import { describe, expect, it } from "vitest";
import type { ArtifactStore, AsrStrategy, PipelineEvent, SourceManifest, Stage, Transcript } from "@lirovo/contracts";
import { runMediaPipeline, type MediaStages } from "./media-pipeline.js";
import type { StageLedger } from "./ledger.js";

const manifest: SourceManifest = {
  source_type: "file",
  duration_s: 100,
  codec: "h264",
  has_audio: true,
  has_video: true,
  ext: ".mp4",
  title: "talk",
  source_path: "/tmp/talk.mp4",
  content_sha256: "a".repeat(64),
};

const transcript: Transcript = {
  engine: "captions",
  model: null,
  language: "en",
  durationS: 100,
  text: "hello",
  segments: [{ id: "seg_0", speaker: null, tStart: 0, tEnd: 1, text: "hello", words: [] }],
};

/** Records which stages actually executed, as opposed to being served cached. */
const makeStages = (ran: Stage[]): MediaStages => ({
  ingest: async () => {
    ran.push("ingest");
    return { manifest, mediaPath: "/tmp/talk.mp4" };
  },
  normalize: async () => {
    ran.push("normalize");
    return { audio_path: "/a.flac", video_path: "/v.mp4", duration_s: 100, audio_bytes: 1, video_bytes: 1 };
  },
  sceneDetect: async () => {
    ran.push("scene-detect");
    return { rawFrameCount: 10 };
  },
  dedup: async () => {
    ran.push("dedup");
    return { keptCount: 8, droppedCount: 2 };
  },
});

const makeAsr = (ran: Stage[]): AsrStrategy => ({
  name: "fake",
  isAvailable: async () => true,
  transcribe: async () => {
    ran.push("asr");
    return transcript;
  },
});

const store: ArtifactStore = {
  resolve: (runId, rel) => `/tmp/${runId}/${rel}`,
  put: async () => ({ sha256: "x", bytes: 0 }),
  putFile: async () => ({ sha256: "x", bytes: 0 }),
  get: async () => null,
  getText: async () => null,
  exists: async () => false,
  verify: async () => true,
  remove: async () => ({ freedBytes: 0 }),
};

/**
 * A ledger backed by a Map, so a resume can be driven without a database.
 *
 * `begin` remembers which hash an attempt belongs to, the same way the SQLite
 * one writes it on the attempt row: `complete` is only told the stage and the
 * attempt number, so without that the fake would silently record nothing and
 * every resume test would pass for the wrong reason.
 */
const memoryLedger = (): StageLedger & { entries: Map<string, unknown> } => {
  const entries = new Map<string, unknown>();
  const pending = new Map<string, string>();
  let counter = 0;
  return {
    entries,
    cached: (stage, hash) => entries.get(`${stage}:${hash}`) ?? null,
    begin: (stage, hash) => {
      counter += 1;
      pending.set(`${stage}:${counter}`, hash);
      return counter;
    },
    complete: (stage, attempt, outcome) => {
      const hash = pending.get(`${stage}:${attempt}`);
      if (hash !== undefined && outcome.status === "done") entries.set(`${stage}:${hash}`, outcome.output);
    },
  };
};

const run = async (
  ledger: StageLedger,
  ran: Stage[],
  events: PipelineEvent[] = [],
  source = "/tmp/talk.mp4",
): Promise<void> => {
  await runMediaPipeline(
    { runId: "run_1", source, frameCap: 100, signal: new AbortController().signal },
    {
      stages: makeStages(ran),
      asr: makeAsr(ran),
      store,
      now: () => 0,
      sha256: (s) => `sha(${s})`,
      ledger,
      onEvent: (e) => events.push(e),
    },
  );
};

