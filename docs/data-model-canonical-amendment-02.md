# Canonical Amendment 02 — SKU Master scope, SKU Sets, lifecycle and printing vocabulary

**Status:** canonical amendment. Product Owner rulings of 2026-09-15/16, given while designing the SKU
Master from the Nagpur SPEC sheet. This document records them in canonical form and states the exact
wording they put into [`data-model-decisions.md`](data-model-decisions.md), which remains the single
canonical record.

**Authority and evidence.** Rulings were given against the SPEC sheet of
`APSPL NAGPUR Master_20260720.xlsx`, the APSPL Specifications Master TechSpec v4, the costing engine
(`src/engine/costing.js`) and a published comparison against CDM-09 to CDM-13, CDM-20, Amendment 01
and the frontend design plan §U2.

**Implementation.** On 2026-09-16 the Product Owner asked for these decisions to be implemented in
the SKU Master page. Activating the supporting migration on the live Supabase project remains a
separate, explicit step.

**Excluded, unchanged:** the Commercial Intelligence workstream.

---

## Why this amendment exists

The SPEC sheet is the plant's working SKU master: 1,363 coded items across 260 columns. The approved
model had three unresolved questions about bringing it into the app: how much of the sheet a SKU
record should hold, how boxes, plates and partitions that are sold together relate outside a Batch,
and how the sheet's own status and printing columns map onto the canonical SKU. The frontend design
plan also warned against rebuilding the sheet as a 260-column screen. These rulings settle all three.

---

## B-01 — Master-level SKU Set

A box, its plates and its partitions are **independent SKUs** for production and costing. Each has its
own identity, Plant Item Code and specification. They are linked into a **SKU Set**: a plant-owned
master record that groups one box with its plate and partition SKUs.

The shared APSPL Item Code base (for example `N1330002` in `N1330002A1`, `N1330002P1`, `N1330002Q1`)
**proposes** a SKU Set. Membership is **confirmed** and stored by internal SKU identity. It is never
inferred from code text or row order (CDM-03, CDM-20). A code base may hold superseded components;
only confirmed members form the set.

A SKU Set has at most one active box member. Member roles are box, plate and partition. The role of
codes outside the A / P / Q convention (X, S, SL, SLP, SP, PL) is **not ruled**; such SKUs cannot take
a set role until it is.

A Batch SET (CDM-20) may be seeded from a master SKU Set. It keeps its own SET Code, lifecycle and
membership history inside the Batch.

## B-02 — Quantity per set

**Each SKU Set member carries its quantity per set**, a strictly positive number. It replaces the
SPEC sheet's retired partition and plate count columns and the sparse *Pc per set* column. It is
the master value that seeds a Batch row's quantity per SET.

## B-03 — SKU Master field scope and the production-data backlog

SKU Master stores **only quotation- and costing-relevant fields** to start. Every other SPEC column is
recorded in a **production-data backlog**: listed in sheet order and sheet group, not implemented, and
never required when a SKU is created or published.

The stored fields, by SPEC column, are:

| SPEC group | Stored fields |
|---|---|
| Identity & Linking | A Customer Alias (resolves Customer and Location applicability), B Item Name, C Item Short Name, D APSPL Item Code (Plant Item Code), E Primary Customer, F Customer Item Code, G Item Family, H Item Group |
| STD Carton Specification | I Ply, J Flute Type, K Flute 1, L Flute 2 (Construction authority), N Graphics / Print Quality, Print Technology (new), Number of Colours (new), O Printing Colour, AA Cobb Value |
| STD Internal Dimensions | AE Length, AF Width, AG Height |
| STD Board & Paper Composition | AI–AR layer BF and GSM (Construction authority), AS Item GSM, AT Item Weight, AU Item CS, AV Item BS, AW Item ECT |
| Conversion | BH B/L Ups |
| Status & Governance | Lifecycle (app), DX Customer Specification Number and Version, DZ SoftComp Code |

Ply, flutes and board layers remain governed by the SKU version's Construction version (CDM-13).
The SPEC values seed Construction candidates; they are not a second authority.

The selection follows what quotation and costing consume: the costing engine reads dimensions, ply,
box type, layers, flutes, ups, board GSM, required box weight and BS / BCT / ECT. Printing fields are
CDM-10 specification data. **Cobb value is directly linked to coating cost** (B-07).

The **Partition (CP–DF) and Plate (DG–DU) sub-specification columns are retired** as unused.
Partitions and plates are recorded as their own SKUs. Whether values still present on 201 and 181
cartons may be left behind at import is **not yet confirmed**.

This resolves the frontend design plan §U2 caution against a second 260-column spreadsheet.

## B-04 — SKU lifecycle

The app lifecycle is the only SKU lifecycle: **Proposed → Active → Discontinued**, with reactivation
preserving identity (CDM-11). *Active* is the published state. The SPEC sheet's five Item Status
values (Underdeveloped, Developed, Running, Slow Moving, Discontinued) and its Discontinued Date are
**not carried**. SKUs loaded from the spreadsheet arrive **Proposed** (CDM-38).

## B-05 — Version or new SKU

CDM-10 is retained. A printing, artwork or name-only change is a **new version of the same SKU** where
CDM-10 allows it. A dimension, Construction or strength change creates a new SKU. The SOP practice of
treating every specification change on a running item as a new item does not govern the app.

## B-06 — Printing Technology vocabulary and field shape

Printing Technology is a controlled value: **Flexo, CMYK, Offset or Unprinted**. On the immutable SKU
specification version it sits with **Number of Colours** (a whole number, zero or more), the
**descriptive colour detail** (SPEC *Printing Colour*) and the **print quality** statement
(SPEC *Graphics / Print Quality*). These fields do not create a pricing formula (Amendment 01, A-06).

## B-07 — Cobb value and coating cost

Cobb value is recorded on the SKU specification version because it is directly linked to coating
cost. Until an approved rate mechanism explicitly consumes it, the coating cost is still entered as a
Batch row add-on, and no coating formula may be inferred from the Cobb value.

---

## Exact canonical edits

| Canonical statement | Edit |
|---|---|
| **CDM-10** | Gains the B-05 confirmation and the B-06 vocabulary and field shape |
| **CDM-11** | Gains the B-04 lifecycle statement |
| **CDM-20** | Gains the statement that a Batch SET may be seeded from a master SKU Set (B-01) |
| **CDM-43** *(new)* | SKU Master field scope and the production-data backlog (B-03, B-07) |
| **CDM-44** *(new)* | SKU Sets and quantity per set (B-01, B-02) |

## Open, not ruled

- SET roles for codes outside A / P / Q: X, S, SL, SLP, SP and PL.
- Whether retired partition and plate values on 201 and 181 cartons may be left behind at import.
- Where the costing engine's glass SKU type should be recorded; it has no SPEC column.

## What this amendment deliberately does not do

- It does not load SPEC data, reset trial data or declare Formal Data Cutover (CDM-37, CDM-38).
- It does not implement the production-data backlog, production planning, paper planning, machine,
  station or process-route scope.
- It does not add a coating, printing or colour-count pricing rule.
- It does not change any existing Construction, Batch, Quote or calculation behaviour.
