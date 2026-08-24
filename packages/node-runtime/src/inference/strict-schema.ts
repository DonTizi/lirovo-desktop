/**
 * Can this schema go through OpenAI-style strict structured output?
 *
 * Strict mode is not "a JSON Schema": it is a restricted subset. Every object
 * must set `additionalProperties: false` and must list EVERY one of its
 * properties in `required`. A schema that breaks either rule is rejected with
 * a 400 before the model ever runs.
 *
 * That matters because two of the schemas here are deliberately open. The
 * knowledge graph allows extra fields on a node — the whole point is that a
 * model may describe a claim with more than the fields we thought of — and a
 * user's own schema is theirs to write. So instead of contorting the schemas
 * to fit the transport, the transport is asked whether it can carry them, and
 * the schema travels in the prompt when it cannot.
 */
export const isStrictSchema = (schema: unknown): boolean => {
  if (schema === null || typeof schema !== "object") return true;
  const node = schema as Record<string, unknown>;

  if (node["type"] === "object" || node["properties"] !== undefined) {
    if (node["additionalProperties"] !== false) return false;
    const properties = node["properties"];
    if (properties !== undefined && properties !== null && typeof properties === "object") {
      const names = Object.keys(properties as Record<string, unknown>);
      const required = Array.isArray(node["required"]) ? (node["required"] as unknown[]) : [];
      if (names.some((name) => !required.includes(name))) return false;
      for (const child of Object.values(properties as Record<string, unknown>)) {
        if (!isStrictSchema(child)) return false;
      }
    }
  }

  if (node["items"] !== undefined && !isStrictSchema(node["items"])) return false;
  for (const key of ["anyOf", "oneOf", "allOf"]) {
    const branch = node[key];
    if (Array.isArray(branch) && branch.some((child) => !isStrictSchema(child))) return false;
  }
  return true;
};
