# U0 — Frontend Discovery and Gap Report

**Date:** 2026-09-07. **Performed by:** SR DEV, under the U-series authorisation in the
post-S7-closure handover (§9.1 of that handover). **Status: read-only discovery. No screen
implementation is authorised by this document; it is the required first U-series deliverable**
(`data-model-frontend-design-plan.md` §9).

**Canonical relationship.** This report inventories the existing `quote-gen-fe` application against
the accepted data model (S0a–S7, closed) and the planning reference `data-model-frontend-design-plan.md`.
It does not amend `data-model-decisions.md` and creates no new canonical authority.

---

## 1. Current navigation and every existing screen

Navigation is `NAV_ITEMS` in [`src/ui/Sidebar.jsx`](../src/ui/Sidebar.jsx), derived state (two
entries carry live counts), not a config file:

| # | Tab key | Label | Component | Gated by |
|---|---|---|---|---|
| 1 | `costing` | Costing | `tabs/costing/CostingTab.jsx` | none — default tab |
| 2 | `items` | Quote Items | `tabs/QuoteItemsTab.jsx` | none |
| 3 | `batch` | Batch Entry | `tabs/batch/BatchEntryTab.jsx` | none |
| 4 | `constrlib` | Construction Library | `tabs/ConstructionLibTab.jsx` | none |
| 5 | `rates` | Rate Master | `tabs/RateMasterTab.jsx` | none |
| 6 | `freight` | Freight Rates | `tabs/FreightTab.jsx` | none |
| 7 | `defaults` | Defaults | `tabs/DefaultsTab.jsx` | none |
| 8 | `users` | Users | `tabs/UserManagementTab.jsx` | `role === "admin"` (frontend-only gate) |

Outside the tab switch, three more screens exist and are not nav items:

| Screen | Component | Trigger |
|---|---|---|
| Login | rendered by `QuotationApp.jsx` when `!profile` | app boot, no session |
| Change Password | `ChangePasswordModal.jsx` | TopBar action |
| Profile / email change | `ProfileModal.jsx` | TopBar action |

`role` gating is frontend-only but is applied **twice** today — once in `Sidebar.jsx` (hides the nav
entry) and again in the tab switch itself (`QuotationApp.jsx`: `tab==="users"&&role==="admin"&&
<UserManagementTab/>`), so forcing `tab="users"` via React DevTools while `role!=="admin"` does not
currently mount the component. Both checks are still plain JS string comparisons, not access control
— the **backend** is the actual enforcement boundary (RLS plus the caller-context routes below), and
a capability-aware nav/render primitive should replace both checks with one shared helper rather than
leave two copies of the same frontend-only gate to drift apart, which is the real risk here: today
they happen to agree, but nothing keeps a future third gate (e.g. a new admin-only action added
inside an already-open screen) in sync with either.

## 2. Browser-local versus Supabase-backed data, per screen

**The frontend has no Supabase client anywhere in `src/`** (confirmed by search — the only
network-calling module is `src/lib/apiClient.js`, which talks exclusively to the Flask backend).
Every "Supabase-backed" screen below is Supabase-backed *only* by way of a Flask route that forwards
the caller's own access token to Supabase (`get_supabase_for_caller`), so RLS is the enforcement
layer in every case — see §3.

| Screen | State source | Persistence |
|---|---|---|
| Costing | `state/useCostingState.js`, `useCostingDraft.js` | `localStorage` (`cbb_*` keys) |
| Quote Items | `state/useQuoteItemsState.js` | `localStorage` |
| Batch Entry | `state/useBatchState.js` | `localStorage` (`cbb_batchRows` etc.) — **not** the governed `public.batches`/`batch_rows` schema from S6/S7 |
| Construction Library | `state/useMastersState.js` | `localStorage` — **not** `public.constructions`/`construction_versions` from S4 |
| Rate Master / Freight / Defaults | `state/useMastersState.js` | `localStorage` — **not** `public.rate_sets`/`freight_sets`/`sectors` from S5 |
| Users | `UserManagementTab.jsx` (own `useState`, no shared slice) | **Supabase-backed**, via `/admin/users*` and `/masters/plants` |
| Login / session | `AuthContext.jsx` + `lib/apiClient.js` | **Supabase-backed** (`auth.users` + `app_users`), token cached in one `localStorage` key (`qgos_session`) |
| Change Password / Profile / email | `ChangePasswordModal.jsx`, `ProfileModal.jsx` | **Supabase-backed**, via `/auth/change-password`, `/auth/me`, `/auth/me/email` |

