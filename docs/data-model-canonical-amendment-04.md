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

**Settled customer (ruled, see D-13):** a Party that has graduated to Customer and holds a permanent
Customer Code. A Prospect is not settled.

**Quotation use (ruled, see D-14):** a Proposed SKU and an unapproved version are calculated and
quoted exactly as a Prospect is admitted incomplete in the Customer Family Master.

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

## D-13 — A settled customer (Product Owner, 2026-09-16)

A customer is **settled** when its Party has graduated to Customer and holds a permanent Customer Code.
A Prospect is not settled. This is where D-06's SKU Set second approval applies (slice 2).

## D-14 — Proposed SKUs are quotable, as Prospects are (Product Owner, 2026-09-16)

> It should be allowed to be calculated just like prospects / new customers are allowed to be added
> in an incomplete manner in the Customer Family Master, without holding back the quote per se.
> Exactly the same behaviour.

This replaces the applied gates that contradicted D-01 and CDM-11: governed Calculate refused a
Proposed SKU (`sku_not_published`, `s7r_7`), Atomic Send refused an unapproved version and a Proposed
SKU (`s9b`), and the Batch row picker offered only approved versions. Now a Proposed SKU and an
unapproved version are calculated, sent and offered (labelled); only a **withdrawn** SKU is refused
(`sku_withdrawn`). The calculation provenance already records the SKU status, so the Checker sees a
Proposed SKU in the evidence — the Maker/Checker workflow is where approval for a settled customer is
exercised. Migration `20260917030435_u2_proposed_skus_are_quotable` (authored as `20260916210000`).

## Wording added to `data-model-decisions.md`

A new **CDM-46 — SKU Master editing by due authority** summarising D-01 to D-12 and pointing here, and
one-line amendment notes under CDM-11 and CDM-31.

## Implementation, 2026-09-16 (slice 1)

- Backend `863e652`: migration `20260917030403_u2_sku_master_governed_operations` (authored as
  `20260916200000`); it requires Amendments 02 and 03 first. Static contract 85/0. Its pgTAP suite
  `tests.sku_governed_operations` is registered in `run_all`.
- Backend `c515108`, `4e4cbde`: twelve governed routes and the activation signal; route gate 195/0.
- Frontend `603af76`: Actions, version editor, references, Propose and History in the SKU Master;
  `test:sku-master` 126/0. Fixture-browser verified only.
- Known activation risk, pre-existing: Amendment 03's `NOT NULL` portfolio breaks every existing
  database fixture that inserts a SKU without one. Migration `20260917025921` (authored as `20260916170500`)
  repoints the nineteen fixture inserts.
- Activation, 2026-09-17: all five SKU migrations applied live in order — 02 (`20260917024849`), 03
  (`20260917024903`), fixtures (`20260917025921`), 04 (`20260917030403`), quotability
  (`20260917030435`). Live pgTAP, each suite run alone and rolled back: `sku_governed_operations`
  67/0, `product_workflow` 68/0, `sku_master` 47/0, `family_c_authority` 23/0. The Batch-creating
  suites (`batch_sets`, `batch_workspace`, `family_f_security`, `calculation_writer`,
  `calculation_persistence`) still abort on the pre-existing empty Sector master, so they are not
  verified. No governed write has been exercised through the authenticated live app.
