import { motion } from "framer-motion";
import { Plus, X } from "lucide-react";
import { useRef } from "react";
import { useScrollMask } from "../lib/useScrollMask";
import type { FieldKind, FieldSpec } from "@lirovo/core";
import { cn } from "../lib/cn";

const KIND_LABEL: Record<FieldKind, string> = {
  text: "Text",
  list: "List",
  number: "Number",
  date: "Date",
};

/**
 * The one field editor.
 *
 * Both the picker on the home page and the schema manager need exactly this,
 * and two hand-written tables for the same rows are two tables that drift —
 * one grows a description column and the other quietly does not.
 */
export function FieldRows({
  fields,
  onChange,
  emptyNote,
  className,
}: {
  fields: readonly FieldSpec[];
  onChange: (fields: FieldSpec[]) => void;
  emptyNote: string;
  className?: string;
}): JSX.Element {
  const list = useRef<HTMLDivElement>(null);
  const { maskImage, onScroll } = useScrollMask(list, [fields.length]);

  const setField = (index: number, patch: Partial<FieldSpec>): void =>
    onChange(fields.map((f, i) => (i === index ? { ...f, ...patch } : f)));

  return (
    <div className={cn("bg-base shadow-ring overflow-hidden rounded-lg", className)}>
      {/* Bounded on purpose. A schema with twelve fields would otherwise push
          everything below it off the screen, and the page would grow every time
          someone added a row. Five is where the list stops being a glance. */}
      <div
        ref={list}
        onScroll={onScroll}
        style={maskImage === undefined ? undefined : { WebkitMaskImage: maskImage, maskImage }}
        className="scrollbar-hide max-h-[280px] overflow-y-auto overscroll-contain"
      >
      {fields.length === 0 ? (
        <p className="text-ink-subtle px-4 py-4 text-center text-xs">{emptyNote}</p>
      ) : (
        fields.map((field, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.14, ease: [0.2, 0, 0, 1] }}
            className="border-hairline border-b px-3 py-2 last:border-b-0"
          >
            <div className="flex items-center gap-2">
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
            </div>

            {/* The description is what the model reads to know where the field's
                boundary is, so it sits with the field rather than behind a
                disclosure that most people would never open. */}
            <input
              className="text-ink-label placeholder:text-ink-placeholder mt-0.5 w-full border-0 bg-transparent text-xs outline-none"
              placeholder="What belongs in this field, and what does not"
              value={field.description ?? ""}
              onChange={(e) => setField(index, { description: e.target.value })}
            />
          </motion.div>
        ))
      )}
      </div>

      {/* Pinned below the scroller: the way to add a row must not scroll away
          the moment there are enough rows to need scrolling. */}
      <button
        className="border-hairline text-ink-subtle hover:bg-elevated hover:text-ink flex w-full items-center justify-center gap-1.5 border-t px-3 py-2 text-xs transition-colors"
        onClick={() => onChange([...fields, { name: "", kind: "text" }])}
      >
        <Plus className="size-3.5" />
        Add a field
      </button>
    </div>
  );
}
