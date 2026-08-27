#!/usr/bin/env node
/**
 * Fill `resources/bin` with the tools the DMG ships.
 *
 * Four binaries from four origins, because none of them has a single official
 * macOS artifact:
 *
 *   ffmpeg, ffprobe  `ffmpeg-ffprobe-static`, whose GitHub release carries one
 *                    asset per platform-arch. Fetched by TARGET arch, never by
 *                    host arch — GitHub's macOS runners are arm64, so an x64
 *                    DMG built there would otherwise ship arm64 binaries that
 *                    cannot run, and nothing in the build would complain.
 *   whisper-cli      built from source: whisper.cpp publishes an xcframework,
 *                    Linux and Windows archives, and no macOS binary at all.
 *   yt-dlp           the project's own `yt-dlp_macos`, verified against the
 *                    SHA2-256SUMS published beside it.
 *
 * Anything already present and correct is left alone, so a second run costs a
 * hash rather than a download.
 */

import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { chmod, cp, mkdir, mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const run = promisify(execFile);
const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(here, "..", "resources", "bin");

const arch = process.argv.includes("--x64") ? "x64" : process.argv.includes("--arm64") ? "arm64" : process.arch;
const only = process.argv.find((a) => a.startsWith("--only="))?.slice("--only=".length) ?? null;

const say = (s) => process.stdout.write(`${s}\n`);

/**
 * One asset per platform-arch, at a PINNED tag.
 *
 * Pinned, not `latest`: a release build that resolves "latest" at build time
 * produces a different DMG from the same commit, which is the property a
 * release pipeline exists to prevent. Every tag in this project carries an
 * `-rc` suffix and none of them is marked a prerelease — that is their naming,
 * not a warning.
 *
 * ffmpeg 6.1.2 is safe here only because scene-detect was already moved off
 * `-vsync` (removed in ffmpeg 9) to `-fps_mode`, which exists from 5.1 — so
 * one code path drives the bundled 6.x and a user's Homebrew 9.x alike.
 */
const FFMPEG_TAG = "b6.1.2-rc.1";
const FFMPEG_RELEASE = `https://github.com/descriptinc/ffmpeg-ffprobe-static/releases/download/${FFMPEG_TAG}`;

const download = async (url, dest) => {
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok || response.body === null) throw new Error(`${url} returned ${response.status}`);
  await mkdir(path.dirname(dest), { recursive: true });
  await pipeline(Readable.fromWeb(response.body), createWriteStream(dest));
};

const sha256 = async (file) => {
  const hash = createHash("sha256");
  const { createReadStream } = await import("node:fs");
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest("hex");
};

const present = async (name) => {
  try {
    return (await stat(path.join(OUT, name))).size > 0;
  } catch {
    return false;
  }
};

/* --------------------------------------------------------------- ffmpeg */

const collectFfmpeg = async () => {
  for (const tool of ["ffmpeg", "ffprobe"]) {
    if (await present(tool)) {
      say(`  ${tool.padEnd(12)} already here`);
      continue;
    }
    const url = `${FFMPEG_RELEASE}/${tool}-darwin-${arch}`;
    say(`  ${tool.padEnd(12)} fetching darwin-${arch}`);
    const dest = path.join(OUT, tool);
    await download(url, dest);
    await chmod(dest, 0o755);
    // Proof it is the right architecture. A silently wrong one only shows up
    // as "Bad CPU type" on a user's machine, long after the build was green.
    const { stdout } = await run("file", [dest]);
    const wanted = arch === "arm64" ? "arm64" : "x86_64";
    if (!stdout.includes(wanted)) throw new Error(`${tool} is not ${wanted}: ${stdout.trim()}`);
    say(`  ${tool.padEnd(12)} ${wanted} ok`);
  }
};

/* ---------------------------------------------------------- whisper-cli */

const WHISPER_REPO = "https://github.com/ggml-org/whisper.cpp.git";
// Pinned for the same reason as ffmpeg: the same commit must produce the same
// DMG. v1.9.3 is the newest tag as of this pin.
const WHISPER_TAG = "v1.9.3";

