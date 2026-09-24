# Quotation simplification — H0 handoff and S1 evidence

Date: 2026-09-23  
Status: H0 complete; revised S1 implemented and locally verified; awaiting review; not committed or deployed

## H0 — handoff and baseline

The quote-journey slice 2 handoff was already coherent when this increment began:

- frontend `bc1d50a` — explicit quote lane, truthful partial readiness and revision-owned
  shareability;
- frontend `8cb8ae1` — governed Sector master consumer, committed separately;
- backend `2777517` — caller-token Sector routes and additive migrations, committed separately;
- frontend and backend primary worktrees were clean; and
- the product-simplification plan was committed separately as `423b2e1`.

One linked frontend worktree remains user-owned and dirty on
`worktree-agent-a2b53170ad09a5edf`. Its changes are limited to Pricing Basis, Customer Families,
and `src/index.css`. S1 did not edit that linked worktree and avoided its application feature files
and `src/index.css`. The primary worktree's `pricing-basis-fixtures.mjs` assertions necessarily
changed for the S1 navigation contract; the linked worktree's independent copy remains untouched.
New S1 styling lives in `src/tabs/batch/BatchFirstShell.css` specifically to avoid mixing with the
concurrent CSS work.

### D-1 to D-9 selections

The Product Owner's simplification direction resolves the earlier decision packet for this
programme as follows.

| Decision | Governing selection |
|---|---|
| D-1 | **Batch Builder first.** Makers land in the multi-item workspace. `New customer quote` is the primary action. Approval Inbox is promoted only when `check_quote` is actually held; no role dashboard is added. |
| D-2 | **Quick calculation remains a secondary private scratchpad.** S1 does not change exports. Removing its typed Quote reference and marking retained output `QUICK CALCULATION — NOT A QUOTE` remain S4 work. |
| D-3 | **One governed row set is the destination once a customer Batch exists.** Do not add more local-to-governed bridge work in S1. Costing remains the individual-row deep-dive and private scratchpad. |
| D-4 | **Preview, then Share with customer as an explicit recorded act.** Manual channel/date/reference is sufficient for the initial programme; email and WhatsApp integration remain deferred to S4 or later. |
| D-5 | **Price first, then why.** Revision comparison leads with item rate and total; detailed input and authority changes stay behind disclosure. Deferred to S5. |
| D-6 | **Latest approved revision for this Customer and Plant in the workspace.** Cross-customer Construction/SKU intelligence remains outside the initial authorization boundary. Deferred to S5. |
| D-7 | **Sourced suggestions require deliberate acceptance.** No price-driving historical value becomes a default. Negotiated margin or commercial conditions are not reused by the initial simplification programme; existing authority and approval rules continue to decide them. |
| D-8 | **One-row Batch toolbar at the beta width.** The primary Quote action moves above the workspace; secondary utilities are under `Batch tools`; row types are under the customer-facing `Add product` action. |
| D-9 | **1366×768 and five seconds.** The primary next action must be identifiable within five seconds; multi-item and SET work remain first-class. Exact typical item counts remain pilot observation, not a prerequisite for S1. |

New ornamental, master and administration destinations are frozen for the simplification programme.
Existing destinations remain reachable but are consolidated under collapsed `Reference data` and
`Administration` sections rather than dominating the Maker path.

### Reproducible baseline

The slice-2 1366×768 fixture-browser capture remains in
[`quote-journey-slice-2-closure.md`](quote-journey-slice-2-closure.md). This run reproduced its
named gates before S1: journey 69/69, construction safety 15/15, screen standard 38/38, Pricing
Basis 108/108, production module-contract build, costing golden cases, negative Case 4, and backend
Sector routes 64/64 using the repository virtual environment.

Parity references selected for later calculation/document slices:

- `scripts/costing-golden.json` and `scripts/case4-reference.mjs` for calculation parity;
- `../quote-gen-be/AvadhootPacks_Quotation_Master_v7.xlsx` as the official quotation-template
  authority; and
- `../APSPL NAGPUR Master_20260720.xlsx` as the accepted Nagpur source-workbook baseline.

S1 changes no calculation or document output, so these references were selected and the costing
goldens were run; no workbook bytes needed to change.

## S1 — Batch-first shell

### User-visible outcome

