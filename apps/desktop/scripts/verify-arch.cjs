"use strict";

/**
 * Refuse to ship a bundle whose tools are the wrong architecture.
 *
 * This is not hypothetical. Declaring `arch: [arm64, x64]` in the mac target
 * made one invocation package both architectures out of a single
 * `resources/bin`, and the x64 DMG went out with arm64 ffmpeg and arm64
 * whisper-cli inside an x86_64 app. Every step reported success. The only
 * symptom would have been "Bad CPU type in executable" on an Intel Mac, hours
 * after the release.
 *
 * `Arch` is electron-builder's enum: 0 = ia32, 1 = x64, 3 = arm64.
 */

const { execFileSync } = require("node:child_process");
const { readdirSync, existsSync } = require("node:fs");
const path = require("node:path");

const WANTED = { 1: "x86_64", 3: "arm64" };

exports.default = async function verifyArch(context) {
  const wanted = WANTED[context.arch];
  if (wanted === undefined) return;

  const binDir = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`, "Contents", "Resources", "bin");
  if (!existsSync(binDir)) {
    throw new Error(`no bundled tools at ${binDir} — run collect-binaries before packaging`);
  }

  const wrong = [];
  for (const name of readdirSync(binDir)) {
    const file = path.join(binDir, name);
    const described = execFileSync("file", [file], { encoding: "utf8" });
    // Universal binaries name every slice they carry, so containing the wanted
    // one is the test rather than equalling it.
    if (!described.includes(wanted)) wrong.push(`${name} (${described.trim().split(":").slice(1).join(":").trim()})`);
  }

  if (wrong.length > 0) {
    throw new Error(
      `packing ${wanted} but these bundled tools are not ${wanted}:\n  ${wrong.join("\n  ")}\n` +
        `Run: node scripts/collect-binaries.mjs --${context.arch === 3 ? "arm64" : "x64"} after clearing resources/bin`,
    );
  }

  process.stdout.write(`  • bundled tools verified  arch=${wanted} count=${readdirSync(binDir).length}\n`);
};
