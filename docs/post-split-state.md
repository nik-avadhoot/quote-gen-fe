# CFB QOS frontend — post-split state

**Status: the component split is complete.** `QuotationApp.jsx` went from **5,402 lines to 83**
across Phases 0–8 on `refactor/component-split`. This document is the handoff. It assumes you have
read none of the conversation that produced the split.

Companion documents:

| | |
|---|---|
| [`component-split-plan.md`](component-split-plan.md) | The full record — every phase, every decision and its reasoning, the complete defect register with mechanisms, and the design positions. **Authoritative.** This file is the summary. |
| [`../CLAUDE.md`](../CLAUDE.md) | Repo conventions and business-logic guardrails. **It now lives at `quote-gen-fe/CLAUDE.md`** — it previously sat in the shared parent directory, outside both git repos, so every edit to it was unversioned. Moved in and tracked at the end of Phase 8. |
| `../../quote-gen-be/docs/CFB_QOS_Project_Brief_v3.md` | Business logic, formulas, tab-by-tab behaviour spec. Authoritative for anything not about code structure. |

> ### ⚠️ OPEN ITEM — for whoever works on `quote-gen-be` next
>
> Moving `CLAUDE.md` into `quote-gen-fe/` left **`quote-gen-be` and the shared parent directory with
> no `CLAUDE.md` at all.** Working in the backend, no conventions file loads — including the
> guardrail that `server.py` mirrors the costing formulas in `engine/costing.js` and that the two
> must not drift.
>
> **This is not resolved and was not decided here.** `quote-gen-be` is a separate repository; adding
> a file to it was out of scope for the split. The likely shape is a short `quote-gen-be/CLAUDE.md`
> carrying the backend-specific sections plus a pointer to this one, but that is a call for whoever
> picks up the backend, not a default to apply silently.

---

## 1. Running it, and the three gates

```bash
npm run dev
```

```bash
npm run test:costing
```

```bash
npm run ref:case4
```

`npm run build` and `npm run lint` are the other two. The backend is expected at `localhost:3001`.

**Last run on `main` at `0def418`, 2026-08-25 — all three green:**

| Gate | Command | Result |
|---|---|---|
| Build | `npm run build` | pass — 406 ms, `index.js` 1,401.96 kB (gzip 513.11 kB) |
| Costing | `npm run test:costing` | pass — 5/5 fixtures |
| Lint | `npx eslint src` | **76 errors, 0 warnings** — equals the Phase 0 baseline |

The lint gate is a *ceiling*, not a target: 76/0 is the pre-refactor count and may only go down.
`npm run lint` (`eslint .`) and the baseline's `npx eslint src` both report 76/0 post-split, so
either is a valid gate — they agreed when checked on `0def418`, but the baseline file names
`npx eslint src` and that is the one to quote.

`python scripts/audit-doc-sections.py` is the fourth check, for documents rather than code — see
§6 rule 2. It exits 0 as of `0def418` (3 retitled, 2 moved, 1 reviewed-and-accepted, no silent
deletions). Its own file header records what it catches and the commit that motivated it.

### What `test:costing` does NOT cover — read this before trusting a green run

It exercises **`engine/costing.js` only**, against pinned `DEFAULT_*` masters, via
`scripts/costing-fixtures.mjs` compared to `scripts/costing-golden.json`.

**It cannot see any of the four bridge/UI guards:**

1. new-batch context with a non-empty batch must **block**
2. client/sector mismatch against the Batch Profile must **warn** — ⚠️ **but see D-24: this guard
   only fires when `batchRows.length > 0`.** Verifying it with rows present never exercises the
   empty-grid-populated-profile path, where it does not fire at all. 7a and 7b both passed it
   this way
3. an unconfirmed SET Code must **block** auto-dims, Calculate All and Send-to-Quote-Items
4. a Part row with `wastePP` explicitly `0` must **keep 0**, not fall back to the sector default

Guards 1–3 live in `state/useCostingBatchBridge.js` and are reachable only through the UI.
Guard 4 depends on `resolveSpecWasteConv`, which is declared **inside** `useCostingResult`
(`useCostingResult.js:84`) and closes over hook state, so it is not importable from Node.

> **A green harness on a broken gate is the exact failure this warning exists to prevent.**
> Every one of these four is a **manual** check.