- The authenticated default destination is Batch Builder.
- With no governed Batch active, Batch Builder shows only a 59px compact landing with
  `New customer quote` and `Open active Batch`. Quotes, Approval Inbox and Quick Calculation remain
  global-navigation destinations rather than duplicated launcher cards.
- With a governed Batch active, the landing disappears completely and its 59px returns to the
  multi-item grid. At 1366×768 the active fixture displayed the delivery group plus six full SKU
  rows with a 143px grid start and no page overflow.
- The existing 50px shared header carries one-line Batch identity, customer, current stage,
  truthful `Next` action and blocker count. Its stage disclosure shows all seven stages; completed
  and currently available stages open their owning surface, while future stages are disabled with
  the reason they cannot yet be opened.
- Approvers receive Approval Inbox through capability-gated global navigation; Makers and Admins
  without `check_quote` do not see a false or disabled inbox. No general dashboard was added.
- Costing is labelled `Quick calculation` when used privately and `Costing deep-dive` when opened
  from a Batch row. A deep-dive retains exact Batch and row context and has one guarded return to
  the originating row. A dirty review must pass the existing confirmation before either that return
  or Quick Calculation can proceed. The specification form, engineering evidence, result and cost
  build-up are unchanged.
- Private Quick Calculation explicitly has no Batch journey context. Quotes separately identifies
  Working Quote Items, Governed Quote evidence or Quote History, and carries exact revision identity
  only when one is selected. Approval Inbox has no Quote context until a specific item is opened.
- `Review the customer document` always opens Working Quote Items, even if History was selected
  previously. Focus-mode `Next` first restores hidden Batch controls and then focuses its target.
- Master destinations remain reachable behind one collapsed `Reference data` section;
  administration remains collapsed and capability-gated.
- The Batch toolbar is 43px at 1366×768. `Batch tools` retains context import and code generation;
  `Add product` retains Box, Plate, Part-L and Part-W creation.
- Backup and Restore moved into the account disclosure so the shared header remains one line.

### Verification

- `npm run test:batch-first-shell` — 24/24.
- `npm run test:journey` — 70/70.
- `npm run test:screen-standard` — 38/38.
- `npm run test:pricing-basis` — 108/108.
- `npm run test:construction-safety` — 15/15.
- `npm run test:costing` and `npm run ref:case4` — golden values unchanged.
- `npm run test:module-contract` — production build passes.
- Focused ESLint passes on the corrected shell, navigation, journey, Costing and Quotes files.
  The touched legacy state hooks also pass with their already-recorded `no-unused-vars`/`no-empty`
  baseline rules disabled; broad changed-file lint continues to expose only that legacy debt plus
  `AuthContext.jsx`'s pre-existing Fast Refresh finding on the existing `useAuth` export.

Browser, explicit 1366×768 viewport, light scheme, development-only labelled profiles:

1. Empty Maker landing: viewport and document were both exactly 1366×768; the shared header was
   50px, the landing was 59px, and its only controls were `New customer quote` and
   `Open active Batch`. The grid began at 202px.
2. Active Maker Batch: viewport and document remained exactly 1366×768; the landing was absent,
   the grid began at 143px, and seven grid body rows were visible (one delivery group plus six SKUs).
   The recovered vertical space was exactly the 59px landing height.
3. The active header measured 50px with 48px scroll height and no internal wrap or overflow. The
   seven-stage disclosure showed Customer and Products as openable; Price, Review, Customer
   document, Approval and Shared remained visible but disabled with concrete readiness reasons.
4. Batch → row magnifier opened the full Costing deep-dive with `← Batch Builder`, permanent Batch
   reference, customer and Row 1 in the same shared header. Returning restored Batch Builder and
   keyboard focus to `batch-row-s1-row-1`.
5. After editing the review copy, attempting Quick Calculation raised the shared confirmation:
   cancelling means stay in Costing deep-dive, so the open review cannot be silently relabelled or
   discarded. The same guard backs the header return and the Costing close action.
6. Private Quick Calculation showed `Private · no Batch context` in the shared header. Its existing
   detailed Costing workspace remained intact.
7. Focus mode kept the header `Next` target visible. Activating it restored Batch Profile and global
   navigation, exited focus mode and focused `Calculate All` instead of doing nothing.
8. Quotes opened Working Quote Items by default; switching to Governed and History published the
   correct distinct header context, and returning to Working restored the active Batch journey.
   Pure-behaviour coverage verifies `Review the customer document` forces Working even after History.
