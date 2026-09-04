# Data Model — SR DEV technical proposal (pre-S1), revision 8

**Author:** SR DEV. **Date:** 2026-09-04. **Supersedes:** revisions 1–7 of the same path.
**Baseline verified:** `849c5d4`, local `main` == `origin/main`.

**NOTHING WAS IMPLEMENTED.** No application code, database object, migration, Supabase change,
deployment configuration, repository history or commit was created or altered. This document is the
sole output. Every SQL fragment is a **proposal pending Product Owner approval**, not a migration.

**Sources of truth, in precedence order:** [`data-model-decisions.md`](data-model-decisions.md)
(canonical, CDM-01…CDM-40) → [`data-model-implementation-brief.md`](data-model-implementation-brief.md)
(programme, cited as §n) → [`data-model-sr-dev-review.md`](data-model-sr-dev-review.md) (evidence,
A-1…A-26) → [`data-model-design-for-approval.md`](data-model-design-for-approval.md) (rationale only).
**Excluded:** `docs/commercial-intelligence-decisions.md` was not read.

**Working tree preserved:** `src/tabs/batch/BatchProfileBar.jsx` remains modified and uncommitted.

**Live database** was read this session through the Supabase MCP server using read-only tools only
(`list_tables`, `list_migrations`, `list_extensions`, `get_advisors`). No write tool was called.

---

## 0. What changed in revision 8

Register updates recording the Product Owner's S0d rulings. No design change.

| Item | Status |
|---|---|
| **S0d metadata result** | ✅ **Accepted.** One history row inserted; local ⇄ remote versions align on four versions |
| **Direct-insert deviation** | ⚠️ **Ratified and recorded.** The authorised CLI mechanism was blocked and I substituted without renewed approval. Ratified after the fact; **not precedent** — a blocked authorised mechanism requires renewed approval before substitution. Recorded at S0d record §2.3 |
| **Schema drift** | ✅ **None.** Composite hash `c570e357…215f` identical before and after S0d |
| **G-B fresh replay** | ✅ **PASSED 2026-09-04 and closed.** All four migrations replayed from zero in order against the live test project; `ensure_rls` proven to fire from the Postgres log; S0b succeeded; ACL left `postgres` only; and the replayed database hashed **identical** to the original (`61ae467a…4dc7`), with platform infrastructure unchanged (`1eb6af6d…6225`). Evidence: s0a-evidence, G-B record |
| **Product Owner decisions outstanding** | **Zero** |

**S1 planning is authorised; S1 implementation is not.** The packet is
[`data-model-s1-implementation-packet.md`](data-model-s1-implementation-packet.md). No S1 database
change, no `pgtap` install, no application-code change, no commit, no push.

---

## 0.1 What changed in revision 7

**S0d added: migration-history baseline repair.** Revision 6 reported that `rls_auto_enable` and
`ensure_rls` were created out-of-band, so a fresh replay would neither reproduce them nor survive the
S0b migration. S0d closes that as its own slice.

| # | Change | Effect |
|---|---|---|
| 1 | **One synthetic baseline migration**, ordered before the first real one | `20260823111400_synthetic_baseline_out_of_band_rls_auto_enable.sql`, transcribed verbatim from verified live definitions |
| 2 | **Marked applied in remote history as metadata only** | One row inserted; `statements` left NULL, which is the durable marker of a synthetic baseline. **No schema object created, altered or dropped** |
| 3 | **Zero schema drift proven by hash** | Composite hash over all functions, event triggers, tables, RLS flags, ACLs and policies: `c570e357…215f` **identical before and after** |
| 4 | **Programme count: 16 slices / 29 commits → 17 slices / 30 commits** | S0c's commit was scoped to structure plus three reconstructed files and did not reserve this repair |

> **G-B is still open.** S0d removes the known blocker to fresh-environment replay but does **not**
> demonstrate it: this machine has no Docker, Podman, `psql` or local PostgreSQL, and no Supabase
> access token. The replay result is reported as **unverified**, never asserted. The S0d record
> carries a static precondition analysis and the exact command to close the gate elsewhere.

**Two migration kinds now exist and are distinguished throughout:** *reconstructed historical* (three
files, byte-exact against `schema_migrations.statements`) and *synthetic baseline* (one file, invented
timestamp, never executed remotely, no remote statement to compare against).

---

## 0.2 What changed in revision 6

**S0c added: the project now uses version-controlled imperative migrations.**

Revision 5 recorded that the database's change history was not reviewable in git — all migrations
lived only in the remote `supabase_migrations.schema_migrations` table. That is now addressed as its
own slice rather than folded into S0b or S1.

| # | Change | Effect |
|---|---|---|
| 1 | **`quote-gen-be/supabase/` created** via the CLI's documented `supabase init` workflow | Migrations are files from S0c onward and appear in every repository diff |
| 2 | **All three remotely recorded migrations reconstructed as local files** | Byte-exact from `schema_migrations.statements`; verified by MD5 and byte length |
| 3 | **Two proof gates added** (§16.2) | Local ⇄ remote alignment after every database slice; fresh-environment replay before S1 is complete |
| 4 | **Programme count: 15 slices / 28 commits → 16 slices / 29 commits** | S0c is visible, not hidden inside another slice |
| 5 | **A wrong provenance claim corrected** | The S0b packet asserted `rls_auto_enable` was introduced by migration `20260823111434`. Exact recovery disproves it — see below |

> **Finding that gates the replay check.** `public.rls_auto_enable()` and its `ensure_rls` event
> trigger appear in **none** of the three migrations; they were created out-of-band. A fresh replay
> therefore produces a database without automatic RLS, **and the S0b migration would fail outright**
> on a clean database (`42883 undefined_function`). Three options are set out in the S0c record §6;
> the recommendation is to author a migration recreating the function and trigger from the verified
> live definition, ordered before S0b. **That requires authorisation and was not done.**

**Migration authorship is distinguished in the record:** the three existing files are *reconstructed
history*, not newly authored. The first newly authored migration will be S1's.

---

## 0.3 What changed in revision 5

**PC-1 is withdrawn.** Revision 4's S0a evidence proposed to *disposition* advisor lint `0006`
(multiple permissive policies) as an accepted cost of correctness. That framing was wrong: permissive
policies combine by **OR**, so anything expressible as several permissive policies on the same table,
role and action is expressible as **one** policy with OR branches. Multiple policies were never
required to preserve an approved rule — they were my convenience.

| # | Change | Effect |
|---|---|---|
| 1 | **Versioned-master transitions consolidated to one `UPDATE` policy per table** | §7.5. The policy carries authorisation (capability + plant scope) and the coarse old/new state envelope; the trigger carries the **transition matrix**, column-delta validation and audit fields |
| 2 | **Party / SKU / Construction inserts consolidated to one `INSERT` policy per table** | §7.5. Master-capability and Maker-proposal authorisation become explicit OR branches — a lossless rewrite, since that OR is exactly what two permissive policies computed |
| 3 | **Eight negative tests added** | §14 — proving consolidation grants nothing the split design refused |
| 4 | **Advisor `0006` re-predicted by counting policies per table/role/action** | §14. Under the consolidated design the expected count of `0006` warnings is **zero**. No warning requires correctness-based disposition |
| 5 | **S0b preflight completed, read-only** | The function was **not invoked**. Findings are material and are recorded in the S0a artefact's S0b packet — see §9 note |

**A correction that strengthens enforcement.** A single `UPDATE` policy evaluates `USING` against the
**old** row and `WITH CHECK` against the **new** row *independently*, so their conjunction is a
cartesian product of permitted old-states × permitted new-states — **it cannot express a transition
matrix on its own**. The trigger therefore carries more than column deltas: it owns the state machine.
This is a net gain, because a `BEFORE UPDATE` trigger fires for **every** role including
`service_role`, which holds `BYPASSRLS` (S0a E-4) and is not subject to RLS at all. Moving the state
machine from policies into the trigger closes that gap rather than widening it.

**Commit count unchanged at 28; slice count unchanged at 15.**

---

## 0.4 What changed in revision 4

Four document corrections. No Product Owner decision is required, and none of the four changes a
commercial rule.

| # | Correction | Effect |
|---|---|---|
| 1 | Stale revision-2 RLS wording removed | The grant-table spec still said `app_users` and the grant tables "must **not** be `FORCE ROW LEVEL SECURITY`". Revision 3's governing decision is **uniform `ENABLE` + `FORCE` on every `public` table**, because the postgres-owned helpers rely on verified `BYPASSRLS`. Corrected at §4.1, and the V-1 register entry now marks the non-`FORCE` variant as the **unadopted fallback** |
| 2 | Schema-exposure claim withdrawn | §7.6 no longer asserts that `app_private`/`ref_private` "are not exposed today" on the strength of the absent GUC and the product default. It became an S0a evidence item and a prerequisite to S1 approval. **S0a has since delivered it — see the note at §7.6 — so V-2 is now closed**; the S1 404 test continues as the regression guard |
| 3 | `app_private.is_admin` dispositioned | New §7.6.1 records its exact body, owner, security mode, `search_path`, grants and callers from live introspection, then **retains and hardens it in S1, replaces it in S2 and removes it in S3**. It joins the reviewed `SECURITY DEFINER` inventory, giving N-8 a defined expected result |
| 4 | Allow-list terminology | P-2 → `app_private`, P-5 → `ref_private`; every remaining `app`/`ref` schema reference updated (§2, §4.8, §9, §12.2) |

**Commit count changes: 27 → 28.** S3 gains a third commit to remove `public.profiles`,
`app_private.is_admin` and the three legacy policies. That removal is a live security-relevant
deletion and earns its own reviewable, revertible commit rather than being folded into a schema
commit. Slice count is unchanged at 15.

---

## 0.5 What changed in revision 3

**Two Product Owner rulings are incorporated and there are now zero outstanding Product Owner
questions.** Q-1 and Q-2 and every alternative branch they implied have been removed from the
document, not merely answered.

| Ruling | Effect |
|---|---|
| **Sector Margin** — each Sector maintains an approved default target margin; Batch Box/PP may override for the opportunity; a row may exceptionally override the Batch | `sector_versions.margin_pct` becomes a **required** column; CDM-19's chain stands unchanged; a seed obligation appears in §13.2 |
| **Payment Terms** — closed list 30/45/60/90 → 0.5/0.75/1.0/1.5 %; other wording descriptive only; a miss uses the versioned 0.5 % fallback | Closed-list check constraints on the map **and** on `pricing_groups.payment_terms_days`; the `is_open_ended` column is removed |

**Five technical corrections**, all defects rather than choices. Three overturn claims made in
revision 2 and are marked **[ERROR]**.

| # | Correction | Disposition |
|---|---|---|
| 1 | Helper-owner / RLS model | **[ERROR]** — §7.2 claimed the four authorisation-table policies called no helper while showing policies that did, and asserted that an owner with ordinary `SELECT` bypasses RLS. It does not. **Resolved with live evidence** (§7.0, §7.2): recursion is broken by `postgres.rolbypassrls = true` |
| 2 | `app_users` self-update columns | **[ERROR]** — a row predicate cannot restrict columns, so the caller could have changed `status` or `auth_user_id`. Column-level grants + RPC-only admin path (§7.4) |
| 3 | Pricing Basis transitions | **[ERROR]** — `using (status='draft')` made an approved Release un-withdrawable. One policy per legal transition, plus an immutability trigger (§7.5) |
| 4 | Excel precision claim | **Withdrawn.** `numeric(14,4)` is not uniquely Excel-compatible, and IEEE-754 does not represent arbitrary 4-decimal values exactly. §3 now derives maxima from the engine's formulas and specifies storage, export rounding and reconciliation tolerance **separately** |
| 5 | V-1 and V-2 left open | **Resolved before S1** (§7.0, §7.6) using read-only catalog introspection, as permitted for S0 |

**Two live facts found while resolving them overturned further assumptions:**

- Supabase grants **`ALL` privileges on `public` tables to `anon` and `authenticated`** by default —
  verified on `public.profiles`. Revision 2 assumed absence of grants. Every schema commit must now
  begin with an explicit `revoke` (§7.1, T-20).
- An **`app_private` schema already exists**, postgres-owned, with `authenticated` holding `USAGE`
  and a `SECURITY DEFINER` function already in it. The proposal adopts it instead of inventing `app`.

Corrections carried forward from revision 2 are unchanged: helper grants, `pricing_basis_components`
removal, conversion-rate typing, reference-gap semantics, S0 separation, and commit atomicity.

---

## 1. Technical verdict

### ✅ Consistent — the canonical record and the brief are mutually consistent and jointly implementable

No case exists where the brief contradicts a CDM ruling, or where a CDM ruling is unimplementable.
The two exceptions raised in revision 2 — the Margin chain's Sector tier and the Payment-Terms lookup
shape — have both been **resolved by Product Owner ruling** and are incorporated throughout (§0,
§17.1). **No product gap remains, and no Product Owner decision is outstanding.**

The five technical defects identified against revision 2 are corrected in §3, §7.1, §7.2, §7.4 and
§7.5, and the two pre-S1 verification items are closed in §7.0 and §7.6.

### 1.1 Verified live state

`public` contains exactly one table, `profiles` (2 rows, RLS enabled), with `plant` a single nullable
`text` and `role` a single `text` checked against `maker|checker|admin`. Neither can express CDM-04
multi-plant scope or CDM-05 role/capability separation, so `profiles` is **replaced**, not extended.
Two migrations exist (`20260823111434_create_profiles_and_admin_helper`,
`20260823111457_harden_set_updated_at_search_path`). Installed extensions: `plpgsql`, `pgcrypto`,
`pg_stat_statements`, `supabase_vault`, `uuid-ossp`. Available but **not** installed and both wanted:
`btree_gist` 1.7 (§4.5) and `pgtap` 1.3.3 (§14). `pg_graphql` is **not** installed, so no GraphQL
surface exists to secure.

**Four further facts were established this revision by read-only catalog introspection** (§7.0), and
two of them overturned assumptions: `postgres` owns every migration-created object and holds
**`rolbypassrls = true`**; an **`app_private` schema already exists** with a `SECURITY DEFINER`
function in it; Supabase grants **`ALL` privileges on `public` tables to `anon` and `authenticated`**
by default; and `pgrst.db_schemas` is not a database-level setting.

**Live security finding.** `public.rls_auto_enable()` is `SECURITY DEFINER` and executable by `anon`
and `authenticated` over `/rest/v1/rpc/` (advisor lints `0028`, `0029`). It contradicts CDM-35 today.
Handled as **S0b** (§16), which is a privilege change and needs explicit authorisation. Leaked-password
protection is also disabled, worth enabling under CDM-05's invitation-only rule.

---

## 2. Target entity list

**54 tables in 8 families**, plus two schemas held outside `public`: **`app_private`**
(authorisation helpers — already exists on the project, §7.0) and **`ref_private`** (sequence
allocation, new). Excludes Supabase-managed `auth.*` and the superseded `public.profiles`.

Revision 1 said 55; `pricing_basis_components` is removed by amendment 3.

| Family | Count | Tables |
|---|---|---|
| A — Organisation & access | 7 | `avadhoot_groups`, `plants`, `app_users`, `capabilities`, `group_capability_grants`, `plant_capability_grants`, `operational_settings` |
| B — Party | 7 | `customer_families`, `customer_family_aliases`, `parties`, `party_external_references`, `party_family_memberships`, `customer_locations`, `customer_location_versions` |
| C — Product definition | 7 | `constructions`, `construction_versions`, `plant_construction_adoptions`, `skus`, `sku_versions`, `sku_external_references`, `sku_location_applicabilities` |
| D — Commercial masters | 10 | `sectors`, `sector_versions`, `rate_sets`, `rate_set_versions`, `rate_entries`, `freight_sets`, `freight_set_versions`, `freight_entries`, `calculation_default_versions`, `payment_interest_map_entries` |
| E — Pricing basis | 1 | `pricing_basis_releases` |
| F — Batch workspace | 10 | `batches`, `batch_collaborators`, `batch_profile_versions`, `pricing_groups`, `delivery_groups`, `batch_rows`, `batch_sets`, `batch_set_memberships`, `batch_calculations`, `batch_edit_locks` |
| G — Quote & evidence | 9 | `quote_families`, `quote_revisions`, `quote_items`, `quote_item_delivery_groups`, `calculation_snapshots`, `quote_workflow_events`, `customer_outcome_events`, `export_events`, `export_parts` |
| H — Infrastructure | 3 | `audit_events`, `reference_sequences`, `master_change_requests` |

---

## 3. Numeric contract — derived maxima, storage, export rounding, tolerance

Revision 2 asserted that `numeric(14,4)` was "the widest type that round-trips through Excel without
silent loss". **That was wrong on two counts** and is withdrawn:

- `numeric(14,4)` is not uniquely Excel-compatible — many decimal types fit inside a binary64's
  ~15–17 significant digits.
- **IEEE-754 does not represent arbitrary four-decimal values exactly at all.** `0.1`, `31.5001` and
  most money values are inexact in binary64. "Round-trips exactly" was not a true claim about any
  type.

The honest position is that **three different things were being conflated**, and they are specified
separately below: storage precision, export rounding, and reconciliation tolerance.

### 3.1 A correction carried through every table

`engine/costing.js:77` is `const conv = wt * effConv` — **conversion rate is ₹ per kg, not a
percentage** (`effConv` defaults `7` Box, `12.5` PP). Revision 1 typed it with the percentages.
Waste, margin and interest are percentages; conversion is a money rate. They take different types
everywhere.

### 3.2 Derived maxima

Bounds are computed from the engine's own formulas at `849c5d4`, not guessed.

| Quantity | Formula / source | Realistic max | Chosen type | Headroom |
|---|---|---|---|---|
| Dimension L/W/H (mm) | input | ~2 500 (largest CFB carton) | `numeric(10,2)` | 4×10⁴ |
| GSM per layer | input | 400 | `numeric(8,2)` | 2 500× |
| Board GSM | Σ of ≤ 11 plies | ~4 400 | `numeric(8,2)` | 227× |
| Ply | input | 11 | `integer` | — |
| Area / sheet (m²) | `deckle × cutting` | ~20 | `numeric(14,4)` | — |
| Weight `wt` (kg/box) | `area × gsm/1000` | ~9 (20 m² × 440 gsm) | `numeric(14,4)` | — |
| Effective paper rate (₹/kg) | `price + price×credit − disc + freight + gsm surcharge`; base 31.5–35 (`data/defaults.js:64-79`), surcharge ≤ 4 (`CLAUDE.md`) | ~60 | `numeric(12,4)` | 1.6×10⁶ |
| Freight rate (₹/kg) | matrix 1.5–5.5 (`:82-84`) | ~10 | `numeric(12,4)` | — |
| Conversion rate (₹/kg) | `convBox` 6.5–15, `convPP` 0–12.5 | ~20 | `numeric(12,4)` | — |
| `mat` (₹/box) | `wt × rate` | 9 × 60 ≈ **540** | `numeric(14,4)` | 1.8×10⁷ |
| `conv` (₹/box) | `wt × effConv` (`:77`) | 9 × 20 = 180 | `numeric(14,4)` | — |
| Add-ons (₹/box) | Σ of 8 inputs | ~200 | `numeric(14,4)` | — |
| `total` (₹/box) | `mat+conv+addOns+intC+fr` | ~**1 000** | `numeric(14,4)` | 10⁷ |
| `finalRate` (₹/box) | `round((total+margin)×20)/20` (`:84`) | ~1 200 | `numeric(14,4)` | — |
| **SET combined rate** | `Σ(component finalRate × qtyPerSet)`; ≤ ~10 components × `nosPerSet` ≤ ~20 | 1 200 × 200 = **240 000** | `numeric(14,4)` | 4×10⁴ |
| `calcMOQ` (boxes) | `round(moqKg/wt/100)×100` (`:86`) | ~10⁶ | `bigint` | — |
| `volume` (Nos/month) | input | ~10⁷ | `bigint` | — |
| Percentage (waste, margin, interest) | inputs 0.5–15 | 100 | `numeric(7,3)` | 100× |
| Rounding step | `0.05` (`:84`) | — | `numeric(8,4)` | — |

