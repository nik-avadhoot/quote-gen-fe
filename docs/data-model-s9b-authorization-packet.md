# S9(b) — authorisation packet for Product Owner review

**Revision 3.** **Date:** 2026-09-11. **Prepared by:** SR DEV.

**Status: proposal. This document authorises nothing.** No Send RPC, fingerprint builder, calculate
writer, migration, grant, policy, route, commit, push or deployment exists or may be made under it.
Every claim below is a live read of the database and the working tree, or a citation to a repository
file at a named line.

**Prerequisite:** S9(b) must not begin until the S7-remainder of §4 is separately authorised and
delivered. That packet does not exist and is not written.

**Sources:** `data-model-decisions.md` (canonical, wins on conflict) · `data-model-design-for-approval.md`
§3 · `data-model-sr-dev-proposal.md` §4.7, §10.4, §10.5, §11, §12 · `data-model-s7-authorization-packet.md`
§7, §8, §10 · `data-model-s7-closure-evidence.md` §1, §2 · `data-model-s8-closure-evidence.md` ·
the five applied S9(a) migrations · live database, read 2026-09-09.

**Standing protections observed throughout.** Nothing staged, committed or pushed. Both repositories
remain on the local-only branch `data-model/s0-provenance` with no upstream.
`docs/commercial-intelligence-decisions.md` was excluded from every search by name and never opened.
The preserved hunk in `src/tabs/batch/BatchProfileBar.jsx` is intact and unstaged — lines 218–225,
`sha256 8ad1c24106bc94fffbc25426c88d010de2877a5d69fdc5062fa962e3a46e0f3b`, reproducible with
`sed -n '218,225p' src/tabs/batch/BatchProfileBar.jsx | sha256sum`.

---

## 0. What changed in revision 2

Eleven corrections from the Product Owner. Three changed a conclusion rather than its wording.

| # | Correction | Where | Effect |
|---|---|---|---|
| 1 | Exact v1 contract, every key enumerated, unknown-key policy stated | §1 | Outline replaced by 22 provenance keys, 5 resolved chains, 15 entered keys, 20 engine scalars, a closed 5-element array. Unknown keys **rejected** at every level |
| 2 | Effective `construction_version_id` non-null, with origin rule | §1.2 | **Conclusion changed.** It was nullable in revision 1. `sku_versions.construction_version_id` is NOT NULL, so the coalesce can never be null |
| 3 | Non-null `provenance.rate_set_version_id`; Rate Entry identities typed per layer | §1.3, §1.4 | Revision 3 supersedes revision 2's supplier-credit snapshot: Rate Set and effective Rate Entry identities remain frozen, while supplier terms stay wholly upstream |
| 4 | Drop the interim content-version freshness mechanism; depend on the minimum canonical fingerprint builder | §3 | **Conclusion changed.** The four content-version keys are removed from the contract entirely rather than demoted |
| 5 | Calculate writer stays classified as omitted S7 scope; separate S7-remainder packet, implemented **before** S9(b) | §4 | **Conclusion changed.** Revision 1 recommended shipping S9(b) unexercisable. It is now sequenced behind a prerequisite |
| 6 | Resolve existing-family behaviour | §2.3 | Rejected outright for this first-Send-only slice |
| 7 | Refuse inactive/absent Pricing Group and Pricing Groups with no active Delivery Group; state remaining completeness rules | §2.4, §2.5 | Added, with six further rules and two flagged for ruling |
| 8 | Correct the Send-audit wording | §6 | Corrected. Revision 1 called `batches.status` plus revision fields "the complete record". They are correlated evidence |
| 9 | Correct PT422 observability | §8 | Corrected. `_rpc_call` logs `exc.message`, not `DETAIL` |
| 10 | Atomicity assertions on every failed-Send test | §7.1 | Four assertions per failure case, plus positive controls and rolled-back fixtures |
| 11 | Closure wording | §10 | SD submits evidence and recommends; the Product Owner awards |

### 0.1 Revision 3 — final S7-R contract correction only

Revision 3 changes no Atomic Send behaviour. It incorporates the Product Owner's final S7-R
authority correction: supplier-credit interest belongs entirely to Rate Master and ends when Rate
Master establishes the governed effective material rate. Calculate neither resolves nor applies a
supplier-credit term. Consequently `resolved.supplier_credit` is removed, the five exact effective
Rate Entry identities and the SKU status are frozen in provenance, and decision D-E is retired as
inapplicable. The S7-R outcomes for D-F and D-G are recorded as settled rather than left open.

---

## 1. The v1 payload contract, exhaustively

Nothing constrains this contract today. `batch_calculations` has held exactly two rows in its
lifetime, both written by a privileged fixture with `'{}'::jsonb` in both columns
(`20260906105600_s6_15_family_f_security_personas.sql:135` and `:305`). There is no incumbent shape
and no reader to break — and because `calculation_snapshots` is immutable once written, a key that is
wrong on the first Send is wrong permanently.

**Three conventions apply throughout.**

- **Keys are `snake_case`.** The payload is written by a database function and read by a database
  function; the JavaScript engine's `camelCase` return is mapped once, by the Calculate writer, and
  the mapping is tabulated in §1.7 so it is reviewable rather than implicit.
- **"Non-null" means present and not JSON `null`.** An absent key and an explicit `null` are the same
  failure. A key documented as nullable must still be *present*, carrying `null`.
- **Numbers are JSON numbers, never strings.** `"5"` is a malformed payload, not a five — the
  blank-versus-zero discipline S7 and S8 established depends on the type surviving.

### 1.0 Unknown keys are REJECTED, at every level

An unrecognised key at any depth of `effective_inputs` or `results` refuses the Send. The reason is
canonical rather than fastidious: §10.4 states that *"unlisted fields are treated as
calculation-relevant until classified"* and instructs the design to *fail toward over-staling*. An
unrecognised key may therefore carry a number that moved the price, and preserving it would freeze,
immutably, evidence that nothing validated. A payload that legitimately needs new keys is a new
`contract_version` — which is exactly what §11.2 means by readers dispatching on the stamped version.

```
effective_inputs := { "contract_version", "provenance", "resolved", "entered" }
results          := { "contract_version", "engine", "row_details" }
```

`contract_version` is an integer and equals 1. A payload stamped 2 is refused by a v1 reader — not
upgraded, not ignored, not partially read. Anything else is `PT422 / payload_contract`.

### 1.1 `effective_inputs.provenance` — 22 keys

