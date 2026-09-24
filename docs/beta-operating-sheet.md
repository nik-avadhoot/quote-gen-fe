# Limited beta operating sheet

Date: 2026-09-17

State: **Prepared — not live**

Go-live authority: Product Owner

## Fence

| Item | Beta value |
|---|---|
| Producing Plant | `NAG` / Nagpur only — PO confirmed 2026-09-17 |
| Maker | `sales.01@avadhootpacks.in` — app user 3535 "Sonali", created 2026-09-18 by Admin 44 through Users/Access; exactly `plant_access` + `make_quote` at `NAG` |
| Checker (also Maker) | `marketing@avadhootpacks.in` — app user 3536 "Snehal", created 2026-09-18 by Admin 44 through Users/Access; `plant_access` + `check_quote` + `make_quote` at `NAG` (the `make_quote` grant was made by migration `20260918091350` through the governed `set_user_capabilities` operation under the PO's identity, on the PO's instruction; content version 2) |
| Beta URL | `https://quote-gen-fe.vercel.app` (backend `https://quote-gen-be.vercel.app`) — the only surface beta users can reach |
| Admin | `nikunj@avadhootpacks.in` / NikunjRL — active login; no beta fence change yet |
| Alongside period | First week; every system result compared with the existing spreadsheet |
| Production build flag | PO ruling 2026-09-18, Vercel = localhost: `src/lib/featureFlags.js` enables `u1_producing_plants`, `u1_customer_families`, `u3_pricing_basis`, `u2_gsm_master`, `u2_sku_master`, `u1_batch_party_link`, `u2_construction_library` and, from the authorised 2026-09-24 interim activation, `customer_pricing_history` in every build; `limited_beta` remains production-only. `freight_authority_v2` stays off. No environment file changed |
| Customer issue | Not permitted until the PO declares go-live |
| Job work | **OUT OF SCOPE** — keep every job-work enquiry on the spreadsheet |

Authorization is server-enforced. The beta build flag controls visibility and BETA export marking;
it is not an access-control substitute. Trial users receive only the capabilities required at the
confirmed beta plant. Wrong-plant and ungranted users must remain refused.

The fence remains closed until Wave C is complete. This is the readiness control for Calculate and
Send: no named beta capability is granted while attestation/Edge activation is pending.

**JOB-WORK ENQUIRIES ARE OUT OF SCOPE FOR LIMITED BETA.** `J` denotes client-owned Kraft paper and
the application has no governed job-work pricing or stock model. A Maker must not approximate job
work by selecting a non-`J` grade or by using a zero material rate; a governed immutable Quote must
never carry a fabricated paper price. Keep those enquiries on the spreadsheet.

## Approved commercial source exception

The first governed Nagpur Rate Set and Freight Set use the application's **current defaults**, not
workbook-derived masters. This exception was explicitly approved by the Product Owner on 2026-09-17.
During the alongside week, spreadsheet comparisons must label that source difference rather than
misdescribe the values as imported from `APSPL NAGPUR Master_20260720.xlsx`.

The initial Freight Set contains only exact existing governed Customer Location matches: **1 of 9
approved destination cities (Nagpur)**, represented by two ship-to-eligible location identities.
For Pune, Kolkata, Haldia, Howrah, Guwahati, Delhi, Ahmedabad and Hyderabad—or any other location
without an entry in the approved Freight Set—the Maker must set the Pricing Group to
`freight_mode = 'manual'` and enter an explicit ₹/kg value. Label the tracker entry **Maker-entered
freight**, not governed-master freight. A destination master remains a post-beta evidence-led decision.

## Daily operating check

Complete once per beta day and after any deployment:

- Check for self-approval: any Quote whose approving actor is also its Maker. The database permits
  it for a dual `make_quote` + `check_quote` holder (Snehal, users 44 and 45) and records it
  truthfully; in beta it is an operating-rule breach to be explained, not a system refusal.
- Record `/health` build revision and artifact SHA-256.
- Confirm the expected frontend build and `limited_beta` flag are active.
- Confirm `calculate-batch-row` is deployed with JWT verification and engine
  `engine/qe1-600adcbe1a85be59`.
- Confirm the active Pricing Basis Release and its Rate, Freight, Sector and Calculation Defaults
  version identities.
