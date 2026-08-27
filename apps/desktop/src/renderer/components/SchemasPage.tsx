import { useCallback, useEffect, useState } from "react";
import { Archive, Check, Clock, Plus } from "lucide-react";
import { SCHEMA_PRESETS, compileSchema, type FieldSpec } from "@lirovo/core";
import type { SchemaRevision, SchemaSummary } from "@lirovo/node-runtime";
import { Badge, Card, CardHeader, Mono, StateLabel } from "./primitives";
import { FieldRows } from "./FieldRows";
import { cn } from "../lib/cn";

const when = (epochS: number): string => new Date(epochS * 1000).toLocaleString();

interface Draft {
  readonly schemaId: string | undefined;
  readonly name: string;
  readonly description: string;
  readonly fields: FieldSpec[];
}

const blank: Draft = { schemaId: undefined, name: "", description: "", fields: [] };

/**
 * Where schemas are made, edited and read back.
 *
 * Picking from four presets is fine for a first run and useless for the second:
 * the whole point of describing fields is that the description gets better as
 * you learn what the model does with it. That only works if the schema is a
 * thing you keep and revise, rather than a shape you retype each time.
 *
 * Every save that changes the CONTENT writes a new revision and leaves the old
 * one readable. A run points at the revision it used, so a value extracted last
 * week can still say what it was asked for — which a mutable schema could never
 * do.
 */
export function SchemasPage(): JSX.Element {
  const [schemas, setSchemas] = useState<SchemaSummary[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [history, setHistory] = useState<SchemaRevision[]>([]);
  const [saved, setSaved] = useState<string | null>(null);

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
    setHistory(answer.value);
    const current = answer.value.find((r) => r.published) ?? answer.value[0];
    setDraft({
      schemaId: summary.id,
      name: summary.name,
      description: summary.description ?? "",
      fields: [...(current?.fields ?? [])],
    });
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
    const refreshed = await window.lirovo.schemaRevisions(answer.value.schemaId);
    if (refreshed.ok) setHistory(refreshed.value);
    void reload();
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <div>
        <Card>
          <CardHeader title="Schemas" action={`${schemas.length}`} />
          {schemas.length === 0 ? (
            <p className="text-ink-subtle px-4 py-4 text-xs">
              None yet. Start from a preset below, or build one from nothing.
            </p>
          ) : (
            schemas.map((s) => (
              <button
                key={s.id}
                onClick={() => void open(s)}
                className={cn(
                  "border-hairline hover:bg-elevated flex w-full items-center gap-2 border-b px-4 py-2.5 text-left transition-colors last:border-b-0",
                  draft?.schemaId === s.id && "bg-elevated",
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className="text-ink-strong block truncate text-sm">{s.name}</span>
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
            onClick={() => {
              setDraft({ ...blank, fields: [] });
              setHistory([]);
              setSaved(null);
            }}
          >
            <Plus className="size-3.5" />
            New schema
          </button>
        </Card>

        <p className="text-ink-label mt-4 mb-2 px-1 text-xs uppercase tracking-wide">Start from</p>
        <div className="flex flex-wrap gap-2">
          {SCHEMA_PRESETS.map((preset) => (
            <button
              key={preset.id}
              title={preset.about}
              onClick={() => {
                setDraft({ schemaId: undefined, name: preset.label, description: preset.about, fields: [...preset.fields] });
                setHistory([]);
                setSaved(null);
              }}
              className="bg-tint text-ink-label hover:bg-fill hover:text-ink-strong rounded-full px-3 py-1.5 text-xs font-medium transition-colors"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {draft === null ? (
        <Card className="flex items-center justify-center py-16">
          <p className="text-ink-subtle text-sm">Pick a schema to edit, or start a new one.</p>
        </Card>
      ) : (
        <div className="grid gap-4">
          <Card>
            <CardHeader
              title={draft.schemaId === undefined ? "New schema" : "Edit schema"}
              action={saved ?? (draft.schemaId === undefined ? "not saved yet" : undefined)}
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
              <span className="text-ink-subtle text-xs">
                A save that changes a name, a type or a description writes a new version.
              </span>
              {draft.schemaId !== undefined && (
                <button
                  className="text-ink-subtle hover:text-danger-text ml-auto flex items-center gap-1.5 text-xs transition-colors"
                  onClick={async () => {
                    await window.lirovo.archiveSchema(draft.schemaId as string);
                    setDraft(null);
                    void reload();
                  }}
                >
                  <Archive className="size-3.5" />
                  Archive
                </button>
              )}
            </div>
          </Card>

          {history.length > 0 && (
            <Card>
              <CardHeader title="History" action={`${history.length} version${history.length === 1 ? "" : "s"}`} />
              {history.map((rev) => (
                <div key={rev.id} className="border-hairline border-b px-4 py-2.5 last:border-b-0">
                  <div className="flex items-center gap-2">
                    <Clock className="text-ink-subtle size-3.5" />
                    <span className="text-ink-strong text-sm">v{rev.version}</span>
                    {rev.published ? <Badge tone="success">in force</Badge> : <StateLabel>superseded</StateLabel>}
                    <span className="text-ink-subtle ml-auto text-xs">{when(rev.createdAt)}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {rev.fields.map((f) => (
                      <Mono key={f.name} className="text-[11px]">
                        {f.name}
                      </Mono>
                    ))}
                  </div>
                </div>
              ))}
            </Card>
          )}

          <details>
            <summary className="text-ink-subtle hover:text-ink cursor-pointer list-none text-[11px] transition-colors">
              Show the compiled schema
            </summary>
            <pre className="bg-recessed text-ink-label mt-2 overflow-x-auto rounded-lg p-3 font-mono text-[11px] leading-relaxed">
              {JSON.stringify(compileSchema(draft.fields), null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}