describe("resume", () => {
  it("runs every stage the first time", async () => {
    const ran: Stage[] = [];
    await run(memoryLedger(), ran);
    expect(ran.sort()).toEqual(["asr", "dedup", "ingest", "normalize", "scene-detect"]);
  });

  it("re-runs nothing but ingest when every stage is already recorded", async () => {
    // Ingest is never ledgered: it establishes the identity everything else
    // chains from, and there is no run row to record it against.
    const ledger = memoryLedger();
    await run(ledger, []);

    const ran: Stage[] = [];
    const events: PipelineEvent[] = [];
    await run(ledger, ran, events);

    expect(ran).toEqual(["ingest"]);
    expect(events.filter((e) => e.type === "stage:resumed").map((e) => (e as { stage: Stage }).stage).sort()).toEqual([
      "asr",
      "dedup",
      "normalize",
      "scene-detect",
    ]);
  });

  it("re-runs everything when the source is a different file", async () => {
    // The chain starts at the content hash, so a cache entry from one video
    // can never be served to another.
    const ledger = memoryLedger();
    await run(ledger, []);

    // Same recorded stages, but the ingest of a different file would produce a
    // different manifest hash — simulated by clearing what the chain agreed on.
    ledger.entries.clear();
    const ran: Stage[] = [];
    await run(ledger, ran);
    expect(ran).toContain("asr");
    expect(ran).toContain("normalize");
  });

  it("does not serve a cached stage whose own parameters changed", async () => {
    const ledger = memoryLedger();
    await run(ledger, []);

    const ran: Stage[] = [];
    await runMediaPipeline(
      // frameCap is part of scene-detect's hash, so changing it must redo it.
      { runId: "run_1", source: "/tmp/talk.mp4", frameCap: 999, signal: new AbortController().signal },
      {
        stages: makeStages(ran),
        asr: makeAsr(ran),
        store,
        now: () => 0,
        sha256: (s) => `sha(${s})`,
        ledger,
      },
    );
    expect(ran).toContain("scene-detect");
    // dedup chains from scene-detect, so it has to go again too.
    expect(ran).toContain("dedup");
    // asr does not depend on frameCap and must NOT be redone.
    expect(ran).not.toContain("asr");
  });

  it("records a failed attempt rather than losing why it failed", async () => {
    const completed: { stage: Stage; status: string; code?: string }[] = [];
    const ledger: StageLedger = {
      cached: () => null,
      begin: () => 1,
      complete: (stage, _attempt, outcome) =>
        completed.push({ stage, status: outcome.status, ...(outcome.code ? { code: outcome.code } : {}) }),
    };

    const stages = makeStages([]);
    const failing: MediaStages = {
      ...stages,
      normalize: async () => {
        throw new Error("ffmpeg exploded");
      },
    };

    await expect(
      runMediaPipeline(
        { runId: "run_1", source: "/tmp/talk.mp4", frameCap: 100, signal: new AbortController().signal },
        { stages: failing, asr: makeAsr([]), store, now: () => 0, sha256: (s) => `sha(${s})`, ledger },
      ),
    ).rejects.toThrow(/ffmpeg exploded/);

    expect(completed).toContainEqual({ stage: "normalize", status: "failed", code: "INTERNAL" });
  });
});

describe("nothing is left running when the pipeline returns", () => {
  it("waits for the visual branch even when transcription fails first", async () => {
    // The bug this pins: `Promise.all` rejected the moment ASR threw and left
    // scene-detect running behind it, so the caller closed the database while
    // that stage was still working and its ledger write landed on a closed
    // handle — "scene-detect degraded: database is not open". The stage's real
    // outcome was lost and a failure was reported that never happened.
    let sceneFinished = false;
    const ledger = memoryLedger();

    await expect(
      runMediaPipeline(
        { runId: "run_1", source: "/tmp/talk.mp4", frameCap: 100, signal: new AbortController().signal },
        {
          stages: {
            ingest: async () => ({
              manifest: {
                source_type: "file" as const,
                duration_s: 10,
                codec: "h264",
                has_audio: true,
                has_video: true,
                ext: "mp4",
                title: "talk",
                source_path: "/tmp/talk.mp4",
                content_sha256: "abc",
              },
              mediaPath: "/tmp/talk.mp4",
            }),
            normalize: async () => ({ audio_path: "/a.flac", video_path: "/v.mp4", duration_s: 10 }),
            sceneDetect: async () => {
              await new Promise((r) => setTimeout(r, 30));
              sceneFinished = true;
              return { rawFrameCount: 3, params: { detector: "scene" as const, scene_threshold: 0.3 } };
            },
            dedup: async () => ({ keptCount: 3, droppedCount: 0, params: { phash_hamming: 5 } }),
          },
          asr: {
            name: "fake",
            isAvailable: async () => true,
            transcribe: async () => {
              throw new Error("no transcription strategy succeeded");
            },
          },
          store,
          now: () => 0,
          sha256: (s) => `sha(${s})`,
          ledger,
        },
      ),
    ).rejects.toThrow(/transcription/);

    expect(sceneFinished).toBe(true);
  });
});
