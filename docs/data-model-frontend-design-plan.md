# CFB Quotation OS — Frontend Data Management Design Plan

**Status:** Product Owner planning reference. This document defines the intended frontend delivery
structure and records product directions that must be reconciled with the canonical data-model
documents before implementation. It does not by itself authorise frontend, backend, database,
migration, deployment, push or commit work.

**Relationship to the canonical programme:** The canonical database sequence remains S0a–S13.
The `U` packages below are frontend delivery packages, not new canonical phases or replacements for
the slice numbers. Where this document conflicts with an earlier commercial rule, SR DEV must identify
the conflict and prepare the necessary canonical amendment rather than silently choosing one version.

**Excluded:** Commercial Intelligence remains entirely outside scope.

---

## 1. Objective

Build the user-facing data-management and workflow layer over the governed CFB Quotation OS data
model. The frontend must make the accepted identities, relationships, plant boundaries,
capabilities, lifecycle rules, versions, approvals and workflow operations usable without becoming
an alternative authority.

Creating database tables does not create frontend screens. Each screen needs an approved user flow,
field set, access model, backend/RPC contract, error behaviour and acceptance evidence.

## 2. Governing frontend principles

1. The database and caller-context backend enforce security; hiding buttons is only a usability aid.
2. Formal writes use governed backend operations or RPCs. The frontend must not reproduce workflow
   or approval rules in browser-only logic.
3. Permanent internal identities are used for relationships. Users see meaningful permanent codes
   and names.
4. Proposed, Draft, Approved, Published, Withdrawn, Retired and Discontinued states remain visibly
   distinct.
5. Approved and published versions are immutable. Corrections create new versions or replacements.
6. Blank/inherit, explicit zero and unresolved are different states and must look different.
7. Stale versions, lock conflicts, access denial and validation failure must produce actionable
   messages; silent RLS no-ops must not be presented as success.
8. Frontend state is not formal authority. Historical Quotes render stored snapshots and never rerun
   current calculation logic.
9. Localhost and Vercel are different application builds even when they point to the same Supabase
   project. A feature appears on Vercel only after approved code is pushed and deployed with the
   correct configuration and feature flag.

### 2.1 Delivery pace, evidence and proportionate gates

> **Product Owner decision — 2026-09-08.** The application is still in private development and has
> not been shared with any other user. Current development users, login activity and business rows
> have been created only by the Product Owner and may be recreated. Development-data preservation
> must therefore not be treated as if it were production-data preservation when that would materially
> delay delivery. Source integrity, migration reproducibility, security boundaries and the accepted
> data model remain non-negotiable.

The programme is a product-building journey with proportionate speedbreakers, not a sequence of gates
that prevents forward movement. Reviews and tests exist to catch credible accidents while allowing
the next useful, visible increment to ship.

1. **Stop-the-line risks** are credible threats to source or migration history, security or access
   boundaries, canonical architecture, irreversible external state, or production/shared data. These
   block progress until resolved or explicitly ruled on by the Product Owner.
2. **Recoverable development-state risks** include loss of the Product Owner's current development
   rows, recreated test identities, localhost configuration and disposable test artefacts. They must
   be disclosed and handled deliberately, but do not by themselves justify prolonged suspension of
   product delivery.
3. **G-A remains mandatory** after database migration work, together with the relevant database tests,
   backend regression suite, permission checks, HTTP probes, frontend fixtures, build and lint gates.
4. **G-B is a milestone gate**, required at major backend/stage closure, before deployment, when
   migration drift or replay integrity is in doubt, or when the Product Owner specifically requests
   it. It is not automatically repeated after every intermediate frontend-enablement slice. A
   Product Owner-approved deferral must be recorded explicitly; it is neither a passed gate nor a
   failed implementation.
5. A missing convenience tool or a desire to preserve disposable development data is not automatically
   a genuine blocker. The team must first consider safe, bounded alternatives and the actual business
   consequence of proceeding.
6. Backend foundations must be converted into **visible frontend increments promptly**. A substantial
   backend capability should be followed by the smallest useful screen, action or workflow that lets
   the Product Owner see and exercise it; backend completion alone must not be presented as equivalent
   to delivered product value.
7. Every increment reports status separately as **implemented**, **tested**, **technically closed**,
   **feature-enabled/currently visible**, and **Product Owner validated**. These terms are not
   interchangeable.
