import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronsUpDown, Search, Settings2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { SCHEMA_PRESETS, type FieldSpec, type SchemaPreset } from "@lirovo/core";
import type { SchemaSummary } from "@lirovo/node-runtime";
import { cn } from "../lib/cn";

export interface SchemaChoice {
  /** The stored revision, when this came from one. */
  readonly revisionId: string | null;
  readonly label: string;
  readonly fields: readonly FieldSpec[];
}

/** Search once the list is long enough that scanning it costs more than typing. */
const SEARCHABLE_AT = 8;

/**
 * Choose a schema from however many exist.
 *
 * A row of chips reads well at four and breaks at ten: it wraps into a block
 * that has to be scanned, and a saved schema called "Talk or lecture" sits
 * beside a preset of the same name with nothing to tell them apart. One control
 * with one value fixes both — the groups say where each entry came from, and
 * the trigger says what is currently selected without anyone having to look for
 * the highlighted pill.
 */
export function SchemaSelect({
  current,
  onChoose,
  onManage,
}: {
  current: { label: string; fieldCount: number; version: number | null };
  onChoose: (choice: SchemaChoice) => void;
  onManage: () => void;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [saved, setSaved] = useState<SchemaSummary[]>([]);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    void window.lirovo.listSchemas().then((answer) => {
      if (answer.ok) setSaved(answer.value);
    });
  }, [open]);

  // Close on Escape or on a click that lands outside. Both, because a menu that
  // only closes one way is a menu someone gets stuck in.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") setOpen(false);
    };
    const onClick = (e: MouseEvent): void => {
      if (box.current !== null && !box.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  const needle = query.trim().toLowerCase();
  const matches = (text: string): boolean => needle === "" || text.toLowerCase().includes(needle);

  const savedShown = useMemo(() => saved.filter((s) => matches(s.name) || matches(s.description ?? "")), [saved, needle]);
  const presetsShown = useMemo(
    () => SCHEMA_PRESETS.filter((p) => matches(p.label) || matches(p.about)),
    [needle],
  );

  const pick = async (summary: SchemaSummary): Promise<void> => {
    const answer = await window.lirovo.schemaRevisions(summary.id);
    if (!answer.ok) return;
    const revision = answer.value.find((r) => r.published) ?? answer.value[0];
    if (revision === undefined) return;
    onChoose({ revisionId: revision.id, label: summary.name, fields: revision.fields });
    setOpen(false);
  };

  const pickPreset = (preset: SchemaPreset): void => {
    onChoose({ revisionId: null, label: preset.label, fields: preset.fields });
    setOpen(false);
  };

  const Row = ({
    title,
    about,
    badge,
    selected,
    onSelect,
  }: {
    title: string;
    about: string | null;
    badge?: string;
    selected: boolean;
    onSelect: () => void;
  }): JSX.Element => (
    <button
      onClick={onSelect}
      className="hover:bg-elevated flex w-full items-start gap-2 px-3 py-2 text-left transition-colors"
    >
      <Check className={cn("mt-0.5 size-3.5 shrink-0", selected ? "text-brand" : "opacity-0")} />
      <span className="min-w-0 flex-1">
        <span className="text-ink-strong block truncate text-sm">{title}</span>
        {about !== null && about !== "" && <span className="text-ink-subtle block truncate text-xs">{about}</span>}
      </span>
      {badge !== undefined && <span className="bg-tint text-ink-label shrink-0 rounded px-1.5 text-[11px]">{badge}</span>}
    </button>
  );

  return (
    <div ref={box} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="border-line bg-base hover:bg-elevated flex h-9 w-full items-center gap-2 rounded-lg border px-3 text-left text-sm transition-colors"
      >
        <span className="text-ink-strong min-w-0 flex-1 truncate">{current.label}</span>
        {current.version !== null && (
          <span className="bg-tint text-ink-label shrink-0 rounded px-1.5 text-[11px]">v{current.version}</span>
        )}
        <span className="text-ink-subtle shrink-0 text-xs">
          {current.fieldCount === 0 ? "no fields" : `${current.fieldCount} field${current.fieldCount === 1 ? "" : "s"}`}
        </span>
        <ChevronsUpDown className="text-ink-subtle size-3.5 shrink-0" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.14, ease: [0.2, 0, 0, 1] }}
            className="bg-base shadow-popover absolute left-0 right-0 z-30 mt-1 overflow-hidden rounded-lg"
          >
            {saved.length + SCHEMA_PRESETS.length >= SEARCHABLE_AT && (
              <div className="border-hairline flex items-center gap-2 border-b px-3 py-2">
                <Search className="text-ink-subtle size-3.5" />
                <input
                  autoFocus
                  className="text-ink placeholder:text-ink-placeholder min-w-0 flex-1 border-0 bg-transparent text-sm outline-none"
                  placeholder="Search schemas"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
            )}

            <div className="max-h-72 overflow-y-auto">
              {savedShown.length > 0 && (
                <>
                  <p className="text-ink-subtle px-3 pb-1 pt-2 text-[11px] uppercase tracking-wide">Your schemas</p>
                  {savedShown.map((s) => (
                    <Row
                      key={s.id}
                      title={s.name}
                      about={s.description}
                      badge={`v${s.version}`}
                      selected={current.label === s.name}
                      onSelect={() => void pick(s)}
                    />
                  ))}
                </>
              )}

              {presetsShown.length > 0 && (
                <>
                  <p className="text-ink-subtle px-3 pb-1 pt-2 text-[11px] uppercase tracking-wide">
                    Start from a preset
                  </p>
                  {presetsShown.map((p) => (
                    <Row
                      key={p.id}
                      title={p.label}
                      about={p.about}
                      selected={current.label === p.label && current.version === null}
                      onSelect={() => pickPreset(p)}
                    />
                  ))}
                </>
              )}

              {savedShown.length === 0 && presetsShown.length === 0 && (
                <p className="text-ink-subtle px-3 py-4 text-center text-xs">Nothing matches “{query}”.</p>
              )}
            </div>

            <div className="border-hairline border-t">
              <Row
                title="Transcript only"
                about="transcribe and detect scenes, fill nothing in"
                selected={current.fieldCount === 0}
                onSelect={() => {
                  onChoose({ revisionId: null, label: "Transcript only", fields: [] });
                  setOpen(false);
                }}
              />
              <button
                onClick={() => {
                  setOpen(false);
                  onManage();
                }}
                className="hover:bg-elevated text-ink-label border-hairline flex w-full items-center gap-2 border-t px-3 py-2 text-left text-xs transition-colors"
              >
                <Settings2 className="size-3.5" />
                Manage schemas
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
