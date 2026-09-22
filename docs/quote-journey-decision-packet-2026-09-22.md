# Quote journey — Product Owner decision packet, 2026-09-22

**Purpose:** one batch of the product decisions that the reshaping of the frontend around the
customer's quote genuinely needs. Nothing here is a design proposal awaiting approval before work
can continue — slice 1 is already implemented and locally verified
([`quote-journey-slice-1-closure.md`](quote-journey-slice-1-closure.md)), and the decision-independent
work continues while these are open.

**Method:** the eight questions raised in the journey brief were first checked against the canonical
records. **Three were already answered and are not asked again** — they are restated in §A so the
answers are visible rather than re-litigated. Four are asked in a narrowed form, because part of each
was already settled. Two are new, raised by this work.

---

## A. Already answered — stated, not asked

### A-1. When a Quote becomes durable · **settled**

- **CDM-02** — START is a private browser-local scratchpad; durable work begins only through
  explicit *Create New Batch*; Batch Entry alone calculates.
- **CDM-14** — the permanent Batch Reference (`Plant/BAT/FY/seq`) is allocated at Batch creation.
- **CDM-21** — the Quote family is created/dedicated at first Send; the customer-facing
  `Plant/Q/FY/seq` reference is allocated at **first Checker approval**, never before.
- **CDM-39** — private START scratch may continue during a Supabase outage; formal Batch creation,
  CalcGate, Send, submit, approval and issuance are blocked rather than recorded locally.

The brief's recommended default — *"a recoverable governed working Quote after the minimum customer
and plant identity is selected, without allocating a customer-facing Quote reference prematurely"* —
is already exactly what the model does. Recoverable identity arrives at Batch creation
(Customer Family + Plant + Sector); the customer-facing reference waits for approval. No decision is
needed.

### A-2. Revision branching and revision reasons · **settled**

- **CDM-21** — revisions are **linear** from the latest issued revision; historical branches are
  **prohibited**. So coexisting alternative scenarios as revisions are already ruled out.
- **CDM-24** — issued revisions are immutable; further work requires a deliberate *Create Revision*.
  An approved-but-unissued revision may be withdrawn **with a mandatory reason**.
- **CDM-30** — Void requires a mandatory reason.
- **CDM-34** — *"Reasons are mandatory only where expressly decided."* Withdrawal and Void are
  expressly decided; **Create Revision is not**, so a revision reason is optional today.

Only *which values are compared between revisions* remains open → **D-5**.

### A-3. Draft exports, approval, and what proves a share · **largely settled**

- **CDM-24** — Maker draft exports carry an unavoidable `DRAFT — NOT APPROVED` mark; approval and
  Issue to Customer are **separate** acts; **download alone never proves issuance**.
- **CDM-28** — the issued revision's customer outcome is whole-revision (Awaiting Response,
  Accepted, Rejected, Expired) and outcome events are append-only.
- **CDM-34** — every workflow change appends an audit event with actor, timestamp and material
  before/after values.
- **CDM-40** — integrations are not in this stage's scope.

So: unapproved previews **may** be downloaded and **are** marked; approval **is** required before a
quote counts as issued; the audit evidence requirement is already defined. What is not settled is
whether the interface needs an explicit *Record as issued* act and whether any send channel enters
scope now → **D-4**.

---

## B. Decisions needed

Each is stated with what it changes, a recommended default, the meaningful alternatives, the
user-visible consequence of each, and the existing decision that partly constrains it.

---

### D-1 · Where a Maker lands after signing in

**Why it matters.** Today a Maker lands on **Start Costing** — a blank SKU specification form with
no customer on it. The first thing the product asks for is a box dimension; the first thing the
Maker has is a customer enquiry. The navigation is ordered by where data is stored (Costing → Batch
Builder → My Batches → Quotes), which is the architecture, not the job.

**Constrained by:** nothing canonical. CDM-02 fixes the *authority* of each surface, not the
*order* they are offered in. The 2026-09-22 approved build order already ruled that the blank slate
offers two doors with governed as the default (see D-2); this decision is about the destination
that carries them.

