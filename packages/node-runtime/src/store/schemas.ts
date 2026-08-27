import { randomBytes, createHash } from "node:crypto";
import { makeId } from "@lirovo/contracts";
import { compileSchema, decompileSchema, fieldsFingerprint, type FieldSpec } from "@lirovo/core";
import type { Db } from "./db.js";

const newId = (kind: Parameters<typeof makeId>[0]): string => makeId(kind, randomBytes(10));
const nowS = (): number => Math.floor(Date.now() / 1000);
const sha256 = (value: string): string => createHash("sha256").update(value).digest("hex");

export interface SchemaRevision {
  readonly id: string;
  readonly schemaId: string;
  readonly version: number;
  readonly fields: readonly FieldSpec[];
  readonly changeReason: string | null;
  readonly createdAt: number;
  readonly published: boolean;
}

export interface SchemaSummary {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly version: number;
  readonly fieldCount: number;
  readonly updatedAt: number;
}

export interface SchemaStore {
  list(): SchemaSummary[];
  revisions(schemaId: string): SchemaRevision[];
  published(schemaId: string): SchemaRevision | null;
  /**
   * Record these fields, creating a revision only when the content changed.
   * Returns the revision now in force.
   */
  save(input: {
    // Optional AND explicitly undefinable: zod's `.optional()` produces
    // `string | undefined`, which the narrower spelling rejects under
    // exactOptionalPropertyTypes.
    schemaId?: string | undefined;
    name: string;
    description?: string | undefined;
    fields: readonly FieldSpec[];
  }): SchemaRevision;
  archive(schemaId: string): void;
}

interface RevisionRow {
  id: string;
  schema_id: string;
  version: number;
  json_schema: string;
  schema_sha256: string;
  change_reason: string | null;
  created_at: number;
}

const toRevision = (row: RevisionRow, publishedId: string | null): SchemaRevision => ({
  id: row.id,
  schemaId: row.schema_id,
  version: row.version,
  fields: decompileSchema(JSON.parse(row.json_schema)) ?? [],
  changeReason: row.change_reason,
  createdAt: row.created_at,
  published: row.id === publishedId,
});

/**
 * Named schemas, and every version they have ever had.
 *
 * A revision is written once and never edited. Renaming a field or rewording
 * its description changes what the model is asked for, so it produces a NEW
 * revision rather than mutating the old one — otherwise a run from last week
 * would claim to have used a contract that did not exist when it ran, and the
 * values it produced would be unexplainable.
 *
 * Publishing is a pointer on the parent, not a flag on the row. A row that
 * calls itself immutable and then flips its own status is neither.
 */
export const createSchemaStore = (db: Db): SchemaStore => ({
  list: () =>
    db
      .prepare<[], SchemaSummary>(
        `SELECT s.id, s.name, s.description,
                COALESCE(r.version, 0) AS version,
                COALESCE(json_array_length(json_extract(r.json_schema, '$.required')), 0) AS fieldCount,
                COALESCE(r.created_at, s.created_at) AS updatedAt
           FROM schemas s
           LEFT JOIN schema_revisions r ON r.id = s.published_revision
          WHERE s.archived_at IS NULL
          ORDER BY updatedAt DESC`,
      )
      .all(),

  revisions(schemaId) {
    const head = db
      .prepare<[string], { published_revision: string | null }>("SELECT published_revision FROM schemas WHERE id = ?")
      .get(schemaId);
    return db
      .prepare<[string], RevisionRow>(
        "SELECT * FROM schema_revisions WHERE schema_id = ? ORDER BY version DESC",
      )
      .all(schemaId)
      .map((row) => toRevision(row, head?.published_revision ?? null));
  },

  published(schemaId) {
    const row = db
      .prepare<[string], RevisionRow>(
        `SELECT r.* FROM schema_revisions r
           JOIN schemas s ON s.published_revision = r.id
          WHERE s.id = ?`,
      )
      .get(schemaId);
    return row === undefined ? null : toRevision(row, row.id);
  },

  save(input) {
    const at = nowS();
    const fingerprint = sha256(fieldsFingerprint(input.fields));
    const json = JSON.stringify(compileSchema(input.fields));

    let schemaId = input.schemaId;
    if (schemaId === undefined) {
      schemaId = newId("schema");
      db.prepare("INSERT INTO schemas (id, name, description, created_at) VALUES (?, ?, ?, ?)").run(
        schemaId,
        input.name,
        input.description ?? null,
        at,
      );
    } else {
      db.prepare("UPDATE schemas SET name = ?, description = ? WHERE id = ?").run(
        input.name,
        input.description ?? null,
        schemaId,
      );
    }

    // Identical content is not a new version. Saving twice without editing
    // anything would otherwise fill the history with revisions that differ in
    // nothing, and make the real changes hard to find among them.
    const existing = db
      .prepare<[string, string], RevisionRow>(
        "SELECT * FROM schema_revisions WHERE schema_id = ? AND schema_sha256 = ? ORDER BY version DESC LIMIT 1",
      )
      .get(schemaId, fingerprint);
    if (existing !== undefined) {
      db.prepare("UPDATE schemas SET published_revision = ? WHERE id = ?").run(existing.id, schemaId);
      return toRevision(existing, existing.id);
    }

    const previous = db
      .prepare<[string], { n: number }>(
        "SELECT COALESCE(MAX(version), 0) AS n FROM schema_revisions WHERE schema_id = ?",
      )
      .get(schemaId);
    const version = (previous?.n ?? 0) + 1;
    const revisionId = newId("revision");

    const write = db.transaction(() => {
      db.prepare(
        `INSERT INTO schema_revisions (id, schema_id, version, json_schema, schema_sha256, change_reason, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).run(revisionId, schemaId as string, version, json, fingerprint, version === 1 ? "created" : "edited", at);
      db.prepare("UPDATE schemas SET published_revision = ? WHERE id = ?").run(revisionId, schemaId as string);
    });
    write();

    return {
      id: revisionId,
      schemaId,
      version,
      fields: input.fields,
      changeReason: version === 1 ? "created" : "edited",
      createdAt: at,
      published: true,
    };
  },

  archive(schemaId) {
    // Soft: a run points at a revision, and deleting the parent would leave
    // that run unable to say what it was asked for.
    db.prepare("UPDATE schemas SET archived_at = ? WHERE id = ?").run(nowS(), schemaId);
  },
});
