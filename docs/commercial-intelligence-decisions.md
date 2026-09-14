# Commercial Intelligence — product decision record

**Status:** approved product decisions from the Commercial Intelligence dry-run Q&A. This is a
canonical decision record, not an implementation plan. It supersedes conversational summaries and
the older Phase 2 module brief wherever they differ.

**Primary objective:** establish a durable culture of capturing commercial intelligence. The first
release must make incomplete, attributable input easy and safe. It must not imply that recorded CI
is complete, is the only source of commercial truth, or is the sole basis of a quotation decision.

**Product authority:** the product owner approves changes to these decisions. An implementer must
not convert deferred ideas into current scope or infer missing business rules.

---

## 1. Governing principles

### CI-D01 — Capture first

- Put the full data structure in place, but optimise the product for easy contribution rather than
  completeness.
- A small amount of attributable intelligence is better than an abandoned comprehensive form.
- Recorded CI will increasingly reflect knowledge people already hold. The app does not claim that
  all relevant knowledge has been entered.
- CI provides context. It never pre-fills margin, changes costing, controls quotation approval, or
  becomes the sole source of truth for a commercial decision.

### CI-D02 — Incomplete records are valid

- Client/scope identity is the only minimum needed to create a CI record.
- Every intelligence field may remain unknown.
- `unknown`, `not applicable`, and `not yet captured` are distinct states; absence must not be
  coerced into a business value.
- One useful observation, summary, or field value is sufficient to save.
- Do not add completeness scores, mandatory-field warning forests, blocked save, or missing-field
  performance targets.
- Checker approval concerns the submitted change set, not completion of the entire client profile.

### CI-D03 — No AI interpretation

- The initial system is deterministic. It does not interpret narrative, decide materiality, infer
  conclusions, or generate a commercial summary.
- Narrative intelligence remains useful and first-class even when it has not been normalised.
- Any deterministic display or nudge must identify its approved structured inputs and scope.

---

## 2. Identity, scope, and record population

### CI-D04 — Permanent grain, permissive capture scope

- The durable structure supports client group, client location, AP plant relationship, and
  portfolio/segment.
- Capture intelligence at the highest scope confidently known. Client group alone is sufficient.
- A Maker is never forced to invent a location, AP plant, or portfolio merely to save input.
- A Checker may narrow, reassign, or split the scope during authorisation.
- Preserve the Maker's original submission when an authorised result is narrowed or split.
- Never silently assume that group-level intelligence applies to all child scopes.

### CI-D05 — Scoped display and inheritance

- Keep group, location, AP-plant relationship, and portfolio intelligence as separate scoped
  records.
- In a specific context, display the most specific applicable approved value first.
- Show broader intelligence as clearly labelled inherited context; do not copy it into child
  records.
- Different values at different scopes are expected and are not automatically conflicts.
- Values at the same field and scope follow normal version and concurrent-change rules.

### CI-D06 — Customers and prospects share the master

- Customers and prospects use the same Client Master and CI structure.
- Prospects are excluded from default client lists and summaries. Users see them only by explicitly
  selecting a Prospects display/filter or opening a specific record for deep dive.
- Prospect status does not make the record eligible for quotation selection.
- Conversion from Prospect to Customer is an authorised status change on the same stable identity;
  it preserves all CI, observations, ownership, and history.
- Dormant, lost, and permanently closed prospects may be archived.

### CI-D07 — Proposed prospect identity

- When no approved master identity exists, create a unique proposed-prospect identity before
  attaching pending CI.
- A Checker/Admin may approve it as new, explicitly merge it into an existing identity, return it,
  or close/reject it while preserving the audit.
- A quotation may continue with its free-text name, but must not pretend the proposed identity is
  already an approved master record.
- Never link a quotation or master through fuzzy name matching.

### CI-D08 — Duplicate handling

- Duplicate detection is advisory. Never merge automatically.
- A Maker may continue when uncertain; label the record as a possible duplicate.
- Merge is an explicit Checker/Admin operation with a preview of identities, scopes, history,
  pending input, and conflicting current values.
- Select one surviving stable identity. Preserve history, observations, attribution, ownership,
  and aliases without rewriting them.
