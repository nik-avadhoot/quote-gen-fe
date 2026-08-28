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
| Defects | 🛑 **RECORD, DON'T FIX, AND DON'T INVESTIGATE — until Phase 8 lands.** A new defect gets **ONE LINE** in the register: **what was observed, and where.** No hypothesis, no reproduction attempt, no bisect, no root-cause analysis, no proposed mechanism, no fix, no proposal, no fix window. **Do not ask whether to fix or investigate; the answer is no.** Only exception: something that blocks *the split itself* — say so once and stop |
| Reported guard failures | **Record as an observation and CARRY ON.** A report that looks like a guard failure is not a stop condition. **Stop only when a guard demonstrably fails in a way that implicates the commit in front of us** — demonstrably, in the current tree, not by inference. Everything else is an observation line and the work continues |
| Capability | **Demonstrated, not described.** Before either party plans around something working, one of us produces it. Covers tool capabilities and covers reporting a check as run |
| Assertions | **DERIVE them programmatically from the source — never type them.** Two concrete bans: **(a) no hand-written string assertions**, and **(b) no positional element selection (`input[N]`, `slice(0,3)`) where a named or labelled selector exists.** See *Why the earlier wording failed* below |
| Range edits | **Anchor on what is being REPLACED, never on what FOLLOWS it.** An end anchor placed on the next section silently consumes everything between the two anchors. Three instances in this project - delete range `1099-1111`, lift boundary `3402`, and the anchor that ate D-6/D-7 in `b7cc2a4`. **In code a bad boundary usually breaks the build; in prose it is silent forever - so documents need MORE care than code, not less.** Guarded by `python scripts/audit-doc-sections.py` |
| Asking | **Ask, then WAIT.** If a question is worth asking before acting, it is worth not acting until it is answered. Raising a concern and proceeding anyway is not asking — it is narrating |

> ### Why the defect rule tightened — D-13 is the worked example
>
> D-13 cost **four exchanges**: hypothesis, static bisect, reproduction attempt, decisive live test.
> The finding that survived all four was **one line** — *there is no non-destructive exit from
> scratchpad context.* Everything else was scaffolding thrown away on arrival.
>
> The investigation was not wrong, it was **mistimed**. Done now it is against code that three
> phases are still moving; the same work post-split is done once, in final code, with every defect
> in view at the same time. **Investigating during the split pays for the analysis twice and gets
> the worse copy.**
>
> **The rule binds both sides.** The implementer does not investigate unprompted, and analysis is
> not requested mid-split. A defect report during the split is a *bookmark*, not a *ticket*.

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

#### Why the earlier wording failed — assertions must be derived, not intended

The first version of this rule read *"read them from the source, never write them from expectation."*
It was broken **within two commits of being written**, which is the useful datum: *"read it from
source"* is an **intention**, and intentions do not survive being three calls deep in an
investigation.

Four false alarms this refactor, none of which was a code fault:

| # | Assertion | Reality |
|---|---|---|
| 1 | A **label** edit propagates to the batch grid | `constrAutoName` is spec-derived and never reads `c.name` |
| 2 | PDF contains `"Payment: 60 days"` | It reads `"Payment terms: 60 days from date of invoice"` |
| 3 | Page contains `"DIE-LINE PREVIEW"` | Source says `Die-Line Preview` (mixed case) |
| 4 | `input[type=number]` indices 0–2 are L/W/H | They are **NOS/SET, L, W** — H left empty, so the block's own guard correctly suppressed it |

**#4 is the one the string rule would not have caught.** Positional element selection is a separate
failure mode and needs its own ban.

**The replacement is mechanical, not attentional:** extract the expected string from the source file
in the same command that asserts it, and select elements by label, placeholder or accessible name —
never by index — whenever such a selector exists.

> **What did NOT go wrong, recorded deliberately.** All four cost time; **none produced a wrong
> conclusion**. Each was chased to ground and correctly attributed to the check rather than filed as
> a code fault. The behaviour being trained out is **wasted effort, not bad reporting** — the
> reporting worked.

#### 🛑 D-5 operational mitigation — ALWAYS Restore, NEVER Dismiss

For the remainder of the split, on the *"Unsaved batch work found … Restore it?"* banner:
**always click Restore. Never click Dismiss.** If the banner is in the way, click Restore and carry on.

`Dismiss` leaves `batchRows` empty in state while the rows remain in storage, and the next write
persists that state over the larger saved batch (D-5). Phases 6 and 7 involve constant reloading, so
the banner will appear often; the destructive button sits directly beside the safe one, and this was
nearly hit twice during Phase 5 verification — once successfully, destroying a 6-row batch.

Restoring always is a **complete mitigation for the duration, with no code change.**

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
| `npm run build` | The Case 4 number check - run `npm run ref:case4`, never a literal |
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
| 1 | *(user)* run the four negative cases | Case 4 target: **`npm run ref:case4`** (SUPERSEDED literal: ₹2.10 / MOQ 82,200 - reproduces, but retired as a form; see the Case 4 section) |
| 2 | ✅ **Phase 4, UNCHANGED** | committed `c7d7b83` at the exact reviewed bytes |
| 3 | ✅ **4c persist wrapper** | 37 sites wrapped, lint-neutral; carried this document into the repo and the held-back `useCostingState` comment |
| 4 | ✅ **D-1 Glass SKU Type** | forward leg written; user verifies on a restored surface |
| 4b | 🚨 **D-5 autosave overwrite** | **BETA BLOCKER — jumps the queue.** Propose before writing |
| 4c | **buildSpecFromRow return leg** | own commit |
| 4d | **KEYS registry + D-3 + D-6 + two cosmetics** | own commit, proposal first |
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
3. ~~Click **⬇ Backup**; keep the JSON as a data fixture.~~ **NEVER CAPTURED.**
4. ~~Export one Excel (backend up) and one PDF; keep both for byte comparison.~~ **NEVER CAPTURED.**

> 🛑 **Phase 0 produced TWO artifacts, not four. Do not cite four.**
>
> | # | Artifact | Status |
> |---|---|---|
> | 1 | `scripts/costing-fixtures.mjs` + `costing-golden.json` | ✅ real — has gated every phase |
> | 2 | `scripts/eslint-baseline.txt` | ✅ real — diffed at every gate |
> | 3 | Backup JSON data fixture | ❌ never captured |
> | 4 | Excel + PDF reference exports | ❌ never captured |
>
> No `CFB_QOS_Backup_20260823.json` exists on disk. This did not cost anything, because the golden
> numbers come from the Node harness rather than any backup, and that check has carried every phase
> — including reproducing all five goldens through the UI on real data.
>
> This is the **second** Phase 0 artifact softer than assumed. The first was that a Phase 0 backup
> would have been **partial anyway**, since D-3 silently drops `cbb_template` and `cbb_rate_date`.
> The lesson is the one already in the decisions table: **capability is demonstrated, not
> described** — an artifact nobody has opened is not an artifact.

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
> 🛑 **The trace shows only ONE of the two bugs.** `qty` at `:107` throws inside the item-row map,
> so `locations` at `:129` never executes. Anyone fixing from this trace alone will fix `qty`,
> re-run, and immediately hit the second one.
>
> **And the second one carries a trap:** line 129 reads `(locations||LOCATIONS)`, which *looks*
> defensive and is not. `locations` is an undeclared identifier, so evaluating it throws a
> `ReferenceError` **before** `||` is ever applied. A short-circuit only guards a declared variable
> holding a falsy value. Read casually this line will scan as already-handled — it is not.
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
4. **Re-run negative Case 4 end-to-end** - derive the target with `npm run ref:case4`; do not
   transcribe it. (SUPERSEDED literal: ₹2.10 / MOQ 82,200 - reproduces, but retired as a form; see the Case 4 section).

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

> ✅ **The `SubHdr` hoist eliminated `react-hooks/static-components` outright, 2 → 0.**
> First rule this refactor removed **by intent** rather than as a side effect of code motion — every
> other lint improvement has been incidental to moving code out of `QuotationApp.jsx`.

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
- ~~Consider renaming `aiNotes` → `statusNote`~~ — **SKIPPED, deliberately. Deferred to the
  post-split cleanup pass.** It is behaviour-neutral and structurally worthless, and it would touch
  `tabs/costing/SpecForm.jsx`, which Phase 7a had just extracted. Renaming a field inside a
  freshly-moved file trades a real risk (a missed call site in a file whose byte-identity is the
  only evidence the extraction was clean) for a cosmetic gain. The name is still wrong — nothing
  about that banner is AI — so it stays on the post-split list, not in Phase 8.
- **Update `CLAUDE.md`** — two statements become actively misleading and will make the next session
  fight this architecture:
  - *"all React state (`useState` only, no Redux/Context)"* — already false (`AuthProvider`), now
    emphatically so.
  - *"This is intentional per the project brief … don't propose breaking it apart unprompted"*
- Drive `npm run lint` to zero for the **new** files at minimum.

---

### Post-split cleanup list — deferred, deliberately

Behaviour-neutral tidying that was in reach during the split and was **left alone on purpose**,
because doing it mid-split would have mixed cosmetic churn into commits whose diffs were the only
evidence the moves were clean.

| Item | Why deferred |
|---|---|
| `aiNotes` → `statusNote` | Would touch freshly-extracted `SpecForm.jsx`; the name is wrong but the risk/benefit is upside-down mid-split |
| Two empty section banners in `QuotationApp.jsx` (`Export modules`, `Presentation`) | Emptied by Phases 3–6, not by Phase 8 — left rather than churned |
| `bsOk` / `isPP` unused locals in `BatchGrid.jsx` | Pre-existing, inside the byte-identical region; removing them would have broken the identity proof |
| `no-empty` × 18, `no-unused-vars` × 63 across `state/` and `export/` | Baseline lint debt, not introduced by the split. New files are at zero |

## Post-split roadmap — what this architecture must accommodate

> ### 🔷 A CONSTRUCTION IS A PHYSICAL SPEC, AND IS CLIENT-AGNOSTIC BY DESIGN
>
> **Stated for the first time at Stage 3, while ruling D-11's identity question. It is a constraint
> on the masters work, not a detail of that defect — which is why it is here and not only there.**
>
> A construction is defined by its **physical spec**: board specs, ply, flutes, box type, layers.
> **Sector and client are metadata attached to it, never part of its identity.**
>
> **Clients attach to constructions; constructions do not belong to clients.** Multiple clients can
> share one construction, and eventually multiple sectors can too.
>
> **Therefore the eventual model must support MANY clients and MANY sectors per construction — not
> one each.** A schema with `client` as a column on the construction row, or a unique key including
> it, fragments a single physical construction across clients. That is **the exact duplication D-11
> exists to prevent, only sanctioned by the schema** — and it would be far harder to unpick than the
> current unguarded creation path, because the data would be correct by its own rules.

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


## Negative Case 4 — the reference pair is DERIVED, never transcribed

`npm run ref:case4` prints the pair. **Do not copy its output into this document.** The literal it
replaced is the reason this section exists.

```bash
npm run ref:case4                                  # against DEFAULT_* (engine baseline)
npm run ref:case4 -- ../CFB_QOS_Backup_XXXX.json   # against a backup's masters (UI baseline)
```

### Why a literal was the wrong shape for this number

| | `scripts/costing-fixtures.mjs` | the running app |
|---|---|---|
| masters | pinned `DEFAULT_RATES` / `DEFAULT_FREIGHT` / `DEFAULT_BOX_TRIM_DATA` | `useMastersState.js:16` reads `localStorage['cbb_rates']`, falling back to `DEFAULT_RATES` only when absent or unparseable |
| | **masters-INDEPENDENT** | **masters-DEPENDENT** |

The two are computed from different data the moment anyone edits Rate Master, Freight or Defaults —
which **D-8** records as an unguarded direct write with no confirmation, validation or undo. Before
any such edit they agree exactly.

> **That agreement is what made the old literal look trustworthy.** It was never an independently
> captured UI number. It was the engine golden wearing a UI label — and nothing in the document said
> so, so nothing flagged it when the two sources could have diverged.

### Status of the superseded pair — it reproduces

The pair flagged void (**₹2.10 / MOQ 82,200**) is **superseded in form, not falsified in value.**
Re-derived against three independent master sources — `DEFAULT_*`, `CFB_QOS_Backup_20260824.json`,
and `CFB_QOS_Backup_20260824_fixture.json` — **all three produce the identical pair.** The masters
had not in fact drifted.

**It is retired anyway, and the reason is the form rather than the digits:** a transcribed literal at
a gate cannot tell you whether it still reproduces. This one happened to; the next one will not, and
will fail a correct build or pass a wrong one without announcing which. Superseded, not deleted —
per the standing rule, and because its reproduction is itself the evidence above.

**The harness goldens remain separate and remain valid.** `scripts/costing-golden.json` is pinned to
`DEFAULT_*` by design and must stay that way — that is what makes it a stable regression gate rather
than a mirror of whatever is currently in the browser. The two numbers coinciding today is a fact
about the current masters, **not** a licence to treat either as a substitute for the other.

### What this does and does not discharge

`ref:case4` pins both `wastePP` arms **at the spec level**, so it never reads a sector's `wastePP`.
It therefore cannot be perturbed by sector master data — and reveals nothing about it.

> ⚠️ **It derives the TARGET. It does not run the CHECK.** Like the fixture harness, it calls
> `calcCosting` directly, which receives a spec whose blanks are already resolved.
> `resolveSpecWasteConv` is still declared **inside** `useCostingResult` (`useCostingResult.js:84`),
> closing over hook state, so it remains unimportable and the blank-vs-zero resolution remains
> untestable from Node. **Negative Case 4 is still a mandatory manual check.** The Phase 9 candidate
> that would retire it is unchanged and still deferred.

Guard against a vacuous run is built in: if the two arms ever produce the same rate, the script
exits non-zero and says so rather than printing a pair that proves nothing.

---

## Defect register — pre-existing bugs found during Phase 4 testing

None of these is a refactor regression; all predate Phase 0. **All are FROZEN until Phase 8 lands** —
see the *Defects* row in the decisions table. Fix windows recorded below are historical intent, not
scheduling; nothing here is actioned before the split completes.

