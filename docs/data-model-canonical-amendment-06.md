# Canonical Amendment 06 — Producing Plant assignment for Customer Families and Customers

Date: 2026-09-18
Status: **Draft for Product Owner approval — not implemented, no migration prepared**
Authority: Product Owner rulings of 2026-09-18 (points 1–4 below)
Amends: CDM-04. Adds: CDM-48.

## Why

CDM-04 makes Customers group-wide: nothing in the database, backend or frontend relates a Customer
Family, Customer or Location to a Producing Plant. A Family meets a plant only indirectly, through a
Batch (CDM-14) or a SKU (CDM-09). The Product Owner has ruled that every Customer Family is served by
named Producing Plants, and that this must both narrow selection and be enforced.

## Product Owner rulings — 2026-09-18

1. **Filter and enforce.** Selection offers only assigned plants, and the database refuses work that
   pairs a Family or Customer with a plant it is not assigned to.
2. **Customer-level assignment** exists as well, but only where the Customer's Family is assigned to
   more than one plant.
3. **Authority:** direct edit initially; to move to propose/approve later.
4. **Initial data:** every kept Family is assigned to `NAG` only.

## CDM-04 as amended

Avadhoot Group is the common organisational family. Its three Producing Plants are separate supplying
and administrative units. Customers and Constructions are group-wide **records**; each Customer Family
and Customer is **served by** the Producing Plants assigned under CDM-48. SKUs, Pricing Basis
Releases, Batches, Quotes, sequences and Construction adoption are plant-owned.

## CDM-48 — Producing Plant assignment

**Family assignment.** Every Customer Family is assigned to at least one active Producing Plant and may
be assigned to all of them. A Family cannot be proposed, approved or activated without one — the same
deferred-constraint pattern that already requires every Family to hold a Sector
(`trg_customer_family_requires_sector`).

**Customer assignment.** Where a Family is assigned to exactly one plant, its Customers are served by
that plant and no Customer-level assignment exists. Where a Family is assigned to more than one plant,
a Customer may be assigned to a non-empty subset of the Family's plants. A Customer's plants can never
exceed its Family's.

**Effective plants.** A Customer's effective plants are its own assignment where one exists, otherwise
its Family's plants (see D-1).

**Filter.** Plant-owned work offers only what is effective at its plant:

- Batch creation offers only Families assigned to the Batch's plant;
- within a multi-plant Family, Customer, Bill-to and Ship-to selection offers only Customers effective
  at the Batch's plant;
- SKU proposal offers only Customers effective at the SKU's plant;
- a Freight lane offers only destination Locations whose Customer is effective at the lane's origin
  plant.

**Enforcement.** The database refuses, with a stable error code:

- a Batch whose Family is not assigned to the Batch's plant (`create_batch`);
- a Delivery Group Bill-to/Ship-to, SKU or Freight entry whose Customer is not effective at the
  relevant plant;
- a Customer assignment outside its Family's plants;
- removing the last plant from a Family.

**History is not rewritten.** Enforcement applies when a row is created or next written. Issued and
superseded Quote evidence stays valid whatever later assignment changes occur. Assignment rows are
never deleted: withdrawal is a recorded status change with actor and time.

**Authority, initially.** A holder of the group capability `manage_customer_master` edits a Family's
plants and a Customer's plants directly. Each edit replaces the complete set in one compare-and-swap
operation (`expected_content_version`), like capability grants, and is attributed by the database.
Direct authenticated INSERT/UPDATE is closed. A later amendment converts this to propose/approve. The
row shape is chosen so that conversion adds a lifecycle without restructuring the data.

**Visibility.** Customer masters stay group-wide for reading. The assignment narrows selection for
plant-owned work, not who may see a Customer (see D-4).

## Initial data

| Family | Assigned plants |
|---|---|
| 202 · G0080 Nagpur Distillers | `NAG` |
| 262 · G0110 Vidarbha Packaging Works | `NAG` |

Both Families are single-plant, so no Customer-level rows are created. The trial Families 208, 396 and
261 are expected to be deleted before this lands; if they still exist, each needs an assignment first.
The live data is trivially compliant: 0 Batches, 0 SKUs, and the governed freight lane (once
restored) serves party 245 in Family 202 from `NAG`.

## Surfaces

- **Customer Families master:** shows assigned plants and edits them as one set for
  `manage_customer_master`.
- **Customer detail:** shows effective plants. It offers narrowing only when the Family has more than
  one plant.
- **Pickers:** Batch creation, Batch Customer/Location selection, SKU proposal and Freight lane
  destination apply the filter. An unavailable choice is omitted, never silently substituted.
- **Quick-create Prospect from a Batch** (`create_minimal_prospect`): the new Family is assigned to
  the Batch's plant in the same operation (see D-5).

## Decisions still yours

- **D-1 — Unassigned Customer in a multi-plant Family.** Recommended: the Customer inherits all the
  Family's plants, so Customer rows only narrow. Alternative: an explicit assignment is required
  before any plant-owned work.
- **D-2 — Removing a plant from a Family** that still has open Batches, active SKUs, Freight lanes or
  Customer rows at that plant. Recommended: refuse until those are closed or withdrawn. Alternative:
  allow it, and block only new work.
- **D-3 — Family merge and Customer reassignment** (`merge_customer_families`, the reassign route,
  `graduate_customer_party`). Recommended: refuse unless the target Family covers every plant at which
  the moving Customer has open work. The Admin adds the plant to the target first.
- **D-4 — Master visibility.** Recommended: unchanged, group-wide read. Alternative: plant-scoped
  users see only Families effective at their plants.
- **D-5 — Quick-created Prospects.** Recommended: auto-assign to the Batch's plant.

## Sequencing

This amendment does not block limited beta: beta is `NAG`-only and both kept Families are Nagpur
Customers. Recommended order after approval:

1. Schema, guards and backfill, applied only after the Wave C smoke.
2. Backend routes.
3. Master and picker surfaces.

The propose/approve conversion follows as its own amendment.

This amendment authorises no migration, deployment or live mutation.
