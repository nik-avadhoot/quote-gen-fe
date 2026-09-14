# S8 — Freight authority: closure evidence

**Date:** 2026-09-09. **Performed by:** SR DEV under Product Owner authorisation of the same date.
**Status: CLOSED for its authorised scope.** Product Owner validated.

**Nothing is pushed.** Both repositories remain on the local-only branch `data-model/s0-provenance`
with no upstream. `docs/commercial-intelligence-decisions.md` was never read, staged or committed.
The user-owned hunk in `src/tabs/batch/BatchProfileBar.jsx` was preserved byte-identical and
unstaged throughout — see §6.

---

## 1. Scope, and what was NOT done

S8 was authorised and delivered as two tranches:

| Tranche | Content | Status |
|---|---|---|
| **S8(a)** | `resolveFreight`, `calcCostingOutcome`, both live call sites, paired result/resolution state, reason-specific missing-information, Output Panel presentation, Calculate All and Send protection, `freight_authority_v2` | Closed, PO validated |
| **S8-producer** | The Batch Profile writer: `normalizeFreightOverrideInput`, the two Plant/Delivery materialisation sites, the missing-pair display and its help text, the freight input handler | Closed, PO validated |

**Explicitly deferred to U4 — not implemented by S8:**

- **fingerprint construction** (calculation and presentation), and
- **the three fingerprint-based divergence states** (`fresh`, `needs_send_only`, `calculation_stale`).

S8 delivered no fingerprint builder, no comparison, no classifier and no live divergence
presentation. The existing pre-S8 staleness heuristic (`getBatchRowStatus`) remains the live signal
and was left untouched. `batch_calculations` already carries `calculation_fingerprint` and
`presentation_fingerprint` (S6-3, `not null`, `ck_bc_fingerprints`); **no migration was required and
none was made.**

**No database migration was authorised or applied in S8.**

---

## 2. The authority chain as built (CDM-17)

```
canonical row override            'row'            governed
  legacy Batch Profile override   'legacy_batch'   TEMPORARY   → removed at U4
    Pricing Group  manual         'pricing_group'  governed    (terminates)
                   ex_factory     'pricing_group'  governed    (terminates, value 0)
                   master         delegates downward via its governed BASIS
      approved Freight Master     'master'         governed
        legacy plant×dest matrix  'legacy_matrix'  TEMPORARY   → removed at U3
          unresolved              'unresolved'     → BLOCKS
```

Row precedence over `legacy_batch` was the ratified Product Owner decision: neither tier has a live
writer today, so the order moves no number now; it decides what happens at U4, when the row override
gains a producer and the tier the Maker can see and edit must beat the batch-level value they did
not touch.

In `master` mode the destination is the basis Delivery Group's Ship-to Location, resolved **upstream**
of the engine. The Batch Profile's legacy destination is read by the `legacy_matrix` tier and by
nothing else; there is no code path in which it substitutes for a governed basis.

Governed master is returned only when **both** `freightSetVersionId` and `freightEntryId` are
present. Incomplete governed provenance is treated as unavailable and takes the authorised
compatibility path — half a reference is not a reference.

### 2.1 The `authority` field — what it does and does not guarantee

`authority` makes governed and temporary provenance explicitly distinguishable. It is `'governed'`
for `row`, `pricing_group` and `master`, and `'temporary'` for `legacy_batch` and `legacy_matrix`.

**Any future U4/S9 snapshot writer must enforce that temporary sources cannot be recorded as
approved Freight Master references.** The field enables that enforcement; it does not guarantee
correct future writer behaviour by itself. No writer exists yet, and none was built in S8.

---

## 3. Defects closed — five instances of one conflation

Explicit zero, blank and "no rate on file" were a single value at five sites. All five are closed.

| # | Site | Defect |
|---|---|---|
| 1 | `engine/costing.js:31` | `if(override&&+override>0)` — an explicit zero override was discarded |
| 2 | `engine/costing.js:32` | `matrix?.[p]?.[d]\|\|0` — a missing pair priced as a real zero |
| 3 | `state/useCostingDraft.js:131` | `cv.freightOverride\|\|""` — a stored zero was blanked one layer above the engine |
| 4 | `tabs/costing/SpecForm.jsx:56` | `_frEff = v => (…&&+v>0)` — the read-only card contradicted the charged rate |
| 5 | `tabs/batch/BatchProfileBar.jsx` | equal-value demotion; Plant/Delivery materialisation; `??0` missing-pair display |

