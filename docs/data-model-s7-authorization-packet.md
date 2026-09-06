# S7 — authorisation packet for Product Owner review

**Status:** proposal. **This document authorises nothing.** No resolver, engine change,
materialisation removal, migration, commit or golden-file update exists or may be made under it.
Prepared under the Product Owner instruction of 2026-09-06 to *prepare, but not implement*, an S7
packet once the S5/S6 correction pass was complete.

**Prerequisite:** S7 must not begin until **S6 is ratified**. Three of the structures S7 resolves
against were unusable before the correction pass, and two of them were unreachable by any ordinary
caller (§7).

**Sources:** `data-model-decisions.md` (canonical, wins on conflict) · `data-model-implementation-brief.md`
§4, §9.3, §10.8 · `data-model-sr-dev-proposal.md` §10, §16.2, T-12/T-13 · live code, re-read
2026-09-06 and cited by current line number.

---

## 1. The resolver's exact authority chains

One pure module in `src/engine/`, not `src/state/` — §9.3 requires the goldens to execute the real
`calcBatchRow` and Send paths, and a resolver in `state/` would need a React renderer to test.
`engine/costing.js` is already React-free.

```
resolve(field, {row, pricingGroup, batchProfile, sector, calcDefaults})
  → { value: number | null,
      source: 'row' | 'pricing_group' | 'batch' | 'sector' | 'system' | 'unresolved',
      sourceVersionId: bigint | null }
```

Provenance is returned, not just value, because CDM-22 requires Send to freeze *"effective values and
sources, selected versions"*.

| Field | Chain | Canon |
|---|---|---|
| **Waste** (CBB / PP) | `row → batch_profile → sector_version → calculation_default_version` | CDM-19 |
| **Conversion** (₹/kg, **not** a percentage) | `row → batch_profile → sector_version → calculation_default_version` | CDM-19, §3.1 |
| **Margin** | `row → batch_profile (Box \| PP) → sector_version.margin_pct → calculation_default_version` | CDM-19 + the Sector Margin ruling |
| **Interest** | `pricing_group.interest_override_pct → payment-terms map → calculation_default_version.interest_fallback_pct` | CDM-18 |
| Freight | `row → pricing_group → approved Freight master → UNRESOLVED → **block**` | CDM-17 — **S8, not S7** |

**Interest is exact-match on a closed list.** 30 → 0.5 %, 45 → 0.75 %, 60 → 1.0 %, 90 → 1.5 %.
`payment_terms_text` never participates. **Any miss — including a null `payment_terms_days` —
resolves to the versioned 0.5 % fallback, never to 1.5 %.** The closed list is already structural in
the database (`ck_pime_closed_list`, `ck_pg_payment_terms_closed`, S5); S7 makes the *resolution*
match it.

### 1.1 The split S7 exists to close (B-1)

Two surfaces answer the same question differently today, and only one consults the Sector:

| Surface | Site | Chain today |
|---|---|---|
| Costing | `src/state/useCostingResult.js:56-59` | `batchDefaults ?? sector ?? literal` — three tiers |
| **Batch Entry (the sole CalcGate)** | `src/state/useQuoteActions.js:222-226` | `row ?? batchProfile ?? literal` — **no Sector tier at all** |

A Batch whose profile field is blank therefore costs one way in Costing and another way at the gate
that actually produces the Quote. Both must call the one resolver.

---

## 2. The three approved `engine/costing.js` corrections

T-12 names three. **Two are S7; the third is S8.** Each is inside the file `CLAUDE.md` protects, and
§4.2 anticipates them: *"removed or reconciled under an explicitly approved engine-change commit."*

