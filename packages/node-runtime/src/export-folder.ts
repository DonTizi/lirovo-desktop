import { open, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { LirovoPaths } from "@lirovo/core";
import { ARTIFACT_PATHS, type FramesManifest } from "@lirovo/contracts";
import { openDatabase } from "./store/db.js";
import { buildRunExport } from "./export.js";
import { INCOMPLETE, assertLibraryIdle, exists, noSymlinks, reserveDirectory, inventory, copyVerified, hashFile, verifyFiles, publish, type VerifiedFile } from "./verified-transfer.js";

export interface RunFolderExport { directory: string; files: number; bytes: number; warnings: string[] }

/** All SQL identifiers are fixed here; a run id is only ever a bound value. */
function runRecords(db: DatabaseSync, runId: string): Record<string, unknown[]> {
  const records: Record<string, unknown[]> = {};
  records.runs = db.prepare("SELECT * FROM runs WHERE id=?").all(runId);
  if (!records.runs.length) throw new Error("This extraction no longer exists.");
  records.sources = db.prepare("SELECT * FROM sources WHERE id IN (SELECT source_id FROM runs WHERE id=?)").all(runId);
  for (const table of ["run_stage_attempts", "artifacts", "run_manifests", "evidence", "extracted_values", "extraction_queue", "run_archives", "extraction_processes"]) {
    records[table] = db.prepare(`SELECT * FROM ${table} WHERE run_id=?`).all(runId);
  }
  for (const table of ["value_evidence", "review_signals", "review_events"]) {
    records[table] = db.prepare(`SELECT * FROM ${table} WHERE observation_id IN (SELECT observation_id FROM extracted_values WHERE run_id=?)`).all(runId);
  }
  records.review_corrections = db.prepare("SELECT * FROM review_corrections WHERE event_id IN (SELECT id FROM review_events WHERE observation_id IN (SELECT observation_id FROM extracted_values WHERE run_id=?))").all(runId);
  records.schema_revisions = db.prepare(`SELECT * FROM schema_revisions WHERE id IN (
    SELECT schema_revision_id FROM runs WHERE id=? UNION SELECT schema_revision_id FROM run_manifests WHERE run_id=?
    UNION SELECT schema_revision_id FROM review_events WHERE observation_id IN (SELECT observation_id FROM extracted_values WHERE run_id=?))`).all(runId, runId, runId);
  const schemaIds = new Set((records.schema_revisions as { schema_id: string }[]).map(row => row.schema_id));
  records.schemas = [...schemaIds].flatMap(id => db.prepare("SELECT * FROM schemas WHERE id=?").all(id));
  return records;
}

/** Native main supplies an exclusive destination. Binary content never traverses renderer IPC. */
export async function createRunExportFolder(paths: LirovoPaths, runId: string, destination: string, protectedRoots: readonly string[] = []): Promise<RunFolderExport> {
  if (!/^run_[0-9a-hjkmnp-tv-z]+$/.test(runId)) throw new Error("Invalid extraction ID.");
  await noSymlinks(paths.data); await noSymlinks(paths.dbFile);
  if (await exists(paths.runs)) await noSymlinks(paths.runs);
  if (resolve(paths.dbFile) !== join(resolve(paths.data), "lirovo.db") || resolve(paths.runs) !== join(resolve(paths.data), "runs")) throw new Error("Unsupported library layout.");
  // Open/migrate the report reader before taking the long-lived write fence.
  const reader = openDatabase(paths.dbFile);
  const lock = new DatabaseSync(paths.dbFile);
  let target: string | null = null;
  try {
    lock.exec("PRAGMA busy_timeout=1000; BEGIN IMMEDIATE");
    assertLibraryIdle(lock);
    const records = runRecords(lock, runId);
    const source = join(paths.runs, runId);
    const entries = await exists(source) ? await inventory(source) : [];
    const warnings = [
      "Includes all stored results, rejected/original values, review history, prompts, run settings, source paths, media and host/process diagnostics. Inspect before sharing; this folder is not encrypted.",
      "External original files outside the extraction directory are not copied or downloaded. Stored source and normalized media are included when available.",
      "Only saved data is exported. This is a portable analysis snapshot, not an importable library backup or a guarantee of model accuracy.",
    ];
    for (const record of records.artifacts as { rel_path: string }[]) {
      if (!entries.includes(record.rel_path)) throw new Error(`A recorded artifact is missing: ${record.rel_path}`);
    }
    if (entries.includes(ARTIFACT_PATHS.framesManifest)) {
      let frames: FramesManifest;
      try { frames = JSON.parse(await readFile(join(source, ARTIFACT_PATHS.framesManifest), "utf8")) as FramesManifest; }
      catch { throw new Error("The saved frame manifest could not be read as JSON. Repair or re-extract this source before exporting."); }
      const validIndex = (frame: { idx: number } | null): boolean => !!frame && Number.isSafeInteger(frame.idx) && frame.idx >= 0;
      if (!frames || !Array.isArray(frames.raw) || !frames.raw.every(validIndex) || (frames.dedup !== undefined && (!Array.isArray(frames.dedup) || !frames.dedup.every(frame => validIndex(frame) && typeof frame.kept === "boolean")))) throw new Error("The saved frame manifest is invalid. Repair or re-extract this source before exporting.");
      const expected = [...frames.raw.map(frame => ({ frame, path: ARTIFACT_PATHS.rawFrame(frame.idx) })),
        ...(frames.dedup ?? []).filter(frame => frame.kept).map(frame => ({ frame, path: ARTIFACT_PATHS.dedupFrame(frame.idx) }))];
      for (const entry of expected) {
        if (!Number.isSafeInteger(entry.frame.idx) || entry.frame.idx < 0 || !entries.includes(entry.path)) throw new Error(`A frame referenced by its manifest is missing or invalid: ${entry.path}`);
      }
    }
    const categories = {
      transcript: [ARTIFACT_PATHS.transcript, ARTIFACT_PATHS.transcriptMarkdown],
      frames: entries.filter(entry => entry.startsWith("frames/")),
      knowledgeGraph: [ARTIFACT_PATHS.graph, ARTIFACT_PATHS.graphCompact],
      visualAnalysis: [ARTIFACT_PATHS.vision],
      media: entries.filter(entry => entry.startsWith("normalized/") || (entry.startsWith("source/") && entry !== ARTIFACT_PATHS.sourceManifest)),
    };
    const sections = Object.fromEntries(Object.entries(categories).map(([name, candidates]) => {
      const files = candidates.filter(entry => entries.includes(entry)).map(entry => `artifacts/${entry}`);
      if (!files.length) warnings.push(`${name}: no saved files are available for this extraction.`);
      return [name, { available: files.length > 0, files }];
    }));
    target = await reserveDirectory(destination, [paths.data, ...protectedRoots]);
    const files: VerifiedFile[] = [];
    const write = async (name: string, content: string): Promise<void> => {
      const file = await open(join(target!, name), "wx", 0o600);
      try { await file.writeFile(content); await file.sync(); } finally { await file.close(); }
      files.push({ path: name, ...await hashFile(join(target!, name)) });
    };
    for (const format of ["json", "markdown", "csv"] as const) {
      const report = buildRunExport(reader, runId, { format, scope: "all" });
      await write(`results.${report.extension}`, report.content);
    }
    await write("records.json", JSON.stringify(records, null, 2) + "\n");
    for (const entry of entries) {
      const name = `artifacts/${entry}`;
      const copied = await copyVerified(join(source, entry), join(target, name));
      const original = await hashFile(join(source, entry));
      if (copied.bytes !== original.bytes || copied.sha256 !== original.sha256) throw new Error(`The source changed during export: ${entry}`);
      files.push({ path: name, ...copied });
    }
    if (await exists(source) && JSON.stringify(entries) !== JSON.stringify(await inventory(source))) throw new Error("The extraction's files changed during export.");
    await verifyFiles(target, files, [INCOMPLETE]);
    const manifest = { format: "lirovo-extraction-folder", version: 1, runId, createdAt: new Date().toISOString(),
      databaseVersion: lock.prepare("PRAGMA user_version").get()?.user_version, scope: "all", sections,
      reports: { results: "results.json", reading: "results.md", spreadsheet: "results.csv", records: "records.json" },
      artifactBase: "artifacts/", externalOriginalMediaIncluded: false, files, warnings };
    const control = await open(join(target, "lirovo-extraction.json"), "wx", 0o600);
    try { await control.writeFile(JSON.stringify(manifest, null, 2) + "\n"); await control.sync(); } finally { await control.close(); }
    await publish(target);
    return { directory: target, files: files.length, bytes: files.reduce((sum, file) => sum + file.bytes, 0), warnings };
  } catch (error) {
    throw new Error(`${error instanceof Error ? error.message : String(error)}${target ? ` An incomplete export remains at ${target}; no source data was changed.` : ""}`);
  } finally {
    try { lock.exec("ROLLBACK"); } catch { /* The lock may not have been acquired. */ }
    try { lock.close(); } finally { reader.close(); }
  }
}
