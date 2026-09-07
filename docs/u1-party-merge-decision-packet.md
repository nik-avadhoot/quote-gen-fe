# Party merge — dependent-handling decision packet

**Date:** 2026-09-07. **Status: decision packet only. Resolves nothing. No migration, route or
frontend action is implemented or proposed for implementation by this document.**

**Why this document exists, separate from the main packet.** `u1-customer-foundation-authorization-
packet.md` originally folded a `merge_parties` CAS correction into the U1 sequence (its former Slice
B) and, in the same breath, decided how three FK dependents should be migrated at merge time. Review
found that decision premature: the CAS defect is real and uncontroversial, but *what a merge does to a
Party's dependents* is not a technical detail with one obviously-correct answer — it touches a rule
not yet written (Location reassignment, CDM-07), a domain not yet governed (SKU ownership, U2), and a
historical-closure question the original design got wrong by omission. Per instruction, `merge_parties`
**stays exactly as it is today — dormant, CAS-less, unreachable** — until the choices below are ruled
on. Nothing here is authorised for implementation.

---

## 1. Current state, confirmed live this session

`app_private.merge_parties(p_survivor bigint, p_merged bigint) returns void` — capability-checked
(`manage_customer_master`), **zero CAS parameters**, migrates `party_external_references` to the
survivor (deduplicated), sets the merged Party's `status='merged'`/`surviving_party_id`. **No `public`
wrapper exists.** **Zero call sites** in either repository. **Zero rows** exist in `parties`,
`customer_locations`, or `skus` today — this is a design decision with no present-day data
consequence, not an urgent live-data problem.

## 2. Every dependent, read directly from `pg_constraint` (exhaustive — confirmed by FK scan, not assumed)

| # | Referencing table.column | Confirmed live FK | Current `merge_parties` behaviour |
|---|---|---|---|
| 1 | `parties.surviving_party_id` (self) | `fk_party_survivor` | Set correctly today — not in question. |
| 2 | `party_external_references.party_id` | `fk_pxr_party` | Migrated to survivor, deduplicated — not in question, see §3. |
| 3 | `party_family_memberships.party_id` | `fk_pfm_party` | **Untouched.** The merged Party's current membership row stays `is_current = true`. |
| 4 | `customer_locations.party_id` | `fk_loc_party` | **Untouched.** |
| 5 | `skus.party_id` | `fk_sku_party` | **Untouched.** |

## 3. Dependent 1 — `party_external_references` (essentially settled, included for completeness)

Current behaviour: rows move to the survivor, existing duplicates (`ref_kind`+`ref_value` already on
the survivor) are skipped. No canonical objection was raised to this. Listed here only so the register
is exhaustive — **not** an open question in the same sense as §§4–6.

## 4. Dependent 2 — `customer_locations.party_id`

**The conflict, stated precisely.** CDM-07 states "Family and Location reassignments are effective-
dated." No schema mechanism for Location-to-Party reassignment exists today (confirmed this session:
`customer_location_versions` carries no `party_id`, no `customer_location_parent_history`-shaped table
exists anywhere). A direct, silent bulk `UPDATE` of `party_id` inside `merge_parties` would be the
**first and only** thing in this codebase that reassigns a Location's parent — and it would do so
without the effective-dating CDM-07 requires, for a mechanism this codebase does not otherwise have.
Building it correctly it means building the general-purpose effective-dated reassignment mechanism;
building it only for the merge path means Location parentage changes by two different rules depending
on *why* it changed, which is exactly the kind of two-tier authority CDM-13/CDM-19's own reasoning
warns against elsewhere in this data model.

**Available choices, none selected:**

