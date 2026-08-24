import { describe, expect, it } from "vitest";
import { claudeSpec } from "./claude.js";
import { codexSpec } from "./codex.js";

describe("claude adapter", () => {
  it("passes the schema inline, not as a path", () => {
    // Established by running it: a path makes the CLI exit 1 with
    // "--json-schema is not valid JSON: Unrecognized token '/'".
    const args = claudeSpec.buildArgs({ schemaPath: "/tmp/schema.json", schemaInline: '{"type":"object"}' });
    expect(args).toContain('{"type":"object"}');
    expect(args).not.toContain("/tmp/schema.json");
  });

  it("keeps MCP servers empty and strict", () => {
    const args = claudeSpec.buildArgs({ schemaPath: null, schemaInline: null });
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
    const args = codexSpec.buildArgs({ schemaPath: "/tmp/schema.json", schemaInline: '{"type":"object"}' });
    expect(args[args.indexOf("--output-schema") + 1]).toBe("/tmp/schema.json");
  });

  it("reads the prompt from stdin and switches off every ambient input", () => {
    const args = codexSpec.buildArgs({ schemaPath: null, schemaInline: null });
    expect(args).toEqual(
      expect.arrayContaining(["-", "--ignore-user-config", "--ignore-rules", "--ephemeral", "--skip-git-repo-check"]),
    );
    expect(args[args.indexOf("--sandbox") + 1]).toBe("read-only");
  });
});
