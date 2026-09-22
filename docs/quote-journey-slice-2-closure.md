# Quote journey — slice 2: the lane is chosen, and every cue tells the truth about it

**Status:** implemented and locally verified 2026-09-22. Fixture-browser evidence only. Not
committed, not deployed, not authenticated-live, not Product Owner accepted.

**Builds on:** [`quote-journey-slice-1-closure.md`](quote-journey-slice-1-closure.md).
**Review input:** [`cost-calculation-journey-ux-review-2026-09-22.md`](cost-calculation-journey-ux-review-2026-09-22.md)
(CC-01, CC-05, CC-07, CC-10).

**Decisions relied on, not reopened:** CDM-02 (START is a private browser-local scratchpad; durable
work begins only through explicit Create New Batch; Batch Entry alone calculates), CDM-21 (the
customer-facing Quote reference is allocated at first approval), CDM-22 (Send freezes evidence),
CDM-24 (approval and Issue are separate; download never proves issuance).

---

## 1. The defect this removes

Slice 1 derived the lane with `durableBatch?.id ? governed : local`. That is wrong in the case that
matters: a Maker who opens a governed Batch to look at it, then does a private calculation, had
their private work labelled **Customer quote**. Binding a Batch is not consent.

The lane now has two inputs, and the stricter one wins:

1. an **explicit, persisted selection** the user made (`quick` | `customer`), and
2. the **actual authority of the artifact** in front of them.

A selection can never manufacture authority. Choosing *Customer quote* leaves the work in
`customer_pending` — visibly not governed — until a governed Batch has actually been created or
opened **and its id matches the id stored with the selection**.

## 2. End-to-end behaviour

| Moment | What the user sees |
|---|---|
| New quote work, nothing chosen | The lane control opens by itself. TopBar: `LANE NOT CHOSEN`. Next: *Choose how this work is saved*. |
| Chooses **Quick calculation** | `Quick calculation`, dashed/local. Persisted to `cbb_quote_lane`. Never asked again. |
| Chooses **Customer quote** | `Customer quote — not started` (red) while the governed-creation panel is open. Nothing claims governed authority yet. |
| Batch comes back | `Customer quote · NAG/BAT/25-26/7`. This is the one place a selection becomes governed. |
| Backs out of creation | Falls back to Quick rather than leaving a pending intent for a workflow they abandoned. |
| Opens a governed Batch while in **Quick** | Lane stays `Quick calculation`. The Batch stays bound and visible in the TopBar; the *work* is still private. |
| Returns to Quick from a Customer quote | Lane becomes local. The governed Batch is left exactly as it is — never downgraded or mutated. |
| Reload | The selection survives; the Batch binding does not (it is session state), so the lane correctly reads `Customer quote — not started` and Next says *Create or open the governed Batch*. The question is **not** re-asked. |

### Promotion — Quick → Customer quote

Selecting *Customer quote* while local rows exist is a **promotion**, and the creation panel says so
before the user commits: *"Keeps your SKU rows as inputs and keeps the customer and route. Clears
every local price and the Quote Items — governed Calculate produces the real prices."*

`completeNewBatchStart` gained one defaulted option, `keepLocalInputs`. On a promotion it keeps
`batchRows` and re-applies the customer, route, customer type, price context and payment terms that
the governed Batch does not itself carry; it **always** clears `batchResults`. That split is the
point: inputs may be reused, a browser-local price may not become governed evidence by being looked
at inside a governed Batch. The ordinary `+ New Batch` path is byte-for-byte unchanged.

> **This was caught in the browser, not in the fixtures.** The first implementation showed the
> toast *"Inputs kept"* while `completeNewBatchStart` cleared the rows — `cbb_batch_autosave` came
> back with `rows: 0`. The message was false, which is exactly the class of defect this programme
> exists to remove, so the behaviour was fixed rather than the message.

## 3. Shareability moved off the lane

