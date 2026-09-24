# Customer Pricing History — P0.5 pre-activation qualification and activation plan

Date: 2026-09-24 · Author: Claude (Sr Dev) · Reviewer: Codex · Go-live authority: Product Owner

State: **Qualified for activation — NOT activated.** No migration applied, no flag enabled, nothing
deployed, no Beta or production data changed. Authority: the Phase 0 plan
(`customer-pricing-history-phase-0-implementation-plan-2026-09-23.md` §10 P0.5, §11).

**Correction (same day):** the governed **Void negotiation round** journey was added before activation
(successor migration `20260924164850_customer_pricing_history_p0_5_void_round.sql`, route
`POST /masters/pricing-events/<id>/void`, confirmation UI). Totals, activation order and decisions below
include it.

## 1. Evidence levels (kept separate)

| Level | Exercised? | What it proves |
|---|---|---|
| Pure model | Yes | Parsing, layouts, summaries, paste mapping, filters, request bodies |
| Route double | Yes | Route validation, stable errors, caller-token forwarding, one-RPC batches |
| Rollback database | Yes (authorised project, self-aborting) | Schema, RLS, grants, definers, CAS, audit, paste binding, independence |
| Fixture browser (1366×768) | Yes | Presentation and request shape only |
| Authenticated local | **No** | No local backend with a signed-in user was run |
| Authorised Beta read-only | Partial | Read-only SQL probes of the project (migration list, advisors, personas); no app journey |
| Live Beta | **No** | Nothing is deployed |

The rollback rehearsal simulates the three database personas with `request.jwt.claims` + `set role`
(app users 44 and 45 hold `read_party_master`; 3440 does not). That is database-level evidence, not an
authenticated HTTP journey.

## 2. Checks and totals

| Gate | Command | Result |
|---|---|---|
| Customer Pricing History fixtures | `npm run test:customer-pricing` | **360 / 360** |
| P0.1 / P0.2 / P0.4 / P0.4.1 routes | `venv/Scripts/python.exe tests/test_customer_pricing_p0_4_1_routes.py` (chains all four) | **71 · 58 · 70 · 46**, 0 failed |
| P0.5 void route | `venv/Scripts/python.exe tests/test_customer_pricing_p0_5_void_routes.py` | **26 / 26** |
| Costing / Quote independence (frontend) | `npm run test:costing`, `test:pricing-basis`, `test:quote-evidence`, `test:journey`, `test:governed-calculate-send`, `test:beta-export`, `test:batch-row-lifecycle`, `test:pricing-group`, `test:screen-standard` | all PASS (35 · 110 · 56 · 70 · 9 · 4 · 18 · 31 · 38) |
| Costing / Quote independence (backend) | `tests/test_quote_workflow_routes.py`, `test_batch_calculate_send_routes.py`, `test_pricing_basis_route.py`, `test_batch_pricing_basis_route.py`, `test_quote_revision_export.py` | all PASS (9 · 12 · 31 · 127 · 15) |
| Targeted lint | `npx eslint src/lib/customerPricing*.js src/tabs/customer-pricing/ scripts/customer-pricing-fixtures.mjs` | clean |
| Module contract / build | `npm run test:module-contract`, `npm run build` | pass |
| Whitespace | `git diff --check` (both repos) + direct scan of untracked pricing files | clean |
| P0.4.1 rollback rehearsal | `tests/cph_p0_4_1_rollback_rehearsal.sql` after the four migrations | failures=0 · 21 catalogue gates · 26 checks |
| **P0.5 qualification rehearsal** | `tests/cph_p0_5_qualification_rehearsal.sql` after the four migrations | **failures=0 · 15 advisor-equivalent lints · 45 checks** |
| **P0.5 void rehearsal** | `tests/cph_p0_5_void_rehearsal.sql` after all **five** migrations | **failures=0 · 47 checks** (25 catalogue rows + 22 void scenarios) |

The P0.5 rehearsal's first run reported two failures, both in the test itself and both confirmed with a
standalone probe: `pg_get_constraintdef` renders the 30-minute bound as `'00:30:00'::interval`, and
`update … set id = id` fails on the identity column with 428C9 before the privilege check. The test
was corrected and the second run passed.