8. Feature-flagged work is not Product Owner-visible merely because its code exists. Localhost
   configuration, caller capability and a real-browser walkthrough form part of visible acceptance;
   production enablement remains separately authorised.
9. Review rounds must converge. Once credible safety, correctness and scope issues are resolved, work
   proceeds to the next visible increment. Repeated planning or proof redesign without a newly
   evidenced material risk is not a substitute for implementation.
10. No relaxation in this section authorises bypassing governed operations, weakening RLS or caller
    checks, exposing privileged credentials, rewriting migration history, silently crossing `S`/`U`
    scope, deploying, or pushing code without the separately required approval.

### 2.2 The Master-backed selector contract

> **Product Owner decision — 2026-09-08.** Settled architectural principle, established while
> correcting U1 Slice D's Batch Entry Client control and now binding on every master-backed control
> in U1–U6. Where an existing screen disagrees with this contract, the screen is wrong.

A **master-backed selector** is any control whose value designates a row in a governed master. It is
not a text box that happens to hold a name. Eleven rules govern all of them.

1. **Free text begins a search.** Typing filters the governed master. It is the entry point to
   finding a record, not a way of asserting one.
2. **Free text may initiate explicit governed creation when the record is genuinely new** — through
   the governed operation that exists for that master, never a client-side invention, and never
   silently. Unmatched text that is simply accepted as a final value is a defect.
3. **Existing records are selected from the relevant governed master**, not retyped. Retyping an
   existing record's name is the failure this contract exists to prevent.
4. **Newly created records become immediately selectable** — the control re-reads the master after a
   successful create, so the new row is genuinely there rather than assumed.
5. **Suggestions show sufficient identity context, not only the editable label**: permanent code
   where one exists, lifecycle or status, and parent/scope context. A list of bare names is not a
   safe selector, because two rows may share a name.
6. **Labels are presentation values, never relationship keys.** A display name, a code rendered for
   humans, or any concatenation of them is something to read — never something to resolve identity
   from.
7. **Temporary legacy string storage must be disclosed and must never be presented as durable
   linkage.** Where a stage stores a string for legacy compatibility, the UI says so plainly and the
   documentation records the limitation. "It looks linked" is not linked.
8. **Durable workflows persist permanent entity IDs and, where the entity is versioned, the
   applicable immutable version ID.** A durable relationship is an ID pair, not a rendered string.
9. **Historical Quotes preserve those references plus the accepted display and calculation
   snapshots.** A Quote records what was referenced *and* what was shown and computed at the time.
10. **Renames, reassignment and later master changes must not rewrite historical Quotes.** History is
    what happened, not what the master says today.
11. **Ambiguous normalized matches must never be selected automatically.** Where normalisation makes
    two or more governed rows indistinguishable from the text, the control reports ambiguity and
    requires a human choice. Silence, or picking the first, is prohibited.

**Capability and scope determine browse, create and select behaviour independently.** Holding the
capability to create a record does not imply the capability to browse the master, and vice versa. A
caller who may create but not browse must be shown the create path and told plainly that their text
is not known to be a governed record — never a dropdown that will be refused, and never an
implication that what they typed is already governed. Plant, Family and other scope restrictions
narrow what may be selected independently of both. These are usability aids; the backend and RLS
remain the authority (§2 item 1).

#### 2.2.1 Mapping the contract to each master

