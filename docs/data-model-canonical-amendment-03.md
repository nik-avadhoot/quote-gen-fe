# Canonical Amendment 03 — SKU pricing portfolio

**Status:** canonical amendment. Product Owner ruling of 2026-09-16, given while the SKU Master was
being brought onto the shared screen-space standard. This document records the ruling in canonical
form and states the exact wording it puts into [`data-model-decisions.md`](data-model-decisions.md),
which remains the single canonical record.

**Relationship to Amendment 02.** This extends the CDM-43 SKU Master field scope by one field. Every
other Amendment 02 ruling — the 39 quote and costing fields, SKU Sets (CDM-44), the lifecycle, the
printing vocabulary — is unchanged.

**Excluded, unchanged:** the Commercial Intelligence workstream.

---

## C-01 — Every SKU records its pricing portfolio

Every SKU carries a **pricing portfolio**. The values are exactly two:

| Value | |
|---|---|
| `Transactional` | |
| `Strategic` | |

There is no third value, no "unclassified" and no "to be decided". The vocabulary is closed in the
same way the printing technology vocabulary is closed (Amendment 02, B-06).

## C-02 — It is mandatory, and import must assign it

No SKU may exist without a portfolio, and **import must assign one** — no imported SKU is
unclassified. The database enforces this as `NOT NULL` with **no default**, so the value is always a
recorded decision and the database can never classify a SKU by itself.

See "Why NOT NULL rather than a publication gate" below for the reasoning, and the migration note
for what happens if SKU rows already exist when it is applied.

## C-03 — An administrator may change it later

A SKU's portfolio is a commercial classification, not a specification fact, so reclassifying a SKU
is **not** a new SKU and **not** a new SKU specification version (CDM-10 is untouched). An
administrator may change it through a governed operation.

At the time of this ruling no governed write path existed, so no non-functional affordance was
added. Amendment 04 subsequently supplied the governed, CAS-protected reclassification operation and
the `manage_sku_master` screen control; the field remains an in-place commercial classification.

## C-04 — It creates NO pricing rule

The portfolio is **recorded only**. Nothing may infer or apply pricing from it, and no rate,
discount, margin, floor or approval threshold may be derived from it, until an approved rate
mechanism explicitly consumes it. This is the same boundary Amendment 01 A-06 set for colour count:
the field is stored because the business tracks it, not because the engine reads it.

Concretely, until that approved mechanism exists:

- `src/engine/costing.js` does not read it;
- no Pricing Basis, Rate Master, Sector Default or Freight rule branches on it;
- no Batch, Quote or snapshot field is derived from it;
- the SKU Master shows it, and the catalogue can filter by it. That is all.

---

## Where the column lives, and why

`public.skus.pricing_portfolio` — on the **SKU**, not on the SKU specification version.

CDM-43 places the quotation- and costing-relevant **SPEC sheet** fields on the immutable
specification version, because those are specification facts and a specification change is a new
version. The portfolio is neither: it is not a SPEC column at all, it classifies the SKU as a
commercial object, and C-03 says an administrator changes it in place.

Putting it on `sku_versions` would allow one SKU's v1 to read `Transactional` while its v2 reads
`Strategic`, which makes "this SKU's portfolio" an ambiguous question. One value per SKU removes
that ambiguity by construction.

**This placement is the one modelling choice this amendment makes that the ruling did not state.**
It is flagged here rather than buried: if the Product Owner wants portfolio history to live on the
version chain instead, the column moves and this section is rewritten.

## Why NOT NULL rather than a publication gate

The alternative considered was a nullable column plus a constraint that a SKU cannot reach `active`
without one — import lands `proposed` rows unclassified, and NPD classifies before activation.

**Recommendation: `NOT NULL`, with no database default.** Three reasons.

1. **It is what the ruling says.** "Import must assign one — no imported SKU is unclassified" is a
   statement about the moment of import, not about the moment of publication. A publication gate
   permits exactly the state the ruling forbids, for as long as a SKU stays proposed.
2. **It removes a third state from every reader.** A nullable column makes "no portfolio yet" a
   value that the route, the screen, the filter, every export and every future rate mechanism must
   each decide how to present. This codebase has repeatedly paid for blank-versus-zero confusion;
   `NOT NULL` pays the cost once, at the writer, instead of forever, at every reader.
3. **No default means no silent classification.** `NOT NULL` with a `DEFAULT` would be worse than
   nullable — the database would quietly classify every SKU that omitted the value. With neither, a
   writer that does not state a portfolio fails loudly, which is the A-06 boundary applied to
   storage.

The cost is one mandatory field in the SPEC import mapping. The SPEC sheet has no portfolio column,
so the importer must obtain it — from a per-import default the operator chooses explicitly, or per
row. That is a real cost and it is the right one: it is a decision being made once rather than a
null being propagated.

**If existing SKU rows are found when the migration runs**, the migration refuses rather than
inventing a classification (see the migration note). Backfilling a value would be exactly the silent
classification this section exists to prevent.

---

## Wording added to `data-model-decisions.md`

**CDM-45 — SKU pricing portfolio.** Every SKU records a pricing portfolio, exactly `Transactional`
or `Strategic`. It is mandatory and has no default: import must assign one, so no imported SKU is
unclassified. It is a commercial classification of the SKU, held on the SKU itself rather than on a
specification version, and an administrator may change it through a governed operation — no such
operation exists yet, so no edit control is offered. It creates **no pricing rule**: nothing may
infer or apply pricing from it until an approved rate mechanism consumes it (Amendment 01, A-06).

---

## Implementation, 2026-09-16

| | |
|---|---|
| Migration | `quote-gen-be/supabase/migrations/20260917024903_u2_sku_pricing_portfolio.sql` — **applied live 2026-09-17** (authored as `20260916170000`) |
| Static contract | `quote-gen-be/tests/test_sku_pricing_portfolio_schema_contract.py` |
| Route | `GET /masters/skus` returns `pricing_portfolio` and accepts a `portfolio` filter; both degrade to `schema_pending` until the migration is applied |
| Registry | `quote-gen-fe/src/lib/skuSpecRegistry.js` field `PF`, app origin, Status & Governance group |
| Screen | shown as a field and catalogue filter; Amendment 04 adds the governed `manage_sku_master` edit control |
| Tests | `test:sku-master`, `tests/test_sku_master_route.py` |

The migration was applied live on 2026-09-17 in the ordered five-migration SKU activation recorded
by Canonical Amendment 04. Authenticated-live mutation verification remains separate and outstanding.
