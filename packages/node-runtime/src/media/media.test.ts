import { describe, expect, it } from "vitest";
import {
  buildFilterChain,
  defaultThresholdFor,
  isEmptySelection,
  parseShowInfo,
  summarizeFfmpegFailure,
} from "./scene-detect.js";
import { parseProbe } from "./probe.js";
import { isUrl, parseYtDlpPrints, sourceTypeOf } from "./ingest.js";
import { clusterByPhash } from "./dedup.js";
import { hammingDistance, phash } from "./phash.js";

describe("parseShowInfo", () => {
  const STDERR = `
[Parsed_showinfo_1 @ 0x55c] n:   0 pts:  88200 pts_time:1.84 pos: 9999 fmt:yuvj420p
[Parsed_showinfo_1 @ 0x55c] n:   3 pts: 176400 pts_time:12.5 pos: 1234 fmt:yuvj420p
ffmpeg version 8.1.1 Copyright (c)
`;

  it("reads frame index and timestamp", () => {
    expect(parseShowInfo(STDERR)).toEqual([
      { idx: 0, source_pts: 1.84, t_ms: 1840 },
      { idx: 3, source_pts: 12.5, t_ms: 12500 },
    ]);
  });

  it("ignores lines that are not showinfo", () => {
    expect(parseShowInfo("ffmpeg version 8.1.1\nsomething else")).toEqual([]);
  });

  it("skips a showinfo line missing pts_time", () => {
    expect(parseShowInfo("[Parsed_showinfo_1 @ 0x1] n: 4 fmt:yuvj420p")).toEqual([]);
  });
});

describe("buildFilterChain", () => {
  it("normalises framerate before detecting, in both detectors", () => {
    expect(buildFilterChain("scene", 0.3)).toBe("fps=30,select='gt(scene,0.3)',showinfo");
    expect(buildFilterChain("scdet", 5)).toBe("fps=30,scdet=threshold=5:sc_pass=1,showinfo");
  });

  it("keeps the two threshold scales apart", () => {
    // 0-1 for `scene`, 0-100 for `scdet`. Mixing them silently changes nothing
    // visible and everything about the output.
    expect(defaultThresholdFor("scene")).toBe(0.3);
    expect(defaultThresholdFor("scdet")).toBe(5);
  });
});

describe("parseProbe", () => {
  it("reads duration and stream layout", () => {
    const out = parseProbe(
      JSON.stringify({
        format: { duration: "708.07" },
        streams: [{ codec_type: "video", codec_name: "h264" }, { codec_type: "audio" }],
      }),
    );
    expect(out).toEqual({ durationS: 708.07, hasAudio: true, hasVideo: true, codec: "h264" });
  });

  it("reports zero for a duration-less container rather than NaN", () => {
    expect(parseProbe(JSON.stringify({ format: {}, streams: [{ codec_type: "audio" }] })).durationS).toBe(0);
  });

  it("accepts a video with no audio track", () => {
    // The hosted engine refuses these. A silent screen recording is an
    // ordinary thing to annotate locally, so the decision moves to the caller.
    const out = parseProbe(JSON.stringify({ format: { duration: "10" }, streams: [{ codec_type: "video" }] }));
    expect(out.hasAudio).toBe(false);
    expect(out.hasVideo).toBe(true);
  });

  it("fails loudly on unparseable output", () => {
    expect(() => parseProbe("not json")).toThrow(/unparseable/);
  });
});

describe("source classification", () => {
  it("recognises a local path", () => {
    expect(isUrl("/Users/x/talk.mp4")).toBe(false);
    expect(sourceTypeOf("/Users/x/talk.mp4")).toBe("file");
  });

  it("names the platforms it treats specially", () => {
    expect(sourceTypeOf("https://www.youtube.com/watch?v=abc")).toBe("youtube");
    expect(sourceTypeOf("https://youtu.be/abc")).toBe("youtube");
    expect(sourceTypeOf("https://vimeo.com/123")).toBe("vimeo");
    expect(sourceTypeOf("https://example.com/a.mp4")).toBe("url");
  });
});

describe("parseYtDlpPrints", () => {
  it("takes the path from the last line and the title from the one above", () => {
    expect(parseYtDlpPrints("Me at the zoo\n/tmp/w/source.mp4\n")).toEqual({
      title: "Me at the zoo",
      filePath: "/tmp/w/source.mp4",
    });
  });

  it("treats yt-dlp's literal NA as no title", () => {
    expect(parseYtDlpPrints("NA\n/tmp/w/source.mp4").title).toBeNull();
  });
});

