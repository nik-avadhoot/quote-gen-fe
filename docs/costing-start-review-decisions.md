# Costing START / REVIEW — product decision record

**Status:** approved product decisions for SR DEV's design revision. This is a decision record, not
an implementation plan. It supersedes conversational summaries where they differ.

**Delivery status (2026-09-01):** the START/REVIEW restructure is delivered and pushed through
`4e66942`. §§1-4 describe delivered behaviour except where a "Delivered as" note says otherwise,
as does the C7a Freight/Interest portion of §5. The remainder of §5 - the SET commercial-discount
rule and the other explicitly future rules it names - remains parked, as do §6 (D-25), §7 (F-2)
and the §8 non-goals. §9 is closed history. §10 maps decisions to commits.

**Scope:** reconcile Costing and Batch Entry into two distinct Costing surfaces: START (authoring)
and REVIEW (Deep Dive of an existing Batch row). The product owner alone approves changes.

---

## 1. Navigation and surface model

- Keep one **Costing** navigation item. Do not add sidebar tabs.
- Inside Costing, use contextual **START** and **REVIEW** subtabs.
- START is the normal destination. REVIEW appears only after Deep Dive opens a row; it is absent
  when no row is under review.
- REVIEW is a separate surface, not a visual state of the START form.
- Explicit REVIEW exit returns automatically to the untouched START draft. **Push does not exit
  REVIEW**; it stays open and becomes clean after a successful Push.
- REVIEW is temporary. Reload/reopen returns to START; REVIEW changes are not persisted and are
  lost unless pushed.

## 2. START draft and state ownership

- START owns exactly **one browser-persisted, unsent draft**. It is device/browser local only; no
  server draft or cross-device promise is in scope.
- Batch Entry's row is the only durable record after Send. Do not maintain a sent-draft history.
- Dirty means the current draft contents materially differ from their clean baseline, not merely
  that an input was once touched. `""`, `0`, and `undefined` remain distinct for future inheritance.
- REVIEW owns a separate session-only working copy. Deep Dive must never overwrite START work.
- A new-batch START draft owns a separate persisted **draft profile**. It must not alter the parked
  Batch Profile.
- Same-batch START and REVIEW read the live Batch Profile directly. They must not retain a second,
  stale snapshot of that profile.
- On the first successful Send from a new-batch draft, establish the Batch Profile, create the first
  row, discard the draft-profile distinction, and automatically continue as same-batch START.
- The first-Send transition must preserve blank values unchanged once D-25 is implemented; it must
  never materialise inheritance into numeric literals.

## 3. START actions and lifecycle

### New SKU

**New SKU** is the direct, common path: another SKU in the current batch and current client.

- Confirm only if the current START draft is dirty.
- Reset row identity, product, and dimensions.
- Carry construction and board specifications forward as editable starting values.
- All batch context carries forward by reading the live Batch Profile.

### New Draft

**New Draft** opens a small choice menu. It is new-batch work; the old Batch Entry batch remains
parked and untouched.

1. **New batch — keep current client**
   - Retain client and editable sector.
   - Retain normal plant, delivery, payment, interest, margin, freight, and commercial values as
     editable starting values.
   - Clear construction and board specifications.
   - In the later D-25 implementation, reset Box/PP waste and conversion overrides to blank =
     inherit. In this START/REVIEW restructure they retain concrete editable values; do not
     implement any blank-inheritance behaviour early.
2. **New batch — new client**
   - Clear customer- and batch-specific context, construction, board specification, location, and
     commercial values. Customer/Prospect semantics are deferred to Customer Master.

For either choice, confirm before replacing a dirty draft.

### Abandoning or creating the real batch

- A new-batch draft gets **Discard new draft / Return to current batch**. Confirm only if dirty.
  Returning opens a clean same-batch START seeded only from the live Batch Profile; it carries none
  of the abandoned draft's construction or board details.
- The new-batch draft is deliberately promoted through the existing two-step flow: Batch Entry
  **+ New Batch**, then Send. D-13 graduation is not part of this work.
- Batch Entry **+ New Batch** preserves an existing new-batch draft unchanged, because it is the
  intended second step before first Send.
- If a same-batch START draft exists, Batch Entry **+ New Batch** must warn that the draft belongs to
  the batch being cleared; the maker must discard it or cancel and use New Draft first.

## 4. Sticky Costing Batch Context

- Costing has an Excel-like, sticky Batch Context view: it remains visible while SKU inputs scroll.
  “Sticky” is a view behaviour, not a claim that fields are always read-only.
- It uses the same field schema and visual language as Batch Entry Profile, without creating a
  second authority.
