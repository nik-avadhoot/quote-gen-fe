# CFB Quotation OS — Complete Data Model design for approval

**Status:** complete conceptual design candidate, technically **approved with amendments** by SR DEV.
Amendments A-1 through A-26 from `docs/data-model-sr-dev-review.md` are incorporated. Product Owner
acceptance and canonicalisation remain outstanding. This is not an implementation brief, migration
execution approval, commit approval, or authority to change code or a database.

**Product authority:** the Product Owner approves every product, architecture, migration, rollout
and commit decision. SR DEV implements only after the complete design and implementation brief are
separately approved.

**Baseline:** Costing START/REVIEW and Pre–Data Model closure are complete. At the start of this
workstream, local and remote `quote-gen-fe/main` were synchronized at `849c5d4`. Batch Entry is the
sole CalcGate. Quote Items is a SendGate, not a CalcGate.

**Excluded workstream:** `docs/commercial-intelligence-decisions.md` is not part of this record and
must not be used unless the Product Owner explicitly merges that workstream.

---

## 0. Numbering note

The live Q&A developed faster than its labels. The conversation contained numbering drift and two
collisions around DM-97 and DM-103. This design normalizes the late sequence as DM-88 through
DM-106 and groups the earlier approved decisions by subject where the conversational number cannot
be reconstructed safely from the available record. No product meaning should be inferred from a
number alone.

Before this becomes canonical, the Product Owner must approve either:

1. this normalized numbering; or
2. a fresh, stable numbering pass over the entire decision set.

Until then, the words of each decision are authoritative and the numbering is provisional.

---

## 1. Governing commercial principles

### 1.1 Quote calculation comes first

- The present goal is universal adoption of reliable **Quote calculation within known cost
  boundaries**.
- Cost-versus-Quote analysis, realised-margin analysis and route-level profitability are later
  workstreams. The application must not manufacture those conclusions now.
- Risk premium remains Maker/Checker commercial judgement. The application does not calculate or
  isolate a risk premium.

### 1.2 Formal authority boundaries

- **Batch Entry is the sole CalcGate.** Formal calculations originate there.
- **Quote Items is the SendGate.** It receives a complete, calculation-ready Batch candidate; it is
  not a second calculation authority.
- Sending is whole-Batch and atomic. Partial row sending is not allowed.
- The application’s frozen calculation is the commercial calculation authority. Excel is a
  representation, reconciliation and discovery surface—not a competing authority.

### 1.3 Smooth initial quoting

- The normal initial Quote flow must avoid unnecessary confirmations and mandatory explanations.
- Exceptions remain visible and auditable, but optional explanations may become mandatory later
  only if experience justifies the friction.
- Missing RFQ information must not unnecessarily block early-stage quotation work. Unknown values
  remain genuinely blank rather than being invented.

---

## 2. Conceptual commercial hierarchy

```text
Customer Family
├── Customer or Prospect
│   └── Customer Location (Bill-to, Ship-to, or both)
└── Customer or Prospect
    └── Customer Location (Bill-to, Ship-to, or both)

Batch (one Customer Family + one Avadhoot producing plant)
├── Batch Profile
├── Pricing Groups
│   └── Delivery Groups
└── Batch SKU Rows
    ├── one Customer-specific SKU
    ├── one Pricing Group
    └── optional SET membership

Quote Family
└── Quote Revisions
    └── immutable Quote Items linked to originating Batch rows
```

This is not a strict `Batch > Pricing Group > Delivery Group > SKU` ownership tree. A Batch owns
both its Pricing Groups and its SKU rows. Each row refers to one Pricing Group and therefore applies
to every Delivery Group within that Pricing Group.

---

## 3. Batch, Quote and revision lifecycle

### DM-1 — Mutable Batch

A Batch is a moldable commercial workspace. The Maker may add, edit, remove and restore SKU rows.
Removing a row is reversible and preserves lineage; adding a replacement creates a new identity.

### DM-2 — Deliberate revision creation

Opening an issued Quote is read-only. Merely viewing the last Quote must never create a draft or a
new revision. **Create Revision** is a deliberate user action.

### DM-3 — Post-issue Batch state

After issue, the Batch is read-only until Create Revision is invoked.

### DM-4 — Revision starting point

A new revision initially preserves the last issued calculations. Recalculation occurs only through
an explicit **Recalculate using current masters** action.

### DM-5 — Recalculation modes

Recalculate presents two commercially distinct modes:

- **Amend Approved Quote:** recalculate only the affected commercial units while preserving the
  previous frozen Pricing Basis.
- **Reprice as on Date:** mark the whole active Batch stale and recalculate it using a deliberately
  selected Pricing Date and Pricing Basis.

### DM-6 — Smallest affected commercial unit

Staleness follows the smallest affected unit:

- a standalone row;
- a complete SET; or
- all rows affected by a Batch-level change.

### DM-7 — Maker/Checker boundary

- The Maker prepares and submits.
- Checker approval is mandatory before an official export.
- A Maker may export a working document only with an unavoidable **DRAFT — NOT APPROVED** marking.

### DM-8 — Approval and issuance are separate

Checker approval does not prove that a Quote was sent. **Issue to Customer** is a separate explicit
event. Downloading or generating an export alone is not issuance.

### DM-9 — Withdrawal and revision rules

- An approved but unissued Quote may be withdrawn to draft with a retained audit event.
- An issued Quote cannot return to draft. Any further commercial work requires a new revision.

### DM-10 — Quote revision numbers

- A revision number is allocated at first Checker approval.
- Withdrawal does not release or renumber it.
- An abandoned allocated revision is void and its number is never reused.

### DM-11 — Stable row and Quote Item identities

- A Batch row has a stable lineage identity across editing and revisions.
- Each Quote Item in each Quote revision has its own immutable identity.
- PM-7 is a direct relationship from the Quote Item to the originating Batch row, accompanied by
  the exact calculation snapshot used for that revision.

### DM-12 — Atomic SendGate

Send to Quote operates on the entire Batch candidate. It does not allow partially refreshed or
partially sent rows.

### DM-13 — Divergence after Send

- A post-Send Batch change leaves the staged candidate visibly diverged.
- Submission and all exports are blocked until an atomic refresh from Batch Entry.
- A submitted or approved candidate cannot silently refresh; it must first follow the applicable
  return or withdrawal workflow.

### DM-14 — Batch and Quote references

- A permanent, human-readable Batch Reference is allocated when the durable Batch is created and is
  never reused.
- A permanent Quote Reference is allocated on first Checker approval and remains the same across
  revisions. It is never reused.

The later Q&A assigned the latest-revision/no-branching rule to DM-106. It appears once in the
normalized ledger below and is not duplicated under an invented early number.

---

## 4. Scratchpad versus formal records

- Costing START remains a private, browser-local scratchpad.
- A durable Batch exists only after the user explicitly chooses **Create New Batch**. Sending the
  first START row must not silently create it.
- **Send to Quote** is the deliberate boundary that creates or dedicates the Quote family from the
  Batch. Later sends refresh the same candidate and family.
- A Quote family abandoned before first approval is retained after Formal Data Cutover with
  **Abandoned** status and no Quote Reference. Its internal identity and audit remain; no customer
  document number was consumed.
- Scratch work may be discarded. Formal Batches, calculations, approvals, issued revisions and
  audit history may not be silently discarded.

