# U1 Slice A — Party editing: closure evidence

**Date:** 2026-09-07. Implements exactly the scope authorised in
`u1-customer-foundation-authorization-packet.md`, Slice A: display_name editing only, via
`app_private.update_party` / `public.update_customer_party`. No deactivation, no merge, no Location
action — none of those are touched.

## Migrations applied (`quote-gen-be`, chronological)

| Version | Name | What |
|---|---|---|
| `20260907162324` | `u1_slice_a_party_edit_function` | `app_private.update_party`, `public.update_customer_party` wrapper, explicit grant/revoke |
| `20260907162417` | `u1_slice_a_party_edit_tests` | `tests.party_edit_mutations()`, registered in `run_all()` (contains a fixture bug, fixed below — kept verbatim for replay fidelity) |
| `20260907162811` | `u1_slice_a_fix_pem_inactive_fixture` | Fix: inactive-persona insert violated `ck_app_users_deactivated` |
| `20260907163012` | `u1_slice_a_fix_pem_ambiguous_oid` | Fix: ambiguous `oid` reference in the grant-posture assertions |
| `20260907163239` | `u1_slice_a_fix_grants_on_new_functions` | Fix: both new functions had `proacl = NULL` (implicit PUBLIC execute) — materialised explicitly, matching every sibling function |

Four migrations, three of them corrections found by actually running the suite — same discipline as
every prior slice in this programme's history (Family B needed thirteen for the same reason).

## G-A

**138 local ⇄ 138 remote**, exact version-string match (diffed, not merely counted).

## G-B

**Prepared, not executed. Deferred by explicit Product Owner decision - neither passed nor failed for
this tranche.**

A complete fail-closed G-B package was produced and reviewed: a single-transaction replay file
(guarded drop of `public`/`app_private`/`tests`/`ref_private`, all 140 committed migrations in exact
version order, post-replay structural assertions, one `tests.run_all()` invocation inside the same
transaction, and fixture-cleanliness assertions), together with a separate single-transaction
governed-identity restoration file. All 140 embedded migrations were verified byte-for-byte against
their committed bytes, and the package was validated as transaction-safe (no psql meta-commands, no
`BEGIN`/`COMMIT`/`ROLLBACK`, no `CONCURRENTLY`, balanced dollar-quoting).

It was not executed. No PostgreSQL client (`psql`, `pg_dump`) exists in this workspace, and the
Supabase MCP channel cannot carry the 1,267,980-byte payload as one atomic request. On 2026-09-08 the
Product Owner superseded the requirement: under `data-model-frontend-design-plan.md` section 2.1
(commit `95d9fd0`), G-B is a **milestone gate** - required at major backend/stage closure, before
deployment, where migration drift or replay integrity is in doubt, or on explicit Product Owner
request - and is **not** automatically repeated after every intermediate frontend-enablement slice.
That section requires an approved deferral to be recorded explicitly, which this is: G-B for this
tranche is **neither a passed gate nor a failed implementation**.

The preparation artefacts were generated outside both repositories and have since been deleted. No
governed-data capture file was ever generated, so no live identity data was written to disk.

Every gate actually required for this tranche passed - G-A, database tests, route tests, HTTP probes
and the standing frontend gate set, all recorded in this document.

## Database tests

`tests.run_all()`: **833 / 833, 0 failures** (821 baseline + 12 new: PEM-1…9, 8a, 10, 11).

## Route tests

`tests/test_party_edit_route.py`: **57 / 57**. Same hermetic fake-client convention as the closed
Family B slice — anonymous 401; well-formed success calls exactly `update_customer_party` with the
caller's own token and exact parameters; three missing/blank-field cases refused 400
`INVALID_INPUT` before any RPC; all five mapped/unmapped SQLSTATEs (`42501`/`P0002`/`40001`/`22023`/
unmapped) proven to leak no table name, column name, function name, SQLSTATE, or exception fragment,
for a message shaped like a real leak; no service-role client used.

All ten pre-existing hermetic backend files re-run unchanged: **394 / 394** total
(337 baseline + 57 new).

## HTTP probes

Full live matrix against the real Supabase project: **194 / 194, 0 failed**, teardown clean. New rows:
`update_customer_party` — `anon` refused 401, `service_role` refused 403 (EXECUTE explicitly revoked).

## Frontend

`lib/partyActions.js` (pure body builder) + `scripts/party-actions-fixtures.mjs`
(`npm run test:party-actions`, added to `package.json`): **3 / 3**. `CustomerFamiliesScreen.jsx`
extended with an Edit action on each Party row (display_name only), `CapabilityGate`-wrapped
(`manage_customer_master`), same confirm/`classifyResponse` flow as every other action on this screen.

Standing eight-gate set, all re-run: `npm run build` (pass), `npx eslint src` (**66/0**, ceiling held),
`npm run test:costing`, `npm run test:blanket`, `npm run test:draft`, `npm run test:resolver`,
`python scripts/audit-doc-sections.py`, `python scripts/audit-setcode.py` — all pass, no findings.
`test:family-actions` and `test:capabilities` re-run unchanged, both pass.

## Status, distinguished as requested

Statuses below use the vocabulary fixed by `data-model-frontend-design-plan.md` section 2.1 item 7 (commit `95d9fd0`): implemented, tested, technically closed, feature-enabled/currently visible, and Product Owner validated are distinct and not interchangeable.

| | Status |
|---|---|
| Code implemented | Yes |
| Automated tests passed | Yes (DB 833/833, route 57/57, backend hermetic total 394/394, frontend fixtures 3/3, all 8 standing gates) |
| Live probes passed | Yes (194/194 against the real Supabase project) |
| Technically closed | Yes, for the scope authorised (display_name edit only), under the revised policy: every gate required for this tranche passed, and G-B is a milestone gate deferred by explicit Product Owner decision rather than an outstanding failure |
| Feature-enabled / currently visible | Separate and **pending** at the time of this record — gated behind `VITE_FEATURE_FLAGS`; enabling localhost configuration and caller capability is a distinct step from technical closure |
| Product Owner / browser validated | Separate and **pending** at the time of this record — a real-browser walkthrough under the Product Owner's development login is required and is not satisfied by automated gates |

## What this slice does not do

Unchanged from the packet: Party deactivation/reactivation is not designed or implemented; the
question of who may deactivate a Party and what happens to its dependents remains a named, unresolved
Product Owner decision.

## Preserved work, verified untouched

`src/tabs/batch/BatchProfileBar.jsx`'s pre-existing uncommitted hunk and `docs/commercial-intelligence-
decisions.md` are both unstaged and unmodified by this slice — confirmed by `git status` immediately
before this commit.
