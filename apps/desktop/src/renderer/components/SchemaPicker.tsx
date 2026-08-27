import { useEffect, useState } from "react";
import { SCHEMA_PRESETS, compileSchema, fieldsFingerprint, type FieldSpec } from "@lirovo/core";
import type { SchemaSummary } from "@lirovo/node-runtime";
import { FieldRows } from "./FieldRows";
import { cn } from "../lib/cn";

const same = (a: readonly FieldSpec[], b: readonly FieldSpec[]): boolean =>
  fieldsFingerprint(a) === fieldsFingerprint(b);

/**
 * What to pull out of this video.
 *
 * Saved schemas come first because they are the ones with descriptions someone
 * has already refined; the presets are starting points for a first run. Editing
 * here changes THIS run only — a schema is revised where it lives, on the
 * Schemas tab, so an edit made in passing cannot silently rewrite the contract
 * every earlier run pointed at.
 */
export function SchemaPicker({
  fields,
  onChange,
  onPickSaved,
  onManage,
}: {
  fields: readonly FieldSpec[];
  onChange: (fields: FieldSpec[]) => void;
  onPickSaved: (revisionId: string | null) => void;
  onManage: () => void;
}): JSX.Element {
  const [saved, setSaved] = useState<SchemaSummary[]>([]);

  useEffect(() => {
    void window.lirovo.listSchemas().then((answer) => {
      if (answer.ok) setSaved(answer.value);
    });
  }, []);

  const chip = (active: boolean): string =>
    cn(
      "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
      active ? "bg-ink-strong text-ink-inverse" : "bg-tint text-ink-label hover:bg-fill hover:text-ink-strong",
    );

  return (
    <div className="mt-6">
      <div className="mb-2 flex items-center justify-center gap-2">
        <p className="text-ink-label text-xs uppercase tracking-wide">What should it pull out?</p>
        <button className="text-ink-subtle hover:text-ink text-[11px] transition-colors" onClick={onManage}>
          Manage schemas
        </button>
      </div>

      <div className="mb-3 flex flex-wrap justify-center gap-2">
        {saved.map((s) => (
          <button
            key={s.id}
            title={s.description ?? undefined}
            className={chip(false)}
            onClick={async () => {
              const answer = await window.lirovo.schemaRevisions(s.id);
              if (!answer.ok) return;
              const current = answer.value.find((r) => r.published) ?? answer.value[0];
              if (current === undefined) return;
              onChange([...current.fields]);
              onPickSaved(current.id);
            }}
          >
            {s.name}
            <span className="text-ink-subtle ml-1.5">v{s.version}</span>
          </button>
        ))}

        {SCHEMA_PRESETS.map((preset) => (
          <button
            key={preset.id}
            title={preset.about}
            className={chip(same(fields, preset.fields))}
            onClick={() => {
              onChange([...preset.fields]);
              onPickSaved(null);
            }}
          >
            {preset.label}
          </button>
        ))}

        <button
          className={chip(fields.length === 0)}
          title="Transcribe and detect scenes, without filling any fields"
          onClick={() => {
            onChange([]);
            onPickSaved(null);
          }}
        >
          Transcript only
        </button>
      </div>

      <FieldRows
        fields={fields}
        onChange={(next) => {
          onChange(next);
          // Edited in place, so it is no longer the stored revision — saying it
          // was would attach this run to a contract it did not use.
          onPickSaved(null);
        }}
        emptyNote="No fields. The video will be transcribed and its scenes detected, and nothing will be filled in."
      />

      {fields.length > 0 && (
        <details className="mt-2">
          <summary className="text-ink-subtle hover:text-ink cursor-pointer list-none text-center text-[11px] transition-colors">
            Show the schema
          </summary>
          <pre className="bg-recessed text-ink-label mt-2 overflow-x-auto rounded-lg p-3 font-mono text-[11px] leading-relaxed">
            {JSON.stringify(compileSchema(fields), null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}