| Option | User-visible consequence |
|---|---|
| **(a) Quote workspace first — recommended.** A **Quotes** destination becomes the landing page and the first nav item: `New quote` as the primary action, then active work, quotes awaiting action, recent approved quotes. Costing and Batch Builder stay in the nav but move below it as the surfaces a quote is worked in. | A Maker who signs in sees their own work and one obvious way to start. Costs one extra click for a Maker whose only intent is a throwaway calculation. |
| (b) Keep Start Costing as the landing page, add a `New quote` button to it. | Cheapest change; nothing moves. But the first screen still asks for a box before a customer, and the two adjacent doors problem (CC-01) survives. |
| (c) Role-specific dashboard (Maker vs Checker vs Admin). | Best for a Checker, who currently lands on a Costing form they may never use. More surface to build, and it delays the Maker journey this programme is about. |

**Recommendation:** (a), with the Approval Inbox promoted for callers holding `check_quote` — which
is a one-line ordering change, not a dashboard.

---

### D-2 · What the quick calculation is allowed to produce

**Why it matters.** This is the single highest-risk item in the current product. Today the **Excel
and PDF exports exist only on the local Working Quote Items screen**, and the reference printed on
that customer document is a **free-text box the Maker types** — export is gated merely on it being
non-empty. A governed Quote now has its own export (shipped 2026-09-22), so there are two documents
and the hand-typed one is the one beta testers are actually using.

**Constrained by:** CDM-02 (START is a scratchpad), CDM-21 (the customer-facing reference is
allocated at approval — so a typed reference is not a Quote reference by definition), and the
**2026-09-22 approved build order**, step 3, which already ruled: *governed by default, local
demoted to a marked unreferenced "quick calculation", typed Quote Ref removed*, and *calculator
mode: everyone*. What remains is how far the demotion goes.

| Option | User-visible consequence |
|---|---|
| **(a) Quick calculation keeps an export, unmistakably marked — recommended.** The typed reference box is removed. The workbook and PDF from the local lane carry `QUICK CALCULATION — NOT A QUOTE` and no reference at all. | Nothing a Maker does today becomes impossible; a customer who receives one can tell instantly it is not a quote. Preserves the internal costing-check habit the local lane is genuinely good for. |
| (b) Quick calculation exports nothing. It is a calculator; to produce any document you create a Customer quote. | The cleanest guarantee that no unofficial document reaches a customer. But it removes a capability beta users have now, on a path that still needs governed Calculate to be live — so it must not land before the keyring is provisioned. |
| (c) Leave both exports as they are. | Two customer-facing documents, one carrying a hand-typed reference. Not recommended under any reading of CDM-21. |

**Recommendation:** (a) now, (b) once the governed path has run end-to-end in beta.
**Note:** the approved build order already accepts that "losing current local entries once" is
acceptable when the doors change.

---

### D-3 · Whether the two lanes converge in the normal path

**Why it matters.** A durable governed row can be copied into the local grid, and the local grid can
hold independently authored rows, on the same screen (CC-05). A Maker can therefore enter the same
SKU twice, in two representations, with two different calculation authorities. The current shell
tags them, but tagging is after the fact.

**Constrained by:** CDM-02 (Batch Entry alone calculates; local preview and persisted governed
calculation are distinct) and CDM-22 (Send freezes inputs, results, effective values, sources and
versions). Neither says whether the *normal* path may use the local grid at all.

| Option | User-visible consequence |
|---|---|
| **(a) Governed rows are the working surface once a Batch is bound — recommended.** With a governed Batch open, the grid shows durable rows; local preview becomes an explicitly requested "try a change without saving it" mode on a row. | One row set, one authority, at any moment. The Maker never wonders which grid they are typing in. Requires the governed row editor to be at least as fast as the local grid, which is a real build. |
| (b) Keep both, but make the local grid read-only while a governed Batch is bound. | Cheap, and removes the double-entry risk entirely. Costs the fast local scratch pass on a customer who already has a governed Batch open. |
| (c) Leave as-is, improve the tags. | No build cost. The double-entry risk stays, and it is the kind that produces a wrong price rather than an error message. |

**Recommendation:** (b) as the next slice, (a) as the destination.

---

### D-4 · The one customer-facing milestone

**Why it matters.** Six internal actions currently read like sending something to someone: *Send to
Batch Entry*, *Send All to Quote Items*, *Atomic Send*, *Submit*, *Approve*, *Issue*. Slice 1 renamed
the first to *Add to batch*, but the milestone itself does not exist as a single unmistakable step.
CDM-24 already separates approval from Issue and says download never proves issuance — so something
must record the issuance, and nothing in the interface does.

**Constrained by:** CDM-24, CDM-28, CDM-34 (see A-3), CDM-40 (integrations out of scope).