> ### 🛑 IT ALSO DOES NOT COVER THE BATCH CALCULATION PATH — added at Stage 4
>
> The fixtures call `engine/costing.js` **directly**, against pinned `DEFAULT_*` masters. They never
> run `calcBatchRow`, never run `buildSpecFromRow` against a real `batchProfile`, and therefore never
> exercise the `??` chains that assemble a spec on the batch path.
>
> **A green `test:costing` is NOT coverage of a calculation change that reaches the engine through
> Batch Entry.** This was found by **D-25**: blanking the initial waste/conv values would send `""`
> into `calcCosting`, whose destructuring defaults fire only on `undefined`, producing **NaN
> silently** — and every fixture would still pass.

`ref:case4` derives Case 4's expected numbers instead of transcribing them. It optionally takes a
Backup file so it computes against real masters rather than `DEFAULT_*`:

```bash
npm run ref:case4 -- ../CFB_QOS_Backup_20260824.json
```

**Never write its output into a document.** The literal it replaced went stale precisely because it
was written down: the harness is masters-independent (pinned `DEFAULT_*`), the running app is
masters-dependent (`useMastersState.js:16` reads `localStorage['cbb_rates']`). The two agree until
someone edits Rate Master — see **D-8**. The old literal was never an independently captured UI
number; it was the engine golden wearing a UI label, and nothing said so.

---

## 2. Final architecture

```
src/
  QuotationApp.jsx           72   shell: provider + chrome + tab switch. NOTHING else
  App.jsx                         AuthProvider > Gate > QuotationApp
  main.jsx  theme.js  index.css  AuthContext.jsx  LoginScreen.jsx
  AccountMenu.jsx  ProfileModal.jsx  ChangePasswordModal.jsx

  state/                          THE STORE — see composition order below
    AppStateContext.js       17   context + useAppState()  (separate file on purpose:
                                  keeps react-refresh/only-export-components quiet)
    AppStateProvider.jsx     41   composition — ORDER IS LOAD-BEARING
    useUiState.js            39
    useMastersState.js      102
    useCostingState.js       51
    useQuoteItemsState.js    38
    useBatchState.js        174
    useCostingResult.js     111   memoised derived costing
    useBatchInvalidation.js  47   two staleness effects
    useCostingBatchBridge.js 656  the guards live here
    useQuoteActions.js      417

  tabs/
    costing/  CostingTab 19 · SpecForm 676 · OutputPanel 340
    batch/    BatchEntryTab 22 · BatchProfileBar 253 · ConstructionOverlay 205 · BatchGrid 712
    ConstructionLibTab 480 · QuoteItemsTab 246 · DefaultsTab 243
    RateMasterTab 209 · FreightTab 83 · UserManagementTab 220

  ui/         Sidebar 60 (owns NAV_ITEMS) · TopBar 38 · ToastStack 37 · primitives 54 · styles 11
  components/ BoxDieline 189
  engine/     costing 219 (NEVER EDIT) · rowType 33
  export/     excel 357 · pdf 121 · importExcel 53 · toB64 7
  lib/        apiClient 122 · persist 49 · constructionName 41
  data/       defaults.js (NEVER EDIT)
  assets/     logos.js

scripts/  costing-fixtures.mjs · costing-golden.json · case4-reference.mjs · eslint-baseline.txt
```

### The store

One provider, one `useAppState()`. **Components take no props for shared state** — every component
calls `useAppState()` directly. Do not reintroduce prop-drilling.

| Slice | Owns |
|---|---|
| `useUiState` | `tab`, `sidebarCollapsed`, `toasts` / `showToast`, modal flags, and `role` — re-exported from `useAuth()` so consumers need one import, not two |
| `useMastersState` | `rates`, `freight`, `locations`, `sectors`, `boxTrim`, `partitionsMaster`, `constructionLib`, rate-master knobs |
| `useCostingState` | `spec`, `s()`, `setAutoFill`, `costingContext`, `specCommitted`, `activeBatchRowId`, `aiNotes` |
| `useQuoteItemsState` | `items`, `savedQuotes`, quote ref and dates, template |
| `useBatchState` | `batchProfile`, `batchRows` (**hydrated on mount since D-5**), `batchResults`, `expandedRows`, `pinnedAddOns`, `autoCode*`, overlay state, autosave, `batchAgeLabel` |
| `useCostingResult` | the derived costing block, memoised |
| `useBatchInvalidation` | two staleness effects — returns nothing |
| `useCostingBatchBridge` | **the Costing↔Batch bridge** |
| `useQuoteActions` | remaining cross-slice handlers, including backup/restore and code generation |

### Composition order — why it is load-bearing

