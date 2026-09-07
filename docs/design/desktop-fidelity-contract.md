# Desktop visual fidelity correction

Match the supplied Codex reference's system typography, compact rows and bottom composer while retaining Lirovo's real extraction workflow. Clarification: the user wants native translucency across the entire app, including the center and top navigation, not only the sidebar.

```text
macOS sidebar material | translucent workspace + top navigation
  compact navigation  | centered welcome / real progress
  recent extractions  | compact schema context
  settings + status   | bottom source composer
```

Pattern: native material shell + shared semantic tokens + progressive disclosure.
Tier 1; spike: yes — native Electron vibrancy must work with a sandboxed renderer before adopting it.

Acceptance: system font throughout; 270px sidebar at desktop width, 32px navigation rows, subdued separators, approximately 100px composer with a compact context strip; native macOS translucency with opaque cross-platform and reduced-transparency fallbacks. Library, schemas, settings and results inherit the same type and color system. Existing extraction, schema editing, evidence, keyboard controls, and light/dark preference remain functional. No running extraction is interrupted.

Files: desktop main window, renderer bootstrap, global CSS/Tailwind, shell, source/schema controls, progress; design evidence and QA.

Non-goals: copying Codex branding or product features, engine/IPC redesign, changing saved data, new dependencies, packaging, publication.

Verification: native-material scratch probe; desktop typecheck, build, tests, formatting and diff check; live desktop home/library/schema/settings/result interactions; paired reference and implementation screenshots at normalized density. Root lint may have no configured tasks and is not lint coverage.

Oracle: checks establish compilation, preload safety and exercised interactions; screenshots establish visual alignment, not pixel-identical Codex internals. Native material depends on macOS appearance, wallpaper and accessibility settings. Human visual approval remains required.

Rollback: reverse only this correction's hunks, preserving prior uncommitted work and user data. No commit, push or deployment.
