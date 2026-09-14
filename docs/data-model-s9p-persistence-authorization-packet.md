# S9-P — persistence prerequisite: authorisation packet for Product Owner review

**Revision 4.** **Date:** 2026-09-09. **Prepared by:** SR DEV.

**Status: proposal. This document authorises nothing.** No column, constraint, RPC, migration, grant
or policy exists or may be created under it. Every type and behaviour below is proposed. S9(b) remains
held at its own Revision 2 and is not revised under this packet.

**S9-P builds no functions at all.** No fingerprint serializer, no gatherer, and — as of this revision
— no guard trigger. S9-P delivers durable columns, the constraints that keep them coherent, two narrow
RPC changes, and the tests that can be closed without a hash and without a resolver. §7 assigns every
remaining gate to the tranche that can actually run it.

**Sources:** `data-model-decisions.md` (canonical, wins on conflict) · `data-model-design-for-approval.md`
DM-5, DM-6 · `data-model-sr-dev-proposal.md` §3.2, §3.3, §4.6, §10.4, §12.4 ·
`data-model-s7-authorization-packet.md` §7, §8 · `data-model-s8-closure-evidence.md` §2, §5.2, §7 ·
live database reads on PostgreSQL 17.6 · `engine/costing.js` · `engine/resolveAuthority.js`.

**Standing protections observed.** Nothing staged, committed or pushed. Both repositories remain on
the local-only branch `data-model/s0-provenance` with no upstream.
`docs/commercial-intelligence-decisions.md` was excluded from every search by name and never opened.
The preserved hunk in `src/tabs/batch/BatchProfileBar.jsx` is intact and unstaged — lines 218–225,
`sha256 8ad1c24106bc94fffbc25426c88d010de2877a5d69fdc5062fa962e3a46e0f3b`.

---

## 0. Rulings recorded, and what changed

### 0.1 Product Owner rulings, settled and not reopened

| Ruling | Effect |
|---|---|
| **D-M approved** | Null and explicit-zero add-ons remain distinct in storage and in the hash, and **both transitions stale the row** — §1.2, §1.5 |
| **D-N — Path A selected** | Temporary freight is narrowly persisted until U3/U4 retire the temporary working-state tiers — §4 |
| **D-O approved** | `app_private.create_batch` is amended **only** for Pricing Date and default-Release initialisation — §3.8 |
| **D-P approved** | S9-P stays a distinct prerequisite tranche. **S6 is not reopened and U4 is not enlarged** — §6 |
| **D-S approved in full** | The future S7-R fingerprint includes **all five** governed-master freight fields: `pg.basis_ship_to_location_id`, `pg.basis_dg_status`, `eff.freight`, `eff.freight_source`, `eff.freight_entry_id` — §4.10 |
| **D-R withdrawn** | With `CP-55c`, at Revision 3 |

### 0.2 Corrections in this revision

| # | Correction | Where | Effect |
|---|---|---|---|
| 1 | D-S recorded as approved in full | §0.1, §4.10 | All five fields are now settled requirements of the S7-R field list, not a recommendation |
| 2 | **The guard trigger is removed** | §4.6 | **Design defect corrected.** `app_private.guard_pg_temporary_freight`, its trigger, and every claim that S9-P prevents a dormant `legacy_matrix` are withdrawn — the mechanism could not enforce the invariant it claimed |
| 3 | `legacy_matrix` reframed | §4.4, §4.6 | It is a **lower-priority fallback**, not a competing active authority. The resolver selects one winner; a stored matrix value below a resolving master is simply not selected |
| 4 | The mode constraint narrowed | §4.6 | Only `legacy_batch` is barred from `manual` and `ex_factory`. `legacy_matrix` may remain stored in any mode |
| 5 | Clearing obligation restated | §4.7 | Both temporary fields are cleared when **U4 restates `legacy_batch`**. Nothing requires clearing `legacy_matrix` merely because an upper tier currently resolves |
| 6 | Send validation rewritten | §4.8 | Send compares the payload against the **winning database-resolved** freight value, source and provenance. The winning source need not equal a stored temporary source |
| 7 | Gates rewritten and reassigned | §7 | `CP-65`, `CP-66`, `CP-67`, `CP-71` removed or rewritten. Five new obligations added. Gate ownership is now a **three-way** split |
| 8 | Counts corrected | §0.3, §6 | 15 columns, 2 RPC changes, constraints and persistence tests. **Zero fingerprint functions, zero guard-trigger functions** |

### 0.3 The tranche, counted

| Count | What | Where |
|---:|---|---|
| 8 | Add-on charge columns on `batch_rows` | §1 |
| 1 | `batch_rows.fluting_bcf` — row tier | §2 |
| 1 | `calculation_default_versions.fluting_bcf_default` — versioned system tier | §2 |
| 3 | `batches.pricing_date`, `pricing_basis_release_id`, `pricing_basis_is_deliberate` | §3 |
| 2 | `pricing_groups.legacy_freight_value`, `legacy_freight_source` | §4 |
| **15** | **columns** | |
| 2 | RPC changes — `create_batch` amended, `set_batch_pricing_basis` added | §3 |
| — | constraints and persistence tests | §1.3, §2.2, §3.1, §4.3, §4.6, §7.1 |
| **0** | **fingerprint functions** — both belong to S7-R | §5 |
| **0** | **guard-trigger functions** — withdrawn this revision | §4.6 |

---

## 1. Eight add-on charges

The engine sums eight named charges into `addOns` and carries the total into
`sub = mat + conv + addOns`, on which interest is then charged (`engine/costing.js:101-102`). They are
price-bearing in the most direct sense available, and no column anywhere in `public` holds any of them.

### 1.1 The columns

Eight `numeric(14,4)` columns on `batch_rows`, all nullable. §3.3 of the canonical proposal sets
*"money and computed values `numeric(14,4)`"*, and §3.2's bounds table already lists
*"Add-ons (₹/box) · Σ of 8 inputs · ~200 · `numeric(14,4)`"*.