| # | Master | Selector behaviour under this contract |
|---|---|---|
| 1 | **Customer Family and Party** | Search the governed Party/Family master; select an existing Customer or Prospect; create a genuinely new one as a governed **Prospect** via `create_minimal_prospect`. Suggestions show display name, lifecycle, Customer Code where present, and current Family. Graduation to Customer — which mints the permanent Customer Code — is a **separate** Customer Master action requiring `manage_customer_master`, deliberately not reachable from Batch Entry. Browse needs `read_party_master`; create needs `manage_customer_master` OR `make_quote`. |
| 2 | **Customer Location** | Search a Party's governed Locations; select by permanent Location Code where minted; propose a new one via `propose_customer_location`. Suggestions show code, Bill-to/Ship-to eligibility, status, incomplete-details state and the owning Party. Eligibility is fixed at proposal. Durable Bill-to/Ship-to references are U4 (§2.2.3). |
| 3 | **SKU and SKU Version** | Search within the applicable Customer and Plant scope; select an SKU **and** the applicable immutable SKU Version. Suggestions show permanent SKU code, version number, status and applicability. A genuinely new SKU is created as a governed **Proposed** SKU. Durable Batch and Quote references persist SKU ID **plus** SKU Version ID. |
| 4 | **Construction and Construction Version** | Search the Construction Library within plant adoption scope; select a Construction and its approved, immutable Construction Version. Suggestions show the construction identity, version, status and adopting plants. Never resolved from a rendered construction name. |
| 5 | **Pricing Basis Release and governed commercial masters** | Select an approved, effective Release for the plant and date; suggestions show release identity, effective window, status and eligibility reason. Durable workflows persist the Release ID; a Quote records which Release priced it and never re-resolves it later. |
| 6 | **Bill-to and Ship-to selection** | Two independent selections over eligible Customer Locations, each honouring its own eligibility flag and scope. They are **not** the freight destination (§2.2.3) and are not one field. Cross-Family third-party selection is a U4 Delivery Group concern. |
| 7 | **Any similar master-backed control introduced in U1–U6** | Same eleven rules, same capability independence, same disclosure obligation for any temporary string storage. A new control does not get an exemption because its master is small or its screen is minor. |

#### 2.2.2 Cross-stage implementation map

| Stage | What the contract requires there |
|---|---|
| **U1** | Customer/Prospect and Customer Location master search, suggestion, selection and governed creation. Storage remains a temporary legacy string, disclosed as such. |
| **U2** | Customer-scoped and Plant-scoped SKU search and suggestion; governed Proposed SKU creation; SKU **Version** selection as a first-class act, not an afterthought of picking an SKU. |
| **U3** | Governed commercial-master and Pricing Basis Release selection, with eligibility for plant and date shown rather than assumed. |
| **U4** | **Durable Batch persistence** of Party, Family, Bill-to Location, Ship-to Location, SKU and SKU Version relationships as permanent IDs — while keeping the freight destination conceptually separate from Customer Location. |
| **U5** | Formal Quote references — the persisted IDs and version IDs — plus immutable historical snapshots of what was displayed and calculated. |
| **U6** | Audit and history presentation over those references and snapshots, showing what was true then rather than what the master says now. |

#### 2.2.3 Specific records this contract fixes

These are recorded because each one has already been got wrong once, or is a known trap.

- **Batch `delivery` is currently a freight-destination lookup key and must not also represent a
  Customer Location.** `BatchProfileBar` resolves `freight[plant][delivery]` from it to price the
  Batch. Writing a Customer Location label into it made that lookup return `0` — a misleading and
  commercially unsafe pricing state that a confirmation dialog did not redeem. One field cannot carry
  two incompatible commercial meanings.
- **Durable Bill-to and Ship-to Location references require separate fields and relationships in
  U4.** They are not `delivery`, they are not each other, and they are not a single "location" field.
- **The current `client` text cannot prove Party identity after reload.** It is a display name. Two
  Parties may share one, and a later rename never reaches a string written earlier.
- **No automatic identity inference from matching text is authorised.** Not on load, not on export,
  not during a future migration.
- **Any current UI match shown after reload is a suggestion, not evidence of linkage.** The wording
  in the UI must stop short of asserting identity, and does.
- **The legacy client-derived SKU prefix must be retired when governed SKU/code authority is
  connected.** `state/useQuoteActions.js` derives an SKU prefix from the first four characters of
  `batchProfile.client`. This is **legacy technical debt**. It is not canonical code authority and
  must not be cited to justify any future identity design.
- **The bare display-name string persisted by U1 remains only for legacy PDF, Excel and filename
  compatibility** (`export/pdf.js`, `export/excel.js`). That compatibility requirement is real, and it
  is *not* an argument that the string means anything more than a label.

## 3. Terminology

### 3.1 Producing Plant

An Avadhoot manufacturing and supplying unit such as NAG, PUN or KOL. Plant timezone is an internal
technical field if still needed by reference allocation or event handling; it is not required on the
ordinary Plant Master frontend.

### 3.2 Customer Location

A customer or legitimate third-party physical site that may be Bill-to, Ship-to, both or incomplete.
A customer factory receiving deliveries is a Customer Location, not an Avadhoot Producing Plant.

### 3.3 Delivery Group

A Batch-level pricing/presentation route referencing actual Bill-to and Ship-to Customer Locations.
It is not a plant master.

### 3.4 Plant Capability

