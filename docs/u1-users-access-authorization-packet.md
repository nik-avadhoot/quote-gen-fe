# U1 Users/Access — authorisation packet

**Status:** revision 2 authorised, and **UA-1 + UA-3 + UA-4 are CLOSED** — implemented,
automated-test verified, browser verified, technically closed and **Product Owner validated on
2026-09-08**. See §11. **UA-5, UA-6 and UA-7 remain open and unauthorised**; Users/Access as a whole
is *not* closed, and neither is U1.

Revision 2 applies the Product Owner's corrections A-J: a mandatory `content_version` concurrency
contract (§2.1), the exact `p_plant_caps` payload (§2.2), a last-active-administrator invariant
covering every path (§2.3), closure of the direct grant-table write bypass (§2.4), replacement rather
than coexistence of the legacy mutation sequence (§2.5), reconciliation against the real error map
(§2.6), read-contract verification (§3), corrected slice sequencing (§4), a Producing Plants cleanup
safeguard (§5) and the expanded test set (§7).

**Sequencing accepted (Product Owner, 2026-09-08):** Users/Access is the next visible increment. It
is unfinished **U1** work. S8 matters for U4 but does not block it; if a genuinely separate backend
lane exists S8 may run in parallel, otherwise Users/Access → S8 → U2. U2 is not the next incomplete
U1 work and is not relabelled as such.

---

## 0. The headline finding, stated first because it changes the shape of the work

**Users/Access is not presentation-only.** The U0 discovery report recorded its backend as *"None —
fully covered… U1 work here is presentation, not new backend"*, and I repeated that in an earlier
report. **Both are wrong**, and this packet does not proceed on that assumption.

Verified against `pg_proc`, `pg_policies` and `server.py`, not assumed:

- There is **no** `app_private` function, **no** `public` wrapper and **no** Flask route that grants
  or revokes a capability. None. The grant tables carry RLS policies permitting `authenticated`
  holders of `administer_users` to `INSERT` and to `UPDATE` a row to `status='revoked'` — so the only
  existing path is a **direct table write**, which is precisely what must not be treated as the
  application workflow.
- `PATCH /admin/users/<id>` reaches those tables through `_apply_role_and_plant()`, which can express
  exactly two things: the group capability `administer_users` (on/off, via `role == "admin"`), and
  per plant `plant_access` **+ one** operational capability (`make_quote` **or** `check_quote`).
- **Nine of the thirteen capabilities in `public.capabilities` cannot be granted or revoked by any
  application workflow at all** — including every group capability the Product Owner named.

| Capability | Scope | Manageable today? |
|---|---|---|
| `administer_users` | group | Yes — only as a side effect of `role = "admin"` |
| `read_party_master` | group | **No** |
| `manage_customer_master` | group | **No** |
| `read_construction_library` | group | **No** |
| `manage_construction_library` | group | **No** |
| `declare_cutover` | group | **No** |
| `plant_access` | plant | Yes — implied by any plant assignment |
| `make_quote` | plant | Yes — only via `role = "maker"` |
| `check_quote` | plant | Yes — only via `role = "checker"` |
| `adopt_construction_for_plant` | plant | **No** |
| `approve_commercial_master` | plant | **No** |
| `propose_commercial_master` | plant | **No** |
| `manage_sku_master` | plant | **No** |

That is how `NikunjRL` and `ClaudeCode` came to hold the development capability union: **direct
database writes during setup**. There is no way to reproduce that for a real user through the
application, and no way to revoke it either.

Two further facts, verified for revision 2 and load-bearing for §2.4:

- `authenticated` holds **`INSERT, SELECT, UPDATE`** on both grant tables. The write privilege is
  real, not merely policy-permitted, so closing the bypass requires a `REVOKE` as well as a policy
  drop.
- RLS is **enabled and FORCED** on all five tables, which are owned by `postgres` — and `postgres`
  holds **`rolbypassrls`**. `SECURITY DEFINER` functions owned by it therefore bypass RLS entirely,
  so dropping the `authenticated` write policies **cannot** break `admin_create_app_user`. That is an
  assumption the tests must still prove rather than assert.