| Column | Type | Null | Engine key | Future fingerprint key |
|---|---|---|---|---|
| `addon_printing` | numeric(14,4) | nullable | `printing` | `addon.printing` |
| `addon_stitching` | numeric(14,4) | nullable | `stitching` | `addon.stitching` |
| `addon_coating` | numeric(14,4) | nullable | `coating` | `addon.coating` |
| `addon_handling` | numeric(14,4) | nullable | `handling` | `addon.handling` |
| `addon_moq_charge` | numeric(14,4) | nullable | `moqCharge` | `addon.moq_charge` |
| `addon_packing` | numeric(14,4) | nullable | `packing` | `addon.packing` |
| `addon_other` | numeric(14,4) | nullable | `other` | `addon.other` |
| `addon_unloading` | numeric(14,4) | nullable | `unloading` | `addon.unloading` |

The right-hand column is **stated, not delivered**. No serializer exists in S9-P to emit those keys —
see §5.

### 1.2 Null versus explicit zero — D-M approved

The engine reads each charge as `(+printing || 0)`, so **null and 0 contribute the same nothing to the
price**. They are not the same commercial fact. `null` means the Maker never entered a charge for this
row; `0` means the Maker deliberately entered zero — coating quoted free, handling absorbed, an MOQ
charge waived. On an immutable Quote that is the difference between an omission and a concession, and
only one of them is defensible to a customer later.

There is **no inheritance chain** for add-ons — no Batch tier, no Sector tier, no system fallback — so
`null` here means *absent*, not *inherit*, unlike every other nullable commercial column in this
model. That asymmetry is stated once here rather than discovered later.

### 1.3 Constraints

```sql
alter table public.batch_rows add constraint ck_row_addons_non_negative check (
      (addon_printing   is null or addon_printing   >= 0)
  and (addon_stitching  is null or addon_stitching  >= 0)
  and (addon_coating    is null or addon_coating    >= 0)
  and (addon_handling   is null or addon_handling   >= 0)
  and (addon_moq_charge is null or addon_moq_charge >= 0)
  and (addon_packing    is null or addon_packing    >= 0)
  and (addon_other      is null or addon_other      >= 0)
  and (addon_unloading  is null or addon_unloading  >= 0) );
```

One constraint, not eight, mirroring the existing `ck_row_overrides_non_negative` exactly.

**No upper bound is proposed.** §3.2 computes the realistic maximum of the sum at ~200 against a type
ceiling of 1.8×10⁷, so the type is already the bound and an invented ceiling would be an unapproved
commercial limit.

### 1.4 Governed mutation path, and the CAS contract stated accurately

**No new grant, no new policy, no new RPC.** The add-ons ride the write governance `batch_rows`
already has: `authenticated` holds `INSERT` and `UPDATE`, and `batch_rows_update` admits the write
under `can_write_batch(batch_id)` — requiring the caller to hold the unreleased edit lock, be owner or
active collaborator, hold `make_quote` at the plant, and find the Batch in `working` or `sent`.

**The concurrency contract has two distinct halves, and only one is enforced by the database.**

| Half | Mechanism | Enforced by |
|---|---|---|
| The version cannot be set by a caller, and always advances on update | `trg_row_content_version` → `app_private.guard_content_version()`, which raises `23514` if `new.content_version is distinct from old.content_version`, then assigns `old.content_version + 1` | **The database.** A trigger; unavoidable on any UPDATE path |
| The write applies only to the version the caller read | The caller adds `and content_version = :expected` to the `WHERE` clause | **The caller / API mutation contract.** Not database-enforced |

```sql
update public.batch_rows
   set addon_coating = 1.5
 where id = :row
   and content_version = :expected   -- caller-supplied filter, not a database rule
returning id;
```

A caller that omits the filter performs a **last-write-wins** update the database will accept. The
trigger still increments the version and still refuses a caller-assigned value, but nothing detects
the lost update. This is the established behaviour of every row edit in this model and needs no change
here — but calling it "database-enforced CAS" would imply a protection that does not exist.

### 1.5 Expected fingerprint participation — stated, not closed

All eight will participate as eight separate scalar lines, each emitted whether null or not, so a
`null → 0` edit produces a different hash and stales the row. That is D-M, and it is the correct
default under §10.4's *fail toward over-staling* instruction.

**S9-P cannot prove any of it.** The gates that would — `CP-2` and `CP-10`…`CP-17` — are inherited by
S7-R (§7.2). What S9-P proves is that the two states are *storable and distinguishable in the row*
(`CP-1`), which is the precondition for the hash ever being able to tell them apart.

---

## 2. Fluting BCF, durably

`calc_bs` is frozen into `results.engine.calc_bs`, and `checkSpecCompliance` compares it against the
row's declared bursting strength (`engine/costing.js:254-255`) to decide whether a row is `spec-gap`.
A quoted item claiming to meet a BS specification is making a commitment, and the factor that produced
that claim has to be reproducible.

### 2.1 Two columns, two tiers

The engine currently hard-codes the fallback: `flBCF = … ? +flutingBCF : 0.10`
(`engine/costing.js:112`). A bare literal governing a frozen result is precisely what S7 spent itself
removing — A-17 put the Payment-Terms map and the 0.5 % interest fallback onto
`calculation_default_versions` for this reason.

| Tier | Column | Type | Null | Meaning |
|---|---|---|---|---|
| **Row** | `batch_rows.fluting_bcf` | numeric(8,4) | nullable | `null` = **inherit**. A value is a deliberate row-level override, including `0` |
| **Versioned system** | `calculation_default_versions.fluting_bcf_default` | numeric(8,4) | **NOT NULL** | The governed fallback. Seeded at `0.1000` so establishing it moves no number — the A-21 discipline |