`AppStateProvider.jsx` builds a plain accumulator `st`, and each hook **destructures it on entry**,
so a slice structurally cannot see anything composed below it. The order is not stylistic:

```
useUiState()              FIRST — showToast is used by every slice below
useMastersState()         no deps
useCostingState()         no deps
useQuoteItemsState(st)    needs profile (ui)
useBatchState(st)         needs sectorCodes + constructionLib (masters). NO ui dep since D-5
useCostingResult(st)      needs spec (costing), masters, batchRows/batchProfile (batch)
useBatchInvalidation(st)  AFTER masters AND batch: reads both, calls invalidateAllBatchResults
useCostingBatchBridge(st) AFTER useCostingResult: consumes resolveSpecWasteConv
useQuoteActions(st)       LAST: reads derived r/missing and restoreRef
```

**Reordering these silently breaks cross-slice handlers rather than throwing.** Read that file's
header before touching it.

Three specific traps, each already paid for once:

- **`useBatchInvalidation.js` carries two `eslint-disable` directives that are load-bearing.**
  `invalidateAllBatchResults` is deliberately **not** in either dependency array: it is recreated
  every render (`()=>setBatchResults({})`), so including it fires the effect on *every* render and
  wipes every cached batch result. The plan called these directives dead; removing them proved they
  were not. They are commented in place — leave them.
- **`useCostingBatchBridge.js` holds the guards as one module on purpose.** `sendCostingToBatch`
  alone reads `costingContext`, `batchRows`, `spec`, `batchProfile` and `specCommitted`. Splitting
  it across slices is exactly how the two-context gate, the G1 identity-first guards and SET Code
  confirmation get broken without a test failing.
- **`useCostingResult` memo deps are precise for a reason.** It depends on `batchRowCount`, not
  `batchRows` (depending on the array busts the memo on every grid keystroke), and on four
  `batchProfile` fields destructured individually, not the object. `resolveSpecWasteConv` sits
  **outside** the `useMemo` deliberately.

### The persistence seam

All `localStorage` access goes through `lib/persist.js` (`getItem` / `setItem` / `removeItem`).
37 call sites. `lib/apiClient.js` is deliberately excluded — it owns the auth session (`qgos_session`),
which is a different lifecycle.

This matters for what comes next: CustomerFamilyMaster, CustomerMaster and SKUMaster are shared
reference data across Makers and Checkers, not per-browser scratch, so they almost certainly belong
in Supabase. One seam to change instead of thirty-seven.

---

## 3. Defect register — D-1 to D-25

Full mechanisms, evidence and reasoning are in [`component-split-plan.md`](component-split-plan.md).
**None is a refactor regression; all predate Phase 0** except the observations, which were found
*during* verification but are not caused by it.

> 🔷 **Before fixing D-23 or D-24, read the `batchRows.length` pattern** in the register
> introduction of [`component-split-plan.md`](component-split-plan.md). Those two and the
> two-context hard gate are **three instances of one reasoning error** — row count used as a proxy
> for spec state, profile identity and batch existence respectively. Fixing them separately fixes
> symptoms and leaves the pattern.

> **D-10 does not exist.** The number was skipped, not lost. D-1 to D-9 and D-11 to D-25 are the
> whole register.
>
> **D-19 was added at the defect pass**, promoted out of the §4 cleanup list rather than newly
> found. It took the next free number for the same reason D-10 stays empty: reusing a skipped
> number corrupts every prior reference.

> **D-6 and D-7 were silently deleted from the plan by commit `b7cc2a4`** — an anchor-replace in
> that commit consumed them. Both were **restored verbatim from `b7cc2a4^`** at the end of Phase 8.
> Nothing was rewritten.
>
> **The whole document was then audited across all 29 commits that touched it** — every heading at
> every revision, compared against the next, with each apparent loss checked by testing whether its
> *body text* survived (a rename is indistinguishable from a deletion at heading level). **D-6 and
> D-7 are the only genuine loss in the document's history.** Five other headings changed and all
> five were deliberate rewrites that added content: `da5ac3c` replaced two sections with three when
> correcting a capability claim that had turned out to be false, `b7cc2a4` reframed D-2 into a
> substantially fuller entry, and `72583b2` retitled D-13.
>
> The mechanism is confirmed by position rather than inferred: at `b7cc2a4^` the register ran
> **D-2 → D-7 → D-6 → D-4**, and the D-2 rewrite replaced from D-2's heading through to D-4's,
> consuming the two entries in between. **An anchor-replace whose end anchor is the *next* heading
> silently eats everything between.** Anchor on the section being replaced, never on what follows it.