**Executed-text proof.** Each rehearsal logs `md5(current_query())`. The MCP route appends its own
106-character provenance comment with a millisecond timestamp. The logged digest matched the local batch
plus that suffix (P0.5 run 2: `a23d2163…`, suffix stamped 11:03:55.795Z), so the SQL that ran is exactly
the four repository migrations plus the committed tail. The void run matched the same way:
`1d23a9ee…`, 145,525 characters, suffix stamped 15:52:56.146Z — all five migrations plus
`cph_p0_5_void_rehearsal.sql`.

**Residue after each abort:** 0 pricing relations, `cph_*` functions, policies, triggers, types, preview
tables and pricing migration-history rows; `supabase_migrations.schema_migrations` still 232 rows.

## 3. Representative scenarios exercised

| Scenario | Rollback DB | Pure model | Fixture browser |
|---|---|---|---|
| Every frequency (monthly, bimonthly, quarterly, half-yearly, annual, ad hoc) | Cycle created for each | labels for all, FY and calendar | — |
| All 4 Rate Bases × all 3 Weight Bases | all 12 accepted via CAS, unknown refused | basis display, equivalents, per-unit conversions | — |
| Excluding / including GST | GST-inclusive round snapshot | tax defaults, GST validation | — |
| Stable Terms, effective dates | later version closes prior; overlap refused (23P01); next Cycle picks the Oct version | applicable-version selection | Stable Terms panel |
| BF schedules, derived rates, overrides | signed deltas snapshotted; one override beside the derived rate | BF parse, floor, schedule mapping | BF paste preview verdicts |
| Fixed annual conversion/freight components | term components snapshotted on the round | component conversion across units | — |
| Scopes: Customer, Location, Plant, SKU, free text | all accepted; SKU at another Plant refused (23503) | scope display, no invented identity | — |
| First offer, counters, final, correction, void | 4 rounds in order; correction is one audited update; void of the latest final keeps every column, the BF snapshot and the numbering, and leaves the earlier final as the latest active one | first/latest/final from active rounds only; voiding the only final leaves it blank | void confirmation, retained voided entries, Final agreed ₹54.25 → blank |
| Start next cycle | 6/6 lines blank, SOB reset, linked to prior | request carries no rate or SOB | — |
| SOB: not captured, undefined, n/a, 0.00 %, 40 %, 0 boxes, 25,000 boxes | all five states distinct in one Cycle | all states, bounds, ambiguity | edit and filter at 1366 |
| Standard, Transposed, grouped, saved layouts | — | identical requests across layouts | all four at 1366; saved view stored |
| Main-grid paste and BF-schedule paste | bound preview, one apply | mapping and verdicts | both previews at 1366 |
| Change history, stale/conflict | stale CAS on 6 record kinds writes nothing | history entry mapping | conflict banner, draft kept |

## 4. Beta-laptop presentation (fixture browser, 1366×768)

