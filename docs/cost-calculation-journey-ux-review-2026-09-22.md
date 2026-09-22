# Cost-calculation journey UX review — 2026-09-22

**Status:** first-pass review record. This document records usability hurdles; it is not an
implementation authorization and does not supersede product, calculation, authorization, or data
model decisions.

## Review question

How intuitive is the current frontend journey for a Maker who needs to create, understand, verify,
and progress a cost calculation? Record everything that makes the journey harder either to
**execute** or to **comprehend**.

## Product UX north star

The fundamental user journey is:

```text
Log in
  -> make a quote quickly and correctly
  -> share it with the customer
  -> negotiate and revise it when needed
  -> retrieve and compare old approved quotes
  -> maintain and reuse customer-specific knowledge when relevant
```

This entire chain—not only the arithmetic—must feel like one coherent job. The user's mental model
should be **the customer and their quote**. Batch identity, calculation persistence, locks, local
previews, immutable revisions, Pricing Groups and evidence snapshots are supporting controls. They
should protect the work without becoming the navigation model the user must learn first.

The interface should let a user answer these questions immediately, in ordinary commercial
language:

1. **Who am I quoting?**
2. **What products and quantities are being quoted?**
3. **Is the price complete and safe to share?**
4. **What exactly will the customer receive?**
5. **Has it been shared, and what happened next?**
6. **Am I revising the current quote or creating a separate alternative?**
7. **What did we quote and approve for this customer previously, and what changed?**
8. **Which customer-specific facts should be reused now?**

### Intuitive-journey standard

A normal user should not need to understand the distinction between local state and governed state
in order to take the correct path. The product should make the safe path the obvious path and reveal
governance detail only when it helps the user resolve an exception, audit a decision, or compare
history.

The primary journey should therefore read approximately as:

```text
Customer / enquiry
  -> Quote workspace
  -> Add products and calculate
  -> Review completeness and commercial exceptions
  -> Preview customer quote
  -> Share
  -> Record response / negotiate
  -> Revise with visible comparison to the prior revision
  -> Approve and retain as customer history
```

Customer history and customer-specific data should remain accessible from the Quote workspace
without forcing the user into separate master-data screens during ordinary quote preparation.

## Scope and evidence

Reviewed the implemented path across:

1. **Start Costing** — START draft, Batch Context, specification input, live result and REVIEW.
2. **Batch Builder** — local working grid, local Calculate All and local Quote Items handoff.
3. **Governed Batch workspace** — durable row preparation, trusted Calculate, readiness and Atomic
   Send.
4. The navigation and state cues connecting Costing, Batch Builder, My Batches and Quotes.

Evidence came from the current frontend source and the unauthenticated development entry screen.
The repository does not provide a costing fixture entry point, and no signed-in test persona was
available in this review session. Consequently, visual behaviour behind authentication has not yet
been re-observed in a genuine browser session. Source-level interaction paths, labels, disabled
conditions and state transitions were reviewed in full; viewport behaviour and subjective user
response remain to be validated with a Maker.

## Current journey, as the interface makes the user assemble it

```text
Start Costing (local scratch)
  -> complete Batch Context + SKU specification
  -> costing appears automatically
  -> Send to Batch Entry

Batch Builder (local working grid)
  -> possibly create/bind a governed Batch separately
  -> maintain local preview rows
  -> Calculate All (local calculation)
  -> Send All to Quote Items (local working items)

Governed Batch workspace (panel inside Batch Builder)
  -> acquire lock
  -> create/revise durable profile, Pricing/Delivery Groups and durable rows
  -> optionally copy durable rows to local preview
  -> resolve governed values and freshness
  -> Calculate governed rows (persisted calculation)
  -> Atomic Send (immutable draft candidate)

Quotes
  -> Submit -> Approve/Return -> Issue
```

The application contains good local explanations for individual states, but it does not present
this end-to-end map to the user. Discovering it is currently part of doing the work.

## Hurdle register

Impact types: **E** = makes execution harder; **C** = makes comprehension harder; **E+C** = both.

Severity is about user/workflow impact, not engineering effort:

- **High** — credible wrong-path, wrong-authority, or abandonment risk in a normal costing journey.
- **Medium** — recurring friction, error-recovery cost, or significant cognitive load.
- **Low** — polish/accessibility friction that compounds the denser issues.