`journeyState` no longer reports `shareable` at all. Whether a customer may be given something is a
property of an approved, current **Quote revision** (CDM-21, CDM-24), never of a lane:

- `revisionShareability(revision)` returns `{ shareable, shared, reason }`. Approved or issued and
  `standing: current` is shareable; draft, submitted, superseded and voided are not. *May be shared*
  and *has been shared* are two separate facts.
- `artifactContext({ kind, revision })` gives each Quotes view its own provenance.
- A governed Batch with no approved revision is **not** shareable — governed and shareable are
  different claims.

The governed and History views each render `ShareabilityNote` for **their own** selected revision,
and the TopBar journey cue is absent from both. Quotes → Working keeps the working journey.

## 4. Readiness stopped lying about partial calculation

`Object.keys(batchResults).length` counted refused rows (`newResults[row.id] = null`) and rows that
had since been deleted. A two-row batch with one refused row therefore read **"✓ Ready to send"**
and then dropped a row into a toast after the click.

- `calculatedRowCount(rows, results)` counts rows with a **truthy** result.
- `sendReadiness(...)` returns one verdict — `empty` / `blocked` / `partial` / `ready` — with
  `canSend` and a `summary`.
- The TopBar count, the toolbar chip and the Send button's `disabled` and `title` all read that one
  verdict, so they cannot describe three different behaviours.

`results_incomplete` is a checklist item, not a refusal: Send *is* permitted (a row refused for
unresolved freight must not block the rest of the batch), but it says *"Send would create 1 item and
leave 1 row out of the customer document"*, and the chip reads **"⚠ Send 1 of 2 rows"**.

## 5. Next action points at a control that exists

*"Build the customer document"* navigated to an empty Working Quote Items view while the control that
fills it — Send All to Quote Items — stayed behind on Batch Builder. `next` now carries a `focus`
target (`FOCUS.lane` / `.calculate` / `.send` / `.workspace`); the TopBar switches surface only when
needed, then scrolls, focuses and briefly outlines the named control.

## 6. Files changed

| File | Change |
|---|---|
| `src/lib/quoteJourney.js` | `LANES` reworked to four states; `LANE_CHOICES`, `resolveLane`, `laneSelectionApplies`, `revisionShareability`, `artifactContext`, `calculatedRowCount`, `sendReadiness`, `FOCUS`; `journeyState` takes `laneSelection` and drops `shareable` |
| `src/state/useQuoteLane.js` | **new** — persisted selection (`cbb_quote_lane`), four transitions, promotion tracking |
| `src/state/AppStateProvider.jsx` | composes `useQuoteLane` after the Batch binding, before `useQuoteActions` |
| `src/state/useQuoteActions.js` | feeds `laneSelection` into the journey; publishes one `quoteReadiness` |
| `src/state/useCostingBatchBridge.js` | `completeNewBatchStart(batch, { keepLocalInputs })` |
| `src/tabs/batch/BatchGrid.jsx` | `LaneControl`; `SendReadiness` rebuilt on the verdict; focus ids on Calculate/Send/workspace |
| `src/tabs/batch/NewGovernedBatchPanel.jsx` | binds the Batch to the selection; promotion-aware impact summary; backs out to Quick |
| `src/ui/TopBar.jsx` | lane states; focus-aware Next; cue absent from Governed/History |
| `src/ui/screenChrome.jsx` | `ShareabilityNote` |
| `src/ui/primitives.jsx` | `Btn` forwards `id` and `title` |
| `src/tabs/QuotesScreen.jsx`, `src/tabs/QuoteCatalogueScreen.jsx` | per-revision shareability |
| `scripts/journey-fixtures.mjs` | rewritten: JR-1..JR-49 behaviour, JR-50..JR-66 wiring |
| `scripts/pricing-basis-fixtures.mjs` | U4-FE-23 repointed at the stable signature prefix |

## 7. Verification