| Key | Type | Null | Permitted values | Consistency check at Send |
|---|---|---|---|---|
| **Identity** | | | | |
| `batch_id` | integer | non-null | > 0 | = `p_batch` |
| `batch_row_id` | integer | non-null | > 0 | = `batch_calculations.batch_row_id` |
| `batch_row_lineage_id` | integer | non-null | > 0 | = that row's `lineage_id`. Becomes `quote_items.batch_row_lineage_id` (PM-7) |
| `pricing_group_id` | integer | non-null | > 0 | = the row's current `pricing_group_id`; that group's `batch_id` = `p_batch` |
| `plant_id` | integer | non-null | > 0 | = `batches.plant_id` = `batch_rows.plant_id` |
| `sector_id` | integer | **nullable** | > 0 when present | = `batches.sector_id`, nullable by schema. A null Sector resolves through to the system tier and is **not** a completeness failure |
| **Product versions frozen (CDM-22)** | | | | |
| `sku_id` | integer | non-null | > 0 | = `batch_rows.sku_id` |
| `sku_version_id` | integer | non-null | > 0 | = `batch_rows.sku_version_id`; its `sku_id` matches; `approved_at is not null` |
| `sku_status` | string | non-null | `active · discontinued` | = the named SKU's current status. A discontinued SKU is permitted exactly as itself and is never auto-substituted |
| `construction_version_id` | integer | **non-null** | > 0 | The effective Construction version — §1.2 |
| `construction_version_origin` | string | non-null | `row_proposed` · `sku_version` | Names which limb produced the value — §1.2 |
| **Commercial basis frozen** | | | | |
| `pricing_basis_release_id` | integer | non-null | > 0 | Exists; `status = 'approved'`; `plant_id` = the Batch's plant |
| `rate_set_version_id` | integer | **non-null** | > 0 | = that release's `rate_set_version_id` — §1.4 |
| `layer_rate_entries` | object | non-null | exactly `TOP · F1 · L1 · F2 · L2`; each value is a positive integer when that layer is present and `null` otherwise | Every non-null id is the unique Rate Entry for that layer's grade in `rate_set_version_id`. The object freezes identity only; it carries no supplier term — §1.4 |
| `calculation_default_version_id` | integer | non-null | > 0 | = that release's `calculation_default_version_id`. Also a typed snapshot column; the pair is checked, not each half |
| `pricing_date` | string | non-null | `YYYY-MM-DD` | Parses as a date; within the release's `effective_from … effective_until` (open-ended when `effective_until` is null) |
| **Engine identity frozen** | | | | |
| `engine_version` | string | non-null | trimmed, non-empty | = `batch_calculations.engine_version` |
| `rounding_rule_version` | string | non-null | trimmed, non-empty | = the release's `calculation_default_versions.rounding_rule_version` |
| `rounding_step` | number | non-null | > 0 | = that version's `rounding_step`. Frozen because `final_rate` is rounded to it and is otherwise unreproducible |
| **Row shape — calculation-relevant per §10.4** | | | | |
| `row_type` | string | non-null | `box · plate · part_l · part_w · other` | = `batch_rows.row_type`, mirroring `ck_row_type`. Decides every PP-versus-Box arm in the engine |
| `set_id` | integer | nullable | > 0 when present | Null iff the row has no active SET membership; otherwise the `batch_sets.id` |
| `set_role` | string | nullable | as `batch_set_memberships.role` | Non-null **iff** `set_id` is non-null, and equal to that membership's role |

### 1.2 The effective Construction version

§10.4 already speaks of *"the effective `construction_version_id`"*, so this is a canonical term being
given a precise definition rather than a new concept. The definition follows CDM-13, which the
database states in the words of its own guard: *"a row Construction reference exists only for a
Quote-specific PROPOSED Construction; the published SKU spec version is otherwise sole authority."*

```
effective construction_version_id :=
    coalesce( batch_rows.proposed_construction_version_id,
              sku_versions.construction_version_id )

construction_version_origin :=
    'row_proposed'  when batch_rows.proposed_construction_version_id is not null
    'sku_version'   otherwise
```

**Non-null by construction, not by convention.** `sku_versions.construction_version_id` is **NOT NULL**
in the live schema, and `batch_rows.sku_version_id` is NOT NULL with a composite foreign key binding
the version to its SKU. The second limb therefore always yields a value, so the effective id can never
be null. Revision 1 had this key nullable; that was wrong.

**Consistency checks — all five required.**

| # | Check | Why it is not redundant |
|---|---|---|
| C-1 | The recorded `construction_version_id` equals the coalesce recomputed at Send, and `construction_version_origin` agrees with which limb produced it | Catches a payload written before the row's proposed reference was added or cleared. The two keys must not be able to disagree with each other or with the row |
| C-2 | When origin is `row_proposed`: the version's parent `constructions.status` is **still** `'proposed'` at Send | `guard_row_proposed_construction` fires on INSERT and UPDATE of `batch_rows` only. A Construction published between calculation and Send leaves a row reference CDM-13 no longer permits, and **no trigger re-fires**. Refusing is the only thing that catches it |
| C-3 | When origin is `sku_version`: the version's parent `constructions.status` is `'published'` | A SKU version could point at a version whose Construction is `'merged'`. A merged Construction is not governed authority for a new Quote |
| C-4 | When origin is `sku_version`: an `adopted` row exists in `plant_construction_adoptions` for `(plant_id, construction_version_id)` | CDM-04 makes Construction adoption plant-owned. A Construction published group-wide but withdrawn at this plant is not a basis this plant may quote on. `uk_pca_plant_version` makes the lookup exact |
| C-5 | The version's own fields — `ply`, the two flute codes, the five layer code/GSM pairs — equal what `entered` carries | This is what makes `entered.layers` evidence rather than a copy. A payload whose layers drifted from the Construction it names would freeze a spec that never existed |

**C-4 is deliberately not applied to a proposed Construction.** A Quote-specific proposed Construction
has by definition not been adopted anywhere; requiring adoption would make the `row_proposed` limb
unreachable. That asymmetry is CDM-13's, not an exception invented here.

### 1.3 `effective_inputs.resolved` — five chains

Each chain carries the value the engine used *and* the tier that produced it. The four non-freight
source vocabularies are the ones `calculation_snapshots` already pins in its own check constraints, so
the contract and the column cannot drift.

**`resolved.waste` · `resolved.conv` · `resolved.margin`** — identical shape, two keys each.

| Path | Type | Null | Permitted values | Check |
|---|---|---|---|---|
| `.value` | number | non-null | finite, ≥ 0 | Reaches the matching `effective_*` snapshot column |
| `.source` | string | non-null | `row · batch · sector · system` | Mirrors `ck_cs_waste_source` / `ck_cs_conv_source` / `ck_cs_margin_source`. `unresolved` is not in the list and refuses the Send |

**`resolved.interest`** — six keys (CDM-18, CDM-22).

| Path | Type | Null | Permitted values | Check |
|---|---|---|---|---|
| `.value` | number | non-null | finite, ≥ 0 | An explicit `0` is a decision and must survive |
| `.source` | string | non-null | `pricing_group · derived_annual · system` | Mirrors `ck_cs_interest_source` |
| `.payment_terms_days` | integer | nullable | `30 · 45 · 60 · 90` | = `pricing_groups.payment_terms_days`, mirroring `ck_pg_payment_terms_closed`. Non-null **required** when source is `derived_annual` — the derivation has no other input |
| `.annual_interest_pct` | number | non-null | finite, ≥ 0 | = the release's `calculation_default_versions.annual_interest_pct` |
| `.day_count_basis` | integer | non-null | > 0 | = that version's `day_count_basis`. CDM-22 is explicit that the derived number alone is unverifiable once the rate is superseded |
| `.override_reason` | string | nullable | trimmed non-empty when present | Required non-null when source is `pricing_group` and `.value` differs from the derived figure — mirrors `ck_pg_interest_override_reason` |

**`resolved.freight`** — seven keys (CDM-17, S8).

| Path | Type | Null | Permitted values | Check |
|---|---|---|---|---|
| `.value` | number | non-null | finite, ≥ 0 | Never `null`: an unresolved chain has no snapshot |
| `.source` | string | non-null | `row · legacy_batch · pricing_group · master · legacy_matrix` | Mirrors `ck_cs_freight_source`. `unresolved` is absent by design and refuses |
| `.authority` | string | non-null | `governed · temporary` | Bound to source exactly as `ck_cs_freight_authority_binds_source` requires |
| `.freight_set_version_id` | integer | nullable | > 0 when present | Non-null **iff** source is `master` — §1.5 |
| `.freight_entry_id` | integer | nullable | > 0 when present | Non-null **iff** source is `master`, and the entry belongs to that version — §1.5 |
| `.mode` | string | nullable | `master · manual · ex_factory` | = `pricing_groups.freight_mode`, mirroring `ck_pg_freight_mode` |
| `.degraded_from` | string | nullable | `no_pricing_group · basis_missing · basis_ship_to_missing · no_approved_pair` | Recorded, never acted on. It is how an issued Quote can later explain why it did not reach the governed master. The vocabulary is closed so it cannot become free text |

### 1.4 Rate Master identity and the effective-rate boundary

`provenance.rate_set_version_id` freezes the governed Rate Set Version and
`provenance.layer_rate_entries` freezes the exact effective Rate Entry used for every present layer.
The `(rate_set_version_id, grade_code)` uniqueness rule makes each non-null entry an identity lookup,
not a grade-to-credit selection rule.

