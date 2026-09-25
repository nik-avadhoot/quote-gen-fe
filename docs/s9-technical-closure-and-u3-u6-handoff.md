# S9 technical closure and U3–U6 handoff

> **Historical technical snapshot (2026-09-15).** Retained for S9/U-series evidence only. It does
> not describe present delivery status or reopen S1–S5; use
> [`current-state.md`](current-state.md) for live truth and
> [`OPEN-DECISIONS-BACKLOG.md`](OPEN-DECISIONS-BACKLOG.md) for remaining work.

Date: 2026-09-11  
Updated: 2026-09-15
Scope: S9 deferral position and UX-first U3–U6 handoff

## Closure classification

| Increment | Implemented locally | Automated-test verified | Database activated | Edge/runtime verified | Browser verified | Technically closed | Product Owner validated |
|---|---:|---:|---:|---:|---:|---:|---:|
| S9 overall | Yes | Yes | Yes | No | No | **No—the secret-dependent activation is deferred** | Deferred to the frontend journey |

The reviewed SQL, engine boundary, security grants, transaction behavior, and authenticated database
personas are implemented and passing. The six migrations were activated on 2026-09-11. Remaining S9
Edge activation is deliberately deferred while the UX-first U-phase proceeds. No attestation key is
provisioned, no Edge Function is deployed or called, and no service-role workaround or weakened
attestation path is introduced. The undeployed Edge artifacts remain preserved for later activation.

## U3–U5 delivery status

| Increment | Local implementation | Focused automated evidence | Authenticated-live browser | Technical status | Product Owner validation |
|---|---:|---:|---:|---|---:|
| U3 Pricing Basis | Yes | Yes | No | Local implementation verified; formal live qualification deferred | No |
| U4 My Batches read-only increment | Yes | Yes | No | Locally technically closed | No |
| U4 Customer Family/Sector migrations | Yes | Static contract 10/10; catalogue gate 7/7 | No | Activated 2026-09-15 as `20260915100440_u4_customer_family_sectors` and `20260915100521_u4_customer_family_sector_catalogue_gates`; operationally blocked because the governed Sector master has zero rows | No |
| U5 read-only Quote workflow presentation | Yes | Yes | No | Locally technically closed for the accepted read-only scope | No |
| U2 SKU Master read-only catalogue/detail | Yes | Yes | No | Local implementation fixture-browser verified; live qualification deferred | No |

U5 now presents Approval Inbox, Quote History, immutable revision/item/calculation evidence, workflow
chronology, customer outcomes, exact Item/Snapshot/Pricing Group/Freight version identities, and
guarded bidirectional Batch navigation. The complete accepted workflow remains visible but disabled:
Submit, Approve, Return, Withdraw, Issue, Create Revision, Amend and Reprice all remain
`Backend activation pending`. No mutation, privileged browser path, current-master substitution, or
fixture fallback was added.

## Delivered behavior

- Rate Master alone establishes each governed effective material rate. Batch Calculate accepts only
  layer code plus effective rate; supplier-credit terms, selection rules, and fallback percentages are
  absent from the runtime Calculate input. Customer-payment-term interest remains separate.
- S7-R retains Rate Set/Rate Entry provenance, exact-text signing, actor/time binding, expiry and replay
  checks, true idempotency, Maker-only recalculation, retired Ship-to refusal, BS/BCT/ECT entered
  evidence, and truthful discontinued-SKU provenance without replacement substitution.
- Atomic Send validates every active row and its current calculation, re-gathers effective inputs,
  checks fingerprints and all readiness authorities, then writes the family, candidate revision,
  items, delivery links, and immutable calculation snapshots in one transaction. It allocates no
  Quote reference and writes no S9(c) workflow event.
- S9(c) provides submit, return, adoption Send, approval, withdrawal, issue, next-revision, and void
  operations. First approval allocates the permanent plant/FY Quote reference; revision lineage is
  linear; issue freezes presentation fields; workflow events preserve actor and time evidence.
- Authenticated maker/checker/admin persona gates cover the relevant database end-to-end behavior.
  Direct authenticated writes to calculation and Family G authority remain unavailable.

## Verification baseline