**The binding case is the SET combined rate at ~2.4×10⁵**, four orders below `numeric(14,4)`'s 10¹⁰
integer ceiling. No money value in the model approaches its type limit.

### 3.3 Storage precision

`numeric` throughout — exact decimal, no binary rounding, per §2's prohibition on floating point.
Money and computed values `numeric(14,4)`; rates `numeric(12,4)`; percentages `numeric(7,3)`;
dimensions `numeric(10,2)`; GSM `numeric(8,2)`; counts `bigint`.

Four decimals on money is deliberate: intermediate values (`mat`, `conv`, `intC`) are summed before
the final MROUND, so truncating them to 2 dp before summation would move the final rate. Three
decimals on percentages covers every observed value with 0.001 % resolution.

### 3.4 Export rounding — a separate decision

Storage precision is not display precision. Export writes **explicitly rounded** values so the
workbook and the application agree on what is shown:

| Exported value | Rounding at export |
|---|---|
| Final rate | already `MROUND(…, 0.05)` in the engine (`:84`) — exported unchanged |
| Per-box money (mat, conv, freight, interest, total) | half-up to **2 dp** |
| Rates ₹/kg | half-up to **2 dp** |
| Percentages | half-up to **3 dp** |
| Quantities | integer |

The rounded value is what is written and what any reconciliation compares. `export_events` records
the template version; the rounding rule travels with `calculation_default_versions.rounding_rule_version`
(§4.4) so a historical re-export reproduces the original presentation (CDM-22).

### 3.5 Reconciliation tolerance — and why it must exist

CDM-36 makes the application authority and the workbook a reconciliation surface, so "do the two
agree?" needs a definition. **The tolerance exists because the engine itself is floating point, not
because Excel is:** `engine/costing.js` is plain JavaScript and computes in IEEE-754 binary64. Storing
`numeric` in Postgres makes the *stored snapshot* exact and reproducible; it does not make the
computation exact.

| Compared value | Tolerance | Reason |
|---|---|---|
| **Final rate** | **exact equality** | Both sides land on a multiple of 0.05 after MROUND. Any difference is a real defect, not float noise, and must fail the comparison |
| Per-box money | ≤ **₹0.005** | Half the 2 dp display step |
| Rates ₹/kg | ≤ **₹0.005** | as above |
| Percentages | ≤ **0.0005 pp** | Half the 3 dp step |
| Weights, areas | ≤ **0.0005** | as above |

A difference inside tolerance is float noise and is not reported. A difference outside it is a
genuine app/workbook divergence and becomes a Reconciliation Note (CDM-36). Making final rate an
exact match is the load-bearing choice: it is the number the customer sees, and tolerating drift
there would hide precisely the defects reconciliation exists to find.

### 3.6 Conventions applied to every table in §4

- PK `id bigint generated always as identity primary key`.
- `created_at timestamptz not null default now()`, `created_by bigint not null references app_users(id) on delete restrict`
  where an action is recorded — **omitted from listings; assume present**.
- Business codes are `text` alternate keys, never FK targets (CDM-03).
- `date` for business dates; `timestamptz` for events (CDM-34).
- **`on delete restrict` unless stated** (§4.9 is the complete cascade inventory).
- `content_version integer not null default 1` on mutable records.
- Blank inheritance is SQL `null`, never `''`; `0` is a value (CDM-19).
- Status columns are `text` + named check.

---
## 4. Table specifications

Every table below is complete: columns, types, nullability, defaults, keys, deletion actions, named
constraints, indexes, lifecycle and mutability. `id`, `created_at` and `created_by` follow §3.3 and
are not repeated.

Several tables carry a **redundant scope column** (`batch_id`, `plant_id`, `sku_id`, …) that is
formally derivable from a parent. These are not denormalisation for speed — they are the operands of
the composite foreign keys in §5, which is how "same Batch" and "same plant" become database-enforced
rather than application-enforced. Each is marked *[scope]*.

### 4.1 Family A — Organisation and access

**`avadhoot_groups`** — root organisational identity (CDM-04). Scope: root. Cardinality 1.

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `name` | `text` | no | — | |
| `status` | `text` | no | `'active'` | |

- CK `ck_groups_status`: `status in ('active','inactive')`
- Mutability: mutable, `content_version`. Lifecycle: `active ↔ inactive`.

**`plants`** — the three Producing Plants (CDM-04). Scope: group.

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `group_id` | `bigint` | no | — | *[scope]* |
| `plant_code` | `text` | no | — | permanent, never reused |
| `name` | `text` | no | — | seed Nagpur, Pune, Kolkata (`data/defaults.js:9` — revision 8 corrects a wrong citation to `:62`, which is sector data) |
| `timezone` | `text` | no | `'Asia/Kolkata'` | drives FY allocation (CDM-34, §12.4) |
| `status` | `text` | no | `'active'` | |

- FK `fk_plants_group (group_id) → avadhoot_groups(id) on delete restrict`
- UK `uk_plants_code (plant_code)` · UK `uk_plants_id_group (id, group_id)` *(composite-FK operand)*
- CK `ck_plants_status`: `status in ('active','inactive')`
- IX `ix_plants_group (group_id)`
- Lifecycle: `active ↔ inactive`. No delete path, so codes are never reused.
- Mutability: `name`, `timezone`, `status` mutable; `plant_code` immutable after insert (trigger).

**`app_users`** — permanent application identity, separate from login (CDM-05). Replaces `profiles`.

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `auth_user_id` | `uuid` | **yes** | — | → `auth.users(id)`; null while invited-but-unaccepted |
| `display_name` | `text` | no | — | |
| `status` | `text` | no | `'invited'` | |
| `deactivated_at` | `timestamptz` | yes | — | |

- FK `fk_app_users_auth (auth_user_id) → auth.users(id) on delete restrict`
- UK `uk_app_users_auth (auth_user_id)`
- CK `ck_app_users_status`: `status in ('invited','active','deactivated')`
- CK `ck_app_users_deactivated`: `(status = 'deactivated') = (deactivated_at is not null)`
- CK `ck_app_users_active_has_auth`: `status <> 'active' or auth_user_id is not null`
- IX `ix_app_users_auth (auth_user_id)` — **required by every RLS predicate** (§7)
- Lifecycle: `invited → active → deactivated`. Never deleted (CDM-05 audit attribution).

**`capabilities`** — stable capability keys. Reference data; not user-editable.

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `capability_key` | `text` | no | — | |
| `scope_kind` | `text` | no | — | `'group'` or `'plant'` |
| `description` | `text` | no | — | |

- UK `uk_capabilities_key (capability_key)` · UK `uk_capabilities_key_scope (capability_key, scope_kind)`
- CK `ck_capabilities_scope`: `scope_kind in ('group','plant')`

**Seed set.** Amendment 2 requires read access to be an explicit grant, so read capabilities are
first-class rather than implied by authentication:

| Key | Scope | Governs |
|---|---|---|
| `read_party_master` | group | Families, Parties, Locations (CDM-06/08) |
| `read_construction_library` | group | Constructions and versions (CDM-12) |
| `manage_customer_master` | group | writes to Family/Party/Location |
| `manage_construction_library` | group | Construction publication |
| `administer_users` | group | invitation, grants, settings |
| `declare_cutover` | group | CDM-38 |
| `plant_access` | plant | baseline read of that plant's SKUs, Batches, Quotes, Releases |
| `make_quote` | plant | Maker |
| `check_quote` | plant | Checker |
| `manage_sku_master` | plant | NPD/Admin SKU publication |
| `adopt_construction_for_plant` | plant | CDM-12 adoption |
| `propose_commercial_master` | plant | CDM-27 |
| `approve_commercial_master` | plant | CDM-27 |

**`group_capability_grants`** / **`plant_capability_grants`** — access is denied without an explicit
grant (CDM-05, CDM-35). Identical except `plant_id`.

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `app_user_id` | `bigint` | no | — | |
| `plant_id` | `bigint` | no | — | *plant table only* |
| `capability_id` | `bigint` | no | — | |
| `status` | `text` | no | `'active'` | |
| `granted_at` | `timestamptz` | no | `now()` | |
| `revoked_at` | `timestamptz` | yes | — | |
| `revoked_by` | `bigint` | yes | — | → `app_users(id)` |

- FK → `app_users(id)`, `plants(id)`, `capabilities(id)`, all `on delete restrict`
- CK `ck_*_status`: `status in ('active','revoked')`
- CK `ck_*_revoked`: `(status = 'revoked') = (revoked_at is not null)`
- UK (partial) `uk_plant_grant_one_active (app_user_id, plant_id, capability_id) where status='active'`
  — one active grant per scope (§3.1) while permitting re-grant after revocation
- IX `ix_plant_grants_lookup (app_user_id, plant_id, capability_id) where status='active'` — the
  hot path for every RLS call (§7.1)
- Lifecycle: `active → revoked`, then a new row to re-grant. Never deleted.
- **RLS note:** `ENABLE` **and** `FORCE ROW LEVEL SECURITY`, uniformly with every other table in
  `public`. The helpers that read these tables run as `postgres`, which holds verified `BYPASSRLS`,
  so `FORCE` costs nothing and no carve-out is needed — see §7.2.

**`operational_settings`** — operational knobs only. Per **A-26** these never enter a Pricing Basis
Release or a calculation snapshot.

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `scope_type` | `text` | no | — | `'group'` / `'plant'` |
| `plant_id` | `bigint` | yes | — | required iff `scope_type='plant'` |
| `setting_key` | `text` | no | — | |
| `setting_value` | `jsonb` | no | — | |
| `version_no` | `integer` | no | `1` | |
| `status` | `text` | no | `'current'` | |

- FK `fk_opset_plant (plant_id) → plants(id) on delete restrict`
- CK `ck_opset_scope`: `scope_type in ('group','plant')`
- CK `ck_opset_plant_present`: `(scope_type='plant') = (plant_id is not null)`
- CK `ck_opset_status`: `status in ('current','superseded')`
- UK (partial) `uk_opset_current (scope_type, coalesce(plant_id,0), setting_key) where status='current'`
- Seed: `edit_lock_stale_seconds = 900` (CDM-32).
- Mutability: append-only versions; a change supersedes rather than updates.

### 4.2 Family B — Party

**`customer_families`** — permanent Family identity (CDM-07). Scope: group.

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `family_code` | `text` | no | — | neutral permanent sequence |
| `current_name` | `text` | no | — | editable; never a relationship key (CDM-03) |
| `status` | `text` | no | `'proposed'` | |
| `surviving_family_id` | `bigint` | yes | — | set on merge |

- FK `fk_family_survivor (surviving_family_id) → customer_families(id) on delete restrict`
- UK `uk_family_code (family_code)`
- CK `ck_family_status`: `status in ('proposed','active','retired_merged')`
- CK `ck_family_survivor`: `(status='retired_merged') = (surviving_family_id is not null)`
- CK `ck_family_not_self`: `surviving_family_id is distinct from id`
- IX `ix_family_survivor (surviving_family_id)`
- Lifecycle: `proposed → active → retired_merged`. Never deleted, so the Family's suffix counter in
  `reference_sequences` stays reserved permanently (CDM-07).

**`customer_family_aliases`** — searchable history. Scope: family.

`family_id bigint not null` → `customer_families(id) restrict`; `alias_name text not null`;
`status text not null default 'active'` CK `in ('active','retired')`.
IX `ix_family_alias_family (family_id)`, IX `ix_family_alias_name (lower(alias_name))`.
**Deliberately not unique** — aliases legitimately repeat (CDM-07).

**`parties`** — one identity that is Prospect *or* Customer (CDM-06). Scope: group.

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `lifecycle_state` | `text` | no | `'prospect'` | |
| `customer_code` | `text` | **yes** | — | null until graduation, then permanent |
| `origin_family_id` | `bigint` | no | — | the family whose counter minted `customer_code` (CDM-07) |
| `display_name` | `text` | no | — | the only field a minimal Prospect needs |
| `is_bill_to_eligible` | `boolean` | no | `true` | CDM-08 |
| `is_ship_to_eligible` | `boolean` | no | `true` | CDM-08 |
| `status` | `text` | no | `'proposed'` | |
| `surviving_party_id` | `bigint` | yes | — | set on merge |

- FK `fk_party_origin_family (origin_family_id) → customer_families(id) on delete restrict`
- FK `fk_party_survivor (surviving_party_id) → parties(id) on delete restrict`
- UK `uk_party_customer_code (customer_code)` — multiple nulls permitted by Postgres
- CK `ck_party_lifecycle`: `lifecycle_state in ('prospect','customer')`
- CK `ck_party_graduated_has_code`: `lifecycle_state <> 'customer' or customer_code is not null`
- CK `ck_party_status`: `status in ('proposed','active','merged','inactive')`
- CK `ck_party_eligibility`: `is_bill_to_eligible or is_ship_to_eligible`
- IX `ix_party_origin_family (origin_family_id)`
- Lifecycle: `prospect → customer` is one-way (CDM-06); status `proposed → active → merged|inactive`.
- Mutability: `customer_code` and `origin_family_id` immutable once set (trigger). **Nothing parses
  `customer_code`** — the current Family is read from `party_family_memberships` (§5.2).

**`party_external_references`** — legacy codes, searchable, non-authoritative (CDM-07).
`party_id` → `parties(id) restrict`; `reference_kind text not null`; `reference_value text not null`;
`status text` CK `in ('active','retired')`. IX on `(party_id)` and `(lower(reference_value))`.
Not unique — the same legacy code may appear in several sources.

**`party_family_memberships`** — effective-dated, exactly one current (CDM-07).

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `party_id` | `bigint` | no | — | |
| `family_id` | `bigint` | no | — | |
| `effective_from` | `date` | no | — | |
| `effective_until` | `date` | yes | — | null = current |
| `is_current` | `boolean` | no | `true` | kept equal to `effective_until is null` |

- FK → `parties(id)`, `customer_families(id)`, both `on delete restrict`
- CK `ck_pfm_current_consistent`: `is_current = (effective_until is null)`
- CK `ck_pfm_dates`: `effective_until is null or effective_until >= effective_from`
- UK (partial) `uk_pfm_one_current (party_id) where is_current`
- UK `uk_pfm_id_party (id, party_id)` *(composite-FK operand)*
- IX `ix_pfm_family (family_id)`, IX `ix_pfm_party_current (party_id) where is_current`
- Mutability: append-only; a reassignment closes the current row and inserts a new one, in one
  transaction.

**`customer_locations`** — canonical site entity (CDM-08). Scope: party.

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `location_code` | `text` | no | — | sequence beneath Customer Code (CDM-07) |
| `current_party_id` | `bigint` | no | — | |
| `is_bill_to` | `boolean` | no | `false` | |
| `is_ship_to` | `boolean` | no | `false` | |
| `location_type` | `text` | **yes** | — | descriptive only (CDM-08) |
| `status` | `text` | no | `'proposed'` | |

- FK `fk_location_party (current_party_id) → parties(id) on delete restrict`
- UK `uk_location_code (location_code)`
- CK `ck_location_type`: `location_type is null or location_type in ('plant','office','warehouse','other')`
- CK `ck_location_role`: `is_bill_to or is_ship_to`
- CK `ck_location_status`: `status in ('proposed','active','inactive')`
- IX `ix_location_party (current_party_id)`
- **No GST/PAN/CIN/invoice columns** (CDM-01).

**`customer_location_versions`** — immutable descriptive/address versions; also carries parentage, so
a reassignment is a new version and no separate history table is needed (§2 rationale).

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `location_id` | `bigint` | no | — | |
| `version_no` | `integer` | no | — | |
| `party_id` | `bigint` | no | — | parent at this version |
| `effective_from` | `date` | no | — | |
| `address_line`, `city`, `state`, `postal_code` | `text` | yes | — | may stay blank (CDM-08) |

- FK → `customer_locations(id)`, `parties(id)`, both `restrict`
- UK `uk_clv_version (location_id, version_no)`
- IX `ix_clv_location (location_id)`
- **Immutable.** No UPDATE or DELETE policy; a correction inserts a new version (CDM-31/PM-3).

### 4.3 Family C — Product definition

**`constructions`** — globally shareable (CDM-12). Scope: group.

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `construction_code` | `text` | **yes** | — | assigned at publication, e.g. `CON-000125` |
| `name` | `text` | no | — | **deliberately not unique** (CDM-12) |
| `status` | `text` | no | `'proposed'` | |
| `surviving_construction_id` | `bigint` | yes | — | on merge (CDM-12) |

- UK `uk_construction_code (construction_code)` · UK `uk_construction_id_status (id, status)` *[scope]*
- CK `ck_construction_status`: `status in ('proposed','published','merged')`
- CK `ck_construction_published_has_code`: `status <> 'published' or construction_code is not null`
- IX `ix_construction_name (lower(name))`
- Lifecycle: `proposed → published | merged` (CDM-12).

**`construction_versions`** — immutable technical definition.

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `construction_id` | `bigint` | no | — | |
| `version_no` | `integer` | no | — | |
| `ply` | `integer` | no | — | |
| `flute_f1`, `flute_f2` | `text` | yes | — | |
| `layer_top_code` … `layer_l2_code` | `text` | yes | — | five layers |
| `layer_top_gsm` … `layer_l2_gsm` | `numeric(8,2)` | yes | — | |
| `board_gsm` | `numeric(8,2)` | yes | — | |
| `approved_by` | `bigint` | yes | — | |
| `approved_at` | `timestamptz` | yes | — | |
| `effective_from` | `date` | yes | — | |

- FK `fk_cv_construction (construction_id) → constructions(id) on delete restrict`
- UK `uk_cv_version (construction_id, version_no)` · UK `uk_cv_id_construction (id, construction_id)` *[scope]*
- IX `ix_cv_construction (construction_id)`
- **Immutable once `approved_at` is set.** A technical change is a new version (CDM-12).

> **CDM-13 made structural.** There is **no** `waste`, `conv_rate`, `waste_pp` or `conv_rate_pp`
> column here. The live engine reads exactly those from the construction —
> `waste:constEntry.waste??prof.waste??5` (`engine/costing.js:201-204`) — placing Construction
> *above* the Batch Profile in a chain CDM-19 does not contain. Omitting the columns is what makes
> the hidden tier unimportable (CDM-37) rather than merely unused.

**`plant_construction_adoptions`** — formal Batch use requires adoption of an exact version (CDM-12).

`plant_id`, `construction_version_id`, `status text default 'adopted'` CK `in ('adopted','withdrawn')`,
`adopted_by bigint`, `adopted_at timestamptz not null default now()`.
FKs `restrict`. UK `uk_pca_plant_version (plant_id, construction_version_id)`.
IX `ix_pca_plant (plant_id)`, `ix_pca_version (construction_version_id)`.

**`skus`** — Customer-specific, plant-owned, not shareable (CDM-09).

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `plant_id` | `bigint` | no | — | *[scope]* |
| `party_id` | `bigint` | no | — | the Customer (CDM-09) |
| `plant_item_code` | `text` | **yes** | — | no fabricated placeholder (CDM-09/11) |
| `status` | `text` | no | `'proposed'` | |
| `replacement_sku_id` | `bigint` | yes | — | linked, never silently substituted (CDM-11) |

- FK → `plants(id)`, `parties(id)`, `skus(id)` (self, for replacement), all `restrict`
- UK `uk_sku_plant_item (plant_id, plant_item_code)` — multiple nulls permitted
- UK `uk_sku_id_plant (id, plant_id)` *[scope]* · UK `uk_sku_id_party (id, party_id)` *[scope]*
- CK `ck_sku_status`: `status in ('proposed','active','discontinued')`
- CK `ck_sku_not_self_replacement`: `replacement_sku_id is distinct from id`
- IX `ix_sku_plant (plant_id)`, `ix_sku_party (party_id)`, `ix_sku_replacement (replacement_sku_id)`
- Lifecycle: `proposed → active → discontinued`; reactivation returns to `active` preserving identity
  (CDM-11). `plant_id` and `party_id` immutable once the SKU appears on an issued Quote (trigger).
