# Limited beta seed — single Product Owner approval

Prepared: 2026-09-17

Status: **Approved by Product Owner on 2026-09-17; live application blocked by destination and grade identities**

Source workbook: `APSPL NAGPUR Master_20260720.xlsx`

This is the one Wave B approval batch required by `beta-readiness-plan.md`. Nothing in this record
has been written to the live database. Approval authorises one forward, idempotent seed migration;
rejection or amendment changes the draft before any live write.

## Decision requested

Approve all of the following together, or reply with amendments in one message:

1. **Workbook currentness:** confirm `APSPL NAGPUR Master_20260720.xlsx` is current enough for the
   limited beta.
2. **Fence:** use Producing Plant `NAG` / Nagpur only, and provide the named Maker, Checker and Admin
   email addresses. Grants will be limited to that plant.
3. **Currency and units:** confirm INR, with material and freight rates expressed as ₹/kg.
4. **Commercial source exception:** the workbook does not contain a usable Rate Master or a
   plant-to-destination Freight Master. Approve the current application mirrors below as the first
   governed Nagpur versions, or provide the replacement values. They are deliberately not described
   as workbook-derived.
5. **Pricing Basis:** approve `FMCG-FOOD` as the sector version pinned by the first automatic Nagpur
   Pricing Basis Release, effective 2026-09-17. All 19 Sectors are still seeded and available;
   alternative sector releases can follow without changing this seed.
6. **Starter Constructions:** approve the five exact, most frequent `Running` signatures below and
   the explicit mapping `INT Flute 2 = NA` to database `NULL` for 3-ply boards.

## Governed Sectors — approved BR-2 values

Each row becomes Sector version 1 with status `approved`. Margin is 8% for every row, matching the
current system fallback; the other values are the current Sector Defaults without reinterpretation.

| Code | Name | Waste CBB % | Waste PP % | Conv Box ₹/kg | Conv PP ₹/kg | Margin % | Spec language |
|---|---|---:|---:|---:|---:|---:|---|
| PAINTS | Paints / Decorative | 5 | 5 | 7 | 10 | 8 | ECT+BS |
| ALCOBEV | Alcobev (Glass & PET) | 5 | 5 | 7 | 12.5 | 8 | BS |
| ICE-CREAM | Ice Cream / Dairy | 5 | 5 | 12 | 0 | 8 | BS |
| SOLAR-PANEL | Solar — Panel Box | 5 | 3 | 15 | 0 | 8 | BS+BCT |
| SOLAR-CELL | Solar — Cell/Ingot | 5 | 3 | 6.5 | 0 | 8 | CS+BS |
| COOLER | Coolers / White Goods | 5 | 0 | 11 | 0 | 8 | BS |
| TEXTILE | Textiles / Warehousing | 5 | 0 | 5.75 | 0 | 8 | BS |
| FOOD-SVC | Food Service / QSR | 5 | 0 | 12 | 0 | 8 | BCT |
| BISCUIT | Biscuits & Confectionery | 4 | 5 | 7 | 10 | 8 | BCT+BS |
| CHIPS | Snacks / Chips | 4 | 5 | 6.5 | 10 | 8 | BCT+BS |
| PETROL | Petroleum / Lubricants | 5 | 0 | 7 | 0 | 8 | BCT+BS |
| EDIBLE-OIL | FMCG / Edible Oils | 5 | 0 | 7 | 0 | 8 | CS+BS |
| FOOTWEAR | Footwear | 5 | 0 | 8 | 0 | 8 | BS |
| ELEC-LED | Electronics / LED | 6 | 0 | 7 | 0 | 8 | BS |
| BEAUTY | Beauty / D2C | 7 | 0 | 6 | 0 | 8 | BCT |
| CHEMICAL | Chemicals / Adhesives | 5 | 5 | 7 | 0 | 8 | BS |
| FANS | Consumer Durables/Fans | 5 | 5 | 8 | 10 | 8 | BS |
| PHARMA | Pharmaceuticals | 5 | 5 | 7 | 10 | 8 | BCT+BS |
| FMCG-FOOD | FMCG Food / Staples | 5 | 5 | 7 | 10 | 8 | BCT+BS |

## Proposed Nagpur Rate Set version 1

Source: current application `DEFAULT_RATES`, **not the workbook**. Supplier interest override remains
`NULL`; incoming freight is explicit zero in each entry. Prices and discounts are ₹/kg.