| Choice | Mechanism | What it preserves | What it costs |
|---|---|---|---|
| **(a) Leave untouched at merge time** | `merge_parties` does not touch `customer_locations` at all. | No conflict with CDM-07 — nothing here claims to be an effective-dated reassignment. | The merged Party's Locations remain attached to a `status='merged'` Party until someone separately reassigns them, once a governed mechanism exists. A survivor with "the same Locations" is not achieved by merge alone. |
| **(b) Direct bulk `UPDATE` at merge time** (the original packet's design) | One `UPDATE ... SET party_id = survivor WHERE party_id = merged`, inside the merge transaction. | Immediate usability — the survivor "has" the Locations right away. | Conflicts with CDM-07 as described above; no effective-dating, no record of "why" the parent changed; pre-empts whatever shape the real reassignment mechanism eventually takes. |
| **(c) Build the effective-dated Location-reassignment mechanism first, as its own slice; have `merge_parties` call it once per dependent Location as a sub-step** | A new `customer_location_parent_history`-shaped table (mirroring `party_family_memberships`) plus a governed `reassign_customer_location` function; `merge_parties` invokes it in a loop. | Fully consistent with CDM-07; one authority for all Location reassignment, whatever caused it. | Materially larger scope — a full new governed operation and history table, gated behind a merge correction that was meant to be small. Blocks merge until that slice is designed and approved. |

## 5. Dependent 3 — `skus.party_id`

**The conflict, stated precisely.** `skus.party_id` exists as a real column (confirmed live), but no
governed mutation surface for `skus` exists yet at all — SKU proposal/publication/lifecycle is U2, not
built. CDM-09 defines a SKU as "a Customer-specific commercial item belonging to exactly one Producing
Plant and one Customer" — changing `party_id` is therefore not a housekeeping FK update, it is a change
of **which Customer a commercial item belongs to**, a fact with pricing/quotation consequences the
moment SKU governance exists to act on it. Deciding this inside a `manage_customer_master`-gated Party-
merge function, ahead of U2 defining what SKU ownership change even means procedurally (does it need
its own capability? its own audit trail? does an in-flight Batch referencing the SKU need to know?),
answers a U2 question from inside a Family-B-scoped correction.

**Available choices, none selected:**

| Choice | Mechanism | What it preserves | What it costs |
|---|---|---|---|
| **(a) Leave untouched at merge time** | `merge_parties` does not touch `skus`. | Defers the ownership-change question entirely to U2, where it belongs. | SKUs remain attached to the merged Party until a future U2-governed reassignment exists; today (0 rows) this costs nothing, but the gap must be remembered when U2 ships. |
| **(b) Direct bulk `UPDATE` at merge time** (the original packet's design) | One `UPDATE ... SET party_id = survivor WHERE party_id = merged`. | Immediate usability. | Answers a U2 ownership question inside a U1 correction, with `manage_customer_master` as the acting capability rather than whatever U2 decides SKU-reassignment should require. |
| **(c) Guard, don't migrate** | `merge_parties` refuses to merge (`22023`) if the merged Party has any `skus` rows at all, until a U2 reassignment path exists. | Prevents silent, unreviewed ownership drift entirely. | Blocks otherwise-legitimate merges of Parties that happen to own SKUs, for as long as U2 takes; today (0 rows) this guard never fires, so it is free to adopt now and relax later. |

## 6. Dependent 4 — `party_family_memberships` (the historical-closure defect)

**The defect, stated precisely.** The current design left this table untouched by merge — reasoned, in
the original packet, as "a Party's Family membership is orthogonal to Party identity merge." That
reasoning addressed *whether the survivor's membership changes* (correctly: it does not) but missed
the separate question of *whether the merged Party's own current membership row should still say
`is_current = true`* after the Party stops representing a live identity. It should not: `is_current`
elsewhere in this schema means "this row describes the present," and a merged Party has no present.
Leaving it `true` is not neutral non-interference — it is an incorrect historical record, discoverable
by anyone who joins "current Parties of a Family" against `party_family_memberships` and gets a merged,
non-live Party back.

**Available choices, none selected:**

| Choice | Mechanism | What it preserves | What it costs |
|---|---|---|---|
| **(a) Close the current row, open no replacement** | `UPDATE party_family_memberships SET effective_until = current_date, is_current = false WHERE party_id = merged AND is_current`. | Correct historical closure — a merged Party has zero current memberships, consistent with having zero current anything else. `uk_pfm_one_current` is a partial unique index that forbids *more than one* current row per party; it does not require *at least one*, so this is schema-compatible without a constraint change (confirmed by reading the index definition, not assumed). | None identified — this is the closest to a "just fix it" choice of anything in this packet, but it is still listed as a choice rather than pre-decided, since it is bundled with §§4–5 in the same function and the whole function is held pending review. |
| **(b) Leave untouched** (current design) | No change. | Nothing. | The defect the review found — restated here only for completeness, not as a live option. |

## 7. What this packet asks for

A ruling on §§4–6 (one choice per dependent — they are independent of each other; e.g. choosing (a)
for Locations does not require choosing (a) for SKUs). Once ruled, `merge_parties`'s CAS correction and
its chosen dependent-handling become **one** migration and one review, not two — the CAS fix alone is
not proposed as a separate, earlier deliverable, since shipping it without the dependent decision would
likely require touching the same function body twice.

**Not part of this decision:** whether Party merge should be exposed through a frontend route at all.
That remains a separate, later step (unchanged from the original packet's own sequencing intent) — this
document is about correctness of the function's *content*, not its exposure.
