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
| Verification | **No phase commits with its own verification outstanding** — whether or not the plan spells out a hard stop for it. Phase 5 broke this rule; see below |
| UI verification | **Cannot be automated. Permanently the user's.** See *Standing constraint* below — schedule around it, do not rediscover it at each gate |
| Capability | **Demonstrated, not described.** Before either party plans around something working, one of us produces it. Covers tool capabilities and covers reporting a check as run |
| Asking | **Ask, then WAIT.** If a question is worth asking before acting, it is worth not acting until it is answered. Raising a concern and proceeding anyway is not asking — it is narrating |

### Standing constraint — UI verification is the user's, always

The implementer has **no login**, so no guard check, negative case, persistence check or
end-to-end flow can be run automatically. `test:costing`, `eslint`, `vite build`, dep-completeness
analysis and console reads cover the engine and the module graph — **they cover none of the
behaviour that the guards protect.**

This is not a per-phase surprise. Each remaining phase below names which checks require a human at
the browser. Plan the handoff into the phase rather than discovering it at the gate.

#### Why the implementer cannot run UI checks — a property of the tools, not a temporary failure

Two independent blocks, both permanent:

**1. No password entry.** A standing prohibition covers passwords, keys and tokens. It does not relax
for a low-privilege or throwaway account, so credentials are never handed over and the implementer
cannot authenticate itself.

**2. The in-app browser pane is headless.** It supports DOM and JavaScript access — navigation,
accessibility-tree reads, console and network reads, `javascript_tool` evaluation — and all of that
works fine without a display. But it produces **no visible surface**: screenshots fail with
*"the Browser pane is not displayed, so the page is not compositing frames"*, including after
explicitly fronting the tab. **There is no window for the user to click into or type into.**

> ⚠️ **A "session handoff" — the user logging in once to a pane the implementer then drives — is
> therefore impossible, and was recorded here in error.** It was described before it was tested;
> it never worked. Do not reach for it again. A real-Chrome route via the `claude-in-chrome`
> extension exists in principle (a **named** profile — Chrome **Guest** mode disables all extensions
> and discards data on close, so Guest cannot work either), but it requires the user to install and
> sign into an extension purely to save the implementer a round trip. That trade was judged not
> worth it: Phases 0–5 all landed without it, and arranging it cost more exchanges than it saved.

#### Guard-adjacent data is out of bounds

Beyond not running the four negative cases: **do not inspect or report on the data those cases rest
on.** Concretely, sector `wastePP` values — the rows carrying `wastePP: 0` are exactly what Case 4
tests. Noticing them incidentally while looking at something else is unavoidable; going to look, or
reporting what is there, is not.

The account matters for the same reason. **An admin session is not acceptable, and convention is not
sufficient protection** — an admin can edit or delete the very master rows the acceptance test
depends on. The implementer works from a maker account, where the boundary is enforced rather than
promised.

#### What the implementer runs, and what it does not

| Runs | Cannot run — the user's, always |
|---|---|
| `npm run test:costing` | Every UI flow, without exception |
| `eslint src` diffed rule-by-rule against the Phase 0 baseline | The four negative cases |
| `npm run build` | The Case 4 number check (₹2.10 / MOQ 82,200) |
| Static dependency / free-variable analysis via ESLint scope | Persistence round-trips (edit → refresh → confirm) |
| Headless console and network reads; `localStorage` inspection | Excel and PDF export, and the Phase 0 byte comparison |

**The four guards must stay genuinely first-touch.** The implementer does not run them even
informally and does not report on them. Not a trust matter: a report that "Case 3 blocks correctly"
makes the user read their own run looking for confirmation rather than at what actually happened. An
accurate report still corrupts the check.

**The obligation that replaces browser access: state explicitly which checks were NOT run, in the
summary and not only in the commit body.** This has caught more real problems than browser access
would have.

#### Unrelated note kept from the same review: `apiClient.js` and the persist seam

`apiClient.js` was deliberately scoped **out** of the `lib/persist.js` seam in 4c, because the
Supabase auth session is not part of the `cbb_*` data model. That reasoning stands on its own and
should not be undone for tidiness — it keeps session persistence and app-data persistence separable,
which matters when the `cbb_*` keys move to a backend and the session does not.

