import { realExec, resolvePaths, buildAsrChain } from "@lirovo/node-runtime";
const paths = resolvePaths({ ...process.env, LIROVO_DATA_DIR: "/tmp/lirovo-smoke" });
const chain = buildAsrChain({ exec: realExec, paths });
const url = process.argv[2];
const t0 = Date.now();
const t = await chain.transcribe({
  runId: "live", sourceKind: "url", sourceUri: url,
  audioPath: "/dev/null", signal: new AbortController().signal,
});
console.log(`engine=${t.engine} model=${t.model} lang=${t.language}`);
console.log(`duration=${t.durationS.toFixed(1)}s  segments=${t.segments.length}  elapsed=${Date.now()-t0}ms`);
console.log(`chars=${t.text.length}`);
console.log(`text: ${t.text.slice(0, 200)}`);
const s = t.segments[0];
console.log(`seg0: [${s.tStart.toFixed(2)}-${s.tEnd.toFixed(2)}] "${s.text}"  words=${s.words.length}`);
if (s.words.length) console.log(`word0: "${s.words[0].w}" @ ${s.words[0].tStart.toFixed(3)}-${s.words[0].tEnd.toFixed(3)}`);
// The property the parser exists for: no phrase should repeat back-to-back.
const toks = t.text.split(" ");
let stutter = 0;
for (let i = 3; i < toks.length; i++) if (toks.slice(i-3,i).join(" ") === toks.slice(i,i+3).join(" ")) stutter++;
console.log(`back-to-back 3-gram repeats: ${stutter}`);
