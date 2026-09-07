export type ByteRange = { start: number; end: number };

/** One inclusive range. Unsupported/malformed ranges fall back to a full response. */
export function byteRange(
  header: string | null,
  size: number,
): ByteRange | "unsatisfiable" | null {
  if (header === null) return null;
  const match = /^bytes=(\d*)-(\d*)$/i.exec(header.trim());
  if (match === null || (match[1] === "" && match[2] === "")) return null;
  const startText = match[1] ?? "";
  const endText = match[2] ?? "";
  if (size === 0) return "unsatisfiable";
  if (startText === "") {
    const suffix = Number(endText);
    if (!Number.isSafeInteger(suffix) || suffix <= 0) return "unsatisfiable";
    return { start: Math.max(0, size - suffix), end: size - 1 };
  }
  const start = Number(startText);
  const end = endText === "" ? size - 1 : Number(endText);
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    start >= size ||
    end < start
  )
    return "unsatisfiable";
  return { start, end: Math.min(end, size - 1) };
}
