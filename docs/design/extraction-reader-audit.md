# Extraction results: audit and implementation

2026-09-05. Scope: reading an existing extraction and opening its source evidence in the native Electron application. The approved translucent shell is unchanged.

## Audit

1. **Read results — poor before the change.** The default five-column table exposes technical paths, mixes categories through review-priority ordering, clips evidence columns, and repeats counts. The actual source screenshot is `design-evidence/extraction-01-before.png`.
2. **Check a source — unclear before the change.** An offscreen timestamp forces the table sideways, separating the value from its evidence. Whole-row click handling also interferes with individual cues. Captured in `design-evidence/extraction-02-evidence-before.png`.

Strengths retained: source recording, multimodal evidence, transcript/frames/graph, real timestamps, run diagnostics, theme tokens. Accessibility risks: horizontal reflow, generic labels, mouse-oriented controls. Screenshots alone cannot establish WCAG compliance.

## Implemented

- Reader-first groups with natural numeric field order, readable headings and field filters.
- Complete value text and on-demand source quotes, modality and time ranges. No inferred summary or loss of evidence.
- Shared safe JSON-string display decoder; serialized quotes/newlines no longer leak into prose.
- Explicit Reading/Table modes; the raw table remains available and no longer intercepts timestamp clicks with a row-wide action.
- More space for results, smaller sticky source column, responsive tab sizing and subtle translucent result surfaces.
- Accessible tab/panel semantics with arrow, Home and End navigation; native keyboard-operable source disclosures.
- Artifact failure message and retry instead of endless loading; extracted values display independently of media loading.

## Checks and limits

- Desktop production build including typecheck and CommonJS preload guard: pass.
- Desktop tests: 22/22 across 4 files, including 5 reader adapter regressions.
- Formatting and git diff whitespace: pass. No desktop lint command is configured; root lint runs zero tasks and is not claimed as coverage.
- Independent fresh-context review: PASS after two accepted fixes (JSON display decoding and dead loading component). Critic record: r20260905T182136Z-12420.
- Native screen inspection: grouped 30-value results at 1180px; search `Jarvis` returns one real value at 900px with no clipped reading columns; source disclosure reveals full quote, modality and field path. Screenshot: `design-evidence/extraction-03-search-900.png`.
- Remaining runtime checks: precise video seeking/playback, all four tabs, category switching and artifact-failure recovery require conclusive native verification. During this pass the player remained black and the capture service intermittently failed. Do not call the full task validated based only on the build/tests.
- These checks do not establish factual truth of extracted claims or complete screen-reader accessibility.

Final diagnostic: the existing video element reported `currentTime=0.461063`, `readyState=4`, `seekable=[[0,0]]`, `buffered=[[0,2.64]]` despite duration 667.5s. The normalized file exists (9,411,522 bytes, AV1, 33,375 frames according to ffprobe). A read-only renderer fetch probe was blocked by the existing CSP; security policy was not weakened. Subsequent native inspection ended with `Sky Computer Use service startup request failed`. Playback, final tab smoke and restoring the last visible app state are therefore unvalidated. No media files or backend/security configuration were changed.

Reference for tab semantics: https://www.w3.org/WAI/ARIA/apg/patterns/tabs/.

## Playback continuation — validated 2026-09-05

The earlier playback blocker is resolved. Electron 44 reads file byte ranges but returns status 200 without Content-Range/Length. The media adapter now supplies the correct 206 envelope while retaining native streaming, existing root containment and CSP. The separate normalized FLAC follows the video clock; sound has an explicit mute/retry control. No stored media or extraction results were changed.

- Real Electron production-handler probe: exact requested bytes plus 206/range headers; HEAD, 416, 405 and out-of-root 403 passed.
- Native source timestamps: jump to 10:25, back to 1:02 and 5:04; the displayed frame changes.
- Native media diagnostic: video 103.980848s and audio 103.920712s, both playing, unmuted and error-free; audio decoded 1,672,287 bytes. Seekable video is now [0,667.5], audio [0,667.573688]. At completion both tracks pause; the mute control changes audio.muted.
- Native reader smoke: Topics filter shows eight items; Jarvis search one item; expanded source shows full text/modality/field; Reading/Table switch works; arrow keys select Transcript then Frames and Home returns Results. Graph rendering was also observed.
- 900px screenshot with source open and video at 10:25: `design-evidence/extraction-04-playback-900.png`. Reader remains usable without clipped value columns; 1180px inspected too.
- 40 tests across six files passed; production build/typecheck/preload guard and formatting/whitespace passed. Root lint still executes no tasks. Existing build warnings: renderer chunk above 500kB and an ignored Vite/Rollup platform option.
- Fresh-context continuation review approved after clearing a stale audio error on playback recovery. Ledger: r20260905T185440Z-31951.

Oracle limits: paired playback is measured, not an acoustic quality test; other codecs, exhaustive accessibility and artifact-failure recovery were not exercised in this smoke. Extracted claims are not fact-checked. No commit, package release or deployment was made.
