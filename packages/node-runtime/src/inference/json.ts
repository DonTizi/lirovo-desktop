/**
 * Pull a JSON object out of model output.
 *
 * Models wrap JSON in prose or fences even when told not to, so the extractor
 * scans for the first balanced object while respecting string literals and
 * escapes. A brace inside `"a } b"` must not close the object.
 */
export const extractJson = (text: string): unknown => {
  const fenced = /```(?:json)?\s*\n([\s\S]*?)```/.exec(text);
  const haystack = fenced?.[1] ?? text;

  const start = haystack.search(/[{[]/);
  if (start === -1) throw new Error("no JSON object found in output");

  const open = haystack[start];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < haystack.length; i += 1) {
    const ch = haystack[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === open) depth += 1;
    else if (ch === close) {
      depth -= 1;
      if (depth === 0) return JSON.parse(haystack.slice(start, i + 1));
    }
  }
  throw new Error("JSON object never closed — output is truncated");
};

/**
 * A truncated answer usually arrives wearing a success status, so the only
 * reliable tell is the shape of the payload itself.
 */
export const looksTruncated = (text: string): boolean => {
  const trimmed = text.trimEnd();
  if (trimmed === "") return true;
  try {
    extractJson(trimmed);
    return false;
  } catch (e) {
    return e instanceof Error && e.message.includes("truncated");
  }
};