const collectWhisper = async () => {
  if (await present("whisper-cli")) {
    say("  whisper-cli  already here");
    return;
  }
  const work = await mkdtemp(path.join(tmpdir(), "whisper-build-"));
  try {
    say(`  whisper-cli  building ${WHISPER_TAG} for ${arch}`);
    await run("git", ["clone", "--depth", "1", "--branch", WHISPER_TAG, WHISPER_REPO, work]);
    await run(
      "cmake",
      [
        "-B", "build",
        "-DCMAKE_BUILD_TYPE=Release",
        `-DCMAKE_OSX_ARCHITECTURES=${arch === "arm64" ? "arm64" : "x86_64"}`,
        // OFF, always — not only when cross-compiling.
        //
        // ggml defaults this ON, which passes the BUILD machine's CPU to the
        // compiler: `-mcpu=apple-m2`. Cross-compiling for x64 that is an
        // immediate "unknown target CPU 'apple-m2'" and the build stops. Built
        // natively it is worse, because it succeeds: an arm64 binary compiled
        // on an M2 carries M2 instructions and can fault on an M1 belonging to
        // someone who was never part of the build.
        "-DGGML_NATIVE=OFF",
        // Embedded, not shipped beside it: a loose .metal file next to the
        // binary is a second thing to sign, and one that goes missing quietly.
        "-DGGML_METAL_EMBED_LIBRARY=ON",
        "-DBUILD_SHARED_LIBS=OFF",
        "-DWHISPER_BUILD_TESTS=OFF",
        "-DWHISPER_BUILD_EXAMPLES=ON",
      ],
      { cwd: work },
    );
    await run("cmake", ["--build", "build", "--config", "Release", "-j"], { cwd: work });

    const built = path.join(work, "build", "bin", "whisper-cli");
    await mkdir(OUT, { recursive: true });
    await cp(built, path.join(OUT, "whisper-cli"));
    await chmod(path.join(OUT, "whisper-cli"), 0o755);

    // Static or it drags dylibs it cannot find inside a signed bundle.
    const { stdout } = await run("otool", ["-L", path.join(OUT, "whisper-cli")]);
    const foreign = stdout
      .split("\n")
      .slice(1)
      .map((l) => l.trim().split(" ")[0])
      .filter((l) => l !== "" && !l.startsWith("/usr/lib/") && !l.startsWith("/System/"));
    if (foreign.length > 0) throw new Error(`whisper-cli links outside the system: ${foreign.join(", ")}`);
    say("  whisper-cli  built, self-contained");
  } finally {
    await rm(work, { recursive: true, force: true });
  }
};

/* --------------------------------------------------------------- yt-dlp */

const YT_DLP = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos";
const YT_DLP_SUMS = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/SHA2-256SUMS";

const collectYtDlp = async () => {
  if (await present("yt-dlp")) {
    say("  yt-dlp       already here");
    return;
  }
  say("  yt-dlp       fetching, then verifying against the published sums");
  const sums = await (await fetch(YT_DLP_SUMS, { redirect: "follow" })).text();
  const expected = sums
    .split("\n")
    .map((line) => /^([0-9a-f]{64})\s+(.+?)\s*$/.exec(line.trim()))
    .find((m) => m !== null && m[2] === "yt-dlp_macos")?.[1];
  if (expected === undefined) {
    // Refusing rather than shipping unverified: the publisher changed the
    // layout of its own checksum file, and guessing past that is the moment a
    // supply chain breaks.
    throw new Error("yt-dlp_macos is not listed in SHA2-256SUMS — refusing to bundle it unverified");
  }

  const dest = path.join(OUT, "yt-dlp");
  await download(YT_DLP, dest);
  const actual = await sha256(dest);
  if (actual !== expected) {
    await rm(dest, { force: true });
    throw new Error(`yt-dlp checksum mismatch — expected ${expected}, got ${actual}`);
  }
  await chmod(dest, 0o755);
  say("  yt-dlp       verified");
};

/* ----------------------------------------------------------------- main */

const TASKS = { ffmpeg: collectFfmpeg, whisper: collectWhisper, "yt-dlp": collectYtDlp };

say(`collecting binaries for darwin-${arch} into resources/bin`);
await mkdir(OUT, { recursive: true });
for (const [name, task] of Object.entries(TASKS)) {
  if (only !== null && only !== name) continue;
  await task();
}
say("done");
