import { beforeEach, describe, expect, it } from "vitest";
import type { FieldSpec } from "@lirovo/core";
import { openMemoryDatabase, type Db } from "./db.js";
import { createSchemaStore, type SchemaStore } from "./schemas.js";

const talk: FieldSpec[] = [
  { name: "title", kind: "text", description: "what this talk is about" },
  { name: "topics", kind: "list" },
];

describe("schema store", () => {
  let db: Db;
  let store: SchemaStore;
  beforeEach(() => {
    db = openMemoryDatabase();
    store = createSchemaStore(db);
  });

  it("creates version 1 and publishes it", () => {
    const rev = store.save({ name: "Talks", fields: talk });
    expect(rev.version).toBe(1);
    expect(rev.published).toBe(true);
    expect(store.list()).toHaveLength(1);
  });

  it("does not version a save that changed nothing", () => {
    // Saving twice without editing would fill the history with revisions that
    // differ in nothing, hiding the real changes among them.
    const first = store.save({ name: "Talks", fields: talk });
    const second = store.save({ schemaId: first.schemaId, name: "Talks", fields: talk });
    expect(second.version).toBe(1);
    expect(store.revisions(first.schemaId)).toHaveLength(1);
  });

  it("versions a rename", () => {
    const first = store.save({ name: "Talks", fields: talk });
    const renamed = store.save({
      schemaId: first.schemaId,
      name: "Talks",
      fields: [{ ...talk[0]!, name: "headline" }, talk[1]!],
    });
    expect(renamed.version).toBe(2);
  });

  it("versions a reworded description, because it changes what was asked", () => {
    const first = store.save({ name: "Talks", fields: talk });
    const reworded = store.save({
      schemaId: first.schemaId,
      name: "Talks",
      fields: [{ ...talk[0]!, description: "the single sentence a reader would keep" }, talk[1]!],
    });
    expect(reworded.version).toBe(2);
    expect(store.revisions(first.schemaId)).toHaveLength(2);
  });

  it("versions a type change", () => {
    const first = store.save({ name: "Talks", fields: talk });
    const retyped = store.save({
      schemaId: first.schemaId,
      name: "Talks",
      fields: [talk[0]!, { ...talk[1]!, kind: "text" }],
    });
    expect(retyped.version).toBe(2);
  });

  it("does not version renaming the SCHEMA, only its content", () => {
    // The label on the folder is not the contract inside it.
    const first = store.save({ name: "Talks", fields: talk });
    const relabelled = store.save({ schemaId: first.schemaId, name: "Conference talks", fields: talk });
    expect(relabelled.version).toBe(1);
    expect(store.list()[0]?.name).toBe("Conference talks");
  });

  it("keeps every earlier revision readable", () => {
    const first = store.save({ name: "Talks", fields: talk });
    store.save({ schemaId: first.schemaId, name: "Talks", fields: [talk[0]!] });
    const history = store.revisions(first.schemaId);
    expect(history.map((r) => r.version)).toEqual([2, 1]);
    expect(history[1]?.fields).toHaveLength(2);
    expect(history[1]?.published).toBe(false);
  });

  it("round-trips the description through storage", () => {
    const saved = store.save({ name: "Talks", fields: talk });
    expect(store.published(saved.schemaId)?.fields[0]?.description).toBe("what this talk is about");
  });

  it("republishes an earlier revision when its content comes back", () => {
    const first = store.save({ name: "Talks", fields: talk });
    store.save({ schemaId: first.schemaId, name: "Talks", fields: [talk[0]!] });
    const back = store.save({ schemaId: first.schemaId, name: "Talks", fields: talk });
    // Reverting is not a third version; it is version 1 in force again.
    expect(back.version).toBe(1);
    expect(store.revisions(first.schemaId)).toHaveLength(2);
  });

  it("hides an archived schema but keeps its revisions", () => {
    const first = store.save({ name: "Talks", fields: talk });
    store.archive(first.schemaId);
    expect(store.list()).toHaveLength(0);
    expect(store.revisions(first.schemaId)).toHaveLength(1);
  });
});

describe("what a schema refuses", () => {
  let db: Db;
  let store: SchemaStore;
  beforeEach(() => {
    db = openMemoryDatabase();
    store = createSchemaStore(db);
  });

  it("refuses a blank name, which would be unpointable in any list", () => {
    expect(() => store.save({ name: "", fields: talk })).toThrow(/needs a name/);
    expect(() => store.save({ name: "   ", fields: talk })).toThrow(/needs a name/);
  });

  it("trims the name it stores, so two schemas cannot differ by a space", () => {
    store.save({ name: "  Talks  ", fields: talk });
    expect(store.list()[0]?.name).toBe("Talks");
    expect(() => store.save({ name: "Talks", fields: talk })).toThrow();
  });

  it("refuses a field whose name has no letters or digits", () => {
    // It would compile to a JSON Schema property called "", which the model is
    // then asked to fill in.
    expect(() => store.save({ name: "bad", fields: [{ name: "  ", kind: "text" }] })).toThrow(/at least one letter/);
    expect(() => store.save({ name: "bad", fields: [{ name: "!!!", kind: "text" }] })).toThrow(/at least one letter/);
  });

  it("still allows a schema with no fields: transcribe-only is a real ask", () => {
    expect(store.save({ name: "transcript only", fields: [] }).fields).toEqual([]);
  });
});
