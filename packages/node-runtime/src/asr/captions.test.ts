import { describe, expect, it } from "vitest";
import { subtitleLanguages, explainYtDlpError, summarizeYtDlpFailure } from "./captions.js";

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

  it("keeps the ERROR line and leaves the naming to explain", () => {
    // Summarise reduces forty lines of banner to the failure; explain says
    // what to do about it. Doing both here is what produced an explanation
    // nested inside its own explanation at the one call site that did both.
    expect(summarizeYtDlpFailure(NOISY)).toContain("429");
    expect(explainYtDlpError(summarizeYtDlpFailure(NOISY))).toContain("rate-limiting");
  });

  it("falls back to the first line when there is no ERROR line", () => {
    expect(summarizeYtDlpFailure("something odd\nand more")).toBe("something odd");
  });
});

describe("an error a person can act on", () => {
  it("summarises without explaining, so a caller can explain exactly once", () => {
    // The bug: summarise called explain, the caller called explain again, and
    // the second pass matched its own output — "that link is not one yt-dlp
    // knows how to open (that link is not one yt-dlp knows how to open (…))".
    const raw = "WARNING: banner\nERROR: Unsupported URL: https://example.com/";
    expect(summarizeYtDlpFailure(raw)).toBe("Unsupported URL: https://example.com/");
  });

  it("names the host that could not be resolved, and does not blame yt-dlp", () => {
    const message = explainYtDlpError("Failed to resolve 'example.invalid' ([Errno 8] nodename nor servname)");
    expect(message).toContain("example.invalid");
    expect(message).not.toMatch(/out-of-date|update it/i);
  });

  it("still names the fix for the failure that has one", () => {
    expect(explainYtDlpError("HTTP Error 403: Forbidden")).toMatch(/out-of-date/i);
    expect(explainYtDlpError("HTTP Error 429: Too Many Requests")).toMatch(/rate-limiting/i);
    expect(explainYtDlpError("Private video")).toMatch(/private, deleted, or restricted/i);
  });

  it("passes an unrecognised failure through rather than guessing", () => {
    expect(explainYtDlpError("some new thing went wrong")).toBe("some new thing went wrong");
  });
});