- **No unique constraint over the technical spec** — similar specs warn, never block (CDM-10).

**`sku_versions`** — immutable spec version; sole authority for its Construction (CDM-13).

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `sku_id` | `bigint` | no | — | |
| `version_no` | `integer` | no | — | |
| `construction_version_id` | `bigint` | **no** | — | **CDM-13 as a `not null` FK** |
| `is_price_driving` | `boolean` | no | — | CDM-10 |
| `length_mm`, `width_mm`, `height_mm` | `numeric(10,2)` | yes | — | |
| `box_type` | `text` | no | `'RSC'` | |
| `ups` | `integer` | no | `1` | |
| `spec_bs`, `spec_bct`, `spec_ect` | `numeric(10,2)` | yes | — | |
| `approved_by`, `approved_at` | | yes | — | |

- FK → `skus(id)`, `construction_versions(id)`, both `restrict`
- UK `uk_skuv_version (sku_id, version_no)` · UK `uk_skuv_id_sku (id, sku_id)` *[scope]*
- IX `ix_skuv_sku (sku_id)`, `ix_skuv_construction_version (construction_version_id)`
- **Immutable once approved.**

**`sku_external_references`** — Customer Item Code and aliases; optional, searchable,
non-authoritative (CDM-10). `sku_id`, `reference_kind`, `reference_value`, `status`. Not unique.

**`sku_location_applicabilities`** — where a SKU may be quoted (CDM-11).
`sku_id`, `location_id`, `scope text` CK `in ('master','batch_only')`, `status text` CK
`in ('proposed','approved','withdrawn')`, `approved_by`, `approved_at`.
UK `uk_sla_sku_location_scope (sku_id, location_id, scope)`. IX on both FKs.
A `batch_only` row authorises the Quote without updating the master (CDM-11).

### 4.4 Family D — Commercial masters

All five master families share one shape: a **set** row (identity), an immutable **version** row
(the approvable unit), and where needed **entry** rows hanging off the version. Approved versions are
immutable (CDM-31/PM-3); a correction is a new version.

**`sectors`** — `sector_code text not null`, `name text not null`,
`status text default 'active'` CK `in ('active','inactive')`. UK `uk_sector_code (sector_code)`.

**`sector_versions`** — the tier consulted by CDM-19's chains.

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `sector_id` | `bigint` | no | — | |
| `version_no` | `integer` | no | — | |
| `waste_cbb_pct` | `numeric(7,3)` | yes | — | percentage |
| `waste_pp_pct` | `numeric(7,3)` | yes | — | percentage |
| `conv_box_rate` | `numeric(12,4)` | yes | — | **₹/kg, not a percentage** (§3.1) |
| `conv_pp_rate` | `numeric(12,4)` | yes | — | ₹/kg |
| `margin_pct` | `numeric(7,3)` | **no** | — | approved default target margin per Sector (ruling) |
| `spec_lang` | `text` | yes | — | |
| `status`, `approved_by`, `approved_at` | | | | |

- UK `uk_sectorv_version (sector_id, version_no)`; CK `ck_sectorv_status`: `in ('draft','approved','superseded')`
- `margin_pct` is **`not null`**: the ruling makes a default target margin a property every Sector
  maintains, so there is no "sector without a margin" state to represent. The waste and conversion
  columns stay nullable — a sector may genuinely omit those, and `null` means inherit (CDM-19).
- CK `ck_sectorv_margin_range`: `margin_pct >= 0 and margin_pct < 100`.
- Seeded from `DEFAULT_SECTORS_DATA` (`data/defaults.js:57+`).

**`rate_sets`** — `plant_id` *[scope]*, `name`, `status`. UK `uk_rate_set_id_plant (id, plant_id)`.
**`rate_set_versions`** — `rate_set_id`, `version_no`, `status` CK `in ('draft','approved','withdrawn')`,
`approved_by`, `approved_at`. UK `(rate_set_id, version_no)`, UK `(id, rate_set_id)` *[scope]*.
**`rate_entries`** — `rate_set_version_id`, `grade_code text not null`, `description text`,
`price numeric(12,4) not null`, `discount numeric(12,4) not null default 0`,
`freight numeric(12,4) not null default 0`, `interest_pct numeric(7,3)` **null**.
UK `uk_rate_entry (rate_set_version_id, grade_code)`. FK `on delete cascade` — see §4.7.

**`freight_sets`** — `plant_id bigint not null` *[scope]* → `plants(id) restrict`; `name text not null`;
`status text not null default 'active'` CK `ck_freight_set_status: in ('active','inactive')`.
UK `uk_freight_set_id_plant (id, plant_id)` *[scope]*. IX `ix_freight_set_plant (plant_id)`.

**`freight_set_versions`** — `freight_set_id bigint not null` → `freight_sets(id) restrict`;
`version_no integer not null`; `status text not null default 'draft'` CK
`ck_fsv_status: in ('draft','approved','withdrawn')`; `approved_by bigint` → `app_users(id) restrict`,
null; `approved_at timestamptz`, null; `effective_from date`, null.
UK `uk_fsv_version (freight_set_id, version_no)`; UK `uk_fsv_id_set (id, freight_set_id)` *[scope]*.
IX `ix_fsv_set (freight_set_id)`. **Immutable once `approved_at` is set** (CDM-31/PM-3).

**`freight_entries`** — `freight_set_version_id`, `origin_plant_id`, `destination_location_id`,
`rate numeric(12,4) not null`. UK `uk_freight_entry (freight_set_version_id, origin_plant_id, destination_location_id)`.
FK `on delete cascade`. **A missing pair is absent, not zero** — this is the silent-zero source
CDM-17 closes.

**`calculation_default_versions`** — the versioned bundle of system fallbacks (CDM-18, CDM-22).

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `version_no` | `integer` | no | — | group-wide |
| `interest_fallback_pct` | `numeric(7,3)` | no | `0.500` | CDM-18 |
| `waste_cbb_fallback_pct` | `numeric(7,3)` | no | `5.000` | |
| `waste_pp_fallback_pct` | `numeric(7,3)` | no | `5.000` | |
| `conv_box_fallback_rate` | `numeric(12,4)` | no | `7.0000` | ₹/kg |
| `conv_pp_fallback_rate` | `numeric(12,4)` | no | `12.5000` | ₹/kg |
| `margin_fallback_pct` | `numeric(7,3)` | no | `8.000` | |
| `rounding_step` | `numeric(8,4)` | no | `0.0500` | `costing.js:84` |
| `engine_version` | `text` | no | — | CDM-22 |
| `rounding_rule_version` | `text` | no | — | CDM-22 |
| `status`, `approved_by`, `approved_at` | | | | |

- UK `uk_cdv_version (version_no)`; CK status `in ('draft','approved','superseded')`
- Defaults above reproduce today's reachable literals, so seeding changes no number (**A-21**).

**`payment_interest_map_entries`** — the approved map (CDM-18), a **closed list** by ruling.

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `calculation_default_version_id` | `bigint` | no | — | |
| `credit_days` | `integer` | no | — | closed-list key, or band upper bound |
| `interest_pct` | `numeric(7,3)` | no | — | |

- FK `on delete cascade` (draft-version editing unit, §4.7)
- UK `uk_pime (calculation_default_version_id, credit_days)`
- CK `ck_pime_days_positive`: `credit_days > 0`
- Seed 30→0.500, 45→0.750, 60→1.000, 90→1.500.
- CK `ck_pime_closed_list`: `credit_days in (30,45,60,90)` — the ruling made structural. A value
  outside the list cannot be stored, so "other wording is descriptive only" is enforced by the
  database rather than by convention.
- CK `ck_pime_interest_range`: `interest_pct >= 0 and interest_pct < 100`.
- There is **no** `is_open_ended` column and no band semantics: lookup is exact-match on
  `credit_days`, and a miss falls to `calculation_default_versions.interest_fallback_pct` (0.500).
- Opening the list later would be a migration plus a new map version, not a configuration change.
  That is the intended friction: the four rates are approved commercial data.

### 4.5 Family E — Pricing basis **[amendment 3]**

Revision 1 proposed `pricing_basis_components(component_type, component_version_id)` — a polymorphic
reference with **no foreign key**, permitting a missing component or one pointing at the wrong table.
That is replaced by four typed `not null` FKs on the Release itself. CDM-26 requires all four
components in every Release, so `not null` also enforces the arity that the components table could
not.

**`pricing_basis_releases`** — immutable approved bundle, plant-specific (CDM-26).

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `plant_id` | `bigint` | no | — | *[scope]* |
| `release_name` | `text` | yes | — | descriptive |
| `effective_from` | `date` | no | — | |
| `effective_until` | `date` | yes | — | null = open-ended |
| `is_automatic_default` | `boolean` | no | `false` | CDM-26 |
| `rate_set_version_id` | `bigint` | **no** | — | typed FK |
| `freight_set_version_id` | `bigint` | **no** | — | typed FK |
| `sector_version_id` | `bigint` | **no** | — | typed FK |
| `calculation_default_version_id` | `bigint` | **no** | — | typed FK |
| `status` | `text` | no | `'draft'` | |
| `proposed_by`, `approved_by` | `bigint` | | — | normally different (CDM-27) |
| `approved_at`, `withdrawn_at` | `timestamptz` | yes | — | |

- FK to each of the four version tables, `on delete restrict`
- FK `fk_pbr_plant (plant_id) → plants(id) restrict`
- CK `ck_pbr_status`: `status in ('draft','approved','withdrawn')`
- CK `ck_pbr_dates`: `effective_until is null or effective_until >= effective_from`
- CK `ck_pbr_default_requires_approved`: `not is_automatic_default or status = 'approved'`
- IX `ix_pbr_plant_effective (plant_id, effective_from)`, `ix_pbr_status (status)`
- **Immutable once approved** except `status → 'withdrawn'` and `withdrawn_at` (CDM-26).

*"All components must already be approved"* (§3.4) still cannot be a check constraint, because a CHECK
may not contain a subquery. It is enforced in the approval RPC **and** re-asserted by a `pgtap` test
per component type (§14). This is a genuine residual, recorded in §17 as open technical verification.

**Default-coverage exclusivity.** Alternatives may overlap; only defaults may not (CDM-26, §3.4):

```sql
create extension if not exists btree_gist;
alter table pricing_basis_releases add constraint ex_pbr_default_no_overlap
  exclude using gist (
    plant_id with =,
    daterange(effective_from, coalesce(effective_until,'infinity'::date), '[]') with &&
  ) where (is_automatic_default and status = 'approved');
```

`btree_gist` is available at 1.7 and not installed (§1.1). Installing it is a schema change requiring
approval in S5. I recommend the constraint over an RPC-only check because §2 requires enforcement
rather than documentation, and an RPC check is silently bypassed by any later write path that forgets
to call it.


### 4.6 Family F — Batch workspace

**`batches`** — one Family, one Plant, mutable until issue (CDM-14).

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `batch_reference` | `text` | no | — | `Plant/BAT/FY/seq` (CDM-14) |
| `family_id` | `bigint` | no | — | exactly one (CDM-14) |
| `plant_id` | `bigint` | no | — | *[scope]*, exactly one |
| `owner_user_id` | `bigint` | no | — | CDM-32 |
| `sector_id` | `bigint` | yes | — | drives the Sector tier (CDM-19) |
| `status` | `text` | no | `'working'` | |
| `price_validity_from`, `price_validity_to` | `date` | yes | — | whole-Batch, optional (CDM-29) |
| `content_version` | `integer` | no | `1` | CAS token; **never touched by heartbeat** (A-23) |

- FK → `customer_families(id)`, `plants(id)`, `app_users(id)`, `sectors(id)`, all `restrict`
- UK `uk_batch_reference (batch_reference)` · UK `uk_batch_id_plant (id, plant_id)` *[scope]*
  · UK `uk_batch_id_family (id, family_id)` *[scope]*
- CK `ck_batch_status`: `status in ('working','sent','submitted','approved','issued_locked','abandoned','archived')`
- CK `ck_batch_validity_dates`: `price_validity_to is null or price_validity_to >= price_validity_from`
- IX `ix_batch_plant (plant_id)`, `ix_batch_owner (owner_user_id)`, `ix_batch_family (family_id)`,
  `ix_batch_status (status)`
- Lifecycle: `working → sent → submitted → approved → issued_locked`, with `submitted → working`
  (Checker Return, CDM-33) and `approved → working` (Withdraw, CDM-24). `issued_locked → working`
  only via Create Revision (CDM-24). `abandoned` and `archived` are terminal/reversible respectively
  (CDM-30).
- Mutability: guarded by `content_version` CAS on every write.

**`batch_collaborators`** — `batch_id`, `app_user_id`, `status text` CK `in ('active','removed')`.
UK (partial) `uk_batch_collab_active (batch_id, app_user_id) where status='active'`.
IX `ix_batch_collab_user (app_user_id, batch_id) where status='active'` — RLS hot path (§7).

**`batch_profile_versions`** — append-only profile history with one current pointer (§3.5).

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `batch_id` | `bigint` | no | — | |
| `version_no` | `integer` | no | — | |
| `waste_cbb_pct`, `waste_pp_pct` | `numeric(7,3)` | **yes** | — | `null` = inherit (CDM-19) |
| `conv_box_rate`, `conv_pp_rate` | `numeric(12,4)` | **yes** | — | ₹/kg; `null` = inherit |
| `margin_box_pct`, `margin_pp_pct` | `numeric(7,3)` | **yes** | — | `null` = inherit |
| `is_current` | `boolean` | no | `true` | |

- FK `restrict`. UK `uk_bpv_version (batch_id, version_no)`;
  UK (partial) `uk_bpv_one_current (batch_id) where is_current`
- **Every value column is nullable and defaults to nothing.** This is D-25 at the storage boundary:
  a blank profile field is `null`, and only `null` advances the chain (§10.2).
- Immutable per version; a profile edit inserts a version and moves the current pointer.

**`pricing_groups`** — owns the single calculating freight, plus Payment Terms and Interest
(CDM-17, CDM-18).

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `batch_id` | `bigint` | no | — | *[scope]* |
| `label` | `text` | yes | — | optional, editable, not a key (CDM-16) |
| `freight_mode` | `text` | no | `'master'` | |
| `freight_basis_delivery_group_id` | `bigint` | yes | — | internal identity, never a name (**A-10**) |
| `freight_manual_value` | `numeric(12,4)` | yes | — | required iff mode `manual` |
| `payment_terms_days` | `integer` | yes | — | the **structured** driver; `null` or one of 30/45/60/90 (CDM-18) |
| `payment_terms_text` | `text` | yes | — | descriptive; **never calculates** (CDM-18) |
| `interest_override_pct` | `numeric(7,3)` | yes | — | `null` = inherit, `0` = explicit zero |
| `status` | `text` | no | `'active'` | |
| `content_version` | `integer` | no | `1` | |

- FK `fk_pg_batch (batch_id) → batches(id) restrict`
- FK `fk_pg_freight_basis (freight_basis_delivery_group_id, id) → delivery_groups(id, pricing_group_id) on delete restrict`
  — **composite**, so the basis must belong to *this* group (§5.4)
- UK `uk_pg_id_batch (id, batch_id)` *[scope]*
- CK `ck_pg_freight_mode`: `freight_mode in ('master','manual','ex_factory')`
- CK `ck_pg_manual_value`: `freight_mode <> 'manual' or freight_manual_value is not null`
- CK `ck_pg_exfactory_no_basis`: `freight_mode <> 'ex_factory' or freight_basis_delivery_group_id is null`
- CK `ck_pg_interest_non_negative`: `interest_override_pct is null or interest_override_pct >= 0`
- CK `ck_pg_payment_terms_closed`: `payment_terms_days is null or payment_terms_days in (30,45,60,90)`
  — a non-list credit period is unstorable as a *calculating* value; it belongs in
  `payment_terms_text`, which never calculates (ruling, CDM-18)
- IX `ix_pg_batch (batch_id)`
- Insert order: create the group with a null basis, insert its Delivery Groups, then set the basis —
  all in one transaction. **No deferrable constraint is needed**, so a violation fails immediately
  rather than at commit.

**`delivery_groups`** — presentation only (**A-14**, CDM-16).

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `pricing_group_id` | `bigint` | no | — | *[scope]* |
| `batch_id` | `bigint` | no | — | *[scope]*, for the same-Batch composite FK |
| `label` | `text` | yes | — | |
| `bill_to_location_id` | `bigint` | yes | — | may be external third party (CDM-08) |
| `ship_to_location_id` | `bigint` | yes | — | may be external third party |
| `route_notes` | `text` | yes | — | |
| `status` | `text` | no | `'active'` | |

- FK `fk_dg_pg (pricing_group_id, batch_id) → pricing_groups(id, batch_id) on delete restrict`
- FK → `customer_locations(id)` ×2, `restrict`
- UK `uk_dg_id_pg (id, pricing_group_id)` — the operand for `fk_pg_freight_basis`
- CK `ck_dg_status`: `status in ('active','removed')`
- IX `ix_dg_pg (pricing_group_id)`, `ix_dg_bill_to (bill_to_location_id)`, `ix_dg_ship_to (ship_to_location_id)`
- **`on delete restrict` on the freight-basis FK is A-11**: the Delivery Group serving as basis
  cannot be removed out from under the calculation. Clearing its *location* is a different act,
  caught by the resolver, which blocks (§10.2).

**`batch_rows`** — the calculating unit.

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `lineage_id` | `bigint` | no | — | stable across revisions (CDM-22); the PM-7 target |
| `batch_id` | `bigint` | no | — | *[scope]* |
| `plant_id` | `bigint` | no | — | *[scope]*, for SKU-plant equality (§5.1) |
| `pricing_group_id` | `bigint` | no | — | |
| `sku_id`, `sku_version_id` | `bigint` | no | — | pinned version (CDM-10) |
| `proposed_construction_version_id` | `bigint` | **yes** | — | **only** for a Quote-specific proposal (CDM-13) |
| `material_code` | `text` | yes | — | free text, **not unique** (§5.7) |
| `row_type` | `text` | no | `'box'` | |
| `waste_override_pct`, `margin_override_pct` | `numeric(7,3)` | yes | — | `null` = inherit, `0` = explicit |
| `conv_override_rate` | `numeric(12,4)` | yes | — | ₹/kg; `null` = inherit, `0` = explicit |
| `freight_override` | `numeric(12,4)` | yes | — | `null` = inherit, `0` = explicit |
| `sales_moq`, `volume` | `bigint` | yes | — | |
| `status` | `text` | no | `'active'` | removal reversible (CDM-14) |
| `content_version` | `integer` | no | `1` | |

- FK `fk_row_batch (batch_id) → batches(id) restrict`
- FK `fk_row_pg (pricing_group_id, batch_id) → pricing_groups(id, batch_id) restrict` (§5.3)
- FK `fk_row_batch_plant (batch_id, plant_id) → batches(id, plant_id) restrict` (§5.1)
- FK `fk_row_sku_plant (sku_id, plant_id) → skus(id, plant_id) restrict` (§5.1)
- FK `fk_row_sku_version (sku_version_id, sku_id) → sku_versions(id, sku_id) restrict` (§5.8)
- FK `fk_row_proposed_cv (proposed_construction_version_id) → construction_versions(id) restrict`
- UK `uk_row_lineage (lineage_id)` — the unique target `quote_items` requires (§5.10)
- UK `uk_row_id_batch (id, batch_id)` *[scope]* · UK `uk_row_id_type (id, row_type)` *[scope]* (§5.6)
- CK `ck_row_type`: `row_type in ('box','plate','part_l','part_w','other')`
- CK `ck_row_status`: `status in ('active','removed')`
- CK `ck_row_overrides_non_negative`: each override `is null or >= 0`
- IX `ix_row_batch (batch_id)`, `ix_row_pg (pricing_group_id)`, `ix_row_sku (sku_id)`,
  `ix_row_lineage (lineage_id)`

