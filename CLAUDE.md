# Frontend working instructions

The parent [`../AGENTS.md`](../AGENTS.md) governs development and review posture. Start with
[`docs/PROJECT-HANDOFF.md`](docs/PROJECT-HANDOFF.md), then
[`docs/current-state.md`](docs/current-state.md) and
[`docs/OPEN-DECISIONS-BACKLOG.md`](docs/OPEN-DECISIONS-BACKLOG.md). Detailed historical plans are
not mandatory startup reading.

## Repository shape

This is the React 19 + Vite frontend. The independent sibling repository `../quote-gen-be` contains
the Flask API, Supabase migrations/tests, Edge Function artifacts, and Excel-template server.
Always inspect both repositories when a change crosses their boundary.

The frontend is no longer a monolith. `QuotationApp.jsx` is a thin shell; shared state is composed
in `src/state/AppStateProvider.jsx`, and screens live under `src/tabs/`. The app currently combines
legacy browser-persisted workspaces with newer authenticated backend/Supabase-backed surfaces.

## Current delivery boundary

S1–S5 are implemented and live; S6 pilot/consolidation is pending. Historical S9 records remain
available as evidence and must not be used as current delivery status. Keep the S9 records in
`docs/`, the migrations/tests/routes in `quote-gen-be`, and
`quote-gen-be/supabase/functions/calculate-batch-row/` easy to find. Do not deploy, provision or
inspect secrets, or alter live Supabase without explicit scope.

## Architecture guardrails

- `src/state/AppStateProvider.jsx` composes domain hooks in a significant order. A slice cannot rely
  on state composed after it.
- Shared components call `useAppState()` directly; do not reintroduce broad prop drilling from the
  shell.
- `src/state/useCostingBatchBridge.js` holds the Costing↔Batch identity and confirmation boundary.
  Preserve its cross-surface guards.
- `src/lib/persist.js` is the single seam for app-owned `cbb_*` and `qgos_*` browser state. Auth
  transport storage is intentionally separate.
- `src/lib/apiClient.js` is the authenticated backend transport. Capability display labels are not
  authorization; enforce access using the actual capabilities and server/RLS boundaries.
- Feature destinations are build-time decisions. Read `src/lib/featureFlags.js` before changing
  visibility or rollout behavior.
- Generated Edge engine copies are produced by the backend bundling flow. Do not edit them as an
  independent implementation.

## Costing and data-integrity guardrails

- Costing/export logic has frontend/backend mirrors. Review both implementations and run the
  directly affected fixtures whenever formulas, defaults, authority resolution, or export inputs
  change.
- Blank, zero, and unresolved values are different. Never use a truthiness fallback where zero is
  valid.
- Batch Entry is the governed calculation context; local preview and persisted governed calculation
  evidence are distinct.
- Preserve SET identity, construction identity, pricing-basis identity, plant/tenant scope,
  optimistic concurrency, immutable Quote revisions, and audit evidence.
- Applied migrations are immutable history. Correct with a new migration in the backend repository.

## Editing rules

- Never run Prettier or `eslint --fix` across this repository. Preserve intentional formatting and
  ASI-sensitive code.
- Hooks belong at component/custom-hook top level, never inside conditions, callbacks, or render
  loops.
- Module-level helpers must receive state through parameters rather than closing over React state.
- Keep Markdown range edits tightly anchored to the section being replaced. Silent section deletion
  has happened before; use `python scripts/audit-doc-sections.py` when the affected document is in
  the audit’s historical scope.
- Do not alter environment files, protected user-owned documents, or unrelated dirty hunks.

## Verification policy

Choose checks in proportion to the behavior changed. Use `npm run` to discover the current named
fixtures instead of relying on an old fixed list.

- Imports/application composition: `npm run build` or `npm run test:module-contract`.
- Costing/resolver changes: the named costing/resolver fixtures plus mirror verification.
- Governed UI/action changes: the relevant named fixture and a browser journey when the acceptance
  claim depends on one.
- Documentation-only changes: Markdown links/path checks, the document-section audit when
  applicable, `git diff --check`, and confirmation that source/migrations/assets were untouched.

Automated tests, fixture-browser proof, authenticated-live browser proof, deployment, technical
closure, and Product Owner validation must be reported separately. Do not quote historical lint
counts, line counts, commit positions, or deployed state without checking them.
