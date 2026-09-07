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

Not run yet — held for the single closure-boundary run after Slice C also lands, per your
instruction ("Run the required closure-boundary G-B only after A and C are both individually green").

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

| | Status |
|---|---|
| Code implemented | Yes |
| Automated tests passed | Yes (DB 833/833, route 57/57, backend hermetic total 394/394, frontend fixtures 3/3, all 8 standing gates) |
| Live probes passed | Yes (194/194 against the real Supabase project) |
| Technically closed | Yes, for the scope authorised (display_name edit only) |
| Product Owner / browser validated | **No** — not attempted in this tranche; UI verification remains Product Owner-led per standing convention, and Slice E (not in this tranche) is where an end-to-end browser walkthrough is scoped |

## What this slice does not do

Unchanged from the packet: Party deactivation/reactivation is not designed or implemented; the
question of who may deactivate a Party and what happens to its dependents remains a named, unresolved
Product Owner decision.

## Preserved work, verified untouched

`src/tabs/batch/BatchProfileBar.jsx`'s pre-existing uncommitted hunk and `docs/commercial-intelligence-
decisions.md` are both unstaged and unmodified by this slice — confirmed by `git status` immediately
before this commit.
