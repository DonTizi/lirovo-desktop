import { compileSchema, type FieldSpec } from "@lirovo/core";
import { useState } from "react";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { FieldRows } from "./FieldRows";
import { SchemaSelect, type SchemaChoice } from "./SchemaSelect";

/**
 * What to pull out of this video.
 *
 * Editing the rows here changes THIS run only. A schema is revised where it
 * lives, on the Schemas tab, so an edit made in passing cannot rewrite the
 * contract every earlier run points at — and the moment a row is touched the
 * link to the stored revision is dropped, because claiming a revision the run
 * did not use is worse than claiming none.
 */
export function SchemaPicker({
  label,
  version,
  fields,
  onChoose,
  onEdit,
  onManage,
}: {
  label: string;
  version: number | null;
  fields: readonly FieldSpec[];
  onChoose: (choice: SchemaChoice) => void;
  onEdit: (fields: FieldSpec[]) => void;
  onManage: () => void;
}): JSX.Element {
  const [editing, setEditing] = useState(false);
  return (
    <div className="bg-surface-subtle mx-3 rounded-t-2xl px-2 py-1">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <SchemaSelect
            current={{ label, fieldCount: fields.length, version }}
            onChoose={onChoose}
            onManage={onManage}
            placement="above"
            compact
          />
        </div>
        <button
          aria-expanded={editing}
          aria-controls="extraction-fields"
          onClick={() => setEditing((value) => !value)}
          className="text-ink-secondary hover:bg-fill flex h-8 items-center gap-2 rounded-lg px-2 text-sm"
        >
          <SlidersHorizontal className="size-3.5" /> Customize
          <ChevronDown
            className={`size-3 transition-transform ${editing ? "rotate-180" : ""}`}
          />
        </button>
      </div>
      {editing && (
        <div
          id="extraction-fields"
          className="mt-3 max-h-64 overflow-auto pb-2"
        >
          <FieldRows
            fields={fields}
            onChange={onEdit}
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
      )}
    </div>
  );
}
