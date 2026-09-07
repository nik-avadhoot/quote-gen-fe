# U1 — Customer Family mutations: implementation packet

**Date:** 2026-09-07. **Status: planning only. No wrapper migration, Flask route or frontend action
is implemented by this document** — it is the packet the post-U1-correction handover asked for
before that work is authorised.

**Scope note, corrected from the U0 report's first draft:** not every Customer Family mutation is
architecturally blocked. Reading `pg_policies` directly (not assumed) shows two different gaps:

| Operation | Governed path today | Gap |
|---|---|---|
| **Propose a new Family** (Maker, `status='proposed'`) | Direct `INSERT` on `public.customer_families`, RLS `WITH CHECK` already permits it for any caller holding `make_quote` at any plant, **or** `manage_customer_master` | **None.** A thin Flask POST route is enough — no new SQL. |
| **Quick-create a Prospect** (Maker, `status='proposed'`, `lifecycle_state='prospect'`) | Direct `INSERT` on `public.parties`, same RLS shape | **None.** Same as above. |
| **Approve a Proposed Family / edit name / aliases** | Direct `UPDATE` on `public.customer_families` / `customer_family_aliases`, RLS gated by `manage_customer_master` | **None.** A thin Flask PATCH route is enough — no new SQL. |
| **Merge two Families** | `app_private.merge_families(p_survivor, p_retired)` — exists, tested, SECURITY DEFINER, checks `manage_customer_master` internally | **Real.** No `public` wrapper; unreachable by any caller today. |
| **Reassign a Party's Family membership** | `app_private.reassign_party_family(p_party, p_new_family, p_effective)` — same shape | **Real.** Same gap. |
| **Graduate a Prospect to a Customer** (mints the permanent Customer Code) | `app_private.graduate_party(p_party)` — same shape | **Real.** Same gap. |

This packet covers only the three real gaps. Propose/approve/edit need no migration and are not
re-litigated here.

---

## 1. Existing `app_private` operations — read from the live database, not assumed

All three are `SECURITY DEFINER`, `SET search_path TO ''` (fully schema-qualified inside, the
established hardening pattern), and already enforce `app_private.has_group_cap('manage_customer_master')`
as their first statement — a caller-supplied JWT reaching them through a wrapper would be refused
the same way regardless of what the wrapper does.

- **`merge_families(p_survivor bigint, p_retired bigint) returns void`** — locks both rows
  (`for update`), refuses `p_survivor = p_retired` (`22023`), copies the retired family's name into
  `customer_family_aliases` on the survivor (idempotent via `on conflict … do nothing`), sets the
  retired family `status='retired'`, `surviving_family_id=p_survivor`, bumps `content_version`.
  **No CAS parameter** — it does not accept or check an expected `content_version` on either side;
  the row lock is the only concurrency control.
- **`reassign_party_family(p_party bigint, p_new_family bigint, p_effective date default
  current_date) returns void`** — locks the Party and its current membership row, no-ops if already
  in the target Family, refuses an effective date before the current membership started (`22007`),
  closes the current membership (`is_current=false`, `effective_until=p_effective`) and inserts the
  new one. **No CAS parameter** either.
- **`graduate_party(p_party bigint) returns text`** — locks the Party, is **idempotent** (returns the
  existing code unchanged if already a customer), requires a current Family membership and that
  Family to already hold a `group_customer_code` (both `P0002` otherwise), allocates a sequence via
  `ref_private.allocate_reference('customer', family_id, null)`, mints `{family_code}-{seq:03d}`,
  sets `lifecycle_state='customer'`, `status='active'`, `customer_code`, bumps `content_version`.
  Returns the minted code.
- **`allocate_group_customer_code() returns text`** — `SECURITY DEFINER`, **no capability check of
  its own** (it is a low-level sequence-allocation helper, not an end-user operation) — mints
  `G{seq:04d}` via `ref_private.allocate_reference('group_customer', 0, null)`. Only meaningful as
  part of Family *creation*, which (per the table above) is a direct RLS-gated `INSERT` — so this
  function's caller would be a **new** `propose_customer_family()` wrapper if the Product Owner
  wants the permanent code minted atomically at proposal time, or left to a separate `manage_
  customer_master`-gated step later. **This packet does not resolve that design question — see §8.**

Existing DB-layer coverage: `tests.party_masters()` (from `20260904144336_p2_3_family_b_regression_tests.sql`)
and the fixtures added in `20260904145607_p2_4_persona_and_lifecycle_tests.sql`. Re-run as part of
`tests.run_all()` (currently 783/783) before and after the wrapper migration — a wrapper must not
require touching these functions' bodies at all, so a passing `tests.run_all()` after the migration
is the first evidence nothing at the authority layer moved.