Deferring is cheaper as well as faster: Phases 6 and 7 relocate most of this code. D-2's handler
lifts into the bridge, the Glass SKU consumer sites move into `BatchGrid.jsx`. Fixing now means every
fix travels through those moves and has to survive them; fixing after means fixing once, in the final
location, against stable line numbers.

D-1 is the exception and stays as committed — written and verified before the freeze.

> **Why the freeze exists:** D-7 was found while verifying D-1's fix. Fixing produces verification,
> verification produces discovery, and there is no natural end to that loop — the app carries months
> of accumulated defects and this refactor has just built the first surface capable of finding them.

> **Two classes live in this register.** D-1 … D-12 are *code not matching intent* — patchable,
> and the correct behaviour is writable down. **D-13 is *intent that was never built*** and is
> marked as such; it needs a product decision before any code and is sequenced as a design input to
> the masters work, not as a bug in the queue. Do not let it be triaged alongside the others.

**Standing rule for every commit from here: one concern per commit.** Structural moves and
behaviour changes never share a commit. If a guard breaks, it must be unambiguous which change did it.

> ## 📏 TWO WAYS THE REGISTER HAS BEEN WRONG — they are NOT the same failure
>
> Four entries have now proved inaccurate under implementation. Conflating them into one warning
> loses the useful part: **they have different causes and different remedies.**
>
> ### Mode A — EXTENT UNDERCOUNT. The mechanism was right; the scope was low.
>
> | Defect | Recorded | Actual |
> |---|---|---|
> | **D-5** | a guard that "never lets a smaller batch overwrite a larger one" | fires only at mount; every other path writes straight through it, leaving a 1-row residue |
> | **D-7** | four comparison sites | **eight sites, six files, three conventions** |
> | **D-18** | "all four sheet-level parameters" | **five** — `freightRowOverride` was never named, and it is the **worst** of them |
>
> **Cause: triage stopped at the first instance.** The entry was written from the example that
> prompted it, and the survey was never done.
>
> **D-18 is the fourth instance, and it was the implementer's count, not the register's** — "all four
> sheet-level parameters" was asserted in a proposal without enumerating the row-level override
> fields. Enumerating them took one grep and found five. **The habit is not specific to the original
> triage; it recurs whenever a set is described from memory instead of derived.**
>
> **Remedy: treat a stated site count as a FLOOR and re-derive the set before proposing.** Minutes to
> do; the cost of skipping it has been a doubled scope and a refinement.
>
> > ### ⚠️ "Floor" understates it — the set moves SIDEWAYS, not just up
> >
> > The Stage 4 survey of D-9 + D-16 was expected to find five sites and found four. **One recorded
> > site turned out to be correct** (`bridge:624`'s `spec.waste ?? p.waste ?? 5` — `??` preserves
> > `""`, so blank survives), **and one unrecorded site turned out to be broken** (`bridge:568`, the
> > first-Send seeding block).
> >
> > **So re-deriving is not only about finding more.** It is about finding *which* — a recorded site
> > may not belong, and an unrecorded one may. Counting is not the check; tracing each site is.
>
> ### Mode B — UNTRACED OBSERVATION. The symptom was recorded; the code path never was.
>
> | Defect | Recorded | Actual |
> |---|---|---|
> | **D-22** | a data defect — a stale `skuType` orphaned by a master edit, "D-8's mechanism in the wild" | **the wrong render path entirely.** The badge never consults the master |
> | **D-14** | an unconfirmed SET Code does not block Deep Dive | **the guard exists, predates the observation by the whole history of the repo, is the sole route, and has no bypass** |
>
> **Cause: an observation entered the register without anyone confirming which code produced it.**
>
> **This is NOT carelessness — it is the designed cost of §6 rule 9** (*record, do not fix, do not
> investigate*), tightened at `b52c681` to *one line each, no hypothesis, no mechanism*. That rule
> was correct for a refactor: it stopped verification turning into an endless fix-and-discover loop.
> **What it bought in speed during the split, it deferred to this pass — and two of the four
> observations it produced have now proved wrong.**
>
> **Remedy: confirm the code path from source BEFORE scoping any entry recorded under that rule.**
> D-15, D-16 and D-17 are from the same batch as D-14 and carry the same risk.
>
> > **The two modes need opposite reflexes.** Mode A says *look wider than the entry*. Mode B says
> > *do not trust the entry at all until the code confirms it*. An entry can suffer both.

> ## 🧊 BLANK MEANS INHERIT — AND SEVERAL PATHS QUIETLY FILL THE BLANK
>
> **A DESIGN failure, not a triage one.** Modes A and B above are about how the register has been
> wrong. This is about how the code is wrong, and it predicts where the next defect will be.
>
> ### ⚠️ AND NOTHING EVER STARTS BLANK — see D-25
>
> `INIT_SPEC` ships `waste:5, convRate:7, wastePP:5, convRatePP:12.5`, and so does the initial
> `batchProfile`. **A fresh spec is never in inherit state**, so the model is not merely bypassed at
> four sites — it is **unreachable in normal use**. That is the cause of what D-9 recorded as a
> symptom, and it is why fixing the four write sites alone changes nothing.
>
> **The app has a blank-means-inherit model.** A blank `waste`, `convRate`, `L` or `W` means *"follow
> the authority"* — the sector master, the Batch Profile, or the parent Box. It is resolved **fresh
> on every render**, which is what keeps it live. `useCostingResult` says so in its own comment:
> *"resolved fresh here (not baked into spec) so it stays live if sector changes."*
>
> **And multiple paths write a resolved value back into the blank**, converting inheritance into a
> frozen override — **with no visual signal, because the number is identical at the moment it
> happens:**
>
> | Defect | Path | Blank filled |
> |---|---|---|
> | **D-9** | Selecting a sector in Costing | `waste`, `convRate`, `wastePP`, `convRatePP` — written straight into `spec` |
> | **D-16** | Push to Batch Row after Deep Dive | `L`, `W` — written into the row from values Deep Dive **derived** from the parent Box |
>
> **Both are silent, both are permanent, and both defeat a documented authority model.** D-9 bypasses
> the Batch Profile; D-16 severs the parent-Box link. In each case the app's own override indicator
> stays off, because the written value equals the inherited one at the instant it is written.
>
> ### The two override indicators are DIFFERENT TESTS, not strong and weak versions of one
>
> ```js
> BatchGrid.jsx:438   isOvr  = row.wasteConv_waste !== "" && != null            // BLANKNESS test
> SpecForm.jsx:564    _isOvW = spec[k] !== "" && != null && +spec[k] !== +_effWaste   // VALUE comparison
> ```
>
> `BatchGrid`'s is correct because its field is **blank when inherited**, so *non-blank* MEANS
> override. `SpecForm`'s cannot be: its field is never blank, so it has to guess by comparing against
> the default — **and at the instant of writing, the written value EQUALS the default.** That is
> precisely why the write is silent.
>
> **The value comparison is not a weaker blankness test. It is a different one, and it is unfixable
> as written** — no refinement of the comparison detects a value that is legitimately equal to the
> default. Once the field starts blank, the trivial test works everywhere and `SpecForm:564`'s
> comparison should be **simplified away**, not kept alongside.
>
> **See D-25: making the field start blank is a larger change than it looks.**
>
> ### Where to look for the next one
>
> **Any code that resolves an inherited value and then stores it.** The tell is a read of a derived
> value followed by a write into the field it was derived from. `autoCalcPPDims`, `resolveSpecWasteConv`,
> `buildSpecFromRow` and `specFromProfile` all produce resolved values; **anything that persists their
> output into a field that was blank is a candidate.**
>
> **Fixing D-9 or D-16 alone leaves the model broken.** The question underneath both is whether a
> resolved value may ever be written back — and if so, whether the UI must mark it as no longer
> inherited.

> ## 🔷 A DESIGN-LEVEL PATTERN, NOT THREE BUGS — read this before fixing any one of them
>
> **`batchRows.length` is used as a proxy for three different questions, and it answers none of
> them.** Three guards, in three different files, each written deliberately with a comment
> explaining its assumption, all gate on row count when row count is not the thing at stake:
>
> | | Site | Gates on | What is actually at stake |
> |---|---|---|---|
> | **Two-context hard gate** | `useCostingBatchBridge.js` | `batchRows.length>0` | Whether a *batch exists to protect* — the one case where row count is arguably the right signal |
> | **D-23** | `OutputPanel.jsx:84` | `batchRows.length>0` | **Spec state.** It confirms about the batch and destroys the scratchpad |
> | **D-24** | `useCostingBatchBridge.js:306` | `batchRows.length>0` | **Profile identity.** A populated profile with an empty grid is still a batch identity, and the guard never reads the profile |
>
> **None of these is a typo or an oversight.** Each carries a comment stating the reasoning, and in
> each the reasoning is internally coherent — *"profile is committed when rows exist"*, *"the batch
> is what the user cares about"*. The error is upstream of all three: **an empty grid was taken to
> mean an empty batch**, and a batch is more than its rows. It has an identity (`batchProfile`), a
> context (`costingContext`), and a scratchpad (`spec`) — none of which `batchRows.length` reports on.
>
> **Fixing D-23 and D-24 separately fixes two symptoms and leaves the pattern**, along with every
> future guard written to the same instinct. Whoever takes Stage 2 should settle *what state actually
> defines "a batch in progress"* before patching either — that single answer determines both fixes
> and is the same question D-5 and D-13 are circling from other directions.
>
> **No number of its own. This is an observation about the code's reasoning, not a defect** — the
> defects are D-23 and D-24, and they are recorded there.

### D-1 — Glass SKU Type never reaches the batch grid

> ### ⚠️ FIXED, but with a live consequence — see D-22
>
> The forward leg landed at `06c1522` and works. The **accepted limitation** recorded below — that
> the 🍶 badge in the Nos/Set cell was deliberately given **no** parent fallback, unlike the other
> two Part-row consumers — has since been **observed in use** as a badge that appears on some Part
> rows and not others, depending on whether the SET's Glass SKU happens to sit on the Box or on the
> Part. That is **D-22**.
>
> Nothing about D-1's fix is wrong. But *"FIXED"* on this entry means the forward leg, not that
> every consumer is consistent. **The remaining inconsistency is exactly one line**: give the badge
> the same `parentBox?.glassSKUType || row.glassSKUType || ""` precedence its siblings already use.

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
| `1885–1890` | `row.glassSKUType` — 🍶 badge in the Nos/Set cell | **none** — starts working once the row carries a value. ⚠️ **This limitation has since surfaced as an observable UI inconsistency — see D-22** (now `BatchGrid.jsx:340`) |

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

> ### 🔴 THE RETURN LEG IS STILL OPEN AND HAS NOW BEEN OBSERVED IN USE
>
> **Reported live by the product owner at Stage 4:** the
> Costing → Send to Batch → Deep Dive → Send/Push loop does not carry `glassSKUType`.
> **This entry predicted it and it was never built.** D-1 is marked FIXED because the *forward* leg
> shipped at `06c1522`; the return leg below was scoped as its own commit and left.
>
> **✅ THE RETURN LEG IS NOW FIXED (`8b317a5`).** `engine/costing.js:213` writes
> `skuType:row.glassSKUType||""` instead of the hardcoded blank. `engine/costing.js` is off-limits
> without a deliberate decision; this was that decision, granted for one line. `test:costing`
> remains 5/5. Verified in the UI: a Deep Dive of an ALCOBEV Part-L now shows
> **"GLASS SKU TYPE (AUTO-FILLS NOS/SET) = Pint 375"** with
> **"L-wise: 3 pcs · W-wise: 5 pcs → Nos/Set = 3"**. That field was blank before the change, and the
> full Costing → Push → row loop was re-run end to end.
>
> **Traced, and the loss is asymmetric — which is why it went unnoticed:**
>
> | Step | Behaviour |
> |---|---|
> | Costing → **Send** | `useCostingBatchBridge.js:558` writes `spec.skuType`, falling back to blank — the row gets the value ✓ |
> | Row → **Deep Dive** | `buildSpecFromRow` sets `skuType:""` (`engine/costing.js:213`), so **the Costing form loses it immediately** ✗ |
> | Deep Dive → **Push** | `:214` writes `spec.skuType`, falling back to **`row.glassSKUType`** — the row's own value survives, so **push MASKS the loss** |
> | Deep Dive → **Send as a NEW row** | `:558` has no row to fall back on, so the new row gets **`""`** ✗ |
>
> **Push is protected by the fallback D-1 already documents as an accepted limitation; Send is not.**
> The blank in the form is visible immediately, but the data loss only materialises on the
> send-as-new-row path — which is why the loop appears to work.
>
> ⚠️ **The fix touches `engine/costing.js`, which is off-limits without a deliberate decision.**
> D-1 argues it is safe — `server.py` has zero references to `skuType` or `glass`, so there is no
> mirror to drift — but **that argument is not the approval.** Needs the product owner's call.

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

**Detection signature:** an affected backup file literally contains `"cbb_template": null`.

> ⚠️ **`null` and ABSENT are different, and only `null` indicates D-3.** Line 37 is
> `if(v!=null)snap[k]=JSON.parse(v);` inside the try — so a key that was **missing from
> localStorage** is never assigned and comes out **absent** from the file, while a key that was
> **present but unparseable** comes out **`null`**. A backup showing `cbb_template` absent was
> taken from a profile that had no template; only an explicit `null` proves the parse failed.

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

> **ANSWERED at the defect pass: every backup file on disk carries the nulls.**
> `CFB_QOS_Backup_20260824.json`, `CFB_QOS_Backup_20260824_fixture.json` and
> `CFB_QOS_Backup_20260825.json` all contain `"cbb_template": null` **and**
> `"cbb_rate_date": null`. The question was not an edge case — it is 100% of the backups that
> exist, the fixture included. **Ruled:** fix the backup leg, re-take fresh backups (the user's
> action), and have restore warn on a null template, because old files circulate regardless.

### D-19 — `exportExcelFull` throws `ReferenceError` on every call

