import path from "node:path";
import { pathToFileURL } from "node:url";
import { net, protocol } from "electron";
import { resolvePaths } from "@lirovo/node-runtime";
import { MEDIA_SCHEME, pathFromMediaUrl } from "./media-url.js";

export { MEDIA_SCHEME, mediaUrl } from "./media-url.js";

/**
 * `lirovo-media://` — the only way the renderer sees a file.
 *
 * A `file://` src does not work: the page is served over http in development
 * and from a bundle in production, and Chromium refuses the cross-origin read
 * either way — which is why the player rendered a black rectangle. Turning
 * `webSecurity` off would fix it by handing the renderer every file on the
 * disk, so instead this scheme serves exactly two directories and resolves
 * every request against them before opening anything.
 */
/** Registered before `app.whenReady`, which is the only moment this is allowed. */
export const registerMediaScheme = (): void => {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: MEDIA_SCHEME,
      privileges: {
        // `stream: true` is what makes <video> able to seek: without it
        // Chromium has to buffer the whole file before it will scrub.
        stream: true,
        supportFetchAPI: true,
        bypassCSP: false,
        standard: true,
        secure: true,
      },
    },
  ]);
};

/**
 * Only the run directory.
 *
 * The player uses `normalized/video.mp4` rather than the file the user picked,
 * which keeps every readable path inside one directory this app created. It is
 * also the more correct video to scrub: frame timestamps were measured against
 * the normalized stream, not against the original container.
 */
const withinRoot = (candidate: string, root: string): boolean => {
  const rel = path.relative(root, candidate);
  return rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel);
};

/**
 * Serve the file, and let Chromium do the ranges.
 *
 * The hand-rolled version advertised `accept-ranges: bytes` and then ignored
 * the `Range` header, answering every request with the whole file and a 200.
 * A player asked to seek to 18:36 of an 80MB video therefore refetched from
 * byte zero — which is the one interaction this whole app exists to make
 * work, since every extracted value is a timecode you click.
 *
 * `net.fetch` on a `file://` URL implements 206, `Content-Range` and 416
 * correctly because it is the same code path Chromium uses for any file, and
 * it is code we then do not own. The containment check stays ours: it runs
 * before the fetch, and nothing outside the run directory is ever named.
 */
export const handleMediaRequest = async (request: Request, roots: readonly string[]): Promise<Response> => {
  const file = pathFromMediaUrl(request.url);

  if (!roots.some((root) => withinRoot(file, root))) {
    // Logged rather than silent: a refused request renders as a black player,
    // and a black player with nothing in the log is unfixable.
    process.stderr.write(`[media] refused ${file}\n`);
    return new Response("forbidden", { status: 403 });
  }

  // `bypassCustomProtocolHandlers` so this cannot recurse into itself.
  const answer = await net
    .fetch(pathToFileURL(file).toString(), {
      headers: request.headers,
      bypassCustomProtocolHandlers: true,
    })
    .catch(() => null);

  if (answer === null || answer.status === 404) {
    process.stderr.write(`[media] missing ${file}\n`);
    return new Response("not found", { status: 404 });
  }

  // Chromium guesses a type from the extension and gets video containers
  // wrong often enough to matter; a `.mp4` served as octet-stream will not
  // play. Ours wins where we have one.
  const known = TYPES[path.extname(file).toLowerCase()];
  if (known === undefined) return answer;

  const headers = new Headers(answer.headers);
  headers.set("content-type", known);
  return new Response(answer.body, { status: answer.status, statusText: answer.statusText, headers });
};

const TYPES: Record<string, string> = {
  ".mp4": "video/mp4",
  ".m4v": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
  ".mkv": "video/x-matroska",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".flac": "audio/flac",
  ".wav": "audio/wav",
  ".m4a": "audio/mp4",
};

export const installMediaProtocol = (): void => {
  const roots = [resolvePaths().runs];
  protocol.handle(MEDIA_SCHEME, (request) => handleMediaRequest(request, roots));
};