### Beta blockers

| # | Defect | Why it blocks |
|---|---|---|
| ~~**D-5**~~ | **FIXED** — Stage 2. `batchRows` hydrates on mount, so state and storage agree from the first render; the write guard is deleted and the banner with it. Autosave silently overwrites a larger batch | Destroys committed work with no undo. It destroyed a test fixture during this project. **Refined at Stage 2:** the effect fires on every intermediate state, so the guard's only effective firing is at mount — it preserves whatever the second-to-last state was, not a larger prior save. Deleting all rows leaves a 1-row residue. |
| **D-8** | Unguarded master-data edits — a *category*, not one bug | Admin edits to shared reference data are direct writes with no confirmation, no validation, no undo. Corrupts every quote computed afterwards, silently. |
| **D-11** | Construction Library duplicates instead of matching | Four creation paths with four different checks — one, `ConstructionLibTab.jsx:196`, has **none**. **And path 1's STD-tier prompt treats Cancel as "keep my grades", which deliberately creates a duplicate** — so there is an unguarded route *and* a sanctioned one, needing different remedies. Corrupts a master that is already an informal join key. |
| **D-12** | Toast overlay makes a destructive button clickable-by-accident | The toast container is `pointerEvents:"none"` and no toast has an `onClick`, so clicks pass **through** to the Costing `+ New Batch` beneath. **Corrected at Stage 2:** narrower than first recorded — it does *not* reach `startNewBatch`, so the batch and Quote Items are never at risk — but **worse in one case**, since that button confirms only `if(batchRows.length>0)`, so with an empty batch an unsaved Costing spec is discarded with **no dialog at all**. D-2's loss without D-2's dialog. |
| **D-13** | No non-destructive exit from scratchpad context | Both guards that block this state instruct the user to perform D-2, which destroys the work they were protecting. |

> **D-12 is added to the four originally named.** It is the mechanism by which D-5 was actually
> triggered during this project: a click that looked like dismissing a notification landed on a
> destructive button underneath. An accidental-destruction path with no confirmation belongs with
> the other data-loss blockers. If that reasoning does not hold, it drops to High.

### The rest

| # | Defect | Severity | Status |
|---|---|---|---|
| D-1 | Glass SKU Type never reaches the batch grid | High | **FIXED** — `06c1522`, written before the freeze. ⚠️ Its accepted limitation has surfaced as a live UI inconsistency — see **D-22** |
| D-2 | New Batch warns about what IS recoverable and hides what ISN'T | High | Open — interacts with D-13 |
| D-3 | Backup silently discards the two raw-string keys | High | Open |
| D-4 | Identity freeze is lost on reload while the batch survives | High | Open |
| D-6 | Backup filenames cannot distinguish two same-day snapshots | Medium | Open |
| ~~D-7~~ | SET Code case normalisation is asymmetric | High | **FIXED** — Stage 3. One helper `sameSetCode()`, enforced by `scripts/audit-setcode.py`. Extent was 8 sites, not 4 |
| D-9 | Selecting a sector silently converts inheritance into an override | High | Open — same shape as **D-16**; see the inheritance-materialisation pattern |
| ~~D-14~~ | Unconfirmed SET Code does not block Deep Dive | — | **CLOSED — NOT A DEFECT.** The guard exists at `useCostingBatchBridge.js:33`, dates to the repo's first commit, is the sole route, has no bypass, and is stricter than the other three gates |
| ~~D-15~~ | Unconfirmed SET Code blocks only the offending row | — | **CLOSED — CORRECT BY DESIGN.** Ruled per-row |
| D-16 | **Push after Deep Dive severs a row's link to its parent Box** | **High — silent, permanent** | Open — **REWRITTEN at Stage 3.** Trigger is Push, not Unlink; Unlink writes nothing to the row and cannot cause it. `pushCostingToBatchRow` writes back the L/W that Deep Dive *derived* from the parent, so `autoCalcPPDims` returns early forever and the row stops tracking. Invisible: the number is identical when it happens. Same shape as **D-9** |
| D-17 | Add-on pin control is an unlabelled circled-plus | Cosmetic | Open — see cleanup list |
| D-18 | Row-level Interest override missing from xlsx export | High | Open — **RESOLVED at source, and it is a category.** See below |
| D-19 | `exportExcelFull` throws `ReferenceError` on every call | High | Open — **in D-3's scope.** Promoted from the §4 cleanup list; D-3 is not discharged without it |
| D-20 | `+ New Construction` gives no visible feedback — draft appended off-screen | UX | Open — observation, Stage-1 verification |
| D-21 | Defaults/Masters screen cut off at the bottom, no scroll affordance | Layout | Open — observation, Stage-1 verification |
| D-22 | 🍶 badge below Nos/Set renders for some Part rows and not others | Cosmetic | Open — **the first version of this entry was wrong and was retracted.** Not a data defect and not D-8: the badge (`BatchGrid.jsx:340`) is the only one of three Part-row consumers with no parent fallback. Related to **D-1**. Nos/Set auto-fill is **verified correct** |
| D-23 | Costing `+ New Batch` guards on batch state to protect spec state | High | Open — the defect underneath D-12. Confirms on `batchRows.length>0` but destroys `spec`. Same family as D-2; rule on it with D-2 at Stage 2 |
| D-24 | G1 identity guards gate on row count, not on whether the profile holds an identity | High | Open — an empty grid with a populated profile passes every mismatch guard, and the seeding block then **silently rewrites the profile**. Rows carry no client/sector, so nothing records it. Pre-existing, **not** a Stage-1 regression. Rule at Stage 2 with D-5 |
| D-25 | Blank-means-inherit is **unreachable**: nothing starts blank, and the batch path cannot consume a blank if one arrives | High | Open — `INIT_SPEC` and the initial `batchProfile` ship concrete numbers, and `calcCosting`'s destructuring defaults fire only on `undefined`, so `""` yields **NaN silently**. The cause of D-9's symptom. **Real scope: three `??` chains made blank-aware BEFORE any literal is blanked.** `data/defaults.js` **not** approved |

