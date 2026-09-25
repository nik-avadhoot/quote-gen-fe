# Customer Pricing History — Phase 0 implementation plan and Sr Dev handoff

> **Completed implementation-plan record.** Customer Pricing History is part of the live S1–S5
> delivery. Retain this document for scope and acceptance context; current status and follow-up are
> in [`current-state.md`](current-state.md) and
> [`OPEN-DECISIONS-BACKLOG.md`](OPEN-DECISIONS-BACKLOG.md).

Date: 2026-09-23  
Status: **Product Owner approved for implementation**  
Primary implementer: **Sr Dev Claude Opus 5**  
Reviewer during implementation: **Codex**  
Priority: **Phase 0 / Beta-critical**

## 1. Purpose and authority

Build a customer-wise pricing-history workspace inside **Customer Family Details**. It must replace
the scattered practical record now held across customer Excel files, email, WhatsApp, calls and
individual memory, and make the next pricing cycle materially easier to prepare.

This is an independent implementation handoff. The product choices in this document are settled and
must not be reopened merely because another design is possible. The implementer may choose component
boundaries, exact file splits and other reversible implementation details while preserving the user
outcomes and invariants below.

This feature is narrower than the full Commercial Intelligence programme. It is a direct-edit
business record, not a Checker-authorised CI profile, and it must not wait for the broader CI module.
It also does not change the Costing engine, Pricing Basis, governed Quote calculation, Quote approval,
or immutable issued evidence.

The unfinished S9 Quote-mutation activation is not a blocker for this independent module. Do not
couple pricing-history Beta entry to Calculate/Send activation. Do not alter or rely on issued Quote
evidence while delivering this feature.

## 2. Product outcome

From one Customer row inside Customer Family Details, a user can:

1. open the Customer's Pricing History without leaving the Family context;
2. record the Customer's long-lived pricing mechanism and effective-dated commercial terms;
3. record each applicable pricing cycle at the Customer's natural frequency;
4. retain every Avadhoot offer and Customer counter-offer;
5. see Avadhoot's first offer, the Customer's latest counter and the final agreed rate in one row;
6. record a defined, undefined, zero or not-applicable Share of Business (SOB);
7. handle Customer-, location-, plant-, item-, BF- and component-specific pricing;
8. start the next cycle from the prior structure without silently treating the prior rate as a new
   decision;
9. paste rows or BF schedules from Excel with a preview; and
10. rearrange, group, hide, transpose and save the presentation for that Customer without changing
    backend meaning or another user's view.

The normal experience should feel as flexible as a well-maintained spreadsheet while retaining
stable identities, source context, concurrency protection and automatic edit history.

## 3. Vocabulary and boundaries

- **Customer** means the permanent `parties` identity. Pricing history stays with that identity if
  Family membership later changes or a Prospect graduates to Customer.
- **Customer Family** is navigation and grouping context. It is not the authority grain of a
  Customer's rate.
- **Pricing Mechanism** is the Customer's relatively stable way of discussing rates.
- **Stable Terms** are effective-dated values that may last one to five years, such as Rate Basis,
  Weight Basis, Wastage Treatment, BF deltas, Conversion and Freight.
- **Pricing Cycle** is one applicable review period: month, two-month period, quarter, half-year,
  year or a custom/ad-hoc period. Do not reuse the existing governed `batches` entity or call a
  Pricing Cycle a Batch in code or database names.
- **Pricing Line** is one Cycle's applicable scope, normally a Customer plus optional Location,
  Avadhoot Producing Plant, SKU/item or free-text portfolio/scope.
- **Negotiation Event** is one dated Avadhoot offer, Customer counter-offer or final agreement.
- **Layout/View** is frontend-only presentation state. Moving a field in a layout never moves,
  promotes, duplicates or deletes business data.

## 4. Settled commercial rules

### 4.1 Currency, precision and tax

- All sales are domestic and INR-only. Do not add a currency selector or currency column.
- Every INR amount, rate, component and signed BF delta is exact decimal data and is stored and
  displayed to **two decimal places**. Do not use floating-point storage.
- Tax Treatment has exactly two values: `excluding_gst` and `including_gst`.
- `excluding_gst` is the default.
- When `including_gst` is selected, retain the applicable GST percentage with the historical event
  so an ex-GST comparison never applies today's tax rate to an older decision.