Sites 3 and 4 were found during browser verification of S8(a) and ratified as scope additions:
without them the authorised `legacy_batch` tier could not express a zero from the UI at all.

Site 5 was dispositioned as a separate producer-side authority defect. Its two behaviours were
distinct: the equal-value demotion **discarded** an authority the user chose, while the
Plant/Delivery materialisation **invented** one nobody chose. The latter is the materialisation
pattern S7 removed at five sites (proposal §10.3); freight was not among the five and survived.

---

## 4. Feature flag and compatibility

`freight_authority_v2`, default **off**, read only at the two application boundaries
(`useCostingResult`, `useQuoteActions`) and injected as a plain boolean. The engine never imports
Vite environment state and remains importable into plain Node, which is what keeps the goldens
runnable.

Not a development-floor default: the floor carries destinations that can vanish and leave a
capability unreachable (`featureFlags.js` note 3), and this is an engine flag. It is opt-in through
`VITE_FEATURE_FLAGS` only.

With the flag **off**, `calcCostingOutcome` calls the unchanged `calcCosting` path and returns
`freightResolution: null`. Parity is structural rather than emulated, and the fixtures assert it in
both directions — including that the pre-S8 defects are **still present** when the flag is off.

**Rollback:** forward-fix, flag off. A Pricing Group using `ex_factory` must be restated as
`manual 0` if an S8 build is reverted. Accepted as acceptable in the present pre-cutover environment.

---

## 5. Evidence

### 5.1 Automated

| Gate | Result |
|---|---|
| `test:costing` | all fixtures pass — 7 golden + 2 contrasts + 26 S8(a) arms |
| **Seven existing goldens** | **byte-identical**; `costing-golden.json` unchanged in `git diff` |
| `test:resolver` | all checks pass — 44 S8(a) freight arms + 32 producer arms |
| `test:module-contract` | green |
| ESLint | **66 errors — pre-existing ceiling unchanged, zero new** |

Covered: explicit zero at every tier; row-over-legacy precedence including zero-over-value;
manual / master / ex-factory; manual-with-no-value → unresolved; missing basis; missing Ship-to;
missing approved pair; missing legacy pair; incomplete master reference → compatibility path;
no Batch-destination substitution in master mode; unresolved returns `null`, never `0` or `NaN`;
flag-off parity across blank / zero / positive / missing-pair; wrapper frozen, two keys, no costing
fields; blank → inheritance; value equal to matrix retained as an override; Plant change and
Delivery change leave a stored override untouched; clearing restores inheritance; an absent matrix
pair is neither displayed nor stored as zero.

### 5.2 Browser

Real Chrome, Product Owner session, flag on, live batch (Nagpur Distillers).

| State | Rendered | Landed |
|---|---|---|
| `legacy_batch` = 2 | `Freight (2 Rs/kg · Batch override (temporary))` ₹0.92 | ₹23.35 |
| `legacy_batch` = 0 | `Freight (0 Rs/kg · Batch override (temporary))` ₹0.00 | ₹22.35 |
| blank → mirror | `Freight (2 Rs/kg · temporary legacy matrix)` ₹0.92 | ₹23.35 |
| typed value **equal to matrix** (2 vs 2) | stored as number `2`, `\| OVERRIDDEN`, amber `#FFF8ED` | — |
| Delivery Nagpur→Pune with override 2 | override held at **2**; title `matrix: 2.5 \| OVERRIDDEN` | — |
| Plant Nagpur→Kolkata with override 2 | override held at **2**; title `matrix: 4.2 \| OVERRIDDEN` | — |
| field cleared | stored `''`; `\| OVERRIDDEN` gone, background white | — |

The read-only reference card agreed with the charged rate in every state. Calculate All ran green
across all three rows.

