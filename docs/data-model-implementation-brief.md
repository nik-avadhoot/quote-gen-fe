# CFB Quotation OS — Data Model implementation brief for SR DEV

**Status:** proposed implementation programme for Product Owner review. Do not implement, migrate,
deploy or commit until the Product Owner approves this brief and its staged commit plan.

**Sources of truth:**

1. [`data-model-decisions.md`](data-model-decisions.md) — canonical product/architecture decisions.
2. [`data-model-sr-dev-review.md`](data-model-sr-dev-review.md) — technical evidence and amendments.
3. Existing closure records named in `CLAUDE.md` and `session-start.md`.

If this brief conflicts with the canonical record, the canonical record wins. The Commercial
Intelligence workstream remains excluded.

---

## 1. Delivery objective

Replace trial/browser-local formal data with a Supabase-backed model that makes Batch Entry the sole
CalcGate, Quote Items an immutable SendGate snapshot, and every identity, version, workflow,
authority, access and export relationship enforceable and auditable.

Do not preserve trial Batch/Quote/SKU/Customer/Construction records. Preserve or reseed Sectors only
if materially cheaper than rebuilding them. Before cutover, Google Sheets remains the upstream master.

---

## 2. Mandatory design principles

- Lowercase `snake_case` database identifiers.
- `bigint generated always as identity` primary keys for the single-database system; `auth.users.id`
  remains UUID and is linked uniquely from the permanent application user.
- Human codes/references are separate `text` alternate keys and never foreign keys.
- `date` for Pricing/Quote/validity/effective dates; `timestamptz` for events and audit.
- `numeric`, never floating point, for money, rates, percentages, dimensions and calculation inputs.
  Precision/scale must be derived from current engine/workbook ranges before migration approval.
- Text status plus named check constraints unless SR DEV demonstrates a safer evolvable alternative.
- Index every foreign key and every column used by RLS predicates. Add composite/partial indexes only
  for demonstrated access paths; do not create speculative indexes.
- No hard delete of post-cutover formal/shared records. Use status/effective dating.
- Keep transactions short. All multi-record workflow transitions are atomic.
- Content concurrency and edit-lock heartbeat are separate mechanisms.
- RLS is defence and enforcement, not documentation. Normal queries execute as the caller.

---

## 3. Proposed schemas and record families

Use an exposed application schema only if required by the chosen API path; otherwise keep privileged
helpers and internal-only objects in a non-exposed schema. Any exposed table has RLS enabled and
explicit grants. Views must use caller/invoker security or remain inaccessible to public API roles.

### 3.1 Organisation, people and permissions

| Table | Purpose and essential fields |
|---|---|
| `avadhoot_groups` | root group identity, name, status |
| `plants` | group FK, permanent plant code, name, local timezone, status |
| `app_users` | permanent identity, unique `auth_user_id`, display name, status |
| `capabilities` | stable capability key and description |
| `group_capability_grants` | user, capability, effective status |
| `plant_capability_grants` | user, plant, capability, effective status |
| `operational_settings` | group/plant setting key, versioned value; includes 15-minute lock timeout, never pricing defaults |

Constraints: one active grant per scope/capability; plant code group-wide unique and never reusable;
deactivation cannot cascade into audit/history.

### 3.2 Customer/Prospect hierarchy

| Table | Purpose and essential fields |
|---|---|
| `customer_families` | permanent identity/code, current name, status, sequence state |
| `customer_family_aliases` | searchable historical/alternate names |
| `parties` | permanent Prospect/Customer identity, lifecycle status, customer code when graduated, commercial role flags |
| `party_external_references` | legacy Customer Codes and other searchable references |
| `party_family_memberships` | party, family, effective-from/until, current marker |
| `customer_locations` | permanent code, current parent party, Bill-to/Ship-to flags, type, status |
| `customer_location_versions` | immutable descriptive/address versions and effective dates |
| `customer_location_parent_history` | effective-dated reassignment between parties if not represented directly by versions |

Constraints: one current Family membership per Party; Customer Code nullable only before graduation;
Location belongs to one current Party; retired Family sequences remain; code uniqueness includes
retired records. Do not add GST/PAN/CIN/invoice fields.

### 3.3 Construction and SKU masters

