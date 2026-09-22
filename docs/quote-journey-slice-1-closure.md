# Quote journey — slice 1: one stage vocabulary, and verbs that name their consequence

**Status:** implemented and locally verified 2026-09-22. Fixture-browser evidence only. Not
deployed, not authenticated-live, not Product Owner accepted.

**Input:** [`cost-calculation-journey-ux-review-2026-09-22.md`](cost-calculation-journey-ux-review-2026-09-22.md).
That document is a review record, not an authorisation; this slice implements only the part of it
that no unresolved product decision stands in front of.

**Decisions this slice relies on and does not reopen:** CDM-02 (START is a private browser-local
scratchpad; durable work begins only through explicit Create New Batch; Batch Entry alone
calculates), CDM-21 (the Quote reference is allocated at first approval), CDM-39 (private START
scratch survives a Supabase outage; formal operations do not).

---

## 1. What a Maker can now do that they could not

| Acceptance question (review §Success criteria) | Before | After |
|---|---|---|
| Is this a scratch calculation or the authoritative Quote calculation? | Inferred from which screen you were on. | Every journey screen carries a lane chip — **Quick calculation** or **Customer quote** — and both local Batch Builder actions carry a `LOCAL` tag inside the button. |
| What is incomplete or unsafe? | Discovered after clicking, as a toast that disappears. | A persistent **`N to fix ▾`** control in the Batch Builder toolbar lists every reason Send will refuse, before the click, in the refusal's own words. |
| What should I do next? | Inferred from disabled controls and dispersed chips. | One **Next** button in the TopBar names the next outcome and navigates to the surface that owns it. |
| Where am I? | The screen name. | `Step n of 7 · <stage>`, derived from the work, not from the screen. |
| Has this exact revision been shared? | — | Not yet. Stages 6–7 (Approval, Shared) exist in the vocabulary but are not yet instrumented; they are a later slice and depend on decision **D-4** below. |

## 2. The change

### 2.1 One readiness model, not two opinions — `src/lib/quoteJourney.js` (new, pure)

`localWorkBlockers()` is the local lane's equivalent of `durableBatchPreparation()`
(`batchRowModel.js`), which the governed lane has had all along. The important property is that it
is not a second checklist rendered beside the real one:

- `useQuoteActions.calculateAll` refuses on `firstRefusal(localWorkBlockers(…), "calculate")`;
- `useQuoteActions.sendAllToQuoteItems` refuses on `firstRefusal(localBlockers(), "send")`;
- the toolbar renders the **same objects**, with the same `title`, `message` and `duration`.

The four refusals — assumed SET Code, incomplete Construction, unresolved route, stale results —
are unchanged in substance, wording and toast duration. `JR-22` asserts that not one of those
message strings survives as a second copy inside `useQuoteActions`.

`journeyState()` derives the lane, the stage and the single next action from state the application
already held. It decides nothing: `shareable` is true only for a bound governed Batch, because
CDM-21 allocates the customer-facing reference at first approval and nothing in the local lane can
have one.

`sendChecklist()` is the one list both readers render, so the TopBar's "N to fix" and the toolbar's
"N to fix" are the same N (`JR-20d`). It adds one item the blocker register deliberately does not
carry — *nothing is calculated yet* — because that condition **disables** Send rather than being a
refusal Send raises; putting it in the register would make `firstRefusal` hand back a message the
action never shows (`JR-20c`).

### 2.2 One deliberate behaviour change

`sendAllToQuoteItems` now evaluates **all four refusals before** its two `window.confirm`
prompts (mixed-client, Cobb-without-coating). It previously checked route and Construction, then
prompted, then checked stale results and SET Codes.

Nothing that was permitted becomes blocked and nothing blocked becomes permitted. What changes is
that the Maker is no longer asked to confirm a send that was about to be refused anyway. The two
confirmations deliberately stay inside the action and out of the readiness model: they are prompts
the Maker may answer "proceed" to, not facts about readiness (`JR-24`).

### 2.3 Verbs that name the outcome

| Control | Was | Now | Review item |
|---|---|---|---|
| Batch Builder | `⚡ Calculate All` | `⚡ Calculate All` + `LOCAL` | CC-03 |
| Batch Builder | `→ Send All to Quote Items (calculate first)` | `→ Send All to Quote Items` + `LOCAL`; the "(calculate first)" reason moved into the readiness list, which states it in full | CC-04, and §2.5's rule that a disabled control says why |
| Batch Builder | `↓ Import profile` | `↓ Copy from Costing`, with a title naming what is copied and what it replaces | CC-08 |
| Batch Builder | `+ New batch` | `+ New customer quote`, amber-filled, with a title contrasting it against the quick calculation on the same screen | CC-01, CC-06 |
| Costing | `✕ Unlink` | `✕ Close review` | CC-25 |
| Costing | `→ Send to Batch Entry` | `→ Add to batch` | CC-04 |
| Costing | *(nothing)* | a permanent `Private draft · this browser only` / `Session copy · not saved until Push` tag in the existing subtab strip | CC-24 |

