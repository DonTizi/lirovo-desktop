import { createHash } from "node:crypto";
import {
  canonicalSchema as canonical,
  schemaObject as object,
  categoryPresets as presets,
} from "../bridge/schema-identity";
import type { Db } from "@lirovo/node-runtime";
import type { ExtractRequest } from "../bridge/contract";

/** Record the requested contract at ingest, even if later stages fail. */
export function recordRunSchema(
  db: Db,
  runId: string,
  request: ExtractRequest,
): void {
  db.prepare(
    `INSERT INTO run_manifests
    (run_id, schema_revision_id, schema_json, prompts_json, dependencies_json, settings_json, created_at)
    VALUES (?, ?, ?, '{}', '{}', ?, ?)
    ON CONFLICT(run_id) DO NOTHING`,
  ).run(
    runId,
    request.schemaRevisionId ?? null,
    request.schemaJson,
    JSON.stringify({
      schemaName: request.schemaName ?? null,
      transcriptOnly: request.schemaJson === null,
    }),
    Math.floor(Date.now() / 1000),
  );
}

const parse = (json: string | null): unknown => {
  try {
    return json === null ? null : JSON.parse(json);
  } catch {
    return null;
  }
};

export function runCategory(input: {
  savedSchemaId: string | null;
  savedName: string | null;
  schemaJson: string | null;
  settingsJson: string | null;
  fieldPaths: readonly string[];
}): { schemaKey: string; schemaName: string | null } {
  if (input.savedSchemaId && input.savedName)
    return {
      schemaKey: `saved:${input.savedSchemaId}`,
      schemaName: input.savedName,
    };
  const settings = object(parse(input.settingsJson));
  if (settings?.transcriptOnly === true)
    return { schemaKey: "mode:transcript", schemaName: "Transcript only" };
  const schema = object(parse(input.schemaJson));
  if (schema) {
    const identity = canonical(schema);
    const preset = presets.find((p) => p.schema === identity);
    const recordedName =
      typeof settings?.schemaName === "string"
        ? settings.schemaName.trim()
        : "";
    return {
      schemaKey: preset
        ? `preset:${preset.id}`
        : `custom:${createHash("sha256").update(identity).digest("hex")}`,
      schemaName:
        recordedName ||
        preset?.label ||
        (object(schema.properties)
          ? `Custom · ${Object.keys(schema.properties as object).join(", ")}`
          : "Custom schema"),
    };
  }
  // Field names are evidence of shape, not proof of the original schema.
  const keys = [
    ...new Set(input.fieldPaths.map((path) => path.split(/[.\[]/)[0] ?? "")),
  ]
    .sort()
    .join("\u0000");
  const inferred =
    keys === "" ? undefined : presets.find((p) => p.keys === keys);
  return inferred
    ? {
        schemaKey: `detected:${inferred.id}`,
        schemaName: `${inferred.label} (detected)`,
      }
    : { schemaKey: "unknown", schemaName: null };
}