| Table | Purpose and essential fields |
|---|---|
| `constructions` | global identity, permanent code when published, name, proposal/publication status |
| `construction_versions` | immutable technical definition, version number, proposer/approver/effective dates |
| `plant_construction_adoptions` | plant + exact Construction version + adoption status/history |
| `skus` | plant FK, Customer Party FK, optional permanent Plant Item Code, status, replacement SKU FK |
| `sku_versions` | immutable customer-facing/spec version, exact Construction-version FK, price-driving classification |
| `sku_external_references` | Customer Item Code and aliases |
| `sku_location_applicabilities` | SKU + Customer Location + proposal/publication/status history |

Do not place Waste/Conversion on Construction. SKU uniqueness is identity/code based, not a unique
technical-spec constraint. Similar technical specifications warn but do not block. Proposed records
use stable internal IDs without placeholder business codes.

### 3.4 Versioned commercial masters

Use explicit master/version tables rather than one untyped JSON master bucket. Candidate families:

| Record family | Required version facts |
|---|---|
| Sectors | sector identity plus immutable default versions |
| Rates | plant-owned rate-set identity and immutable entries/versions |
| Freight | plant-owned matrix/set identity, immutable route/rate entries and versions |
| Calculation Defaults | immutable defaults including Payment-Terms→Interest map and independent 0.5% fallback |
| Pricing Basis Releases | plant, effective dates, status, default designation, proposer/approver, immutable component-version links |

Suggested table set: `sectors`, `sector_versions`, `rate_sets`, `rate_set_versions`, `rate_entries`,
`freight_sets`, `freight_set_versions`, `freight_entries`, `calculation_default_versions`,
`payment_interest_map_entries`, `pricing_basis_releases`, `pricing_basis_components`.

All Release components must already be approved. Enforce only one automatic default per plant/date.
Because effective periods may overlap for alternatives, do not impose a blanket no-overlap rule;
enforce uniqueness of the default calendar coverage. SR DEV must propose the exact exclusion/index or
transactional validation mechanism for review.

### 3.5 Batch workspace

| Table | Purpose and essential fields |
|---|---|
| `batches` | reference, Family, plant, status, owner, content version, price-validity input, timestamps |
| `batch_collaborators` | Batch + Maker access |
| `batch_profile_versions` | immutable profile history or append-only change versions; one current pointer |
| `pricing_groups` | Batch, label, freight mode/basis/value/source, Payment Terms, Interest override, status/version |
| `delivery_groups` | Pricing Group, label, Bill-to Location, Ship-to Location, descriptive route data, status/version |
| `batch_rows` | stable lineage, Batch, SKU, SKU version, Pricing Group, row type/status, overrides, content version |
| `batch_sets` | Batch, Box row, mandatory SET Code, active/dissolved status |
| `batch_set_memberships` | SET + component row + role/status/history |
| `batch_calculations` | replaceable working calculation with fingerprints, effective inputs/results and engine version |
| `batch_edit_locks` | one lock per Batch, holder, heartbeat, acquired/reclaimed timestamps; no Batch content-token mutation |

Constraints/checks:

- Batch has exactly one Family and plant.
- SKU plant equals Batch plant.
- At row addition, SKU Customer has current membership in Batch Family.
- Pricing/Delivery Group and row belong to same Batch.
- Active SET has one Box and at least one component; standalone Box has no active SET.
- SET Code is mandatory and unique on `(batch_id, upper(btrim(set_code)))`, including dissolved SETs.
- Freight mode check: `master`, `manual`, `ex_factory`; explicit zero legal only as resolved value,
  unresolved basis blocks calculate/send.
- Blank inheritance is SQL `null`, never empty string. Import/API adapters normalise legacy empty
  strings before domain validation; zero remains zero.
- Every mutable record uses an integer content version (or equivalent compare-and-swap token).

### 3.6 Quote, revision and immutable snapshots

| Table | Purpose and essential fields |
|---|---|
| `quote_families` | Batch relationship, optional permanent Quote Reference until first approval, status |
| `quote_revisions` | family, revision number, source revision, workflow status, standing, frozen addressee/validity |
| `quote_items` | immutable identity, revision, direct Batch-row lineage, Pricing Group context |
| `quote_item_delivery_groups` | immutable applicability to every same-priced Delivery Group |
| `calculation_snapshots` | schema version, exact entered/effective inputs, results, sources, master versions, engine/rounding version |
| `quote_workflow_events` | submit, return, approve, withdraw, issue, void, supersede, archive events |
| `customer_outcome_events` | append-only Awaiting/Accepted/Rejected/Expired history and optional acceptance context |
| `export_events` | revision, template/version, draft/official, mismatch acknowledgement, representative choices |
| `export_parts` | workbook/sheet/file parts belonging to one export event |

