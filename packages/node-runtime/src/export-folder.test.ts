import { afterEach, describe, expect, it } from "vitest";
import { chmod, mkdtemp, mkdir, readFile, readdir, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { tmpdir, hostname } from "node:os";
import { join, dirname } from "node:path";
import { openDatabase } from "./store/db.js";
import { resolvePaths } from "./paths.js";
import { persistExtraction } from "./store/results.js";
import { reviewValue } from "./store/review.js";
import { createRunExportFolder } from "./export-folder.js";

const roots: string[] = [];
const digest = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
async function fixture() {
  const root = await realpath(await mkdtemp(join(tmpdir(), "lirovo-export-test-"))); roots.push(root);
  const paths = resolvePaths({ LIROVO_DATA_DIR: join(root, "profile") });
  const db = openDatabase(paths.dbFile);
  for (const id of ["run_001", "run_002"]) {
    db.prepare("INSERT INTO sources VALUES (?,?,?,?,?,?,?,?,?)").run(id, "file", "/external/original.mp4", null, id === "run_001" ? "Été 東京" : "UNRELATED PRIVATE SOURCE", 10, 1, 1, 1);
    db.prepare("INSERT INTO runs(id,source_id,status,created_at) VALUES (?,?,?,?)").run(id, id, "succeeded", 1);
    persistExtraction(db, { runId: id, data: { title: id === "run_001" ? "Original 東京" : "OTHER PRIVATE RESULT" }, evidenceByField: new Map([["title", [{ modality: "audio", sourceRef: "asr#seg_1", tStart: 1, tEnd: 3, quote: "Bonjour 東京", nodeKey: null }]]]) });
  }
  db.exec("INSERT INTO settings VALUES ('secret-token','DO NOT EXPORT',1)");
  const id = db.prepare<[], { observation_id: string }>("SELECT observation_id FROM extracted_values WHERE run_id='run_001'").get()!.observation_id;
  reviewValue(db, { runId: "run_001", observationId: id, action: "correct", expectedRevision: 0, value: "Corrected 東京", note: "Full audit note" });
  reviewValue(db, { runId: "run_001", observationId: id, action: "reject", expectedRevision: 1 });
  db.close();
  const run = join(paths.runs, "run_001");
  const entries: Record<string, string | Buffer> = {
    "transcripts/asr.json": JSON.stringify({ text: "Bonjour 東京\n".repeat(1000), segments: [{ id: "seg_1", tStart: 1, tEnd: 3, text: "Bonjour 東京" }] }),
    "transcripts/transcript.md": "# Transcript\nBonjour 東京",
    "graph/kg.json": JSON.stringify({ nodes: [{ key: "a", label: "Été" }, { key: "b", label: "東京" }], edges: [{ source: "a", target: "b", label: "mentions" }] }),
    "graph/kg.compact.json": JSON.stringify({ nodes: ["a", "b"], edges: [["a", "b"]] }),
    "frames/manifest.json": JSON.stringify({ raw: [{ idx: 0, t_ms: 1000 }], dedup: [{ idx: 0, kept: true, t_ms: 1000 }] }),
    "frames/raw/000000.jpg": Buffer.from([255, 216, 0, 127, 255, 217]),
    "frames/dedup/000000.jpg": Buffer.from([255, 216, 0, 127, 255, 217]),
    "vision/analyses.json": JSON.stringify({ description: "Complete saved visual analysis" }),
    "normalized/video.mp4": Buffer.from([0, 0, 0, 32, 102, 116, 121, 112]),
    "normalized/audio.flac": Buffer.from("fLaC\u0000complete binary"),
    "source/downloaded.mp4": Buffer.from("retained source bytes"),
  };
  for (const [name, content] of Object.entries(entries)) { await mkdir(dirname(join(run, name)), { recursive: true }); await writeFile(join(run, name), content); }
  return { root, paths, run, entries, destination: join(root, "export") };
}
afterEach(async () => { for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true }); });