---

## 5. Customer, Prospect and delivery identity

### 5.1 Party lifecycle and D-13

- Prospect and Customer are lifecycle states of one permanent party identity.
- Graduation preserves the identity and all history; it does not create a disconnected Customer.
- A permanent Customer Code is assigned at graduation.
- Makers may create Prospects.
- Admin initially controls graduation, merge and deactivation. Permission-based alternative routes
  may be introduced later.

### 5.2 Customer Family hierarchy

- Every Customer is a child of exactly one Customer Family.
- Every Customer Location is a child of exactly one Customer.
- A Customer Family consolidates:
  - companies belonging to the same customer group; and/or
  - multiple plants of one company.
- The Family has a permanent, non-reusable, group-wide **Group Customer Code**.
- Each graduated Customer has its own permanent, non-reusable, group-wide unique Customer Code.
- Prospects may remain uncoded.
- Initial master loading requires an explicit Product Owner-reviewed mapping of Family → Customer →
  Customer Location. Names and aliases must not drive automatic consolidation.
- A retired or merged Family and its Customer-number sequence remain permanently reserved. Family
  retirement must never permit an already-issued Customer Code to be allocated again.

### 5.3 Family-level Batch boundary

- A Batch belongs to exactly one Customer Family and exactly one Avadhoot producing plant.
- One Batch and one customer-facing Quote may cover multiple Customers or plants inside that Family.
- Family membership permits joint quoting but never makes Customer-specific SKUs interchangeable.
- A Quote revision has one Primary Addressee even when it contains several Delivery Groups.

### 5.4 External Ship-to

A Delivery Group may expressly name an external Ship-to plant belonging to another Customer or
Family, such real contract-packer routes such as Canpack or HNG. Commercial ownership remains with
the Bill-to Customer Family; this does not re-parent or share SKUs.

---

## 6. SKU identity and specification

- A SKU is a **100% Customer-specific commercial item**. Only Constructions are shareable.
- Each SKU belongs to exactly one Avadhoot producing/supplying plant.
- One SKU may be permitted for one or several Customer Locations of its Customer.
- Supplying the otherwise equivalent item from a different Avadhoot plant creates a different SKU.
- Every unique live-master Plant Item Code becomes a distinct SKU identity, including Box, Plate and
  Partition SET components.
- **Plant Item Code** replaces plant-specific wording such as “APSPL Item Code”. It is unique within
  one producing plant, permanent and never reused.
- Plant Item Code is a business identifier, not the database relationship key. Relationships use
  stable internal identities and do not parse code text.

### 6.1 Proposed SKU flow

- Makers may create a stable Proposed SKU directly from Batch Entry.
- A Proposed SKU may be approved and issued on a Quote before Plant Item Code assignment. No
  placeholder or fabricated code is permitted.
- SKU code assignment and activation are Admin-only initially.
- Eventually, plant-scoped NPD permission is expected to own publication: code assignment,
  activation, non-price-driving spec versions, delivery applicability, discontinue/reactivate, and
  reject/return.
- Customer and producing plant become immutable after the SKU first appears on an issued Quote. A
  correction requires a new SKU.

### 6.2 Price-driving versus non-price-driving changes

- Any dimensional, Construction or strength change creates a new SKU because it changes price.
- A price-driving edit to a selected SKU creates a derived Proposed SKU; it never mutates the
  original SKU.
- Printing, artwork or product-name changes may form a new immutable spec version under the same
  SKU when they do not materially change recurring cost.
- Number of colours is not a mechanical identity threshold. Additional colours are often absorbed
  as a customer-retention judgement. The Maker proposes same-SKU treatment and the Checker approves
  it.
- The current Costing and Batch Entry standard specification does not capture number of colours; the
  Data Model must not silently introduce it.
- A quote-specific proposed non-price-driving SKU version may be approved by the Checker for that
  Quote. Publishing it to the shared master is a separate NPD/Admin action.

### 6.3 Delivery applicability

- A Maker may create a Proposed Customer Location with incomplete data and use it in an issued
  Quote. Unknown information stays blank.
- An existing SKU may be quoted to a new Customer Location through a Batch-only proposed
  applicability.
- Checker approval authorises that applicability only for the Quote. It does not silently update the
  SKU Master.

---

## 7. Construction Library

- Construction is the only product definition designed for sharing across Customers.
- Construction has a global identity; Customer, Family, Sector and plant applicability are separate
  relationships rather than ownership.
- Any plant may discover a Construction.
- Scratch use is globally unrestricted. Formal Batch use requires adoption by that producing plant.
- A technical change creates a new immutable Construction version. Historical Quotes stay pinned to
  their earlier version, and a new version requires fresh plant adoption.
- Live-workbook technical specifications seed a reviewed and deduplicated candidate library; they do
  not auto-publish.
- The current alphabet-based coding mechanism is rejected.
- Construction Code is a neutral globally unique, non-reusable system sequence such as
  `CON-000125`, with an editable meaningful name and immutable technical versions.
- **Manage Construction Library**, **Adopt Construction for Plant** and **Manage SKU Master** are
  separate capabilities even when the same NPD user holds all of them.

---

## 8. Pricing Groups and Delivery Groups

- A Pricing Group contains one or more visibly distinct Delivery Groups that share the same quoted
  prices.
- A Delivery Group represents one Bill-to/Ship-to route and its descriptive logistics context.
- Delivery Group route/freight context is descriptive. Pricing Group owns the one explicit freight
  basis and effective freight value that enter calculation.
- Each Batch SKU row belongs to one Pricing Group and applies once across all Delivery Groups in
  that group. The SKU is not repeated merely because several routes share one price.
- Different actual freight by route does not prevent Maker/Checker judgement from quoting one common
  selling price across the group.
- The model intentionally does not calculate route profitability or realised margin at this stage.

### 8.1 Excel destination representation

- Existing CBB+PP Column E already supports freight differences by delivery plant per SKU.
- Comma/slash-concatenated delivery locations must not become a lookup key because that can break
  exact workbook lookup and silently produce zero freight.
- Calculation basis and display destinations are separate:
  - one explicit freight calculation basis/applicable freight; and
  - a separately rendered multi-location list or schedule.

---

## 9. Commercial authority map

### 9.1 Freight

```text
Batch-row explicit override
    → Pricing Group freight
        → approved Freight Master
            → unresolved: calculation blocked
```

- Blank means inherit.
- Zero means an explicit zero.
- A non-zero value is an explicit override.
- The frozen calculation records both effective freight and its source/version.
- Exports must represent row exceptions accurately; they must not silently report the first item’s
  freight as applying to all items.
- Pricing Group owns the one freight value that enters calculation. Delivery Group route/freight
  details are descriptive and never provide competing calculation inputs.
- Pricing Group freight basis mode is explicit: approved master, manual, or ex-factory. Ex-factory
  is an explicit zero; unresolved is not zero and blocks calculation.
- A selected freight-basis Delivery Group or Location is referenced by internal identity, never by
  name. Removing it or clearing its location makes the basis unresolved and blocks calculation; no
  fallback or zero is inferred.

### 9.2 Payment terms and Interest

- Pricing Group owns Payment Terms and Interest.
- Payment Terms has a structured value and may also carry optional descriptive wording. Only the
  structured value participates in calculation; export must not mechanically append `days` to
  already descriptive wording.
