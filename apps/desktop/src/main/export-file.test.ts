import { afterEach, expect, it } from "vitest";
import { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { saveExportFile } from "./export-file.js";

const directories: string[] = [];
async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), "lirovo-save-test-"));
  directories.push(root);
  const library = path.join(root, "library");
  await mkdir(library);
  return { root, library };
}
afterEach(async () => { for (const directory of directories.splice(0)) await rm(directory, { recursive: true, force: true }); });

it("writes the complete content atomically and leaves no temporary files", async () => {
  const { root, library } = await fixture();
  const target = path.join(root, "report.json");
  await writeFile(target, "old");
  const content = JSON.stringify({ value: -2.5, text: "Été\n完整", nested: [false, null] });
  await saveExportFile(target, content, [library]);
  expect(await readFile(target, "utf8")).toBe(content);
  expect((await readdir(root)).sort()).toEqual(["library", "report.json"]);
});
it("rejects the library including symlinked parents without touching its database", async () => {
  const { root, library } = await fixture();
  await writeFile(path.join(library, "lirovo.db"), "original database");
  await symlink(library, path.join(root, "alias"));
  for (const parent of [library, path.join(root, "alias")]) {
    await expect(saveExportFile(path.join(parent, "lirovo.db"), "bad", [library])).rejects.toThrow(/outside Lirovo/);
  }
  expect(await readFile(path.join(library, "lirovo.db"), "utf8")).toBe("original database");
});
it("rejects directories and symbolic-link destinations", async () => {
  const { root, library } = await fixture();
  await writeFile(path.join(root, "original"), "untouched");
  await symlink(path.join(root, "original"), path.join(root, "alias"));
  await expect(saveExportFile(path.join(root, "alias"), "bad", [library])).rejects.toThrow(/regular file/);
  await expect(saveExportFile(library, "bad", [])).rejects.toThrow(/regular file/);
  expect(await readFile(path.join(root, "original"), "utf8")).toBe("untouched");
});
