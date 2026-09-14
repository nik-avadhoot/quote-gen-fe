# U1 — read-only Party external references, and Producing Plant relevant assignments

**Date:** 2026-09-09. Two visible U1 omissions, closed. Branch `data-model/s0-provenance`, nothing
pushed. Statuses use the vocabulary fixed by `data-model-frontend-design-plan.md` §2.1 item 7 and
claim nothing beyond what was demonstrated.

---

## 1. Read-only Party external references

Canonical: `data-model-frontend-design-plan.md` §6 U1, *Customers and Prospects — external
references*. `u1-customer-foundation-authorization-packet.md` had corrected its own draft to record
this as a genuine gap: the read route did not select `party_external_references` at all.

**Backend.** One entry added to `_READS` in `server.py`'s `list_customer_families`:
`id, party_id, ref_kind, ref_value, created_at`. No route, RPC, migration, policy, capability or
privileged function. `created_by` is deliberately not selected — it is an FK to `app_users`, and the
Customer Master has no business disclosing which operator recorded a reference. Authority is
unchanged: `party_external_references_select` is the same `read_party_master` policy as the six
existing reads, and the route's explicit capability check still runs before any read.

**Frontend.** `groupExternalReferencesByParty` (deterministic: kind → value → id; rows without a
`party_id` dropped rather than guessed) and `externalRefKindLabel` in
`lib/customerFamilyActions.js`; a read-only list under each Party in `CustomerFamiliesScreen.jsx`.
No create/edit/retire/delete control, because no such operation exists — propose/edit remain
Deferred. `ref_value` is rendered as plain monospace and **not** through `<PermanentCode>`: that
component denotes a governed permanent code, and borrowing it would assert that an external
reference is one. The caption says so in words too.

**Status: implemented, automated-test verified, browser verified, technically closed, Product Owner
validated (2026-09-09).**

Browser evidence, on temporary fixture rows against Party 314 (`Slice D Acceptance Prospect`, a
retained development row) that were recorded, verified and then removed: the authorised response
carried the collection; only the five approved fields appeared; `created_by` was absent; empty and
populated states both rendered; both rows appeared under Party 314 only; no mutation control
existed. Cleanup removed IDs 1 and 2 alone and the table returned to its prior count of zero, with
Family, Party and Location counts unchanged.

---

## 2. Producing Plant "relevant assignments"

Canonical: `data-model-frontend-design-plan.md:412` — *"Show code, name, status and relevant
assignments"*. This line appeared in no acceptance register; it was the only wholly un-triaged
canonical U1 requirement.

**The authority line is drawn by the database, and the implementation follows it:**

- `plants_select` is `using ( true )` — any authenticated user may read the Plant Master.
- `pgrant_select` is `using ( app_user_id = current_app_user() OR has_group_cap('administer_users') )`
  — a caller reads plant grants for themselves only, unless they administer users.

So **your own access** needs no request at all: it is already in the resolved profile
(`plant_capabilities`), rendered as labels in canonical `PLANT_CAPABILITIES` order, or "No access".
**Assigned people** are administrator-only: `/admin/users` is requested *only* when the caller holds
`administer_users` — not requested and then hidden — and the response is projected to
`{ plant_code: [display_name] }` before it reaches component state, so email, last sign-in, account
status, id and group capabilities are dropped at the boundary. Deactivated accounts are excluded:
listing somebody who cannot sign in as a current assignee would simply be untrue.

No aggregate count and no privileged function is offered; either would mean reading around
`pgrant_select`. No backend, RLS, policy, capability, migration or privileged-function change was
made.

The names read is **optional**. Every failure — 403, any non-ok status, a thrown network error,
malformed JSON — yields `null`, and the screen keeps rendering own-access. `null` ("not available")
is deliberately distinct from an empty map ("nobody is assigned"); a defect that conflated them was
found by the new fixtures and corrected before review (see §3).

**Status: implemented, automated-test verified, browser verified, technically closed; Product Owner
validation pending.**

---

## 3. Defects found and corrected during this work

**Incorrect named import, found in the browser.** `groupExternalReferencesByParty` and
`externalRefKindLabel` were imported from `lib/customerLocationActions.js` instead of
`lib/customerFamilyActions.js`. The screen failed to load with
`SyntaxError: … does not provide an export named 'externalRefKindLabel'`.

