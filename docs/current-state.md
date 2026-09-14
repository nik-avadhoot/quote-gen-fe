# Current state handoff

Updated: 2026-09-14. This is a concise working snapshot, not a closure award. Verify the source,
repository status, and deployed state before relying on any time-sensitive claim.

## Product and repository shape

The application is split across two independent repositories:

- `quote-gen-fe`: React 19 + Vite frontend. Authentication, feature-gated governed screens, local
  costing/legacy workspaces, and API-backed operational screens coexist during the transition.
- `quote-gen-be`: Flask API, Supabase caller-context and governed route layer, database migrations
  and tests, the `calculate-batch-row` Edge Function source, and Excel-template export.

The frontend still has local `cbb_*` persistence for legacy master, costing, batch, template, and
working-quote state. Newer governed reads and mutations travel through the authenticated backend
and Supabase RLS/RPC boundaries. Do not describe the system as either “localStorage only” or “fully
database-backed”; both models currently exist in deliberately different areas.

Both worktrees are on `data-model/s0-provenance` and contain substantial modified and untracked
project work. Treat every pre-existing change as user/project-owned. Do not stage, discard, reflow,
or fold it into an unrelated increment.

## Current S9 truth

S9 remains active unfinished work:

| Boundary | Current truth |
|---|---|
| Local implementation | Present |
| Automated database verification | Complete in the recorded S9 run |
| Database migrations | Activated through `20260911091000_s9c_quote_workflow_gates` |
| Production attestation secret | Not provisioned |
| `calculate-batch-row` Edge Function | Source retained; not deployed or activated |
| Governed Calculate through real authenticated runtime | Not verified |
| Atomic Send and quotation workflow through deployed runtime | Not verified |
| Maker/Checker/Admin authorization through that runtime | Not verified end to end |
| Genuine browser and persistent calculation/quotation journey | Not verified |
| Product Owner journey validation | Outstanding |
| Technical/Product Owner closure | **No** |

The active record is
[`s9-technical-closure-and-u3-u6-handoff.md`](s9-technical-closure-and-u3-u6-handoff.md).
Migration activation and local/automated tests are real evidence, but they do not substitute for
secret provisioning, deployment, authenticated runtime proof, browser proof, persistent evidence,
or Product Owner acceptance.

Completing S9 later should require a focused activation run and an update/final addendum to that
record—not another documentation reorganisation.

## Other delivery state

- Canonical product and architecture decisions are in
  [`data-model-decisions.md`](data-model-decisions.md).
- S7 and S8 have scoped closure records. Those records do not close S9.
- U1 has several scoped closure records. Read each record’s final status section; do not infer that
  every U1 concern is closed from one slice.
- The local worktree contains later U3/U4/U5-facing screens and routes. Presence in a dirty
  worktree is implementation evidence, not deployment or Product Owner closure.
- The U4 My Batches read-only increment is locally and fixture verified; authenticated-live browser
  verification and Product Owner validation remain deferred in its record.
- S10 and later S-tranche work are not made current merely by appearing in an older roadmap.

## Durable guardrails

- Mirrored costing implementations must not drift.
- Blank, zero, and unresolved values have different meanings.
- Tenant/plant authorization, quotation authority, audit history, and immutable revisions are
  protected boundaries.
- Applied database migrations are immutable project history; never rename or delete them.
- Do not expose or inspect secret material during ordinary repository work.
- Broad Markdown replacements must be anchored to the section being replaced; silent section loss
  has occurred before.
- Generated Edge engine files are regenerated through the repository bundling flow. Do not edit a
  generated copy as if it were an independent source.

## Immediate sequence

1. Continue independent read-only/product-surface work only within its accepted scope.
2. For S9 activation, provision the attestation material through approved secret-management
   surfaces, deploy/activate the retained Edge Function, and exercise the real authenticated paths.
3. Verify Maker, Checker, and Admin boundaries; inspect persistent calculation, quotation, and
   workflow evidence; run directly affected regressions.
4. Complete the genuine frontend journey with the Product Owner.
5. Update the S9 record truthfully to award technical and Product Owner closure only after those
   outcomes are observed.
