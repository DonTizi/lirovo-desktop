# Spike: desktop-media-seeking

- goal: restore native evidence seeking without replacing or copying stored media.
- hypothesis: the custom protocol response lacks the byte-range metadata Chromium needs.
- materiality: real runtime uncertainty.

## What was exercised
Installed Electron net.fetch against the existing normalized recording, then the production media handler against the same immutable bytes.

## Outputs observed
See the observed result below and `probe.cjs` / `verify.cjs`.

## Edge cases found
Out-of-bounds native ranges throw; unsupported multipart requests should receive a full response.

## Limitations found
This is one Electron version and recording, not every codec or large-file case.

## Verdict: adapt
Keep native streaming; supply the correct range envelope.

## Productionization checklist (if adopted — spike code is NEVER merged directly)
- [x] rewritten outside spikes/, scaffolding/secrets stripped
- [x] tests added for the edge cases above
- [x] verified (DoD)
- [x] limitations cited in plan/ADR
# Observed result — 2026-09-05

Installed Electron 44.0.0, direct net.fetch on the existing 9,411,522-byte MP4:
- no Range: status 200, full 9,411,522 bytes, only content-type/last-modified headers;
- bytes=0-1023: status 200, exactly 1,024 bytes, no Content-Range/Length;
- bytes=4096-8191: status 200, exactly 4,096 bytes, no Content-Range/Length;
- out of bounds: throws ERR_REQUEST_RANGE_NOT_SATISFIABLE.

Verdict: adapt. Native fetch supports byte reads but not the HTTP envelope expected by a media element. Production code should stat the file, normalize a single inclusive range, provide 206/Content-Range/Content-Length/Accept-Ranges, and delegate only the byte stream to net.fetch. Handle 416 before fetching, HEAD without reading, and ignore unsupported/conditional ranges safely. Preserve the existing root containment and CSP. No source data is modified.

Official references: https://www.electronjs.org/docs/latest/api/protocol and https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Range_requests .

Production checklist: focused range tests, real Electron response-byte comparison, full desktop build/tests, native seek forward/back, independent review. Audio normalization also produces a separate FLAC, which needs a separate playback check.

Completed: `verify.cjs` passed exact bytes and status/headers; 40 desktop tests and production build passed; native paired media measured within 60ms, seek forward/back and mute/end verified. See `docs/design/extraction-reader-audit.md` for exact measurements and limits. Rebuild the temporary probe bundle with installed esbuild using `--bundle --platform=node --format=cjs --external:electron --packages=external --outfile=apps/desktop/media-protocol-probe.cjs`, input `apps/desktop/src/main/media-protocol.ts`, then run `verify.cjs <recording-path>` with the installed Electron binary. Generated probe bundles are disposable and not production inputs.
