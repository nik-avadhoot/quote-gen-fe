# U1 — Customer Foundation: implementation-ready authorisation packet

**Date:** 2026-09-07. **Revised twice same day** after Product Owner review — round 1 removed the
`merge_parties` dependent-handling decision and the Batch-integration link machinery; round 2 (this
revision) narrows Slice C's eligibility design further still. Change registers for both rounds were
returned in-conversation, not as separate files — no separate register file exists or is cited here.
**Status: planning only. No migration, Flask route or frontend action is implemented by this document.**
Supersedes the planning-level `u1-customers-prospects-locations-packet.md` for everything it left as an
open question — that packet's schema-reading (§1) and its Batch Entry analysis (§4) are reused and
cited below where they still hold; where live catalog evidence sharpened or corrected them, this
document says so explicitly.

**Authority chain.** `data-model-decisions.md` (CDM-06/07/08/34) is canonical. This packet also carries
forward the binding decisions from `u1-customer-family-mutations-packet.md` (mandatory CAS with no
optional/default parameter, atomic multi-row operations as one function body, no raw Postgres exception
text to the client, explicit `service_role` revoke on every new wrapper from the start, one migration
== one `apply_migration` call, G-B required when a structural workflow function is added or changed) —
those rules are not re-derived here, they are simply applied.

**Evidence method.** Every schema/function/policy claim below was read directly from the live Supabase
catalog this session (`information_schema.columns`, `pg_constraint`, `pg_indexes`, `pg_policies`,
`pg_get_functiondef`) — not assumed, not carried over from the original design proposal, which has
already diverged from what was actually built in several confirmed respects (see Slice C).

**Zero live data.** `parties`, `customer_locations` and `skus` all currently hold **0 rows**.

**What `merge_parties` is NOT in this revision.** The first draft included a `merge_parties` CAS
correction as a slice in this sequence, and decided — inside the same function — how three FK
dependents (`customer_locations.party_id`, `skus.party_id`, `party_family_memberships`) should be
migrated. Review found the dependent-handling decisions premature: one conflicts with an unbuilt
canonical mechanism (CDM-07 Location reassignment), one answers a U2 question from inside a U1
correction (SKU ownership), and one was simply wrong (historical closure of the merged Party's Family
membership). **`merge_parties` is out of this packet.** It stays exactly as it is today — dormant,
CAS-less, unreachable, zero call sites — and is not touched, exposed, or changed by anything below. The
dependents and their available choices are enumerated, unresolved, in a separate document:
[`u1-party-merge-decision-packet.md`](u1-party-merge-decision-packet.md). Nothing in this packet is
blocked on that document — see §0's dependency graph.

---

## 0. Scope table and dependency graph

