# CFB Quotation OS — Canonical Data Model decisions

**Status:** approved conceptual model. Prepared after Product Owner Q&A and SR DEV technical review.

**Authority:** this record supersedes conversational DM numbering and
`data-model-design-for-approval.md` where wording differs. It approves the product/architecture
model only. It does not authorise code, database changes, migration, deployment or commits.

**Baseline:** Costing START/REVIEW and Pre–Data Model closure are complete at `849c5d4`. Batch Entry
is the sole CalcGate. Quote Items is the SendGate and has no calculation or edit authority.

**Excluded:** the Commercial Intelligence workstream is not merged into this model.

---

## CDM-01 — Product boundary

The first objective is fast, dependable customer Quote calculation within known cost boundaries.
Cost-versus-Quote, realised-margin, route-profitability, automatic risk-premium, order management,
tax and invoicing are outside this stage.

## CDM-02 — Formal authority boundary

START is a private browser-local scratchpad. Durable work begins only through explicit Create New
Batch. Batch Entry alone calculates. Atomic Send freezes a complete Quote candidate. Quote Items
cannot calculate or edit commercial figures.

## CDM-03 — Stable identity

Every durable entity has an immutable internal identity separate from visible codes and labels.
Permanent business references are unique in their approved scope and never reused. Editable codes,
names, aliases and SET labels never act as relationship keys.

## CDM-04 — Avadhoot structure

Avadhoot Group is the common organisational family. Its three Producing Plants are separate
supplying and administrative units. Customers and Constructions are group-wide; SKUs, Pricing Basis
Releases, Batches, Quotes, sequences and Construction adoption are plant-owned.

## CDM-05 — Users and capabilities

One permanent application-user identity is linked to login credentials. Roles, capabilities and
plant grants are separate and changeable. Access is invitation-only and denied without an explicit
grant. Deactivation stops future access while retaining audit attribution and requiring reassignment
of open owned work.

## CDM-05-A — Legacy `Group` scope, and multi-plant assignment

**Ruled by the Product Owner 2026-09-05. Amends CDM-05.**

The legacy `profiles.plant` value `Group` is a **deliberate commercial scope, not dirty data**. It
means group-wide access: across all current plants, all future plants, and relevant group-level
areas beyond an individual producing plant. It must not be treated as an invalid plant code, mapped
onto `NAG`/`PUN`/`KOL` as though it were one of them, or retired.

**One user may hold any number of plant assignments.** This is the normal case, not an edge case.
The user-management model must not collapse plant assignment into a single field. The legacy single
`profiles.plant` column was one column; the capability model is not, and the API's singular `plant`
field survives only as a read-only convenience and a single-value input alias.

**Phase 2 representation, accepted with a stated limitation.** The `Group` scope is carried forward
as **explicit** grants of `plant_access` + `make_quote` at each currently seeded plant — `NAG`, `PUN`
and `KOL`. **Access to a plant created later requires an explicit administrator grant.** Automatic
inclusion of future plants is **deferred for separate product consideration** and is not implemented.

That limitation is asserted as a test (`MP-8`), not merely documented, so that it fails loudly if a
later change ever makes new plants automatic without a decision.

**Group-level visibility is separate.** It comes only from the appropriate existing group
capabilities, granted explicitly. It is **not** inferred from, and not conferred by, the legacy
`Group` value. In particular the legacy value does not imply `read_party_master`,
`manage_customer_master`, `administer_users` or any other group capability.

**Scope of the carried-forward identity:** Maker. No Checker authority, no `administer_users`.

**Superseded proposal.** An earlier reading of this ruling would have introduced a new group-wide
*operational* scope into the capability model. That was withdrawn by the Product Owner: no new scope
kind is introduced in Phase 2, and the current capability architecture stands unless multi-plant
assignment itself proves unsupportable. It was not — only the write path collapsed to one plant, and
that was a defect in the route, not in the model.

## CDM-06 — Customer hierarchy and lifecycle

Customer Family contains one or more Customer/Prospect identities; each contains Customer
Locations. Prospect and Customer are lifecycle states of the same identity. Graduation preserves
history and assigns the permanent Customer Code. Creating a minimal Prospect requires only a display
name and silently establishes a Proposed Family when necessary.