- The retired identity becomes an alias/redirect. Do not treat it as an ordinary archive.

### CI-D09 — Archive, do not erase

- Customers and prospects may be archived with a reason such as dormant, lost, permanently closed,
  or other.
- Archive hides the identity from default lists and new quotation selection.
- Existing quotations and CI-version references remain valid.
- Authorised users may explicitly search/deep-dive archived records.
- Pause pending submissions on archive and present them to the responsible Checker for disposition.
- Ordinary CI updates require reactivation; Admin may add a closure note.
- Reactivation restores the same identity and history. Archive is reversible.

---

## 3. Maker–Checker contribution model

### CI-D10 — Maker input, Checker authorisation

- Makers and other authorised contributors may capture proposed intelligence.
- Maker input is attributable and remains pending until authorised.
- Pending information is visible but unmistakably labelled; it does not replace the confirmed
  Current Picture.
- Pending input may provide context to authorised viewers, but cannot trigger a nudge or enter an
  approved CI snapshot.
- The Maker may edit or withdraw a pending submission before review.
- CI never blocks quotation work while input is pending.

### CI-D11 — Checker outcomes and correction authority

A Checker may:

1. approve;
2. return for clarification;
3. approve with correction; or
4. partially approve a multi-change submission.

- Preserve the Maker's original proposal and the Checker's authorised result.
- Approved portions become current independently; returned portions remain pending.
- Checker authorisation is final. Maker acknowledgement is not required.
- A disagreeing Maker submits a new attributable proposal; completed history is not reopened or
  overwritten.

### CI-D12 — Change-set approval unit

- One natural capture action is one change set: an observation or a related group of field changes.
- Show the prior approved value, proposed value, Maker context, and scope.
- Do not show unchanged fields for approval.
- Permit field/change-level partial approval so one uncertain value does not hold back unrelated
  approved information.

### CI-D13 — Explanation and source are non-blocking

- Capture the proposed value or observation immediately.
- Information date defaults to today but remains editable.
- Offer a quick source type, short context, optional source description, and optional approved link
  or reference.
- Do not require a confidence score.
- Explanation is encouraged, including when replacing an approved value, but is never a save gate.
- When context is omitted, label the submission `Pending input — context not yet added`.
- A Maker may add context later. A Checker may approve using their own knowledge, add/correct the
  context, or return the change.
- Record whether context came from Maker or Checker.

### CI-D14 — Direct Checker and Admin entry

- A Checker may enter immediately authorised intelligence within their assigned scope.
- Label it `Direct Checker entry`; do not manufacture a Maker–Checker trail.
- Admin may enter immediately authorised data and is attributed as Admin.
- A later phase may add dual authorisation for specifically approved high-risk fields; it is not a
  current requirement.

### CI-D15 — Clarification thread

- Attach a lightweight, permission-controlled clarification thread to each submission.
- Checker may ask a question without rejecting the entire change set; Maker may reply or add
  context.
- Comments are attributable, dated, retained with the resolved audit, and do not themselves mutate
  proposed values.
- Partially approved changes continue independently while other portions await clarification.
- Do not build a general chat system or external notification integration.

### CI-D16 — Concurrent submissions

- Independent submissions coexist; one save never overwrites another.
- Each proposed structured change records the approved value/version on which it was based.
- If the base changes before review, show `Current value changed since submission` with the prior
  value, proposals, and current approved value.
- Checker may approve one, combine through an explicit correction, authorise both as observations,
  or return either.
- Approval against a stale base requires explicit acknowledgement by the Checker.

---

## 4. Current Picture, observations, history, and correction

### CI-D17 — Three authorisation outcomes for observations

A Checker may authorise an input as:

1. an observation only;
2. an update to the structured Current Picture; or
3. both the original observation and a structured update.

- Do not require every useful observation to map to one of the 86 structured fields.
- Observation-only is a valid outcome, not incomplete form work.
- Preserve original narrative when a later structured value is derived from it.

### CI-D18 — Current Commercial Picture

