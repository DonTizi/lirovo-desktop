# Complete extraction export spike

Date: 2026-09-07. Verdict: adopt the existing verified-transfer pattern for an exclusive run folder; no archive dependency required.

## Observations before tests

`node spikes/complete-export/probe.mjs` invoked production functions against a fresh real SQLite profile. The original JSON report had results/evidence/audit but no transcript or graph. The existing library backup preserved the artifact bytes, but included both runs and was a recovery format rather than a shareable run export.

The first fixture path failed because macOS `/var` is a symlink. Canonicalizing the freshly created scratch root before calling the existing no-symlink transfer resolved it; production paths were not weakened.

After implementation, the same direct probe exported 13 data files, verified every destination size/SHA-256, preserved full Unicode transcript, both graph representations, real ffmpeg JPEG/video bytes, and scoped records to one of two source runs. Existing destination, protected library, active lease and source-symlink calls refused. A real unreadable source file then produced an explicitly incomplete folder while retaining source bytes; this behavior was exercised before its regression test was added. Scratch root for that final probe: `/private/var/folders/4t/wjt0c0cd51jgn1ypy8xry_hh0000gn/T/lirovo-complete-export-5Sn9Ex`.

## Native observations

In the running Electron development app, the actual Export menu defaulted to Complete extraction folder and disabled the scope selector at All results. The actual native picker was opened and cancelled; the UI reported no saved export. A second picker interaction ended with successful export in Downloads (the computer-use tool reported concurrent window interaction, so this is an observed successful native path, not a fully isolated automated picker sequence).

Independent filesystem verification found 237 indexed data files plus the manifest, 89,362,113 indexed bytes, 220 transcript segments, 114 raw + 112 deduplicated images, 39 graph nodes and 74 edges. Every manifest hash matched its file. The saved extraction had a failed vision stage and no visual-analysis artifact; the manifest correctly declared that category unavailable. No extraction/review/source data was edited or deleted. External original media was not fetched.

## Limits / production checklist

- [x] Productionize run-scoped records and reuse verified copy/inventory/publication.
- [x] Typed IPC and native-selected destinations only; report-only formats stay available.
- [x] Safety, completeness, missing-tree, malformed-manifest and real-permission-failure regressions.
- [x] Real native dialog cancellation and saved-file inspection.
- [ ] Granular progress and concurrent library browsing during very large transfers are future work. Current UI explicitly explains the pause and requires keeping Lirovo open.
- No guarantee of source/model truth, secure erasure, malicious same-user filesystem races, or power-loss-atomic directory publication. Exported file paths inside original JSON remain original provenance; the manifest's artifactBase and relative file inventory describe portable locations.

Official references checked: [Electron dialog](https://www.electronjs.org/docs/latest/api/dialog), [Node file handles and streams](https://nodejs.org/api/fs.html#filehandlecreatereadstreamoptions). Native directory selection and streamed copying follow those APIs; the marker/hash/SQLite coordination protocol is the project's own validated pattern.
