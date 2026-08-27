# Reporting a vulnerability

Please report privately, not as a public issue.

Use GitHub's **[Report a vulnerability](https://github.com/DonTizi/lirovo-desktop/security/advisories/new)**
button, which opens a private advisory only the maintainers can see.

You will get an acknowledgement within a few days. If a fix is warranted it goes
out on the `latest` update channel, and the advisory is published once people
have had a chance to update.

## What is most worth looking at

This app runs a signed, notarised macOS binary that updates itself, and it
processes untrusted input. The parts where a mistake would matter most:

- **The bundled tools.** `apps/desktop/scripts/collect-binaries.mjs` downloads
  ffmpeg, ffprobe and yt-dlp and builds whisper.cpp, and everything it produces
  is signed with our Developer ID. Every artifact is pinned by version and
  verified by SHA-256 before it is made executable. A way around that check is
  the highest-value finding in this repo.
- **The updater.** `apps/desktop/src/main/updater.ts`. The feed is GitHub
  Releases on this public repo; no credential ships inside the app.
- **The IPC surface.** `apps/desktop/src/main/ipc.ts` — every channel validates
  its payload with zod and checks the sender is the main frame. `reveal` and the
  `lirovo-media://` scheme both resolve against the app's data directory and
  refuse anything outside it.
- **Untrusted content.** Transcripts, OCR text and video frames all come from
  whatever a user pointed us at, and reach a model. Prompt injection through a
  transcript is in scope.

## Not in scope

- A local user with an account on the machine reading their own data directory.
  Everything the app stores is theirs and is not encrypted at rest.
- The third-party tools' own vulnerabilities. Report those upstream — we pin and
  verify them, but we do not maintain them.
