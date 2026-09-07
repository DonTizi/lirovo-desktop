import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_WHISPER_MODEL, parseWhisperJson, resolveModelPath, whisperLanguage } from "./whisper-cpp.js";
import { assertTranscriptQuality } from "./quality.js";

describe("local speech language", () => {
  it("uses auto explicitly, preserves an explicit language, and blocks English-only guessing", () => {
    expect(whisperLanguage(DEFAULT_WHISPER_MODEL)).toBe("auto");
    expect(whisperLanguage(DEFAULT_WHISPER_MODEL, "fr")).toBe("fr");
    expect(whisperLanguage("ggml-base.en-q5_1.bin", "en")).toBe("en");
    expect(() => whisperLanguage("ggml-base.en-q5_1.bin")).toThrow("multilingual Base");
    expect(() => whisperLanguage("ggml-base.en.bin", "fr")).toThrow("English-only");
    expect(() => whisperLanguage(DEFAULT_WHISPER_MODEL, "--translate")).toThrow("language code");
  });
  it("prefers multilingual weights without overriding an explicit model selection", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "lirovo-model-test-"));
    const paths = { data: dir, runs: dir, models: dir, dbFile: path.join(dir, "unused.db"), bundledBin: null };
    try {
      await writeFile(path.join(dir, "ggml-base.en-q5_1.bin"), "fixture");
      await writeFile(path.join(dir, "ggml-small.bin"), "fixture");
      expect(resolveModelPath(paths, {})).toBe(path.join(dir, "ggml-small.bin"));
      await writeFile(path.join(dir, DEFAULT_WHISPER_MODEL), "fixture");
      expect(resolveModelPath(paths, {})).toBe(path.join(dir, DEFAULT_WHISPER_MODEL));
      expect(resolveModelPath(paths, { LIROVO_WHISPER_MODEL: "/explicit/model.bin" })).toBe("/explicit/model.bin");
    } finally { await rm(dir, { recursive: true, force: true }); }
  });
  it("reads detected language and millisecond offsets observed from whisper-cli JSON", () => {
    const parsed = parseWhisperJson(JSON.stringify({ result: { language: "en" }, transcription: [
      { text: " Today we compare three language models.", offsets: { from: 0, to: 2420 } },
      { text: " The first model is fast.", offsets: { from: 2420, to: 4040 } },
    ] }));
    expect(parsed.language).toBe("en");
    expect(parsed.segments[1]?.tStart).toBe(2.42);
    expect(parsed.durationS).toBe(4.04);
  });
  it("does not turn missing offsets into invented zero timestamps", () => {
    const parsed = parseWhisperJson(JSON.stringify({ transcription: [{ text: "Missing offsets" }] }));
    expect(() => assertTranscriptQuality({ ...parsed, engine: "whisper-cpp", model: null })).toThrow("timestamps");
  });
});