**`batch_sets`** — CDM-20 plus A-9, A-15, A-16, A-20.

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `batch_id` | `bigint` | no | — | *[scope]* |
| `box_row_id` | `bigint` | no | — | exactly one Box parent |
| `box_row_type` | `text` | no | `'box'` | generated-constant, forces the parent to be a Box (§5.6) |
| `set_code` | `text` | no | — | mandatory (CDM-20) |
| `status` | `text` | no | `'active'` | |
| `active_component_count` | `integer` | no | `0` | trigger-maintained; enforces cardinality (§5.9) |

- FK `fk_set_batch (batch_id) → batches(id) restrict`
- FK `fk_set_box_row (box_row_id, batch_id) → batch_rows(id, batch_id) restrict` (§5.5)
- FK `fk_set_box_is_box (box_row_id, box_row_type) → batch_rows(id, row_type) restrict` (§5.6)
- UK `uk_set_id_batch (id, batch_id)` *[scope]* · UK `uk_set_box_row (box_row_id)` — one SET per Box
- CK `ck_set_code_not_blank`: `btrim(set_code) <> ''`
- CK `ck_set_box_row_type`: `box_row_type = 'box'`
- CK `ck_set_status`: `status in ('active','dissolved')`
- CK `ck_set_active_has_component`: `status <> 'active' or active_component_count >= 1` (§5.9)
- **UK `uk_set_code_normalised (batch_id, upper(btrim(set_code)))` — unconditional** (A-16). It
  mirrors `normSetCode=v=>(v||"").trim().toUpperCase()` (`engine/rowType.js:32`), which
  `scripts/audit-setcode.py` exists to keep as the only comparison. A raw-text index would let `abc`
  and `ABC` coexist in the database while the application treats them as one SET — a ninth
  comparison site, in the one layer the audit gate cannot see.
- Because the index is unconditional, **dissolved SETs keep reserving their code** (CDM-20).
  Dissolution is a status change, never a delete, so identity and label survive reactivation (A-9),
  and dissolved rows stay readable and therefore relabellable (A-15).

**`batch_set_memberships`** — components only; the Box is `batch_sets.box_row_id`, not a membership.

`set_id`, `row_id`, `batch_id` *[scope]*, `role text` CK `in ('plate','partition','other')`,
`status text` CK `in ('active','removed')`.
FK `fk_bsm_set (set_id, batch_id) → batch_sets(id, batch_id) restrict`;
FK `fk_bsm_row (row_id, batch_id) → batch_rows(id, batch_id) restrict` (§5.5).
UK (partial) `uk_bsm_active (set_id, row_id) where status='active'`.
IX `ix_bsm_set (set_id)`, `ix_bsm_row (row_id)`.

**`batch_calculations`** — replaceable working result (CDM-22).

`batch_row_id` **UK** (one current per row), `calculation_fingerprint text not null`,
`presentation_fingerprint text not null`, `engine_version text not null`,
`schema_version integer not null`, `effective_inputs jsonb not null`, `results jsonb not null`,
`computed_by bigint`, `computed_at timestamptz not null default now()`.
FK `on delete cascade` from `batch_rows` — **the one place a Batch child cascades**, justified in §4.7.
IX `ix_bc_row (batch_row_id)`.

**`batch_edit_locks`** — **A-23**, entirely separate from `batches.content_version`.

`batch_id` **UK**, `holder_user_id`, `acquired_at timestamptz not null default now()`,
`heartbeat_at timestamptz not null default now()`, `released_at timestamptz`.
FK `restrict`. IX `ix_bel_heartbeat (heartbeat_at)`.
Staleness is evaluated **server-side only** (A-24) from `now() - heartbeat_at`, with the interval
read from `operational_settings.edit_lock_stale_seconds`. Reclaim is one conditional statement so two
racing reclaims cannot both win:

```sql
update batch_edit_locks
   set holder_user_id = :caller, acquired_at = now(), heartbeat_at = now()
 where batch_id = :b
   and holder_user_id = :expected_holder
   and now() - heartbeat_at > (:stale_seconds * interval '1 second')
returning id;   -- zero rows = someone else won; the caller must not proceed
```

### 4.7 Family G — Quote and evidence

**`quote_families`** — `batch_id` **UK** (one family per Batch, CDM-21),
`quote_reference text` **nullable** until first approval, `status text` CK
`in ('draft','active','abandoned')`. UK `uk_qf_reference (quote_reference)`.
CDM-30's rule — an abandoned pre-approval family consumes no Quote Reference — is exactly
`quote_reference is null` at abandonment, enforced by
CK `ck_qf_abandoned_unreferenced`: `status <> 'abandoned' or quote_reference is null`.

**`quote_revisions`**

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `family_id` | `bigint` | no | — | *[scope]* |
| `revision_no` | `integer` | **yes** | — | allocated at first approval (CDM-21) |
| `source_revision_id` | `bigint` | yes | — | linear only (CDM-21) |
| `workflow_status` | `text` | no | `'draft'` | |
| `standing` | `text` | yes | — | set at issue |
| `addressee_name` | `text` | yes | — | frozen at issue (CDM-24) |
| `addressee_details` | `jsonb` | yes | — | frozen at issue |
| `quote_date` | `date` | yes | — | |
| `offer_validity_to` | `date` | yes | — | from Quote Date (CDM-29) |
| `approved_by`, `approved_at`, `issued_by`, `issued_at`, `voided_by`, `voided_at` | | yes | — | |
| `void_reason`, `withdraw_reason`, `return_note` | `text` | yes | — | mandatory where CDM says so |

- FK → `quote_families(id)`, self (`source_revision_id`), `app_users(id)`, all `restrict`
- UK `uk_qr_revision (family_id, revision_no)` · UK `uk_qr_id_family (id, family_id)` *[scope]*
- CK `ck_qr_workflow`: `workflow_status in ('draft','submitted','returned','approved','issued','withdrawn')`
- CK `ck_qr_standing`: `standing is null or standing in ('current','superseded','voided')`
- CK `ck_qr_approved_has_revision_no`: `workflow_status not in ('approved','issued') or revision_no is not null`
- CK `ck_qr_void_reason`: `standing <> 'voided' or void_reason is not null` (CDM-30)
- CK `ck_qr_not_self_source`: `source_revision_id is distinct from id`
- IX `ix_qr_family (family_id)`, `ix_qr_status (workflow_status)`, `ix_qr_source (source_revision_id)`
- **Immutable after issue** except `standing` and the void columns (CDM-24).

**`quote_items`** — immutable (CDM-02, CDM-22).

`revision_id`, `batch_row_lineage_id bigint not null`, `pricing_group_id bigint not null`,
`calculation_snapshot_id bigint not null`.
FK `fk_qi_revision → quote_revisions(id) restrict`;
FK `fk_qi_lineage (batch_row_lineage_id) → batch_rows(lineage_id) restrict` (§5.10);
FK `fk_qi_snapshot (calculation_snapshot_id) → calculation_snapshots(id) restrict`.
UK `uk_qi_revision_lineage (revision_id, batch_row_lineage_id)` — one item per row per revision.
UK `uk_qi_snapshot (calculation_snapshot_id)` — a snapshot serves exactly one item (§5.10).
IX `ix_qi_revision (revision_id)`, `ix_qi_lineage (batch_row_lineage_id)`.
**No UPDATE and no DELETE policy will exist** (§7.4) — that absence is the structural form of
"Quote Items cannot calculate or edit".

**`quote_item_delivery_groups`** — `quote_item_id`, `delivery_group_id`.
UK `uk_qidg (quote_item_id, delivery_group_id)`. FKs `restrict`. One item covers every same-priced
Delivery Group and is not repeated per destination (CDM-16).

**`calculation_snapshots`** — immutable evidence (CDM-22). Column list in §11.1.
FK `fk_cs_release → pricing_basis_releases(id) restrict`. **No UPDATE/DELETE policy.**

**`quote_workflow_events`** — append-only. `revision_id`, `event_type text` CK
`in ('submitted','returned','approved','withdrawn','issued','voided','superseded','archived')`,
`actor_user_id`, `occurred_at timestamptz`, `note text`.
IX `ix_qwe_revision (revision_id, occurred_at)`.

**`customer_outcome_events`** — append-only (CDM-28). `revision_id`, `outcome text` CK
`in ('awaiting_response','accepted','rejected','expired')`, `acceptance_date date`,
`acceptance_reference text`, `note text`, `recorded_by`, `occurred_at`.
IX `ix_coe_revision (revision_id, occurred_at)`.
Standing and outcome are independent — an Accepted revision may later be Superseded (CDM-28).

**`export_events`** — `revision_id`, `template_name text`, `template_version text`,
`is_official boolean not null`, `mismatch_acknowledged boolean not null default false`,
`acknowledgement_note text`, `representative_choices jsonb`, `exported_by`, `exported_at`.
CK `ck_ee_ack`: `not mismatch_acknowledged or acknowledgement_note is not null` (CDM-36).
**`export_parts`** — `export_event_id`, `part_name text`, `part_kind text`, `sequence_no integer`.
FK `on delete cascade` — parts belong wholly to one event and no event is deletable post-cutover.

### 4.8 Family H — Infrastructure

**`audit_events`** — append-only. `actor_user_id`, `occurred_at timestamptz not null default now()`,
`action text not null`, `entity_table text not null`, `entity_id bigint not null`,
`before jsonb`, `after jsonb`, `reason text`.
IX `ix_audit_entity (entity_table, entity_id, occurred_at)`, `ix_audit_actor (actor_user_id, occurred_at)`.
Stores *material* before/after only; immutable snapshots are not duplicated into it (§3.7).

**`reference_sequences`** — `scope_type text not null`, `scope_key bigint not null`,
`fy_label text not null default ''`, `next_value bigint not null default 1`.
UK `uk_refseq (scope_type, scope_key, fy_label)`.
CK `ck_refseq_positive`: `next_value >= 1`. Lives in **`ref_private`**, with an explicit
`revoke all ... from anon, authenticated`; no client grant of any kind (§7.2, §9).

**`master_change_requests`** — proposal workflow where a typed version table cannot carry review
state (CDM-31). `entity_table text`, `entity_id bigint`, `proposed_by`, `reviewed_by`,
`status text` CK `in ('proposed','approved','returned','withdrawn')`, `payload jsonb`, `note text`.

### 4.9 Deletion actions — the complete cascade inventory

Every FK in §4 is `on delete restrict` **except** the four below. Each is inside a single editing
aggregate that has never been published, and none is reachable once approved:

| Child → Parent | Why cascade is correct |
|---|---|
| `rate_entries → rate_set_versions` | A draft version and its entries are one editing unit. Approved versions are immutable (CDM-31) and unreachable by any delete path |
| `freight_entries → freight_set_versions` | as above |
| `payment_interest_map_entries → calculation_default_versions` | as above |
| `batch_calculations → batch_rows` | A working calculation is worthless without its row and is explicitly replaceable pre-Send (CDM-22). Frozen evidence lives in `calculation_snapshots`, which is `restrict` |
| `export_parts → export_events` | Parts are meaningless alone; post-cutover neither is deletable |

Nothing under `batches`, `quote_*`, `audit_events` or any approved master cascades.

---

## 5. Database enforcement of cross-table invariants

The technique throughout is a **composite foreign key against a redundant scope column**, backed by a
matching composite unique key on the parent. This makes "same Batch" and "same plant" structural. Where
a composite FK is the *wrong* tool — because the rule is point-in-time rather than invariant — I say so
and propose a trigger instead, with the reason.

| # | Invariant | Mechanism |
|---|---|---|
| 5.1 | **SKU plant == Batch plant** | `batch_rows.plant_id` *[scope]* + `fk_row_batch_plant (batch_id, plant_id) → batches(id, plant_id)` + `fk_row_sku_plant (sku_id, plant_id) → skus(id, plant_id)`. Both FKs bind the same column, so the two plants must be equal. **Fully DB-enforced** |
| 5.3 | **Batch Row and Pricing Group in the same Batch** | `fk_row_pg (pricing_group_id, batch_id) → pricing_groups(id, batch_id)`. **Fully DB-enforced** |
| 5.4 | **Delivery Group and freight basis in the same Pricing Group** | `fk_dg_pg (pricing_group_id, batch_id) → pricing_groups(id, batch_id)` and `fk_pg_freight_basis (freight_basis_delivery_group_id, id) → delivery_groups(id, pricing_group_id)`. **Fully DB-enforced**, and `on delete restrict` is A-11 |
| 5.5 | **SET Box and component rows in the same Batch** | `fk_set_box_row (box_row_id, batch_id) → batch_rows(id, batch_id)`; `fk_bsm_row (row_id, batch_id)` and `fk_bsm_set (set_id, batch_id)` likewise. **Fully DB-enforced** |
| 5.6 | **The SET parent row is a Box** | `batch_rows` gains UK `(id, row_type)`; `batch_sets.box_row_type text not null default 'box'` with CK `= 'box'` and `fk_set_box_is_box (box_row_id, box_row_type) → batch_rows(id, row_type)`. A non-Box parent has no matching parent key. **Fully DB-enforced** |
| 5.8 | **SKU version belongs to the selected SKU** | `fk_row_sku_version (sku_version_id, sku_id) → sku_versions(id, sku_id)`. **Fully DB-enforced** |
| 5.10 | **Quote Item lineage and snapshot have valid unique targets** | `batch_rows` UK `(lineage_id)` makes it a legal FK target; `quote_items.batch_row_lineage_id → batch_rows(lineage_id) restrict`; `uk_qi_snapshot (calculation_snapshot_id)` makes the snapshot 1:1. **Fully DB-enforced** |

Three invariants cannot be composite FKs. Each is argued rather than asserted.

### 5.2 SKU Customer belongs to the Batch Family — **trigger, and a FK would be wrong**

CDM-06 and design DM-187 make this a rule **at row addition**: *"Later Family reassignment preserves
existing work and warns rather than deleting/re-parenting it."*

A composite FK would enforce it **continuously**. The moment a Party was reassigned to another Family
(CDM-07 permits this, effective-dated), every existing Batch row referencing that Party's SKU would
violate the constraint, and the reassignment would either fail or cascade — both of which destroy
work CDM-06 explicitly protects. A permanent constraint is therefore not merely awkward here; it
contradicts an approved rule.

**Proposal:** a `before insert` trigger on `batch_rows` that resolves the SKU's Party, reads its
`is_current` membership from `party_family_memberships`, and raises unless it equals
`batches.family_id`. Updates to `sku_id` are blocked separately (a row changes SKU by replacement,
not mutation — CDM-11). Reassignment afterwards leaves existing rows untouched and is surfaced as a
warning by the application, exactly as CDM-06 requires.

### 5.7 Proposed Construction is mutually exclusive with SKU Construction authority — **trigger**

CDM-13: a Batch row holds a Construction reference **only** for a Quote-specific *Proposed*
Construction; otherwise the published SKU spec version is sole authority.

The FK-only route is a chain of denormalised status columns cascading
`constructions.status → construction_versions → batch_rows`, with a check that
`proposed_construction_version_id is null or proposed_construction_status = 'proposed'`. It is
expressible, but it has an unacceptable consequence: **publishing the Construction would then violate
the check on every open row still pointing at it**, so `ON UPDATE CASCADE` would make publication
fail. CDM-12 explicitly permits publication while Quote-specific proposals exist, so the elegant
constraint would forbid an approved operation.

**Proposal:** a `before insert or update` trigger on `batch_rows` asserting that, *at the time of
write*, `proposed_construction_version_id` is null or its Construction has `status='proposed'`.
Publication later is unaffected; the row keeps its pinned version, which is what CDM-10's pinning
rule wants anyway.

### 5.9 Active SET cardinality — **counter column plus trigger**

"An active SET has at least one component" is an aggregate over a child table, which a CHECK cannot
express. Rather than leave it to the application, `batch_sets.active_component_count integer not null
default 0` is maintained by an `after insert/update/delete` trigger on `batch_set_memberships`, and
the rule becomes an ordinary check:

```sql
constraint ck_set_active_has_component
  check (status <> 'active' or active_component_count >= 1)
```

This is genuinely database-enforced — no write path can produce an active empty SET — and it makes
CDM-20's dissolve/reactivate transition mechanical: the counter reaching 0 drives `status='dissolved'`,
and rising to 1 restores `'active'` **on the same row**, preserving identity and label (A-9, A-15).

---

## 6. Relationship diagram

```text
FAMILY A                                    FAMILY B
avadhoot_groups ─1─* plants                 customer_families ─1─* customer_family_aliases
      │                                            │  ▲ surviving_family_id (self)
app_users ─*─ plant_capability_grants ─*─ capabilities   │
      └─*─ group_capability_grants ──────────┘     └─1─* party_family_memberships *─1─ parties
      │                                                    (exactly one is_current)      │  ▲ self-merge
operational_settings ─*─1 plants                                parties ─1─* party_external_references
                                                                parties ─1─* customer_locations ─1─* customer_location_versions

FAMILY C
constructions ─1─* construction_versions ─*─* plant_construction_adoptions *─1─ plants
                            ▲
                            │ not null  (CDM-13: the SKU spec owns its Construction)
skus ─1─* sku_versions ─────┘        skus *─1─ plants     skus *─1─ parties
  ├─* sku_external_references
  └─* sku_location_applicabilities *─1─ customer_locations

FAMILY D + E
sectors ─1─* sector_versions ────────────────┐
rate_sets ─1─* rate_set_versions ─1─* rate_entries
freight_sets ─1─* freight_set_versions ─1─* freight_entries
calculation_default_versions ─1─* payment_interest_map_entries
        └────► pricing_basis_releases  (four typed NOT NULL FKs — amendment 3) *─1─ plants

FAMILY F                       one Batch = one Family + one Plant (CDM-14)
customer_families ─1─* batches *─1─ plants ;  batches *─1─ app_users (owner) ;  batches *─1─ sectors
   ┌────────────┬──────────────────┬──────────────────┬─────────────┬──────────────┐
   ▼            ▼                  ▼                  ▼             ▼              ▼
batch_        batch_profile_    pricing_groups     batch_rows    batch_sets   batch_edit_locks
collaborators   versions            │  ▲                │            │ box_row_id   (1:1, and
                              freight│  │composite      │            │             separate from
                                basis▼  │(same PG)      │            ▼             content_version)
                                delivery_groups         │      batch_set_memberships
                                     │ bill_to/ship_to  │            │
                                     ▼                  │            └── row_id ──┐
                              customer_locations        └── composite FKs: same Batch, same plant,
                                                             sku_version⊂sku, parent row_type='box'
                              batch_rows ─1─1 batch_calculations   (cascade; pre-Send only)

FAMILY G                        immutable from Send onward (CDM-22)
batches ─1─1 quote_families ─1─* quote_revisions ──┬─* quote_workflow_events
                                    │  ▲ source     ├─* customer_outcome_events
                                    │  (linear)     └─* export_events ─1─* export_parts
                                    ▼
                               quote_items ─1─1 calculation_snapshots *─1─ pricing_basis_releases
                                    │  └─* quote_item_delivery_groups *─1─ delivery_groups
                                    └── batch_row_lineage_id ──► batch_rows.lineage_id   ◄── PM-7

FAMILY H   audit_events (append-only) · reference_sequences (schema ref) · master_change_requests
```

---

## 7. Row-level security

### 7.0 Evidence gathered (read-only, this session)

V-1 and V-2 are resolved below from live introspection rather than assumption. Only `SELECT`
statements against catalog views were run; no DDL, no DML, no `apply_migration`.

