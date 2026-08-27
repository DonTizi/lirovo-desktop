import { motion } from "framer-motion";
import { Plus, X } from "lucide-react";
import { SCHEMA_PRESETS, compileSchema, type FieldKind, type FieldSpec } from "@lirovo/core";
import { cn } from "../lib/cn";

const KIND_LABEL: Record<FieldKind, string> = {
  text: "Text",
  list: "List",
  number: "Number",
  date: "Date",
};

const sameFields = (a: readonly FieldSpec[], b: readonly FieldSpec[]): boolean =>
  a.length === b.length && a.every((f, i) => f.name === b[i]?.name && f.kind === b[i]?.kind);

/**
 * What to pull out of the video, described as fields.
 *
 * The previous version of this put a JSON Schema document in a textarea, which
 * is the correct contract and the wrong thing to hand someone: it reads as
 * debug output, and it asks a person to know draft-2020-12 before they can
 * extract anything.
 *
 * So: four starting points, then rows you can rename and retype. The schema is
 * compiled from them, and stays reachable under a disclosure for anyone who
 * actually wants to read it.
 */
export function SchemaPicker({
  fields,
  onChange,
}: {
  fields: readonly FieldSpec[];
  onChange: (fields: FieldSpec[]) => void;
}): JSX.Element {
  const setField = (index: number, patch: Partial<FieldSpec>): void =>
    onChange(fields.map((f, i) => (i === index ? { ...f, ...patch } : f)));

  return (
    <div className="mt-6">
      <p className="text-ink-label mb-2 text-center text-xs uppercase tracking-wide">What should it pull out?</p>

      <div className="mb-3 flex flex-wrap justify-center gap-2">
        {SCHEMA_PRESETS.map((preset) => {
          const active = sameFields(fields, preset.fields);
          return (
            <button
              key={preset.id}
              onClick={() => onChange([...preset.fields])}
              title={preset.about}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                active
                  ? "bg-ink-strong text-ink-inverse"
                  : "bg-tint text-ink-label hover:bg-fill hover:text-ink-strong",
              )}
            >
              {preset.label}
            </button>
          );
        })}
        <button
          onClick={() => onChange([])}
          className={cn(
            "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
            fields.length === 0
              ? "bg-ink-strong text-ink-inverse"
              : "bg-tint text-ink-label hover:bg-fill hover:text-ink-strong",
          )}
          title="Transcribe and detect scenes, without filling any fields"
        >
          Transcript only
        </button>
      </div>

      <div className="bg-base shadow-ring overflow-hidden rounded-lg">
        {fields.length === 0 ? (
          <p className="text-ink-subtle px-4 py-4 text-center text-xs">
            No fields. The video will be transcribed and its scenes detected, and nothing will be filled in.
          </p>
        ) : (
          fields.map((field, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.14, ease: [0.2, 0, 0, 1] }}
              className="border-hairline flex items-center gap-2 border-b px-3 py-2 last:border-b-0"
            >
              <input
                className="text-ink placeholder:text-ink-placeholder min-w-0 flex-1 border-0 bg-transparent text-sm outline-none"
                placeholder="Field name"
                value={field.name}
                onChange={(e) => setField(index, { name: e.target.value })}
                spellCheck={false}
              />
              <select
                className="bg-tint text-ink-label focus:ring-brand/20 rounded px-2 py-1 text-xs outline-none focus:ring-2"
                value={field.kind}
                onChange={(e) => setField(index, { kind: e.target.value as FieldKind })}
              >
                {(Object.keys(KIND_LABEL) as FieldKind[]).map((kind) => (
                  <option key={kind} value={kind}>
                    {KIND_LABEL[kind]}
                  </option>
                ))}
              </select>
              <button
                className="text-ink-subtle hover:text-danger-text rounded p-1 transition-colors"
                onClick={() => onChange(fields.filter((_, i) => i !== index))}
                aria-label={`Remove ${field.name || "this field"}`}
              >
                <X className="size-3.5" />
              </button>
            </motion.div>
          ))
        )}

        <button
          className="border-hairline text-ink-subtle hover:bg-elevated hover:text-ink flex w-full items-center justify-center gap-1.5 border-t px-3 py-2 text-xs transition-colors"
          onClick={() => onChange([...fields, { name: "", kind: "text" }])}
        >
          <Plus className="size-3.5" />
          Add a field
        </button>
      </div>

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