Supplier price, discount, freight, supplier-credit percentage and supplier-credit source remain
upstream Rate Master facts. Calculate receives only each named entry's governed
`effective_material_rate`; it never receives or recomputes those components. The per-layer `rate` in
`results.row_details` is therefore calculation evidence produced from that governed material rate
(plus the existing governed GSM surcharge where applicable), not a second supplier-credit snapshot.
Customer-payment-term interest remains the separate `resolved.interest` Batch input above.

### 1.5 Freight reference shape

| Payload condition | Verdict | Why |
|---|---|---|
| `source = unresolved`, or key absent | **Refuse** | `ck_cs_freight_source` has no such value. Refusing in the RPC turns an unmapped constraint violation into a controlled answer |
| `authority` disagrees with `source` | **Refuse** | Mirrors `ck_cs_freight_authority_binds_source` |
| `source = master`, only one of the two references | **Refuse** | **Invalid master-only reference shape.** Half a reference is not a reference; the resolver already treats it as unavailable and the snapshot must never record it as approved authority |
| `source = master`, both present, entry not in that version | **Refuse** | **Mismatched master reference.** `fk_cs_freight_entry_in_version` is the backstop; the RPC refuses first so the caller gets a controlled error, not a foreign-key failure |
| Any non-`master` source carrying either reference | **Refuse** | Mirrors the biconditional `ck_cs_freight_refs_master_only`. A `row` or `pricing_group` snapshot claiming Freight Master provenance is the fiction the S9(a) correction closed |
| `authority = temporary`, no governed reference | **Permit** | Warn-and-permit is the ratified issuance rule. A Quote may be issued on temporary freight; it may never *describe* that freight as approved Freight Master authority |

### 1.6 `effective_inputs.entered` — 15 keys

`entered` carries **only what `calcCosting` consumes and no resolver produces**. Every resolved value
is excluded on purpose: carrying `waste`, `conv_rate`, `margin`, `interest` or `freight_override` here
as well as under `resolved` would create two answers to one question, which is the defect class S7 and
S8 exist to have removed.

| Key | Type | Null | Permitted values | Check |
|---|---|---|---|---|
| `length_mm` | number | non-null | > 0 | The engine returns `null` without it |
| `width_mm` | number | non-null | > 0 | as above |
| `height_mm` | number | nullable | > 0 when present | May be null **only** when `box_type` is `Board` or `PP` — the engine's flat-piece arm. Otherwise required |
| `ply` | integer | non-null | ≥ 1 | = the effective Construction version's `ply` (C-5) |
| `box_type` | string | non-null | `RSC · Board · PP · HRSC-L · HRSC-R · HRSC-O · Die-R · Die-S · Custom` | Selects the deckle formula. A value outside the list silently takes the RSC branch, so the list is closed here |
| `ups` | integer | non-null | ≥ 1 | Divides `area`; a zero would produce infinity |
| `flute_f1` | string | nullable | a flute code | = the Construction version's `flute_f1` (C-5) |
| `flute_f2` | string | nullable | a flute code | = the Construction version's `flute_f2` (C-5) |
| `layers` | object | non-null | exactly 5 keys: `TOP · F1 · L1 · F2 · L2` | Each value is an object of exactly two keys — `code` (string, nullable) and `gsm` (number, nullable, > 0 when present). Both null means the layer is absent. All ten values equal the Construction version's (C-5) |
| `fluting_bcf` | number | non-null | 0 … 0.30 | Feeds `calc_bs`. The engine defaults it to 0.10 when unset, so freezing it is what makes `calc_bs` reproducible |
| `add_ons` | object | non-null | exactly 8 keys | `printing · stitching · coating · handling · moq_charge · packing · other · unloading`, each a non-null number ≥ 0. Zero is a real value and must be present, not omitted |
| `sales_moq` | integer | nullable | ≥ 0 when present | = `batch_rows.sales_moq` |
| `volume` | integer | nullable | ≥ 0 when present | = `batch_rows.volume` |
| `spec_bs`, `spec_bct`, `spec_ect` | number | nullable | > 0 when present | Frozen specification evidence; all three equal the named SKU version |

`spec_bs`, `spec_bct` and `spec_ect` are included by the final S7-R contract. They are not arithmetic
inputs to `calcCosting`, but they are calculation evidence because Send must preserve the specification
against which the computed strength was judged.

**Deliberately absent from `entered`, and from the calculation payload entirely:** `client`, `product`,
`material_code`, `sector` code, `plant` and `delivery` names, `dim_type`, `sku_type`, `customer_type`,
`price_context`, `is_repeat`, `payment_disc`, `qty_per_set`, `req_box_wt`, `board_gsm`. Each is
presentation, a display label, or a legacy field the engine never reads. §10.4 assigns the
presentation ones to the presentation fingerprint; none is calculation evidence.

### 1.7 `results.engine` — 20 scalars

The complete scalar return of `calcCosting` (`src/engine/costing.js:119-121`), mapped once from
`camelCase`. All 20 are non-null numbers, finite and not NaN.

| Key | Engine key | Meaning | Extra rule |
|---|---|---|---|
| `deckle` | `deckle` | Deckle, mm | > 0 |
| `cutting` | `cutting` | Cutting length, mm | > 0 |
| `area` | `area` | Area per piece, m² | > 0 |
| `wt` | `wt` | Paper consumed incl. waste, kg | > 0 |
| `wt_sheet` | `wtSheet` | Sheet weight excl. waste, kg | > 0 |
| `mat` | `mat` | Material cost | ≥ 0 |
| `conv` | `conv` | Conversion cost | ≥ 0 |
| `fr` | `fr` | Freight cost on sheet weight | ≥ 0 |
| `add_ons` | `addOns` | Sum of the eight add-ons | ≥ 0; equals the sum of `entered.add_ons` |
| `int_c` | `intC` | Interest cost | ≥ 0 |
| `total` | `total` | Total cost incl. freight | ≥ 0 → `total_cost` |
| `final_rate` | `finalRate` | Rounded final rate | ≥ 0 → `final_rate` |
| `margin_amt` | `marginAmt` | Margin amount | ≥ 0 |
| `moq_kg` | `moqKg` | MOQ in kg | ≥ 0 |
| `estimated_box_wt` | `estimatedBoxWt` | Sheet weight less 2 % | > 0 |
| `calc_moq` | `calcMOQ` | Computed MOQ, pieces | integer ≥ 0 → `calc_moq` |
| `calc_bs` | `calcBS` | Computed bursting strength | ≥ 0 |
| `calc_gsm` | `calcGSM` | Computed GSM | integer ≥ 0 |
| `rate_per_kg` | `ratePerKg` | Rate per kg on sheet weight | ≥ 0 → `rate_per_kg` |
| `fr_rate` | `frRate` | Freight rate applied, ₹/kg | ≥ 0; **must equal `resolved.freight.value`** — the single check that proves the engine was called with the resolution the snapshot records |

### 1.8 `results.row_details` — a closed array of exactly five

One element per board layer, in the fixed order the engine emits them. The array length is **exactly 5**
and the order is **positional, not sorted**: element 0 is TOP, then F1, L1, F2, L2.

| Element shape | When | Keys | Rules |
|---|---|---|---|
| **Absent layer** | the Construction has no `code` or no `gsm` for that layer | exactly 4 — `k`, `wt`, `cost`, `rate` | `k` = the positional layer name; `wt`, `cost`, `rate` all exactly `0`. There is **no `ws` key** in this shape |
| **Present layer** | both `code` and `gsm` present | exactly 8 — `k`, `wt`, `ws`, `cost`, `rate`, `code`, `gsm`, `tu` | `k` = the positional layer name; `code` and `gsm` equal `entered.layers[k]`; `tu` is the take-up factor, `1` for liners; all numbers finite and ≥ 0 |

Cross-check: `sum(row_details[].wt)` equals `results.engine.wt`, and `sum(row_details[].cost)` equals
`results.engine.mat`, each to the stored numeric precision. Any other element shape, length or order is
`PT422 / payload_contract`.

### 1.9 Mapping to the snapshot's typed columns