**Why Phase 5 is the cautionary case:** it was committed with steps 3 and 4 of its own verification
unrun, and the disclosure sat in the commit body rather than the summary. The concrete risk was
real — those steps test whether the memoised resolver goes stale on the send path, and D-1 modifies
that same path. Stacked, a wrong waste/conv on a batch row could not have been attributed to either
change. Hence the rule now in the decisions table.

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

> ✅ **`exportExcelFull`'s failure reproduced live and captured (post-Phase-5):**
> ```
> Toast:   ❌ Export failed: qty is not defined. Check the browser console for details.
> Console: [exportFromTemplate] Export failed: ReferenceError: qty is not defined
>              at .../src/export/excel.js   at Array.map (<anonymous>)
> ```
> Source line is `excel.js:107`, inside `exportExcelFull` (32–137), in the item-row `.map()`. The
> outer try/catch ("Fix 8") catches it, so the user sees a toast rather than a white screen — the
> failure is visible but the export simply does not happen.
>
> **Reproducing it needs THREE conditions, not two.** Backend unreachable AND `cbb_template` absent
> from `localStorage` AND `templateB64` empty in React state. The Quote Items button passes
> `templateB64` from state, which is read once at mount — so clearing `localStorage` alone does NOT
> disarm the template, and the click silently takes the client-side template-clone path instead.
> The fallback is only reachable by passing `templateB64Arg = null` explicitly, or by reloading
> after clearing the key.
>
> ⚠️ **Two known `no-undef` bugs, moving as-is by decision.** `exportExcelFull` references undefined
> `qty` (line 108, twice) and undefined `locations` (line 130) — so it throws `ReferenceError` on
> every call, and it is reachable at 201 and 211 (no template loaded / template missing its `CBB+PP`
> sheet). The client-side Excel fallback CLAUDE.md describes as covering Vercel's 10s cap does not
> work today. Separately, `parseImportedExcel` references undefined `boxTrim` at line 524 (its
> parameter is named `boxTrimData`) — part of why Re-import is disabled. Carry `// BUG:` comments
> naming all four references. Fix separately.

**Verify:** `npm run test:costing`; Costing renders; die-line preview appears when L/W/H are typed;
exported Excel and PDF match the Phase 0 files.

> ✅ **Confirmed live (post-Phase-5).** `exportFromTemplate` works end-to-end after being moved
> to `export/excel.js`: clicking Export (Master Format) issued `OPTIONS` + `POST`
> `http://localhost:3001/export`, both **200**, with zero console errors. The backend fill of the
> master template is intact across the Phase 3 move.

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

> 👤 **Requires a human at the browser.** Per extracted tab: open it, edit one value, refresh,
> confirm persistence. For **6c** specifically: add a sector, confirm it appears in both the Costing
> and Batch Profile dropdowns, then try to delete a sector referenced by `batchProfile.sector` and
> confirm the guard fires. For **6d**, the Construction Library is the least-tested area in the app —
> its cross-tab interactions have no automated coverage at all.

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

> 👤 **Requires a human at the browser — the heaviest verification load of any phase.** The full
> flow (Costing → Send → Calculate All → Deep Dive → Push → Send All → Export) **plus all four
> negative cases**, because this phase moves the JSX that renders every guard's UI. Also: slide-over
> overlay opens per-row and from the toolbar; pin/unpin an add-on column; expand a row. Budget for
> this handoff — it is not a quick pass.

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

> 👤 **Requires a human at the browser.** Sidebar collapse/expand persists across refresh; Backup
> downloads and Restore round-trips (the hidden file input moves with `restoreRef` in this phase, so
> a silent break here is invisible to every automated check).

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

Costing captures the value as **`spec.skuType`** (dropdown at `QuotationApp.jsx:309`, shown only when
`spec.rowType` is Part-L/Part-W). The batch grid uses **`row.glassSKUType`** (editable dropdown at
`:2117`, shown only when `row.itemType==="Box"`). `sendCostingToBatch` writes neither — its only
mention of `skuType` is the comment at `useCostingBatchBridge.js:138` listing fields *not* carried.

**Ownership is inverted between the layers.** In Costing the *Part* row owns the value; in the grid
the *Box* row owns it and Part rows inherit. So the obvious one-line copy onto the row being sent
lights the badge but does **not** fix the symptom, because Nos/Set auto-fill reads
`parentBox.glassSKUType`.

Same shape as the already-fixed **B1** (`nosPerSet` lost on the Deep-Dive→Push path).