| # | Site (verified 2026-09-06) | Defect | Slice |
|---|---|---|---|
| **E-1** | `costing.js:35` — `…margin=8,interest=1.5,…` | A **fourth answer** where CDM-18 gives one. Unreachable *today* only because `buildSpecFromRow` (`costing.js:209`) always supplies `prof.interest ?? 0.5`. A destructuring default is not a decision anyone approved | **S7** |
| **E-2** | `costing.js:81` — `const intC=sub*(+interest\|\|0)/100;` | `+""` is `0` and `0\|\|0` is `0`, so **blank and explicit zero are indistinguishable at the only line that consumes Interest** (A-19) | **S7** |
| **E-3** | `costing.js:29-32` — `if(override&&+override>0)return +override;` then `matrix?.[p]?.[d]\|\|0` | An **explicit zero freight override is discarded**, and a matrix miss returns `0` — so explicit-zero and unresolved collapse, where CDM-17 requires **block** | **S8** |

### 2.1 A fourth site, not in the original three, needing a ruling before S7 can proceed

`costing.js:26` — `const creditPct=(e.interest!=null&&e.interest!=='')?+e.interest/100:CREDIT_PCT;`
with `CREDIT_PCT = 0.015` (`data/defaults.js:58`).

This is the **rate entry's own credit percentage**, a different tier from Pricing Group Interest. It
has its own null-aware test already, so it is not an A-19-class defect — but its fallback is a bare
literal of 1.5 %, and **CDM-18's 0.5 % fallback governs Payment-Terms Interest, not this.** §4.4
makes `rate_entries.interest_pct` nullable and says nothing about what a null resolves to. See
**Q-1** below.

---

## 3. The five materialisation-removal sites

All five re-read and confirmed present, 2026-09-06.

| # | Site | What it writes today |
|---|---|---|
| 1 | `tabs/batch/BatchProfileBar.jsx` — Sector `<select>` `onChange` (~67-74) | `waste: sd?sd.wasteCBB:5, convRate: …, wastePP: …, convRatePP: …` — the Sector's numbers stamped into the profile as literals |
| 2 | `tabs/batch/BatchProfileBar.jsx` — `numField` `onChange` (~147) | `if(raw===""){setBatchProfile(p=>({...p,[key]:def}))}` — **clearing a field stores the sector default** |
| 3 | `tabs/costing/BatchContextBar.jsx` — `pickSector` (~89-93) | the same four values into the context cascade |
| 4 | `tabs/batch/BatchProfileBar.jsx` — Payment Terms `<select>` (~230-231) | `interest: m[e.target.value] \|\| 1.5` (**A-18**, and the forbidden 1.5 fallback) |
| 5 | `tabs/costing/BatchContextBar.jsx` — `pickPayment` (~104-105) | `interest: PAY_INTEREST[code] \|\| 1.5` (**A-18**) |

**Site 2 is the one that matters most.** Clearing a field is the *only* gesture a Maker has for
"inherit", and it is the gesture that manufactures an override. After S7 all five write `null` and
let the resolver answer.

> Site 2 and site 4 both live in `BatchProfileBar.jsx`, which currently carries an **uncommitted
> Product Owner change that has been preserved untouched through every slice.** S7 is the first
> slice that must edit that file. **The preserved change must be reconciled with the Product Owner
> before S7 touches it** — it cannot simply be committed or overwritten as part of the resolver work.

---

## 4. Blank versus explicit zero

**The rule, exactly:** `null` means *inherit*, `0` means *a value the user chose*, and **only `null`
advances the chain**. Every tier test is `x !== null && x !== undefined` — never truthiness, never
`||`, never `+x > 0`.

| Layer | State today |
|---|---|
| **Storage** | **Already correct.** `batch_profile_versions` has every value column nullable with **no default** (S6-1), and `BP-3f` proves a blank field is stored as `null` and never as `0`. `batch_rows` overrides are the same |
| **Engine, waste/conv** | **Already correct.** `costing.js:42` `nz=(v,d)=>(v===''||v==null||isNaN(+v))?d:+v` — and its comment records why: eight sectors legitimately carry `wastePP = 0`, which `0 \|\| 5` silently discards |
| **Engine, Interest** | **Broken** — E-2 |
| **Engine, Freight** | **Broken** — E-3, S8 |
| **UI** | **Broken** — sites 1-5: the UI never lets a `null` reach storage in the first place |

