import { beforeEach, describe, expect, it } from "vitest";
import { openMemoryDatabase, type Db } from "./db.js";
import { createSettingsStore, type SettingsStore } from "./settings.js";

describe("settings store", () => {
  let db: Db;
  let store: SettingsStore;
  beforeEach(() => {
    db = openMemoryDatabase();
    store = createSettingsStore(db);
  });

  it("reads back nothing before anything is set", () => {
    expect(store.get("default_backend")).toBeNull();
  });

  it("keeps the last value written", () => {
    store.set("default_backend", "codex");
    store.set("default_backend", "claude");
    expect(store.get("default_backend")).toBe("claude");
  });

  it("forgets a key set to null, which is how no-preference is expressed", () => {
    store.set("default_backend", "codex");
    store.set("default_backend", null);
    expect(store.get("default_backend")).toBeNull();
  });

  it("survives a reopen against the same database", () => {
    store.set("default_backend", "local");
    expect(createSettingsStore(db).get("default_backend")).toBe("local");
  });
});