A second, independent defect in the same code path: `_apply_role_and_plant()` issues its revokes and
inserts as **separate PostgREST statements**, each its own transaction. A failure part-way leaves a
user holding a partially-applied capability set while the route may still answer 200. `POST
/admin/users` was deliberately fixed for exactly this hazard (one RPC, one transaction); the PATCH
path was not.

---

## 1. Gap matrix

Columns: canonical requirement · `app_private` function · `public` wrapper · Flask route · frontend
control · capability + scope · status · **exact missing layer**.

Status vocabulary per design plan §2.1 item 7: **I**mplemented, **T**ested, **V**isible, **C**losed.

### A. Identity and lifecycle

| # | Requirement | app_private | public | Route | Frontend | Capability | Status | Missing layer |
|---|---|---|---|---|---|---|---|---|
| 1 | **User list / search / detail** | — (RLS `app_users_select`) | — | `GET /admin/users` | `UserManagementTab` table | `administer_users` (via derived `admin`) | I,T,V — **not C** | No search/filter; no detail view; no loading/empty/denied/stale states; nav gated on derived role, not capability |
| 2 | **Invitation** | `provision_pending_invitation(email, name, grant_admin)` | **none** | **none** | **none** | `administer_users` | Not I | **public wrapper + route + UI.** `app_private.pending_invitations` exists and is written by nothing reachable |
| 2b | Resend / recovery of an invitation | — | — | — | — | — | Not I | Whole feature. No resend concept exists |
| 3 | **Activate / deactivate** | `admin_set_user_status` | `admin_set_app_user_status` | `PATCH /admin/users/<id>` `{active}` | Toggle in `UserRow` | `administer_users` | I,T,V — **not C** | Self-deactivation guard is route-only; no confirmation; no visible consequence explanation |
| 4 | **Login-email administration** | `admin_prepare_email_change`, `record_email_change`, `revoke_user_sessions` | all three | `PATCH /admin/users/<id>/email`, `POST /auth/me/email` | `EmailChangeModal` | `administer_users` | I,T,V — **not C** | No visible history of past changes (audit table is `app_private`, unexposed) |
| 5 | **Credential management boundaries** | — | — | `POST /admin/users/<id>/reset-password` | `CredentialModal` shows a temp password | `administer_users` | I,T,V — **not C** | Temp password is displayed in-app; no policy statement, no forced rotation, no "copy once" boundary |
| 10 | **First-admin / bootstrap** | `bootstrap_app_user` | `bootstrap_app_user` | implicit in `/auth/login` | none (invisible) | none (self) | I,T — **not V** | No UI or explanation; an administrator cannot see that bootstrap happened |
| 10b | **Orphaned-auth recovery** | — | `admin_emails_with_open_invitation` | `GET /admin/auth-orphans`, `POST /admin/users/adopt` | **none** | `administer_users` | I,T — **not V** | **Frontend only.** Two working routes with no screen |

### B. Access and capability

| # | Requirement | app_private | public | Route | Frontend | Capability | Status | Missing layer |
|---|---|---|---|---|---|---|---|---|
| 6 | **Multiple Producing Plant assignments** | — (RLS + `enforce_active_plant_grant` trigger) | — | `PATCH /admin/users/<id>` `{plants:[…]}` | `PlantPicker` | `administer_users` | I,T,V — **not C** | Direct table writes, not a governed operation; **non-atomic** across revokes/inserts |
| 7 | **Plant-scoped grants and revocation** | **none** | **none** | partial — only `plant_access` + one operational cap, chosen by role | role dropdown only | `administer_users` | Partly I | **DB function + wrapper + route + UI.** 4 of 7 plant capabilities unreachable |
| 8 | **Group-scoped grants and revocation** | **none** | **none** | **none** except `administer_users` via role | **none** | `administer_users` | Not I | **DB function + wrapper + route + UI.** All five named group capabilities unreachable |
| 9 | **Derived labels vs actual capability sets** | `_derive_role` (caller_context) + `derive_role` (server) | — | reported in every auth payload | role dropdown is the *only* editor | — | I,T,V — **wrong shape** | The UI presents role as the authorization primitive. Capability sets are never displayed. Editing a role silently rewrites grants |

### C. Presentation and correctness

