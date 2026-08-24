<!--
  CANONICAL LOCATION: quote-gen-fe/docs/component-split-plan.md

  This is the working plan for the nine-phase split of QuotationApp.jsx.
  Amend THIS file — it is the version under version control, so every change
  to the plan is diffable alongside the code change that motivated it.

  It began life as a Claude Code plan file at
  ~/.claude/plans/i-want-to-split-cryptic-fox.md, which is now a stale copy
  kept only for that session's tooling. Do not edit that one.

  Status when this file was created: Phases 0-3 committed on
  refactor/component-split; Phase 4 written and under review; plan item 4c
  (the lib/persist.js seam) outstanding and owed as the next commit.
-->

# Split `QuotationApp.jsx` into components

## Context

`quote-gen-fe/src/QuotationApp.jsx` is a single 5,402-line file (718 KB) holding the entire app:
every `useState`, every handler, and all seven tabs' JSX. It was deliberately left monolithic
(CLAUDE.md says so), but it has now hit concrete limits:

- **All seven tabs are built on every render.** Each tab is a `const` holding a JSX element, all
  evaluated every time, then selected at the bottom by `{tab==="x" && …}`. Typing one character in
  Costing rebuilds the 1,116-line Batch Entry tree.
- **`calcCosting()` runs on every render** (line 1147), including renders caused by unrelated state.
- **The monolith is already forcing bad code.** `newSector`, `newGrade`, and `newLocation` are pure
  form-scratch state hoisted ~4,000 lines from their only consumer, with a comment at line 4989
  explaining that Rules of Hooks left no choice. `constructionLibTab` is an IIFE for the same reason.
- **Zero `useMemo`/`useCallback`** anywhere in the file.

Goal: real components, one mounted tab at a time, with a shared state layer — ending at a
~113-line `QuotationApp.jsx`.

### Decisions taken
| | |
|---|---|
| Scope | Full split, all phases |
| State sharing | React Context — one provider, domain-sliced hooks |
| Unreferenced code | **Retain by default.** Delete only what is inert by construction — see Phase 2 |
| Broken `exportExcelFull` | Flag only, move as-is — do **not** fix in this refactor |
| Costing↔Batch bridge | Its own module. The most important business logic in the app |
| **Phase 4** | **Hard stop.** Ships alone, uncommitted, hand off for manual guard verification |
| Commit discipline | **One concern per commit.** Structural moves and behaviour changes never share one |

### Sequence from here
| # | Commit | Notes |
|---|---|---|
| 1 | *(user)* run the four negative cases | Case 4 target: **₹2.10 / MOQ 82,200** |
| 2 | ✅ **Phase 4, UNCHANGED** | committed `c7d7b83` at the exact reviewed bytes |
| 3 | ✅ **4c persist wrapper** | 37 sites wrapped, lint-neutral; carried this document into the repo and the held-back `useCostingState` comment |
| 4 | **D-1 Glass SKU Type** | fix proposed for approval before writing |
| 5 | Phase 5 — memoise `useCostingResult` | |
| 6 | Phase 6 — leaf tabs | 6c needs the persist wrapper already in place |
| 7 | Phase 7 — prerequisite commit lifts New Batch | **D-2 fixed there** |

---

## Prerequisite

✅ **DONE.** The pre-existing uncommitted work was committed as `1ee0e28` *"Gate the app behind
login; add account UI and user management"* — that is the clean baseline.

Phase 0 tooling then landed on `main` as `3d87de8` *"Add costing fixture harness and lint baseline"*,
deliberately **on main rather than the refactor branch** so the harness survives any revert to main.
`refactor/component-split` is branched from `3d87de8`.

Every phase must be independently revertable: one commit per phase on `refactor/component-split`.

---

## Phase 0 — Baseline + automated fixture harness

There is no test suite. Rather than re-entering three specs by hand at eight phase gates, build a
fixture harness once — `engine/costing.js` and `data/defaults.js` are **verified pure** (no
`localStorage`/`window`/`document`/`navigator`), and `package.json` is `"type": "module"`, so they
import directly into Node.

1. **`scripts/costing-fixtures.mjs`** (~35 lines): import `calcCosting` and the `DEFAULT_*` masters,
   run frozen specs, and assert `finalRate`, `ratePerKg`, `calcMOQ`, `calcGSM`, `calcBS` against
   golden values. Non-zero exit on mismatch.
   Add `"test:costing": "node scripts/costing-fixtures.mjs"` to `package.json`.
   One command per phase gate; the highest-leverage item in the plan.

   - **Fixture 1** — a 5-ply Box.
   - **Fixture 2** — a Plate.
   - **Fixture 3 — a Part-L contrast pair.** Run the *same* Part-L spec through `calcCosting` twice,
     once with `wastePP: 0` and once with `wastePP: 5`, and **assert the two `finalRate` values
     differ**. Record both numbers in the Phase 0 artifacts.

   > **Pin fixture 3 to a named sector with `wastePP: 5` — `PAINTS` or `ALCOBEV`.** `5` is *not* a
   > universal default: of the sector rows in `data/defaults.js`, 10 carry `wastePP: 5`, **8 carry
   > `wastePP: 0`**, and 2 carry `3` (and 12 carry `convPP: 0`). This is precisely the CLAUDE.md
   > warning that "several sectors set them to 0." Pick a `0`-sector by accident and both arms of the
   > pair produce the same rate, making the assertion vacuous.

   > ⚠️ **What fixture 3 does and does not prove.** It guards the **engine's** arithmetic on an
   > explicit zero, and it gives the manual case-4 check a known-wrong number to compare against —
   > "a Part-L with `wastePP` cleared to 0 must show ₹X; if it shows ₹Y, the resolver regressed."
   > It does **not** test the resolver. `calcCosting` receives `_calcSpec` (1127–1134), in which
   > blanks have *already* been resolved to defaults; the blank-vs-zero distinction lives at
   > 1127–1146 inside `App()` and is not importable. **Negative case 4 in the Phase 4 hard stop
   > remains a mandatory manual check — this fixture does not discharge it.**