Measured with element offsets (the pane's screenshots are scaled). Beta resolution is taken as
1366×768 per the Batch Builder and journey evidence; the confirmed resolution is still PO decision D-9.

- No page-level horizontal scroll; every toolbar control fits; the filter bar (now with the SOB filter)
  stays one 26 px row.
- Standard, Transposed, grouped, Mixed-values disclosure, SOB filter (“Showing 1 of 6”), saved view: no
  clipped or off-screen control.
- Paste preview: 1327 px wide, nothing clipped; a bare SOB number is blocked with Treat as % / Treat as
  boxes; Validate is disabled while blocked and becomes “Validate 3 changes” once resolved; one
  `POST …/pricing-paste/preview` carried all three operations with their own CAS versions.
- **Defect found and fixed:** the expanded negotiation timeline was 1497 px inside a 1325 px matrix, so
  the round actions (Correct, BF ▾, collapse) and the BF-schedule paste box (Close, textarea at x=1509)
  sat off-screen. Components, Source and Notes are now capped (full text on hover). Measured after the
  first fix: timeline 1281 px, matrix fits, 0 off-screen controls with the timeline and BF paste open.
- **Void round (1366 geometry).** Adding “Void round” beside Correct widened the actions column to
  171 px and pushed the timeline back to 1379 px inside the 1325 px matrix (BF ▾ off-screen) — caught by
  this smoke and fixed: the caps are now 144 px and the row actions keep Correct · Void round on one
  line with BF ▾ wrapping under them. Measured after: timeline 1266 px, no horizontal scroll, 0
  controls outside the page.
- Fixture mode: Void round is offered only on active rounds; the confirmation names type, date and
  rate (“Final agreement · 2026-08-30 · ₹54.25 /kg paper consumed — round #4, read at v1”); an empty
  reason is refused; a valid reason shows the request it would send
  (`POST /masters/pricing-events/304/void` with `party_id`, `expected_content_version`, `reason`) and
  **no request left the page**.
- Real component with a stubbed backend (no request reached any server): a first confirm answered 409
  `STALE_VERSION` kept the panel and the typed reason with the “nothing was voided” message; after
  Reload the panel offered “Use latest version” (v2) without retyping; the re-confirm sent v2, closed
  the panel and reloaded. The compact **Final agreed changed from ₹54.25 to blank** (line 31 has no
  other active final; nothing restored), the round count dropped from 4 to 3, both voided rounds stay
  in place with “VOIDED” and “Voided: <reason>”, and the voided round offers no Correct, Void, Override
  or Paste while its BF schedule stays readable. A round whose only change was the void is no longer
  labelled “corrected”.
- States rendered through the real component with stubbed responses: loading, denied (“needs the
  Customer master read permission”), unavailable (**“Pricing history is not activated in this
  environment yet.”** — the message environments without the migrations keep showing), failed with
  Retry, empty (record the mechanism first), partial (“Showing the newest 3 cycles.”), stale (conflict
  banner; the draft 30000 is kept in the editor), change history partial/unreadable-actor wording and
  SOB labels (“SOB mode”, “SOB allocated boxes: — → 25,000 boxes”).
- SOB boxes editor fits with and without an expanded line.

## 5. Authorization and concurrency (rollback database unless stated)

- anon: read of lines and change log, mechanism write, paste preview and a direct private-definer call — all 42501.
- authenticated without `read_party_master`: reads 0 Cycles (RLS); create Cycle, update Line, paste preview and Start next cycle — all 42501.
- authorised user: 40 direct INSERT / UPDATE / DELETE / TRUNCATE statements on the 10 tables and 2 on the preview table — all 42501. Reads work (8 Cycles).
- identity substitution: another Customer's Line or Cycle through 245's paste → P0002; another Customer's Location → 23503; another Customer's Stable Term → 22023.
- stale CAS on mechanism, Cycle, Line, Stable Term, round and BF override → PT409; audit delta 0; rows unchanged.
- paste: another user's preview → P0002; stale preview → PT409 with the other user's save kept, audit delta 0, preview unconsumed; tampered digest → PT412; reuse → PT410; expired → PT410 and nothing written.
- mutation and audit are one transaction: a failing later op (23505) undoes the earlier Cycle change and its audit row.
- no hard delete: no DELETE/TRUNCATE grant and no pricing function contains either; the change log and BF deltas refuse even the owner (42501).
- **void** (void rehearsal): anon and no-capability → 42501; another Customer's event, or this event
  through another Customer → P0002; missing, blank, 2- and 501-character reasons → 22023; stale → PT409
  with audit delta 0; a void whose transaction fails leaves neither the status change nor its audit
  row; a successful void changes only status and reason (every other column byte-identical, BF snapshot
  rows unchanged, no round added or removed, chronology `1,2,3 active · 4 voided`), writes one audit
  row `active → voided` with the reason and actor 44; re-void, correction and BF override on the voided
  round → 55000 with audit delta 0; even the owner cannot rewrite or un-void it (55000), cannot combine a
  void with a rate change (22023) or void without a reason (23514), and cannot delete it (42501); a paste
  batch that touches the voided round is refused whole and its earlier operation rolled back.
- **void route** (route double): 401 / 403, exact RPC parameters, 9 bad inputs refused before any RPC,
  500-character reason accepted, P0002 → not found, PT409 → stale, 55000 → `ROUND_VOIDED`, 42501 →
  denied, PGRST202 / 42883 → `MASTER_UNAVAILABLE`; correction and BF override on a voided round answer
  `ROUND_VOIDED`; a paste onto a voided round is blocked; the read returns `void_reason`.
- layout storage (fixture browser): one key `qgos_cph_layout:<user>:<party>`, 1872 bytes, no rates, codes, scopes or tokens.
- Route doubles: 401 anonymous, 403 without the capability, stable error codes, caller token only (P0.1–P0.4.1 gates).

## 6. No effect on Costing, Quote or issued evidence

- **Behavioural:** every one of the 59 non-pricing `public` / `app_private` tables was byte-identical
  (row-set md5) before and after the full P0.5 scenario and authorization run inside the rehearsal,
  and again before and after the void run.
- **Static (database):** no pricing function references a Quote, calculation, Pricing Basis, Batch,
  rate, freight, sector, construction or SKU-version table; no pricing trigger is attached outside the
  pricing tables.
- **Static (frontend):** only `CustomerFamiliesScreen.jsx` (the entry point, flag-gated) and the
  DEV-only fixture route import pricing modules; pricing modules import nothing from Costing, Quote,
  Batch or Pricing Basis.
- **Static (backend):** the pricing routes read only pricing tables plus identity lookups (parties,
  locations, plants, SKUs, app users) and write only through `cph_*` RPCs.
- The Costing, Pricing Basis, Quote evidence, journey, Calculate/Send, beta export, Batch row and
  Pricing Group gates all pass (section 2).

## 7. Advisors

- **Hosted advisors (read-only, live project):** run today. They cannot see the pricing objects, which
  exist only inside rolled-back batches. Baseline findings, all pre-existing and outside this feature:
  security — INFO `rls_enabled_no_policy` on `app_private.email_change_audit`, WARN leaked-password
  protection disabled; performance — 5 unindexed foreign keys on `app_private.pending_quote_revision_sources`
  and `public.quote_revisions`, 21 INFO unused indexes.
- **Advisor-equivalent lints inside the rehearsal (15/15 pass):** RLS enabled and forced on all 11
  pricing tables; one policy per exposed table; no multiple permissive policies; every policy wraps its
  capability call in a sub-select; every pricing foreign key covered by a leading-column index; no
  duplicate index; every pricing function pins `search_path`; no SECURITY DEFINER function in `public`;
  no pricing function executable by PUBLIC or anon; internal helpers not executable by authenticated;
  table grants SELECT-only; no DELETE/TRUNCATE in any pricing function; no reach into Costing/Quote
  objects; no trigger outside pricing tables; preview expiry bounded to 30 minutes. These 15 ran on the
  four-migration chain. After the void migration, the chain-wide catalogue rows still pass (every
  `cph_*` definer pins an empty `search_path`, RLS forced, SELECT-only grants, indexed foreign keys),
  and CPH5-3 / CPH5-4 check the void function itself: authenticated EXECUTE only, no PUBLIC or anon
  grant, private guard, empty `search_path`, SECURITY INVOKER public wrapper. The void migration adds no
  table, index or policy.
- **Hosted advisor evidence that needs the objects to exist:** only obtainable after activation (step
  A5 below). Expected new findings: INFO `rls_enabled_no_policy` for `app_private.cph_paste_previews`
  (deliberate — only the definers touch it) and INFO `unused_index` for the new indexes until used.
  Anything else is a stop condition.

## 8. Defects fixed in P0.5

| File | Change |
|---|---|
| `src/tabs/customer-pricing/PricingLineDetail.jsx` | Timeline Components, Source and Notes capped (now 144 px); the Source hover shows its full “type · date · reference”; **Void round** button, confirmation panel (type/date/rate, required reason, kept on failure, “Use latest version”, fixture request preview), reload on success, “Voided: reason” in Notes, row actions wrap at 1366, void-only version bump not called a correction |
| `src/tabs/customer-pricing/BfScheduleTable.jsx` | No Override, Change override or Paste BF rates on a voided round |
| `src/tabs/customer-pricing/ChangeHistoryPanel.jsx` | “Status” and “Void reason” labels |
| `src/tabs/customer-pricing/LineCommercialBasis.jsx` | “No active agreement in the prior cycle”, naming a kept voided agreement |
| `src/lib/customerPricingActions.js` | `voidEvent` path; `ROUND_VOIDED` is its own outcome, not “stale” |
| `src/lib/customerPricingModel.js` | `validateVoidReason` (trimmed 3–500), `voidRoundBody` |
| `src/lib/customerPricingFixture.js` | Voided round carries `void_reason`; its change entry records it |
| `scripts/customer-pricing-fixtures.mjs` | P0.5 caps/hover checks (2) and void checks (24) |
| `quote-gen-be/supabase/migrations/20260924164850_customer_pricing_history_p0_5_void_round.sql` | New successor migration: `void_reason` + check, status-only void guard trigger, `app_private.cph_void_round` (SECURITY DEFINER, empty `search_path`, caller + `read_party_master` + event-to-Customer ownership + CAS), public SECURITY INVOKER wrapper, EXECUTE for `authenticated` only, `tests.cph_p0_5_catalogue()` |
| `quote-gen-be/server.py` | `POST /masters/pricing-events/<id>/void`; `ROUND_VOIDED` error; event read returns `void_reason`; paste refuses BF overrides on a voided round |
| `quote-gen-be/tests/test_customer_pricing_p0_5_void_routes.py` | New void route gate (26) |
| `quote-gen-be/tests/cph_p0_5_qualification_rehearsal.sql` | New qualification rehearsal (lints, scenarios, authorization, concurrency, independence) |
| `quote-gen-be/tests/cph_p0_5_void_rehearsal.sql` | New void rehearsal (47 checks) |
| `docs/customer-pricing-history-phase-0-implementation-plan-2026-09-23.md` | §4.10 and the validation list now describe SOB as percentage **or** allocated quantity for the current Cycle, explicit 0.00 % / 0 boxes, mutually exclusive, no separate allocation frequency |

## 9. Debt classification

**Development Speedbreaker:** none.

**Fix in this increment:** the 1366 timeline width — done (section 8). **Governed void writer — done**
(previously follow-up debt): Void round with CAS, required reason, status-only change, audit, frozen
afterwards, never a delete (sections 4, 5, 8). The 1366 regression it introduced was found by the smoke
and fixed.

**Plan wording — done:** Phase 0 plan §4.10 now matches the accepted SOB states.

**Activation preconditions (done at activation, not qualification defects):**

1. **Isolate pricing-only commits.** The backend working copy of `server.py` also carries another
   lane's uncommitted S3 Batch-row quantity changes (`_optional_nonnegative_integer`,
   `_BATCH_ROW_QUANTITY_FIELDS` for `volume` / `sales_moq`, which are Calculate inputs). The frontend
   worktree carries uncommitted Costing / Batch work (`useCostingBatchBridge.js`, `CostingTab.jsx`,
   `SpecForm.jsx`, `BatchWorkspacePanel.jsx`, `batchRowModel.js`). Deploying either working copy would
   couple this feature to unfinished Calculate work. Activation commits must stage only the pricing hunks
   (for `server.py`: `import uuid`, the `DUPLICATE_RECORD` / `OVERLAPPING_VERSION` status and message
   entries, and the Customer Pricing History route block including the void section). This is the one
   remaining pre-activation requirement on the code side; the manifest is in section 12.
2. **Pre-go-live backup / PITR record**, the gate already listed in `beta-operating-sheet.md`.

**Follow-up debt:**

- Change-history labels are friendly only for the SOB, status and void-reason fields; other fields show
  column names.
- The 0–999,999,999 box bound is a reversible implementation limit.
- The production bundle keeps the fixture tag string and one tiny helper from the DEV-only fixture
  module (no fixture data or profile).
- Vite ignores the preview tool's assigned port (bound 5174 when 5173 was taken).

**Observation:**

- Rehearsal rows are synthetic and rolled back, but they are written against the real Customer id 245
  and parties 315 / 1151.
- Pre-existing hosted-advisor findings listed in section 7 are unrelated to this feature.

## 10. Activation plan (prepared, not executed)

**Scope:** Beta project `czettlukuenlnnrmvhqt`, frontend `quote-gen-fe.vercel.app`, backend
`quote-gen-be.vercel.app`. Independent of S2 exact-recipient (`20260923170000`) and of Quote
Calculate/Send.

### A. Preflight (all must pass; any failure stops)

1. `list_migrations`: the tip is `20260924084505`, and none of the five pricing versions or names are
   present. Pre-state probe returns 0 pricing relations, functions, policies, triggers and types.
2. Re-run the P0.5 qualification and void rehearsals on the day. Expect failures=0, a matching md5 and
   zero residue for each.
3. Record the backup / PITR restore point in `beta-operating-sheet.md`.
4. Pricing-only commits prepared in both repos (precondition 1); all gates in section 2 re-run green on
   exactly those commits.
5. Hosted advisors baseline captured (section 7).

### B. Database (Product Owner authorisation required)

Apply, in this order, each file's exact text through the MCP `apply_migration` route (the CLI route
needs `supabase login`, a credential change):