| # | Requirement | Current state | Missing layer |
|---|---|---|---|
| 11 | **Inactive-user / access-denied presentation** | `UserManagementTab` renders a bare red error string; nav hides Users unless derived role is `admin` | `AccessDeniedState`; capability-based nav; inactive-session handling (`isActive`) as `ProducingPlantsScreen` already does |
| 12 | **Loading / empty / error / timeout / stale** | `users===null` renders **nothing**; errors are `err.message`; no `classifyResponse` anywhere in the file | `LoadingState`, `EmptyState`, `AccessDeniedState`, `StaleState` and the D2 outcome vocabulary (denied / stale / **outcome-unknown** / failed). All four components already exist and are used by two other screens |
| 13 | **Capability-aware navigation** | `Sidebar.jsx:36` — `role==="admin"` | `hasCapability(profile,'administer_users')`. The derived label must not gate a screen |
| 14 | **Embedded Plant Master duplication** | `PlantMasterPanel` inside `UserManagementTab` duplicates `ProducingPlantsScreen`; both call `GET /masters/plants` | Confirm no User workflow depends on it (the `PlantPicker` uses the *same* `plants` fetch), then remove the panel and keep the standalone screen |
| 15 | **Audit attribution / history** | `granted_by` / `revoked_by` / `revoked_at` columns exist; `app_private.email_change_audit` exists | Nothing exposes any of it. Grant history display and email-change history are **S10/U6-deferred**; this packet only ensures the columns are *written correctly* by the new operation |

---

## 2. The governed backend addition (UA-3)

Required by gaps 7 and 8. **Authorised in principle, 2026-09-08, subject to the corrections in this
section.** One operation, not five.

### 2.1 Signature and concurrency contract

```
app_private.set_user_capabilities(
  p_app_user                 bigint,
  p_expected_content_version integer,
  p_group_caps               text[],
  p_plant_caps               jsonb
) returns jsonb
```
with the `public.set_user_capabilities` invoker wrapper and
`POST /admin/users/<id>/capabilities`.

**Why a declarative desired set rather than grant/revoke verbs:** the desired state *is* a set. A verb
pair invites two half-applied calls — the exact defect already live in `_apply_role_and_plant`.

**Concurrency is mandatory, not optional.** `app_users.content_version` already exists and is used for
CAS elsewhere; this operation must honour it.

| Requirement | Mechanism |
|---|---|
| Deterministic lock order | **(1)** `pg_advisory_xact_lock(hashtext('administer_users_invariant'))` — serialises the last-administrator check across concurrent edits to *different* users; **(2)** `SELECT … FROM public.app_users WHERE id = p_app_user FOR UPDATE`; **(3)** grant rows touched in `(plant_id, capability_id)` / `capability_id` order. Always this order, so two concurrent administrator edits cannot deadlock |
| Stale rejection | If `content_version <> p_expected_content_version`, `RAISE … USING ERRCODE = 'PT409'`. **Never `40001`** — that is `serialization_failure`, which the Data API retries, and migration `20260908052900` exists precisely because a deliberate conflict raised as `40001` produced a 1,025,464-retry storm and no response at all |
| Atomicity | One RPC = one PostgREST transaction. Every group and plant revoke and insert commits together or not at all |
| Version increment | `content_version` increments **exactly once**, and **only when the effective capability set actually changes** |
| Idempotence | Re-submitting a desired state equal to the current effective state performs no writes and **does not** increment the version. Grant history stays meaningful for U6 |
| Return value | `jsonb`: `{ "content_version": <int>, "group_capabilities": [...], "plant_capabilities": { "<plant_id>": [...] }, "changed": <bool> }` — the resulting version and the resulting effective state, so the client never has to guess or re-read |

**HTTP and frontend contract.** The request carries `expected_content_version`. A `409 STALE_VERSION`
is handled by reloading that user and telling the administrator, in words, that **permissions were
changed elsewhere** — not by a silent retry, and not by re-submitting the same body. The reload shows
the current effective set so the administrator re-decides against what is actually true now.

### 2.2 The `p_plant_caps` payload, defined exactly

**Plants are identified by immutable ID in the database contract, and by `plant_code` at the HTTP
boundary.** The grant table's FK is `plant_id`; a code is a human-facing label. The Flask route
resolves code → id, and the function **re-validates every id as an active plant inside the
transaction**, which closes the window in which a plant is deactivated between the route's lookup and
the write.

HTTP request body:

```json
{
  "expected_content_version": 7,
  "group_capabilities": ["read_party_master", "manage_customer_master"],
  "plant_capabilities": {
    "NAG": ["plant_access", "make_quote"],
    "PUN": ["plant_access", "check_quote"]
  }
}
```

`p_plant_caps` as received by the function — keys are text-encoded `plants.id`, because jsonb object
keys are always text:

```json
{ "12": ["plant_access", "make_quote"],
  "13": ["plant_access", "check_quote"] }
```

| Rule | Definition |
|---|---|
| Permitted keys | HTTP: an active `plants.plant_code`. Function: a text-encoded `plants.id` |
| Permitted values | A JSON array of `capabilities.capability_key` strings whose `scope_kind = 'plant'` |
| `p_group_caps` | A `text[]` of `capability_key` whose `scope_kind = 'group'` |
| Scope mismatch | A group key inside `plant_capabilities`, or a plant key in `group_capabilities`, is **rejected** — not silently relocated |
| Unknown capability key | Rejected |
| Unknown or inactive plant | Rejected. Belt-and-braces with the existing `enforce_active_plant_grant` trigger |
| Duplicates within an array | **Normalised**, not an error: the set is canonicalised as `distinct`, sorted ascending by `capability_key`, before any comparison |
| Duplicate plant keys | Impossible inside one JSON object. At the HTTP boundary, two codes differing only in case are **rejected** as `INVALID_INPUT` rather than silently folded |
| Canonical comparison | Both current and desired sets are canonicalised (distinct, sorted) before diffing, so ordering never causes a spurious version bump |
| **Omitted vs empty** | **Both collections are REQUIRED and must be non-null.** This is a complete replacement of the effective capability set, so there is no partial-update mode to get wrong. `[]` / `{}` mean *"hold none of these"* and revoke everything in that dimension. A `null` or absent collection is **rejected** — it is ambiguous between "clear" and "leave alone", and the UI always has the full current set to send because it just displayed it |

### 2.3 The administrator invariant

Self-demotion protection alone is insufficient, as the correction notes. The invariant is:

> **At least one *active* `app_users` row must hold an *active* `administer_users` group grant.**

It is checked **after** the mutation, inside the same transaction, under the advisory lock from §2.1,
and violation raises `22023`. That covers the three paths that can remove administration authority:

| Path | Change |
|---|---|
| Capability replacement | `set_user_capabilities` enforces it |
| **User deactivation** | `app_private.admin_set_user_status` gains the same check — deactivating the last active administrator is refused |
| Legacy role/update path | Eliminated by §2.4; while it still exists it delegates to `set_user_capabilities` and inherits the check |

Because the check is *"at least one active user holds it"* rather than *"you may not demote
yourself"*, it holds under concurrency and needs **no second real administrator account**: the pgTAP
fixtures mint isolated synthetic identities, exactly as every existing suite does. No live user, grant
or session is touched to prove it.

### 2.4 Closing the direct-write bypass

**An RPC does not create governance while the same caller can still write the tables directly and
choose its own attribution.** Verified, not assumed:

- `authenticated` currently holds **`INSERT, SELECT, UPDATE`** on both grant tables (`app_users`,
  `capabilities` and `plants` are `SELECT`-only).
- Policies `ggrant_insert` / `ggrant_update` / `pgrant_insert` / `pgrant_update` permit exactly that
  for an `administer_users` holder, with `granted_by` / `revoked_by` **supplied by the caller**.

**Inventory of legitimate callers, before changing anything:**

| Caller | Path | Effect of closure |
|---|---|---|
| `app_private.admin_create_app_user` | `SECURITY DEFINER`, owned by `postgres`, which holds `rolbypassrls` | **Unaffected.** It bypasses RLS entirely, including `FORCE`, so dropping the `authenticated` write policies cannot break user creation — *this must still be proven by test, not assumed* |
| `server.py::_apply_role_and_plant` | PostgREST as `authenticated` | **Replaced** by the governed operation (§2.5) |
| Development-time direct writes | PostgREST / SQL editor as an administrator | **Ended.** This is how the current development capability union was created, and it stops being an application path |
| `GET /admin/users` | reads via `ggrant_select` / `pgrant_select` | **Preserved** — read policies are kept |
| Caller-context resolution | reads the caller's own grants | **Preserved** — must be regression-tested |