- Pre-activation rollback suite: **165 focused assertions, 0 failed**.
- Post-activation full database suite: **1,291 assertions plus one plan line, 0 failed**.
- Focused S7-R + S9(b) + S9(c) database suite: **165 assertions, 0 failed**.
- S7-R database suite after the effective-rate correction: **1,232 assertions, 0 failed**.
- Executor fixtures: **22 assertions, 0 failed**.
- CP-108 bundle fidelity: passed; generated engine version
  `engine/qe1-7c2ceac1972460ba`.
- Frontend costing, resolver, module-contract, and all named fixture scripts: passed.
- Backend standalone `tests/test_*.py` scripts: **16 files passed**. `pytest` is not installed; these
  tests are executable gate scripts and were run individually.
- Frontend build: passed.
- Current focused frontend rerun: Construction **15/15**, Pricing Basis **98/98**, and U5 Quote
  evidence plus governed Calculate/Send **47/47**, all with 0 failed. The U4 catalogue/lock/
  row-lifecycle/pricing-group aggregate is **54/56**: catalogue **14/14**, lock **5/5**, row lifecycle
  **6/6**, and Pricing Group **29/31**. Its two failures are stale structural assertions left behind
  by separately landed changes: `U4-PG-FE-18a` still expects the pre-printing 35-column grid instead
  of the current shared 37-column span, and `U4-PG-FE-19` still expects the pre-UX fixed 340px
  Pricing card instead of the current flexible summary card. Neither failure is reported as passed.
- Current governed backend route rerun: Construction, Pricing Basis, Batch Pricing Basis, My Batches,
  Calculate/Atomic Send, and Quote workspace **221/221**, 0 failed. The U4 Customer Family/Sector
  static migration contract separately passed **10/10**; this is not activation evidence.
- Local fixture-browser evidence shows all ten accepted workflow actions disabled under `Backend
  activation pending`, including Submit, Amend and Reprice. It also renders the persisted Item,
  Snapshot, Pricing Group, Freight Set Version and Freight Entry identities returned by the governed
  Quote workspace contract. This was not an authenticated-live or production-runtime walkthrough.
- Targeted lint for the directly changed S7-R modules: passed.
- Whole-frontend lint is not a clean baseline: 68 existing/mixed findings remain outside this
  increment. No closure claim depends on that unrelated historical gate.
- `git diff --check`: passed in both repositories (line-ending warnings only).
- Persistent attestation keyring and `batch_calculations`: empty after rollback verification.
- `__p2_fixture_owner`: remains absent.

No browser journey was observed for S7-R, S9(b), or S9(c); none is claimed.

## Migration activation and remaining rollout boundary

The live Supabase ledger previously ended at
`20260911050635_s7r_13_rate_master_separation_gates`. It now ends at
`20260911091000_s9c_quote_workflow_gates`. These six entries were applied in order and each stored
body was checked byte-for-byte against its local source:

1. `20260911070000_s7r_14_effective_material_rate_boundary.sql`
2. `20260911071000_s7r_15_effective_material_rate_gates.sql`
3. `20260911080000_s9b_atomic_send.sql`
4. `20260911081000_s9b_atomic_send_gates.sql`
5. `20260911090000_s9c_quote_workflow.sql`
6. `20260911091000_s9c_quote_workflow_gates.sql`

Migration activation is complete. Secret-dependent activation is deferred: this U-phase does not
inspect or handle attestation secret material, deploy the Edge Function, or claim the required real
authenticated Edge/runtime journey. The persistent governed Calculate and the Atomic Send, approval,
return, issue and revision mutations remain unavailable until that activation is separately resumed.

The current live Supabase security advisor reports two pre-existing items only: an informational
RLS-without-policy finding on private table `app_private.email_change_audit`, and a warning that Auth
leaked-password protection is disabled. Neither is introduced by the unapplied local migrations.

## Repository preservation and cleanup

The exhaustive ownership/tranche inventory is in
`docs/repository-worktree-inventory-2026-09-11.md`. All user-owned and unrelated work remains
unstaged and untouched. The protected `BatchProfileBar.jsx` hunk hash still matches the supplied
value. The prohibited commercial-intelligence record and `.env.local` were not read or modified.

The obsolete generated residue
`quote-gen-be/supabase/functions/calculate-batch-row/_engine/data/defaults.js` was proven outside the
manifest/import closure and deleted under narrow Product Owner authority. No other file was deleted.

## UX-first U3–U6 sequence