There is no update path for `quote_items` or `calculation_snapshots`. Correction creates another
revision/snapshot. Re-export reads stored data. Mixed engine versions are supported per item and must
be exposed. Quote Reference allocation and revision allocation are atomic; gaps/voids are never
reused.

### 3.7 Audit and workflow infrastructure

| Table | Purpose |
|---|---|
| `audit_events` | append-only actor, time, action, entity identity, material before/after, optional/required reason |
| `reference_sequences` | atomic plant/FY and Family-scoped counters; retired scope counters retained |
| `master_change_requests` | proposal/review/publication workflow where a typed master table alone is insufficient |

Audit is not a substitute for typed history/version tables. Store only the material before/after
needed for accountability; do not duplicate every immutable snapshot into audit JSON.

---

## 4. Calculation authority and resolver work

### 4.1 One resolver

Create one pure, testable authority resolver used by Batch Entry calculation, Send and Costing
display. Batch Entry remains the sole caller authorised to create formal calculations. The resolver
returns both effective value and source/version for every inherited field.

### 4.2 Required chains

- Waste/Conversion: row → Batch Profile → Sector → system fallback.
- Margin: row → Batch Box/PP → Sector → system fallback.
- Freight: row → Pricing Group → approved Freight Master → unresolved/block.
- Interest: Pricing Group override → versioned Payment Terms mapping → versioned 0.5% fallback.

The structured Payment Terms map is a closed list: 30 days→0.5%, 45 days→0.75%, 60 days→1.0% and
90 days→1.5%. Other wording is descriptive only and does not calculate. A map miss resolves to the
versioned 0.5% fallback, never to 1.5%.

Sector versions carry an approved default target Margin. It is an overridable starting tier for the
Sector's normal market and process economics: Batch Box/PP defaults may override it for the customer
opportunity, and individual rows may exceptionally override the Batch.

Resolve blank/null before the engine. Never use truthiness for numeric fallback. `0` must survive.
The existing unreachable 1.5% engine default must be removed/reconciled under an explicitly approved
engine-change commit.

### 4.3 Materialisation removal

Sector selection, Payment Terms selection and clearing a field must not write inherited values into
override columns. Remove the five known authoring/materialisation sites only in the approved D-25
calculation slice, with before/after golden values.

### 4.4 Fingerprints

Maintain separate deterministic fingerprints/versions:

- calculation fingerprint: calculation-bearing inputs, relationships, versions and structural
  choices;
- presentation fingerprint: names, displayed routes, addressee/address and descriptive terms.

Unknown fields default to calculation-relevant until classified. Send stores both. Pricing changes
stale calculations; presentation-only changes require fresh Send without Calculate.

---

## 5. Workflow transaction boundaries

Implement these as short atomic transactions/RPCs with current-state, version and capability checks:

1. Create Batch and allocate Batch Reference.
2. Calculate/Calculate All publication into replaceable working calculations.
3. Atomic Send: validate every active row, freeze candidate Items/snapshots, update fingerprints.
4. Submit, Checker Return, Approve/allocate Quote Reference+revision, Withdraw, Issue/Supersede.
5. Create Revision from latest/current source only.
6. Void and create corrective revision.
7. Record customer outcome event.
8. Publish/withdraw/correct master versions and Pricing Basis Releases.
9. Acquire/heartbeat/reclaim/take over Batch editing lock.
10. Allocate permanent Family/Customer/Location/Construction/Plant Item references.

Lock rows in a consistent identity order for multi-row operations. Do not make external network/file
calls while holding a database transaction.

---

## 6. Supabase Auth, RLS and privileged access

### 6.1 Architectural prerequisite

The current backend’s service-role client bypasses RLS. Before any access-boundary claim is accepted,
normal reads/writes must use the caller’s access token/database context. Writing policies without
changing this path is not delivery.

### 6.2 Policy rules