Every handler, disabled condition, confirm rule and guard is untouched. The two placement gates
that pin these controls (`SS-36`, `U4-FE-11a`) assert handler names and ordering, and both still
pass.

### 2.4 No new band

The journey cue lives in the existing 48px TopBar, which was empty in its middle third. The
screen-space standard's "one toolbar per panel, no second band" is intact (`JR-27`). The redundant
`LOCAL` tag beside the working-row count was removed: the lane chip 60px away already says it.

## 3. Verification

**Automated — the complete named suite, 2026-09-22:** every `test:*` script passes.
New gate `npm run test:journey` — **36/36** (`JR-1..JR-30`), of which `JR-1..JR-20f` drive the pure
model with real arguments and `JR-21..JR-30` assert the wiring and the labels.

Two existing gates were repointed rather than relaxed, because the code they assert moved:

- `CON-SAFE-12` — the "cannot send an incomplete Construction" guard is now read from
  `quoteJourney.js`, **and** the check additionally asserts that both actions refuse through it.
  The claim is strictly stronger than before.
- `SS-31` — the Batch Builder toolbar's local `gap:8` override is gone; it now uses the shared
  toolbar's own gap of 6. The shared token and the pinned `lineHeight` are unchanged.

**Fixture-browser, 1366×768, light scheme** (no-credential fetch-stub shell; a labelled fixture
profile, no backend, no authenticated read or write). Seeded through the app's own `cbb_*`
persistence, then driven by clicking the real controls:

| Step | Observed |
|---|---|
| Sign in, empty workspace | `QUICK CALCULATION · Step 1 of 7 · Customer · NEXT Name the customer you are quoting`. No "to fix" chip — an empty workspace has an unresolved route by definition and must not be greeted with a fault it cannot act on. |
| Costing | `START · PRIVATE DRAFT · THIS BROWSER ONLY`, `→ Add to batch`. |
| 2 rows, one assumed SET Code, one incomplete Construction, none calculated | `Step 2 of 7 · Products · NEXT Confirm 1 assumed SET Code · 3 TO FIX`, and the toolbar disclosure lists the same 3, verbatim: *Calculate the batch first*, *Confirm 1 assumed SET Code*, *Complete 2 Constructions*. |
| Click `⚡ Calculate All` | Refusal toast is **byte-identical** to the first listed item: `⚠️ Confirm SET Codes first: Row 2 [36512-P] — click the orange ! in its SET Code`. |
| Blockers cleared, `⚡ Calculate All` | Both rows calculate. `Step 4 of 7 · Review`, `✓ Ready to send`. |
| `→ Send All to Quote Items` | 2 Working Quote Items created. `Step 5 of 7 · Customer document`. |
| Quotes screen | Lane still reads `QUICK CALCULATION`; Next says *"Review the customer document — this is a quick calculation, it carries no governed Quote reference."* |

**Not evidence of:** deployment, authenticated-live behaviour, governed Calculate/Send, any
workflow transition, or Product Owner acceptance.

**Two defects this verification found and fixed before the slice closed**, both of the kind only a
browser session surfaces:

- The TopBar counted blockers while the toolbar counted blockers **plus** "nothing is calculated
  yet", so the same screen read `1 TO FIX` and `2 to fix ▾` 400px apart. Both now render
  `sendChecklist()` (`JR-20d`).
- Working Quote Items persist in `cbb_quoteitems` and outlive the rows that produced them, so a
  **new** batch of two uncalculated rows reported `Step 5 of 7 · Customer document` while its next
  action correctly said `Confirm 1 assumed SET Code`. The stage is now a ladder in which each step
  requires the one before it (`JR-20e`, `JR-20f`). A stage that disagrees with the next action is
  worse than no stage at all.

## 4. Debt this slice records and does not fix

- **The Batch Builder toolbar is two rows at 1366×768.** Measured: 69px before this slice, 74px
  after; content 1206px against 1142px available. This is a pre-existing condition at the beta
  laptop width that a 1440px development viewport hides. Removing the local `gap:8` and shortening
  the Construction Library label recovered ~40px, which was not enough. The fix that works is to
  put `↓ Copy from Costing`, `+ New customer quote` and `Code tools ▾` behind one disclosure
  (~200px saved, comfortably one row) — but `SS-36` and `U4-FE-11a` pin those three in the toolbar
  from a Product Owner–accepted U4 pass, so it is **decision D-8 below**, not an implementation
  choice to make quietly.
- Stages 6 (Approval) and 7 (Shared) are named but not instrumented. They depend on **D-4**.
- The governed lane still computes its readiness through `durableBatchPreparation`. The two models
  are deliberately separate — they describe different authorities — but the TopBar currently
  reports the local lane's blocker count even when a governed Batch is bound. Converging the two
  counts is a later slice and depends on **D-3**.

## 5. Not touched

Calculation, authorization, tenant/plant isolation, immutable history, blank-versus-zero, CalcGate,
the workflow gates, the governed Batch workspace, every backend route, and every migration.
