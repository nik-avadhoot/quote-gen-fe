# Session start

Start with [`PROJECT-HANDOFF.md`](PROJECT-HANDOFF.md) for the authority hierarchy, then read
[`current-state.md`](current-state.md) and
[`OPEN-DECISIONS-BACKLOG.md`](OPEN-DECISIONS-BACKLOG.md). Read a detailed packet only when the
current change touches its subject.

## Repository boundary

`quote-gen-fe` and `quote-gen-be` are independent Git repositories. Inspect both statuses before a
cross-repository conclusion. Existing modified and untracked files are user/project work; preserve
them unless the current request explicitly owns them.

Do not read or modify environment/secret files without explicit scope. Do not stage, commit, push,
deploy, or change live Supabase merely because local verification passes.

## Current delivery boundary

S1–S5 are implemented and live; S6 pilot/consolidation is pending. Historical S9 material remains
available as evidence but does not define current delivery status. Keep S9 records, migrations,
tests, backend routes, and Edge artifacts easy to find. Do not deploy, provision or inspect secrets,
or alter live Supabase without explicit scope.

## Working posture

- Follow [`../../AGENTS.md`](../../AGENTS.md): move forward with proportionate checks and reserve a
  Development Speedbreaker for a concrete material risk.
- Do not reopen settled decisions without new contradictory, security, data-integrity, or
  implementation-impossibility evidence.
- Select checks that can detect regressions in the affected behavior. Do not run every historical
  gate for every change.
- Automated tests, fixture-browser checks, authenticated-live browser checks, deployment, technical
  closure, and Product Owner validation are distinct claims.
- Record current unresolved decisions in
  [`OPEN-DECISIONS-BACKLOG.md`](OPEN-DECISIONS-BACKLOG.md); otherwise leave the current increment
  focused.

## Durable technical guardrails

- Mirrored costing implementations must not drift.
- Blank, zero, and unresolved values are different.
- Tenant/plant authorization, quotation authority, audit history, and immutable revisions are
  protected boundaries.
- Applied migrations are immutable history.
- Never run Prettier or automatic lint fixes across the frontend. Preserve intentional formatting
  and verify any touched file directly.
- Anchor document range edits to the section being replaced. Run the section audit for broad edits:
  `python scripts/audit-doc-sections.py`.
- Generated Edge engine copies come from the bundling flow; do not maintain them independently.

## Choosing verification

Use `npm run` in the frontend to see the current focused fixtures. Typical choices are:

- frontend structure/import changes: `npm run build` or `npm run test:module-contract`;
- costing or resolver changes: their named fixture plus the mirrored-boundary check;
- a changed UI journey: its focused fixture and an actual browser journey when the acceptance claim
  requires one;
- backend routes: the directly related standalone `tests/test_*.py` scripts;
- documentation-only work: link/path checks, the document-section audit when applicable,
  `git diff --check`, and repository-scope verification.

Do not quote old lint totals, line counts, branches, or commit positions as current without checking
them first.
