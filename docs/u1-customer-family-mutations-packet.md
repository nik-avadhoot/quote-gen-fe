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

**Grants — corrected under U1-CF-C1.** The original `do $$ ... $$` loop (in
`20260907065939_family_b_mutations_functions.sql`) revoked from `public` and `anon` and granted to
`authenticated`, but never explicitly touched `service_role`. It was written to believe that clause
was a complete revoke; it was not.

~~"`revoke all ... from public` (covers `anon`/`service_role`'s default membership)" — superseded, see
below: `REVOKE ALL FROM PUBLIC` does not remove a role's OWN separately-granted ACL entry, and
`service_role` had one.~~

**Catalog evidence, read directly (`pg_proc.proacl`, `pg_default_acl`), not assumed:** before the
correction, every one of the ten wrappers' ACL read
`{postgres=X/postgres, authenticated=X/postgres, service_role=X/postgres}` — a **direct** grant to
`service_role`, not inherited from `PUBLIC` (`has_function_privilege('public', …)` was already
`false`) and not owner/superuser-derived (`proowner = postgres`, an ordinary role, not a bypass).
`pg_default_acl` showed the source: a platform default privilege — `ALTER DEFAULT PRIVILEGES FOR ROLE
postgres IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role` — applied
automatically to every new `public`-schema function `postgres` creates. The migration's explicit
`revoke ... from public` and `revoke ... from anon` calls overrode that default for those two roles;
`service_role` was simply never named, so its slice of the default stood untouched.

**Fix (`20260907125813_family_b_mutations_revoke_service_role_execute.sql`):** explicit
`revoke execute on function <sig> from service_role` on all ten, plus
`alter default privileges for role postgres in schema public revoke execute on functions from
service_role` — closing the gap for every function `postgres` creates in `public` from this point on
(forward-only; `ALTER DEFAULT PRIVILEGES` never touches an existing object, so nothing already created
was affected). Post-fix ACL on all ten: `{postgres=X/postgres, authenticated=X/postgres}` — confirmed
directly via `has_function_privilege`, one row per wrapper, in the table below.

| Wrapper | `anon` | `authenticated` | `service_role` | `PUBLIC` | ACL |
|---|---|---|---|---|---|
| `propose_customer_family` | false | true | **false** | false | `{postgres=X/postgres,authenticated=X/postgres}` |
| `create_minimal_prospect` | false | true | **false** | false | same |
| `update_customer_family` | false | true | **false** | false | same |
| `approve_customer_family` | false | true | **false** | false | same |
| `add_family_alias` | false | true | **false** | false | same |
| `update_family_alias` | false | true | **false** | false | same |
| `retire_family_alias` | false | true | **false** | false | same |
| `merge_customer_families` | false | true | **false** | false | same |
| `reassign_customer_family` | false | true | **false** | false | same |
| `graduate_customer_party` | false | true | **false** | false | same |

No table grant changes, no RLS changes — the wrappers don't touch RLS; `app_private.*` already runs
`SECURITY DEFINER` and the capability gate is PL/pgSQL, not a policy.

**Regression coverage, restored** (`20260907130316_family_b_mutations_restore_cfm26_service_role_check.sql`):
CFM-26 had been narrowed to check `anon` only, in `20260907071705`, on the (now-corrected) belief that
`service_role` holding `EXECUTE` was inherent platform behaviour rather than a missed revoke. It now
asserts `has_function_privilege('service_role', …)` is false for all ten, alongside `anon`, in the
same assertion. `tests.customer_family_mutations()` CFM-26/26a assert this grant posture directly
rather than assuming it holds; the live HTTP probe matrix (§10) additionally proves it over real
PostgREST calls, not only via catalog introspection.

BYPASSRLS and function `EXECUTE` are different controls, and conflating them was the error the first
draft of this section made — `service_role` holding `BYPASSRLS` says nothing about whether it can
invoke a specific `SECURITY INVOKER` function; that is decided by the function's own ACL alone. Flask
never constructs a service-role client for any of these ten routes regardless (verified — see §10),
so this was defense-in-depth even before the fix, but it is no longer an *undefended* layer.

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

## 6. Stable HTTP error mapping — implemented, corrected under U1-CF-C2

**Corrected.** The first implementation's `_rpc_call()` returned `exc.message` — the Postgres
exception's own text — for every mapped `errcode`, reasoned to be "safe... names no table or column"
by manual inspection of the `RAISE` statements at the time they were written. That is exactly the
fragile posture the binding instruction ruled out: safety would silently break the moment any
`RAISE` message changed, with no code-level guard to catch it. Replaced with an application-owned
`error_code` and a fixed message, defined once in `server.py`, that never varies with what the
database happened to say:

| Postgres condition | `errcode` | `error_code` (this file's own constant) | HTTP |
|---|---|---|---|
| No active session / caller not resolvable | `42501` | — (`require_auth` refuses first) | 401 |
| Capability check failed | `42501` | `CAPABILITY_REQUIRED` | 403 |
| Row not found (Family, Party, alias) | `P0002` | `RECORD_NOT_FOUND` | 404 |
| Stale `content_version` | `40001` | `STALE_VERSION` | 409 |
| Forbidden state transition, self-merge, merge-cycle, double-retirement, retired target | `22023` | `TRANSITION_NOT_ALLOWED` | 422 |
| Effective date precedes current membership | `22007` | `INVALID_EFFECTIVE_DATE` | 422 |
| Missing/blank required field, caught by Flask before any RPC call | n/a — never reaches the DB | `INVALID_INPUT` | 400 |
| Anything else (an unmapped `errcode`) | any | `INTERNAL_ERROR` | 500 |

Every response from every one of the ten routes is `{"error_code": "<constant above>", "error":
"<fixed text or a Flask-authored field-required message>"}` — never `exc.message`, never the raw
`errcode`, never a table/column/function name. `server.py`'s own `_RPC_ERROR_MAP` and
`_ERROR_MESSAGE` dicts are the single source of truth; the route tests
(`test_customer_family_mutation_routes.py`) inject a Postgres message shaped like a real leak
(schema-qualified table, column, function name, the SQLSTATE itself) for **every** mapped code, not
only the unmapped case, and assert none of that text reaches the response body — 127/127.

The 400-vs-422 ambiguity the first draft flagged for `22023` no longer exists: the "required field"
checks are Flask-side validation that runs *before* any RPC call (so they never produce a `22023` at
all in the routes as implemented — the DB's own `22023` "a Family name is required" style checks are
unreachable defense-in-depth, since Flask already refused a blank field), and every DB-raised `22023`
that does occur is uniformly `TRANSITION_NOT_ALLOWED` (422).

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

## 9. Frontend actions — implemented

Per the required mutation scope: propose/edit Family, approve, add/edit/retire alias, merge, reassign
with effective dating, graduate a Prospect "where it belongs naturally on the Family surface" — i.e.
as actions on `CustomerFamiliesScreen.jsx`'s existing read-only rows, not a new screen. The broader
Customer/Prospect mutation UI stays out of scope, per the standing instruction — see the follow-on
authorisation packet for that work, requested and delivered separately after this slice's closure.

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

**Route — implemented, strengthened under U1-CF-C2 (127 checks).**
`quote-gen-be/tests/test_customer_family_mutation_routes.py`, same hermetic fake-client convention as
`test_customer_families_route.py`: anonymous 401 on all ten routes; each route's well-formed success
path calls exactly the expected RPC, with the caller's own token and the exact expected parameters
(`reassign`'s optional `p_effective` included, both present and omitted); a missing/blank required
field is refused 400 with `error_code: "INVALID_INPUT"` before any RPC is attempted; each mapped
Postgres error code (`42501`/`P0002`/`40001`/`22023`/`22007`) is exercised by injecting a message
**shaped like a real leak** — a schema-qualified table name, a column name, a function name, and the
SQLSTATE itself — and asserting none of it, nor any fragment of it, reaches the response body, for
every mapped code, not only the unmapped one; each response's `error_code` and message are asserted
to equal `server.py`'s own fixed constants exactly (proving the response is backend-authored, not a
passthrough that merely lacks today's leak strings); `server.py._RPC_ERROR_MAP`'s full key set is
asserted to be exercised here, catching a code added to one dict and not the other; no route uses the
service-role client. (Wrong-plant/wrong-group/inactive-caller behaviour is proved once, at the
authoritative layer, by `tests.customer_family_mutations()` above — a route-level fake cannot
exercise RLS/capability grants meaningfully, only prove the route forwards the caller's own token and
does not pre-empt the database's decision, which it does not.)

**Frontend — implemented.** `CustomerFamiliesScreen.jsx` now offers all nine actions on its existing
rows; request-body shapes and confirm-dialog copy live in `src/lib/customerFamilyActions.js`, proven
by `scripts/customer-family-actions-fixtures.mjs` (28 checks, the `npm run test:family-actions`
convention). `CapabilityGate` was extended to accept an array of capabilities for OR semantics
(propose/prospect-create's `manage_customer_master` **or** `make_quote`). All 7 standing frontend
gates, lint (66/0 ceiling held) and build pass. The app was verified to boot cleanly in a real
browser (Vite HMR, zero console errors) after a stale backend dev server — found running the
pre-slice code — was restarted; no test credentials were available in this session to exercise the
mutation flows interactively, so that rests on the DB/route/probe layers instead.

**HTTP probe matrix — implemented and run live, three times.** `U1_FAMILY_B_RPCS` added to
`quote-gen-be/tests/http_probe_matrix.py`, one entry per newly exposed public RPC. First run
(`--anon-only`, before the Flask routes existed): 108/108. Second run (full matrix, after G-B — see
§12): **182/182** (172 pre-slice + 10 new RPCs), including the authenticated personas and the
two-session lock-race test, teardown clean. Third run, after U1-CF-C1 (§13), adds a `service_role`
probe per wrapper — calling each RPC with the service-role key exactly the way fixture setup does,
over real PostgREST, expecting the same refusal shape as `anon`: **118/118**, all ten `service_role`
calls refused `403 {"code":"42501",...}`, direct HTTP-level confirmation on top of the catalog
evidence in §13.

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

An eleventh migration, `20260907122440` (`family_b_mutations_fix_unindexed_approved_by_fk`), was
added after G-B (§12) surfaced a genuine performance-advisor finding: `customer_families.approved_by`
had no covering index, the one place this slice fell short of the standing discipline that every
foreign key is index-covered (S6 Family F's `BF-5` asserts exactly this for its own tables). Additive
only — one `CREATE INDEX IF NOT EXISTS`.

A twelfth and thirteenth migration were added under the U1-CF review correction round (§13):
`20260907125813` (`family_b_mutations_revoke_service_role_execute` — explicit `service_role` revoke
on all ten wrappers plus a forward-only default-privilege fix) and `20260907130316`
(`family_b_mutations_restore_cfm26_service_role_check` — CFM-26 restored to assert `service_role` has
no `EXECUTE`, alongside `anon`, in the same assertion). Both additive/corrective only; no structural
workflow function changed, so G-B was not re-run for this round (§13).

Nothing in `app_private` from before this slice was altered except the two changed signatures noted
above (both previously unreachable — no public wrapper existed for either, confirmed by the original
S6-era search before this slice began), so no other caller anywhere in the codebase needed updating
except the two found by running the full suite (`tests.fixtures_matrix()`, patched in the tests
migration itself, and `tests.batch_workspace()`, patched in `072420`).

## 12. G-B — full destructive replay, run at this slice's closure boundary

Required by the binding decision: this slice adds governed database entry points and migrations, so
G-B was re-run at closure, preserving identities/grants/invitations/settings exactly, same method as
the S7 closure run (`data-model-s7-closure-evidence.md` §9.6).

**Structural change from the S7-era method.** `tests._finish()` never resets pgTAP's `plan()` state
— confirmed by reading its body, not assumed — so `tests.run_all()` can be called at most **once per
database session**. The empty-replay check and the post-restoration check must therefore be two
separate sessions, not two calls inside one transaction. This splits the run into three sequential
steps rather than the one all-in-one script the S7 phrasing could be read as describing (re-reading
that record's own wording — "drop, sweep, schema drop, empty-state assertion, migration replay,
post-replay guard" — it never actually claims restoration was in the same commit either, so this is
a clarification of the method, not a deviation from it):

1. **Drop + replay + empty-state verification**, one transaction, committed: pre-drop `auth.users`
   guard; drop the event trigger, 41 named `public` tables (`CASCADE`), the `app_private`/
   `ref_private`/`tests` schemas (`CASCADE`), and every remaining non-extension `public` function via
   a dynamic `pg_proc`/`pg_depend` sweep; an in-transaction guard asserting zero relations, zero
   functions, zero of the three schemas and zero `ensure_rls` before replay; all **130** migrations
   replayed in version order (126 bodied, read directly from `supabase_migrations.schema_migrations`
   — never in the drop set; 4 bodyless repair rows staged from local files and MD5-verified byte-exact
   beforehand: `8dfd002b…`, `eccd19cf…d197`, `8fdc6f73…e487`, `53f6be9d…f5fc`, all matching); a
   post-replay guard (`auth.users` unchanged, `app_users` empty); `tests.run_all()` on the empty
   replay asserted **zero `not ok` lines and exactly 821** (783 pre-slice + 38
   `customer_family_mutations`, catching a silently-lost suite the same way S7-4/S7-5 did); a
   synthetic-fixture sweep and a final `auth.users` re-check. Committed with no error.
2. **Restore governed identities**, a separate transaction, committed: `app_users`,
   `group_capability_grants`, `plant_capability_grants`, `app_private.pending_invitations`,
   `operational_settings` re-inserted with `OVERRIDING SYSTEM VALUE` (explicit ids preserved, not
   renumbered) from a pre-drop capture; sequences bumped past the restored maxima; verified in the
   same transaction: exact row-for-row match on all five tables, `plants`/`capabilities` reseeded
   identically (byte-exact id+key match against the pre-drop capture, not merely trusted from
   precedent), zero orphans either direction between `auth.users` and `app_users`, `granted_by`
   present on every one of the 12 plant grants.
3. **Re-verify**, read-only: `tests.run_all()` on the restored state — **zero `not ok`, exactly 821**
   again — then a final `auth.users` guard.

| Measure | Result |
|---|---|
| `auth.users` | **2 — unchanged throughout** (checked before the drop, after the replay, after each `run_all()`, and at the very end) |
| Migrations replayed | **130 / 130** |
| `tests.run_all()`, empty replay | **821 / 821, 0 failures** |
| Identity restore | **app_users 2, group_capability_grants 1, plant_capability_grants 12 (`granted_by` intact), pending_invitations 1, operational_settings 1 — exact match on every column, including id** |
| `plants` / `capabilities` reseed | **byte-identical** (3 plants, 13 capabilities, same ids) |
| Orphans | **0** |
| `tests.run_all()`, restored state | **821 / 821, 0 failures** |
| G-A, re-run | **130 local ⇄ 130 remote**, 126 bodied, fingerprint `304c36f6f6af6741a3266ab13e27b33a` — identical to the pre-replay figure |
| Backend acceptance suites | **275 pass** (25 caller-context / 14 capability-shape / 13 customer-families route / 77 mutation routes / 66 email+plants / 28 first-sign-in / 29 multi-plant / 23 route caller-context) |
| HTTP probe matrix | **182 / 182**, 0 failed, teardown clean (172 pre-slice + 10 new U1 RPCs) |
| Frontend | all 6 gates + lint (66/0) + build pass |
| Security advisors | **2 — the accepted carry-forwards, unchanged** (leaked-password WARN; `email_change_audit` RLS-no-policy INFO) |
| Performance advisors | **1 new finding, fixed within this closure** (`customer_families.approved_by` unindexed FK — §11's eleventh migration); 15 INFO `unused_index` on empty/low-traffic tables, no other finding |
| `gb_scratch` | **dropped** after every verification above completed; 0 residue |

**No genuine defect was found in the replayed schema itself** — the one finding (the unindexed FK)
was a real gap in this slice's own schema migration, not a replay defect, fixed in place per §11.

## 13. U1-CF review correction round — U1-CF-C1 … U1-CF-C4

The Product Owner's review of this slice's first closure report found two real defects the report's
own claims did not survive catalog evidence, one mislabelled next-stage recommendation, and one
implementation-process deviation worth a factual record. All four addressed before this slice is
considered closed.

### U1-CF-C1 — `service_role` held a real, direct `EXECUTE` grant

The first closure report's §2 claimed the ten wrappers were "revoked from public/anon, granted only
to authenticated." That was incomplete: `service_role` was never named in the original grant/revoke
DO block at all, and catalog evidence (`pg_proc.proacl`, `pg_default_acl` — see §2's corrected text
and table) showed it held a **direct** grant, sourced from a platform default privilege applied at
`CREATE FUNCTION` time. Fixed with an explicit revoke on all ten wrappers plus a forward-only default-
privilege correction (`20260907125813`), CFM-26 restored to assert it (`20260907130316`), and a new
live HTTP probe per wrapper proving the refusal over real PostgREST (118/118, §10). BYPASSRLS and
function `EXECUTE` are different controls — the first draft's §2 conflated them, and that conflation,
not a documentation typo, is what let the gap stand unnoticed through the original closure.

### U1-CF-C2 — raw Postgres exception text was reaching the client

`_rpc_call()` returned `exc.message` for every mapped `errcode`. Fixed with an application-owned
`{error_code, error}` shape backed by fixed, backend-authored text (§6, corrected); the database's own
message and SQLSTATE are logged server-side only (`app.logger`), never returned. Proven for every
mapped code, not only the unmapped case, by injecting a message shaped like a real leak and asserting
none of it — table name, column name, function name, or the SQLSTATE itself — reaches the response
(127 route checks, §10).

### U1-CF-C3 — next-stage designation corrected

The first closure report's recommendation named "U3: Construction/SKU master mutations" as the
suggested next slice. The canonical sequence is **U2 — Product and Specification Masters, U3 —
Commercial Masters and Pricing Basis, U4 — Durable Batch Workspace, U5 — Quote Workflow, U6 — Export
and Audit** — Construction/SKU masters are U2, not U3. More materially, the recommendation should not
have pointed at U2-series work at all: broader Customers/Prospects, Customer Locations, and their
integration with Batch Entry are outstanding **U1** acceptance components, not a jump ahead to the
next major stage. Neither error was written into this packet itself (§0–§12 above never named a
U-series stage); both were confined to the closure report text, corrected there.

### U1-CF-C4 — implementation-process deviation, recorded factually

During this slice's original build, `tests.batch_workspace()` was patched directly against the live
database (a self-verifying `regexp_replace` against `pg_get_functiondef`, raising if the substitution
did not match exactly once) to fix its two stale `reassign_party_family()` call sites, **before** a
migration file recording that change existed. The corresponding migration
(`20260907072420_family_b_mutations_fix_batch_workspace_reassign_calls.sql`) was written and applied
*afterward*, transcribing the already-live definition rather than the live state deriving from the
migration.

- Live state temporarily preceded the local migration artefact for this one function.
- The final live body was subsequently captured byte-exact into the migration file (MD5-verified
  against the live `pg_get_functiondef` output at the time).
- Local/remote parity was restored — confirmed by every G-A run since, including the two in this
  correction round (§13's own migrations included).
- G-B (§12) proved the migration chain reproduces the live state from a genuine empty replay — the
  patched function's final form is exactly what 130 migrations, applied to nothing, produce.
- **Direct live patching is not precedent for subsequent slices.** Every migration in this
  correction round (U1-CF-C1/C2) was applied via `apply_migration`, which records the migration row
  and applies the DDL as one atomic operation — live state never preceded its migration artefact for
  either fix.

### G-B — not re-run for this round

Per the closure instruction's own carve-out: a second destructive G-B is required only if a correction
changes a structural workflow function or reveals a replay divergence. This round's two migrations are
privilege-only (`125813`) and a test-suite assertion correction (`130316`) — no structural workflow
function changed, and G-A remained exact in shape (133 local ⇄ 133 remote, 129 bodied) both before and
after. G-B was not re-run; the evidence in §14 (below) is the full-focused re-verification the
correction instruction asked for instead.

## 14. Final focused verification, after U1-CF-C1 … U1-CF-C4

| Check | Result |
|---|---|
| `tests.customer_family_mutations()` (via `run_all()`) | CFM-26 restored, asserts `anon` **and** `service_role` both lack `EXECUTE` on all ten wrappers; passes |
| `tests.run_all()`, exact count | **821 / 821, 0 failures** (unchanged — CFM-26's condition was widened in place, no assertion added or removed) |
| Backend mutation-route tests | **127 / 127** (`test_customer_family_mutation_routes.py`, strengthened per §10) |
| HTTP probes for the ten wrappers | **118 / 118** (anon + the new `service_role` probe, live) |
| G-A | **133 local ⇄ 133 remote**, 129 bodied, fingerprint `dbcd66bc2e5c49a3d06edfda4ee12370` |
| Frontend family-action fixtures | **28 / 28**, unaffected (pure request-body/copy logic, no backend error-shape dependency) |
| Lint / build | 66/0 ceiling held; build passes |
| Security advisors | **2 — the accepted carry-forwards, unchanged** |
| Performance advisors | **1 new `unused_index` INFO** on `ix_customer_families_approved_by` (a fresh, correctly-created index — not a finding requiring action) plus the same 14 pre-existing INFO entries; no unindexed-FK finding |
| `BatchProfileBar.jsx` | untouched (uncommitted hunk preserved throughout this round) |
| `docs/commercial-intelligence-decisions.md` | unread, unstaged, still untracked |
| Push | nothing pushed in either repo (no upstream configured on either working branch) |

**The Customer Family mutation slice is closed as of this correction round.**

---

**Superseded sections removed:** the first draft's §2 (wrapper code samples for a since-abandoned
2-argument `merge_families`/3-argument `reassign_party_family` shape) and §7 (three-route plan for
only Merge/Reassign/Graduate) are replaced in full by §§1–2 and §8 above; nothing from the original
code samples survives unchanged into the implementation.