2. `npx eslint src` → save output. Baseline: **121 errors, 2 warnings** — recorded to
   `scripts/eslint-baseline.txt` (per-file and per-rule, repo-relative, diffable). Of those, 118
   errors / 2 warnings are `QuotationApp.jsx` alone; `engine/costing.js` adds 2 and `AuthContext.jsx`
   adds 1. *(An earlier draft of this plan labelled the 118 figure as the `eslint src` total — it was
   the single-file count. Corrected in Phase 0.)* Any *new* rule violation in
   a later phase is a regression.
3. Click **⬇ Backup**; keep the JSON as a data fixture.
4. Export one Excel (backend up) and one PDF; keep both for byte comparison.

The harness covers the engine. It does **not** cover the UI or bridge guards — those need the
negative-case checks in the Phase 4 hard stop, all four of which are manual.

---

## Phase 1 — Logos out

`src/assets/logos.js` ← `LOGO_WIDE_B64` (line 15) only. Delete `LOGO_BOX_B64` and `LOGO_SQ_B64`
(lines 13–14) — image blobs with no consumer, no latent workflow attached.

**718 KB → ~355 KB.** The payoff is **lint and editor speed**, not build speed: the
`[BABEL] …deoptimised the styling… exceeds the max of 500KB` note comes from the ESLint run, not Vite.

**Verify:** PDF export still shows the logo header.

---

## Phase 2 — Delete only inert code (~24 lines, in two non-contiguous ranges)

### Retained despite zero/one reference — these are latent, not dead

Testing to date has covered the Costing → Batch → Costing → Batch → Quote Items → Costing Deep Dive
workflow. **Construction Library and its cross-tab interactions are largely untested and will be
exercised once a deep library exists.** Low reference counts in that area mean "not yet reached,"
not "dead." All of the following **move intact** into their new modules:

| Symbol | Lines | Destination |
|---|---|---|
| `exportPDF` | 384–413 | `src/export/pdf.js` (Phase 3) |
| `parseImportedExcel` | 491–528 | `src/export/importExcel.js` (Phase 3) — carry the "Fix 12: re-enable after column mapping is fixed" note |
| `handleImport` | 2084–2091 | `state/useQuoteActions.js` (**Phase 4**) — it is App-scope: calls `setItems`/`setTab`/`setAiNotes` and reads `rates`/`freight`/`boxTrim`. It **cannot** live in the pure export module |
| `importRef` + the commented-out Re-import JSX | 857 (part), 4812–4820 | `tabs/QuoteItemsTab.jsx` (**Phase 6e**) |
| `parseConstrQuery` | 1026–1063 | `state/useBatchState.js` (Phase 4) — see the UNWIRED note below |
| `constrQuery`, `constrFilter`, `expandedConstr` | 971–973 | `state/useBatchState.js` (Phase 4), beside the `batchConstrOverlay*` state |
| `addItem` | 1169–1199 | `state/useQuoteActions.js` (Phase 4) |
| `savedQuotes` / `setSavedQuotes` + the Drafts button | 832, 4823–4828 | retained — see the accurate justification below |
| `_sendLayerNames` | 1165 | moves with the send-readiness block |

> ⚠️ **Line 857 is one line with four different fates** and gets edited in three separate phases:
> `const fileRef=useRef(),importRef=useRef(),templateRef=useRef(),restoreRef=useRef();`
> — `fileRef` deleted (Phase 2) · `importRef` → `QuoteItemsTab.jsx` (Phase 6e) · `templateRef`
> attached at 4712 but never read · `restoreRef` → `TopBar.jsx` (Phase 8). Split it deliberately;
> don't let one phase's edit clobber another's.

**`savedQuotes` — state the reason accurately.** `setSavedQuotes` has exactly one writer (line 1176,
inside `addItem`) and `addItem` has zero call sites, so `savedQuotes` is permanently `{}` and the
Drafts button at 4823 **never renders today**. Retaining `addItem` is still right, but because it
preserves a **re-wirable** path — not a working one. Do not carry "retaining `addItem` keeps Drafts
reachable" forward as if it were verified.

**`parseConstrQuery` is UNWIRED, not superseded — and it has an obvious intended home.** Its output
object (1031–1032) is `{sector, client, status, gsm_min, gsm_max, bs_min, bct_min, ect_min,
cobb_max}` — *exactly* the filter shape the live batch overlay consumes at 3440–3446 and the same
field set `clTabFilter` uses at 4282–4290. It is a free-text query parser (e.g. `active alcobev ITC
BS>8 GSM 700-750 Cobb 125`) for a filter shape with **two live consumers**, currently wired to a
third orphaned setter. Keep it with the 971–973 trio in `useBatchState` beside `batchConstrOverlay*`,
under this header rather than a bare `// latent:`:

```js
// UNWIRED: free-text filter parser. Output shape matches
// batchConstrOverlayFilter (3440–3446) and clTabFilter (4282–4290).
// Currently writes to setConstrFilter, which has no reader.
// To activate: point it at setBatchConstrOverlayFilter (note: the overlay
// hardcodes status='active' at 3439, while the parser emits a status field).
```

Mark the remaining retained symbols with a short `// latent:` comment at their new home rather than
deleting, so the next reader doesn't re-litigate this.