| calculation_snapshots column | Source | Null | Rule |
|---|---|---|---|
| `schema_version` | literal `1` | NOT NULL | Versions the **snapshot**. `batch_calculations.schema_version` versions the **calculation payload**. Different lifecycles; never copied one into the other |
| `engine_version` | `bc.engine_version` | NOT NULL | = `provenance.engine_version` |
| `rounding_rule_version` | `provenance.rounding_rule_version` | NOT NULL | trimmed non-empty |
| `pricing_basis_release_id` | `provenance.pricing_basis_release_id` | NOT NULL | §1.1 |
| `calculation_default_version_id` | `provenance.calculation_default_version_id` | NOT NULL | §1.1 |
| `pricing_date` | `provenance.pricing_date` | NOT NULL | §1.1 |
| the five `effective_*` / `*_source` pairs | `resolved.*` | NOT NULL | §1.3 |
| `freight_authority`, `freight_set_version_id`, `freight_entry_id` | `resolved.freight.*` | see §1.5 | §1.5 |
| `total_cost`, `final_rate`, `rate_per_kg`, `calc_moq` | `results.engine.*` | first three NOT NULL | §1.7 |
| `calculation_fingerprint` | `bc.calculation_fingerprint` | NOT NULL | Carried verbatim *and* re-verified — §3 |
| `presentation_fingerprint` | `bc.presentation_fingerprint` | NOT NULL | Carried verbatim and opaque. Not recomputed at S9(b) — §3.3 |
| `effective_inputs`, `results` | `bc.*` | NOT NULL | Carried whole, after full contract validation |
| `calculated_by` | `bc.computed_by` | NOT NULL | **Nullability mismatch.** `bc.computed_by` is nullable; this column is not. A null computer refuses the Send rather than reaching a constraint violation |
| `calculated_at` | `bc.computed_at` | NOT NULL | Carried. **Not** `now()` — the snapshot records when the number was computed, not when it was frozen |

---

## 2. What makes a complete Quote candidate

The current browser-local Send does the opposite, and that is the behaviour this slice must not carry
into the database. `sendAllToQuoteItems` skips at **two** independent points: a row with no result
appends to `skippedRows` and returns (`src/state/useQuoteActions.js:359-365`), and so does a row whose
construction cannot be found (`:367`). Both produce a partial Quote and a toast. Defensible for a
scratchpad; not for frozen, immutable evidence, which CDM-02 requires to be *complete*.

### 2.1 The invariant

```
Let  A = { r in batch_rows : r.batch_id = p_batch and r.status = 'active' }
Let  S = { snapshots the operation writes }

|A| = |S|   and   |A| >= 1   and   for every r in A : exactly one fresh, conforming calculation

Anything short of this raises. Nothing is written.
```

> **The structural rule.** The operation must never reach `batch_rows` through an inner join to
> `batch_calculations`. An inner join *is* the filter — it silently produces a smaller,
> plausible-looking Quote instead of an error. An anti-join runs first and refuses; only then does a
> second statement build from the joined set. The gate asserts the anti-join count is zero rather than
> trusting the build statement's row count, because a build statement that dropped rows would still
> report a self-consistent number. With two skip sites in the incumbent behaviour rather than one, the
> rule has to be structural — removing a condition would not have been enough.

| Half of "exactly one" | Enforced by | Evidence |
|---|---|---|
| **At most one** per row | the database, already | `uk_bc_row unique (batch_row_id)`. The RPC does not re-prove it; a gate pins the constraint so a future migration cannot silently drop it |
| **At least one** per active row | the RPC | `left join batch_calculations … where bc.id is null`, executed before any insert |

### 2.2 The four calculation refusal classes

| Class | Detected by | Reason token |
|---|---|---|
| **Missing** — an active row with no calculation | the anti-join | `calculation_missing` |
| **Stale** — computed against different inputs | the canonical calculation fingerprint, recomputed and compared — §3 | `calculation_stale` |
| **Foreign-Batch** | Two hazards, one already closed. *(a)* A calculation naming another Batch's row is unrepresentable — `fk_bc_row` is the composite `(batch_row_id, batch_id) → batch_rows(id, batch_id)`. *(b)* An **Item** pointing at another Batch's lineage is **not** prevented by anything: `fk_qi_lineage` targets `batch_rows(lineage_id)` with no Batch scoping. Every lineage must be drawn only from rows selected under `br.batch_id = p_batch`, and a gate asserts every written Item's lineage resolves back to that Batch | `row_foreign_batch` |
| **Malformed** | the §1 contract, key by key, including the §1.0 unknown-key rejection | `payload_contract` |

### 2.3 Existing Quote family — REJECTED

If a `quote_families` row already exists for this Batch — in **any** status, `draft`, `active` or
`abandoned` — the Send is refused with `PT422 / quote_family_exists`. S9(b) creates families; it does
not adopt them.

Two findings support this, and both should be visible rather than just the conclusion.

- **Canon does not define an empty-draft recovery case.** CDM-21 says *"First Send creates/dedicates
  the Quote family"*, and "dedicates" plainly anticipates adoption — but nowhere is the adoptable
  state specified. CDM-30 defines abandonment of a *pre-approval* family, not re-entry into one.
  Building an adoption rule from "dedicates" alone would be modelling an unapproved rule.
- **No code path can produce the state.** A family is created only by Send, inside one transaction that
  also creates the revision and sets `status = 'sent'`. A family with zero revisions cannot commit, and
  a family with revisions implies a Batch no longer `working`, which §5 already refuses. Within S9(b),
  family-exists is unreachable — so refusing costs nothing and is the fail-closed reading.

The check is written against **existence**, not against status, precisely so that it does not quietly
become an adoption rule if a future slice makes the state reachable. **S9(c) must define adoption**
when it introduces Create Revision and the `submitted → working` return; recorded here as its
obligation, not answered by omission.

### 2.4 Pricing Group and Delivery Group completeness

CDM-16 makes one same-priced row into one Quote Item covering *every* Delivery Group in its Pricing
Group. An Item that covers none is an Item that reaches no customer, and it would be frozen that way.

| # | Rule | Reason token | What is and is not already enforced |
|---|---|---|---|
| P-1 | Every active row's Pricing Group exists and belongs to this Batch | `pricing_group_missing` | Already unrepresentable — `fk_row_pg` is the composite `(pricing_group_id, batch_id)`. Asserted anyway so the guarantee is pinned rather than assumed |
| P-2 | That Pricing Group's `status = 'active'` | `pricing_group_inactive` | **Not enforced anywhere.** `ck_pg_status` permits `removed`, and a row can point at a removed group |
| P-3 | That Pricing Group has **at least one** `delivery_groups` row with `status = 'active'` | `delivery_group_absent` | **Not enforced anywhere.** No cardinality trigger on `delivery_groups` and no constraint requiring one — verified live: zero non-internal triggers on that table |
| P-4 | In `master` freight mode: `freight_basis_delivery_group_id` is non-null, that Delivery Group is `active`, and it has a non-null `ship_to_location_id` | `freight_basis_invalid` | Partly enforced: `fk_pg_freight_basis` binds the basis to the group. **Neither the basis being active nor its Ship-to being present is enforced** — and both are exactly what S8's resolver treats as a degradation to the temporary tier. At Send they must refuse rather than degrade |
| P-5 | In `manual` mode: `freight_manual_value` is non-null. In `ex_factory` mode: no basis is set | `freight_mode_invalid` | Already enforced by `ck_pg_manual_value` and `ck_pg_exfactory_no_basis`. Re-checked so the refusal is controlled rather than a constraint violation |

### 2.5 The remaining completeness rules