**The governance line runs exactly where CLAUDE.md says it does:** identity (auth, users, plants-as-read)
moved to Supabase at Phase 2; every commercial/business screen — Costing, Batch, Construction, Rate,
Freight, Defaults, Quote Items — is still 100% `localStorage`, fully disconnected from the accepted
S3–S7 data model. **No screen currently reads or writes `public.parties`, `customer_families`,
`constructions`, `skus`, `rate_sets`, `freight_sets`, `sectors`, `batches`, `batch_rows`, or any other
table the closed S3–S7 slices created.** U1–U4 are not incremental UI polish on top of a connected
app; they are the first connection of each of those domains.

## 3. Backend route / RPC behind every current action

Full inventory of `quote-gen-be/server.py` routes (16 total) and what calls them:

| Route | Method | Called from | Supabase surface behind it |
|---|---|---|---|
| `/health` | GET | ops only | none |
| `/export` | POST | `export/excel.js` | none (openpyxl template fill; not Supabase) |
| `/auth/login` | POST | `apiClient.login` | `auth.sign_in_with_password` + `_read_one_user` (caller context after) |
| `/auth/refresh` | POST | `apiClient.refreshSession` | `auth.refresh_session` |
| `/auth/logout` | POST | `apiClient.logout` | `privileged_client("auth_admin_sign_out")` — one of the 5 allow-listed service-role ops |
| `/auth/me` | PATCH | `ProfileModal.jsx` | caller-context update on `app_users` |
| `/auth/me/email` | POST | `ProfileModal.jsx` | caller-context, service-role only for the Auth-side email change step |
| `/auth/change-password` | POST | `ChangePasswordModal.jsx` | caller-context `auth.update_user` |
| `/admin/users` | GET | `UserManagementTab.jsx` | caller-context `app_users` + grants read, `derive_role()` collapses grants to one label |
| `/admin/users` | POST | `UserManagementTab.jsx` | caller-context atomic multi-plant creation (P2-13) |
| `/admin/users/<uid>` | PATCH | `UserManagementTab.jsx` | caller-context status/role/plant-grant change |
| `/admin/users/<uid>/email` | PATCH | `UserManagementTab.jsx` | caller-context + service-role Auth-side step |
| `/admin/users/<uid>/reset-password` | POST | `UserManagementTab.jsx` | service-role Auth-admin op (allow-listed) |
| `/admin/auth-orphans` | GET | `UserManagementTab.jsx` (orphan recovery panel) | caller-context, backed by the O-5..O-14 orphan-detection suite |
| `/admin/users/adopt` | POST | `UserManagementTab.jsx` | caller-context, same atomic grant call as ordinary creation |
| `/masters/plants` | GET | `UserManagementTab.jsx` (embedded `PlantMasterPanel`) | plain caller-context `SELECT` on `public.plants`, explicitly read-only, explicitly excludes timezone |

**Every route executes as the caller** (CLAUDE.md's standing architecture rule) except the five
named Auth-admin operations, which is exactly what the 25-assertion `test_caller_context.py` C-9
family and the 23-assertion `test_routes_caller_context.py` R-15/R-16 gates verify (both re-run and
passing after G-B — see the S7 closure record). This means every *new* U1 route this report proposes
must follow the same `get_supabase_for_caller(g.access_token)` pattern — there is no other backend
data-access pattern anywhere in this codebase, and none should be invented.

**No route exists yet** for any Family B (`customer_families`, `parties`, `party_family_memberships`),
Family C (`constructions`, `skus`), Family D/E (commercial masters, Rate/Freight Sets, Pricing Basis),
or Family F (`batches` and below) table or operation. §6 covers exactly what is missing and what the
smallest safe addition looks like for the one domain this report's U1 scope actually needs
(Customer Families).

## 4. Reusable, transitional and replacement screens

| Existing artifact | Disposition | Why |
|---|---|---|
| `UserManagementTab.jsx`'s embedded `PlantMasterPanel` (lines 22–86) | **Reusable, promote to its own screen.** | Already calls `/masters/plants`, already shows exactly code/name/status, already omits timezone, already labelled read-only with an explanatory note — this *is* the U1 §9.3 Producing Plants screen in miniature. It should be extracted into `ui/ProducingPlantsScreen.jsx` (or similar) and given its own nav entry, not rebuilt. |
| `UserManagementTab.jsx`'s `PlantPicker` | **Reusable as-is** for any future plant-multi-select (e.g. a Batch's plant scope). | Already selects only from `active` plants, already forbids free text. |
| `apiClient.js` / `AuthContext.jsx` | **Foundation, extend, do not replace.** | The token-refresh-and-retry pattern in `apiFetch` is exactly what a shared "backend error translation" primitive (U1 §9.2) should wrap, not duplicate. |
| `ui/primitives.jsx`, `ui/styles.js`, `theme.js` (`C`, `mono`, `sans`) | **Reusable.** | Already the shared visual language; U1 primitives (empty/loading/access-denied states) should be built as new exports from here, matching existing tokens, not a parallel design system. |
| `ToastStack.jsx` / `showToast` | **Reusable** for the "successful-operation state read-back" requirement. | Already wired app-wide via `useUiState`. |
| Costing, Batch Entry, Construction Library, Rate/Freight/Defaults tabs | **Transitional — out of scope for this phase.** | All `localStorage`-only; migrating them is U2/U3/U4 work per the design plan's own sequencing (§8), explicitly not authorised in this handover. They are left untouched. |
| `UserManagementTab.jsx` as a whole | **Transitional.** | Functionally correct and already Supabase-backed, but pre-dates the capability-aware-navigation and shared-primitive work U1 introduces; it should adopt the new shared states (loading/empty/access-denied/stale) rather than be rewritten. |