### Delete — inert by construction, no workflow behind them

These are disabled-feature stubs that cannot do anything if called: `handlePDF` and `handleSuggest`
(1110–1111) only set the string *"AI Assist is currently disabled"*; `aiPanel` is literally `null`.

| Item | Lines |
|---|---|
| `aiOpen`, `aiMode`, `aiLoading`, `file`, `desc` | 770–771, 833–836 |
| `mergeAI` | **1094–1105** |
| `handlePDF`, `handleSuggest` | **1110–1111** |
| `aiPanel = null` + its render site | 5357, 5397 |
| `addedFlash`, `editMasters`, `fileRef` | 859, 837, 857 (part) |
| `CONSTR_SUMMARY` (dead alias for `constrAutoName`) | 3158 |

> 🛑 **Two deletions, not one contiguous range. `1099–1111` would be destructive.** `mergeAI`'s body
> runs to **1105**, and lines **1107–1109 are live code that must be kept**:
> ```
> 1094–1105  mergeAI                     DELETE
> 1107–1109  sectorCodes + its comment   KEEP — LIVE
> 1110–1111  handlePDF, handleSuggest    DELETE
> ```
> `sectorCodes` (1109) has three JSX consumers — `specForm` 2217, `batchEntryTab` 3199,
> `constructionLibTab` 4589 — plus the retained `parseConstrQuery` at 1038. Deleting `1099–1111`
> would truncate `mergeAI` mid-object-literal *and* silently take `sectorCodes` with it. The
> truncation is a syntax error so the build catches it — but only if nobody "fixes" the unbalanced
> paren without noticing `sectorCodes` went too.

If AI Assist is on any roadmap, say so and this list shrinks to the last two rows.

**Keep:** `aiNotes`/`setAiNotes` — the live status banner at `specForm` 2166–2172, written by
`addItem` (1189, 1198) and `handleTemplateLoad` (2080).

**Verify:** `npm run test:costing`; all seven tabs render; Excel and PDF export work.

---

## Phase 3 — Extract pure module-level code (~728 lines)

Nothing in lines 33–760 closes over React state — copy-paste plus imports.

Extract `src/engine/rowType.js` **first**: `isPPType` and `applyAddOns` (149–167) are imported by
both the export modules *and* `App()` logic (`calcBatchRow`, `sendCostingToBatch`,
`sendAllToQuoteItems`, `pushCostingToBatchRow`, `getBatchRowStatus`, `loadBatchRowIntoCosting`).
Neutral domain helpers, not export code.

Then:
- `src/ui/primitives.jsx` ← `inputSt`, `Inp`, `Sel`, `Btn`, `SH`, `FR`, `KN` (536–586)
- `src/components/BoxDieline.jsx` ← 587–760 (zero App-state coupling — cleanest extraction in the file)
- `src/export/excel.js` ← `exportFromTemplate` **and** `exportExcelFull` together (the former calls
  the latter at 201 and 211)
- `src/export/pdf.js` ← `exportAllPDF` **and** `exportPDF`
- `src/export/importExcel.js` ← `parseImportedExcel`
- `src/export/toB64.js` ← line 534

> ⚠️ **ASI hazard travels in this phase.** Line 271 is
> `const _ppItem=items.find(i=>isPPType(i.spec.rowType)) // R-2;` — the statement terminator is
> *inside the comment* and only works via automatic semicolon insertion. It sits inside
> `exportFromTemplate`, so it lands in `src/export/excel.js`. **Never run Prettier or
> `eslint --fix` reflow over this code**, here or anywhere in the file.

> ⚠️ **Two known `no-undef` bugs, moving as-is by decision.** `exportExcelFull` references undefined
> `qty` (line 108, twice) and undefined `locations` (line 130) — so it throws `ReferenceError` on
> every call, and it is reachable at 201 and 211 (no template loaded / template missing its `CBB+PP`
> sheet). The client-side Excel fallback CLAUDE.md describes as covering Vercel's 10s cap does not
> work today. Separately, `parseImportedExcel` references undefined `boxTrim` at line 524 (its
> parameter is named `boxTrimData`) — part of why Re-import is disabled. Carry `// BUG:` comments
> naming all four references. Fix separately.

**Verify:** `npm run test:costing`; Costing renders; die-line preview appears when L/W/H are typed;
exported Excel and PDF match the Phase 0 files.

---

## Phase 4 — State layer *(highest risk — nothing else in this commit)*

> # 🛑 PHASE 4 IS A HARD STOP
>
> **Phase 4 ships alone.** Do not begin Phase 5 or Phase 6 in the same session — not even if Phase 4
> finishes early and looks clean.
>
> **After the Phase 4 code is written: stop and hand off. Do not commit.** The four negative cases
> below are run manually by the user before anything enters history:
> 1. New-batch context + non-empty batch must **BLOCK**
> 2. Client/sector mismatch vs Batch Profile must **WARN**
> 3. Unconfirmed SET Code must **BLOCK** auto-dims, Calculate All, Deep Dive, Send-to-Quote-Items
> 4. Part-L with `wastePP = 0` must **keep 0**, not fall back to the sector default — compare against
>    the Phase 0 fixture-3 contrast pair: it must show the `wastePP: 0` rate, not the `wastePP: 5` one
>
> **`npm run test:costing` passing is NOT sufficient to proceed.** It exercises `calcCosting` on
> three frozen specs and covers **none** of the four cases above — those are UI/bridge guards, and
> the engine harness cannot see them. A green harness on a broken gate is the exact failure this
> stop exists to catch.
>
> **Report the line-count movement as TWO separate numbers.** Phase 4 both removes the state region
> and adds a `useAppState()` destructure back into `App()`, so a single net Δ conflates the two and
> can false-trip on how the destructure happens to be wrapped.
>
> 1. **Lines REMOVED from the state/handler region** — the measurement that matters. Re-derive the
>    region by grep (see below); the plan's original 762–2106 is from the 5,402-line file and has
>    shifted by ~750 lines. Expected ≈ **−1,324**. Treat ±5 as rounding; **outside roughly ±25 means
>    code was missed or over-taken — flag it and stop.**
> 2. **Lines ADDED by the destructure** (plus any new import lines) — reported separately, with no
>    band. However it is wrapped is a formatting choice, not a signal.
>
> Net file Δ is then just (1) + (2), and is reported for information only — it is **not** the gate.
>
> **Re-derive every line range in this phase by grep.** Every number written in this plan predates
> Phases 1–3 and is stale: `sendCostingToBatch` 1543–1873, the bridge functions, the effect
> line numbers, all of it.