1. `20260924164751_customer_pricing_history_p0_1.sql`
2. `20260924164806_customer_pricing_history_p0_2.sql`
3. `20260924164820_customer_pricing_history_p0_4.sql`
4. `20260924164835_customer_pricing_history_p0_4_1_sob_allocated_boxes.sql`
5. `20260924164850_customer_pricing_history_p0_5_void_round.sql`

Do **not** apply `20260923170000_quote_revision_exact_recipient.sql` as part of this activation.

The MCP route records the apply time as the version, so rename the five local files to the recorded
versions afterwards (existing practice).

Post-migration catalogue checks (read-only):

- every row of `tests.cph_p0_1_catalogue()`, `cph_p0_2_catalogue()`, `cph_p0_4_catalogue()`,
  `cph_p0_4_1_catalogue()` and `cph_p0_5_catalogue()` is ok (25 rows);
- hosted security and performance advisors show only the expected new INFO findings;
- 0 rows in every pricing table;
- migration history shows exactly the five new rows.

### C. Backend deploy

Commit and push the pricing-only backend changes (routes plus error-map entries). Vercel deploys from
git. Verify `/health` reports the new revision. With the migrations present, an unauthorised read
returns 403 and an authorised read of a Customer returns the empty history. Without the migrations,
the same routes answer `MASTER_UNAVAILABLE`, which is harmless.