- Use two compact rows:
  - **Identity/logistics:** Client, Sector, Customer Type, Price Context, Producing Plant, Default
    Delivery.
  - **Commercial defaults:** Box and PP Waste/Conversion/Margin, Payment Terms/Interest, Freight
    basis.
  - **Delivered as (C5, `7e9bade`):** three bordered cards - Customer · Commercials · Terms - using
    Batch Entry's visual grammar, in one 84px sticky band. The two-row grouping above was the
    approved intent; the card layout carries exactly those fields and was accepted in its place
    after the C2 presentation was rejected. The rail is **complete**; only further visual
    compression is parked.
- It is editable when establishing a new batch; it is read-only for same-batch START and REVIEW.
- A read-only bar offers **Edit Batch Profile**, routing directly to Batch Entry.
- Customer Type and Price Context remain current pre-master fields. Do not introduce new
  Customer/Prospect rules in this restructure.

## 5. Field authority and visible controls

### Batch context

Client, Sector, Producing Plant, Delivery, payment terms, Interest, Freight basis, Customer Type,
Price Context, and Box/PP default waste-conversion-margin belong to Batch Context.

- **Delivery is batch-level for beta.** Different delivery location for the same client means a new
  Batch Entry batch. Do not introduce SKU-level delivery overrides or a second freight resolver.
- Manual Freight and Interest are batch-level only.
  - **Decided:** remove SKU-level manual Freight/Interest overrides; current rows are trial data
    and need no migration or legacy notice.
  - **Delivered as C7a (`57bcbc4`) - Costing side only.** Costing can no longer author or edit
    either field: both resolve from Batch Context in START, and REVIEW carries the row's effective
    figure read-only. Push omits both row keys, so an existing Batch Entry override survives
    byte-for-byte; first Send writes `""` for Batch Entry schema compatibility only.
  - **What Costing still shows.** A grey `NOT EDITABLE` preview keeps both figures visible in the
    Commercial Parameters card. In START it displays the resolved Batch Context Freight and
    Interest. In REVIEW it displays the effective Batch Entry row value where one exists, and
    otherwise the Batch Profile value. It is non-focusable and has no Costing write path.
  - **Still live, by product ruling:** Batch Entry's row editors (`BatchGrid.jsx:727,742`),
    `useQuoteActions.js:232-233,345-346`, both exporters (`export/excel.js:42`) and the backend
    (`quote-gen-be/server.py:250`) continue to read and honour row-level overrides. System-wide
    removal is **parked, not done**, and carries the D-18/D-27 mirror risk that the workbook
    reports the first item's figure for the whole sheet.
- Box/PP Waste and Conversion remain visible and editable in the main grid: they are core figures
  for understanding and working a row. Keep the current divergence warning because the workbook
  exports one Box and one PP value.
- The Context bar holds normal Box/PP defaults. Any present rare row exception remains an explicit
  exception, not a reason to hide the core figures.

### SKU context

START/REVIEW own product, dimensions, construction, board specifications, add-ons, and SKU
commercials that the target model permits.

- SKU-level Margin override remains an exception in the expanded sub-row.
- A SET's commercial discount is owned by its parent Box; Plates/Partitions derive it read-only.
- An unconfirmed SET Code blocks every inherited SET-level value. No implicit confirmation or copied
  materialisation is allowed.

## 6. D-25 — decided product rule, separate implementation

The product rule is **blank means inherit** for Box and PP Waste/Conversion, both in fresh START
work and a fresh Batch Profile. The existing grey inherited-value presentation is retained: show the
effective value in grey, leave the input blank, and let an explicit entry override it.

This is **not** part of the START/REVIEW restructure. Before changing `INIT_SPEC`, defaults, or a
fresh profile to blanks, D-25 must first make every Batch-side calculation path blank-aware and
revisit first-Send profile establishment. `data/defaults.js` and the costing engine remain untouched
in the restructure.

## 7. F-2 — per-SKU Discount, separate after D-25

Discount is a future feature request, not structural fallout from the reconciliation.

- Create it as **F-2** in `feature-requests.md` when scheduled.
- One per-SKU **Discount (Rs/pc)** field, blank by default. No percentage mode in app or workbook.
- It is a normal visible commercial field in Costing and Batch Entry, immediately before Final Rate:
  **Total Cost → Margin → Discount → Final Rate**.
- Apply it after cost-plus-margin. The exported Final Rate is the discounted customer quote; Rate/kg
  is the internal reference for that same discounted offer. Do not add a Net Final Rate column.
- The workbook gets one visible Discount column; no-discount rows are blank.
- Discount cannot make Final Rate zero or negative.
- The app shows Calculated Rate, Discount, Final Rate, and realised margin. The main Batch grid stays
  clean: a below-cost or below-threshold result has a compact exception marker; detail is in the
  expanded row.
- Beta is advisory only: no Checker/Admin/Maker approval or export gate. Show separate advisories
  for “below current cost” and “realised margin below target”.
- The initial minimum realised-margin threshold is **2%**, as an Admin-editable Defaults master
  field, not a hard-coded literal.
- For SETs, discount is entered on the parent Box only; child components derive it read-only.