**This comes before tab extraction.** Extracting tabs first would mean writing ~96 prop declarations
across five tabs (measured App-scope reference counts: freight 8, defaults 17, constrLib 18, rate 24,
items 29) and deleting all of them in the state phase. State-first lets every tab be extracted
directly onto `useAppState()`. Phase 3 already provides the low-risk confidence-building run.

```
src/state/
  AppStateProvider.jsx        provider + useAppState()
  useUiState.js               tab, sidebarCollapsed, toasts/showToast, modal flags, role
  useMastersState.js          rates, freight, locations, sectors, boxTrim, partitionsMaster,
                              constructionLib, rate-master knobs
  useCostingState.js          spec, s(), setAutoFill, costingContext, specCommitted,
                              activeBatchRowId, aiNotes
  useBatchState.js            batchProfile, batchRows, batchResults, expandedRows, pinnedAddOns,
                              autoCode*, overlay state, legacy constr filter state, autosave
  useQuoteItemsState.js       items, savedQuotes, quoteRef/dates, template
  useCostingResult.js         the derived block at 1117–1153
  useCostingBatchBridge.js    the 546-line Costing↔Batch bridge  ← see 4a
  useQuoteActions.js          remaining cross-slice handlers
src/lib/persist.js            read/write/remove wrapper           ← see 4c
```

**One provider, one `useAppState()`.** Don't nest additional *state* providers — nesting order would
become load-bearing and cross-slice actions would straddle boundaries. (`AuthProvider` already sits
above `App` in `App.jsx`, so CLAUDE.md's "no Context" line is *already* false today, which
strengthens the Phase 8 doc update.) Re-render breadth is a non-issue: after Phase 7 only one tab is
mounted.

**The trick that makes this diff reviewable:** in `App()`, write
```js
const st = useAppState();
const { spec, setSpec, rates, setRates, batchRows, /* …everything… */ } = st;
```
so the ~3,300 remaining lines of JSX stay **byte-identical**. The diff reads "state declarations
moved out, one destructure added."

### 4a — Carve out the Costing↔Batch bridge first

**The most important business logic in the app**, and the highest-consequence code motion in this
plan. 546 lines spanning three of the proposed slices:

| Function | Lines |
|---|---|
| `sendCostingToBatch` | 1543–1873 (**331**) |
| `pushCostingToBatchRow` | 1438–1542 (105) |
| `loadBatchRowIntoCosting` | 1328–1369 (42) |
| `specFromProfile` | 1370–1403 (34) |
| `specForNewBatch` | 1404–1437 (34) |

`sendCostingToBatch` alone reads `costingContext`, `batchRows`, `spec`, `batchProfile`, and
`specCommitted`. Splitting these across `useCostingState`/`useBatchState`/`useQuoteActions` is
exactly how the two-context hard gate, the G1 identity-first guards, and SET Code confirmation get
silently broken. Keep them together in `state/useCostingBatchBridge.js` as one cohesive module with
an explicit header comment naming the invariants it enforces.

**Ordering constraint:** `resolveSpecWasteConv` is produced by `useCostingResult` (1137) and consumed
at **1463** and **1778** — both inside bridge functions. So `useCostingBatchBridge` and
`useQuoteActions` must both be called **after** `useCostingResult`.

### 4b — Ordering rules (violating any of these crashes or silently breaks)
1. **`useUiState` must run first** — `showToast` is referenced 28× by pre-JSX handlers.
2. **`invalidateAllBatchResults` must be declared before the two effects that call it** (currently
   1085 and 1251, calling a function declared at 1267). ESLint already errors here:
   `react-hooks/immutability` at 1085 — *"Cannot access variable before it is declared."* It only
   survives today because effects run after render. Those effects depend on masters
   (`rates`/`freight`/`constructionLib`) **and** batch (`batchProfile` fields), so they belong in a
   small `useBatchInvalidation(masters, batch)` called after both — **not** inside `useBatchState`.
3. **`parseConstrQuery` (1028) references `sectorCodes` (1109)** — same use-before-declare pattern,
   benign today, a hard crash if the two land in different hooks in the wrong order. This rule is
   live precisely *because* `parseConstrQuery` is being retained.
4. `handleBackup` (897) references `constructionLib` (961) — same pattern.
5. Delete the two now-dead `eslint-disable react-hooks/exhaustive-deps` directives (1084, 1250) —
   ESLint reports them as unused; the rule no longer exists in eslint-plugin-react-hooks v7.
6. Free fix: replace the mount effect at 1069–1071 (`setTemplateLoaded` inside `useEffect`, flagged
   `react-hooks/set-state-in-effect`) with lazy init, matching `templateB64` at 1066.