**Promoted into the register at the defect pass**, from the post-split cleanup list where it sat as
deferred lint debt. It is a correctness defect on a live fallback path, and **D-3 is not discharged
without it.**

> **The number is D-19, not D-10.** D-10 is recorded as deliberately skipped; reusing it would
> corrupt every prior reference to the register's numbering.

| | |
|---|---|
| Site | `export/excel.js:107` — `qty`, twice, in the item row map · `excel.js:129` — `locations`, in the freight matrix |
| Reached from | `excel.js:176` (no template stored) and `excel.js:186` (stored template has no CBB+PP sheet) |
| Severity | **High** — the client-side Excel fallback does not work at all today |
| Detection | `npx eslint src` reports all three as `no-undef`; they are inside the 76-error baseline |
| Status | Open — Stage 1 of the defect pass, in D-3's scope |

**Why it belongs with D-3.** D-3 discards `cbb_template` from every backup. Restore such a backup and
no template is stored, so `excel.js:176` routes every export into `exportExcelFull`, which throws.
**A restored profile cannot export at all** — and fixing D-3 alone stops only *new* losses, leaving
every already-restored profile broken.

> **This tie spans two documents, which is why it went unseen.** D-3 was in the register; the
> `no-undef` bug was in the cleanup list as lint debt. Neither pointed at the other, and each looked
> like someone else's problem from where it sat.

> **Scope caution.** This is not a rewrite of `exportExcelFull`. `qty` and `locations` are
> **absent, not misspelled**, so neither has a mechanical repair. The pre-existing `⚠️ BUG` comment
> at `excel.js:11` describes the fault and stays until the fix lands.

#### The two faults are different in kind — `qty` is a DISCOVERY, not a typo

**Calling D-19 "a `no-undef` fix" understates what is actually wrong with the `qty` half.**

| | Fault | What it really is |
|---|---|---|
| `locations` (`:129`) | `(locations\|\|LOCATIONS)` was correct while this code lived inside `QuotationApp.jsx` with `locations` in scope. Phase 3 extracted it and the identifier went undefined | **A genuine extraction casualty.** Mechanical once the source is chosen |
| `qty` (`:107`, twice) | The OFFER header at `:102` declares **10 columns**. The data row emits **12 values** — the last two being `qty` and `finalRate*qty` | **A schema that was never built** |

**There is no order-quantity field anywhere in the data model.** The nearest, `qtyPerSet`, is
nos-per-set — a different quantity entirely. So `qty` was never defined *because the thing it refers
to does not exist*: whoever wrote that row expected the OFFER sheet to carry an order quantity and a
line value, and the schema behind it was never created. The column count mismatch is the evidence —
a header written for ten columns and a row written for twelve.

> **Ruled: drop the two trailing values** so the row matches its own 10-column header. That restores
> the function with no invented data. **Adding the columns properly is a feature, not this fix** —
> it needs an order-quantity field the app does not capture, and the product question behind it is
> recorded in [`defect-pass-plan.md`](defect-pass-plan.md) §8, not resolved here.

> **`locations` — ruled: read it through the persistence seam**, `getItem('cbb_locations')`, inside
> `exportExcelFull`. Precedent already exists in this file at `:175`, which reads
> `getItem('cbb_template')` the same way. Falling back to the imported `LOCATIONS` constant was
> rejected: it would **silently discard a customised locations master**, which is the same class of
> silent substitution as D-9.
>
> **The lint ceiling: 76 → 73, and `scripts/eslint-baseline.txt` needs NO change.** That file is a
> **Phase 0 snapshot** — it records 121 errors / 2 warnings against the pre-split monolithic
> `QuotationApp.jsx` and is not regenerated per commit. The live gate is the prose ceiling of 76/0
> in §1 of the handoff, and it *may only go down*, so 73 satisfies it. `npm run lint` is plain
> `eslint .` — nothing compares against the baseline file programmatically.
>
> `src` holds **four** `no-undef` errors, not three: the fourth is `boxTrim` at
> `importExcel.js:50`, the `parseImportedExcel` bug, which stays on the cleanup list and is **not**
> part of D-19.

### D-18 — Row-level Interest override does not reach the exported xlsx

Observed at Phase 8. Everything else in the export is correct.

**Recorded at Phase 8 as unresolved, one of two — deliberately not investigated then:**

1. the export writes a **stale** interest value, or
2. the export writes **nothing** and the template's own cell stands.

> ## PARTLY RESOLVED, PARTLY A TEMPLATE LIMITATION — and the earlier framing was wrong
>
> **The recorded framing — "sheet-level parameters, one value for all rows" — was wrong**, and so was
> the reading of `_ppSpec` as a prior partial patch. Both are corrected below against the actual
> workbook.

#### ✅ THE CODE HALF — fixed in BOTH exporters

> ### ⚠️ TWO EXPORTERS FILL THIS TEMPLATE, AND THEY MUST NOT DRIFT
>
> `/export` POSTs to **`quote-gen-be/server.py`** (openpyxl) and falls back to
> **`quote-gen-fe/src/export/excel.js`** (xlsx-js-style) only when the backend is unreachable.
> **Both write the same parameter cells.**
>
> **`server.py:245-246` carried the identical defect** — `ws_cbb["BJ3"] = ws_cbb["BJ4"] = interest/100`
> — while its siblings all took proper pairs (`conv_box`/`conv_pp`, `waste`/`waste_pp`,
> `margin`/`margin_pp`). **Interest was the one narrowed parameter, narrowed the same way in two
> independent implementations.**
>
> **Fixing only the frontend would have created a drift where a quote costs differently depending on
> whether the backend was reachable** — worse than being consistently wrong, and undetectable from
> the output. `server.py` was opened by explicit approval for these lines alone. §6 rule 3 applies:
> **change one, change both.**

> ### 🔎 A PRE-EXISTING DRIFT, found while matching them — NOT fixed, NOT in the approval
>
> The two exporters already disagree on **waste and conv**:
>
> | | `AY4` / `BA4` source |
> |---|---|
> | `excel.js` | `_ppSpec.wastePP ?? _ppSpec.waste ?? f0.wastePP ?? f0.waste` — the **PP row's applied** value |
> | `server.py` | `f0.get("wastePP")` — the **first item's** `wastePP` field |
>
> These coincide until a PP row carries a row-level waste/conv override, at which point the two
> exporters produce different workbooks from the same quote. **Pre-existing, out of the approved
> scope, and recorded here rather than fixed.**

`BJ3` and `BJ4` are **two slots the template offers**, and the code wrote the Box row's interest into
both — a code-level narrowing on top of the template's limit, so every PP row was costed at the Box
row's rate. `BJ4` now reads `_ppSpec.interest ?? f0.interest`, exactly as `AY4`/`BA4` already do.

#### 🛑 THE TEMPLATE HALF — a limitation, not a fix. Read this before attempting one.

**1 · The template models BOX vs PP, NOT per-sheet.** Every parameter is
`IF(B7="Box", row3, row4)` — **two slots, not one.** The gap is not "one value for all rows"; it is
**two values for all rows**, split by row type. Verified in
`quote-gen-be/CFB_Quotation_Master_v7.xlsx`:

```
AY7 = IFERROR(AX7/(1+IF(B7="Box",$AY$3,$AY$4)),0)     waste
BA7 = IFERROR(AX7*IF(B7="Box",$BA$3,$BA$4),0)          conv
BJ7 = IFERROR(SUM(AZ7:BI7)*$BJ$3,0)                    interest
BM7 = IFERROR(IF(B7="Box",$BM$3,$BM$4),0)              margin
BK7 = IFERROR(AY7*IFERROR(IF($BK$4="",VLOOKUP(E7,…),$BK$4),0),0)   freight
```

**2 · `_ppSpec` WAS NOT A PARTIAL PATCH.** It filled **the second of the template's two supported
slots** — the correct and complete treatment for a Box/PP model. It was cited twice in this document
as evidence of a prior partial fix; **that reading is withdrawn.** The interest fix above is the same
act, not a repetition of a mistake.

**3 · 🪤 THE COLUMNS ARE DUAL-PURPOSE — this is the trap a future session will walk into.**
Rows 3/4 hold the parameter; rows 7+ hold the computed result **in the same column**. `BM6`'s header
reads *"Margin %"*, so `BM7` looks exactly like a per-row margin input. **It is
`=IFERROR(IF(B7="Box",$BM$3,$BM$4),0)`.**

> **Writing a per-row value there overwrites the formula.** That row then reads correctly — and every
> other row is still on the formula. `BN7 = BL7*BM7` consumes it, so the workbook produces a
> silently inconsistent quote. **The "obvious" fix is worse than the defect.**

**4 · `$AY$3` reaches beyond its own column.** `AS7`, `AT7`, `AU7`, `AV7`, `AW7` and `AY7` all apply
the waste parameter — **six columns, not one.** Even a deliberate template change is wider than it
looks, and that must be visible before anyone scopes one.

#### The per-parameter gap — this table is the specification for whoever takes the template on

**Freight is the worst, and it is listed first for that reason.**

| Parameter | Template supports | App allows | The gap |
|---|---|---|---|
| **Freight** 🚨 | `BK4` override, else a VLOOKUP per delivery location | per row | **Worst of the five.** `BK3` is written only when `f0.freightOverride` is set, so a row-2 override is **not written AND the VLOOKUP silently computes something else in its place.** A wrong number with no trace, not a missing one |
| Margin | Box + PP | per row | rows within each type. `BM4` already follows `batchProfile.marginPP` rather than row 1 — **a third behaviour**, better than the others and still not per-row |
| Waste | Box + PP — feeding **six** columns | per row | rows within each type |
| Conv | Box + PP | per row | rows within each type |
| Interest | Box + PP | per row | **code half now fixed**; rows within each type remain |

> ### ⚠️ APPROVING `server.py` WOULD NOT HELP — someone will assume it can carry this
>
> The backend fills **the same v7 template** with the same hard-coded cell addressing, so it inherits
> the identical ceiling. **The constraint is the workbook, not the code that fills it.** No amount of
> access to `server.py` creates a per-row cell that does not exist.

> ### 📋 OPEN QUESTION — not decided, and not this pass's to decide
>
> **Whether the template changes at all.** Different work, different owner, and it interacts with
> `server.py`'s hard-coded addressing and the masters migration. The table above is the
> specification for whoever takes it.

### D-14 … D-17 — observations from Phase 7b verification

Recorded under the tightened rule (`b52c681`): **one line each, what was observed and where.**
No hypothesis, no reproduction, no bisect, no mechanism. **Do not investigate these.** They are
bookmarks for the post-split defect pass, not tickets.

| # | Observed | Class |
|---|---|---|
| ~~**D-14**~~ | ~~unconfirmed SET Code does not block Deep Dive~~ | **CLOSED at Stage 3 — NOT A DEFECT.** See below |
| ~~**D-15**~~ | ~~blocks only the offending row, not globally~~ | **CLOSED at Stage 3 — CORRECT BY DESIGN.** Ruled per-row. Calculate All and Send All are already effectively global, so the safety property exists where wrong attribution would escape; extending it to every action buys little and costs a lot of friction. Its dependent D-14 is closed as not-a-defect, so nothing follows from it |
| **D-16** | **REWRITTEN at Stage 3 — the trigger is PUSH, not Unlink, and the effect is permanent.** See below | **High — silent, permanent** |
| **D-17** | The add-on pin control is a bare ⊕ beside a number input — no label, hover tooltip only, reads as "add"/"increment" rather than "pin to grid". Discoverability only, not correctness. Fix is a pin glyph | cosmetic |

#### D-16 — ✅ FIXED at Stage 4 (`c5f3e85`). Push materialises derived dims and severs the parent link

> **Resolved.** `pushCostingToBatchRow` now writes L/W through a delta check against
> `autoCalcPPDims` — the same shape and the same `0.001` tolerance as `wasteOverride` twenty lines
> above. Unchanged dims write `""` and keep inheriting; changed dims write through as a real
> override, which the grid already marks by turning the greyed placeholder solid.
>
> **Verified by the product owner, three cases** — the decisive one being that after a no-change
> push, moving the parent Box's L from 512 to 600 still moved the Plate to 595. **The link survived,
> not merely the value.**

##### ⚠️ The Stage 4 fix carried a regression that DESTROYED data. Fixed in `53935b0`

> **`c5f3e85` blanked every explicitly typed L/W on push.** It shipped to `origin/main` and stood
> until it was caught by accident during the D-26 checks.
>
> `autoCalcPPDims` returns the row **untouched** when both dims are already filled
> (`useBatchState.js:168`, `if(!needsL&&!needsW)return row;`). The guard passed `row` as-is, so
> `_derivedDims[k]` **equalled `cur`** for exactly the rows it was meant to protect. The delta was
> always zero, so the guard wrote `""` — and the row fell back to inheriting.
>
> **Unlike D-16 itself, the number on screen changed.** An ALCOBEV Part-L holding `390×230` became
> `507×170` after a push that edited only the Glass SKU. Different deckle area, different cost.
> D-16 was invisible-but-preserving; its fix was visible-but-destroying. **The fix was worse than
> the defect.**
>
> The mixed case failed by a second path: with L typed and W blank there is no early return, but
> `needsL` is false, so L is returned unchanged and `_derivedDims.L` still equals `cur`.
>
> **The fix:** derive from a blanked copy — `autoCalcPPDims({...row,L:"",W:""})` — which asks what
> the row *would* inherit, the only value `cur` can meaningfully be compared against. The spread
> keeps `row.id`, so the parent lookup still resolves. The `d===""` branch at `:198`, written for
> "no parent to derive from", was **unreachable for any dimensioned row** before this.

> ### 🧭 WHY IT ESCAPED — the verification tested only the case the fix was written for
>
> All three cases above used a row with **blank** dims. That is the D-16 case. **The case the fix
> could break — a row with dims already typed — was never run.** A guard that converts one state
> into another must be tested from both states, not from the one it was designed around.
>
> Four cases now stand, all run in the live UI: **blank untouched** (stays `""`), **blank edited**
> (writes through), **explicit untouched** (survives — the regression), **mixed explicit/blank**
> (both correct, and a distinct path through `autoCalcPPDims`).

