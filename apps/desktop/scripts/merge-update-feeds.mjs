#!/usr/bin/env node
/**
 * One update feed out of the per-architecture feeds two runners produced.
 *
 * electron-builder merges the `files:` of several architectures into one
 * `latest-mac.yml` — but only within a single invocation, because that is the
 * only time it knows about more than one. Our arm64 and x64 builds are
 * separate matrix jobs on separate runners, so each writes a complete feed
 * naming only its own two files, under the same name. Whichever is copied
 * second wins and the other architecture vanishes from the feed, with nothing
 * failing anywhere.
 *
 * electron-updater picks by matching "arm64" in the file URL (MacUpdater:
 * arm64 Macs prefer arm64 and accept x64 through Rosetta; x64 Macs exclude
 * arm64 outright), so the merged `files:` list is exactly what it wants.
 *
 * Usage: node merge-update-feeds.mjs <out-dir> <in-dir>...
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { load as yamlLoad, dump as yamlDump } from "js-yaml";

/**
 * The union of every architecture's files, under one version.
 *
 * Deduplicated by url: a file named twice with two different checksums means
 * two different builds are being passed off as one release, and picking a
 * winner silently is how a user downloads a binary whose hash will not match.
 */
export const mergeFeeds = (feeds) => {
  if (feeds.length === 0) throw new Error("no feeds to merge");
  const versions = [...new Set(feeds.map((f) => f.version))];
  if (versions.length > 1) {
    throw new Error(`refusing to merge feeds for different versions: ${versions.join(", ")}`);
  }

  const byUrl = new Map();
  for (const feed of feeds) {
    for (const file of feed.files ?? []) {
      const seen = byUrl.get(file.url);
      if (seen !== undefined && seen.sha512 !== file.sha512) {
        throw new Error(`two different builds both call themselves ${file.url}`);
      }
      byUrl.set(file.url, file);
    }
  }
  const files = [...byUrl.values()].sort((a, b) => a.url.localeCompare(b.url));

  // The legacy single-file fields, for a client too old to read `files`. It
  // gets the x64 zip: an Intel Mac cannot run the arm64 build, while an Apple
  // Silicon Mac runs the x64 one under Rosetta. Wrong-but-runnable beats
  // wrong-and-refuses-to-launch.
  const fallback =
    files.find((f) => f.url.endsWith(".zip") && !f.url.includes("arm64")) ??
    files.find((f) => f.url.endsWith(".zip")) ??
    files[0];

  return {
    version: versions[0],
    files,
    path: fallback.url,
    sha512: fallback.sha512,
    // The earliest, so the date names when the release was cut rather than
    // whichever runner happened to finish last.
    releaseDate: feeds.map((f) => f.releaseDate).filter(Boolean).sort()[0] ?? new Date().toISOString(),
  };
};

const main = () => {
  const [outDir, ...inDirs] = process.argv.slice(2);
  if (!outDir || inDirs.length === 0) {
    console.error("usage: merge-update-feeds.mjs <out-dir> <in-dir>...");
    process.exit(2);
  }

  // Both channels, because a prerelease writes beta-mac.yml and a stable one
  // writes latest-mac.yml, and this must not care which is being cut.
  const names = new Set();
  for (const dir of inDirs) {
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir)) if (/-mac\.yml$/.test(f)) names.add(f);
  }
  if (names.size === 0) {
    console.error("no *-mac.yml found in: " + inDirs.join(", "));
    process.exit(1);
  }

  for (const name of names) {
    const found = inDirs
      .map((d) => path.join(d, name))
      .filter((p) => existsSync(p))
      .map((p) => yamlLoad(readFileSync(p, "utf8")));
    const merged = mergeFeeds(found);
    const dest = path.join(outDir, name);
    writeFileSync(dest, yamlDump(merged, { lineWidth: -1 }));
    console.log(`${name}: ${found.length} feeds -> ${merged.files.length} files`);
    for (const f of merged.files) console.log(`  ${f.url}`);
  }
};

if (import.meta.url === `file://${process.argv[1]}`) main();