## CDM-07 — Customer codes and history

Family Code is a neutral permanent sequence. Customer Code contains its original Family Code plus a
sequential Customer suffix and remains unchanged after reassignment. Location Code sequences beneath
Customer Code. Family and Location reassignments are effective-dated. Retired Families and sequence
state remain reserved permanently. Existing business codes remain searchable external references.

## CDM-08 — Customer Locations and third parties

Customer Location is the canonical address/site entity and may be Bill-to, Ship-to or both. Details
may remain incomplete. External Bill-to and Ship-to use the third party’s real Customer Location;
they do not duplicate it under the Batch Family or change Batch, Quote or SKU ownership.

## CDM-09 — SKU identity

A SKU is a Customer-specific commercial item belonging to exactly one Producing Plant and one
Customer. It may apply to several Customer Locations. Equivalent supply from another Avadhoot plant
is another SKU. Plant Item Code is unique within its plant, permanent and optional until assigned;
no temporary pseudo-code is manufactured.

## CDM-10 — SKU change rules

Dimension, Construction or strength change creates a new SKU. Printing/artwork/name-only change may
be a new version of the same SKU or a separate SKU according to how the customer orders it. Printing
Technology, number of colours and descriptive colour detail are captured as specification data on the
immutable SKU specification version, not on global Construction (Amendment 01, A-06). Number of
colours does not by itself create a mechanical pricing rule and does not mechanically determine
whether a new SKU identity is required; these fields become calculation-driving only when an approved
rate mechanism explicitly consumes them, and no pricing formula may be inferred from them. Open
Batches remain pinned to their selected non-price-driving SKU version until Maker adopts a newer
version.

## CDM-11 — Proposed and discontinued SKUs

Maker may create a stable Proposed SKU in Batch Entry and quote it before Plant Item Code assignment.
Checker approval authorises Quote use, not master publication. NPD/Admin publication is separate.
Discontinued SKUs cannot be newly selected but may finish an existing Batch with warning. Reactivation
preserves identity if the commercial item is unchanged; replacement SKUs are linked but never
silently substituted.

## CDM-12 — Construction Library

Construction is globally shareable. It has a neutral permanent sequence code such as `CON-000125`,
non-unique descriptive name and immutable technical versions. Formal published use requires exact
plant adoption. Maker may propose a Construction in Batch Entry; Checker may approve Quote-specific
use without publishing it. Publication preserves a genuinely new identity; duplicates merge with
retained lineage.

## CDM-13 — Construction authority

A published SKU spec version is the sole authority for its Construction. A Batch row holds a
separate Construction reference only for a Quote-specific Proposed Construction. Construction-level
Waste/Conversion is outside the model and must not be imported as a hidden authority tier.

## CDM-14 — Batch boundary and references

A Batch belongs to exactly one Customer Family and one Producing Plant. It is mutable: rows may be
added, edited, reversibly removed and restored. Batch Reference is allocated at creation as
`Plant/BAT/Indian-FY/sequence`, is permanent and never reused.

## CDM-15 — Batch commercial structure

A new Batch starts with one default Pricing Group and one default Delivery Group. Batch rows and
Pricing Groups are sibling children of Batch; each row references exactly one Pricing Group. Empty
groups may exist during drafting but never enter a submitted candidate.

## CDM-16 — Pricing and Delivery Groups

Pricing Group represents one per-SKU price schedule across one or more Delivery Groups. Delivery
Group represents Bill-to/Ship-to route presentation. One same-priced Batch row becomes one Quote
Item covering all Delivery Groups in its Pricing Group. The same SKU at a different price requires a
separate visible Batch row; one hidden shared calculation may not feed several different prices.

## CDM-17 — Freight authority

Pricing Group owns the single freight value entering calculation:

`row explicit override → Pricing Group freight → approved Freight Master → unresolved/block`.

Mode is explicitly master, manual or ex-factory. Blank inherits, zero is explicit zero, and missing
is not zero. Freight-basis Location/Delivery Group is referenced by internal identity. Clearing or
removing the selected basis blocks rather than falling back silently. Other route details are
descriptive.