- Review failed Calculate/Send/workflow responses and Edge/Postgres logs; record only stable error
  codes, never tokens, attestations or secret values.
- For every issued beta Quote, compare final rate and inputs with the spreadsheet and record the
  explanation for every difference.
- Label freight in the tracker as either `governed-master` or `Maker-entered`; for manual mode,
  record the explicit ₹/kg value used.
- Inspect persistent calculation provenance, snapshot identities, workflow actor/time and the
  permanent Quote reference.
- Triage defects as Speedbreaker, Fix in this increment, Follow-up debt or Observation.

## Feedback channel and issue log

Feedback channel: **"NAG App Beta Tracker" Google Sheet** (Product Owner nomination, 2026-09-17).
Every defect, difference and observation is recorded there; informal messages are not acceptance
evidence. The table below mirrors the sheet's columns so an entry can be copied either way.

Daily checker: **NikunjRL** (Product Owner nomination, 2026-09-17) — owns the daily operating check
above and the alongside-week spreadsheet comparison for every issued beta Quote.

| Date/time | Quote/Batch reference | Reporter | Classification | Summary | Owner | State |
|---|---|---|---|---|---|---|
| — | — | — | — | No beta entries yet | — | Prepared |

## Kill switch

Use the narrowest lane that contains the problem.

1. Immediately revoke the affected beta user's plant capabilities at the beta plant. For a full
   beta stop, revoke `make_quote` from Makers and `check_quote` from Checkers; retain only the access
   needed to investigate read-only evidence.
2. Confirm the running backend refuses the revoked caller. This is the immediate, server-enforced
   stop and does not wait for a frontend deployment.
3. Redeploy the frontend without `limited_beta` and without the beta destination flags. Flags are
   build-time, so an existing build does not change until redeployed.
4. If trusted Calculate itself is implicated, remove the route from use by revoking Maker capability;
   do not expose, rotate or delete attestation material in a debugging transcript.
5. Preserve all Quote revisions, calculations and workflow events. Do not delete evidence to unwind
   a beta action.

## Backup and recovery record

The pre-go-live backup is a go-live gate and has not been taken yet.

| Field | Value |
|---|---|
| Backup timestamp | Pending |
| Backup method / platform record | Pending |
| Latest migration | Pending final Wave A/B application |
| Restore target/check | Pending |
| Recorded by | Pending |

At go-live, record the Supabase backup/PITR status and restore point before granting beta
capabilities. Do not claim recovery readiness from configuration alone.

## Edge secret handoff

The Product Owner confirmed on 2026-09-17 that exactly `QCA_KEY_ID` and `QCA_KEY_HEX` are provisioned
in Supabase Dashboard → Edge Functions → Secrets Management. `QCA_KEY_HEX` must be 64 lower-case hexadecimal characters (256
bits); `QCA_KEY_ID` must match the database keyring identifier. Never paste either value into this
document, a repository file, a command transcript or chat. Confirm only that both names are present.

## Known issues before entry

### Customer Pricing History interim activation — 2026-09-24

Customer Pricing History was deployed before the final clean-slate Beta cutover so the Product
Owner and testers can use it. The five pricing migrations are recorded as `20260924164751`,
`20260924164806`, `20260924164820`, `20260924164835` and `20260924164850`; their 25 catalogue
checks passed. Test pricing records created before the final cutover are disposable. The future
clean reset remains a separate, explicitly authorised operation and was not performed here.

### Live U1 beta-exit evidence — 2026-09-18

Admin `nikunj@avadhootpacks.in` exercised the governed lifecycle for Nagpur Distillers Private
Limited (`G0080-001`, party 245), with database attribution to app user 44:

- Bill-to location 599: proposed with short address `Gurugram`, approved from content version 1,
  then assigned permanent code `G0080-001-02`; active at content version 2.
- Ship-to location 600: proposed with short address `Nagpur`, approved from content version 1,
  then assigned permanent code `G0080-001-03`; active at content version 2.
- Locations 122 and 165 were not updated or reactivated.

This propose → approve → code-assignment evidence counts toward beta exit. The Wave C smoke uses
Ship-to `G0080-001-03`, whose exact governed Nagpur freight entry is ₹2.00/kg.

