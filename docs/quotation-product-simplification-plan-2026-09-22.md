# Quotation product simplification plan

Date: 2026-09-22  
Status: implementation plan for Product Owner confirmation and controlled handoff  
Governing posture: cautious optimism and continuous forward motion

## 1. Decision and timing

Do **not** wait for every item in the UX review, quote-journey decision packet, U2-U5 live
qualification, or historical closure register to close before beginning this programme. Much of
that work either depends on real users or improves surfaces that this programme will hide, combine
or replace.

Do wait for one narrow handoff checkpoint: the Sr Dev completes, verifies and commits the currently
in-flight quote-journey slice 2. At that checkpoint:

1. its closure record and focused checks are current;
2. the frontend worktree has no uncommitted slice-2 changes mixed with later work;
3. any backend Sector-master increment is committed separately and remains independently usable;
4. no new quote-journey slice has begun in the same files; and
5. the Product Owner's D-1..D-9 selections are recorded as the governing direction.

Authenticated-live proof, deployment, complete Product Owner walkthrough, full D-1..D-9
implementation and closure of unrelated masters are **not** prerequisites for this handoff.

The next currently recorded follow-on — automatically creating governed rows from promoted local
inputs — should pause unless it is already materially underway. It is useful transitional plumbing,
but the intended destination is direct governed Batch creation on one multi-item working surface.
Building more bridge before that surface risks making the transitional two-lane model harder to
remove.

## 2. User outcome

A Maker signs in and completes one coherent job. The Batch is the primary Quote-making workspace
because a customer enquiry normally contains several items. Costing is the specialist deep-dive for
one Batch row and may also remain available as a private scratchpad; it is not the normal starting
surface.

```text
Customer enquiry
  -> create or open Batch
  -> select established SKUs or create Proposed SKUs inline
  -> enter quantities and shared opportunity-specific terms
  -> open Costing deep-dive only where an item needs detailed work
  -> calculate all Batch items and resolve visible blockers
  -> preview the exact customer document
  -> obtain approval where required
  -> share and record the event
  -> record the response or create a revision
```

The user may understand Batch as their multi-item working quotation, but does not need to understand
its persistence internals, local versus governed storage, calculation snapshots, Pricing Basis
composition, locks, lineage, Quote families or immutable revision internals. Those controls remain
underneath the journey.

### 2.1 Product-surface model

- **Batch Builder is the home and primary Quote composer.** Customer, plant, shared commercial
  context, multiple SKUs, quantities, SET relationships, readiness and progression to the customer
  document belong here.
- **Costing is the beautiful deep-dive.** A Batch row opens into the existing detailed specification,
  cost build-up, engineering evidence and `Why this price?` experience, then returns to the same row
  and Batch context.
- **Costing may also remain a private scratchpad.** Scratch work is unmistakably non-governed and
  cannot produce an official Quote. A useful scratch specification may be copied as inputs into a
  Batch, but its local price never becomes governed evidence.
- **Quotes is the downstream document and history surface.** It owns approval, exact revision
  preview, sharing, outcomes and revision history; it is not the normal starting point for making a
  multi-item quotation.

## 3. Scope

### 3.1 Retain from day one

- One authoritative governed calculation for every official Quote.
- Exact SKU and SKU-version identity on every Quote Item.
- Inline creation of a stable Proposed SKU when no established SKU exists.
- Versioned Rates, Freight, Construction and calculation inputs.
- Blank, explicit zero and unresolved as separate meanings.
- Caller-scoped plant, customer and capability enforcement in the backend and database.
- Frozen calculation evidence and immutable issued revisions.
- Actor, timestamp and material before/after evidence for formal transitions.
- Atomic approval, issuance/share recording and revision creation.
- Existing applied migration history and live data.

### 3.2 Simplify or hide initially

- Make Batch Builder the first destination and `New customer quote` the dominant action.
- Hide master-data and administration destinations from ordinary Makers.
- Keep Quick calculation as a secondary, unmistakably non-Quote tool.
- Remove its hand-typed Quote Reference and mark any retained output
  `QUICK CALCULATION — NOT A QUOTE`.
- Once a Customer Batch exists, show one governed row set and one calculation authority.
- Preserve the current Costing design as the row-level deep-dive rather than flattening its
  specification and evidence into the Batch grid.
- Replace internal handoff verbs with customer outcomes: Add product, Calculate price, Preview,
  Request approval, Approve, Share with customer, Record response, Create revision.
