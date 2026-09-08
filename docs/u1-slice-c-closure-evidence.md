# U1 Slice C — Customer Location proposal/version/approval/retirement: closure evidence

**Date:** 2026-09-07. Implements exactly the narrower scope authorised in
`u1-customer-foundation-authorization-packet.md`, Slice C, as further narrowed by the final
correction round: proposal (with Bill-to/Ship-to eligibility fixed at that point), descriptive
versioning, read presentation, approval, retirement, and permanent-code assignment. **No
post-proposal eligibility change, no eligibility-history infrastructure, no Location-to-Party
reassignment, no cross-Family third-party selection** — none of these are implemented, sketched, or
held in reserve.

## Migrations applied (`quote-gen-be`, chronological)

| Version | Name | What |
|---|---|---|
| `20260907164819` | `u1_slice_c_location_functions` | 4 `app_private` functions (`propose_customer_location`, `update_customer_location`, `approve_customer_location`, `retire_customer_location`), 5 public wrappers (those 4 plus a wrapper for the pre-existing `assign_location_code`), explicit grant/revoke on every one from this single migration |
| `20260907165153` | `u1_slice_c_location_tests` | `tests.customer_location_mutations()`, registered in `run_all()` |

Two migrations — no corrections needed this time; the Slice A lessons (explicit grant/revoke from
the first migration, watching for `ck_*` constraints, qualifying ambiguous columns) were applied up
front and the suite passed on the first run.

## G-A

**140 local ⇄ 140 remote**, exact version-string match (diffed, not merely counted).

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

`tests.run_all()`: **859 / 859, 0 failures** (833 after Slice A + 26 new: CLM-1…17 with sub-cases).
Covers: unauthenticated/no-capability refusal; the `make_quote` propose path (not just
`manage_customer_master`); the `ck_loc_eligible` refusal both as a real DB-level `22023` (not just
Flask's pre-check); not-found; atomicity (a forced `ck_lv_type` violation on the second insert
leaves no orphaned `customer_locations` row); stale CAS on edit; exactly one `current` version after
an edit (`uk_lv_one_current` verified directly) with the prior version `superseded`, not deleted;
eligibility proven unchanged by a descriptive edit; forbidden transitions (retire-before-approve,
double-approval, double-retirement); `assign_location_code`'s pre-graduation `P0002` and post-
graduation idempotent success; grant posture on all five wrappers.

## Route tests

`tests/test_customer_location_routes.py`: **82 / 82**. Same hermetic fake-client convention:
anonymous 401 on all five routes; well-formed success calls exactly the expected RPC with the
caller's own token and exact parameters; the eligibility guard refused Flask-side (400
`INVALID_INPUT`) before any RPC for both "neither checked" and "omitted entirely"; three
missing-CAS-field cases refused 400; **an explicit assertion that no `/eligibility` route exists at
all** (404), proving the removal is real, not merely undocumented; all five mapped/unmapped
SQLSTATEs proven to leak nothing; no service-role client used.

All eleven hermetic backend files re-run unchanged: **476 / 476** total (394 after Slice A + 82 new).

## HTTP probes

Full live matrix against the real Supabase project: **204 / 204, 0 failed**, teardown clean. New
rows: all five Slice C wrappers, `anon` refused 401 and `service_role` refused 403 (EXECUTE
explicitly revoked) — confirmed no eligibility-change RPC exists to probe.

## Frontend

`lib/customerLocationActions.js` (pure body builders, confirm copy, and the incomplete-details
indicator) + `scripts/customer-location-actions-fixtures.mjs`
(`npm run test:location-actions`, added to `package.json`): **12 / 12** — explicitly asserting no
eligibility field exists on the update-body builder. `CustomerFamiliesScreen.jsx` extended with a
Locations sub-list under each Party row: code, eligibility (read-only), status, incomplete-details
badge, and Propose/Edit/Approve/Retire/Assign-Code actions, each `CapabilityGate`-wrapped — no
Eligibility action exists on the screen. `GET /masters/customer-families` extended with two additive
arrays, `locations` and `location_versions`, same `read_party_master` gate, confirmed not to break
the existing route test (13/13 unchanged).

Standing eight-gate set, all re-run: `npm run build` (pass), `npx eslint src` (**66/0**, ceiling
held), `npm run test:costing`, `npm run test:blanket`, `npm run test:draft`, `npm run test:resolver`,
`python scripts/audit-doc-sections.py`, `python scripts/audit-setcode.py` — all pass, no findings.
`test:family-actions`, `test:party-actions`, `test:capabilities` re-run unchanged, all pass.

## Status, distinguished as requested

Statuses below use the vocabulary fixed by `data-model-frontend-design-plan.md` section 2.1 item 7 (commit `95d9fd0`): implemented, tested, technically closed, feature-enabled/currently visible, and Product Owner validated are distinct and not interchangeable.