**The closure migration:**

```sql
REVOKE INSERT, UPDATE ON public.group_capability_grants FROM authenticated;
REVOKE INSERT, UPDATE ON public.plant_capability_grants FROM authenticated;
DROP POLICY ggrant_insert  ON public.group_capability_grants;
DROP POLICY ggrant_update  ON public.group_capability_grants;
DROP POLICY pgrant_insert  ON public.plant_capability_grants;
DROP POLICY pgrant_update  ON public.plant_capability_grants;
-- ggrant_select and pgrant_select are RETAINED: UA-1 and UA-4 read through them.
```

Only after this is the packet entitled to claim trustworthy attribution — because only then is
`granted_by` / `revoked_by` **necessarily** the resolved caller rather than whatever the client sent.

**Security pattern, matching every existing governed operation:** `SECURITY DEFINER`, `SET
search_path = ''` with fully-qualified identifiers, caller resolved through
`app_private.current_app_user()` and `app_private.has_group_cap('administer_users')` inside the
function, and on the public wrapper `REVOKE ALL … FROM PUBLIC, anon, service_role;` then `GRANT
EXECUTE … TO authenticated;` — the explicit `service_role` revoke that `U1-CF-C1/C2` established.

### 2.5 Replacing the legacy mutation sequence

`_apply_role_and_plant()` is **deleted**, not left alongside. There is one permission authority.

- **In UA-3**, `PATCH /admin/users/<id>`'s `role` / `plant` / `plants` branch becomes a single
  delegation: translate the legacy inputs into a desired capability set and issue **one**
  `set_user_capabilities` call. It therefore also requires `expected_content_version` on that branch.
  This is a deliberate route-contract change; the only caller is our own frontend, updated in the same
  tranche.
- **In UA-4**, the editable role field is retired and that branch is removed with it. The derived,
  **read-only** role label remains for usability. An editable role must never silently rewrite
  capability grants — that is the second competing permission model this correction exists to prevent.
- `display_name`, `active` and email administration keep their existing paths, unchanged.

### 2.6 Error mapping — existing codes only

Reconciled against `_RPC_ERROR_MAP` and `_ERROR_STATUS` in `server.py`. **No new code is introduced.**

| Condition | SQLSTATE | `error_code` | HTTP |
|---|---|---|---|
| Caller lacks `administer_users` | `42501` | `CAPABILITY_REQUIRED` | 403 |
| Target user not found | `P0002` | `RECORD_NOT_FOUND` | 404 |
| **Stale `expected_content_version`** | **`PT409`** | `STALE_VERSION` | **409** |
| Unknown capability key / scope mismatch / unknown or inactive plant | `22023` | `TRANSITION_NOT_ALLOWED` | 422 |
| **Last-active-administrator protection** | `22023` | `TRANSITION_NOT_ALLOWED` | 422 |
| Malformed body (missing collection, bad types, duplicate codes by case) | route-level | `INVALID_INPUT` | 400 |
| Genuine concurrent serialization failure | `40001` | `SERIALIZATION_FAILURE` | 409 (retryable) |

Every `RAISE` inside the function uses one of these mapped SQLSTATEs. An unmapped code becomes a bare
`500`, which is exactly how Slice D's `location_type` defect surfaced.

### 2.7 Migrations

Three, each followed by **mandatory G-A**:

1. `set_user_capabilities` function + wrapper + grants; administrator invariant added to
   `admin_set_user_status`.
2. Bypass closure — revokes and policy drops (§2.4).
3. pgTAP suite, registered in `tests.run_all()`.

---

## 3. Read-contract verification (H)

Checked against the actual `GET /admin/users` response, which today emits:
`id, display_name, active, status, role, plant, plants, email, last_sign_in_at`.

| UA-1 / UA-4 needs | Present? | Action |
|---|---|---|
| `content_version` | **No** | Add — required for CAS |
| Effective **group** capabilities | **No** | Emit. The route already computes `group_by_user` and discards it |
| Effective **plant-scoped** capabilities | **No** — only plant *codes* via `plants` | Emit the `{code: [capability_key]}` map. The route already computes `plant_by_user` and discards it |
| Active / inactive state | Yes (`active`, `status`) | — |
| Safe identity information | Yes (`display_name`, `email`, `last_sign_in_at`) | — |

