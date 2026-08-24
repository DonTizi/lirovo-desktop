import { mkdirSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { LirovoError } from "@lirovo/contracts";
import { MIGRATIONS } from "./migrations.js";

export type Db = Database.Database;

/**
 * Pragmas that make a desktop database survive a laptop closing.
 *
 * `synchronous = FULL` rather than NORMAL: the difference is a few
 * milliseconds per commit and the failure it prevents is a corrupted database
 * after a power loss, which for a local-only system of record is unrecoverable.
 */
const applyPragmas = (db: Db): void => {
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = FULL");
  db.pragma("foreign_keys = ON");
  // Three surfaces can open this file. A writer that finds it locked should
  // wait rather than fail the user's run.
  db.pragma("busy_timeout = 5000");
};

/**
 * Apply pending migrations.
 *
 * `BEGIN IMMEDIATE` takes the write lock up front, so two processes starting
 * together cannot both decide they are the one to migrate. The version bump is
 * inside the same transaction as the statements it describes.
 */
export const migrate = (db: Db): number => {
  const current = (db.pragma("user_version", { simple: true }) as number) ?? 0;
  let applied = current;

  for (const migration of MIGRATIONS) {
    if (migration.version <= applied) continue;
    const run = db.transaction(() => {
      for (const statement of migration.statements) db.exec(statement);
      db.pragma(`user_version = ${migration.version}`);
    });
    try {
      run.immediate();
    } catch (error) {
      throw new LirovoError(
        "MIGRATION_FAILED",
        `migration ${migration.version} failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    applied = migration.version;
  }
  return applied;
};

export const openDatabase = (dbPath: string): Db => {
  mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  applyPragmas(db);
  migrate(db);
  return db;
};

/** An in-memory database with the schema applied. For tests. */
export const openMemoryDatabase = (): Db => {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  migrate(db);
  return db;
};
