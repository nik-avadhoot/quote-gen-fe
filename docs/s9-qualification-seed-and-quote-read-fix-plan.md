# S9 qualification: Quote read fix and test-data seeding plan

Date: 2026-09-15
Status: **Prepared, not applied.** Nothing in this document has been executed against Supabase.
Scope: clears two Speedbreakers found by the 2026-09-15 localhost qualification run so that the
S9 browser journeys B–E can be qualified after activation. It does not close S9.

## Context

The localhost qualification run on 2026-09-15 used frontend `0669799` and backend `ece5ff7` with
one genuine persona (`NikunjRL`, holding every group and plant capability). It recorded:

- **Product Owner validation: NO.** The S9 journey was not accepted.
- **S9 verdict:** `NOT CLOSED — activation prerequisites remain incomplete`.
- **Speedbreaker 1:** Quote History and Approval Inbox return 403 `CAPABILITY_REQUIRED` to a caller
  holding `make_quote` and `check_quote` at every plant.
- **Speedbreaker 2:** no caller-visible test data exists. There are 0 Pricing Basis Releases,
  0 Batches, 0 active Sectors, no Sector linked to either active Customer Family, and 0 active
  Constructions. Neither a Batch nor a test Prospect can be created through the application.
- **Speedbreaker 3 (unchanged):** S9 activation. The Supabase project reached through the MCP
  connector lists no deployed Edge Functions.

This document prepares the clearing actions for Speedbreakers 1 and 2. Speedbreaker 3 remains a
separate activation increment.

## Part A — Quote read fix

### Root cause

| Evidence | Location |
|---|---|
| Every Family G SELECT policy calls `app_private.can_read_quote_family`, `_revision` or `_item` | `quote-gen-be/supabase/migrations/20260909105454_s9_1_family_g_quote_schema.sql:374-406` |
| The same migration revokes all privileges on those helpers from `authenticated` | same file, `:409-411` |
| No later migration grants them back | repository search over all migrations |
| QG-38 asserts the revocation, so the passing suite locks the defect in | `20260909111611_s9_1_snapshot_freight_reference_integrity_tests.sql:216-221` |
| `can_read_batch` is granted to `authenticated`, which is why `quote_families` and My Batches work | `20260906044153_s6_1_family_f_batch_core.sql:209` |
| S9(b)/S9(c) gates read Family G tables only after `reset role`, never as `authenticated` | `20260911091000_s9c_quote_workflow_gates.sql:15-60` |
| The backend maps Postgres `42501` to `CAPABILITY_REQUIRED` / 403 | `quote-gen-be/server.py:3242-3246` |

A policy expression runs with the privileges of the querying role. `SECURITY DEFINER` changes only
the privileges inside the function body, not the right to call it.

Confidence is high from source and from the observed stable error. The live privilege state has not
been queried; the branch rehearsal below confirms it.

### Prepared change

| Artifact | Purpose |
|---|---|
| `quote-gen-be/supabase/migrations/20260915180000_s9_1_fix_family_g_read_helper_execute.sql` | Grants EXECUTE on the three helpers to `authenticated` only. Inverts QG-38 in the live `tests.quote_schema()` rather than deleting it. Runs a one-time structural proof that every helper named in a Family G SELECT policy is executable by `authenticated` and not by `anon`. |
| `quote-gen-be/tests/test_family_g_read_helper_grant_contract.py` | Standalone static contract gate for the migration's boundaries. |

The migration follows two existing precedents: the `can_read_batch` grant, and the inverted-not-deleted
gate pattern of `20260910160430_s7r_11_invert_s9p_cp80_boundary_gate.sql`. The splice matches
single-line fragments and aborts unless each occurs exactly once, so it does not depend on the stored
function body's line endings.

### Alternatives considered

1. **Grant EXECUTE to `authenticated`** — chosen. Smallest change, matches `can_read_batch`, and
   adds no API surface because `app_private` is not an exposed PostgREST schema.
2. **Inline the traversal into each policy** — rejected. It rewrites nine policies and restates Batch
   authority in several places, which the original design deliberately avoided.