| # | Rule | Reason token | Why it belongs before immutability |
|---|---|---|---|
| R-1 | The Batch has at least one active row | `no_active_rows` | A revision with no Items is not a Quote candidate. CDM-02 requires completeness, and an empty revision could never be distinguished later from one whose Items were lost |
| R-2 | Every active row's `sku_versions.approved_at` is non-null | `sku_version_unapproved` | `approved_at` is nullable, so an unapproved SKU version is representable on a row. Quoting a spec nobody approved, immutably, is the failure this prevents |
| R-3 | Every active row's `skus.status` is not `'proposed'` | `sku_not_published` | A proposed SKU has no `plant_item_code` yet. **See D-G for `discontinued`** |
| R-4 | The five Construction consistency checks C-1 … C-5 pass for every row | `construction_reference_invalid` | §1.2 |
| R-5 | One Pricing Basis Release governs every row: all snapshots carry the same `pricing_basis_release_id`, approved, for this plant, covering `pricing_date` | `pricing_basis_inconsistent` | A revision assembled from two Releases is a mixed-basis Quote. CDM-25's Amend and Reprice modes exist precisely so that mixing is a *deliberate*, later act — never an accident of Send |
| R-6 | The caller holds the unreleased edit lock, and it is theirs | — (`42501`) | Already inside `can_write_batch`; restated because Send is the one operation whose result cannot be undone if the lock assumption is wrong |

The final S7-R contract settles D-G: `proposed` is refused; `active` and `discontinued` are permitted,
and the exact status is frozen as `provenance.sku_status`. A replacement SKU is never substituted.

### 2.6 Why "the entire Send" is not merely an intention

1. **Order.** Every validation runs before the first `INSERT`. A refusal on row 40 of 40 has written
   nothing to undo.
2. **Transaction.** One RPC call is one transaction, so even a failure raised after the inserts rolls
   the whole thing back. This is the proposal's own S9 criterion: *"Send is all-or-nothing under
   induced failure."*
3. **Measurement.** §7.1 asserts four unchanged quantities across every failed Send. A count is
   evidence; "the transaction rolled back" is a claim.

---

## 3. Freshness is the canonical fingerprint

> **Revision 1 was wrong here.** It proposed four content-version integers as an interim freshness test
> and asked the Product Owner to approve the divergence. That was the wrong shape of answer. CDM-23
> names one mechanism, and standing a second one beside it would have created two answers to "is this
> calculation still valid" — the exact defect class S7 and S8 were spent removing. The four keys are
> **deleted from the contract**, not demoted.

### 3.1 What the minimum builder is

§10.4 already specifies it exactly — *"two deterministic hashes over sorted, typed, explicitly listed
fields"* — with the calculation fingerprint's field list enumerated in full. The minimum builder is one
deterministic function computing **that list, from database state**. Nothing is invented; a written
specification is implemented at its narrowest.

| §10.4 field | Available from |
|---|---|
| Row overrides — waste, conversion, margin, freight | `batch_rows.waste_override_pct`, `margin_override_pct`, `conv_override_rate`, `freight_override` |
| `sku_version_id`; the effective `construction_version_id` | `batch_rows`; the §1.2 coalesce |
| Dimensions, ply, box type, ups; `row_type` | `sku_versions`, `construction_versions`, `batch_rows.row_type` |
| SET membership | `batch_set_memberships` |
| `pricing_group_id` and the group's `freight_mode`, `freight_basis_delivery_group_id`, `freight_manual_value`, `interest_override_pct`, `payment_terms_days` | `pricing_groups` |
| Batch Profile values and `sector_id` | `batch_profile_versions` where `is_current`; `batches.sector_id` |
| `pricing_basis_release_id`; engine and rounding versions | `pricing_basis_releases`, `calculation_default_versions` |
| Add-ons | `effective_inputs.entered.add_ons` |

Every field is already in the database. The builder is a pure, deterministic function over them —
sorted and typed, per §10.4 — and it is the *same* function the Calculate writer calls to stamp
`batch_calculations.calculation_fingerprint`. One function, two callers, no possibility of the writer
and the reader disagreeing.

### 3.2 How Send uses it

```
for each active row:
    stored  := batch_calculations.calculation_fingerprint
    current := app_private.calculation_fingerprint(row)
    if stored is distinct from current then
        raise PT422, reason = 'calculation_stale'
```

That is the whole use. Send does not classify, does not present, and does not act on any difference
other than refusing.

### 3.3 What is explicitly NOT absorbed

| Stays at U4 | Why it is not needed here |
|---|---|
| The **presentation** fingerprint builder | Send carries `presentation_fingerprint` verbatim and opaque. Nothing in S9(b) compares it. The `needs_send_only` state it serves is a divergence signal, not a Send precondition |
| The **three divergence states** — `fresh`, `needs_send_only`, `calculation_stale` | Send needs one boolean: equal or not. The classifier is a live signal for the Batch screen, and there is no Batch screen |
| Live divergence **presentation**, and the smallest-affected-unit rules of CDM-23 / DM-6 | Entirely UI and staling-propagation work. Send refuses; it does not mark anything stale |
| Any new **persistence** | None is required. `batch_calculations.calculation_fingerprint` and `presentation_fingerprint` have existed since S6-3, both `not null` under `ck_bc_fingerprints`. There is no migration to add a column and none is proposed |
| The existing `getBatchRowStatus` heuristic | Frontend, untouched, and not the authority for anything the database does |

### 3.4 Where the builder belongs

The Calculate writer *cannot stamp a fingerprint without it*, and the writer is the S7-remainder of §4.
Delivering the builder inside S9(b) would mean shipping a function whose only writer arrives in a
different slice — with a window in which the two could be built against different field lists.

**Recommendation, for the S7-remainder packet to confirm:** the canonical fingerprint builder ships
**with the Calculate writer**, in that packet. S9(b) consumes it read-only and declares a hard
dependency on it. That packet is not written and is not mine to write without instruction, so this is a
recommendation about its contents, not a decision taken.

---

## 4. The Calculate writer, and the sequence it forces

**Classification retained: OMITTED S7 SCOPE.** The S7 authorisation packet names the calculate RPC as
an S7 obligation in two separate sections. The commit shape proposed in that same packet — and
executed — contains no such commit. No deferral was recorded anywhere, and nothing superseded it. It
was not decided against; it fell out between §8 and §10 of one document.

### 4.1 What the packet committed S7 to

> Somewhere to put the result — `batch_calculations` — **Has no write grant and no write policy today**
> — deliberately: §7.5 leaves the calculate path to S7. **S7 must add the calculate RPC and that path
> only**.
>
> — `data-model-s7-authorization-packet.md` §7, dependency table

> **Schema.** S7 is additive: **a calculate RPC**, plus the write grant and policy on
> `batch_calculations` that §7.5 withheld.
>
> — *ibid.* §8, Rollback and compatibility consequences

### 4.2 What S7 proposed and shipped

| Evidence | Finding |
|---|---|
| S7 packet §10, "Proposed shape, for approval" | Three commits: **S7(a)** the resolver module, **S7(b)** the two engine corrections plus the golden file, **S7(c)** materialisation removal at five sites. **No calculate RPC in the approved shape** |
| S7 closure evidence §1, twelve Product Owner dispositions | Annual interest basis · override attribution · map retirement · supplier credit · pre-S7 literals · flute profiles · printing vocabulary · location eligibility · Item Status · file preservation · authorisation · closure evidence. **None is the calculate path** |
| S7 closure evidence §2, eight backend migrations | `s7_1` … `s7_6` plus two fixes. None touches `batch_calculations` |
| Repository-wide search of every migration for a write grant or insert policy on `batch_calculations` | **No match.** The only two inserts in the whole history are the privileged fixture seeds |
| Live database, read 2026-09-09 | `authenticated` holds `SELECT` and nothing else; one policy, `batch_calculations_select`; no `calculate_*` or `record_batch_calculation` function in `public` or `app_private` |
| A live, green gate — `FS-14` in `tests.family_f_security()` | Still asserts, and passes: *"batch_calculations has no write grant at all — a caller cannot publish a calculation **(S7 owns that)**"* |

### 4.3 Why not "deferred", and why not "superseded"

This programme records its deferrals in writing. S8's closure evidence carries a section headed
*"Explicitly deferred to U4 — not implemented by S8"*; S7's own disposition table records Item Status as
*"Not started. Recorded as a cutover-design item."* Nothing of that kind exists for the calculate RPC in
the packet, the closure evidence, the amendment, or any commit message. **An unrecorded absence is an
omission, not a deferral** — a deferral carries a decision and an owner; an omission carries neither.

Nor was it superseded: the S7 resolver computes the values but has no write path and no route, and
§10.5 still names `batch_calculations` as Send's exclusive source.

