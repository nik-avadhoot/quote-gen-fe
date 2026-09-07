# U1 — Customers, Prospects and Customer Locations: implementation packet

**Date:** 2026-09-07. **Status: planning only. No migration, Flask route or frontend action is
implemented by this document.** Requested after the Customer Family mutation slice's closure
(U1-CF-C1…C5), per the explicit instruction not to move to U2 while these U1 acceptance components
remain outstanding: (1) broader Customers and Prospects, (2) Customer Locations, (3) integration of
the minimal Prospect and a usable Location flow with Batch Entry.

This packet follows the same discipline as the closed slice: current state read from the catalog, not
assumed; every mutation CAS-protected and atomic where it touches more than one row; nothing decided
here that the evidence does not support. One genuine open question is raised in §5 rather than
resolved unilaterally, per the standing instruction to pause only where alternatives materially change
the data model.

---

## 0. Scope — what already exists, what is a real gap

| Area | Governed today | Gap |
|---|---|---|
| Read Parties/Families/memberships | `GET /masters/customer-families` (U1, closed slice) | None — already returns `parties` with `customer_code`, `lifecycle_state`, `status`. Does **not** return `customer_locations` at all — no route touches that table. |
| Propose a Party (Prospect) | `create_minimal_prospect` (U1-CF, closed slice) | None for the *minimal* path. No governed path exists for editing an existing Party's fields, nor for any lifecycle transition other than `graduate_party` (prospect→customer) and the untested `merge_parties`. |
| Edit a Party (`display_name`, etc.) | **Nothing.** RLS `parties_update` policy exists (`manage_customer_master`) but no `app_private` function, no CAS, no route. | **Real.** A direct `UPDATE` would repeat the exact mistake the closed slice's binding decision ruled out for Family B. |
| Deactivate / reactivate a Party | **Nothing.** `ck_party_status` allows `inactive` as a value; no function sets it. | **Real, but not requested in this packet's scope** — no canonical rule was found describing when/why a Party moves to `inactive` (as opposed to `merged`, which `merge_parties` already governs). Not designed here; see §5. |
| Merge two Parties | `app_private.merge_parties(p_survivor, p_merged)` exists, `SECURITY DEFINER`, checks `manage_customer_master` | **Real, and structurally the same defect class U1-CF just closed for Families**: **no CAS parameters at all** — not even the mandatory-but-later-added kind Family B started with, literally nothing. No public wrapper exists either, so it is currently unreachable — the gap is real but *dormant*. Not proposed for this packet (§5 open question 2). |
| Customer Locations — read | **Nothing.** No route selects `customer_locations`. | **Real.** |
| Customer Locations — propose/edit/approve/retire | **Nothing.** RLS policies exist (`customer_locations_insert` permits a Maker with `make_quote` to propose; `_select`/`_update` require the respective group capabilities) but no `app_private` function, no CAS on `content_version` despite the column existing, no route. | **Real.** |
| Location Code allocation | `app_private.assign_location_code(p_location)` exists, `SECURITY DEFINER`, mints `{customer_code}-{seq:02d}` via `ref_private.allocate_reference('location', party_id, null)`, **idempotent** (returns the existing code unchanged on a repeat call, same short-circuit as `graduate_party` — no CAS needed by the same reasoning) | **Real, dormant** — no public wrapper, unreachable today. |
| Batch Entry ↔ Customer Family/Party/Location | **Nothing connects them.** See §4 — this is not a small wiring gap, it is a genuine fork requiring a decision. | **Real**, and the shape of the fix is the open question in §4/§5. |

## 1. Schema, read directly from the catalog

**`parties`** — `id, customer_code (unique, nullable), display_name, lifecycle_state
('prospect'|'customer'), status ('proposed'|'active'|'merged'|'inactive'), surviving_party_id (self-FK,
`on delete restrict`), content_version, created_at, created_by`. Constraints: `ck_party_customer_has_code`
(a `customer` must carry a `customer_code`), `ck_party_merged_has_survivor` (a `merged` Party must name
its survivor), `uk_party_id_state` (supports composite FKs elsewhere, same pattern as
`customer_families`).

**`customer_locations`** — `id, party_id (FK parties, restrict), location_code (unique, nullable),
bill_to_eligible, ship_to_eligible (both boolean, default false), status
('proposed'|'active'|'inactive'), content_version, created_at, created_by`. Constraint
`ck_loc_eligible`: `bill_to_eligible OR ship_to_eligible` — every Location must declare a commercial
purpose, already enforced structurally (confirmed in `data-model-s7-closure-evidence.md` §9.3, decision
8: "closed, no work" — this constraint is the whole of that decision, nothing further to design).
`uk_loc_id_party` supports the same composite-FK pattern.

