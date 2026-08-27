import { compileSchema, type FieldSpec } from "@lirovo/core";
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
  return (
    <div className="mt-6">
      <p className="text-ink-label mb-2 text-center text-xs uppercase tracking-wide">What should it pull out?</p>

      <div className="mx-auto mb-2 max-w-md">
        <SchemaSelect
          current={{ label, fieldCount: fields.length, version }}
          onChoose={onChoose}
          onManage={onManage}
        />
      </div>

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
  );
}