- Show quoted rate and total first; place calculation evidence behind `Why this price?`.
- Put blockers beside the affected row/field and preserve one persistent readiness list.
- Keep customer history and reusable SKU knowledge inside the Quote workspace.
- Use one simple progress model; do not add another toolbar or status vocabulary.

### 3.3 Explicitly defer

- Cross-plant expansion beyond the beta plant.
- New capability granularity not needed by Maker, Approver or Admin.
- Additional master-governance ceremonies that do not protect a pilot Quote.
- Advanced partial Amend/Reprice and mixed-engine editing UX.
- Cross-customer commercial intelligence.
- Email, WhatsApp and ERP integration; record manual channel/date/reference first.
- Production, scheduling, capacity, procurement, tax, invoice and order workflows.
- Broad backend rewrite or schema redesign solely for aesthetic cleanliness.

## 4. Implementation strategy

Use a strangler-style product reset over the existing authority boundaries. Build the simplified
Batch-first journey using existing authenticated APIs and database protections, then progressively stop
mounting the legacy surfaces in the normal path. Hide first; remove only after pilot evidence shows
that the replacement covers the real journey.

Do not undertake a big-bang frontend/backend rewrite. The immediate goal is one adopted vertical
journey, not architectural uniformity. Extract backend and frontend modules when the new journey
touches them and when the extraction directly reduces delivery risk.

## 5. Delivery slices

Each slice must produce an observable user improvement and remain reversible. Later slices may
improvise on component placement, wording and reuse of existing APIs without a new approval packet,
provided the authority boundaries in section 3.1 do not change.

### H0 — Handoff and baseline

- Commit the in-flight quote-journey slice 2 as its own coherent increment.
- Record the D-1..D-9 Product Owner selections.
- Freeze new ornamental/master destinations during the simplification programme.
- Capture the current 1366x768 Maker journey and the focused test baseline.
- Select representative Excel quotations and existing costing golden cases for parity checks.

**Exit:** known worktree ownership, reproducible focused checks, and no concurrent editing of the
files used by the first simplification slice.

### S1 — Batch-first shell

- Land Makers on Batch Builder, not standalone Start Costing or Quote History.
- Present `New customer quote`, active Batches, awaiting action and recently progressed Quotes.
- Promote Approval Inbox only for Approvers.
- Keep Costing accessible as `Quick calculation` and as a Batch-row deep-dive, but remove it as the
  competing primary start for ordinary Quote work.
- Keep Quotes as the downstream document/history destination.
- Preserve direct links temporarily for recovery and comparison.

**Exit:** a Maker can identify how to start a multi-item customer quotation within five seconds,
and can identify Costing as a row deep-dive rather than a competing workflow.

### S2 — Direct governed Batch start, with SKU foundation

- Start from Customer/Prospect and producing plant.
- Search established SKUs by customer reference, Plant Item Code, description and recent use.
- Load the exact reusable SKU specification version.
- Provide `Create proposed SKU` inline with the minimum quotation-relevant specification.
- Create/open the governed Batch directly; do not route normal work through Quick
  calculation first.
- Preserve the current rule that Proposed SKUs and unapproved versions may be quoted, while
  withdrawn SKUs are refused.

**Exit:** several established or genuinely new SKUs can enter one durable customer Batch without
visiting SKU Master or standalone Costing as prerequisite destinations.

### S3 — One governed working surface

- Render only durable governed rows after a customer Batch has begun.
- Open the existing Costing UX from a Batch row as `Costing deep-dive`, preserving its specification,
  engineering evidence and cost build-up.
- Return changes deliberately to the originating Batch row and clear/recalculate governed evidence
  according to the existing authority rules.
- Keep scratch Costing separate; make any `Copy inputs to Batch` transition explicit and never copy
  a local result as an official price.
- Keep shared customer, delivery and commercial terms at Batch level; keep item specification and
  quantity in the row/deep-dive workflow.
- Run only the governed calculation for official prices.
- Show one readiness result and navigate every blocker to its field or row.
- Keep advanced provenance available through disclosure rather than permanent screen density.

**Exit:** the Maker prepares several items in one Batch, can deep-dive any row without losing Batch
context, never enters the same SKU into two row systems, and can explain which price is official
without referring to a lane chip or tooltip.

### S4 — Exact document, approval and share

- Remove the free-text Quote Reference from Quick-calculation output.
- Preview the exact governed revision the customer will receive.
- Keep Submit/Approve internally where required, but present one unmistakable readiness path.
- Implement `Share with customer` on an approved current revision.
- Record date, actor, manual channel and optional external reference, then download the frozen
  document.
