import { realExec, resolvePaths, buildAsrChain } from "@lirovo/node-runtime";
const paths = resolvePaths({ ...process.env, LIROVO_DATA_DIR: "/tmp/lirovo-smoke" });
const chain = buildAsrChain({ exec: realExec, paths });
const t0 = Date.now();
const t = await chain.transcribe({
  runId: "local", sourceKind: "file", sourceUri: process.argv[2],
  audioPath: process.argv[2], signal: new AbortController().signal,
});
console.log(`engine=${t.engine} model=${t.model}`);
console.log(`duration=${t.durationS.toFixed(1)}s segments=${t.segments.length} elapsed=${Date.now()-t0}ms`);
console.log(`text: ${t.text}`);
console.log(`seg0: [${t.segments[0].tStart.toFixed(2)}-${t.segments[0].tEnd.toFixed(2)}] speaker=${t.segments[0].speaker}`);
