# ADR 0013: Verified complete extraction folders

- status: accepted
- date: 2026-09-07
- spike: [complete-export](../../spikes/complete-export/NOTES.md)

## Context

The report exporter preserved extracted observations and review evidence, but omitted transcript files, frame images and knowledge-graph artifacts. A whole-library backup preserved those files but was not an appropriate one-extraction sharing format.

## Decision

Apply the existing **immutable snapshot plus verified transfer** pattern to one extraction. Offer Complete extraction folder alongside lightweight JSON/CSV/Markdown reports. Folder exports always include all stored observations and audit; they are never represented as accepted-only.

## Why

A plain directory keeps JPEG, MP4, FLAC and JSON files directly usable without a new archive dependency, base64 expansion or binary renderer IPC. Reusing one set of verified transfer primitives avoids a second implementation of path checks and copy integrity. A library-wide write fence trades temporary unavailability for consistent stored records and artifact publication.

## How it was implemented

`export-folder.ts` snapshots run-scoped records, generates the existing three report formats, inventories and streams every run artifact into `artifacts/`, and publishes a versioned `lirovo-extraction.json` manifest after validating every file hash. Frame-manifest references and database-recorded artifact paths must exist. Missing analysis categories are declared rather than fabricated.

`verified-transfer.ts` holds shared exclusive-folder, no-symlink, streaming-copy, hash, idle-owner and publication primitives formerly local to library backup. Native main selects the destination; the isolated engine performs the transfer while maintenance fencing prevents concurrent application writes. Existing destinations and protected roots are refused.

## How to implement it correctly next time

Preserve full source files and original provenance, including the distinction between generated and unavailable data. Keep a complete manifest and retain an incomplete marker on failure. Export only explicitly scoped records, not an entire user database. Validate real bytes and native picker behavior before writing regression expectations. Explain sensitivity and the temporary pause in the UI.

## Limitations and evidence

The real native export contained 237 indexed files plus its manifest, 220 transcript segments, 114 raw and 112 deduplicated frames, and 39 graph nodes/74 edges. Each indexed SHA-256 was independently verified. The source's vision stage had failed; no visual analysis was invented. See [validation](../design/complete-extraction-export-validation.md).

The export does not copy external original files, credentials, installed tools/models or unrelated runs. It is not a restorable library backup. Original absolute paths inside source records remain provenance; portable file locations are the manifest's relative paths. Stored prompts, host/process diagnostics, original/rejected values and media may be sensitive. Large transfers pause other library operations and currently have indeterminate progress. Hash checks prove saved-byte fidelity, not model accuracy, malicious same-user filesystem-race resistance or power-loss atomicity.

## Links

- [Contract](../design/complete-extraction-export-contract.md)
- [Electron directory dialogs](https://www.electronjs.org/docs/latest/api/dialog)
- [Node file handles and streaming](https://nodejs.org/api/fs.html#filehandlecreatereadstreamoptions)
- Existing project knowledge: `/Users/dontizi/Obsidian/vault/projects/lirovo/lirovo.md`
- Local increment only; no commit or publication yet.