- Wave A is live and verified as migrations `20260917182121` and `20260917182138`.
- Wave B is live as `20260918040738_seed_nagpur_limited_beta_masters`. One of nine destination
  cities has governed coverage: Ship-to `G0080-001-03` in Nagpur at ₹2.00/kg. Every unmatched
  destination uses explicit Maker-entered manual freight; locations 122 and 165 stayed untouched.
- Construction 2 uses governed grade `25`, not `25WTL` or `24GY`, with the first-version commercial
  values of grade `24`. Its evidence name is `Beta 3-ply C 25/150-16/120-18/150`.
- Job-work enquiries are excluded from limited beta and stay on the spreadsheet.
- Maker and Checker Auth invitations were sent on 2026-09-18; both must activate their logins before
  any capability grant.
- Edge Function `calculate-batch-row` version 1 is ACTIVE with JWT verification enabled. Local
  executor fixtures pass and no deployment/startup errors were present at verification time.
- The stored test aggregate has pre-existing production-data fixture defects: the GSM catalogue
  suite returns boolean into a text runner, the Family D group suite hard-codes Calculation Defaults
  version 1, and the Pricing Basis suite tries to create an overlapping automatic default. The
  unaffected Construction, plant-master, security and product-workflow suites passed 178/178.
- Workflow HTTP/UI activation is committed; deployed-role and state-transition smoke proof remains a
  beta-entry check after Maker and Checker activate their logins.
- Supabase Auth leaked-password protection warning and five unindexed foreign keys are follow-up
  debt; neither was introduced by beta readiness work.

### Wave C readiness recheck — 2026-09-18 (Claude SD, read-only)

No live write, grant or deployment was made. Findings:

1. **Maker and Checker have not accepted.** `sales.01@` and `marketing@` exist only as invited
   Auth rows (invited 2026-09-17 18:50/18:51 UTC; `email_confirmed_at` and `last_sign_in_at` null)
   with no `app_users` row. They are not yet distinct application users, so no capability was
   granted and the smoke did not run.
2. **The database attestation keyring is empty.** `app_private.attestation_keys` has 0 rows.
   `app_private.qca_key()` resolves the verifying key only from that table, so every live Calculate
   attestation from the Edge Function would be refused even with correctly provisioned Edge
   secrets. The Edge half (`QCA_KEY_ID`, `QCA_KEY_HEX`) is confirmed; the database half — one
   `active` row whose `keyid` equals `QCA_KEY_ID` and whose 32-byte `key` equals `QCA_KEY_HEX` — is
   Product Owner out-of-band provisioning (S7-R/1) and has not happened. This is the
   attestation-activation-pending condition; the fence stays closed until it clears. Key values were
   not read.
3. **Two active accounts already hold `make_quote` and `check_quote` at `NAG`** (and at `KOL`,
   `PUN`): app user 44 (`nikunj@`) and app user 45 (`ClaudeCode`, `claude@com`, last sign-in
   2026-09-15). User 45 is not named in the fence above.
4. **Maker ≠ Checker is not database-enforced.** `20260911091000_s9c_quote_workflow_gates.sql`
   (S9C-23/24) deliberately permits a dual-capability Maker to self-approve and records it
   truthfully. Different-person approval therefore depends entirely on the Maker holding no
   `check_quote` and the Checker holding no `make_quote` at `NAG`, and on 44/45 not acting in beta.
5. App user 3440 `__p2_fixture_owner` (synthetic fixture) is active with zero capability grants.
6. The backend workflow signal models Send → **Submit** → Approve → Issue
   (`quote-gen-be/workflow_activation.py`); the smoke must include the Maker Submit step.

### Production deployment — 2026-09-18

`main` was fast-forwarded to `data-model/s0-provenance` in both repositories (frontend
`c43903d → 0d22293`, backend `82a807b → 716f1b5`). Vercel production `/health` reports revision
`716f1b5…` from `VERCEL_GIT_COMMIT_SHA`; the frontend serves the PKGCanvas build and its login screen
loads without console errors. Pre-push gates: `npm run build` and backend `py_compile` clean. No new
environment variable is required. Production frontend flags are dashboard-managed and were not
changed; `limited_beta` is still unset.