### D. Frontend deploy

`src/lib/featureFlags.js`: move `"customer_pricing_history"` from `DEVELOPMENT_DEFAULTS` into
`BUILD_DEFAULTS`, and replace the development-only comment with the activation record. Update the
production-build-flag row of `docs/beta-operating-sheet.md`. Commit only these plus the pricing
frontend files, push, and verify the live bundle contains the flag array.

The flag only mounts the workspace; access remains `read_party_master` (currently app users 44, 45,
3535 and 3536). A build without the migrations keeps showing “Pricing history is not activated in this
environment yet.”

### E. Authenticated smoke (one Beta user plus the Admin, on the Beta URL, a test Customer agreed with the PO)

1. Open Customer Family Details → Customer → Pricing history (empty).
2. Record the mechanism, create a Cycle, add a Location line, record offer → counter → final, set SOB
   to 25,000 boxes and to 0.00 % on another line.
3. Reload; values persist; change history shows actor, time and SOB mode.
4. Paste a 3-row SOB block (with one bare number resolved explicitly); preview → apply; one preview and
   one apply request.
5. Stale test: two browsers edit the same line; the second gets the conflict and keeps its draft.
6. A user without `read_party_master` is refused.
7. Start next cycle; SOB is blank on the new lines.
8. Void the final agreement with a reason: it stays in the timeline marked Voided, Final agreed falls
   back to the previous active final (or blank), change history shows actor, time, status and reason,
   and Correct / Override are no longer offered on it. A second browser voiding the same round with the
   old version gets the conflict and keeps its reason.