So the gap is not the storage boundary. It is that the UI prevents `null` from being written and the
Interest line cannot tell `null` from `0` once it is.

---

## 5. Affected frontend and runtime behaviour

What a user will see change:

1. **Clearing a profile field stops storing a number.** It will display the inherited value —
   greyed, per CDM-19 — instead of stamping the Sector default into the Batch. This is a visible
   behaviour change on the most common gesture in the profile bar.
2. **Changing Sector stops rewriting the profile.** Waste/conversion/margin follow the new Sector
   *by resolution*, immediately, without any stored value moving.
3. **Payment Terms stops writing Interest.** The PT selection becomes the input; Interest becomes a
   resolved output with a visible source.
4. **Costing and Batch Entry agree.** Any Batch that today shows a different cost in the two places
   because of the missing Sector tier will change in Costing, at the gate, or both. **This is the
   point of the slice, and it must be expected rather than treated as a regression.**
5. **Existing Batches keep their stored literals.** Values materialised before S7 are indistinguishable
   from deliberate overrides, so they stay and carry forward visibly (CDM-25). Nothing is backfilled.
   See Q-2.

---

## 6. Golden-test changes requiring Product Owner review

**The proof gate (§16.2) is the full `npm run test:costing` golden diff, reviewed line by line.**
`scripts/costing-fixtures.mjs` currently asserts **5 checks**; `test:blanket` and `test:draft` must
stay green and are not expected to move.

New goldens S7 must add, each requiring review:

| Case | Why |
|---|---|
| Blank / explicit-zero / value across **all five** inheritable fields (waste CBB, waste PP, conversion Box, conversion PP, margin) | §9.3; the `0` must survive every tier |
| Row override beats Batch beats Sector beats system, for each field | CDM-19, and the tier `useQuoteActions` is missing today |
| Sector changed mid-Batch with a blank profile field | proves resolution rather than materialisation |
| Payment Terms map **hit** on each of 30/45/60/90 | CDM-18's closed list |
| Payment Terms **miss**, and null `payment_terms_days` | must reach **0.5 %**, never 1.5 % |
| Explicit `interest_override_pct = 0` | must produce zero interest, not the fallback (E-2) |
| Provenance assertions: `source` and `sourceVersionId` for every resolved field | CDM-22 requires Send to freeze them |

**Any change to an existing golden value is a change to a price.** The diff must be presented with
before/after figures and an explanation per line, and approved before commit.

---

## 7. Dependency on the corrected S6 structures

S7 reads Family F. Three of the things it reads **did not work before the correction pass**, and two
were unreachable by any ordinary caller — so this dependency is real, not formal.

| S7 needs | S6 structure | State |
|---|---|---|
| The **Batch tier** of every chain | `batch_profile_versions` + one current pointer | **Only usable because of S6-12.** Before it the profile was write-once and every Batch-level default was frozen at creation |
| To write a profile change safely | `revise_batch_profile` CAS (`40001` on a stale token) | New in S6-12 |
| The **row tier** | `batch_rows.waste_override_pct`, `margin_override_pct`, `conv_override_rate` | **Only reachable because of S6-9 and S6-11.** Before them no authenticated caller could insert a Batch row at all |
| The **Sector tier** key | `batches.sector_id` | Unchanged |
| The Interest chain inputs | `pricing_groups.payment_terms_days` (closed list), `interest_override_pct` | Unchanged |
| SET-aware row typing | `batch_sets.status`, `active_component_count` | **Trustworthy only after S6-10.** An active empty SET was representable before |
| Somewhere to put the result | `batch_calculations` | **Has no write grant and no write policy today** — deliberately: §7.5 leaves the calculate path to S7. S7 must add the calculate RPC and that path only |
| The two lower tiers | `sector_versions.margin_pct` (not null), `calculation_default_versions` | From S5 |