**Fixtures — the complete named suite passes.** `test:journey` **69/69**,
`test:construction-safety` 15/0, `test:screen-standard` 38/0, `test:pricing-basis` 108/0,
`test:module-contract` (production build) clean. ESLint clean on every touched file.

**JR-18, JR-19 and JR-20b were replaced, not kept.** They asserted that a bound Batch made the lane
governed, that a fully calculated batch pointed at the Quotes screen, and a checklist with no
partial state — the three defects this increment removes. Replacements: JR-17/JR-19, JR-41,
JR-36..JR-38.

**One pre-existing gate needed repointing, not relaxing:** `U4-FE-23` pinned
`completeNewBatchStart=(governedBatch=null)=>` verbatim. Its claim (sector inheritance survives a
new-Batch reset) is untouched; only the signature gained a defaulted second argument.

**Fixture-browser, 1366×768, light scheme.** No-credential fetch-stub shell with a labelled fixture
profile; `/batches`, `/batches/create-options` and the lock release stubbed so the real governed
creation path runs. No authenticated read or write.

| Scenario | Observed |
|---|---|
| Cold start, nothing chosen | Chooser opens; `LANE NOT CHOSEN`; Next *Choose how this work is saved*; Send disabled, "Calculate before sending" |
| Partial calculation (1 of 2 rows) | Chip `⚠ Send 1 of 2 rows`; Send **enabled** with matching title; TopBar `1 TO FIX`; Next *Calculate the remaining rows*; checklist *"1 row still has no price"* + *"SEND IS ALLOWED — THE ROWS ABOVE ARE LEFT OUT"* |
| Send with a refused row | Toast `⚠️ 1 row(s) skipped (no result): Row 2 [36513]` — the behaviour the label predicted |
| Governed Batch bound, lane Quick | Lane `Quick calculation`; `NAG/BAT/25-26/7` still shown; Working items still local |
| Quick → Customer promotion | Panel states the outcome; lane `Customer quote · NAG/BAT/25-26/7`; `autosaveRows: 1` (kept); `client: "Indo Rama"` (kept); readiness back to *Calculate before sending*; stage 4 → 2 |
| Customer → Quick | Lane local again, governed Batch untouched and still bound |
| Reload | `cbb_quote_lane` survives; lane reads `Customer quote — not started`; not re-asked; rows kept |
| Reopen the same Batch | Lane restored silently, no second question |
| Quotes Working → Governed → History | Journey cue present only on Working. Governed: `Revision 2 · Issued · Current · CUSTOMER Shared · may be re-sent`; selecting `Revision 1 · Approved · Superseded` → `CUSTOMER Not shareable` ("A later revision has superseded this one") |
| Next focuses its control | `journey-send-control` and `journey-calculate-control` receive focus; the user stays on Batch Builder |

**A hook-order error appeared in the console and was investigated, not ignored.** It was an HMR
artefact from adding a `useCallback` to `useQuoteLane.js` while the app was mounted. A clean tab
loads with **no console errors**; the cold-start walkthrough above ran in that tab.

**Not evidence of:** deployment, authenticated-live behaviour, governed Calculate/Send, any real
workflow transition, or Product Owner acceptance.

## 8. Follow-up debt

- **Governed rows are still not created from the promoted inputs.** The promotion keeps the local
  rows and clears their prices, and the UI says to create the governed rows in the Batch workspace.
  Creating them from the local inputs is a governed write and is the next slice.
- **Batch Builder toolbar is 73px (two rows) at 1366×768** — unchanged in character from slice 1's
  74px; the lane control added ~150px and the readiness summary shortened. Still decision **D-8** in
  [`quote-journey-decision-packet-2026-09-22.md`](quote-journey-decision-packet-2026-09-22.md).
- **Quotes → Working still has the free-text Quote Ref box** (decision **D-2**).
- Stages 6–7 (Approval, Shared) remain named but not instrumented (decision **D-4**).