**Not reproducible in live data:** the rendered unresolved state. The Product Owner's freight master
is complete across all 36 plant×location pairs, so no unresolvable combination exists without
editing master data, which was not done. Unresolved was demonstrated through the actual served
module in the browser and through focused fixtures. This is a positive finding: **S8 blocks no route
in current valid master data.**

### 5.3 Restoration

The Product Owner's Batch profile was restored exactly — `freightOverride: 2` (number),
plant `Nagpur`, delivery `Nagpur`, 3 rows — verified after reload in both `cbb_batchprofile` and
`cbb_batch_autosave`. `.env.local` was restored byte-exact to `920559e5…0b6dd9`.

---

## 6. Protected file handling

Authorised edits in `src/tabs/batch/BatchProfileBar.jsx` were confined to the separately identified
freight sites: the import, the two Plant/Delivery materialisation sites, the missing-matrix display
expression with its help text, and the freight input handler.

| | Value |
|---|---|
| Hunk body sha256 **before** | `8ad1c24106bc94fffbc25426c88d010de2877a5d69fdc5062fa962e3a46e0f3b` |
| Hunk body sha256 **after** | `8ad1c24106bc94fffbc25426c88d010de2877a5d69fdc5062fa962e3a46e0f3b` |
| `diff` before/after | no output — byte-identical |
| Hunk in `git diff` | `@@ -213,2 +218,8 @@` — same source coordinates, own separate hunk |
| Working-file location | shifted 213–220 → 218–225 by insertions above it |
| Staged | nothing; the file was never staged |
| Whole-file sha256 | `23f34283…88b3f` → `f08ae990aa05b2ac2a71ace36140b5d1b2d3c02837094dbcc37e6915bac2449c` |

A changed whole-file SHA-256 is expected and is not a preservation failure. The stable identifier for
the hunk is its body, recorded here verbatim:

```
          {/* Header + data rows grid. The three data columns are PINNED at 52px,
              matching Costing's Batch Context bar (BatchContextBar.jsx:161) so the
              same three fields are the same size in both places. They were 1fr,
              which let them absorb the bar's free space and rendered a two-digit
              percentage in a field several times wider than its content - the
              numField width arguments below (50/48/46) were written for the
              intended size and never applied, because the input is width:100%. */}
          <div style={{display:"grid",gridTemplateColumns:"24px 52px 52px 52px",
```

---

## 7. Accepted future boundaries

S8 is closed with these boundaries recorded and accepted:

| Boundary | Stage |
|---|---|
| `legacy_matrix` replacement by the approved Freight Master, and its **possible repricing event** — mirror rates are not guaranteed equal to approved Freight Set rates | **U3** |
| Canonical Pricing Group and row producers, plus **`legacy_batch` restatement** into governed Pricing Group freight before that tier is removed | **U4** |
| Fingerprint construction and live divergence classification | **U4** |
| Immutable Quote snapshot enforcement, including the rule that temporary sources are never recorded as approved Freight Master references | **S9 / U5** |

Also recorded, not actioned: `BatchProfileBar.jsx` `_mxRaw` now reports an absent pair as
unavailable rather than zero, which is the display-side half of the U3 work — the governed
replacement of `DEFAULT_FREIGHT` remains U3's.

---

## 8. Files changed

11 files, +773 / −44. No migration. Nothing committed or pushed.

| File | Lines |
|---|---|
| `scripts/resolver-fixtures.mjs` | +261 |
| `src/engine/resolveAuthority.js` | +149 |
| `src/engine/costing.js` | +124 −6 |
| `scripts/costing-fixtures.mjs` | +107 |
| `src/tabs/batch/BatchProfileBar.jsx` | +51 −13 |
| `src/state/useQuoteActions.js` | +30 −6 |
| `src/state/useBatchState.js` | +28 −6 |
| `src/state/useCostingResult.js` | +26 −6 |
| `src/tabs/costing/OutputPanel.jsx` | +21 −2 |
| `src/state/useCostingDraft.js` | +13 −1 |
| `src/tabs/costing/SpecForm.jsx` | +7 −1 |

Plus a documentation block in `.env.example` describing `freight_authority_v2`.
`src/lib/featureFlags.js` was **not** modified.