### Beta user onboarding — why the dashboard invitations cannot be used

The 2026-09-17 invitations were sent from the Supabase dashboard and link to the project Site URL
(localhost). Resending them to the Vercel URL would still not work: the application signs in with
email + password through `POST /auth/login` and has no invite-acceptance or set-password screen; a
first sign-in creates an application identity only from an `app_private.pending_invitations` row, and
none exists; and the invited Auth rows are unconfirmed. The governed path is Admin → Users/Access →
Create user (`POST /admin/users`), which creates a confirmed Auth account, returns a temporary
password and, through `admin_create_app_user`, grants exactly `plant_access` + `make_quote`
(role `maker`) or `plant_access` + `check_quote` (role `checker`) at the named plant. Because
creation and the NAG grant are one atomic step, creating the users opens the fence.

### Beta users created — 2026-09-18 (read-only verification)

The Product Owner deleted the two unconfirmed dashboard-invited Auth accounts, created both users
through Users/Access on the Vercel application, and reported the Supabase Site URL updated to the
Vercel frontend (Auth URL configuration is not readable from this session, so that is recorded as
reported, not verified). Verified live:

- Maker: app user 3535, Auth account confirmed, active; NAG `plant_access` + `make_quote` only.
- Checker: app user 3536, Auth account confirmed, active; NAG `plant_access` + `check_quote` only.
- Distinct application users; neither holds the other's quote capability; both granted by app user 44.
- No unlinked Auth account remains. Neither user had signed in at verification time.
- `app_private.attestation_keys` still has **0 rows**: live Calculate cannot verify until the
  Product Owner provisions the matching database key, so the smoke cannot yet start.
- Users 44 and 45 still hold `make_quote` + `check_quote` at `NAG`; ruling outstanding.

### Incident — governed Nagpur freight lane deleted by stored tests (found 2026-09-18)

Approved Freight Set Version 246 (`Nagpur Limited Beta Freight Set`, used by Release 799) now has
**0 entries**. The Wave B seed inserted exactly one (`NAG` → Location 600 / `G0080-001-03`,
₹2.0000/kg) and asserted it in the same transaction. Two stored pgTAP suites clean up with a
plant-wide delete that removes **every** `NAG`/`PUN` freight entry, real ones included:

- `20260905194804_s5_2_family_d_plant_masters_tests.sql:267`
- `20260905195206_s5_3_pricing_basis_tests.sql:377`

They were written when the live masters were empty, and ran against live data when the aggregate
`tests.run_all()` was executed after the seed. Every other cleanup in both suites is fixture-scoped.
Verified intact: 19 Sectors, 17 Rate entries (version 512), Release 799, 4 Constructions and 4
adoptions, and Location 600. Inserts into an approved version are guarded
(`trg_fe_follows_version`); deletes are not.

**Repaired 2026-09-18 (Product Owner approved; backend `e7fb926`):**

- `20260918090723_scope_family_d_and_pricing_basis_test_cleanup` rewrote the three plant-wide cleanup
  deletes in place so each suite deletes only entries and releases under its own freight set. An
  audit of every stored `tests.*` function found no other delete or update that can reach real rows.
- `20260918090810_restore_nagpur_beta_freight_lane` re-inserted the identical approved lane into the
  same approved Version 246, so Release 799 keeps its identity. It is now entry 190: `NAG` →
  Location 600, ₹2.0000/kg, `created_by` 44. `trg_fe_follows_version` was disabled for that one
  insert only and is verified re-enabled.
- Rolled-back proof: `tests.family_d_plant_masters()` passes 48/48 and leaves the real lane and
  Release 799 intact. `tests.pricing_basis()` still aborts on the known pre-existing overlap with the
  real automatic default (`ex_pbr_default_no_overlap`) before its cleanup, so its scoped cleanup is
  proven by source audit, not by execution. No fixture residue remained.

Still open: the handoff's fixture defects (GSM boolean result, Pricing Basis default overlap, and any
suite assuming Calculation Defaults version 1 is unused). Until they are repaired, `tests.run_all()`
is not a usable gate on production. The S7-R suite inserts its own active key `t1`, so once the real
attestation key is active that suite will fail rather than touch it. The real key must never be
named `t1`.

