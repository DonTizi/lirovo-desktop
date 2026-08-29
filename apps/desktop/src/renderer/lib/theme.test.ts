import { describe, expect, it } from "vitest";
import { isThemeChoice, resolveTheme, THEME_CHOICES } from "./theme.js";

describe("resolveTheme", () => {
  it("follows the system when the user has not chosen", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
  });

  it("lets an explicit choice override the system, in both directions", () => {
    // The half people forget: staying light on a dark machine has to work as
    // well as staying dark on a light one.
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });

  it("treats anything it does not recognise as following the system", () => {
    // A setting row written by a later version, or a corrupted one. Following
    // the machine is the one answer that is never surprising; guessing a
    // palette would be.
    expect(resolveTheme("neon" as never, true)).toBe("dark");
    expect(resolveTheme("neon" as never, false)).toBe("light");
  });

  it("only ever answers with a palette, never with the choice", () => {
    for (const choice of THEME_CHOICES) {
      for (const dark of [true, false]) {
        expect(["light", "dark"]).toContain(resolveTheme(choice, dark));
      }
    }
  });
});

describe("isThemeChoice", () => {
  it("accepts the three, and nothing else", () => {
    for (const ok of THEME_CHOICES) expect(isThemeChoice(ok)).toBe(true);
    for (const no of ["", "Dark", "auto", null, undefined, 0, {}]) expect(isThemeChoice(no)).toBe(false);
  });
});