| ID | Impact | Severity | Journey point | Hurdle and observed consequence | Evidence |
|---|---|---:|---|---|---|
| CC-01 | E+C | **High** | Entry | Two adjacent destinations, **Start Costing** and **Batch Builder**, both look like valid ways to begin the same job. The UI does not ask whether the user is exploring a cost, preparing a local batch, or creating a governed quotation. A user must already understand the architecture to choose correctly. | `Sidebar.jsx:30-31`; initial tab is Costing in `useUiState.js:23`. |
| CC-02 | C | **High** | Whole journey | The product vocabulary changes across surfaces: **Start Costing**, **START**, **REVIEW**, **Batch Builder**, **Batch Entry**, **local preview**, **durable Batch**, **governed calculation**, **Quote Items**, **draft candidate**, **Submit**, and **Issue**. These are meaningful distinctions internally, but there is no stable user-facing glossary or stage model tying them together. | `CostingTab.jsx`; `BatchGrid.jsx`; `BatchWorkspacePanel.jsx`; `Sidebar.jsx`. |
| CC-03 | E+C | **High** | Calculation | “Calculate” has three different behaviours: Costing recalculates live with no Calculate button; Batch Builder's **Calculate All** computes browser-local results; the Batch workspace's **Calculate all active rows** persists trusted governed calculations. Similar language masks materially different authority and persistence. | `OutputPanel.jsx`; `useQuoteActions.js:276`; `BatchGrid.jsx:173`; `BatchWorkspacePanel.jsx:107-112,658-702`. |
| CC-04 | E+C | **High** | Send/handoff | “Send” also has three different meanings: **Send to Batch Entry** creates a local row; **Send All to Quote Items** copies local results into working items; **Atomic Send** creates an immutable draft Quote candidate but does not submit or issue it. The user can complete a “Send” and still be at a very different commercial stage than expected. | `CostingTab.jsx:128-146`; `BatchGrid.jsx:177-180`; `useQuoteActions.js:322-458`; `BatchWorkspacePanel.jsx:109-115,706-740`. |
| CC-05 | E+C | **High** | Batch Builder | Local working rows and durable governed rows coexist on the same destination. A durable row can be copied into the local grid, while the local grid can also contain independently authored rows. The Top Bar adds Local/Governed tags, but the main work surface still asks users to remember which row set and which calculation authority they are operating on. | `TopBar.jsx:42-63`; `BatchWorkspacePanel.jsx:1334-1418`; `BatchGrid.jsx:283-313`. |
| CC-06 | E | **High** | Formalisation | Starting in Costing is not a continuous path to a governed calculation. A new draft may need a separate **+ New batch** action in Batch Builder before first Send, and a governed Batch additionally needs durable identities, groups, rows and a lock in the Batch workspace. The user leaves the task context, creates authority elsewhere, then returns or copies data. | `costing-start-review-decisions.md` §3; `CostingTab.jsx:149-182`; `NewGovernedBatchPanel.jsx`. |
| CC-07 | E+C | **High** | Completion | The legacy/local path can reach Quotes working items even though it is not the governed Atomic Send path. A user who sees results in Quotes may reasonably believe the quotation candidate is durable and authoritative. Provenance tags help after arrival but do not prevent the wrong path choice before it. | `useQuoteActions.js:322-458`; `TopBar.jsx`; `QuotesWorkspace.jsx`. |
| CC-08 | E | **High** | Batch setup | **Import profile** does not visibly name its source or destination. It means “copy the current Costing profile into Batch Profile,” an operation with broad costing consequences, but the label reads like a generic import. Understanding it requires its hover title and prior knowledge of the two profiles. | `BatchGrid.jsx:182-190`. |
| CC-09 | C | **High** | New Draft | The **New Draft** menu displays only “New batch — Keep current client” and “New batch — New client.” The important consequences—what is retained, cleared, or parked—exist only in `title` tooltips. The choice can materially reshape context, yet its decision support is invisible without hover. | `CostingTab.jsx:149-172`. |
| CC-10 | E+C | **High** | Readiness | Local **Calculate All** is disabled only when there are no rows or no Construction catalogue. Other blockers are discovered after clicking via transient toasts. Local **Send All** is enabled as soon as any result exists, while plant/delivery, stale rows, unconfirmed SETs, missing constructions, and coating exceptions are checked later. The toolbar therefore overstates readiness. | `BatchGrid.jsx:173-180`; `useQuoteActions.js:276-306,322-397`. |
| CC-11 | E | **High** | Multi-row governed calculation | Governed **Calculate all active rows** runs sequentially and stops at the first refused row. Earlier rows remain calculated. The button sounds atomic/all-or-nothing, while the actual outcome can be partial success revealed only afterward by a toast. Recovery requires finding the refused row and understanding which prior rows persisted. | `BatchWorkspacePanel.jsx:689-704`. |
| CC-12 | C | **High** | Governed workspace | The most authoritative surface uses specialist vocabulary at high density: durable structure, local preview, governed evidence, freshness, active lock, lineage, content version, Pricing Group, Delivery Group, binding and immutable candidate. The explanations are accurate, but users must decode the data model while trying to price a job. | `BatchWorkspacePanel.jsx:80-115,1224-1418`. |
| CC-13 | E+C | **Medium** | Orientation | There is no persistent progress indicator or “next required step.” The Top Bar names the current screen and current Batch, but not the stage (specification, preview, governed readiness, calculated, sent, submitted) or the next action. Users must infer progress from dispersed status chips and disabled controls. | `TopBar.jsx`; `BatchPreparationSummary` in `BatchWorkspacePanel.jsx`. |
| CC-14 | E | **Medium** | Batch Context | Essential context is compressed into Customer, Commercials and Terms disclosures. On an existing Batch it becomes read-only and **Edit Batch Profile** sends the user to another screen/surface. Fixing a blocker therefore interrupts the SKU task and risks losing visual place. | `BatchContextBar.jsx:166-293`. |
| CC-15 | C | **Medium** | Defaults and overrides | Inherited, overridden, derived, explicit zero and not-applicable values are distinguished by amber/grey styling and tooltips across several surfaces. The convention is internally consistent, but Costing/Batch Builder do not provide an always-visible legend at the point of use. Colour and hover carry too much meaning. | `BatchContextBar.jsx:46-60,104-108`; `BatchProfileBar.jsx:223-228`; `BatchGrid.jsx:638-688`. |
| CC-16 | E+C | **Medium** | Local grid | The compact grid has 36 base columns before optional pinned add-ons. Only the first five are frozen. Inputs, calculated outputs, spec checks and actions are separated by extensive horizontal travel, making it hard to connect a changed input with its result or maintain row identity. | `BatchGrid.jsx:250-278`; table `minWidth:1400`. |
| CC-17 | E+C | **Medium** | Local grid | Important row actions and states are glyph-led: status icon, expand chevron, magnifying-glass Deep Dive, `G`, and `×`. Most meaning lives in hover titles. This slows discovery and raises accidental-action risk, especially for row removal. | `BatchGrid.jsx:385-404,745-766`. |
| CC-18 | C | **Medium** | Local grid | A local row's primary status is shown as an icon in a 28px cell; the human-readable status label appears mainly in the tooltip. Users scanning many rows cannot quickly distinguish incomplete, stale, reviewed, override and spec-gap states without learning the icon system. | `BatchGrid.jsx:319-328,385-404`; `constructionName.js`. |
| CC-19 | E | **Medium** | Data entry | Requiredness is not consistently visible next to inputs. Some fields have `*`, while dimensions, Construction layers, Plant/Delivery and other gates are learned from the right-panel blocker list or after an action. The user repeatedly switches attention between the input pane and diagnostics. | `SpecForm.jsx`; `OutputPanel.jsx:274-344`; `useCostingResult.js:130-145`. |
| CC-20 | C | **Medium** | Costing output | Before a result exists, blockers are presented twice: once in the red diagnostics card and again in “Complete these fields.” The parallel warning card remains alongside blockers even when empty. Repetition consumes the most valuable early-screen space without clarifying sequence. | `OutputPanel.jsx:274-344`. |
| CC-21 | C | **Medium** | Costing output | Once calculated, the first output region exposes Margin, eight KPI tiles, die-line, cost build-up, BS control, layer detail and specification checks. This is strong evidence for experts but has no clear hierarchy such as “quoted rate,” “why this rate,” then “engineering verification.” New users must decide what matters. | `OutputPanel.jsx:346-430`. |
| CC-22 | E+C | **Medium** | Costing vs governed flow | Margin and fluting BS alter the Costing result immediately, while changes to governed rows require an explicit persisted calculation and freshness check. Moving between the surfaces changes the interaction contract from “live model” to “calculate/verify,” but the UI never teaches that switch. | `OutputPanel.jsx` `MarginControl`/`BsControl`; `BatchWorkspacePanel.jsx:103-115`. |
| CC-23 | E | **Medium** | Repeated SKU work | **Start new SKU** carries Construction and board specifications forward. This is efficient for similar products but the carry-forward rule is visible only in the tooltip; there is no on-screen summary of retained fields after the reset. A user can unknowingly begin from a prior SKU's physical specification. | `CostingTab.jsx:141-147`; `costing-start-review-decisions.md` §3. |
| CC-24 | E+C | **Medium** | REVIEW | REVIEW is session-only; reload loses unpushed edits. The temporary nature is a product rule, but the working screen does not maintain a persistent, prominent “not saved until Push” cue. The bottom review panel reports dirty construction changes, but temporary ownership applies to the whole review copy. | `costing-start-review-decisions.md` §§1-2; `SpecForm.jsx:701-756`. |
| CC-25 | E | **Medium** | REVIEW exit | **Unlink** is the exit verb for REVIEW. It describes the data relationship, not the user's intent (“Back to my draft” or “Close review”). Users must understand linkage semantics before they can confidently leave. | `CostingTab.jsx:96-114`. |
| CC-26 | C | **Medium** | Batch creation | Governed creation starts with **Customer Family**, then shows member Customers as evidence. A salesperson commonly begins from the Customer enquiry, so the hierarchy is reversed from their likely recall path. Search helps, but the selected object is still the Family and the reason is not explained in plain commercial terms. | `NewGovernedBatchPanel.jsx:118-179,204-258`. |
| CC-27 | E+C | **Medium** | Governed workspace | The Batch workspace is a long modal/side panel containing identity, lock, readiness, profile, durable rows, SETs, Pricing Groups and Delivery Groups. Core actions sit near the top while the fields that clear their blockers can be far below. There are no internal jump links or sticky readiness/action controls. | `BatchWorkspacePanel.jsx:1224-1594`. |
| CC-28 | E | **Medium** | Locking | Editing durable content requires acquiring an edit lock. The lock is explained in the workspace, but the user can first encounter many disabled controls before understanding that one lock action unlocks the lane. Lock state is not part of the main Batch Builder toolbar. | `BatchWorkspacePanel.jsx:1284-1304,1338-1343,1403-1418`. |
| CC-29 | E+C | **Medium** | Error feedback | Several local-path failures are transient toasts. For a dense multi-row table, a disappearing global message is weak recovery guidance: it may name row numbers, but it does not pin the error to the cell or preserve a checklist of unresolved rows. | `useQuoteActions.js:276-397`; `ToastStack.jsx`. |
| CC-30 | C | **Medium** | Calculation confidence | The Costing result does not expose a concise “inputs used” summary at the primary result. Detailed source information exists across Batch Context, commercial previews and layer tables, but confirming the final rate requires cross-reading both panes and several cards. | `BatchContextBar.jsx`; `SpecForm.jsx:534-674`; `OutputPanel.jsx`. |
| CC-31 | E+C | **Low** | Readability | Costing and Batch Builder rely heavily on 7.5–10px labels and 8–10px table text. The density is efficient on a large monitor but makes prolonged scanning, low-vision use and laptop-scale work harder. | `BatchContextBar.jsx:46-59`; `BatchGrid.jsx`; `SpecForm.jsx`. |
| CC-32 | E+C | **Low** | Layout | Costing uses a fixed 380px input column and an output design that can show four KPI columns plus narrow vertical controls. No responsive breakpoint or compact alternative is present. On narrower work areas, comprehension depends on squeezing dense content rather than reprioritising it. | `CostingTab.jsx:188`; `OutputPanel.jsx:346-387`. |
| CC-33 | C | **Low** | Diagnostics | Blockers and warnings are shown as equal-width peer cards. A warning column with “None” still occupies half the band, while true blockers compete for attention. This weakens the priority signal precisely when the user needs the shortest path to a result. | `OutputPanel.jsx:286-314`. |
| CC-34 | E | **Low** | Local row removal | The local row remove action is a bare `×` beside other tiny row actions and has no confirmation. Local rows may be recoverable only from another copy or by re-entry, so the interaction adds avoidable caution and slows confident use even when no mistake occurs. | `BatchGrid.jsx:745-766`. |