## CDM-18 — Payment Terms and Interest

**Amended by Amendment 01, A-01 to A-04 (Product Owner, 2026-09-06). Replaces the previous fixed
Payment-Terms mapping in full.**

Pricing Group owns structured/descriptive Payment Terms and Interest. Interest resolves:

`explicit Pricing Group override → derived from the approved annual interest rate → versioned system fallback`.

One approved annual interest percentage is the single calculating authority. The effective
percentage is derived as `annual_interest_pct × payment_terms_days ÷ day_count_basis`. The approved
day-count basis is **360, and 360 only**; no alternative basis may be stored, configured or
selected, and a change of convention requires an explicit canonical amendment and its own migration.
The initial approved annual rate is **6.000% per annum**, which reproduces every previously approved
value exactly: 30d→0.5%, 45d→0.75%, 60d→1.0%, 90d→1.5%.

The annual rate is calculation-driving: versioned, second-person approved, attributable, and
immutable once approved. A change is a new approved version, never an edit.

The structured calculating Payment Terms remain the closed list of 30, 45, 60 and 90 days, carried
as a closed input domain on the Pricing Group. Other wording may be retained as descriptive free
text but does not calculate. An unresolved structured Payment Term — including a null — resolves to
the independent versioned fallback of 0.5%, never to 1.5%.

Separately maintained fixed effective-interest percentages per Payment Term are withdrawn, together
with their customer-behaviour reading. No second interest authority may exist. The obsolete
structure is not removed while any deployable build still reads it or substitutes a hard-coded
percentage; the approved removal order is stated in Amendment 01, A-03.

The explicit Pricing Group override is retained. Blank inherits and the derivation applies; zero is
an explicit zero; a non-null override takes precedence over the derivation. Where the override
differs from the derived percentage a reason is mandatory, and the actor, time, derived percentage
and overridden percentage are all preserved.

The annual rate, its version, the day-count basis, the selected days and the derived percentage are
snapshotted. Payment Terms change stales rows only when Interest inherits; with an explicit override
it requires fresh Send only.

## CDM-19 — Waste, Conversion and Margin

Waste/Conversion resolve `row override → Batch default → Sector default → system fallback`.
Margin resolves `row override → Batch Box/PP default → Sector default → system fallback`. Blank
means inherit; zero is explicit. Each Sector maintains an approved default target margin reflecting
its normal market and process economics; it is a starting authority tier, not a rigid price rule.
The Batch may override it for the customer opportunity, and an individual row may exceptionally
override the Batch. Effective inherited values may display in grey but are never stored as
overrides. Batch Entry’s single CalcGate resolver governs every surface.

## CDM-20 — SET identity

A Box without components is standalone. Attaching the first Plate/Partition creates or reactivates a
SET; removing the last component dissolves but does not delete it. SET Code is mandatory,
case/trim-normalised unique across the entire Batch and remains reserved while dissolved. Dissolved
SETs stay visible and relabellable. Membership uses internal identity; no string/order inference.

## CDM-21 — Quote family and revision identity

First Send creates/dedicates the Quote family; first Checker approval allocates permanent
`Plant/Q/Indian-FY/sequence`. Revision number is allocated at first approval, never reused, and
retained if approval is withdrawn. Revisions are linear from the latest/current issued revision;
historical branches are prohibited.

## CDM-22 — Calculation and Send snapshots

Each Batch row has stable lineage; each revision’s Quote Item has a new immutable identity directly
linked to that row (PM-7). Send freezes inputs, results, effective values and sources, selected
versions, Pricing Basis, engine/rounding version, user and timestamp. For Interest this means the
approved annual rate and its version, the day-count basis, the selected Payment Terms days and the
derived percentage — not the derived number alone, which is otherwise unverifiable once the rate is
superseded. Send also freezes the effective supplier paper-credit cost, its source and the Rate Set
version it came from (CDM-41). Historical view/re-export reads stored results and never reruns
current logic.

## CDM-23 — Divergence signals