- `anon`: no business-table access.
- `authenticated`: access only through explicit group/plant grants and capabilities.
- Customer/Location/Construction read: explicit group or applicable plant grant.
- SKU/Pricing Basis/Batch/Quote read: relevant plant grant plus record-state rules.
- Working Batch write: owner/collaborator/Checker/Admin capability plus workflow and active-lock rule.
- Issued Quote Item/snapshot: select only; no update/delete policy.
- Master write/publication: exact capability and plant/group scope.
- Audit/outcome/workflow insert: through validated workflow operations; no client update/delete.

Use `TO authenticated` plus indexed predicates; `TO authenticated` alone is not authorisation.
UPDATE policies require SELECT plus both `USING` and `WITH CHECK`. Do not use user-editable metadata
for authorisation. If JWT/app metadata accelerates checks, the database grant tables remain authority
and token-staleness behaviour must be documented/tested.

### 6.3 Privileged allow-list

Service-role or tightly scoped private `security definer` operations are allowed only for:

- authentication/profile bootstrap where caller policy cannot yet run;
- Admin user invitation/session administration;
- safe atomic reference allocation if it cannot be performed as caller.

Any privileged function lives outside exposed schemas, sets an empty/safe search path, validates
`auth.uid()` and capability explicitly, revokes execute from `public/anon/authenticated` unless
specifically required, and has dedicated negative tests.

### 6.4 Session deactivation

Deactivation must revoke/sign out sessions where supported; deleting or disabling a profile row is
not assumed to invalidate existing JWTs. Sensitive workflow operations re-check active user/grants.

---

## 7. Migration and seed programme

### Stage M0 — Discovery, no writes

- Identify current Supabase workflow: declarative schemas versus imperative migrations.
- Inventory existing schemas, RLS, grants, functions, triggers, views and extensions.
- Verify current CLI/tool versions and current Supabase documentation/changelog before implementation.
- Derive numeric precision/scale and snapshot schema from current engine/workbooks.
- Produce source-to-target maps for Sector and Google Sheets Customer/SKU data.

### Stage M1 — Disposable pre-cutover reset

- Export/retain Product Owner backups outside the migration.
- Reset trial Customer/SKU/Construction/Batch/Quote data only after explicit approval of exact scope.
- Seed Avadhoot Group, three Plants, initial Admin user/capabilities and optional Sectors.
- Load reviewed Family → Party → Location mapping.
- Load each unique Plant Item Code as its own SKU candidate, including Box/Plate/Partition SKUs.
- Seed reviewed/deduplicated Construction candidates.
- Drop/not-map manufactured blanks, absent properties, inert legacy override keys and Construction
  Waste/Conversion.

### Stage M2 — Formal Data Cutover

- Product Owner records cutover explicitly.
- Disable reset/reload path and all browser-local formal persistence.
- Make spreadsheet imports proposal-only.
- Verify reference sequences and immutable-history protections.
- Take a recovery snapshot/backup and rehearse compatible application rollback.

No destructive post-cutover rollback. Corrections use forward migrations and new versions/events.

---

## 8. Export compatibility work

- Model export template/version capability declarations.
- Record every draft/official export event and part.
- Preserve template originally used; allow later compatible rendering while recording it.
- Implement scenario detection and recommended template selection.
- Permit incompatible official export only after explicit acknowledgement.
- Require deliberate representative value for legacy single-value fields; never choose first item.
- Until corrected templates exist, include visible item-level Reconciliation Notes.
- Test D-18/D-27, multiple Pricing Groups, multi-destination one-price, row freight override,
  external Bill-to/Ship-to, mixed engine versions, blank validity and Proposed master records.

The intended endpoint is compatible templates without Reconciliation Notes. Notes are a controlled
discovery mechanism, not the target experience.

---

## 9. Verification requirements

### 9.1 Database tests

- Every FK and uniqueness/check constraint, including negative cases.
- Family membership single-current rule.
- Plant/SKU/Batch relationship checks.
- default Pricing Basis plant/date uniqueness with alternatives allowed.
- whole-Batch normalised SET Code uniqueness, dissolved reservation and mandatory code.
- immutable Quote Items/snapshots and append-only events.
- atomic reference/revision allocation under concurrency.
- content compare-and-swap conflict failure.
- 15-minute lock heartbeat/reclaim using server time and concurrent contenders.