- Interest resolves through one chain:

```text
Pricing Group explicit Interest override
    → approved Payment Terms → Interest mapping
        → versioned system fallback
```

- Blank Interest means inherit; zero is explicit zero; a non-zero value is an explicit override.
- The mapping exists once as a versioned Calculation-defaults component and requires PM-2 approval.
- Initial approved mapping: 30 days → 0.5%, 45 days → 0.75%, 60 days → 1.0%, and
  90 days → 1.5%.
- The initial system fallback is **0.5%**. It is independent from the ≤30-day mapping entry even
  though both currently equal 0.5%; either may change through its own approved version later.
- Changing Payment Terms while Interest inherits changes effective Interest and stales affected
  rows. With an explicit Interest override, it is presentation-only and requires fresh Send.
- It may inherit a Bill-to Customer default only when the result is unambiguous. Otherwise the Maker
  deliberately selects one common basis.
- There is no target SKU-level Interest override.
- Inert legacy override keys and manufactured blank values do not become meaningful commercial data.

### 9.3 Margin

```text
Batch-row explicit override
    → Batch Box/PP default
        → Sector default
            → system fallback
```

Pricing Group does not own Margin. Blank/zero/value semantics are preserved.

### 9.4 D-25 Waste and Conversion

```text
Batch-row explicit override
    → Batch default
        → Sector default
            → system fallback
```

- Blank means inherit; zero is explicit zero; a non-zero value is explicit.
- The UI may display the effective inherited value in grey without storing it as an override.
- The calculation snapshot records the effective value and its exact authority source.
- Migration must ignore manufactured blanks, absent keys and inert legacy overrides.
- This is one CalcGate-authoritative chain. Batch Entry defines the result; Costing and every other
  surface must use the same resolver and produce the same effective value.
- Selecting a Sector, clearing a field, or any other UI action must not materialise an inherited
  value. Clearing writes blank/inherit, not the current default as a stored number.
- D-25 blank-awareness includes Interest as a fifth field alongside Box/PP Waste and Conversion.
- Implementing this model requires removing the existing materialisation paths, reconciling blank
  and explicit zero before the costing engine consumes them, and adding golden-value coverage over
  the actual Batch Entry CalcGate path. These are approval-gated implementation prerequisites.

### 9.5 Validity

- **Price Validity Period** is an optional Batch Profile input because it informs commercial risk
  judgement. Initially it applies to the whole Batch, with no Pricing Group override.
- **Offer Validity** is a separate optional Quote revision field.
- Neither field calculates risk premium.
- Offer Validity starts from Quote Date, not Issue Date.
- Before issue, Maker may adjust Quote Date or validity. After issue, the revision freezes both.
- Passing the date displays **Offer validity lapsed** but does not automatically record a customer
  outcome of Expired.

---

## 10. SET model

- A SET is a first-class Batch grouping with a permanent internal identity.
- A Box with no components is standalone and has no active SET relationship.
- Attaching the first Plate/Partition component creates or reactivates a SET. Removing the final
  component dissolves it into an inactive state rather than deleting it; row and SET identities are
  preserved.
- An active SET contains exactly one parent Box plus one or more component rows.
- SET Code is a user-visible, editable business label unique within the Batch.
- SET Code is mandatory, non-blank, trimmed/case-insensitively unique across the entire Batch, and
  remains reserved by a dissolved SET.
- Dissolved SETs remain visible and relabellable. Reattaching a component normally reactivates the
  preserved SET identity and code.
- At first SET creation, seed from the parent Box Material Code only when it is present and unused;
  otherwise the Maker must supply a distinct SET Code. Never silently append a suffix or change the
  Maker’s label.
- SET Code is not the relationship key; correcting the label must not break identity or lineage.
- Membership is explicit. “Nearest preceding Box” may be a UX suggestion only and must be confirmed.
- Strings and row order never establish SET membership.
- Standalone rows have no SET.

---

## 11. Shared-master controls: PM-1, PM-2 and PM-3

### PM-1 — Safe editing

- Shared masters use Draft/Edit → Save/Cancel.
- Save is atomic, validates the full change and detects conflicting updates.
- Per-keystroke live writes are not permitted.
- This applies to Customer, SKU, Construction, Rates, Freight, Sectors, Defaults and other shared
  masters.

### PM-2 — Approval proportional to impact

- Calculation-driving master changes require second-person approval.
- Routine descriptive changes may publish directly.
- Identity-sensitive operations use dedicated workflows.
- Emergency self-approval must be explicit, reasoned and audited.

### PM-3 — Immutable history and correction

- Published master history is immutable.
- Rollback means creating a new corrective version, never overwriting or deleting the old version.
- A corrective version records proposer, approver, reason and effective date.

### Capability model

- Roles and capabilities are separate.
- Initial operational roles are Maker, Checker and Admin.
- Future capabilities are assigned per plant, including Manage SKU Master, Manage Construction
  Library, Adopt Construction for Plant, Manage Customer Master and approve commercial masters.
- NPD is expected eventually to hold the relevant SKU and Construction capabilities.

---

## 12. Pricing Basis Release — normalized DM-88 to DM-98

### DM-88 — Approved bundle

A Pricing Basis Release is an internally approved, plant-specific bundle of Rates, Freight, Sector
defaults and calculation Defaults. It is not a customer-confirmed price, an Approved Quote or an
Issued Quote.

- Amend reuses the prior revision’s release.
- Reprice selects an approved release appropriate to the Pricing Date.
- Formal first-time calculations also use a release so they cannot silently combine unrelated
  master versions.
- The snapshot retains every underlying component version.

### DM-89 — Pricing Date and basis selection

- Pricing Date and Pricing Basis are separately recorded.
- The system suggests the release effective for the selected date.
- Maker may select another approved release.
- A reason is optional initially; the selection remains visible to the Checker.

### DM-90 — Smooth automatic default

For a normal initial Quote, the effective release is applied automatically and shown unobtrusively.
No confirmation is required unless the Maker changes it or no release covers the date.

### DM-91 — Calendar-gap handling

If no release covers the Pricing Date, the Maker may deliberately choose another approved release
and continue. The application warns clearly, records the choice and exposes it to the Checker.
Explanation remains optional initially.

### DM-92 — One automatic default

Several approved releases may be available for a producing plant and date, but exactly one is the
automatic default. Alternatives require deliberate Maker selection.

### DM-93 — One producing plant

Each Pricing Basis Release belongs to exactly one Avadhoot producing plant. A Batch may use only a
release belonging to its producing plant.

### DM-94 — Calendar-date precision

- Releases may change multiple times within a month.
- Applicability uses calendar dates, not intraday times.
- There is only one automatic default per producing plant per calendar date.

### DM-95 — Retrospective effectiveness

Past-effective releases are permitted. Their true creation and approval timestamps remain
immutable. They affect suggestions for new calculations using the historical Pricing Date but
never alter a frozen calculation or issued Quote.

### DM-96 — Future effectiveness

Future-effective releases are normal business. They may be prepared and approved in advance and
become the automatic default on their effective date.

### DM-97 — Immutability, correction and withdrawal

- An approved release’s contents and effective date cannot be edited.
- Correction requires a new approved replacement release.
- An unused future release may be withdrawn before becoming the default.
- A used release remains permanently available for history and reproduction.