### 4c — Route all persistence through `lib/persist.js`  ✅ **DONE** (own commit, after Phase 4)

> Skipped during Phase 4 and paid back immediately after, as its own commit with zero logic change.
>
> **37 call sites wrapped** across 8 files — the 36 originally counted
> (`useMastersState` 17, `useBatchState` 8, `useQuoteItemsState` 4, `useQuoteActions` 3,
> `useUiState` 2, `useCostingState` 1, `QuotationApp.jsx` 1) plus one more found during the sweep:
> **`export/excel.js:174` reads `cbb_template`**. That one was outside the original count and would
> have left the seam leaky for exactly the key a migration touches.
>
> **`lib/apiClient.js` (3 sites) is deliberately excluded** — the Supabase auth session lives in its
> own key and is explicitly not part of the `cbb_*` data model. Routing it through here would
> conflate session persistence with app data.
>
> `persist.js` is a **thin synchronous shim**, mirroring the localStorage API one-for-one, so
> adopting it was a mechanical substitution. Its header states plainly what it does *not* buy:
> Supabase is async, so pointing these three functions at the network is not sufficient — callers
> would have to become async, and several are `useState` initialisers that cannot be. The realistic
> path is hydrate-on-mount plus write-through. The seam makes that change local to one module; it
> does not make it free.
>
> `useCostingState` reads `cbb_batchprofile` through the seam to seed plant/delivery, and now
> carries a comment saying why it must stay a storage read: it composes *before* `useBatchState`, so
> `batchProfile` state does not exist yet. That coupling is real and the seam cannot hide it.