## 5. Legacy data shapes conflicting with the accepted model

1. ~~`profile.role` is a single collapsed label ... per-plant per-capability detail is not yet
   returned by any route~~ — **wrong, corrected after this draft.** `derive_role()` in `server.py`
   does collapse grants to one label, and `UserManagementTab.jsx`'s admin gate still reads only that
   label — but this section originally missed `caller_context.py`, a separate module. Its
   `resolve_caller()` — which `/auth/login`, `/auth/refresh` and every `@require_auth` route (via
   `g.caller`) already use — has always returned the full shape:
   `profile.group_capabilities` (flat array) and `profile.plant_capabilities` (`{plant_code:
   [capability keys]}`), scoped correctly today. No backend change was needed for U1-C1; the
   correction was fixing `lib/capabilities.js` to read the fields that already exist instead of ones
   this report invented (`profile.capabilities`, `profile.capabilitiesByPlant`), and removing the
   role-based fallback that could grant a capability never actually held. See the U1 correction
   report for the fix and its tests.
2. **`localStorage` `cbb_*` state has no relationship to any governed identity.** Batches, Constructions,
   Rates, Freight and Sectors in the browser are anonymous, single-machine, unversioned data with no
   Family/Plant/lifecycle model — they cannot be reconciled with S3–S6 by transformation; they can only
   be superseded, screen by screen, per the design plan's own migration language ("Migrate the existing
   Batch Entry incrementally", §6 U4).
3. **No five-state Item Status, no Printing Technology/colour fields, no flute take-up factors exist
   anywhere in the frontend** — consistent with the closed S7 handover's explicit deferral of all
   three (§8.1–8.4 of the takeover brief), not a defect to fix here.

## 6. Missing governed backend operations

| Domain | What exists today | What U1 needs | Gap |
|---|---|---|---|
| Producing Plants (read) | `/masters/plants` (GET), full caller-context, tested | Read-only list | **None** — fully covered |
| Users and access | `/admin/users*`, full CRUD + orphan recovery, 171-assertion tested | List/invite/administer/assign plants/activate/deactivate | **None** — fully covered; U1 work here is presentation (shared states, capability-aware gating), not new backend |
| Customer Families — **read** (list, search, filter, detail, membership history) | `public.customer_families`, `customer_family_aliases`, `party_family_memberships` exist, RLS enabled+forced, readable by any authenticated caller holding `read_party_master` | A `/masters/customer-families` (or similar) GET route, mirroring `/masters/plants`'s exact pattern | **One new Flask route.** Low risk: plain `SELECT` through the caller's own token, same shape as the existing Plant route. No new SQL. |
| Customer Families — **mutations** (merge, reassign, propose-family review, retirement) | `app_private.merge_families`, `app_private.reassign_party_family`, `app_private.graduate_party`, `app_private.allocate_group_customer_code` — all exist and are pgTAP-tested, but **none has a `public` invoker wrapper** | Public wrapper RPCs following the established P2-6 pattern (SECURITY DEFINER in `app_private`, thin `public` shim), plus one Flask route per action forwarding the caller's token | **Real gap.** These functions are architecturally unreachable from any caller today — not just unrouted in Flask, but not exposed to PostgREST at all, by the same `app_private`-is-not-in-the-Data-API's-exposed-schema-list rule that already protects `is_admin()` and the identity RPCs. Per the handover's own instruction (§9.4): do not create a direct browser-table write for these; propose the wrapper migration as its own reviewable unit rather than folding it into the U1 screen commit. |
| Everything else in the design plan's proposed nav (Product Masters, Commercial Masters, Plant Capabilities, Quote workflow) | Nothing routed | — | Out of scope for this handover (U2 and later; not authorised — see §10 of the takeover brief) |

