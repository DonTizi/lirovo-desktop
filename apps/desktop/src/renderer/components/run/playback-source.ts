/** Retry the same stored file with a fresh media-resource cache identity. */
export function playbackSource(source: string | null, attempt: number): string | undefined {
  if (source === null) return undefined;
  if (attempt === 0) return source;
  const url = new URL(source);
  url.searchParams.set("playbackAttempt", String(attempt));
  return url.toString();
}