**Context, recorded but not attributed:** the Batch Entry toolbar's `+ Constr` button switches to
the Construction Library tab instead of opening the slide-over overlay. The per-row route into the
overlay opens correctly. Filed against D-16 and D-6.

> ### D-18 is a CATEGORY, not one cell — resolved at source, do not fix interest alone
>
> The two recorded possibilities were *writes a stale value* and *writes nothing*. **Neither.**
> `export/excel.js:251–252` writes `f0.interest` — **`items[0]`'s** value — into `BJ3`/`BJ4`, which
> are *sheet-level* parameter cells that every data row from row 7 computes against.
> `useQuoteActions.js:266` correctly folds each row's `interestOverride` into that item's own spec.
>
> **The app models interest per-row; the template models it per-sheet. Every row after the first is
> costed in the workbook at row 1's rate.** Row 1 is correct, which is why it presents as
> intermittent.
>
> **Three siblings share the shape** — `BM3` from `f0.margin`, `AY3`/`BA3` from `f0.waste` /
> `f0.convRate`, and `AY4`/`BA4` which are **already partially patched**. The `FIX:` comment and
> `_ppSpec` workaround at `excel.js:244–250` exist because someone hit this once for the PP row and
> repaired that instance without generalising. **Fixing interest the same way makes the same mistake
> a third time.**
>
> 🛑 **The ASI landmine is five lines from the fix site.** `const _ppItem=items.find(...) // R-2;`
> at `excel.js:246` has its terminator inside a comment; the interest writes are at `251–252`. See
> §6 rule 1 — no reflow, no Prettier, no `eslint --fix`, anywhere near this.

Sequencing, clusters and the Stage-1 rulings for the defect pass are in
[`defect-pass-plan.md`](defect-pass-plan.md).

### D-13 is a different class from the rest

**D-1 to D-12 are code not matching intent** — each has a correct behaviour someone could write
down, and the code does something else. They are patchable, and the patch is decidable by whoever
writes it.

**D-13 is intent that was never built.** There is no correct behaviour to restore, because the
capability does not exist and never did. It needs a **product decision about what the batch model
is** before any code — should promoting a scratchpad archive the existing batch, require it be sent
to Quote Items first, or hold two batches concurrently?

It will also interact with the three incoming masters: "promote scratchpad to a new batch" is
structurally the **Prospect to Customer transition** — provisional work, held under a temporary
identity, graduating to a permanent one without being re-keyed. A Prospect already carries two codes
for exactly that reason. Solving one and not the other builds the same mechanism twice. **Sequence
D-13 as a design input to the masters work, not as a bug in the queue.**

---

## 4. Post-split cleanup list