## Highest-leverage problems

### 1. One journey is presented as three adjacent work systems

The central difficulty is the relationship between:

- exploratory/local Costing;
- local Batch Builder previews and working Quote Items; and
- durable governed Batch calculation and Atomic Send.

The application accurately labels many individual facts, but the user has to synthesize which
system is authoritative. That is both an execution and a comprehension problem, and it creates the
highest risk of doing valid work in the wrong lane.

Against the product north star, this is the main architectural UX mismatch: the navigation begins
with **where data is stored and calculated**, while the user begins with **a customer enquiry that
must become a shareable quote**.

### 2. Action verbs do not encode consequence

“Calculate,” “Send,” “New Batch,” “Import,” and “Unlink” describe mechanics, not outcomes. The
consequence often appears only in hover text or explanatory copy away from the control. The most
important wording change is to make local, governed, persistent and workflow consequences legible
on the controls themselves.

### 3. Readiness is stronger in the governed panel than in the daily working grid

The governed workspace has a durable preparation summary and persistent blocker list. The local
grid waits until action time for several checks and reports many failures through toasts. The local
grid is the denser, faster surface, so it needs at least the same “what is left?” clarity.

### 4. Density is being used where prioritisation is needed

The interface exposes valuable technical evidence, but often all at once. The dominant question at
each stage should be easier to answer:

- What must I enter next?
- What rate did the system produce?
- Why did it produce that rate?
- Is this only a preview or a governed result?
- What is the next commercial action?

### 5. The customer relationship is not the persistent centre of the journey

The current costing path begins with screens and data authority. It does not keep the customer's
current enquiry, relevant historical quotes, negotiated revisions and customer-specific facts in
one persistent context. Those capabilities may exist or be emerging on separate destinations, but
the user must assemble the relationship between them.

For the intended product, old approved quotes and customer knowledge are not separate reporting or
master-data chores. They are decision support while making and revising the next quote.

### 6. “Share with customer” is not yet a clear, singular milestone

The current labels distinguish Send, Atomic Send, Submit, Approve and Issue according to internal
workflow consequences. The primary journey needs one unmistakable customer-facing milestone:
**Preview and share this exact quote**. Governance can still require submission and approval, but
the interface must make clear:

- whether the quote is ready to share;
- whether approval is still required;
- which revision the customer will receive;
- whether it has actually been shared;
- and what the next follow-up or negotiation state is.

No local handoff or internal Send action should look like that customer-facing milestone.

## What already helps and should be preserved

- Clear blocker/warning separation in Costing, despite the density and duplication.
- The cost build-up and layer evidence, which make the number auditable.
- Explicit Local/Governed/Immutable provenance tags in the shell and Quote surfaces.
- Frozen identity columns and the optional Batch Builder focus mode.
- The governed Preparation and readiness summary.
- Visible distinction between inherited, overridden, explicit-zero and unavailable values; the
  issue is discoverability, not the underlying semantic discipline.