## 2. Minimum public invoker wrappers required

Following the established P2-6 pattern already used for `is_admin()`-style helpers (SECURITY
DEFINER in `app_private`, thin `public` shim so PostgREST can route to it under the caller's own
token):

```sql
create or replace function public.merge_customer_families(p_survivor bigint, p_retired bigint)
returns void
language sql
security invoker
set search_path = ''
as $$
  select app_private.merge_families(p_survivor, p_retired);
$$;

create or replace function public.reassign_customer_family(
  p_party bigint, p_new_family bigint, p_effective date default current_date)
returns void
language sql
security invoker
set search_path = ''
as $$
  select app_private.reassign_party_family(p_party, p_new_family, p_effective);
$$;

create or replace function public.graduate_customer_party(p_party bigint)
returns text
language sql
security invoker
set search_path = ''
as $$
  select app_private.graduate_party(p_party);
$$;
```

`SECURITY INVOKER` on the shim is correct and deliberate — the shim itself does nothing privileged;
it exists only so PostgREST can route an RPC call to a `public`-schema name. All three fail closed:
if `manage_customer_master` is absent, `app_private.*` raises `42501` before any row is touched,
and the shim propagates that exception unchanged (`security invoker` + `language sql` does not
swallow exceptions).

**Grants:** `grant execute on function public.merge_customer_families(bigint, bigint) to
authenticated;` (and the same for the other two). No grant to `anon`. No grant to `service_role`
needed — the caller's own token reaches the function via PostgREST exactly as every other converted
route does.

**No new table grant, no RLS change.** The wrapper does not touch RLS at all — `app_private.*`
already runs as the function owner (`SECURITY DEFINER`) and the capability check happens in
PL/pgSQL, not through a policy. This is the same shape as every other converted-RPC slice (Family
C's `propose_construction`, Family D/E's `propose_pricing_basis_release`) — nothing novel is being
introduced.

## 3. Caller and capability checks

Already complete inside `app_private.*` — the wrapper adds none and must not duplicate the check
(duplicating it would create two places that could drift, exactly the D-27/S6-14 class of defect
this codebase has already paid for once). The Flask route's only job is to forward the caller's
token via `get_supabase_for_caller(g.access_token).rpc(...)`, read the RPC's result or exception,
and translate a `42501`/`P0002`/`22023`/`22007` Postgres error into the right HTTP status — the same
translation `_apply_role_and_plant` and the other RPC-calling routes already do.

## 4. Atomicity

Each function is already one PL/pgSQL block — Postgres wraps it in an implicit transaction, so
`merge_families` cannot leave the alias inserted without the retirement applied, and
`reassign_party_family` cannot leave the old membership closed without the new one inserted. The
wrapper adds no additional statements, so it introduces no new atomicity surface. **The Flask route
must call the RPC exactly once and not attempt to compose several RPC calls into one HTTP request**
(e.g. "graduate then reassign" must be two requests, two undo points) — composing them would move
atomicity into application code, which CDM/D-27 precedent says not to do.

## 5. Conflict / CAS behaviour — the one real design gap

Neither `merge_families` nor `reassign_party_family` accepts an expected `content_version`. Both
take a row lock (`for update`), so two concurrent calls serialise correctly and neither corrupts
data — but the **second** caller's request silently succeeds against whatever the first caller left
behind, with no "this changed since you loaded it" signal. That is different from `revise_batch_
profile`'s established CAS shape (S6-C2) and from the stale-write discipline the U1 shared
foundation's `StaleState` component exists to surface.

**Recommendation, not yet decided:** add an optional `p_expected_content_version` parameter to both
`app_private` functions (a small, additive change to already-tested code, not a rewrite) that raises
`40001` when the locked row's `content_version` does not match — mirroring `revise_batch_profile`
exactly. This is a Product Owner / SR DEV design decision for the actual migration session, not
resolved here. If declined, the frontend must instead re-fetch and compare before showing a merge/
reassign confirmation, and accept that a genuine race is possible (rare, since both are
`manage_customer_master`-gated administrative actions, not high-frequency Maker writes).

`graduate_party` needs no CAS — it is already idempotent (returns the existing code unchanged on a
second call), so a race produces the same correct result twice, not a conflict.

## 6. Permanent-code and lineage preservation

Already correct in the existing functions, verified by reading the bodies, not assumed:
- `merge_families` never deletes the retired Family row or renumbers `customer_families.id` —
  it sets `status='retired'` and `surviving_family_id`, so every historical reference (a Party's old
  membership rows, any exported document) keeps resolving. The retired name becomes a searchable
  alias on the survivor rather than being lost.