- Never infer sharing from download alone.

**Exit:** the user can answer which revision is approved, what the customer received, and whether
it was actually shared.

### S5 — Customer response, history and simple revision

- Show the latest approved Quote for the same Customer and plant inside the workspace.
- Compare price and total first, then explain changed inputs and authorities on demand.
- Record Awaiting Response, Accepted, Rejected or Expired as the product rules allow.
- Create a deliberate next revision from the current issued revision.
- Prefer full-Quote recalculation initially; retain advanced partial Amend/Reprice as deferred
  behaviour.

**Exit:** a negotiation can be completed without Excel, email notes or a separate history screen
being the decision authority.

### S6 — Pilot consolidation and removal

- Run the Nagpur shadow pilot against the agreed Excel cases.
- Observe Maker, Approver and Admin journeys on genuine records.
- Remove or stop mounting legacy paths only when the replacement covers their used behaviour.
- Retain recoverable feature flags or routing for one pilot interval before code deletion.
- Reclassify remaining work from observed use: necessary next, later enhancement or retire.

**Exit:** trial users voluntarily use the app as the authoring system, every official pilot Quote
comes from a frozen governed revision, and no Speedbreaker-class defect remains.

## 6. Improvisation envelope

The implementation team may decide without further approval:

- component boundaries and file splits;
- labels that translate internal language into commercial language;
- exact layout, disclosure and responsive behaviour;
- consolidation or removal of duplicated cards, chips, toolbars and navigation entries;
- reuse of existing read routes and additive presentation models;
- focused accessibility improvements;
- reversible feature-flag sequencing; and
- fixes directly required to make the accepted vertical journey work.

Record meaningful choices in the slice closure note; do not create a separate decision packet for
ordinary reversible implementation.

## 7. Development Speedbreakers

Pause only the affected lane when continuing would credibly risk:

1. a changed calculation result against an accepted golden case without an approved rule change;
2. plant, customer, role or capability data becoming visible or writable to an unauthorised caller;
3. mutation or misrepresentation of an issued revision or its frozen evidence;
4. destructive loss or ambiguous migration of real data;
5. an unrehearsed live migration against populated production data;
6. an official document that can be mistaken for the wrong revision or an unapproved Quote;
7. overwriting concurrent user work without detectable conflict; or
8. materially different product behaviour where the intended customer-facing outcome is genuinely
   undecided.

A Speedbreaker report must name the failure mode, affected user/data, evidence and shortest safe
clearance. The following are not Speedbreakers by default: pre-existing lint debt, unrelated test
failures, incomplete historical documentation, a preferable abstraction, lack of exhaustive proof,
or a reversible UI choice inside this plan.

## 8. Verification proportional to each slice

For every slice:

- run the directly affected frontend fixtures and production module-contract build;
- run the directly affected backend route/database checks when an API or authority boundary moves;
- exercise the real journey at the beta laptop resolution;
- verify Maker, Approver and Admin visibility when capabilities are involved;
- compare official calculation changes against golden cases;
- verify frozen revision/export behaviour when document state changes; and
- record what was not exercised without treating unrelated historical gates as blockers.

Database or RLS changes additionally require caller-scoped verification, anon/public refusal where
applicable, and security/advisor review before activation. Applied migrations are never rewritten.

## 9. Adoption measures

- A returning Customer with established SKUs reaches a correct previewable Quote in under five
  minutes.
- The next required action is identifiable within five seconds.
- No master-data screen is required during the normal quotation path.
- A multi-item quotation remains one Batch throughout preparation.
- Costing deep-dive opens from and returns to the originating Batch row without losing context.
- No SKU is entered into both local and governed row representations.
- Every customer-facing document has an exact governed revision identity and approval state.
- Every pilot result matches the accepted spreadsheet result or has a reviewed explanation.
- Previous Customer pricing is available without leaving the current Quote.
- After the shadow interval, Excel is reconciliation evidence rather than the authoring system.

## 10. Immediate instruction

Finish and commit quote-journey slice 2. Do not wait for complete programme closure. Do not begin
the promoted-local-row-to-governed-row bridge unless already materially underway. At handoff,
begin S1 and S2 as the first vertical package: Batch-first landing plus direct governed multi-item
Batch creation with established/Proposed SKU selection. Preserve Costing as the Batch-row
deep-dive and private scratchpad.
