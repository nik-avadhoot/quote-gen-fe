# Canonical Amendment 01 — customer interest, supplier credit cost, and specification capture

**Status:** canonical amendment, submitted for Product Owner review before any schema change.

**Authority:** Product Owner ruling of 2026-09-06, taken on the evidence in the SR DEV pre-S7
reconciliation report of the same date. This amendment records that ruling in canonical form and
states the exact wording it puts into [`data-model-decisions.md`](data-model-decisions.md), which
remains the single canonical record.

**Scope of this document.** It amends canonical decisions only. It authorises no code, no migration,
no deployment and no commit by itself; the implementation sequence it enables is the revised S7
packet. `data-model-frontend-design-plan.md` remains a planning reference and does not become
canonical authority by being referenced here.

**Excluded, unchanged:** the Commercial Intelligence workstream.

---

## Why this amendment exists

Two calculation authorities for one number cannot coexist. The approved model held four fixed
effective-interest percentages, one per structured Payment Term. The Product Owner has ruled that
one approved annual interest percentage is the authority and that the effective percentage is
derived from it. Leaving both in place — in the canonical record, in the database, or in the running
application — is the precise defect this amendment removes.

A second confusion is retired at the same time. The word *interest* was doing two jobs: what
Avadhoot charges a customer for a credit period, and what Avadhoot pays a paper supplier for taking
credit. They sit on opposite sides of the transaction and are now named apart.

---

## A-01 — Annual customer-interest authority

One approved **annual interest percentage** is the single calculating authority for customer
Payment-Terms Interest. The **initial approved rate is 6.000 % per annum.**

The effective percentage for a Pricing Group is derived:

    effective_interest_pct = annual_interest_pct × payment_terms_days ÷ day_count_basis

The annual rate is calculation-driving. It is versioned, approved by a second person, attributable,
and immutable once approved; a change is a new approved version, never an edit.

**The initial rate preserves every currently accepted result.** This is arithmetic, not coincidence
— the four approved values were already an exact straight-line derivation at 6 % per annum on a
360-day year:

| Payment Terms | Derived at 6.000 % p.a. | Previously approved | Change |
|---:|---:|---:|:-:|
| 30 days | 0.500 % | 0.500 % | none |
| 45 days | 0.750 % | 0.750 % | none |
| 60 days | 1.000 % | 1.000 % | none |
| 90 days | 1.500 % | 1.500 % | none |

The earlier 12 % figure was an explanatory example and is not the initial rate.

## A-02 — Day-count convention

The approved day-count basis is **360, and 360 only.** No alternative basis may be stored,
configured or selected. A change of convention requires an explicit canonical amendment and its own
migration; it is not a configuration change.

## A-03 — Retirement of the fixed Payment Terms map

The separately maintained mapping of Payment Terms to fixed effective-interest percentages is
**withdrawn as a calculation authority.** It has no surviving non-competing purpose: its entire
content is reproduced exactly by A-01.

Two rules survive it, and are relocated rather than lost:

1. **The closed structured Payment Terms list remains 30, 45, 60 and 90 days.** It is now a closed
   *input domain* carried on the Pricing Group, not a property of a mapping table. Other wording may
   be retained as descriptive free text and does not calculate.
2. **The independent system fallback remains 0.500 %.** A missing or unresolved structured Payment
   Term resolves to it, and never to 1.500 %.

The customer-behaviour reading of the four withdrawn values — Prompt, Moderate, Delayed, Chronic —
is retired with them. The percentage is the cost of a customer credit period, derived from the
approved annual rate.

**Removal ordering is part of the amendment, not an implementation detail.** The obsolete structure
must not be removed while any deployable application build still reads it or silently substitutes a
hard-coded percentage. The approved order is: add the annual-rate fields; state the database
assertions; complete the resolver and application transition; prove agreement and the golden
results; only then remove the obsolete structure; then re-run the migration-alignment and
fresh-replay gates.

## A-04 — Retained explicit Pricing Group interest override

The explicit Pricing Group interest override is **retained.** It is the commercial escape hatch and
is not removed.