**`customer_location_versions`** — `id, location_id (FK), version_no, location_type, address_text,
contact_name, notes, status ('current'|superseded, by analogy with other `*_versions` tables in this
schema — not directly confirmed, see §5), created_at, created_by`. This is the versioned-detail table
(address/contact/notes change over time; `customer_locations` itself carries only the permanent
identity + eligibility flags + code). **No function anywhere creates a version row** — `customer_
location_versions` is currently unreachable in both directions (no INSERT policy allows a bare RLS
write either, confirmed: only `customer_location_versions_insert`/`_select`/`_update` policies exist,
gated by capability, but nothing has ever inserted through them). Proposing a Location's *first*
version is therefore part of what a governed `propose_customer_location` operation must do atomically,
mirroring how `propose_customer_family` mints the code in the same statement that inserts the row.

**`party_external_references`** — `id, party_id, ref_kind, ref_value, created_at, created_by`. Read-
only in this packet's scope; `merge_parties` already migrates these rows to the survivor. No evidence
found of what `ref_kind` values are canonical (GST/PAN/legacy ERP code are plausible but not
confirmed) — not designed here.

## 2. Proposed governed operations (Party)

Following the identical CAS/atomicity discipline the closed slice established — every function that
mutates an existing row takes a **required** `p_expected_content_version`:

| Function | Capability | CAS | Notes |
|---|---|---|---|
| `update_party(p_party, p_expected_content_version, p_display_name)` | `manage_customer_master` | **required** | Renames a Party. Mirrors `update_customer_family` exactly. |
| `graduate_party(p_party)` | *(unchanged, already governed)* | n/a (idempotent) | No change proposed. |

Deactivation/reactivation and `merge_parties`'s CAS gap are **not** proposed for this packet — see §5,
open questions 1 and 2. Scoping `update_party` to `display_name` only mirrors the closed slice's own
"permitted Family fields" framing (binding decision 9) rather than inventing a broader edit surface
this packet has no canonical citation for.

## 3. Proposed governed operations (Customer Location)

Mirrors the Family propose/approve/edit/retire shape exactly, since the schema (`content_version`,
`status` with a `proposed` state) is structurally identical:

| Function | Capability | CAS | Notes |
|---|---|---|---|
| `propose_customer_location(p_party, p_location_type, p_address_text, p_contact_name, p_notes, p_bill_to_eligible, p_ship_to_eligible)` | `manage_customer_master` **or** `make_quote` at any active plant (mirrors `customer_locations_insert`'s existing RLS OR-condition exactly, not narrower) | n/a (insert) | Atomic: locks the Party (refuses if not found — `P0002`), inserts `customer_locations` (`status='proposed'`), inserts the first `customer_location_versions` row (`version_no=1`), all in one function body. Refuses `not (p_bill_to_eligible or p_ship_to_eligible)` before touching the database — `22023` — matching `ck_loc_eligible` at the application layer too (same "genuinely useful client-side hint, DB stays authoritative" pattern as `reassign_party_family`'s effective-date check). |
| `update_customer_location(p_location, p_expected_content_version, p_address_text, p_contact_name, p_notes)` | `manage_customer_master` | **required** | Inserts a **new** `customer_location_versions` row (`version_no + 1`) rather than mutating the existing one — versions are historical, matching the `batch_profile_versions` append-only precedent (S6-13) and the table's own name. Bumps `customer_locations.content_version`. Does **not** touch `bill_to_eligible`/`ship_to_eligible`/`location_type` — those describe the Location's identity, not a revisable detail; changing eligibility is arguably a different operation (see §5, open question 3). |
| `approve_customer_location(p_location, p_expected_content_version)` | `manage_customer_master` | **required** | `proposed → active` only, refuses any other current status (`22023`) — mirrors `approve_customer_family`. |
| `retire_customer_location(p_location, p_expected_content_version)` | `manage_customer_master` | **required** | `active → inactive`. Refuses retiring an already-`inactive` or still-`proposed` Location (`22023`) — mirrors `retire_family_alias`'s double-retirement guard. |
| `assign_customer_location_code(p_location)` | *(unchanged, already governed — `assign_location_code`)* | n/a (idempotent) | Needs only a `public` wrapper; no `app_private` change. Renamed at the public layer for the same clarity reason `graduate_party` became `graduate_customer_party`. **Open question:** should this be called automatically by `approve_customer_location` (mirroring `propose_customer_family`'s allocate-at-creation timing), or explicitly by a separate action, mirroring how `graduate_party` is its own step after a Family already has a code? The Family Code precedent (§12.4: allocated at *creation*) does not obviously transfer here — a Location's code is scoped beneath the Party's `customer_code`, which does not exist until graduation, so a Location proposed against a still-Prospect Party literally cannot have a code yet (`assign_location_code` already refuses with `P0002` — "party is not graduated"). Recommendation: **do not auto-call it from approve** — leave it a distinct, explicit action available once the Party is a Customer, consistent with the function's own existing refusal behaviour. Not a business-model fork, so not escalated to §5. |

## 4. Batch Entry integration — the actual shape of the gap

**Read from the code, not assumed** (frontend research this session): Batch Entry today has **no
FK-based connection to any Customer/Prospect entity at all**. The Batch Profile carries a free-text
`client` string (matched loosely against Construction Library client names for autocomplete only,
`state/useBatchState.js`) and a free-text `delivery` string drawn from a flat `locations` master list
in `localStorage` (`data/defaults.js` → `state/useMastersState.js`), used purely to key into the
plant×location freight-rate matrix (`engine/costing.js`). Per `CLAUDE.md`, this is consistent with the
documented state of the system: **all quote/Batch state still lives in `localStorage`** — the backend's
own Batch workspace (Family F / S6: `batches`, `delivery_groups`, `pricing_groups`, etc., which *does*
already carry a real `family_id` and `ship_to_location_id`/`bill_to_location_id`) is fully governed and
tested at the database layer but is **never called from the frontend at all** — confirmed: no route in
`server.py` and no state hook in `quote-gen-fe/src` references `create_batch` or `family_id`.

This means "integration... with Batch Entry" cannot mean "wire the FK" without first reckoning with the
fact that Batch Entry is not connected to the backend's Batch tables in any way yet — that is a
substantially larger undertaking (moving the Batch workflow off `localStorage` onto the governed
`batches`/`delivery_groups` schema) than anything else in this packet, and it is arguably **U4 —
Durable Batch Workspace** by the canonical sequence you gave, not U1. See §5, open question 4 for the
two honest alternatives and a recommendation.

## 5. Open questions — genuine forks, not decided here

**1. Party deactivation/reactivation.** `ck_party_status` allows `inactive`, but no canonical source
found describing the rule (who may deactivate a Customer, what happens to its current Family
membership/Locations/SKUs when it does, whether it differs from a `merged` Party). Not designed in this
packet. **Recommendation:** defer until a canonical rule is cited, same discipline as the closed
slice's Family Code timing question — do not invent a lifecycle rule from UI intuition.

**2. `merge_parties`'s CAS gap.** Structurally identical to the exact defect class the binding decision
closed for `merge_families` (dual-sided CAS) — but `merge_parties` additionally has implications this
packet has not investigated (what happens to the merged Party's `customer_locations`,
`party_family_memberships`, and any `skus.party_id` references — `merge_families` only ever touched
Family-level rows, `merge_parties` would touch Party-level rows other tables FK against directly).
**Recommendation:** treat Party merge as its own future packet, not a line item folded into this one —
the blast radius is different enough to deserve its own review, not an assumption that the Family
pattern transfers unchanged.

**3. Location eligibility changes (`bill_to_eligible`/`ship_to_eligible`) after proposal.** §3's
`update_customer_location` deliberately excludes these two columns. Is changing a Location from
ship-to-only to also bill-to-eligible (or the reverse) an edit, or does it require retiring the old
Location and proposing a new one (preserving `ck_loc_eligible`'s "never neither" invariant at every
point in history, the same lineage-preservation spirit as Family merge)? **Recommendation:** treat as
out of scope until asked for — no batch/quote workflow in this packet's read of the code currently
depends on changing eligibility after the fact.

**4. Batch Entry integration depth — the one fork that changes the data model.**

| Alternative | What it means | Consequence |
|---|---|---|
| **(a) Light integration (recommended)** | Add a "+ New Prospect" / "+ New Location" quick-create action reachable from Batch Entry's existing `client`/`delivery` fields, calling the **already-governed** `create_minimal_prospect` and the **newly-governed** `propose_customer_location` (§§2–3), and populate the free-text fields with the resulting `display_name`/a location label. No FK, no `party_id` column added to Batch state, no change to `localStorage`-based Batch Entry, no call to `create_batch`/backend Batch tables. | Small, U1-sized, ships independently of any Batch Workspace migration. The free-text fields remain free-text — this closes the *authoring* gap (a Maker can mint a real governed Prospect/Location without leaving Batch Entry) but not a *referential* one (the Batch itself still doesn't know it's pointing at a real Party/Location row). |
| **(b) Deep integration** | Give Batch state a real `party_id`/`location_id`, replacing the free-text `client`/`delivery` fields, and wire Batch Entry to call the backend's existing `create_batch`/`delivery_groups` RPCs instead of `localStorage`. | This is the `localStorage`→Supabase migration for the entire Batch/Quote workflow — a materially larger, higher-risk change than anything in either U1 slice so far, and duplicates work that belongs to **U4 — Durable Batch Workspace** by your own canonical sequence. Undertaking it here would be exactly the kind of premature scope-jump U1-CF-C3 just flagged in the opposite direction (naming U2 work as "next" while U1 was still open) — this would be the mirror error, naming U4 work as U1. |

**Recommendation: (a).** It delivers everything the three-item scope literally asked for — a usable
Prospect-and-Location flow reachable from Batch Entry — without silently absorbing U4's actual scope
into a U1 slice. If (b) is genuinely wanted now, it should be authorised explicitly as pulling U4
forward, not folded into this packet under the "Batch Entry integration" heading.

## 6. Flask routes (proposed, once §5's open questions are ruled on)

Same shape as the closed slice's ten routes — thin caller-context forwarders, `{error_code, error}`
mapping per the corrected §6 discipline (U1-CF-C2), no service-role client, no duplicated capability
check:

- `PATCH /masters/parties/<id>` — Body `{expected_content_version, display_name}`.
- `POST /masters/parties/<id>/locations` — propose. Body `{location_type?, address_text?,
  contact_name?, notes?, bill_to_eligible, ship_to_eligible}`.
- `PATCH /masters/customer-locations/<id>` — edit (new version). Body `{expected_content_version,
  address_text?, contact_name?, notes?}`.
- `POST /masters/customer-locations/<id>/approve` — Body `{expected_content_version}`.
- `POST /masters/customer-locations/<id>/retire` — Body `{expected_content_version}`.
- `POST /masters/customer-locations/<id>/assign-code` — Body `{}`.
- (§4-a) `POST /masters/customer-families/prospects` already exists and is reused unchanged — the
  Batch Entry quick-create action calls it, then chains `POST /masters/parties/<id>/locations`, as two
  requests (never composed into one, per binding decision on atomicity — each RPC is already atomic on
  its own; sequencing two independent atomic operations client-side is not the same as composing them
  into one transaction, and is exactly how the existing screen already sequences propose-then-approve).

`GET /masters/customer-families` should be extended to also return `customer_locations` (a fifth array
in the response, same shape as `families`/`aliases`/`memberships`/`parties`) — additive, no RLS change,
gated by the same `read_party_master` check already in place.

## 7. Proof obligations (proposed shape, mirroring the closed slice)

Database: unauthenticated/no-capability/wrong-plant/inactive refusal per new function; CAS stale-
version refusal for every function with CAS; `propose_customer_location`'s `ck_loc_eligible` refusal
both client-side (Flask 400) and DB-side (`22023`); atomic rollback if the version-1 insert fails after
the location row is created; `approve`/`retire` forbidden-transition refusals; `assign_location_code`'s
existing `P0002` (not graduated) and idempotent-repeat-call behaviour, now exercised through its new
public wrapper. Route: same hermetic fake-client pattern, same leak-proof error-mapping assertions
U1-CF-C2 established. HTTP probe matrix: one row per newly exposed public RPC, anon **and**
`service_role` both refused, per the U1-CF-C1 discipline from the start this time — not added after
review. Frontend: fixture-script coverage for the Batch Entry quick-create action's confirm copy and
request-body shape, same convention as `customer-family-actions-fixtures.mjs`.

---

**Not implemented.** This is the design for review. Once §5's four open questions are ruled on
(deactivation deferred, Party merge deferred, eligibility-change deferred, and Batch Entry integration
depth decided — (a) recommended), the next authorised session turns §§2–3 and §6 into one migration,
one Flask commit and one frontend commit, gated exactly like every action in the closed slice, followed
by G-A (G-B only if warranted by the same carve-out U1-CF-C5 established: not required for a
Party/Location-only addition unless it touches a structural workflow function, which none of §§2–3 do).