| Option | User-visible consequence |
|---|---|
| **(a) Preview, then Record as issued — recommended.** One `Preview customer quote` step showing exactly the document the customer will get, then one `Share with customer` action on an approved revision that records the issuance event (date, channel as free text, optional reference) and downloads the file. No internal handoff uses the word Send. | The Maker has one place to answer "what will they receive" and one act that makes it true. Issuance becomes a fact in the audit trail, as CDM-24 requires, rather than an inference from a download. |
| (b) Download of an approved revision is itself the share; no separate record. | Fewer clicks. But it contradicts CDM-24's "download alone never proves issuance", and nothing can then answer "has this exact revision been shared?". |
| (c) Integrate a channel (email / WhatsApp) now. | Strongest evidence and least manual work. Explicitly outside CDM-40's stage scope, and a large build; recommend deferring and keeping (a)'s channel field free text so the history is usable when a channel is added. |

**Recommendation:** (a). **Question for you:** is email or WhatsApp wanted inside beta, or is the
recorded-manual-send of (a) enough for now?

---

### D-5 · What a revision comparison shows

**Why it matters.** The branching and reason questions are already settled (A-2). What is not
settled is what the Maker and the Checker actually see when a customer asks for a reduction. Without
a decision, a comparison gets built that shows everything and therefore shows nothing.

**Constrained by:** CDM-22 (a Send snapshot freezes inputs, results, effective values *and their
sources*, selected versions, Pricing Basis and engine version — so all of the candidates below are
available in evidence), CDM-23 (pricing-relevant vs descriptive change), CDM-25 (mixed-engine
revisions are legitimate and **must be visible**).

| Option | User-visible consequence |
|---|---|
| **(a) Price first, then why — recommended.** Default comparison: per-item rate and total, then quantity, then margin. One disclosure reveals the input differences (dimensions, Construction version, waste/conversion) and a second reveals the authority differences (Pricing Basis release, engine version, interest basis, freight source). | Answers the commercial question in one glance and keeps the audit answer one click away. Matches CDM-25's requirement that a mixed-engine revision is visible without putting engine versions in the Maker's face. |
| (b) Full side-by-side of every frozen field. | Complete and auditable. Unreadable at the beta laptop width, and it makes the Checker hunt for the number that changed. |
| (c) Price only. | Fastest to read and to build. Cannot explain *why* a price moved, which is exactly what a Checker is approving. |

**Recommendation:** (a).

---

### D-6 · Historical retrieval — what "the last quote" means

**Why it matters.** "What did we quote them last time" is the most common question in a negotiation
and there is currently no answer inside the quote being worked on. The choice of *key* decides
whether the answer is usually right or usually empty.

**Constrained by:** CDM-04 (Customers are group-wide; **Quotes are plant-owned**), CDM-09 (a SKU
belongs to one Plant and one Customer; equivalent supply from another plant is a different SKU),
CDM-28 (revision standing: Current / Superseded / Voided), CDM-29 (offer validity). Anything
cross-plant is therefore a deliberate read across ownership, not a default.

| Option | User-visible consequence |
|---|---|
| **(a) Latest approved revision for this Customer at this Plant, surfaced in the workspace; deliberate side-by-side before anything is copied — recommended.** Keyed on Customer + Plant, then narrowed by SKU when the Maker is on a row. Expiry and superseded standing shown on the card. | The common case answers itself without leaving the quote. Copying is always an explicit act, never a default, so no historical price silently becomes a current one. |
| (b) Also offer history by Construction and SKU Set across Customers. | Genuinely useful for a new Customer with no history of their own. Raises a cross-Customer visibility question CDM-35 constrains, so it needs its own authorization pass. |
| (c) Keep history on the Quotes screen only; the Maker navigates there. | Already built (U5, read-only). Costs the Maker their place in the quote every time they check. |

**Recommendation:** (a) now; (b) only with an explicit authorization decision.

---

### D-7 · Customer-specific knowledge — which facts default, and which only suggest

**Why it matters.** The brief asks for ten categories. Several already have a settled authority
chain, and turning a historical value into a default would silently override it — the exact failure
the resolution order exists to prevent.

**Already authoritative — these must keep resolving through their existing chain and must never be
defaulted from Quote history:**

| Category | Existing authority |
|---|---|
| Freight | **CDM-17** — `row override → Pricing Group freight → approved Freight Master → unresolved/block`. |
| Payment terms and interest | **CDM-18**, and the approved annual basis travels in the Pricing Basis Release (CDM-26). |
| Waste, conversion, margin | **CDM-19**, with Sector inheritance. |
| Bill-to / Ship-to Locations | **CDM-08** — Customer Location is canonical; external parties use the third party's real Location. |
| Rates | **CDM-26** — the effective Pricing Basis Release, never a remembered number. |

