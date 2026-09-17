# Limited beta readiness plan

Date: 2026-09-17
Authority: Product Owner approval, 2026-09-17, of the beta-entry / beta-exit split proposed by the
Sr Dev reviewer. This record changes **when** existing closure gates are observed. It does not
amend `data-model-decisions.md`, reopen a canonical decision, or weaken any `AGENTS.md`
Speedbreaker.

## 1. Why this record exists

The S9 closure gates (authenticated runtime journeys, Maker/Checker/Admin proof through the deployed
runtime, genuine browser journey, Product Owner acceptance) and the U2–U5 live-qualification items
can only be observed with real users operating the system. Holding them as **pre-beta** gates made a
beta impossible by construction. The Product Owner has ruled that they are observed **inside** a
limited beta, and that forward work beyond S9 and its U dependents does not stop for them.

## 2. What actually blocks a beta (live facts, 2026-09-17, read-only)

| Live table | Rows | Consequence |
|---|---:|---|
| `sectors` | 0 | Family proposal, Prospect creation, Family Sector and governed Batch creation refuse |
| `rate_sets` / `freight_sets` | 0 / 0 | No effective material rate or freight authority exists |
| `pricing_basis_releases` | 0 | Calculate refuses `pricing_basis_absent` |
| `constructions` | 0 | Calculate refuses `construction_reference_invalid` |
| `skus` / `batches` / `quote_families` | 0 / 0 / 0 | Nothing to qualify yet |
| `app_private` attestation keys | 0 | Governed Calculate cannot be attested |
| `plants` / `parties` / `customer_locations` / `customer_families` / active users | 3 / 4 / 3 / 5 / 3 | Enough identity foundation to start |

The live ledger now includes Wave A as `20260917182121_s9_1_fix_family_g_read_helper_execute` and
`20260917182138_register_gsm_and_customer_family_sector_suites`.

**The critical path is master seed plus S9 activation, not further S9 proof.**

Calculate eligibility (`app_private.assert_calculate_eligible`, S7R-7 and later) requires a
Construction by one of two routes: a row-proposed Construction still in `proposed` status, or the SKU
version's Construction in `published` status **and** a `plant_construction_adoptions` row with
`status = 'adopted'` for the Batch's plant. A Proposed SKU and an unapproved SKU version are
calculable (Amendment 04 D-14); only a withdrawn SKU is refused.

## 3. The gate split

Every existing closure gate is now exactly one of:

- **Beta-entry** — must hold before a named trial user touches the governed path.
- **Beta-exit** — observed during the beta and required for S9 technical closure, Product Owner
  closure, and the Formal Data Cutover decision.
- **Post-beta** — not required for beta entry or exit.

### 3.1 Beta-entry (the whole list)

| Wave | Item | Clearing evidence | Owner |
|---|---|---|---|
| A | Apply the Family G authenticated-read correction (`ac67e39`) | Live ledger entry; authenticated caller reads a Family G row; anon refused | SR DEV |
| A | Register `gsm_master_catalogue` and `u4_customer_family_sector_catalogue` in `run_all` | `suite_registration` SR-1 green | SR DEV |
| A | Backend build identity signal | The running Flask service reports its revision | SR DEV |
| B | Governed Sectors seeded (BR-2) | Sector rows exist; Family/Prospect/Batch creation no longer refuses | SR DEV drafts, PO approves |
| B | Beta plant masters: Rate Set, Freight Set, approved Pricing Basis Release, starter Constructions published and adopted at the beta plant (BR-4, BR-7) | Each approved version visible in U3 Pricing Basis; Calculate eligibility passes on a probe row | SR DEV drafts, PO approves |
| B | Batch-creating pgTAP suites (`batch_sets`, `batch_workspace`, `family_f_security`, `calculation_writer`, `calculation_persistence`) green once Sectors exist | Each suite alone, rolled back, 0 failed | SR DEV |
| C | Attestation secret provisioned through the approved Supabase secret surface | Owner confirms provisioned; no secret value appears in any repository, log or conversation | **Product Owner** |
| C | `calculate-batch-row` Edge Function deployed from retained source (bundle fidelity re-checked) | Deployed version recorded against the CP-108 engine version | SR DEV |
| C | One end-to-end smoke on the beta plant: Maker Calculate → Send → Checker Approve → Issue | Persistent `batch_calculations`, Quote family/revision/items/snapshots and workflow events inspected; Quote reference allocated | SR DEV with two real personas |
| D | Real activation signal replaces the hard-coded disabled workflow actions | `quoteEvidenceModel.js` / `batchCatalogueModel.js` enable an action only when the backend reports it live; still disabled with a reason otherwise | SR DEV |
| D | Beta fence: production build flags for the beta destinations only; named users granted capabilities at the beta plant only (BR-3) | Wrong-plant and ungranted callers refused through the running backend | SR DEV + PO names users |
| D | Exports marked BETA on the current template (BR-5) | Every beta export visibly carries the mark | SR DEV |
| D | Pre-go-live database backup and a written kill switch | Backup recorded; kill switch = revoke beta capabilities (immediate, server-enforced), then redeploy without flags (flags are build-time) | SR DEV |
| D | Beta operating sheet: users, plant, known issues, feedback channel, daily check | Single page in `docs/` | SR DEV |

Nothing else is beta-entry. Specifically **not** beta-entry: Product Owner walkthroughs, U2–U5
authenticated-browser qualification, S10 template compatibility, S11 formal reset rehearsal, U6
audit timeline, Party merge and deactivation, Plant Construction Adoption proposal/approval
workflow, SPEC import, UX Batches still listed in `open-work.md`.

### 3.2 Beta-exit (observed during beta)

