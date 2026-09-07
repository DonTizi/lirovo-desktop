import { describe, expect, it } from "vitest";
import { fieldLabel, highlightWords, sourceLabel } from "./knowledge-presentation";

describe("knowledge search presentation", () => {
  it("highlights accent-insensitive matches without changing the source text", () => {
    const text = "Le modèle local : café & <script>";
    const parts = highlightWords(text, "modele café");
    expect(parts.filter(part => part.match).map(part => part.text)).toEqual(["modèle", "café"]);
    expect(parts.map(part => part.text).join("")).toBe(text);
  });

  it("preserves complete long text, combining marks, punctuation and newlines", () => {
    const text = "A cafe\u0301 — vidéo 中文 👋\n<script>alert('x')</script> ".repeat(150);
    const parts = highlightWords(text, "café 中文");
    expect(parts.map(part => part.text).join("")).toBe(text);
    expect(parts.filter(part => part.match)).toHaveLength(300);
  });

  it("does not highlight an empty or punctuation-only query", () => {
    for (const query of ["", "  ", "'; --"]) {
      expect(highlightWords("A complete result.", query).some(part => part.match)).toBe(false);
    }
  });

  it("matches within words and ignores case like keyword retrieval", () => {
    expect(highlightWords("LOCAL models", "local model").filter(part => part.match).map(part => part.text)).toEqual(["LOCAL", "models"]);
  });

  it("presents field paths without internal array indexes", () => {
    expect(fieldLabel("key_claims[18]")).toBe("key claims");
    expect(fieldLabel("benchmarks[2].score_value")).toBe("benchmarks score value");
  });

  it("shows only the public hostname, never URL credentials or query parameters", () => {
    expect(sourceLabel("https://www.youtube.com/watch?v=test")).toBe("youtube.com");
    expect(sourceLabel("https://user:secret@example.com/video?token=private")).toBe("example.com");
  });

  it("does not expose local paths as source labels", () => {
    for (const uri of ["/private/video.mp4", "file:///Users/person/video.mp4", "", "not a URL"]) {
      expect(sourceLabel(uri)).toBe("Local video");
    }
  });
});
