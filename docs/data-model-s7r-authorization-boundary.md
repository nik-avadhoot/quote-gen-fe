# S7-R — read-only authorisation boundary

**Revision 1.** **Date:** 2026-09-10. **Prepared by:** SD.

**Status: proposal. This document authorises nothing.** No Calculate RPC, fingerprint builder,
serializer, migration, grant, policy, route, commit, push or deployment exists or may be made under
it. Every claim is a live read of the database or the working tree, or a citation to a repository file
at a named line.

**Scope discipline.** This is a *boundary*, not an audit. It derives only from the four named sources
and states what S7-R must contain, what it must not, and what remains for the Product Owner. Settled
decisions are reused by reference and are **not reopened** — in particular the whole S9-P ruling set
(D-M, D-N Path A, D-O, D-P, D-Q, D-S, D-T, D-U, D-V), which is Product Owner validated and closed.

**Sources.** `data-model-s7-authorization-packet.md` §7, §8, §10 · `data-model-s7-closure-evidence.md`
§1, §2, §9 · `data-model-s9b-authorization-packet.md` **Revision 2** §1, §2, §3, §4 ·
`data-model-s9p-persistence-authorization-packet.md` **Revision 4** §1, §2, §3, §4, §5, §7 · the
S9(b) prerequisite reconciliation (*Calculation Freshness Prerequisites*, 2026-09-09) §1–§4 ·
`data-model-sr-dev-proposal.md` §10.4, §10.5 · `data-model-decisions.md` (canonical, wins on conflict)
· live database, read 2026-09-10.

**Standing protections observed.** Nothing staged, committed or pushed. Both repositories remain on
the local-only branch `data-model/s0-provenance` with no upstream.
`docs/commercial-intelligence-decisions.md` was excluded by name and never opened.
`src/tabs/batch/BatchProfileBar.jsx` was not read, opened, modified, normalised or re-anchored; its
recorded diff shape remains 35 insertions / 16 deletions and its operative hash is carried unchanged.

---

## 1. What S7 required and omitted

### 1.1 The two commitments

The S7 authorisation packet obliges S7 to the calculate path in two separate sections.

> Somewhere to put the result — `batch_calculations` — **Has no write grant and no write policy today**
> — deliberately: §7.5 leaves the calculate path to S7. **S7 must add the calculate RPC and that path
> only**.
>
> — `data-model-s7-authorization-packet.md` §7, dependency table

> **Schema.** S7 is additive: **a calculate RPC**, plus the write grant and policy on
> `batch_calculations` that §7.5 withheld.
>
> — *ibid.* §8

### 1.2 What was actually delivered

| Evidence | Finding |
|---|---|
| S7 packet §10, the approved commit shape | **S7(a)** resolver · **S7(b)** two engine corrections + golden file · **S7(c)** materialisation removal ×5. No calculate commit |
| S7 closure evidence §1, twelve dispositions | Annual interest · override attribution · map retirement · supplier credit · pre-S7 literals · flute profiles · printing vocabulary · location eligibility · Item Status · file preservation · authorisation · closure evidence. **None is the calculate path** |
| S7 closure evidence §2, eight backend migrations | `s7_1` … `s7_6` plus two fixes. None touches `batch_calculations` |
| Live database, 2026-09-10 | `authenticated` on `public.batch_calculations`: `SELECT=true`, `INSERT=false`, `UPDATE=false`, `DELETE=false`. One policy, `batch_calculations_select [r]`. **0 rows.** No `calculate_*`, `fingerprint_*` or `calculation_fingerprint` function in `public` or `app_private` — the only match on either name pattern anywhere is `app_private.__email_fingerprint`, which is unrelated |
| A live, green gate | `FS-14` in `tests.family_f_security()` still asserts `42501` and prints *"batch_calculations has no write grant at all — a caller cannot publish a calculation **(S7 owns that)**"* |

**Classification: omitted S7 scope, not deferral.** This programme records deferrals in writing —
S8's closure has a section headed *"Explicitly deferred to U4"*; S7's own table records Item Status as
*"Not started."* Nothing of that kind exists for the calculate RPC in the packet, the closure
evidence, the amendment, or any commit message. An unrecorded absence is an omission: a deferral
carries a decision and an owner, an omission carries neither.

### 1.3 What was *not* S7's omission, and why the sequence ran through S9-P

The prerequisite reconciliation corrected one attribution and it stands. A writer can only persist
what a column exists to hold, and §4.6 of the canonical proposal specified `batch_rows` **with no
add-on columns** and `batches` **with no Pricing Basis Release and no Pricing Date**. Six §10.4
fingerprint inputs had no durable home; the design had the gap, not the implementation.

S9-P closed it — fifteen columns, `create_batch` amended, `set_batch_pricing_basis` added, all
Product Owner validated. **Every §10.4 input now has a durable source (§3).** S7-R is therefore
implementable for the first time.

### 1.4 The two things S7-R comprises

1. The **canonical calculation-fingerprint builder** — a serializer and a gatherer, per §4.
2. The **Calculate writer** — the RPC that writes `batch_calculations`, per §2.

They ship together because the writer cannot stamp a fingerprint without the builder, and a builder
shipped alone would be testable only against itself. This is the recommendation S9(b) §3.4 and S9-P §5
both made and left for this packet to confirm; **it is confirmed here as the shape, subject to
authorisation**.

---

## 2. The Calculate RPC — contract and authority

### 2.1 Shape

```
public.calculate_batch_row(
    p_batch_row_id           bigint,
    p_expected_content_version integer,
    p_effective_inputs       jsonb,
    p_results                jsonb
) returns bigint
```

