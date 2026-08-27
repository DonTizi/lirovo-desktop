import { useCallback, useEffect, useState } from "react";
import { Archive, Check, Clock, Pencil, Plus, RotateCcw } from "lucide-react";
import { SCHEMA_PRESETS, type FieldSpec } from "@lirovo/core";
import type { SchemaRevision, SchemaSummary } from "@lirovo/node-runtime";
import { Badge, Card, CardHeader, StateLabel } from "./primitives";
import { FieldRows } from "./FieldRows";
import { Hero } from "./hero";
import { SchemaExplorer } from "./schemas/explorer";
import { cn } from "../lib/cn";

const when = (epochS: number): string =>
  new Date(epochS * 1000).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

interface Draft {
  readonly schemaId: string | undefined;
  readonly name: string;
  readonly description: string;
  readonly fields: FieldSpec[];
}

const blank: Draft = { schemaId: undefined, name: "", description: "", fields: [] };

/**
 * Where schemas are made, read and revised.
 *
 * Laid out as the rest of the app is: the page names itself, a rail on the
 * left holds what you are choosing between, and the right column holds the
 * one thing chosen. The rail carries both levels — which schema, then which
 * version of it — because a revision is meaningless without the schema it
 * belongs to, and the version list is the whole reason revisions exist.
 *
 * Every save that changes the CONTENT writes a new revision and leaves the old
 * one readable. A run points at the revision it used, so a value extracted
 * last week can still say what it was asked for — which a mutable schema could
 * never do.
 */
