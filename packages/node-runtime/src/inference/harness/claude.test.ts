import { describe, expect, it } from "vitest";
import { claudeSpec } from "./claude.js";
import { codexSpec } from "./codex.js";
import { VISION_MODEL_BY_BACKEND } from "../vision.js";

describe("claude adapter", () => {
  it("passes the schema inline, not as a path", () => {
    // Established by running it: a path makes the CLI exit 1 with
    // "--json-schema is not valid JSON: Unrecognized token '/'".
    const args = claudeSpec.buildArgs({ schemaPath: "/tmp/schema.json", schemaInline: '{"type":"object"}', tuning: {} });
    expect(args).toContain('{"type":"object"}');
    expect(args).not.toContain("/tmp/schema.json");
  });

  it("keeps MCP servers empty and strict", () => {
    const args = claudeSpec.buildArgs({ schemaPath: null, schemaInline: null, tuning: {} });
    expect(args).toContain("--strict-mcp-config");
    expect(args[args.indexOf("--mcp-config") + 1]).toBe('{"mcpServers":{}}');
  });

  it("unwraps the result envelope", () => {
    expect(claudeSpec.parseOutput('{"result":"{\\"a\\":1}","is_error":false}')).toBe('{"a":1}');
  });

  it("throws on an error envelope instead of feeding it to the JSON extractor", () => {
    expect(() => claudeSpec.parseOutput('{"is_error":true,"error":"usage limit reached"}')).toThrow(/usage limit/);
  });

  it("passes plain output through when it is not an envelope", () => {
    expect(claudeSpec.parseOutput("just text")).toBe("just text");
  });
});

describe("codex adapter", () => {
  it("passes the schema as a file path, not inline", () => {
    const args = codexSpec.buildArgs({ schemaPath: "/tmp/schema.json", schemaInline: '{"type":"object"}', tuning: {} });
    expect(args[args.indexOf("--output-schema") + 1]).toBe("/tmp/schema.json");
  });

  it("reads the prompt from stdin and switches off every ambient input", () => {
    const args = codexSpec.buildArgs({ schemaPath: null, schemaInline: null, tuning: {} });
    expect(args).toEqual(
      expect.arrayContaining(["-", "--ignore-user-config", "--ignore-rules", "--ephemeral", "--skip-git-repo-check"]),
    );
    expect(args[args.indexOf("--sandbox") + 1]).toBe("read-only");
  });
});

describe("cheap model for frames", () => {
  it("puts the small model on the command line when tuning asks for it", () => {
    // Measured on the same twenty frames: haiku is 54.3s and $0.13, the
    // default model 77.7s and $0.79, with identical coverage.
    const args = claudeSpec.buildArgs({ schemaPath: null, schemaInline: null, tuning: { model: "haiku" } });
    expect(args[args.indexOf("--model") + 1]).toBe("haiku");
  });

  it("names claude as the backend whose frames go to a cheap model by default", () => {
    expect(VISION_MODEL_BY_BACKEND["claude"]).toBe("haiku");
  });

  it("passes reasoning effort to codex, which has a flag for it", () => {
    const args = codexSpec.buildArgs({ schemaPath: null, schemaInline: null, tuning: { effort: "low" } });
    expect(args[args.indexOf("-c") + 1]).toBe("model_reasoning_effort=low");
  });
});