| Fact | Value | Consequence |
|---|---|---|
| Owner of `public.profiles` | `postgres` | migration-created objects are postgres-owned |
| Owner of `rls_auto_enable`, `set_updated_at` | `postgres` | so are functions |
| **`postgres.rolbypassrls`** | **`true`** (`rolsuper` false) | **this is what breaks policy recursion** — see §7.2 |
| `authenticated`, `anon`, `authenticator` | `rolbypassrls = false`, `rolsuper = false` | no client role can bypass RLS |
| `service_role.rolbypassrls` | `true` | why §9's allow-list is load-bearing |
| **`app_private` schema already exists** | owner `postgres`; ACL `postgres=UC | authenticated=U` | the project already uses this pattern — adopt it rather than inventing `app` |
| `app_private.is_admin` | exists, `SECURITY DEFINER`, postgres-owned | precedent for the helper design |
| `pgrst.db_schemas` | **not set at database level** | exposed-schema list is project API config, not a DB GUC — see §7.6 |
| `public.profiles` ACL | `anon=arwdDxtm`, `authenticated=arwdDxtm` | **Supabase grants ALL privileges on public tables to `anon` and `authenticated` by default; RLS is the only gate.** See §7.1 |
| `profiles` RLS | `relrowsecurity=true`, `relforcerowsecurity=false` | FORCE is not the current default |
| Existing policies | `profiles_select_own`, `profiles_select_admin_all`, `profiles_update_admin_all`, all `TO authenticated`; no INSERT/DELETE policy | matches the table comment |

Two of these overturn assumptions in revision 2 and are handled below: the **default `GRANT ALL` to
`anon`** (§7.1) and the **real mechanism of recursion-breaking** (§7.2).

### 7.1 Grants — revoking is mandatory, not assumed

Revision 2 said "`anon` receives no grant on any business table" as though that were the default. It
is **not**: this project's existing table shows `anon=arwdDxtm/postgres` — every privilege including
`INSERT`, `UPDATE` and `DELETE`. Supabase's default privileges grant broadly and rely on RLS alone.
A table created without explicit revocation inherits that.

Every schema commit therefore begins with explicit revocation:

```sql
-- run once per new table, in the same commit that creates it (§16.1)
revoke all on public.<table> from anon, authenticated;
grant select                        on public.<table> to authenticated;   -- where §7.5 allows
grant insert, update                on public.<table> to authenticated;   -- only where a policy exists
-- anon is granted nothing, ever, on any business table
```

Grants decide *which statements are possible*; policies decide *which rows*. Both are required:
a table with a permissive policy but no grant is unreadable, and a table with a grant but no policy
is unreadable too (RLS default-denies). The §16.1 assertion checks both.

### 7.2 The recursion problem, and the mechanism that actually solves it — **[ERROR corrected]**

Revision 2 made two claims that were wrong and are withdrawn:

1. That the four authorisation-table policies "call no helper" — while the displayed Family A policies
   plainly used `G(...)` and `U`. **Internally inconsistent.**
2. That a *dedicated owner role holding ordinary `SELECT`* would bypass RLS. **It would not.**
   Postgres bypasses RLS for exactly three cases: the **table owner** (unless `FORCE ROW LEVEL
   SECURITY`), a role with the **`BYPASSRLS`** attribute, and a superuser. An ordinary `SELECT` grant
   confers none of them, so such a helper would re-enter the policy and recurse.

**The resolved model, backed by §7.0:**

| Decision | Value | Why |
|---|---|---|
| Owner of all tables **and** helper functions | **`postgres`** | Verified as the owner of every existing migration-created object. Single owner, no split-ownership complexity |
| Helper security | `SECURITY DEFINER` | Runs as `postgres` |
| **Recursion broken by** | **`postgres.rolbypassrls = true`** (verified) | Inside the definer function `current_user` is `postgres`, which bypasses RLS, so the helper's read of the authorisation tables **does not re-enter their policies**. Termination is guaranteed by the role attribute, not by policy shape |
| `FORCE ROW LEVEL SECURITY` | **on every table in `public`, uniformly** | Because BYPASSRLS (not owner-bypass) does the work, no table needs an exemption. Revision 2's "don't FORCE the four" carve-out is withdrawn — uniform FORCE is simpler and strictly safer |
| Helper schema | **`app_private`** (existing) | Already present, postgres-owned, `authenticated` already has `USAGE`, and it already holds a `SECURITY DEFINER` function. Aligning beats inventing `app` |
| Sequence schema | `ref_private` (new), with explicit `revoke all … from anon, authenticated` | §7.0 shows default grants cannot be assumed |
| `BYPASSRLS` on a new role | **not used** | Granting it requires superuser; `supabase_admin` is the only superuser and is not available to project migrations |

**Because Family A policies may now safely call helpers**, the Family A predicates in §7.5 stand as
written — the inconsistency is resolved in favour of the helpers, not against them.

**The cost, stated plainly.** `postgres` holds `BYPASSRLS`, so **every `SECURITY DEFINER` function
owned by `postgres` is a full-database read primitive**. That is the price of the only supported
mechanism here, and it makes three disciplines load-bearing rather than stylistic:

1. Helper bodies stay minimal — each reads only the authorisation tables and returns a boolean or an
   id. No helper accepts a table name, a column name or free SQL.
2. `set search_path = ''` on every one, with all references schema-qualified, so no search-path
   substitution can redirect a read.
3. **No new `SECURITY DEFINER` function may be added without review**, and §16.1's assertion
   enumerates them so an unreviewed addition fails the build.

**Fallback, if a future review wants a smaller blast radius:** a dedicated `app_authz` role owning
*only* the four authorisation tables, without `BYPASSRLS`, relying on **owner**-bypass — which then
requires those four tables to be `ENABLE`d but **not** `FORCE`d. This is genuinely least-privilege
but splits object ownership across two roles and complicates Supabase's migration tooling, so it is
the fallback rather than the default. The switch is mechanical if wanted.

```sql
create function app_private.has_plant_cap(p_plant bigint, p_cap text)
returns boolean
language sql
stable                      -- lets the planner hoist it out of the row loop
security definer            -- runs as postgres, which has BYPASSRLS -> no recursion
set search_path = ''
as $$
  select exists (
    select 1
      from public.plant_capability_grants g
      join public.capabilities c on c.id = g.capability_id
      join public.app_users     u on u.id = g.app_user_id
     where u.auth_user_id   = (select auth.uid())
       and u.status         = 'active'
       and g.plant_id       = p_plant
       and c.capability_key = p_cap
       and g.status         = 'active');
$$;

revoke execute on function app_private.has_plant_cap(bigint,text) from public;  -- drops the implicit grant
grant  execute on function app_private.has_plant_cap(bigint,text) to authenticated;
```

`revoke … from public` is not optional: Postgres grants `EXECUTE` on new functions to `PUBLIC`, which
includes `anon`. Revoke first, then grant to `authenticated` only — that role **must** hold `EXECUTE`,
because a policy expression is evaluated with the querying role's privileges and would otherwise fail
with `permission denied for function`. (This is the revision-1 error, corrected in revision 2 and
restated here because it is easy to re-break.)

Same shape for `app_private.has_group_cap(text)`, `app_private.current_app_user()`,
`app_private.is_plant_member(bigint)`, `app_private.can_read_batch(bigint)`,
`app_private.can_write_batch(bigint)`.

### 7.3 Negative tests proving the model (S1 gate)

| # | Test | Passes when |
|---|---|---|
| N-1 | `authenticated` calls each helper | **succeeds** — the revision-1 regression guard |
| N-2 | `anon` calls each helper | `permission denied for function` |
| N-3 | Plain `select` on `app_users` as an admin whose policy calls `has_group_cap` | returns rows; **no** `infinite recursion detected in policy for relation` — this is the direct recursion proof |
| N-4 | `select proowner = relowner` for every helper vs the authorisation tables | true — owner alignment holds |
| N-5 | `select rolbypassrls from pg_roles where rolname='postgres'` | true — the assumption the model rests on is asserted, not remembered |
| N-6 | Every `public` table has `relrowsecurity and relforcerowsecurity` | true, uniformly |
| N-7 | `anon` has no privilege on any business table (`has_table_privilege('anon', …)` for all four verbs) | false everywhere |
| N-8 | Enumerate `SECURITY DEFINER` functions; compare to the reviewed allow-list | exact match — an unreviewed addition fails |
| N-9 | A user with zero grants selects from every business table | zero rows everywhere |

### 7.4 Column-level restriction on self-service updates — **[correction 2]**

A row predicate says *which rows*, never *which columns*. `using (auth_user_id = auth.uid())` would
let a user set their own `status` to `'active'` or repoint `auth_user_id`. Both are privilege
escalation.

**Postgres column-level privileges are the right tool**, and they compose with RLS — a statement must
pass the column grant *and* the policy:

```sql
revoke all    on public.app_users from anon, authenticated;
grant  select on public.app_users to authenticated;
grant  update (display_name) on public.app_users to authenticated;   -- the ONLY updatable column

create policy app_users_update_own on public.app_users for update to authenticated
  using      ( auth_user_id = (select auth.uid()) )
  with check ( auth_user_id = (select auth.uid()) );
```

An attempt to update `status` now fails at the grant, before RLS is consulted, with
`permission denied for column status`. Defence in depth: a `before update` trigger additionally
rejects any change to `auth_user_id` once set, so the column is immutable even to a privileged path.

**All administrative user changes are RPC-only** — `app_private.admin_set_user_status(...)` — never a
direct `UPDATE` policy. Two reasons: the capability check lives in one reviewed place, and
deactivation must also revoke sessions (P-3, §8.5), which a bare table update would silently skip.
This replaces revision 2's `or G('administer_users')` branch on the `app_users` UPDATE policy.

The same discipline applies wherever a client may update a row it does not fully own: grant the
specific columns, never the table.

### 7.5 Exact policies

Notation: `U` = `(select app_private.current_app_user())`, `G(x)` =
`(select app_private.has_group_cap('x'))`, `P(plant,x)` =
`(select app_private.has_plant_cap(plant,'x'))`. All policies are `to authenticated`; `anon` receives
no grant anywhere. Every UPDATE policy states `using` **and** `with check`. "— none —" means **no
policy is created**, so the action is impossible for every role.

**Family A** — helpers are safe here (§7.2).

| Table | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `app_users` | `auth_user_id = (select auth.uid()) or G('administer_users')` | — none — (P-1/P-2) | **column-grant limited to `display_name`**, `using`/`check`: `auth_user_id = (select auth.uid())` (§7.4). Admin changes are RPC-only | — none — |
| `capabilities`, `plants`, `avadhoot_groups` | `true` (vocabulary, no commercial content) | — none — | RPC-only | — none — |
| `group_/plant_capability_grants` | `app_user_id = U or G('administer_users')` | `G('administer_users')` | `G('administer_users')`, `with check (status='revoked')` — revoke only | — none — |
| `operational_settings` | `true` | `G('administer_users')` | `G('administer_users')` | — none — |

**Family B — party.** Amendment 2 applied: read requires the explicit `read_party_master` group
capability, never mere authentication.

```sql
create policy party_select on public.parties for select to authenticated
  using ( (select app_private.has_group_cap('read_party_master')) );

-- ONE insert policy. Permissive policies combine by OR, so the two authorisation
-- routes become two OR branches with no change in what is permitted.
create policy party_insert on public.parties for insert to authenticated
  with check (
        (select app_private.has_group_cap('manage_customer_master'))
     or ( status = 'proposed'                       -- CDM-06: Maker proposal route
          and lifecycle_state = 'prospect'
          and exists (select 1
                        from public.plant_capability_grants g
                        join public.capabilities c on c.id = g.capability_id
                       where g.app_user_id = (select app_private.current_app_user())
                         and c.capability_key = 'make_quote'
                         and g.status = 'active') ) );

create policy party_update on public.parties for update to authenticated
  using      ( (select app_private.has_group_cap('manage_customer_master')) )
  with check ( (select app_private.has_group_cap('manage_customer_master')) );
-- no delete policy
```

The Maker branch is deliberately narrow: `status='proposed'` **and** `lifecycle_state='prospect'` are
inside the branch, so a `make_quote` holder cannot insert an active Customer, and cannot reach the
master route at all without `manage_customer_master` (tests N-P3, N-P4).

| Table | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `customer_families`, `parties`, `customer_locations`, `party_family_memberships` | `G('read_party_master')` | `G('manage_customer_master')`, **or** a `make_quote` holder inserting `status='proposed'` (CDM-06) | `G('manage_customer_master')` | — none — |
| `customer_family_aliases`, `party_external_references` | `G('read_party_master')` | `G('manage_customer_master')` | `G('manage_customer_master')` | — none — |
| `customer_location_versions` | `G('read_party_master')` | `G('manage_customer_master')` or Maker proposal | **— none —** (immutable, CDM-31) | — none — |

**Family C — product definition:**

| Table | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `constructions` | `G('read_construction_library')` | `G('manage_construction_library')`, **or** any `make_quote` holder with `status='proposed'` (CDM-12) | `G('manage_construction_library')` | — none — |
| `construction_versions` | `G('read_construction_library')` | as above | `using approved_at is null and G('manage_construction_library')`; same `with check` | — none — |
| `plant_construction_adoptions` | `P(plant_id,'plant_access')` | `P(plant_id,'adopt_construction_for_plant')` | same | — none — |
| `skus` | `P(plant_id,'plant_access')` | `P(plant_id,'manage_sku_master')`, **or** `P(plant_id,'make_quote')` with `status='proposed'` (CDM-11) | `P(plant_id,'manage_sku_master')` | — none — |
| `sku_versions` | `P(plant,'plant_access')` via parent | `P(plant,'manage_sku_master')` or Maker proposal | only while `approved_at is null` | — none — |
| `sku_external_references` | `P(plant,'plant_access')` | `P(plant,'manage_sku_master')` | same | — none — |
| `sku_location_applicabilities` | `P(plant,'plant_access')` | `P(plant,'manage_sku_master')`; `scope='batch_only'` also by `P(plant,'make_quote')` (CDM-11) | matching capability | — none — |

Every table above takes **one policy per action**, with the master-capability and proposal routes as
OR branches, exactly as `parties` does. For `skus` and `sku_location_applicabilities` the proposal
branch is additionally **plant-scoped** — `P(plant_id,'make_quote')` reads the row's own `plant_id`,
so a Maker cannot propose a SKU onto a plant they hold no grant for (test N-P5).

`skus.plant_id` sits on the row, so each predicate is one column read plus one helper call — no join
— served by `ix_sku_plant`.

**Family D — commercial masters:**

| Table | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `sectors`, `sector_versions`, `calculation_default_versions`, `payment_interest_map_entries` | `G('read_party_master') or G('read_construction_library')` — any granted user | `P(any,'propose_commercial_master')` | the three-transition shape below | — none — |
| `rate_sets`, `rate_set_versions`, `rate_entries`, `freight_sets`, `freight_set_versions`, `freight_entries` | `P(plant_id,'plant_access')` | `P(plant_id,'propose_commercial_master')` | the three-transition shape below | — none — |

**Family E — Pricing Basis transitions — [correction 3, consolidated in revision 5].**

Revision 2's single policy with `using (status='draft')` could never withdraw an approved Release.
Revision 4 fixed that with three permissive policies. Revision 5 consolidates to **one**, because
three were never necessary — but the consolidation forces an honest statement of what a policy can
and cannot do:

> A single `UPDATE` policy checks `USING` against the **old** row and `WITH CHECK` against the
> **new** row, independently. Their conjunction is therefore the *cartesian product* of allowed
> old-states and allowed new-states. `{draft, approved} × {draft, approved, withdrawn}` admits
> `draft → withdrawn`, `approved → draft` and `approved → approved`, none of which is legal.
> **No single policy — and in fact no set of permissive policies — can express a transition matrix**,
> because policies never see old and new together.

So the two concerns separate cleanly:

- **The policy** answers *"may this caller touch this row at all?"* — capability, plant scope, and
  the coarse state envelope.
- **The trigger** answers *"is this specific old → new transition legal, and which columns may
  change?"* — it is the only place that sees `OLD` and `NEW` together.

```sql
-- ONE policy per table. Authorisation and envelope only.
create policy pbr_update on public.pricing_basis_releases for update to authenticated
  using      ( status in ('draft','approved')
               and ( (select app_private.has_plant_cap(plant_id,'propose_commercial_master'))
                  or (select app_private.has_plant_cap(plant_id,'approve_commercial_master')) ) )
  with check ( status in ('draft','approved','withdrawn')
               and ( (select app_private.has_plant_cap(plant_id,'propose_commercial_master'))
                  or (select app_private.has_plant_cap(plant_id,'approve_commercial_master')) ) );
```

**The transition matrix lives in `before update` and is exhaustive — anything unlisted raises:**

| `OLD.status` | `NEW.status` | Capability required | Columns permitted to change |
|---|---|---|---|
| `draft` | `draft` | `propose_commercial_master` | any content column |
| `draft` | `approved` | **`approve_commercial_master`** | `status`, `approved_by`, `approved_at` **only** — approval may not smuggle a content edit |
| `approved` | `withdrawn` | **`approve_commercial_master`** | `status`, `withdrawn_by`, `withdrawn_at` **only** |
| `approved` | `approved` | — | **rejected** — an approved Release is immutable (CDM-26), `is_automatic_default` included; a different default is a new Release |
| `approved` | `draft` | — | **rejected** |
| `draft` | `withdrawn` | — | **rejected** |
| `withdrawn` | anything | — | **rejected** — terminal (CDM-26: corrections create replacements) |

`plant_id` is immutable in every transition, so the policy's `USING` and `WITH CHECK` capability
checks cannot be made to disagree by moving the row between plants.

`approved_by` / `approved_at` / `withdrawn_by` / `withdrawn_at` are set **by the trigger** from
`auth.uid()` and `now()` and are never accepted from the client.

**Self-approval.** A caller holding only `propose_commercial_master` **cannot** approve — the trigger
rejects the `draft → approved` transition on the capability test, even though the policy admitted the
row. A caller holding **both** capabilities may self-approve: CDM-27 permits audited emergency
self-approval, so the trigger records `self_approved` and writes an `audit_events` row rather than
refusing. Test N-P1 pins the first behaviour; N-P8 pins the second.

**Why this is stronger than the three-policy version.** RLS does not apply to `service_role`, which
holds `BYPASSRLS` (S0a E-4). A `BEFORE UPDATE` trigger fires for every role regardless. Under the
split design the state machine lived in policies and was therefore bypassable by any privileged path;
under the consolidated design it is not (test N-P7).

The same one-policy + trigger shape governs `rate_set_versions`, `freight_set_versions`,
`sector_versions` and `calculation_default_versions`.

**Family F — batch.** One reusable predicate; every child delegates to it.

```sql
create function app_private.can_read_batch(p_batch bigint) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.batches b
     where b.id = p_batch
       and ( b.owner_user_id = (select app_private.current_app_user())
          or exists (select 1 from public.batch_collaborators bc
                      where bc.batch_id = b.id
                        and bc.app_user_id = (select app_private.current_app_user())
                        and bc.status = 'active')
          or (select app_private.has_plant_cap(b.plant_id,'check_quote'))
          or (select app_private.has_group_cap('administer_users')) ));
$$;
```

`app_private.can_write_batch(p_batch)` adds three further conditions: the caller **holds the active
edit lock**, the Batch `status` is an editable one, and either the caller is owner or collaborator
with `make_quote`, or holds `check_quote` while `status='submitted'` (CDM-33).