**Conclusion for U1 scope:** Producing Plants and the Users/access shared-foundation work need zero
new backend surface. Customer Families **read** needs one small, low-risk route. Customer Families
**write** operations (merge, reassign, retirement) are blocked on a backend addition this report
recommends but does not implement in this pass, consistent with "map to an existing governed
operation... report the missing operation" rather than inventing a workaround.

## 7. Shared UI components already available

`ui/primitives.jsx`, `ui/styles.js`, `theme.js` (color tokens `C.amber/slateM/slateL/white/cream/
border/green/red/amberL/amberD`, fonts `mono`/`sans`), `ToastStack.jsx`, `Sidebar.jsx`'s collapse
pattern, `UserManagementTab.jsx`'s `btnStyle`/`inputStyle` factories and its collapsible-panel pattern
(`PlantMasterPanel`'s `open`/`setOpen` disclosure). None of the U1-required states (loading, empty,
access-denied, stale/conflict) exist as shared components yet — every tab currently handles its own
ad hoc empty/loading rendering inline.

## 8. Proposed capability-aware navigation

Extend `Sidebar.jsx`'s `NAV_ITEMS` derivation from a single `role==="admin"` check to a small
`hasCapability(key, plantCode?)` helper — corrected to read `profile.group_capabilities` /
`profile.plant_capabilities` directly (§5.1) and to deny by default rather than degrade to a
role-based guess. New nav entries: **Producing Plants** (visible to any authenticated, active user
— its RLS policy is open, no capability gate) and **Customer Families** (requires
`read_party_master`, confirmed from `pg_policies`). Both are additionally feature-flagged
(`u1_producing_plants`, `u1_customer_families`; §9), gating the SAME flag on both the nav entry and
the tab's render mount so a hidden entry cannot be forced to render through a stale `tab` value.
Both mount under a new top-level section rather than inside the existing flat list, matching the
design plan's `## 4. Proposed application navigation` grouping (`Customer Masters`, `Administration`)
at a scale of two items rather than committing to the full proposed IA now.

## 9. Localhost and Vercel feature-flag approach

No feature-flag mechanism existed before this handover — every screen shipped to both `localhost` and
Vercel identically, gated only by `role`. The shared foundation adds a minimal reader:
`VITE_FEATURE_FLAGS`, a comma-separated allow-list (documented in `.env.example`), read once at boot,
exposed as `isFeatureEnabled(key)`/`useFeatureFlag(key)`, default-off when unset. **It is now actually
applied** (U1-C4 correction — the first pass added the reader but left both new screens unconditional):
`u1_producing_plants` and `u1_customer_families` gate both the `Sidebar.jsx` nav entry and the
`QuotationApp.jsx` render mount with the same check, so a hidden nav entry can never be forced to
render through a stale `tab` value. **Nothing in this pass changes `vercel.json`, `.env.production`
or any deployment config, and nothing is pushed or deployed** — both flags are off on this localhost
today (no `.env` sets them) and stay off on Vercel until a future session sets them in a Vercel
project setting.

## 10. Maker / Checker / Administrator / master-manager / wrong-plant / inactive-user scenarios

| Scenario | Current backend behaviour | Current frontend behaviour | Gap this report flags |
|---|---|---|---|
| Maker, own plant | Full caller-context access to their grants | Works today for Users/Plants (read) | none |
| Checker, own plant | `check_quote` grant recognised, collapses to `role="checker"` | Sidebar hides Users; nothing else role-aware | Plant-scoped nuance lost (see §5.1) |
| Administrator | `administer_users` → `role="admin"` | Sees Users tab | Tab renders even if forced without the grant — see §1 |
| Master-manager (a capability this report found no equivalent of) | Not modelled by `derive_role()` — no Family B/C/D capability collapses to a distinguishable frontend role today | N/A | New capability-aware helper (§8) must read the actual grant list, not the collapsed role, once that shape exists |
| Wrong-plant | RLS refuses at the table; `/masters/plants` and `/admin/users*` are plant-scoped correctly per the 29-assertion multi-plant suite | No frontend concept of "current plant" exists yet — every screen that is Supabase-backed today happens to be plant-agnostic (Users, Plants) | U1's "plant selector" primitive is new, not a fix to something broken |
| Inactive user | `/auth/refresh` and every caller-context route refuse via RLS/`AuthProvider`'s `isActive` | `AuthContext.isActive` exists and is computed but **is not currently read anywhere** — no screen acts on it | Real gap: an inactive session is not distinguished from an active one in the UI today; U1's access-denied state should consume `isActive` |

