# Current state handoff

Updated: 2026-09-25. This is the canonical record of implemented and deployed product state.
For the reading order and decision ownership, start at
[`PROJECT-HANDOFF.md`](PROJECT-HANDOFF.md).

## Live delivery truth

S1 through S5 are implemented and live. They are not pending design work and must not be described
as fixture-only or as blocked by the earlier S9 activation programme.

| Surface | Live deployment evidence |
|---|---|
| Backend | Production deployment commit `6d1d84b` |
| Frontend | Production deployment commit `e627007` |
| Product increment | S1–S5 implemented and live |
| Next delivery lane | S6 pilot/consolidation — pending |

The two repositories remain intentionally separate:

- `quote-gen-fe` is the React/Vite product surface, including the governed Batch and Quote journey.
- `quote-gen-be` is the Flask API, Supabase caller-context/governed route layer, database
  migrations and tests, Edge Function source, and Excel-template exporter.

Some legacy local `cbb_*` persistence still coexists with governed data flows. Do not collapse that
into either “localStorage only” or “fully database-backed”; consult the decision sources before
changing a boundary.

## Current non-blocking follow-up

The complete short list is maintained in
[`OPEN-DECISIONS-BACKLOG.md`](OPEN-DECISIONS-BACKLOG.md). Its items do not reopen S1–S5 or block
S6 planning unless the named boundary is directly involved:

1. A protected, authenticated production Batch-to-Quote smoke check.
2. A Batch-workspace Compare entry point.
3. S5R-17 cross-customer test using a second active Party.
4. Named ownership for the U4/CPH migration-path pin.
5. A future beta-reset plan that retains real beta accounts and removes only fixture/trial business
   data after explicit authorisation.

## Guardrails that remain current

- Preserve tenant/plant authorization, quotation authority, audit history, immutable revisions,
  and optimistic-concurrency boundaries.
- Applied migrations are immutable history. Add a corrective migration instead of rewriting an
  applied one.
- Mirrored costing implementations require a deliberate mirror review.
- Blank, zero, and unresolved values have distinct meanings.
- Do not expose or inspect secret material in ordinary work.

## Status of earlier programme records

Earlier S7–S9, U-series, beta, and component-split packets are retained as audit and design
evidence. They are not live-state authority unless the handoff map explicitly names them for a
specific decision. In particular, historical references to an unexercised S9 runtime or a full main
database reset must not override the live S1–S5 state or the current limited reset decision.