### 4.4 The sequence this forces

Revision 1 recommended shipping S9(b) fixture-proven and unexercisable. On Product Owner instruction
that is replaced: **a separate S7-remainder packet is prepared, authorised and implemented first**, and
S9(b) follows it. The writer is *not* included in S9(b) — folding it in would repeat the collapse of
confirmation and implementation that cost the S6 correction pass.

What that packet would need to carry, as a recommendation for it rather than a decision taken here:

- The **canonical fingerprint builder** of §3, since the writer cannot stamp a fingerprint without it.
- The **calculate RPC** that writes `batch_calculations`, emitting a payload conforming to the §1 v1
  contract — so the contract is ratified once and honoured by writer and reader alike.
- The write path §7.5 withheld: whether that is the write grant and policy the S7 packet describes, or
  an RPC-only definer path with no grant at all, is that packet's design question. The second is more
  consistent with how every governed write has been built since.
- Whatever gate replaces `FS-14`, which asserts the absence the writer is about to remove and will fail
  the moment it lands.

### 4.5 Fixture-populatable is not legitimately exercisable

A suite can mint a conforming `batch_calculations` row through the owner, and that proves the Send
RPC's logic under every branch. It proves nothing about whether an authorised caller can produce one.
That distinction survives the resequencing, because even after S7-remainder lands there is still **no
HTTP route and no user interface** for Batch or Quote anywhere in either repository — so §10 keeps
browser verification and Product Owner validation outstanding regardless.

---

## 5. Duplicate invocation is a state refusal

One line: **Send requires `batches.status = 'working'`, and Send sets it to `'sent'`.** A second
invocation meets a Batch that is no longer `working` and is refused with
`22023 → TRANSITION_NOT_ALLOWED → HTTP 422`. No idempotency key, no dedupe window, no "return the
existing revision" convenience.

This is deliberately the narrowest rule. It does not decide what a legitimate re-Send does after Create
Revision, what happens to a Batch a Checker returns from `submitted` to `working`, or whether a second
Send should open a new draft revision. Those belong with the workflow transitions in S9(c) and are
**explicitly deferred**, alongside §2.3's family-adoption obligation.

| Backstop | Effect on a second Send |
|---|---|
| `uk_qf_batch unique (batch_id)` | A second Quote family for the same Batch is impossible (CDM-21) — and §2.3 refuses before reaching it |
| `uk_qi_revision_lineage` | A second Item for the same row in the same revision is impossible, and with no DELETE privilege or policy anywhere in Family G there is no way to clear the first |
| `p_expected_content_version` CAS | Send bumps `batches.content_version`, so a replayed request carrying the old token fails with `PT409` before the status check matters |

Two gates: a second Send against a `'sent'` Batch raises `22023` and writes nothing; and a Send against
each of the other five non-`working` statuses — `submitted`, `approved`, `issued_locked`, `abandoned`,
`archived` — raises the same code. The second gate exists because a check written as
`status <> 'sent'` would pass all five and read as correct.

> **Recorded, not fixed.** There is no transition guard on `batches.status` — no trigger, and
> `batches_update` admits any of the seven values in `ck_batch_status` to any caller holding the edit
> lock and the right capability. A direct PATCH can move a Batch out of `working`, or back into it,
> without going through Send. Closing that changes accepted S6 work, is **not** in this increment, and
> most likely belongs with the transitions in S9(c).

---

## 6. What the Send leaves as evidence

> **Revision 1 overstated this.** It said `batches.status = 'sent'` together with
> `quote_revisions.created_at` and `created_by` was *"the complete record of the act."* It is not. There
> is **no `sent_by` and no `sent_at` anywhere**. What exists is correlated evidence from which the act
> can be inferred, and the difference matters for anyone reading a Quote's history later.

| What exists after a Send | What it actually attests | What it does not |
|---|---|---|
| `quote_revisions.created_by` / `created_at` | Who created the first revision, and when | A row-creation stamp, not a recorded workflow act. Nothing labels it "Send" |
| `batches.status = 'sent'` | The Batch is in the post-Send state | Carries no actor and no timestamp, and — per §5 — is reachable by a direct PATCH that never ran Send |
| `calculation_snapshots.calculated_by` / `calculated_at` | Who computed each number, and when | The *calculator*, not the sender. They can be different people, and the times can be far apart |
| `batches.content_version` incremented | The Batch changed | Says nothing about what changed it |

Correlating the first three gives a confident reading of who sent and roughly when. It is inference
from three correlated facts, not a record — and this packet says so rather than let a future reader
believe an audit event exists.

### 6.1 No workflow event, and no constraint widening

`ck_qwe_event_type` admits exactly eight values — `submitted`, `returned`, `approved`, `withdrawn`,
`issued`, `voided`, `superseded`, `archived`. There is no `sent`. The eight are the workflow acts of
CDM-24 and CDM-33, all of which are S9(c)'s; Send is the act that *creates the candidate* the workflow
then operates on.

So S9(b) writes no `quote_workflow_events` row and **does not alter the check constraint**. Two gates,
failing in different directions: after a successful Send, `count(*)` on that table is **0**; and
`ck_qwe_event_type` is pinned **by its exact expression**, not by name, because a widened constraint
keeps its name and only its definition moves.

> **The gap, recorded for a separate decision — D-H.** If Send should leave an explicit, attributed
> audit record, the honest options are a Family H `audit_events` row — the table exists and is
> append-only, and this is the same shape as the outstanding **O-1** obligation for lock takeover and
> reclaim — or widening the workflow event vocabulary, which is a change to an S9(a) constraint.
> **Neither is in this increment** and neither will be added without separate authorisation.

---

## 7. Two proof layers, and what every failure asserts

The two layers prove different propositions and must not substitute for one another. A suite that only
calls the RPC proves the RPC refuses; it says nothing about whether the database would catch the same
defect if the check were deleted. A suite that only probes constraints proves the database refuses; it
says nothing about whether the caller gets a controlled error or an unmapped 500.

| | Layer A — RPC pre-validation | Layer B — constraint rejection |
|---|---|---|
| **Proposition** | The operation refuses a defective Batch *with a mapped, controlled error*, and writes nothing | The database refuses a defective row *by a named rule*, independently of the operation |
| **Invocation** | `public.send_batch(…)` as a real persona: `set local role authenticated` with the fixture's JWT claims | `insert into public.calculation_snapshots …` directly, bypassing the RPC |
| **Asserted** | The SQLSTATE, the reason token, and the four atomicity quantities in §7.1 | The SQLSTATE (`23514` / `23503`) **and the constraint's name** via `GET STACKED DIAGNOSTICS … = PG_EXCEPTION_CONSTRAINT`. A bare `23514` proves only that *some* check fired |
| **Runs as** | `authenticated`. Never the owner — an owner run silently skips RLS, column grants and sequence grants, which is how three defects hid through all of S6 | The owner, deliberately: the point is to reach the constraint with the RPC removed from the path |
| **Containment** | The RPC's own transaction rolls back on refusal | **A rolled-back subtransaction closed by a sentinel exception** — mandatory, §7.2 |

### 7.1 Four assertions on every failed Send

Every Layer A failure case captures these before the call and re-reads them after. All four, every
time — not a representative sample.

| # | Quantity | Assertion | Why it is separate |
|---|---|---|---|
| A-1 | Family G row counts | All **nine** tables unchanged — `quote_families`, `quote_revisions`, `calculation_snapshots`, `quote_items`, `quote_item_delivery_groups`, `quote_workflow_events`, `customer_outcome_events`, `export_events`, `export_parts` | Nine, not the six Send writes: a bug that wrote to a table Send has no business touching is exactly what a narrower assertion would miss |
| A-2 | `batches.status` | Still `'working'` | The status flip is the one write outside Family G. A refusal that left the Batch `'sent'` with no Quote would strand it permanently — §5 would then refuse every retry |
| A-3 | `batches.content_version` | Unchanged | Distinct from A-2. A bumped version with an unchanged status invalidates the caller's CAS token, so the next honest attempt fails with `PT409` for no reason |
| A-4 | `ref_private.reference_sequences` for `('quote', plant_id, fy)` | `next_value` unchanged **and** no row created where none existed | Both halves matter: `allocate_reference` upserts before it increments, so a row appearing from nothing is itself a consumed allocation. S9(b) must allocate no Quote Reference at all — CDM-21 puts that at first Checker approval |

