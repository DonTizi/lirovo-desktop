/**
 * Describing what to extract, without writing JSON Schema.
 *
 * The schema is the contract the model must satisfy, so it has to exist — but
 * asking a person to hand-write draft-2020-12 is a developer's tool leaking
 * into a product. Nobody opens an app to type `"additionalProperties": false`.
 *
 * So the surface is a list of named fields with a kind each, and the schema is
 * compiled from it. The raw document stays reachable for anyone who wants it;
 * it is simply not the thing you meet first.
 */

export type FieldKind = "text" | "list" | "number" | "date";

export interface FieldSpec {
  readonly name: string;
  readonly kind: FieldKind;
  /**
   * What this field MEANS, in words, for the model reading it.
   *
   * A name is a label; a description is an instruction. "risks" tells a model
   * almost nothing — "things the speaker said could go wrong, not things that
   * already did" tells it where the boundary is. JSON Schema carries this as
   * `description`, so it travels to the model with the contract rather than
   * needing a second channel.
   */
  // `| undefined` explicitly: a value parsed from the wire, or built
  // conditionally, is `string | undefined`, which the narrow spelling rejects
  // under exactOptionalPropertyTypes.
  readonly description?: string | undefined;
}

export interface SchemaPreset {
  readonly id: string;
  readonly label: string;
  /** What this preset is FOR, in the words of someone choosing it. */
  readonly about: string;
  readonly fields: readonly FieldSpec[];
}

/**
 * The identity of a schema's CONTENT.
 *
 * A rename or a reworded description changes what the model is asked for, so it
 * has to produce a new revision — two runs labelled with the same schema must
 * have been asked the same question. Order is part of it because the prompt
 * renders the fields in order.
 *
 * Deliberately not the compiled JSON: that would make a formatting change look
 * like a semantic one.
 */
export const fieldsFingerprint = (fields: readonly FieldSpec[]): string =>
  fields.map((f) => `${toPropertyName(f.name)}:${f.kind}:${(f.description ?? "").trim()}`).join("\u0000");

/**
 * A property name a JSON Schema can carry and a person can read back.
 *
 * Spaces and punctuation are what someone naturally types; the schema needs an
 * identifier. Converting rather than rejecting means the field is called what
 * they wrote and keyed by something valid.
 */
export const toPropertyName = (label: string): string =>
  label
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);

const KIND_SCHEMA: Record<FieldKind, Record<string, unknown>> = {
  text: { type: "string" },
  list: { type: "array", items: { type: "string" } },
  number: { type: "number" },
  date: { type: "string" },
};

/**
 * Compile the fields into a schema.
 *
 * Closed and fully required on purpose. The strict structured-output mode that
 * the fastest backends use accepts nothing else — every object must set
 * `additionalProperties: false` and list every property in `required` — so a
 * schema built here is one the fast path can actually carry.
 */
export const compileSchema = (fields: readonly FieldSpec[]): Record<string, unknown> => {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const field of fields) {
    const key = toPropertyName(field.name);
    if (key === "" || key in properties) continue;
    const described = field.description?.trim() ?? "";
    // `description` is where the meaning rides along with the contract. The
    // model reads the schema; it does not read the app.
    properties[key] = described === "" ? KIND_SCHEMA[field.kind] : { ...KIND_SCHEMA[field.kind], description: described };
    required.push(key);
  }

  return { type: "object", additionalProperties: false, required, properties };
};

/**
 * Read fields back out of a schema, so an edited document still shows as fields.
 *
 * Returns null when the schema uses anything the builder cannot represent —
 * nesting, unions, constraints. Guessing at those would silently discard them
 * the next time the builder recompiled.
 */
export const decompileSchema = (schema: unknown): FieldSpec[] | null => {
  if (schema === null || typeof schema !== "object") return null;
  const node = schema as Record<string, unknown>;
  if (node["type"] !== "object") return null;

  const properties = node["properties"];
  if (properties === null || typeof properties !== "object") return null;

  const fields: FieldSpec[] = [];
  for (const [key, raw] of Object.entries(properties as Record<string, unknown>)) {
    if (raw === null || typeof raw !== "object") return null;
    const prop = raw as Record<string, unknown>;

    const described = typeof prop["description"] === "string" ? { description: prop["description"] } : {};

    if (prop["type"] === "string") fields.push({ name: key, kind: "text", ...described });
    else if (prop["type"] === "number" || prop["type"] === "integer")
      fields.push({ name: key, kind: "number", ...described });
    else if (prop["type"] === "array") {
      const items = prop["items"] as Record<string, unknown> | undefined;
      // A list of anything but plain strings is beyond what the builder shows.
      if (items?.["type"] !== "string") return null;
      fields.push({ name: key, kind: "list", ...described });
    } else return null;
  }
  return fields;
};

/**
 * Starting points, not a catalogue.
 *
 * Four, because a list long enough to need scanning is a list that costs more
 * to read than the fields cost to type.
 */
export const SCHEMA_PRESETS: readonly SchemaPreset[] = [
  {
    id: "talk",
    label: "Talk or lecture",
    about: "what it covered, and what was claimed",
    fields: [
      { name: "title", kind: "text", description: "what this talk is about, in one line" },
      { name: "topics", kind: "list", description: "the subjects covered, in the order they were addressed" },
      {
        name: "key claims",
        kind: "list",
        description: "statements the speaker asserted as fact, not questions or opinions they attributed to others",
      },
    ],
  },
  {
    id: "meeting",
    label: "Meeting",
    about: "what was decided, and who owns it",
    fields: [
      { name: "summary", kind: "text", description: "what this meeting was for and what came out of it" },
      { name: "decisions", kind: "list", description: "things settled in the meeting, not options still being weighed" },
      { name: "action items", kind: "list", description: "work someone committed to, with the owner when it was named" },
      {
        name: "risks",
        kind: "list",
        description: "things someone said could go wrong, not things that already did",
      },
    ],
  },
  {
    id: "demo",
    label: "Product demo",
    about: "what was shown on screen",
    fields: [
      { name: "product", kind: "text", description: "the product being demonstrated" },
      { name: "features shown", kind: "list", description: "capabilities actually demonstrated on screen, not merely mentioned" },
      { name: "tools shown", kind: "list", description: "named software visible on screen during the demo" },
    ],
  },
  {
    id: "interview",
    label: "Interview",
    about: "who said what, and what they asked for",
    fields: [
      { name: "summary", kind: "text", description: "what the person interviewed was asked about, and what they conveyed" },
      { name: "quotes", kind: "list", description: "sentences worth reproducing verbatim, copied exactly as spoken" },
      { name: "requests", kind: "list", description: "things the person asked for or said they needed" },
    ],
  },
];