A governed description of what a Producing Plant can manufacture or perform. Initial scope includes
flute profiles and take-up factors. Future scope may include machines, stations and process routes.

## 4. Proposed application navigation

### Work

- Start Costing
- Batch Workspace
- My Batches
- Approval Inbox
- Quotes
- Quote History

### Customer Masters

- Customer Families
- Customers and Prospects
- Customer Locations
- External References

### Product Masters

- Construction Library
- Plant Construction Adoption
- SKUs
- SKU Versions
- SKU–Location Applicability
- Specification Reference

### Commercial Masters

- Sectors and Defaults
- Rate Masters
- Freight Masters
- Annual Interest Basis
- Pricing Basis Releases

### Plant Capabilities

- Flute Profiles and Take-Up Factors
- Machines — future
- Stations — future
- Process Routes — future

### Administration

- Users
- Plant Assignments
- Capabilities
- Producing Plants
- Invitations and Orphan Recovery
- Audit History when the audit slice is delivered

Navigation visibility follows capability, but backend and database enforcement remains mandatory.

## 5. Commercial amendments requiring canonical reconciliation before S7

> **Reconciled 2026-09-06.** The directions in this section have been ruled on by the Product Owner
> and carried into the canonical record by
> [`data-model-canonical-amendment-01.md`](data-model-canonical-amendment-01.md) and the amended
> CDM-10, CDM-18, CDM-22, CDM-26, CDM-40, CDM-41 and CDM-42 in
> [`data-model-decisions.md`](data-model-decisions.md). **Those are the authority; the text below is
> the planning direction that prompted them and is retained for provenance only.** Where the two
> differ, the canonical record wins — in particular the approved annual rate is **6.000%**, not the
> 12% used as an illustration in §5.1, and the day-count basis is 360 only.

### 5.1 Annual interest basis

The intended model uses one approved annual interest percentage and derives the percentage for the
selected number of Payment Terms days.

Unless the Product Owner directs otherwise, the commercial convention is a 360-day year:

`effective_interest_pct = annual_interest_pct × payment_terms_days ÷ 360`

Example at 12% per annum:

| Payment Terms | Effective interest |
|---:|---:|
| 30 days | 1.00% |
| 45 days | 1.50% |
| 60 days | 2.00% |
| 90 days | 3.00% |

The frontend shows the annual rate, Payment Terms days, formula and calculated effective percentage.
The annual rate must be versioned and approval-controlled because it drives calculation. An explicit
Pricing Group interest override may remain only if canonical reconciliation confirms that the
existing override rule still applies.

This direction supersedes the earlier commercial result that stored separate fixed mappings such as
30 days → 0.5%. SR DEV must not implement the S7 Interest resolver against both models.

### 5.2 Flute profiles and take-up factors

Plant Capabilities must show plant-scoped, governed flute profiles with:

- Producing Plant;
- flute code and name;
- take-up factor;
- status and effective version;
- proposal, approval and withdrawal attribution;
- notes where required.

The current source reference contains A = 1.51, C = 1.45, B = 1.37 and E = 1.31, with NA = 0 for
liner layers. These are reviewed import inputs, not permanent constants to hide in frontend code.

Take-up factors affect material consumption and costing. The selected approved factor/version must
therefore participate in resolver provenance and be frozen in a formal calculation snapshot.

### 5.3 Printing Technology and number of colours

Add both fields to Box/Board specification:

- `printing_technology`: controlled selection from an approved vocabulary or master;
- `number_of_colours`: optional non-negative whole number;
- optional printing description/colour detail where operationally useful.

These belong on the immutable SKU specification version, not on global Construction. They must be
available in Costing and Batch Entry, included in Send snapshots, carried into exports and searchable
in SKU Master. They may appear in an expanded grid sub-row if the main Batch row would become too
wide.

The transitional local frontend places `Colours` and `Print Tech` directly after `Ups` and before
`Std GSM` in Batch Entry. They are row-owned fields in both Costing→Batch Send and explicit
REVIEW→Batch Push, and return to Costing on Deep Dive. They remain outside shared Construction
confirmation and do not invalidate or influence a calculation.

This direction amends the earlier deferral of colour-count capture. The new rule is:

> Number of colours is captured as specification data. It does not by itself create a mechanical
> pricing rule or mechanically decide whether a new SKU identity is required.

Printing Technology and number of colours become calculation-driving only when an approved rate
mechanism explicitly consumes them. No price formula may be invented from these fields alone.