| Grade | Description | Price | Discount | Incoming freight |
|---|---|---:|---:|---:|
| 16 | 16 BF Kraft | 31.50 | 1.00 | 0 |
| 18 | 18 BF Kraft | 32.00 | 1.00 | 0 |
| 20 | 20 BF Kraft | 33.50 | 1.00 | 0 |
| 22 | 22 BF Kraft | 35.00 | 1.00 | 0 |
| 24 | 24 BF Kraft | 39.00 | 1.00 | 0 |
| 28 | 28 BF Kraft | 44.50 | 1.50 | 0 |
| 35 | 35 BF Kraft (calc as 33) | 51.50 | 1.50 | 0 |
| 20GY | 20 BF Golden Yellow | 35.00 | 1.00 | 0 |
| 22GY | 22 BF Golden Yellow | 36.50 | 1.00 | 0 |
| 24GY | 24 BF Golden Yellow (=25VK) | 40.50 | 1.00 | 0 |
| 28GY | 28 BF Golden Yellow | 45.50 | 1.50 | 0 |
| 35GY | 35 BF Golden Yellow (calc 33) | 52.00 | 1.50 | 0 |
| 25WTL | 25 BF White Top Liner | 76.00 | 1.50 | 0 |
| 14DUP | 14 BF Duplex Board | 45.00 | 1.50 | 0 |
| 26HRCT | 26 BF High Recycle Content | 44.50 | 1.50 | 0 |
| 40VKL | 40 BF Imported Virgin Kraft | 68.00 | 1.50 | 0 |

## Proposed Nagpur Freight Set version 1

Source: current application Nagpur freight mirror, **not the workbook**. The workbook's `Customer
Master!Y` values are customer/location-specific and cannot be safely reinterpreted as one governed
plant-to-destination matrix. Only live governed Customer Location identities that exactly match a
destination below will be inserted; any unmatched destination is reported and blocks application.

| Origin | Destination | ₹/kg |
|---|---|---:|
| Nagpur | Nagpur | 2.0 |
| Nagpur | Pune | 2.5 |
| Nagpur | Kolkata | 4.0 |
| Nagpur | Haldia | 4.5 |
| Nagpur | Howrah | 4.0 |
| Nagpur | Guwahati | 5.5 |
| Nagpur | Delhi | 3.5 |
| Nagpur | Ahmedabad | 3.0 |
| Nagpur | Hyderabad | 3.5 |

## Calculation Defaults and Pricing Basis Release

- Calculation Defaults version 1: interest 0.5%, CBB waste 5%, PP waste 5%, Box conversion 7 ₹/kg,
  PP conversion 12.5 ₹/kg, margin 8%, rounding step 0.05, fluting BCF 0.10.
- Engine: `engine/qe1-600adcbe1a85be59`; rounding rule: `qe1-rounding-v1`.
- Payment-day map: existing closed list and canonical values from the schema migration.
- Release name: `Nagpur Limited Beta 2026-09-17`; effective from 2026-09-17; no end date;
  automatic default; pins the approved Rate, Freight, `FMCG-FOOD` Sector and Calculation Defaults
  versions.

## Starter Constructions

Source population: 826 workbook `SPEC` rows whose Item Status is exactly `Running`. Frequency is the
count of the complete internal signature. BF values become layer grade codes as text; blank F2/L2
layers stay `NULL`. Each Construction receives version 1, is published, and that exact version is
directly adopted at Nagpur as authorised seed data.

| # | Frequency | Name | Ply | Flutes | TOP | F1 | L1 | F2 | L2 | Board GSM |
|---:|---:|---|---:|---|---|---|---|---|---|---:|
| 1 | 84 | Beta 3-ply B 16/100 | 3 | B / NULL | 16/100 | 16/100 | 16/100 | NULL | NULL | 337 |
| 2 | 57 | Beta 3-ply C 25-16-18 | 3 | C / NULL | 25/150 | 16/120 | 18/150 | NULL | NULL | 474 |
| 3 | 48 | Beta 3-ply C 16/170 | 3 | C / NULL | 16/170 | 16/170 | 16/170 | NULL | NULL | 586.5 |
| 4 | 38 | Beta 3-ply C 16/120 | 3 | C / NULL | 16/120 | 16/120 | 16/120 | NULL | NULL | 414 |
| 5 | 23 | Beta 3-ply E 18J/120 | 3 | E / NULL | 18J/120 | 18J/120 | 18J/120 | NULL | NULL | 397.2 |

## Application invariants

- The migration resolves plant, user and component identities by stable codes/attributes; it never
  hard-codes generated IDs.
- It fails before writing if Nagpur, an approved named actor, a destination, or an expected empty
  seed target is missing/ambiguous.
- Every version is attributed and approved; no secret appears in SQL or logs.
- Once referenced, corrections are new versions or withdrawals—never destructive deletes.

## Product Owner response

Approved on 2026-09-17 with `NAG` / Nagpur, INR and ₹/kg confirmed. The Product Owner explicitly
approved the application-current-default Rate and Freight values as non-workbook-derived sources,
the `FMCG-FOOD` Release, all 19 Sectors, the five starter Constructions, and `NA` → `NULL` for the
second flute/layer pair. Named users are Maker `sales.01@avadhootpacks.in`, Checker
`marketing@avadhootpacks.in`, and Admin `nikunj@avadhootpacks.in`.

Live preflight found that only Nagpur appears in current Customer Location address evidence; eight
approved Freight destinations have no exact governed Customer Location identity. The seed must not
guess, create pseudo-customer locations, or publish a partial approved Freight Set, so application
is blocked pending a canonical destination-identity resolution.

Preflight also found that starter Construction 5 uses grade code `18J`, while the approved Rate Set
contains `18` but no `18J`. The seed must not silently reinterpret `18J` as `18`; application is
blocked pending an explicit governed `18J` rate or a Product Owner-approved construction change.