9. Confirm with a read-only query that no Quote, calculation, Pricing Basis or Batch row changed.

### F. Rollback / disable (narrowest first)

1. **Hide:** redeploy the frontend with the flag back in `DEVELOPMENT_DEFAULTS` (build-time). Data is
   kept.
2. **Refuse access:** revoke `read_party_master` from affected users (server-enforced immediately; note
   this also hides Customer masters).
3. **Remove schema** (only if no real pricing data was recorded, and with PO authorisation): a new
   forward migration dropping the pricing objects in reverse order. Never delete recorded commercial
   history to unwind a Beta action — preserve and export it first.

### G. Evidence capture checklist

migration list before/after · catalogue rows · hosted advisors before/after · backend `/health`
revision · frontend bundle flag grep · smoke steps 1–9 with timestamps and the acting user · the
post-smoke independence query · the Beta tracker entry.

### H. Stop conditions

Stop at any of these:

- any preflight failure, rehearsal failure or residue;
- an unexpected migration at the tip;
- a catalogue row not ok;
- a new hosted-advisor WARN or ERROR;
- a backend deploy that carries non-pricing changes;
- `/health` not showing the expected revision;
- any smoke step that writes to a non-pricing table;
- a stale write that overwrites another user's save;
- any authorization surprise;
- a PO instruction to pause.