- Provide an optional, short, human-authored Current Commercial Picture.
- It follows the same Maker–Checker workflow and carries explicit scope.
- Combine it with a small deterministic set of approved structured highlights.
- Do not generate or rewrite the summary from narrative observations.
- Pending observations never rewrite the summary automatically.
- Version every authorised summary revision.

### CI-D19 — Correct by superseding or retracting

- Correct confirmed structured information through a new version; retain the old value as
  superseded.
- Mark an authorised observation retracted/incorrect rather than silently editing or deleting it.
- Retain author, time, and optional correction reason.
- A pending Maker submission may be withdrawn before approval.
- Mark duplicates and link to the retained entry.
- Permanent deletion is Admin-only and exceptional, for cases such as accidental sensitive-data
  entry. Record the deletion event.
- Normal views show the current approved position; history reveals superseded/retracted content to
  authorised users.

### CI-D20 — Retention

- Retain CI history indefinitely in the initial phase.
- Staleness never deletes or hides historical information.
- Introduce no automatic expiry or purge.
- A later legal, contractual, or storage policy may revise retention through a separate decision.

### CI-D21 — Optional categorisation

- Observation categories are optional for Makers.
- Keep categories broad: relationship, pricing/commercial, competition, payment, service/quality,
  opportunity, risk, general, and Admin-controlled extensions.
- `General/Not sure` and `Other` must not block capture.
- Checker may add/correct categories during authorisation. Categories organise data only; they do
  not trigger conclusions by themselves.

### CI-D22 — Follow-up is outside CI

- CI may optionally record that follow-up was mentioned and may reference an external system.
- Do not add task assignment, deadlines, reminders, completion status, overdue dashboards, or
  escalation in the initial phase.
- A later observation may record the outcome.

---

## 5. Import, field structure, and controlled classifications

### CI-D23 — Founding Excel import is authorised

- Treat the product owner's existing Excel data as fully authorised Admin-entered data.
- Tag it as imported for provenance only. Do not label it unconfirmed, create pending tasks, or
  require retrospective approval.
- Record source workbook/version, source row/scope where possible, import timestamp, and Admin
  attribution.
- Subsequent changes follow normal versioning and Maker–Checker rules.

### CI-D24 — Lossless import and progressive normalisation

- Preserve authorised source wording exactly.
- Populate typed/structured fields only when mapping is unambiguous.
- Keep mixed-scope or rich narrative values intact until deliberately split or normalised.
- Never invent precision, averages, classifications, or scope during import.
- The UI must display useful authorised narrative even when no machine-readable equivalent exists.
- `structured later` does not mean `lower confidence now`.

### CI-D25 — All 86 fields exist behind progressive disclosure

- Put the full data structure in place, typing fields progressively without lossy coercion.
- Do not show an 86-field spreadsheet as the normal experience.
- Group fields into plain-language sections and keep empty sections collapsed with `Add information`.
- Provide field search so users need not know the section hierarchy.
- Show recently changed and pending items near the top.
- Do not show completeness percentages or `N fields missing` messages.

### CI-D26 — Admin-controlled definitions

- Admin controls field definitions, dropdown options, categories, and active/inactive choices.
- Makers may propose `Other` with free text and continue.
- Checker may authorise the intelligence without creating a permanent new option.
- Admin may later promote recurring values into controlled options.
- Renaming preserves stable identity and historical label. Retiring an option prevents new use but
  does not rewrite history.
- Structural field changes are versioned and governed separately from ordinary CI approval.

### CI-D27 — Later bulk updates

- Bulk import/update is Admin-only and always preview-before-apply.
- Preview matched, new, changed, conflicting, and unmatched rows.
- Prefer stable record IDs; never silently match by name alone.
- Bulk changes create authorised versions with import provenance; they do not replace observations
  or history.
- Blank cells do not erase current values unless deletion is explicit.
- Permit conflicts to be skipped for later resolution. Retain the source and result summary.

### CI-D28 — Evidence files are deferred

- Initially support optional source type, source description, document/reference number, approved
  link, and a statement that supporting material exists.
- Do not require evidence to capture or authorise intelligence.
- Model evidence as a separate future relationship to an observation/change set, with potentially
  narrower permissions than the client record.
