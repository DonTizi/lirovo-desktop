# Onboarding refresh

Bring first launch into the approved neutral desktop design without changing installation, readiness, or persistence contracts.

```text
Doctor report -> existing onboardingSteps -> three setup disclosures
                    |                         | install / choose / recheck
                    +-> canExtract -> Continue +-> existing bridge
```

- Pattern: shared theme tokens, shared LirovoMark, progressive disclosure over existing doctor state.
- Acceptance: no pixel backdrop; native typography, neutral surfaces, restrained entrance motion; accessible expandable steps, full readable guidance; distinguish optional improvements from blockers; preserve skip, installs, recheck, backend choice. Default model matches core recommendation.
- Non-goals: engine changes, new onboarding persistence, downloads during verification, app/Dock icons, new dependencies.
- Files: Onboarding.tsx; scoped onboarding.css; first-run title in App.tsx; isolated onboarding preview; this contract.
- Spike: no. Existing React component, motion dependency, report model and bridge callbacks are reused. Direct invocation observed three blocked steps and canExtract=false for missing tools/speech/model before editing.
- Verify: desktop typecheck/build/tests; core onboarding tests; Prettier; diff check; production component in an isolated browser replay for ready, optional, blocked, model selection, disclosure, recheck and skip/continue; light/dark and narrow width visual checks.
- Oracle: replay proves UI rendering and callback wiring, not real downloads/provider authentication. No user onboarding preference will be reset. Human brand preference remains subjective.
- Rollback: revert only this turn's Onboarding.tsx changes and remove onboarding.css import/file plus isolated preview. Preserve unrelated existing worktree edits.

## Validation — 2026-09-05

- Desktop build, typecheck, preload guard, 67 desktop tests and 18 core onboarding tests passed. Prettier and git diff --check passed. No desktop lint script exists. Existing Rollup platform-option and >500 kB chunk warnings remain.
- Production Onboarding component exercised at localhost:5183/spikes/onboarding-preview.html using an isolated bridge. Ready, optional, three-blocker, model selection, disclosure, checking-disabled, workspace entry, skip and failure feedback were observed. No software was installed and no preference was reset.
- Visual dark ready state and light 340px blocked state checked, including the footer. A container query adapts to the actual workspace column rather than only the window width. Full guidance wraps. One download action replaces duplicate install paths for fetchable tools.
- Core recommendation selects the image-capable provider over the first text-only provider; explicit text-only choice updates both the header and selected row and keeps its limitation visible.
- Native Electron remains healthy on the existing completed extraction. Native first-launch persistence, fresh-machine installs, provider authentication, screen-reader speech and OS reduced-motion switching were not exercised; motion has explicit reduced-motion guards.
- Fresh-context checker accepted the initial diff and final container-query/action/title deltas; maker reread the scoped diff. No architectural change or ADR required.
- Vault recall found the existing Lirovo neutral desktop conventions, not a separately approved onboarding design. Shared tokens and monogram were reused. Motion reduced-motion docs were cross-checked: https://motion.dev/docs/react-use-reduced-motion.
