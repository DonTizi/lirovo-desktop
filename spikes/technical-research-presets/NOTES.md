# Technical research preset probe

2026-09-07. Before implementation, invoked compiled SCHEMA_PRESETS/compileSchema/decompileSchema directly: four presets, closed required fields, editor counts 3/4/3/3. Preserved their ids, labels, fields and descriptions unchanged.

After adding technical-talk and benchmark-comparison, before creating tests, rebuilt core and directly invoked compileSchema, decompileSchema, isStrictSchema and validateAgainst against both real new presets. Each has six fields, strict-mode compatibility true, zero validation errors for explicit empty-list fixtures, and six required-property failures for an empty object. Printed complete compiled schemas to confirm descriptions survived unchanged.

Verdict: adopt additive FieldSpec presets. No new dependencies or schema editor extension. Metrics are complete attributed strings, not silently normalized numbers; missing conditions and incompatible comparisons remain explicit. The existing separate evidence envelope carries actual timestamps. User-editable source_context does not replace provenance.

Oracle: tests prove schema representation, validation and compatibility, not model behavior. No inference calls, real participant sessions, external outreach or telemetry. docs/design/technical-research-validation.md defines the prospective consent, baseline, source-ledger and repeat-use protocol; pilot outcomes remain unknown.