3. **Read Family G through the privileged client** — rejected. It bypasses RLS and breaks the
   caller-token authority rule.

### Decision still yours

QG-38 originally recorded an intent that the helpers are "internal machinery, not an API surface".
The fix keeps them out of the exposed API but makes them executable by `authenticated`, because
RLS cannot work otherwise. Confirm that you accept this reinterpretation before activation.

### Verification sequence

1. Run the static gate: `.\venv\Scripts\python.exe tests\test_family_g_read_helper_grant_contract.py`.
2. Apply to a Supabase branch. Confirm the migration's structural proof passes.
3. In the branch, run `tests.run_all()` and confirm the inverted QG-38 passes with no new failure.
4. In the branch, perform an authenticated read of a real Family G row (one Atomic Send candidate or
   a transaction-scoped fixture) and confirm no `42501`.
5. Under explicit Product Owner authority, apply to production and record the ledger entry.
6. Re-open Quote History and Approval Inbox in an authenticated browser session. Expected: 200 with
   an honest empty state, never 403.
7. Run the security advisor and confirm no new finding.

Rollback is forward-only. If the grant must be withdrawn, add a new migration; never edit this one
after it is applied.

## Part B — Test-data seeding plan

### Goal and non-goals

Goal: create the smallest clearly labelled, disposable data set that lets one Product Owner session
qualify journey B (governed Batch structure, lock, readiness) and Calculate's safe refusal. The same
data then serves C–E once S9 activation is complete.

Non-goals: no attestation secret, no Edge deployment, no Calculate or Send mutation, no workflow
action, and no change to existing customer or operational records.

### Constraints

- **CDM-37:** all current application data is disposable trial data, and pre-cutover load is
  reset-and-replace (`data-model-decisions.md:348-353`). Seeding is consistent with that policy but
  still needs explicit authority, because the records are persistent and largely immutable.
- **No application path** creates Sector versions, Calculation Default versions, Rate or Freight
  versions, Constructions or SKU Versions. Pricing Basis Release propose and approve exist only as
  database RPCs (`20260905195028_s5_3_pricing_basis_workflow_rpcs.sql`). Those records therefore need
  a reviewed privileged seed.
- **Everything with an application path goes through the application** as the authenticated
  Product Owner, so its governance, CAS and attribution are exercised rather than bypassed.
- **Never an automatic default.** `create_batch` silently attaches an approved automatic-default
  Release to every new Batch at that plant
  (`20260910033733_s9p_5_create_batch_pricing_basis_init.sql:56-63`). The seed Release must be
  approved with `p_is_automatic_default = false` and selected explicitly on the test Batch.
- **One plant only.** Every plant-scoped record goes to a single plant chosen by the Product Owner.
- **Labelled.** Every name and code carries `S9QA` so it cannot be mistaken for commercial data.

### Record inventory and creation path

The chain mirrors the fixture already proven by the database suite in
`20260910160244_s7r_9b_hoist_signing_out_of_authenticated_blocks.sql:204-266`.