| Slice | Title | New schema | New `app_private` fns | New public wrappers | New routes | Depends on |
|---|---|---|---|---|---|---|
| A | Party editing and Customer/Prospect detail | none | 1 (`update_party`) | 1 | 1 | — |
| C | Customer Location proposal/version/approval/retirement (initial eligibility only — see §"Eligibility" below) | none | 4 | 5 | 5 | — |
| D | Batch Entry light integration | none (no new localStorage fields at all) | none | none | none (reuses C's route) | **C only** |
| E | End-to-end acceptance flow | none | none | none | none | A, C, D |

**A and C are independent of each other and of the merge-decision packet.** Neither reads, writes, nor
depends on `merge_parties` or on anything in `u1-party-merge-decision-packet.md`. **D depends only on
C** (the quick-create/select Location action calls `propose_customer_location`; it does not call
`update_party`, so Slice A's display-name edit is not a prerequisite for D — the earlier draft's "A
before D" ordering was an unforced sequencing choice, not a real dependency, and is corrected here).
Recommended commit order, now that no ordering constraint links A and C: **A and C in either order (or
in parallel), then D, then E.**

---

## Slice A — Party editing and Customer/Prospect detail

*(Unchanged from the first draft's technical design — review raised no finding against this slice's
schema, function, route, or test design. Reproduced here for completeness of one implementation-ready
document; see the original draft or the change register for provenance.)*

### Canonical authority
CDM-06 (one identity, Prospect/Customer lifecycle), CDM-03 (editable labels are never relationship
keys). Mirrors the closed `update_customer_family` pattern exactly.

### Exact schema changes
None. `parties.content_version` (integer, default 1, not null) already exists — confirmed live.

### Function signature
```sql
create or replace function app_private.update_party(
  p_party bigint,
  p_expected_content_version integer,
  p_display_name text
) returns void
language plpgsql security definer set search_path to ''
as $function$
begin
  if not app_private.has_group_cap('manage_customer_master') then
    raise exception 'manage_customer_master required' using errcode = '42501';
  end if;
  if p_display_name is null or btrim(p_display_name) = '' then
    raise exception 'display_name is required' using errcode = '22023';
  end if;

  update public.parties
     set content_version = content_version
   where id = p_party and content_version = p_expected_content_version;
  if not found then
    perform 1 from public.parties where id = p_party;
    if not found then
      raise exception 'party not found' using errcode = 'P0002';
    end if;
    raise exception 'party changed since you read it (expected content version %) - re-read and retry',
      p_expected_content_version using errcode = '40001';
  end if;

  update public.parties
     set display_name = btrim(p_display_name), content_version = content_version + 1
   where id = p_party;
end $function$;
```
Scope deliberately mirrors the closed slice's own framing (binding decision 9, "permitted Family
fields"): `display_name` only. `customer_code`, `lifecycle_state`, `origin_family_id` and `status` are
not editable through this function.

### Mandatory CAS
Required, no default, `p_expected_content_version integer`.

### Capability and scope
`manage_customer_master`, group-scoped (matches `parties_update` RLS confirmed live).

### Public wrapper
```sql
create or replace function public.update_customer_party(
  p_party bigint, p_expected_content_version integer, p_display_name text
) returns void
language sql security invoker set search_path = ''
as $$ select app_private.update_party(p_party, p_expected_content_version, p_display_name) $$;

revoke all on function public.update_customer_party(bigint, integer, text) from public, anon, service_role;
grant execute on function public.update_customer_party(bigint, integer, text) to authenticated;
```

### Flask route
`PATCH /masters/parties/<int:party_id>` — Body `{expected_content_version, display_name}`. Reuses the
existing `_rpc_call`/`_RPC_ERROR_MAP` module — no new error code needed.

### Frontend screens and actions
Extends `CustomerFamiliesScreen.jsx`'s existing Party rows (no new screen) with an Edit action on
`display_name`, `CapabilityGate(capability="manage_customer_master")`, same confirm/`classifyResponse`
flow as Family edit. New pure helpers in `lib/partyActions.js`, proven by
`scripts/party-actions-fixtures.mjs`.

**Correction from the first draft:** this slice, on its own, is display-name editing only. It does
**not** constitute "Customer/Prospect detail" as a completed requirement — see the acceptance matrix
in §"Customers/Prospects acceptance matrix" below for what is and is not closed by this slice.

### Feature flag
Reuses `u1_customer_families`.

### Negative and positive tests (`tests.party_edit_mutations()`)
Unauthenticated refused; no-capability refused; deactivated-user-holding-grant refused; blank
`display_name` refused `22023`; not-found `P0002`; stale `content_version` refused `40001`; authorised
update succeeds, `content_version` increments by exactly 1; a second call with the now-stale original
version is refused `40001`.

### HTTP probes
One row: `update_customer_party`, `anon` refused, `service_role` refused, authenticated success.

### G-A/G-B
G-A after the migration commit. G-B at the closure boundary shared with Slice C (see Slice C's own
G-B note) — folding A and C's schema changes into one destructive replay, since both land in the same
review round and neither is individually large enough to warrant its own.

### Rollback consequence
Purely additive. No data consequence.

### Dependencies / unresolved Product Owner decisions
**Party deactivation/reactivation is explicitly NOT designed or implemented in this slice.**
`ck_party_status` already permits `'inactive'`, but no function sets it and no canonical rule exists
describing: which capability may deactivate a Party; what happens to its current Family membership row;
what happens to its active Customer Locations (once Slice C exists); what happens to any SKUs that
reference it (`skus.party_id` exists, confirmed live, though SKU governance is U2); and how `'inactive'`
is distinguished from `'merged'`. Not invented here.

---

## Slice C — Customer Location proposal/version/approval/retirement

### Canonical authority
CDM-08, CDM-07 (scope carve-out below), CDM-31, your direction on proposal atomicity, no-silent-
mutation, and governed eligibility.

### Live schema, confirmed this session
```
customer_locations         id, party_id (fk parties, restrict), location_code (unique, nullable),
                            bill_to_eligible bool not null default false,
                            ship_to_eligible bool not null default false,
                            status text not null default 'proposed' check in
                              ('proposed','active','inactive'),
                            content_version int not null default 1, created_at, created_by
                            ck_loc_eligible: bill_to_eligible or ship_to_eligible

customer_location_versions id, location_id (fk, restrict), version_no int not null,
                            location_type text null check in ('plant','office','warehouse','other'),
                            address_text, contact_name, notes (all text, nullable),
                            status text not null default 'current' check in ('current','superseded'),
                            created_at, created_by
                            uk_lv_version (location_id, version_no)
                            uk_lv_one_current (location_id) WHERE status='current'  -- partial unique,
                                                                                     -- confirmed live
```

**Corrections to the original design proposal, confirmed by direct catalog read:**
1. `customer_locations` uses `party_id` (plain FK), not `current_party_id` — there is no "current"
   framing because there is no reassignment mechanism at all (see the scope carve-out below).
2. `customer_location_versions` carries **no `party_id`** — parentage reassignment is not modelled into
   the version table.
3. **No `customer_location_parent_history` table exists.** Location-to-Party reassignment has zero
   mechanism in the schema today, not merely an unbuilt governed function over an existing one.

### Scope carve-out: Location-to-Party reassignment is OUT OF SCOPE for this slice
CDM-07 promises it as a future canonical capability. Nothing in the current frontend or backend
workflow depends on it today (confirmed this session). Building it now would require inventing a new
schema mechanism for a capability nothing yet asks for. **Flagged as a citable gap against CDM-07, not
designed here** — same discipline as Party deactivation above.

### Eligibility — narrowed design, per second review round

**What round 1 still got wrong.** Round 1 replaced a bespoke history table with a plain
CAS-protected `update_location_eligibility` function and framed the remaining open question as *how*
eligibility changes are recorded (history table vs. none). Round 2 found that framing itself
incomplete: it silently assumed an approved or active Location's eligibility **may be edited in place
at all**. That is a separate, prior question — not "how is a change recorded" but "does a governed
in-place edit exist as a transition, or does changing what a Location is eligible for require a
different governed transition altogether (for instance: retire the Location and propose a new one,
preserving `ck_loc_eligible`'s 'never neither' invariant at every historical point by construction
rather than by an edit that happens to be logged)." Shipping `update_location_eligibility` answered
that prior question by fiat — building the in-place-edit transition **is** the policy decision, not a
neutral implementation of a decision already made. It is removed from this slice for that reason, not
merely because it lacked history.

**What is retained, unchanged.** Bill-to/Ship-to eligibility **is chosen at initial proposal** —
`propose_customer_location` already takes `p_bill_to_eligible`/`p_ship_to_eligible` and enforces "must
be at least one" both at the application layer (`22023`) and at the database layer
(`ck_loc_eligible`, confirmed live, unchanged). Nothing about proposal-time eligibility selection is in
question; only *post-proposal change* is blocked.

**What is removed from this slice's proposed implementation:** `update_location_eligibility`, its
public wrapper, its route, its UI action, its HTTP probes, and its mutation tests — all deleted below,
not merely deferred. No eligibility-history table is sketched, proposed, or held in reserve "for when
the policy needs it" — building that sketch would itself presuppose an in-place-edit or a specific
transition shape neither of which is decided. If a governed transition is later approved, its concrete
shape (in-place edit with or without history; retire-and-repropose; something else) is designed then,
against whatever the ruling actually says, not against a shape guessed now.

**Post-proposal eligibility change is Product Owner-blocked.** Two questions, not one, both open:
(1) is in-place editing of an approved/active Location's eligibility permitted at all, or does a
change require a new governed transition (e.g. retire + re-propose)? (2) if some form of change is
permitted, must it be historically attributable, and if so how? Question 2 cannot be answered before
question 1 — this packet answers neither.

### Function signatures

```sql
create or replace function app_private.propose_customer_location(
  p_party bigint,
  p_location_type text,
  p_address_text text,
  p_contact_name text,
  p_notes text,
  p_bill_to_eligible boolean,
  p_ship_to_eligible boolean
) returns bigint
language plpgsql security definer set search_path to ''
as $function$
declare v_location_id bigint;
begin
  if not (app_private.has_group_cap('manage_customer_master')
          or app_private.has_any_plant_cap('make_quote')) then
    raise exception 'manage_customer_master or make_quote at an active plant required' using errcode = '42501';
  end if;
  if not (p_bill_to_eligible or p_ship_to_eligible) then
    raise exception 'a Location must be Bill-to, Ship-to or both' using errcode = '22023';
  end if;
  perform 1 from public.parties where id = p_party for update;
  if not found then
    raise exception 'party not found' using errcode = 'P0002';
  end if;

  insert into public.customer_locations
    (party_id, bill_to_eligible, ship_to_eligible, status, created_by)
  values (p_party, p_bill_to_eligible, p_ship_to_eligible, 'proposed', app_private.current_app_user())
  returning id into v_location_id;

  insert into public.customer_location_versions
    (location_id, version_no, location_type, address_text, contact_name, notes, status, created_by)
  values (v_location_id, 1, p_location_type, p_address_text, p_contact_name, p_notes, 'current',
          app_private.current_app_user());

  return v_location_id;
end $function$;
```
Two inserts, one function body — matches `create_minimal_prospect`'s atomicity pattern. (Reduced from
three inserts in the first draft, since no eligibility-history table is built — see §"Eligibility"
above.)

```sql
create or replace function app_private.update_customer_location(
  p_location bigint,
  p_expected_content_version integer,
  p_address_text text,
  p_contact_name text,
  p_notes text
) returns void
language plpgsql security definer set search_path to ''
as $function$
declare v_type text; v_next_version int;
begin
  if not app_private.has_group_cap('manage_customer_master') then
    raise exception 'manage_customer_master required' using errcode = '42501';
  end if;

  update public.customer_locations set content_version = content_version
   where id = p_location and content_version = p_expected_content_version;
  if not found then
    perform 1 from public.customer_locations where id = p_location;
    if not found then
      raise exception 'location not found' using errcode = 'P0002';
    end if;
    raise exception 'location changed since you read it (expected content version %) - re-read and retry',
      p_expected_content_version using errcode = '40001';
  end if;

  select location_type, version_no + 1 into v_type, v_next_version
    from public.customer_location_versions
   where location_id = p_location and status = 'current';

  update public.customer_location_versions
     set status = 'superseded'
   where location_id = p_location and status = 'current';

  insert into public.customer_location_versions
    (location_id, version_no, location_type, address_text, contact_name, notes, status, created_by)
  values (p_location, v_next_version, v_type, p_address_text, p_contact_name, p_notes, 'current',
          app_private.current_app_user());

  update public.customer_locations
     set content_version = content_version + 1
   where id = p_location;
end $function$;
```
Excludes `bill_to_eligible`/`ship_to_eligible`/`location_type` — descriptive detail only.
`location_type` is carried forward unchanged. Eligibility has **no** edit function in this slice — see
§"Eligibility" above: no in-place eligibility-change transition is proposed, so none is implemented.

```sql
create or replace function app_private.approve_customer_location(
  p_location bigint, p_expected_content_version integer
) returns void
language plpgsql security definer set search_path to ''
as $function$
begin
  if not app_private.has_group_cap('manage_customer_master') then
    raise exception 'manage_customer_master required' using errcode = '42501';
  end if;

  update public.customer_locations set content_version = content_version
   where id = p_location and content_version = p_expected_content_version;
  if not found then
    perform 1 from public.customer_locations where id = p_location;
    if not found then raise exception 'location not found' using errcode = 'P0002'; end if;
    raise exception 'location changed since you read it (expected content version %) - re-read and retry',
      p_expected_content_version using errcode = '40001';
  end if;

  update public.customer_locations
     set status = 'active', content_version = content_version + 1
   where id = p_location and status = 'proposed';
  if not found then
    raise exception 'only a proposed location may be approved' using errcode = '22023';
  end if;
end $function$;
```

```sql
create or replace function app_private.retire_customer_location(
  p_location bigint, p_expected_content_version integer
) returns void
language plpgsql security definer set search_path to ''
as $function$
begin
  if not app_private.has_group_cap('manage_customer_master') then
    raise exception 'manage_customer_master required' using errcode = '42501';
  end if;

  update public.customer_locations set content_version = content_version
   where id = p_location and content_version = p_expected_content_version;
  if not found then
    perform 1 from public.customer_locations where id = p_location;
    if not found then raise exception 'location not found' using errcode = 'P0002'; end if;
    raise exception 'location changed since you read it (expected content version %) - re-read and retry',
      p_expected_content_version using errcode = '40001';
  end if;

  update public.customer_locations
     set status = 'inactive', content_version = content_version + 1
   where id = p_location and status = 'active';
  if not found then
    raise exception 'only an active location may be retired' using errcode = '22023';
  end if;
end $function$;
```

`assign_location_code` — **unchanged, already governed**, confirmed live, idempotent. Needs only a
public wrapper:
```sql
create or replace function public.assign_customer_location_code(p_location bigint) returns text
language sql security invoker set search_path = ''
as $$ select app_private.assign_location_code(p_location) $$;
```
Kept a distinct, explicit action rather than auto-called from `approve_customer_location` — unchanged
reasoning from the first draft, not challenged by review.

### Exact schema changes
**None** (revised from the first draft, which added `customer_location_eligibility_history` — no such
table is built or sketched; the underlying policy question is Product Owner-blocked, see
§"Eligibility" above).

### Mandatory CAS
Required, no default, on every function that mutates an existing row (`update_customer_location`,
`approve_customer_location`, `retire_customer_location`). Not applicable to `propose_customer_location`
(insert) or `assign_customer_location_code` (idempotent).

### Capability and scope
`propose_customer_location`: `manage_customer_master` **or** `make_quote` at any active plant (mirrors
`customer_locations_insert`'s RLS OR-condition, confirmed live). All other functions:
`manage_customer_master`, group-scoped.

### Public wrappers
**Five** — `propose_customer_location`, `update_customer_location`, `approve_customer_location`,
`retire_customer_location` (new `app_private` functions, one wrapper each) plus
`assign_customer_location_code` (wrapper only, over the existing `assign_location_code`). Each
`SECURITY INVOKER`/`language sql`/`set search_path = ''`, each with an explicit
`revoke ... from public, anon, service_role` / `grant ... to authenticated` pair from the first
migration. (Reduced from six: `update_location_eligibility`'s wrapper is removed.)

### Flask routes
```
POST   /masters/parties/<int:party_id>/locations                  propose
PATCH  /masters/customer-locations/<int:location_id>               edit (new version)
POST   /masters/customer-locations/<int:location_id>/approve       approve
POST   /masters/customer-locations/<int:location_id>/retire        retire
POST   /masters/customer-locations/<int:location_id>/assign-code   assign code
```
**Five** (reduced from six — the `/eligibility` route is removed). Same `@require_auth` + `_rpc_call`
shape as every existing route; no new error codes.

### Read extension
`GET /masters/customer-families` gains a fifth array, `locations`, selecting
`id, party_id, location_code, bill_to_eligible, ship_to_eligible, status, content_version` from
`customer_locations` — additive, same `read_party_master` gate.

### Frontend screens and actions
Extends `CustomerFamiliesScreen.jsx`'s Party rows with a Locations expansion listing code, eligibility
badges (set once at proposal, read-only thereafter — **no Eligibility action**), status, and
Propose/Edit/Approve/Retire/Assign-Code actions, each `CapabilityGate`-wrapped. New pure helpers in
`lib/customerLocationActions.js`, proven by `scripts/customer-location-actions-fixtures.mjs`.
Incomplete-details indication (CDM-08: "details may remain incomplete") is a computed frontend badge —
shown when `address_text` (or all three descriptive fields) is null on the current version — no schema
needed, included in this slice's screen work.

### Feature flag
Reuses `u1_customer_families`.

### Negative and positive tests (`tests.customer_location_mutations()`)
Unauthenticated/no-capability refused on every function; `propose` refused for a caller with neither
`manage_customer_master` nor `make_quote` at any plant; `propose` refused `22023` for
`not(bill_to or ship_to)`, both Flask-side (400) and DB-side (`22023`, exercised directly against the
RPC); `propose` atomicity: a forced failure on the second insert leaves no orphaned
`customer_locations` row; `propose` against a not-found Party refused `P0002`; `update_customer_location`
stale CAS refused `40001`; successful edit supersedes the prior version (`uk_lv_one_current` still
holds exactly one `'current'` row, asserted directly) and leaves eligibility/`location_type`
unchanged (proving the edit function cannot touch eligibility even if called with different values —
there is no parameter for it to accept); `approve_customer_location`/`retire_customer_location`
forbidden-transition and double-transition cases; `assign_customer_location_code`'s existing `P0002`
and idempotent-repeat-call behaviour, now exercised through the new public wrapper;
`anon`/`service_role` execute refused on all five wrappers. **No `update_location_eligibility` tests
exist** — the function is not built.

### HTTP probes
**Five** rows (reduced from six), each `anon` and `service_role` refused; the `propose`→`approve` happy
path exercised once with an authenticated fixture persona, teardown clean. No eligibility-change probe.

### G-A/G-B
G-A after every migration commit. **One G-B run, shared with Slice A**, at the boundary after both are
committed (four new Slice-C functions plus one Slice-A function is a smaller structural surface than
the original Family B slice's ten, but still adds governed database entry points, so the same G-B
discipline applies rather than being skipped for size). Preserve identities/grants/invitations/settings
exactly, same three-step method already established (`u1-customer-family-mutations-packet.md` §12).

### Rollback consequence
Four new functions, five new wrappers, five new routes, one additive response-shape change to an
existing GET route. Entirely additive. No existing table, function, or route is altered. No new table
in this revision.

### Dependencies / unresolved Product Owner decisions
1. **Location-to-Party reassignment** — confirmed gap against CDM-07, no mechanism exists, not built.
2. **Post-proposal eligibility change policy** — blocked. Two nested questions unresolved: whether an
   in-place edit transition is permitted at all, and — only if it is — whether it must be historically
   attributable and how. Neither `update_location_eligibility` nor any eligibility-history table is
   built pending this ruling.

### Confirmation
This is a narrower slice than "complete Customer Locations": it delivers proposal (with eligibility
fixed at that point), descriptive versioning, approval, retirement, and permanent code assignment. It
can be implemented, tested, and closed on its own terms without claiming to close Customer Locations as
a whole, and without claiming any contribution toward closing U1 as a whole — both matrices below and
the closing section restate this explicitly, not only here.

---

## Customers/Prospects acceptance matrix

Covers every requirement `data-model-frontend-design-plan.md` §6 U1 names for "Customers and Prospects."
**This packet does not close the Customers/Prospects requirement as a whole** — only the rows marked
"included now" are delivered by Slice A; the review specifically warned against inferring closure from
display-name editing alone, and this matrix is the corrective.

| Requirement | Status | Evidence / notes |
|---|---|---|
| Quick-create minimal Prospect | **Already closed** | `create_minimal_prospect`, closed U1-CF slice — live, wrapped, routed, tested. |
| One identity across Prospect/Customer lifecycle (view) | **Already closed** | `GET /masters/customer-families` already returns `lifecycle_state`/`status` per Party. |
| One identity across Prospect/Customer lifecycle (edit `display_name`) | **Included now** | Slice A, this packet. |
| Graduation and permanent Customer Code | **Already closed** | `graduate_party`/`graduate_customer_party`, closed U1-CF slice. |
| Family reassignment | **Already closed** | `reassign_party_family`/`reassign_customer_family`, closed U1-CF slice. |
| External references (view) | **Already closed** | `GET` does not currently return `party_external_references`, though `merge_parties` reads/writes it — **correction: this row is actually a gap, not closed; see below.** |
| External references (propose/edit) | **Deferred** | No governed function, no route. Not requested by your direction for this packet; `ref_kind` values are confirmed (`legacy_customer_code`, `customer_item_ref`, `other`) but no workflow currently needs manual entry. Not built. |
| Party lifecycle/status transition history (a real timeline, not just current status) | **Blocked** | No mechanism exists — would require Family H/`audit_events` (S10, U6) or a bespoke Party-status history table. Not designed here. |
| Family membership history (view) | **Already closed** | `GET` already returns `party_family_memberships` with `effective_from`/`effective_until`/`is_current`. |
| Party deactivation/reactivation | **Blocked** | Genuine Product Owner decision, not designed (Slice A §"Dependencies"). |
| Party merge | **Out of this packet** | Dormant, unreachable; dependent-handling choices unresolved — see `u1-party-merge-decision-packet.md`. |

**Correction applied while building this matrix:** external references are read by nothing today —
`GET /masters/customer-families` does not select `party_external_references` at all. The first draft
did not name this gap explicitly. Corrected here: both read and write for external references are
**deferred**, not closed, not attempted by this packet.

---

## Customer Locations acceptance matrix

Covers every requirement finding 4 named. **States plainly which subset this packet closes** — this is
a narrower Location slice, not complete Customer Locations.

| Requirement | Status | Evidence / notes |
|---|---|---|
| Address/site details (create + edit) | **Included now** | Slice C: `propose_customer_location` + `update_customer_location`. |
| Incomplete-details indication | **Included now** | Frontend computed badge over nullable descriptive fields — CDM-08's "may remain incomplete" made visible, not silently blank. No schema needed. |
| Eligibility — initial selection at proposal | **Included now** | `propose_customer_location` takes `p_bill_to_eligible`/`p_ship_to_eligible`; `ck_loc_eligible` ("at least one") retained at both the application and database layer, unchanged. |
| Eligibility — post-proposal change (whether an in-place edit transition exists at all, and, only if so, whether/how it is historically attributable) | **Blocked** | Genuine Product Owner decision on the transition itself, not merely on how to record it. `update_location_eligibility` removed from this packet entirely; no eligibility-history table sketched pending that ruling. |
| Permanent Location Code | **Included now** | `assign_location_code` already governed at the DB layer (dormant); Slice C adds its public wrapper and route. |
| Descriptive version history (`customer_location_versions`) | **Included now** | Already schema-present (`uk_lv_one_current` confirmed live); Slice C's `propose`/`update` populate and supersede it correctly. |
| Effective-dated parent (Party) reassignment | **Blocked** | Confirmed zero schema mechanism exists; CDM-07 promises it; not built here — see Slice C's scope carve-out. |
| Legitimate third-party Bill-to/Ship-to selection (CDM-08) | **Deferred** | The underlying read (any `customer_locations` row is selectable by `location_id`, unconstrained by Family) is not itself blocked, but no search/select UI for an *arbitrary existing* Location across Families exists yet. Slice D's light integration only reaches Locations belonging to the Party just quick-created/selected in the same action — genuine cross-Family third-party selection belongs to U4's Delivery Group UI (`data-model-frontend-design-plan.md` §6 U4), not this packet. |

**This slice can be implemented, tested and closed on its own without claiming "Customer Locations" is
complete** — three of seven rows above are explicitly not delivered (post-proposal eligibility change,
Party reassignment, third-party selection), and none of the Customers/Prospects matrix's own gaps are
touched by Location work either.

---

## Slice D — Batch Entry light integration

### Canonical authority
Your direction, restated and now applied literally: *"U1 may provide explicit governed quick-create/
select and then populate the existing free-text `client`/`delivery` values. Formal referential linkage
and migration belong to U4."*

### What changed from the first draft
The first draft added two new optional Batch Profile fields (`clientLink`/`deliveryLink`, each an
object carrying a `partyId`/`locationId`), plus staleness-detection logic comparing live text against a
linked-at-time snapshot, plus a `resolveLinkForMigration` helper anticipating U4. **All of that is
removed.** It was a referential-linkage mechanism in substance — a persistent pointer from Batch state
to a governed identity, with its own consistency rules — which is precisely what your direction says
belongs to U4, not U1, regardless of how "light" its staleness handling was. Keeping it would have
reintroduced through Batch state exactly the two-tier authority problem this packet elsewhere argues
against for Location parentage.

### Interim representation — the whole of it
The Batch Profile's existing `client`/`delivery` free-text fields are **unchanged in shape** — no new
fields, no link object, nothing persisted beyond the string that was already there. Quick-create/select
is a **write-once convenience**, not a live relationship:

- "+ Create/Select Prospect" near `client`: opens a picker over the existing `GET /masters/customer-
  families` `parties` array (select existing) or a quick-create form calling `create_minimal_prospect`
  (already closed, U1-CF). On success, sets `client = <returned display_name>`. Nothing else changes.
- "+ Create/Select Location" near `delivery`: same pattern, using `propose_customer_location` (Slice C)
  or the extended `locations` array from `GET`. On success, sets `delivery = <location label>`.
  Nothing else changes.

After either action, the free-text field is **indistinguishable from having been typed by hand** — no
badge, no linked-state, no staleness concept, because there is no state left to go stale. This is what
"populate the existing free-text values" means taken literally, and it is the smallest interpretation
of "light" consistent with your direction.

### Backend
No new routes. Reuses `POST /masters/customer-families/prospects` (already closed) and
`POST /masters/parties/<id>/locations` (Slice C). Two independent RPC calls, sequenced client-side,
never composed into one request — unchanged discipline from the first draft.

### Frontend
New `lib/batchQuickCreate.js` — pure request-body builders only (`createProspectBody`,
`createLocationBody`; both already exist in near-identical form in `customerFamilyActions.js`/
`customerLocationActions.js` and are reused rather than duplicated where the shape is identical). No
staleness helpers, no link-object helpers — none are needed. A small affordance near the existing
`client`/`delivery` inputs in `BatchProfileBar.jsx`, placed to respect the file's currently preserved,
uncommitted hunk (an unrelated grid column-width fix in the "Commercials" region — not touched by this
slice's eventual implementation).

### Feature flag
New: `u1_batch_party_link` — gates only the quick-create/select affordance inside the always-on Batch
Entry tab; default-off.

### Migration order
After C only (see §0) — not after A.

### Tests
Fixture-script coverage (`batch-quick-create-fixtures.mjs`): the quick-create action's confirm copy and
request-body shape; that a successful call's result is written to `client`/`delivery` as plain text and
nothing else. No staleness test exists because no staleness mechanism exists.

### HTTP probes / G-A / G-B
None new — no new routes, no new schema.

### Rollback consequence
None — no persisted shape change to Batch Profile at all.

### U4
This packet documents no migration path, resolver, or seed mechanism for U4, per your direction that
referential linkage belongs there. When U4 moves Batch state off `localStorage`, it starts from
whatever free text exists (linked or hand-typed — indistinguishable, by design) and resolves Party/
Location identity itself; that resolution mechanism is U4's to design, not anticipated here.

### Dependencies
Slice C only.

---

## Slice E — End-to-end Prospect + usable Location acceptance flow

### What this slice is
Not new schema, functions, routes, or screens. It is the closure and proof slice tying A, C and D
together against `data-model-frontend-design-plan.md`'s own U1 acceptance outcome: *"an authorised user
can create a Prospect and usable Location, then select them within an allowed plant workflow without
bypassing Customer Master governance."*

### Acceptance scenario (positive)
An authenticated Maker holding `make_quote` at an active plant, from Batch Entry's `client` field,
quick-creates a Prospect ("Acme Boxes Ltd"); the free text updates to the Prospect's `display_name`.
From the same panel, quick-creates a Customer Location for that Prospect, Ship-to-eligible, with an
address; `delivery`'s free text updates. The Batch Profile persists across a page reload as plain text,
same as any other free-text entry. Separately, in the Customer Families screen, the same Prospect and
Location are visible, correctly attributed, in `'proposed'` status, without manual re-entry.

### Acceptance scenario (negative, one per governance boundary this packet touches)
- A user with neither `manage_customer_master` nor `make_quote` at any plant sees no quick-create
  affordance and, if forced, the route refuses `403 CAPABILITY_REQUIRED`.
- A deactivated user's session is refused before any of these routes execute.
- Proposing a Location with neither Bill-to nor Ship-to checked is refused client-side, and, if
  bypassed, `422 TRANSITION_NOT_ALLOWED` server-side.
- A stale `content_version` on any Slice A/C edit (two browser tabs racing) is refused `409` and the UI
  re-fetches rather than silently overwriting — exercised for at least one Slice A function and one
  Slice C function.
- Attempting to reassign a Party into a retired Family (existing, unchanged rule) still refuses `422`,
  proving Slice D's quick-create does not bypass existing governance by a different path.

### Proof obligations
Full standing eight-gate set; new fixture scripts (`party-actions-fixtures.mjs`,
`customer-location-actions-fixtures.mjs`, `batch-quick-create-fixtures.mjs`); `tests.run_all()` full
count including every new pgTAP case from A/C; route tests, same hermetic/leak-proof convention; HTTP
probe matrix additions from A/C, `anon` and `service_role` both refused, teardown clean; G-A after every
migration commit, the one A+C closure-boundary G-B; manual verification in a real browser of the
positive acceptance scenario (closing the gap the closed U1-CF slice left open — "no test credentials
were available... to exercise the mutation flows interactively"); `BatchProfileBar.jsx`'s preserved
hunk and `docs/commercial-intelligence-decisions.md` verified untouched at closure.

### Dependencies
A, C, D all committed and individually green first.

---

## Scope boundary — what this packet does not close

**Users/Access is outside this packet entirely.** Per the U0 discovery report, its backend is already
fully covered ("None — fully covered... U1 work here is presentation, not new backend") and any
remaining frontend work (shared loading/empty/access-denied/stale states applied to
`UserManagementTab.jsx`, further capability-aware navigation refinement) is separately tracked and not
evaluated, designed, or touched by this packet.

**Completing Slices A, C, D and E does not close U1 as a whole.** Outstanding after this packet, all
explicitly named above rather than silently implied:
- Party deactivation/reactivation — blocked, Product Owner decision required (Slice A).
- Location-to-Party reassignment — blocked, no schema mechanism, gap against CDM-07 (Slice C).
- Post-proposal Location eligibility change — blocked, Product Owner decision required on whether an
  in-place transition exists at all before any question of history arises (Slice C).
- Party external references, read and write — deferred, not requested, not built.
- Party lifecycle/status transition history — blocked, needs Family H/`audit_events` (S10/U6).
- Legitimate third-party (cross-Family) Location selection — deferred to U4's Delivery Group UI.
- Party merge (CAS correction and dependent handling) — out of this packet; separate, unresolved
  decision packet.
- Users/Access frontend presentation polish — out of this packet, separately tracked.

---

## Consolidated register

### Product Owner decisions still required (genuine, not technical)
1. **Party deactivation/reactivation** (Slice A).
2. **Location-to-Party reassignment** (Slice C) — CDM-07 promises it; no mechanism exists.
3. **Post-proposal Location eligibility change policy** (Slice C) — whether an in-place edit transition
   is permitted at all, prior to and independent of any question of how it would be recorded. Nothing
   resembling this transition is implemented, sketched, or held pending; initial eligibility selection
   at proposal is unaffected and delivered.
4. **Party merge dependent handling** — three independent choices, see
   `u1-party-merge-decision-packet.md`.

### Producing Plants / Customer Families visibility — recorded for the avoidance of doubt
Confirmed by direct investigation this session (git history, live bundle decoding, current env files):
both screens are implemented and unreverted; they are hidden today solely because
`VITE_FEATURE_FLAGS` is unset in this workspace, which is a **visibility/configuration state, not a
code rollback**. No configuration change (no `.env.local`, no capability grant, no server restart) has
been made or is proposed for execution by this packet — any such change remains a separate,
independently authorised action.

### What this packet does not authorise
Implementation. Migration. Deployment. Push. Commit. Any capability grant. Any local configuration
file. Any server start or restart.