### DM-98 — Historical release in Amend

A withdrawn release is unavailable for new Quotes and Reprice, but Amend may reuse it when the
existing Quote revision already used it. The Checker sees that the historical basis is withdrawn.

---

## 13. Customer outcome — normalized DM-99 to DM-105

### DM-99 — Outcome set

An issued Quote revision supports these customer outcomes:

- Awaiting Response
- Accepted
- Rejected
- Expired

Customer outcome is separate from Checker approval and Issue to Customer.

### DM-100 — Whole-revision outcome

Outcome initially applies to the entire issued Quote revision, not individual Quote Items. Partial
acceptance or changed commercials require a deliberate new revision reflecting the agreed scope.

### DM-101 — Offer Validity basis

Offer Validity runs from Quote Date. The frozen issued revision retains Quote Date and validity.

### DM-102 — No automatic commercial conclusion

A lapsed Offer Validity date does not automatically set Expired. The system flags the lapse; an
authorised user records the actual commercial outcome.

### DM-103 — Outcome history and optional acceptance context

- Customer outcome changes are recorded as history, not destructive overwrites.
- A late acceptance may follow an earlier expired/rejected understanding when commercial reality
  requires it.
- User and timestamp are mandatory audit facts; explanatory notes are optional initially.
- Acceptance date, customer PO/reference, and email/verbal-confirmation note are optional.
- This is not order management. Supporting-document storage is deferred.

### DM-104 — Outcome versus revision standing

- Customer outcome is Awaiting Response, Accepted, Rejected or Expired.
- Revision standing is separately Current or Superseded.
- Issuing a newer revision automatically supersedes the earlier revision.
- The older revision’s historical customer outcome remains intact.

### DM-105 — Outcome permissions

The Quote owner Maker and authorised Checkers may record customer outcomes. Admin may correct
exceptional errors. Every event is attributed and timestamped.

### DM-106 — Linear revision history

A new revision originates only from the latest/current issued revision. Historical revisions are
read-only and do not branch.

### DM-107 — Batch Reference format

- Batch Reference contains only stable operational information:
  `Plant Code / BAT / Financial Year / Sequence`.
- Example: `NGP/BAT/26-27/00125`.
- Customer, Sector and SKU are not encoded because those classifications may be corrected or
  reorganised.
- The reference is human-readable, plant-identifiable, permanent and never reused.

### DM-108 — Quote Reference and revision format

- A Quote family has one permanent base reference:
  `Plant Code / Q / Financial Year / Sequence`.
- Example base: `NGP/Q/26-27/00418`.
- The revision is displayed separately as a suffix, for example
  `NGP/Q/26-27/00418-R2`.
- Voided revision numbers are not reused.
- The Quote sequence restarts for each producing plant at the start of each financial year.

---

## 14. Audit, ownership and access boundaries

- Each Batch has one current Maker owner.
- Created by, current owner, submitted by, approved by and issued by are separate audit facts.
- Ownership transfer is explicit, reasoned and audited. User deactivation must not orphan work.
- Access is plant-scoped by default; explicit grants may span several plants.
- Makers may edit owned/collaborative Batches and view issued Quotes for their assigned plants.
- Unfinished work is visible to its owner/collaborators plus authorised Checkers/Admin.
- Initially, one user edits a Batch at a time. Takeover and stale-lock recovery are audited.
- Checkers may initially edit a submitted Batch and the same Checker may modify and approve it.
  Every change retains before/after audit, makes affected units stale, and requires recalculation and
  a fresh Send. A future setting may disable Checker editing.
- Formal/shared records use deactivate/archive/status transitions rather than hard delete. Private
  START scratch may be discarded.
- Customer and Construction masters are group-wide visible. SKU visibility follows assigned plants
  by default, with explicit cross-plant grants.
- Database access control—not merely hidden UI—must enforce these boundaries. Privileged server
  credentials must never be exposed to the frontend.

---

## 15. Calculation and history preservation

- Before Send, the latest working calculation may replace an earlier working calculation.
- Send freezes an immutable snapshot for every Quote Item, including:
  - entered inputs;
  - calculated results;
  - effective inherited values and authority sources;
  - selected master and Construction versions;
  - Pricing Date and Pricing Basis Release;
  - calculating user and timestamp;
  - originating Batch-row identity.
- Submitted, approved and issued states are retained.
- Calculate, reprice and send actions need lightweight audit events; every discarded intermediate
  numeric payload need not be retained.
- A revised Quote may intentionally contain unaffected items frozen under an earlier engine version
  and amended items calculated under the active engine. Engine version is therefore an item-level
  snapshot fact and mixed-engine revisions must be visible in review/export rather than treated as
  corruption.

---

## 16. Export and workbook rules

- Official export requires Checker approval, except Maker draft exports marked unmistakably
  **DRAFT — NOT APPROVED**.
- No Excel/app mismatch may block official export. Export is necessary to discover real gaps between
  the workbook and the application.
- Known mismatch requires explicit acknowledgement and audit, not prohibition.
- Export templates are versioned and declare which scenarios they support.
- Different scenarios may eventually require two or more workbook formats.
- Every export records template/version and acknowledged mismatches.
- Old Quote revisions may be re-exported with the original template or a later compatible template;
  the rendering choice is recorded.
- D-18/D-27 first-item assumptions must be visible. The system must not silently represent one
  item’s value as the whole-sheet value when rows differ.

---

## 17. Migration and pre-Beta reset

- Current application Customer, SKU, Construction, Batch and Quote data is trial data and may be
  discarded.
- No browser-local formal-history migration or PM-7 backfill is required.
- There is one current application owner/browser; no distributed browser-data reconciliation is
  required.
- Sector Master is the only existing application dataset preferred for retention, but the Product
  Owner has a backup and accepts replacement when retention cost is material.
- Other application masters may be overwritten and rebuilt.
- Live Customer/SKU workbook data is a source for controlled initial master loading, not evidence
  that trial application data is production history.
- Import must not convert manufactured blanks, missing properties or inert legacy override keys into
  meaningful explicit commercial values.
- Every unique Plant Item Code in the live SPEC data is a separate SKU candidate, including SET
  components.
- Customer hierarchy import requires explicit reviewed mapping rather than name-based inference.
- Construction-level Waste and Conversion fields present in current trial records are outside the
  target authority model. Loaders must drop rather than map/populate them, so they cannot become a
  hidden tier above the Batch Profile.

---

## 18. Q&A continuation ledger — DM-109 through DM-210

This section preserves the working conversation identifiers. DM-140 and DM-141 were accidentally
skipped in the conversation and remain deliberately unused here; numbers are not silently shifted.
The final canonical record should receive one clean numbering pass after Product Owner approval.

### Customer and Prospect identity

- **DM-109:** Group Customer Code is a neutral permanent sequence, independent of Family name.
- **DM-110:** Existing Customer Codes remain searchable legacy/external references, never
  relationship keys.
- **DM-111:** Customer Code contains the original Family Code and remains permanent after later
  Family reassignment.
- **DM-112:** Customer suffix is a simple sequence within its original Family, not name initials.
- **DM-113:** Customer Location Code is a permanent sequence beneath its Customer Code.
- **DM-114:** External Ship-to locations live once under their actual Customer and are referenced
  cross-Customer without duplication.