Returns `batch_calculations.id`. **One row per call.** `uk_bc_row unique (batch_row_id)` already makes
one calculation per row the database's rule; a batch-wide convenience call would only be a loop with
a worse failure story, since a partial batch calculate has no meaning Send could use.

**Placement follows the established pattern exactly**, and this is not a design choice left open:
`app_private.calculate_batch_row(...)` is `SECURITY DEFINER`, `set search_path = ''`; the `public`
function is a thin `SECURITY INVOKER` shim; EXECUTE is granted to `authenticated` and revoked from
`public, anon`. This is what `create_batch`, `revise_batch_profile` and `set_batch_pricing_basis` all
do, and departing from it was the defect corrected at S9-P/6a.

### 2.2 The write path: RPC-only, no grant, no policy

The S7 packet offered *"the write grant and policy"*. S9(b) §4.4 observed that an RPC-only definer
path with **no grant at all** is more consistent with how every governed write has been built since,
and the S9-P authority correction has now settled that question in the strongest possible terms for
this very family: `public.batches` carries **no** `authenticated` INSERT or UPDATE at table or column
level, no INSERT or UPDATE policy, and every mutation runs through a definer RPC.

**S7-R adds no grant and no policy on `batch_calculations`.** `authenticated` keeps `SELECT` and
`batch_calculations_select`, and gains nothing else. Adding a write grant now would re-open, on a
neighbouring table, exactly the bypass surface the authority correction closed.

> **`FS-14` is replaced, not deleted.** It asserts an absence the writer does not remove — the direct
> write grant stays absent. Its *wording* is what falls due: it credits S7 with owning the path. The
> replacement asserts the same `42501` and states that the only writer is
> `app_private.calculate_batch_row`. A deleted gate would silently stop proving something true.

### 2.3 Authority

`app_private.can_write_batch(p_batch)` — the same gate as every other Batch mutation. Read live, it
admits exactly:

```
lock held by the caller and unreleased
AND (   ( status in ('working','sent')
          AND ( owner OR active collaborator )
          AND has_plant_cap(plant, 'make_quote') )
     OR ( status = 'submitted'
          AND has_plant_cap(plant, 'check_quote') ) )
```

Three consequences, stated rather than assumed:

| Consequence | Detail |
|---|---|
| A **lock is mandatory** | Calculate is a write. A second Maker at the same plant without the lock is refused `42501`, and so is the owner once the lock is released — the CP-41/CP-42 behaviour already proved for `set_batch_pricing_basis` |
| `sent` Batches remain calculable | `can_write_batch` admits `working` **and** `sent`. That is CDM-22's replaceability: a calculation is replaceable until it is frozen by Send into a snapshot, and a `sent` Batch may be re-worked |
| A **Checker on a `submitted` Batch would be admitted** | This is the branch `CP-55` refused to assume. See **D-X** |

**Replaceability.** `insert … on conflict (batch_row_id) do update`. CDM-22 makes `batch_calculations`
explicitly replaceable pre-Send, and `uk_bc_row` makes replacement the only representable second
write. The RPC never deletes.

### 2.4 What the RPC verifies, and the one residual it cannot

This is the load-bearing paragraph of the whole boundary.

The costing engine is JavaScript — `calcCosting` in `src/engine/costing.js`, governed by the
`test:costing` golden gate under §16.2. **There is no engine in the database and S7-R must not build
one**: a second implementation would be a second answer to every price, which is the defect class S7
and S8 were spent removing.

So Calculate is a **validating writer, not a computing writer**. It receives the payload and, before
writing anything:

| Payload region | Verified how | Verifiable? |
|---|---|---|
| `effective_inputs.provenance` (20 keys) | Every key re-derived from durable state and compared — §1.1 of S9(b) Rev 2, whose consistency column is the check list | **Fully** |
| `effective_inputs.resolved` (6 chains) | Every chain re-resolved from durable state and compared, value *and* source. Freight per §6 | **Fully** |
| `effective_inputs.entered` (15 keys) | `add_ons` and `fluting_bcf` from `batch_rows`; `ply`, flutes and the five layer code/GSM pairs from the effective `construction_versions` (C-5); dimensions, `box_type`, `ups` from `sku_versions`; `sales_moq`, `volume` from `batch_rows` | **Fully** |
| `results.engine` (20 scalars), `results.row_details` (5 elements) | **Not recomputable.** Checked for shape, type, finiteness, and three internal-consistency identities: `add_ons` equals the sum of `entered.add_ons`; `fr_rate` equals `resolved.freight.value`; `sum(row_details[].wt)` equals `engine.wt` and `sum(row_details[].cost)` equals `engine.mat` | **Internally only** |

