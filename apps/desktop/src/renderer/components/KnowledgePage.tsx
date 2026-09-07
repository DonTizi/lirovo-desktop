import {useEffect, useRef, useState} from "react";
import {ArrowUpRight, Search, Columns2, BookOpen, Sparkles, Square} from "lucide-react";
import type {BackendStatus, DoctorReport} from "@lirovo/core";
import type {KnowledgeAnswer, KnowledgeComparison, KnowledgeHit, KnowledgeResult, RunSummary} from "../../bridge/contract";
import {formatTime} from "./run/lens";

export function KnowledgePage({runs,onOpen}: {runs: readonly RunSummary[]; onOpen:(runId:string,t?:number)=>void}):JSX.Element {
  const [query,setQuery]=useState("");
  const [approved,setApproved]=useState(false);
  const [result,setResult]=useState<KnowledgeResult|null>(null);
  const [comparison,setComparison]=useState<KnowledgeComparison|null>(null);
  const [selected,setSelected]=useState<string[]>([]);
  const [error,setError]=useState<string|null>(null);
  const [busy,setBusy]=useState(false);
  const [question,setQuestion]=useState("");
  const [answer,setAnswer]=useState<KnowledgeAnswer|null>(null);
  const [backends,setBackends]=useState<readonly BackendStatus[]>([]);
  const [backendId,setBackendId]=useState("");
  const [consent,setConsent]=useState(false);
  const [asking,setAsking]=useState(false);
  const activeQuestion=useRef<string|null>(null);
  const request=useRef(0);
  const invalidateScope = () => {
    request.current += 1;
    setConsent(false);
    setResult(null);
    setComparison(null);
    setAnswer(null);
    setError(null);
  };
  useEffect(()=>{
    let mounted=true;
    void window.lirovo.doctor().then(response=>{if(mounted&&response.ok)setBackends((response.value as DoctorReport).backends);}).catch(()=>{});
    return ()=>{mounted=false;request.current+=1;if(activeQuestion.current!==null)void window.lirovo.cancelKnowledge({requestId:activeQuestion.current}).catch(()=>{});};
  },[]);
  const ask=async()=>{
    if(!question.trim()||!backendId||!consent||busy)return;
    const id=++request.current;const requestId=crypto.randomUUID();
    activeQuestion.current=requestId;setBusy(true);setAsking(true);setError(null);setAnswer(null);
    try{
      const response=await window.lirovo.askKnowledge({question,query:query||undefined,runIds:selected,approvedOnly:approved,backendId,consent:true,requestId});
      if(id!==request.current)return;
      if(response.ok)setAnswer(response.value);else setError(response.error.message);
    }catch{if(id===request.current)setError("The answer could not be completed. No partial answer was accepted.");}
    finally{if(id===request.current){setBusy(false);setAsking(false);setConsent(false);activeQuestion.current=null;}}
  };
  const stop=async()=>{
    if(activeQuestion.current===null)return;
    try{const response=await window.lirovo.cancelKnowledge({requestId:activeQuestion.current});if(!response.ok)setError(response.error.message);}
    catch{setError("Could not confirm cancellation. Please wait for the request to finish.");}
  };
  const search=async()=>{
    if(busy)return;
    const id=++request.current;setBusy(true);setError(null);setComparison(null);setAnswer(null);
    try {
      const answer=await window.lirovo.searchKnowledge({query,approvedOnly:approved,runIds:selected});
      if(id!==request.current)return;
      if(answer.ok)setResult(answer.value);else setError(answer.error.message);
    } catch {if(id===request.current)setError("Search could not be loaded. Try again.");}
    finally{if(id===request.current)setBusy(false);}
  };
  const compare=async()=>{
    if(busy)return;
    const id=++request.current;setBusy(true);setError(null);setResult(null);setAnswer(null);
    try{
      const answer=await window.lirovo.compareKnowledge(selected, approved);
      if(id!==request.current)return;
      if(answer.ok)setComparison(answer.value);else setError(answer.error.message);
    }catch{if(id===request.current)setError("Comparison could not be loaded. Try again.");}
    finally{if(id===request.current)setBusy(false);}
  };
  const card=(hit:KnowledgeHit)=> <article key={hit.observationId} className="rounded-xl border border-hairline bg-surface/40 p-4">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-ink-subtle"><span>{hit.fieldPath.replace(/_/g," ")}</span><span>{hit.corrected?"Edited · ":""}{hit.decision==="approved"?"Reviewed":"Not reviewed"}</span></div>
    <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-ink">{hit.text}</p>
    <button type="button" className="mt-4 flex items-center gap-2 text-xs text-ink-secondary hover:text-ink" onClick={()=>onOpen(hit.runId,hit.evidence[0]?.tStart)}><ArrowUpRight className="size-3.5"/>{hit.title}</button>
    <div className="mt-2 flex flex-wrap gap-2">{hit.evidence.map((e,i)=><button key={`${e.sourceRef}-${i}`} className="rounded-md bg-fill px-2 py-1 font-mono text-xs text-ink-secondary" title={e.quote??e.sourceRef} onClick={()=>onOpen(hit.runId,e.tStart)}>{formatTime(e.tStart)} · {e.modality}</button>)}{hit.evidence.length===0&&<span className="text-xs text-ink-subtle">No linked source moment</span>}</div>
  </article>;
  return <section className="mx-auto w-full max-w-6xl px-6 py-8">
    <div className="mb-8"><p className="mb-2 flex items-center gap-2 text-xs text-ink-subtle"><BookOpen className="size-4"/>Your knowledge workspace</p><h1 className="text-2xl font-medium tracking-tight">Find the idea. Keep the evidence.</h1><p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-secondary">Search saved results across your videos, or compare extractions side by side. Corrections are included; rejected results stay out.</p></div>
    <form onSubmit={e=>{e.preventDefault();void search();}} className="flex gap-3 rounded-2xl border border-hairline bg-surface p-3"><Search className="my-auto size-5 text-ink-subtle"/><input aria-label="Search knowledge" disabled={busy} className="min-w-0 flex-1 bg-transparent text-sm outline-none" value={query} onChange={e=>{invalidateScope();setQuery(e.target.value);}} placeholder="Search a topic, a product, a claim…"/><button disabled={busy||!query.trim()} className="liq-solid rounded-lg px-4 py-2 text-sm disabled:opacity-40">Search</button></form>
    <div className="my-4 flex flex-wrap items-center justify-between gap-3 text-xs text-ink-subtle"><span>Keyword search · full saved values · on-device</span><label className="flex gap-2"><input type="checkbox" disabled={busy} checked={approved} onChange={e=>{invalidateScope();setApproved(e.target.checked);}}/>Reviewed results only</label></div>
    <details className="mb-6 rounded-xl border border-hairline p-4"><summary className="cursor-pointer text-sm text-ink-secondary">Sources · {selected.length===0?"All extractions":`${selected.length} selected`}</summary><div className="mt-4 grid max-h-64 gap-3 overflow-auto sm:grid-cols-2">{runs.filter(r=>r.status==="succeeded").map(run=><label key={run.runId} className="flex items-start gap-2 text-sm text-ink-secondary"><input type="checkbox" checked={selected.includes(run.runId)} onChange={e=>{invalidateScope();setSelected(s=>e.target.checked?[...s,run.runId]:s.filter(id=>id!==run.runId));}} disabled={busy||(!selected.includes(run.runId)&&selected.length>=10)}/><span>{run.title??"Untitled extraction"}<span className="ml-2 text-xs text-ink-subtle">{run.schemaName??"Custom"}</span></span></label>)}</div><div className="mt-4 flex items-center gap-4"><button onClick={()=>void compare()} disabled={busy||selected.length<2} className="flex items-center gap-2 rounded-lg bg-fill px-3 py-2 text-sm disabled:opacity-40"><Columns2 className="size-4"/>Compare selected</button><button disabled={busy} className="text-xs text-ink-subtle" onClick={()=>{invalidateScope();setSelected([]);}}>Clear selection</button></div></details>
    <details className="mb-6 rounded-2xl border border-hairline bg-surface/40 p-5">
      <summary className="cursor-pointer text-sm font-medium"><span className="inline-flex items-center gap-2"><Sparkles className="size-4 text-ink-subtle"/>Ask with sources</span></summary>
      <p className="mt-3 text-xs leading-relaxed text-ink-subtle">Ask a question across the selected extractions. Search terms above refine retrieval; leave them empty to use the question. Keyword retrieval is local. Answer generation uses your chosen provider.</p>
      <form onSubmit={e=>{e.preventDefault();void ask();}} className="mt-4">
        <fieldset disabled={busy} className="space-y-4">
          <textarea aria-label="Question for your knowledge" value={question} onChange={e=>{setQuestion(e.target.value);setConsent(false);}} placeholder="What do these sources say about…?" rows={2} className="w-full resize-y rounded-xl border border-hairline bg-transparent px-4 py-3 text-sm leading-relaxed outline-none focus:border-ink-subtle"/>
          <div className="flex flex-wrap items-center gap-3"><label htmlFor="knowledge-provider" className="text-xs text-ink-subtle">Answer with</label><select id="knowledge-provider" value={backendId} onChange={e=>{setBackendId(e.target.value);setConsent(false);}} className="min-w-0 rounded-lg border border-hairline bg-surface px-3 py-2 text-xs text-ink"><option value="">Choose a provider…</option>{backends.filter(b=>b.available).map(b=><option key={b.id} value={b.id}>{b.id}{b.version?` · ${b.version}`:""}</option>)}</select>{backends.every(b=>!b.available)&&<span className="text-xs text-ink-subtle">Configure an available provider in Settings.</span>}</div>
          <label className="flex items-start gap-2 text-xs leading-relaxed text-ink-secondary"><input type="checkbox" className="mt-0.5" disabled={!backendId} checked={consent} onChange={e=>setConsent(e.target.checked)}/><span>Allow this question and complete retrieved values, quotes and source metadata to be sent to <span className="text-ink">{backendId||"the chosen provider"}</span>. Depending on its configuration, processing may leave this device and use quota. No automatic provider fallback.</span></label>
          <button type="submit" disabled={!consent||!backendId||!question.trim()} className="liq-solid rounded-lg px-4 py-2 text-sm disabled:opacity-40">Ask with sources</button>
        </fieldset>
      </form>
    </details>
    {error!==null&&<p role="alert" className="mb-4 rounded-lg border border-danger-text/30 p-4 text-sm text-danger-text">{error}</p>}
    {busy&&<div className="flex items-center justify-between gap-3 py-8"><p role="status" className={`text-sm text-ink-subtle ${asking?"motion-safe:animate-pulse":""}`}>{asking?"Connecting the evidence into a cited answer…":"Looking through your saved knowledge…"}</p>{asking&&<button type="button" onClick={()=>void stop()} className="flex items-center gap-2 rounded-lg border border-hairline px-3 py-2 text-xs"><Square className="size-3"/>Stop</button>}</div>}
    {!busy&&answer!==null&&<section className="mb-8 rounded-2xl border border-hairline bg-surface/40 p-5 sm:p-7">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2"><h2 className="flex items-center gap-2 text-base font-medium text-ink"><Sparkles className="size-4 text-ink-subtle"/>Answer with sources</h2><span className="text-xs text-ink-subtle">{answer.model??"No model call"}{answer.model?` · ${answer.backendId}`:""}</span></div>
      <p className="mb-5 whitespace-pre-wrap text-xs text-ink-subtle">{answer.question}</p>
      {answer.status==="insufficient-evidence"?<p className="text-sm leading-relaxed text-ink-secondary">The retrieved evidence is insufficient to answer this question. Try more specific keywords, include other sources, or review the saved results.</p>:<div className="space-y-5">{answer.claims.map((claim,i)=><div key={i}><p className="whitespace-pre-wrap break-words text-sm leading-7 text-ink">{claim.text}</p><div className="mt-2 flex flex-wrap gap-2">{claim.citationIds.map(id=>{const citation=answer.citations.find(c=>c.id===id);return citation?<button key={id} type="button" title={citation.hit.title} onClick={()=>onOpen(citation.hit.runId,citation.hit.evidence[0]?.tStart)} className="rounded-md bg-fill px-2 py-1 text-xs text-ink-secondary">{id} · {formatTime(citation.hit.evidence[0]?.tStart??0)}</button>:null;})}</div></div>)}</div>}
      <details className="mt-6 border-t border-hairline pt-4 text-xs text-ink-subtle"><summary className="cursor-pointer">How to read this answer · limits and {answer.citations.length} retrieved sources</summary><ul className="mt-3 list-disc space-y-2 pl-4">{answer.limitations.map(note=><li key={note}>{note}</li>)}</ul><div className="mt-5 grid gap-3 lg:grid-cols-2">{answer.citations.map(c=><div key={c.id}><p className="mb-2 font-mono text-xs">{c.id}</p>{card(c.hit)}</div>)}</div></details>
    </section>}
    {!busy&&result!==null&&<><p role="status" className="mb-4 text-xs text-ink-subtle">{result.total===0?"No matches. Try a shorter topic or another term.":`${result.total} matches across ${result.runCount} extractions${result.total>result.hits.length?` · first ${result.hits.length} shown`:""}`}</p><div className="grid gap-3 lg:grid-cols-2">{result.hits.map(card)}</div></>}
    {!busy&&comparison!==null&&<><p className="mb-5 text-xs leading-relaxed text-ink-subtle">{comparison.note}</p>{comparison.fields.length===0&&<p className="py-8 text-sm text-ink-subtle">These extractions have no available results to compare.</p>}{comparison.fields.map(group=><section key={group.field} className="mb-7"><h2 className="mb-3 text-sm font-medium">{group.field.replace(/_/g," ")}</h2><div className="grid gap-3 lg:grid-cols-2">{group.entries.map(card)}</div></section>)}</>}
    {!busy&&result===null&&comparison===null&&answer===null&&<div className="py-16 text-center"><BookOpen className="mx-auto mb-4 size-8 text-ink-tertiary"/><h2 className="text-lg">Your videos become useful together.</h2><p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-subtle">Try a subject from a completed extraction, or select two sources to see their results together.</p></div>}
  </section>;
}