| Table | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `batches` | `can_read_batch(id)` | `P(plant_id,'make_quote')` | `can_write_batch(id)`, both `using` and `with check` | — none — |
| `batch_collaborators` | `can_read_batch(batch_id)` | owner, `P(plant,'check_quote')`, or Admin (CDM-32) | same | — none — |
| `batch_profile_versions` | `can_read_batch(batch_id)` | `can_write_batch(batch_id)` | **— none —** (append-only versions) | — none — |
| `pricing_groups`, `delivery_groups`, `batch_rows`, `batch_sets`, `batch_set_memberships` | `can_read_batch(batch_id)` | `can_write_batch(batch_id)` | `can_write_batch(batch_id)` | — none — (status change only) |
| `batch_calculations` | `can_read_batch` via parent row | **RPC only** — the Calculate function | **RPC only** | — none — |
| `batch_edit_locks` | `can_read_batch(batch_id)` | **RPC only** | **RPC only** (heartbeat / reclaim / takeover) | — none — |

**Family G — quote.** Read is plant-scoped; every write is RPC-mediated.

| Table | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `quote_families`, `quote_revisions` | `P(batch.plant_id,'plant_access')` | **RPC only** (Send / Approve) | **RPC only** (workflow) | — none — |
| **`quote_items`** | `P(plant,'plant_access')` | **RPC only** (Send) | **— none —** | **— none —** |
| **`quote_item_delivery_groups`** | as above | **RPC only** | **— none —** | **— none —** |
| **`calculation_snapshots`** | as above | **RPC only** | **— none —** | **— none —** |
| `quote_workflow_events`, `customer_outcome_events`, `export_events`, `export_parts` | as above | validated RPC | **— none —** | **— none —** |

The three bold rows are the enforcement of CDM-02 and CDM-22. Immutability is not a convention: with
no UPDATE policy, a Quote Item is unwritable by **every** role, including an Admin and including the
Maker who legitimately owns the Batch it came from.

**Family H — infrastructure:**

| Table | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `audit_events` | `G('administer_users')`, or plant members for entities on their plant | validated RPC only | **— none —** | **— none —** |
| `reference_sequences` | **no policy, no grant** — lives in `ref_private`, reachable only through P-5 | — | — | — |
| `master_change_requests` | granted users on the relevant scope | proposer | reviewer capability | — none — |

### 7.6 Schema exposure — **[V-2 RESOLVED by accepted S0a evidence]**

**What is established.** `pgrst.db_schemas` is **not set at the database level** on this project
(§7.0). The exposed-schema list is therefore project API configuration (Dashboard → Settings → API →
Exposed schemas), not a database object, and **being outside `public` is what keeps a helper off
`/rest/v1/rpc/`** — the grant does not do that job (§7.2).

**What is NOT established, and must not be assumed.** Revision 3 previously stated that
`app_private` and `ref_private` "are not exposed today". **That claim is withdrawn.** The absence of
a database-level GUC and the knowledge of Supabase's product default (`public, graphql_public`)
together prove nothing about this project's actual Dashboard setting. Someone may have added a
schema at any time, and no evidence gathered so far would show it.

Because helper non-exposure is a **foundational security property** of the whole design — every
`SECURITY DEFINER` helper is postgres-owned and therefore a full-database read primitive (§7.2) —
this is not a detail to discover during S1.

> **RESOLVED — S0a evidence accepted, 2026-09-04.** The value was obtained from the **running
> PostgREST instance**, which is a stronger source than the console setting because it is the
> configuration actually in force. Requesting a non-exposed schema returns `PGRST106` with the
> permitted list enumerated in the hint:
>
> > *"Only the following schemas are exposed: **public, graphql_public**"*
>
> **`app_private` is not exposed.** Two controls prove the enumeration discriminates rather than
> erroring generically: an exposed-but-empty schema (`graphql_public`) returns `PGRST205` — schema
> accepted, table absent — while `app_private` returns `PGRST106` — schema rejected. Unauthenticated
> `POST /rest/v1/rpc/is_admin` returns **404 `PGRST202`** in `public` and **406 `PGRST106`** when the
> real schema is forced, identically for both key types.
>
> Full record: [`data-model-s0a-evidence.md`](data-model-s0a-evidence.md) items **E-1** and **E-2**.

**S1's 404 test remains**, and its role is different: it is the **continuing regression guard**, run
in CI against the deployed project, so that a later console change fails the build rather than
silently widening the surface. S0a established the starting value; S1 keeps it true.

**Authenticated `is_admin` probes** (S0a E-2 rows 4 and 5) were not performed — no user credential
exists yet, and minting one would have meant fabricating authentication. They are carried into S1 as
a **regression test once the invitation flow creates a test user**, not as an open exposure question:
`PGRST106` is returned at PostgREST's schema-routing layer, before any role is assumed, so no bearer
token of any role can reach an unexposed schema.

`pg_graphql` is not installed, so no GraphQL surface exists to secure.

### 7.6.1 Disposition of the existing `app_private.is_admin`

The project already carries one `SECURITY DEFINER` function. It must be dispositioned rather than
inherited silently, and it must appear in N-8's expected inventory. Verified read-only this session:

| Property | Value |
|---|---|
| Signature | `app_private.is_admin(uid uuid DEFAULT auth.uid()) returns boolean` |
| Language / volatility | `sql`, `STABLE` |
| Security | `SECURITY DEFINER` |
| Owner | `postgres` |
| `search_path` | **`public`** — *not* `''` |
| Grants | `postgres=X/postgres | authenticated=X/postgres` — **`PUBLIC`/`anon` already revoked** |
| Body | `select exists (select 1 from public.profiles where id = uid and role = 'admin' and active = true)` |
| Callers | RLS policies only: `profiles_select_admin_all` (SELECT `USING`) and `profiles_update_admin_all` (UPDATE `USING` + `WITH CHECK`). **No application code calls it** — verified by grep across `quote-gen-be/*.py` and `quote-gen-fe/src/` |

*The zero-argument calls in those policies are valid, not a defect: the parameter carries
`DEFAULT auth.uid()`.*

**Assessment.** Two properties are already correct — `anon` cannot execute it, and it is postgres-owned
like every other object. Two are not:

1. `search_path` is `public`, not `''`. The body does schema-qualify `public.profiles`, so it is not
   presently exploitable, but it does not meet the standard §7.2 sets for every helper.
2. **Its authority model is the one CDM-05 replaces.** It reads `profiles.role = 'admin'` — the single
   role column that cannot express roles-plus-capabilities or multi-plant grants (§1.1). Its
   successor is `app_private.has_group_cap('administer_users')`.

**Disposition — retain, harden, then replace and remove, across three slices:**

| Slice | Action |
|---|---|
| **S1** | **Retain and harden.** `alter function app_private.is_admin(uuid) set search_path = ''` and re-qualify the body. It stays the authority for `profiles` while `profiles` is still read. Added to the reviewed `SECURITY DEFINER` inventory (below) |
| **S2** | **Replace.** Backend routes move to caller context and read `app_users` + grants (§8.4). Nothing new calls `is_admin` |
| **S3** | **Remove**, together with `public.profiles` and its three policies, in an authorised cleanup commit |

**Why removal waits until S3.** `profiles` is read by `auth.py:42`, `server.py:565` and
`server.py:623`, which convert in S2. §15 gives S2 a compatibility window in which the previous build
must still run — and the previous build needs `profiles` and therefore `is_admin`. Dropping either in
S2 would make that rollback impossible. S3 removal is the first point at which the window has closed.

**Reviewed `SECURITY DEFINER` inventory — N-8's expected result.** N-8 enumerates every
`SECURITY DEFINER` function and fails on any difference:

| Function | From | Until |
|---|---|---|
| `public.rls_auto_enable()` | pre-existing | **execute revoked in S0b**; a candidate for removal in the same authorised commit |
| `app_private.is_admin(uuid)` | pre-existing | hardened S1, **removed S3** |
| `app_private.has_plant_cap(bigint,text)` | S1 | — |
| `app_private.has_group_cap(text)` | S1 | — |
| `app_private.current_app_user()` | S1 | — |
| `app_private.is_plant_member(bigint)` | S1 | — |
| `app_private.can_read_batch(bigint)` | S6 | — |
| `app_private.can_write_batch(bigint)` | S6 | — |
| `app_private.admin_set_user_status(...)` | S1 | — |
| `app_private.bootstrap_app_user()` (P-2) | S1 | — |
| `ref_private.allocate_reference(...)` (P-5) | S1 | — |

Any function present and not on this list fails N-8. The expected set changes only by an approved
amendment to this table.

### 7.7 The nine personas

| Persona | Result |
|---|---|
| **`anon`** | No grant on any business table (§7.1 revocation), no `EXECUTE` on helpers. Every request denied or empty |
| **Authenticated, no grants** | Reads `capabilities`, `plants`, `avadhoot_groups`, own `app_users` row. **No commercial data** |
| **Maker, correct plant** | Reads that plant's SKUs/Batches/Quotes; writes Batches owned or collaborated on while holding the lock; may create Proposed Party/SKU/Construction |
| **Maker, wrong plant** | `has_plant_cap` false → zero rows. Guessing an id changes nothing: the predicate is on the row's own `plant_id`, not on obscurity |
| **Collaborator** | As owner for read/write; cannot manage collaborators |
| **Checker** | Reads all Batches on the plant; may edit a `submitted` Batch and approve it (CDM-33); may take over a lock with reason |
| **Admin** | `administer_users` for users, grants, settings — **through RPCs, not table UPDATE** (§7.4). Still cannot update a `quote_item`: no policy exists for any role |
| **NPD / master capabilities** | `manage_sku_master`, `adopt_construction_for_plant` per plant; `manage_construction_library` group-wide. Confers no Quote authority (CDM-27) |
| **Deactivated user** | Every helper tests `u.status='active'`, so access stops on the next query even with an unexpired JWT. §8.5's revocation is the complement |
| **Cross-Family third-party location** | A Delivery Group may reference another Party's Location (CDM-08). Nothing follows: reading locations needs `read_party_master`, and that party's SKUs and Quotes stay behind their own plant predicates (CDM-35) |

---
## 8. Caller-context backend design

### 8.1 Verified current state

| Fact | Evidence |
|---|---|
| Both clients are **cached module-level singletons** | `supabase_client.py:29-30` (`_client`, `_admin_client`) |
| The anon client is used **only** for auth calls | `auth.py:34`; `server.py:471`, `:509`, `:595` |
| **Every `public` table access uses service-role** | `auth.py:42`; `server.py:565`; `server.py:623` (`.table("profiles")`) |
| The caller's token is **already captured per request** | `auth.py:58` — `g.access_token = token` |

The review's broader claim that "every backend query uses the service-role client" was too wide.
Auth operations already run as the caller; only *table* access does not. The token is already in hand,
which makes S2 smaller than it looks.

### 8.2 Why the obvious fix is unsafe

Setting the caller's JWT on the existing client per request is **a privilege-escalation bug**, not a
style choice. `get_supabase()` returns one shared object; Flask serves requests concurrently;
mutating its PostgREST auth header per request races, and one user's query can execute under another
user's token.

### 8.3 Recommendation

**Construct a short-lived per-request client bound to the caller's JWT. Never mutate a shared one.**

```python
# proposed — NOT a cached singleton
def get_supabase_for_caller(access_token: str) -> Client:
    client = create_client(os.environ["SUPABASE_URL"],
                           os.environ["SUPABASE_PUBLISHABLE_KEY"])
    client.postgrest.auth(access_token)
    return client
```

exposed by `require_auth` as `g.db` beside the existing `g.access_token`.

**Multi-row workflow transitions become `SECURITY INVOKER` Postgres functions** called through that
client. PostgREST gives one statement per request, so Send — validate every active row, freeze items
and snapshots, write both fingerprints — cannot be atomic as a sequence of client calls. As an
invoker-rights RPC it is one transaction and RLS still applies to every table it touches.

**Trade-off, plainly.** The alternative is `supabase-js` straight from the browser with Flask kept
only for export: fewer moving parts, one less hop. It fails on atomicity — Send, Approve and Issue
each touch several tables and must be all-or-nothing, and a browser cannot hold a transaction.
Splitting them into several calls would permit a half-sent candidate after a dropped connection,
which is exactly what CDM-02's atomic SendGate forbids. **Recommendation: server-side invoker RPCs
for all formal writes; direct client reads are acceptable later, since the same policies apply.**

### 8.4 Migration path (S2)

1. Add `get_supabase_for_caller`; leave the existing functions in place.
2. Convert `/auth/me` and `/admin/users` to `g.db`. `/admin/users` then needs an `administer_users`
   policy on `app_users` rather than a service-role read — it comes **off** the allow-list.
3. Add a CI assertion that `get_supabase_admin` appears only at allow-listed call sites.
4. Prove by test, not inspection: the same request as a wrong-plant Maker returns zero rows
   **through the running backend**.

### 8.5 Session deactivation

Deactivation revokes sessions via the Auth admin API (P-3). Deleting or disabling a row is **not**
assumed to invalidate an existing JWT — §7.6's helper-level `status='active'` test is the primary
control, and revocation is the complement.

---

## 9. Privileged-operation allow-list

Every entry states why caller context cannot do the job. Anything not listed that uses service-role
is a defect.

| # | Operation | Mechanism | Why the caller's own rights are insufficient |
|---|---|---|---|
| P-1 | Create the `auth.users` row for an invited user | `auth.admin` API | The invitee has no session; only the Auth admin API can mint the identity (CDM-05) |
| P-2 | Create the matching `app_users` row at first sign-in | **`app_private`** definer function, invoked by the caller | Chicken-and-egg: policies resolve identity *through* `app_users`, which does not yet exist. Validates `auth.uid()` and inserts exactly one row for that uid |
| P-3 | Global sign-out on deactivation | `auth.admin.sign_out` (`server.py:537`) | Session revocation has no SQL equivalent |
| P-4 | Password change | `auth.admin.update_user_by_id` (`server.py:603`) | Auth-API operation |
| P-5 | Reference allocation | **`ref_private`** definer function | Must update a counter row the caller has no grant on (§12). Validates capability first |
| P-6 | Pre-cutover reset and seed (S11) | Migration/CLI, never a request path | One-off, approved, and permanently disabled at cutover (CDM-38) |

Rules for every definer function: outside `public`; `set search_path = ''`; validates `auth.uid()`
and capability before acting; `revoke execute … from public` then grant only to `authenticated`
(§7.1); carries a negative test proving an unauthorised caller is rejected.

**Two removals**, one of them live:

- `/admin/users`' service-role table read (`server.py:623`) is **not** allow-listed (§8.4).
- **`public.rls_auto_enable()` must have `EXECUTE` revoked from `public`, `anon` and
  `authenticated`, or be dropped.** It is `SECURITY DEFINER` and reachable without signing in,
  contradicting CDM-35. This is **S0b** (§16) — a real privilege change requiring explicit
  authorisation, not part of the read-only audit.

---

## 10. Calculation authority

### 10.1 One resolver, and where it lives

**Recommendation: a pure module in `src/engine/`, not `src/state/`.** §9.3 requires tests to execute
the actual `calcBatchRow` and Send paths; a resolver in `state/` would need a React renderer to test.
`engine/costing.js` is already React-free (`CLAUDE.md`), and the resolver joins it there. Both
`useCostingResult` and `calcBatchRow` then call the one module — which is what closes B-1's split:

| Surface | Site today | Chain today |
|---|---|---|
| Costing | `state/useCostingResult.js:56-59` | `batchDefaults ?? Sector ?? literal` |
| **Batch Entry (CalcGate)** | `state/useQuoteActions.js:222-226` | `row ?? batchProfile ?? literal` — **no Sector tier** |

Signature returns value **and** provenance, because CDM-22 requires the source to be snapshotted:

```
resolve(field, {row, pricingGroup, batchProfile, sector, calcDefaults})
  → { value: number|null,
      source: 'row'|'pricing_group'|'batch'|'sector'|'system'|'unresolved',
      sourceVersionId: bigint|null }
```

### 10.2 The four chains

```
Waste            row → batch_profile → sector → calculation_defaults      (CDM-19)
Conversion       row → batch_profile → sector → calculation_defaults      (CDM-19; ₹/kg, §3.1)
Margin           row → batch_profile(box|pp) → sector → calculation_defaults (CDM-19)
Freight          row → pricing_group → freight master → UNRESOLVED → block (CDM-17)
Interest         pricing_group → payment-terms map → calculation_defaults (CDM-18)

**Margin, per the ruling.** The Sector's approved default target margin is the third tier. A Batch
Box/PP default overrides it for the customer opportunity, and a row may exceptionally override the
Batch. All three levels use the same `null`-means-inherit rule, so an untouched Batch inherits its
Sector's target margin without storing it (§10.3).

**Interest, per the ruling.** Lookup is **exact-match on a closed list** — 30 → 0.5 %, 45 → 0.75 %,
60 → 1.0 %, 90 → 1.5 %. `payment_terms_text` never participates. Any miss — including a null
`payment_terms_days` — resolves to the versioned fallback `interest_fallback_pct` (0.500), **not** to
the `1.5` the live code produces via `m[e.target.value]||1.5`
(`tabs/batch/BatchProfileBar.jsx:230-231`). S7 corrects that.
```

**`null` is inherit, `0` is a value, and only `null` advances the chain.** Every tier test is
`x !== null && x !== undefined`, never truthiness. Freight alone terminates in **block**, not a
fallback.

Three live sites make this impossible today:

| Site | Behaviour | Slice |
|---|---|---|
| `engine/costing.js:81` `sub*(+interest\|\|0)/100` | `+""` is `0` and `0\|\|0` is `0`, so blank and explicit zero are **indistinguishable at the only line that consumes Interest** (**A-19**) | S7 |
| `engine/costing.js:29-32` `if(override&&+override>0)` | An explicit **zero freight override is discarded**, then a matrix miss returns `0` anyway — explicit-zero and unresolved collapse | S8 |
| `engine/costing.js:35` `interest=1.5` | A fourth answer where CDM-18 gives one (`0.5`); unreachable today only because `buildSpecFromRow` always supplies a value (**A-21**) | S7 |

All three are in `engine/costing.js`, which `CLAUDE.md` protects. §4.2 anticipates this: *"removed or
reconciled under an explicitly approved engine-change commit."* S7 and S8 are those commits, each
carrying a full `test:costing` golden diff as its proof gate.

### 10.3 Materialisation removal — the five sites

| # | Site | Writes |
|---|---|---|
| 1 | `tabs/batch/BatchProfileBar.jsx:67-76` | sector waste/conv into the profile as literals |
| 2 | `tabs/batch/BatchProfileBar.jsx:145` | **clearing** a field restores the sector default as a stored literal |
| 3 | `tabs/costing/BatchContextBar.jsx:90-92` | `pickSector` writes waste/conv into the context cascade |
| 4 | `tabs/batch/BatchProfileBar.jsx:230-231` | Payment Terms select writes `interest` (**A-18**) |
| 5 | `tabs/costing/BatchContextBar.jsx:104` | `pickPayment` writes `interest` (**A-18**) |

Site 2 is the one to watch: *clearing* — the only gesture a Maker has for "inherit" — is what creates
an override. After S7 all five write `null` and let the resolver answer.

### 10.4 Fingerprints

Two deterministic hashes over sorted, typed, explicitly listed fields. Unlisted fields are treated as
**calculation-relevant** until classified (§4.4 — fail toward over-staling).

**Calculation fingerprint:** row overrides (waste, conversion, margin, freight); `sku_version_id`;
the effective `construction_version_id`; dimensions, ply, box type, ups; `row_type`; SET membership;
`pricing_group_id`; the group's `freight_mode`, `freight_basis_delivery_group_id`,
`freight_manual_value`, `interest_override_pct`, `payment_terms_days`; Batch Profile values and
`sector_id`; `pricing_basis_release_id`; engine and rounding versions; add-ons.

**Presentation fingerprint:** Pricing/Delivery Group labels; `bill_to_location_id`,
`ship_to_location_id`; `route_notes`; `payment_terms_text`; addressee name and details;
`material_code`; SET Code label.