Behaviour-neutral tidying that was in reach during the split and left alone on purpose, because
doing it mid-split would have mixed cosmetic churn into commits whose diffs were the only evidence
the moves were clean.

| Item | Why it was deferred |
|---|---|
| `aiNotes` → `statusNote` | Nothing about that banner is AI, so the name is wrong. Skipped because it would touch `tabs/costing/SpecForm.jsx`, whose byte-identity was the only evidence Phase 7a was clean |
| **D-17** — a pin glyph instead of the circled-plus | Cosmetic, but see the note below |
| Two empty section banners in `QuotationApp.jsx` | Emptied by Phases 3 to 6, not by Phase 8 — left rather than churned |
| `bsOk` / `isPP` unused locals in `BatchGrid.jsx` | Pre-existing, inside the byte-identical region; removing them would have broken the identity proof |
| Baseline lint debt: `no-empty` x18, `no-unused-vars` x63, mostly in `state/` and `export/` | Predates the split. **Every file created by the split lints at zero** |
| ~~`exportExcelFull` `no-undef` bugs~~ | **PROMOTED OUT of this list — now D-19 in the register.** `qty` (twice) and `locations` are undefined, so it throws `ReferenceError` on every call. It was never behaviour-neutral tidying: it is a correctness defect on a live fallback path, and D-3 routes users onto that path. Listed here as lint debt is how the D-3 tie stayed invisible |
| `parseImportedExcel` `no-undef` bug | References `boxTrim` at what is now `importExcel.js`; its parameter is named `boxTrimData`. Part of why Re-import is disabled |

> **D-17 understates itself deliberately.** The pin control was not missed by someone new to the
> app — it was missed by its author, who knew the feature existed and was looking for it. That is a
> discoverability failure of a different order from a merely unlabelled control. It is filed as
> cosmetic so it is not confused with a correctness defect, not because the cost is small.

---

## 5. Deliberately NOT done — do not "fix" these

| | Why |
|---|---|
| **`BatchGrid.jsx` stays one ~712-line file** | Frozen-column cumulative `left:` offsets (0, 28, 52, 140, 258, ...) are brittle and positional; splitting the file invites drift |
| **Rows use `<Fragment key={row.id}>`, never `<>`** | Shorthand fragments cannot take a `key`. Two `<>` remain, at `BatchGrid.jsx:378` and `:497` — both inside a `<button>` / `<td>`, neither inside a `.map()`, so neither needs a key. They are correct as they stand |
| **The expanded-row IIFE stays an IIFE** | Converting it buys nothing and risks the sub-row structure |
| **`upd` / `updC` stay per-row inside `.map()`** | They are plain functions, not hooks. They belong there |
| **The toolbar IIFE returns an array and chains `.map()` INSIDE itself** | This is the *correct* pattern. Splitting the call from the `.map()` renders raw objects as children and **crashes React** |
| **`ConstructionOverlay` keeps query/filter in the store** | The plan said make them component-local. That would reset the query when the overlay closes — a behaviour change. If that reset is wanted, it is its own commit with its own verification |
| **No `useCallback` anywhere** | One tab is mounted at a time and there are no `React.memo` boundaries, so it buys nothing |
| **No React Compiler** | Deferred to a possible Phase 9. Revisit only once `npm run lint` is clean of `react-hooks/*` |
| **`resolveSpecWasteConv` not extracted** | Lifting it into an importable pure module would make negative Case 4 machine-checkable permanently, retiring the only manual check that guards a *silent* wrong number. Genuinely worth doing — but it is a semantic-boundary change and was too risky mid-split. Phase 9 candidate |

---

## 6. Standing rules that outlive the split

1. **Never reflow. Never run Prettier or `eslint --fix` over this repo.** `export/excel.js` contains
   an ASI-dependent statement whose terminator sits *inside a comment* —
   `const _ppItem=items.find(...) // R-2;`. A reformat silently breaks it.
