import { randomBytes } from "node:crypto";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import type { PipelineEvent } from "@lirovo/contracts";
import { isLirovoError, makeId } from "@lirovo/contracts";
import { runMediaPipeline, type MediaPipelineResult } from "@lirovo/core";
import {
  buildAsrChain,
  buildMediaStages,
  createFsArtifactStore,
  realExec,
  resolvePaths,
} from "@lirovo/node-runtime";
import { EXIT, type ExitCode } from "../exit-codes.js";

export const DEFAULT_FRAME_CAP = 2000;

export interface ExtractOptions {
  readonly source: string;
  readonly json: boolean;
  readonly frameCap: number;
  readonly noInference: boolean;
}

const humanMs = (ms: number): string => (ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`);

/**
 * Progress on stderr, result on stdout.
 *
 * That split is what makes `lirovo extract --json | jq` work while the user
 * still watches the stages go by.
 */
const renderEvent = (event: PipelineEvent): string | null => {
  switch (event.type) {
    case "stage:start":
      return `  ${event.stage} …`;
    case "stage:done":
      return `  ${event.stage} done in ${humanMs(event.ms)}`;
    case "stage:degraded":
      return `  ${event.stage} degraded: ${event.message}`;
    default:
      return null;
  }
};

const renderResult = (runId: string, result: MediaPipelineResult): string => {
  const lines: string[] = [];
  lines.push(`run ${runId}`);
  lines.push(`  source     ${result.manifest.source_type}  ${result.manifest.title ?? "(untitled)"}`);
  lines.push(`  duration   ${result.manifest.duration_s.toFixed(1)}s`);
  lines.push(`  transcript ${result.transcript.engine}  ${result.transcript.segments.length} segments  ${result.transcript.text.length} chars`);
  lines.push(
    result.rawFrameCount === 0
      ? "  frames     none"
      : `  frames     ${result.rawFrameCount} detected → ${result.keptFrameCount} kept (${result.droppedFrameCount} near-duplicates dropped)`,
  );
  for (const d of result.degraded) lines.push(`  degraded   ${d.stage}: ${d.message}`);
  return lines.join("\n");
};

export const extractCommand = async (
  opts: ExtractOptions,
  out: (s: string) => void,
  errOut: (s: string) => void,
): Promise<ExitCode> => {
  const paths = resolvePaths();
  await mkdir(paths.runs, { recursive: true });
  const store = createFsArtifactStore(paths.runs);
  const runId = makeId("run", randomBytes(10));

  const controller = new AbortController();
  // Ctrl-C has to reach the child processes, not just this one: ffmpeg and
  // yt-dlp keep running otherwise and keep the run directory locked.
  const onSigint = (): void => {
    errOut("\ncancelling…");
    controller.abort();
  };
  process.once("SIGINT", onSigint);

  try {
    const stages = await buildMediaStages({ exec: realExec, store, paths });
    const asr = buildAsrChain({ exec: realExec, paths });

    const result = await runMediaPipeline(
      { runId, source: opts.source, frameCap: opts.frameCap, signal: controller.signal },
      {
        stages,
        asr,
        store,
        now: () => Date.now(),
        onEvent: (event) => {
          const line = renderEvent(event);
          if (line !== null && !opts.json) errOut(line);
        },
      },
    );

    if (opts.json) {
      out(
        JSON.stringify(
          {
            ok: true,
            run_id: runId,
            artifacts_dir: path.join(paths.runs, runId),
            source: result.manifest,
            transcript: {
              engine: result.transcript.engine,
              model: result.transcript.model,
              language: result.transcript.language,
              segments: result.transcript.segments.length,
              chars: result.transcript.text.length,
            },
            frames: {
              detected: result.rawFrameCount,
              kept: result.keptFrameCount,
              dropped: result.droppedFrameCount,
            },
            degraded: result.degraded,
          },
          null,
          2,
        ),
      );
    } else {
      out(renderResult(runId, result));
      out(`  artifacts  ${path.join(paths.runs, runId)}`);
    }
    return EXIT.ok;
  } catch (error) {
    const payload = isLirovoError(error)
      ? error.toJSON()
      : { code: "INTERNAL" as const, message: String(error), context: {} };
    if (opts.json) out(JSON.stringify({ ok: false, run_id: runId, error: payload }, null, 2));
    else errOut(`${payload.code}: ${payload.message}`);
    return payload.code === "CANCELLED" ? EXIT.cancelled : EXIT.failed;
  } finally {
    process.removeListener("SIGINT", onSigint);
  }
};
