import { describe, expect, it } from "vitest";
import { subtitleLanguages, summarizeYtDlpFailure } from "./captions.js";

describe("subtitleLanguages", () => {
  it("never uses a glob, because en.* matches the auto-translated en-de track", () => {
    const langs = subtitleLanguages("en");
    expect(langs).not.toContain("*");
    expect(langs.split(",")).toEqual(["en-orig", "en"]);
  });

  it("asks for the original track before the generic one", () => {
    const parts = subtitleLanguages("fr").split(",");
    expect(parts.indexOf("fr-orig")).toBeLessThan(parts.indexOf("fr"));
  });

  it("falls back to English after the requested language", () => {
    expect(subtitleLanguages("fr").split(",")).toEqual(["fr-orig", "fr", "en-orig", "en"]);
  });
});

describe("summarizeYtDlpFailure", () => {
  const NOISY = `WARNING: Your yt-dlp version (2026.03.17) is older than 90 days!
WARNING: The extractor specified to use impersonation for this download
ERROR: Unable to download video subtitles for 'en-de': HTTP Error 429: Too Many Requests`;

  it("keeps the error and drops the warnings", () => {
    const out = summarizeYtDlpFailure(NOISY);
    expect(out).not.toContain("older than 90 days");
    expect(out).not.toContain("impersonation");
  });

  it("names rate limiting for what it is", () => {
    expect(summarizeYtDlpFailure(NOISY)).toContain("rate-limiting");
  });

  it("falls back to the first line when there is no ERROR line", () => {
    expect(summarizeYtDlpFailure("something odd\nand more")).toBe("something odd");
  });
});