- **Blank means inherit** — the derived percentage applies.
- **Zero is an explicit zero** — a deliberate decision that no interest is charged.
- A **non-null override takes precedence** over the derivation.
- Where the override **differs from the derived percentage, a reason is mandatory**, and the actor,
  the time, the derived percentage and the overridden percentage are all preserved for the Send
  snapshot and the audit trail.

## A-05 — Supplier paper-credit cost is a separate authority

**Rate Master Credit Cost is not customer Payment-Terms Interest.** It is the cost of credit taken
from the paper supplier and enters the Effective Paper Rate as an input cost. It is never derived
from customer Payment Terms and never from the annual customer-interest basis.

- The **initial blanket supplier Credit Cost is 1.500 %.**
- It is stored as a **versioned, approved, plant-owned value on the Rate Set version.**
- A **per-grade value is retained only as an explicit exception.** Blank inherits the Rate Set
  version value; explicit zero remains zero.
- The effective supplier Credit Cost, its source and the Rate Set version are frozen at Send.

Labels in the application and in calculation results must distinguish **customer credit-period
interest** from **supplier paper-credit cost** so that the two cannot be read as one.

## A-06 — Printing Technology and number of colours

Printing Technology, number of colours and descriptive colour detail are captured as **specification
data on the immutable SKU specification version**, not on the global Construction.

Number of colours does not by itself create a mechanical pricing rule and does not mechanically
determine whether a new SKU identity is required. These fields become calculation-driving only when
an approved rate mechanism explicitly consumes them. **No pricing formula may be inferred from
them.**

Descriptive colour detail is captured in principle, because a count does not preserve Pantone, DLX
or other customer-facing shade identity. The controlled Printing Technology vocabulary and the final
field shape are deferred to the U2 Product and Specification design packet, prepared from the source
material and current conversion practice for Product Owner approval.

## A-07 — Future plant-scoped flute governance

A **plant-scoped, governed model for flute profiles and take-up factors is approved in principle**
and is **not implemented or seeded by this amendment.** The take-up factor is a governed plant-owned
value, not a code constant.

No flat flute-factor list is approved for migration. The source conflict is genuine and unresolved:
Nagpur C is 1.45 in the Operations Master and 1.47 in the quotation template and the current
application, and other plant-specific values also differ.

When the package is prepared — **after S8** — it must carry plant-specific profile identity,
approved immutable versions, strictly positive take-up factors, an **absent reference for "no flute"
rather than a zero multiplier**, no silent fallback of an unknown or malformed flute code to 1.0,
controlled normalisation of case and whitespace, and calculation and snapshot provenance. A
plant-by-plant reconciliation table and a named operational owner for each value are required before
that package is authorised.

---

## Exact canonical edits

| Canonical statement | Edit |
|---|---|
| **CDM-10** | The sentence deferring colour count is replaced by the A-06 rule |
| **CDM-18** | Replaced in full by the A-01 to A-04 rules |
| **CDM-22** | Gains the annual-rate, convention, selected-days, derived-value and supplier-credit-cost snapshot obligations |
| **CDM-26** | Gains the statement that the approved annual interest basis travels in the Release through its Calculation Defaults component |
| **CDM-40** | `colour-count rules` becomes `colour-count *pricing* rules` |
| **CDM-41** *(new)* | Supplier paper-credit cost (A-05) |
| **CDM-42** *(new)* | Plant flute profiles and take-up factors, approved in principle, not implemented (A-07) |

## What this amendment deliberately does not do

- It does not change any currently accepted calculated result. At 6.000 % per annum the derived
  percentages equal the withdrawn fixed values exactly.
- It does not reinterpret, migrate or backfill existing Batch or Batch Profile values. Pre-existing
  stored literals stay as they are; they may represent deliberate user choices. The new authority
  chain applies to subsequent calculation activity only.
- It does not implement flute governance, Product Master frontend screens, machine, station or
  process-route work, or any slice from S8 onward.
- It does not alter the requirement that every Customer Location declare a commercial purpose. A
  Location may have incomplete address or site details; it may not exist without being Bill-to,
  Ship-to or both. No amendment was required and none is made.
- It does not expand the SKU lifecycle. Mapping the legacy five-state Item Status is prepared in the
  U2 and S11 cutover design, where source-data migration is distinguished from the canonical
  Proposed / Published / Discontinued workflow before any lifecycle amendment is requested.