**Smallest read-route correction, in scope for UA-1:** add `content_version` to the `app_users`
select, and emit `group_capabilities` and `plant_capabilities` from the two dictionaries the route
already builds. No new query, no new round-trip, no RLS change — the grant reads already happen.

**Orphan recovery — correcting my own over-restriction.** My earlier draft said the screen must never
display an email. That was wrong and would have made adoption unusable, as the correction says.
`GET /admin/auth-orphans` **already returns** `ref`, `auth_user_id`, `email`, `created_at` and
`last_sign_in_at`, and the list is inherently bounded — only Auth accounts with no `app_users` row
**and** no open invitation — behind `administer_users`. It is a short remediation queue, not a
directory. The screen therefore shows `ref`, email, created and last-sign-in, which is what an
administrator needs to identify the right account. The redaction discipline that stays is the one that
already exists and is about **logs**: the compensation log line carries only the non-reversible `ref`.
If you want it tighter than that, the alternative is server-side exact-email match with no listing —
say so and I will specify it instead.

---

## 4. Slices and order (corrected sequencing)

UA-1 exposes current authority **read-only**. It deliberately does **not** put a polished mutation
experience on top of the known non-atomic backend.

| # | Slice | Backend? | Visible outcome |
|---|---|---|---|
| **UA-1** | Shared loading / empty / error / stale / access-denied states; **read-only** display of each user's actual group and plant capability sets; capability-based nav; the §3 read-route correction | Read-route only | An administrator can finally *see* who holds what, accurately, with honest states. No new mutation surface |
| **UA-3** | `set_user_capabilities` — function, wrapper, route, invariant, **bypass closure**, tests | **Yes**, 3 migrations | Nothing user-visible alone; the gate everything else depends on |
| **UA-4** | Capability editor wired **exclusively** to UA-3; retire the editable role field; delete `_apply_role_and_plant` | No | Administrators grant/revoke all group and plant capabilities atomically, with stale-conflict recovery |
| **UA-5** | Activation/deactivation hardening + last-administrator protection surfaced in the UI | No | Deactivation explains its consequence and is refused for the last administrator |
| **UA-6** | Orphan recovery screen + remaining cleanup | No | Frontend over two proven routes |
| **UA-7** | Remove the duplicated embedded Plant Master panel | No | **Gated — see §5** |

The former UA-2 ("mutation hardening") is **removed**: hardening the multi-call path ahead of the
atomic operation would polish the thing being replaced.

---

## 5. Producing Plants cleanup safeguard (I)

**Do not remove the embedded panel while the standalone tab can be hidden by configuration.**
`Sidebar.jsx:33` mounts Producing Plants only when `isFeatureEnabled("u1_producing_plants")`, and
flags are build-time (`featureFlags.js` reads `VITE_FEATURE_FLAGS` once, inlined by Vite). A build
without that flag would remove the embedded panel *and* hide the standalone screen, leaving **no**
Plant Master view — the precise appearing-then-disappearing regression already experienced with the
standalone Plant and Customer Family tabs.

UA-7 proceeds only when **either** the standalone screen is reliably available in the target build's
flag configuration, **or** the screen is unflagged. Until then the duplication stays. `PlantPicker`
keeps its own `plants` fetch regardless, so user assignment never depends on the panel.

---

## 6. Frontend actions and screens

- `tabs/UserManagementTab.jsx` — rebuilt on `classifyResponse` and the four shared state components;
  search/filter; per-user capability display (UA-1) then editor (UA-4); stale-conflict reload path.
- `ui/CapabilityMatrix.jsx` *(new)* — scope-aware rendering of group and plant capability sets;
  read-only in UA-1, editable in UA-4. A group capability is never offered per plant.
- `tabs/AuthOrphansScreen.jsx` *(new, UA-6)* — over the two existing routes.
- `lib/userAccessActions.js` *(new)* — pure body builders, canonicalisation (distinct + sort), scope
  validation and confirm copy. The testable surface, per the established convention.
- `ui/Sidebar.jsx` — gate Users on `hasCapability(profile,'administer_users')`, not on the derived role.

The role label stays a **presentation summary**, read-only. No authorization is designed around it,
and no future user receives the development capability union by default.

