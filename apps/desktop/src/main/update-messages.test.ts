import { describe, expect, it } from "vitest";
import { explainUpdateFailure } from "./update-messages.js";

describe("explainUpdateFailure", () => {
  // The exact failure a stable-channel copy hits when the only release so far
  // is a prerelease. It arrived in the UI as four kilobytes of GitHub headers.
  const theRealOne =
    'Cannot parse releases feed: Error: Unable to find latest version on GitHub ' +
    '(https://github.com/DonTizi/lirovo-desktop/releases/latest), please ensure a ' +
    'production release exists: HttpError: 406 "method: GET url: ' +
    'https://github.com/DonTizi/lirovo-desktop/releases\\n\\n Data:\\n \\n " Headers: { ' +
    '"cache-control": "no-cache", "content-security-policy": "default-src \'none\'; ...';

  it("turns the no-stable-release case into a sentence with a next step", () => {
    const said = explainUpdateFailure(new Error(theRealOne), "latest");
    expect(said).toBe("no stable release yet. Preview, above, gets prereleases as they are cut");
    expect(said).not.toMatch(/HttpError|Headers|content-security-policy/);
  });

  it("does not tell a preview user to switch to preview", () => {
    expect(explainUpdateFailure(new Error(theRealOne), "beta")).toBe(
      "no build published on this channel yet",
    );
  });

  it("names being offline as being offline", () => {
    expect(explainUpdateFailure(new Error("getaddrinfo ENOTFOUND github.com"), "latest")).toBe(
      "no connection — check again when you are online",
    );
  });

  it("shortens anything it does not recognise to one line", () => {
    const long = `something odd\n  at foo (bar.js:1:1)\n  at baz (qux.js:2:2)`;
    expect(explainUpdateFailure(new Error(long), "latest")).toBe("something odd");
  });

  it("caps a single very long line rather than passing it through", () => {
    const said = explainUpdateFailure(new Error("x".repeat(500)), "latest");
    expect(said.length).toBeLessThanOrEqual(120);
    expect(said.endsWith("…")).toBe(true);
  });

  it("never returns an empty string", () => {
    for (const input of [null, undefined, "", new Error("")]) {
      expect(explainUpdateFailure(input, "latest")).not.toBe("");
    }
  });
});
