# Welcome monogram

Replace only the welcome film symbol with a bespoke rounded L matching the approved neutral UI.

```text
welcome icon -> LirovoMark SVG -> inherited theme color
```

Pattern: decorative, reusable currentColor SVG. Accept: clear L silhouette, soft corner/short angled foot, same welcome spacing, light/dark support, no redundant spoken label. Non-goals: app icon, sidebar wordmark, other media icons, animation, engine changes. Files: App and LirovoMark. spike: no — standard inline SVG, no new API/dependency or runtime uncertainty. Verify build/typecheck/tests/format, independent small diff review and native welcome screenshot. Oracle proves render/integration, not subjective brand approval. Rollback only monogram component/import/call. No release or README.

Validation 2026-09-05: native welcome screenshot shows the rounded L with an angled foot at the original icon position. Fresh reviewer accepted bounds, currentColor, decorative semantics and scoped replacement. Formatting, 67 desktop tests, build/typecheck/preload guard and diff checks pass; existing Rollup platform/bundle-size warnings remain. No lint script configured. Theme inheritance is source-verified; native light mode was not toggled. Recall found the neutral desktop project conventions but no approved desktop L asset; other vendor logos already use inline SVG. MDN SVG fill documentation cross-checked. Cosmetic asset only, no new architectural pattern or ADR.