- Confirm-before-mutate rules around materially risky transitions.

## Recommended validation sequence

This review should continue with a real Maker session before prioritising implementation:

1. Give the Maker only a customer enquiry and ask them to prepare the exact quote they would share;
   do not name screens or internal workflow states.
2. Ask them to preview what the customer will receive and explain whether it has actually been
   shared, is awaiting approval, or remains a working draft.
3. Ask them to narrate which calculation is authoritative at each Calculate/Send action.
4. Observe whether they begin in Start Costing or Batch Builder and why.
5. Introduce one incomplete Construction, one stale result and one row requiring a delivery-route
   correction; record recovery time and navigation.
6. Ask the customer for a price reduction; have the Maker create a revision, explain what changed,
   and preserve the earlier version.
7. Ask the Maker to find the latest approved quote for the same customer, compare it with the new
   revision, and reuse one relevant customer-specific fact.
8. Repeat with two SKUs and one SET so horizontal-grid and cross-row comprehension are exercised.
9. Run at the actual beta laptop resolution, not only a 1440px development viewport.

Success criteria for the next review pass:

- the Maker can state the current stage and authority without referring to tooltips;
- they can identify the next required action within five seconds at every stop;
- they do not enter data into both local and durable row representations unnecessarily;
- they can explain what each Send action will create before clicking it;
- they recover from every blocker without leaving an unresolved transient-toast message behind;
- they can identify the exact revision the customer will receive;
- they can retrieve and compare a prior approved quote without leaving the customer context;
- they can distinguish customer-specific knowledge from defaults and choose deliberately whether to
  reuse it.
