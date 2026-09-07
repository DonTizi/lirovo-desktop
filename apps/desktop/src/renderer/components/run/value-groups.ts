import type { ValueRow } from "../../../bridge/contract.js";

/** The bridge carries value_json, not an already decoded display string. */
export function displayValue(value: string): string {
  try {
    const decoded: unknown = JSON.parse(value);
    return typeof decoded === "string" ? decoded : value;
  } catch {
    return value;
  }
}

export const fieldGroup = (path: string): string =>
  path.replace(/\[\d+\]/g, "");

export const fieldLabel = (path: string): string =>
  fieldGroup(path)
    .replace(/([a-z\d])([A-Z])/g, "$1 $2")
    .replace(/[_.-]+/g, " ")
    .replace(/^./, (letter) => letter.toUpperCase());

/** Display order only: retain original objects, complete text and evidence. */
export function groupValues(
  values: readonly ValueRow[],
): { key: string; label: string; rows: ValueRow[] }[] {
  const groups = new Map<string, ValueRow[]>();
  for (const row of values) {
    const key = fieldGroup(row.fieldPath);
    const rows = groups.get(key) ?? [];
    rows.push(row);
    groups.set(key, rows);
  }
  return [...groups]
    .sort(([a], [b]) => {
      if (a === "title") return -1;
      if (b === "title") return 1;
      return a.localeCompare(b, undefined, { numeric: true });
    })
    .map(([key, rows]) => ({
      key,
      label: fieldLabel(key),
      rows: rows.sort((a, b) =>
        a.fieldPath.localeCompare(b.fieldPath, undefined, { numeric: true }),
      ),
    }));
}