**Confirmed by the product owner's run at Stage 3, against the source mechanism below.**
**Severity raised: silent and permanent, not a transient recalculation glitch.**

| | |
|---|---|
| **TRIGGER** | **Push, not Unlink.** `Unlink` writes nothing to the row — `setSpec`, `setActiveBatchRowId(null)`, `setSpecCommitted(false)`, `setCostingContext` — and **cannot cause this** |
| **MECHANISM** | Deep Dive reads the row through `autoCalcPPDims` (`useCostingBatchBridge.js:40`), so `spec.L`/`spec.W` hold values **derived from the parent Box**. `pushCostingToBatchRow` then writes `spec.L` and `spec.W` into the row (falling back to `""`). **A computed number is materialised into a field that was blank by design.** |
| **CONSEQUENCE** | **Permanent.** `autoCalcPPDims` returns early forever (`needsL`/`needsW` are now false) and `isAutoDim` at `BatchGrid.jsx:388` flips false, so the greyed live placeholder becomes a hard value. **The row silently stops tracking its parent Box.** Change the Box's dimensions afterwards and the Part does not follow |
| **WHY IT IS INVISIBLE** | **The number is identical at the moment it happens.** Nothing on screen changes. The link is severed and the only evidence is the absence of an update that arrives later, or never |

> **The 7b observation is recorded separately below and is NOT reconciled with this.** The mechanism
> above stands on source and on a confirmed run; the original report named a different trigger. Both
> are kept as they are.

##### The original 7b observation — untraced, kept as recorded

> *"After Deep Dive → Unlink, auto-dims stop recalculating. Unlink itself behaves correctly and its
> notice matches what it does."*

**Unlink cannot produce this** — it writes nothing to the row. The observation gestured at a real
defect one button away and named the wrong control. **A Mode B entry that happened to point
somewhere true.** Why it named Unlink is not recoverable and is not worth recovering; it is recorded
so the next reader can see that the entry and the mechanism disagree, and that the mechanism won.

> **The unverified sub-question is answered and is NOT part of this defect.** *"Do conv/waste
> re-resolve per sector after a Set Role or Box Type change post-Unlink?"* **Yes.**
> `specFromProfile` blanks `waste`/`convRate`/`wastePP`/`convRatePP` deliberately, so they inherit
> and `_calcSpec` re-resolves every render from `_sectorForCalc`. Changing Set Role or Box Type does
> not touch them. **What stops re-resolution is changing the SECTOR — and that is D-9.**

> ### 🔗 SAME SHAPE AS D-9 — see the inheritance-materialisation pattern in the register introduction
>
> D-9 fills the blank on **sector selection**; D-16 fills it on **push**. Two paths, one design
> failure. Fixing either alone leaves the model broken.

#### D-14 — CLOSED. The guard exists, has always existed, and has no bypass

**Settled from source at Stage 3, before any scoping. The code cannot produce the behaviour the
entry describes.**

| Check | Result |
|---|---|
| Does the guard exist? | Yes — `useCostingBatchBridge.js:33`, `if(row.setCodeAssumed){ showToast(…); return; }` |
| Does it post-date the 7b observation? | **No.** `git log -S` puts it in `986033e`, the repo's **first commit**. `c7d7b83` (Phase 4) only moved it into the bridge |
| Is it the only route? | Yes — `BatchGrid.jsx:544` (🔍) is the sole caller |
| Can it be bypassed? | No. The guard returns before the `setTab("costing")` at `:59`. The only other route into Costing is `loadItem` from **Quote Items**, which requires passing the Send All gate that already blocks unconfirmed rows |
| Is it weaker than the other gates? | **No — stricter.** `useQuoteActions.js:227`/`:301` filter `itemType!=="Box" && setCodeAssumed`; this one has no `itemType` exemption |

**Most likely the observed row had `setCodeAssumed:false` already** — Deep Dive correctly opened, and
that was read as a missing gate. What can be established from source is narrower and sufficient: **the
described behaviour is not producible from this code.** Why the observation was made cannot be
recovered, and is not worth recovering.

> **Closed as not-a-defect.** No fix, no commit, nothing to verify.

> ### ⚠️ D-15, D-16 and D-17 COME FROM THE SAME BATCH AND CARRY THE SAME RISK
>
> All four were recorded together under the tightened rule at `b52c681` — *one line each, what was
> observed and where; no hypothesis, no reproduction, no mechanism*. **D-14 is the first of that
> batch to be checked, and it did not survive.**
>
> **Confirm D-15, D-16 and D-17 from source BEFORE scoping any of them.** They are untraced
> observations by construction, not by carelessness — see the two failure modes in the register
> introduction.

> **D-17 carries more weight than "cosmetic" suggests.** It was not found by someone new to the app
> — it was not found by its author, who knew the feature existed and was looking for it. That is a
> discoverability failure of a different order from an unlabelled control, and the severity label
> here understates it deliberately so it is not confused with a correctness defect.

**Context recorded against D-16 and D-6:** during check 6 the Batch Entry toolbar's **`+ Constr`**
button switched to the Construction Library tab instead of opening the slide-over overlay. The
per-row route into the overlay opens correctly. Observed at 7b; **not investigated, not attributed.**

### D-13 — 🧭 Scratchpad work cannot become a batch without being destroyed

> ## CLASS BOUNDARY — THIS IS THE FIRST MISSING-CAPABILITY ENTRY
>
> **D-1 … D-12 are code not matching intent.** Each has a correct behaviour that someone could
> write down, and the code does something else. They are patchable, and the patch is decidable by
> whoever writes it.
>
> **D-13 is intent that was never built.** There is no correct behaviour to restore, because the
> capability does not exist and never did. Nothing here can be *fixed* — something has to be
> *designed and then built*.
>
> **Consequences of the class difference:**
> * It **requires a product decision from the user before any code is written.** Not a review of a
>   proposed patch — a decision about what the batch model *is*. No implementer can derive it.
> * It **will interact with the three incoming masters** (CustomerFamilyMaster, CustomerMaster,
>   SKUMaster — see the roadmap). "Promote scratchpad to a new batch" is structurally the same
>   shape as the **Prospect → Customer transition**: provisional work, held under a temporary
>   identity, that must graduate into a permanent one without being re-keyed. A Prospect already
>   carries two codes for exactly this reason. Solving one and not the other builds the same
>   mechanism twice.
> * **This is the defect most likely to shape what gets built next** — not something to patch.
>   Sequence it as a design input to the masters work, not as a bug in the queue behind D-1…D-12.

**Not a guard failure.** The guards fire correctly. The defect is that the state they block has **no
non-destructive way out**.

#### The flow
```
Costing → + New Batch (scratchpad)      costingContext = "new-batch", rows preserved
        → enter client / sector / plant  real work now lives only in `spec`
Batch Entry → ↓ Profile                  C11 BLOCKS — correctly
```

#### The wording is itself part of the defect — baseline recorded verbatim

**Any fix that lands MUST rewrite these strings.** They are not incidental UI copy: in this state
they are the app's *only* guidance, and both of them point the user at the app's most destructive
action. **A user who follows the instructions correctly still loses work.** That is the defect
stated at its sharpest — obedience is not a defence.

There are **two** such strings, from two independent guards, and *both* name `+ New Batch`.
Copied byte-for-byte from source as the baseline any rewrite is diffed against:

| | Guard | Source | Current text, verbatim (`

` shown as ⏎) |
|---|---|---|---|
| **C11** | `↓ Profile` import | `useCostingBatchBridge.js:604` | `❌ Scratchpad context — cannot overwrite the existing Batch Profile.`⏎`Use Batch Entry → + New Batch to clear the old batch first.` |
| **C10** | Send Costing → Batch | `useCostingBatchBridge.js:260-261` | `❌ New-Batch/Scratchpad context — cannot send into existing Batch Entry batch.`⏎`Go to Batch Entry → + New Batch to clear the old batch first, then send.` |

> **Both exits from this state are the same destructive action.** The app offers the user exactly
> two ways forward — send the spec into the batch, or import the profile — blocks both, and hands
> out the identical remedy each time. There is no third string, because there is no third path.

**Following either instruction triggers D-2** — `startNewBatch` calls `setSpec({...INIT_SPEC})` and
silently discards the Costing scratchpad the user just filled in. The confirm names the profile, rows,
results and Quote Items; it does not name the spec.

#### Both exits lose something
| Choice | Cost |
|---|---|
| Import anyway (if C11 did not exist) | Batch contaminated: new customer's profile over the previous customer's rows |
| Follow the toast → `+ New Batch` | **The Costing spec is destroyed**, unnamed, unrecoverable (never persisted) |
| Abandon and re-enter elsewhere | Manual re-keying |

**The guard protects the batch and sacrifices the scratchpad.** There is no "commit this scratchpad
into a new batch", no "park it", no "save before proceeding".

> **This is the missing capability, not a broken check.** The scratchpad context exists precisely so
> a Maker can cost something independently while a batch is open — but nothing lets that work
> *graduate* into a batch of its own without first destroying it.

> ### ⚠️ D-2's FIX REDUCES D-13's SHARPEST EDGE — that is NOT resolution
>
> Since D-2 (Stage 4), `+ New Batch` **preserves the Costing spec**, so the two guards that point the
> user at it no longer instruct them into destroying their scratchpad. **A user who follows the
> instructions no longer loses work** — which was D-13 stated at its sharpest.
>
> **D-13 IS NOT ADDRESSED.** The capability is still missing:
> * the old batch is **not reachably archived** — `cbb_batch_previous` exists with no reader
> * the Maker **still cannot hold two batches** concurrently
> * nothing lets scratchpad work *graduate* into a batch of its own; it survives by accident of the
>   spec not being cleared, not by design
>
> **Do not read reduced severity as resolution.** D-13 remains a product decision and a design input
> to the masters work.

> **NO FIX WINDOW. Do not propose a fix.** Post-Phase-8 this is a design question the user answers
> first: what should "promote scratchpad to a new batch" do with the existing batch — archive it,
> require it be sent to Quote Items first, or hold two batches concurrently? Then, and only then,
> what the two strings above should say instead. **A patch to a toast string is not a fix** —
> rewriting the strings without building the missing path merely removes the false instruction and
> leaves the user in the same dead end, better informed.

#### Related, unreproduced — C11 observed once as not firing
During Phase 7a verification the guard was reported as importing anyway under this flow. It could
not be reproduced. Evidence on both sides, recorded so it is neither lost nor mistaken for a
confirmed defect:

* **Static:** the guard is **byte-identical** at `dacedb4` (pre-lift, inline), `5c72d1c` (post-lift,
  in the bridge) and the 7a tree. Identical code with identical inputs cannot behave differently —
  so any real failure implies the *inputs* differed, not the code.
* **Live at 7a**, with `costingContext:"new-batch"`, `batchRows:3`, `spec.client:"ZZTEST OtherCo"`:
  the toast fired and `batchProfile.client` was unchanged (`profileHeld: true`).
* Plausible input differences: `↓ Profile` clicked **once before** entering scratchpad context, where
  it is legal and unguarded — which produces the same end state (new profile, old rows) one step
  earlier than the click it was attributed to.

**Status: open observation, not a defect record.** If it recurs, capture `costingContext` and
`batchRows.length` at the moment of the click.

### D-12 — 🚨 The toast overlay makes a destructive button clickable-by-accident

The client-mismatch toast overlays the Costing header, and clicking it fires the Costing
**+ New Batch** — silently discarding an in-progress Costing spec that is never persisted anywhere.

> ### ⚠️ CORRECTED at Stage 2 — narrower in scope, WORSE in one case
>
> This entry originally said the click fires *"+ New Batch — the most destructive action in the
> app"* and put the user *"one OK away from losing the batch, Quote Items and the Costing spec."*
> **That describes the wrong button.** There are two:
>
> | Button | Site | Action |
> |---|---|---|
> | Batch Entry | `BatchProfileBar.jsx:244` | `startNewBatch` — the destructive one, ten state changes, D-2's subject |
> | **Costing** | `OutputPanel.jsx:84` | Sets `spec` to `INIT_SPEC`, flips context to `new-batch`. **Does not touch `batchRows`, `items` or `batchProfile`** |
>
> The toast sits over the **Costing** panel header — confirmed by the product owner from a
> screenshot, orange button edge visible behind the toast, "Batch active · 3 rows" alongside. So the
> button underneath is the Costing one. **The batch and Quote Items are never at risk from this
> path.**
>
> **But one case is worse than what was recorded.** The Costing button confirms only
> `if(batchRows.length>0)`. **With an empty batch there is no dialog at all** — a pass-through click
> goes straight to `setSpec({...INIT_SPEC})` and the in-progress Costing spec is gone. The spec is
> never persisted anywhere, so there is no autosave banner, no restore, no undo.
>
> **This is D-2's loss without D-2's dialog**, reached by a click the user cannot see they are
> making.
>
> ### 🚨 STAYS A BETA BLOCKER on that basis
>
> Silent unrecoverable loss with **zero** confirmation is not a downgrade from loss behind a
> confirm. The severity did not fall; the mechanism moved.

#### Mechanism — DETERMINED: pass-through, not a toast handler

The toast stack — `QuotationApp.jsx:2229` pre-split, `QuotationApp.jsx:78` post-split, and now
`ui/ToastStack.jsx`:

```js
{toasts.length>0&&<div style={{position:"fixed",top:68,right:20,zIndex:9999,…,pointerEvents:"none"}}>
  {toasts.map(t=>(<div key={t.id} style={{…}}>{t.msg}</div>))}</div>}
```

* The container sets **`pointerEvents:"none"`**.
* **No toast carries an `onClick`** — zero matches in the element.

So the toast is not a control and never receives the click. `pointerEvents:"none"` makes the click
pass **straight through** to whatever sits beneath — here, the **+ New Batch** button in the Costing
header, which the toast visually covers (its orange edge is visible behind the toast).