- **DM-115:** A Customer may independently be Bill-to eligible, Ship-to eligible, or both.
- **DM-116:** Maker may create a Proposed external Customer and Proposed Location during quoting;
  Quote approval does not publish them to the master.
- **DM-117:** One Customer may have several Bill-to locations.
- **DM-118:** One Customer Location may be Bill-to only, Ship-to only, or both.
- **DM-119:** The canonical entity is Customer Location; Plant, Office, Warehouse and Other are
  optional descriptive types.
- **DM-120:** Missing address or invoicing-grade information does not block quoting.
- **DM-121:** Prospect creation initially requires only a usable display name.
- **DM-122:** A standalone Prospect creates a minimal Proposed Family and Prospect structure in one
  quick action; duplicate warnings advise but do not block.
- **DM-123:** Primary Addressee requires only Customer/Prospect identity; location, person, email and
  postal address are optional.
- **DM-124:** An issued revision freezes exactly the addressee name/details rendered on it.
- **DM-125:** Duplicate Prospects merge into one surviving identity while aliases, lineage and issued
  snapshots remain.
- **DM-126:** Prospect graduation changes the lifecycle state of the same identity. Open work sees
  the Customer Code; issued Prospect-era revisions remain frozen.
- **DM-127:** Family consolidation retains one survivor plus retired aliases/history; issued records
  do not change.
- **DM-128:** Customer-to-Family membership is effective-dated and auditable, with one current
  Family.
- **DM-129:** A reassigned Customer Location retains its permanent code and parent history.
- **DM-130:** Corrections/renaming of the same physical location version that Location; a genuinely
  different physical establishment creates a new Location.
- **DM-131:** GST, invoicing and tax workflows/data are outside foreseeable scope; do not add
  speculative fields for them.

### SKU and Construction identity

- **DM-132:** Proposed SKU is shown without a fabricated temporary code.
- **DM-133:** Later Plant Item Code assignment updates open work through the same identity but does
  not rewrite issued snapshots.
- **DM-134:** Customer Item Code/reference is optional, searchable and non-authoritative.
- **DM-135:** An open Batch stays pinned to its chosen SKU spec version until Maker adopts a newer
  non-price-driving version.
- **DM-136:** A SKU discontinued after selection may proceed in that open Batch with warning; it
  cannot be selected for a new row.
- **DM-137:** Similar Proposed SKUs create a non-blocking comparison.
- **DM-138:** Artwork/name-only differences may be either a new version of the same SKU or separate
  SKUs, according to whether the customer treats them as separate orderable items. Maker proposes;
  Checker sees the choice.
- **DM-139:** Technical equality is labelled Similar existing SKU, not Possible duplicate, unless a
  Plant Item Code or Customer Item Code conflicts.
- **DM-140 and DM-141:** unused working numbers; no product decisions.
- **DM-142:** Construction Code is a neutral, permanent global sequence containing no technical
  meaning.
- **DM-143:** Construction names may repeat; technical comparison warns without blocking.
- **DM-144:** Maker may create a stable Proposed Construction in Batch Entry.
- **DM-145:** Checker may approve that proposal for the specific Quote before Library publication or
  plant adoption; this does not make it reusable elsewhere.
- **DM-146:** Publishing a genuinely new proposal preserves identity and assigns permanent code and
  approved version.
- **DM-147:** A duplicate proposal merges into the existing Construction with retained lineage and
  unchanged issued snapshots.

### Pricing/Delivery Groups and row presentation

- **DM-148:** Every new Batch starts with one default Pricing Group.
- **DM-149:** Customer Location may remain blank, but freight treatment must be explicit; blank
  location never silently means zero freight.
- **DM-150:** The default Pricing Group starts with one default Delivery Group whose locations may be
  blank.
- **DM-151:** Pricing/Delivery Group labels are optional and editable; relationships use internal
  identities.
- **DM-152:** Pricing Group means a common per-SKU price schedule across its Delivery Groups; SKUs
  within that schedule still have different prices from each other.
- **Rejected proposal:** one technical Batch row feeding several differently priced Pricing Groups
  was rejected. Same SKU plus different price requires separate visible Batch rows. Copy assistance
  may reduce entry effort later without merging their identities.
- **DM-188:** Empty Pricing or Delivery Groups may exist while drafting but cannot enter a submitted
  Quote candidate.
- **DM-189:** External Bill-to Customer Locations are permitted and visibly identified as
  third-party billing.
- **DM-190:** External billing does not change Batch, Quote or SKU commercial ownership.
- **DM-191:** One same-priced Batch row produces one Quote Item carrying all Delivery Groups in its
  Pricing Group; it is not repeated per destination.
- **DM-192:** A pricing-relevant Delivery Group change stales every row in its Pricing Group. A purely
  descriptive change needs fresh Send but not fresh calculation.
- **DM-193:** Multi-destination rows show a compact count/summary with expandable locations.
- **DM-194:** Customer documents show the common SKU price once with a separate destination list or
  schedule. Template-level row repetition remains one Quote Item rendering.

### Quote exceptional lifecycle

- **DM-153:** Checker/Admin may mark an issued revision Voided with mandatory reason. Record and
  exports remain.
- **DM-154:** A corrective next revision may start from the voided revision and passes the complete
  calculation, Send and approval path.
- **DM-165:** Batch workflow status and Quote revision status are distinct.
- **DM-166:** Checker Return requires a mandatory note.
- **DM-167:** Withdrawing an approved but unissued revision requires a mandatory reason.
- **DM-168:** Archive is reversible organisation only and changes no commercial status/history.

### Pricing Basis and override governance

- **DM-155:** Every component must be approved before its Pricing Basis Release can be approved.
- **DM-156:** Withdrawing a component warns on affected Releases but does not automatically withdraw
  them; an authorised person decides.
- **DM-157:** Batch/Pricing Group/row overrides stay outside the reusable Release and are frozen in
  the Quote calculation snapshot.
- **DM-158:** Reprice carries explicit overrides forward with prominent review indicators; clearing
  is deliberate.
- **DM-159:** Pricing Basis proposal/approval uses plant-scoped commercial-master capabilities;
  proposer and approver are normally different.
- **DM-160:** Maker/Checker status does not automatically grant master publication authority.

### People, permissions and collaboration

- **DM-161:** A user holding Maker and Checker capabilities may initially approve their own Quote;
  audit identifies self-approval. Four-eyes enforcement may be enabled later.
- **DM-162:** Checker authority is assigned per producing plant.
- **DM-163:** Batch owner may add plant-authorised Maker collaborators; Checker/Admin may manage them.
- **DM-164:** Active editing-lock takeover is Checker/Admin-only with mandatory reason; owner may
  reclaim a clearly stale lock. All takeover events are audited.
- **DM-180 (revised):** Avadhoot Group is the common organisational family, not one operating or
  legal unit.
- **DM-181:** User identity is permanent and separate from login details, roles and plant grants.
- **DM-182:** Each Producing Plant is also the supplying and administrative unit for this app; no
  extra legal-entity layer is introduced.
- **DM-183:** Customers and Constructions are group-wide; SKUs, Pricing Basis Releases, Batches,
  Quotes, number sequences and Construction adoption are plant-owned.
