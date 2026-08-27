import { createHash } from "node:crypto";
import { copyFile, mkdir, rename, rm, stat, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ArtifactStore } from "@lirovo/contracts";
import { LirovoError } from "@lirovo/contracts";

const sha256 = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");

/**
 * Artifacts on the local filesystem, laid out exactly like the hosted R2 tree.
 *
 * Keeping the same relative paths means an artifact produced here and one
 * produced by the hosted pipeline can be diffed byte for byte, which is what
 * makes the golden fixture usable as a regression gate.
 *
 * Every write lands through a temp file and a rename. A rename within one
 * filesystem is atomic, so a crash mid-write leaves either the previous
 * artifact or nothing — never a half-written file that a resumed run would
 * happily treat as complete.
 */
/**
 * A run id is a directory name, so it has to look like one.
 *
 * `run_` and lowercase base32 is the whole alphabet `makeId` produces. The
 * check is here rather than only at the IPC boundary because this is the layer
 * that joins the value into a path: a caller that forgets to validate should
 * not be able to reach outside `runs/` with `..`, and there is more than one
 * caller.
 */
const RUN_ID = /^run_[0-9a-hjkmnp-tv-z]+$/;

const dirName = (runId: string): string => {
  if (!RUN_ID.test(runId)) {
    throw new LirovoError("ARTIFACT_MISSING", `not a run id: ${JSON.stringify(runId)}`);
  }
  return runId;
};

export const createFsArtifactStore = (root: string): ArtifactStore => {
  const dirFor = (runId: string): string => path.join(root, dirName(runId));
  const full = (runId: string, relPath: string): string => {
    const target = path.resolve(dirFor(runId), relPath);
    const base = path.resolve(dirFor(runId));
    // Belt and braces: the id is validated above, and the joined path is
    // checked to still be inside the run's own directory. `relPath` comes from
    // ARTIFACT_PATHS today, and this stays true if it ever comes from anywhere
    // else.
    if (target !== base && !target.startsWith(`${base}${path.sep}`)) {
      throw new LirovoError("ARTIFACT_MISSING", `path escapes the run directory: ${relPath}`);
    }
    return target;
  };

  const writeAtomic = async (target: string, write: (tmp: string) => Promise<void>): Promise<void> => {
    await mkdir(path.dirname(target), { recursive: true });
    const tmp = `${target}.${process.pid}.tmp`;
    try {
      await write(tmp);
      await rename(tmp, target);
    } catch (error) {
      await rm(tmp, { force: true });
      if (error instanceof Error && "code" in error && error.code === "ENOSPC") {
        throw new LirovoError("DISK_FULL", `no space left writing ${target}`);
      }
      throw error;
    }
  };

  return {
    resolve: full,

    async put(runId, relPath, body) {
      const bytes = typeof body === "string" ? new TextEncoder().encode(body) : body;
      await writeAtomic(full(runId, relPath), (tmp) => writeFile(tmp, bytes));
      return { sha256: sha256(bytes), bytes: bytes.byteLength };
    },

    async putFile(runId, relPath, absSourcePath) {
      const target = full(runId, relPath);
      await writeAtomic(target, (tmp) => copyFile(absSourcePath, tmp));
      // Hash after the rename so the digest describes what is actually stored.
      const bytes = await readFile(target);
      return { sha256: sha256(bytes), bytes: bytes.byteLength };
    },

    async get(runId, relPath) {
      try {
        return await readFile(full(runId, relPath));
      } catch {
        return null;
      }
    },

    async getText(runId, relPath) {
      const bytes = await this.get(runId, relPath);
      return bytes === null ? null : new TextDecoder().decode(bytes);
    },

    async exists(runId, relPath) {
      try {
        await stat(full(runId, relPath));
        return true;
      } catch {
        return false;
      }
    },

    async verify(runId, relPath, expected) {
      const bytes = await this.get(runId, relPath);
      return bytes !== null && sha256(bytes) === expected;
    },

    async remove(runId) {
      const dir = dirFor(runId);
      let freedBytes = 0;
      try {
        const walk = async (current: string): Promise<void> => {
          const { readdir } = await import("node:fs/promises");
          for (const entry of await readdir(current, { withFileTypes: true })) {
            const child = path.join(current, entry.name);
            if (entry.isDirectory()) await walk(child);
            else freedBytes += (await stat(child)).size;
          }
        };
        await walk(dir);
      } catch {
        // Nothing to measure; the removal below is still the right thing to do.
      }
      await rm(dir, { recursive: true, force: true });
      return { freedBytes };
    },
  };
};