9. At exactly 1366×768, Maker, Approver and Admin each had no page overflow and the same 50px
   header. Approval Inbox appeared only for Approver; Users & Access appeared only for Admin.
   Approval Inbox itself showed no quotation context before an item was selected.
10. Browser console had no application errors; only the pre-existing Vite development warning about
    the browser-externalized `stream` module appeared.

Not verified: an authenticated-live Batch catalogue, a successful governed Batch create, persistent
row writes, deployed behavior, Product Owner acceptance, official export, or a timed five-minute
quote. S1 does not move those boundaries and performs no new API mutation.

## Findings

- **Speedbreaker:** none.
- **Fix in this increment:** the original large launcher rail was replaced by the two-action empty
  landing and removed for an active Batch; duplicated awaiting/next guidance was removed; journey
  context moved into the shared header; Working/Governed/History routing, dirty-review Quick exit,
  and focus-mode Next defects were corrected. Browser verification also found that returning from
  Costing could scroll to but not focus a `<tr>`; making the originating row programmatically
  focusable completed the guarded return.
- **Follow-up debt:** authenticated-live Maker/Approver/Admin qualification and Product Owner timing
  observation remain required. Quick-calculation export demotion remains S4, not S1.
- **Observation:** the linked user-owned frontend worktree remains dirty and untouched. The
  development console's `stream` compatibility warning predates S1 and did not affect the journey.

## Recommended S2 scope

Implement direct governed Batch start from Customer/Prospect and producing Plant, then add several
established SKUs or create a minimum Proposed SKU inline. Reuse the existing caller-scoped Batch,
SKU and durable-row routes; do not create a local-to-governed promotion bridge, change calculations,
or expand master navigation. Finish with several durable rows in one Batch and Costing available
only as the selected row's deep-dive.

## 2026-09-23 — customer handoff candidate for review (after S1, uncommitted)

The next bounded increment implements the customer handoff part of the above S2 recommendation;
it does **not** start the multi-SKU part. The creation panel now chooses a current active
Customer/Prospect member, separately from its Family. A single-member Family suggests its sole
member; a multi-member Family cannot create a Batch until the Maker chooses one. Customer, Family,
Plant and Sector are shown immediately. Initial Ship-to, Bill-to and 30/45/60/90-day payment terms
are collected in the same form. If an approved Location is missing, required quote-specific
destination text is saved separately from approved Location identity. The form states that typed
text does not make master-backed route/freight calculation ready. Optional commercial overrides
remain null and inherited.

One additive, unapplied backend migration adds `batches.customer_party_id` plus distinct
`delivery_groups.destination_text` and `billing_text`, and a single atomic creation RPC. The
existing Batch RPC remains for historical callers; the new customer-facing route requires the
exact member and handoff fields. The workspace read-back and reopen path hydrate the Batch Profile
from the saved governed record, not from the form or a Family-name substitution. The exact
Customer is also visible in the Batch workspace, and the shared header prefers that selected
Customer. No S1 permanent launcher height is restored.

Focused checks: backend route gate 111/111; frontend pricing 108/108, journey 70/70, Batch
catalogue 24/24, S1 shell 24/24, screen standard 38/38, draft gate, build and focused ESLint all
pass. The isolated browser fixture exercised a single-member Customer with approved Ship-to and
Bill-to, and a multi-member Prospect with missing approved Locations. In both, reopening the
in-memory fixture showed the same exact Customer, Family, route context and payment terms. The
multi-member form blocked creation before explicit member, destination and terms choices. The
fixture runs at the browser's 813px viewport; this increment has **not** repeated the exact
1366×768 S1 layout check. The earlier S1 browser check remains recorded above.

**Not verified:** the new SQL has not been applied or executed against a database; the Supabase
CLI and local `psql` are unavailable in this workspace. No authenticated-live create/reopen,
official Quote document, export, deployment or Product Owner acceptance was exercised. In
particular, typed destination text is a saved quote brief, not approved Customer Location or
calculation readiness. This is a review candidate, not a live-release claim.

Findings: **Speedbreaker:** none for this uncommitted increment. **Fix in this increment:** exact
member persistence and reopen; explicit missing route/terms capture; ambiguous route-notes reuse
avoided; fixture-only creation now clears stale rows/profile and retains its group identities;
outdated fixture assertions updated to the already-settled S1 navigation. **Follow-up debt:**
apply and qualify the migration in an authorized environment before any release; repeat 1366×768
and authenticated-live browser creation/reopen then. **Observation:** typed route details remain
separate from approved Locations, so governed calculation and Send gates still enforce their
existing route-readiness rules.