Formal candidates distinguish: fresh, needs-Send-only and calculation-stale. Pricing-relevant change
stales the smallest affected unit; descriptive change requires fresh Send only. Moving a row between
Pricing Groups is pricing-relevant. Adding/removing an ordinary Delivery Group is presentation-only
unless it is/becomes the freight basis. Submitted/approved candidates never refresh silently.

## CDM-24 — Approval and issuance lifecycle

Maker submits; Checker approves; approval and Issue to Customer are separate. Maker draft exports
carry unavoidable `DRAFT — NOT APPROVED`. Approved but unissued revisions may be withdrawn with
mandatory reason. Issued revisions are immutable and further work requires deliberate Create
Revision. Download alone never proves issuance.

## CDM-25 — Amendment and Reprice

Create Revision initially preserves issued calculations. Amend uses the earlier Pricing Basis and
current engine for affected units only; unaffected items remain frozen. Reprice as on Date uses any
permissible Pricing Date (default today), the current engine and all active rows. Explicit overrides
carry forward visibly until deliberately cleared. Mixed-engine Quote revisions are legitimate and
must be visible.

## CDM-26 — Pricing Basis Release

A Pricing Basis Release is an internal, immutable, plant-specific approved bundle of Rates, Freight,
Sector defaults and Calculation Defaults—not customer confirmation. One automatic default applies
per plant/date; approved alternatives may coexist. Releases may be retrospective or future-effective.
Corrections create replacements; withdrawal never rewrites history. Amend may reuse a withdrawn
historical Release; new Quote/Reprice may not. The approved annual interest basis travels in the
Release through its Calculation Defaults component and is not a separate component; the supplier
paper-credit cost travels through the Rate component (CDM-41).

## CDM-27 — Pricing Basis selection and approval

The effective default Release is applied automatically for ordinary pricing. Maker may deliberately
choose another approved Release; reasons are optional initially. Calendar gaps warn but allow an
approved alternative. Release components must already be approved. Plant-scoped proposer/approver
are normally different; emergency self-approval is explicitly audited.

## CDM-28 — Customer outcome and revision standing

Issued revision customer outcome is whole-revision: Awaiting Response, Accepted, Rejected or
Expired. Outcome events are append-only with optional acceptance date/reference/note. Offer-validity
lapse is a system flag, not automatic Expired. Revision standing is separately Current, Superseded
or Voided. New issuance supersedes the prior revision without erasing its customer outcome.

## CDM-29 — Validity

Price Validity is an optional whole-Batch Profile input initially. Offer Validity is a separate
optional Quote-revision field measured from Quote Date. Risk premium remains Maker/Checker judgement.
Issued values are frozen.

## CDM-30 — Exceptional document states

Checker/Admin may Void an issued revision with mandatory reason; a corrective next revision may use
it as source but passes the complete workflow. Abandoned durable Batches retain reference/history.
Pre-approval Quote families may be Abandoned without consuming a Quote Reference. Archive is
reversible organisation only and never changes commercial standing.

## CDM-31 — Master governance

Shared masters use Draft/Edit, Save/Cancel, atomic validation and conflict detection (PM-1).
Calculation-driving changes require second-person approval; routine descriptive changes may publish
directly (PM-2). Published history is immutable and rollback creates a corrective version (PM-3).
Saved proposals are Withdrawn, not hard-deleted.

## CDM-32 — Ownership, collaboration and locks

Each Batch has one current owner plus authorised collaborators. Transfers and collaboration changes
are audited. One active editor is allowed initially. A lock is stale after 15 minutes without a
server-observed heartbeat. Heartbeat is separate from content concurrency. Owner reclaim and
Checker/Admin takeover are atomic and audited; active takeover requires reason.

## CDM-33 — Checker behaviour

Checker may initially edit a submitted Batch and the same Checker may modify and approve after
affected units are recalculated and resent. A user holding Maker and Checker capabilities may
self-approve initially; audit exposes it. Both behaviours may become configurable later. Checker
Return requires a note.

## CDM-34 — Audit and time

Formal/master/workflow/access changes append audit events with actor, exact timestamp, action and
material before/after values. Reasons are mandatory only where expressly decided. Business dates are
calendar dates; events use timezone-aware instants displayed in the user’s timezone. Pricing/Quote
dates never control permanent-reference FY allocation.