- `graduate_party` mints `customer_code` **once** (idempotent short-circuit) — a Party's permanent
  Customer Code, once minted, cannot be reassigned by calling this function again.
- `allocate_group_customer_code` / `allocate_reference('customer', …)` both go through
  `ref_private`'s existing reference-sequence machinery (the same one every other permanent code in
  the accepted model uses) — no bespoke numbering scheme is introduced.

## 7. Required Flask routes

Three POST routes, same `@require_auth` + `get_supabase_for_caller(g.access_token).rpc(name, params)`
shape as the existing `/admin/users` POST (which already calls `admin_create_app_user` this way):

- `POST /masters/customer-families/merge` — body `{survivor_id, retired_id}`
- `POST /masters/customer-families/reassign` — body `{party_id, new_family_id, effective_date?}`
- `POST /masters/customer-families/graduate` — body `{party_id}`

Each: validate the body shape (integers/date, not RLS's job), call the RPC, map `42501` → 403,
`P0002` → 404, `22023`/`22007` → 400 with the Postgres message (these messages name no table or
column, safe to surface — read them before deciding, per the existing `_valid_email`-style
discipline), anything else → 500 with no detail leaked. Return the RPC's result (`graduate` returns
the new code; `merge`/`reassign` return nothing — respond `{"ok": true}`).

## 8. Frontend actions and confirmation flows

- **Merge**: two-step confirm ("Merge {retired.name} into {survivor.name}? This cannot be undone.")
  — irreversible per the schema (no un-merge function exists), so the UI must say so, not just ask
  "are you sure?". Read-back: re-fetch `/masters/customer-families` and show the retired Family's
  new `LifecycleBadge` (retired) and its alias now under the survivor.
- **Reassign**: date picker defaulting to today, refuse a past date client-side too (cheap, the
  server still refuses authoritatively) with the same `22007` message. Read-back: the Party's row in
  `VersionHistory` gains a new entry, the old one gains its `effective_until`.
- **Graduate**: single confirm, shows the minted code in the success toast (the code is not
  guessable in advance and the user needs to see it once, same reasoning as `CredentialModal` for a
  reset password). Disabled (via `CapabilityGate`) when the Party has no current Family or that
  Family has no `group_customer_code` — mirror the RPC's own `P0002` conditions client-side as a
  usability hint, not as the actual guard.
- All three actions go through `CapabilityGate` gated on `manage_customer_master`, and through
  `classifyResponse()` so a `403` reads as access-denied and a `400`/`404` reads as validation, per
  the existing `lib/backendError.js` contract.

## 9. Positive and negative tests

**Database** (extend `tests.party_masters()` or a new suite, same file convention as every other
Family): merge survivor/retired both exist, alias created, retired row intact with
`surviving_family_id` set, `content_version` bumped, self-merge refused `22023`, without
`manage_customer_master` refused `42501` before any row changes; reassign happy path, no-op when
already in target family, past-effective-date refused `22007`, nonexistent party `P0002`; graduate
happy path mints the expected code shape, second call is idempotent (same code, no new sequence
consumed), missing family membership `P0002`, family without a code `P0002`.

**Route** (same hermetic fake-client pattern as `test_customer_families_route.py`): each of the three
routes — anonymous 401, no-capability 403 with no RPC call attempted, success path calls the RPC
with the caller's own token and returns the expected body, each Postgres error code maps to the
right HTTP status, no service-role client used.

**Frontend**: `classifyResponse` already covers 403/400/404 shape (no new test needed there);
one fixture-script scenario per action confirming the confirm-dialog copy names the right entities
and the read-back re-fetch fires after a 200.

## 10. Rollback and migration treatment

Additive only — one migration creating three `public` functions and their grants, nothing dropped,
nothing altered in `app_private`. Rollback is `drop function public.merge_customer_families(bigint,
bigint);` etc. — safe at any time, since no other object depends on the wrappers (PostgREST is the
only caller, and dropping them just makes the RPCs unroutable again, back to today's state). If the
CAS addition from §5 is accepted, that migration touches `app_private.merge_families` and
`app_private.reassign_party_family` signatures (`create or replace`, additive optional parameter —
existing callers with no version supplied keep today's unconditional behaviour) and must re-run
`tests.party_masters()` before and after, same as any other function edit in this codebase.

---

**Not implemented.** This is the design the next authorised session should review and, if accepted,
turn into one migration + one Flask commit + one frontend commit, gated exactly like every other
`manage_customer_master` action.