### 7.2 Positive controls and rolled-back fixtures

**Positive control, first, in both layers.** One Send that *succeeds* and writes the expected counts —
one family, one revision, *n* snapshots, *n* items, the correct number of delivery-group links, zero
workflow events. Without it, every zero in §7.1 could mean the fixture never reached the code at all,
which is the failure mode this programme has been bitten by before. The positive control also
re-asserts A-4: a *successful* Send must leave the Quote reference sequence untouched too.

**Every fixture Send is rolled back.** Not hygiene — a necessity. Family G has no DELETE privilege and
no DELETE policy, and every foreign key is `on delete restrict`, so a committed fixture Send is
unremovable by the application and leaves the sent `batch_rows`, `pricing_groups` and
`pricing_basis_releases` undeletable for good. A Layer B probe that *unexpectedly succeeds* raises
nothing, so an ordinary `begin … exception when others` block would commit it.

The pattern is already established here, and its rationale is recorded verbatim in
`20260908113153_ua3_fix_last_admin_test_uses_rolled_back_subtransaction.sql`: the block is *always*
rolled back by a sentinel exception raised unconditionally at its end, and the verdict survives because
*plpgsql variable assignments are not transactional*. Every probe in both layers uses it, the positive
control included.

### 7.3 Layer coverage

| Defect | Layer A — SQLSTATE + token | Layer B — constraint by name |
|---|---|---|
| Active row with no calculation | `PT422` · `calculation_missing` | — (no constraint expresses this) |
| Fingerprint mismatch | `PT422` · `calculation_stale` | — |
| Item lineage from another Batch | `PT422` · `row_foreign_batch` | — (`fk_qi_lineage` is unscoped — §2.2) |
| Malformed or unknown-key payload | `PT422` · `payload_contract` | `ck_cs_effective_inputs_object`, `ck_cs_results_object` |
| Freight `unresolved` | `PT422` · `freight_unresolved` | `ck_cs_freight_source` |
| Authority / source mismatch | `PT422` · `freight_authority_mismatch` | `ck_cs_freight_authority_binds_source` |
| Master with one reference; non-master with any | `PT422` · `freight_reference_shape` | `ck_cs_freight_refs_master_only` |
| Entry not in its Freight Set Version | `PT422` · `freight_reference_mismatch` | `fk_cs_freight_entry_in_version` — `23503` |
| Pre-existing Quote family | `PT422` · `quote_family_exists` | `uk_qf_batch` — `23505` |
| Pricing Group removed; no active Delivery Group | `PT422` · `pricing_group_inactive` · `delivery_group_absent` | — (neither is enforced — §2.4) |
| Freight basis missing, inactive, or without Ship-to | `PT422` · `freight_basis_invalid` | partial — `fk_pg_freight_basis` |
| Unapproved SKU version; unpublished SKU | `PT422` · `sku_version_unapproved` · `sku_not_published` | — |
| Construction consistency C-1 … C-5 | `PT422` · `construction_reference_invalid` | — (the trigger does not re-fire at Send — C-2) |
| Two Pricing Basis Releases in one Batch | `PT422` · `pricing_basis_inconsistent` | — |
| No active rows | `PT422` · `no_active_rows` | — |
| Caller lacks the lock or `make_quote` | `42501` | — |
| Batch not `working`, incl. duplicate Send | `22023` | — |
| Stale `expected_content_version` | `PT409` | — |

---

## 8. Controlled errors, and how the reason is observed

Eighteen refusal conditions, **four SQLSTATEs**, three of which already exist.

| SQLSTATE | error_code | HTTP | Meaning | Status |
|---|---|---|---|---|
| `42501` | `CAPABILITY_REQUIRED` | 403 | No active app user; no `make_quote` at the plant; not owner or collaborator; edit lock not held | Existing |
| `PT409` | `STALE_VERSION` | 409 | `p_expected_content_version` does not match | Existing |
| `22023` | `TRANSITION_NOT_ALLOWED` | 422 | **Wrong state.** The Batch is not `working`, including every duplicate Send | Existing |
| `PT422` | `SEND_NOT_READY` | 422 | **Right state, unready content.** Every completeness, freshness, contract, family, group and freight refusal in §1–§3 | **One new code** |

The split that keeps this from growing is **wrong state versus unready content**. `22023` already means
"that action is not allowed for this record's current state" throughout this codebase. Everything else
is a Batch in the right state whose content is not yet a complete Quote candidate — one condition
class, one code, eighteen tokens.

### 8.1 The correction: DETAIL is not currently logged

> **Revision 1's observability design did not work.** It proposed raising the reason token in `DETAIL`
> and said the server "already logs it." It does not. `_rpc_call` logs exactly two fields —
> `app.logger.info("RPC %s refused: %s %s -> %s", name, exc.code, exc.message, code)` for a mapped
> code, and `exc.code` with `exc.message` again for an unmapped one. **`exc.details` is never read.** A
> token raised in `DETAIL` would have been silently invisible in production, and only the in-database
> tests would ever have seen it.

One relevant fact in the other direction, verified in the installed package:
`postgrest.exceptions.APIError` *does* populate `.details` from PostgREST's JSON `details` field,
alongside `.message`, `.code` and `.hint`. So the DETAIL channel is reachable — it is simply not read
today. Both options below are therefore genuinely available.

| | Option 1 — fixed MESSAGE token **(recommended)** | Option 2 — DETAIL plus a logging change |
|---|---|---|
| **The raise** | `raise exception 'send_not_ready:freight_reference_shape' using errcode = 'PT422';` | `raise exception 'send precondition failed' using errcode = 'PT422', detail = 'freight_reference_shape';` |
| **Backend change** | **None** beyond the three mapping-dictionary entries every new code needs. The existing log line already carries `exc.message` | One line in `_rpc_call` to include `exc.details` in the log call — on the path of **every governed route in the application** |
| **Tests read** | `GET STACKED DIAGNOSTICS … = MESSAGE_TEXT` | `… = PG_EXCEPTION_DETAIL` |
| **Client receives** | `{"error_code":"SEND_NOT_READY","error":"<one fixed backend-authored sentence>"}` — identical under both, and nothing database-authored reaches it either way | as left |
| **Risk** | MESSAGE stops being a human sentence. Mitigated by a gate asserting every `PT422` raise in the function source matches `^send_not_ready:[a-z_]+$` against the closed token list — mechanical, and it fails on free text | Semantically cleaner, but it touches shared code for one slice's benefit and widens what is logged for every route |

**Recommendation: Option 1.** It reaches the log through a channel that already exists and already
never reaches the client, and it keeps S9(b) from editing a function on every governed route's path.
The U1-CF-C2 rule is satisfied under either — the rule is that raw Postgres text must not be
*forwarded*, and `_error()` returns only `_ERROR_MESSAGE` strings this codebase wrote.

> **Two constraints, and one deferral.** `PT422` follows the `PT409` precedent exactly — a custom
> `PT`-class SQLSTATE, introduced by migration `20260908052900` for the same reason. **It must not be
> `40001`, and nothing here may raise `40001` deliberately:** the Data API treats it as transient and
> retries, which produced a measured 1,025,464-retry storm and a request that never returned.
>
> **Deferred:** whether a Maker is eventually *told which* precondition failed. A leak-safe reason
> channel to the UI is genuine design work and there is no UI to receive it.

---

## 9. The logical change boundary

S9(b) is **one logical change: the atomic Send operation and its proof.** Four units of work, defined
by responsibility rather than by file count. Whether they arrive as one migration or five, and in what
order, is decided at build time under the ordinary rules — each file byte-identical to the body the
database records, and the G-A fingerprint agreeing on both sides.