## 11. Product Owner decisions required before activation

1. Authorise applying the five migrations to the Beta project (section 10 B), after preflight passes.
2. Authorise the pricing-only backend and frontend commits and deploys, including moving the flag into
   `BUILD_DEFAULTS`.
3. Confirm the Beta resolution (D-9). This qualification used 1366×768.
4. Name the test Customer for the authenticated smoke, and confirm that all four current
   `read_party_master` holders may read, edit and void pricing history from day one.

(The earlier void decision is resolved: the governed Void round writer is built and qualified.)

## 12. Pricing-only commit manifest (prepared, not committed)

Nothing is staged or committed. At activation, stage exactly these.

**Backend (`quote-gen-be`):**

- whole new files: the five migrations in section 10 B; `tests/test_customer_pricing_history_routes.py`,
  `test_customer_pricing_p0_2_routes.py`, `test_customer_pricing_p0_4_routes.py`,
  `test_customer_pricing_p0_4_1_routes.py`, `test_customer_pricing_p0_5_void_routes.py`; the six
  `tests/cph_*_rehearsal.sql` files;
- `server.py` — 9 hunks; stage **hunks 1, 2, 3 and 9** only:
  1. `@@ -32` `import uuid` (+1);
  2. `@@ -3468` `_ERROR_STATUS`: `DUPLICATE_RECORD`, `OVERLAPPING_VERSION` (+6);
  3. `@@ -3494` `_ERROR_MESSAGE`: the same two (+3);
  9. `@@ -7290` the Customer Pricing History route block (+1232): mechanism, cycles, lines, rounds,
     correction, Stable Terms, BF sets, references, measures, overrides, next cycle, change log, paste
     preview/apply, and the void section (`ROUND_VOIDED`, `POST /masters/pricing-events/<id>/void`);
- **leave unstaged:** `server.py` hunks 4–8 (S3 Batch-row: `_optional_nonnegative_integer`,
  `_BATCH_ROW_QUANTITY_FIELDS` with `volume` / `sales_moq`, `_batch_row_input`, and the two
  `update_batch_row` hunks) and `tests/test_batch_pricing_basis_route.py` (+40, S3).

**Frontend (`quote-gen-fe`):**

- whole new files (28): `src/lib/customerPricingActions.js`, `customerPricingFilters.js`,
  `customerPricingFixture.js`, `customerPricingLayout.js`, `customerPricingModel.js`,
  `customerPricingPaste.js`; all 19 files in `src/tabs/customer-pricing/`;
  `scripts/customer-pricing-fixtures.mjs`; `docs/customer-pricing-history-phase-0-implementation-plan-2026-09-23.md`
  and this document;
- modified files whose every hunk is pricing (stage whole): `src/App.jsx` (the DEV-only
  `?fixture=p03-pricing` route and its two imports), `src/lib/featureFlags.js` (the
  `DEVELOPMENT_DEFAULTS` flag and comment), `src/lib/persist.js` (the layout-key comment),
  `src/tabs/CustomerFamiliesScreen.jsx` (the flag-gated Pricing history entry point);
- `package.json` — **split**: stage only the `test:customer-pricing` line;
- **leave unstaged:** the `test:governed-row-return` line in `package.json`,
  `scripts/governed-row-return-fixtures.mjs`, `src/lib/governedRowReturn.js`, `useCostingBatchBridge.js`,
  `CostingTab.jsx`, `SpecForm.jsx`, `BatchWorkspacePanel.jsx`, `BatchProfileBar.jsx`, `batchRowModel.js`,
  `batch-first-shell-fixtures.mjs`, `resolver-fixtures.mjs`, `pricing-group-fixtures.mjs` (none refer to
  pricing history) and `docs/README.md`. No pricing module imports `governedRowReturn`.

Before committing, re-run section 2 on exactly the staged tree (for example in a clean worktree with the
staged patch applied).
