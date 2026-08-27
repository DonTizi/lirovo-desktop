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

/**
 * Verified, like everything else here.
 *
 * This project publishes no checksum file, so the digests are pinned in the
 * repo instead — computed once from the assets at the tag above, and a change
 * to any of them is a reviewable diff rather than a silent swap. It matters
 * more here than anywhere: these two are chmod +x, signed with a Developer ID
 * and notarised, so Gatekeeper trusts them because WE vouched for them. An
 * architecture check is not a provenance check.
 */
const FFMPEG_SHA256 = {
  "ffmpeg-darwin-arm64": "9f865039102a1139c7057d7f21ddaacd106d602fa3af1f99b70f43d520439b8c",
  "ffmpeg-darwin-x64": "4a4a968b98859588e98500ae25973d80a5ca5eed0724222b9f76360dcb72a001",
  "ffprobe-darwin-arm64": "05a26b32c32115785d48b01601e104712bbc6c2b1d363b9cf44c42232684e25e",
  "ffprobe-darwin-x64": "ce5414269f0efa1e88b5e23b57f801d5b9a40be554716544936e0332b4601a62",
};

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

/**
 * Is the right thing already here?
 *
 * "Right" includes the architecture. Testing only for existence meant a switch
 * from --x64 to --arm64 reported "already here" over the leftover x86_64
 * binaries and bundled them — the afterPack guard caught it at package time,
 * but a collector that hands back the wrong file is the bug, and the guard is
 * the net.
 */
const present = async (name, expectedSha = null) => {
  const file = path.join(OUT, name);
  try {
    if ((await stat(file)).size === 0) return false;
  } catch {
    return false;
  }

  const wanted = arch === "arm64" ? "arm64" : "x86_64";
  const { stdout } = await run("file", [file]);
  if (!stdout.includes(wanted)) {
    // Wrong architecture: remove it so the fetch below has somewhere to land.
    say(`  ${name.padEnd(12)} present but not ${wanted} — replacing`);
    await rm(file, { force: true });
    return false;
  }

  // A cached file has to clear the same bar as a fresh one. Skipping the hash
  // for something already on disk means a build machine that was tampered with
  // once stays tampered with, and every later run signs it again.
  if (expectedSha !== null && (await sha256(file)) !== expectedSha) {
    say(`  ${name.padEnd(12)} present but the hash does not match — replacing`);
    await rm(file, { force: true });
    return false;
  }
  return true;
};

/* --------------------------------------------------------------- ffmpeg */

const collectFfmpeg = async () => {
  for (const tool of ["ffmpeg", "ffprobe"]) {
    const asset = `${tool}-darwin-${arch}`;
    const expected = FFMPEG_SHA256[asset];
    if (expected === undefined) throw new Error(`no pinned checksum for ${asset}`);

    if (await present(tool, expected)) {
      say(`  ${tool.padEnd(12)} already here, hash verified`);
      continue;
    }

    say(`  ${tool.padEnd(12)} fetching darwin-${arch}`);
    const dest = path.join(OUT, tool);
    await download(`${FFMPEG_RELEASE}/${asset}`, dest);

    const actual = await sha256(dest);
    if (actual !== expected) {
      await rm(dest, { force: true });
      throw new Error(`${asset} checksum mismatch — expected ${expected}, got ${actual}`);
    }
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
/**
 * The commit the tag pointed at when it was pinned.
 *
 * Tags move. Upstream can repoint v1.9.3 and every build after that silently
 * compiles different source — which then gets signed with our identity.
 */
const WHISPER_COMMIT = "371b5a7561823ab2bb32142d2751e35e7534727b";

const collectWhisper = async () => {
  if (await present("whisper-cli")) {
    say("  whisper-cli  already here");
    return;
  }
  const work = await mkdtemp(path.join(tmpdir(), "whisper-build-"));
  try {
    say(`  whisper-cli  building ${WHISPER_TAG} for ${arch}`);
    await run("git", ["clone", "--depth", "1", "--branch", WHISPER_TAG, WHISPER_REPO, work]);
    const { stdout: head } = await run("git", ["rev-parse", "HEAD"], { cwd: work });
    if (head.trim() !== WHISPER_COMMIT) {
      throw new Error(
        `${WHISPER_TAG} now points at ${head.trim()}, not the pinned ${WHISPER_COMMIT} — refusing to build unreviewed source`,
      );
    }
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

/**
 * Pinned, like the other two.
 *
 * `releases/latest` made the checksum prove only that the binary and its sums
 * file came from the same release — never that anyone had reviewed that
 * release. Whatever happened to be newest when the job ran is what got signed
 * with a Developer ID, and the same commit built a different DMG on a
 * different day. Bumping this is now a commit somebody can read.
 */
const YT_DLP_TAG = "2026.08.19";
const YT_DLP_RELEASE = `https://github.com/yt-dlp/yt-dlp/releases/download/${YT_DLP_TAG}`;
const YT_DLP = `${YT_DLP_RELEASE}/yt-dlp_macos`;
const YT_DLP_SUMS = `${YT_DLP_RELEASE}/SHA2-256SUMS`;

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
