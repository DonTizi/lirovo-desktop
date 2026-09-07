import { describe, expect, it } from "vitest";
import { exportRunSchema } from "./ipc";

describe("export request boundary", () => {
  it("supports complete folders only with full scope and preserves existing report formats", () => {
    expect(exportRunSchema.parse({ runId: "run_001", options: { format: "folder", scope: "all" } }).options.format).toBe("folder");
    expect(exportRunSchema.safeParse({ runId: "run_001", options: { format: "folder", scope: "approved" } }).success).toBe(false);
    for (const format of ["json", "csv", "markdown"]) expect(exportRunSchema.parse({ runId: "run_001", options: { format, scope: "approved" } }).options.format).toBe(format);
    expect(exportRunSchema.safeParse({ runId: "run_001", options: { format: "shell", scope: "all" } }).success).toBe(false);
  });
  it("does not accept renderer-supplied destinations", () => {
    expect(exportRunSchema.parse({ runId: "run_001", destination: "/private/file", options: { format: "folder", scope: "all" } })).not.toHaveProperty("destination");
  });
});