`numeric(8,4)` matches `rounding_step`, the only other dimensionless engine constant in §3.3's type
vocabulary.

### 2.2 Permitted range

```sql
alter table public.batch_rows add constraint ck_row_fluting_bcf_range
  check ( fluting_bcf is null or (fluting_bcf >= 0 and fluting_bcf <= 0.30) );

alter table public.calculation_default_versions add constraint ck_cdv_fluting_bcf_range
  check ( fluting_bcf_default >= 0 and fluting_bcf_default <= 0.30 );
```

0 … 0.30 inclusive, matching the slider bound documented at the engine's own call site. **Zero is
permitted and meaningful** — a take-up factor of zero says the flute contributes no bursting strength.
Unlike §1.2's presence question, the `null`-versus-`0` distinction here is a genuine inheritance
question.

### 2.3 Governed mutation path and CAS

The row tier rides `batch_rows` exactly as §1.4 describes. The versioned tier does not:
`calculation_default_versions` is a governed master under the Family D/E regime, so a new fallback is a
**new version**, proposed and approved through the commercial-master path, never an update to an
approved row. That is CDM-31's immutable-published-history rule, and it is what keeps an old snapshot
reproducible.

### 2.4 Expected fingerprint participation — stated, not closed

| Key | Value | Why |
|---|---|---|
| `row.fluting_bcf` | the row column, `\N` when inheriting | Records the authority the Maker exercised, not merely the number that resulted |
| `eff.fluting_bcf` | the resolved value actually used | A new Calculation Defaults version changes this while the row column is unchanged |
| `eff.fluting_bcf_source` | `row` or `system` | The provenance §10.4 requires the hash to be fed, rather than the raw input |

`CP-19` — inherited by S7-R — is the gate that catches an omitted `eff.fluting_bcf`, because it asserts
a change for an inheriting row and no change for an overriding one.

---

## 3. Pricing date and pricing basis

### 3.1 Three columns on `batches`

| Column | Type | Null | Meaning |
|---|---|---|---|
| `pricing_date` | date | **NOT NULL** | The date the commercial basis is read as at. Defaulted at Batch creation — §3.2 |
| `pricing_basis_release_id` | bigint | **nullable** | The approved Release governing every row. Null is legal on a working Batch and refused at Send — §3.5 |
| `pricing_basis_is_deliberate` | boolean | NOT NULL, default `false` | `false` = the automatic default was taken; `true` = an approved alternative was deliberately selected — §3.4 |

A Pricing Date always exists — there is always a today. A Release may genuinely not exist for that
date, and blocking Batch creation on a master-data gap would stop unrelated work.

| Constraint | Definition |
|---|---|
| `fk_batch_pricing_basis` | `(pricing_basis_release_id, plant_id) → pricing_basis_releases(id, plant_id) on delete restrict` — **composite**, so a Release from another plant is unrepresentable rather than merely refused. Requires adding `uk_pbr_id_plant (id, plant_id)` |
| `ck_batch_deliberate_needs_release` | `not pricing_basis_is_deliberate or pricing_basis_release_id is not null` |

### 3.2 Default Pricing Date

```
pricing_date := ( now() at time zone plants.timezone )::date
```

The **producing plant's local date**, not the server's. §12.4 already fixes FY derivation to *"the
producing plant's local event date … computed from `now() at time zone plants.timezone`"*, and
`plants.timezone` is `text NOT NULL` — verified live. Using `current_date` would put the Pricing Date
and the Batch Reference's FY on two different clocks, which around midnight and around 31 March would
disagree.

### 3.3 Automatic default-Release selection

```sql
select id into v_release
  from public.pricing_basis_releases
 where plant_id = new.plant_id
   and status = 'approved'
   and is_automatic_default
   and daterange(effective_from, effective_until, '[]') @> v_pricing_date;
```

**At most one match is guaranteed by the database, not by the query.** `ex_pbr_default_no_overlap` is
live: an exclusion constraint over `(plant_id =, daterange(effective_from, effective_until, '[]') &&)`
where `is_automatic_default and status = 'approved'`. This select can never return two rows and needs
no `order by … limit 1` — which would have silently picked one had the guarantee not held.

Two semantics verified live: `daterange(from, NULL, '[]')` yields `[from,)`, genuinely unbounded above;
and `'[]'` is inclusive at both ends, so `effective_until` is the **last covered day**.

### 3.4 Deliberate approved-alternative selection

> The effective default Release is applied automatically for ordinary pricing. **Maker may
> deliberately choose another approved Release**; reasons are optional initially. Calendar gaps warn
> but allow an approved alternative.
>
> — `data-model-decisions.md`, CDM-27

**`pricing_basis_is_deliberate` records the mode of selection, not the identity of the selector.** It
does not attest who chose, does not imply Checker involvement, and must never be read as an approval
signal. CDM-27 makes reasons optional initially, so no reason column is proposed.

```
public.set_batch_pricing_basis(
    p_batch                    bigint,
    p_expected_content_version integer,
    p_pricing_date             date,
    p_release                  bigint )   -- null = revert to the automatic default
```

| Check, in order | Failure |
|---|---|
| Active app user resolved | `42501` |
| `can_write_batch(p_batch)` — unreleased edit lock held by this caller, plus `make_quote` and status | `42501` |
| Batch status is `working` | `22023` |
| Release exists, `status = 'approved'` | `22023` |
| Release `plant_id` = Batch `plant_id` | `22023` — and the composite FK makes it unrepresentable regardless |
| Release covers `p_pricing_date` | `22023` |
| CAS filter: `update … where id = p_batch and content_version = p_expected_content_version` returns a row | `PT409` |

A withdrawn Release is refused by the same `status = 'approved'` test that refuses a draft.
`p_release = null` re-runs §3.3's automatic selection and resets `pricing_basis_is_deliberate`.

### 3.5 Calendar gaps

CDM-27 settles this directly: *"Calendar gaps warn but allow an approved alternative."*