| # | Record | Created by | Approval / activation | Notes to confirm in rehearsal |
|---|---|---|---|---|
| 1 | Sector `S9QA` + Sector version 1 (margin e.g. 8.000) | Privileged seed | Version `draft → approved` by a caller with approval authority | `sectors.status` defaults to `active` (`s5_1_family_d_group_masters.sql:44`) |
| 2 | Calculation Default version | Privileged seed | `draft → approved` | `version_no` is globally unique; `engine_version` must match the calculation engine the executor will attest |
| 3 | Rate Set `S9QA` + version + one rate entry per grade used by the test Construction | Privileged seed | Version `draft → approved` | `effective_material_rate` is set by trigger (`s7r_14_effective_material_rate_boundary.sql:35-55`) |
| 4 | Freight Set `S9QA` + version | Privileged seed | Version `draft → approved` | Entries are unnecessary if the Pricing Group uses manual freight |
| 5 | Pricing Basis Release `S9QA test release` | `propose_pricing_basis_release` then `approve_pricing_basis_release(…, false)` under the Product Owner's authenticated claims | Recorded as `self_approved` when the same user proposes and approves | Needs all four components approved first |
| 6 | Test Prospect `S9QA Test Customer` with Sector `S9QA` | **Application**: Customer Families → `POST /masters/customer-families/prospects` | Family `proposed → active` via `POST /masters/customer-families/{id}/approve` (`manage_customer_master`, held) | Creates Party, Family and first Family Sector atomically |
| 7 | Bill-to/Ship-to Customer Location | **Application**: `POST /masters/parties/{id}/locations`, approve, assign code | Location approval | Needed for the complete Delivery Group route blocker (`batchRowModel.js:99-102`) |
| 8 | Construction `S9QA` + version (3-ply, full layer codes and GSM) + plant adoption | Privileged seed | Publish and adopt at the chosen plant | Layer grade codes must match the rate entries in #3 |
| 9 | SKU + approved, price-driving SKU Version for the test Party at that plant | Privileged seed | `approved_at` set | Must satisfy `_read_batch_row_options` (`quote-gen-be/server.py:2673-2730`) |
| 10 | Governed Batch | **Application**: Batch Builder → Start a new Batch (`POST /batches`) | — | Batch reference is permanent |
| 11 | Pricing Basis selection | **Application**: Batch Pricing Basis selector (`POST /batches/{id}/pricing-basis`) | — | Selects the non-default Release #5 |
| 12 | Delivery route and manual freight | **Application**: Delivery Group and Pricing Group routes | — | Clears the route and freight-basis blockers |
| 13 | One active row | **Application**: `POST /batches/{id}/rows` with the SKU Version #9 | — | Clears the row and governed-identity blockers |

### Execution venue

1. **Rehearsal** in a disposable Supabase branch: run the privileged seed, exercise records 6–13
   through equivalent authenticated calls, run `tests.run_all()`, and fix the script.
2. **Production** only under explicit Product Owner authority, as a reviewed one-off seed script with
   readback queries. Proposed location (not yet created): `quote-gen-be/supabase/seed/s9qa/`,
   not `supabase/migrations/`, so disposable trial data never enters immutable schema history or
   replays into every environment.
3. **Application steps** 6, 7 and 10–13 are then performed by the Product Owner with me observing,
   which doubles as journey B evidence.

### Gate impact to check in rehearsal

- Suites asserting that Family G is empty (QG-32–QG-37 in `tests.quote_schema()`, and the S9-P/S9(b)
  "Family G still empty" gates) are unaffected by seeding, but will fail after the first real Atomic
  Send. Schedule their inversion inside the S9 activation increment.
- Run the full `tests.run_all()` after seeding and list any gate that assumed an empty master table.
  Invert or scope each one in a separate reviewed migration; do not delete gates.
- The persistent attestation keyring and `batch_calculations` must stay empty after seeding.

### Retirement

Records are append-only or restrict-delete. Retire rather than delete: withdraw the Release
(`withdraw_pricing_basis_release`), set the Sector inactive, retire the Family, and discontinue the
SKU. At Formal Data Cutover the whole trial set is reset-and-replaced under CDM-37.

### Decisions still yours

1. Which single plant hosts the test data.
2. Final names and codes (default prefix `S9QA`).
3. Whether a self-approved Pricing Basis Release is acceptable for qualification data.
4. Authority to create a Supabase branch for the rehearsal. It may incur cost.
5. Authority to run the privileged seed against production after rehearsal.
6. The `engine_version` for the Calculation Default version, which must be confirmed against the
   engine the activated executor will attest.
7. Acceptance of the QG-38 reinterpretation in Part A.

## Recommended order

1. Review this document and the prepared migration.
2. Branch rehearsal of Part A, then Part B.
3. Production: apply Part A first, then run the Part B seed.
4. Product Owner journey: application steps 6, 7 and 10–13, Quote History and Approval Inbox recheck.
5. S9 activation increment: attestation secret, Edge deployment, Calculate, Atomic Send, workflow,
   Family G empty-gate inversion, and the full B–E journey.
6. Update `s9-technical-closure-and-u3-u6-handoff.md` only with outcomes actually observed.
