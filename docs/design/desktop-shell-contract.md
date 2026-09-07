# Desktop workspace design contract

Simplify extraction around a Codex-inspired neutral workspace. Preserve the real engine, schemas, stored runs and appearance preference.

```text
Sidebar                     Workspace
New extraction / Library    Contextual title and controls
Schemas                     Spacious introduction
Recent extractions          Schema choice (customize on demand)
Settings / engine status    Source composer -> progress -> result
```

- Pattern: persistent sidebar + contextual toolbar + progressive disclosure. Existing React components, Inter and Lucide; no new dependencies.
- Acceptance: charcoal/grey dark theme matching the supplied visual direction; complete light theme; visible file picker; keyboard submission; schema selection/editing preserved; recent runs and result search work; errors and cancellation stay reachable; narrow desktop windows scroll without hiding persistent controls.
- Non-goals: chat/agent functionality, backend changes, localization, deployment or packaging.
- Files: renderer App, NavBar, TitleBar, SourceInput, SchemaPicker, SchemaSelect, globals.css and Tailwind token adapter.
- Spike: yes — prove light-dark color values plus alpha modifiers in the installed Electron runtime before replacing the invalid channel tokens.
- Verification: desktop build, typecheck, existing desktop tests, available lint/format checks, live Electron navigation/theme/schema/source inspection and screenshot comparison.
- Oracle: proves renderer integration, colors and the exercised interactions. Does not prove every extraction provider, new extraction quality, packaged-app distribution, or full accessibility conformance. Visual preference still benefits from user review.
- Rollback: reverse only this design diff; preserve the existing preload correction, local data and unrelated files. No commit/push.

## Audit evidence

1. Entry: `design-evidence/before-overview.png`. Three header rows consume space; search is visible with no result selected; source action competes with a full schema editor.
2. Schema configuration: preset and field editing already work. Keep the functionality, reveal editing only when requested.
3. History: Runs, Needs review and Activity repeat the same records. Use a single recent list and retain Library for full inspection.

Prior-art recall found marketing design patterns, not a directly applicable desktop shell. Use the repository's theme preference contract and the supplied screenshot as the authority. Reference: Apple HIG sidebars/dark mode; MDN light-dark and relative colors.