| Moment | Behaviour |
|---|---|
| Batch creation | **Permitted.** `pricing_basis_release_id` stays null; the Batch is created and editable |
| Calculate | **Refused** — no Release means no Rate Set version, no Freight Set version, no versioned fallbacks |
| Send | **Refused** — `PT422 / pricing_basis_unresolved`. `calculation_snapshots.pricing_basis_release_id` is NOT NULL |
| Resolution | The Maker selects an approved alternative (§3.4), or the master owner approves a Release covering the gap |

### 3.6 Recalculation and staleness

`pbr.id` and `pbr.pricing_date` will be Batch-scoped fingerprint inputs, so changing either changes the
fingerprint of **every row in the Batch** — DM-6's largest smallest-affected unit. That is the correct
blast radius: a different Release means different paper rates, a different freight master, different
sector defaults and different versioned fallbacks.

- **Reverting is clean.** Selecting an alternative and reverting returns the same `pbr.id` and the same
  fingerprints. The round trip is invisible in the fingerprints and visible only in `content_version`.
- **This is not DM-5's Reprice.** What is proposed here is only the durable place a Pricing Date can
  live.

### 3.7 Snapshot mapping

| Snapshot column | Source |
|---|---|
| `pricing_basis_release_id` | `batches.pricing_basis_release_id` |
| `pricing_date` | `batches.pricing_date` |
| `calculation_default_version_id` | the Release's own `calculation_default_version_id` |
| `rate_set_version_id` *(in `effective_inputs.provenance`)* | the Release's own `rate_set_version_id` |

`pricing_basis_is_deliberate` is frozen into `effective_inputs.provenance.pricing_basis_is_deliberate`.

### 3.8 The accepted-work change — D-O approved

`app_private.create_batch` is amended **only** to set `pricing_date` per §3.2 and resolve
`pricing_basis_release_id` per §3.3, leaving it null on no match. Nothing else changes — not the lock
insert, not the default Pricing Group or Delivery Group, not the profile version, not the capability
check, not its signature. The amendment is additive within the existing transaction.

---

## 4. Temporary freight — Path A, at Pricing Group level

**D-N selected Path A:** narrowly persist temporary freight value and provenance until U3/U4 retire
the temporary working-state tiers. Warn-and-permit is preserved unchanged.

### 4.1 Why Pricing Group

CDM-17: *"Pricing Group owns the single freight value entering calculation."* And U4 restates
`legacy_batch` into governed Pricing Group freight, so persisting it here puts the value where its
successor already lives — retirement becomes a transformation in place rather than a move between
tables.

### 4.2 The columns

| Column | Type | Null | Meaning |
|---|---|---|---|
| `legacy_freight_value` | numeric(12,4) | nullable | The rate the temporary tier produced, ₹/kg. Matches every other freight rate in the model (§3.3: *rates `numeric(12,4)`*) |
| `legacy_freight_source` | text | nullable | Which temporary tier produced it. Closed list — §4.3 |

One pair per Pricing Group. A group stores **either** a `legacy_batch` fallback **or** a
`legacy_matrix` fallback, never both — the pair records the temporary value that is available to the
chain, not a catalogue of every temporary tier that might once have produced one.

### 4.3 Closed source list, pairing and sign

```sql
alter table public.pricing_groups add constraint ck_pg_legacy_freight_source
  check ( legacy_freight_source is null
       or legacy_freight_source in ('legacy_batch','legacy_matrix') );

alter table public.pricing_groups add constraint ck_pg_legacy_freight_paired
  check ( (legacy_freight_value is null) = (legacy_freight_source is null) );

alter table public.pricing_groups add constraint ck_pg_legacy_freight_non_negative
  check ( legacy_freight_value is null or legacy_freight_value >= 0 );
```

The list is **exactly `legacy_batch | legacy_matrix`** and deliberately excludes every governed source.
A governed value has its own home — `freight_manual_value`, the `ex_factory` mode, or the approved
Freight Master reached through the basis — and admitting one here would create a second authority over
the same number.

`ck_pg_legacy_freight_paired` makes a value without provenance, and provenance without a value,
equally unrepresentable — the same biconditional device the S9(a) freight correction used, and for the
same reason: half a reference is not a reference.

### 4.4 Precedence — a single chain with one winner

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

**The resolver selects exactly one effective source.** That is the whole model, and it settles what a
stored temporary value means:

| Stored source | Position | What a stored value means |
|---|---|---|
| `legacy_batch` | **above** the Pricing Group tier | It wins over `manual`, `ex_factory` and `master`. Storing it alongside a governed mode statement would make that statement ineffective — §4.6 |
| `legacy_matrix` | **below** the approved master | It is a **lower-priority fallback**. When an upper tier resolves, it is simply not selected. That is the chain working, not a contradiction |

If approved master freight resolves, the snapshot records `master`. If it does not, the stored matrix
fallback may resolve as `legacy_matrix`. Nothing about the stored value is misleading in either case,
because provenance is decided by the resolver at calculation time and frozen from the winner.

### 4.5 Write authority, edit lock and CAS

Identical in shape to §1.4, on a different table. `pricing_groups` already carries `INSERT` and
`UPDATE` for `authenticated`, with `pricing_groups_insert` and `pricing_groups_update` gated on
`can_write_batch(batch_id)`. **No new grant and no new policy.** Concurrency has the same two halves:
`trg_pg_content_version` is the database's; the expected-version `WHERE` filter is the caller's
contract.

### 4.6 The one narrow constraint — and the guard that is withdrawn

```sql
-- legacy_batch outranks the Pricing Group tier, so storing it alongside a
-- governed mode statement would make the Maker's selection ineffective.
alter table public.pricing_groups add constraint ck_pg_legacy_batch_not_with_governed_mode
  check ( legacy_freight_source is distinct from 'legacy_batch'
       or freight_mode = 'master' );
```