- **DM-184:** Durable records use invisible internal identities; human business codes are separate.
- **DM-185:** Database access is denied without an explicit group-wide or plant-specific grant.
- **DM-186:** A Batch may use only SKUs belonging to its producing plant.
- **DM-187:** At row addition, SKU Customer must belong to the Batch Family. Later Family
  reassignment preserves existing work and warns rather than deleting/re-parenting it.
- **DM-205:** User onboarding is invitation-only; login alone grants no commercial access.
- **DM-206:** User deactivation removes future access immediately, preserves attribution and
  requires audited reassignment of open work.

### Rollout, migration and export compatibility

- **DM-169:** Rollout gates are Product Owner validation, small Maker/Checker pilot, then plant-wise
  expansion.
- **DM-170:** After formal adoption, rollback preserves Supabase records through compatible app
  rollback or controlled forward correction, not destructive database reversal.
- **DM-171:** All application data existing before this programme is disposable; authoritative
  masters can be rebuilt from the live Google Sheets pseudo-ERP.
- **DM-172:** Product Owner explicitly declares Formal Data Cutover. Destructive reset/reload is
  allowed only before that boundary.
- **DM-173:** Before cutover, Google Sheets is upstream master authority. Supabase receives controlled
  reloads with no live or bidirectional synchronisation.
- **DM-174:** Pre-cutover master reload uses reset-and-replace rather than expensive reconciliation.
- **DM-175:** Post-cutover spreadsheet import creates a reviewed proposed change set and never
  directly overwrites Supabase masters.
- **DM-176:** App recommends a compatible export template but permits an acknowledged incompatible
  template; no official-export compatibility block.
- **DM-177:** While a template has a known unresolved mismatch, a conspicuous Reconciliation Notes
  sheet records item-level truth and the workbook limitation. The product goal is to remove these
  notes by resolving app/workbook differences.
- **DM-178:** Where a legacy single-value field cannot represent several values, the exporter—not a
  first-item assumption—requires deliberate selection of the representative value and records it.
- **DM-179:** One Quote revision may produce a multi-part export bundle under one export event.

### Audit, engine, retention and availability

- **DM-195:** Formal changes create append-only audit events; material edits retain before/after
  values. Reasons are optional except where expressly mandatory.
- **DM-196:** Pricing/Quote/validity/effective dates are calendar dates. Calculation/workflow/audit
  events use exact timestamps displayed in the user’s timezone, initially India time.
- **DM-197:** Calculation snapshots record calculation-engine and rounding-rule versions.
- **DM-198:** Historical view/re-export uses stored results and never reruns current logic.
- **DM-199:** Amend recalculates affected units with the active engine while preserving the earlier
  Pricing Basis Release.
- **DM-200:** Makers cannot select historical engines; old results survive only as frozen snapshots.
- **DM-201:** Activating a new engine stales unsubmitted working calculations from the prior engine.
- **DM-202:** Submitted/approved revisions remain valid under their recorded engine; Checker may
  return them, but activation creates no automatic block.
- **DM-203:** After cutover, an abandoned durable Batch is marked Abandoned; reference and history
  remain.
- **DM-204:** After cutover, saved shared proposals are Withdrawn rather than deleted. Unsaved local
  entries may be cancelled.
- **DM-207:** Producing Plant Code is permanent, group-wide unique and never reused.
- **DM-208:** Batch/Quote sequences use the Indian financial year (1 April–31 March) and producing
  plant’s local event date, never user-editable Pricing/Quote Date.
- Batch Reference FY follows Batch creation; Quote Reference FY follows first Checker approval. A
  Batch created in March and first approved in April legitimately carries different FY segments.
- **DM-209:** After Formal Data Cutover, Supabase is the sole formal data authority. Browser storage
  is limited to START scratch and UI preferences.
- **DM-210:** If Supabase is unavailable, private START scratch may continue but formal Batch,
  CalcGate, submit, approve and issue actions are unavailable.

### SR DEV resolution addendum — approved amendments A-1 through A-26

- **CalcGate resolver:** Waste, Conversion and Interest inheritance must be resolved once through
  Batch Entry’s authoritative path; Costing cannot carry an independent commercial resolver.
- **No materialisation:** Sector selection and field clearing preserve blank/inherit rather than
  copying effective values into records.
- **Freight owner:** Pricing Group owns the sole calculating freight basis; Delivery Groups carry
  route presentation. Basis references are internal identities; unresolved blocks.
- **Divergence:** calculation and presentation changes have separate signals. Classification is per
  field, not per entity. Adding/removing an ordinary Delivery Group is presentation-only; changing
  the selected freight-basis route or moving a row between Pricing Groups is calculation-relevant.
- **Construction authority:** a published SKU spec version determines its Construction. A separate
  row Construction reference exists only for a quote-specific Proposed Construction.
- **Database enforcement prerequisite:** normal formal access executes as the calling user. A
  privileged client is limited to an explicit allow-list of bootstrap, user-administration and safe
  sequence-allocation operations.
- **SET:** standalone Box has no active SET; dissolved SET is retained; code is mandatory and unique
  across the whole Batch; no silent de-duplication.
- **Interest:** Payment Terms provides a versioned suggested Interest; blank inherits, zero is
  explicit, and 0.5% is the independently versioned initial system fallback.
- **Editing lock:** stale means 15 minutes without server-observed heartbeat. Heartbeat has a
  separate lock record and never advances the Batch content-concurrency token. Reclaim is atomic,
  server-clock based and audited. Timeout is an operational setting, never a Calculation Default.

---

## 19. Complete conceptual relationship model

### 19.1 Organisational and access records

```text
Avadhoot Group
└── Producing Plant
    ├── plant-owned numbering sequences
    ├── user plant grants and capabilities
    ├── Pricing Basis Releases
    ├── SKUs
    ├── Batches / Quotes
    └── Construction adoptions

Application User
├── login identity
├── group-wide capabilities
└── one or more plant grants/capabilities
```

One permanent application-user identity survives changes to login name, email, role and plant
assignment. Deactivation stops access without breaking audit attribution.

### 19.2 Party records

```text
Customer Family
├── Family identity + permanent Group Customer Code
├── Family names/aliases
└── Party memberships (effective-dated)
    └── Customer/Prospect identity
        ├── lifecycle state: Prospect or Customer
        ├── permanent Customer Code when graduated
        ├── legacy/external references
        └── Customer Locations
            ├── Bill-to eligibility
            ├── Ship-to eligibility
            └── versioned descriptive/address details
```

The same Party identity graduates. Family membership and Location parentage may change with history;
permanent codes do not. External Bill-to and Ship-to are references to the third party’s actual
Location, never duplicate child records under the Batch Family.

### 19.3 Product-definition records

```text
Global Construction
├── permanent Construction Code
├── immutable Construction Versions
└── plant adoption of an exact version

Plant-owned, Customer-specific SKU
├── optional permanent Plant Item Code
├── optional Customer Item references
├── immutable SKU Spec Versions
├── permitted Customer Locations
└── proposal/publication status
```

Construction is shareable; SKU is not. A SKU points to one producing plant and one Customer. A
formal published Construction version requires plant adoption, while a Quote may carry a
quote-specific approved proposal without publishing it globally.

### 19.4 Pricing master records