### 4.2 Review frequency and applicable period

Supported frequencies are:

- monthly;
- every two months (the approved meaning of "bi-monthly");
- quarterly;
- half-yearly;
- annual; and
- ad hoc/custom.

Store exact `period_start` and `period_end` dates. Render the Cycle label at the Customer's selected
level, for example `Sep 2026`, `Sep-Oct 2026`, `Q3 2026-27`, `H1 2026-27`, `FY 2026-27`, or a
user-supplied custom label. The mechanism may choose calendar-year, Indian-financial-year or custom
period labelling without changing stored dates.

### 4.3 Quote and agreement dates

Retain:

- Cycle initiation date;
- every Negotiation Event date; and
- final agreement date through the final agreement event.

The default compact Date display is initiation date until agreement and agreement date afterwards.
The user may instead display initiation date, agreement date, latest activity date, period start or
period end. This selection is layout state, not commercial data.

### 4.4 Rate bases

The initial controlled Rate Basis list is:

1. Delivered Box Rate per piece;
2. Delivered Box Rate per kg of the selected weight basis;
3. Delivered Kraft Paper Rate per kg of the selected weight basis; and
4. Delivered Box Rate per square metre.

The original Customer basis remains authoritative. Equivalent views such as INR/piece may be
calculated only when all necessary weight/area inputs are present. Missing inputs disable that
comparison; they never become zero or an inferred value.

### 4.5 Weight bases and Costing vocabulary

The initial controlled Weight Basis list is:

- **Paper Consumed** — Sheet Weight plus Wastage;
- **Sheet Weight** — Box Weight plus trimming-margin weight; and
- **Box Weight** — the finished-box weight.

Always display the selected basis beside an INR/kg value. A historical pricing line may retain all
three weights when known, plus `weight_source`: Costing snapshot, Customer-confirmed, imported or
manual. A Customer-confirmed/manual value does not overwrite a Costing-derived value; preserve source
and value explicitly.

These labels align with the settled Costing distinctions in `src/engine/costing.js`: paper consumed
includes wastage, sheet weight excludes wastage, conversion applies on paper consumed and freight
applies on sheet weight. This module may display those meanings but must not change the formulas.

### 4.6 Wastage

Supported Wastage Treatments are:

- added as a percentage over the selected weight;
- already included in the chargeable/recorded weight;
- not applicable; and
- not yet captured.

Store the percentage separately when present. Blank, explicit zero and unknown are different states.

### 4.7 Freight and Conversion

Freight Treatment is either:

- delivered/included; or
- ex-factory with Freight recorded separately.

Conversion and Freight commonly remain fixed for a year, while Kraft Paper changes more frequently.
Model them as effective-dated Stable Terms that a Cycle references. They may be scoped to the whole
Customer or, where required, to a Location and/or Producing Plant.

For a mechanism such as `Kraft Paper + Conversion + Freight = Delivered Box Rate`, retain the
component breakup and the recorded total. Do not silently alter an imported/recorded total merely
because components differ after rounding. Show a reconciliation difference instead.

### 4.8 BF-wise Kraft Paper pricing

Support Customers such as PepsiCo whose negotiation uses one base BF and agreed signed deltas for
other BFs.

The Stable Terms retain:

- base BF;
- one signed INR delta per other BF;
- applicable scope and effective dates; and
- later corrective versions without rewriting old Cycles.

Each Negotiation Event records the base-BF rate and snapshots the effective delta schedule. Derived
BF rates are `base rate + signed delta`, to two decimals. Permit an explicit BF-specific exception,
visibly labelled as an override. A later delta change never recalculates an earlier offer or
agreement.

The compact grid may show only the base BF. Expanding the BF group shows the complete schedule.

### 4.9 Negotiation summary and history

Negotiation Event types are Avadhoot offer, Customer counter and final agreement. Multiple events of
each side are allowed and ordered by event date plus stable sequence.

The compact Pricing Line displays:

- **Our Offer:** the first Avadhoot offer;
- **Customer Offer:** the latest Customer counter;
- **Final Agreed:** the latest final agreement; and
- an expand action showing every intermediate round chronologically.

Do not overwrite a prior offer to make room for the next one.

### 4.10 Share of Business

SOB is attached to the final applicable line/scope and uses an explicit state:

- not yet captured;
- Customer left undefined;
- not applicable;
- percentage; or
- allocated quantity.