#### Three Part-row read sites — only two need the fallback
| Line | Reads | Change |
|---|---|---|
| `1806–1813` | `parentBox.glassSKUType` — Nos/Set auto-fill on SET-code confirm | **fallback** |
| `2148–2154` | `parentBox?.glassSKUType` — read-only display in expanded row | **fallback** |
| `1885–1890` | `row.glassSKUType` — 🍶 badge in the Nos/Set cell | **none** — starts working once the row carries a value |

#### Decision: Part-row write + consumer fallback

`sendCostingToBatch` writes `glassSKUType` onto **the row it is already sending**. No sibling write.
Consumers resolve `parentBox?.glassSKUType || row.glassSKUType || ""` — **parent wins, row is
fallback.** That is a precedence rule, not a second source of truth: "SET-level context" still holds,
and the Part row carries the SET's value forward until the head exists.

> **Why NOT seed the parent Box (the original recommendation) — the ordering hole.**
> Seeding requires a confirmed matching Box to already exist. It fails two ways, both likely:
> * **Part sent first.** Nothing enforces Box-before-Part, and costing a partition set starting from
>   Part-L is entirely natural. There is no parent to seed.
> * **Box present but `setCodeAssumed === true`.** The parent predicate excludes it — and an
>   unconfirmed SET Code is exactly what negative Case 3 blocks.
>
> So it works on the happy path and fails silently on the ordering a user is most likely to hit
> first. The fallback works regardless of send order, and keeps `sendCostingToBatch` free of sibling
> writes — preserving the property that makes that file's history our correctness evidence.

#### Two competing parent-resolution strategies live in this grid

Worth recording, because they disagree and neither is documented as canonical:

| Site | Predicate |
|---|---|
| Glass SKU consumers `1804`, `2141` | `itemType==="Box" && !setCodeAssumed && trimmed setCode matches` |
| SET-checkbox handler `1842` | nearest **preceding** Box by position: `[...batchRows.slice(0,ri2)].reverse().find(r=>r.itemType==="Box"&&r.matCode&&!r.setCodeAssumed)` |

Match-by-SET-code vs nearest-preceding-by-position. They can resolve to different rows. Not in scope
for D-1; flagged so it is not mistaken for a fix opportunity mid-bugfix.

#### Known limitation of the fix (accepted, do not fix)

`pushCostingToBatchRow` will carry `glassSKUType:spec.skuType||row.glassSKUType`, so **clearing the
Glass SKU in Costing will not clear it on push.** Identical to B1's behaviour and consistent with it,
but sharper here: Part rows have no editable Glass SKU control in the grid (`2143` is read-only), so
a wrong value can be corrected by pushing a different one, never by clearing. Accepted.

#### A Box row sent from Costing will now carry `glassSKUType`

Correct and desirable — it pre-fills the grid's Box dropdown, which is discoverable and editable.
The path is narrow: the Costing dropdown renders only for Part-L/Part-W (`:309`), so the value can
only be *set* while `rowType` is Part, then carried across a switch to Box per `:258`
("SET-level context, persists across role changes"). Still only the row being sent — no sibling write.

