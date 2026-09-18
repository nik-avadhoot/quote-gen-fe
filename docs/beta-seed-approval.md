# Limited beta seed — single Product Owner approval

Prepared: 2026-09-17

Status: **Applied live as `20260918040738_seed_nagpur_limited_beta_masters`**

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
6. **Starter Constructions:** approve the four exact, most frequent non-job-work `Running` signatures below and
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
| 25 | 25 BF Kraft | 39.00 | 1.00 | 0 |
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

On 2026-09-18 the Product Owner ruled that workbook grade `25` remains its own governed exact grade;
it is not `25WTL` or `24GY`. For the first governed version its description is `25 BF Kraft`, with
the same commercial values as grade `24`: price ₹39.00/kg, discount ₹1.00/kg, incoming freight zero
and a `NULL` per-grade supplier-interest exception.

## Proposed Nagpur Freight Set version 1

Source: current application Nagpur freight mirror, **not the workbook**. The workbook's `Customer
Master!Y` values are customer/location-specific and cannot be safely reinterpreted as one governed
plant-to-destination matrix. Only existing governed, ship-to-eligible Customer Location identities
whose current address exactly evidences a destination below are inserted. An unmatched destination
does not block this amended seed: its Pricing Group must use `freight_mode = 'manual'` with an
explicit Maker-entered value, and the tracker must label that quote's freight as Maker-entered.

Live preflight on 2026-09-18 found **1 of 9 destination cities** matched: Nagpur. The live Freight
Set binds that lane only to the newly proposed, approved and coded Nagpur Ship-to
`G0080-001-03` for Nagpur Distillers Private Limited; locations 122 and 165 stayed untouched. The other eight cities
(Pune, Kolkata, Haldia, Howrah, Guwahati, Delhi, Ahmedabad and Hyderabad) have no exact governed
Customer Location match and therefore use manual Pricing Group freight during limited beta.

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
layers stay `NULL`. Each listed Construction receives version 1, is published, and that exact
version is directly adopted at Nagpur as authorised seed data. The former fifth candidate,
`Beta 3-ply E 18J/120`, is excluded: `J` denotes client-owned job-work paper and is not a paper grade.

| # | Frequency | Name | Ply | Flutes | TOP | F1 | L1 | F2 | L2 | Board GSM |
|---:|---:|---|---:|---|---|---|---|---|---|---:|
| 1 | 84 | Beta 3-ply B 16/100 | 3 | B / NULL | 16/100 | 16/100 | 16/100 | NULL | NULL | 337 |
| 2 | 57 | Beta 3-ply C 25/150-16/120-18/150 | 3 | C / NULL | 25/150 | 16/120 | 18/150 | NULL | NULL | 474 |
| 3 | 48 | Beta 3-ply C 16/170 | 3 | C / NULL | 16/170 | 16/170 | 16/170 | NULL | NULL | 586.5 |
| 4 | 38 | Beta 3-ply C 16/120 | 3 | C / NULL | 16/120 | 16/120 | 16/120 | NULL | NULL | 414 |

## Application invariants

- The migration resolves plant, user and component identities by stable codes/attributes; it never
  hard-codes generated IDs.
- It fails before writing if Nagpur, an approved named actor, a purported matched destination, or an
  expected empty seed target is missing/ambiguous. Unmatched freight cities are deliberately absent.
- Every version is attributed and approved; no secret appears in SQL or logs.
- Once referenced, corrections are new versions or withdrawals—never destructive deletes.

## Product Owner response

Approved on 2026-09-17 with `NAG` / Nagpur, INR and ₹/kg confirmed. The Product Owner explicitly
approved the application-current-default Rate and Freight values as non-workbook-derived sources,
the `FMCG-FOOD` Release, all 19 Sectors, the four non-job-work starter Constructions, and `NA` → `NULL` for the
second flute/layer pair. Named users are Maker `sales.01@avadhootpacks.in`, Checker
`marketing@avadhootpacks.in`, and Admin `nikunj@avadhootpacks.in`.

On 2026-09-18 the Product Owner amended freight handling: seed only exact existing matches, create no
generic destination master or pseudo Customer Locations, and require explicit manual Pricing Group
freight for every unmatched destination. The same amendment removed the `18J` Construction and
placed all job-work enquiries outside limited beta; no `18J` rate or `18J` → `18` mapping is allowed.

On 2026-09-18 the Product Owner resolved the identity contradiction: create `25` as its own governed
grade with the commercial values of grade `24`, and rename Construction 2 to carry `25` explicitly.
It is not equated with `25WTL` or `24GY`.

Wave B was applied atomically on 2026-09-18 as recorded migration
`20260918040738_seed_nagpur_limited_beta_masters`. Live verification found 19 approved Sector
versions, 17 Rate entries, one approved Nagpur Freight entry, one approved automatic Release and
four published/adopted starter Constructions.