**Why only `legacy_batch`, and only these two modes.** `manual` and `ex_factory` are explicit Maker
statements of a specific value. `legacy_batch` sits above them in the chain, so a Pricing Group holding
both would apply the temporary value and silently discard the governed one the Maker just stated. That
is a contradiction, it is `CHECK`-expressible from columns on one row, and it holds on every write path
— the existing direct table write, any future RPC, a migration, an owner-level write.

`master` mode is deliberately excluded from the rule. There the Maker has stated a *delegation*, not a
value, so `legacy_batch` winning is the ratified S8 chain behaving as designed pending U4 — not a
contradiction to prevent.

`legacy_matrix` is not restricted in any mode. In `manual` or `ex_factory` it is dormant; in `master`
it is a fallback below the approved master. Neither state is contradictory, and §4.4 explains why
neither is misleading.

> #### Withdrawn: `app_private.guard_pg_temporary_freight`
>
> Revision 3 proposed a `BEFORE INSERT OR UPDATE` trigger on `pricing_groups` rejecting a stored
> `legacy_matrix` pair whenever the approved master resolved. **That mechanism could not enforce the
> invariant it claimed, and the claim is withdrawn with it.**
>
> A trigger on `pricing_groups` fires only on writes to `pricing_groups`. Every input that decides
> whether the master resolves lives somewhere else:
>
> | Change that makes the master resolve | Table written | Does the trigger fire? |
> |---|---|---|
> | Basis Delivery Group's `ship_to_location_id` set or changed | `delivery_groups` | **No** |
> | Basis Delivery Group reactivated from `removed` | `delivery_groups` | **No** |
> | Batch's Pricing Basis Release changed to one whose Freight Set version has the route | `batches` | **No** |
> | A Freight Entry approved for that route | `freight_entries` / `freight_set_versions` | **No** |
>
> So the state the trigger existed to prevent would arise silently through four ordinary paths, and
> the trigger would catch only the fifth — someone writing to the Pricing Group afterwards. A guard
> that fires on one of five paths is not an invariant; it is an intermittent obstacle that would give
> false assurance while permitting the very state it names.
>
> Enforcing it properly would need triggers on four tables across three families, each re-deriving the
> full master resolution — far outside a persistence tranche, and unnecessary once §4.4's framing is
> taken seriously: a lower-priority fallback that is not selected needs no guard.

### 4.7 Population and clearing

| Act | Rule |
|---|---|
| **Population** | Written through the same governed `pricing_groups` update path as any other freight field. No dedicated RPC: a bespoke write path for a field scheduled for deletion would outlive its purpose |
| **Clearing** | Explicit — both columns set to `null` together, enforced by `ck_pg_legacy_freight_paired` |
| **Mandatory clearing at U4** | When **U4 restates `legacy_batch` into governed Pricing Group freight**, both temporary fields are cleared as part of that restatement. The value has been superseded by a governed one and must not remain as a higher-priority tier that would outrank it |
| **Not required** | Clearing `legacy_matrix` merely because an upper tier currently resolves. It is a lower-priority fallback (§4.4); leaving it stored costs nothing, and it becomes relevant again the moment the upper tier stops resolving — which is exactly what a fallback is for |
| **Atomicity, where it applies** | Stating `manual` or `ex_factory` freight while a `legacy_batch` pair is stored fails unless the pair is cleared in the same statement — `ck_pg_legacy_batch_not_with_governed_mode` makes any intermediate state unwritable |

### 4.8 Send validation — compare against the winner

**Send validates the payload against the freight the database resolves, not against the stored
temporary pair.** The stored pair is one input to that resolution, not a value to be matched
independently.

```
1. Resolve freight from durable state, following §4.4's chain, producing
   ( value, source, authority, freight_set_version_id, freight_entry_id ).
2. Compare that winner with the payload's resolved.freight block.
3. Disagreement on value, source, authority or either reference refuses the Send.
```

| Condition | Verdict |
|---|---|
| Payload's `resolved.freight` matches the database-resolved winner in every field | **Accept** |
| Any field disagrees | `PT422 / freight_resolution_mismatch` |
| Winner is `unresolved` | `PT422 / freight_unresolved` — an unresolved chain has no calculation |

**The winning source need not equal `legacy_freight_source`.** A Pricing Group storing a
`legacy_matrix` fallback whose approved master resolves produces a winner of `master`, and the payload
must say `master`. Requiring it to match the stored temporary source — as Revision 3 did — would have
refused a correct Send whenever an upper tier legitimately won.

Snapshot mapping follows the winner:

| Winning source | `freight_source` | `freight_authority` | master refs | `effective_freight` |
|---|---|---|---|---|
| `row` | `row` | `governed` | both null | the row override |
| `legacy_batch` | `legacy_batch` | `temporary` | both null | `legacy_freight_value` |
| `pricing_group` | `pricing_group` | `governed` | both null | manual value, or `0` for ex-factory |
| `master` | `master` | `governed` | **both non-null** | the Freight Entry's rate |
| `legacy_matrix` | `legacy_matrix` | `temporary` | both null | `legacy_freight_value` |

Already enforced by `ck_cs_freight_authority_binds_source` and `ck_cs_freight_refs_master_only`; Send
refuses first so the caller receives a controlled error rather than a constraint violation.

### 4.9 Retirement

`calculation_snapshots` **copies** the value into `effective_freight` and the provenance into
`freight_source` and `freight_authority`. There is **no foreign key** from any Family G table back to
`pricing_groups.legacy_freight_value` or `legacy_freight_source` — verified live, the only Family G
reference to that table is `fk_qi_pricing_group`, which points at `pricing_groups(id)` and is
unaffected by dropping a column.

**Dropping the columns therefore removes no historical evidence.** Every issued snapshot keeps its
frozen value and provenance and remains fully readable and re-exportable, as CDM-22 requires.

