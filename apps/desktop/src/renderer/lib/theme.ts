/**
 * Which palette the window wears.
 *
 * One module owns the whole question: what the user chose, what the system
 * says, what those two resolve to, and how that reaches the document. Nothing
 * else in the renderer touches a theme — components read tokens, and the tokens
 * change underneath them.
 *
 * The decision and the effects are kept apart on purpose. `resolveTheme` is a
 * function of two values with no DOM in it, so the rule — "system means follow
 * the system" — can be tested without a browser. Everything below it is the
 * plumbing that rule drives.
 */

/** What the user picked. `system` is the default and is not a palette. */
export type ThemeChoice = "system" | "light" | "dark";

/** What the window actually wears. Always one of two. */
export type Theme = "light" | "dark";

export const THEME_CHOICES: readonly ThemeChoice[] = ["system", "light", "dark"];

export const isThemeChoice = (value: unknown): value is ThemeChoice =>
  typeof value === "string" && (THEME_CHOICES as readonly string[]).includes(value);

/**
 * The whole rule, in one place.
 *
 * A stored choice wins over the system; `system` defers to it. Anything
 * unrecognised — a setting written by a future version, a corrupted row — is
 * treated as `system` rather than guessed at, because following the machine is
 * the one answer that is never surprising.
 */
export const resolveTheme = (choice: ThemeChoice, systemPrefersDark: boolean): Theme => {
  if (choice === "light" || choice === "dark") return choice;
  return systemPrefersDark ? "dark" : "light";
};

/**
 * Put the resolved theme on the document.
 *
 * One property. Every token in globals.css is `light-dark(light, dark)`, so
 * writing `color-scheme` picks the palette — there is no class to keep in step
 * with a stylesheet, and no second list of the same token names to drift.
 *
 * It also decides the parts of the window this app does not paint: form
 * controls, scrollbars, the space behind an overscroll. That is why the same
 * property does both jobs, and why a dark app with light scrollbars — the
 * detail that makes a theme look half-applied — cannot happen here.
 *
 * Untouched, the root keeps the stylesheet's `light dark`, which means the
 * system decides. That is what paints before this ever runs.
 */
export const applyTheme = (theme: Theme): void => {
  document.documentElement.style.colorScheme = theme;
};

/**
 * Apply what the user chose, which for `system` means applying nothing.
 *
 * The stylesheet already says `color-scheme: light dark`, so an untouched root
 * follows the machine — live, at sunset, with no listener and no re-render.
 * Clearing the inline value hands the decision back rather than freezing
 * whatever the machine happened to prefer at the moment the choice was read.
 *
 * That is the whole reason there is no `matchMedia` subscription in this file:
 * the browser was already doing it.
 */
export const applyChoice = (choice: ThemeChoice): void => {
  if (choice === "system") {
    document.documentElement.style.removeProperty("color-scheme");
    return;
  }
  applyTheme(choice);
};