> **The irony is the root cause.** `pointerEvents:"none"` was almost certainly added so toasts would
> not block the UI underneath — a correct instinct. Combined with a fixed position that overlaps an
> actionable control, that same property converts *"click the toast"* into *"click whatever is
> behind it, sight unseen."* A toast that swallowed the click would be **safer** than one that
> passes it through.

This makes it a **positioning / z-order problem, not an affordance problem.** Fixes that target the
toast's own click handling would find nothing to change.

#### Why it is dangerous beyond an ordinary mis-click
The toast's own text invites the click: *"Start a New Batch for this client, or fix the Client field
in Costing."* It reads as an instruction, and clicking a toast is the universal instinct for
dismissing one. The path from *"a warning appeared"* to *"one OK away from losing the batch, Quote
Items and the Costing spec"* is a single reflexive click on a control the user cannot see.

**The confirm dialog catches it only when the batch is non-empty.** With rows present the user
gets a dialog — which, per **D-2**, names what is recoverable and stays silent about what is not.
With an empty batch there is no dialog and the loss is immediate and total.

### D-24 — 🚨 G1 identity guards gate on ROW COUNT, not on whether the profile holds an identity

> 🔷 **One of three instances of the same reasoning error** — see the `batchRows.length` pattern in
> the register introduction, and **read it before fixing this.** D-24, D-23 and the two-context hard
> gate all use row count as a proxy for a question it does not answer. Fixing this one alone leaves
> the pattern.

**Severity: HIGH.** Found at Stage 2 while setting up D-12's verification. **Pre-existing — not a
Stage-1 regression**, confirmed: Stage 1's only change to this file is `300e68c`, five lines at
`463–467` inside the `newConstr` literal, nowhere near the guard.

#### Reproduction

| | |
|---|---|
| Setup | Batch Entry grid **empty**, `batchProfile` **fully populated** with an old client and sector |
| Action | Costing → Start New Batch → enter a **new** client and sector → Send to Batch |
| Expected | Negative Case 2 (client/sector mismatch) warns |
| Actual | **No guard fires, no toast at all.** The SKU is accepted and the profile is silently rewritten |

#### Mechanism — the guard never looks at the profile

All four identity guards — client, sector, plant, delivery — sit inside one condition at
`useCostingBatchBridge.js:306`:

```js
if(batchRows.length>0){
```

**The guard's own comment states the assumption, and the assumption is false:**

> *"These guards fire only when `batchRows.length > 0` (profile is committed). On first Send (empty
> batch), the seeding block below establishes the profile."*

An empty grid is taken to mean *no committed profile*. **A populated `batchProfile` with an empty
grid is still a batch identity**, and the guard cannot see it, because it never reads the profile —
only the row count.

Negative Case 1 (the two-context hard gate) correctly did **not** fire: `batchRows` is empty, so by
its own condition it has nothing to protect. That part is working as designed.

#### The seeding block turns a missed warning into a silent rewrite

`:556`, on the same Send:

```js
if(batchRows.length===0){
  if(spec.client)   profilePatch.client=spec.client;
  if(spec.sector){  profilePatch.sector=spec.sector; /* + waste, convRate, wastePP, convRatePP */ }
  …
}
```

Its comment — *"existing profile defaults such as 'Nagpur' must not silently win over the Maker's
explicit Costing values"* — was written for a **fresh** profile holding defaults, not a populated
one holding a real prior identity.

#### ⚠️ "Identity" is `client || sector` — an IMPLEMENTATION CHOICE, not the ruling

**The ruling was "a populated profile is still committed". It did not say which fields constitute
an identity.** That `_profileHasIdentity = !!(batchProfile.client || batchProfile.sector)` is the
implementer's choice, and it is recorded here so it reads as a decision rather than an inherited
assumption.

**What it means in practice:**

* A profile with **either** field set counts as committed, so the guards run.
* A profile with **only a sector** — no client — still blocks a sector mismatch. **Verified**: with
  both clients blank so only the sector guard could fire, a PAINTS spec against an ALCOBEV profile
  was blocked.
* `plant` and `delivery` are **deliberately excluded**. They have guards of their own, but they
  default to concrete values (`Nagpur`) on a fresh profile, so including them would make *every*
  profile "committed" and the seeding block unreachable.

> **If the definition should be narrower (client only) or wider (any of the four), that is a
> different decision and this line is where to change it.**

#### Site 4 — harmless IN CONTEXT after this fix, NOT resolved

The seeding block that D-24 gates also carries **site 4** of the inheritance-materialisation pattern
(D-9 / D-16): it writes the sector's derived waste/conv into `batchProfile`.

**D-24's fix does not fix site 4. It restricts when the block runs**, so the write now lands only in
a profile with no identity — initial state, not a frozen inheritance.

> **And that is contingent, not permanent.** It holds only because **D-25** means the profile cannot
> express blank-means-inherit. When D-25 is fixed, this write becomes materialisation again.
> **D-25 carries a hard precondition to revisit `bridge:568`, and the code carries the matching
> comment.** Three places, deliberately — this is the exact shape of thing that gets lost between
> sessions.

#### BOTH branches, recorded explicitly

| Branch | Outcome | Severity |
|---|---|---|
| **`spec.client` AND `spec.sector` both set** | Profile **silently overwritten**. The batch is coherently re-identified to the new customer, along with four derived waste/conv values. No mis-filed SKU, no split identity | **High** |
| **Either field blank** | That field **keeps its old value**. The SKU is attributed under a **mixed identity** — new client, old sector, or the reverse | **Worse, and still unguarded** |

> ### The silence is the defect, and it does not shrink on the safer branch
>
> Even where the outcome is coherent and may be what the Maker intended:
>
> * **The app reassigned an existing batch to a different customer without asking.**
> * **There is no record it happened.** Rows carry no `client` and no `sector` — every field on
>   `newRow` was checked, and identity of that kind lives only on `batchProfile`. `buildSpecFromRow`
>   reads both from the profile (`engine/costing.js:186–187`), as do export, PDF, Quote Items
>   grouping and `generateCode`. The old profile value is retained nowhere.
> * **A Maker returning to a batch they set aside earlier cannot discover it** — not before the
>   Send, and not after.

#### Why 7a and 7b passed it

Negative Case 2 is listed among the four manual guards as *"client/sector mismatch against the Batch
Profile must warn"* — with **no mention of a row-count precondition.** Verified twice by a route
that had rows present, which is the only route where the guard exists. **The checklist describes a
guard that is narrower than its description.**

> **NO FIX PROPOSED. The question is the product owner's:** does an empty grid with a populated
> profile mean the profile is **still committed**, or is an empty batch a **blank slate**? Every
> reasonable fix follows from that answer and none can be derived without it. **Rule at Stage 2,
> alongside D-5.**

### D-23 — the Costing `+ New Batch` guards on batch state to protect spec state

> ### ⚠️ THE MESSAGE IS AS WRONG AS THE CONDITION — fixing the gate does not close this
>
> The dialog currently reads *"Your existing Batch Entry batch (N rows) remains completely
> untouched"* — and says **nothing** about discarding the Costing spec, which is the only thing the
> action actually destroys. **It reassures about what is safe and stays silent about what is lost:
> exactly D-2's inverted warning, in a different button.**
>
> **RULED: confirm when the spec is dirty** (`_specHasWork` — seven string fields, no numerics, so
> the `wastePP:0` blank-vs-zero trap never arises), **and rewrite the message to name the spec.**
> A future reader must not conclude that correcting the gate closed the defect.

**Recorded, not fixed. Independent of the toast.**

> 🔷 **One of three instances of the same reasoning error** — see the `batchRows.length` pattern in
> the register introduction, and **read it before fixing this.** D-23, D-24 and the two-context hard
> gate all use row count as a proxy for a question it does not answer. Fixing this one alone leaves
> the pattern.

`OutputPanel.jsx:84` gates its confirm on `batchRows.length>0`, but the thing it destroys is
`spec` — `setSpec({...INIT_SPEC,plant:"",delivery:""})`. **It guards X to protect Y.** The batch it
asks about is the one thing the action leaves untouched; the scratchpad it silently discards is
never mentioned.

This is the defect underneath D-12. Fixing the pass-through stops the *accidental* click; the
button still discards an unsaved spec without asking whenever the batch happens to be empty.
**Same family as D-2** — a confirm describing the wrong subject — and it should be ruled on with
D-2 at Stage 2.

> **NO FIX WINDOW. Do not propose a fix.**
> ⚠️ **Whatever lands must NOT suppress the toast.** The client-mismatch warning **is negative
> Case 2** and must keep firing. The fix is to stop the overlay sitting over actionable controls —
> reposition, reserve space, or make the stack swallow clicks — not to remove the warning.

### D-11 — 🚨 Construction Library duplicates instead of matching (FOUR predicates, one absent)

**Hypothesis tested and REFUTED.** The proposed cause was that the two `importConstrFromSpec` copies
disagree — the tab compares `spec_cobb`, the bridge does not — and that `JSON.stringify(c.layers)`
is key-order / type sensitive. **Neither explains the observed duplicates.**

#### Evidence — the duplicates match on EVERY field BOTH predicates compare

Live fixture, 24 entries. Grouping by the bridge's full 9-field predicate finds **two duplicate
groups covering 6 of 24 entries (25%)**:

```
G, U, V, W    identical on all 9 bridge fields, including JSON.stringify(layers)
O, T          identical on all 9 bridge fields
```

Field-by-field on U/V/W: board_gsm "400" (string), spec_bs "4.5" (string), spec_bct "", spec_ect "",
spec_cobb **undefined on all three**, sector "ALCOBEV", ply 3 (number), flute_F1 "B", flute_F2 "A",
boxType "PP", and byte-identical layers JSON with identical key order TOP,F1,L1,F2,L2.

Both predicates return **match** for every pair (U↔V, U↔W). The stringify comparison **passes**. The
divergence is real but is **not** what produced these rows.

#### The actual finding — FOUR creation paths, FOUR different checks, one absent

| # | Path | Duplicate check |
|---|---|---|
| 1 | `useCostingBatchBridge.js:467` — Send to Batch Entry | 9 fields: STDs + ply + flutes + boxType + layers JSON. **No spec_cobb, no sector** |
| 2 | `useQuoteActions.js:389` — App-level `importConstrFromSpec` | 5 fields: STDs + sector. **No cobb, no ply/flutes/boxType/layers.** Its own comment: *"Fix 14: duplicate check (was missing from this path; the Construction Library tab has it, this didn't)"* |
| 3 | `ConstructionLibTab.jsx:264` — tab's inline `importConstrFromSpec` | 6 fields: STDs + **spec_cobb** + **sector** |
| 4 | `ConstructionLibTab.jsx:196` — **"+ New Construction"** | **NONE.** Appends a blank entry unconditionally |

> 🛑 **THE OBVIOUS FIX FIXES NOTHING OBSERVABLE.** "The two predicates disagree" reads as
> *"unify the two `importConstrFromSpec` copies"* — and that leaves **path 4 untouched**, which is
> the path most likely producing the duplicates. Do the work, and the library keeps duplicating.
> This is the trap to avoid.

**Path 4 is the unguarded one.** It creates a blank row which the user fills in afterwards, so no
check is possible at creation and none happens later. Any construction built this way that matches
an existing one becomes a permanent duplicate — the most probable origin of the observed groups, and
it requires no predicate disagreement at all.

#### D-11 IS WIDER THAN "ONE UNGUARDED PATH" — there is also a SANCTIONED duplication route

Confirmed at source during Stage 1. The four paths are not "three guard, one doesn't":

| # | Path | Behaviour |
|---|---|---|
| 1 | bridge send (`useCostingBatchBridge.js:419–447`) | **Two checks.** `existingFull` (all fields incl. layers) reuses silently with a toast. `existingSTD` (8 fields, no layers) raises `window.confirm` — **and Cancel deliberately creates a duplicate** |
| 2 | app-level `importConstrFromSpec` | 5 fields (4 STDs + sector) → `window.alert`, `return`. **Blocks** |
| 3 | tab `importConstrFromSpec` | STDs + `spec_cobb` + sector → `window.alert`, `return; // always stop`. **Blocks** |
| 4 | `+ New Construction` (`ConstructionLibTab.jsx:196`) | **No check at all.** Appends unconditionally |

> ### 🛑 Path 1's Cancel branch is a DELIBERATE duplication route, not a gap
>
> The STD-tier prompt offers *"OK = Reuse [X] — your Costing paper grades are discarded / Cancel =
> Create a new construction entry with your Costing layers"*. **Cancel means "keep my grades", and
> keeping them requires a new entry.** The comment at the fall-through says so:
> *"If cancelled, fall through to create new construction below."*
>
> **So D-11 has an unguarded path AND a sanctioned one.** Path 4 creates duplicates because nothing
> checks; path 1 creates them because the user was asked and said yes. These need different
> remedies, and a fix that only adds guards addresses one of the two.
>
> ### ✅ RULED: THE CANCEL BRANCH STAYS
>
> Discarding a Maker's paper grades to force reuse is its own kind of data loss, so the branch is
> kept deliberately.
>
> **The consequence, which must be recorded with the ruling: a guards-only fix addresses ONE OF TWO
> duplicate sources.** Path 4 creates duplicates because nothing checks; path 1 creates them because
> the user was asked and said yes. Adding predicates everywhere leaves the second untouched — by
> design now, rather than by omission. **Anyone measuring whether D-11 "worked" must count only
> unsanctioned duplicates**, or the sanctioned ones will read as a failed fix.

**Second duplicate-producing route, by design:** the bridge's STD-tier prompt (`:425–444`) offers
*"OK = Reuse [X] — your Costing paper grades are discarded"*. **Cancel** means "keep my grades",
which creates a new entry.

#### ✅ RULED at Stage 3 — identity is the PHYSICAL SPEC

**Board specs + ply + flutes + boxType + layers.** Sector and client are **metadata, not identity**.
Minimum prevention only: one shared predicate at all four creation paths including the unguarded
`ConstructionLibTab.jsx:196`. Not an identity model, not a merge tool — small enough that discarding
it costs nothing once constructions gain database identity.