```text
Plant-owned Pricing Basis Release
├── effective-from date and optional effective-until date
├── automatic-default flag for its plant/date
├── exact approved Rates version(s)
├── exact approved Freight version(s)
├── exact approved Sector-default version(s)
└── exact approved Calculation-default version(s)
```

The Release is reusable master context. Batch, Pricing Group and row overrides remain outside it.
The final Calculation Snapshot combines the selected Release, applicable overrides and results.

### 19.5 Batch and route records

```text
Batch
├── permanent Batch Reference
├── exactly one Customer Family
├── exactly one Producing Plant
├── current owner + collaborators
├── Batch Profile and profile history
├── Pricing Groups
│   └── Delivery Groups
│       ├── Bill-to Location (optional; internal or external)
│       ├── Ship-to Location (optional; internal or external)
│       └── descriptive route/logistics context
├── Batch Rows
│   ├── exactly one plant/customer-valid SKU
│   ├── exactly one Pricing Group
│   ├── selected SKU spec version (published Construction follows from it)
│   ├── separate Construction reference only for a Quote-specific proposal
│   ├── row overrides
│   └── stable lineage identity
└── SETs
    ├── internal SET identity
    ├── editable SET Code
    └── explicit Box/Plate/Partition membership
```

A Pricing Group is a common price schedule across one or more Delivery Groups. One row may cover
many same-priced Delivery Groups. A different price requires another visible Batch row.

### 19.6 Quote records

```text
Quote Family
├── permanent Quote Reference
└── linear Quote Revisions
    ├── revision number and workflow status
    ├── current/superseded standing
    ├── frozen addressee and validity
    ├── Quote Items
    │   ├── immutable Quote Item identity
    │   ├── direct originating Batch-row identity (PM-7)
    │   ├── Pricing/Delivery Group applicability
    │   └── immutable Calculation Snapshot
    ├── approval and issuance events
    ├── customer-outcome events
    └── export events and generated parts
```

Quote Items do not calculate. Send freezes the Batch Entry result. A Quote revision never branches,
and historical rendering always reads frozen values.

---

## 20. Required relationship and uniqueness constraints

The later Supabase design must enforce, not merely display, these approved invariants:

1. Every durable record has an internal immutable identity independent of visible codes.
2. Permanent Group Customer, Customer, Customer Location, Plant, Plant Item, Construction, Batch and
   Quote codes/references are unique in their approved scope and never reused.
3. One Customer has one current Family membership; membership history may contain prior periods.
4. One Batch has one Family and one Producing Plant.
5. One SKU has one Customer and one Producing Plant. A new Batch row can use it only when both the
   Batch plant and current Batch Family rules pass.
6. One Batch row belongs to one Pricing Group; the Pricing Group belongs to the same Batch.
7. Every Delivery Group belongs to one Pricing Group in the same Batch.
8. One same-priced Batch row may relate to several Delivery Groups only through its Pricing Group.
9. A SET has exactly one Box parent and explicit component membership; editable SET Code is not a
   foreign key. Only an active SET must have one or more components. A dissolved SET remains as an
   inactive historical record. SET Code is mandatory and unique within the Batch after trimming and
   case normalization, including codes held by dissolved SETs.
10. One Quote Item links directly to exactly one originating Batch row and one frozen calculation
    snapshot.
11. Quote revision numbers are unique within one Quote family and never reused.
12. Only one Pricing Basis Release may be automatic default for a plant on a calendar date, while
    approved alternatives may coexist.
13. Approved master versions, issued revisions, calculation snapshots and audit events are
    immutable. Corrections append new versions/events.
14. Customer/Location reassignment, Family merger or master deactivation cannot cascade-delete
    Batches, Quotes or snapshots.
15. Empty Pricing/Delivery Groups cannot enter a submitted Quote candidate.
16. Published SKU spec version is the sole Construction authority for that SKU. A separate Batch-row
    Construction reference is permitted only for an expressly quote-specific Proposed Construction.
17. Mutable shared/formal records carry a content concurrency token checked atomically on write.
    Editing-lock heartbeats are stored separately and cannot change that token.

Technical key types, exact indexes and SQL expressions belong in the later SR DEV brief, after this
conceptual design is approved.

---

## 21. Lifecycle maps

### 21.1 Scratch to issued Quote

```text
Private START scratch
    → explicit Create New Batch
Working Batch
    → calculate in Batch Entry (CalcGate)
    → atomic Send to Quote (SendGate)
Draft Quote Candidate
    → Submit for Approval
Submitted Quote Revision
    → Checker Return ───────────────→ Working Batch / refreshed candidate
    → Checker Approve
Approved, Unissued Revision
    → Withdraw with reason ─────────→ Draft workflow
    → Issue to Customer
Issued Revision + locked Batch
    → deliberate Create Revision ──→ next linear revision, initially preserving calculations
```

### 21.2 Issued revision standing and customer outcome

```text
Issued revision standing: Current → Superseded when next revision is issued
                          Current → Voided by Checker/Admin with reason

Customer outcome history: Awaiting Response → Accepted / Rejected / Expired
                          later outcomes append; earlier entries remain
```

Standing and customer outcome are independent. An Accepted revision may later be Superseded without
erasing that it was once accepted.

### 21.3 Recalculation

```text
Amend Approved Quote
├── start from current/latest revision
├── retain earlier Pricing Basis Release and explicit overrides
├── use current calculation engine for affected units only
└── preserve unaffected frozen calculations

Reprice as on Date
├── start from current/latest revision
├── choose Pricing Date (default today)
├── auto-suggest that plant/date's default Pricing Basis Release
├── allow deliberate approved alternative
├── carry explicit overrides with visible review markers
└── recalculate all active Batch rows with current engine
```

### 21.4 Master proposal and publication

```text
Local edit → Save shared proposal → Review/approval → Published immutable version
                                 ↘ Return / Withdraw

Correction to published data → new proposed version → approval → new published version
```

Quote-specific Proposed Customer/Location/SKU/Construction use is not silent master publication.

---

## 22. Consolidated authority map

| Commercial fact | Primary authority | Exception/override | Frozen at Send/Issue |
|---|---|---|---|
| Calculation | Batch Entry | none; Quote Items cannot calculate | exact result + inputs |
| Pricing master context | plant Pricing Basis Release | deliberate approved alternative release | release and components |
| Waste/Conversion | Sector/system → Batch default | row explicit blank/zero/value semantics | effective value + source |
| Margin | System/Sector → Batch Box/PP default | row explicit override | effective value + source |
| Freight | approved master → Pricing Group | row explicit override; explicit zero allowed | effective value + source |
| Payment Terms | structured/descriptive Pricing Group field | optional wording; wording does not calculate | rendered term snapshot |
| Interest | approved Payment Terms mapping → versioned 0.5% fallback | Pricing Group blank/zero/value override | value + source + map/default version |
| Price Validity | Batch Profile | none initially | revision snapshot |
| Offer Validity | Quote revision from Quote Date | may remain blank | issued revision snapshot |
| SKU definition | plant-owned Customer SKU + selected version | Quote-specific Proposed SKU/version | Quote Item snapshot |
| Construction | global version + plant adoption | Quote-specific Proposed Construction | Quote Item snapshot |
| Bill-to/Ship-to | Delivery Group references actual Customer Locations | external third parties permitted | displayed route snapshot |
| Customer response | authorised Maker/Checker event | Admin correction by later event | append-only outcome history |

