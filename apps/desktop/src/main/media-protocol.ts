import { createReadStream, statSync } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { protocol } from "electron";
import { resolvePaths } from "@lirovo/node-runtime";

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
export const MEDIA_SCHEME = "lirovo-media";

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

export const handleMediaRequest = (url: string, roots: readonly string[]): Response => {
  // Host and pathname are recombined because an absolute POSIX path parses as
  // `//Users/...`, putting the first segment in the host.
  const parsed = new URL(url);
  const raw = decodeURIComponent(`${parsed.hostname}${parsed.pathname}`);
  const file = path.resolve(raw.startsWith("/") ? raw : `/${raw}`);

  if (!roots.some((root) => withinRoot(file, root))) return new Response("forbidden", { status: 403 });

  try {
    const size = statSync(file).size;
    return new Response(Readable.toWeb(createReadStream(file)) as ReadableStream, {
      status: 200,
      headers: {
        "content-length": String(size),
        "content-type": contentType(file),
        // Seeking works without this in Chromium's stream mode, but saying so
        // is what stops it from downloading the whole file to scrub.
        "accept-ranges": "bytes",
      },
    });
  } catch {
    return new Response("not found", { status: 404 });
  }
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

const contentType = (file: string): string => TYPES[path.extname(file).toLowerCase()] ?? "application/octet-stream";

/** Turn an absolute path into a URL the renderer can put in a src. */
export const mediaUrl = (absolutePath: string): string =>
  `${MEDIA_SCHEME}://${absolutePath.split("/").map(encodeURIComponent).join("/")}`;

export const installMediaProtocol = (): void => {
  const roots = [resolvePaths().runs];
  protocol.handle(MEDIA_SCHEME, (request) => handleMediaRequest(request.url, roots));
};
