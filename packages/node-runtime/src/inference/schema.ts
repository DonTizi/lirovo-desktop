import { Validator } from "@cfworker/json-schema";
import { LirovoError } from "@lirovo/contracts";

/**
 * Validate a value against a JSON Schema, returning readable errors.
 *
 * The errors go straight back to the model in the repair turn, so they are
 * phrased as instructions rather than as diagnostics: "at /decisions/0: must
 * be string" is something a model can act on.
 */
export const validateAgainst = (schema: Record<string, unknown>, value: unknown): string[] => {
  let validator: Validator;
  try {
    validator = new Validator(schema as never, "2020-12", false);
  } catch (error) {
    throw new LirovoError(
      "SCHEMA_VALIDATION_FAILED",
      `the schema itself is unusable: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const result = validator.validate(value);
  if (result.valid) return [];

  // The validator reports the whole chain from the root down to the offending
  // leaf: `Property "data" does not match schema`, then the same about "n",
  // then finally `Expected "number"`. Only the last one tells a model what to
  // change, and handing it the wrappers as well invites it to "fix" the shape
  // of the envelope instead of the value.
  const locations = result.errors.map((e) => e.instanceLocation);
  const leaves = result.errors.filter(
    (e, i) => !locations.some((other, j) => j !== i && other.startsWith(`${e.instanceLocation}/`)),
  );

  return (leaves.length > 0 ? leaves : result.errors).map(
    (e) => `at ${e.instanceLocation.replace(/^#/, "") || "/"}: ${e.error}`,
  );
};

/** The KG shape Pass A must produce. Extra fields on nodes and edges are allowed. */
export const KG_JSON_SCHEMA: Record<string, unknown> = {
  type: "object",
  required: ["version", "duration_s", "nodes", "edges", "evidence"],
  properties: {
    version: { type: "string" },
    duration_s: { type: "number", minimum: 0 },
    nodes: {
      type: "array",
      items: {
        type: "object",
        required: ["id", "type"],
        properties: {
          id: { type: "string", pattern: "^[A-Za-z0-9_]+$" },
          type: { type: "string", minLength: 1 },
        },
      },
    },
    edges: {
      type: "array",
      items: {
        type: "object",
        required: ["from", "to", "type"],
        properties: {
          from: { type: "string" },
          to: { type: "string" },
          type: { type: "string", minLength: 1 },
        },
      },
    },
    evidence: {
      type: "array",
      items: {
        type: "object",
        required: ["node_id", "modality", "source_ref"],
        properties: {
          node_id: { type: "string" },
          modality: { type: "string", enum: ["audio", "visual", "both"] },
          source_ref: { type: "string", minLength: 1 },
          span: { type: "array", items: { type: "number" }, minItems: 2, maxItems: 2 },
        },
      },
    },
  },
};

/** The `{data, evidence}` envelope Pass B must produce, with the caller's schema inside. */
export const passBSchema = (dataSchema: Record<string, unknown>): Record<string, unknown> => ({
  type: "object",
  required: ["data", "evidence"],
  properties: {
    data: dataSchema,
    evidence: {
      type: "array",
      items: {
        type: "object",
        required: ["field_path", "node_id"],
        properties: { field_path: { type: "string" }, node_id: { type: "string" } },
      },
    },
  },
});
