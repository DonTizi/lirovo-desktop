import { useId, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Braces, ChevronRight, Search } from "lucide-react";
import { compileSchema, type FieldSpec } from "@lirovo/core";
import { Badge, Card, CardHeader } from "../primitives";

/** The JSON-Schema type a kind compiles to, which is what the model is told. */
const JSON_TYPE: Record<FieldSpec["kind"], string> = {
  text: "string",
  list: "array",
  number: "number",
  date: "string",
};

const CONSTRAINT: Record<FieldSpec["kind"], string> = {
  text: "No constraints",
  list: "array of strings",
  number: "No constraints",
  date: "date",
};

/** `report_date` reads as a column name; "Report date" reads as a field. */
const humanise = (name: string): string => {
  const spaced = name.replace(/[_-]+/g, " ").trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
};

const propertyName = (name: string): string =>
  name.trim().replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").toLowerCase();

function FieldRow({ field }: { field: FieldSpec }): JSX.Element {
  const [open, setOpen] = useState(false);
  const panelId = `${useId()}-field`;
  const described = field.description !== undefined && field.description.trim() !== "";

  return (
    <div className="border-hairline border-b last:border-b-0">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="hover:bg-elevated flex w-full items-start gap-3 px-4 py-3 text-left"
      >
        <motion.span
          animate={{ rotate: open ? 90 : 0 }}
          transition={{ duration: 0.16, ease: [0, 0, 0.2, 1] }}
          className="text-ink-subtle mt-0.5 shrink-0"
        >
          <ChevronRight className="size-4" />
        </motion.span>

        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-ink-strong font-medium">{humanise(field.name)}</span>
            <Badge>{JSON_TYPE[field.kind]}</Badge>
            {/* Every field is required: the strict structured-output mode the
                agent CLIs use rejects a schema that leaves one optional. */}
            <Badge tone="info">Required</Badge>
          </span>
          <span className="text-ink-subtle mt-1 block break-all font-mono text-xs">{propertyName(field.name)}</span>
          {described && <span className="text-ink-label mt-1 line-clamp-2 block text-xs">{field.description}</span>}
        </span>

        <span className="text-ink-subtle hidden shrink-0 text-right text-xs sm:block">{CONSTRAINT[field.kind]}</span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={panelId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: [0, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <dl className="bg-elevated grid gap-x-6 gap-y-2 px-11 py-3 text-xs sm:grid-cols-2">
              <div>
                <dt className="text-ink-subtle">Definition</dt>
                <dd className="text-ink-label mt-0.5">
                  {described
                    ? field.description
                    : "None. The model is told the name and the type, and nothing else."}
                </dd>
              </div>
              <div>
                <dt className="text-ink-subtle">In the schema</dt>
                <dd className="text-ink-label mt-0.5 font-mono">{JSON.stringify({ type: JSON_TYPE[field.kind] })}</dd>
              </div>
            </dl>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * The fields of one revision, searchable.
 *
 * A schema is read far more often than it is written — before a run, to decide
 * whether it asks for the right thing; after one, to explain a value. So the
 * default view is a reader: names, types, definitions and the property the
 * model actually sees, with the search that makes ninety-five of them
 * navigable.
 */
export function SchemaExplorer({ fields }: { fields: readonly FieldSpec[] }): JSX.Element {
  const [query, setQuery] = useState("");
  const [showJson, setShowJson] = useState(false);

  const needle = query.trim().toLowerCase();
  const shown = useMemo(
    () =>
      needle === ""
        ? fields
        : fields.filter((f) => [f.name, f.kind, f.description ?? ""].join(" ").toLowerCase().includes(needle)),
    [fields, needle],
  );

  return (
    <Card className="overflow-hidden">
      <CardHeader title="Schema fields" action={`${fields.length} field${fields.length === 1 ? "" : "s"}`} />

      <div className="border-hairline flex flex-wrap items-center gap-2 border-b px-3 py-2">
        <label className="shadow-control focus-within:shadow-[0_0_0_1px_var(--kumo-focus)] bg-base flex h-9 min-w-56 flex-1 items-center gap-2 rounded-lg px-3 sm:max-w-md">
          <Search className="text-ink-placeholder size-4 shrink-0" />
          <span className="sr-only">Search schema fields</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search a field or its definition"
            className="text-ink placeholder:text-ink-placeholder min-w-0 flex-1 bg-transparent outline-none"
          />
        </label>

        <span className="text-ink-subtle ml-auto text-xs tabular-nums">
          {shown.length} of {fields.length} fields
        </span>
        <button
          type="button"
          onClick={() => (needle === "" ? setShowJson((v) => !v) : setQuery(""))}
          className="shadow-control bg-base hover:bg-elevated h-9 rounded-lg px-3 text-sm font-medium"
        >
          {needle !== "" ? "Clear search" : showJson ? "Hide JSON" : "Show JSON"}
        </button>
      </div>

      {showJson && needle === "" ? (
        <pre className="bg-recessed text-ink-label max-h-[58vh] overflow-auto px-4 py-3 font-mono text-[11px] leading-relaxed">
          {JSON.stringify(compileSchema(fields), null, 2)}
        </pre>
      ) : (
        <div className="max-h-[58vh] overflow-y-auto overscroll-contain">
          {shown.length === 0 ? (
            <div className="flex min-h-52 flex-col items-center justify-center px-6 text-center">
              <Braces className="text-ink-placeholder size-6" />
              <p className="text-ink-strong mt-3 font-medium">No fields found</p>
              <p className="text-ink-subtle mt-1 text-xs">Try a field name, a type, or a word from a definition.</p>
            </div>
          ) : (
            shown.map((field, i) => <FieldRow key={`${field.name}-${i}`} field={field} />)
          )}
        </div>
      )}

      <div className="border-hairline bg-elevated text-ink-subtle flex flex-wrap items-center justify-between gap-2 border-t px-4 py-2 text-xs">
        <span>Open a field to read the definition the model is given.</span>
        <span className="font-mono">lirovo.db · schema_revisions</span>
      </div>
    </Card>
  );
}
