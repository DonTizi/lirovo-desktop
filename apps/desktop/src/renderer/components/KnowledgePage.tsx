import { memo, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ArrowUpRight, Check, ChevronLeft, ChevronRight, Film, Search, ShieldCheck, X } from "lucide-react";
import type { KnowledgeHit, KnowledgeResult, RunSummary } from "../../bridge/contract";
import { LirovoMark } from "./LirovoMark";
import { formatTime } from "./run/lens";
import { fieldLabel, highlightWords, sourceLabel } from "./knowledge-presentation";
import "./knowledge-search.css";

type SearchScope = { query: string; runId: string; reviewed: boolean };
type SearchState = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; result: KnowledgeResult };
const PAGE_SIZE = 10;

function Highlight({ text, query }: { text: string; query: string }): JSX.Element {
  return <>{highlightWords(text, query).map((part, index) => part.match ? <mark key={index}>{part.text}</mark> : part.text)}</>;
}

const SearchResult = memo(function SearchResult({ hit, query, schema, onOpen }: {
  hit: KnowledgeHit; query: string; schema: string | undefined;
  onOpen: (runId: string, time?: number) => void;
}): JSX.Element {
  const first = hit.evidence[0];
  return <article className="knowledge-hit">
    <div className="knowledge-hit-origin">
      <span className="knowledge-source-icon"><Film size={15} aria-hidden="true" /></span>
      <div><span className="knowledge-origin-name">{sourceLabel(hit.sourceUri)}</span>
        <span className="knowledge-origin-path">{schema ?? "Extraction"} <span aria-hidden="true">/</span> <Highlight text={fieldLabel(hit.fieldPath)} query={query} /></span>
      </div>
      {hit.decision === "approved" && <span className="knowledge-reviewed"><Check size={12} aria-hidden="true" />Reviewed</span>}
    </div>
    <h2><button type="button" onClick={() => onOpen(hit.runId, first?.tStart)}><Highlight text={hit.title} query={query} /><ArrowUpRight size={15} aria-hidden="true" /></button></h2>
    <p className="knowledge-hit-text"><Highlight text={hit.text} query={query} /></p>
    <div className="knowledge-hit-footer">
      {first && <button className="knowledge-moment" type="button" onClick={() => onOpen(hit.runId, first.tStart)} aria-label={`Open source at ${formatTime(first.tStart)}`}>
        <span className="knowledge-play" aria-hidden="true">▶</span>{formatTime(first.tStart)}<span>Open source</span>
      </button>}
      {hit.corrected && <span>Edited result</span>}
      {!first && <span>No linked timestamp</span>}
      {hit.evidence.length > 0 && <details className="knowledge-evidence">
        <summary>{hit.evidence.length} source {hit.evidence.length === 1 ? "moment" : "moments"}</summary>
        <div className="knowledge-evidence-list">{hit.evidence.map((evidence, index) => <div key={`${evidence.sourceRef}-${index}`}>
          <button type="button" onClick={() => onOpen(hit.runId, evidence.tStart)}>{formatTime(evidence.tStart)} <span>· {evidence.modality}</span><ArrowUpRight size={12} aria-hidden="true" /></button>
          {evidence.quote && <blockquote><Highlight text={evidence.quote} query={query} /></blockquote>}
        </div>)}</div>
      </details>}
    </div>
  </article>;
});

