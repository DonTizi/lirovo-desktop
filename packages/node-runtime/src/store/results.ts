import { randomBytes } from "node:crypto";
import type { EvidenceDraft, RunManifest } from "@lirovo/contracts";
import { makeId } from "@lirovo/contracts";
import { deriveReviewSignals, leafPaths } from "@lirovo/core";
import type { Db } from "./db.js";

const newId = (kind: Parameters<typeof makeId>[0]): string => makeId(kind, randomBytes(10));
const nowS = (): number => Math.floor(Date.now() / 1000);

export interface PersistInput {
  readonly runId: string;
  readonly data: unknown;
  readonly evidenceByField: ReadonlyMap<string, readonly EvidenceDraft[]>;
}

export interface PersistResult {
  readonly values: number;
  readonly grounded: number;
  readonly evidenceRows: number;
}

/**
 * Write the extraction as values, evidence and review signals.
 *
 * One transaction: a value without its evidence is worse than no value at all,
 * because the interface would present it as grounded.
 *
 * Every leaf of `data` becomes a row, including the ones the model cited
 * nothing for. Those are exactly the values a reviewer needs to see, and
 * dropping them would make the result look better grounded than it is.
 */
export const persistExtraction = (db: Db, input: PersistInput): PersistResult => {
  const paths = leafPaths(input.data);
  const insertValue = db.prepare(
    `INSERT INTO extracted_values (observation_id, run_id, field_path, value_json, proposition_key, created_at)
     VALUES (?, ?, ?, ?, NULL, ?)`,
  );
  const insertEvidence = db.prepare(
    `INSERT INTO evidence (id, run_id, modality, source_ref, t_start, t_end, quote, node_key)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const linkEvidence = db.prepare(
    "INSERT OR IGNORE INTO value_evidence (observation_id, evidence_id, role) VALUES (?, ?, 'value')",
  );
  const insertSignals = db.prepare(
    `INSERT INTO review_signals
       (observation_id, evidence_coverage, evidence_modalities, evidence_quality, consistency, mapping_status, review_priority, priority_version)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  const readPath = (path: string): unknown => {
    // "people[0].name" — walk it the same way the citation writes it.
    const parts = path.replace(/\[(\d+)\]/g, ".$1").split(".").filter((p) => p !== "");
    let current: unknown = input.data;
    for (const part of parts) {
      if (current === null || typeof current !== "object") return undefined;
      current = (current as Record<string, unknown>)[part];
    }
    return current;
  };

  let grounded = 0;
  let evidenceRows = 0;

  const write = db.transaction(() => {
    for (const path of paths) {
      const observationId = newId("value");
      insertValue.run(observationId, input.runId, path, JSON.stringify(readPath(path) ?? null), nowS());

      const drafts = input.evidenceByField.get(path) ?? [];
      if (drafts.length > 0) grounded += 1;
      for (const draft of drafts) {
        const evidenceId = newId("evidence");
        insertEvidence.run(
          evidenceId,
          input.runId,
          draft.modality,
          draft.sourceRef,
          draft.tStart,
          draft.tEnd,
          draft.quote,
          draft.nodeKey,
        );
        linkEvidence.run(observationId, evidenceId);
        evidenceRows += 1;
      }

      const signals = deriveReviewSignals({
        observationId,
        evidence: drafts,
        // Governed vocabularies are not built yet, so nothing can be matched
        // against one. Saying "unmapped" is the honest answer and it keeps
        // these rows near the top of the review queue, which is right.
        mappingStatus: "unmapped",
        retracted: false,
        conflicting: false,
      });
      insertSignals.run(
        signals.observationId,
        signals.evidenceCoverage,
        signals.evidenceModalities,
        signals.evidenceQuality,
        signals.consistency,
        signals.mappingStatus,
        signals.reviewPriority,
        signals.priorityVersion,
      );
    }
  });
  write();

  return { values: paths.length, grounded, evidenceRows };
};

export const persistManifest = (db: Db, manifest: RunManifest): void => {
  db.prepare(
    `INSERT INTO run_manifests
       (run_id, source_sha256, schema_revision_id, schema_json, prompts_json, asr_engine, asr_model,
        inference_backend, inference_model, backend_version, dependencies_json, settings_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (run_id) DO UPDATE SET
       prompts_json = excluded.prompts_json, settings_json = excluded.settings_json`,
  ).run(
    manifest.runId,
    manifest.sourceSha256,
    manifest.schemaRevisionId,
    manifest.schemaJson,
    JSON.stringify(manifest.prompts),
    manifest.asrEngine,
    manifest.asrModel,
    manifest.inferenceBackend,
    manifest.inferenceModel,
    manifest.backendVersion,
    JSON.stringify(manifest.dependencyVersions),
    JSON.stringify(manifest.settings),
    manifest.createdAt,
  );
};

export interface ReviewQueueRow {
  readonly observation_id: string;
  readonly field_path: string;
  readonly value_json: string;
  readonly review_priority: number;
  readonly evidence_coverage: string;
  readonly evidence_quality: string;
  readonly decision: string | null;
}

/** Undecided values, most in need of a human first. */
export const reviewQueue = (db: Db, runId: string, limit = 50): ReviewQueueRow[] =>
  db
    .prepare(
      `SELECT v.observation_id, v.field_path, v.value_json,
              s.review_priority, s.evidence_coverage, s.evidence_quality,
              r.decision
         FROM extracted_values v
         JOIN review_signals s ON s.observation_id = v.observation_id
         LEFT JOIN review_state r ON r.observation_id = v.observation_id
        WHERE v.run_id = ? AND (r.decision IS NULL OR r.decision = 'reopened')
        ORDER BY s.review_priority DESC, v.field_path
        LIMIT ?`,
    )
    .all(runId, limit) as ReviewQueueRow[];
