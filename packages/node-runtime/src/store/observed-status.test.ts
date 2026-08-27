import { describe, expect, it } from "vitest";
import { LEASE_MS, observedStatus } from "./runs.js";

const now = 1_800_000_000_000;
const inSeconds = (ms: number): number => Math.floor(ms / 1000);

describe("observedStatus", () => {
  it("leaves a live run running while its lease holds", () => {
    expect(observedStatus("running", inSeconds(now + LEASE_MS), now)).toBe("running");
  });

  it("calls a run stopped once nothing is renewing its lease", () => {
    // The exact case behind a row that reads RUNNING an hour after the process
    // that owned it was killed.
    expect(observedStatus("running", inSeconds(now - 1000), now)).toBe("stopped");
  });

  it("treats a claimed run the same way, since it is equally unattended", () => {
    expect(observedStatus("claimed", inSeconds(now - 1), now)).toBe("stopped");
    expect(observedStatus("claimed", inSeconds(now + LEASE_MS), now)).toBe("claimed");
  });

  it("treats a missing lease as expired rather than as permission to keep waiting", () => {
    expect(observedStatus("running", null, now)).toBe("stopped");
  });

  it("never rewrites a finished run: those rows have no lease by design", () => {
    for (const status of ["succeeded", "failed", "cancelled"] as const) {
      expect(observedStatus(status, null, now)).toBe(status);
    }
  });
});
