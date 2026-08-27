import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync, type StatementSync } from "node:sqlite";
import { LirovoError } from "@lirovo/contracts";
import { MIGRATIONS } from "./migrations.js";

/**
 * SQLite through Node's own `node:sqlite`, deliberately not through a native
 * addon.
 *
 * `better-sqlite3` compiles one `better_sqlite3.node` per install, matched to
 * one ABI. Measured here: Node 22 is ABI 127 and Electron 33 is ABI 130, both
 * resolve the SAME physical file through pnpm's store, and rebuilding for
 * either one breaks the other — the CLI stopped opening its database the
 * moment the desktop's rebuild landed.
 *
 * The usual answers are all bad. Two copies means pinning two versions and
 * watching them drift. Rebuilding per surface means a build step that silently
 * invalidates the other. Shipping prebuilds means a matrix per architecture per
 * runtime, and every one of those `.node` files is another Mach-O to sign and
 * notarise.
 *
 * `node:sqlite` has no ABI to match, because it is part of the runtime. It
 * removes the only native module in the project — `jpeg-js` is pure
 * JavaScript — so there is no rebuild step, no architecture matrix, and one
 * fewer binary inside the signed bundle.
 *
 * It is experimental on Node 22 and warns; it is stable from Node 24, which is
 * what recent Electron ships.
 */

/** What SQLite accepts as a bound parameter. Declared here because the installed @types/node does not export it. */
type BindValue = null | number | bigint | string | Uint8Array;

interface RunResult {
  changes: number | bigint;
  lastInsertRowid: number | bigint;
}

export interface Statement<TParams extends unknown[] = unknown[], TRow = Record<string, unknown>> {
  all(...params: TParams): TRow[];
  get(...params: TParams): TRow | undefined;
  run(...params: TParams): RunResult;
}

export interface Transaction {
  (): void;
  /** Takes the write lock up front rather than on the first write. */
  immediate(): void;
}

export interface Db {
  prepare<TParams extends unknown[] = unknown[], TRow = Record<string, unknown>>(
    sql: string,
  ): Statement<TParams, TRow>;
  exec(sql: string): void;
  pragma(statement: string, options?: { simple?: boolean }): unknown;
  transaction(fn: () => void): Transaction;
  close(): void;
}

const wrap = (db: DatabaseSync): Db => ({
  prepare: <TParams extends unknown[], TRow>(sql: string): Statement<TParams, TRow> => {
    const statement: StatementSync = db.prepare(sql);
    // The caller's parameter tuple is whatever the query needs; SQLite only
    // accepts its own value union, and the check that matters is the one the
    // database performs at bind time.
    const bind = (params: TParams): BindValue[] => params as BindValue[];
    return {
      all: (...params: TParams) => statement.all(...(bind(params) as never[])) as TRow[],
      get: (...params: TParams) => statement.get(...(bind(params) as never[])) as TRow | undefined,
      run: (...params: TParams) => statement.run(...(bind(params) as never[])) as RunResult,
    };
  },

  exec: (sql: string) => db.exec(sql),

  /**
   * `PRAGMA`, in the shape the rest of the store already calls it.
   *
   * A pragma that ASSIGNS returns nothing and has to go through exec; one that
   * asks returns a row. Telling them apart on the presence of `=` is what the
   * previous binding did, and leaving the call sites untouched is the point of
   * this wrapper.
   */
  pragma: (statement: string, options?: { simple?: boolean }): unknown => {
    if (statement.includes("=")) {
      db.exec(`PRAGMA ${statement}`);
      return undefined;
    }
    const row = db.prepare(`PRAGMA ${statement}`).get() as Record<string, unknown> | undefined;
    if (row === undefined) return options?.simple === true ? undefined : [];
    return options?.simple === true ? Object.values(row)[0] : [row];
  },

  /**
   * A transaction that rolls back on any throw.
   *
   * `node:sqlite` ships no transaction helper, so this is the one place the
   * BEGIN/COMMIT/ROLLBACK dance lives. Half-written extractions are the failure
   * it exists to prevent: a value without its evidence is worse than no value
   * at all, because the interface presents it as grounded.
   */
  transaction: (fn: () => void): Transaction => {
    const run = (begin: string): void => {
      db.exec(begin);
      try {
        fn();
        db.exec("COMMIT");
      } catch (error) {
        try {
          db.exec("ROLLBACK");
        } catch {
          // SQLite already rolled it back; the original error is the real one.
        }
        throw error;
      }
    };
    const transaction = (): void => run("BEGIN");
    transaction.immediate = (): void => run("BEGIN IMMEDIATE");
    return transaction;
  },

  close: () => db.close(),
});

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
  let applied = 0;

  // The version is read INSIDE the write transaction, not before it.
  //
  // Reading first leaves a window: the CLI and the app can both open a v1
  // database, both see 1, and both decide to apply migration 2. The first
  // commits; the second then runs `CREATE TABLE settings` against a database
  // that already has it and fails on a machine where nothing is wrong. Taking
  // the write lock first makes the check and the apply one atomic step, and
  // the loser simply finds the version already current and does nothing.
  const run = db.transaction(() => {
    applied = (db.pragma("user_version", { simple: true }) as number | undefined) ?? 0;
    for (const migration of MIGRATIONS) {
      if (migration.version <= applied) continue;
      for (const statement of migration.statements) db.exec(statement);
      db.pragma(`user_version = ${migration.version}`);
      applied = migration.version;
    }
  });

  try {
    run.immediate();
  } catch (error) {
    throw new LirovoError(
      "MIGRATION_FAILED",
      `migration failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  return applied;
};

export const openDatabase = (dbPath: string): Db => {
  mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = wrap(new DatabaseSync(dbPath));
  applyPragmas(db);
  migrate(db);
  return db;
};

/** An in-memory database with the schema applied. For tests. */
export const openMemoryDatabase = (): Db => {
  const db = wrap(new DatabaseSync(":memory:"));
  db.pragma("foreign_keys = ON");
  migrate(db);
  return db;
};