export function SchemasPage(): JSX.Element {
  const [schemas, setSchemas] = useState<SchemaSummary[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [history, setHistory] = useState<SchemaRevision[]>([]);
  const [reading, setReading] = useState<SchemaRevision | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  // What the next save produces, when it produces anything: an edit that ends
  // up identical to a revision already on file republishes that one instead of
  // adding a copy, which is why this is the ceiling and not a promise.
  const nextVersion = history.reduce((max, r) => Math.max(max, r.version), 0) + 1;

  const reload = useCallback(async () => {
    const answer = await window.lirovo.listSchemas();
    if (answer.ok) setSchemas(answer.value);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const open = async (summary: SchemaSummary): Promise<void> => {
    const answer = await window.lirovo.schemaRevisions(summary.id);
    if (!answer.ok) return;
    const current = answer.value.find((r) => r.published) ?? answer.value[0] ?? null;
    setHistory(answer.value);
    setReading(current);
    setDraft({
      schemaId: summary.id,
      name: summary.name,
      description: summary.description ?? "",
      fields: [...(current?.fields ?? [])],
    });
    setEditing(false);
    setSaved(null);
  };

  const save = async (): Promise<void> => {
    if (draft === null || draft.name.trim() === "") return;
    const answer = await window.lirovo.saveSchema({
      ...(draft.schemaId !== undefined ? { schemaId: draft.schemaId } : {}),
      name: draft.name.trim(),
      description: draft.description.trim(),
      fields: draft.fields,
    });
    if (!answer.ok) return;
    setDraft({ ...draft, schemaId: answer.value.schemaId });
    setSaved(`Saved as version ${answer.value.version}`);
    setReading(answer.value);
    setEditing(false);
    const refreshed = await window.lirovo.schemaRevisions(answer.value.schemaId);
    if (refreshed.ok) setHistory(refreshed.value);
    void reload();
  };

  /**
   * Edit what is on screen, not what happens to be published.
   *
   * The rail can be showing v1 while v3 is in force. Seeding the editor from
   * the published revision in that state would silently discard the version
   * the user was reading and edit a different one — so the draft is refilled
   * from whichever revision is open.
   */
  const edit = (): void => {
    if (draft === null) return;
    setDraft({ ...draft, fields: [...(reading?.fields ?? draft.fields)] });
    setEditing(true);
    setSaved(null);
  };

  /** Publishing an old revision again. The store republishes it rather than
   *  writing a copy, so the history does not grow a duplicate. */
  const restore = async (): Promise<void> => {
    if (draft === null || reading === null) return;
    const answer = await window.lirovo.saveSchema({
      ...(draft.schemaId !== undefined ? { schemaId: draft.schemaId } : {}),
      name: draft.name.trim(),
      description: draft.description.trim(),
      fields: reading.fields,
    });
    if (!answer.ok) return;
    setSaved(`v${answer.value.version} is in force`);
    setReading(answer.value);
    const refreshed = await window.lirovo.schemaRevisions(answer.value.schemaId);
    if (refreshed.ok) setHistory(refreshed.value);
    void reload();
  };

  const startNew = (preset?: (typeof SCHEMA_PRESETS)[number]): void => {
    setDraft(
      preset === undefined
        ? { ...blank, fields: [] }
        : { schemaId: undefined, name: preset.label, description: preset.about, fields: [...preset.fields] },
    );
    setHistory([]);
    setReading(null);
    setEditing(true);
    setSaved(null);
  };

  return (
    <div className="pb-16">
      <Hero title="Schemas" sub="A field keeps its definition. Changing one writes a new version, and never the old." />

      <div className="mt-10 grid gap-4 lg:grid-cols-[minmax(240px,280px)_minmax(0,1fr)] lg:items-start">
        <div className="grid gap-4">
          <Card className="overflow-hidden">
            <CardHeader title="Schemas" action={`${schemas.length}`} />
            {schemas.length === 0 ? (
              <p className="text-ink-subtle px-5 py-6 text-xs">None yet. Start from a preset below.</p>
            ) : (
              schemas.map((s) => (
                <button
                  key={s.id}
                  onClick={() => void open(s)}
                  className={cn(
                    "border-hairline hover:bg-elevated flex w-full items-center gap-2 border-b px-5 py-2.5 text-left transition-colors last:border-b-0",
                    draft?.schemaId === s.id && "bg-elevated",
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="text-ink-strong block truncate text-[13px] font-medium">{s.name}</span>
                    <span className="text-ink-subtle block truncate text-xs">
                      {s.fieldCount} field{s.fieldCount === 1 ? "" : "s"} · {when(s.updatedAt)}
                    </span>
                  </span>
                  <Badge>v{s.version}</Badge>
                </button>
              ))
            )}
            <button
              className="border-hairline text-ink-subtle hover:bg-elevated hover:text-ink flex w-full items-center justify-center gap-1.5 border-t px-3 py-2 text-xs transition-colors"
              onClick={() => startNew()}
            >
              <Plus className="size-3.5" />
              New schema
            </button>
          </Card>

          {history.length > 0 && (
            <Card className="overflow-hidden">
              <CardHeader title="Versions" action={`${history.length}`} />
              {history.map((rev) => (
                <button
                  key={rev.id}
                  onClick={() => {
                    setReading(rev);
                    setEditing(false);
                  }}
                  className={cn(
                    "border-hairline hover:bg-elevated flex w-full flex-col items-start gap-0.5 border-b px-5 py-2.5 text-left transition-colors last:border-b-0",
                    reading?.id === rev.id && "bg-elevated",
                  )}
                >
                  <span className="flex items-center gap-2">
                    <span className="text-ink-strong text-[13px] font-medium">v{rev.version}</span>
                    {rev.published ? <StateLabel>in force</StateLabel> : <StateLabel>superseded</StateLabel>}
                  </span>
                  <span className="text-ink-subtle text-xs">{when(rev.createdAt)}</span>
                </button>
              ))}
            </Card>
          )}

          <Card className="overflow-hidden">
            <CardHeader title="Start from" />
            <div className="flex flex-wrap gap-2 p-4">
              {SCHEMA_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  title={preset.about}
                  onClick={() => startNew(preset)}
                  className="bg-tint text-ink-label hover:bg-fill hover:text-ink-strong rounded-full px-3 py-1.5 text-xs font-medium transition-colors"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </Card>
        </div>

        {draft === null ? (
          <Card className="flex min-h-64 items-center justify-center">
            <p className="text-ink-subtle text-sm">Pick a schema to read it, or start a new one.</p>
          </Card>
        ) : (
          <div className="grid min-w-0 gap-4">
            <Card>
              <CardHeader
                title={
                  draft.schemaId === undefined
                    ? "New schema"
                    : `${draft.name}${reading === null ? "" : ` · v${reading.version}`}`
                }
                action={saved !== null ? <span className="text-success-text">{saved}</span> : undefined}
              />
              <dl className="grid gap-x-8 gap-y-2 px-5 py-4 text-sm sm:grid-cols-2">
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-ink-label">Fields</dt>
                  <dd className="text-ink-strong tabular-nums">{(reading?.fields ?? draft.fields).length}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-ink-label">Status</dt>
                  <dd className="text-ink-strong">
                    {reading === null ? "not saved yet" : reading.published ? "in force" : "superseded"}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-ink-label">Written</dt>
                  <dd className="text-ink-strong">{reading === null ? "–" : when(reading.createdAt)}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-ink-label">About</dt>
                  <dd className="text-ink-strong truncate">
                    {draft.description === "" ? <span className="text-ink-placeholder">–</span> : draft.description}
                  </dd>
                </div>
              </dl>

              {draft.schemaId !== undefined && !editing && (
                <div className="border-hairline flex items-center gap-2 border-t px-5 py-3">
                  <button onClick={edit} className="liq-solid liq-solid-brand flex h-9 items-center gap-1.5 rounded-lg px-4 text-sm font-medium">
                    <Pencil className="size-3.5" />
                    Edit fields
                  </button>
                  {reading !== null && !reading.published && (
                    <button
                      onClick={() => void restore()}
                      className="shadow-control bg-base hover:bg-elevated flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium"
                    >
                      <RotateCcw className="size-3.5" />
                      Put v{reading.version} back in force
                    </button>
                  )}
                  <span className="text-ink-subtle ml-auto text-xs">
                    Editing writes v{nextVersion}. Nothing already extracted changes.
                  </span>
                </div>
              )}
            </Card>

            {editing || draft.schemaId === undefined ? (
              <Card>
                <CardHeader
                  title={draft.schemaId === undefined ? "Build it" : `Editing — saves as v${nextVersion}`}
                  action="a change to a name, a type or a definition writes a new version"
                />
                <div className="grid gap-2 p-4">
                  <input
                    className="border-line bg-surface-subtle text-ink placeholder:text-ink-placeholder focus:border-brand focus:bg-surface focus:ring-brand/20 h-9 rounded-lg border px-3 text-sm outline-none transition-colors focus:ring-2"
                    placeholder="Name — what this schema is for"
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  />
                  <input
                    className="border-line bg-surface-subtle text-ink placeholder:text-ink-placeholder focus:border-brand focus:bg-surface focus:ring-brand/20 h-9 rounded-lg border px-3 text-sm outline-none transition-colors focus:ring-2"
                    placeholder="A line about when to reach for it"
                    value={draft.description}
                    onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  />
                </div>

                <FieldRows
                  fields={draft.fields}
                  onChange={(fields) => {
                    setDraft({ ...draft, fields });
                    setSaved(null);
                  }}
                  emptyNote="No fields. Add one to say what should be pulled out."
                  className="mx-4 mb-4"
                />

                <div className="border-hairline flex items-center gap-2 border-t px-4 py-3">
                  <button
                    className={cn(
                      "flex h-9 items-center gap-1.5 rounded-lg px-4 text-sm font-medium",
                      draft.name.trim() === "" ? "bg-fill text-ink-placeholder cursor-default" : "liq-solid liq-solid-brand",
                    )}
                    onClick={() => void save()}
                    disabled={draft.name.trim() === ""}
                  >
                    <Check className="size-4" />
                    Save
                  </button>
                  {draft.schemaId !== undefined && (
                    <button
                      onClick={() => setEditing(false)}
                      className="text-ink-label hover:text-ink-strong h-9 px-2 text-sm transition-colors"
                    >
                      Cancel
                    </button>
                  )}
                  {draft.schemaId !== undefined && (
                    <button
                      className="text-ink-subtle hover:text-danger-text ml-auto flex items-center gap-1.5 text-xs transition-colors"
                      onClick={async () => {
                        await window.lirovo.archiveSchema(draft.schemaId as string);
                        setDraft(null);
                        setHistory([]);
                        setReading(null);
                        void reload();
                      }}
                    >
                      <Archive className="size-3.5" />
                      Archive
                    </button>
                  )}
                </div>
              </Card>
            ) : (
              <SchemaExplorer fields={reading?.fields ?? draft.fields} />
            )}

            {history.length > 0 && !editing && (
              <Card>
                <CardHeader title="History" action={`${history.length} version${history.length === 1 ? "" : "s"}`} />
                {history.map((rev) => (
                  <div key={rev.id} className="border-hairline flex items-center gap-2 border-b px-5 py-2.5 last:border-b-0">
                    <Clock className="text-ink-subtle size-3.5" />
                    <span className="text-ink-strong text-sm">v{rev.version}</span>
                    {rev.published ? <Badge tone="success">in force</Badge> : <StateLabel>superseded</StateLabel>}
                    <span className="text-ink-subtle ml-auto text-xs">
                      {rev.fields.length} field{rev.fields.length === 1 ? "" : "s"} · {when(rev.createdAt)}
                    </span>
                  </div>
                ))}
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