1. **Qualify the completed read-only surfaces:** run U3 Pricing Basis, U4 My Batches, and U5 Quote
   workflow presentation against genuine caller-visible records in an authenticated browser session,
   then record Product Owner acceptance separately from technical evidence.
2. **U4 migration truth is resolved:** both Customer Family/Sector migrations were activated on
   2026-09-15 (see the table above). The remaining operational blocker is the empty governed Sector
   master; do not invent Sector rows or connect legacy Sector Defaults without a settled rule.
3. **Resume S9 activation only under separate authority:** provision approved attestation material,
   deploy/activate the retained Edge Function, and verify real Calculate/Atomic Send/workflow and
   Maker/Checker/Admin boundaries before enabling any mutation.
4. **U6:** do not implement until its S10 and approved audit/Family H foundations exist.

Product Owner validation remains separate from technical checks. Do not begin S10 or any later
S-tranche.

## 2026-09-15 addendum — U-series continuation under a narrow S9 deferral

S9 remains active and **not closed**. The Speedbreaker is narrowed to enabling or relying on
production Quote mutations; independent U-series implementation, local verification, fixture-browser
work and deployment-ready preparation continue. Product Owner walkthroughs are **unavailable and
deferred, not failed**. No secret was provisioned, no Edge Function deployed, no production data
seeded, no migration applied and no mutation enabled in this increment.

| Thread | Repository | Commit | Evidence |
|---|---|---|---|
| U4 Pricing Group fixture correction | `quote-gen-fe` | `970ee95` | U4 aggregate 54/56 → **56/56**; no UI source changed |
| Family G authenticated-read correction (prepared, **unapplied**) | `quote-gen-be` | `ac67e39` | Static contract **20/0** |
| U2 SKU Master backend | `quote-gen-be` | `4588e80` | `test_sku_master_route.py` **66/0** |
| U2 SKU Master frontend | `quote-gen-fe` | `da3958b` | `test:sku-master` **29/0**; lint exit 0; module-contract build exit 0 |

Reruns on 2026-09-15: `test:pricing-basis` 98/0, `test:batch-catalogue` 14/0, `test:batch-lock` 5/0,
`test:batch-row-lifecycle` 6/0, `test:pricing-group` 31/0, `test:quote-evidence` 38/0,
`test:governed-calculate-send` 9/0. Backend routes: Quote workspace 27, Batch catalogue 13, Pricing
Basis 31, Batch Pricing Basis 101, Calculate/Send 11, Constructions 38, Customer Families 38, GSM
Master 39, caller context 24 — all 0 failed; Customer Family/Sector static contract 10/0.

**Local fixture-browser evidence only** (Vite dev server on the main `quote-gen-fe` checkout,
developer previews, no signed-in profile, no API call). Not authenticated-live, not
production-runtime, not Product Owner validation:

- `?fixture=u3-u4` — release eligibility, lifecycle chronology, plant-enforced composition, Rate
  version history, and Sector-vs-Default inheritance showing `0.000% · explicit zero`.
- `?fixture=u4-batches` — bounded catalogue, partial detail naming the denied field, Governed and
  Immutable tags, workflow actions disabled.
- `?fixture=u5`, `u5-inbox`, `u5-history` — revision chronology, frozen Item/Snapshot/Pricing
  Group/Freight Set Version/Freight Entry identities, customer outcomes; disabled Submit, Approve,
  Return, Withdraw, Issue, Create revision, Amend and Reprice (plus Calculate, Send, Open Quote, Open
  current Batch). `quoteEvidenceModel`/`batchCatalogueModel` carry `reason: "backend_activation_pending"`.
- `?fixture=u2-skus` — catalogue with an unassigned Plant Item Code, `H —` versus `H 0`; detail with
  exact Construction identity and own-plant adoption, "Construction version #42 · Details
  unavailable", "Construction version #41 · Not visible to this caller", "Plant adoption
  unavailable", "No current Family", replacement lineage both ways, and the declared-unrecorded
  printing fields. No console errors.

Deployment-dependent: applying the Family G correction; S9 secret, Edge deployment and authenticated
runtime journeys; authenticated-live qualification of U2–U5. Decision-dependent: governed Sector
rows and their relation to legacy Sector Defaults; U1 Party merge, deactivation/reactivation and
post-proposal eligibility change. S10-dependent: U1 lifecycle/audit history and U6.