> **The design intent behind it, which neither party had stated before and which is a constraint on
> the masters work — see the roadmap section.** A construction is a **physical spec and is
> client-agnostic by design.** Clients attach to it; multiple clients can share one construction,
> and eventually multiple sectors. Including client in identity would fragment a single physical
> construction across clients — **the exact duplication D-11 exists to prevent, only sanctioned.**

#### TWO COMPETING HYPOTHESES — equal standing, BOTH UNTESTED

Whoever investigates after Phase 8 **must test both**. Neither is proven.

**Hypothesis A — path 4, the unguarded blank-create.** "+ New Construction" appends a blank entry
the user then fills in. Explains a duplicate arising from manual entry.
*Weakness:* it explains a filled-in-later entry, but explains **poorly** why G/U/V/W are identical
on **every** field. That pattern fits a fully-formed duplicate created in one action, not four
independent manual fill-ins converging exactly.

**Hypothesis B — session boundaries breaking the match-back.** Batch Entry → Deep Dive → Costing
rehydrates a spec that came FROM an existing construction. If the send path then fails to match it
back — across a reload, a session restore, or a `costingContext` change — Costing creates a new
construction that is an **exact copy** of the one the row already pointed at.
*Strength:* fits the evidence better. Identical on every field, clustered in pairs and groups, and
reachable through the workflow used constantly (Deep Dive → edit → send).

#### The predicate divergence is real and still a defect — just not this one
Overlap between tab and bridge is only the four STD fields. Each compares five the other ignores, so
they disagree **in both directions**:
* **Tab says duplicate, bridge says new** — same STDs and sector, different ply/flutes/boxType/layers.
* **Bridge says match, tab says new** — identical board and layers, different spec_cobb or sector; the
  bridge silently reuses an entry the tab treats as distinct.

`spec_cobb` is **undefined** on the sampled entries, so the tab's cobb comparison is currently a
no-op. It starts biting once cobb values are populated.

#### Code allocation compounds it
All paths allocate A–Z then fall back to `C${constructionLib.length}`. Duplicates burn the readable single
letters, and the fallback is **length-based**, so it can collide after deletions — the same class of
bug "Fix 14" corrected for the letters.

> **Severity: outranks D-5 for roadmap purposes.** The library is meant to become a deep reference
> set — the stated reason for retaining untested code in Phase 2. A library that duplicates instead
> of matching destroys its own value as a source of truth.

> **Phase 2's "do not unify the two copies" was CORRECT as a refactor rule** — the divergence must
> survive the split unchanged so it stays diagnosable. **But it is now a known defect to resolve
> after Phase 8, not to preserve indefinitely.** Any resolution must reconcile **all four** paths:
> unifying the two `importConstrFromSpec` copies while leaving path 4 unguarded would fix nothing
> observable.

> **NO FIX WINDOW. Do not propose a fix.** Resolution needs a product decision on what *constitutes*
> the same construction — whether sector/client are identity or metadata, and whether layers must
> match or only board specs.

#### Provenance, not timestamps — what the register actually needs

⚠️ **A `createdAt` timestamp alone would NOT distinguish hypothesis A from B.** Both produce an entry
at some time; neither is identifiable by when it appeared.

**The requirement is recording WHICH PATH wrote the entry** — path 4 blank-create vs bridge send vs
tab import vs app-level import. A `createdVia` field (plus `createdAt` for ordering) is the cheap
enabler that makes this decidable. **That is an enabler, not a fix** — it does not prevent a single
duplicate.

#### Cleaning the EXISTING duplicates is separate work

Whatever gets built post-Phase-8 **prevents new duplicates. It does not remove the ones already
there** — currently **6 of 24 entries across two groups** (G/U/V/W, O/T).

Consolidating them needs a merge tool or manual work, and it is not just the library: **every batch
row and quote item pointing at a duplicate code has to be repointed**, or those rows resolve to an
entry that no longer exists. Scope this as its own task. Otherwise it gets discovered after the
prevention fix ships and the library still looks wrong.

#### Not reproducible on demand from the current fixture
A spec loaded via Deep Dive matches its own construction on all 9 fields, as expected — that test is
circular, since `buildSpecFromRow` builds the spec *from* the construction. Constructions carry **no
timestamps**, so stored data cannot say whether an entry was duplicated at creation or edited into
identity afterwards. A `createdAt` field would make this diagnosable.

### D-26 — typing a SET Code silently skips the Nos/Set auto-fill

> **✅ FIXED at Stage 4 (`ce800ca`).** The resolution logic is extracted from `handleConfirm` into
> `applyGlassSKUNos`, called by both paths — `handleConfirm` as before, and a new `onBlur` on the
> SET Code input. `onFocus` records the value at focus; `onBlur` re-applies **only if it changed**,
> so tabbing through an untouched field never overwrites a Nos/Set the Maker set deliberately.
>
> The ref is declared at the component top, **not** inside the row `.map()` — hooks inside `.map()`
> have caused blank-screen crashes in this file before.
>
> **Verified in the live UI, two cases plus a positive control.** Typing lowercase `glass180` and
> blurring filled Nos/Set 1 → 5 from the parent's *Nip 180* (also exercising D-7's case-insensitive
> match). With Nos/Set set manually to 9, focusing and blurring the SET Code **without editing it**
> left it at 9.
>
> > **The first run of the second check tested nothing** and was nearly recorded as a pass. The
> > element ref was stale, so the focus landed on a different row's field — Nos/Set held at 9
> > because the handler never ran, not because the guard worked. Re-run with focus asserted before
> > the blur, then followed by a **positive control on the same element**: focus, change the value,
> > blur → 9 → 5. Only that pair makes the negative result mean anything.
> >
> > Second instance in this pass of a negative test that proved nothing. **A test whose pass
> > condition is "nothing happened" is worthless without a paired demonstration that something
> > *could* have happened.**

**Moved into the register from `post-model-defects.md` (was PM-4), 2026-08-28. Not a new finding —
a corrected filing.** The scope freeze exists to stop the register *growing*; it is not a reason to
leave a misclassified entry in the wrong list.

**Found by applying the two-test sorting rule to post-model, on its first use.** PM-4 failed both:

| Test | Answer |
|---|---|
| Does the masters migration make this tractable? | **No.** It is a UI entry-point problem, not an identity one. Entities change nothing about it |
| Is live data wrong today? | **Yes** — but see the correction below. The wrong number reaches the **client-facing quote**, not the costing |

> ### ⚠️ CORRECTED — the consequence was overstated, and in the direction that matters
>
> This entry first claimed `qtyPerSet` *"multiplies the SET rate at `engine/costing.js:212`"*,
> producing a wrong SET **total**. **That is wrong.** Line 212 is the only mention of `qtyPerSet` in
> the engine and it is an **assignment inside `buildSpecFromRow`, not arithmetic**. `calcCosting`
> never reads it.
>
> **So the per-box rate, material cost, margin and MOQ are all correct.** The claim came from a grep
> hit that was never checked for read-versus-write — **Mode B, in the implementer's own analysis.**
>
> **What is actually wrong is client-facing, which is why the entry stands:**
>
> | Site | Effect of a stale `nosPerSet` |
> |---|---|
> | `excel.js:324` / `server.py:337` → **`BS{r}`** | The workbook's **Nos/Set** column shows `1` instead of the true count |
> | Template **`BT`** — *SET Rate Contribution (Rs/set)* | Computed from `BS`, so the per-set contribution is wrong |
> | `pdf.js:79,81` | The PDF's *"SET: X — combined rate ₹N/set"* is wrong |
>
> **A Maker quoting a five-piece partition set shows the customer the price of one piece.** A wrong
> number on a document that leaves the building — but not a costing error, and the entry should not
> be read as one.

#### Scope is narrower than recorded

The auto-fill is gated on `batchProfile.sector === "ALCOBEV"` **and** `itemType` in
`Part-L`/`Part-W`. Rows **sent from Costing** take `nosPerSet` from `spec.qtyPerSet`
(`useCostingBatchBridge.js:571`) and never reach `handleConfirm` at all.

**So D-26 affects exactly: ALCOBEV Part-L/Part-W rows created IN THE GRID, where the Maker types the
SET Code instead of confirming the inherited one.** Narrow — and an ordinary thing to do.

#### Mechanism — two entry points to one resolution

**Auto-dims and Nos/Set auto-fill both depend on resolving the same parent Box, and they are reached
differently:**

* **Auto-dims** run on render, via `autoCalcPPDims` in `useBatchState.js`.
* **Nos/Set auto-fill** runs *only* inside `handleConfirm` (`BatchGrid.jsx:250`), which renders only
  while `setCodeAssumed` is true.

**Typing in the SET Code field clears `setCodeAssumed`** (`BatchGrid.jsx:311`), which removes the
confirm control from the DOM. So a Maker who *types* a SET Code gets auto-dims and **silently no
Nos/Set** — no error, no toast, nothing indicating a step was skipped.

> **Demonstrated live at Stage 3.** A Part-L created with its SET Code typed as `glass180` resolved
> its parent for dims and did not auto-fill Nos/Set. Initially read as a D-7 failure; it is neither a
> D-7 failure nor a gate — **the code path simply never executes.**

> **Severity: HIGH.** The wrong value is *visible* in the grid's Nos/Set column, so it is not
> invisible in the way D-16 was. But nothing draws attention to it, and the default silently
> multiplies through the SET rate.

> **Sequenced after D-18.** Small, blocks nothing.

### D-25 — the blank-means-inherit model is UNREACHABLE: the batch path cannot consume blanks

**Found at Stage 4 while scoping D-9's fix. Its own entry, not a note inside D-9, because it is a
structural mismatch rather than another write site — and it explains why the model has been broken
everywhere rather than in four places.**

#### The two halves that do not meet

**The app declares a blank-means-inherit model.** A blank `waste`/`convRate`/`wastePP`/`convRatePP`
means *"follow the authority"*, resolved fresh on every render so it stays live.

**But nothing ever starts blank.** `INIT_SPEC` ships `waste:5, convRate:7, wastePP:5,
convRatePP:12.5` (`data/defaults.js:94`) and the initial `batchProfile` ships the same four
(`useBatchState.js:26`). **A fresh spec is never in inherit state at all.** Blank is reachable only
via `specFromProfile` — Unlink or Start New SKU.

> **This is the CAUSE of what D-9 recorded as a symptom.** D-9 observed that *"blank = inherit almost
> never occurs in normal use, so the inherit path is largely untested in practice"* — correctly, but
> without explaining why. This is why.

#### And the calculation path cannot accept a blank if one arrives

**`calcCosting` uses destructuring defaults** (`engine/costing.js:34`):

```js
const{ … waste=5, convRate=7, wastePP=5, convRatePP=12.5, … }=spec;
```

**Destructuring defaults fire only on `undefined` — never on `""`.** A blank sails through as `""`
and every arithmetic operation on it yields **`NaN`, silently**. No throw, no visible failure.

**And a live route delivers one.** `useQuoteActions.js:210`:

```js
const profWaste=isPP?(batchProfile.wastePP??5):(batchProfile.waste??5);
```

`??` is nullish coalescing, so **`""` does not trigger the fallback** — it is preserved and passed
on. `buildSpecFromRow` (`engine/costing.js:201`) has the identical `constEntry.waste??prof.waste??5`
shape, and so does `pushCostingToBatchRow`.

> **Two paths, only one of which resolves blanks.** The **Costing** tab is safe: `useCostingResult`
> builds `_calcSpec`, which substitutes defaults for blanks before calling `calcCosting`. The
> **batch** path is not: `calcBatchRow` and `sendAllToQuoteItems` assemble their spec independently
> and **never pass through `_calcSpec`**.

> ## 🛑 HARD PRECONDITION — revisit `bridge:568` BEFORE blanking the profile
>
> **Before blanking the profile's `waste`/`convRate`/`wastePP`/`convRatePP`, revisit the first-Send
> seeding block at `useCostingBatchBridge.js:568`** — **site 4** of the inheritance-materialisation
> pattern.
>
> That block writes the sector's derived waste/conv into `batchProfile`. **D-24's fix made it
> harmless IN CONTEXT** by restricting it to run only into a profile with no identity — establishing
> initial state rather than freezing an inheritance. **That holds only because of D-25 itself:** the
> profile cannot express blank-means-inherit today, so there is nothing to freeze.
>
> **Blanking the profile removes exactly that protection.** A blank profile would then mean "follow
> the sector", and these writes become materialisation again — **re-creating the defect inside the
> commit that fixes it.**
>
> **This is not a note. It is a precondition on D-25's fix**, and the matching pointer is in the code
> at `bridge:568`.

#### Consequence for the D-9 / D-16 fix

**Making the model real is not a two-literal change.** Blanking `INIT_SPEC` and the initial
`batchProfile` without first making the batch path blank-aware would produce **NaN costings on
Calculate All** — silently, and on the path that produces quotes.

**The real scope is three `??` chains made blank-aware** — `buildSpecFromRow`, `calcBatchRow`, and
`pushCostingToBatchRow` — *before* any initial value is blanked. `data/defaults.js` is **not**
approved for this; the narrow approval given for two literals was withdrawn once the true scope was
established.

> ### ⚠️ `test:costing` WOULD NOT HAVE CAUGHT THIS
>
> **The batch path is not covered by the fixtures.** `scripts/costing-fixtures.mjs` exercises
> `engine/costing.js` directly against pinned `DEFAULT_*` masters. It never runs `calcBatchRow`,
> never runs `buildSpecFromRow` against a real `batchProfile`, and therefore never sees the `??`
> chains that would carry a blank into the engine.
>
> **A green `test:costing` is not coverage of a calculation change that goes through the batch.**
> This is a gap in the harness, not just in this defect — see §1 of the handoff, which lists what the
> fixtures cannot see.

### D-9 — Selecting a sector silently converts inheritance into an override

Pre-existing, in Costing's spec form. **Not a Phase 6 regression** — nothing in the split touched it.

Selecting a sector writes that sector's defaults straight into `spec`
(`QuotationApp.jsx:193–194`):

```js
setSpec(p=>({...p, sector:v,
  ...(sd?{waste:sd.wasteCBB, convRate:sd.convBox,
          wastePP:sd.wastePP, convRatePP:sd.convPP}:{})}))
```