## 8. Sequencing and explicit non-goals

1. START/REVIEW split with persisted START draft. - **DELIVERED** (C1, C3-C6, C7a; see §10).
2. D-25 blank-inheritance implementation.
3. F-2 Discount, including app and workbook changes.
4. Customer/Prospect/SKU masters.

Do not fold the following into the reconciliation:

- **F-1** Batch Entry row copy/paste — recorded, not specified, in
  [`feature-requests.md`](feature-requests.md). Its identity/spec/commercial/workflow taxonomy is
  useful evidence only. When F-1 is later specified, re-derive it: F-2 adds Discount, and the
  SKU-level Interest/manual-Freight fields are gone from **Costing** (C7a) but still exist on the
  Batch Entry row until the parked system-wide removal is scheduled.
- D-13 graduation capability.
- Workbook/template edits.
- Customer/Prospect semantics, temporary codes, converted codes, or other masters work.
- Unrelated D-* or PM-* items.

## 9. SR DEV proposal amendments required before approval

> **Closed history.** All eight amendments below were incorporated before implementation began.
> They are retained as the record of what was required and why; they are not outstanding work.
> Item 8's outcome is in §10: C1 landed structurally, C2 was rejected.

The design proposal must be revised, not accepted as-is, to incorporate this record:

1. Push stays in REVIEW; only explicit exit returns to START.
2. One draft total is confirmed; `profileDraft` participates in semantic dirty comparison.
3. Trial data removes the live-data migration question for old row Interest/manual-Freight overrides.
4. Delivery remains batch-level; remove the proposed SKU-delivery resolver, row field, and SET
   delivery inheritance work.
5. Preserve new-batch drafts through Batch Entry + New Batch; guard same-batch START drafts from
   orphaning.
6. Remove unapproved `savedAt` UI from scope.
7. Remove or fully source/propose the unsupported “Reset Phase 0” prerequisite.
8. C1/C2 may be structural commits, but they must not be presented as proving REVIEW is safe before
   the review-copy commit lands.

All implementation claims must be re-derived from current source. Run all seven standing gates on
every commit — `docs/session-start.md` §3 is canonical for the list; `npm run test:draft` was added
at C3 for the Costing draft model. UI verification remains the product owner's responsibility.

---

## 10. Delivery closeout — decisions to commits

Pushed to `origin/main` through `4e66942`. Every commit ran all seven standing gates; lint held at
the 66/0 ceiling throughout.

| Commit | Decision delivered |
|---|---|
| `8e09956` C1 | §1 — contextual START/REVIEW subtabs in one Costing nav item; header controls relocated into the strip |
| — C2 | **Rejected on product/UX grounds after being built, reverted and dropped. No C2 commit exists.** Its intended outcome — one visible Batch Context authority — was delivered by C5 |
| `b3d645d` C3 | §2 — the single persisted START draft `{v:1, spec, profileDraft, baseline}` and the semantic dirty comparator (strict equality, one both-`NaN` exception). Added `test:draft` as the seventh standing gate |
| `f250a8a` C4 | §1, §2 — the session-only REVIEW copy; Deep Dive cannot touch START; Push stays in REVIEW and advances an outcome-aware baseline; Quote Items became navigation-only |
| `1143963` PM-7 | Documentation only — see below |
| `7e9bade` C5 | §4, §5 — `profileDraft` owns new-batch context; one sticky Batch Context rail is the single authority; duplicate editors removed from `SpecForm` |
| `6bd2903` C6 | §1 — `specCommitted` and its identity-freeze rendering deleted; the read-only rule lives in the Context bar's own mode test |
| `57bcbc4` C7a | §5 — Freight and Interest cease to be Costing-editable SKU exceptions (Costing side only; see §5) |
| `4e66942` | Visual refinement of the SKU-exception sub-card. No behaviour change; deliberately unnumbered, not part of the C-series |

**Held as promised.** No commit in the sequence touched `data/defaults.js` or `engine/costing.js`
(§6), and no blank-inheritance behaviour was implemented early (§3, §6): a new SKU still seeds
concrete Box/PP waste and conversion values.

**PM-7 — recorded, not implemented.** `docs/post-model-defects.md:280` records that a Quote Item
carries no stable identity back to the Batch row that produced it. Documentation only: no
mechanism, migration or fix is approved, and C4 was deliberately built around the gap.

**Parked — each a separate concern, none on this record's completion path:**

- Further visual compression of the Batch Context rail, and the wider Geometry / Die-Line / Paper
  Construction / Layer Detail SKU-layout redesign.
- System-wide removal of the Batch-row Freight/Interest overrides — grid, export, backend (§5).
- D-25 blank-inheritance (§6); F-2 per-SKU Discount (§7), including the SET commercial-discount
  rule §5 names.
- Customer/Prospect and other masters, D-13 graduation, workbook/template edits, and unrelated
  D-*/PM-* items (§8).
