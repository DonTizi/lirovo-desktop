import { describe, expect, it, vi } from "vitest";
import {mkdtemp,writeFile,readdir,readFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import type { AsrStrategy, Transcript } from "@lirovo/contracts";
import { createAsrChain } from "./smart.js";
import { buildAsrChain } from "./index.js";

const transcript: Transcript = { engine: "fixture", model: null, language: "en", durationS: 1, text: "Hello.", segments: [{ id: "s1", text: "Hello.", speaker: null, tStart: 0, tEnd: 1, words: [] }] };
const request = () => ({ runId: "test", sourceKind: "file" as const, sourceUri: "/unused.wav", audioPath: "/unused.wav", signal: new AbortController().signal });
const strategy = (name: string, result = transcript): AsrStrategy => ({ name, isAvailable: async () => true, transcribe: vi.fn(async () => result) });

describe("ASR trust and cancellation boundaries", () => {
  it("preserves a complete suspect candidate locally and does not use the consented remote provider",async()=>{
    const data=await mkdtemp(path.join(tmpdir(),"lirovo-quality-test-"));
    const fetch=vi.spyOn(globalThis,"fetch").mockRejectedValue(new Error("must not send audio"));
    try{
      await writeFile(path.join(data,"whisper-cli"),"fixture",{mode:0o755});
      await writeFile(path.join(data,"ffmpeg"),"fixture",{mode:0o755});
      await writeFile(path.join(data,"ggml-base-q5_1.bin"),"model marker");
      const phrase="It was the first time I had to do it.";
      const chain=buildAsrChain({
        paths:{data,runs:data,models:data,dbFile:path.join(data,"unused.db"),bundledBin:data},
        allowRemote:true,env:{OPENAI_API_KEY:"test-not-a-real-key"},
        exec:async(_bin,args)=>{
          if(args.includes("-oj"))await writeFile(`${args[args.indexOf("-of")+1]}.json`,JSON.stringify({result:{language:"en"},transcription:Array.from({length:6},(_,i)=>({text:phrase,offsets:{from:i*2000,to:(i+1)*2000}}))}));
          return {stdout:"",stderr:""};
        },
      });
      await expect(chain.transcribe({...request(),runId:"run_abc"})).rejects.toThrow("No automatic provider fallback");
      const files=(await readdir(path.join(data,"run_abc"))).filter(file=>file.startsWith("asr-quality-"));
      expect(files).toHaveLength(1);
      const report=JSON.parse(await readFile(path.join(data,"run_abc",files[0]!),"utf8"));
      expect(report.transcript.segments).toHaveLength(6);
      expect(report.transcript.text).toBe(Array(6).fill(phrase).join(" "));
      expect(report.status).toBe("needs-review");
      expect(fetch).not.toHaveBeenCalled();
    }finally{fetch.mockRestore();await rm(data,{recursive:true,force:true});}
  });
  it("stops on suspect output rather than silently switching providers", async () => {
    const bad = strategy("bad", { ...transcript, text: "" });
    const good = strategy("good");
    await expect(createAsrChain([bad, good]).transcribe(request())).rejects.toThrow("Transcription needs review");
    expect(good.transcribe).not.toHaveBeenCalled();
  });
  it("does no work when cancelled before entry", async () => {
    const controller = new AbortController(); controller.abort();
    const candidate = strategy("local");
    await expect(createAsrChain([candidate]).transcribe({ ...request(), signal: controller.signal })).rejects.toMatchObject({ code: "CANCELLED" });
    expect(candidate.transcribe).not.toHaveBeenCalled();
  });
  it("does not interpret AbortError as permission to try another provider", async () => {
    const aborted: AsrStrategy = { ...strategy("aborted"), transcribe: async () => { throw new DOMException("cancelled", "AbortError"); } };
    const next = strategy("remote");
    await expect(createAsrChain([aborted, next]).transcribe(request())).rejects.toMatchObject({ code: "CANCELLED" });
    expect(next.transcribe).not.toHaveBeenCalled();
  });
  it("does not send audio remotely just because an API key exists", async () => {
    const fetch = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network must not be used"));
    try {
      const data = "/nonexistent-lirovo-test";
      const chain = buildAsrChain({
        exec: async () => { throw new Error("local failure"); },
        paths: { data, models: data, runs: data, dbFile: `${data}/unused.db`, bundledBin: null },
        env: { OPENAI_API_KEY: "test-not-a-real-key", PATH: "" },
      });
      await expect(chain.transcribe(request())).rejects.toMatchObject({ code: "TRANSCRIBE_FAILED" });
      expect(fetch).not.toHaveBeenCalled();
      expect(chain.cacheIdentity).toContain('"remote":false');
    } finally { fetch.mockRestore(); }
  });
  it("cache identity distinguishes language and explicit remote permission", () => {
    const data = "/nonexistent-lirovo-test";
    const deps = { exec: vi.fn(), paths: { data, models: data, runs: data, dbFile: `${data}/unused.db`, bundledBin: null }, env: { OPENAI_API_KEY: "test-not-a-real-key" } };
    const en = buildAsrChain({ ...deps, language: "en" });
    const fr = buildAsrChain({ ...deps, language: "fr" });
    const remote = buildAsrChain({ ...deps, language: "fr", allowRemote: true });
    expect(en.cacheIdentity).not.toBe(fr.cacheIdentity);
    expect(fr.cacheIdentity).not.toBe(remote.cacheIdentity);
    expect(fr.validateTranscript).toBeTypeOf("function");
  });
});