describe("complete extraction folders", () => {
  it("preserves every artifact byte, transcript segment, graph edge and review without other runs or settings", async () => {
    const { paths, entries, destination } = await fixture();
    const result = await createRunExportFolder(paths, "run_001", destination);
    const manifest = JSON.parse(await readFile(join(destination, "lirovo-extraction.json"), "utf8"));
    expect(manifest).toMatchObject({ format: "lirovo-extraction-folder", version: 1, scope: "all", runId: "run_001", externalOriginalMediaIncluded: false });
    expect(result.files).toBe(Object.keys(entries).length + 4);
    expect(manifest.files).toHaveLength(result.files);
    expect(result.bytes).toBe(manifest.files.reduce((sum: number, file: { bytes: number }) => sum + file.bytes, 0));
    for (const file of manifest.files) {
      const bytes = await readFile(join(destination, file.path));
      expect(bytes.length).toBe(file.bytes); expect(digest(bytes)).toBe(file.sha256);
    }
    for (const [name, bytes] of Object.entries(entries)) expect(await readFile(join(destination, "artifacts", name))).toEqual(Buffer.from(bytes));
    const recordText = await readFile(join(destination, "records.json"), "utf8");
    expect(recordText).not.toMatch(/UNRELATED PRIVATE|OTHER PRIVATE|DO NOT EXPORT/);
    const records = JSON.parse(recordText);
    expect(records.runs).toHaveLength(1); expect(records.sources).toHaveLength(1);
    expect(records.review_events).toHaveLength(2); expect(records.review_corrections).toHaveLength(1);
    const report = JSON.parse(await readFile(join(destination, "results.json"), "utf8"));
    expect(report.result.title).toBe("Corrected 東京");
    expect(report.audit[0].review.originalValue).toBe("Original 東京");
    expect(report.audit[0].review.decision).toBe("rejected");
    expect(report.observations[0].evidence[0]).toMatchObject({ start: 1, end: 3, sourceRef: "asr#seg_1" });
    expect(manifest.sections.knowledgeGraph.files).toEqual(["artifacts/graph/kg.json", "artifacts/graph/kg.compact.json"]);
    expect(await readdir(destination)).not.toContain(".lirovo-incomplete");
  });
  it("declares unavailable analysis without fabricating empty transcript or graph files", async () => {
    const { paths, destination } = await fixture();
    const result = await createRunExportFolder(paths, "run_002", destination);
    expect(result.files).toBe(4);
    expect(result.warnings.join("\n")).toContain("knowledgeGraph: no saved files");
    const manifest = JSON.parse(await readFile(join(destination, "lirovo-extraction.json"), "utf8"));
    expect(manifest.sections.transcript).toEqual({ available: false, files: [] });
    expect(await readdir(destination)).not.toContain("artifacts");
  });
  it("exports database-only history when the entire runs directory is absent", async () => {
    const { paths, destination } = await fixture();
    await rm(paths.runs, { recursive: true });
    expect((await createRunExportFolder(paths, "run_002", destination)).files).toBe(4);
  });
  it.each(["{", "null", '{"raw":[null]}', '{"raw":[],"dedup":[null]}'])("explains malformed frame manifest %s before publishing", async content => {
    const { paths, run, root, destination } = await fixture();
    await writeFile(join(run, "frames/manifest.json"), content);
    await expect(createRunExportFolder(paths, "run_001", destination)).rejects.toThrow(/saved frame manifest/);
    expect(await readdir(root)).not.toContain("export");
  });
  it("never overwrites an existing folder or writes inside protected roots", async () => {
    const { paths, root, destination } = await fixture();
    await mkdir(destination); await writeFile(join(destination, "keep"), "original");
    await expect(createRunExportFolder(paths, "run_001", destination)).rejects.toThrow(/EEXIST/);
    await expect(createRunExportFolder(paths, "run_001", join(paths.data, "export"))).rejects.toThrow(/outside/);
    const app = join(root, "application"); await mkdir(app);
    await expect(createRunExportFolder(paths, "run_001", join(app, "export"), [app])).rejects.toThrow(/outside/);
    expect(await readFile(join(destination, "keep"), "utf8")).toBe("original");
  });
  it("refuses source and destination-parent symlinks", async () => {
    const { paths, root, run, destination } = await fixture();
    const alias = join(root, "alias"); await symlink(root, alias);
    await expect(createRunExportFolder(paths, "run_001", join(alias, "export"))).rejects.toThrow(/Symbolic links/);
    await symlink(join(run, "transcripts/asr.json"), join(run, "linked.json"));
    await expect(createRunExportFolder(paths, "run_001", destination)).rejects.toThrow(/Symbolic links/);
  });
  it("refuses missing recorded artifacts and missing manifest-referenced images", async () => {
    const { paths, run, destination } = await fixture();
    await writeFile(join(run, "frames/manifest.json"), JSON.stringify({ raw: [{ idx: 12 }] }));
    await expect(createRunExportFolder(paths, "run_001", destination)).rejects.toThrow(/frame.*missing/i);
    const db = openDatabase(paths.dbFile);
    db.exec("INSERT INTO artifacts VALUES ('missing','run_001','graph','graph/missing.json','abc',1,'application/json',1)"); db.close();
    await expect(createRunExportFolder(paths, "run_001", destination)).rejects.toThrow(/recorded artifact is missing/);
  });
  it.each(["lease", "queue", "process"])("refuses active %s writers before reserving a folder", async kind => {
    const { paths, root, destination } = await fixture();
    const db = openDatabase(paths.dbFile);
    if (kind === "lease") db.prepare("UPDATE runs SET lease_expires_at=? WHERE id='run_001'").run(Math.floor(Date.now() / 1000) + 60);
    if (kind === "queue") db.exec("INSERT INTO extraction_queue VALUES ('run_003','{}','queued',1,1,NULL)");
    if (kind === "process") db.prepare("INSERT INTO extraction_processes VALUES ('run_001',?,?,?,1,0)").run(`${hostname()}:${process.pid}:fixture`, hostname(), process.pid);
    db.close();
    await expect(createRunExportFolder(paths, "run_001", destination)).rejects.toThrow(/Stop active|subprocess/);
    expect(await readdir(root)).not.toContain("export");
  });
  it("rejects traversal, unsafe ids and unknown extractions", async () => {
    const { paths, root, destination } = await fixture();
    await expect(createRunExportFolder(paths, "../profile", destination)).rejects.toThrow(/Invalid extraction/);
    await expect(createRunExportFolder(paths, "run_999", destination)).rejects.toThrow(/no longer exists/);
    await expect(createRunExportFolder(paths, "run_001", `${root}/../escape`)).rejects.toThrow(/traversal/);
  });
  it.skipIf(process.platform === "win32" || process.getuid?.() === 0)("retains an incomplete marker and source bytes after a real permission failure", async () => {
    const { paths, run, destination } = await fixture();
    const source = join(run, "transcripts/asr.json");
    const before = await readFile(source);
    await chmod(source, 0);
    try {
      await expect(createRunExportFolder(paths, "run_001", destination)).rejects.toThrow(/incomplete export/);
      expect(await readFile(join(destination, ".lirovo-incomplete"), "utf8")).toContain("did not finish");
      expect(await readdir(destination)).not.toContain("lirovo-extraction.json");
    } finally { await chmod(source, 0o600); }
    expect(await readFile(source)).toEqual(before);
  });
});