export function KnowledgePage({ runs, onOpen }: { runs: readonly RunSummary[]; onOpen: (runId: string, time?: number) => void }): JSX.Element {
  const [draft, setDraft] = useState("");
  const [submitted, setSubmitted] = useState<SearchScope | null>(null);
  const [reviewed, setReviewed] = useState(false);
  const [runId, setRunId] = useState("");
  const [state, setState] = useState<SearchState>({ status: "loading" });
  const [page, setPage] = useState(1);
  const input = useRef<HTMLInputElement>(null);
  const availableRuns = runs.filter(run => run.status === "succeeded");
  const isHome = submitted === null;

  useEffect(() => {
    if (submitted === null) return;
    let active = true;
    void window.lirovo.searchKnowledge({ query: submitted.query, runIds: submitted.runId ? [submitted.runId] : [], approvedOnly: submitted.reviewed })
      .then(response => {
        if (active) setState(response.ok ? { status: "ready", result: response.value } : { status: "error", message: response.error.message });
      }).catch(() => { if (active) setState({ status: "error", message: "Your library could not be searched. Please try again." }); });
    return () => { active = false; };
  }, [submitted]);

  const requestSearch = (scope: SearchScope): void => {
    setState({ status: "loading" });
    setPage(1);
    setSubmitted({ ...scope });
  };
  const search = (query = draft, source = runId): void => {
    if (!query.trim()) { input.current?.focus(); return; }
    setDraft(query); setRunId(source);
    requestSearch({ query: query.trim(), runId: source, reviewed });
  };
  const changeFilters = (nextReviewed: boolean, nextRun: string): void => {
    if (nextReviewed === reviewed && nextRun === runId) return;
    setReviewed(nextReviewed); setRunId(nextRun);
    if (submitted) {
      requestSearch({ ...submitted, reviewed: nextReviewed, runId: nextRun });
    }
  };
  const home = (): void => {
    setSubmitted(null); setDraft(""); setReviewed(false); setRunId(""); input.current?.focus();
  };
  const result = state.status === "ready" ? state.result : null;
  const pages = Math.ceil((result?.hits.length ?? 0) / PAGE_SIZE);
  const statusText = isHome ? "" : state.status === "loading" ? "Searching your library…" : state.status === "error" ? "Search couldn’t finish." :
    `${state.result.total} ${state.result.total === 1 ? "result" : "results"} · ${state.result.runCount} ${state.result.runCount === 1 ? "extraction" : "extractions"}`;
  const changePage = (nextPage: number): void => {
    setPage(nextPage);
    input.current?.focus();
    input.current?.scrollIntoView({ block: "center" });
  };

  return <section className={`knowledge-search-page ${isHome ? "is-home" : "has-results"}`} aria-label="Knowledge search">
    <header className="knowledge-search-header">
      {!isHome && <button type="button" className="knowledge-back" onClick={home} aria-label="Back to knowledge search"><ArrowLeft size={17} /></button>}
      <div className="knowledge-wordmark"><LirovoMark className="knowledge-mark" /><span>Knowledge</span></div>
      {isHome ? <div className="knowledge-intro"><h1>Find it in your videos.</h1><p>Your extracted knowledge, one search away.</p></div> : <h1 className="sr-only">Search your knowledge</h1>}
      <form role="search" aria-label="Search extracted knowledge" className="knowledge-search-form" onSubmit={event => { event.preventDefault(); search(); }}>
        <Search size={20} className="knowledge-search-icon" aria-hidden="true" />
        <input ref={input} type="search" aria-label="Search knowledge" placeholder="Search a topic, a name, an idea…" value={draft} onChange={event => setDraft(event.target.value)} autoComplete="off" spellCheck={false} />
        {draft && <button type="button" className="knowledge-clear" onClick={() => { setDraft(""); input.current?.focus(); }} aria-label="Clear search"><X size={16} /></button>}
        <button type="submit" className="knowledge-submit" disabled={!draft.trim()} aria-label="Search"><ArrowRight size={19} /></button>
      </form>
      <div className="knowledge-search-filters">
        <div className="knowledge-filter-tabs" role="group" aria-label="Review filter">
          <button type="button" aria-pressed={!reviewed} onClick={() => changeFilters(false, runId)}>All results</button>
          <button type="button" aria-pressed={reviewed} onClick={() => changeFilters(true, runId)}><Check size={13} aria-hidden="true" />Reviewed</button>
        </div>
        <label className="knowledge-source-filter"><span className="sr-only">Filter by extraction</span><select value={runId} onChange={event => changeFilters(reviewed, event.target.value)}>
          <option value="">All extractions</option>{availableRuns.map(run => <option value={run.runId} key={run.runId}>{run.title ?? "Untitled extraction"}</option>)}
        </select></label>
      </div>
    </header>
    <p role="status" aria-atomic="true" className={isHome || state.status === "error" ? "sr-only" : "knowledge-result-count"}>
      {statusText}{!isHome && state.status === "ready" && <span>Keyword search · on-device</span>}
    </p>
    {isHome ? <div className="knowledge-home-content">
      {availableRuns.length > 0 ? <><p className="knowledge-section-label">Explore your library</p><div className="knowledge-recent-sources">
        {availableRuns.filter((_, index) => index < 3).map(run => <button type="button" key={run.runId} onClick={() => search(run.title ?? "", run.runId)} disabled={!run.title}>
          <Film size={15} aria-hidden="true" /><span>{run.title ?? "Untitled extraction"}<small>{run.schemaName ?? "Extraction"}</small></span><ArrowUpRight size={14} aria-hidden="true" />
        </button>)}
      </div></> : <div className="knowledge-empty-library"><Film size={22} aria-hidden="true" /><h2>Your knowledge starts with a video.</h2><p>Complete an extraction, then find its saved results here.</p></div>}
      <p className="knowledge-privacy"><ShieldCheck size={13} aria-hidden="true" />On-device search. No AI generation.</p>
      <p className="knowledge-scope-note">Searches saved extraction results and their linked quotes.</p>
    </div> : <div className="knowledge-results-region" aria-busy={state.status === "loading"}>
      {state.status === "loading" && <div className="knowledge-skeleton" aria-hidden="true">{[0, 1, 2].map(i => <div key={i}><span /><span /><span /></div>)}</div>}
      {state.status === "error" && <div className="knowledge-empty"><Search size={26} aria-hidden="true" /><h2>Search couldn’t finish.</h2><p role="alert">{state.message}</p><button type="button" onClick={() => requestSearch(submitted)}>Try again<ArrowRight size={14} /></button></div>}
      {state.status === "ready" && <>
        {draft.trim() !== submitted.query && <p className="knowledge-query-note">Showing results for <strong>{submitted.query}</strong>. {draft.trim() ? "Press Enter to search your new text." : "Type a new term to search again."}</p>}
        {result?.total === 0 ? <div className="knowledge-empty"><Search size={28} aria-hidden="true" /><h2>No results for “{submitted.query}”</h2><p>Try a shorter term or a different spelling.{reviewed || runId ? " You can also broaden your filters." : ""}</p>
          {(reviewed || runId) && <button type="button" onClick={() => changeFilters(false, "")}>Search all extractions<ArrowRight size={14} /></button>}
        </div> : <>
          <div className="knowledge-results-list">{result?.hits.filter((_, index) => index >= (page - 1) * PAGE_SIZE && index < page * PAGE_SIZE).map(hit => <SearchResult key={hit.observationId} hit={hit} query={submitted.query} schema={runs.find(run => run.runId === hit.runId)?.schemaName ?? undefined} onOpen={onOpen} />)}</div>
          {result && result.total > result.hits.length && <p className="knowledge-query-note">Showing the first {result.hits.length} ranked results. Narrow your search or choose an extraction to find more.</p>}
          {pages > 1 && <nav className="knowledge-pagination" aria-label="Search result pages">
            <button type="button" disabled={page === 1} onClick={() => changePage(page - 1)}><ChevronLeft size={16} />Previous</button><span>Page {page} of {pages}</span>
            <button type="button" disabled={page === pages} onClick={() => changePage(page + 1)}>Next<ChevronRight size={16} /></button>
          </nav>}
          <p className="knowledge-results-note">Results come from your saved extractions. Linked sources show context, not a fact-check.</p>
        </>}
      </>}
    </div>}
  </section>;
}
