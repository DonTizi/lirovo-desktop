import { SCHEMA_PRESETS, compileSchema } from "@lirovo/core";

export const schemaObject = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
export const canonicalSchema = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonicalSchema).join(",")}]`;
  const record = schemaObject(value);
  if (record)
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalSchema(record[key])}`)
      .join(",")}}`;
  return JSON.stringify(value) ?? "null";
};
export const categoryPresets = SCHEMA_PRESETS.map((preset) => {
  const schema = compileSchema(preset.fields);
  return {
    ...preset,
    schema: canonicalSchema(schema),
    keys: Object.keys(schema.properties as object)
      .sort()
      .join("\u0000"),
  };
});

/** Same identity as the engine, before it has created the run's database row. */
export async function submittedSchemaKey(
  schemaJson: string | null,
  savedSchemaId: string | null,
): Promise<string> {
  if (savedSchemaId) return `saved:${savedSchemaId}`;
  if (schemaJson === null) return "mode:transcript";
  const identity = canonicalSchema(JSON.parse(schemaJson));
  const preset = categoryPresets.find((p) => p.schema === identity);
  if (preset) return `preset:${preset.id}`;
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(identity),
  );
  return `custom:${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}
