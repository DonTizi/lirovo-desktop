import type { Exec } from "@lirovo/contracts";
import { LirovoError } from "@lirovo/contracts";

interface FfprobeStream {
  codec_type?: string;
  codec_name?: string;
}
interface FfprobeOutput {
  format?: { duration?: string; format_name?: string };
  streams?: FfprobeStream[];
}

export interface ProbeResult {
  readonly durationS: number;
  readonly hasAudio: boolean;
  readonly hasVideo: boolean;
  readonly codec: string | null;
}

/**
 * Read duration and stream layout out of ffprobe's JSON.
 *
 * Note what is NOT rejected here: a source with no audio track. The hosted
 * engine refuses those outright, which is right when every job is billed by
 * the minute and a silent video is almost certainly a mistake. On a desktop a
 * silent screen recording is a perfectly ordinary thing to want annotated, so
 * the caller decides, not the probe.
 */
export const parseProbe = (json: string): ProbeResult => {
  let parsed: FfprobeOutput;
  try {
    parsed = JSON.parse(json) as FfprobeOutput;
  } catch (error) {
    throw new LirovoError("PROBE_FAILED", `ffprobe returned unparseable JSON: ${String(error)}`);
  }

  const streams = parsed.streams ?? [];
  const video = streams.find((s) => s.codec_type === "video");
  const duration = Number(parsed.format?.duration ?? Number.NaN);

  return {
    // A live stream or a duration-less container reports nothing usable. Zero
    // is the honest answer; the caller decides whether that is fatal.
    durationS: Number.isFinite(duration) && duration > 0 ? duration : 0,
    hasAudio: streams.some((s) => s.codec_type === "audio"),
    hasVideo: video !== undefined,
    codec: video?.codec_name ?? null,
  };
};

export const probeMedia = async (exec: Exec, ffprobePath: string, mediaPath: string): Promise<ProbeResult> => {
  const { stdout } = await exec(ffprobePath, [
    "-v", "quiet",
    "-print_format", "json",
    "-show_format",
    "-show_streams",
    mediaPath,
  ]);
  return parseProbe(stdout);
};