- Actual managed file upload, retention, backup, and access are deferred.

---

## 6. Freshness and quotation snapshots

### CI-D29 — Freshness is encouraged, never a gate

- Show a compact CI summary and last-confirmed information in quotation context.
- User may confirm, update, or continue without confirming or explaining.
- CI freshness never blocks quotation work in the adoption phase.
- Do not infer that proceeding means the user accepted, rejected, or ignored CI.

### CI-D30 — Confirm only what was reviewed

- Freshness belongs to the information and scope actually displayed/reviewed, not the entire
  86-field client record.
- A one-click `Confirm displayed summary` records the displayed field/version set.
- It does not validate hidden, empty, broader, or unrelated sections.
- Checker approval may confirm the authorised section.

### CI-D31 — Neutral dates, no stale classification

- Show exact last-updated and last-confirmed dates with neutral age wording.
- Do not introduce universal red/green `stale/current` classifications or field expiry periods.
- Pending queues may show neutral submission age.
- Later usage may justify section-specific freshness rules through a separate decision.

### CI-D32 — Snapshot purpose

- A quotation snapshot means: `this was the recorded, approved CI visible at this time`.
- It does not mean the quotation decision was derived from CI or that CI was complete.
- Snapshot only a fixed, versioned set of decision-relevant context, not all 86 fields.
- Do not implement material-change interpretation in the initial phase.

### CI-D33 — Snapshot timing and behaviour

- During draft preparation, show the latest approved CI and separately labelled pending input.
- At formal quotation save/finalisation, reference the approved CI version then visible and record
  whether the user confirmed, updated, or continued without confirmation.
- Later CI changes do not rewrite the historical reference.
- Reopening shows current CI first with access to the referenced historical version.
- A formally saved new quotation version receives its own CI reference.
- Until database-backed quotation storage exists, prepare the relationship but do not imitate it
  unreliably in browser storage.

---

## 7. Surfaces and interaction model

### CI-D34 — Two capture surfaces

- The dedicated Commercial Intelligence tab owns full records, history, pending review, curation,
  and Checker authorisation.
- Quotation/Batch Profile context shows a compact approved summary plus one unobtrusive
  `Add intelligence` action.
- Quick capture may add an observation or propose a field change without opening/completing the
  full profile.
- Do not place Checker processing, the full 86-field form, or CI-driven calculation controls in the
  costing workflow.

### CI-D35 — Client-list and client-workspace presentation

- Default CI list shows a small useful set: identity/scope, owner, last confirmed date, pending
  count, and short Current Picture where permitted.
- Opening a client shows the compact Current Picture and plain-language sections.
- Keep quotation controls visually primary when CI is shown in quotation context.
- Prospects and archived records are opt-in displays, never default list content.

### CI-D36 — Empty state

- When no CI exists, show `No commercial intelligence recorded yet` plus optional
  `Add intelligence`.
- Do not warn, block, infer defaults, or generate nudges.
- Distinguish `no CI record` from `record exists but information is unknown`.
- Never silently create a master from a free-text client name.

### CI-D37 — Quiet queues

- Show a small pending count on the CI tab.
- Checker queue groups pending work by client, shows oldest first, and supports client/Maker filters.
- Makers see their own pending and returned work.
- Use neutral ages such as `Today`, `7 days`, `30+ days`.
- Do not add email, pop-up, animated, quotation-blocking, or escalation notifications initially.
- Do not create individual performance scores or overdue penalties.

---

## 8. Ownership, routing, visibility, and sensitivity

### CI-D38 — Automatic routing

- Assign a primary CI owner/Checker to each client or relevant scope.
- Route group input to the group owner and more specific input to its assigned owner where one
  exists.
- When no owner exists, route to a shared commercial review queue.
- Maker need not understand or choose the hierarchy; show the destination unobtrusively.
- Checker may reassign without returning the submission. Routing never blocks quotation work.

### CI-D39 — Versioned ownership

- Model client/scope ownership separately from CI content and version the assignment.
- Reassignment reroutes pending and future responsibility without rewriting historical Maker,
  Checker, owner, or authorisation attribution.