| | Unit | Responsibility | Complete when |
|---|---|---|---|
| L1 | **The operation** | `app_private.send_batch(p_batch bigint, p_expected_content_version integer) returns bigint`, `SECURITY DEFINER`, `set search_path = ''`; the `public.send_batch` invoker wrapper; `EXECUTE` to `authenticated` on the wrapper only | The validation order of §1–§3 is implemented, the writes below are the only writes, and the errors of §8 are the only errors |
| L2 | **The proof** | `tests.quote_send()` — Layers A and B as §7 separates them, positive controls first, four atomicity assertions on every failure | Every row of §7.3 has an assertion, each naming the mistake that would produce a different answer |
| L3 | **Registration** | `tests.run_all()` redefined to call the new suite | `tests.suite_registration()` passes — it fails an unregistered suite, so this is enforced, not remembered |
| L4 | **Access hygiene** | `revoke all on function tests.quote_send() from public, anon, authenticated` | `tests.function_grants()`, `tests.access_model()` and `definer_placement` pass. A new `tests.*` function is created with PUBLIC EXECUTE by default — this caught S9(a) on its first full run |

### 9.1 The write surface

| Table | Operation | Constraint on the write |
|---|---|---|
| `quote_families` | INSERT | `status='draft'`; `quote_reference` **NULL**. Never reuse — §2.3 |
| `quote_revisions` | INSERT | `revision_no` **NULL**; `workflow_status='draft'`; `standing` NULL; `source_revision_id` NULL |
| `calculation_snapshots` | INSERT only | One per active row. Never UPDATE, never DELETE — enforced in the code, because the database cannot stop a definer owned by a `BYPASSRLS` role |
| `quote_items` | INSERT only | One per snapshot; lineage drawn only from rows selected under `batch_id = p_batch` |
| `quote_item_delivery_groups` | INSERT | One Item × every active Delivery Group in its Pricing Group (CDM-16); at least one per Item, guaranteed by P-3 |
| `batches` | UPDATE two columns | `status := 'sent'`, `content_version := content_version + 1`. Nothing else |
| `quote_workflow_events` | **No write** | §6.1 |
| `ref_private.reference_sequences` | **No write** | No Quote Reference, no revision number. Both belong to first Checker approval (CDM-21), which is S9(c). Asserted by A-4 |
| `customer_outcome_events`, `export_events`, `export_parts` | **No write** | Three of the nine Family G tables stay empty |

### 9.2 Prerequisites, outside the boundary

S9(b) does not begin until both are authorised and delivered under §4: the **Calculate writer**, and
the **canonical fingerprint builder** of §3. Neither is in this increment.

### 9.3 Also outside the boundary, explicitly

No HTTP route in `server.py` beyond the `PT422` mapping entries. No frontend change of any kind. No
workflow transition beyond `working → sent`. No approval, issuance, withdrawal, voiding, export or
outcome. No presentation fingerprint, no divergence classification, no staling propagation (U4). No
`legacy_batch` or `legacy_matrix` replacement (U3 / U4). No transition guard on `batches.status`. No
audit event. No Quote family adoption. No change to any file in `quote-gen-fe/src`, and none to
`src/tabs/batch/BatchProfileBar.jsx`, whose preserved hunk at lines 218–225 hashes to
`8ad1c241…3e6e0f3b` and stays unstaged.

### 9.4 Rollback

Clean while Family G is empty: dropping the operation and its suite reverts everything. **Not clean
after the first Send commits** — every Family G foreign key is `on delete restrict`, so the sent
`batch_rows`, `pricing_groups`, `delivery_groups` and `pricing_basis_releases` become undeletable and
no application path can remove the Quote rows. The proposal states it: S9 is *"the last slice with a
clean revert."* Hence §7.2 — no acceptance run may leave a committed Send behind.

---

## 10. Evidence submitted, closure recommended

> **Revision 1 claimed an authority it does not have.** It said technical closure was *"closable by the
> Senior Developer."* Corrected: the Senior Developer assembles and submits evidence and **recommends**
> closure. Awarding it is the Product Owner's. The three outstanding states below are not
> sub-conditions of closure and must not be folded into it.

| State | Who | Content |
|---|---|---|
| **Implemented** | SD asserts | L1–L4 exist and are applied, each migration file byte-identical to the body the database recorded, G-A fingerprint agreeing on both sides. A statement of fact the SD can make alone, because it is mechanically checkable |
| **Automated-test verified** | SD submits evidence | `tests.run_all()` green with `tests.quote_send()` registered, and `tests.quote_schema()` **still 97 / 0** — the regression net for the immutability guarantees this operation is the first thing capable of breaching. Backend `pytest` at its 1027 / 0 baseline. All eight frontend gates green, ESLint at 66 or below, `test:module-contract` green. The counts and the run output are the submission |
| **Technically closed** | **SD recommends · PO awards** | Recommended only with its limit stated in the closure record itself: the operation is proven against minted fixtures, and — even after the §4 prerequisites land — **no HTTP route and no user interface exists to invoke it**. A closure record omitting that sentence would be false |
| **Browser verified** | **Outstanding** | No route, no UI, no populated Batch. Nothing can be exercised through a browser, and no walkthrough of the existing `localStorage` Send would be evidence about this operation — that path never reaches the database |
| **Product Owner validated** | **Outstanding** | Validation on this programme has meant the Product Owner exercising the behaviour in an authenticated session. That remains impossible for S9(b). Review of the code and the evidence is available and worth having; it is a different thing and belongs under a different name |
| **Rollout ready** | **Outstanding** | Nothing is pushed; neither repository has an upstream. The environment is a private development database with every upstream table empty. Both are private-development facts and neither supports a production claim |

The honest submission S9(b) could earn: *implemented; automated-test verified; recommended for
technical closure of the database operation only, with no route or interface able to invoke it; browser
verification, Product Owner validation and rollout readiness all outstanding.*

---

## 11. Decisions required before S9(b) can be authorised

Seven. D-A, D-B and D-C gate the work; D-D through D-G are narrower rulings inside it; D-H records a
gap that may want closing elsewhere.

| # | Decision | Why it cannot be taken by SR DEV |
|---|---|---|
| **D-A** | **Ratify the §1 v1 payload contract.** Twenty-two provenance keys, five resolved chains, fifteen entered keys, twenty engine scalars, a closed five-element array, unknown keys rejected at every level | `calculation_snapshots` is immutable, so a key that is wrong on the first Send is wrong permanently. The contract also binds the Calculate writer, so ratifying it constrains the S7-remainder packet |
| **D-B** | **Confirm the sequencing: S7-remainder first, then S9(b).** The Calculate writer and the canonical fingerprint builder become prerequisites, prepared in their own packet | It changes what is authorised and in what order, and it creates a new packet obligation |
| **D-C** | **Approve one new SQLSTATE, `PT422 → SEND_NOT_READY → 422`, with Option 1 observability** | A new application-owned error code and its client-facing message are product surface, and Option 2 would edit code on every governed route's path |
| **D-D** | **Confirm that a pre-existing Quote family refuses the Send** | Canon says "creates/dedicates" but never defines the adoptable state. Defining adoption now would be modelling an unapproved rule |
| **D-E** | **Retired by the 2026-09-11 S7-R correction.** Calculate has no supplier-credit source vocabulary | Supplier-credit authority ends inside Rate Master; there is no Batch supplier-credit chain on which to rule |
| **D-F** | **Settled by S7-R: freeze `spec_bs`, `spec_bct` and `spec_ect` in `entered`.** | Preserves the specification evidence used to judge the computed result |
| **D-G** | **Settled by S7-R: permit `discontinued`, freeze `sku_status`, never auto-substitute.** | Preserves truthful status while keeping final-run and re-order Quotes possible |
| **D-H** | **Recorded, not proposed — the Send leaves no attributed audit record** | Closing it means either a Family H `audit_events` row (the O-1 shape) or widening an S9(a) constraint. Neither will be added without separate authorisation |

---

**Nothing in this packet is implemented.** It is submitted for Product Owner review, and S9(b) begins
only on explicit approval of this packet and after the §4 prerequisites are themselves authorised and
delivered.
