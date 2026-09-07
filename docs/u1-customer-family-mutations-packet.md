# U1 — Customer Family mutations: implementation packet

**Date first drafted:** 2026-09-07. **Amended:** 2026-09-07, same day, before implementation began,
per the binding decisions issued after this packet's first draft was reviewed. **Status: schema,
governed DB operations and DB-layer tests are now implemented and committed** (`quote-gen-be`
migrations `20260907065533`…`20260907072420`). Flask routes, frontend actions and the HTTP probe
matrix update are **still pending** — this document is corrected ahead of that remaining work, not
after it, so the routes and UI are built against the actual implemented shape rather than the
superseded planning assumptions below.

## Amendment record — what changed from the first draft, and why

The first draft (§0 table below, preserved for the audit trail) treated Propose/Quick-create-
Prospect/Approve/Edit as needing **no new SQL** — a direct RLS-gated `INSERT`/`UPDATE` was assumed
sufficient, with only Merge/Reassign/Graduate treated as real gaps. That assumption is **superseded**
by the binding decision that concurrency protection is mandatory on every mutable Family B record,
not optional, and that Minimal Prospect creation must be one atomic governed database operation, not
a collection of separate writes (CDM-06). A direct `UPDATE` cannot carry a CAS check without becoming,
in effect, a governed operation anyway — so every mutation in scope now goes through an
`app_private.*` function, none through a bare RLS-gated table write. The three items originally
marked "no gap" were gaps after all, once CAS was made mandatory.

~~Original §0 scope table (superseded — see above; kept for the record, not for reference):~~

| ~~Operation~~ | ~~Governed path assumed~~ | ~~Gap assumed~~ |
|---|---|---|
| ~~Propose a new Family~~ | ~~Direct `INSERT`, RLS-gated~~ | ~~None — thin Flask POST is enough~~ |
| ~~Quick-create a Prospect~~ | ~~Direct `INSERT`, RLS-gated~~ | ~~None — thin Flask POST is enough~~ |
| ~~Approve / edit / alias~~ | ~~Direct `UPDATE`, RLS-gated~~ | ~~None — thin Flask PATCH is enough~~ |
| ~~Merge / Reassign / Graduate~~ | ~~`app_private.*` exists, untested by wrapper~~ | ~~Real — no public wrapper~~ |