| Retirement precondition | Why |
|---|---|
| **No open Batch depends on them** — no `pricing_groups` row with a non-null pair belongs to a Batch in `working`, `sent` or `submitted` | A working Batch whose freight resolves through a temporary tier would silently lose its rate mid-edit and fall to `unresolved` |
| **Compatibility control** — the build that reads the columns must not outlive them | An older build reading a dropped column errors; the drop and the build move together, per §16.1's atomicity rule |
| **The governed replacement exists first** — U3's approved Freight Master covering every live route, U4's restatement of `legacy_batch` | Dropping before replacing converts a temporary rate into `unresolved`, which blocks. S8 recorded that mirror rates are **not guaranteed equal** to approved Freight Set rates, so U3 carries a possible repricing event |
| **A residual-count gate** — `CP-69` | Makes the first precondition mechanically checkable rather than a claim |

### 4.10 Governed master freight fingerprint fields — D-S approved in full

§10.4's list names the group's `freight_mode`, `freight_basis_delivery_group_id`,
`freight_manual_value` and the row `freight_override`. **That is not sufficient to determine the
resolved master rate.** The full chain in `master` mode is:

```
pricing_groups.freight_basis_delivery_group_id
   → delivery_groups.ship_to_location_id          ← NOT in §10.4
   → freight_entries where freight_set_version_id = <the Release's>
                       and origin_plant_id        = <the Batch's plant>
                       and destination_location_id = <that Ship-to>
   → freight_entries.rate
```

**All five fields are approved and are settled requirements of the S7-R field list.**

| Key | Source | Null when | Evidence |
|---|---|---|---|
| `pg.basis_ship_to_location_id` | basis Delivery Group's `ship_to_location_id` | no basis, or basis has no Ship-to | Changing Ship-to on the *same* Delivery Group changes the resolved Entry and therefore the rate, with `freight_basis_delivery_group_id` unchanged. Verified: **there is no trigger of any kind on `delivery_groups`**, and `delivery_groups_update` admits the change under `can_write_batch` |
| `pg.basis_dg_status` | basis Delivery Group's `status` | no basis | Setting the basis group to `removed` degrades resolution to the tier below — a price change. CDM-23: adding or removing an ordinary Delivery Group is presentation-only *"unless it is/becomes the freight basis"* |
| `eff.freight` | the resolved rate | never — an unresolved chain has no calculation | Hashing the outcome tests the result, not merely the derivation |
| `eff.freight_source` | the winning source | never | §10.4 asks that the hash be fed the resolver's *output provenance* rather than the raw input |
| `eff.freight_entry_id` | the resolved `freight_entries.id` | source is not `master` | Removes the freshness test's hidden dependency on `trg_fe_follows_version`, `trg_fsv_transition` and the absence of a DELETE grant — machinery in another family that the test neither owns nor sees |

**Recorded, not proposed.** `customer_locations` has its own retirement path
(`retire_customer_location`). A retired Ship-to leaves the Freight Entry — keyed by location id —
intact and resolvable, so the rate does not move; whether a Quote *should* price against a retired
destination is a commercial question S8's resolver does not address. Flagged for the S7-R packet.

---

## 5. Fingerprint construction is not in this tranche

**Both fingerprint functions belong to S7-R**, alongside the Calculate writer that is their first
caller. A builder is a *consumer* of the columns S9-P creates and a *dependency* of the writer that
stamps its output; delivering it here would create a window in which a serializer exists, is testable
only against itself, and has nothing that writes its result — while the field set it must cover is
still growing (§4.10 adds five keys).

| Stated in S9-P | Built and proved in S7-R |
|---|---|
| Which columns participate, and under which key names (§1.1, §2.4, §4.10) | The serializer that emits them |
| That null and explicit zero must hash differently (§1.2) | The gate that proves they do (`CP-2`) |
| That the byte contract is `qcf/1` as specified in the freshness reconciliation §3 | The function implementing it, and its golden vector |
| The static privilege placement both functions must have (below) | The catalogue gate asserting it (`CP-54`) |

**The privilege requirement is stated here so S7-R inherits it rather than rediscovering it.** The
serializer touches no table and must be `IMMUTABLE`, `SECURITY INVOKER`, `set search_path = ''`. The
gatherer reads eight tables across three families and must be `STABLE`, `SECURITY DEFINER`,
`set search_path = ''` — because it answers "what is this row's fingerprint", a property of the
database and not of the caller's visibility. Both live in `app_private`; both are revoked from
`public`, `anon` and `authenticated`.

---

## 6. The dependency order — D-P approved

```
S9-P  persistence prerequisite                    ← this packet
      15 columns · 2 RPC changes · constraints · persistence tests
      ZERO fingerprint functions · ZERO guard triggers · no hash-dependent gate
         │
         │  without it: add-ons, Release, Pricing Date, fluting BCF and
         │  temporary freight have no durable home
         ▼
S7-R  S7 remainder                                ← its own packet, not written
      the canonical fingerprint builder — serializer + gatherer (§5)
      the database-side freight resolver
      the calculate RPC that writes batch_calculations
      the write path §7.5 withheld · whatever gate replaces FS-14
      EVERY hash-dependent and resolution-dependent gate (§7.2)
         │
         │  without it: batch_calculations has no writer, so Send's
         │  exclusive source can never be legitimately populated
         ▼
S9(b) atomic Send                                 ← packet held at Revision 2
      one RPC · its proof suite · registration · access hygiene
      the Send-time gates of §7.3
```

**Each concern belongs to exactly one tranche.** Persistence is S9-P's. Fingerprint construction and
freight resolution are S7-R's. Send is S9(b)'s. No item is assigned twice, and §7's three tables make
the split checkable line by line.

Under **D-P**, S6 is not reopened — the `create_batch` amendment of §3.8 is authorised separately
under D-O and is additive within that function. U4 is not enlarged — it keeps its S8-recorded scope,
and §4.7 and §4.9 record what it must deliver.

---