1. Maker, Checker and Admin each complete their real paths through the deployed runtime, including
   one Return and one Create Revision.
2. Wrong-plant, inactive-user and ungranted-capability refusals observed through the running backend.
3. Shadow parity: during the alongside period (BR-3), every beta quote is compared with the
   spreadsheet result for the same inputs; differences are explained or fixed.
4. Persistent evidence inspected for every issued beta quote: calculation provenance, immutable
   snapshots, workflow events with actor and time.
5. U2–U5 screens used by trial users on genuine records; defects triaged with the `AGENTS.md`
   classification.
6. No open Speedbreaker-class defect.
7. Product Owner acceptance recorded.

On exit, S9 receives its technical and Product Owner closure addendum in
`s9-technical-closure-and-u3-u6-handoff.md`, and the beta evidence stands as S12 real-scenario
validation input for the Formal Data Cutover decision (still a separate Product Owner event).

### 3.3 Post-beta

S10 full export compatibility and multi-part export history; S11 formal pre-cutover reset and seed
rehearsal; S13 monitoring beyond the beta operating sheet; U6 audit timeline; Plant Construction
Adoption governed lifecycle; SPEC import (CDM-37/38) including pricing-portfolio assignment; Party
merge/deactivation; remaining UX batches. **Amend and Reprice are deliberately post-beta:** their
limited-beta controls remain disabled with `not_available_in_limited_beta`; this is Product Owner
ruling BR-8, not an inferred implementation limitation.

## 4. Protections that stay in force during beta

- Secret material is provisioned only through approved surfaces and never read, printed or committed.
- Tenant and plant isolation, capability-based authorization, immutable Quote revisions and
  append-only history are unchanged.
- Applied migrations are never renamed or deleted; corrections are forward migrations.
- No destructive change to populated live data. A seed that must be undone is withdrawn or
  superseded, not deleted, once anything references it.
- A defect that corrupts calculation, quotation, approval, audit or identity authority stops the
  beta path it affects (kill switch), not the whole programme.

## 5. Beta rulings

| # | Ruling | Status |
|---|---|---|
| BR-1 | S9 remaining proof and U2–U5 live qualification are beta-exit, not beta-entry | **Approved** 2026-09-17 |
| BR-2 | Seed governed Sectors using current Sector Defaults values as their first version; how governed Sectors formally relate to legacy Sector Defaults stays parked | **Approved** with the plan (recommended option); PO may override |
| BR-3 | Beta runs alongside the existing spreadsheet for the first week before quotes go to customers from the system | **Approved** 2026-09-17 for `NAG` / Nagpur only with Maker `sales.01@avadhootpacks.in`, Checker `marketing@avadhootpacks.in`, and Admin `nikunj@avadhootpacks.in` |
| BR-4 | Beta plant masters are drafted from `APSPL NAGPUR Master_20260720.xlsx` | **Approved** 2026-09-17 with the explicit exception that the first governed Rate and Freight Sets use application-current defaults, not workbook-derived values |
| BR-5 | Beta exports use the current Excel template, visibly marked BETA | **Approved** with the plan (recommended option) |
| BR-6 | SKU Sets slice 2 | **Superseded:** applied live 2026-09-17 by a concurrent thread; available in beta as-is |
| BR-7 | Constructions: a starter set is seeded published and directly `adopted` at the beta plant, and trial users may also propose Constructions on the row | **Approved** 2026-09-17, including five starters and `INT Flute 2 = NA` → `NULL`. Direct adoption rows are seed data only; no UI exposes direct adoption writes |
| BR-8 | Amend and Reprice are unavailable in limited beta and are delivered post-beta | **Approved** 2026-09-17 |

Wave B seed content (Sectors, rates, freight, Pricing Basis composition, starter Constructions) is
presented to the Product Owner as **one** batch for approval, not item by item.

## 5.1 Delivery progress — 2026-09-17

| Wave | State | Evidence / next gate |
|---|---|---|
| A | Done | Family G correction applied live as `20260917182121`; authenticated has helper EXECUTE while anon/public remain denied. Catalogue-suite registration applied live as `20260917182138`; both suites are present in stored `tests.run_all()`. Backend build identity is committed as `5a4132d`. |
| B | In progress — data blocker | PO approved the single seed batch on 2026-09-17. Live preflight found no exact governed Customer Location identity for eight of nine approved freight destinations and no approved Rate Set entry for starter grade `18J`; the migration must fail closed rather than invent identities, reinterpret the grade as `18`, or write a partial governed release. |
| C | Waiting on Wave B | CP-108 drift was fixed in backend `6d11bed`; six files hash-match engine `engine/qe1-600adcbe1a85be59`, executor fixtures pass. PO confirmed `QCA_KEY_ID` and `QCA_KEY_HEX` are provisioned, names only. Deploy and smoke follow the completed Wave B seed. |
| D | In progress | Build-flag-driven visible BETA marking is committed as frontend `5b2ea5f` plus backend `5a4132d`; production `limited_beta` remains unset. Backend-governed workflow availability and caller-token mutation routes are committed as backend `0bd1f06` and frontend `40cd682`. By PO ruling, the named-user fence remains closed until Wave C deploy and smoke are complete; the pre-go-live backup also remains. |

## 6. Authority granted by this plan

- SR DEV may apply the Wave A migrations, apply Wave B seed after its single content approval, deploy
  the Edge Function in Wave C once the Product Owner confirms the secret is provisioned, and make the
  Wave D code and configuration changes.
- Each live action is announced in one line immediately before it runs and recorded afterwards. It
  does not wait for a fresh approval unless it departs from this record.
- Reserved to the Product Owner: secret provisioning, naming beta users and plant, approving seed
  content, the go-live moment, and beta exit.