2. **When replacing a range, anchor on what is being replaced — NEVER on what follows it.**
   An end anchor placed on the *next* section silently consumes everything between the two anchors.

   This failure has now occurred **three times in this project**, each time from an end-point chosen
   by what was *visible* rather than by what was *structurally there*:

   | | Where | Caught by |
   |---|---|---|
   | Delete range `1099–1111` | would have truncated `mergeAI` mid-object-literal **and** silently taken live `sectorCodes` with it | the build — syntax error |
   | Lift starting at `3402` | lines 3402–3403 were closing `</div>` tags belonging to the block above | the build — unbalanced JSX |
   | Anchor on the next heading | consumed defect entries **D-6 and D-7** in `b7cc2a4` | **nothing. Eleven commits later, by hand.** |

   > **The asymmetry is the point.** In code, a bad range boundary usually breaks the build, so the
   > error announces itself immediately. In prose, a bad range boundary is **silent, and stays
   > silent** — the document simply reads as though the section never existed.
   >
   > **Therefore documents need MORE care than code, not less.** The intuition that prose is the
   > low-risk place to be casual with boundaries is exactly backwards: it is the only place where
   > nothing is checking.

   `python scripts/audit-doc-sections.py` exists for precisely this and currently exits 0.
   Run it after any structural edit to a tracked document.

3. **`engine/costing.js`, `data/defaults.js` and `quote-gen-be/server.py` are off-limits** without a
   deliberate decision. The costing formulas are mirrored between `costing.js` and `server.py` and
   must not drift. If `test:costing` fails, the change is wrong — revert it.
4. **Capability is demonstrated, not described.** Before either party plans around something
   working, one of us shows it working. Claims about tooling that turn out to be false cost more
   than the work they were meant to save.
5. **One concern per commit.** Structural moves and behaviour changes never share a commit. If a
   guard breaks, it must be unambiguous which change did it.