- Record effective date, changed-by user, and optional handover note.
- The incoming owner receives authorised history and pending work permitted by role.

### CI-D40 — Layered visibility

- Makers see compact approved, operationally relevant CI for the client/context being worked and
  may add pending input.
- Relevant Checkers/client owners see full approved records, permitted history, pending submissions,
  and authorisation tools within scope.
- Authorised commercial leadership receives cross-client visibility according to policy.
- Admin manages access and exceptional deletion but is not automatically a commercial approver.
- Pending input is visible to its Maker, relevant Checker/owner, and authorised leadership—not all
  Makers.
- CI never appears in client-facing quotation/export output.

### CI-D41 — Sensitivity levels

- Use three initial levels: `Operational`, `Restricted`, and `Leadership-only`.
- Maker may mark input potentially sensitive; Checker authorises the final classification.
- Default is Operational unless identified otherwise.
- Restricted information appears only in the full CI workspace to authorised users.
- Leadership-only is narrowly visible and its access is audited.
- A Checker may write a separate safe Operational summary; never expose restricted text indirectly
  through search, counts, snapshots, exports, or layout.

### CI-D42 — Search

- Default search covers active customers and the user's authorised Operational content.
- Match permitted aliases, locations, portfolios, structured values, approved summaries, and
  authorised observations.
- Pending input appears only to authorised participants.
- `Include prospects` and `Include archived` are explicit opt-ins.
- Retracted content is absent from normal search but available in authorised history.
- Fuzzy search may help find client names/aliases; it must never infer commercial facts or create
  identity links.

### CI-D43 — Export

- Only Admin may export CI data in the initial phase.
- Makers, Checkers, owners, and commercial leadership receive no CI export facility until a later
  product ruling changes access.
- Admin exports are scoped and audited and respect sensitivity.
- CI exports are separate from quotation exports and system backups.

---

## 9. Soft-nudge framework

### CI-D44 — Eligibility-gated, non-authoritative nudges

- Soft deterministic nudges are allowed; they are not the primary or only source of truth.
- Evaluate a rule only when every declared input is present, approved/Admin-authorised, structured
  sufficiently, applicable to the exact scope, and visible to the user.
- Missing, narrative-only, pending, contradictory, inaccessible, or out-of-scope input disables the
  individual nudge. It never produces an opposite inference.
- Pending Maker input cannot trigger a nudge.
- Label nudges `Based on recorded CI`, show scope/source dates, and link to permitted source data.
- Nudges do not block, score, recommend margin, route approval, change costing, affect export, or
  require acknowledgement.
- Do not machine-interpret narrative to trigger a rule.

### CI-D45 — Permission-aware evaluation

- A user sees a nudge only when authorised to see every source field.
- Restricted/Leadership-only data produces no masked warning, count, empty-space hint, or generic
  operational nudge for an unauthorised user.
- The same rule may display to leadership and be wholly absent for a Maker.
- Nudge logs inherit source visibility.
- The absence of a nudge never implies the absence of restricted intelligence.

### CI-D46 — Seven initially eligible explicit-state rules

These rules are eligible only when CI-D44 and CI-D45 are satisfied:

| Rule | Required approved condition | Neutral text |
|---|---|---|
| `CONTACT_CONTINUITY_RISK` | Structured risk is high/critical and Operational for this user | Recorded relationship continuity concern. View context. |
| `SCOPE_CREEP` | Scope-creep flag is active at the applicable scope | Scope variation is recorded for this account. |
| `UNACKNOWLEDGED_COMMITMENT` | RM commitment is greater than zero and confirmation is verbal | Recorded RM commitment currently has verbal confirmation. |
| `QUALITY_ISSUE_OPEN` | Permitted authorised disruption/quality event remains unresolved | An open service or quality matter is recorded. |
| `STRATEGIC_CREDENTIAL` | Sole-vendor status or formal recognition is active | A strategic credential is recorded for this relationship. |
| `CULTURE_WATCH` | Explicit active flag; normally Restricted/Leadership-only | An active internal relationship consideration is recorded for this scope. |
| `EXIT_INTENT` | Explicit active flag; normally Restricted/Leadership-only | An internal portfolio-position decision is recorded for this scope. |

