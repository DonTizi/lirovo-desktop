import { randomUUID } from "node:crypto";
import { lstat, realpath, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

async function canonical(target: string): Promise<string> {
  try { return await realpath(target); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    const parent = path.dirname(target);
    if (parent === target) throw error;
    return path.join(await canonical(parent), path.basename(target));
  }
}

/** Native-selected destinations still must not overwrite the live library. */
export async function saveExportFile(destination: string, content: string, protectedRoots: readonly string[]): Promise<void> {
  const parent = await realpath(path.dirname(destination));
  const target = path.join(parent, path.basename(destination));
  for (const root of protectedRoots) {
    const relative = path.relative(await canonical(path.resolve(root)), target);
    if (relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative))) {
      throw new Error("Choose a destination outside Lirovo’s application and library folders.");
    }
  }
  const existing = await lstat(target).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return null;
    throw error;
  });
  if (existing && (!existing.isFile() || existing.isSymbolicLink())) {
    throw new Error("Choose a regular file, not a folder or symbolic link.");
  }
  const temporary = path.join(parent, `.lirovo-export-${randomUUID()}.tmp`);
  try {
    await writeFile(temporary, content, { encoding: "utf8", flag: "wx", mode: 0o600 });
    await rename(temporary, target);
  } catch (error) {
    await unlink(temporary).catch(() => undefined);
    throw error;
  }
}