## CDM-35 — Supabase security boundary

RLS and database constraints—not UI filtering—enforce plant, ownership, capability and workflow
boundaries. Normal access executes as the caller. Privileged credentials are restricted to a written
allow-list of bootstrap, user administration and safe sequence allocation. Cross-Family route
selection grants no access to unrelated third-party Quotes/SKUs.

## CDM-36 — Export authority and compatibility

App frozen calculation is authority; workbook is representation/reconciliation. Compatibility
mismatch never blocks official export, but requires explicit acknowledgement and visible item truth
until templates are corrected. Templates are versioned; app recommends compatibility. No silent
first-item assumption: representative values are deliberately selected and audited. One revision may
produce a multi-part export event.

## CDM-37 — Pre-cutover migration

All current app operational/master data is disposable trial data. Google Sheets pseudo-ERP remains
upstream before explicit Formal Data Cutover. Pre-cutover load is reset-and-replace; no browser-local
history or PM-7 backfill. Customer hierarchy requires reviewed mapping. Manufactured blanks,
missing/inert keys and Construction Waste/Conversion are not imported as meaningful values.

## CDM-38 — Cutover, rollout and rollback

Product Owner explicitly declares Formal Data Cutover. Afterwards Supabase is sole formal authority;
spreadsheet imports become reviewed proposals and formal records are not destructively reset.
Rollout gates are Product Owner validation, small Maker/Checker pilot and plant-wise expansion.
Rollback preserves database history through compatible app rollback or forward correction.

## CDM-39 — Availability

If Supabase is unavailable, private START scratch may continue. Formal Batch creation/update,
CalcGate, Send, submit, approval and issuance are blocked rather than recorded locally.

## CDM-40 — Explicit deferrals

Deferred: route profitability; cost/margin intelligence; risk-premium calculation; order/tax/invoice
workflows; colour-count *pricing* rules; live spreadsheet synchronisation; multi-editor mode; final workbook
formats; later permission routes; Pricing Group validity overrides; and the separate Commercial
Intelligence workstream.

## CDM-41 — Supplier paper-credit cost

**Added by Amendment 01, A-05 (Product Owner, 2026-09-06).**

Rate Master Credit Cost is the cost of credit taken from the paper supplier. It is an input cost
entering the Effective Paper Rate, and it is **not** customer Payment-Terms Interest (CDM-18). It is
never derived from customer Payment Terms and never from the annual customer-interest basis.

The initial blanket supplier Credit Cost is 1.500%. It is a versioned, approved, plant-owned value
on the Rate Set version. A per-grade value is retained only as an explicit exception: blank inherits
the Rate Set version value, and explicit zero remains zero. The effective value, its source and the
Rate Set version are frozen at Send (CDM-22).

Application labels and calculation-result labels must distinguish customer credit-period interest
from supplier paper-credit cost so that the two cannot be read as one.

## CDM-42 — Plant flute profiles and take-up factors

**Added by Amendment 01, A-07 (Product Owner, 2026-09-06). Approved in principle; not implemented.**

Flute take-up factors are governed, plant-owned, versioned values, not code constants. No flat
factor list is approved for migration: the sources conflict, and Nagpur C is 1.45 in the Operations
Master against 1.47 in the quotation template and the current application.

The package is prepared after S8 and must carry plant-specific profile identity, approved immutable
versions, strictly positive factors, an absent reference for "no flute" rather than a zero
multiplier, no silent fallback of an unknown or malformed flute code to 1.0, controlled
normalisation of case and whitespace, and calculation and snapshot provenance. A plant-by-plant
reconciliation table and a named operational owner per value are required before authorisation.
Machine, station, process-route, scheduling, capacity, shop-floor, QC and procurement scope remain
outside this and every current slice.

---

## Approval handoff

This canonical record is the product and architecture source for the Data Model implementation
brief. Exact SQL, RLS policy text, migration files, UI details and commit sequence require separate
Product Owner approval through that brief. No implementation is authorised by this record alone.