| | Status |
|---|---|
| Code implemented | Yes, for the narrowed scope only |
| Automated tests passed | Yes (DB 859/859, route 82/82, backend hermetic total 476/476, frontend fixtures 12/12, all 8 standing gates) |
| Live probes passed | Yes (204/204 against the real Supabase project) |
| Technically closed | Yes, for the scope authorised — **not** complete Customer Locations, per the acceptance matrix — under the revised policy: every gate required for this tranche passed, and G-B is a milestone gate deferred by explicit Product Owner decision rather than an outstanding failure |
| Feature-enabled / currently visible | Separate and **pending** at the time of this record — gated behind `VITE_FEATURE_FLAGS`; enabling localhost configuration and caller capability is a distinct step from technical closure |
| Product Owner / browser validated | Separate and **pending** at the time of this record — a real-browser walkthrough under the Product Owner's development login is required and is not satisfied by automated gates |

## What this slice does not do (restated, not merely implied)

- **Post-proposal eligibility change** — genuinely blocked pending a Product Owner ruling on whether
  an in-place edit transition is permitted at all, prior to any question of history. Nothing named
  `update_location_eligibility` exists anywhere in this codebase.
- **Location-to-Party reassignment** — no schema mechanism exists (confirmed: `customer_location_
  versions` carries no `party_id`, no parent-history table exists); not built.
- **Cross-Family third-party Bill-to/Ship-to selection** — belongs to U4's Delivery Group UI.

This is a narrower Location slice. It does not claim to close "Customer Locations" as a requirement,
and it contributes nothing toward closing U1 as a whole — see the packet's own closing section for
the full list of what remains open.

## Preserved work, verified untouched

`src/tabs/batch/BatchProfileBar.jsx`'s pre-existing uncommitted hunk and `docs/commercial-intelligence-
decisions.md` are both unstaged and unmodified by this slice — confirmed by `git status` immediately
before this commit.

---

# Closure status update — 2026-09-08 (post-validation)

This section supersedes the "Feature-enabled" and "Product Owner validated" rows of the status table
above, which recorded those two statuses as *pending at the time of that record*. Nothing else is
revised — in particular, the narrowed scope stands: this slice still does not close "Customer
Locations" as a requirement, and the three named exclusions above remain excluded.

## Technical closure

**Technically closed** under `data-model-frontend-design-plan.md` §2.1, **for the narrowed scope
only** — every gate required for this tranche passed (§2.1 item 3), and G-B is a milestone gate, not
a per-slice requirement (§2.1 item 4).

## Feature-enabled and visible

**Feature-enabled / currently visible: yes, on localhost.** `.env.local` (gitignored; localhost only,
`.env.production` untouched) carries `VITE_FEATURE_FLAGS=u1_producing_plants,u1_customer_families`.
The Locations sub-list renders inside the Customer Families screen, so it shares that screen's flag
and that screen's `read_party_master` requirement — the flag grants no capability. Vercel enablement
remains separately authorised and has not been performed.

## Product Owner validation

**Product Owner browser validation: completed and accepted.** The Location propose / edit / approve /
retire / assign-code flows were exercised interactively in a real browser under the Product Owner's
own development login.

## Defects raised during validation — both closed

Both defects were raised against the shared mutation path this screen uses, so they are recorded
identically in `u1-slice-a-closure-evidence.md`:

| Defect | Fix | Commits |
|---|---|---|
| D2 — stale CAS surfaced as `40001`, indistinguishable from a genuine serialization failure; upstream timeout reported as `500` | Stale CAS raises `PT409` → `409 STALE_VERSION`; genuine `40001` still separately classified; upstream timeout → `504 UPSTREAM_TIMEOUT`, stating the outcome may be unknown rather than that the write failed | be `98e43f9`, `75840a4`; fe `1ec94a3` |
| D3 — a "disabled" button was still clickable; a blank Family name failed only server-side | Genuinely disabled control; blank-name rule extracted to a tested pure function driving both the disabled state and the inline message. Usability pre-check only — the route and the DB function still refuse a blank name | fe `1e8d6cf` |

## Accepted, non-blocking performance debt

Customer Master loads measure approximately **2.4–3.6 s**, after `98e43f9`/`75840a4` bounded the
upstream timeout, removed redundant round-trips, and parallelised the six independent master reads
(one client per worker). The remaining latency is **accepted by the Product Owner as non-blocking
performance debt** — not an open defect, not a gate failure. This slice's two additive arrays
(`locations`, `location_versions`) are part of that parallel read set and did not add a round-trip.

## G-B

**Explicitly deferred to a future milestone boundary** by Product Owner decision, per §2.1 item 4 —
a Product-Owner-approved deferral, neither a passed gate nor a failed implementation. The earlier
record of G-B as "prepared but deferred" (`da56b76`) stands; no G-B preparation is in progress and
none is to be resumed without a separate instruction.