describe("clusterByPhash", () => {
  const f = (idx: number, hash: string) => ({ idx, t_ms: idx * 1000, hash });

  it("keeps the first frame of a shot and drops its near-duplicates", () => {
    const out = clusterByPhash([f(0, "0000000000000000"), f(1, "0000000000000001"), f(2, "ffffffffffffffff")], 5);
    expect(out.map((d) => d.kept)).toEqual([true, false, true]);
    expect(out.map((d) => d.cluster_id)).toEqual([0, 0, 1]);
  });

  it("keeps everything when nothing is close enough", () => {
    const out = clusterByPhash([f(0, "0000000000000000"), f(1, "ffffffffffffffff")], 5);
    expect(out.every((d) => d.kept)).toBe(true);
  });

  it("preserves the raw frame index, which evidence anchors depend on", () => {
    const out = clusterByPhash([f(7, "0000000000000000"), f(11, "0000000000000000")], 5);
    expect(out.map((d) => d.idx)).toEqual([7, 11]);
  });

  it("compares against cluster representatives, not the previous frame", () => {
    // A slow drift: each step is within tolerance of the one before, but the
    // last is far from the first. Chaining would collapse them all into one.
    const drift = ["0000000000000000", "0000000000000007", "0000000000000077", "0000000000000777"];
    const out = clusterByPhash(drift.map((h, i) => f(i, h)), 5);
    expect(out.filter((d) => d.kept).length).toBeGreaterThan(1);
  });
});

describe("phash", () => {
  const solid = (w: number, h: number, v: number) => ({
    width: w,
    height: h,
    data: new Uint8Array(w * h * 4).fill(v),
  });

  it("gives identical hashes to identical images", () => {
    expect(phash(solid(64, 64, 128))).toBe(phash(solid(64, 64, 128)));
  });

  it("is 16 hex characters", () => {
    expect(phash(solid(64, 64, 40))).toMatch(/^[0-9a-f]{16}$/);
  });

  it("measures distance between hashes", () => {
    expect(hammingDistance("0000000000000000", "0000000000000000")).toBe(0);
    expect(hammingDistance("0000000000000000", "000000000000000f")).toBe(4);
    expect(hammingDistance("0000000000000000", "ffffffffffffffff")).toBe(64);
  });

  it("refuses to compare hashes of different lengths", () => {
    expect(() => hammingDistance("00", "0000")).toThrow(/length mismatch/);
  });
});

describe("summarizeFfmpegFailure", () => {
  const REAL = `ffmpeg version 8.1.1 Copyright (c) 2000-2026 the FFmpeg developers
  built with Apple clang version 17.0.0
  configuration: --prefix=/opt/homebrew/Cellar/ffmpeg/8.1.1 --enable-libx264 --enable-gpl
  libavutil      60. 26.101 / 60. 26.101
Stream #0:0[0x1](und): Video: av1 (libdav1d) (Main), yuv420p(tv, smpte170m/bt470bg/bt709), 320x240
[mjpeg @ 0x1] ff_frame_thread_encoder_init failed
[vost#0:0/mjpeg @ 0x1] Error while opening encoder - maybe incorrect parameters
Conversion failed!`;

  it("keeps the encoder error and drops the banner and build flags", () => {
    const out = summarizeFfmpegFailure(REAL);
    expect(out).toContain("Error while opening encoder");
    expect(out).not.toContain("--enable-libx264");
    expect(out).not.toContain("libavutil");
  });

  it("does not mistake a build flag for the error, when a real one is present", () => {
    // The flag list genuinely contains the word "error", which is why it is
    // excluded by name rather than by keyword.
    const out = summarizeFfmpegFailure(
      "configuration: --enable-error-resilience\n[mjpeg @ 0x1] Error while opening encoder",
    );
    expect(out).toBe("[mjpeg @ 0x1] Error while opening encoder");
  });

  it("falls back to the first line rather than to nothing", () => {
    // A message with no recognisable error line still has to say something.
    expect(summarizeFfmpegFailure("configuration: --enable-gpl")).toBe("configuration: --enable-gpl");
  });

  it("falls back to the first line when nothing looks like an error", () => {
    expect(summarizeFfmpegFailure("something odd\nand more")).toBe("something odd");
  });
});

describe("isEmptySelection", () => {
  it("recognises ffmpeg saying the filter matched nothing", () => {
    // A single-shot recording produces exactly this, plus a non-zero exit.
    expect(isEmptySelection("[vf#0:0] No filtered frames for output stream, trying to initialize anyway.")).toBe(true);
    expect(isEmptySelection("[out#0/image2] Nothing was written into output file")).toBe(true);
  });

  it("does not swallow a genuine decode failure", () => {
    expect(isEmptySelection("[mjpeg @ 0x1] Error while opening encoder")).toBe(false);
    expect(isEmptySelection("Invalid data found when processing input")).toBe(false);
  });
});
