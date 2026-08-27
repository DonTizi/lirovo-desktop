import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { AsrRequest, AsrStrategy, Exec, Transcript } from "@lirovo/contracts";
import { LirovoError } from "@lirovo/contracts";
import type { LirovoPaths } from "@lirovo/core";
import { resolveBinary } from "../binaries.js";
import { parseVtt } from "./vtt.js";

/**
 * The subtitle languages to ask for, most wanted first.
 *
 * Deliberately no globs. `en.*` looks harmless and matches `en-de`, which is an
 * auto-TRANSLATED track, not English — asking for a glob is how you end up
 * transcribing a machine translation of the talk instead of the talk.
 */
export const subtitleLanguages = (lang: string): string =>
  [...new Set([`${lang}-orig`, lang, "en-orig", "en"])].join(",");

/**
 * yt-dlp is chatty: version nags and impersonation notices drown the one line
 * that says what actually went wrong. Keep the ERROR lines, drop the rest.
 */
export const summarizeYtDlpFailure = (message: string): string => {
  const errors = message
    .split("\n")
    .filter((line) => line.trim().startsWith("ERROR:"))
    .map((line) => line.replace(/^\s*ERROR:\s*/, "").trim());
  if (errors.length === 0) return message.split("\n")[0]?.trim() ?? message;
  // Summarising only. Explaining here too meant a caller that also explained
  // wrapped an already-explained string in its own explanation: "that link is
  // not one yt-dlp knows how to open (that link is not one yt-dlp knows how to
  // open (Unsupported URL: …))".
  return errors.join("; ");
};

/**
 * Say what the user can do about it.
 *
 * yt-dlp reports what the server said, which is accurate and useless: "HTTP
 * Error 403: Forbidden" gives a person nothing to act on. Each of these
 * conditions has a different fix, and naming the fix is the whole job of an
 * error message.
 */
export const explainYtDlpError = (message: string): string => {
  if (/HTTP Error 429|Too Many Requests/i.test(message)) {
    return `the platform is rate-limiting downloads from this address — wait a few minutes (${message})`;
  }
  if (/HTTP Error 403|Forbidden|Sign in to confirm|nsig extraction/i.test(message)) {
    return `the platform refused the download. This is usually an out-of-date yt-dlp: YouTube changes its player often and old builds stop working. Update it, then try again (${message})`;
  }
  if (/Video unavailable|This video is unavailable|Private video|members-only/i.test(message)) {
    return `this video is not available to download — it may be private, deleted, or restricted (${message})`;
  }
  if (/is not a valid URL|Unsupported URL/i.test(message)) {
    return "that link is not one yt-dlp knows how to open — it needs a page with a video on it";
  }
  // Named separately from a refusal: nothing about the video is wrong, the
  // address simply does not exist, and telling someone to update yt-dlp for a
  // typo sends them to fix the wrong thing.
  const host = /Failed to resolve '([^']+)'/.exec(message)?.[1];
  if (host !== undefined) return `${host} could not be reached — check the address, and the network`;
  if (/nodename nor servname|getaddrinfo|Temporary failure in name resolution/i.test(message)) {
    return "that address could not be reached — check the link, and the network";
  }
  return message;
};

export interface CaptionsDeps {
  readonly exec: Exec;
  readonly paths: LirovoPaths;
  readonly env?: NodeJS.ProcessEnv;
}

/**
 * Native subtitles, via yt-dlp.
 *
 * The cheapest transcript there is: no model loads, no GPU, no seconds of
 * audio decoded. On a captioned conference talk this returns in the time it
 * takes to fetch one file, and it is the reason a first extraction can feel
 * instant instead of costing four minutes of local Whisper.
 *
 * It only applies to URLs, and only when the platform actually carries
 * subtitles, so it is the first link of a chain rather than the whole story.
 */
export const createCaptionsStrategy = (deps: CaptionsDeps): AsrStrategy => ({
  name: "captions",

  async isAvailable(req: AsrRequest): Promise<boolean> {
    if (req.sourceKind !== "url") return false;
    return (await resolveBinary("yt-dlp", deps.paths, deps.env)) !== null;
  },

  async transcribe(req: AsrRequest): Promise<Transcript> {
    const ytDlp = await resolveBinary("yt-dlp", deps.paths, deps.env);
    if (ytDlp === null) throw new LirovoError("DEPENDENCY_MISSING", "yt-dlp not found", { stage: "asr" });

    const lang = req.language ?? "en";
    const dir = await mkdtemp(path.join(tmpdir(), "lirovo-subs-"));
    try {
      // A non-zero exit is NOT decisive here. yt-dlp reports one failed track
      // and still writes the others, so the file on disk is the real verdict
      // and the exit code is only used to explain an empty directory.
      let failure: string | null = null;
      await deps.exec(
        ytDlp.path,
        [
          "--skip-download",
          "--write-subs",
          "--write-auto-subs",
          // Ask for the requested language in every regional spelling, then
          // fall back to English, then to whatever single track exists.
          "--sub-langs",
          subtitleLanguages(lang),
          "--convert-subs",
          "vtt",
          "--no-playlist",
          "--no-progress",
          // Silences the "your version is older than 90 days" nag that would
          // otherwise be the first thing in every failure message.
          "--no-update",
          "-o",
          path.join(dir, "subs.%(ext)s"),
          req.sourceUri,
        ],
        { cwd: dir, signal: req.signal as AbortSignal, timeoutMs: 120_000 },
      ).catch((error: unknown) => {
        if (error instanceof LirovoError && error.code === "CANCELLED") throw error;
        failure = explainYtDlpError(summarizeYtDlpFailure(error instanceof Error ? error.message : String(error)));
      });

      const vttFile = (await readdir(dir)).find((f) => f.endsWith(".vtt"));
      if (vttFile === undefined) {
        throw new LirovoError(
          "TRANSCRIBE_FAILED",
          failure ?? "no subtitle track published for this video",
          { stage: "asr" },
        );
      }

      const parsed = parseVtt(await readFile(path.join(dir, vttFile), "utf8"));
      if (parsed.segments.length === 0) {
        throw new LirovoError("TRANSCRIBE_FAILED", "subtitle track was empty", { stage: "asr" });
      }

      return {
        engine: "captions",
        // The published track, not something we produced: naming it keeps the
        // run manifest honest about where the words came from.
        model: vttFile,
        language: /\.([a-z]{2}(-[A-Za-z]+)?)\.vtt$/.exec(vttFile)?.[1] ?? null,
        durationS: parsed.durationS,
        text: parsed.text,
        segments: parsed.segments,
      };
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  },
});
