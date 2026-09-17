# U2 SKU Master — governed editing by due authority: design packet

Status: **ruled 2026-09-16** — recorded as [Canonical Amendment 04](data-model-canonical-amendment-04.md)
(D1 same-person approval allowed initially, as a canonical speed-first principle; D6 second approval
only for settled quotes; every other recommendation approved). Slice 1 is implemented and its five
SKU migrations were applied live on 2026-09-17; see the amendment for current evidence.

## 1. What existed when this packet was ruled (2026-09-16)

| Area | Truth |
|---|---|
| Live schema at ruling time | S4-2 `20260905142733_s4_2_family_c_sku_master` and S4-3 `20260905182113_s4_3_product_definition_workflow_rpcs` were applied. Amendments 02 and 03 were then prepared but unapplied; both and Amendment 04 are now applied under their recorded 2026-09-17 versions. |
| Tables | `skus` (plant, party, `plant_item_code`, `status`, `replacement_sku_id`, `content_version`), `sku_versions` (Construction version, dimensions, box type, ups, BS/BCT/ECT, `is_price_driving`, approval pair), `sku_external_references`, `sku_location_applicabilities`. Amendment 02 adds the 15 quote fields, the `softcomp_code` kind, `sku_sets` and `sku_set_members`; Amendment 03 adds `skus.pricing_portfolio`. |
| Read authority | RLS `has_plant_cap(plant_id, 'plant_access')` on every SKU table. |
| **Write authority today** | `authenticated` holds **INSERT and UPDATE grants** on the four S4-2 tables, with UPDATE policies for `manage_sku_master` and INSERT policies for `manage_sku_master` or a narrow Maker proposal branch (`make_quote`). **A direct table write is possible today** without any governed operation — the same bypass class UA-3 closed for user grants. No DELETE policy exists (CDM-31). Amendment 02/03 add no write grant or policy. |
| Database guards | An approved `sku_versions` row is immutable; `plant_item_code` is permanent once set; status moves only proposed→active→discontinued→active (reactivation keeps identity). |
| Functions | `propose_sku` (manage_sku_master or make_quote), `approve_sku_version` (manage_sku_master; no proposer ≠ approver rule), `assign_plant_item_code` (**assigns the code AND activates** in one step), `set_sku_status` (no reason, no replacement link). All SECURITY DEFINER in `app_private` with invoker shims in `public`. |
| Concurrency | None of the four functions takes `expected_content_version`. `skus.content_version` exists but **no trigger maintains it** (the `guard_content_version` trigger is on Batch tables only); `sku_versions` has no token. |
| Audit | **No audit table exists in the project** (recorded in S6-14). Only `created_by` / `approved_by` columns. |
| Callers | **No backend route calls any SKU write function.** Nobody holds `manage_sku_master` except accounts given it by direct database writes during setup (U1 packet §2). |
| S9 | SKU tables are **Family C**. Editing a SKU writes no Family G (Quote) table, so it neither enables nor relies on production Quote mutations. The one S9-adjacent rule is CDM-09's "plant and party immutable once on an issued Quote", which needs a Family G read; this packet proposes plant and party are never editable at all, so it is not reached. |

## 2. Decisions considered (all ruled in Amendment 04)

The wording below preserves the choices presented for the ruling. The approved outcomes, not these
pre-ruling recommendations, are authoritative in Canonical Amendment 04.

**D1 — Due authority.** `manage_sku_master` at the SKU's plant is the existing, RLS-enforced
capability. CDM-31 PM-2: calculation-driving changes need second-person approval; routine
descriptive changes may publish directly. CDM-11: a Maker may propose; NPD/Admin publishes.
- (a) single authority for everything;
- **(b) recommended:** PM-2 split — calculation-driving changes are proposed then approved by a
  *different* `manage_sku_master` holder; descriptive and classification changes by one holder;
- (c) proposer ≠ approver for every change.
Also rule: may one person who holds both roles approve their own proposal (CDM-33 allows it for
Quotes)? Recommended **no** for SKU Master.

**D2 — What edits in place, what makes a new version, what forces a new SKU.**

| Class | Fields | Basis |
|---|---|---|
| Never editable | plant, Customer (party) | CDM-09: another plant or Customer is another SKU |
| In place on the SKU, single authority | pricing portfolio | CDM-45 C-03 (ruled) |
| Lifecycle operation, not an edit | status, replacement link | CDM-11 |
| **New SKU (ruled)** | length, width, height, Construction version (ply, flutes, board layers), BS / BCT / ECT | CDM-10 |
| New SKU — **needs ruling** | box type; stated Item GSM, CS, BS, ECT (customer-stated strength text) | recommended: new SKU (box type changes the die line; stated values are strength) |
| New version, or a new SKU "as the customer orders it" | Item Name, Item Short Name, print quality, Print Technology, Number of Colours, colour detail, customer spec version | CDM-10; recommended: new version by default, with an explicit "create as a new SKU instead" choice |
| New version — **needs ruling** | Item Family, Item Group; Cobb value (drives coating cost, CDM-43); item weight; ups | recommended: Family/Group descriptive version; Cobb, weight and ups price-driving versions (second person per D1) |