### 9.2 RLS matrix tests

For every table/action, test unauthenticated, wrong-plant Maker, owner Maker, collaborator, Checker,
Admin, multi-plant user, deactivated user and privileged operation. Include IDOR attempts using known
IDs and cross-Family external route references. Test the running backend path, not only direct SQL.

### 9.3 Calculation golden tests

- Execute actual `calcBatchRow` and atomic Send paths.
- Blank/zero/value across all five inheritable fields.
- Sector/Batch/row authority changes.
- Payment Terms map, explicit Interest override and independent fallback.
- master/manual/ex-factory/unresolved freight.
- smallest affected unit and Pricing Group invalidation.
- current-engine Amend with preserved Pricing Basis and mixed-engine revision.
- historical view/re-export never recalculates.

### 9.4 Existing gates

Run every standing gate from `session-start.md` on every approved commit. Add new focused database,
RLS, CalcGate and migration tests before claiming the corresponding slice complete. UI verification
remains Product Owner-led.

Before release, run Supabase database/security/performance advisors using the then-current supported
tooling and resolve or explicitly disposition findings.

---

## 10. Proposed approval-gated delivery slices

Each slice requires an SR DEV proposal, Product Owner approval, implementation, verification and
separate commit. Exact commit count may be refined before Slice 1, but concerns must not be collapsed
to make review harder.

1. **S0 — Tooling and current-state audit:** Supabase workflow, live schema/policy inventory, no data change.
2. **S1 — Foundation identities:** Group, Plants, users, grants, capabilities, settings and RLS harness.
3. **S2 — Caller-context security:** replace normal service-role path; prove RLS through backend tests.
4. **S3 — Customer/Prospect hierarchy:** Families, Parties, Locations, codes, history and proposals.
5. **S4 — Construction/SKU masters:** versions, adoption, proposals, applicability and lifecycle.
6. **S5 — Versioned commercial masters and Pricing Basis Releases.**
7. **S6 — Batch core:** profile, groups, rows, SET identity, ownership, collaborators, locks and concurrency.
8. **S7 — D-25/Interest authority resolver:** one CalcGate resolver, no materialisation, golden tests.
9. **S8 — Freight authority and calculation/presentation divergence.**
10. **S9 — Quote family/revisions:** PM-7, immutable Item/snapshot, approval/issue/outcome lifecycle.
11. **S10 — Workbook/export compatibility and audit.**
12. **S11 — Pre-cutover reset and controlled master seed rehearsal.**
13. **S12 — Product Owner real-scenario validation and Formal Data Cutover readiness review.**
14. **S13 — Pilot enablement, monitoring and rollback rehearsal.**

Do not declare Formal Data Cutover inside an implementation commit. It is a separate Product Owner
event after S12 evidence is reviewed.

---

## 11. Rollback and compatibility

- Prefer additive/backward-compatible schema stages: introduce, dual-read only where explicitly
  necessary, switch authority, then remove obsolete paths in a later approved slice.
- Never dual-write browser-local and Supabase formal records after cutover.
- Application rollback target must remain compatible with the current schema for the defined window.
- Post-cutover migration rollback never deletes formal history; forward-fix or deactivate.
- Feature enablement is plant/user gated, but feature flags are not an access-control substitute.
- Every slice documents forward migration, compatibility window, application rollback action and
  data recovery consequence before approval.

---

## 12. Required SR DEV proposal before implementation

SR DEV must return a design revision containing:

1. exact table/column/type/constraint/index definitions;
2. relationship diagram and ownership/deletion actions;
3. exact RLS policy matrix and caller-context backend design;
4. privileged-operation allow-list and function security review;
5. snapshot JSON/typed-column boundary and schema-version plan;
6. calculation/presentation fingerprint field classification;
7. migration source-to-target mapping and destructive pre-cutover reset list;
8. test plan mapped to every constraint, policy and commercial authority chain;
9. per-slice rollback/compatibility plan;
10. proposed commit sequence and proof gates.

The Product Owner approves that proposal before S1. This brief does not authorise implementation.

---

## 13. Explicit non-goals

No Commercial Intelligence, realised margin, route-profitability, risk-premium engine, order
management, tax/invoice model, colour-count pricing, live Sheets synchronisation, simultaneous Batch
editing, final workbook redesign or migration of disposable trial history.
