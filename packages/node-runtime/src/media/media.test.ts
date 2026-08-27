import { describe, expect, it } from "vitest";
import {
  buildFilterChain,
  defaultThresholdFor,
  isEmptySelection,
  parseShowInfo,
  summarizeFfmpegFailure,
  LEGACY_RATE_FLAG,
  RATE_FLAG,
  buildSceneDetectArgs,
  rejectsOption,
} from "./scene-detect.js";
import { parseProbe } from "./probe.js";
import { isPartialDownload, isUrl, parseYtDlpPrints, sourceTypeOf } from "./ingest.js";
import { durationTolerance } from "./normalize.js";
import { STALE_AFTER_DAYS, versionAgeDays } from "../binaries.js";
import { explainYtDlpError } from "../asr/captions.js";
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

describe("isPartialDownload", () => {
  it("rejects what yt-dlp leaves mid-download", () => {
    // A file truncated to 40% still probes as the FULL duration, because the
    // header at the front describes a video the file no longer contains — so
    // nothing downstream would catch it.
    expect(isPartialDownload("source.mp4.part")).toBe(true);
    expect(isPartialDownload("source.mp4.ytdl")).toBe(true);
    expect(isPartialDownload("source.f399.mp4")).toBe(true);
    expect(isPartialDownload("source.webm.temp")).toBe(true);
  });

  it("accepts a finished download", () => {
    expect(isPartialDownload("source.mp4")).toBe(false);
    expect(isPartialDownload("source.webm")).toBe(false);
    expect(isPartialDownload("source.m4a")).toBe(false);
  });

  it("does not mistake a version-looking name for a fragment", () => {
    expect(isPartialDownload("source.mp4")).toBe(false);
    expect(isPartialDownload("source.part2.mp4")).toBe(false);
  });
});

describe("durationTolerance", () => {
  it("gives a second of slack to short clips, where rounding dominates", () => {
    expect(durationTolerance(10)).toBe(1);
  });

  it("scales for long recordings, where a second is unreasonably tight", () => {
    expect(durationTolerance(3600)).toBe(72);
  });

  it("would have caught the real case: 19s promised, 6.5s decoded", () => {
    // Measured on a genuinely truncated download.
    expect(19.014 - 6.533).toBeGreaterThan(durationTolerance(19.014));
  });

  it("does not fire on a container that rounds", () => {
    expect(19.014 - 19.013).toBeLessThan(durationTolerance(19.014));
  });
});

describe("versionAgeDays", () => {
  const on = (iso: string): Date => new Date(`${iso}T00:00:00Z`);

  it("reads yt-dlp's date-shaped version", () => {
    expect(versionAgeDays("2026.03.17", on("2026-08-27"))).toBe(163);
    expect(versionAgeDays("2026.08.19", on("2026-08-27"))).toBe(8);
  });

  it("accepts a single-digit month or day", () => {
    expect(versionAgeDays("2026.3.7", on("2026-03-17"))).toBe(10);
  });

  it("returns null for a version that is not a date", () => {
    // ffmpeg's "8.1.1" is a version, not a build date, and ageing it is
    // meaningless — only yt-dlp goes stale in a way that stops it working.
    expect(versionAgeDays("8.1.1")).toBeNull();
    expect(versionAgeDays(null)).toBeNull();
  });

  it("flags what the user actually hit", () => {
    expect(versionAgeDays("2026.03.17", on("2026-08-27"))).toBeGreaterThan(STALE_AFTER_DAYS);
  });
});

describe("explainYtDlpError", () => {
  it("turns a status code into the thing to do about it", () => {
    // "HTTP Error 403: Forbidden" is accurate and useless.
    const out = explainYtDlpError("unable to download video data: HTTP Error 403: Forbidden");
    expect(out).toContain("out-of-date yt-dlp");
    expect(out).toContain("403");
  });

  it("separates an unavailable video from a broken tool", () => {
    const out = explainYtDlpError("Video unavailable");
    expect(out).toContain("private, deleted, or restricted");
    expect(out).not.toContain("out-of-date");
  });

  it("names rate limiting as something that passes", () => {
    expect(explainYtDlpError("HTTP Error 429: Too Many Requests")).toContain("wait a few minutes");
  });

  it("passes an unrecognised failure through rather than inventing a cause", () => {
    expect(explainYtDlpError("something nobody has seen")).toBe("something nobody has seen");
  });
});

describe("ffmpeg rate flag", () => {
  it("uses the flag ffmpeg 9 actually accepts", () => {
    // Reproduced against ffmpeg 9.0.1: `-vsync vfr` exits with
    // "Unrecognized option 'vsync' / Error splitting the argument list",
    // which is the failure that silently emptied every scene-detect run.
    const args = buildSceneDetectArgs("/in.mp4", "fps=30", RATE_FLAG, "/out/%06d.jpg");
    expect(args).toContain("-fps_mode");
    expect(args).not.toContain("-vsync");
  });

  it("keeps the flag, because dropping it duplicates every kept frame", () => {
    const args = buildSceneDetectArgs("/in.mp4", "fps=30", RATE_FLAG, "/out/%06d.jpg");
    expect(args[args.indexOf("-fps_mode") + 1]).toBe("vfr");
  });

  it("recognises ffmpeg refusing a flag it has never heard of", () => {
    expect(rejectsOption("Unrecognized option 'fps_mode'.\nError splitting", "fps_mode")).toBe(true);
    expect(rejectsOption("Conversion failed!", "fps_mode")).toBe(false);
  });

  it("has a legacy flag to fall back to, for a binary older than 5.1", () => {
    expect(LEGACY_RATE_FLAG).toEqual(["-vsync", "vfr"]);
  });
});