**The residual, named.** The database freezes twenty engine scalars it cannot independently reproduce.
Nothing in S7-R changes that, and it is not a defect this tranche can close — it is the consequence of
one engine, in JavaScript, under a golden gate. What S7-R *does* close is the far larger hole: because
every input is verified against durable state, a payload cannot describe inputs the database does not
hold, and because the fingerprint is stamped from durable state rather than from the payload, the
freshness test is not self-witnessing (the reconciliation's §2 rule).

**`engine_version` is governed, not client-declared.** It is
`calculation_default_versions.engine_version`, reached through the Batch's Pricing Basis Release. The
RPC takes it from there and refuses a payload whose `provenance.engine_version` differs — a client
running a build other than the one the Release names cannot write a calculation.

### 2.5 The expected-version token

`p_expected_content_version` is compared against `batch_rows.content_version` and raises `PT409` on
mismatch, exactly as `set_batch_pricing_basis` does.

**Stated accurately:** this is a caller/API contract, not database-enforced CAS. The primary defence
against a row changing between compute and write is §2.4's validation, which is strictly stronger —
a changed row fails an `entered` or `resolved` comparison. The token exists because it turns that
failure into one unambiguous `PT409` instead of a field-level mismatch the caller must interpret.

---

## 3. The durable source for every fingerprint field

§10.4's list, plus the widening it mandates, plus D-S's five. **Every field now has a durable source**
— the state the reconciliation found missing on six counts is closed.

| Fingerprint key | Durable source | Delivered by |
|---|---|---|
| `row.waste_override_pct` · `row.margin_override_pct` · `row.conv_override_rate` · `row.freight_override` | `batch_rows` | S6 |
| `row.row_type` · `row.pricing_group_id` · `row.sku_version_id` | `batch_rows` | S6 |
| `skuv.length_mm` · `width_mm` · `height_mm` · `box_type` · `ups` | `sku_versions` | S4 |
| `cv.id` · `cv.ply` | effective `construction_versions` — the §1.2 coalesce | S4/S6 |
| `pg.freight_mode` · `freight_basis_delivery_group_id` · `freight_manual_value` · `interest_override_pct` · `payment_terms_days` | `pricing_groups` | S6 |
| `bp.waste_cbb_pct` · `waste_pp_pct` · `conv_box_rate` · `conv_pp_rate` · `margin_box_pct` · `margin_pp_pct` | `batch_profile_versions` where `is_current` | S6-12 |
| `batch.sector_id` | `batches.sector_id` | S6 |
| `pbr.id` · `pbr.pricing_date` | **`batches.pricing_basis_release_id`, `batches.pricing_date`** | **S9-P** |
| `pbr.engine_version` · `pbr.rounding_rule_version` | `calculation_default_versions` reached through the Release | S5, selectable only since S9-P |
| `set.members` | `batch_set_memberships` where `status='active'` | S6-10 |
| `addon.printing` … `addon.unloading` (8) | **`batch_rows.addon_*`**, `numeric(14,4)`, nullable | **S9-P** |
| `row.fluting_bcf` · `eff.fluting_bcf` · `eff.fluting_bcf_source` | **`batch_rows.fluting_bcf`** and **`calculation_default_versions.fluting_bcf_default`** | **S9-P** |
| `pg.basis_ship_to_location_id` · `pg.basis_dg_status` · `eff.freight` · `eff.freight_source` · `eff.freight_entry_id` | §5 | **D-S**, sources S6/S8/S9-P |

**Three fields carry both the input and the resolved output**, and that is deliberate, not
duplication. `row.fluting_bcf` records the authority the Maker exercised; `eff.fluting_bcf` records
the number actually used; `eff.fluting_bcf_source` records which tier won. §10.4 requires the hash to
be fed *the resolver's output provenance* rather than the raw input, and a new approved Calculation
Defaults version moves `eff.fluting_bcf` while the row column does not move at all. The same pattern
governs freight in §5.

**Nothing outside this list is emitted, and nothing in it is omitted.** §10.4's standing rule is that
unlisted fields are calculation-relevant *until classified*; the classification work was done at S9-P
(`fluting_bcf` persisted rather than classified out) and at S9(b) §1.6 (presentation fields assigned
to the presentation fingerprint). The field set is closed and versioned — §4.3.

---

## 4. The canonical serialization and SHA-256 byte contract

Taken verbatim from the prerequisite reconciliation §3, which is the ratified specification. One
shared function guarantees that two callers execute the same code, **not** that the same value
serialises to the same bytes; the contract removes every remaining degree of freedom. Every primitive
below was verified live on this project's PostgreSQL 17.6 and needs no extension.

### 4.1 Algorithm, encoding, determinism

| Element | Rule |
|---|---|
| Hash | `sha256(bytea)` — built in since PostgreSQL 11. No `pgcrypto` dependency |
| Output | `encode(…, 'hex')` — 64 lowercase hex characters; satisfies `ck_bc_fingerprints` |
| Encoding | `convert_to(payload, 'UTF8')` — never the session's client encoding, which could differ between the writer's connection and Send's |
| Input discipline | The serializer takes **only scalars**, never a `jsonb` blob whose key order it cannot control |

### 4.2 Serialized form

```
payload := "qcf/1" || LF || line || LF || line || … || line      (no trailing LF)
line    := key || "=" || encoded_value
LF      := U+000A, always — never CRLF
```

`qcf/1` is the contract version, on its own first line and outside the sorted block. Changing any rule
below changes it to `qcf/2`, so two contract versions can never collide and a fingerprint always
declares which rules produced it.

### 4.3 Order and key names

**Lines are sorted by key ascending, by raw byte value** — `ORDER BY key COLLATE "C"`, never a locale
collation, which orders differently between databases and can change with an ICU upgrade. Sorting by
key rather than by a hand-maintained position means a new field cannot be inserted in the wrong place.

Keys are canonical column names prefixed by origin so two tables' same-named columns cannot collide:
`row.` · `skuv.` · `cv.` · `pg.` · `bp.` · `batch.` · `pbr.` · `set.` · `addon.` · `eff.`. Every key
matches `^[a-z][a-z0-9_.]*$`, so `=` can never appear in a key and the first `=` on a line is always
the separator.

**The field set is closed and versioned.** Adding, removing or renaming a key is a contract-version
change, not an edit — otherwise two builds would compute different hashes from identical data and
every row would read as stale on deploy.

### 4.4 Numeric normalization

`numeric` carries its scale into its text form — `5.000::numeric(7,3)::text` is `'5.000'` while
`5::numeric::text` is `'5'`. Same number, different bytes, different hash.

```
numeric  →  trim_scale(v)::text          strips trailing zeros; scale-independent
integer  →  v::text
boolean  →  't' | 'f'
date     →  to_char(v,'YYYY-MM-DD')      never v::text, which follows DateStyle
```

Verified live: `5.000::numeric(7,3)` → `5`; `0.500` → `0.5`; `123456.7800::numeric(14,4)` →
`123456.78`; `0::numeric` → `0`; `(-0.0)::numeric` → `0`. Negative zero collapses — exactly the kind
of thing that bites once, silently, years later.

### 4.5 Null, strings, collections

```
null            →  the two characters  \N
non-null string →  backslash-escaped:  \ → \\   LF → \n   CR → \r
text            →  normalize(v, NFC), then that escaping
```

Because a literal backslash is doubled, `\N` can only ever mean null. The escaping makes a line
terminator impossible inside a value, so line structure cannot be forged by data.

**Every key is always emitted, null or not.** Omitting null keys would let two different states hash
identically — a row with no margin override and a row whose key was dropped by a bug.

NFC only: **no case folding, no trimming, no collation.** The values entering this fingerprint are
closed vocabularies or version labels, already exact; case-folding would let two genuinely different
values collide, which is more dangerous for a freshness test than an occasional false stale.

| Collection | Rule |
|---|---|
| `set.members` | Active memberships only, **ordered by `row_id` ascending**, rendered `role:row_id`, joined by `,`, the whole list one escaped value on one line. Empty emits `\N`, not `''`. `row_id` is a stable surrogate no user action reorders; ordering by `role` would be unstable because two components can share one |
| `addon.*` | **Not a collection.** Eight separate scalar lines, each always emitted — `0` for a deliberate zero, `\N` for absent, and they are different states (D-M) |

### 4.6 Privilege placement — inherited from S9-P §5, not rediscovered

| Function | Volatility | Security | search_path | Grants |
|---|---|---|---|---|
| `app_private.fingerprint_serialize(...)` | `IMMUTABLE` | `SECURITY INVOKER` | `''` | revoked from `public`, `anon`, `authenticated` |
| `app_private.calculation_fingerprint(p_batch_row_id bigint)` | `STABLE` | `SECURITY DEFINER` | `''` | revoked from `public`, `anon`, `authenticated` |

The serializer touches no table, so it is invoker and immutable. The gatherer reads eight tables
across three families and must be definer, because it answers *"what is this row's fingerprint"* — a
property of the database, not of the caller's visibility. `CP-54` pins both.

**One function, two callers.** The same `calculation_fingerprint` the Calculate writer calls to stamp
`batch_calculations.calculation_fingerprint` is the one S9(b) calls to recompute and compare. Neither
consumer may define its own.

---

## 5. The D-S field extension — approved in full, and why it is load-bearing

**D-S is settled (S9-P §0.1, §4.10) and is not reopened here.** It is restated because these five keys
are S7-R's to build and would otherwise have to be inferred from a table in another packet.

§10.4 names the group's `freight_mode`, `freight_basis_delivery_group_id`, `freight_manual_value` and
the row `freight_override`. **That is not sufficient to determine the resolved master rate.** The
chain in `master` mode is:

```
pricing_groups.freight_basis_delivery_group_id
   → delivery_groups.ship_to_location_id            ← NOT in §10.4
   → freight_entries where freight_set_version_id = <the Release's>
                       and origin_plant_id         = <the Batch's plant>
                       and destination_location_id = <that Ship-to>
   → freight_entries.rate
```

| Key | Source | Null when | Why it must be hashed |
|---|---|---|---|
| `pg.basis_ship_to_location_id` | basis Delivery Group's `ship_to_location_id` | no basis, or basis has no Ship-to | Changing the Ship-to on the *same* Delivery Group changes the resolved Entry and therefore the rate, with `freight_basis_delivery_group_id` unchanged. Verified: **there is no trigger of any kind on `delivery_groups`**, and `delivery_groups_update` admits the change under `can_write_batch` |
| `pg.basis_dg_status` | basis Delivery Group's `status` | no basis | Setting the basis group to `removed` degrades resolution to the tier below — a price change. CDM-23: adding or removing an ordinary Delivery Group is presentation-only *"unless it is/becomes the freight basis"* |
| `eff.freight` | the resolved rate | never — an unresolved chain has no calculation | Hashing the outcome tests the result, not merely the derivation |
| `eff.freight_source` | the winning source | never | §10.4 requires the hash be fed the resolver's output provenance |
| `eff.freight_entry_id` | the resolved `freight_entries.id` | source is not `master` | Removes the freshness test's hidden dependency on `trg_fe_follows_version`, `trg_fsv_transition` and the absence of a DELETE grant — machinery in another family the test neither owns nor sees |

`CP-24` and `CP-25` are the gates: a basis Ship-to change stales; a **basis** group set to `removed`
stales while a **non-basis** group set to `removed` does not — CDM-23 in both directions.

---

## 6. How temporary `legacy_batch` and `legacy_matrix` participate

**D-N Path A and D-Q are settled (S9-P §4) and are not reopened.** What follows is the resolution
behaviour S7-R must implement, because S7-R builds the first database-side freight resolver.

### 6.1 One chain, one winner

```
row override                    'row'             governed     batch_rows.freight_override
  legacy Batch override         'legacy_batch'    TEMPORARY    pricing_groups.legacy_freight_*   ← U4
    Pricing Group  manual       'pricing_group'   governed     terminates
                   ex_factory   'pricing_group'   governed     terminates, value 0
                   master       delegates downward via its governed BASIS
      approved Freight Master   'master'          governed     freight_entries
        legacy plant×dest matrix 'legacy_matrix'  TEMPORARY    pricing_groups.legacy_freight_*   ← U3
          unresolved                                           blocks
```

The two temporary tiers read from **one** stored pair —
`pricing_groups.legacy_freight_value` / `legacy_freight_source` — whose closed list is exactly
`legacy_batch | legacy_matrix` (`ck_pg_legacy_freight_source`), paired biconditionally
(`ck_pg_legacy_freight_paired`) and non-negative. A group stores one or the other, never both.

### 6.2 What position means

| Stored source | Position | Consequence for the resolver |
|---|---|---|
| `legacy_batch` | **above** the Pricing Group tier | Wins over `manual`, `ex_factory` and `master`. Storing it beside a governed mode statement would make that statement ineffective, which is why `ck_pg_legacy_batch_not_with_governed_mode` bars it from `manual` and `ex_factory` — and only those two. `master` is deliberately excluded: there the Maker stated a *delegation*, not a value |
| `legacy_matrix` | **below** the approved master | A **lower-priority fallback**. When an upper tier resolves it is simply not selected. That is the chain working, not a contradiction, and it needs no guard — the reason `guard_pg_temporary_freight` was withdrawn |

### 6.3 What S7-R must therefore prove

`CP-65` and `CP-66` are the pair that replaces the withdrawn trigger, and they are S7-R's because the
resolver is S7-R's:

- **`CP-65`** — with `freight_mode = 'master'`, an active basis carrying a Ship-to, a matching Freight
  Entry **and** a stored `legacy_matrix` pair, the resolver returns `master` with both references
  non-null. The stored pair is not selected and is not an error.
- **`CP-66`** — four arms, each a different reason the master fails to resolve: no basis; basis
  `removed`; basis without Ship-to; no matching Freight Entry. In every arm the resolver returns
  `legacy_matrix`, `authority = 'temporary'`, both references null.

### 6.4 Provenance is decided by the resolver, frozen from the winner

`resolved.freight.source` is **the winning source, which need not equal `legacy_freight_source`.** A
group storing a `legacy_matrix` fallback whose approved master resolves produces a winner of `master`,
and the payload must say `master`. This is what Calculate validates against, and it is the same rule
S9(b) applies at Send (`CP-72`). `degraded_from` — `no_pricing_group · basis_missing ·
basis_ship_to_missing · no_approved_pair` — is recorded and never acted on; it is how an issued Quote
can later explain why it did not reach the governed master.

**Warn-and-permit is preserved unchanged.** A calculation may rest on temporary freight; it may never
*describe* that freight as approved Freight Master authority. The binding is structural:
`ck_cs_freight_authority_binds_source` and `ck_cs_freight_refs_master_only` at the snapshot, and the
same shape validated in the payload at Calculate.

---

## 7. What Calculate must refuse

Every check runs **before** the single write. A refusal has nothing to undo.

### 7.1 Authority and concurrency

| # | Condition | Raise |
|---|---|---|
| A-1 | `can_write_batch(batch)` false — no lock, released lock, foreign lock, wrong capability, wrong status | `42501` |
| A-2 | `p_expected_content_version` ≠ `batch_rows.content_version` | `PT409` |
| A-3 | The row is not `status = 'active'` | `PT422 / row_inactive` |

### 7.2 Payload contract — the §1 contract of S9(b) Rev 2, enforced at the writer

The v1 contract is **ratified once and enforced at both ends.** Calculate validates it on the way in;
Send validates it again on the way out. That is not redundancy: the payload is immutable once frozen,
and a contract enforced only at Send would let a malformed row sit in `batch_calculations` until the
moment it mattered most.

| # | Condition | Raise |
|---|---|---|
| C-1 | `contract_version` absent, non-integer, or ≠ 1 | `PT422 / payload_contract` |
| C-2 | An **unknown key at any depth** of `effective_inputs` or `results` | `PT422 / payload_contract` |
| C-3 | A documented key absent, or present as JSON `null` where non-null is required | `PT422 / payload_contract` |
| C-4 | A number arriving as a string; a non-finite or NaN value | `PT422 / payload_contract` |
| C-5 | `results.row_details` not an array of exactly 5, in positional order TOP · F1 · L1 · F2 · L2, each of the 4-key absent shape or the 8-key present shape | `PT422 / payload_contract` |
| C-6 | An internal-consistency identity of §2.4 fails | `PT422 / payload_contract` |

C-2 is canonical rather than fastidious: §10.4 treats unlisted fields as calculation-relevant until
classified and instructs the design to *fail toward over-staling*. An unrecognised key may carry a
number that moved the price.

### 7.3 Disagreement with durable state

| # | Condition | Raise |
|---|---|---|
| V-1 | Any `provenance` key disagrees with the value re-derived from durable state | `PT422 / provenance_mismatch` |
| V-2 | Any `entered` key disagrees with `batch_rows`, `sku_versions` or the effective `construction_versions` | `PT422 / entered_mismatch` |
| V-3 | Any `resolved` chain's value **or source** disagrees with the chain re-resolved from durable state | `PT422 / resolution_mismatch` |
| V-4 | `resolved.freight` disagrees with the database-resolved **winner** in value, source, authority or either reference | `PT422 / freight_resolution_mismatch` |
| V-5 | `provenance.engine_version` ≠ the Release's `calculation_default_versions.engine_version` | `PT422 / engine_version_mismatch` |

### 7.4 States that make a calculation meaningless

| # | Condition | Raise |
|---|---|---|
| S-1 | The Batch has no `pricing_basis_release_id` — legal on a working Batch, fatal to a calculation, since every master rate and versioned fallback is reached through it | `PT422 / pricing_basis_absent` |
| S-2 | The Release is not `approved`, is not this plant's, or does not cover `batches.pricing_date` | `PT422 / pricing_basis_invalid` |
| S-3 | The freight chain resolves to **unresolved** — CDM-17 requires block, not zero | `PT422 / freight_unresolved` |
| S-4 | `length_mm` or `width_mm` absent on the effective `sku_versions` row; or `height_mm` absent where `box_type` is not `Board` or `PP` | `PT422 / dimensions_incomplete` |
| S-5 | The five Construction consistency checks C-1 … C-5 fail — including C-2, a `row_proposed` reference whose parent Construction has since been published, which **no trigger re-fires to catch** | `PT422 / construction_reference_invalid` |

### 7.5 What Calculate does **not** refuse

Stated so the boundary between the two tranches is not blurred by omission:

- **An unapproved SKU version, a `proposed` SKU, an inactive Pricing Group, a Pricing Group with no
  active Delivery Group, an invalid freight basis, a Batch with no active rows, a mixed Pricing Basis
  Release across rows, an existing Quote family.** All are S9(b) completeness rules (R-1…R-6,
  P-1…P-5, §2.3). A Maker must be able to cost a row while the master data around it is still being
  assembled; freezing it immutably is the act that requires completeness.
- **A stale calculation.** Calculate *creates* freshness; it cannot be stale at the moment it is
  written. Staleness is Send's test.

### 7.6 The commercial cases that genuinely require Product Owner disposition

Three of the refusal questions above are not technical, and one of them changes what Calculate does
rather than only what Send does. They are carried into §11 rather than answered here: **D-F**
(`spec_bs` / `spec_bct` / `spec_ect` in `entered`), **D-G** (`discontinued` SKU), and **D-W** (a
retired Ship-to Location).

---

## 8. What is written, atomically

### 8.1 `batch_calculations` — the eleven columns, all in one statement

| Column | Value | Note |
|---|---|---|
| `batch_row_id`, `batch_id` | the row and its Batch | `fk_bc_row` is the composite `(batch_row_id, batch_id) → batch_rows(id, batch_id)`, so a calculation naming another Batch's row is **unrepresentable**, not merely refused |
| `calculation_fingerprint` | `app_private.calculation_fingerprint(row)` — **computed from durable state, never from the payload** | The reconciliation's §2 rule. A payload cannot witness itself |
| `presentation_fingerprint` | **See D-Y.** `ck_bc_fingerprints` requires it non-empty | The one column S7-R cannot fill without a ruling |
| `engine_version` | the Release's `calculation_default_versions.engine_version` | Governed, not client-declared — §2.4. `ck_bc_engine_version` requires trimmed non-empty |
| `schema_version` | literal `1` | **Versions the calculation payload.** `ck_bc_schema_version` requires ≥ 1 |
| `effective_inputs`, `results` | the validated payload, whole | Written only after every check of §7 passes |
| `computed_by` | `app_private.current_app_user()` — **always non-null** | §8.3 |
| `computed_at` | left to its `now()` default | The moment the number was computed |

### 8.2 Schema-version separation — two counters, never copied

| Column | Versions | Set by |
|---|---|---|
| `batch_calculations.schema_version` | the **calculation payload** shape — the v1 contract | Calculate, S7-R |
| `calculation_snapshots.schema_version` | the **snapshot** shape | Send, S9(b) |

Different lifecycles. Neither is ever copied into the other. A payload stamped `2` must be refused by
a v1 reader — not upgraded, not ignored, not partially read.

### 8.3 `computed_by` nullable, `calculated_by` NOT NULL — resolved at the writer

`batch_calculations.computed_by` is **nullable** (`fk_bc_computed_by → app_users(id) on delete
restrict`). `calculation_snapshots.calculated_by` is **NOT NULL**. S9(b) §1.9 handles the mismatch by
refusing the Send when `computed_by` is null, rather than reaching a constraint violation.

**S7-R closes it at the source.** Calculate always writes `computed_by = current_app_user()`; the RPC
is `authenticated`-only and `can_write_batch` has already established an app user, so a null is not
reachable through the governed path. The column stays nullable — the two fixture rows in its history
were written privileged, and narrowing the column would be a schema change this tranche has no
mandate for.

> **S9(b)'s null-`computed_by` refusal is retained, and becomes unreachable rather than unnecessary.**
> A gate that only fires against a privileged write is still the gate that stops a fixture-shaped row
> reaching immutable evidence. Removing it because the governed path can no longer produce the state
> would be trusting the path instead of proving it.

Likewise `calculation_snapshots.calculated_at` takes `batch_calculations.computed_at` — **not**
`now()`. The snapshot records when the number was computed, not when it was frozen.

### 8.4 Atomicity

One RPC call is one transaction. Every validation of §7 runs before the single
`insert … on conflict … do update`, so a refusal has written nothing; and a failure raised after the
write still rolls the whole call back. The gates measure this rather than assert it — §9.

---

## 9. Focused gates

Grouped by what they defend. The inherited numbering from S9-P §7.2 is kept so the two packets can be
read together.

### 9.1 Determinism and the byte contract

| Gate | Requirement |
|---|---|
| `CP-50` | **Golden vector.** A fixed input row serialises to a byte-exact expected payload and hashes to a hard-coded hex digest |
| `CP-51` | **Numeric normalization.** `5`, `5.0`, `5.000` in a `numeric(14,4)` column produce one digest; `-0.0` and `0` likewise |
| `CP-52` | **Null is not empty.** A null add-on and one set to `0` differ; a null text field and an empty string differ |
| `CP-53` | **Writer/reader equality.** The value Calculate stamps equals `calculation_fingerprint(row)` recomputed immediately after, over an unchanged row |
| `CP-2` ×8 | For each add-on, the serialized line is `\N` for null and `0` for zero, and the two payloads hash differently |

### 9.2 Completeness of the field set — every field must move the hash

| Gate | Requirement |
|---|---|
| `CP-10`…`CP-17` | Each of the eight add-ons, `null → 0` **and** `0 → 1.5`, changes the fingerprint on **both** transitions (D-M) |
| `CP-18` | `batch_rows.fluting_bcf` changes the fingerprint |
| `CP-19` | A new approved `calculation_default_versions` with a different `fluting_bcf_default` changes the fingerprint for an **inheriting** row and **not** for an overriding one |
| `CP-20` | `batches.pricing_date` changes the fingerprint for **every** row in the Batch |
| `CP-21` | `batches.pricing_basis_release_id` changes the fingerprint for **every** row in the Batch |
| `CP-22` · `CP-23` | `legacy_freight_value` and `legacy_freight_source` change the fingerprint for every row in **that Pricing Group only** |
| `CP-24` | A basis **Ship-to** change stales every row in that Pricing Group, with `freight_basis_delivery_group_id` unchanged |
| `CP-25` | The **basis** group set to `removed` stales; a **non-basis** group set to `removed` does not — CDM-23, both directions |

> **A no-filtering gate belongs here too.** The field-set closure must be asserted structurally, not
> by counting: a gate enumerates the emitted keys of a known row and compares against the closed list,
> so a field silently dropped from the serializer fails immediately rather than re-staling every row
> in the database on the next deploy.

### 9.3 Freight resolution

| Gate | Requirement |
|---|---|
| `CP-65` | A resolved approved master beats a stored `legacy_matrix`; both references non-null; the stored pair is not selected and is not an error |
| `CP-66` | A stored `legacy_matrix` is used **only** when the master does not resolve — four arms: no basis; basis `removed`; basis without Ship-to; no matching Freight Entry. Each returns `legacy_matrix`, `temporary`, both references null |

### 9.4 Security and privilege

| Gate | Requirement |
|---|---|
| `CP-54` | `fingerprint_serialize` has `prosecdef = false`; `calculation_fingerprint` has `prosecdef = true`; both pin `search_path` to `''`; both revoked from `public`, `anon`, `authenticated` |
| **`FS-14′`** | **Replaces `FS-14`.** `batch_calculations` still has no direct write grant for `authenticated` at table **or column** level, no INSERT or UPDATE policy, and the only writer is `app_private.calculate_batch_row` |
| new | `public.calculate_batch_row` is `SECURITY INVOKER`; `app_private.calculate_batch_row` is `SECURITY DEFINER` with `search_path = ''`; EXECUTE granted to `authenticated`, revoked from `public, anon` — the `s9p_6a` lesson pinned |
| new | No lock, released lock, foreign lock, missing `make_quote` — each refused `42501`, and the row is unchanged in each case |

### 9.5 Concurrency

| Gate | Requirement |
|---|---|
| new | A stale `p_expected_content_version` raises `PT409` and **nothing moves** — no `batch_calculations` row written, no `content_version` advanced |
| new | A second call for the same row **replaces** rather than duplicating; `uk_bc_row` still holds; the replaced row's `computed_at` advances |
| **caller-path equality** | Deferred from S9-P `CP-55` and answerable only once **D-X** is ruled. If two differently-authorised personas may both Calculate, both must produce the identical fingerprint over an unchanged row |

### 9.6 Atomicity and no-filtering

| Gate | Requirement |
|---|---|
| new | Every refusal class of §7 asserts four unchanged quantities: `count(batch_calculations)`, the row's `content_version`, the target row's existing calculation (fingerprint and `computed_at`), and `count(calculation_snapshots)`. A count is evidence; *"the transaction rolled back"* is a claim |
| new | The gatherer reaches its inputs by **outer** join. A row whose Pricing Group, Batch Profile version or SET membership is absent must yield `\N` for those keys, never disappear from the result set — an inner join is a filter, and a fingerprint that silently omits a field would compare equal to one that never had it |

---

## 10. The boundary between S7-R and S9(b)

### 10.1 S7-R contains

- `app_private.fingerprint_serialize` and `app_private.calculation_fingerprint`, per §4.
- `app_private.calculate_batch_row` and its `public` shim, per §2.
- The database-side **freight resolver** the Calculate writer needs, per §6 — the first one to exist.
- The gates of §9, and the `FS-14` replacement.
- No grant and no policy on `batch_calculations`.

### 10.2 S7-R does **not** contain

| Excluded | Owner |
|---|---|
| **Any Send operation.** No `send_batch`, no `quote_families` / `quote_revisions` / `quote_items` / `calculation_snapshots` write, no `batches.status` transition of any kind | S9(b) |
| The completeness rules R-1…R-6 and P-1…P-5, and the `quote_family_exists` refusal | S9(b) |
| The staleness comparison itself — S7-R builds the fingerprint; **Send** compares stored against current | S9(b) |
| The **presentation** fingerprint builder, the three divergence states (`fresh`, `needs_send_only`, `calculation_stale`), live divergence presentation, CDM-23 / DM-6 smallest-affected-unit propagation | U4 — subject to **D-Y** |
| Any HTTP route, and any frontend change. There is still no route and no user interface for Batch or Quote anywhere in either repository | later |
| Retirement of `legacy_batch` (U4) or `legacy_matrix` (U3), and any clearing of the temporary pair | U3 / U4 |
| Any engine change, golden-file change, or second engine implementation | §16.2 governs the engine; S7-R adds none |

### 10.3 The seam, stated once

**S7-R makes a calculation exist and be trustworthy. S9(b) makes it permanent.**

```
S7-R   Calculate ──► batch_calculations           replaceable, per CDM-22
                     + calculation_fingerprint    stamped from durable state
                          │
                          │  Send recomputes the SAME function and compares
                          ▼
S9(b)  Send ─────► calculation_snapshots          immutable
                   quote_families / revisions / items
                   batches.status → sent
```

Neither tranche may define the fingerprint function twice, and neither may relax the v1 payload
contract. S9(b) declares a hard dependency on S7-R and consumes the builder **read-only**.

### 10.4 What remains outstanding regardless

Even after S7-R lands there is **no HTTP route and no user interface**, so a governed
`authenticated` caller still cannot reach Calculate outside a test harness. Fixture-populatable is not
legitimately exercisable. Browser verification and Product Owner validation therefore remain
outstanding for S7-R as they do for S9(b), and neither can be claimed on automated evidence alone.

---

## 11. Decisions required before S7-R can be authorised

Five. Three were explicitly handed to this packet by name; two are carried from S9(b) Revision 2 and
fall due here because **Calculate writes `entered`**, so they can no longer wait for Send.

**Reused without reopening:** D-M, D-N Path A, D-O, D-P, D-Q, D-S, D-T, D-U, D-V (S9-P, validated);
the annual-interest basis and supplier-credit separation (S7 decisions 1 and 4); the S9(b) Revision 2
payload contract, §1.0 unknown-key rejection, §1.2 effective Construction definition, and §1.5 freight
reference shape.

| # | Decision | Why it cannot be taken by SD | Recommendation |
|---|---|---|---|
| **D-Y** | **The presentation fingerprint.** `ck_bc_fingerprints` requires `presentation_fingerprint` non-empty on **every** `batch_calculations` row, and `calculation_snapshots.presentation_fingerprint` is NOT NULL — so whatever Calculate stamps is carried verbatim into immutable evidence at Send. The builder is U4 scope. Options: **(a)** build a `qpf/1` presentation serializer in S7-R under the same byte contract, over §10.4's presentation list; **(b)** stamp a versioned sentinel; **(c)** relax the constraint | Option (b) freezes a meaningless value into permanent records, which is the one class of error that can only be superseded, never corrected. Option (a) enlarges S7-R. Option (c) changes a shipped constraint. All three are scope or evidence decisions | **(a)**, narrowly: the presentation *serializer* only, with no divergence classifier and no UI — those stay at U4. It is the only option that does not write something untrue into an immutable record |
| **D-X** | **May a Checker invoke Calculate?** `can_write_batch` admits a `check_quote` holder on a `submitted` Batch. `CP-55` refused to assume it and deferred the question here by name. Answering it also decides whether the caller-path equality gate of §9.5 can be written at all | Whether a Checker re-prices during check, or only reads and returns the Batch, is a workflow rule about who may move a number | **Permit**, and gate it: the fingerprint must be identical whichever persona computes it, which is exactly what the deferred equality gate would prove |
| **D-W** | **May a Quote price against a retired Ship-to Location?** Flagged for this packet by S9-P §4.10. `customer_locations` has `retire_customer_location`; a retired Ship-to leaves the Freight Entry — keyed by location id — intact and resolvable, so **the rate does not move**. The question is whether it should | Commercial. The database can price it; whether the business should quote a destination it has retired is not a technical fact | Flagged without recommendation. If refused, it belongs in §7.4 as a Calculate refusal, not only at Send |
| **D-F** *(carried from S9(b) §1.6)* | **`spec_bs`, `spec_bct`, `spec_ect` in `entered`.** They are **not consumed by `calcCosting`**, so by the contract's own rule they do not belong. But `checkSpecCompliance` compares them against the computed `calc_bs` to decide whether a row is `spec-gap`, and a Quote issued claiming compliance arguably has to freeze what it claimed against | Falls due at S7-R rather than S9(b) because Calculate is what writes `entered`. Including them widens "what the engine consumes"; excluding them means an issued Quote cannot evidence its own compliance claim | Flagged. Note that S9-P persisted `fluting_bcf` for exactly this reason — `calc_bs` must be reproducible — which is an argument for inclusion |
| **D-G** *(carried from S9(b) §2.5)* | **A `discontinued` SKU.** R-3 refuses `proposed`, uncontroversially. `discontinued` is not obviously wrong to quote — a re-order or a final run is a real commercial case, and `skus.replacement_sku_id` exists to point at the successor. Options: refuse, permit, or permit with the status frozen into `provenance` as evidence | Commercial. Refusing blocks a legitimate Quote; permitting silently prices a discontinued item with no signal | Flagged. If ruled *permit with evidence*, `provenance` gains one key and the contract version stays at 1 only if this is settled **before** the first Send — after that it is `qcf/2` and a new `contract_version` |

**Consequential note on D-Y and D-F.** Both change the byte contract if ruled after implementation.
`qcf/1` is closed and versioned precisely so that cannot happen silently — but a contract-version bump
re-stales every row in the database. **Ruling both before S7-R begins costs nothing; ruling either
afterwards costs a full re-calculation of every open Batch.**

---

**Nothing in this boundary is implemented.** It is submitted for Product Owner review. S7-R begins
only on explicit authorisation of a boundary, and S9(b) is not revised until this one is ruled.