## 11. Screen-level acceptance criteria (for the two U1 screens this report clears)

**Producing Plants (read-only):**
- Loads via `/masters/plants`, shows code/name/status, omits timezone.
- Empty-plants state renders the shared empty-state primitive, not silent blank space.
- A deactivated user's session is refused before the screen renders (access-denied state).
- No create/edit/retire control exists anywhere on the screen.
- `npm run build`/`lint` unaffected; no new console error on boot.

**Customer Families (list/search/detail only, pending the write-path backend addition):**
- Loads via the new `/masters/customer-families` route; search and status/family filters operate
  client-side over the returned set (small reference table, no pagination needed yet).
- Permanent Family Code, names/aliases, Proposed-state, current Customers/Prospects and
  effective-dated membership history all render from the one read response.
- Merge lineage and retirement history render read-only; no merge/retire control is offered until
  the wrapper RPCs in §6 exist — the screen states this explicitly rather than showing a dead button.
- `read_party_master` is a GROUP capability (`has_group_cap`, confirmed from `pg_policies`), not
  plant-scoped, so there is no wrong-plant case for this screen. Inactive and no-capability sessions
  see the access-denied state, and — after the U1-C3 correction — the backend now returns a genuine
  403 for "no capability" rather than 200 with empty arrays, so this is no longer merely a frontend
  convention: the two cases are distinguishable at the HTTP layer.

## 12. Realistic delivery estimates

| Package | Scope | Estimate |
|---|---|---|
| U1 shared foundation | Feature-flag reader, loading/empty/access-denied/stale states, capability-action wrapper, capability-aware nav, plant selector, permanent-code display, lifecycle display, version-history pattern, error translation | 0.5–1 session |
| U1 Producing Plants | Extract `PlantMasterPanel` into its own screen + nav entry | 0.25 session (mostly done already) |
| U1 Customer Families — read | One new Flask route + one new screen | 0.5–1 session |
| U1 Customer Families — write (merge/reassign/retire) | Public wrapper RPC migration (reviewed separately) + route + UI actions | 1–2 sessions, **blocked on the migration being authorised as its own reviewable unit** |
| U1 Customers/Prospects, Customer Locations | Out of this handover's authorised U1 subset (design plan lists them under U1 but the takeover brief's §9 only authorises Producing Plants + Customer Families) | not estimated here |

## 13. Genuine Product Owner questions — and two answered empirically since first draft

1. ~~Capability key for Customer Family visibility~~ — **answered, not assumed.** `pg_policies` was
   read directly: `customer_families_select`, `customer_family_aliases_select`,
   `parties_select` and `party_family_memberships_select` are all gated by
   `app_private.has_group_cap('read_party_master')`. No Product Owner decision needed; this was a
   fact to look up, not a direction to set.
2. ~~Customer Family merge/retire authorisation~~ — **answered the same way.** The `UPDATE` policy on
   all four tables is gated by `has_group_cap('manage_customer_master')`. That is the capability the
   future public-wrapper migration for `merge_families`/`reassign_party_family`/`graduate_party`
   should require — recorded here so the next session does not have to re-derive it, but it is still
   that session's decision whether to build the wrapper, not this report's.
3. **Navigation grouping** (still open). Producing Plants and Customer Families were added flat to
   the existing sidebar list for this pass rather than under a new top-level section, since a
   two-item section reads oddly on its own. Revisit once U2/U3 add enough items to justify grouping.

## 14. What this report cleared for implementation, and what was actually built

After the discovery above, two screens were implemented in this same handover (separate commits,
`quote-gen-fe`): **Producing Plants** (read-only, `/masters/plants`, no backend change) and
**Customer Families** (read-only list/search/detail, `/masters/customer-families` — one new
`quote-gen-be` route, mirroring `/masters/plants` exactly: plain caller-context `SELECT`s across the
four RLS-gated tables, no new SQL, no new capability, `mutations: "not_yet_governed"` in its own
response so the frontend never has to guess). Both backend acceptance suites (171) and the HTTP probe
matrix (172) were re-run after the new route and pass unchanged. Merge, reassignment and
Proposed-family review remain unbuilt, per §6/§13 above — the screen states this rather than offering
a dead control.

---

**Discovery and the two U1 screens it cleared are both delivered.** Product Masters, Commercial
Masters, the Batch Workspace, Quote workflow and export/audit (U2–U6) remain out of scope for this
handover and are not begun.
