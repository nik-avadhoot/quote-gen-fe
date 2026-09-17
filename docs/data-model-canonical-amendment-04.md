# Canonical Amendment 04 — SKU Master editing by due authority

**Status:** canonical amendment. Product Owner rulings of 2026-09-16 on
[`u2-sku-master-governed-edit-design-packet.md`](u2-sku-master-governed-edit-design-packet.md)
(decisions D1–D12). This document records them in canonical form and states the wording they put
into [`data-model-decisions.md`](data-model-decisions.md), which remains the single canonical record.

**Relationship to earlier records.** It extends CDM-09, CDM-10, CDM-11, CDM-31, CDM-44 and CDM-45 for
the SKU Master. Where it departs from an earlier rule, the departure is stated below rather than left
implicit.

---

## D-01 — Speed before approval for new SKUs; approval for settled customers (principle)

The Product Owner's ruling, recorded as a **canonical principle**:

> Speed for new SKUs, new customers and changes is critical in quotation, so approvals cannot hold the
> SKU record back from quotation. For settled customers, approval is critical.

Consequences ruled now:

- **Due authority** is `manage_sku_master` at the SKU's own Producing Plant.
- **The same person may propose and approve**, initially. How this works in practice is to be
  discovered and revisited.
- **A Maker (`make_quote`) may propose** a SKU and its versions (CDM-11).
- NPD works on production specifications, which may differ from the customer's specification; the
  SKU Master records the customer-facing quotation and costing fields (CDM-43).

**Departure from CDM-31 PM-2**, stated: PM-2 requires second-person approval for calculation-driving
master changes. For the SKU Master, second-person approval is **not** required initially (see D-06
for the one place it applies).

**Not yet decided — see "Open" below:** what makes a customer *settled*, and how approval gates
quotation use for settled customers without holding back new ones.

## D-02 — Field classes

| Class | Fields |
|---|---|
| Never editable | Producing Plant, Customer (CDM-09) |
| In place on the SKU | pricing portfolio (CDM-45 C-03) |
| Lifecycle operations, not edits | status, replacement link |
| **New SKU** | length, width, height, Construction version (ply, flutes, board layers), BS / BCT / ECT, box type, customer-stated Item GSM / CS / BS / ECT |
| **Price-driving version** | Cobb value, item weight, ups |
| **Version** (or, by explicit choice, a new SKU as the customer orders it) | Item Name, Item Short Name, print quality, Print Technology, Number of Colours, colour detail, customer spec version, Item Family, Item Group |

A draft (unapproved) version is edited in place until approved. The first version of a SKU that has
never been approved may change any field.

## D-03 — Plant Item Code and publication are separate

The permanent Plant Item Code (CDM-09) is assigned while Proposed and does not publish. Publishing
(Proposed → Active) requires a code, an approved version and a pricing portfolio. A code, once used at
a plant — including a retired code recorded as a legacy reference — is never reissued.

## D-04 — Lifecycle and replacement

Discontinuing requires a reason. A replacement is a different, active SKU of the **same plant and
Customer**, linked and never substituted (CDM-11). Reactivation keeps identity and clears the link;
the history keeps it. A Proposed SKU may be **withdrawn** (terminal) instead of deleted (CDM-31).

## D-05 — External references

References are added and withdrawn, never edited in place.

## D-06 — SKU Sets

Membership is confirmed by internal SKU identity, never inferred from code text (CDM-44). **Second
approval applies only to settled quotes during the SKU Master stage.** For new SKUs and customers,
approval must not compromise speed; the Maker/Checker quotation workflow covers them.

## D-07 — Location applicability is deferred to a later slice

## D-08 — Optimistic concurrency

Every operation takes `expected_content_version` and a stale write is refused, never retried silently.
The database maintains the tokens.

## D-09 — History

An append-only SKU Master history records actor, instant, operation, the material before and after,
and the reason. It is scoped to the SKU Master (Family C), not a general audit architecture.

## D-10 — The direct write path is closed

Every SKU write goes through a governed operation; the direct table grants are revoked.

## D-11 — Before activation, controls are visible and disabled

Until the operations are applied in an environment, their controls are shown **disabled with the
reason "Schema activation pending"**, the same visibility rule as S9.

## D-12 — Slices

1. SKU, versions, Plant Item Code, lifecycle, portfolio and references;
2. SKU Sets;
3. Location applicability.

---

## Open — needs a Product Owner ruling before slice 2 and before quotation gating changes

1. **What makes a customer "settled"?** For example: a Party that has graduated to Customer (holds a
   permanent Customer Code); or a customer with at least one issued Quote; or an explicit flag.
2. **Quotation gating conflicts with D-01 today.** The applied governed Calculate eligibility
   (`app_private.assert_calculate_eligible`, migration `s7r_7`) refuses a **Proposed** SKU
   (`sku_not_published`), and the Batch row picker offers only **approved** versions. So today a new
   SKU cannot be quoted until it is published and approved — the opposite of "approvals cannot hold
   the SKU record for quotation". CDM-11 already says a Maker may quote a Proposed SKU. Changing the
   calculation path is S9-adjacent and was **not** changed in slice 1.

## Wording added to `data-model-decisions.md`

A new **CDM-46 — SKU Master editing by due authority** summarising D-01 to D-12 and pointing here, and
one-line amendment notes under CDM-11 and CDM-31.

## Implementation, 2026-09-16 (slice 1)

- Backend `863e652`: migration `20260916200000_u2_sku_master_governed_operations` — **prepared, NOT
  applied**; it requires Amendments 02 and 03 first. Static contract 85/0. Its pgTAP suite
  `tests.sku_governed_operations` is registered in `run_all`; database-runtime verification is owed at
  activation.
- Backend `c515108`, `4e4cbde`: twelve governed routes and the activation signal; route gate 195/0.
- Frontend `603af76`: Actions, version editor, references, Propose and History in the SKU Master;
  `test:sku-master` 126/0. Fixture-browser verified only.
- Known activation risk, pre-existing: Amendment 03's `NOT NULL` portfolio breaks every existing
  database fixture that inserts a SKU without one.