**Genuinely open — the suggestion layer:** previously used SKUs and Constructions, printing and
packaging requirements, customer item codes and external references, historical volumes and MOQ
expectations, recurring remarks or restrictions, negotiated commercial conditions.

| Option | User-visible consequence |
|---|---|
| **(a) Sourced suggestions the Maker accepts — recommended.** Each fact appears with where it came from and when ("Quote NAG/Q/25-26/41, 12 Aug"), never pre-filled. Accepting is one click and is recorded as a reuse. Anything older than a configurable window is shown as stale. | Nothing historical becomes authoritative without a human act, so a stale price or a lapsed term cannot enter a quote unnoticed. Slower than autofill by one click per fact. |
| (b) Auto-default the non-price facts (item codes, printing requirements, remarks) and suggest only the commercial ones. | Faster for a repeat customer. The boundary between "non-price" and "price-driving" is not always obvious — printing requirements can drive cost — so it needs a per-field ruling. |
| (c) Historical evidence only, no reuse action. | Safest and cheapest. Leaves the Maker retyping, which is the friction this programme exists to remove. |

**Recommendation:** (a), with maintenance on the Customer/Customer-Location master for the
authoritative facts and on Quote history for the suggested ones.
**Question for you:** should reuse of a *negotiated margin or commercial condition* require a
Checker, or is a Maker's deliberate acceptance enough?

---

### D-8 · The Batch Builder toolbar at the beta laptop width

**Why it matters.** Measured this session at 1366×768: the toolbar is **two rows, 74px** (it was
69px before slice 1), because its content is 1206px against 1142px of available width. A 1440px
development viewport hides this entirely. The fix that works is to put `↓ Copy from Costing`,
`+ New customer quote` and `Code tools ▾` behind one disclosure — but `SS-36` and `U4-FE-11a` pin
those three in the toolbar from a Product Owner–accepted U4 pass, so it is not mine to change.

**Constrained by:** the screen-space standard (one 43px toolbar per panel) and the two named gates.

| Option | User-visible consequence |
|---|---|
| **(a) Move those three behind one `Batch setup ▾` disclosure — recommended.** | Recovers ~200px; one 43px toolbar at 1366. The three controls become one click deeper. `+ New customer quote` is the governed door, so burying it slightly conflicts with D-1's aim — unless D-1 (a) lands, which gives that door a better home on the Quotes workspace anyway. |
| (b) Accept two rows at 1366. | No change, 31px of grid lost on every beta laptop. |
| (c) Keep them, move the four `+ Box / + Plate / + Part-L / + Part-W` buttons into a disclosure. | Same width saving, but row creation is the most-used control on the screen and should not get deeper. |

**Recommendation:** (a), sequenced **after** D-1, so the governed door is promoted before it is
tucked away here.

---

### D-9 · The speed target, and the device it is measured on

**Why it matters.** The brief proposes targets; they cannot be verified without knowing the screen
they are measured on. Everything measured this session used **1366×768** as the assumed beta laptop
width, and that assumption already produced one finding (D-8).

**Proposed, for confirmation:**

- a returning Customer with established SKUs reaches a correct, governed, previewable quote in
  **under five minutes**;
- the next required action is identifiable within **five seconds** at every stop — slice 1's
  `Next` control is the first instrument for this;
- the Maker does not need to open a master-data screen on the normal path;
- no tooltip is required to understand the current stage or the consequence of the primary action.

**Questions for you:** (1) is 1366×768 the beta laptop resolution, or should this be measured at a
different size? (2) what is the most common quote shape — how many SKUs, and how often is a SET
involved? The horizontal-travel findings (CC-16) depend on the answer.

---

## C. What proceeds while these are open

Slice 1 is done. The following are decision-independent and continue:

1. **Readiness parity for the governed lane** — the Batch workspace's preparation summary and the
   new local register should present identically, even though they describe different authorities.
2. **Blocker-to-row navigation** — clicking a listed blocker scrolls to and highlights the named
   rows, which CC-29 asks for and no decision blocks.
3. **The Costing output hierarchy** (CC-20, CC-21, CC-33) — removing the duplicated blocker list,
   and giving warnings a width proportional to their importance.
4. **Row status legibility** (CC-17, CC-18) — a readable status word beside the icon.

None of these change calculation, authority, persistence or workflow.