Eleven sites are effects (768, 886, 1009, 1074, 1076–1081, 1086). **Five are imperative and easy to
lose:** `touchRateDate` (790 → `cbb_rate_date`), `handleRestoreFile` (938 → all keys),
`togglePinAddOn` (953 → `cbb_pinned_addons`, which has **no** backing effect), `handleTemplateLoad`
(2079 → `cbb_template`), and **a raw write inside `defaultsTab` JSX at 5061** (`cbb_boxtrim` "Reset
to Defaults") that will travel with the tab in Phase 6.

Also: `cbb_pinned_addons` is **missing from `BACKUP_KEYS`** (891–895), so backup/restore silently
loses pinned columns. Pre-existing — flag, don't fix here.

### 4d — Two loose ends
- **`role`** (52 references, from `useAuth()`) is read by four tabs plus `specForm` and
  `batchEntryTab`, and belongs to no slice. **Re-export it through `useAppState()`** rather than
  having six components each import `useAuth` — one source, one import per consumer.
- **`useRef` audit:** only `restoreRef` is genuinely used (`restoreRef.current?.click()` at 921).
  `templateRef` is attached at 4712 but never read; `importRef` is attached only inside the
  commented-out Re-import block. `restoreRef`, `handleRestore`, and the hidden `<input>` at 2158
  must move to `TopBar.jsx` **together** in Phase 8. All four refs share **line 857** — see the
  four-fates warning in Phase 2.
- **Don't scatter `client` / `material_code` string reads.** `client` appears **79 times** and
  `material_code` **27 times**, including `constructionLib`'s own `client` field, which is already a
  de-facto join key across Construction Library, Defaults, and Batch Profile. When CustomerMaster and
  SKUMaster land (see roadmap), every one of those becomes a foreign key. **Cheap accommodation, no
  semantic change now:** wherever this refactor already touches a `client`/`material_code` read,
  route it through the masters hook or the bridge rather than reading the raw string in tab JSX — so
  the split doesn't spread 79 direct string reads across twelve new files.

### Verify — happy path *and* the guards
**Hand off here. Do not commit.** The user runs the four negative cases before Phase 4 enters
history — see the hard stop at the top of this phase.

`npm run test:costing`, then the full flow: Costing → fill a 5-ply Box → Send to Batch Entry → row
appears → Calculate All → Deep Dive (🔍) → edit L → Push to Row → Calculate All → Send All to Quote
Items → Export Excel → diff against Phase 0. Refresh; confirm rates/freight/sectors/constructions/
items survived. ⬇ Backup → ⬆ Restore → confirm reload.

**Then the negative cases — these are the real assertions, and the happy path touches none of them:**
- New-batch context with a non-empty batch **must block**.
- Client/sector mismatch between Costing and the Batch Profile **must warn**.
- An unconfirmed SET Code (`setCodeAssumed === true`) **must block** auto-dims, Calculate All, Deep
  Dive, and Send-to-Quote-Items.
- A Part-L row with `wastePP` set to `0` must keep `0`, not fall back to the sector default.

---

## Phase 5 — Memoize the costing computation (~10 lines)

> ⛔ **Blocked until the Phase 4 hard stop clears** — Phase 4 must be manually verified against its
> four negative cases and committed by the user before this phase starts. Not the same session.

Wrap the derived block in `state/useCostingResult.js` in `useMemo`. Done in the session after
Phase 4 clears, as its own single-variable commit.

**Dependency list — get this exactly right or the memo is decorative:**
`spec`, `sectors`, `rates`, `freight`, `boxTrim`, `costingContext`, **`batchRows.length`** (not
`batchRows` — only `_hasCommittedBatch` uses it, and depending on the array busts the memo on every
grid keystroke), and the **four `batchProfile` fields destructured individually** — `waste`,
`convRate`, `wastePP`, `convRatePP`. Depending on `batchProfile` as an object busts the memo on every
profile-bar keystroke.

Honest expectation: `spec` is replaced wholesale by `s()` on every Costing keystroke, so this does
nothing for typing *in Costing*. It helps renders caused by other state — toasts, batch grid edits,
tab switches, sidebar collapse. **The primary perf win is Phase 7, not this.**

### Verify — the on-screen check is NOT sufficient

`resolveSpecWasteConv` is returned from this hook and consumed at
`useCostingBatchBridge.js:166` and `:481`, both inside `sendCostingToBatch`. Memoising the block
captures that closure. **A wrong dep list yields a stale resolver, and the waste/conv values written
into the batch row at send time come from an old spec.**

That failure is invisible on screen: the Costing panel renders `r`, not the resolver, so Final Rate
stays correct while the row silently receives wrong values. It is Case 4's failure class one layer
deeper, with no number on screen to catch it.

1. `npm run test:costing` passes.
2. Type in Costing — Final Rate updates.
3. **Change `wastePP` in Costing → Send to Batch → open the row → confirm the row carries the value
   just typed, not the previous one.**
4. **Re-run negative Case 4 end-to-end** (₹2.10 / MOQ 82,200).

Run steps 3 and 4 for **both the Box and the PP path** — `:166` and `:481` branch on
`isPPRowType` / `isPPItem`, so a stale resolver can surface on one path and not the other.

**Implementation note:** the safest way to satisfy this is to keep `resolveSpecWasteConv` itself
*outside* the `useMemo`, rebuilt every render from the memoised scalars. It is a trivial
object-returning arrow — memoising it buys nothing and is the entire source of the staleness risk.

---

## Phase 6 — Extract the five self-contained tabs (~1,068 lines)

> ⛔ **Blocked until the Phase 4 hard stop clears.**

Prerequisite: `src/lib/constructionName.js` ← `constrAutoName` (3137–3157) and `STATUS_DISPLAY`
(3126–3136). Both pure, both used by *two* tabs.

Follow the pattern in [`UserManagementTab.jsx`](quote-gen-fe/src/UserManagementTab.jsx): own file,
local state, imports from `theme.js`. Shared state and `showToast` come from `useAppState()`.

One commit each, ascending coupling:

| | File | Lines | Local state it absorbs |
|---|---|---|---|
| 6a | `tabs/FreightTab.jsx` | 61 | `newLocation` |
| 6b | `tabs/RateMasterTab.jsx` | 180 | `newGrade` |
| 6c | `tabs/DefaultsTab.jsx` | 204 | `newSector` |
| 6d | `tabs/ConstructionLibTab.jsx` | 418 | `clTabQuery`, `clTabFilter`, `clTabExpandedConstr` |
| 6e | `tabs/QuoteItemsTab.jsx` | 205 | `importRef` + the commented-out Re-import JSX (4812–4820) |

**6c is the payoff:** `newSector` becomes ordinary local state; delete the "hoisted for Rules of
Hooks" comment at 4989–4991. **6d kills the IIFE:** `const constructionLibTab=(()=>{…})()` becomes
`function ConstructionLibTab(props)`; `applyClTabFilter`/`filtered`/`activeCount` become plain locals.

> ⚠️ **6d needs the `Fragment` import.** Four `<Fragment>` opening sites exist: 3732 (batch grid,
> Phase 7) and **4580, 4611, 4663 — all three inside `constructionLibTab`.** Miss the named import
> here and 6d breaks. `<>` cannot take a `key`, and CLAUDE.md bans `<>` inside table rows.

**6d is also the tab whose behavior is least covered by testing** (see Phase 2). Extract it
structurally, change nothing semantically, and treat any behavior difference as a bug in the
extraction rather than a pre-existing quirk.

**Preserve these deliberate cross-domain reads — documented bug fixes, not smells:**
- `DefaultsTab` reads `batchProfile.sector` and `constructionLib` for sector delete/rename guards
  (4939–4974, comment at 4969).
- `QuoteItemsTab` reads `batchProfile.marginPP` (4799) and `batchProfile.paymentDisc` (4805).
- `ConstructionLibTab` has its own inline copy of `importConstrFromSpec` (4425–4477) that differs
  from the App-level one (2027–2072) — it also compares `spec_cobb`. **Do not unify them**; that
  would be a behavior change hidden inside a structural one, in exactly the untested area.

**Verify each step:** `npm run test:costing`; open the tab, edit a value, refresh, confirm
persistence. For 6c: add a sector, confirm it appears in both the Costing and Batch Profile
dropdowns, then try deleting a sector referenced by `batchProfile.sector` and confirm the guard fires.

---

## Phase 7 — Extract Costing and Batch Entry (~2,077 lines)

**Prerequisite commit — alone.** Two cross-cutting actions are inline JSX inside `batchEntryTab` and
must be lifted into `useCostingBatchBridge`:
- **`+ New Batch`** — the `onClick` handler body opens at **3404** and runs to 3424.
  🛑 **Do not start the lift at 3402.** Lines 3402–3403 are two closing `</div>` tags belonging to
  the Import-from-Costing block above; consuming them leaves the `BatchProfileBar` JSX unbalanced —
  the silent-deletion failure mode CLAUDE.md §5 warns about. Move only the handler body; the
  `<button>` element itself stays in `BatchProfileBar.jsx`. **Line 3421 reads `INIT_SPEC`** — the
  bridge module needs that import from `data/defaults.js`; it is easy to lose in the lift. All ten
  setters sit in 3411–3422. It calls **ten setters across four slices**: `setBatchProfile`,
  `setBatchRows`, `setBatchResults`, `setExpandedRows`, `setActiveBatchRowId`, `setSpecCommitted`,
  `setItems`, `setCostingContext`, `setSpec`, `setSetAutoFill`. The most cross-cutting action in the app.
- **`↓ Profile`** (3369–3392) — reads `spec`, `costingContext`, `batchRows.length`; writes `batchProfile`.

**7a — `tabs/costing/`**: `SpecForm.jsx` (642), `OutputPanel.jsx` (319), `CostingTab.jsx` (~15, just
the `380px | 1fr` grid wrapper). **Hoist `SubHdr` (line 2493) to module scope** — ESLint errors
`react-hooks/static-components` at 2501 and 2530 because it's a component created during render.

**7b — `tabs/batch/`**: `BatchProfileBar.jsx` (3160–3432), `ConstructionOverlay.jsx` (3433–3612,
IIFE → component with local query/filter state), `BatchGrid.jsx` (3613–4275), composed by
`BatchEntryTab.jsx` (~40).

**Deliberate restraint — do NOT go further in this phase:**
- Leave `BatchGrid.jsx` as one ~665-line file. The frozen-column cumulative `left` offsets and the
  `<Fragment key={row.id}>` structure at 3732/4267 are brittle.
- Leave the expanded-row IIFE (4118–4266) as an IIFE.
- Leave `upd`/`updC` (3709–3711) defined per-row inside `.map()` — plain functions, not hooks.
- The IIFE at **3666–3696 returns an array and chains `.map()` inside the IIFE**. That is the
  *correct* pattern per CLAUDE.md §5. Do not "tidy" it by hoisting the array out — splitting the
  call from `.map()` renders raw objects as children and crashes React.

**Verify:** `npm run test:costing`; the full Phase 4 flow **including every negative case**; plus —
slide-over overlay opens per-row and from the toolbar; pin/unpin an add-on column; expand a row.

---

## Phase 8 — Shell cleanup and docs

- `ui/Sidebar.jsx` (2107–2140, plus `NAV_ITEMS` 2097–2106) and `ui/TopBar.jsx` (2143–2162, **with**
  `restoreRef` and the hidden restore `<input>` — they must not be separated).
- Move `UserManagementTab.jsx` into `tabs/`.
- Consider renaming `aiNotes` → `statusNote` (it is a generic status banner; nothing about it is AI).
- **Update `CLAUDE.md`** — two statements become actively misleading and will make the next session
  fight this architecture:
  - *"all React state (`useState` only, no Redux/Context)"* — already false (`AuthProvider`), now
    emphatically so.
  - *"This is intentional per the project brief … don't propose breaking it apart unprompted"*
- Drive `npm run lint` to zero for the **new** files at minimum.

---

## Post-split roadmap — what this architecture must accommodate

Three coded masters land **after** the split is organized and tested for logic consistency:
**CustomerFamilyMaster**, **CustomerMaster**, and **SKUMaster**. CustomerFamily and Customer each
split into two categories — **Customer** and **Prospect** — and a Prospect carries **two codes**: a
temporary code while it is a prospect, and a second code once converted to a customer.

Not designed here. But the split should not obstruct it, so three cheap accommodations:

1. **Make masters additive.** `useMastersState` should hold masters in a uniform shape
   (key → `{data, setData, storageKey}`) rather than seven bespoke `useState` pairs, so master #8,
   #9, #10 are registrations rather than edits. Likewise, `NAV_ITEMS` + the `tabs/` directory should
   make adding a master tab a one-line change, and new master tabs should follow the Phase 6 leaf-tab
   pattern exactly.
2. **`lib/persist.js` earns its place here.** Customer and SKU masters are shared reference data
   across Makers and Checkers, not per-browser scratch — they almost certainly belong in Supabase
   rather than `localStorage`. Routing all sixteen existing sites through one wrapper in Phase 4c
   means that migration touches one file. *(What actually moves to Supabase stays a per-feature call,
   per CLAUDE.md — not decided here.)*
3. **Flag the code-generation seam now.** `generateCode` (1975–1980) and `generateMissingCodes`
   (1982–1990) build material codes from a client prefix — confirmed: first 4 chars of
   `batchProfile.client` free text, uppercased — plus a sequence. The Prospect-temp-code →
   Customer-code conversion, and the CustomerFamily → Customer hierarchy, both land right here. Keep
   these two functions together and clearly named in `useQuoteActions` so that work has an obvious
   insertion point — do not scatter them into the batch grid.
4. **The integration surface is wider than those two functions.** `client` (79 references) and
   `material_code` (27) become foreign keys once the masters land, and `constructionLib.client` is
   already an informal join key across Construction Library, Defaults, and Batch Profile. See the
   Phase 4d accommodation: route reads through the masters hook or bridge as the refactor passes
   through them, rather than scattering raw string reads across the new file tree.

---

## Defect register — pre-existing bugs found during Phase 4 testing

Neither is a Phase 4 regression; both exist in the original monolith. Recorded here so they are
fixed in the right commit, at the right time, and never bundled with a structural move.

**Standing rule for every commit from here: one concern per commit.** Structural moves and
behaviour changes never share a commit. If a guard breaks, it must be unambiguous which change did it.

### D-1 — Glass SKU Type never reaches the batch grid

Costing captures the value as **`spec.skuType`** (the Glass SKU Type dropdown calls
`s("skuType", v)` at `QuotationApp.jsx:313`). The batch grid reads and writes **`row.glassSKUType`**
(`QuotationApp.jsx:1805, 1812, 1884–1889, 2116–2123`). `sendCostingToBatch` writes **neither** — the
only occurrence of `skuType` anywhere in the 579-line bridge is the comment at
`state/useCostingBatchBridge.js:138`, which lists it among the fields explicitly *not* carried.

Effect: the grid always shows "— set on Main Box row —" and every SKU needs manual re-entry. The
grid's Part-row inheritance from `parentBox.glassSKUType` works correctly; it just never gets a seed.

> **Fix window: the commit immediately after Phase 4 lands.**
> **Do not touch `useCostingBatchBridge.js` before then** — the byte-identical diff against the
> original ranges is the only evidence Phase 4 is correct, and editing the file destroys it.
>
> **Propose the fix before writing it.** Two open questions are the user's call, not the
> implementer's: (a) does it write to the Main Box row only, or to Part rows too? (b) should the
> field be renamed to a single name across both layers?

### D-2 — New Batch silently discards the Costing scratchpad

`QuotationApp.jsx:1398` fires `setSpec({...INIT_SPEC,plant:"",delivery:""})` unconditionally. The
confirm text at `1383` names *"the current profile, all SKU rows, results, and Quote Items"* — four
things. The Costing spec is a fifth, unnamed one.

Worst case is not hypothetical: a user fully enters a spec, is correctly blocked by a Batch Profile
mismatch, goes to New Batch to clear the blocker, and loses the entire spec with no warning. They
consented to four things and lost five.

> **Fix window: Phase 7's prerequisite commit**, which lifts this exact handler into
> `useCostingBatchBridge` anyway. Fixing it there costs nothing extra and lands in the right module.
>
> **Propose options then, not now** — add the scratchpad to the confirm text; preserve the spec and
> clear only the batch; or offer a third choice. The user decides.

---

## Target layout

```
src/
  QuotationApp.jsx          ~113  provider + shell + tab switch
  state/                          9 files (see Phase 4)
  tabs/
    costing/                CostingTab, SpecForm, OutputPanel
    batch/                  BatchEntryTab, BatchProfileBar, ConstructionOverlay, BatchGrid
    ConstructionLibTab.jsx  QuoteItemsTab.jsx  DefaultsTab.jsx
    RateMasterTab.jsx       FreightTab.jsx     UserManagementTab.jsx
  ui/                       primitives.jsx, styles.js, Sidebar.jsx, TopBar.jsx
  components/               BoxDieline.jsx
  export/                   excel.js, pdf.js, importExcel.js, toB64.js
  engine/                   costing.js (untouched), rowType.js
  lib/                      apiClient.js (untouched), constructionName.js, persist.js
  assets/logos.js
  scripts/costing-fixtures.mjs
  theme.js  data/defaults.js  App.jsx  AuthContext.jsx  LoginScreen.jsx  index.css   (untouched)
```

| Phase | `QuotationApp.jsx` | Δ |
|---|---|---|
| 0 Baseline | 5,402 (718 KB) | — |
| 1 Logos | 5,396 (**355 KB**) | −6 |
| 2 Inert code | ~5,372 | −24 |
| 3 Pure modules | ~4,644 | −728 |
| 4 State layer | ~3,320 | **−1,324** |
| 5 Memo | ~3,320 | 0 |
| 6 Leaf tabs | ~2,252 | −1,068 |
| 7 Costing + Batch | ~175 | −2,077 |
| 8 Shell | **~111** | −64 |

*(Phase 4's Δ is the state+handler region 762–2106 = 1,345 lines, less the ~21 inert lines inside
that range removed in Phase 2. Cumulative figures are ±a few lines per phase for added `import`
statements.)*

---

## Not doing: React Compiler

Out of scope. `eslint-plugin-react-hooks@7` (which ships the compiler's own analysis) reports three
hard violations: `react-hooks/purity` (1993, `Date.now()` in `addBatchRow`),
`react-hooks/static-components` (2501, 2530), `react-hooks/immutability` (1085) — the compiler would
bail out of optimizing `App()` entirely. It also cannot deliver the primary win: seven tab trees
being *constructed* every render is structural, fixed only by Phase 7. And with no test suite,
enabling it alongside a 5,400-line restructure means a wrong Final Rate can't be attributed to one
cause. *(Note: "it would reintroduce Babel" is not a valid argument — `@vitejs/plugin-react` already
depends on `@babel/core`.)*

Revisit as a standalone Phase 9 once `npm run lint` is clean of `react-hooks/*`. No `useCallback`
anywhere either — with one tab mounted and no `React.memo` boundaries it buys nothing.

### Phase 9 candidate — extract `resolveSpecWasteConv` (do NOT do this now)

Lifting the blank-vs-zero resolver (1127–1146) into an importable pure module would make negative
case 4 machine-checkable permanently, retiring the only manual check that guards a *silent* wrong
number. Worth doing — **but not during Phase 4.** It is a semantic-boundary change inside the
highest-risk phase, in the exact code the hard stop exists to protect. Logged here; left alone.

---

## Verification (every phase)

1. **`npm run test:costing`** → must pass. The primary gate — but **never a sufficient one at
   Phase 4**, where it covers none of the four bridge guards. See the Phase 4 hard stop.
2. `npx eslint src` → diff against `scripts/eslint-baseline.txt` (121 errors / 2 warnings). No *new*
   rule violations; counts may only go down. Note `scripts/*.mjs` is outside the ESLint config
   (it matches only `**/*.{js,jsx}`), so the harness itself is unlinted — revisit in Phase 8.
3. `npm run build` → must succeed. Catches the esbuild/JSX landmines.
4. `npm run dev`, visit all seven tabs, edit one value in each, **refresh**, confirm persistence.
5. From Phase 3 on: export Excel (backend up, `GET localhost:3001/health` → `template: true`) and
   PDF; compare against the Phase 0 files.
6. From Phase 4 on: the full end-to-end flow **plus the four negative cases** listed in Phase 4.

Business-logic guardrail throughout: **`engine/costing.js` is never edited.** Its formulas are
mirrored in `quote-gen-be/server.py`. If `test:costing` fails, the refactor is wrong — revert the phase.