#### Naming: map now, rename later
Keep both names and map between them in the bridge. `skuType` currently means three things —
`partitionsMaster[].skuType` (the master's admin-editable primary key), `spec.skuType`, and the
grid's `glassSKUType`. Collapsing to `glassSKUType` is right, but not in this commit: `spec` objects
are persisted inside `cbb_quoteitems` (`useQuoteActions.js:106,113` store `{...spec}`), so a rename
orphans the field in every saved quote. Do it later with a read-both/write-one shim.

#### Existing saved rows: graceful, no migration
Every guard is falsy-safe — `row.glassSKUType||""`, `isAlcoPart && row.glassSKUType`,
`if(parentBox && parentBox.glassSKUType)`. Old rows behave after the fix exactly as all rows behave
today, and the existing *"⚠️ Glass SKU Type not yet set on the parent Box"* toast already says what
to do. No backfill.

#### Return leg — `buildSpecFromRow` hardcodes `skuType:""`
`engine/costing.js:213` blanks the field, so Deep Dive from a row that has `glassSKUType` loses it.
**No mirroring risk: `server.py` has zero references to `skuType` or `glass`** — the field never
reaches the backend, and `costing.js:213` is its only occurrence in the engine. Trivially safe.
**Own commit**, separate from the forward leg.

#### Test surface note — ALCOBEV is available

The working data restored into the implementer's profile carries a batch profile on sector
**ALCOBEV** with 23 construction entries. ALCOBEV is the Glass SKU sector, so this surface can
actually exercise the D-1 path; the defaults surface could not (no constructions, no ALCOBEV
batch). Useful accident — note it before choosing a different fixture.

#### D-1-follow-up — seed the Box row (NOT part of the bugfix)
Once send-ordering is properly understood, `sendCostingToBatch` could also seed the parent Box so the
SET head becomes authoritative and every sibling Part inherits. Deferred deliberately: it expands
`sendCostingToBatch` to write rows the user did not send, and it needs the ordering question answered
first. **Enhancement, not bugfix. Do not build it as part of D-1.**

### D-3 — Backup silently discards the two raw-string keys

`handleBackup` (`state/useQuoteActions.js:37`):

```js
BACKUP_KEYS.forEach(k=>{try{const v=getItem(k);if(v!=null)snap[k]=JSON.parse(v);}catch(e){snap[k]=null;}});
```

`cbb_rate_date` holds a raw string (`"11 Aug 2026"`) and `cbb_template` holds raw base64. Neither is
JSON, so `JSON.parse` throws, the catch writes `snap[k]=null`, and `handleRestoreFile:9`
(`if(snap[k]!=null)`) skips nulls. The keys never round-trip.

**The restore leg is already correct** — line 14 reads
`typeof snap[k]==='string' ? snap[k] : JSON.stringify(snap[k])`, with a comment explaining that
stringifying a string adds quotes and corrupts base64. Whoever fixed that leg did not fix backup.

**Why exactly two keys and not three.** Lines 39–47 overwrite `snap` for nine keys from in-memory
state *after* the loop, masking the line-37 failure for all of them. Only three keys escape that
overwrite: `cbb_template`, `cbb_rate_date`, `cbb_batch_autosave`. The loss is the intersection of
**raw-string AND not-overwritten** — the first two die, the third survives because it is JSON.

**Detection signature:** an affected backup file literally contains `"cbb_template": null`. Existing
files can be checked without restoring them.

#### Severity — higher than `cbb_pinned_addons`
* **Silent.** The exception is swallowed, the toast reports success, the file looks well-formed.
* **`cbb_template` is the real cost.** Restore onto a fresh machine and the Excel master is gone, so
  every export drops into `exportExcelFull` — the pre-existing `qty`/`locations` `ReferenceError`
  from Phase 3. **A restored profile cannot export at all.**
* `cbb_rate_date` is display-only (the "Rate Master last updated" string, written by
  `touchRateDate()`, shown once in the Rate Master header). Nothing costing-related reads it.

> **The Phase 0 backup was therefore never a complete snapshot — record it as a PARTIAL fixture.**
> The golden numbers are unaffected: they come from the Node harness, not from any backup.

> **Fix scope is narrower than it looks.** Because lines 39–47 overwrite nine keys afterwards,
> line 37 only ever matters for the three keys that escape the overwrite: `cbb_template`,
> `cbb_rate_date`, `cbb_batch_autosave`. Any fix need only be correct for those.
>
> **Fix window: the KEYS-registry commit.** Same file, same backup/restore concern, already opening
> for `cbb_pinned_addons`. One commit covers all three. **Propose before writing.** The obvious fix
> mirrors line 14 into line 37 — attempt `JSON.parse`, fall back to the raw string rather than null —
> but the proposal must also answer what happens to backup files **already written with nulls in
> them**. Do not fix before then; pre-existing, not a refactor regression.

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

### D-4 — Identity freeze is lost on reload while the batch survives

`specCommitted` is session state, not persisted. That is deliberate and correct in itself. The
consequence is not: **after any page reload the Costing identity freeze is gone, while the batch it
was protecting persists in `localStorage`.**

Observed directly: with "Batch active · 4 rows" showing, Costing's CLIENT and SECTOR fields were
empty and fully editable after a reload. A Maker can then type a different client into Costing and
send — and the client/sector mismatch guard only **WARNS**, it does not block.

So the post-reload state is: no freeze, plus a passable warning, protecting a batch that survived.
Weaker than the design intends, and reloads are ordinary — laptop closed, crash, HMR reload during
development.

**Not a refactor regression** — behaviour is identical to pre-Phase-4. But it is inherited rather
than decided, and it is the class of thing that bites in beta.

> **No fix window assigned.** To be decided after Phase 6. **Do not propose a fix.**


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