The other open item in the first draft, §5's CAS design question ("optional `p_expected_content_
version` … Product Owner / SR DEV decision for the actual migration session"), is resolved by the
same binding decision: **not optional**. Every `app_private` function that mutates an existing row
takes a **required** `p_expected_content_version` with no default — a caller cannot construct a call
that skips the check.

The Family Code allocation-timing question (first draft §1's `allocate_group_customer_code` note,
"this packet does not resolve that design question") is resolved from accepted canonical authority,
not invented: `data-model-sr-dev-proposal.md` §12.4's scope/timing table states explicitly, in a row
that separately treats Construction Code as bound to *publication* — "Family Code | group | Family
creation." `propose_customer_family` therefore allocates the code in the same statement that inserts
the Family row, at proposal, not deferred to approval.

---

## 1. Implemented `app_private` operations

All are `SECURITY DEFINER`, `SET search_path TO ''` (fully schema-qualified inside), and each
performs its own capability check as its first statement — a caller-supplied JWT reaching one
through its wrapper is refused the same way regardless of the wrapper. Source:
[`20260907065939_family_b_mutations_functions.sql`](../../quote-gen-be/supabase/migrations/20260907065939_family_b_mutations_functions.sql).

| Function | Capability required | CAS | Notes |
|---|---|---|---|
| `propose_customer_family(p_name)` → `bigint` | `manage_customer_master` **or** `make_quote` at any active plant | n/a (insert) | Allocates `group_customer_code` at creation (§12.4). Creates `status='proposed'`. |
| `create_minimal_prospect(p_display_name, p_family_id default null)` → `(party_id, family_id)` | same as propose | n/a (insert) | One atomic operation (CDM-06): reuses `p_family_id` if given (locked, refused if retired), else silently proposes a new Family named after the Prospect; inserts the Party (`lifecycle_state='prospect'`) and its current membership. Full rollback on any step failure — implicit transaction, one function body. |
| `update_customer_family(p_family, p_expected_content_version, p_name)` | `manage_customer_master` | **required** | Renames a Family. |
| `approve_customer_family(p_family, p_expected_content_version)` | `manage_customer_master` | **required** | `proposed → active` only; refuses any other current status (`22023`); sets `approved_by`/`approved_at`. |
| `add_family_alias(p_family, p_alias)` | `manage_customer_master` | n/a (insert) | Duplicate alias on the same Family refused by `uk_alias` (`23505`). |
| `update_family_alias(p_alias_id, p_expected_content_version, p_alias)` | `manage_customer_master` | **required** | |
| `retire_family_alias(p_alias_id, p_expected_content_version)` | `manage_customer_master` | **required** | Refuses double-retirement (`22023`). |
| `merge_families(p_survivor, p_retired, p_expected_survivor_version, p_expected_retired_version)` | `manage_customer_master` | **required, both sides** | Self-merge refused (`22023`). Cycle prevention: retired-into-survivor and double-retirement both refused (`22023`). Retired Family's name copied to the survivor as an alias (`on conflict do nothing`, idempotent). Retired row keeps its id, gets `status='retired'`, `surviving_family_id=survivor` — lineage never deleted. |
| `reassign_party_family(p_party, p_new_family, p_expected_content_version, p_effective default current_date)` | `manage_customer_master` | **required, on the Party** | Locks the Party and its current membership row together. No-ops if already in the target Family. Refuses a target that is `retired` (`22023`) and an effective date before the current membership's `effective_from` (`22007`). Closes the current membership and inserts the new one — the prior one is retained as history, not deleted. |
| `graduate_party(p_party)` → `text` | `manage_customer_master` | n/a (idempotent) | Unchanged from S6 — mints `customer_code` once, returns the existing code unchanged on a repeat call. No CAS needed: a race produces the same correct result twice. |

**CAS technique** (identical on every function above that needs it — the established
`revise_batch_profile`/S6-12 pattern): a self-referential `update ... set content_version =
content_version [+ 1] where id = ... and content_version = p_expected`; `get diagnostics v_n =
row_count`; `v_n = 0` distinguishes "row doesn't exist" (`P0002`) from "row exists but version
didn't match" (`40001`) by a follow-up existence check. `merge_families` applies this **twice**, once
per side, both checks completed *before* either row's status changes — a stale version on the
survivor is caught exactly as reliably as a stale version on the retiring side. `reassign_party_
family` applies it to the **Party** row (not the membership row directly), which protects against
both a concurrent reassignment and a concurrent unrelated edit to the Party while the call is in
flight.

**No optional/default CAS parameter exists anywhere in this set** — every `p_expected_content_
version` argument is required, so no call can be constructed that bypasses the check, per the
binding decision.

## 2. Public invoker wrappers — implemented

Ten `public`-schema `SECURITY INVOKER`, `language sql`, `set search_path = ''` wrappers, one per
`app_private` function above (the tenth being the now-wrapped, previously-unreachable
`graduate_party`, renamed `graduate_customer_party` at the public layer for name clarity). Each
wrapper is a single `select app_private.<fn>(...)` — no logic, no duplicated capability check. Source:
same migration, §"public invoker wrappers".

**Grants**, applied via a `do $$ ... $$` loop over exactly these ten public functions (not a manual
per-function `grant`/`revoke`, to guarantee none is missed):
- `revoke all ... from public` (covers `anon`/`service_role`'s default membership)
- `revoke all ... from anon` (explicit, defense in depth)
- `grant execute ... to authenticated` (the only role that can ever reach any of the ten)

No table grant changes, no RLS changes — the wrappers don't touch RLS; `app_private.*` already runs
`SECURITY DEFINER` and the capability gate is PL/pgSQL, not a policy. `tests.customer_family_
mutations()` CFM-26/26a assert this grant posture directly (`has_function_privilege`) rather than
assuming it holds.

**`service_role`** deliberately is **not** asserted to lack `EXECUTE` (an earlier test draft assumed
it did and was corrected — see the `20260907071705` migration's header comment): `service_role`
bypasses RLS and carries platform-level default privileges on this project regardless of a per-
function revoke, so confinement of `service_role` is enforced as an *application-layer* discipline
(Flask never uses the service-role client for these routes — see §5) rather than a DB-grant one. The
established `revise_batch_profile` (S6-12) grant pattern makes the same choice.

## 3. Caller and capability checks

Enforced entirely inside `app_private.*`, per the binding decision that business operations stay
authoritative in the database and Flask must not duplicate capability rules. Flask's job, once the
routes exist, is unchanged from the plan: forward the caller's own token via
`get_supabase_for_caller(g.access_token).rpc(name, params)`, read the RPC's result or exception, and
map the Postgres error code to a stable HTTP status (§6).

## 4. Atomicity

Each function is one PL/pgSQL body; Postgres's own implicit transaction is the atomicity boundary.
`create_minimal_prospect` is the operation this matters most for — Family reuse-or-creation, Party
insert, and membership insert are three statements inside one function, so a failure at the
membership insert rolls back the Party insert too (verified: CFM-22a asserts no orphan Party survives
a forced failure). `merge_families` cannot leave the alias inserted without the retirement applied,
and cannot leave one side's CAS validated without the other's. **Flask must still call each RPC
exactly once per HTTP request and never compose several RPC calls into one request** — unchanged from
the original plan; composing them would move atomicity into application code.

## 5. Conflict / CAS behaviour

No longer an open question (see the Amendment record above) — implemented as mandatory, required-
argument CAS on every mutation of an existing row, verified by twelve distinct stale-version test
cases in `tests.customer_family_mutations()` (CFM-9, 12, 15, 16, 23), each expecting `40001`.

## 6. Stable HTTP error mapping (for the pending Flask routes)

| Postgres condition | `errcode` | HTTP |
|---|---|---|
| No active session / caller not resolvable | `42501` | 401 (if literally unauthenticated) |
| Capability check failed | `42501` | 403 |
| Row not found (Family, Party, alias) | `P0002` | 404 |
| Stale `content_version` | `40001` | 409 |
| Forbidden state transition, self-merge, merge-cycle, double-retirement, retired target | `22023` | 422 |
| Effective date precedes current membership | `22007` | 422 |
| Missing/blank required field | `22023` (same code, different message) | 400 |
| Anything else | — | 500, no Postgres text leaked to the client; log server-side only |

Distinguishing the 400-vs-422 `22023` cases requires matching on the message text server-side (never
forwarding raw Postgres text to the client either way) or, preferably, giving the "required field"
checks their own distinct `errcode` in a follow-up migration if the ambiguity proves troublesome in
practice — not resolved here since it does not change the data model, only the HTTP mapping's
internal implementation.

## 7. Permanent-code and lineage preservation

Unchanged from the original analysis, now re-verified by the implemented test suite rather than by
reading the bodies alone: `merge_families` never deletes the retired Family row (CFM-17/17a/17b);
`graduate_party` mints `customer_code` once, idempotently; both go through `ref_private`'s existing
reference-sequence machinery. The Customer Code, once minted, is a permanent business identifier and
must be shown plainly on the Party record and in the graduation success confirmation going forward
(not treated as a one-time secret) — a frontend requirement for §9, not yet built.

## 8. Required Flask routes — still pending

Nine routes (one per required mutation action in scope; Graduate is included though its DB operation
was already wrapper-reachable before this slice), same `@require_auth` +
`get_supabase_for_caller(g.access_token).rpc(name, params)` shape as the existing `/admin/users` POST
and `/masters/customer-families` GET:

- `POST /masters/customer-families` — propose. Body `{name}`.
- `POST /masters/customer-families/prospects` — minimal Prospect. Body `{display_name, family_id?}`.
- `PATCH /masters/customer-families/<id>` — edit name. Body `{expected_content_version, name}`.
- `POST /masters/customer-families/<id>/approve` — Body `{expected_content_version}`.
- `POST /masters/customer-families/<id>/aliases` — add. Body `{alias}`.
- `PATCH /masters/customer-family-aliases/<id>` — edit. Body `{expected_content_version, alias}`.
- `POST /masters/customer-family-aliases/<id>/retire` — Body `{expected_content_version}`.
- `POST /masters/customer-families/merge` — Body `{survivor_id, retired_id, expected_survivor_version, expected_retired_version}`.
- `POST /masters/customer-families/reassign` — Body `{party_id, new_family_id, expected_content_version, effective_date?}`.
- `POST /masters/customer-families/graduate` — Body `{party_id}`.

**As implemented**, all three take every id from the body rather than the URL — the earlier draft's
`<id>`-in-path shape for reassign/graduate was ambiguous (which id — Party or Family?) and added
nothing merge's own all-body shape didn't already establish as the pattern. A route-shape
simplification, not a data-model decision.

Each route: validate body shape (types only, not RLS's job), call the RPC once, map the result per
§6, return `{"ok": true}` for void RPCs or the RPC's return value (new id, minted code, or the
`(party_id, family_id)` pair) for the others.

## 9. Frontend actions — still pending

Per the required mutation scope: propose/edit Family, approve, add/edit/retire alias, merge, reassign
with effective dating, graduate a Prospect "where it belongs naturally on the Family surface" — i.e.
as actions on `CustomerFamiliesScreen.jsx`'s existing read-only rows, not a new screen. The broader
Customer/Prospect mutation UI stays out of scope, per the standing instruction, unless a small part
proves strictly required by one of these nine actions (expected: it will not).

- Every action's confirm/error flow goes through `CapabilityGate` (`manage_customer_master`, or for
  Propose/Prospect-create, `manage_customer_master` **or** `make_quote` at any plant — mirroring the
  DB's own OR condition, not narrower) and `classifyResponse()` from `lib/backendError.js`, so a 403
  reads as access-denied, a 409 reads as stale (re-fetch and retry, not silently overwritten), and a
  422/400 reads as validation.
- **Merge**: two-step, irreversible-warning confirm; read-back re-fetches and shows the retired row's
  new state plus its alias on the survivor.
- **Reassign**: date picker defaulting to today; client-side pre-check against the DB's actual rule
  (not preceding the *current membership's* start date, not an invented narrower policy) as a
  usability hint only — the server remains authoritative.
- **Graduate**: shows the minted Customer Code in the success confirmation, and the record continues
  to display it afterward as a permanent field — not a one-time reveal.
- Every mutation call is a single Flask request per action; the browser never calls a Postgres RPC or
  runs mutation SQL directly (binding decision — backend-only writes).

## 10. Proof obligations

**Database — implemented.** `tests.customer_family_mutations()` (CFM-1…26a, in
[`20260907071937`](../../quote-gen-be/supabase/migrations/20260907071937_family_b_mutations_fix_grants_and_drop_obsolete.sql)'s
corrected final form): unauthenticated (CFM-1), no capability (CFM-2), deactivated/inactive assignee
holding the grant (CFM-3), authorised Maker succeeds at propose (CFM-4/5), wrong-group denial at
approve (CFM-6), valid approval (CFM-7/7a), forbidden re-approval of an already-active Family
(CFM-8), stale `content_version` on edit (CFM-9), duplicate alias (CFM-11), stale alias version
(CFM-12), self-merge (CFM-14), stale survivor-side CAS alone (CFM-15), stale retired-side CAS alone
(CFM-16), survivor/retired lineage preservation (CFM-17/17a/17b), merge-cycle prevention (CFM-18),
double-retirement prevention (CFM-19), atomic `create_minimal_prospect` incl. Family reuse (CFM-20…21)
and rollback on partial failure (CFM-22/22a), stale Party CAS during reassignment (CFM-23), reassign
into a retired target refused (CFM-24), reassignment membership-history correctness (CFM-25/25a),
absence of `anon` execute on any of the ten wrappers and full `authenticated` coverage (CFM-26/26a).
`tests.batch_workspace()` (BF-13) re-verified against the new required-CAS `reassign_party_family`
signature.

**Route — implemented.** `quote-gen-be/tests/test_customer_family_mutation_routes.py`, same hermetic
fake-client convention as `test_customer_families_route.py` (77 checks): anonymous 401 on all ten
routes; each route's well-formed success path calls exactly the expected RPC, with the caller's own
token and the exact expected parameters (`reassign`'s optional `p_effective` included, both present
and omitted); a missing/blank required field is refused 400 before any RPC is attempted; each mapped
Postgres error code (`42501`→403, `P0002`→404, `40001`→409, `22023`/`22007`→422) is exercised via
injected `APIError`s and an unmapped code falls back to 500 with nothing of the injected message
forwarded to the client; no route uses the service-role client. (Wrong-plant/wrong-group/inactive-
caller behaviour is proved once, at the authoritative layer, by `tests.customer_family_mutations()`
above — a route-level fake cannot exercise RLS/capability grants meaningfully, only prove the route
forwards the caller's own token and does not pre-empt the database's decision, which it does not.)

**Frontend** — pending, one fixture-script scenario per action per the existing
`scripts/capabilities-fixtures.mjs` convention.

**HTTP probe matrix — implemented and run live.** `U1_FAMILY_B_RPCS` added to
`quote-gen-be/tests/http_probe_matrix.py`, one entry per newly exposed public RPC; run against the
live project with `--anon-only`: 108/108 checks passed, including all ten U1 RPCs refused `401
{"code":"42501",...}` before authorization is reached, matching the S5/S6 rows already in the
matrix.

## 11. Rollback and migration treatment

The ten Flask routes, their fake-client route gate, and the extended HTTP probe matrix are committed
in `quote-gen-be` at `919db1d`, on top of the migrations below (`bf1acd2`).

Ten migrations, chronological, already applied and locally committed (`bf1acd2`):
`20260907065533` (schema), `20260907065939` (functions/wrappers/grants), `20260907070509` (test
suite), four `_fix_*` corrections found by actually running the suite
(`20260907070644`/`070903`/`071102`/`071251`), `20260907071705` (three test-logic bugs found by a full
run), `20260907071937` (grant/revoke completion + drop of the two orphaned CAS-less function
overloads left behind when `merge_families`/`reassign_party_family` changed signature —
`CREATE OR REPLACE` with a different argument list creates a new overload rather than replacing the
old one, so the prior 2-arg/3-arg versions had to be dropped explicitly or they would have remained
live, reachable, and exactly the concurrency-bypass surface the binding decision ruled out), and
`20260907072420` (a second, independent fix to `tests.batch_workspace()`'s own two stale call sites,
found only when running the *entire* `tests.run_all()`, not just the new suite in isolation).

Nothing in `app_private` from before this slice was altered except the two changed signatures noted
above (both previously unreachable — no public wrapper existed for either, confirmed by the original
S6-era search before this slice began), so no other caller anywhere in the codebase needed updating
except the two found by running the full suite (`tests.fixtures_matrix()`, patched in the tests
migration itself, and `tests.batch_workspace()`, patched in `072420`).

---

**Superseded sections removed:** the first draft's §2 (wrapper code samples for a since-abandoned
2-argument `merge_families`/3-argument `reassign_party_family` shape) and §7 (three-route plan for
only Merge/Reassign/Graduate) are replaced in full by §§1–2 and §8 above; nothing from the original
code samples survives unchanged into the implementation.