SOB describes the line's current Pricing Cycle; there is no separate allocation frequency. The two
value states are mutually exclusive — a line carries either a percentage or an allocated quantity,
never both:

- **percentage** — required, **0.00% to 100.00%**;
- **allocated quantity** — required, whole boxes from **0 to 999,999,999** for the Cycle.

An explicit **0.00%** or **0 boxes** is a deliberate, valid allocation and must never be treated as
blank. The non-value states carry neither a percentage nor a quantity.

### 4.11 Source context

Each event may carry source type, source date, short reference/link and notes. Initial source types
are email, WhatsApp, call, meeting, Excel and other. Managed evidence-file upload is out of Phase 0.

## 5. Customer Family Details UX

Add `Pricing history` to each Customer/Prospect row in `CustomerFamiliesScreen.jsx`. Opening it uses
the existing full-width expanded-row pattern so the user remains in Family context. Extract the
workspace into focused modules; do not turn `CustomerFamiliesScreen.jsx` into the pricing grid.

The workspace has four compact areas:

1. **Current Mechanism / Stable Terms** — collapsed summary with effective dates and edit action;
2. **Pricing History toolbar** — Cycle creation, filters, view selector, transpose, field chooser and
   paste;
3. **Pricing matrix** — the active user-configured layout; and
4. **Expanded Pricing Line** — full negotiation rounds, BF schedule, components, weights, source and
   change history.

`Start next cycle` copies structural scope, applicable Stable-Term references, BF structure and
component structure. Prior agreed values appear as locked comparison context. New offers start blank.
An explicit `Copy prior agreed to draft offer` action may populate them; no silent carry-forward.

## 6. Frontend-only layout engine

### 6.1 Non-negotiable boundary

Transpose, show/hide, ordering, grouping, pinning and drag/drop are presentation-only. The backend
returns one canonical pricing-history representation and does not implement arbitrary pivoting,
dynamic field movement or per-user layouts.

Dragging a field to a `Customer Terms`, `Cycle Terms`, grid, details or hidden area changes only where
the frontend displays it. It does not change the field's semantic owner or database location.

When a higher-level visual panel displays a field whose applicable underlying values are identical,
show it once. When they differ, show `Mixed values` with disclosure to the contributing records.

### 6.2 Supported layouts

Provide a field registry and four layout zones: `Rows`, `Columns`, `Details`, and `Hidden`.

Required operations:

- Standard orientation: Cycles/lines as rows, fields as columns;
- Transposed orientation: selected fields as rows, Cycles/lines as columns;
- reorder rows and columns;
- show/hide fields;
- group/ungroup and collapse/expand column groups;
- pin rows or columns;
- drag fields between layout zones;
- accessible menu equivalents for every drag operation;
- named saved layouts; and
- reset to the standard Customer-pricing layout.

Useful shipped presets are `Negotiation`, `BF Schedule`, `Location Comparison`, and `Annual Terms`.

### 6.3 Layout persistence

Phase 0 layout preferences are browser-local and must use the existing `src/lib/persist.js` seam.
Key them by authenticated user identity and Customer party ID. Do not add layout tables or backend
routes. Document that views do not roam across browsers/devices and are not shared with other users.

Version the stored layout shape so an invalid/older layout can fall back safely to the standard view.
Never let layout corruption affect pricing data.

### 6.4 Editing through rearranged views

Every displayed cell carries the canonical record and field identity from which it was rendered.
Editing the same value in Standard, Transposed or grouped presentation must invoke the same mutation.
Test edit round-trips after transpose and regrouping. Never infer a mutation target from visual row or
column position alone.

## 7. Excel clipboard paste

Support clipboard paste into:

1. the main pricing matrix; and
2. the expanded BF schedule.

Map pasted cells through the active layout's canonical field descriptors. Before applying, show a
preview of new records, matched records, changed values, possible duplicates, invalid rates/dates,
and unresolved Customer Location/Plant/SKU references.

Rules:

- blank cells do not erase existing values unless the user explicitly selects Clear;
- INR values are normalised to exact two-decimal values;
- zero remains zero;
- do not fuzzy-link Customer, Location, Plant or SKU identities;
- permit unresolved item scope as retained free text rather than inventing a master identity;
- preserve original pasted wording in source/context where typed mapping is ambiguous; and
- apply accepted rows in a bounded atomic batch or safe chunks, not one network round trip per cell.