- `CULTURE_WATCH` and `EXIT_INTENT` never appear in quotation context unless an authorised Checker
  explicitly classifies the underlying source Operational.
- Remove imperative legacy wording such as `seek confirmation`, `check before quoting`, or
  `do not extend commitments`.

### CI-D47 — Two deferred time-threshold rules

- Defer `CONTACT_STALE` and `CI_STALE`.
- Show neutral last-interaction/last-confirmed dates when they exist.
- Do not treat an incomplete activity log as proof that no contact occurred.
- Do not activate fixed 60/90-day stale thresholds without a later product ruling.

### CI-D48 — Five dormant cross-system/trend rules

Keep these documented but inactive:

- `RATE_REVIEW_DUE`
- `VOLUME_DROP`
- `WALLET_SHARE_EROSION`
- `RM_HOLDING_REVIEW`
- `DEV_COST_UNRECOVERED`

Each requires a separate approved definition of source, grain, comparison period, baseline,
threshold, missing-period treatment, and exceptions. One current value never establishes a trend;
missing periods are never zero.

### CI-D49 — Nudge rendering and logging

- Render soft nudges inside the compact CI panel under `Recorded context`, not an amber alert strip.
- Show at most two short items initially and offer `View all`.
- Use quiet neutral styling; mix positive and cautionary context without ranking either as truth.
- No toast, modal, animation, or repeated interruption.
- Log only a nudge actually rendered to an authorised user: rule/version, user/role, client/scope,
  source CI version, quotation/draft reference where available, timestamp, and visibility.
- Do not log suppressed/hidden evaluations or infer acknowledgement, dismissal, or rejection from
  user continuation.

---

## 10. Adoption analytics and explicit non-goals

### CI-D50 — Non-punitive adoption measurement

Authorised leadership may see:

- clients with recent CI activity;
- observations captured;
- Maker submissions and Checker outcomes;
- median review turnaround;
- CI views during quotation work;
- confirmations/updates after display;
- active contributors by team;
- ageing pending submissions; and
- prospect additions, conversions, archives, and reactivations.

Do not introduce:

- completeness scores or targets;
- individual league tables;
- quotas for number of entries;
- automated intelligence-quality judgements;
- penalties for continuing without confirmation; or
- performance conclusions from nudge interaction.

### Explicit initial-phase non-goals

- AI extraction, interpretation, summarisation, or materiality decisions
- CI-driven margin, costing, quotation approval, or export behaviour
- hard commercial alerts or mandatory nudge acknowledgement
- task/action management and reminders
- managed evidence-file storage
- non-Admin CI export
- universal freshness/staleness thresholds
- automatic duplicate merge or fuzzy identity linking
- full analytical use of captured CI
- activating the five trend/cross-system nudges without approved feeds and semantics

---

## 11. Instructions to the implementer

1. Treat this file as product authority. Do not use the older Phase 2 brief to reintroduce a
   conflicting requirement.
2. Before implementation, translate these decisions into phased schema, service, permission, and
   UI proposals. Proposal first; do not implement from this record alone.
3. Preserve stable identities, full provenance, version history, explicit scope, and sensitivity
   in the foundation. These are structural and must not be retrofitted later.
4. Keep capture permissive. Do not add a required field, validation gate, notification, warning,
   score, threshold, or role entitlement unless this record explicitly authorises it.
5. Never coerce narrative or missing information to make a nudge or typed field work.
6. Separate current approved state, pending proposals, authorised observations, snapshots, and
   audit history. Do not collapse them into one mutable row.
7. Ensure Row Level Security and every read path—including search, counts, logs, snapshots, and
   exports—honour scope and sensitivity. UI hiding is not access control.
8. Do not create a quotation-time snapshot in local browser storage as a substitute for future
   database-backed quotation versioning.
9. Give every nudge an explicit rule version and prerequisite contract. A disabled rule must fail
   closed by showing nothing, never by manufacturing a reassuring inverse.
10. Bring genuine product ambiguities back to the product owner. Do not resolve them through
    implementation convenience.