That contradicts the design stated ~200 lines below in `numField`: *"Input stays blank = inherit.
Explicit entry = override (amber border)."* The field now holds a literal number, so by the app's own
definition it **is** an override.

**It does not look like one.** The override indicators `_isOvW`/`_isOvC` require
`+spec[key] !== +_effWaste`, and immediately after selection those are equal — no amber border, no
`↑` marker. A silent override presenting as inheritance.

#### Two documented guarantees break

**1. Liveness.** `useCostingResult`'s own comment: *"resolved fresh here (not baked into spec) so it
stays live if sector changes."* Once copied in, the value is frozen — edit that sector in Defaults
and Costing keeps the stale number.

**2. Batch Profile authority — the sharper one.** The `_hasCommittedBatch` branching exists so the
Batch Profile is authoritative for waste/conv once a batch exists. That only works while the spec
field is **blank**. Sector selection fills it, so the spec value wins and the profile is silently
bypassed. A Maker believes the Batch Profile governs their batch; it does not.

#### Does NOT break Case 4
An explicit `0` differs from the sector default, so it flags amber and behaves correctly. But it does
mean **"blank = inherit" almost never occurs in normal use**, so the inherit path — the one Case 4
exercises — is largely untested in practice.

#### The full write-site set must be derived before any fix
Two contradictory conventions already coexist. A partial fix produces inconsistent behaviour between
paths, which is worse than the current uniform wrongness. Sites seen so far, **not an exhaustive
survey**:

| Site | Shape |
|---|---|
| `QuotationApp.jsx:193–194` | Costing sector `<Sel>` — copies sector defaults into `spec` (**the reported case**) |
| `QuotationApp.jsx:1138–1139` | Batch Profile sector `<select>` — same copy shape, into `batchProfile` |
| `QuotationApp.jsx:1331–1332` | `spec.waste ?? p.waste ?? 5` — coalescing fallback, a third shape |
| `useCostingBatchBridge.js:83` | `waste:"", convRate:"", wastePP:"", convRatePP:""` — **blank = inherit, done correctly** |

> **Severity: HIGH.** Not data loss (D-5) nor wrong-quote-by-typo (D-8), but it **silently defeats a
> documented authority model.**

> ### 🔗 SAME SHAPE AS D-16 — see the inheritance-materialisation pattern in the register introduction
>
> D-9 fills the blank on **sector selection**; D-16 fills it on **push to batch row**. Two paths, one
> design failure: a blank-means-inherit model with several paths that quietly fill the blank. **Fixing
> either alone leaves the model broken** — the question underneath both is whether a resolved value
> may ever be written back, and if so whether the UI must mark it as no longer inherited.

> **NO FIX WINDOW. Do not propose a fix.** Post-Phase-8 this needs a product decision first: should
> selecting a sector pre-fill visible values (arguably friendlier) or leave them blank with the
> default shown as placeholder (what the design says)? That is a domain question, not a code one.

### D-8 — 🚨 BETA BLOCKER — unguarded master-data edits (CATEGORY, not one bug)

**A different class from D-1…D-7.** Those are code not matching intent. This is **intent that was
never specified** — no code inspection finds it, because nothing is behaving contrary to how it was
written.

Admin edits to master data are direct writes: **no confirmation, no validation, no undo.** A typo —
an extra digit on a paper rate, ₹450 for ₹45 — is accepted silently and flows into every subsequent
quote.

#### Why it is worse than ordinary missing validation

**1. Writes are immediate and per-keystroke.** `onChange` fires `setRates` (or the equivalent) plus
`touchRateDate`, persists through the seam, and returns. There is no commit step, no undo, and no
record of the prior value. Verified at source in `RateMasterTab.jsx`.

**2. It propagates BACKWARDS.** `useBatchInvalidation.js:34` —
`useEffect(()=>{invalidateAllBatchResults();},[rates,freight,constructionLib])` — wipes every cached
batch result on any rate change, so **previously calculated rows recalculate against the new
number.** A quote costed this morning gives a different answer this afternoon and nothing explains
why. The typo is invisible at the point of damage.

#### Scope — a category, present in four places
| Surface | Fields |
|---|---|
| Rate Master | grade price, discount, interest, freight — **plus the blanket operations** (`blanketDisc`, `blanketInterest`, GY premium) which write across **ALL grades at once** |
| Freight Rates | the plant × location matrix |
| Defaults | sector values including waste/conv — which feed the `wastePP` resolution |
| Partitions master | partition counts |

**The blanket operations are the sharpest case:** one wrong number applied to every grade, one click,
no confirmation.

> **Severity: BETA BLOCKER, alongside D-5.** D-5 loses work you know you had. **D-8 produces wrong
> quotes you have no reason to doubt** — worse, because it is undetectable from inside the app.

> **NO FIX WINDOW. Do not propose a fix.**
> When this is taken up after Phase 8 it is a **design question before it is a code one** —
> plausible-range warnings, an explicit save step, change history, or some combination. It needs the
> product owner's domain input, not the implementer's judgement. **Record it as needing a design
> decision, not a patch.**

### D-5 — ✅ FIXED at Stage 2 (was 🚨 BETA BLOCKER) — autosave silently overwrites a larger batch

> **Resolved.** `batchRows` now hydrates from `cbb_batch_autosave` on mount, so state and storage
> agree from the first render and the divergence the defect rested on cannot occur. The write guard
> is deleted — after hydration an empty batch means the batch is empty, so every write persists,
> including a deliberate delete-to-zero. The banner and `restoreAutosave` went with it.
>
> **DP-2's confirmation survives**, moved to where it belongs: `handleRestoreFile` asks before the
> write, unconditionally, naming both row counts. It cannot expire, unlike the 7-day banner gate it
> replaces. The age is now surfaced in the Batch Profile bar with no behaviour attached.
>
> `+ New Batch` archives to `cbb_batch_previous` first — one slot, most recent non-empty batch. The
> route for a user to reach that archive is **D-2's** decision and is still open.
>
> Commits: `53676f4` archive · `1408df8` hydration · `fdf19a7` restore confirmation · `73a0948` age.

`state/useBatchState.js:69–80`. The comment and the code disagree:

```js
// Fix 3: Never let a smaller/empty batch overwrite a larger valid prior save.
// Only write if current rows are non-empty AND >= the saved row count (or no prior save exists).
if(!batchRows.length){                        // ← guard fires ONLY when empty
  const prev=getItem('cbb_batch_autosave');
  if(prev){const{rows}=JSON.parse(prev);if(rows?.length>0)return;}
}
setItem('cbb_batch_autosave',JSON.stringify({ts:Date.now(),rows:batchRows,profile:batchProfile}));
```

The comment promises a **count comparison**. The code implements only the **empty** case. Any
non-empty batch overwrites any larger prior save.

#### Reachable from ordinary use, in three steps
`batchRows` is **not** hydrated from storage on mount — the rows live in `cbb_batch_autosave` and the
app shows a *"Unsaved batch work found … Restore it?"* banner and waits for an explicit click. So:

1. Reload. Rows are in storage, `batchRows` state is empty.
2. **Dismiss** the banner — it looks like cosmetic clutter. State and storage are now divergent.
3. Add or send one row. The effect fires and writes 1 row over N.

**Silent. No confirmation, no undo.** A Maker who dismisses the banner because it is in the way
loses the batch on their next send.

> **Observed live, not theorised.** During Phase-5-era fixture work this destroyed a 6-row batch,
> overwriting it with 1. The operator was working under an explicit "tell me before anything
> destructive" rule and still walked into it, because **Dismiss reads as cosmetic and is not.**
> If a careful operator under that rule hits it, a Maker mid-quote has no chance.

> **Severity: BETA BLOCKER. Outranks D-3 and the `cbb_pinned_addons` gap.** Silent, unrecoverable
> loss of work on a common path.

#### The comment describes the WRONG fix — do not implement it

Demonstrated by an ordinary action: **deliberately deleting 2 of 4 rows.** The autosave correctly
wrote 2 over 4. That write is *exactly* what the comment's guard — *"only write if current rows are
non-empty AND >= the saved row count"* — would **block**. Under that rule the deletion never
persists, and the user reloads to find the deleted rows back.

So a count comparison is not a stricter version of the right behaviour; it is a different bug.
**Deliberate shrinking must persist. Only shrinking the user did not ask for is the defect.** Row
count cannot distinguish the two, because the difference is *intent*, which the count does not carry.

#### The guard's ONLY effective firing is at mount — observed, and it leaves a residue

**Added at Stage 2 from live observation. The entry above is accurate; this is what it omits.**

The effect's dep array is `[batchRows,batchProfile]`, and row deletion
(`BatchGrid.jsx:546`) replaces the array on every click. **So the effect fires on every intermediate
state.** Deleting 8 rows one at a time:

| State reached | Guard | Result |
|---|---|---|
| 7, 6, 5, 4, 3, 2, **1** | not empty — does not fire | storage overwritten each time. **The 8-row save is gone at the first deletion** |
| **0** | fires, sees 1 row in storage, returns | storage **frozen at 1 row** |

Observed live: deleting all 8 rows then reloading offers a banner for **1 row**. Deleting 2 of 8
leaves 6, as expected — deliberate shrinking persists for every non-zero count.

> **The guard does not preserve "a larger prior save". It preserves whatever the second-to-last
> state happened to be.** By the time it fires, the intermediate writes have already destroyed
> anything larger. The code comment it contradicts is not merely unimplemented — the behaviour it
> describes is unreachable through this code path.

> ### The consequence that matters for the fix
>
> **The only moment the guard is ever effective is at mount** — the one case where `batchRows`
> reaches the effect empty without earlier non-empty writes having overwritten the prior save.
> Every other path writes straight through it.
>
> Since **hydrating `batchRows` on mount eliminates exactly that case**, the guard has no remaining
> purpose after hydration. It is deleted, not reshaped.

#### The real defect is state/storage divergence

`Dismiss` leaves `batchRows` empty in React state while the rows remain in `localStorage`. Every
subsequent write is then "legitimate" by any count rule — the state genuinely does hold fewer rows —
but it persists **a state the user never intended to be in**. The write is not the bug; the
divergence that preceded it is.

> **Fix window: immediately after D-1. Propose before writing.**
> **Investigate the divergence framing first** — make `Dismiss` not leave state and storage
> disagreeing — rather than adding a guard at the write. A guard at the write can only ever see
> counts, and counts cannot encode intent. Options worth weighing: have `Dismiss` clear the stored
> autosave as well as the banner; or hydrate `batchRows` from storage on mount so state and storage
> never diverge in the first place, making the banner a genuine choice rather than the only path
> back to one's own data.

### D-2 — ✅ FIXED at Stage 4 — New Batch warns about what IS recoverable and hides what ISN'T

> **Resolved.** `startNewBatch` no longer calls `setSpec` — **the Costing scratchpad survives.** The
> confirm was rewritten from four named items out of ten state changes into **three lines grouped by
> effect**, naming what changes rather than listing setters.
>
> **`setSetAutoFill(true)` was removed as an EXTENSION of the same ruling**, not a separate change:
> `setAutoFill` is the "auto-derive SET Code from Mat Code" checkbox in the Costing form — workspace
> configuration, the same category as the spec. Resetting it would have made *"keeps your Costing
> spec"* partly false, since the preserved spec would stop behaving as the Maker left it.
>
> **No recoverability is claimed.** `cbb_batch_previous` holds the cleared batch but has no reader,
> so from the Maker's position it is gone; an unqualified *"recoverable"* would invite reliance on a
> route that does not exist.
>
> **The retained client and sector are NAMED in the confirm** — see **PM-6**, the hole this fix
> creates and does not close.

`useCostingBatchBridge.js` → `startNewBatch` (lifted from the Batch Profile bar JSX in the Phase 7
prerequisite). The confirm reads:

> *"Start a new batch? This will clear the current profile, all SKU rows, results, and Quote Items."*

**Four things named. Ten state changes made.**

| Named (4) | Unnamed (6) |
|---|---|
| `setBatchProfile` | **`setSpec`** — the Costing scratchpad |
| `setBatchRows` | `setCostingContext("same-batch")` |
| `setBatchResults` | `setSpecCommitted(false)` — releases the identity freeze |
| `setItems` | `setActiveBatchRowId(null)` — breaks any Deep-Dive link |
| | `setSetAutoFill(true)` |
| | `setExpandedRows(new Set())` |

#### The warning is INVERTED relative to the actual risk — observed first-hand

Confirmed live, not read from code: **after + New Batch, the autosave recovery banner offers the
batch back.** The Costing spec is gone permanently.

So the confirm **names four things that are RECOVERABLE** (the batch survives in
`cbb_batch_autosave`) **and stays silent about the one thing that is not** (`spec` is never
persisted anywhere).

**Practical consequence:** a user who does this and panics can get their batch back. They cannot get
their spec back, and **nothing tells them it is gone** — Costing simply shows *4 BLOCKERS* and looks
like a clean start rather than a loss.

Three of the six unnamed changes alter Costing's **mode** rather than its content: context reverts to
same-batch, the identity freeze releases, and any Deep-Dive link breaks. A user mid-review on a batch
row loses that link with no mention of it.

> **Interacts with D-5 and D-12.** D-5 is why the batch is recoverable at all. D-12 is how a user
> reaches this confirm by reflex, without meaning to.

> **Fix window: was Phase 7's prerequisite; now deferred under the defect freeze.** The handler has
> already moved into the bridge, so the fix has a stable home. **Propose options rather than
> assuming** — name the scratchpad in the confirm, preserve the spec and clear only the batch, or
> offer a third choice. Product decision.

> ⚠️ **These two entries were silently deleted by `b7cc2a4` and restored verbatim from `b7cc2a4^` at the end of Phase 8.** An anchor-replace in that commit consumed them. Nothing was rewritten — the text below is byte-identical to what was recorded originally.

### D-7 — ✅ FIXED at Stage 3 — SET Code case normalisation is asymmetric, breaking parent resolution