File upload/import is not required for Phase 0; the accepted requirement is Excel/Sheets clipboard
paste.

## 8. Persistence and API design

### 8.1 Recommended relational shape

The implementer may refine names/normalisation, but the following independent responsibilities and
invariants must remain visible:

1. `customer_pricing_mechanisms` — one Customer's current mechanism identity, cadence and CAS token;
2. `customer_pricing_term_versions` — effective-dated Stable-Term versions, including rate/weight/
   wastage/tax/freight basis and applicability scope;
3. `customer_pricing_bf_delta_sets` plus entries — base BF and signed deltas by effective version;
4. `customer_pricing_cycles` — exact period, initiation date, optional custom label, status and CAS;
5. `customer_pricing_lines` — Cycle scope, optional Location/Plant/SKU, free-text scope, weights,
   area, SOB and CAS;
6. `customer_pricing_negotiation_events` — ordered offers/counters/agreements and source context;
7. `customer_pricing_event_components` and BF snapshots/overrides where required; and
8. `customer_pricing_change_events` — append-only actor/time/before/after evidence for direct edits.

Use permanent internal foreign keys. Preserve readable historical snapshots where later master-label
changes would otherwise make the old record ambiguous. Avoid one unbounded JSONB document as the sole
authority; typed columns are required for dates, identities, basis classifications, INR values,
percentages and common filters. JSONB may carry versioned auxiliary display/source detail where its
shape is validated and the typed authority remains clear.

### 8.2 Types and constraints

- bigint identity primary keys;
- `date` for commercial dates and `timestamptz` for audit timestamps;
- exact `numeric(...,2)` for all INR values and deltas;
- exact numeric percentages with two display decimals;
- text plus check constraints for controlled states;
- non-negative amounts except signed BF deltas;
- date-range checks;
- `including_gst` requires a valid GST percentage;
- percentage SOB requires 0-100 percentage; allocated-quantity SOB requires 0-999,999,999 whole
  boxes; the two are mutually exclusive and other SOB states carry neither;
- kg-based Rate Basis requires a Weight Basis before comparison/conversion, while incomplete capture
  may remain savable with the comparison disabled;
- every foreign-key column is indexed; and
- indexes support the primary reads: Customer + period, Cycle + scope, Line + event chronology, and
  active effective-dated Stable Terms.

### 8.3 Direct edit, audit and concurrency

There is no Maker/Checker confirmation. Every authorised editor may create and edit the business
record directly.

Direct editing does not mean last-write-wins or no audit:

- use `content_version` compare-and-swap on mutable mechanism, term, Cycle and Line records;
- a stale write returns a stable conflict response and never silently overwrites another user;
- record actor, timestamp and material before/after evidence in the same transaction;
- negotiation rounds remain distinct events;
- correcting an event is visibly auditable; and
- ordinary application users receive no hard-delete path for commercial history.

The UI may feel spreadsheet-like while mutations remain atomic row/change operations underneath.

### 8.4 Authorisation and RLS

This feature is open to all **authorised application users who can read the Customer master**, not to
anonymous callers and not to arbitrary authenticated users without Customer visibility.

- Reuse the caller's `read_party_master` boundary for read and direct-edit eligibility unless the
  existing capability architecture supplies a strictly equivalent narrower predicate.
- Do not require `manage_customer_master` merely to avoid a Checker workflow; the Product Owner has
  chosen collaborative direct editing.
- Enforce Customer/party visibility in RLS and every route. UI hiding is not authorization.
- Enable and force RLS on every exposed table.
- Grant only the required table/sequence/function privileges; anon/public receive none.
- Policies use `TO authenticated` plus the real authorization predicate; `TO authenticated` alone is
  insufficient.
- UPDATE policies require SELECT visibility plus both `USING` and `WITH CHECK`.
- If a SECURITY DEFINER mutation is required for atomic audit/CAS, keep the privileged function in a
  non-exposed schema, set an empty/fixed search path, check the calling identity and capability inside
  the body, and revoke default PUBLIC execution before narrowly granting the wrapper path.
- Views, if any, use `security_invoker = true` or remain unexposed.

Follow the repository's current imperative-migration workflow. During implementation, inspect the
installed Supabase CLI with `--help`, review the current Supabase changelog/docs, create a migration
through the repository's supported migration command, run focused database tests/advisors, and do
not apply to the live project without separate explicit authority.