It passed every focused automated gate. Demonstrated, not assumed, by reintroducing the exact defect
and re-running: **ESLint exits 0** (it does not resolve named exports), and the focused fixtures
import each `lib` module directly, so importing a helper from the wrong module is invisible to them.
**`vite build` exits 1** — the bundler resolves the real module graph and rejects it.

Guard added: `npm run test:module-contract` (`vite build --logLevel error`), proven to fail on the
defect and pass on the corrected tree. It is a build assertion over the real module graph, not a new
test programme.

**Unknown-versus-empty conflation.** `loadAssignedUserNames` originally used
`resp.json().catch(() => ({}))`, which turned a parse failure into an empty map and would have
rendered "Assigned: nobody" on every plant — stating as fact something unknown. Caught by the new
fixtures, corrected to return `null`.

---

## 4. Separate pre-existing reliability item — backend process-lifetime degradation

**Not investigated or fixed in this tranche. Recorded so it is not lost.**

During verification, `GET /masters/customer-families` began hanging indefinitely. The wording matters
and the earlier phrasing overstated it: **the seventh read was not conclusively exonerated.** What
the evidence establishes is narrower — the hang is **not exclusive to the changed route**:

| Probe | Reads / clients | Changed by this work? | Result |
|---|---|---|---|
| `GET /masters/customer-families` | 7 | Yes | hangs >30s (single request) |
| `GET /masters/plants` | 1 | **No** | **hangs >15s** |
| Supabase PostgREST / GoTrue, probed directly | — | No | HTTP 401 in ~0.5s |
| Postgres `pg_stat_activity` | — | No | 1 active, nothing long-running |

An untouched one-read route degrades identically on the same process, while Supabase answers
directly in half a second and Postgres is idle. A restart clears it, and on a fresh process the
seven-read route answered in ~5.0 s and `POST /auth/login` in 4.1 s. **No causal regression from this
slice was demonstrated**; equally, no proof is offered that the seventh read is harmless under
degradation.

`caller_context.new_caller_client`'s own docstring describes this failure mode: concurrent use of a
shared HTTP/2 client fails and "leaves the pooled connection wedged so the NEXT request hangs until
timeout". Characterising and fixing that belongs to its own item, with its own authorisation.

---

## 5. Evidence

| Gate | Before | After |
|---|---|---|
| Frontend fixture gates | 10 gates, 628 checks | **10 gates, 659 checks, all pass** |
| — `test:capabilities` | 14 | **35** |
| — `test:family-actions` | 37 | **47** |
| — `test:user-access` | 124 | 124 (unchanged) |
| `tests/test_customer_families_route.py` | 26 | **36 passed, 0 failed** |
| `npm run test:module-contract` | — | **new; exit 0 (exit 1 on the defect)** |
| ESLint | 66 errors, 0 warnings | **66 / 0 — ceiling held, zero new** |

New route checks: empty reads as `[]` not a missing key; both references returned with correct
`party_id`, values and kinds; `created_by` never exposed; no field beyond the five authorised; seven
reads and seven distinct worker clients; a failing external-references read fails the whole request
with no partial 200. The route suite's fake client was taught to honour `select()` projections —
without that, the `created_by` assertions were unprovable.

New capability checks include the two that matter most for authority: a **non-administrator never
calls `/admin/users` at all** (spy records zero calls, which is stronger than asserting the response
was ignored), and every failure path returns `null` rather than a partial or empty map.

Browser evidence for §2, as an administrator: the Assignments column showed
`You: Plant access, Make quotes, Check quotes, Manage SKUs, Adopt Constructions, Propose commercial
masters, Approve commercial masters` and `Assigned: ClaudeCode, NikunjRL` on each of KOL, NAG and
PUN. A DOM scan confirmed no email, last-sign-in, account-status wording, group capability or
deactivated account name was present anywhere on the screen. The non-administrator branch was
verified through the automated fixture rather than by modifying live grants or creating an identity.

Preserved throughout: `src/tabs/batch/BatchProfileBar.jsx` unmodified;
`docs/commercial-intelligence-decisions.md` never read or staged; no feature-flag, `.env.production`,
`.env.local`, live user, grant, capability or authority change; nothing committed or pushed.
