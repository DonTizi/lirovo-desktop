/**
 * The URL <-> path round trip for `lirovo-media://`.
 *
 * Deliberately free of every Node import so it can be tested on its own. This
 * parse is where a space, an accent, or a `#` in a filename quietly becomes a
 * 404 that reads as a broken player, which is exactly the kind of thing that
 * should be pinned by a test rather than by a screenshot.
 */
export const MEDIA_SCHEME = "lirovo-media";

/** Turn an absolute path into a URL the renderer can put in a src. */
export const mediaUrl = (absolutePath: string): string =>
  `${MEDIA_SCHEME}://${absolutePath.split("/").map(encodeURIComponent).join("/")}`;

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

export const pathFromMediaUrl = (url: string): string => {
  // Host and pathname are recombined because a `standard` scheme parses the
  // first segment of an absolute POSIX path as the host.
  const parsed = new URL(url);
  return normalise(decodeURIComponent(`${parsed.hostname}${parsed.pathname}`));
};