### 5.4 Specifications Master source mapping

Use these source references for field discovery:

- `APSPL_SpecificationsMaster_TechSpec_v4.docx`
- `APSPL NAGPUR Master_20260720.xlsx`

Do not reproduce all legacy columns in the Quotation OS. Classify every candidate field as:

1. required for quotation identity or calculation;
2. required for customer-facing product description;
3. required only for manufacturing planning;
4. required only for QC/COA;
5. required only for procurement or mill assignment;
6. derived rather than stored;
7. legacy duplicate or inert field;
8. historical/searchable external reference.

Only categories 1 and 2 enter the current quotation frontend by default. Other categories require
their own approved module boundary.

### 5.5 Future machines, stations and process routes

Use `APSPL_Nagpur_Master_Operations_SOP_v8.2.docx` as the primary discovery reference.

Future Plant Manufacturing Capabilities should distinguish:

- Station — a production activity;
- Machine — a physical asset capable of one or more activities;
- Process Route — an ordered path through stations for a particular item/specification;
- alternate or conditional route steps;
- active/inactive routes without deleting history;
- effective versions and plant ownership.

Full scheduling, capacity, production rates and shop-floor execution are not imported into the
current quotation scope. A simple route reference may be added only after deciding what the current
quotation or costing process genuinely needs.

## 6. Frontend delivery packages

### U0 — frontend foundation and discovery

Canonical dependencies: accepted S1–S6 structures and current application code.

Deliver:

- screen and navigation inventory;
- browser-local versus Supabase-backed state map;
- reusable/replacement decision for each existing tab;
- route/RPC contract for every action;
- shared list, detail, version, approval, conflict and access-denied patterns;
- capability-aware navigation;
- localhost and Vercel feature-flag plan;
- Maker, Checker, Administrator, master-manager, wrong-plant and inactive-user scenarios.

No master screen begins implementation until every formal action is mapped to an existing governed
operation or identified as a missing operation.

### U1 — organisation, access and customer foundation

Canonical foundations: S1 and S3.

#### Users and access

- list, invite and administer users;
- assign multiple Producing Plants;
- grant capabilities by plant/group scope;
- activate/deactivate;
- manage login email and credentials;
- recover orphaned authentication identities;
- preserve identity and audit attribution.

#### Producing Plants

Initial frontend is read-only unless a separate plant lifecycle operation is approved. Show code,
name, status and relevant assignments. Do not show timezone in the ordinary screen.

#### Customer Families

- list, search and filter;
- permanent Family Code;
- names and aliases;
- proposed-family review;
- current Customers/Prospects;
- effective-dated membership history;
- merge and retirement actions where authorised.

#### Customers and Prospects

- quick-create minimal Prospect from Batch Entry;
- one identity across Prospect and Customer lifecycle;
- graduation and permanent Customer Code;
- Family reassignment;
- external references;
- lifecycle/history view.

#### Customer Locations

- address/site details;
- Bill-to and Ship-to eligibility;
- incomplete-details indicator;
- permanent Location Code;
- effective-dated reassignment;
- legitimate third-party Bill-to/Ship-to selection.

Acceptance outcome: an authorised user can create a Prospect and usable Location, then select them
within an allowed plant workflow without bypassing Customer Master governance.

### U2 — product and specification masters

Canonical foundation: S4 plus approved amendments from §5.

#### Construction Library

- search by permanent code, description and status;
- propose Construction;
- immutable technical versions;
- approve, publish, withdraw and retain merge lineage;
- keep global publication separate from plant adoption.

#### Plant Construction Adoption

- see published versions;
- adoption status by Producing Plant;
- authorised proposal, approval and withdrawal;
- prevent wrong-plant formal selection.

#### SKU and SKU Versions

- plant, Customer, Family, status and Plant Item Code filters;
- Proposed SKU creation from Batch Entry;
- optional permanent Plant Item Code assignment;
- immutable specification versions;
- Construction-version authority;
- Printing Technology and number of colours;
- Customer Item references and aliases;
- Customer Location applicability;
- discontinue, reactivate and replace without silent substitution.

#### Specification Reference

Expose the quotation-relevant subset selected through the field-classification exercise. Keep STD
customer-facing values distinct from internal/production values. Do not make the frontend a second
260-column spreadsheet.

### U3 — commercial masters and Pricing Basis

