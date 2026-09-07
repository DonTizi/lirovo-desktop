import type { Db } from "./db.js";

/**
 * The keys this app remembers between launches.
 *
 * Named rather than free-form so a typo produces a type error instead of a
 * setting that silently never reads back.
 */
export type SettingKey = "default_backend" | "whisper_model" | "update_channel" | "onboarded" | "theme";

export interface SettingsStore {
  get(key: SettingKey): string | null;
  /** Passing null forgets the key, which is how "no preference" is expressed. */
  set(key: SettingKey, value: string | null): void;
}

/**
 * Preferences, shared by every surface.
 *
 * The CLI and the app read the same row, so a model chosen in one is the model
 * the other uses. A preference stored in the app's own window state would make
 * `lirovo extract` quietly disagree with the button the user just clicked.
 */
export const createSettingsStore = (db: Db): SettingsStore => {
  const read = db.prepare("SELECT value FROM settings WHERE key = ?");
  const write = db.prepare(
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
  );
  const forget = db.prepare("DELETE FROM settings WHERE key = ?");

  return {
    get(key) {
      const row = read.get(key) as { value?: string } | undefined;
      return row?.value ?? null;
    },
    set(key, value) {
      if (value === null) forget.run(key);
      else write.run(key, value, Math.floor(Date.now() / 1000));
    },
  };
};
