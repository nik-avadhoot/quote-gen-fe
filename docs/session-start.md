# Session start

Start with [`README.md`](README.md) for the authority hierarchy, then read
[`current-state.md`](current-state.md) and [`open-work.md`](open-work.md). Read a detailed packet
only when the current change touches its subject.

## Repository boundary

`quote-gen-fe` and `quote-gen-be` are independent Git repositories. Inspect both statuses before a
cross-repository conclusion. Existing modified and untracked files are user/project work; preserve
them unless the current request explicitly owns them.

Do not read or modify `commercial-intelligence-decisions.md` or environment/secret files without
explicit scope. Do not stage, commit, push, deploy, or change live Supabase merely because local
verification passes.

## Current S9 boundary

S9 migrations and recorded automated database verification are complete. Production attestation
secret provisioning, Edge deployment/activation, real authenticated Calculate/Send/workflow proof,
runtime Maker/Checker/Admin proof, genuine browser and persistent evidence, and Product Owner
validation are incomplete. S9 is not technically or Product Owner closed. Keep all S9 records,
migrations, tests, backend routes, and Edge artifacts active and easy to find.

## Working posture

- Follow [`../../AGENTS.md`](../../AGENTS.md): move forward with proportionate checks and reserve a
  Development Speedbreaker for a concrete material risk.
- Do not reopen settled decisions without new contradictory, security, data-integrity, or
  implementation-impossibility evidence.
- Select checks that can detect regressions in the affected behavior. Do not run every historical
  gate for every change.
- Automated tests, fixture-browser checks, authenticated-live browser checks, deployment, technical
  closure, and Product Owner validation are distinct claims.
- Record unrelated defects briefly in [`open-work.md`](open-work.md) only when they are current;
  otherwise leave the current increment focused.

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