### 8.5 API surface

Prefer a Customer-scoped read model, for example:

- `GET /masters/parties/<party_id>/pricing-history`;
- focused mechanism/term/Cycle/Line/Event mutation routes carrying expected versions; and
- one preview/apply route pair for accepted clipboard batches.

Use the caller token on every database operation. Return stable error codes for invalid input,
capability denial, stale version, missing identity, duplicate event/scope and batch-preview expiry.
Do not use the service role from the frontend.

The read response should be sufficient for all frontend layouts without additional per-cell calls.
Avoid N+1 reads; fetch the Customer's bounded history and related identities in joined/batched reads,
with pagination or period filters once record volume warrants it.

## 9. Frontend implementation seams

Recommended separation:

- `src/tabs/customer-pricing/CustomerPricingHistory.jsx` — workspace composition;
- focused mechanism, toolbar, matrix, expanded-line, BF and history components;
- `src/lib/customerPricingModel.js` — canonical derivation, summaries, validation and exact decimal
  display helpers;
- `src/lib/customerPricingLayout.js` — field registry, transpose/group/pivot presentation and layout
  migration only;
- `src/lib/customerPricingPaste.js` — clipboard parsing and preview model;
- `src/lib/customerPricingActions.js` — authenticated API mutations; and
- a focused state hook if asynchronous state cannot remain local to the workspace.

Use `src/lib/apiClient.js` for transport and `src/lib/persist.js` for browser-only layout state.
Do not add pricing-history data to legacy `cbb_*` local storage. Do not put arbitrary pricing state
into `AppStateProvider` unless another live surface genuinely consumes it.

Gate rollout through the existing feature-flag pattern. The flag controls mounting/visibility only;
it is not an authorization control.

## 10. Delivery slices

Move continuously through these slices. Do not create a new Product Owner approval ceremony between
them; the feature and its behaviours are approved by this plan.

### P0.1 — Foundation and one thin vertical path

- schema, constraints, RLS, privileges and caller-scoped read/write path;
- Customer Family `Pricing history` entry point;
- one Customer mechanism, one Cycle, one Pricing Line and multiple Negotiation Events;
- direct edit with CAS and audit; and
- standard compact grid with first/latest/final summary.

**Exit:** an authorised user can create, reload and edit a real Customer pricing record; another
authorised user cannot silently overwrite it; anon and unauthorized callers cannot read/write it.

### P0.2 — Commercial mechanisms

- all Rate and Weight Bases;
- Wastage and GST treatment;
- effective-dated Conversion/Freight;
- BF base/delta schedules and snapshots;
- multiple Locations/Plants/items;
- SOB states including explicit zero; and
- `Start next cycle` with prior comparison.

**Exit:** the representative per-piece, per-kg, Kraft/BF-derived and per-square-metre Customer cases
can be captured without inventing a second Costing rule.

### P0.3 — Flexible presentation

- field registry and shipped column groups;
- show/hide/reorder/pin/group/ungroup;
- Standard and Transposed orientations;
- drag/drop plus accessible menu equivalents;
- common-value/Mixed-value header summaries; and
- browser-local named views per user and Customer.

**Exit:** rearranging the same record changes no API payload or persisted commercial value, and an
edit made through a transposed layout updates the intended canonical field.

### P0.4 — Excel paste and history usability

- main-grid and BF-matrix clipboard paste;
- preview/mapping, explicit-clear semantics and bounded batch apply;
- filters, expanded negotiation timeline and change history; and
- useful empty/loading/error/conflict states.

**Exit:** a representative Customer Excel extract can be pasted, reviewed and applied without
per-cell entry or silent identity matching.

### P0.5 — Beta qualification

- exercise representative Customer mechanisms and edge cases at the beta laptop resolution;
- verify caller boundaries and concurrency with real authenticated test personas;
- confirm Costing/Quote results and issued evidence are untouched;
- run focused regressions and database advisors;
- record known non-blocking debt; and
- enable the feature only in the authorised Beta environment.

**Exit:** users can maintain the next real pricing cycle in the app, preserve its negotiation record,
and retrieve the prior decision without returning to a Customer spreadsheet as the primary record.

## 11. Verification contract

### Database and backend

