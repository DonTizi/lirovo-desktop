/**
 * The URL <-> path round trip for `lirovo-media://`.
 *
 * Deliberately free of every Node import so it can be tested on its own. This
 * parse is where a space, an accent, or a `#` in a filename quietly becomes a
 * 404 that reads as a broken player, which is exactly the kind of thing that
 * should be pinned by a test rather than by a screenshot.
 */
export const MEDIA_SCHEME = "lirovo-media";

/**
 * A fixed host, and the file in the path.
 *
 * The scheme is registered `standard`, which means Chromium parses it with
 * host/path semantics: an absolute POSIX path written straight after `://`
 * puts `Users` in the host and drops it from the path. Naming a host
 * explicitly makes the whole file the pathname, which is the only part that
 * round-trips.
 */
export const MEDIA_HOST = "artifact";

export const mediaUrl = (absolutePath: string): string =>
  `${MEDIA_SCHEME}://${MEDIA_HOST}${absolutePath.split("/").map(encodeURIComponent).join("/")}`;

/** Collapse `.` and `..` without asking the filesystem. */
const normalise = (raw: string): string => {
  const out: string[] = [];
  for (const part of raw.split("/")) {
    if (part === "" || part === ".") continue;
    if (part === "..") out.pop();
    else out.push(part);
  }
  return `/${out.join("/")}`;
};

export const pathFromMediaUrl = (url: string): string => normalise(decodeURIComponent(new URL(url).pathname));
