import { describe, expect, it } from "vitest";
import { SCHEMA_PRESETS, compileSchema } from "@lirovo/core";
import { openMemoryDatabase } from "@lirovo/node-runtime";
import { recordRunSchema, runCategory } from "./run-category";
import { extractRequestSchema } from "./ipc";
import { submittedSchemaKey } from "../bridge/schema-identity";

const unknown = {
  savedSchemaId: null,
  savedName: null,
  schemaJson: null,
  settingsJson: null,
  fieldPaths: [],
};
describe("run categories", () => {
  it("keeps pending and persisted identities identical for every schema kind", async () => {
    for (const schemaJson of [
      null,
      ...SCHEMA_PRESETS.map((preset) =>
        JSON.stringify(compileSchema(preset.fields)),
      ),
      '{"type":"object","properties":{"note":{"type":"string"}}}',
    ]) {
      for (const savedSchemaId of [null, "saved-schema"]) {
        expect(await submittedSchemaKey(schemaJson, savedSchemaId)).toBe(
          runCategory({
            ...unknown,
            schemaJson,
            savedSchemaId,
            savedName: savedSchemaId ? "Saved schema" : null,
            settingsJson: JSON.stringify({
              transcriptOnly: schemaJson === null,
            }),
          }).schemaKey,
        );
      }
    }
  });
  it("leaves absent or malformed metadata uncategorized", () => {
    expect(runCategory(unknown).schemaKey).toBe("unknown");
    expect(
      runCategory({ ...unknown, schemaJson: "{", settingsJson: "[]" })
        .schemaKey,
    ).toBe("unknown");
  });
  it("uses saved identity across revisions and prioritizes its name", () => {
    expect(
      runCategory({
        ...unknown,
        savedSchemaId: "one",
        savedName: "Interviews",
        settingsJson: '{"schemaName":"Old name"}',
      }),
    ).toEqual({ schemaKey: "saved:one", schemaName: "Interviews" });
  });
  it("recognizes full preset schema, not just its field names", () => {
    const schema = compileSchema(SCHEMA_PRESETS[0]!.fields);
    expect(
      runCategory({ ...unknown, schemaJson: JSON.stringify(schema) }).schemaKey,
    ).toBe("preset:talk");
    expect(
      runCategory({
        ...unknown,
        schemaJson: JSON.stringify({
          ...schema,
          description: "Different contract",
        }),
      }).schemaKey,
    ).toMatch(/^custom:/);
  });
  it("labels field-shape inference and rejects partial or extra fields", () => {
    expect(
      runCategory({
        ...unknown,
        fieldPaths: ["title", "topics[0]", "key_claims[0]", "key_claims[1]"],
      }).schemaName,
    ).toBe("Talk or lecture (detected)");
    expect(
      runCategory({ ...unknown, fieldPaths: ["title", "topics[0]"] }).schemaKey,
    ).toBe("unknown");
    expect(
      runCategory({
        ...unknown,
        fieldPaths: ["title", "topics[0]", "key_claims[0]", "extra"],
      }).schemaKey,
    ).toBe("unknown");
  });
  it("only calls a run transcript-only when explicitly recorded", () => {
    expect(runCategory(unknown).schemaName).toBeNull();
    expect(
      runCategory({ ...unknown, settingsJson: '{"transcriptOnly":true}' })
        .schemaName,
    ).toBe("Transcript only");
  });
  it("canonicalizes object key order without collapsing distinct contracts", () => {
    const a = runCategory({
      ...unknown,
      schemaJson: '{"type":"object","properties":{"a":{"type":"string"}}}',
    });
    const b = runCategory({
      ...unknown,
      schemaJson: '{"properties":{"a":{"type":"string"}},"type":"object"}',
    });
    expect(a.schemaKey).toBe(b.schemaKey);
    expect(a.schemaName).toBe("Custom · a");
  });
  it("retains long labels and schema JSON and keeps old IPC callers valid", () => {
    expect(
      extractRequestSchema.parse({
        source: "video",
        schemaJson: null,
        backendId: null,
      }).schemaName,
    ).toBeUndefined();
    const db = openMemoryDatabase();
    try {
      db.exec(
        "INSERT INTO sources(id,kind,uri,has_audio,has_video,created_at) VALUES('source','file','probe',1,1,1); INSERT INTO runs(id,source_id,status,created_at) VALUES('run','source','running',1)",
      );
      const schemaName = "Meeting ".repeat(100);
      const schemaJson = JSON.stringify(
        compileSchema(SCHEMA_PRESETS[1]!.fields),
      );
      recordRunSchema(
        db,
        "run",
        extractRequestSchema.parse({
          source: "video",
          schemaName,
          schemaJson,
          backendId: null,
        }),
      );
      const saved = db
        .prepare(
          "SELECT schema_json AS schemaJson, settings_json AS settingsJson FROM run_manifests WHERE run_id='run'",
        )
        .get()!;
      expect(saved.schemaJson).toBe(schemaJson);
      expect(JSON.parse(saved.settingsJson as string).schemaName).toBe(
        schemaName,
      );
      db.exec("UPDATE runs SET status='failed' WHERE id='run'");
      expect(
        runCategory({
          ...unknown,
          schemaJson: saved.schemaJson as string,
          settingsJson: saved.settingsJson as string,
        }).schemaKey,
      ).toBe("preset:meeting");
    } finally {
      db.close();
    }
  });
});