- schema constraints for every controlled state and blank/zero distinction;
- RLS read/write allow and deny cases, including anon/public refusal;
- Customer A cannot be addressed through an unauthorized identity/path;
- CAS conflict leaves stored data unchanged;
- audit and business mutation commit atomically;
- event chronology and compact first/latest/final derivation;
- BF signed deltas, snapshots, exceptions and two-decimal rounding;
- SOB undefined versus 0%;
- GST-inclusive historical snapshot;
- batch paste applies all accepted rows or reports a bounded partial-failure contract explicitly;
- route tests use caller context and stable errors; and
- advisors/missing-FK-index checks before activation.

### Frontend pure-model fixtures

- Cycle labels for every frequency and date boundary;
- display-date modes before/after agreement;
- every Rate/Weight/Wastage/Freight/SOB state;
- first Avadhoot offer, latest Customer counter, final agreement;
- transpose twice returns the same canonical mapping;
- group/ungroup, hide/show and pin do not alter data;
- `Mixed values` never claims a common value;
- corrupt/old local layout falls back safely;
- edits and clipboard paste map correctly in Standard and Transposed views;
- blank paste does not erase and explicit zero survives; and
- exact two-decimal INR rendering.

### Browser journeys

- open from a Customer inside Family Details;
- create and reopen a Cycle;
- multiple negotiation rounds and expanded timeline;
- BF-derived schedule;
- annual Conversion/Freight with a shorter Kraft cycle;
- multiple Locations/Plants;
- SOB undefined and 0%;
- save and switch named views;
- transpose and edit;
- paste a representative Excel block; and
- concurrency conflict recovery without lost work.

Use the repository's current named scripts discovered through `npm run`; do not rely on historical
test counts. A production build/module contract is required for new frontend modules. Documentation,
fixture-browser, authenticated-local, live-Beta and Product Owner evidence must be reported as
separate levels rather than collapsed into one "verified" claim.

## 12. Explicit non-goals for Phase 0

- foreign currencies or exchange rates;
- managed email/WhatsApp ingestion or attachment storage;
- AI extraction, price recommendations or narrative interpretation;
- automatic change to Costing, margin, Pricing Basis or Quote approval;
- automatic creation of a new offer from the previous agreement;
- arbitrary backend pivot/layout storage;
- shared or cross-device view preferences;
- a full generic spreadsheet formula engine;
- non-Admin bulk file import/export;
- Checker approval or cell-level approval workflow; and
- broad Commercial Intelligence implementation.

## 13. Reviewer and handoff protocol

Claude owns implementation and focused verification for each slice. Codex remains the reviewer.

At each slice handoff, provide:

1. exact frontend/backend files changed;
2. migration name and whether it is local-only, applied anywhere, or unapplied;
3. user journey now working;
4. focused checks run and their results;
5. browser evidence level;
6. known baseline failures or environment limitations; and
7. any Product Owner ambiguity that genuinely prevents the accepted behaviour.

Codex will review proportionately and classify findings as Speedbreaker, Fix in this increment,
Follow-up debt or Observation. Only concrete security/authorization leakage, destructive data risk,
corrupted pricing/audit authority, unsafe live migration, lost concurrent work, or a demonstrated
regression in the accepted journey warrants stopping the affected lane.

Do not let unrelated historical lint, documentation debt, missing ideal abstractions or unexercised
unaffected gates delay this Beta-critical vertical feature.

## 14. Phase 0 completion standard

Phase 0 is complete when:

- Customer Family Details opens a sustainable Customer pricing record;
- all four approved Rate Bases and three Weight Bases work;
- long-lived terms are not repeated visually unless the user chooses to show them;
- every offer/counter/agreement round is retained;
- the compact row displays first Avadhoot offer, latest Customer offer and final agreement;
- BF-derived and fixed annual component mechanisms work;
- applicable periods and user-selected Date display work;
- SOB distinguishes undefined, not captured, not applicable and explicit 0%;
- Excel clipboard paste has a safe preview;
- users can rearrange and transpose fields without backend semantic changes;
- direct collaborative editing is audited and concurrency-safe;
- unauthorized/anon access is refused; and
- the Beta journey is exercised on representative real-world Customer patterns with no change to
  Costing or immutable Quote evidence.

The governing presumption after this handoff is: implement the smallest end-to-end slice, verify the
affected boundary, integrate it, and continue toward Beta.