Recommended remaining S2 scope: add several established SKUs as durable rows within the newly
created Batch, and allow a minimum Proposed SKU inline where the master is missing. Retain the
Costing deep-dive and existing calculation, approval, revision and export authority unchanged.

## 2026-09-23 — handoff correction and bounded multi-row continuation

This section supersedes the earlier candidate's statements that the migration was unapplied and
that no multi-SKU work had started. The user explicitly authorized the connected trial-data
project's live/main database after no isolated branch or local Postgres was available. The
additive handoff migration applied there as version `20260923132556`; the local migration filename
now matches that recorded version. Code remains uncommitted and undeployed.

- The `SECURITY DEFINER` handoff checks both `read_party_master` and `make_quote` at the producing
  Plant. An authenticated Sonali Maker transaction with the read grant temporarily revoked refused
  guessed Party/Location IDs with `42501`; the transaction rolled back and her read grant remained
  active. Her actual profile has the read grant and a usable governed selection path. No grant or
  visibility was broadened.
- The canonical Prospect operation produced a `proposed` Party and new `proposed` Family. A Maker
  could create and reopen a Batch with that exact Party, selected Plant/Sector, quote-specific
  delivery and billing destinations, and terms. An additional proposed member in the same Family
  was selectable exactly. Inactive Party, merged Party and retired Family trials were refused.
  These database probes rolled back; a later read confirmed no trial identities remained.
- The New Customer Quote form now uses one `Find or create Customer/Prospect` disclosure, matching
  the Customer Profile pattern: search existing identities, or offer `Create as a new Prospect`
  for unmatched text. It invokes the existing governed creation route and duplicate suggestions,
  refreshes caller-visible choices, selects the exact new Party/Family and retains valid Plant and
  Sector. The Maker completes destinations and payment terms in the same quote window. At
  1366×768, the control occupies one compact line when closed; the creation form scrolls inside its
  overlay, not the page.
- Active Batches now means `working`, `sent`, `submitted` and `approved`, queried server-side before
  the 50-row limit. `issued_locked`, `abandoned` and `archived` are separate. An older-work cursor
  reaches open Batches beyond the first page; immutable Quote History is not mixed into the list.
- The bounded S2 row path now offers `+ Add governed SKU row` from active Batch Builder. The row
  editor searches eligible established SKUs first, including item description and caller-visible
  recent use. When needed, it creates a proposed SKU for the exact selected Customer against an
  adopted Construction Version, then uses the existing governed row route. The editor remains
  ready for another row. No calculation or document authority changed.

Focused checks: backend handoff/Batch route 119/119 and catalogue 17/17; frontend Pricing Basis
109/109, Batch catalogue 24/24, Quick Create gate, targeted ESLint and production build passed.
The fixture browser exercised Find → create proposed Prospect/new Family → fill destinations and
terms → Batch Profile/reopen → create proposed SKU → add two durable rows in one Batch, at
1366×768. A fixture-only string-ID conversion error found during this journey was corrected;
the adopted Construction Version now remains exact rather than displaying `NaN`.

An authenticated-role live database trial (Sonali) also created a canonical proposed Prospect and
Family, handed them to a Batch, proposed **two distinct SKUs**, inserted two durable rows, and
read back both rows and the exact selected Party. All trial writes occurred inside an exception
subtransaction and rolled back; a separate read found zero trial Parties and rows. This verifies
database authority and persistence rules under her role, but is **not** a completed authenticated
browser or HTTP create/reopen journey.

Findings: **Speedbreaker:** none in the tested handoff and row paths. **Fix in this increment:**
selection-capability enforcement, canonical proposed identities, integrated Find/create,
truthful open-work listing, fixture identity conversion, and repeatable durable-row entry.
**Follow-up debt:** authenticate the full browser/API journey and verify a true established-SKU
selection in that journey; exact selected-Customer identity in the immutable Quote/export is a
required acceptance criterion before calling this an end-to-end customer quote. **Observation:**
typed destinations remain distinct from approved Locations and therefore do not bypass route or
freight readiness. Product Owner review is pending; neither S1 nor S2 code has been committed or
deployed.
