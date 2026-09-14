# Batch commercials seeding regression

Date: 2026-09-15
Status: landed and locally verified
Implementation: `831e182 fix(batch): preserve sector commercial authority`

## Intended behaviour

A fresh local Batch or new-client Costing draft begins without Batch-level commercial overrides.
Margin, waste and conversion therefore remain blank at the stored Batch/SKU tiers and resolve through
the selected Sector before reaching the approved system fallback. A governed Batch is different: its
current profile is an intentional source, so present profile values—including zero—must seed exactly,
while null continues to mean inherit.

The authority order remains Row → Batch → Sector → system. Blank, zero and a typed value equal to the
current Sector value are distinct states.

## Regression

Commit `7e9bade` (`C5: profileDraft owns new-batch context, and one Batch Context bar owns it`,
2026-09-01) introduced concrete `8 / 5 / 7 / 5 / 12.5` seeds for new-client drafts and SKU defaults.
Those numbers occupied override slots before a Maker selected a Sector, so later Sector selection
could not remain authoritative. Commit `59b9989` (`feat: publish governed quotation workspace and
project records`, 2026-09-14) repeated the local fallback seeding in the new governed/local Batch
entry path. Existing Batch-grid and Send call sites also used literal `??` fallbacks, and clearing a
Costing Batch Context field wrote the displayed default back instead of restoring null inheritance.

## Fix

- `resolveBatchCommercialDefaults` centralises Box and PP commercial resolution through the existing
  resolver, preserving Sector values and explicit zero.
- `freshNewClientProfileValues` and local `freshBatchProfileValues` keep fresh override slots null.
  Governed `freshBatchProfileValues` carries current-profile values exactly.
- `seedSkuDefaults` keeps present nulls blank so SKU exceptions inherit, preserves explicit values
  and zero, and retains bounded legacy seeds only when an old profile lacks the fields entirely.
- Batch Builder, Costing review/push/send, and Quote Send now consume the same resolved Batch/Sector
  values. Clearing a Costing context input stores null; typing any number stores an explicit override.

No costing formula, SET identity rule, CalcGate authority, capability gate, confirmation guard, or
construction-selection behaviour changed in this commit.

## Verification

### Named fixtures

- `npm run test:resolver`: passed with `all checks pass`. Its new “Batch Builder presents and sends
  the same inherited defaults” section proves blank Box waste/conversion resolve from Sector,
  Sector PP zero survives, and Margin reaches Sector/system correctly.
- `npm run test:draft`: passed with `all checks pass`. Its new “New Draft / new client” section proves
  fresh null overrides, blank SKU inheritance, explicit-zero preservation, legacy fallback handling,
  local new-Batch reset, and governed-profile seeding.

### Browser journeys

1. Local `+ New Batch` stored all six commercial fields as null. Selecting `TEXTILE` displayed Box
   `5.75 / 5 / 8` and PP `0 / 0 / 8`, labelled `Inherited`. Typing Box conversion `6.5` stored only
   that override and exposed the instruction to clear it to inherit `5.75`.
2. Governed Batch fixture `VERIFY-GOV-001` seeded Box/PP values as
   `null / 6.25 / 11 / 0 / 0 / 9`; null Box waste resolved to the Sector value `5`, while every
   present profile value and zero survived.
3. Costing “New Draft — New client” stored null commercial fields. Selecting `TEXTILE` displayed the
   same inherited Box `5.75 / 5 / 8` and PP `0 / 0 / 8` values.

These are local implementation checks, not production deployment or Product Owner closure.