Canonical foundation: S5 after the interest amendment is resolved.

- Sectors, Waste, Conversion and target Margin versions;
- approved annual interest basis and its history;
- Rate Sets, versions and entries;
- Freight Sets, versions and entries, preserving missing versus explicit zero;
- Pricing Basis Release composition, defaults, alternatives, approval, self-approval indication,
  withdrawal and replacement lineage.

Acceptance outcome: a user can see exactly which approved versions form a Pricing Basis Release and
why it is eligible for a plant/date.

### U4 — durable Batch Workspace

Canonical foundations: accepted S6, then S7 and S8.

- create Batch with permanent reference;
- Customer Family and Producing Plant selection;
- ownership and collaborators;
- editable versioned Batch Profile;
- Pricing and Delivery Groups;
- Batch rows and SET membership;
- lock acquire/heartbeat/release/reclaim/takeover;
- stale-content conflict handling;
- Box/Board specification including Printing Technology and number of colours;
- effective values and authority sources;
- blank, zero and unresolved states;
- fresh, needs-Send-only and calculation-stale signals.

Migrate the existing Batch Entry incrementally and preserve calculation parity. Formal Batch state
must ultimately cease to depend on browser-local persistence.

### U5 — Quote workflow

Canonical foundation: S9.

- Maker submission;
- Checker approval inbox and Return;
- approval, withdrawal and Issue to Customer;
- immutable Quote revisions;
- Create Revision, Amend and Reprice;
- Current/Superseded/Voided standing;
- customer outcomes;
- historical frozen calculation view.

Quote Items remain read-only and never calculate or edit commercial values.

### U6 — export and audit

Canonical foundations: S10 and the approved audit/Family H slice.

- draft versus official export;
- mandatory draft marking;
- template/version selection;
- compatibility acknowledgement;
- representative-value selection without a first-item assumption;
- multi-part export history;
- actor/time/action/reason/material-change timeline.

## 7. Required screen specification template

Every screen must state:

1. purpose;
2. authorised personas;
3. plant/group scope;
4. list columns, search and filters;
5. detail sections;
6. create/edit fields;
7. generated and read-only fields;
8. lifecycle actions;
9. backend route or RPC per action;
10. validation, stale-write and lock behaviour;
11. empty, unavailable and unauthorised states;
12. history and audit visibility;
13. localhost feature flag;
14. Vercel deployment gate;
15. acceptance scenarios.

Wireframes support this specification but do not replace it.

## 8. Recommended sequencing

1. Correct and independently close S5/S6.
2. Reconcile the §5 commercial amendments before authorising S7 implementation.
3. Perform U0 discovery and architecture.
4. Design U1 Customer Foundation while S7/S8 calculation work proceeds.
5. Design U2 Product/Specification Masters after the field mapping and flute model are approved.
6. Design U3 Commercial Masters after the annual-interest model is approved.
7. Implement the durable U4 Batch Workspace only on accepted S6–S8 foundations.
8. Deliver U5 with S9 and U6 with S10/audit foundations.
9. After each approved backend or database increment, deliver and visibly verify the smallest useful
   frontend increment before starting another extended foundation-only workstream, unless a recorded
   dependency makes that impossible.

U1–U3 design may proceed without changing the costing engine. Implementation requires its own
approval and must use accepted operations.

## 9. First frontend planning deliverable

Produce a read-only Frontend Discovery and Gap Report containing:

- current navigation and screen inventory;
- browser-local versus Supabase-backed data per screen;
- current backend/API connection for every action;
- legacy shapes conflicting with the accepted model;
- reusable components and replacement candidates;
- missing governed operations;
- proposed navigation;
- screen priorities;
- wireframes for Customer Family, Customer/Prospect, Customer Location and Producing Plant;
- field-classification approach for the Specifications Master;
- implementation estimates by `U` package;
- acceptance scenarios;
- genuine Product Owner questions only.

## 10. Current decision boundary

This document authorises planning and review only. **The two conditions it named are now settled by
[`data-model-canonical-amendment-01.md`](data-model-canonical-amendment-01.md):** the annual-interest
rule is approved at 6.000% on a 360-day basis, and flute take-up factors are approved in principle as
governed plant-owned values but are deliberately kept **out** of the calculation authority chain and
out of S7 — the package is prepared after S8. Frontend implementation, new plant-manufacturing
entities and any push remain separately controlled.
