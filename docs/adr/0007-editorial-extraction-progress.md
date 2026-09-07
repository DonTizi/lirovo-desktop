# ADR 0007: Truthful editorial extraction progress

- status: accepted
- date: 2026-09-05
- spike: [observations](../../spikes/extraction-progress/NOTES.md)

## Context and decision

Replace the technical icon checklist while preserving approved desktop materials/type. Use an event-driven presentation adapter with progressive disclosure: live shimmer headline and four numbered milestones, then an unboxed summary. Keep full stage records and errors in a native disclosure. No simulated reasoning or fabricated percentages.

## Why and implementation

A cosmetic checklist would preserve misleading states; another animation dependency adds no useful capability. `progress-model.ts` translates actual events/attempts; `RunProgress.tsx` serves both launch and results. Scoped CSS handles text clipping, entry, pause, reduced motion and forced colors.

## Reuse correctly

Distinguish skipped, degraded, interrupted and unrecorded. Missing ingest on a successful recording is not pending. Latest recorded terminal attempts beat stale live activity; final command failure beats intermediate run:done. Disable keyed entry animation when paused so replacement copy cannot freeze at zero opacity. Announce meaningful copy changes politely without counter chatter.

## Proof and limits

64 tests/build/typecheck/preload guard, real-record direct invocation, native completion/disclosure and browser shimmer/pause/light/compact/failure checks passed. Independent review accepted after correction. Full new extraction, OS accessibility emulation and screen-reader speech were not exercised. See spike notes. Local only.

## References

- [MDN reduced motion](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/%40media/prefers-reduced-motion): followed with CSS fallback.
- [MDN text clipping](https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Styling_basics/Advanced_styling_effects): adapted to existing tokens.
- [WAI status messages](https://www.w3.org/WAI/WCAG21/Understanding/status-messages): polite status region.
- [WAI pause](https://www.w3.org/WAI/WCAG21/Understanding/pause-stop-hide.html): explicit animation pause.
- Vault: `/Users/dontizi/Obsidian/vault/projects/lirovo/lirovo.md`.