## 7. Proof gates

One new suite, `tests.calculation_persistence()`, registered in `tests.run_all()` and revoked from
`public`, `anon` and `authenticated`. Every gate runs as `authenticated` with minted fixtures unless
it is a catalogue assertion.

### 7.1 Gates S9-P closes

These need no hash and no resolver. They are the whole of S9-P's automated evidence.

#### A — storage distinguishes blank from explicit zero

| Gate | Asserts |
|---|---|
| `CP-1` ×8 | For each add-on: `null` stores and reads back null; `0` stores and reads back 0; the two are distinguishable in the row |
| `CP-3` | `fluting_bcf = null` and `= 0` are distinguishable in the row; `fluting_bcf_default` is NOT NULL and seeded `0.1000` |
| `CP-4` | `ck_row_addons_non_negative`, `ck_row_fluting_bcf_range` and `ck_cdv_fluting_bcf_range` reject `-1` and `0.31` **by constraint name** via `GET STACKED DIAGNOSTICS` |

#### B — Release selection and validation

| Gate | Case | Expected |
|---|---|---|
| `CP-30` | **Positive control.** Approved default Release covering today, at the Batch's plant | Selected automatically; `pricing_basis_is_deliberate = false` |
| `CP-31` | **Wrong plant** | Not selected; deliberate selection refused `22023`; direct write refused by `fk_batch_pricing_basis` **by name** |
| `CP-32` | **Withdrawn** | Not selected; refused `22023` |
| `CP-33` | **Future** | Not selected; refused `22023` |
| `CP-34` | **Expired**, then the **boundary**: `effective_until` before, then equal to, the Pricing Date | Refused when before; **accepted when equal** |
| `CP-35` | **Deliberate alternative**, selected by a **Maker** holding `make_quote` | Accepted; `pricing_basis_is_deliberate = true` |
| `CP-36` | **Revert** — `p_release = null` | Automatic default reselected; `is_deliberate` back to `false` |
| `CP-37` | **Calendar gap** | Batch creation **succeeds** with a null Release |
| `CP-38` | A second approved default overlapping the first at one plant | Refused by `ex_pbr_default_no_overlap` **by name** |

`CP-34`'s boundary arm is deliberate: an off-by-one day at a Release boundary would price a Quote on
the wrong basis, visible to nobody until a customer disputed it. `CP-35` runs as a **Maker** — CDM-27
gives the Maker the choice, and a Checker persona would pass while encoding the wrong authority.

#### C — no partial mutation

| Gate | Case | Asserts |
|---|---|---|
| `CP-40` | `set_batch_pricing_basis` with a stale expected version | `PT409`, **all three** columns unchanged, `content_version` unchanged |
| `CP-41` | No edit lock held | `42501`, same three columns and version unchanged |
| `CP-42` | Lock held by **another** user | `42501` — a released lock and a foreign lock are different states |
| `CP-43` | Fails its *last* validation — right plant, approved, but not covering the date | `22023`, and `pricing_date` **unchanged** |
| `CP-44` | Direct `update` on `batch_rows` sending `content_version` | `23514` from `guard_content_version` **by message** |
| `CP-45` | Direct `update` **omitting** the expected-version filter, caller holding the lock | **Succeeds**, version increments. Records the §1.4 truth: the filter is a caller contract, not a database rule |

#### D — temporary freight, stored and constrained

| Gate | Asserts |
|---|---|
| `CP-60` | `ck_pg_legacy_freight_paired` refuses a value without a source and a source without a value — **by constraint name** |
| `CP-61` | `ck_pg_legacy_freight_source` refuses `'master'`, `'row'`, `'pricing_group'` and `'unresolved'` — **by name** |
| `CP-62` | **`manual` + `legacy_batch` is rejected.** Setting `freight_mode = 'manual'` with a value while a `legacy_batch` pair is stored is refused by `ck_pg_legacy_batch_not_with_governed_mode` **by name**; and **succeeds** when the pair is cleared in the same statement |
| `CP-63` | **`ex_factory` + `legacy_batch` is rejected.** As `CP-62` for `ex_factory`. Written separately because the two modes reach the constraint by different column states, and one gate would leave the other untested |
| `CP-64` | **`manual` and `ex_factory` may retain a dormant `legacy_matrix` pair.** Both modes accept a stored `legacy_matrix` value — the positive arm, proving the constraint is narrow and does not over-reach |
| `CP-64a` | **`master` + `legacy_batch` is permitted.** The constraint excludes `master` on purpose: there the Maker stated a delegation, not a value, so the ratified S8 order applies pending U4 |
| `CP-68` | **Atomicity where it applies.** Stating `manual` freight and clearing a `legacy_batch` pair in one statement succeeds; either half alone fails |
| `CP-69` | **Retirement readiness.** The count of non-null pairs on Pricing Groups belonging to Batches in `working`, `sent` or `submitted` is reported. Informational until U3/U4; becomes the drop precondition of §4.9 |
| `CP-70` | **No Family G foreign key** references either column — asserted from `pg_constraint`, so §4.9's conclusion cannot silently stop being true |

**Removed this revision:** `CP-65` and `CP-66` in their Revision 3 form (they tested the withdrawn
guard); `CP-67` (`BEFORE INSERT` coverage — no trigger to cover); `CP-71` (the guard's privilege
placement — no guard). `CP-65` and `CP-66` are **rewritten as resolution obligations** and reassigned
to S7-R in §7.2.

### 7.2 Requirements S7-R inherits

**S9-P cannot close any of these.** Each computes a hash or resolves the freight chain, and neither a
serializer nor a database-side resolver exists until S7-R builds them.