`payment_terms_days` is calculation-relevant while `payment_terms_text` is not — CDM-18 exactly.
CDM-23's rule that a Payment Terms change stales rows **only when Interest inherits** falls out
without a special case, provided the hash is fed the resolver's **output provenance** rather than the
raw input: with an explicit `interest_override_pct`, the resolved Interest and its source are
unchanged, so only the presentation hash moves.

**Three states** (CDM-23): `fresh`, `needs_send_only`, `calculation_stale`. Send stores both hashes.

### 10.5 Batch Entry as sole CalcGate

Three independent layers, so no single mistake defeats it:

1. **Schema** — `calculation_snapshots` is reachable only from `quote_items`; there is no Quote-side
   path to inputs.
2. **RLS** — no UPDATE or DELETE policy exists on `quote_items` or `calculation_snapshots`, for any
   role including Admin (§7.4).
3. **RPC** — only the Send function inserts them, reading exclusively from `batch_calculations`,
   which only the Batch Entry calculate path writes.

---

## 11. Snapshot design

### 11.1 Typed columns *and* versioned JSON

**Boundary: "is it queried or reported?"**

*Typed columns:* `schema_version integer not null`; `engine_version text not null`;
`rounding_rule_version text not null`; `pricing_basis_release_id bigint not null`;
`calculation_default_version_id bigint not null`; `pricing_date date not null`;
paired effective value + source for each inherited field —
`effective_waste_pct numeric(7,3)` / `waste_source text`,
`effective_conv_rate numeric(12,4)` / `conv_source text`,
`effective_margin_pct numeric(7,3)` / `margin_source text`,
`effective_interest_pct numeric(7,3)` / `interest_source text`,
`effective_freight numeric(12,4)` / `freight_source text`;
`total_cost numeric(14,4)`; `final_rate numeric(14,4)`; `rate_per_kg numeric(14,4)`;
`calc_moq bigint`; `calculated_by bigint`; `calculated_at timestamptz`;
`calculation_fingerprint text`; `presentation_fingerprint text`.

*Versioned JSONB:* `inputs jsonb not null`, `results jsonb not null` — the complete engine input and
output.

**Why not all-JSON:** "every issued item whose margin was overridden at row level" is a routine
commercial question; against JSONB it is a full scan with no usable index, and it loses the exact
numeric types CDM-22 requires. **Why not all-typed:** `calcCosting` returns roughly forty derived
fields (`engine/costing.js:98-99`) that will evolve, and a column per engine change means a migration
against an immutable table on every release.

### 11.2 Schema versioning

`schema_version` is stamped at write and **never migrated**. Readers dispatch on it. This is the only
approach consistent with CDM-22's *"historical view/re-export reads stored results and never reruns
current logic"* — rewriting old snapshots into a new shape is exactly the recomputation that forbids.
Old readers are retained; a version retires only when no snapshot carries it.

### 11.3 Provenance and mixed engines

Each snapshot records entered inputs; results; effective value **and source** per inherited field;
`sku_version_id` and `construction_version_id`; the Release and, through §4.5's four typed FKs, every
component version; `calculation_default_version_id`, which fixes both the Payment-Terms map and the
0.5 % fallback that applied (**A-17**); engine and rounding versions; user and timestamp.

Because `engine_version` sits on the **snapshot** and not the revision, a mixed-engine revision is
representable without contortion (CDM-25) — and §14 asserts it is *visible*, not merely storable.

### 11.4 Immutability and PM-7

`quote_items.batch_row_lineage_id → batch_rows.lineage_id` (§5.10) points at the **lineage**, not the
row instance, so later revisions editing that row do not orphan earlier items, and divergence is
always computed against the snapshot rather than the row's current content. No UPDATE path exists at
any of the three layers in §10.5.

---

## 12. Reference allocation

### 12.1 Why not Postgres sequences

Sequences are non-transactional, so a rolled-back approval would consume a Quote number permanently.
CDM-30 requires an abandoned pre-approval family to consume **no** reference, which a sequence cannot
express. FY scoping needs a counter per `(plant, FY)`, not one global counter.

### 12.2 Mechanism

`ref_private.reference_sequences`, allocated inside the caller's transaction by definer function
P-5:

```sql
update ref_private.reference_sequences
   set next_value = next_value + 1
 where scope_type = 'quote' and scope_key = :plant_id and fy_label = :fy
returning next_value - 1;
```

A bare `UPDATE … RETURNING` holds a row lock for the transaction's duration, serialising concurrent
allocations **for that one scope only**. Throughput is far beyond need — allocations happen per Batch
creation and per Quote approval, not per keystroke.

### 12.3 Gaps — **[ERROR corrected]**

Revision 1 said a rolled-back transaction leaves a gap. **It does not.** The counter lives in an
ordinary table, so a rollback reverts the increment along with everything else — that is precisely
why a table is used instead of a sequence (§12.1). The distinction matters:

| Cause | Gap? |
|---|---|
| Transaction rolls back (Send fails, approval aborts) | **No.** The increment is rolled back with it, and the number is re-issued to the next caller |
| A reference is allocated and committed, then its record is **voided** (CDM-30) | **Yes** — and correctly so: the number is consumed and never re-issued |
| A durable Batch is committed then **abandoned** (CDM-30) | **Yes** — the Batch Reference stays with the abandoned Batch |
| A Quote family is abandoned **before** approval (CDM-30) | **No gap and no consumption** — no reference was ever allocated |

So gaps arise only from committed-but-unused references, never from rollbacks. Non-reuse follows from
monotonic increment plus the absence of any decrement path; CDM-14 and CDM-21 require
non-**reuse**, not gap-freedom.

### 12.4 Scope, FY and timing

| Reference | Scope key | Allocated at |
|---|---|---|
| Plant Code | group | plant creation (seed) |
| Family Code | group | Family creation |
| Customer Code | **original** family (CDM-07) | graduation |
| Location Code | parent Customer | Location creation |
| Construction Code | group | **publication**, not proposal (CDM-12) |
| Batch Reference | `(plant, FY)` | Batch creation (CDM-14) |
| Quote Reference | `(plant, FY)` | **first Checker approval** (CDM-21) |
| Revision number | quote family | first approval of that revision (CDM-21) |

**FY derivation:** Indian FY, 1 April – 31 March, from the **producing plant's local event date**,
never a user-editable Pricing or Quote Date (CDM-34) — computed from
`now() at time zone plants.timezone`.

**A consequence worth stating once.** Batch and Quote references are allocated at different moments,
so a Batch created 25 March and approved 5 April carries an FY-26-27 Batch Reference and an FY-27-28
Quote Reference. That is correct under CDM-14 and CDM-21 and should not be "fixed" later.

---

## 13. Pre-cutover reset and import maps

### 13.1 Destructive reset list — explicit approval required (§7 M1)

**Browser `localStorage`, cleared in full — 17 keys**, enumerated from source: `cbb_rates`,
`cbb_freight`, `cbb_sectors`, `cbb_boxtrim`, `cbb_partitions`, `cbb_constrlib`, `cbb_locations`,
`cbb_quoteitems`, `cbb_batchprofile`, `cbb_batch_autosave`, `cbb_batch_autosave_corrupt`,
`cbb_batch_previous`, `cbb_costing_draft`, `cbb_costing_draft_corrupt`, `cbb_pinned_addons`,
`cbb_rate_date`, `cbb_template`.

**Supabase:** nothing to reset beyond `public.profiles` (2 rows), superseded by `app_users` + grants.
Verified: no other `public` table exists.

**Product Owner backups** (`CFB_QOS_Backup_*.json`, five files at the workspace root) are retained
outside the migration and are not an input to it.

### 13.2 Source-to-target maps

| Source | Target | Rule |
|---|---|---|
| `DEFAULT_SECTORS_DATA` (`data/defaults.js:57+`) | `sectors` + `sector_versions` v1 | `code`→`sector_code`; `wasteCBB`→`waste_cbb_pct`; `wastePP`→`waste_pp_pct`; **`convBox`→`conv_box_rate`, `convPP`→`conv_pp_rate` (₹/kg, §3.1)**; `specLang`→`spec_lang`. **`margin_pct` has no source column and must be supplied** — see the seed obligation below |
| `DEFAULT_RATES` (`:63`) | `rate_sets` + v1 + `rate_entries` | `code`→`grade_code`; `price`/`disc`/`freight` → `numeric(12,4)` |
| `DEFAULT_FREIGHT` (`:81`) | `freight_sets` + v1 + `freight_entries` | Nested map → one row per (origin, destination). **A missing pair is absent, not zero** |
| `PLANTS` (`:62`) | `plants` | Nagpur, Pune, Kolkata |
| `LOCATIONS` (`:63`) | `customer_locations` seeds | 9 destinations, reviewed mapping |
| Sheets Customer hierarchy | `customer_families` → `parties` → `customer_locations` | **Reviewed mapping only**; names and aliases never drive consolidation (CDM-06/37) |
| Sheets SPEC | `skus` + `sku_versions` | Every unique Plant Item Code is its own SKU, **including Plate and Partition components** (CDM-37) |
| Sheets technical specs | `constructions` + `construction_versions` | Reviewed, deduplicated; never auto-published (CDM-12) |

**Never imported** (CDM-37): manufactured blanks; absent properties; inert legacy override keys; and
**Construction-level waste/conversion**, which has no destination column by construction (§4.3).

**Blank normalisation:** legacy `""` → SQL `null`; `0` stays `0`, in the import adapter before domain
validation (§2).

### 13.3 Seed obligation — Sector target margins

The Sector Margin ruling makes `sector_versions.margin_pct` a required column, and **the live Sector
master has no margin field to import from**: entries are `code, name, wasteCBB, wastePP, convBox,
convPP, specLang` (`data/defaults.js:57-62`). A reviewed target margin per Sector is therefore a
**required input to S11**, not something the migration can derive or default.

This is a delivery task rather than an open question — the ruling settled that the tier exists. S11
cannot complete without the values, so they are listed as a prerequisite on that slice (§16.2) and
the `not null` constraint makes a partial seed fail loudly rather than silently inserting zeros.

---

## 14. Test matrix

`pgtap` 1.3.3 is available and not installed; I recommend installing it in **S1** so every later
slice inherits a harness.

| Area | Tests | Slice |
|---|---|---|
| Constraints | every FK; `restrict` blocks deleting a referenced master; one-current-membership partial index; `uk_sku_plant_item` with multiple nulls; `ck_set_code_not_blank`; freight-mode checks; `ck_qf_abandoned_unreferenced` | S3–S6 |
| Composite FK | wrong-plant SKU on a Batch row **rejected** (§5.1); row in another Batch's Pricing Group **rejected** (§5.3); freight basis from another group **rejected** (§5.4); non-Box SET parent **rejected** (§5.6); `sku_version` of another SKU **rejected** (§5.8); deleting the basis Delivery Group **rejected** (A-11) | S6, S8 |
| Triggers | Family-membership check fires at insert and **not** on later reassignment (§5.2); proposed-Construction exclusivity (§5.7); SET counter drives dissolve/reactivate and blocks an active empty SET (§5.9) | S6 |
| Pricing Basis | two approved alternatives may overlap; **two defaults may not**; a Release with an unapproved component is rejected; Amend may reuse a withdrawn Release, new Quote/Reprice may not (CDM-26) | S5 |
| **Pricing Basis transitions** | each legal transition succeeds for the right capability; an **approved Release can be withdrawn** (the revision-2 defect); a withdrawn Release is terminal (§7.5) | S5 |
| **Policy-consolidation negatives (N-P1 … N-P8)** | the eight tests below, proving one policy grants nothing the split design refused | S3–S5 |
| RLS matrix | every table × action × the nine personas of §7.6; IDOR with known ids; cross-Family route grants no third-party access | S1, then every slice |
| RLS negative | UPDATE on `quote_items` fails **for every role including Admin**; INSERT into `audit_events` outside an RPC fails; `anon` reaches nothing; a user with zero grants reads no commercial row (amendment 2) | S1, S9 |
| **Helper security and RLS model** | the nine tests **N-1 … N-9** of §7.3 in full: `authenticated` can execute each helper and `anon` cannot; no `infinite recursion detected in policy` on an admin read of `app_users`; `proowner = relowner`; `postgres.rolbypassrls` asserted; uniform `FORCE`; `anon` holds no privilege on any business table; the `SECURITY DEFINER` inventory matches the reviewed allow-list; a zero-grant user reads nothing | S1 |
| **Schema non-exposure** | CI smoke test against the deployed project: `POST /rest/v1/rpc/has_plant_cap` returns **404**, so a console change to exposed schemas fails the build (§7.6) | S1 |
| **Column-level grants** | updating `app_users.status` or `auth_user_id` as the row's owner fails with `permission denied for column`; updating `display_name` succeeds; the admin path works only through the RPC (§7.4) | S1 |
| Caller context | wrong-plant Maker returns zero rows **through the running backend**; concurrent requests never cross tokens (§8.2) | S2 |
| Concurrency | two concurrent allocations yield distinct numbers; a rolled-back allocation leaves **no** gap (§12.3); CAS on a stale `content_version` fails; two racing lock reclaims — exactly one wins | S1, S6 |
| Lock | heartbeat does **not** advance `batches.content_version` (A-23); staleness uses server time under a skewed client clock | S6 |
| **Ruling conformance** | Sector target margin resolves when Batch and row are blank, and is overridden by Batch, then by row; `payment_terms_days` outside 30/45/60/90 is **rejected by constraint**; each of the four maps to its approved rate; a null or absent `payment_terms_days` resolves to **0.5 %, not 1.5 %** | S5, S7 |
| CalcGate golden | blank/zero/value across all five inheritable fields; sector→batch→row authority; Payment Terms map, explicit override, 0.5 % fallback; freight master/manual/ex-factory/unresolved; smallest affected unit; Pricing Group invalidation; Amend preserves Release; mixed-engine revision visible; historical re-export does not recalculate | S7–S9 |
| Engine change | full `npm run test:costing` golden diff on each of the three `costing.js` edits, reviewed line by line | S7, S8 |
| Migration | import rejects manufactured blanks; `""`→`null`, `0`→`0`; a missing freight pair is absent not zero; every Plant Item Code becomes one SKU | S11 |
| Export | D-18/D-27 first-item, multiple Pricing Groups, multi-destination one price, row freight override, external Bill-to/Ship-to, mixed engine, blank validity, Proposed masters | S10 |
| Advisors | `get_advisors` security **and** performance clean or explicitly dispositioned | S0a, S13 |
| Standing gates | all seven from `session-start.md` §3 on **every** commit | all |

### 14.1 Negative tests for policy consolidation

Revision 5 replaced several permissive policies with one policy per table/action. Because permissive
policies combine by **OR**, a careless consolidation widens authority silently. These eight tests pin
the boundary; each must **fail** the attempted action.

| # | Attempt | Must fail because |
|---|---|---|
| **N-P1** | A caller holding **only** `propose_commercial_master` updates a draft Release to `status='approved'` | The trigger's `draft → approved` row requires `approve_commercial_master`. The *policy* admits the row — this test proves the trigger, not the policy, is what refuses |
| **N-P2** | An approver performs `draft → approved` **and** changes `effective_from` in the same statement | Approval permits only `status`, `approved_by`, `approved_at`. Proves approval cannot smuggle a content edit |
| **N-P3** | A `make_quote` holder inserts a `parties` row with `status='active'` (or `lifecycle_state='customer'`) | Both predicates sit **inside** the Maker OR-branch; the master branch needs `manage_customer_master` |
| **N-P4** | A user with **no** grants inserts into `parties`, `constructions` or `skus` | Neither OR branch is satisfiable without a grant (CDM-05) |
| **N-P5** | A Maker with `make_quote` on plant A inserts a proposed `skus` row with `plant_id = B` | The proposal branch reads the row's own `plant_id`, so `P(B,'make_quote')` is false |
| **N-P6** | An approver withdraws an approved Release **and** edits `is_automatic_default` | Withdrawal permits only `status`, `withdrawn_by`, `withdrawn_at`; an approved Release is otherwise immutable (CDM-26) |
| **N-P7** | **`service_role`** (which holds `BYPASSRLS` — S0a E-4) performs `approved → draft` | RLS does not constrain `service_role`, but the `BEFORE UPDATE` trigger fires for every role. **This test exists only because the state machine moved out of policies**; under the split design it would have passed |
| **N-P8** | A caller holding **both** capabilities self-approves | ✅ **Must SUCCEED** — CDM-27 permits audited emergency self-approval. The test asserts it is allowed **and** that `self_approved` is set and an `audit_events` row written. Included here so consolidation is not over-tightened into breaking an approved rule |

N-P7 and N-P8 are the two that would be easy to get wrong in opposite directions — one proves the
consolidation did not create a bypass, the other that it did not remove a permitted behaviour.

### 14.2 Advisor `0006` — recounted, not dispositioned

`multiple_permissive_policies` fires per **(table, role, action)** with more than one permissive
policy. Counting the consolidated design:

| Table group | SELECT | INSERT | UPDATE | DELETE | `0006`? |
|---|---|---|---|---|---|
| `app_users` (own OR admin, one policy) | 1 | 0 | 1 | 0 | no |
| `capabilities`, `plants`, `avadhoot_groups`, `operational_settings` | 1 | 0–1 | 0–1 | 0 | no |
| grant tables | 1 | 1 | 1 | 0 | no |
| Family B — party (master OR proposal, one policy) | 1 | 1 | 1 | 0 | no |
| Family C — construction, SKU (master OR proposal, one policy) | 1 | 1 | 0–1 | 0 | no |
| Family D/E — masters and Pricing Basis (one policy + trigger) | 1 | 1 | 1 | 0 | no |
| Family F — batch and children | 1 | 1 | 0–1 | 0 | no |
| Family G — quote (writes RPC-only) | 1 | 0 | 0 | 0 | no |
| Family H — audit, sequences, change requests | 0–1 | 0–1 | 0–1 | 0 | no |

> **Predicted `0006` count under the consolidated design: zero.** No table carries more than one
> permissive policy for the same role and action.
>
> **Predicted `0003` (`auth_rls_initplan`) count: zero**, because every predicate wraps its helper and
> `auth.uid()` as `(select …)` (§7.1). S0a E-6 shows the pre-existing `0003` on
> `profiles.profiles_select_own`; that row disappears when `profiles` is dropped in S3.

**No advisor warning now requires a correctness-based disposition.** The S13 gate's wording —
*"advisors clean or explicitly dispositioned"* — should be satisfied by *clean*, and any `0006` that
does appear is to be treated as a defect in the consolidation, not as an accepted cost. **PC-1 from
the S0a artefact is withdrawn on this basis.**

---

## 15. Rollback and compatibility, per slice

Amendment 10. "Previous build" is not a plan where the older build cannot read newly authoritative
data, or where reverting would **restore** a security weakness. Each slice states four things:
compatibility window (which app builds can run against the post-slice schema), forward-fix route,
feature-gate action, and data consequence.