### Product Owner rulings — 2026-09-18

- **Users 44 and 45 keep their current capabilities for beta**, including `make_quote` +
  `check_quote` at `NAG`.
- Both beta users signed in on the Vercel application on 2026-09-18 (Snehal 06:51, Sonali 06:52 UTC).
- **Snehal (3536) is also a Maker at `NAG`** (granted as above): add `make_quote` so she can prepare quotes as well
  as check quotes prepared by others. The rule is now per Quote — a Quote's Checker must not be
  its Maker — and is enforced by operation and the daily self-approval check, not by the
  database. The Wave C smoke still runs Sonali (Maker) → Snehal (Checker).
- **Superseding ruling, later on 2026-09-18 — all permissions to all users for verification.** So
  that users can see every screen and exercise every intended workflow, access is not restricted by
  role for now. Migration `20260918094026_open_all_capabilities_to_beta_users` gave Sonali (3535)
  and Snehal (3536) the complete set app user 44 holds: all 6 group capabilities, including
  `administer_users`, and all 7 plant capabilities at `NAG`, `PUN` and `KOL`. Users 44, 45, 3535 and
  3536 are now identical. Consequences, accepted by this ruling:
  - the NAG-only fence no longer holds for users;
  - anyone may change user access;
  - anyone may propose and approve live commercial masters;
  - anyone may approve their own Quote.

  The daily self-approval check and the operating rule "Nagpur only; job work stays on the
  spreadsheet" remain in force. Restricting again uses the same operation (kill switch).
- **One-window Prospect creation (PO ruling 2026-09-18).** Creating a Prospect from the Batch
  Client field sent no Sector, so the backend refused it ("sector_id is required when proposing a
  new Family"), and choosing the Batch Sector closed the panel and lost the typed name. It is now a
  single window (`src/tabs/batch/ProspectCreateModal.jsx`) with five required fields: Prospect
  name, governed Sector, Producing Plant, Delivery to (chosen only from the Batch Profile's own
  freight destinations) and Customer Type (defaults to New; it feeds only the margin suggestion).
  Likely duplicates are shown first, and explanatory text was removed at the PO's request. Create
  sends `{display_name, sector_id}` to the same governed route, then applies all five to the Batch.
  This deliberately widens the Slice D write boundary:
  - `applyLabelToProfile` accepts `client`/`sector`/`plant` and still refuses `delivery`;
  - Delivery and Customer Type are written only as listed options, so a Location label can never
    reach the freight key;
  - margin and freight fields never move.

  `test:batch-quick-create` pins all of this. Not included, by judgment: Price Context (it varies
  per enquiry) and a ship-to Customer Location (not needed to create or price; the existing
  Location action covers it). The Plant is not yet stored on the Customer Family; that needs
  Amendment 06.
- The grant is made by the Admin through Users/Access (`POST /admin/users/3536/capabilities`,
  complete set with `expected_content_version`), not by a direct database write.

## Go-live checklist

- [x] Direct confirmation received for the two Wave A live migrations; applied ledger entries and
      authenticated/anon proof recorded.
- [ ] Single Wave B content approval recorded; idempotent seed applied and inspected.
- [ ] Named users and beta plant recorded; wrong-plant and ungranted checks pass.
- [x] `QCA_KEY_ID` and `QCA_KEY_HEX` confirmed present without reading their values.
- [ ] Matching `active` key provisioned in `app_private.attestation_keys` (0 rows on 2026-09-18).
      Procedure given to the PO: a one-shot SQL Editor snippet generates the key inside the
      database and shows it once; the PO copies both values into the Edge secrets. SR DEV never
      sees the values, and the key id is never `t1`.
- [ ] CP-108 passes; Edge Function deployed with JWT verification; deployed version recorded.
- [ ] Maker Calculate → Send → Submit → Checker Approve → Maker Issue smoke passes with persistent
      evidence.
- [ ] Backend-reported workflow activation drives enabled UI actions; unavailable actions remain
      disabled with a reason.
- [ ] Production build contains only approved beta flags; Excel and PDF exports visibly say BETA.
- [ ] Backup/restore point recorded above.
- [x] Feedback channel named; daily checker assigned.
- [ ] Product Owner explicitly declares the limited beta live.