---

## 7. Tests and browser acceptance (J)

**pgTAP**, registered in `tests.run_all()`:

- stale desired-set conflict raises `PT409` once, **no retry storm** (assert a single failed attempt,
  not a hung call);
- idempotent resubmission: no writes, **no version increment**;
- concurrent administrator changes: two sessions, one wins, the loser gets `PT409`;
- deterministic lock ordering: interleaved edits to two different users complete without deadlock;
- **last-active-administrator protection through every path** — capability replacement, `admin_set_user_status`
  deactivation, and the delegating legacy PATCH branch;
- direct grant-table write rejected for `authenticated` after closure (INSERT and UPDATE, both tables);
- `admin_create_app_user` still succeeds after closure (the definer-bypass assumption, proven);
- attribution: `granted_by` / `revoked_by` / `revoked_at` equal the resolved caller, and cannot be
  supplied by the client;
- unknown capability, scope mismatch, unknown plant, inactive plant, duplicate entries;
- inactive or unknown target user;
- **existing plant grants preserved** when represented unchanged in the desired set (no churn).

**Backend:** hermetic route tests in the fake-client convention; HTTP probe rows for the new route
(`anon` refused, `service_role` refused); **G-A after each of the three migrations**.

**Frontend fixtures** (`npm run test:user-access`, a ninth standing gate): canonicalisation and
scope validation; complete-replacement body shape; stale-state recovery copy; capability visibility
and **edit gating**; role label derived correctly, including a user holding `check_quote` at one plant
and `make_quote` at another.

**Browser acceptance** (authenticated, real database, isolated test identities): grant
`read_party_master` and watch Customer Families become reachable; revoke it and get a genuine 403,
not an empty list; two-tab stale conflict showing the reload-and-explain path; last-administrator
refusal; assign two plants; adopt an orphan.

**G-B is milestone-only** under the accepted proportionate-gates policy and is **not** invoked for
this packet or its slices.

---

## 8. Estimate

| Slice | Effort |
|---|---|
| UA-1 (incl. read-route correction) | 0.75 day |
| UA-3 (function, invariant, closure, 3× G-A, pgTAP, route tests, probes) | 2 days |
| UA-4 | 1 day |
| UA-5 | 0.5 day |
| UA-6 | 0.5 day |
| UA-7 | 0.25 day, gated |
| **Total** | **~5 days**; UA-1 (0.75 day) is visible value with no mutation risk |

UA-3 is larger than the previous estimate because the bypass closure, the invariant and the
concurrency contract are real work that the earlier draft under-scoped.

---

## 9. Product Owner decisions — settled

| # | Decision | Status |
|---|---|---|
| 1 | UA-3 authorised in principle, subject to §2 corrections | **Settled** |
| 2 | Emailed invitation-provider integration **deferred** while the application is private and single-operator. Not an identity-provider project | **Settled** — gap 2 is out of scope; `pending_invitations` stays unreached |
| 3 | No second live administrator. Isolated test identities/fixtures prove protection rules; production design must still prevent loss of all active administrators | **Settled** — §2.3 |
| 4 | Editable role dropdown retired as an authority mechanism; derived read-only label may remain | **Settled** — §2.5, UA-4 |
| 5 | Temporary-password workflow may remain provisionally, provided credentials are never logged or persisted unnecessarily and the UI names it a temporary development mechanism. Replacement is a **mandatory pre-sharing gate** | **Settled** — UA-1 adds the label; the gate is recorded below |

**Recorded pre-sharing gate:** before this application is shared with any user other than the Product
Owner, the temporary-password workflow must be replaced by a secure invitation/reset flow. This is a
blocking gate, not a backlog item.

**Remaining open question, unchanged:** none. This packet is ready for authorisation as it stands.

---

## 10. Scope boundary

U1 Users/Access. Not relabelled as S8–S13. Does not begin U2, S8 or U4. Touches no Batch state, no
`delivery` semantics, no feature flag, no live grant, no live user. Authorises no deployment and no
push. `BatchProfileBar.jsx`'s user-owned hunk and `docs/commercial-intelligence-decisions.md` are
untouched.


---

## 11. Closure record — UA-1 + UA-3 + UA-4 (2026-09-08)

**Product Owner validation granted for this tranche only.**

