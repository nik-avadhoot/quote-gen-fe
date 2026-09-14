# S9 technical closure and U3–U6 handoff

Date: 2026-09-11  
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

1. **U3 release visibility:** a read-only, caller-scoped Pricing Basis screen showing plant/date
   eligibility and the exact Rate, Freight, Sector and Calculation Default versions in a Release.
2. **U3 governed-master drill-down:** version history and entries for those four components, including
   missing-versus-zero Freight and inherited-versus-explicit commercial values.
3. **U4 Batch workspace:** incrementally connect the existing Batch Entry journey to durable read paths,
   effective sources, freshness and readiness while preserving the local preview distinction.
4. **U5 workflow presentation:** show genuine immutable evidence and workflow state read paths; all
   secret-dependent mutations remain disabled as `Backend activation pending`.
5. **U6:** do not implement until its S10 and approved audit/Family H foundations exist.

The U3 window is open now. Product Owner validation remains separate from technical checks. Do not
begin S10 or any later S-tranche.