**S7 must not begin before S6 is ratified.** If S6 were amended after S7 started, the resolver would
be reading a moving target.

---

## 8. Rollback and compatibility consequences

**Schema.** S7 is additive: a calculate RPC, plus the write grant and policy on `batch_calculations`
that §7.5 withheld. No table is dropped or altered destructively. Forward migration only.

**Application rollback is *not* free, and this is the compatibility risk to weigh.** Once
materialisation stops, a cleared field is stored as `null`. An application build **older than S7**
reads those fields with `||` and truthiness and would substitute its own literal — so a blank field
that should inherit the Sector would silently become the hard-coded `5` / `7` / `12.5` / `8`.

> **Compatibility window: the S7 application build and the S7 schema move together.** Rolling the
> app back below S7 while S7-era `null`s exist mis-resolves inherited values. If a rollback below S7
> is ever required, it must be preceded by a deliberate, approved forward migration that
> materialises current effective values back into the profile — which is the very thing S7 removes,
> and therefore a decision, not a script.

**Data.** Nothing is backfilled. Literals materialised before S7 remain and are indistinguishable
from deliberate overrides. Per CDM-25 they carry forward visibly until cleared.

**Calculations.** `batch_calculations` is explicitly replaceable pre-Send (CDM-22), so rows written
by a reverted S7 are discarded rather than corrected. No frozen evidence is at risk: `quote_items`
and `calculation_snapshots` are S9 and do not exist.

**Engine.** The golden file is the compatibility record. A revert of S7 must revert the golden file
in the same commit, per the atomicity rule (§16.1).

---

## 9. Decisions required before S7 can be authorised

| # | Decision | Why it cannot be taken by SR DEV |
|---|---|---|
| **Q-1** | What is the versioned fallback for a **rate entry's own** credit percentage when `rate_entries.interest_pct` is null? Today it is the bare literal `CREDIT_PCT = 1.5 %`. CDM-18's 0.5 % governs Payment-Terms Interest and does not obviously govern this tier | It is a commercial rate, not a technical default. Putting 1.5 % into `calculation_default_versions` would enshrine an unapproved number; putting 0.5 % there would change every rate that relies on it |
| **Q-2** | Are profile literals materialised **before** S7 left as they are (recommended — they are indistinguishable from real overrides, and CDM-25 says overrides carry forward visibly), or cleaned up under a separate approval? | Cleaning them changes stored commercial values on existing Batches |
| **Q-3** | The preserved uncommitted change in `BatchProfileBar.jsx` — S7 is the first slice that must edit that file (sites 2 and 4) | The change is the Product Owner's and has been preserved untouched through every slice; it must be reconciled, not overwritten |

**Carried forward, not S7 decisions:** **O-1** (the Family H audit event for lock takeover and
reclaim, with its mandatory reason) and the HTTP status mapping for `40001` and `55P03`, which the
API layer should translate to 409 when these operations are exposed through a route.

---

## 10. Proposed shape, for approval

Per §16.2, S7 is **three commits**, and the ⚠️ marks the engine change as needing authorisation
beyond ordinary commit approval:

| Commit | Content | Proof gate |
|---|---|---|
| **S7(a)** | The resolver module and its unit tests; no caller changed | All five fields correct for blank / zero / value at every tier; provenance returned for each |
| **S7(b)** ⚠️ | The engine change — `costing.js:35` and `:81` — with its golden file in the same commit | Full `test:costing` diff reviewed line by line and approved |
| **S7(c)** | Materialisation removal ×5; both surfaces call the resolver | Clearing a field stores `null`; Costing and Batch Entry agree; `test:blanket` and `test:draft` still green |

Plus the standing gates on every commit: `tests.run_all()`, the backend acceptance suites, the HTTP
probe matrix, and G-A.

---

**Nothing in this packet is implemented.** It is submitted for Product Owner review alongside the
S5/S6 closure report, and S7 begins only on explicit approval of this packet and after S6 is
ratified.
