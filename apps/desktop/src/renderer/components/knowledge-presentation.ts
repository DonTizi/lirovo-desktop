const normalize = (text: string): string => text.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase();

/** Keep every character; highlighting is presentation, never a shortened retrieval. */
export function highlightWords(text: string, query: string): { text: string; match: boolean }[] {
  const words = normalize(query).match(/[\p{L}\p{N}]+/gu) ?? [];
  return text.split(/([\p{L}\p{N}\p{M}]+)/u).map(part => ({ text: part, match: words.length > 0 && words.some(word => normalize(part).includes(word)) }));
}
export const fieldLabel = (path: string): string => path.replace(/\[\d+\]/g, "").replace(/[_.]+/g, " ").trim();
export function sourceLabel(uri: string): string {
  try { const url = new URL(uri); if (url.protocol === "http:" || url.protocol === "https:") return url.hostname.replace(/^www\./, ""); }
  catch { /* A local path is not a public URL. */ }
  return "Local video";
}