| Status | UA-1 | UA-3 | UA-4 |
|---|---|---|---|
| Implemented | yes | yes | yes |
| Automated-test verified | yes | yes | yes |
| Browser verified | yes | yes | yes |
| Technically closed | yes | yes | yes |
| Product Owner validated | yes | yes | yes |

### What shipped

- **UA-1** — shared loading/empty/error/stale/access-denied states; read-only display of each user's
  actual group and plant capability sets; navigation gated on `administer_users` rather than on the
  role string.
- **UA-3** — `set_user_capabilities` (function, invoker wrapper, route), the last-active-administrator
  invariant, and the **direct grant-table write bypass closed**: `authenticated` holds no INSERT or
  UPDATE on either grant table and the four write policies are dropped, so a direct write is refused
  by the database, not by a check in the route. Applied only after every application caller had
  migrated, so no intermediate state existed in which the application depended on a revoked write.
- **UA-4** — the capability editor wired exclusively to UA-3, replacing the COMPLETE capability set in
  one operation carrying `expected_content_version`; the editable role field retired and
  `_apply_role_and_plant` deleted. `role` is now a derived read-only label and is never an input.

### Associated correction, accepted as in scope

`caller_context.resolve_caller` fell back to `.limit(2)` over every row the caller could see when no
auth uid was passed. An administrator sees everyone, so once a third user existed those two rows
needn't include the administrator's own row: identity resolved to `None` and `/auth/refresh` returned
403 "Account is not active" for a valid session. Pre-existing; it became reachable when the acceptance
test user was created, and it blocked the authorised acceptance work. Fixed at all three call sites in
`ce332e7`, with regression coverage in `tests/test_login_bootstrap.py`.

### Evidence totals (re-run at closure)

| Gate | Result |
|---|---|
| G-A migration correspondence | 151 local = 151 remote, fingerprint `67938d51` identical |
| pgTAP `tests.run_all()` | 905 passed, 0 failed |
| Backend hermetic suites (12) | 569 passed, 0 failed |
| Frontend gates (10) | 555 checks, all pass — `user-access` 51 |
| HTTP probe matrix | 226/226 |
| ESLint | 66 errors, 0 new |

Browser verified live: capability-gated nav; accurate group and plant display; grant; two plants with
distinct sets; an unchanged submission as a true no-op (no version bump, no grant rows written, Save
disabled); the two-tab stale conflict, reloaded and re-decided rather than retried; governed creation
after the bypass closure; the loading state; the derived read-only role column with no selector; and
Customer Families reachable with `read_party_master` and then genuinely 403 — not an empty success —
after a governed revocation, using the same token, which is what proves the database decides per
request.

Verified by automated evidence only, at the Product Owner's direction: the last-active-administrator
invariant (pgTAP, isolated subtransaction) and the `TRANSITION_NOT_ALLOWED` explanation. Direct-write
rejection rests on BY-1..BY-11 and the probe matrix; the destructive experiments were not repeated.
The Users-screen access-denied and server-error presentations are covered hermetically: observing
them live would have required demoting an administrator or breaking the server.

### Acceptance fixture, retained deliberately

`app_users.id = 1375`, "UA Test User", `ua-test@fixture.invalid` — created through the governed
application path, left **deactivated with zero active group and plant grants** (`content_version` 7,
`deactivated_at` stamped). Its revoked grant rows are retained as the audit trail. Not deleted, by
instruction. No live administrator was demoted, deactivated or otherwise manipulated at any point;
`NikunjRL` ends at `content_version` 1 with no revoked rows in either grant table.

Commits: `quote-gen-be` `0926c82`, `4eb3458`, `e3b9124`, `ce332e7`; `quote-gen-fe` `d740f95`,
`b5298dd`, `d0f8d8e`. Nothing pushed.

### Still open — Users/Access is NOT closed

| # | Slice | State |
|---|---|---|
| **UA-5** | Activation/deactivation UX and consequence handling | Open, unauthorised |
| **UA-6** | Orphan-account recovery screen | Open, unauthorised |
| **UA-7** | Remove the duplicated embedded Plant Master panel | Open, unauthorised, **and gated on reliable standalone Producing Plants visibility (§5)** |

Each needs its own authorisation. Nothing here begins S8 or U2.
