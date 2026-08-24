import { copyFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import jpeg from "jpeg-js";
import type { ArtifactStore, DedupFrameEntry, FramesManifest } from "@lirovo/contracts";
import { ARTIFACT_PATHS, LirovoError } from "@lirovo/contracts";
import { pMap } from "../p-map.js";
import { hammingDistance, phash } from "./phash.js";

/** Two frames within this distance are the same shot as far as a model cares. */
export const DEFAULT_PHASH_HAMMING = 5;

export interface DedupInput {
  readonly runId: string;
  readonly hamming?: number;
  readonly concurrency?: number;
  readonly signal: AbortSignal;
}

export interface DedupDeps {
  readonly store: ArtifactStore;
}

export interface DedupResult {
  readonly keptCount: number;
  readonly droppedCount: number;
  readonly params: { phash_hamming: number };
}

/**
 * Assign each frame to the first cluster it is close enough to.
 *
 * Sequential and greedy on purpose. A frame is compared against cluster
 * REPRESENTATIVES rather than every previous frame, which keeps a long
 * recording from turning into a quadratic comparison, and the first frame of a
 * shot is the representative because it is the one whose timestamp a viewer
 * would expect to jump to.
 */
export const clusterByPhash = (
  hashes: readonly { idx: number; t_ms: number; hash: string }[],
  maxDistance: number,
): DedupFrameEntry[] => {
  const representatives: { hash: string; clusterId: number }[] = [];
  const out: DedupFrameEntry[] = [];

  for (const frame of hashes) {
    const match = representatives.find((rep) => hammingDistance(rep.hash, frame.hash) <= maxDistance);
    if (match === undefined) {
      const clusterId = representatives.length;
      representatives.push({ hash: frame.hash, clusterId });
      out.push({ idx: frame.idx, t_ms: frame.t_ms, kept: true, cluster_id: clusterId, phash: frame.hash });
    } else {
      out.push({ idx: frame.idx, t_ms: frame.t_ms, kept: false, cluster_id: match.clusterId, phash: frame.hash });
    }
  }
  return out;
};

/**
 * Collapse near-identical frames before anything expensive looks at them.
 *
 * This is the stage that decides how much the run costs: a talking-head
 * recording emits a scene change every time the speaker gestures, and every
 * one of those would otherwise become a model call.
 */
export const dedupFrames = async (input: DedupInput, deps: DedupDeps): Promise<DedupResult> => {
  const maxDistance = input.hamming ?? DEFAULT_PHASH_HAMMING;
  const manifestText = await deps.store.getText(input.runId, ARTIFACT_PATHS.framesManifest);
  if (manifestText === null) {
    throw new LirovoError("ARTIFACT_MISSING", "no frames manifest — run scene detection first", { stage: "dedup" });
  }
  const manifest = JSON.parse(manifestText) as FramesManifest;

  const hashes = await pMap(
    manifest.raw,
    async (entry) => {
      if (input.signal.aborted) throw new LirovoError("CANCELLED", "dedup cancelled", { stage: "dedup" });
      const bytes = await readFile(deps.store.resolve(input.runId, ARTIFACT_PATHS.rawFrame(entry.idx)));
      const decoded = jpeg.decode(bytes, { useTArray: true });
      return {
        idx: entry.idx,
        t_ms: entry.t_ms,
        hash: phash({ width: decoded.width, height: decoded.height, data: decoded.data }),
      };
    },
    input.concurrency ?? 8,
  );

  const dedup = clusterByPhash(hashes, maxDistance);
  const kept = dedup.filter((d) => d.kept);

  const dedupDir = path.dirname(deps.store.resolve(input.runId, ARTIFACT_PATHS.dedupFrame(0)));
  await mkdir(dedupDir, { recursive: true });
  await pMap(
    kept,
    async (entry) =>
      // The raw index is preserved in the deduped filename so an evidence
      // anchor like `frame#000042` means the same frame everywhere.
      copyFile(
        deps.store.resolve(input.runId, ARTIFACT_PATHS.rawFrame(entry.idx)),
        deps.store.resolve(input.runId, ARTIFACT_PATHS.dedupFrame(entry.idx)),
      ),
    8,
  );

  const updated: FramesManifest = {
    ...manifest,
    dedup,
    params: { ...manifest.params, phash_hamming: maxDistance },
  };
  await deps.store.put(input.runId, ARTIFACT_PATHS.framesManifest, `${JSON.stringify(updated, null, 2)}\n`);

  return {
    keptCount: kept.length,
    droppedCount: dedup.length - kept.length,
    params: { phash_hamming: maxDistance },
  };
};