6. **Nothing commits with verification outstanding**, and **UI verification is permanently the
   user's.** No amount of automated green discharges a manual guard.

   > ### 🔒 A STRUCTURAL FACT, not a rule — state it as one
   >
   > **The implementer cannot reach any authenticated screen of this app.** Login is required, and
   > entering credentials is prohibited. There is no version of this project in which UI
   > verification becomes the implementer's, and **nobody should plan around that changing.**
   > It is a property of the setup, not a policy that could be relaxed.

   > ### The ONE granted exception, and its three conditions
   >
   > `73a0948` (D-5's age label, Stage 2) is the **first and so far only** fix committed without the
   > user running it. Granted deliberately, recorded so it is traceable, and **not a precedent to
   > widen.**
   >
   > **Why it was granted:** display-only with no behaviour attached; the one real risk
   > (`Date.now()` during render) had already been caught by `react-hooks/purity` and fixed; and the
   > worst case is a wrong or missing date label — visible and harmless.
   >
   > **It applies only where ALL THREE hold:**
   >
   > 1. the change is **display-only, with no behaviour attached to it**
   > 2. the logic is **separately verifiable outside the browser** (it was: extracted verbatim and
   >    run in Node, 9/9, both sides of the threshold)
   > 3. the unverified part **fails visibly rather than silently**
   >
   > **Anything failing any one of the three still needs the user's run.** The scope must also be
   > stated honestly in the commit — *what* was verified and *what* was not — as `73a0948` does.
   > **"You verified it last time" is not a reason.** The exception is about the class of change,
   > never about accumulated trust.
7. **Derive assertions programmatically from source — never type them.** Two concrete bans: no
   hand-written string assertions, and no positional element selection (`input[N]`) where a named or
   labelled selector exists.
8. **An unproposed design decision inside an approved diff is a DEVIATION — even when it is
   defensible.** "Propose before writing" is not discharged by proposing the *shape* of a change
   and then deciding its conditions during implementation. A condition that changes when the code
   fires is part of the design, not an implementation detail.

   > Caught live at Stage 2. The DP-2 file-restore confirmation was proposed as *"compare with
   > current `batchRows.length` and confirm naming both counts before writing anything."* What was
   > written gated the whole confirmation on `_currentRows>0` — a reasonable call, never put to the
   > product owner, and discovered only when the check appeared to fail. The reasoning was also
   > wrong: dialog fatigue is a hazard of *routine* actions, and the exempted case was the one where
   > the user does not yet know the grid is empty.
   >
   > **The standard is the one already applied to the `window.alert` switch in the same commit** —
   > that deviation was flagged at the time and accepted. The difference between the two was not
   > defensibility. It was disclosure.

9. **Defects during structural work: record, do not fix, do not investigate.** One line — what was
   observed, and where. A defect report during a refactor is a bookmark, not a ticket. *(This rule
   existed for the split; the defect pass is where it lifts.)*

---

## 7. Provenance

Branch `refactor/component-split`, one commit per phase, each independently revertable.

| | |
|---|---|
| Baseline | `1ee0e28` |
| Phase 0 harness | `3d87de8` — deliberately on `main`, so it survives a revert of the branch |
| Phases 1–6 | `77e73a2` · `ceff59c` · `76626a6` · `c7d7b83` · `a6af2e4` · `27e4a10` · `5c96cc6` · `12aa5b0` · `5755273` · `60d3c48` · `dacedb4` |
| Phase 7 | `5c72d1c` prerequisite · `4082d8d` 7a · `a6e326c` 7b |
| Phase 8 | `724da4e` |
| Post-split docs | `ffaded3` · `32f28ed` · `019cd34` · `5313f15` |
| **Merge to `main`** | **`0def418`** — "Merge refactor/component-split", ort strategy |

**Line-count trajectory of `QuotationApp.jsx`:**

5,402 → 5,396 → 5,374 → 4,649 → 3,375 → 3,296 → 3,115 → 2,906 → 2,487 → 2,279 → 2,234 → 1,266 → **83**

Every extraction from Phase 7 onward was verified **byte-identical**: the moved JSX reconstructs
exactly from the previous commit after a uniform dedent. Free variables were derived by ESLint scope
analysis and confirmed reachable from the store before any file was written — not read off by eye.

---

## 8. Repository and deployment state

### Where the code is

| | |
|---|---|
| `quote-gen-fe` local `main` | `0def418` — the merge; the split is here |
| `quote-gen-fe` `origin/main` | `aee1121` — **current, and holds the split.** Local `main` is in sync; two doc-only commits (`dfa57f4`, `aee1121`) sit above the merge. Was `1ee0e28` (pre-split) until this document was pushed |
| `refactor/component-split` | **local only.** `git ls-remote --heads origin` listed only `refs/heads/main`; the branch was never pushed. It is kept locally because every phase is independently revertable. |
| `quote-gen-be` `origin/main` | `cf61f0e` auth, then `b93dee7` login-config fix |

**This gap is now closed.** The 46 commits from `3d87de8` (Phase 0 harness) through `0def418`
(merge) sat unpushed on local `main` for two days while `origin/main` still pointed at the pre-split
baseline. They have since been pushed, along with the two doc commits above the merge, and
`origin/main` now holds all of it.

**Keep the habit regardless: if a clone looks like it has no component split in it, check
`origin/main` before concluding the work is missing.** The condition that made that advice necessary
has gone, but the failure it prevents — reading an out-of-date remote as evidence that work was
never done — costs a session every time it recurs.

### The Vercel environment-variable requirement

`quote-gen-be/.env` is gitignored — deliberately, it holds the Supabase keys — which means **it
never reaches Vercel**. The deployed backend gets its configuration only from environment variables
set in the Vercel project itself. Three are required:

| Var | Scope |
|---|---|
| `SUPABASE_URL` | all environments |
| `SUPABASE_PUBLISHABLE_KEY` | all environments — RLS enforced |
| `SUPABASE_SECRET_KEY` | **Production only** — service role, bypasses RLS, never exposed to the frontend |

Setting them requires a redeploy; Vercel does not apply new variables to existing deployments.

### Confirming it worked

```bash
curl -s https://quote-gen-be.vercel.app/health
```

Want `"supabase": true`. This is a live check, not a static flag — `/health` calls `get_supabase()`
inside a try/except, so it reports true only if the client actually constructed from real
environment variables.

**It does not validate the secret key.** `/health` builds only the publishable-key client. To
confirm `SUPABASE_SECRET_KEY` landed, complete a login: that path calls `_fetch_profile_or_none()`,
which uses the admin client.

### `supabase: false` means configuration, not credentials

This cost real time and is the reason `b93dee7` exists.

`/auth/login` called `get_supabase()` *inside* the same `try` that wrapped
`sign_in_with_password`. Missing environment variables raise `RuntimeError`; the bare
`except Exception` caught it alongside a genuine auth failure and returned
**"Invalid email or password"**. A deployment fault was reported as a credentials fault, which sent
the investigation to the user record — *was the account created, is the password right* — when the
account was fine all along: confirmed, active, `role: admin`, with a successful `last_sign_in_at`
already on it.

`b93dee7` hoists the client construction above the credential check; a config fault now returns
**500 "Auth backend is not configured"** and logs the cause.

> **The generalisation.** The missing variables were the trigger; the swallowed `RuntimeError` was
> the defect. A `try` block that spans both "can I reach the service" and "are these credentials
> valid" collapses two failures with completely different remedies into one message. Keep
> reachability and validity in separate `try` blocks wherever this pattern recurs.

When a login fails, **check `/health` before touching the user record.**
