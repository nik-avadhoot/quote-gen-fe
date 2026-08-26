# Feature requests

**Not defects.** The defect register (D-*) is in [`component-split-plan.md`](component-split-plan.md)
and covers code not matching intent. This file covers **capabilities that do not exist and are
wanted** — logged before they are specified, so the reasoning behind a request is not reconstructed
later from a one-line summary.

Numbered **F-*** in a separate sequence from D-*. Nothing here is scheduled, and nothing here is
part of the defect pass.

> **Recording rule, same as the defect register:** a request is logged with its *decided*
> constraints and its *open* questions kept visibly apart. **Do not design against an open
> question** — the point of separating them is that the open ones belong to the product owner.

---

## F-1 — Row copy/paste in Batch Entry

**Status: recorded, not specified. Do not build, do not design.**

Excel-like row copying in the Batch Entry grid — copy a row's contents onto another row rather than
re-keying them. Comparable in spirit to Costing's `+ New SKU`, but operating on grid rows.

### Decided — not open

| | |
|---|---|
| **Identity markers are NOT copied** | `matCode` is left alone. **The target row keeps its own identity.** |
| **SET Code requires confirmation** | It must not silently inherit onto the target row. |

### Open — the product owner's to answer

1. **Copy onto an EXISTING row, or duplicate as a NEW row?** These are different features. Pasting
   over a populated row is destructive and would need its own confirmation.
2. **One row at a time, or multi-row?**
3. **Does a copied row start stale, requiring Calculate All?**

---

### Source finding (a) — `setCodeAssumed` already provides the confirmation mechanism

**Yes. A copied row can land with `setCodeAssumed:true` and be caught by the existing gate. No new
machinery is needed, and reusing this gate is strictly better than adding a parallel one.**

**How the flag is set today** — always to mark *an inherited, unconfirmed* SET Code:

| Site | When |
|---|---|
| `useQuoteActions.js:363` | `addBatchRow` — a non-Box row inherits from the nearest preceding **confirmed** Box |
| `BatchGrid.jsx:298` | grid re-link to a preceding Box |
| `useCostingBatchBridge.js:515` | set **false** — a row sent from Costing carries an explicit SET Code |

**Cleared only by explicit user action** in the grid — `BatchGrid.jsx:249`, `:276`, `:288`, `:311`.
There is no path that clears it implicitly.

**Four gates already block on it**, so a copied row inherits all four for free:

| Gate | Site |
|---|---|
| Auto-dims suppressed | `useBatchState.js:138` — `if(row.setCodeAssumed)return row;` |
| Calculate All | `useQuoteActions.js:192` |
| Send All to Quote Items | `useQuoteActions.js:266` |
| Deep Dive | `useCostingBatchBridge.js:33` — **see the discrepancy below** |

The grid also already renders the confirm affordance for an assumed code (`BatchGrid.jsx:245`), so
the UI exists too.

> ⚠️ **Reusing this gate inherits its open defects.** Two are live and unresolved:
> * **D-15 (undecided)** — the gate blocks only the offending row, not globally.
> * **D-7 (open)** — SET Code case normalisation is asymmetric. The grid input does not uppercase
>   (`BatchGrid.jsx:309`) and the grid's parent predicates are case-sensitive, so a copied `setCode`
>   can silently fail to match its parent Box. **A copy feature would multiply this**, since copying
>   is exactly how the same string gets onto many rows at once.

> 🔎 **Source contradicts D-14 — one check for Stage 3, deliberately not investigated here.**
> D-14 records that an unconfirmed SET Code does **not** block Deep Dive. In current source it does:
> `BatchGrid.jsx:544`'s Deep Dive button calls `loadBatchRowIntoCosting`, which opens with an
> explicit `if(row.setCodeAssumed)` guard and a toast (`useCostingBatchBridge.js:33`). Either the
> guard post-dates the observation or the observation was mistaken. **Settle it when D-14 is worked.**

---

### Source finding (b) — the actual batch-row field list

The full set is the **union** of `addBatchRow` (`useQuoteActions.js:367`, the blank row) and
`sendCostingToBatch` (`useCostingBatchBridge.js:509`, the row built from a spec). Grouped as
requested — **the grouping below is a reading of the code, not a recommendation.**

#### Identity — must never copy

| Field | Why |
|---|---|
| `id` | Unique row key; `<Fragment key={row.id}>` in the grid, and `batchResults` is keyed by it |
| `matCode` | **Decided constraint** — the target keeps its own |
| `setCode` | **Decided constraint** — requires confirmation |
| `setCodeAssumed` | The confirmation flag itself; the copy sets it, it is never copied |
| `autoCode` | Records whether `matCode` was auto-generated — belongs to the target's identity |

> **`product` (SKU Description) is not in either list on purpose.** It is a per-SKU *name*, so
> copying it produces two rows describing themselves identically — but it is not an identity key the
> way `matCode` is. **Product owner's call.**

#### Spec / construction — the body of what a copy is for

`constructionCode` · `L` · `W` · `H` · `ups` · `boxType` · `spec_bs` · `spec_bct` · `spec_ect` ·
`board_gsm` · `spec_cobb` · `reqBoxWt` · `nosPerSet` · `glassSKUType` · `setAutoFill`

> Two in that list are **SET-scoped rather than row-scoped**, and are worth deciding separately:
> `nosPerSet` (derived from the partitions master via the SET head) and `glassSKUType` (SET-level
> context, where the parent Box wins and the row is only a fallback — see D-1). **D-22 has just
> shown that stale `glassSKUType` values already exist in live data**, and copying would propagate
> one across every target row.

#### Commercials — probably copy, product owner decides

`marginOverride` · `wasteConv_waste` · `wasteConv_conv` · `interestOverride` · `freightRowOverride` ·
`salesMOQ` · `volume`

`addOns` — a nested object, all eight copied together or not at all:
`printing` · `stitching` · `coating` · `handling` · `moqCharge` · `packing` · `other` · `unloading`

> **Every `*Override` field is a delta against the Batch Profile, not an absolute** — the bridge
> writes one only when the Costing value differs from the profile (`useCostingBatchBridge.js:497`).
> Copying them between rows under the same profile is therefore meaningful; the semantics change if
> the profile ever varies per row.

#### Workflow state — neither spec nor commercial

`reviewed` · `status` · `remarks`

> `reviewed` and `status` are per-row lifecycle and would be wrong to carry across. `remarks` is
> free text — product owner's call.

#### Bearing on open question 3

**A copied row starts with no result regardless of what is copied.** Results live in
`batchResults`, keyed by `row.id`, not on the row object — so a new `id` has no entry and the row is
uncalculated by construction. Recorded as a fact about the current data model, not an answer.
