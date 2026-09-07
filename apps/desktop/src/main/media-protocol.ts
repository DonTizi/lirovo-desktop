import path from "node:path";
import { stat } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { net, protocol } from "electron";
import { resolvePaths } from "@lirovo/node-runtime";
import { MEDIA_SCHEME, pathFromMediaUrl } from "./media-url.js";
import { byteRange } from "./byte-range.js";

export { MEDIA_SCHEME, mediaUrl } from "./media-url.js";

/**
 * `lirovo-media://` — the only way the renderer sees a file.
 *
 * A `file://` src does not work: the page is served over http in development
 * and from a bundle in production, and Chromium refuses the cross-origin read
 * either way — which is why the player rendered a black rectangle. Turning
 * `webSecurity` off would fix it by handing the renderer every file on the
 * disk, so instead this scheme serves only the run directory and resolves
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
 * Electron's file fetch reads the requested byte range, but in Electron 44
 * reports 200 and omits Content-Length/Content-Range. Supply the HTTP envelope
 * explicitly so the media element can seek; keep the streamed body native.
 */
export const handleMediaRequest = async (
  request: Request,
  roots: readonly string[],
): Promise<Response> => {
  const file = pathFromMediaUrl(request.url);

  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response(null, { status: 405, headers: { Allow: "GET, HEAD" } });
  }

  if (!roots.some((root) => withinRoot(file, root))) {
    // Logged rather than silent: a refused request renders as a black player,
    // and a black player with nothing in the log is unfixable.
    process.stderr.write(`[media] refused ${file}\n`);
    return new Response("forbidden", { status: 403 });
  }

  const info = await stat(file).catch(() => null);
  if (info === null || !info.isFile())
    return new Response("not found", { status: 404 });
  // HEAD and conditional range requests receive the complete representation.
  // We do not implement If-Range validators; ignoring Range is safe in that case.
  const range = byteRange(
    request.method === "HEAD" || request.headers.has("if-range")
      ? null
      : request.headers.get("range"),
    info.size,
  );
  const headers = new Headers({
    "accept-ranges": "bytes",
    "content-type":
      TYPES[path.extname(file).toLowerCase()] ?? "application/octet-stream",
    "last-modified": info.mtime.toUTCString(),
  });
  if (range === "unsatisfiable") {
    headers.set("content-range", `bytes */${info.size}`);
    return new Response(null, { status: 416, headers });
  }
  headers.set(
    "content-length",
    String(range === null ? info.size : range.end - range.start + 1),
  );
  if (range !== null)
    headers.set(
      "content-range",
      `bytes ${range.start}-${range.end}/${info.size}`,
    );
  if (request.method === "HEAD")
    return new Response(null, { status: 200, headers });
  const upstreamHeaders = new Headers();
  if (range !== null)
    upstreamHeaders.set("range", `bytes=${range.start}-${range.end}`);

  // `bypassCustomProtocolHandlers` so this cannot recurse into itself.
  const answer = await net
    .fetch(pathToFileURL(file).toString(), {
      headers: upstreamHeaders,
      signal: request.signal,
      bypassCustomProtocolHandlers: true,
    })
    .catch(() => null);

  if (answer === null || answer.status === 404) {
    process.stderr.write(`[media] missing ${file}\n`);
    return new Response("not found", { status: 404 });
  }

  return new Response(answer.body, {
    status: range === null ? 200 : 206,
    headers,
  });
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
  protocol.handle(MEDIA_SCHEME, (request) =>
    handleMediaRequest(request, roots),
  );
};