> **Resolved.** Parent resolution now runs through a single helper, `sameSetCode()` in
> `engine/rowType.js`, enforced by `scripts/audit-setcode.py`. Commits `0453d0a` (helper + four
> sites) · `50e47b5` (the SET completeness export gate) · `8a88544` (the guard script).
>
> **The extent was wider than recorded — eight sites, six files, three conventions**, not four.
> See the pattern note in the register introduction: this is the third time.

#### Three things about the fix that will otherwise be misread

**1 · `BatchGrid.jsx:254` is DEFENSIVE, not load-bearing — and is likely unreachable
differentially.** An assumed SET Code is *copied verbatim* from its parent Box
(`BatchGrid.jsx:298`, `useQuoteActions.js:395`), so it cannot differ from that parent in case. The
only way to make it differ is to type in the field — and typing clears `setCodeAssumed` at
`BatchGrid.jsx:311`, which removes the confirm control from the DOM before it can be used.

> **How it was tested, so nobody repeats it and reads the result as a failure.** The product owner
> created a Part-L, typed the SET Code as lowercase `glass180`, and confirmed. **Auto-dims filled;
> Nos/Set did not.** That is not `:254` failing — `handleConfirm` never ran, because typing had
> already removed its control. Auto-dims run on render via `autoCalcPPDims`; Nos/Set auto-fill lives
> only inside `handleConfirm`. Same parent, two different entry points.

**2 · `normSetCode` deliberately does NOT collapse internal whitespace.** It trims and uppercases,
so `"Glass 180"` and `"Glass180"` remain **distinct** SET Codes. **A decision, not an omission** —
collapsing internal spaces would merge codes a user typed differently on purpose. Do not "fix" it.

**3 · The guard script has a blind spot, and it is weaker than the other exceptions.**
`scripts/audit-setcode.py` cannot see `setCode` inside a **composite key**: `useQuoteActions.js:167`
builds a template literal and compares whole strings, so no `setCode` operand exists syntactically
and no regex reaches it without parsing. **That exception is enforced by nothing.** A green exit
from the script does not cover it, and it is recorded here as well as in the script header because
an exception documented only inside the tool that cannot enforce it is documented in the wrong place.

> **Also unchanged, deliberately:** `sameSetCode("","")` is **true**, exactly as the previous code
> was. Two of the four sites have no empty-guard, so two rows with blank SET Codes match each other.
> Almost certainly wrong — blank means "not in a SET" — but it is a second behaviour change and is
> **ruled to be FALSE in its own commit, after the case fix is verified**, so that if parent
> resolution misbehaves it is unambiguous which change did it.

Two entry points normalise differently, and the two consumers compare differently:

| Site | Behaviour |
|---|---|
| Costing SET Code input — `QuotationApp.jsx:250` | `s("setCode", v.toUpperCase())` — **forces uppercase** |
| Costing's own parent lookup — `:284–289` | `.trim().toUpperCase()===` on both sides — **case-insensitive** ✓ |
| Grid SET Code input — `:1860` | `upd("setCode", e.target.value)` — **no normalisation** |
| Grid parent predicates — `:1805`, `:2149` | `.trim()===` — **case-sensitive** ✗ |

So a SET created in the grid as `Glass180` can **never** be matched by a row sent from Costing,
which stores `GLASS180`. Costing's own auto-dims lookup would match it; the grid's Glass-SKU parent
resolution will not.

**Observed in live data.** After sending a Part-L from Costing under SET `Glass180`, the batch held:

```
Glass180     Box      setCode "Glass180"   glassSKUType "Nip 180"
Glass180-P   Plate    setCode "Glass180"   glassSKUType null
ZZTEST-A     Part-L   setCode "GLASS180"   glassSKUType "Pint 375"
```

The Part-L is visually in the same SET and is not, as far as `:1805`/`:2149` are concerned.

> **Interaction with D-1, worth knowing.** D-1's `parentBox?.glassSKUType||row.glassSKUType||""`
> fallback **masks this**: with no parent matched, the row's own value is used and the display reads
> *"(from Costing — Main Box not yet set)"* — which is accurate but attributes the miss to the Box
> being unset rather than to a case mismatch. Nos/Set still auto-fills correctly. So D-7 degrades
> quietly rather than failing loudly, and only because D-1 landed first.

> **Fix window: not assigned.** Pre-existing, unrelated to the split. The obvious fix is to
> normalise in one place — either uppercase at both inputs, or compare case-insensitively at both
> predicates (Costing already does the latter at `:288`). Choosing between them affects existing
> stored data, which carries mixed case today.

### D-6 — Backup filenames cannot distinguish two snapshots from the same day

`state/useQuoteActions.js`, in `handleBackup`:

```js
a.download=`CFB_QOS_Backup_${d.getFullYear()}${MM}${DD}.json`;
```

No time component. Every backup taken on the same day gets an identical filename. Nothing is
overwritten — the browser saves the second as `…(1).json` — but **provenance becomes guesswork
within hours.**

Not hypothetical: it is exactly the confusion that arose during D-5 recovery. A `20260824` file
timestamped 09:14 turned out to be masters-only (0 rows, 0 items, 0 constructions), while the
restore that had actually populated the test pane came from something else. With only a date in the
name there was no way to tell the two apart from the filesystem.

Low severity and a trivial fix — add `HHMM`, or use the `_ts` already written inside the file. But
**the entire safety story for this refactor rests on these files**, and a name that cannot separate
two snapshots taken an hour apart undermines it.

> **Fix window: the KEYS-registry / backup commit, alongside D-3.** Same file, same concern.

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

### D-20 … D-22 — observations from Stage-1 verification of the defect pass

Recorded under the same one-line rule as D-14…D-17: **what was observed, and where.** The
record-don't-investigate rule has lifted for defects *being worked*; these are new sightings from a
verification session and are bookmarks, not tickets. One exception is marked below.

| # | Observed | Class |
|---|---|---|
| **D-20** | `+ New Construction` gives no visible feedback — the draft entry is appended at the bottom, off-screen, and the user must scroll to discover anything happened. Needs to direct the user to the new entry; scroll-to vs overlay vs modal is a design choice for the product owner | UX |
| **D-21** | The Defaults/Masters screen is cut off at the bottom — content height exceeds the viewport with no scroll affordance at the cut point | Layout |
| **D-22** | The 🍶 badge below Nos/Set renders for some Part rows and not others (`Pint 375` yes, `Nip 180` no) | **Cosmetic/UX — see below.** Related to **D-1**, not D-8 |

#### D-22 — the 🍶 badge has no parent fallback. RETRACTED AND REWRITTEN

> ### ⚠️ THE FIRST VERSION OF THIS ENTRY WAS WRONG, AND WAS PUSHED
>
> It claimed D-22 was a **data** defect — that the row held a `skuType` no longer in
> `partitionsMaster`, that this was **D-8's mechanism in the wild**, and that Nos/Set auto-fill was
> probably producing silent wrong numbers. It was rated **High**. **Every part of that is false.**
>
> **The wrong render path was read.** `BatchGrid.jsx:584` is the **expanded-row panel for Box
> rows**, which renders a "Part-L: n pcs · Part-W: n pcs" tag and *does* gate on
> `partitionsMaster.find(...)`. The badge actually being reported is `BatchGrid.jsx:340`, in the
> **main grid's Nos/Set cell**, which does not consult the master at all. The structural argument
> was sound about the code that was read and irrelevant to the code in question.
>
> **It was caught by domain knowledge, not by code review** — the product owner knew both master
> values were healthy and challenged the conclusion. **That is the second time a claim in this
> project has been wrong in a way only a check could catch** (the first: `scripts/eslint-baseline.txt`
> described as a live gate when it is a Phase 0 snapshot). A confident mechanism, derived from real
> source, can still be about the wrong source.

**The actual condition** — `BatchGrid.jsx:340`, one line, no master lookup:

```js
const isAlcoPart = batchProfile.sector==="ALCOBEV" && (row.itemType==="Part-L"||row.itemType==="Part-W");
{isAlcoPart && row.glassSKUType && ( … 🍶 {row.glassSKUType.substring(0,8)} … )}
```

**The badge reads `row.glassSKUType` and nothing else.** No parent fallback. So a Part row whose
SET carries the value on its **Box** shows no badge, while a Part row that happens to carry its own
value does.

Confirmed against live data (`CFB_QOS_Backup_20260827_0012.json`), master healthy in every respect:

| SET | Box | Plate | Part-L | Part-W | Badge on Parts |
|---|---|---|---|---|---|
| Glass180 | `'Nip 180'` | `None` | `None` | `None` | **no** |
| Glass375 | `''` | `''` | `'Pint 375'` | `'Pint 375'` | **yes** |

`partitionsMaster` holds all eight entries intact — `'Nip 180'` (lwise 5, wwise 7) and `'Pint 375'`
(lwise 3, wwise 5), no ` ml` suffix on any stored key. **Nothing is stale and nothing is orphaned.**

#### This is D-1's accepted limitation surfacing as an observable inconsistency

D-1 lists three Part-row read sites and gives the badge **no** fallback deliberately, on the
reasoning that it "starts working once the row carries a value." The other two resolve
`parentBox?.glassSKUType || row.glassSKUType`. **The badge is the only one of the three without
parent-first resolution**, and that is precisely what produces the reported difference.

> ### The fix is one line and already specified by its siblings
>
> **Give the badge the same parent-first resolution the other two consumers already have** —
> `parentBox?.glassSKUType || row.glassSKUType || ""`, the precedence rule D-1 established. **Do not
> invent a new mechanism.** The parent-lookup predicate is already written at
> `BatchGrid.jsx:253` and `:597`.

> ### ✅ Nos/Set auto-fill is VERIFIED CORRECT — do not re-open
>
> The retracted entry speculated that auto-fill shared the badge's gate and might be producing
> silent wrong numbers. **It does not, and it is not.** `BatchGrid.jsx:260` resolves parent-first
> before the master lookup:
>
> ```js
> const effGlassSKU = parentBox?.glassSKUType || row.glassSKUType || "";
> const pm = partitionsMaster.find(x => x.skuType === effGlassSKU);
> ```
>
> Demonstrated end to end against live data: **all four Part rows resolved correctly**, including
> the two that carry no `glassSKUType` of their own and reached the master through their parent Box.
>
> | Row | `nosPerSet` | Master |
> |---|---|---|
> | Glass180 Part-L | 5 | `'Nip 180'` lwise 5 ✓ |
> | Glass180 Part-W | 7 | `'Nip 180'` wwise 7 ✓ |
> | Glass375 Part-L | 3 | `'Pint 375'` lwise 3 ✓ |
> | Glass375 Part-W | 5 | `'Pint 375'` wwise 5 ✓ |
>
> **No silent wrong numbers. D-8 stays at Stage 4** — this was not an argument for moving it.

**Second part, design only:** even when correct, the tag expands row height and costs vertical
space, which compounds badly on a 20+ SKU batch. That half is a design call for the product owner,
not a correctness fix.


---

## Design positions — decided, not overlooked

Recorded so a later reader knows these were considered and settled. **Not defects. No fix window.**

### DP-1 — The batch grid signals THAT a row is non-compliant, not WHY

Finding the reason requires Deep Dive. **This is deliberate and stays.** The grid is already dense
with frozen columns, and inlining per-row mismatch reasons would crowd every row for a case that is
occasional.

> **Do not "improve" the grid by adding a reason column.** It was considered and rejected on density
> grounds.

### DP-2 — Manual Restore does NOT repopulate the grid directly, and that is deliberate

**Confirmed from source, not inferred.** `handleRestoreFile` writes `cbb_batch_autosave` like any
other key and reloads. On mount, `batchRows` initialises **empty** — only `autosaveBanner`
(`useBatchState.js:55`) reads that key, and only to build a *label* from `ts` and `rows.length`.
`restoreAutosave()` is the sole path that puts rows into state, and it is user-invoked from the
banner.

So a manual Restore is a **two-step**: Restore writes the data, the banner offers it, the user
accepts. That is D-5's symptom, and it is **also a guard worth keeping**:

> **Clicking Restore cannot silently overwrite batch entries the user has not looked at.** A second,
> explicit confirmation stands between a restore and the grid being replaced. **Ruled: deliberate,
> not accidental.**

> ### 🛑 CORRECTION — the guard described above SILENTLY EXPIRES, so DP-2 does not currently
> exist in the form it was decided in
>
> The banner is age-gated: `if(ageMin>10080||!rows?.length)return null` (`useBatchState.js:64`) —
> **7 days**. Past that the rows remain in `localStorage` and the banner never appears, so there is
> **no route back to them through the UI at all.**
>
> **This is not a footnote on DP-2; it is a hole in it.** The position was ruled on the basis that a
> second confirmation always stands between a manual Restore and the grid being replaced. For any
> autosave older than a week that confirmation is not merely absent — **the data is unreachable**,
> which is a worse outcome than the silent overwrite the guard was meant to prevent.
>
> **DP-2 therefore states an intent, not the current behaviour.** What is decided is that the
> confirmation *should* exist. What is implemented expires after 7 days.
>
> **Whatever replaces the banner must satisfy both:** preserve the confirmation, and **not inherit
> the expiry.** See the blocking constraint on D-5 in
> [`defect-pass-plan.md`](defect-pass-plan.md) §4.2.

### QE-1 — Queued enhancement: put the mismatch reason in the EXPANDED SUB-ROW

Not a defect, not part of the split. If the "why" is wanted, the sub-row is the right home —
**not a tooltip, and not a new grid column**:

* the sub-row already exists and already carries per-row detail;
* it is opened by exactly the person who saw the flag and wants to know why, so the reason appears
  where they are already looking;
* zero grid-density cost, no new UI surface;
* a tooltip is too cramped for something like *"BS 6.2 against NLT 9.0"*, and Deep Dive is too heavy
  — it hydrates the whole spec into Costing just to read one line.

DP-1 still stands: the grid signals THAT, not WHY. This only makes the WHY one click away instead of
a full Deep Dive.

> **Lands after Phase 8.** The expanded-row IIFE is explicitly on Phase 7's leave-alone list, so this
> work waits until that code is in its final location.

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