| Slice | Compatibility window | Forward-fix route | Feature gate | Data consequence of reverting |
|---|---|---|---|---|
| **S0a** | unchanged — docs only | n/a | none | none |
| **S0b** | all builds | re-grant `EXECUTE` if a dependency is discovered | none | **Reverting restores an anon-callable `SECURITY DEFINER` function.** Revert only with the same authorisation that approved the change |
| **S0c** | all builds — repository files only | n/a; deleting the files loses provenance but changes no database | none | none. **Note:** the three files are reconstructed history, so replaying them on a *fresh* database does not reproduce live — see the S0c record §6 |
| **S0d** | all builds — one file plus one metadata row | delete the history row to un-mark it; the file is inert until replayed | none | none. Reverting restores the replay gap it closed; it cannot affect the live schema, which S0d never touched |
| **S1** | all builds; new tables are unread | drop-and-recreate is safe (no data) | new tables behind `data_model_v2` off | none — nothing reads them yet |
| **S2** | **builds ≥ S2 only** for `/auth/me` and `/admin/users` | re-point routes to `g.db` | per-route | **Reverting restores service-role table access** — a security regression, not a neutral rollback. Must be paired with disabling the converted routes rather than silently reverting |
| **S3** | (a)(b) all builds. **(c) builds ≥ S2 only** — removing `profiles` closes S2's compatibility window permanently | additive columns; corrective versions. (c) is not forward-fixable: recreate from migration if genuinely needed | `party_master` off | (a)(b) new rows orphaned, harmless. **(c) `profiles` data is gone** — it is superseded trial data (2 rows) already replaced by `app_users`, and the Product Owner backups retain it |
| **S4** | all builds | additive | `sku_master` off | as above |
| **S5** | all builds | additive; a bad Release is **withdrawn**, never deleted (CDM-26) | `pricing_basis` off | as above. `btree_gist` stays installed — dropping an extension is not a rollback step |
| **S6** | all builds; Batch still browser-local until S9 | additive; triggers droppable | `batch_supabase` off | Supabase Batches become unreachable but are retained |
| **S7** | **builds ≥ S7 only.** Pre-S7 builds compute Interest and blanks differently — the narrowest window in the programme | forward-fix in the resolver; snapshots keep their recorded engine version | `resolver_v2` off returns the old chain **and** the old golden values | Pre-S7 snapshots stay valid under their recorded `engine_version` (CDM-22). Working calculations recompute on next Calculate. **Reverting after any Send under S7 leaves snapshots the old engine cannot reproduce — acceptable only because CDM-22 forbids recomputation anyway** |
| **S8** | **builds ≥ S8 only** where a Pricing Group uses `ex_factory` — earlier builds have no such concept | forward-fix | `freight_authority_v2` off | Fingerprints recompute on next Calculate; `ex_factory` groups must be re-stated as `manual 0` if reverted |
| **S9** | **builds ≥ S9 only** once any Quote is issued from Supabase | forward-fix; corrections are new revisions | `quote_supabase` off | Issued revisions are immutable and unaffected. **This is the last slice with a clean revert** |
| **S10** | builds ≥ S10 for re-export of S10-era events | forward-fix | `export_events` off | Export history retained; re-export falls back to the recorded template |
| **S11** | n/a | re-run the seed | n/a | **The only destructive step, and only before cutover** (CDM-38). After cutover this route is disabled |
| **S12** | unchanged | n/a | n/a | none — validation only |
| **S13** | unchanged | n/a | per-plant enablement | none |

**Two programme-level rules.** First, **after Formal Data Cutover there is no destructive rollback**;
corrections are forward migrations and new versions (CDM-38). Second, **feature flags gate
functionality, never access** (§11) — turning a flag off must never be the only thing standing
between a user and data their grants do not permit.

---

## 16. Commit sequence and proof gates

### 16.1 The atomicity rule — **[ERROR corrected]**

Revision 1 both split schema and RLS into separate commits *and* claimed they never ship apart. The
rule now governs:

> **A commit that creates a table in `public` also enables RLS, `FORCE`s it where §7.2 requires,
> creates every policy, issues every grant and builds every index the policies need. There is no
> commit, and no moment between commits, at which an exposed table lacks its policies.**

This is enforceable, not aspirational: a `pgtap` assertion in every schema commit fails if any table
in `public` has `rowsecurity = false` or zero policies. Helper functions are created **before** the
first table that references them, in the same commit.

**Two gates apply to every slice that touches the database, added in revision 6:**

> **G-A — local ⇄ remote migration alignment.** After each database slice, the set of versions in
> `quote-gen-be/supabase/migrations/` must exactly equal the set in
> `supabase_migrations.schema_migrations`. A file with no remote row means an unapplied migration; a
> remote row with no file means a change that escaped review. Both fail the gate.
>
> **G-B — fresh-environment replay, before S1 is considered complete.** Replaying every migration in
> order against an empty database must produce a schema matching the live project, with `ensure_rls`
> present and enabled, the S0b migration succeeding, and the resulting ACL leaving only `postgres`
> with `EXECUTE`. S0d supplied the missing prerequisite, so the known blocker is gone — but **the gate
> is still unverified**, because no container runtime or PostgreSQL exists on the development machine.
> Close it where Docker is available: `supabase start` then `supabase db reset --local`.

### 16.2 Sequence — 17 slices, 30 commits

| Slice | Commits | Proof gate |
|---|---|---|
| **S0a** — read-only audit | 1 — findings document only | **Produces evidence E-1 … E-6 below. No database change of any kind.** S1 approval is gated on it |
| **S0b** — privilege change ⚠️ | 1 — revoke `EXECUTE` on `rls_auto_enable` | Advisor re-run shows lints `0028`/`0029` cleared. **Requires explicit Product Owner authorisation** (§9) |
| **S0c** — version-controlled migration provenance | 1 — `supabase/` structure plus three **reconstructed** historical migrations | G-A passes: local and remote version sets identical. Every reconstructed body byte-exact against `schema_migrations.statements` (MD5 + byte length). S0b file holds exactly the four authorised `REVOKE`s. No secret in any file. Generated `config.toml` lists the same two exposed schemas verified live in E-1 — no broadening. **G-B does not yet pass**, by the finding above |
| **S0d** — migration-history baseline repair | 1 — one **synthetic baseline** migration + one history metadata row | Drift hash identical before and after (`c570e357…215f`) — no schema change. Function body, owner, return type, security mode and event-trigger binding unchanged. S0b's four grants still revoked. Local ⇄ remote sets align on four versions. Synthetic row carries `statements = NULL`. **G-B removed of its known blocker but still unverified** — no replay environment on this machine |
| **S1** — foundation | 2 — (a) family A tables + explicit `revoke` + RLS + `FORCE` + policies + column grants + `app_private` helpers + indexes, atomically; (b) `pgtap` install + the N-1…N-9 harness + the RPC-404 CI test | **All nine of §7.3 pass**, including the recursion proof (N-3) and the `rolbypassrls` assertion (N-5); `anon` holds no privilege anywhere; `app_users.status` is not updatable by its owner; `/rest/v1/rpc/has_plant_cap` returns 404 |
| **S2** — caller context | 2 — (a) per-request client; (b) route conversion + CI assertion | Wrong-plant Maker gets zero rows through the backend; concurrent requests never cross tokens; `get_supabase_admin` only at allow-listed sites |
| **S3** — party | 3 — (a) family B + RLS; (b) graduation/merge/reassign RPCs; (c) ⚠️ **remove `public.profiles`, `app_private.is_admin` and the three legacy policies** | One-current-membership holds under concurrency; codes never reused; Maker may create a Proposed Prospect and nothing more. For (c): nothing references `profiles`; N-8's inventory matches the post-removal expected set (§7.6.1) |
| **S4** — product | 2 — (a) family C + RLS; (b) proposal/publication RPCs | **No waste/conv column exists on `construction_versions`**; approved versions immutable; wrong-plant SKU invisible |
| **S5** — masters and Pricing Basis | 2 — (a) family D + RLS; (b) `btree_gist` + family E + approval RPC | Overlapping alternatives allowed, overlapping defaults rejected; unapproved component rejected |
| **S6** — batch core | 3 — (a) family F tables + RLS + composite FKs; (b) SET triggers + counter; (c) locks + CAS RPCs | Every §5 composite FK rejects its negative case; active empty SET impossible; racing reclaims yield one winner; heartbeat leaves `content_version` untouched |
| **S7** — resolver ⚠️ | 3 — (a) resolver module + tests; (b) **engine change** (`costing.js:35`, `:81`); (c) materialisation removal ×5 | Full `test:costing` golden diff reviewed line by line; all five fields correct for blank/zero/value; clearing a field stores `null` |
| **S8** — freight and divergence ⚠️ | 2 — (a) freight authority + **engine change** (`costing.js:29-32`); (b) fingerprints | Explicit zero ≠ unresolved; unresolved blocks; three divergence states correct |
| **S9** — quote | 3 — (a) family G + RLS; (b) atomic Send RPC; (c) workflow RPCs | UPDATE on `quote_items` fails for every role incl. Admin; PM-7 lineage survives later row edits; Send is all-or-nothing under induced failure |
| **S10** — export | 2 — (a) export tables + RLS; (b) templates and reconciliation | Export matrix green; no first-item assumption |
| **S11** — reset and seed ⚠️ | 1 + approved reset | Import rejects blanks and inert keys; sequences verified; Construction waste/conv absent. **Prerequisite input: reviewed Sector target margins** (§13.3) — the `not null` column makes a partial seed fail rather than default silently |
| **S12** — validation | 0 | Product Owner scenario sign-off |
| **S13** — pilot | 1 | Rollback rehearsal completed; advisors clean |

**S0a must produce exactly this evidence**, all of it read-only:

| # | Evidence | Method | Why S1 depends on it |
|---|---|---|---|
| **E-1** | The project's **exposed-schema list** (Dashboard → Settings → API) | console read | **The decisive one.** Helper non-exposure is what keeps a postgres-owned, `BYPASSRLS`-backed definer function off the public API. If the list holds anything beyond `public`/`graphql_public`, that is reported before any table exists |
| **E-2** | Live probe: unauthenticated and authenticated `POST /rest/v1/rpc/is_admin` | HTTP | Confirms E-1 empirically rather than by configuration reading alone |
| **E-3** | `SECURITY DEFINER` inventory with owner, `search_path`, `proacl` for every schema | `pg_proc` SELECT | Establishes N-8's baseline; already gathered for `is_admin` and `rls_auto_enable` (§7.0, §7.6.1) |
| **E-4** | Role attributes for `postgres`, `authenticated`, `anon`, `service_role` | `pg_roles` SELECT | The `rolbypassrls` fact the entire recursion model rests on (N-5 re-asserts it in CI) |
| **E-5** | Default privileges and current grants on `public` objects | `pg_class.relacl`, `pg_default_acl` | Confirms the `GRANT ALL to anon` default that T-20's revocation exists to undo |
| **E-6** | `get_advisors` security + performance baseline | MCP read-only | The before-picture for S0b and S13 |

**All six were gathered and accepted on 2026-09-04**; E-1 and E-2, the two that were outstanding when
this section was written, are recorded at [`data-model-s0a-evidence.md`](data-model-s0a-evidence.md).
E-1 returned `public, graphql_public`; E-2 found `is_admin` unreachable at two independent layers.

⚠️ marks a slice needing explicit authorisation beyond ordinary commit approval: **S0b** (privilege
change), **S3(c)** (removal of live objects), **S7** and **S8** (`engine/costing.js`), **S11**
(destructive reset).

Cross-layer invariants stay atomic within a commit: the engine change ships with its golden file, and
tables ship with their policies. **Formal Data Cutover is not among these commits** — it is a separate
Product Owner event after S12 (§10).

---

## 17. Consolidated register

### 17.1 Product Owner decisions — **zero outstanding**

Both commercial questions are resolved and recorded canonically. They are incorporated throughout
this revision; **no alternatives remain in the document.**

| Ruling | Incorporated at |
|---|---|
| **Sector Margin.** Each Sector maintains an approved default target margin. Batch Box/PP defaults may override it for the customer opportunity; an individual row may exceptionally override the Batch. The chain is `row → Batch Box/PP → Sector → system fallback`, exactly as CDM-19 states | `sector_versions.margin_pct` is a **real, required** column (§4.4); resolver chain confirmed (§10.2); import map carries a seed obligation (§13.2); tests in §14 |
| **Payment Terms.** The structured calculating list is **closed at 30/45/60/90 days → 0.5 % / 0.75 % / 1.0 % / 1.5 %**. Other wording is descriptive only. A map miss uses the versioned **0.5 %** fallback | `payment_interest_map_entries` closed-list check and `pricing_groups.payment_terms_days` check (§4.4, §4.6); resolver (§10.2); `is_open_ended` column **removed**; tests in §14 |

**One seed obligation follows from the first ruling and is a delivery task, not a question.** The
live Sector master carries no margin — entries are `code, name, wasteCBB, wastePP, convBox, convPP,
specLang` (`data/defaults.js:57-62`). A reviewed target margin per sector must therefore be supplied
during **S11** seeding. S11 cannot complete without it, and §13.2 records it as a required input.

### 17.2 Mandatory technical corrections — already incorporated

No decision needed; each follows from an approved CDM rule and is carried in the slice shown.

| # | Correction | Slice | Origin |
|---|---|---|---|
| T-1 | Helpers: revoke from `public`, grant to `authenticated`; non-exposed schema | S1 | rev 2 |
| T-2 | **Recursion broken by `postgres.rolbypassrls`, verified; uniform `FORCE` on all tables; `app_private` adopted** | S1 | **rev 3** |
| T-3 | Explicit read capabilities replace "authenticated and active" | S1, S3, S4 | rev 2 |
| T-4 | `pricing_basis_components` removed; four typed `not null` FKs | S5 | rev 2 |
| T-5 | Conversion rate is ₹/kg, not a percentage | S5, S6 | rev 2 |
| T-6 | Composite FKs for the seven structural invariants | S6 | rev 2 |
| T-7 | Triggers, with reasons, for the three that cannot be FKs | S6 | rev 2 |
| T-8 | SET code unique index unconditional, normalised `upper(btrim(...))` | S6 | rev 2 |
| T-9 | Per-request Supabase client; never mutate a singleton | S2 | rev 2 |
| T-10 | `/admin/users` off the privileged allow-list | S2 | rev 2 |
| T-11 | `rls_auto_enable` execute revoked | S0b | rev 2 |
| T-12 | Three `engine/costing.js` reconciliations under approved engine commits | S7, S8 | rev 2 |
| T-13 | Five materialisation sites write `null` | S7 | rev 2 |
| T-14 | Snapshot hybrid typed/JSONB, never-migrated `schema_version` | S9 | rev 2 |
| T-15 | Reference gaps arise only from committed-but-unused allocations | S1 | rev 2 |
| T-16 | Tables, RLS, policies, grants and indexes in one commit | all | rev 2 |
| T-17 | **Numeric contract re-derived; storage / export rounding / reconciliation tolerance specified separately; the Excel exactness claim withdrawn** | S5, S10 | **rev 3** |
| T-18 | `btree_gist` installed for default-coverage exclusivity | S5 | rev 2 |
| T-19 | `pgtap` installed as the constraint/RLS harness | S1 | rev 2 |
| T-20 | **Explicit `revoke all … from anon, authenticated` on every new table — Supabase's default grant is `ALL`, verified live** | all schema commits | **rev 3** |
| T-21 | **Column-level `grant update (display_name)` on `app_users`; all admin user changes RPC-only** | S1 | **rev 3** |
| T-22 | **Pricing Basis: one policy per legal transition + immutability trigger** | S5 | **rev 3** |
| T-23 | **Sector Margin tier is real: `sector_versions.margin_pct` required; seed values needed at S11** | S5, S11 | **rev 3** |
| T-24 | **Payment Terms closed list enforced by check constraint on both the map and `pricing_groups`** | S5, S6 | **rev 3** |
| T-25 | **Uniform `ENABLE` + `FORCE ROW LEVEL SECURITY` on every `public` table; no carve-out** | S1 | **rev 4** |
| T-26 | **`app_private.is_admin` hardened (S1), replaced (S2), removed (S3); added to the reviewed `SECURITY DEFINER` inventory** | S1–S3 | **rev 4** |
| T-27 | **Schema names settled: `app_private` (existing) and `ref_private`; P-2/P-5 and all prose updated** | S1 | **rev 4** |
| T-28 | **One policy per table/action; the transition matrix moves into the `BEFORE UPDATE` trigger, which also binds `BYPASSRLS` roles** | S3–S5 | **rev 5** |
| T-29 | **Eight consolidation negative tests N-P1 … N-P8; advisor `0006` and `0003` predicted at zero** | S3–S5, S13 | **rev 5** |

### 17.3 Technical verification required **before** S1 approval — **all resolved**

| # | Item | Status |
|---|---|---|
| **V-1** | Helper ownership and RLS-bypass mechanism | ✅ **Resolved (§7.0, §7.2).** All objects are `postgres`-owned; `postgres.rolbypassrls = true` (verified live), which is what terminates policy recursion. Uniform `FORCE` on all tables. `BYPASSRLS` on a new role is unavailable (needs superuser; only `supabase_admin` qualifies). Fallback documented (**not adopted**): `app_authz` owning the four authorisation tables without `BYPASSRLS`, which would be the only case requiring those tables to be `ENABLE`d but not `FORCE`d. Proved by N-3, N-4, N-5, N-6 |
| **V-2** | Non-exposure of the helper schema | ✅ **RESOLVED by accepted S0a evidence (§7.6).** The running PostgREST instance enumerates its permitted list as **`public, graphql_public`**; `app_private` is rejected with `PGRST106`, and two controls prove the enumeration discriminates. `is_admin` is unreachable at two independent layers. Authenticated probes are carried into S1 as a **regression test**, not an open question — `PGRST106` precedes role assumption. The S1 404 test continues as the regression guard |
| **V-8** | Disposition of the pre-existing `app_private.is_admin` | ✅ **Resolved (§7.6.1).** Body, owner, security mode, `search_path`, grants and callers recorded from live introspection; no application code calls it. Retained and hardened in S1, replaced in S2, removed in S3. Added to the reviewed `SECURITY DEFINER` inventory so N-8 has a defined expected result |

**S0a is complete and its evidence accepted (2026-09-04). No verification item now blocks S1
approval.** The evidence artefact is [`data-model-s0a-evidence.md`](data-model-s0a-evidence.md);
§16.2 lists the six items it was required to produce. One pre-existing hygiene defect remains open
and blocks nothing — the inert `EXECUTE` grant on `public.rls_auto_enable`, awaiting **S0b**
authorisation.

### 17.4 Technical verification legitimately deferred to later slices

Each is scoped to the slice that first needs it and cannot be answered earlier without building that
slice.

| # | Item | Resolve in |
|---|---|---|
| V-3 | "All Release components already approved" cannot be a `CHECK` (no subqueries). Confirm the approval RPC + `pgtap` pairing suffices, or add a trigger | **S5** |
| V-4 | Exact JSONB key set for `inputs`/`results` v1, derived from `calcCosting`'s return (`engine/costing.js:98-99`) | **S9** |
| V-5 | Whether Vercel's 10 s function cap (`CLAUDE.md`) constrains the atomic Send RPC for a large Batch; measure, and move Send behind a longer-running path if needed | **S9** |
| V-6 | Confirm `plants.timezone` is the right FY source for all three plants (all currently India) | **S1** (non-blocking: the seed value is `Asia/Kolkata` either way) |
| V-7 | Reconciliation tolerances (§3.5) validated against real workbook output across the §14 export matrix | **S10** |

### 17.5 Deferred and out of scope

Unchanged from CDM-40 and §13: route profitability; cost-versus-Quote and realised-margin
intelligence; risk-premium calculation; order, tax and invoicing workflows; colour-count capture or
pricing; live or bidirectional Sheets synchronisation; multiple simultaneous Batch editors; final
workbook layout redesign; Pricing Group-level validity overrides; later permission routes beyond
initial Admin control; migration of disposable trial history; and the separate **Commercial
Intelligence** workstream, which was not read.

---

## 18. Confirmation

- **Nothing was implemented.** No application code, database object, migration, Supabase schema
  change, deployment configuration, repository history or commit was created or altered.
- Supabase access was **read-only throughout**: `list_tables`, `list_migrations`, `list_extensions`,
  `get_advisors`, and — for §7.0's V-1/V-2 evidence — `execute_sql` running **only `SELECT`
  statements against catalog views** (`pg_class`, `pg_proc`, `pg_roles`, `pg_namespace`,
  `pg_policy`). No DDL, no DML, no `apply_migration`, no branch operation.
- Only `docs/data-model-sr-dev-proposal.md` was written. No canonical record was altered.
- The uncommitted `src/tabs/batch/BatchProfileBar.jsx` change was preserved untouched.
- `docs/commercial-intelligence-decisions.md` was not read.
- Every SQL fragment is a **proposal pending Product Owner approval**.