Blank means unknown/inherit only where the field’s authority chain defines inheritance. Zero remains
an explicit value. The model must never convert missing input into commercial zero by convenience.
The detailed chains in §9 run from highest-priority override down to fallback. This summary table
sometimes reads from inherited source toward exception; the underlying authority is unchanged.

---

## 23. Supabase access design for approval

This is the required access model, still expressed conceptually rather than as SQL:

| Record family | Read boundary | Write boundary |
|---|---|---|
| Customer Families, Customers, Locations | users holding an explicit group or applicable plant grant | explicit Customer-master capability |
| Construction Library | users holding an explicit group or applicable plant grant | Construction-library capability |
| Plant Construction adoption | users with relevant plant access | plant Adoption capability |
| SKUs | assigned plant(s), plus explicit cross-plant grants | plant SKU-master capability; Quote proposals by authorised Maker |
| Working Batches | owner/collaborators plus plant Checker/Admin | active editor subject to workflow/lock rules |
| Issued Quotes | users assigned to producing plant | immutable; later events/revisions only |
| Pricing Basis/master versions | relevant plant users | plant commercial-master proposal/approval capability |
| Audit/calculation snapshots | same or narrower access as parent record | append-only system-controlled writes |
| Exports | same access as Quote revision | draft by Maker; official only after approval |

Required enforcement principles:

- invitation-only authentication;
- deny by default without explicit grant;
- browser UI is not the security boundary;
- privileged server credentials never reach the frontend;
- normal formal reads and writes execute in the calling user’s database context so RLS actually
  applies. The current service-role-for-every-query backend cannot satisfy this and must be changed
  before the access design can be claimed as delivered;
- privileged backend operations are limited to a reviewed allow-list, initially authentication
  bootstrap, user administration and safe reference-sequence allocation;
- all formal writes validate plant, ownership, capability and current workflow state;
- conflicting/stale writes fail rather than overwrite newer data;
- every mutable shared/formal record carries a content version checked atomically at Save;
- one active Batch editor initially, with lock heartbeat in a separate record. Fifteen minutes with
  no server-observed heartbeat is stale. Owner reclaim and Checker/Admin takeover are atomic and
  audited; active takeover requires reason. Heartbeats never alter the Batch content version;
- the 15-minute timeout is an Admin-configurable operational setting and never part of a Pricing
  Basis Release or Calculation Snapshot;
- cross-Family Bill-to/Ship-to selection grants no access to the third party’s unrelated Quotes or
  SKUs.

---

## 24. Reset, migration, compatibility and rollout

### 24.1 Before Formal Data Cutover

- Current app data is trial/disposable.
- Google Sheets pseudo-ERP remains upstream master authority.
- Supabase may be reset and cleanly reloaded.
- No browser-local formal-history import or PM-7 backfill is required.
- Live Customer hierarchy requires Product Owner-reviewed Family/Customer/Location mapping.
- Live SPEC Plant Item Codes import as distinct SKU candidates, including SET components.
- Blank/missing/inert keys never become explicit values.
- Sector data may be retained if inexpensive; backup permits fresh overwrite.

### 24.2 Formal Data Cutover

The Product Owner records an explicit cutover event. From that point:

- Supabase becomes sole formal authority;
- destructive reset of real Batches/Quotes/audit is prohibited;
- spreadsheet loads become proposed reviewed change sets;
- browser-local storage cannot author formal records;
- rollback preserves database records.

### 24.3 Adoption gates

1. Product Owner validation using real workbook scenarios.
2. Small Maker/Checker pilot.
3. Plant-wise wider adoption.

Each gate reviews calculation parity, workflow, access, export coverage and discovered exceptions.
Application rollback may restore a compatible earlier deployment or disable incomplete functionality;
database correction proceeds forward rather than deleting formal history.

### 24.4 Workbook compatibility

- Templates are versioned and declare supported scenarios.
- App recommends a compatible template but permits an acknowledged incompatible one.
- Compatibility mismatches never block official export.
- While a mismatch exists, Reconciliation Notes expose item-level truth.
- A legacy single-value field requires deliberate representative-value selection.
- One Quote revision may create several workbook/sheet parts under one export event.
- The desired endpoint is scenario-capable templates with no reconciliation note, not permanent
  dependence on warnings.

---

## 25. Explicitly deferred and excluded

- Cost-versus-Quote and realised-margin analytics.
- Route-level actual freight/profitability analysis.
- Automatic risk-premium calculation or isolation.
- Order management and acceptance-document storage.
- GST, PAN, CIN, invoicing and tax workflows/data.
- Mechanical number-of-printing-colours capture or pricing rules.
- Pricing Group-level Price Validity overrides; initial validity is Batch-wide.
- Alternative D-13 graduation routes beyond initial Admin control.
- Later expansion of NPD/Admin capabilities and mandatory-reason policies.
- Possible later disabling of Checker editing or quote self-approval.
- Multiple simultaneous Batch editors.
- Live or bidirectional Google Sheets synchronisation.
- Final scenario-specific workbook layout design.
- Migration/backfill of disposable trial application records.
- The separate Commercial Intelligence workstream.

---

## 26. Implementation prerequisites exposed by the technical review

These are not permissions to implement. They must appear in the later SR DEV implementation brief
and receive explicit Product Owner approval as part of its staged sequence.

1. Replace the duplicated Costing/Batch waste-conversion resolution with one Batch
   CalcGate-authoritative resolver.
2. Remove every authoring path that materialises Sector defaults or Payment Terms-derived Interest
   into blank/inherit fields.
3. Resolve all five inheritable fields—Box/PP Waste, Box/PP Conversion and Interest—before they reach
   code paths that collapse blank, zero or missing values.
4. Reconcile the unreachable 1.5% Interest engine literal with the approved versioned 0.5% fallback;
   it must not remain as a silent alternative default.
5. Add golden-value tests that execute the actual Batch Entry calculation and Send paths, not only
   the isolated costing engine.
6. Introduce distinct calculation and presentation fingerprints/signals and test every classified
   field and structural change.
7. Make Pricing Group the only freight calculation owner, with explicit master/manual/ex-factory
   mode and blocking unresolved state.
8. Remove Construction-level Waste/Conversion from import mapping and from the target authority
   path.
9. Introduce caller-context database access before claiming RLS enforcement. Service-role access is
   restricted to a reviewed allow-list.
10. Introduce atomic content-version conflict checking separately from the 15-minute editing-lock
    heartbeat/reclaim mechanism.
11. Ensure every permanent reference/sequence is allocated atomically and never reused, including
    sequence state belonging to retired Families.
12. Verify that exports expose mixed engine versions, route schedules, representative-value choices
    and known compatibility mismatches without recalculating historical results.

---

## 27. Closure and successor records

No unresolved exploratory product question is known. The Product Owner accepted SR DEV’s technical
review and authorised preparation of the freshly numbered canonical record and separate
implementation brief.

- `docs/data-model-decisions.md` is the concise canonical decision authority.
- `docs/data-model-implementation-brief.md` translates it into an approval-gated programme for SR DEV.
- This longer design remains supporting rationale and Q&A traceability; it is not the implementation
  authority where the canonical record differs.

No code, database, migration, Vercel deployment or commit is authorised by any of these documents.
