import { createHash, randomBytes } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, rename, rm, stat, chmod } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { LirovoError, type AbortSignalLike } from "@lirovo/contracts";
import { sha256FromSumsFile, type Installable, type LirovoPaths } from "@lirovo/core";

export interface InstallProgress {
  readonly received: number;
  /** Null when the server does not say, which some CDNs do not. */
  readonly total: number | null;
}

export interface InstallResult {
  readonly path: string;
  readonly bytes: number;
  readonly sha256: string;
  /** True when the file was already there and already correct. */
  readonly alreadyPresent: boolean;
}

/**
 * Fetch a file, prove it is the right one, then put it in place.
 *
 * Three properties, none optional:
 *
 *   verified   the hash is computed from the bytes as they arrive, and a
 *              mismatch deletes what was written. This app EXECUTES some of
 *              what it downloads; an unverified binary is a supply chain with
 *              no chain in it.
 *   atomic     written to `.part` and renamed only after the hash matches, so
 *              a download killed halfway leaves no file that looks installed.
 *   resumable  by being cheap to repeat: an install that is already correct
 *              costs one stat and one hash, not another download.
 */
export const installArtifact = async (
  item: Installable,
  paths: LirovoPaths,
  options: {
    readonly onProgress?: (p: InstallProgress) => void;
    readonly signal?: AbortSignalLike;
    readonly fetch?: typeof globalThis.fetch;
  } = {},
): Promise<InstallResult> => {
  const doFetch = options.fetch ?? globalThis.fetch;
  const dest = path.join(paths.data, item.relPath);
  // Unique per call. A single `${dest}.part` meant two concurrent installs of
  // the same artifact wrote into one file and each deleted the other's work
  // while hashing a different stream — and whichever renamed last published
  // bytes nobody had verified as a whole.
  const partial = `${dest}.part-${randomBytes(6).toString("hex")}`;

  const expected = typeof item.sha256 === "string" ? item.sha256 : await resolveSum(item, doFetch);

  // Already correct is the common case on a second launch, and re-downloading
  // 574MB to discover that would be the wrong kind of thorough.
  const existing = await hashOf(dest).catch(() => null);
  if (existing !== null && existing.sha256 === expected) {
    return { path: dest, bytes: existing.bytes, sha256: existing.sha256, alreadyPresent: true };
  }

  await mkdir(path.dirname(dest), { recursive: true });
  await rm(partial, { force: true });

  const response = await doFetch(item.url, {
    ...(options.signal === undefined ? {} : { signal: options.signal as AbortSignal }),
  }).catch((error: unknown) => {
    throw new LirovoError(
      "DOWNLOAD_FAILED",
      `could not reach ${new URL(item.url).hostname}: ${error instanceof Error ? error.message : String(error)}`,
    );
  });
  if (!response.ok || response.body === null) {
    throw new LirovoError("DOWNLOAD_FAILED", `${item.url} returned ${response.status}`);
  }

  const declared = Number(response.headers.get("content-length") ?? "");
  const total = Number.isFinite(declared) && declared > 0 ? declared : item.bytes;

  const hash = createHash("sha256");
  let received = 0;
  const source = Readable.fromWeb(response.body as never);
  source.on("data", (chunk: Buffer) => {
    hash.update(chunk);
    received += chunk.length;
    options.onProgress?.({ received, total });
  });

  try {
    await pipeline(source, createWriteStream(partial));
  } catch (error) {
    await rm(partial, { force: true });
    throw new LirovoError(
      "DOWNLOAD_FAILED",
      `${item.label} did not download completely: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const actual = hash.digest("hex");
  if (actual !== expected) {
    // Deleted, not kept for inspection: a file with the wrong hash that stays
    // on disk is a file some later code path will find and use.
    await rm(partial, { force: true });
    throw new LirovoError(
      "ARTIFACT_CHECKSUM_MISMATCH",
      `${item.label} downloaded but its checksum does not match — expected ${expected}, got ${actual}`,
    );
  }

  if (item.executable) await chmod(partial, 0o755);
  await rename(partial, dest);
  return { path: dest, bytes: received, sha256: actual, alreadyPresent: false };
};

const resolveSum = async (item: Installable, doFetch: typeof globalThis.fetch): Promise<string> => {
  const spec = item.sha256 as { fromSumsFile: string; name: string };
  const response = await doFetch(spec.fromSumsFile);
  if (!response.ok) {
    throw new LirovoError("DOWNLOAD_FAILED", `could not read the checksums for ${item.label}`);
  }
  const found = sha256FromSumsFile(await response.text(), spec.name);
  if (found === null) {
    // Refusing rather than installing unverified: the publisher changed the
    // layout of its own checksum file, and guessing past that is exactly the
    // moment a supply chain breaks.
    throw new LirovoError(
      "ARTIFACT_CHECKSUM_MISMATCH",
      `${spec.name} is not listed in ${spec.fromSumsFile} — refusing to install something unverified`,
    );
  }
  return found;
};

const hashOf = async (file: string): Promise<{ sha256: string; bytes: number }> => {
  const { size } = await stat(file);
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk as Buffer);
  return { sha256: hash.digest("hex"), bytes: size };
};
