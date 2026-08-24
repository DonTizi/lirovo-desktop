#!/usr/bin/env node
// Compare a local run's frame manifest against the hosted golden reference.
//   node scripts/golden-frames.mjs <run-artifacts-dir>
// Exits non-zero when a signal that SHOULD be stable has moved.
import { readFile } from "node:fs/promises";
import path from "node:path";

const runDir = process.argv[2];
if (!runDir) {
  console.error("usage: node scripts/golden-frames.mjs <run-artifacts-dir>");
  process.exit(2);
}

const read = async (p) => JSON.parse(await readFile(p, "utf8"));
const mine = await read(path.join(runDir, "frames/manifest.json"));
const gold = await read(new URL("../fixtures/hosted-run-3bfaee0f0f3d/frames_manifest.json", import.meta.url));

const key = (f) => `${f.idx}@${f.t_ms}`;
const mineRaw = mine.raw.map(key);
const goldRaw = gold.raw.map(key);
const keptOf = (m) => (m.dedup ?? []).filter((d) => d.kept).length;

const checks = [
  ["raw frame list", JSON.stringify(mineRaw) === JSON.stringify(goldRaw), `${mineRaw.length} vs ${goldRaw.length}`],
  ["kept frame count", keptOf(mine) === keptOf(gold), `${keptOf(mine)} vs ${keptOf(gold)}`],
];

let failed = false;
for (const [name, ok, detail] of checks) {
  console.log(`${ok ? "ok  " : "FAIL"}  ${name.padEnd(18)} ${detail}`);
  if (!ok) failed = true;
}

// Reported, never asserted: pHash follows the JPEG encoder, so it moves with
// an ffmpeg upgrade even when the pipeline is unchanged. See the fixture README.
const goldDedup = new Map((gold.dedup ?? []).map((d) => [d.idx, d]));
const drift = (mine.dedup ?? []).filter((d) => goldDedup.get(d.idx)?.phash !== d.phash);
console.log(`info  phash drift        ${drift.length}/${(mine.dedup ?? []).length} frames (encoder noise, not asserted)`);

process.exit(failed ? 1 : 0);
