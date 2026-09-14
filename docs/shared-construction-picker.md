# Shared construction picker and exact-selection reuse

Date: 2026-09-15
Status: landed and locally verified
Implementation: `ec13a42 feat(construction): share picker across costing and batch`

## What changed

Batch Builder and Costing START now open the same selection-only Construction Library picker. The
shared component owns search, Sector/client and STD filters, preview, active-status filtering, and
the boundary that hides incomplete constructions. Each call site keeps its existing write meaning:
Batch Builder links the selected construction and copies its displayed board specifications onto the
row, while Costing deep-copies construction fields and layers into the surviving draft without
copying customer, Sector, SKU identity, dimensions, or commercial values.

Construction matching and duplicate detection now use the shared identity helpers. When Costing is
sent with multiple exact library duplicates, an exact construction explicitly selected by the Maker
wins over the library's first otherwise-equivalent match. The Batch row and surviving Costing draft
both retain the code Send actually reused. Only active, structurally usable constructions can be
selected or silently reused.

## Why

The two previous pickers had duplicated presentation and filtering behaviour, so their usable-entry
boundaries could drift. Separately, first-match reuse discarded the Maker's explicit choice whenever
an earlier exact duplicate existed. Sharing the picker removes the UI duplication while retaining
the distinct Batch-link and Costing-copy semantics; selected-exact preference makes the resulting
construction reference deterministic from the Maker's action.

No construction pricing formula, paper-layer costing rule, Batch commercial authority, SKU identity,
or Construction Library edit/create workflow changed in this increment.

## Verification

### Named fixtures

- `npm run test:construction-safety`: `15 passed, 0 failed` and
  `Construction safety fixture gate PASS`. The gate proves selected-reference carry-through,
  construction-only/deep-copy behaviour, active-and-usable matching, both shared-picker call sites,
  and the unchanged calculation/Send guards.
- `npm run test:costing`: completed with `all fixtures pass`, including numerical parity and the
  blank-versus-zero costing cases.
- `npm run test:module-contract`: completed successfully, confirming the changed module graph builds.

### Browser journeys

1. Batch Builder's `+ Box` row opened the shared picker with `DUP-A` and `DUP-B` shown as two usable
   entries. Selecting `DUP-A` closed the picker, linked the row to `DUP-A`, and populated Board GSM
   `500` and BS `7`, preserving the prior Batch-link behaviour.
2. Costing's `Choose existing` opened the same picker. Selecting `DUP-B` showed `[DUP-B] Linked` and
   copied the three-ply `24/18/24` layers with GSM `180/120/180`, Board GSM `500`, and BS `7` into
   the Costing draft.
3. The library was deliberately ordered `DUP-A`, then `DUP-B`, with exact construction identity.
   After the Maker selected `DUP-B`, `sendCostingToBatch` created
   `VERIFY-CONSTRUCTION-001` with `constructionCode: "DUP-B"`; the surviving draft also remained
   `constructionCode: "DUP-B"`. This proves explicit selection wins over the first exact match.

These are local implementation checks, not production deployment or Product Owner closure.