A draft (unapproved) version stays editable in place by its proposer or a `manage_sku_master`
holder until approved; `is_price_driving` is set explicitly on every new version (the schema has no
default by design).

**D3 — Plant Item Code (CDM-09).** Today assignment and activation are one step.
- **Recommended:** split them. Assign the code any time while Proposed (permanent from that moment,
  unique within the plant); publish (→ Active) separately, requiring a code, an approved version and —
  once Amendment 03 is live — a portfolio. A retired code is never reissued; it is recorded as a
  `legacy_plant_item_code` reference.

**D4 — Lifecycle and replacement (CDM-11).**
- Discontinue: reason required? Recommended **yes**. Optional replacement link to a SKU at the **same
  plant and same Customer**, never substituted in any Batch.
- Reactivate: keep or clear the replacement link? Recommended **clear it, recorded in history**.
- A Proposed SKU that should never go live has no terminal state today; CDM-31 says proposals are
  Withdrawn, not deleted. Recommended: add `withdrawn` (from Proposed only) — a schema change.

**D5 — External references.** Recommended: add and withdraw only (no in-place value edit), single
authority, kinds Customer Item Code, SoftComp Code, legacy Plant Item Code, alias, other; values not
unique (as the schema already rules).

**D6 — SKU Sets (CDM-44).** Membership confirmed by internal SKU id chosen from that plant's SKUs,
never inferred from code text; at most one active box; quantity per set strictly positive; codes
outside A / P / Q take no role until ruled. Quantity per set multiplies the set rate, so under D1(b)
it would be calculation-driving. Rule: second person for set confirmation and quantity changes?
Recommended **yes**.

**D7 — Location applicability.** Master-scope applicability approval is a separate SKU write.
Recommended: **defer** to a later slice.

**D8 — Optimistic concurrency.** Recommended: add the existing `guard_content_version` trigger to
`skus`, `sku_sets` and `sku_set_members`, add a token to `sku_versions` for draft edits, and have every
operation take `expected_content_version` and raise `PT409` on a stale write (the D2 convention),
surfaced as "changed elsewhere — reload" with no silent retry.

**D9 — Audit / history (CDM-34).** No audit table exists. Options:
- **(a) recommended:** a narrow append-only `sku_master_events` table (actor, instant, operation, entity
  and id, material before/after, reason) written inside each governed function, readable with
  `plant_access`;
- (b) rely on immutable versions and created/approved columns — cannot show portfolio, lifecycle,
  code or reference history;
- (c) wait for S10's general audit.
S6-14 warned against a partial general-purpose audit architecture; (a) is deliberately Family-C-only.

**D10 — Close the direct-write bypass.** Recommended: revoke INSERT/UPDATE from `authenticated` on the
SKU tables and drop the write policies, so every write passes through a governed function (UA-3
precedent). No route uses direct writes today; database test fixtures that insert SKUs must be
proven to run outside `authenticated`.

**D11 — Deployment shape.** One prepared, **unapplied** migration with a static contract, depending
on Amendments 02 and 03. Until it is applied the route answers `SCHEMA_ACTIVATION_PENDING`. Rule: in
the live app, are the edit controls hidden, or visible and disabled with "Schema activation
pending"? Recommended: **visible and disabled with that reason**, the same visibility rule as S9.

**D12 — Increment slicing.** Recommended:
1. governed functions + routes + form for propose SKU with version, edit draft version, approve version,
   assign code, publish / discontinue (with replacement) / reactivate, portfolio change, references;
2. SKU Set membership;
3. Location applicability.

## 3. What will be built once ruled

- Backend: prepared migration (functions with CAS, lifecycle and field-class rules, event table if
  D9a, bypass closure if D10) plus static contract test; Flask routes under `/masters/skus/*` as the
  caller only, stable error codes (`CAPABILITY_REQUIRED`, `INVALID_INPUT`, `STALE_VERSION`/PT409,
  `TRANSITION_NOT_ALLOWED`, `SCHEMA_ACTIVATION_PENDING`); route gate.
- Frontend: a governed form in the SKU detail panel gated on `manage_sku_master` at that plant, showing
  per field whether a change edits in place, creates a version, or requires a new SKU; confirms that
  state the consequence; fixture gate and fixture preview.