| Gate | Requirement |
|---|---|
| `CP-2` ×8 | For each add-on, the serialized line for `null` is `\N` and for `0` is `0`, and the two payloads hash differently |
| `CP-10`…`CP-17` | Each of the eight add-ons, `null → 0` and `0 → 1.5`, changes the fingerprint on **both** transitions |
| `CP-18` | `batch_rows.fluting_bcf` changes the fingerprint |
| `CP-19` | A new approved `calculation_default_versions` with a different `fluting_bcf_default` changes the fingerprint for an **inheriting** row and **not** for an overriding one |
| `CP-20` | `batches.pricing_date` changes the fingerprint for **every** row in the Batch |
| `CP-21` | `batches.pricing_basis_release_id` changes the fingerprint for **every** row in the Batch |
| `CP-22` | `pricing_groups.legacy_freight_value` changes the fingerprint for every row in that Pricing Group only |
| `CP-23` | `pricing_groups.legacy_freight_source` changes the fingerprint for every row in that Pricing Group only |
| `CP-24` | **A basis Ship-to change stales.** Changing `delivery_groups.ship_to_location_id` on the **basis** group, with `freight_basis_delivery_group_id` unchanged, changes the fingerprint of every row in that Pricing Group |
| `CP-25` | **Basis status is calculation-relevant; ordinary status is not.** Setting the **basis** group to `removed` changes the fingerprint; setting a **non-basis** group to `removed` does **not** — CDM-23, both directions |
| **`CP-65`** *(rewritten)* | **A resolved approved master beats a stored `legacy_matrix`.** With `freight_mode = 'master'`, an active basis carrying a Ship-to, a matching Freight Entry, **and** a stored `legacy_matrix` pair, the resolver returns `master` with both references non-null. The stored pair is not selected and is not an error |
| **`CP-66`** *(rewritten)* | **A stored `legacy_matrix` is used only when the master does not resolve.** Four arms, each a different reason to fall through: no basis; basis `removed`; basis without Ship-to; no matching Freight Entry. In every arm the resolver returns `legacy_matrix` with `authority = 'temporary'` and both references null |
| `CP-50` | **Golden vector.** A fixed input row serializes to a byte-exact expected payload and hashes to a hard-coded hex digest |
| `CP-51` | **Numeric normalization.** `5`, `5.0`, `5.000` in a `numeric(14,4)` column all produce the same digest; `-0.0` and `0` likewise |
| `CP-52` | **Null is not empty.** A null add-on and one set to `0` differ; a null text field and an empty string differ |
| `CP-53` | **Writer/reader equality.** The value the calculate RPC stamps equals `calculation_fingerprint(row)` recomputed immediately after, over an unchanged row |
| `CP-54` | **Privilege placement.** `fingerprint_serialize` has `prosecdef = false`; `calculation_fingerprint` has `prosecdef = true`; both pin `search_path` to empty; both revoked from `public`, `anon`, `authenticated` |

`CP-65` and `CP-66` are the pair that replaces the withdrawn guard. Where Revision 3 tried to *prevent*
a state by trigger, these two *prove the resolver handles it* — which is where the invariant actually
lives, and the only place it can be enforced for all five paths of §4.6.

#### `CP-55` — caller-path equality, deferred

Revision 2 proposed proving caller-independence by having two differently-authorized personas invoke
Calculate. **That assumed a non-owner Checker may invoke Calculate, and nothing establishes it.**
`can_write_batch` admits a `check_quote` holder only when the Batch is `submitted`; on a `working`
Batch it requires `make_quote` plus ownership or active collaboration. Whether a Checker may Calculate
at all is a question the **S7-R packet must answer when it defines the Calculate RPC's authority**.

Caller-path equality testing is therefore **deferred to S7-R**. The static requirement `CP-54` is
retained and is the gate that catches the realistic regression — someone changing the gatherer to
`SECURITY INVOKER` in a later edit. `CP-55c` and **D-R are withdrawn**.

### 7.3 Requirements S9(b) inherits

| Gate | Requirement |
|---|---|
| **`CP-67`** *(rewritten)* | **Send freezes only the winning source.** Given a Pricing Group storing a `legacy_matrix` pair whose approved master resolves, the snapshot records `freight_source = 'master'`, `freight_authority = 'governed'`, both master references non-null, and `effective_freight` equal to the Freight Entry's rate — **not** the stored temporary value. And with the master not resolving, the same Pricing Group produces `legacy_matrix`, `temporary`, both references null, and the stored value |
| `CP-72` *(new)* | **Send compares against the winner, not the stored pair.** A payload whose `resolved.freight` disagrees with the database-resolved winner in any field raises `PT422 / freight_resolution_mismatch` and writes nothing. A payload that agrees is accepted **even though its source differs from `legacy_freight_source`** — the case Revision 3 would wrongly have refused |

---

## 8. Decisions required before S9-P can be authorised

Five rulings are recorded as settled in §0.1 — **D-M**, **D-N Path A**, **D-O**, **D-P**, **D-S** —
and are not reopened. **D-R is withdrawn.**

| # | Decision | Why it cannot be taken by SR DEV |
|---|---|---|
| **D-Q** *(revised)* | **Ratify the §4 Path A design as corrected.** Two columns with the closed source list, pairing and non-negative constraints; **one** narrow constraint barring `legacy_batch` from `manual` and `ex_factory` only; **no guard trigger**; `legacy_matrix` retained as a lower-priority fallback in any mode; clearing mandatory at U4's restatement and not otherwise; Send comparing against the winning resolution | The narrow constraint **changes what a Maker's governed-freight edit must do** — stating manual or ex-factory freight fails unless a stored `legacy_batch` pair is cleared in the same statement. That is a live behavioural restriction on a currently-representable state, and it is the only such restriction this tranche imposes |

**Recorded, not proposed:** whether a Quote may price against a **retired** Ship-to Location (§4.10).
The Entry remains resolvable and the rate does not move, so this is commercial rather than freshness.
Flagged for the S7-R packet.

---

**Nothing in this packet is implemented.** It is submitted for Product Owner review. S9-P begins only
on explicit approval, and S9(b) is not revised until this boundary is ruled.
