# Data Model — SR DEV technical review

**Reviewer:** SR DEV / technical architecture reviewer.
**Subject:** [`docs/data-model-design-for-approval.md`](data-model-design-for-approval.md) (58 KB,
2026-09-04), reviewed at `849c5d4`.
**Date:** 2026-09-04.

**Scope of this document.** Technical coherence and implementability only. It makes no product
decision, approves no schema, and authorises no code, migration, deployment or commit. Where a
finding touches a commercial rule, it states the technical consequence and leaves the rule alone.

**Nothing was implemented.** No application code, database object, migration or commit. This file is
the sole output.

**Excluded as instructed:** `docs/commercial-intelligence-decisions.md` was not read.

**Records read:** `CLAUDE.md`; `docs/session-start.md`; `docs/post-split-state.md`;
`docs/component-split-plan.md`; `docs/post-model-defects.md`;
`docs/costing-start-review-decisions.md`; `quote-gen-be/docs/CFB_QOS_Project_Brief_v3.md`;
`docs/data-model-design-for-approval.md`. Every claim below is re-derived from current source and
cited by `file:line`.

> **Reading note.** A bare **§N** always refers to a section of
> [`data-model-design-for-approval.md`](data-model-design-for-approval.md). Sections of *this*
> document are cited as **review §N**. Section numbers here have gaps (7, 10) from successive
> appends; they were deliberately not renumbered, because almost every §N in this file is a
> design-document reference and a blanket renumber would silently corrupt them.

**Working-tree note:** `src/tabs/batch/BatchProfileBar.jsx` is modified and uncommitted at review
time. It is unrelated to this design and was not touched.

---

## 1. Technical verdict

### ✅ Approve with amendments

The design is **coherent, internally consistent at the conceptual level, and implementable**. The
entity model in §19, the constraint list in §20 and the lifecycle maps in §21 are the strongest
parts: they are specific enough to build from, and §20 correctly demands enforcement rather than
display. The CalcGate/SendGate boundary is preserved throughout and is in fact *strengthened* by the
model — see review §6.1.

**It is not approvable as-is**, for a single recurring reason rather than seven unrelated ones:

> **The design describes authority chains and enforcement properties that the current
> implementation does not have, and does not name the work required to acquire them.** In three
> places the live code resolves the same commercial fact through a *different* chain than the one
> the design states — and in one of those the divergent resolver is the CalcGate itself.

None of the seven blocking findings requires redesign. All seven are closed by amendment: five by
adding a sentence or a prerequisite, two by choosing between two readings the document currently
supports equally. The commercial rules survive every one of them unchanged.

---

## 2. Blocking findings

### B-1 — §9.4 / §22: the Waste/Conversion chain is implemented twice, the two disagree, and the CalcGate is the one missing the Sector tier

**Design says** (§9.4, and §22's Waste/Conversion row):

```
Batch-row explicit override → Batch default → Sector default → system fallback
```

**Live code has two chains, not one:**

| Surface | Resolver | Chain |
|---|---|---|
| Costing tab | `state/useCostingResult.js:56-59` | `batchDefaults ?? Sector ?? literal` |
| **Batch Entry (the CalcGate)** | `state/useQuoteActions.js:222-226` (`calcBatchRow`) | `row ?? batchProfile ?? literal` — **no Sector tier** |

`sendAllToQuoteItems` repeats the Batch Entry chain verbatim at `useQuoteActions.js:341-346`.
`component-split-plan.md` §D-25 states the same split independently: *"Two paths, only one of which
resolves blanks. The Costing tab is safe… The batch path is not: `calcBatchRow` and
`sendAllToQuoteItems` assemble their spec independently and never pass through `_calcSpec`."*

**The design's chain matches Costing, not the CalcGate.**

**Why they agree today, and why that ends.** Both land on the Batch Profile value because the
profile is *never blank* — `useBatchState.js:26` ships `waste:5, convRate:7, wastePP:5,
convRatePP:12.5`, so `bdWaste ?? Sector` short-circuits at `bdWaste` and `row ?? batchProfile` at
`batchProfile`. The Sector tier is unreachable. **D-25 exists precisely to make blanks reachable.**

**Practical failure mode.** The moment a Batch Profile can hold a blank, the same row resolves to
the Sector default in Costing and to the hard literal `5`/`7`/`5`/`12.5` in Batch Entry. The Maker
sees one number on screen and a different number is quoted — **silently, with no error**, because
`calcCosting` destructures with defaults that fire only on `undefined` (`engine/costing.js:34`) and
a `""` reaching it yields `NaN` with no throw. Batch Entry is the CalcGate, so Batch Entry's answer
is the one that reaches the customer.

**This is not a schema question.** A `NULL`-means-inherit column is correct and I recommend it. The
finding is that **§9.4 cannot be implemented without unifying the two resolvers**, and unifying them
is a change to how a quoted price is computed.

---

### B-2 — §9.4's non-materialisation rule is contradicted by three live write sites, and the design does not name their removal as a prerequisite

**Design says** (§9.4): *"The UI may display the effective inherited value in grey **without storing
it as an override**."* §22 repeats it: *"The model must never convert missing input into commercial
zero by convenience."*

**Three live sites do exactly the opposite:**

| Site | What it writes |
|---|---|
| `tabs/batch/BatchProfileBar.jsx:67-76` | Selecting a sector copies `wasteCBB`/`convBox`/`wastePP`/`convPP` into `batchProfile` as literals |
| `tabs/batch/BatchProfileBar.jsx:145` | **Clearing** a field restores the sector default *as a stored literal* — the comment is explicit: *"blank on ANY numField (margin, waste, conv) must restore to sector default"* |
| `tabs/costing/BatchContextBar.jsx:90-92` | `pickSector` writes `waste:n.wasteCBB, convRate:n.convBox, …` into the context cascade, and thence into `profileDraft.values` |

This is the inheritance-materialisation pattern recorded as **D-9** and **D-16**
(`component-split-plan.md` §D-9: *"A silent override presenting as inheritance"*). C5 (`7e9bade`)
removed **site 4** — the first-Send re-derivation now writes `profileDraft.values` verbatim
(`useCostingBatchBridge.js:782-794`) — but the three above remain, and site 3 feeds the very draft
that C5 now trusts.

**Practical failure mode.** The schema gains `NULL`-means-inherit columns that the application can
never write `NULL` into. Every field arrives populated, so **no inheritance is ever stored**, the
Sector and system tiers of §9.3/§9.4 are permanently unreachable, and the calculation snapshot's
"effective value and its exact authority source" (§9.4, §15) records *override* for every field in
every quote. The model reads as implemented and is not.

**Note the second site especially.** `BatchProfileBar.jsx:145` makes *clearing* a field the act that
creates an override. That is the one path a Maker would use to express "inherit," and it does the
opposite.

---

### B-3 — §9.1 vs §8 / §19.5: the calculating freight value has two candidate owners

**Design says three things that do not resolve to one entity:**

- §9.1: `Batch-row explicit override → **Pricing Group freight** → approved Freight Master → unresolved: calculation blocked`
- §8: *"A **Delivery Group** represents one Bill-to/Ship-to route and **its freight context**."*
- §19.5: the Delivery Group node carries *"freight/logistics context"*.

§8.1 comes closest to resolving it — *"Calculation basis and display destinations are separate: one
explicit freight calculation basis/applicable freight; and a separately rendered multi-location list
or schedule"* — but it never says **which entity holds the calculating basis**, and §19.5 puts
freight on the Delivery Group without marking it non-calculating.

**Practical failure mode — and the design already names it.** DM-149: *"blank location never
silently means zero freight."* A Pricing Group with three Delivery Groups on three routes has three
freight contexts and one price. An implementer reading §8/§19.5 puts the calculating value on the
Delivery Group; the resolver then has three candidates for one row and takes the first, or none.
`getFreightRate` (`engine/costing.js:29-32`) resolves override-else-matrix and returns `0` when the
matrix misses — so the failure is a **silent zero freight**, which is precisely the outcome §8.1 and
DM-149 were written to prevent.

**Amendment closes this** (§4, A-3). The commercial rule is untouched: one price across the group,
routes visibly distinct.

---

### B-4 — DM-192 requires two classes of change, but the design specifies only one divergence signal

**Design says:**

- DM-13: *"A post-Send Batch change leaves the staged candidate visibly diverged. Submission and all
  exports are blocked until an atomic refresh from Batch Entry."*
- DM-192: *"A pricing-relevant Delivery Group change stales every row in its Pricing Group. **A
  purely descriptive change needs fresh Send but not fresh calculation.**"*

DM-192 therefore defines **three** states — *fresh*, *needs-Send-only*, *stale* — where DM-13
describes one blocking condition and the application today has two (`getBatchRowStatus`, consumed at
`useQuoteActions.js:294-300`).

**Practical failure mode, in both directions.** Implemented with a single signal:

- *conservatively* — every descriptive edit (renaming a Delivery Group, correcting an address)
  stales the whole Pricing Group and forces a recalculation. That contradicts §1.3's *"avoid
  unnecessary confirmations"* and, worse, invites Makers to recalculate reflexively, which is how a
  Reprice gets run by accident.
- *permissively* — descriptive changes raise no signal at all, the issued document renders the
  pre-edit description, and DM-192's "needs fresh Send" is silently unimplemented.

**What is missing is a classification, not a mechanism.** The design must say which Delivery Group
and Pricing Group fields are pricing-relevant and which are descriptive. Two signals then follow
naturally: a calculation fingerprint and a presentation version.

---

### B-5 — §19.5 pins both the SKU spec version and the Construction version on the Batch row, but §6.2 makes Construction part of SKU identity

**Design says:**

- §19.5, Batch Rows: *"selected SKU/Construction versions"* — two independent pins.
- §6.2: *"**Any dimensional, Construction or strength change creates a new SKU** because it changes
  price."*
- DM-135: *"An open Batch stays pinned to its chosen SKU spec version until Maker adopts a newer
  non-price-driving version."*

If a Construction change creates a new **SKU**, then the SKU spec version *already determines* the
Construction. A second, independent Construction pin on the row is a redundant authority that can
disagree with the first.

**Practical failure mode.** A row pinned to SKU spec v2 — which specifies Construction X v1 — and
independently to Construction X v2. Two records now describe the board, the calculation used one,
and §15 requires the snapshot to record *"selected master and Construction versions"* (plural) with
no rule for which governs. On re-export (DM-198, *"uses stored results and never reruns current
logic"*) the stored result is right but the stored *provenance* is ambiguous. This is D-11's failure
class — two sources answering one question — reintroduced at the row level.

**There is a legitimate reason for a row-level Construction reference**, and it is why I read this
as under-specified rather than wrong: DM-144/DM-145 permit a Maker to create a **Proposed
Construction** in Batch Entry and a Checker to approve it for that Quote before Library publication.
Such a row has no published SKU spec version to derive from. The amendment scopes the row-level pin
to exactly that case.

---

### B-6 — §14 and §23 assert database-level enforcement that the current architecture cannot deliver, and the design does not record it as a prerequisite

**Design says:**

- §14: *"**Database access control—not merely hidden UI**—must enforce these boundaries."*
- §23: *"browser UI is not the security boundary"*; *"deny by default without explicit grant"*
  (DM-185); *"all formal writes validate plant, ownership, capability and current workflow state."*

**Current architecture cannot satisfy any of that.** Every backend Postgres call uses the
service-role client, which **bypasses RLS by definition**:

- `quote-gen-be/supabase_client.py:44-57` — `get_supabase_admin()`, secret key, *"bypasses RLS."*
- `quote-gen-be/auth.py:41-49` — the per-request profile read.
- `quote-gen-be/server.py:623, 669, 715` — every `/admin/users` operation.

The anon (RLS-respecting) client is used for exactly one call: `auth.get_user(token)` at
`auth.py:35`. **No application query is currently subject to a policy.**

**Practical failure mode.** §23's entire table can be implemented as policies, reviewed, tested
against a direct-connection harness, pass — and enforce nothing in the running product, because
every real query arrives as service-role. A plant-scoping bug would then be invisible to both the
policy tests and the UI, and would surface as a Maker reading another plant's quotes.

The plumbing for the fix already exists: `require_auth` captures the caller's token at `auth.py:56`
(`g.access_token`). This is a recorded prerequisite, not a redesign — but if it is not recorded
*here*, §23 will be read as satisfied by writing policies alone.

---

### B-7 — §20.9 / §10: SET cardinality is undefined for a Box with no components

**Design says:**

- §10: a SET *"contains exactly one parent Box plus Plate/Partition component rows **where
  applicable**"*, and *"**Standalone rows have no SET.**"*
- §20.9: *"A SET has exactly one Box parent and explicit component membership."*

*"Where applicable"* permits a SET with zero components; *"standalone rows have no SET"* forbids it.
Both readings are supported by the text and they are mutually exclusive.

**Current behaviour makes this a migration question, not only a modelling one.** Every Box row
receives a SET Code at creation — `useQuoteActions.js:406`: `if(itemType==="Box"){ setCode=matCode; }`.
So in today's data **every Box carries a SET Code, including genuinely standalone boxes**, and the
loader must decide whether each one becomes a `set` record or a standalone row with no SET.

**Practical failure mode.** Choose "every Box creates a SET" and §10's *"standalone rows have no
SET"* is false, `set_id` is never null, and the standalone concept disappears. Choose "a SET exists
only with components" and §20.9's constraint must tolerate a transient one-member SET during the
window between creating the Box and attaching the first Plate — otherwise the constraint fires
mid-edit and the Maker cannot build a SET at all.

> **CORRECTION, 2026-09-04.** The paragraph above originally also claimed that existing Box rows
> carrying SET Codes make this "a migration question, not only a modelling one." **That claim is
> withdrawn — it was wrong.** §17 and §24.1 make all pre-cutover Batch data disposable (DM-171,
> DM-172), so no Batch rows are loaded and no SET records are derived from trial data. The
> pre-cutover SKU import (§24.1) brings in Plate and Partition **SKUs**, which are not SET
> membership. **The modelling half of the finding stands unchanged**; the migration half does not
> exist. **RESOLVED — see review §8.**

---

## 3. Non-blocking improvements

**N-1 — a dormant Construction-level Waste/Conversion tier sits *above* the Batch default, and the
design's chain omits it.** `buildSpecFromRow` resolves `constEntry.waste ?? prof.waste ?? 5`
(`engine/costing.js:201-204`) — Construction **outranks** the Batch Profile. It is inert today:
both creation paths hardcode `waste:null, convRate:null, wastePP:null, convRatePP:null`
(`ConstructionLibTab.jsx:241,333`; `useCostingBatchBridge.js:681`), no editor exposes the fields, and
`calcBatchRow` overwrites the row's own slot afterwards. **The risk is the migration:** a
Construction loader that helpfully populates those four fields activates a tier that silently
outranks the Batch Profile for every row using that Construction. The brief should state that these
four fields are **dropped, not mapped**.

**N-2 — §9 and §22 read in opposite directions.** §9's chains are written in *resolution* order
(override first); §22's table is written in *inheritance-source* order (`Sector/system → Batch
default` as "Primary authority", with the row override in the "Exception" column). Same facts,
inverted presentation, one page apart. Add a note to §22 saying so.

**N-3 — the Quote Reference financial year is the FY of first approval, not of the Batch.** DM-14
allocates the Batch Reference at creation and the Quote Reference at first Checker approval; DM-208
fixes both to the Indian FY. A Batch created 25 March and approved 5 April therefore carries
`…/BAT/26-27/…` and `…/Q/27-28/…`. That is coherent and probably intended — state it, so a later
reader does not "correct" it.

**N-4 — no terminal state for an abandoned Quote Family.** §4 creates the Quote family at Send;
DM-14 allocates its reference only at first approval. DM-203 covers abandoned *Batches* (*"marked
Abandoned; reference and history remain"*) but nothing covers a Quote family that never reaches
approval and therefore never receives a reference. Give it a state.

**N-5 — a revision may legitimately contain items computed by different engine versions.** DM-199
(*"Amend recalculates affected units with the active engine"*) plus DM-6 (smallest affected unit)
plus DM-200 (*"Makers cannot select historical engines"*) makes mixed-engine revisions normal, and
DM-197 makes them representable. This is defensible, but it should be stated as *intended* and made
visible on the export, or it will be reported as a defect.

**N-6 — §23's read boundary contradicts DM-185.** §23 grants Customer/Location/Construction reads to
*"authenticated group users"*; DM-185 says *"Database access is denied without an explicit
group-wide or plant-specific grant."* One reads as `auth.uid() is not null`, the other as
`has_group_grant()`. Pick one.

**N-7 — per-Family customer sequences must outlive their Family.** DM-112 makes the Customer suffix
*"a simple sequence within its original Family"*; DM-127 permits Family consolidation with a
surviving record and retired aliases. The retired Family's sequence counter must be **retained
permanently**, or a later allocation under a resurrected or re-created Family can mint a Customer
Code already issued — violating §20.2's non-reuse rule.

**N-8 — terminology drift inside the document.** DM-119 makes *Customer Location* canonical, and §2
and §19.2 follow it. §5.2 still says *"Family → Customer → Delivery Plant"* and §6.3 says *"quoted to
a new Delivery Plant"*. Harmonise.

**N-9 — PM-1 and §23 both require a concurrency token that is not named.** PM-1: *"Save is atomic,
validates the full change and **detects conflicting updates**."* §23: *"conflicting/stale writes fail
rather than overwrite newer data."* Both require a version or `updated_at` token carried on every
mutable shared record and checked on write. Worth naming in the design so it is not discovered
during implementation.

**N-10 — `test:costing` cannot see the CalcGate, which is where B-1 and B-2 land.**
`component-split-plan.md` §D-25 is explicit: *"The batch path is not covered by the fixtures…
`scripts/costing-fixtures.mjs` exercises `engine/costing.js` directly… It never runs `calcBatchRow`,
never runs `buildSpecFromRow` against a real `batchProfile`."* Any change to the waste/conversion
chain is therefore **unverifiable by the existing gates**. A fixture over `calcBatchRow` is a
prerequisite for B-1's amendment, not an optional extra.

---

## 4. Exact proposed amendments

Each is additive. None changes a commercial rule.

**A-1 (B-1) — add to §9.4, after the chain:**

> This chain is **single and CalcGate-authoritative**. Batch Entry's resolver is the definition;
> every other surface, including Costing's display, must resolve through the same chain and produce
> the same value. Implementing this requires unifying the two resolvers that exist today
> (`state/useCostingResult.js` and `state/useQuoteActions.js`), and that unification is a
> calculation change requiring golden-value review and a fixture that exercises the batch path.

**A-2 (B-2) — add to §9.4, after the grey-display sentence:**

> No user action may convert an inherited value into a stored value. This specifically includes
> selecting a Sector and clearing a field: clearing returns a field to inherit, it does not restore
> the default as a stored number. Removing the existing materialisation sites is a prerequisite for
> this section, not a consequence of it.

**A-3 (B-3) — add to §8, and mirror in §19.5:**

> The **Pricing Group** owns the single freight value that enters calculation. A Delivery Group's
> freight and logistics information is **descriptive**: it is displayed, exported and audited, and
> it never enters a calculation. Where routes in one Pricing Group carry genuinely different actual
> freight, the Maker selects one explicit calculation basis at the Pricing Group and the route
> detail is rendered separately (§8.1).

**A-4 (B-4) — add to DM-192:**

> Two distinct signals are therefore required: a **calculation signal** (raised by pricing-relevant
> changes; stales the affected rows per DM-6) and a **presentation signal** (raised by descriptive
> changes; requires a fresh Send but no recalculation). The design must enumerate which Pricing Group
> and Delivery Group fields belong to each class; a field not classified is treated as
> pricing-relevant.

**A-5 (B-5) — replace §19.5's *"selected SKU/Construction versions"* with:**

> ├── selected SKU spec version (the Construction follows from it)
> ├── row-level Construction reference **only** for a quote-specific Proposed Construction
> │   under DM-144/DM-145, marked as such

and add to §6.2:

> Because a Construction change creates a new SKU, a published SKU's spec version is the sole
> authority for its Construction. A Batch row does not independently pin a Construction except for a
> quote-specific proposal not yet carried by any published SKU version.

**A-6 (B-6) — add to §23's enforcement principles:**

> Formal reads and writes must execute **as the calling user**, so that database policies apply.
> Privileged service credentials are restricted to a written allow-list of operations that cannot
> run as the user — authentication bootstrap, user administration and sequence allocation.
> Satisfying this section is an architectural prerequisite: the current backend performs all
> database access with a privileged client that bypasses policy enforcement entirely.

**A-7 (B-7) — replace §10's third bullet and align §20.9:**

> A SET exists once a Box has at least one component. A Box with no components is a standalone row
> and has no SET. Attaching the first component creates the SET; removing the last component
> dissolves it, and neither event changes any row's lineage identity.

**A-8 (N-1) — add to §17 / §24.1:**

> Construction-level Waste and Conversion values are not part of this model and must not be
> populated by any loader. The four fields present in current Construction records are dropped, not
> mapped.

---

## 5. Genuine Product Owner questions

Four. Each changes a stored value or a constraint, and none can be answered from source.

**Q-1 — Clearing a Waste or Conversion field: blank, or restore the default as a number?**
§9.4 says inherit is shown in grey and not stored, which implies *blank*. But the current control
deliberately does the opposite — `BatchProfileBar.jsx:145`: *"blank on ANY numField (margin, waste,
conv) must restore to sector default"* — and that was a considered affordance, not an accident.
`component-split-plan.md` §D-9 left this open as *"a domain question, not a code one."*
**Confirming §9.4's reading closes D-9 and D-16.** (Blocks B-2.)

**Q-2 — A Box with no components: SET, or standalone?**
Today every Box gets a SET Code (`useQuoteActions.js:406`). §10 supports both readings. This decides
whether `set_id` is ever null and how every existing Box row is loaded. (Blocks B-7.)

**Q-3 — Which Delivery Group and Pricing Group fields are pricing-relevant?**
DM-192 divides changes into pricing-relevant and descriptive but does not enumerate either side. I
can propose a split, but the classification is a commercial judgement about what changes a price.
(Blocks B-4.)

**Q-4 — What makes an editing lock "clearly stale"?** ✅ **RESOLVED — review §14.2.**
DM-164 permits an owner to reclaim *"a clearly stale lock"* but sets no threshold. Without one,
either the owner can always reclaim (the lock means nothing) or never can (a browser crash strands
the Batch until a Checker intervenes). A duration is needed.

---

## 6. Decisions that are technically sound and should not be reopened

These are strong choices. Several close defects that have been open for the life of the register,
and an implementer should not be tempted to "simplify" any of them.

**6.1 — Batch Entry as sole CalcGate, Quote Items as SendGate (§1.2, §22).**
**Preserved, and strengthened.** §22's calculation row reads *"none; Quote Items cannot calculate."*
Because §15 makes the Quote Item snapshot immutable and §20.13 makes issued revisions immutable, the
model permits a Quote Item table with **no update path at all** — a number can only enter it by an
insert from a Send, and a Send is reachable only from Batch Entry after Calculate All. C4
(`f250a8a`) already removed the last writable path from Quote Items back into Costing; this design
makes that boundary structural rather than procedural. **Do not add a Quote Item edit path for any
reason.**

**6.2 — Internal identity separate from visible business codes (§20.1, DM-184, §6, §10).**
This single decision closes the whole PM-7 cluster: (a) no stable Quote Item → Batch row identity,
(b) ambiguous re-send matching on `(material_code, rowType)` where `""===""` overwrites the first
blank-coded item (`useQuoteActions.js:344-345`), and (c) `Date.now()` row-id collisions
(`useQuoteActions.js:392`, `useCostingBatchBridge.js:701`). It also retires the D-7/D-11 class, where
an editable string was doing a key's job.

**6.3 — SET Code as an editable label over an internal SET identity (§10, §20.9).**
Correct, and the reason is recorded in the code itself: `engine/rowType.js:33` exists because eight
SET Code comparisons had three different normalisation conventions (D-7). Making the label
non-authoritative removes the class, not the instance.

**6.4 — Append-only customer outcome, with standing as a separate axis (DM-103, DM-104).**
An event table rather than a mutable column, and *"An Accepted revision may later be Superseded
without erasing that it was once accepted"* (§21.2). This is the right shape and it is cheap.

**6.5 — Default Pricing Group and Delivery Group on every new Batch (DM-148, DM-150).**
This is what makes the mandatory `row → Pricing Group` relationship satisfiable **with no UI change
and no behaviour change**, and it resolves the apparent conflict with
`costing-start-review-decisions.md` §5 (*"Delivery is batch-level for beta"*) without reopening it.

**6.6 — DM-208: Indian FY and the plant's local event date, never the user-editable Quote Date.**
Deriving a permanent sequence from a user-editable field would let a Maker influence reference
allocation by changing a date. Binding it to the event date closes that, and it answers the FY
boundary question outright.

**6.7 — DM-178: the exporter requires deliberate selection of a representative value.**
This directly retires the D-18/D-27 first-item assumption — *"the exporter—not a first-item
assumption—requires deliberate selection… and records it."* It is the correct fix and it is better
than blocking the export, which §16 rightly refuses to do.

**6.8 — DM-172: Formal Data Cutover as an explicitly declared boundary.**
A single declared event separating "reset freely" from "never destroy" is the right shape for reset
safety, and far safer than inferring the boundary from data volume or elapsed time. DM-170's
*"rollback preserves Supabase records through compatible app rollback or controlled forward
correction, not destructive database reversal"* is the correct rollback posture for a system with
issued commercial documents.

**6.9 — §6.2: no number-of-colours field.**
*"The current Costing and Batch Entry standard specification does not capture number of colours; the
Data Model must not silently introduce it."* Verified — there is no colours field in `INIT_SPEC`
(`data/defaults.js:87-97`). Correctly resisting a plausible-looking addition.

**6.10 — DM-198 / DM-200: historical rendering reads stored results and never reruns current logic.**
The only defensible rule once results are frozen, and it is what makes DM-197's engine-version
recording meaningful rather than decorative.

---

## 8. Resolution log — Product Owner rulings, 2026-09-04

### Rulings received

| Item | Ruling |
|---|---|
| **B-1, B-2** | **No further product decision required.** D-25 already settled that blank means inherit and that clearing restores blank rather than storing the inherited number. Resolver unification and a CalcGate fixture are implementation prerequisites, not open questions. **Q-1 is withdrawn.** |
| **B-3** | Intended authority confirmed: **Pricing Group owns calculating freight; Delivery Groups describe routes.** The finding was wording, not design. Amendment A-3 stands as written. |
| **B-5** | Accepted as a valid technical clarification. Published SKU spec version determines the Construction; a row-level Construction reference exists **only** for a quote-specific proposal. Amendment A-5 stands as written. |
| **B-6** | Accepted as a valid architecture prerequisite. Normal formal reads and writes must execute with the caller's permissions; writing RLS policies while the backend bypasses them is unacceptable. Amendment A-6 stands as written. |
| **B-7** | **Resolved — see 8.1.** |
| **B-4** | **Resolved — see 8.2.** |

**Q-1 (clearing a Waste/Conversion field) is withdrawn.** The Product Owner ruled it already settled
by D-25: clearing restores blank. `tabs/batch/BatchProfileBar.jsx:145` is therefore a **defect
against the settled rule**, not a competing affordance, and its removal is part of B-2's
prerequisite work.

### 8.1 — B-7 resolved: a Box with no components is a standalone row

**Ruling.** A Box with no Plate or Partition components is a standalone row with no SET. Adding the
first component creates the SET; removing the last component dissolves it; row identities are
unchanged; existing trial SET Codes need no migration.

**Technically sound, and it matches amendment A-7.** One amendment is required to make "dissolves"
safe.

> **A-9 — dissolve is a state transition, not a deletion.**
>
> When the last component is removed, the SET becomes **empty**; its permanent internal identity
> and its SET Code label are retained. It is not deleted. Attaching a component to that Box again
> reuses the same SET identity.

**Three reasons, each grounded in an approved rule:**

1. **DM-1 makes row removal reversible** (*"Removing a row is reversible and preserves lineage"*).
   If removing the last component hard-deletes the SET, restoring that row cannot restore the same
   SET — it mints a new identity. §10 requires the SET's internal identity to be **permanent**, so a
   reversible action must not destroy it.
2. **§14 requires deactivate/archive over hard delete** for formal records. An empty SET is the
   deactivated state.
3. **It preserves the editable SET Code across a remove/re-add cycle.** Under a delete-and-recreate
   reading, a Maker who removes a Plate to correct it loses the label they typed.

**Consequential clarification for §20.9.** With A-9, the *"exactly one Box parent and explicit
component membership"* constraint applies to **active (non-empty) SETs**. This is what stops it
firing mid-edit, in the window between creating a Box and attaching the first component.

**RESOLVED 2026-09-04.** The Product Owner confirmed A-9 in full: the Box becomes actively
standalone with no active SET relationship; the former SET is retained as inactive/dissolved with
its identity and SET Code; reattaching a component normally reactivates the same SET. It was also
made explicit that **a standalone Box is not treated as an active SET** — which is exactly the
distinction B-7 was raised to force. One amendment covers the word *"normally"*.

> **A-13 — SET Code uniqueness is scoped to active SETs, and reactivation must handle a taken label.**
>
> §10 requires the SET Code to be *"unique within the Batch."* With dissolved SETs retained, that
> constraint must be scoped to **active** SETs — otherwise a dissolved SET permanently reserves its
> label and the Maker cannot reuse it.
>
> That scoping creates the one case where reactivation cannot be automatic: if SET-1 dissolved
> holding `ABC` and an active SET has since taken `ABC`, reactivating SET-1 would produce two active
> SETs with one label. **Reactivation must then be blocked and the Maker prompted to relabel**,
> reusing the original SET identity with a new code. Identity is preserved; only the label changes.
> Silently minting a second identity, or silently overwriting the label, are both wrong.

### 8.2 — B-4 resolved: the pricing/presentation classification

**Ruling.** Approved as proposed:

| Class | Fields |
|---|---|
| **Pricing Group — calculation** | freight basis mode (master / manual / ex-factory); selected freight-basis location or route; applicable freight value/source; ~~payment terms~~ ⚠️; Interest |
| **Delivery Group — presentation** | actual Bill-to Customer Location; actual Ship-to Customer Location; destination label; displayed route/address details; delivery notes |

> ⚠️ **Payment terms is provisionally struck from the calculation class and is unresolved** — see
> review §9. The Product Owner has since ruled it descriptive, but that ruling rests on a premise that
> source contradicts, so its class is open. **Everything else in this table is settled.**

A Pricing Group calculation-field change **stales its rows**. An ordinary Delivery Group presentation
change requires **fresh Send only**. **Safeguard:** if the Pricing Group's selected freight-basis
location points to the Delivery Group being changed, that route change is pricing-relevant and
stales the rows.

**Technically sound. The safeguard is the right mechanism** — it is what prevents the silent-zero
outcome B-3 identified, without pretending route changes can never affect price. It also cleanly
replaces the current direct `batchProfile.delivery → matrix[plant][delivery]` lookup
(`engine/costing.js:31`), which today makes the delivery location unconditionally calculation-bearing.

Three amendments are required before it is implementable.

> **A-10 — the freight-basis reference must be an internal identity, not a name.**
>
> The Pricing Group's selected freight-basis location must reference the Delivery Group (or
> Location) by **internal identity**. The safeguard is then an exact reference check, not a string
> or name comparison. §8.1 already forbids the alternative: *"Comma/slash-concatenated delivery
> locations must not become a lookup key because that can break exact workbook lookup and silently
> produce zero freight."*

> **A-11 — removing or emptying the freight-basis Delivery Group must block, not re-resolve.**
>
> If the Delivery Group that *is* the freight basis is removed, or its location is cleared, the
> basis becomes unresolved. Per §9.1 this **blocks calculation**. It must not silently fall back to
> the Freight Master or to zero. This is a pricing-relevant structural change and belongs in the
> calculation class.

> **A-12 — classify the two structural changes the field list does not cover.**
>
> - **Adding or removing a Delivery Group within a Pricing Group** — presentation-relevant (fresh
>   Send), because DM-191 makes one Quote Item carry all Delivery Groups in its Pricing Group, so
>   the item's content changes without its price changing. **Unless** the affected Delivery Group is,
>   or becomes, the freight basis — then A-11 applies and it is pricing-relevant.
> - **Moving a Batch row between Pricing Groups** — always pricing-relevant. The row changes freight,
>   payment terms and Interest authority in one action.

**Two observations, neither of which changes the ruling:**

**O-1 — "ex-factory" is a genuine improvement over the design document, and it cannot be expressed
in the current engine.** The design had no way to state a deliberate zero freight other than typing
`0`, and `getFreightRate` rejects exactly that:

```js
// engine/costing.js:29-32
export const getFreightRate=(plant,delivery,matrix,override)=>{
  if(override&&+override>0)return +override;
  return matrix?.[plant]?.[delivery]||0;
};
```

`0` is falsy and `+0>0` is false, so an explicit zero override is **discarded** and the lookup runs
anyway — returning `0` on a miss. **Explicit zero and unresolved are today indistinguishable**,
which is precisely what §9.1 (*"Zero means an explicit zero"* / *"unresolved: calculation blocked"*)
and DM-149 forbid. A distinct ex-factory **mode** is the correct fix. Implementing it needs either a
change to `engine/costing.js` — which is off-limits without a deliberate decision — or resolution of
the effective freight upstream of `calcCosting`. **Flagged, not decided.**

**O-2 — payment terms.** ⚠️ **This observation was factually wrong and is superseded by review §9.** It
stated that no code derives Interest from payment terms. Two authoring sites do
(`BatchProfileBar.jsx:230-231`, `BatchContextBar.jsx:32,104`). The corrected analysis, and the
consequence for this classification, are in §9.

### 8.3 — A-10 to A-12 and ex-factory: accepted

The Product Owner confirmed that these are **technical consequences of approved rules, not new
commercial decisions**, and directed that they be incorporated into the design following approval of
the underlying field split:

- freight-basis references use internal identities (**A-10**);
- deleting or clearing the selected freight basis blocks calculation rather than resolving to zero
  (**A-11**);
- ordinary Delivery Group additions and removals require fresh Send (**A-12**);
- changing the selected freight-basis route, or moving a row between Pricing Groups, requires
  recalculation (**A-12**);
- **ex-factory must be an explicit mode**, because explicit zero and unresolved freight are
  commercially different (**O-1**).

The ex-factory ruling also disposes of O-1's open half: since the mode is mandatory, the effective
freight must be resolved **before** `calcCosting`, or `engine/costing.js:29-32` must change under its
own decision. `getFreightRate`'s `override&&+override>0` guard cannot represent a deliberate zero,
and that guard is the reason the mode is needed rather than a convention.

---

## 9. Q-5 — payment terms and Interest: the source correction

> **Status: RESOLVED in review §11.2.** This section records the source correction that reversed the
> question's premise. The Product Owner withdrew the decoupling recommendation on the strength of it
> and ruled the structured relationship preserved as an inheritance/override chain. Kept as the
> evidence behind that ruling, not as an open item.

### 9.1 — Correction to my own earlier statement

**I previously wrote that "no code performs that derivation." That was wrong.** The derivation
exists, it is structured, and the UI advertises it. `data/defaults.js:97`'s comment — *"credit days
→ auto-sets interest%"* — is accurate.

### 9.2 — What the code actually does

Selecting payment terms **writes Interest**, from a four-entry map, at two authoring sites:

| Site | Code |
|---|---|
| `tabs/batch/BatchProfileBar.jsx:230-231` | `const m={"30":0.5,"45":0.75,"60":1.0,"90":1.5}; setBatchProfile(p=>({...p,paymentDisc:e.target.value,interest:m[e.target.value]||1.5}))` |
| `tabs/costing/BatchContextBar.jsx:32,104` | `PAY_INTEREST={"30":0.5,"45":0.75,"60":1.0,"90":1.5}`; `pickPayment` writes `{paymentDisc:code, interest:PAY_INTEREST[code]||1.5}` |

Payment terms is **not free text**. It is a constrained enum of four credit-day values rendered as
`≤30d · 0.5%` … `≤90d · 1.5%` (`BatchProfileBar.jsx:236-239`, `BatchContextBar.jsx:33`). The control
is labelled **"PT · Int"** with the tooltip *"Payment Terms → auto-sets Interest %"*
(`BatchProfileBar.jsx:226-227`), and a third copy of the map exists for display only
(`DISC_MAP`, `:198`).

### 9.3 — Why this changes the answer

**The ruling's premise — "this matches the current calculation reality" — does not hold.** It holds
for *invalidation*: `useBatchInvalidation.js:77` does exclude `paymentDisc` by name. It does not
hold for *authoring*: changing payment terms rewrites `interest`, and `interest` **is** in the
invalidation dependency array (`:83`). **So changing payment terms stales every row today —
transitively, through the value it writes.**

> **The proposed classification and the existing auto-set are mutually exclusive.** Payment terms
> cannot be "descriptive, fresh Send only" while selecting it rewrites a calculation-bearing field.
> Decoupling them is therefore a **behaviour change**, not a confirmation of current behaviour.

Two further consequences of decoupling:

1. **Interest becomes hand-entered.** Today a Maker picks one of four options and Interest is set for
   them. Removing the link puts free numeric entry on a calculation-bearing field with no default —
   a new error surface on the value that feeds `Mat + Conv + Add-ons`.
2. **"45 days from receipt" is not expressible today, and the PDF would render it wrongly.**
   `export/pdf.js:41` emits `Payment: ${spec.paymentDisc||"30"} days` — it appends the word *days*.
   A descriptive free-text term would render as *"45 days from receipt days"*. If payment terms
   becomes descriptive, that exporter must change with it.

**Also note the duplication.** The map is written three times (`BatchProfileBar.jsx:198`, `:230`,
`BatchContextBar.jsx:32`). That is the D-7 / D-11 / D-27 pattern — one rule, several copies, free to
drift. Whichever way this is decided, the map must end up in one place if it survives.

### 9.4 — Recommendation

**Keep the link, but make it an override chain rather than a hard write** — the same
inherit/override idiom §9 already uses everywhere else:

```text
Pricing Group explicit Interest override
    → Interest derived from selected payment terms (structured map)
        → system fallback
```

- Payment terms **proposes** an Interest default; the Maker may override it, and the override is
  visible and audited.
- Changing payment terms with no override present stales the rows (Interest genuinely moved).
  Changing it while an override stands is descriptive and needs fresh Send only.
- This satisfies the ruling's intent — *"the app does not infer Interest from phrases"* — because
  nothing is inferred from text. A chosen enum maps to a number, which is structured, not inference.
- It keeps the working behaviour, removes the third copy of the map, and leaves the door open for
  the *"future structured credit-days formula"* to replace the map without touching the authority
  chain.

**If the Product Owner still prefers full decoupling**, that is a legitimate commercial choice and I
will record it — but it should be recorded as *removing an existing link*, with the two consequences
in 9.3 accepted, not as matching current behaviour.

### 9.5 — What is settled either way

Payment terms **as a stored field** is descriptive and belongs to the Pricing Group (§9.2). The open
question is only whether selecting it may write Interest.

**One classification point holds regardless**, and it corrects an implication of the 8.2 table:

> **A-14 — the pricing/presentation split is per-field, not per-entity.**
>
> The 8.2 table reads as *Pricing Group = calculation, Delivery Group = presentation*. Payment terms
> is a **Pricing Group field in the presentation class**, so the classification must be stated
> per-field. An implementer who infers the entity-level shortcut will class every Pricing Group
> field as calculation-bearing and stale rows on descriptive edits.

---

## 11. Resolution log — Product Owner rulings, round 2 (2026-09-04)

### 11.1 — A-13 withdrawn: dissolved SETs keep reserving their code

**Ruling.** SET Code uniqueness is **whole-Batch, not active-only**. A dissolved SET continues to
reserve its code; reattaching a component reactivates the original identity; another SET cannot take
that code meanwhile; reusing the label elsewhere requires deliberately relabelling the dissolved SET
first.

**A-13 is withdrawn.** The Product Owner is right on both the rule and the reasoning. §10 says
*"unique within the Batch"*, not "unique among active SETs" — I narrowed an approved rule for
implementation convenience, which is exactly the distinction I was asked to hold. Two historical SETs
sharing one visible label would make Batch history ambiguous, and that cost is real.

**The ruling is also technically simpler than the amendment it replaces.** A-13 existed only to
resolve a reactivation conflict; whole-Batch reservation means that conflict **cannot arise**, so a
branch disappears rather than being added. Reactivation is then always automatic and unambiguous, and
the constraint is a plain unique index with no partial predicate.

Two consequences must be carried, or the reservation becomes invisible.

> **A-15 — dissolved SETs must remain visible and relabellable in the Batch.**
>
> A reserved code held by a record the Maker cannot see is a phantom constraint: they are told `ABC`
> is taken with nothing on screen holding it, and the ruling's own escape hatch — *"deliberately
> relabel the dissolved SET"* — is unreachable. Dissolved SETs must be listed, and their codes
> editable, wherever SETs are managed.

> **A-16 — the database uniqueness constraint must use the application's normalization.**
>
> The app compares SET Codes through one helper: `normSetCode=v=>(v||"").trim().toUpperCase()`
> (`engine/rowType.js:32`), and `scripts/audit-setcode.py` exists to keep it the only comparison.
> The constraint must therefore be over `upper(btrim(set_code))`, not raw text. A raw-text unique
> index would let `abc` and `ABC` coexist in the database while the application treats them as one
> SET — **a ninth comparison site, and a new instance of D-7**, in the one layer the audit gate
> cannot see.

### 11.2 — Q2 accepted: Payment Terms → Interest as inheritance/override

**Ruling.** The structured relationship is preserved and formalised as an authority chain:

```text
Pricing Group explicit Interest override   (0 = explicit zero; blank = inherit)
    → Interest suggested by Payment Terms via an approved mapping
        → system fallback
```

Changing Payment Terms while Interest is inherited moves the effective Interest and **stales** the
affected rows; changing it while an explicit override stands changes no number and needs **fresh Send
only**. The mapping exists **once**, as an approved master/default. Free-text Payment Terms do not
drive calculation.

**Technically sound, and it is the right shape** — it is the same blank/zero/value idiom §9.1 and
§9.4 already use, so Interest stops being a special case. Three amendments are required.

> **A-17 — the mapping is a versioned Calculation-defaults component, and its version belongs in the
> snapshot.**
>
> §19.4 already reserves the slot: *"exact approved Calculation-default version(s)."* The credit-days
> → Interest map belongs there. Two consequences follow: changing it is a calculation-driving master
> change requiring PM-2 second-person approval, and because it moves the effective Interest of every
> Pricing Group that inherits, **the map version must be recorded in the calculation snapshot**
> alongside the effective value and its authority source (§15). Without the version, a historical
> quote cannot be reproduced.

> **A-18 — D-25's blank-awareness scope extends to Interest: five fields, not four.**
>
> D-25 is scoped to `waste`, `convRate`, `wastePP`, `convRatePP`. Making Interest inheritable puts it
> in the same model, so the blank-awareness work covers **five** fields. The two sites that currently
> auto-write Interest — `BatchProfileBar.jsx:230-231` and `BatchContextBar.jsx:104` — must stop
> writing and let it resolve, which **grows B-2's materialisation removal list from three sites to
> five**.

> **A-19 — `engine/costing.js:81` collapses blank and explicit zero, so the ruling is not
> implementable there as written.**
>
> ```js
> const intC = sub*(+interest||0)/100;   // engine/costing.js:81
> ```
>
> `+""` is `0`, and `0||0` is `0`. A blank Interest therefore costs as **0%** — and so does an
> explicit zero. The two are **indistinguishable at the only line that consumes the value**, which is
> exactly what the ruling's `blank → suggested` / `0 → explicit zero` distinction requires them not to
> be.
>
> Note this fails *differently* from waste and conversion, and worse. A blank waste yields `NaN`,
> which is visible. A blank Interest yields a **plausible-looking zero**. It is also precisely the
> hazard `CLAUDE.md` already names for `wastePP`/`convRatePP`: *"never fall back to `||` against
> these, since a legitimate value of `0` must be preserved."*
>
> `engine/costing.js` is off-limits without a deliberate decision, so this must be resolved either by
> that decision or by resolving the effective Interest upstream of `calcCosting`.

**One inconsistency to reconcile while the chain is being formalised.** Interest currently has **two
different system fallbacks**:

| Site | Fallback |
|---|---|
| `engine/costing.js:35` — `calcCosting` destructuring default | **1.5** |
| `engine/costing.js:209` — `buildSpecFromRow` | **0.5** |
| `state/useBatchState.js:25` — initial Batch Profile | **0.5** |

`1.5` is unreachable through the batch path today, because `buildSpecFromRow` always supplies a
value, so nothing currently disagrees. Once the chain's terminal tier becomes an explicit approved
default it must be **one** number, and whichever survives should be recorded as a decision rather
than inherited from whichever literal happened to be reachable.

**Two representations, one driver.** *"Free-text Payment Terms do not drive calculation"* implies
Payment Terms carries both a structured value (the map key) and optional descriptive text. Only the
structured value feeds the chain; free text alone yields no suggestion, so Interest must then be
explicitly set or fall to the system default. `export/pdf.js:41` renders
`Payment: ${spec.paymentDisc||"30"} days` — appending the word *days* — so it must read the
descriptive text when one exists, or it will render *"45 days from receipt days"*.

**A-14 stands**, confirmed: the pricing/presentation classification is per field, not per entity.

---

## 12. Q-6 resolved: SET Code is mandatory

**Ruling, 2026-09-04.** SET Code is mandatory. Blanks are not permitted.

**Technically clean, and it closes the register's open note.** The constraint becomes a plain unique
index with no exemption:

```sql
set_code text not null check (btrim(set_code) <> '')
unique (batch_id, upper(btrim(set_code)))        -- per A-16
```

It also disposes of the ambiguity `engine/rowType.js:25-31` deliberately left open — *"two rows with
blank SET Codes match each other today… Whether they should is a separate ruling"*. Under this
ruling `sameSetCode("","")` becomes unreachable for SETs, and the underlying hazard disappears twice
over: blanks are forbidden, **and** membership is by internal SET identity rather than by code, so
the comparison is no longer on the relationship path at all.

**No migration follows.** Pre-cutover Batch data is disposable (§17, §24.1), so no existing
blank-coded row needs handling.

Two consequences must be carried into the implementation brief.

### 12.1 — The allocation moment

A SET is created when the first component is attached (review §8.1). A mandatory code must therefore
exist **at that instant**, and the current seed cannot always supply one.

Today a Box's SET Code is seeded from its own Material Code — `useQuoteActions.js:406`:
`if(itemType==="Box"){ setCode=matCode; }` — but Material Code is itself blank whenever auto-coding
is off: `const matCode=autoCodeEnabled?generateCode(autoCodeSeq):""` (`:392`). **Attaching the first
component to an uncoded Box would therefore try to create a SET with no code.**

> **A-20 — SET Code allocation at SET creation.**
>
> Seed the SET Code from the parent Box's Material Code where one exists and is not already held by
> another SET in the Batch. Otherwise the Maker supplies it as part of creating the SET. The code is
> never silently invented, and never silently de-duplicated.

### 12.2 — The seed can violate the new constraint

**Material Code is not unique within a Batch, and nothing checks it.** The only two `matCode`
equality tests are duplicate *warnings* on the Send-from-Costing path
(`useCostingBatchBridge.js:587,598`); direct grid entry has no check at all. Two Boxes may therefore
share a Material Code.

Seeding SET Code from Material Code can consequently collide with the whole-Batch uniqueness rule
the Q1 ruling establishes. The resolution belongs in A-20's second clause: on collision the Maker
supplies a distinct SET Code.

**Silent de-duplication — appending `-2` or similar — must not be used.** The application would be
changing a user-facing label the Maker believes they set, which is the D-9 failure class this
programme has spent its rulings removing. A blocked save with a clear reason is correct; a silently
altered label is not.

---

## 14. Resolution log — round 3 (2026-09-04), and a correction to review §12

### 14.0 — Correction: two questions were still open

Review §12 closed with *"no open questions remain."* **That was wrong**, and the Product Owner is
right to reject it. Two decisions this review had itself recorded as unresolved were not counted:

- **Q-4 — the stale editing-lock threshold**, raised in review §5 and never answered;
- **the Interest system fallback**, raised by this review in §11.2 (*"must be **one** number… recorded
  as a decision"*) and left undecided.

Closing the two questions raised in the most recent round is not the same as closing the register.
Both are answered below.

### 14.1 — Interest system fallback: 0.5%, as an approved versioned Calculation Default

**Ruling.** When neither a structured Payment Term nor an explicit override supplies a value, the
system fallback is **0.5%**, stored as an approved versioned Calculation Default rather than a
hard-coded literal.

**Source confirms the reasoning exactly.** Three independent reachable sites already agree on 0.5,
and they are mutually consistent rather than coincidentally equal:

| Site | Value | Role |
|---|---|---|
| `state/useBatchState.js:25,28` | `interest:0.5` with `paymentDisc:'30'` | fresh Batch Profile |
| `engine/costing.js:209` | `prof.interest ?? 0.5` | `buildSpecFromRow` fallback |
| `BatchProfileBar.jsx:230`, `BatchContextBar.jsx:32` | `{"30":0.5, …}` | the ≤30-day mapping entry |

A fresh profile is Payment Terms `30` and Interest `0.5`, and the map's `"30"` entry is `0.5`. **The
default profile is already exactly what the chain would resolve to**, so adopting 0.5 changes no
current number. The `1.5` at `engine/costing.js:35` is the only dissenting value and is unreachable
through the batch path, because `buildSpecFromRow` always supplies one.

Two amendments follow.

> **A-21 — the `1.5` literal must be reconciled, not left standing.**
>
> Once 0.5% is the approved default, `engine/costing.js:35`'s `interest=1.5` becomes a **fourth
> answer** to a question that now has one. It is unreachable via the batch path *today*, but a
> destructuring default is a silent catch-all: any future caller that reaches `calcCosting` without
> passing through the resolver would be costed at 1.5% with no signal.
>
> A field whose authority chain terminates in an approved master should not also carry a silent
> engine-level default. Preferably the engine receives an always-resolved value and a missing one is
> treated as a resolver defect rather than absorbed. `engine/costing.js` is off-limits without a
> deliberate decision, so this is decision-gated — but **leaving the literal untouched is itself a
> decision**, and should be made knowingly rather than by omission.

> **A-22 — the fallback and the ≤30-day map entry are independent tiers that happen to coincide.**
>
> Both are `0.5` today and both will live in the Calculation Defaults. They are **different tiers**:
> the map applies when a structured Payment Term exists, the fallback when none does. They may
> legitimately diverge. Record that they are independent, so neither is later "corrected" to track
> the other on the assumption that one is a copy of the other.

### 14.2 — Stale editing lock: 15 minutes without heartbeat, Admin-configurable

**Ruling.** Active editing renews a heartbeat. After 15 minutes without renewal the owner may
reclaim. Checker/Admin may take over an *active* lock earlier only with a mandatory reason. The
timeout is an Admin-configurable system setting.

**Technically sound and implementable.** It resolves Q-4's real problem — *"clearly stale"* was
unmeasurable — by replacing a judgement with an observable. Three amendments are needed to make it
correct under concurrency, and one to keep it out of the wrong master.

> **A-23 — the heartbeat must not participate in the record's concurrency token.**
>
> PM-1 requires shared-master saves to *"detect conflicting updates"*, and §23 requires that
> *"conflicting/stale writes fail rather than overwrite newer data"* — which needs a version or
> `updated_at` token on the Batch (review N-9).
>
> A heartbeat is a write every few seconds by the active editor. If it lands on the Batch row and
> advances that token, **every heartbeat looks like a content change**: collaborators' saves fail as
> spurious conflicts, and the token stops meaning "the content changed." The lock state — holder,
> acquired-at, heartbeat-at — belongs in its own record, or in columns explicitly excluded from the
> concurrency token.

> **A-24 — staleness is computed from the server clock, and reclaim is one atomic conditional write.**
>
> Staleness must be evaluated as `now() - heartbeat_at > timeout` **on the server**. A client-side
> comparison lets a machine with a skewed clock reclaim a live lock, or never reclaim a dead one.
>
> Reclaim must be a single conditional update — *take the lock only if it is still held by the same
> user and still stale* — so that two simultaneous reclaims cannot both succeed. A read-then-write
> sequence permits two users to each believe they hold the lock, which is the failure the lock exists
> to prevent.

> **A-25 — reclaim is audited, not only takeover.**
>
> DM-164 states that *"All takeover events are audited"* and separately allows the owner to reclaim a
> stale lock. Owner reclaim must be audited on the same footing: it is the event that explains why
> another session's edits stopped being possible, and without it a stale-lock dispute has no record.

> **A-26 — the timeout is an operational system setting, not a Calculation Default.**
>
> It is Admin-configurable and it drives no number. It must **not** join the Calculation Defaults
> that a Pricing Basis Release captures (§19.4), or an operational knob enters the pricing snapshot
> and every timeout change looks like a pricing-basis change. It belongs in a separate system-settings
> record with its own audit trail.

### 14.3 — Register status

With 14.1 and 14.2 ruled, **this review carries no open product questions.** Twenty-six amendments
(A-1 … A-26) stand against seven blocking findings, all of which are now resolved by ruling. The
verdict is unchanged: **approve with amendments**, no commercial redesign required.

---

## 15. What this review did not do

- No application code, database object, migration, deployment or commit.
- No product decision, and no reopening of a settled commercial rule.
- Did not read `docs/commercial-intelligence-decisions.md`.
- Did not touch the uncommitted `BatchProfileBar.jsx` change present in the working tree.
- Did not verify live Supabase policies. The Supabase MCP server was unavailable in the prior
  session and every Supabase claim here is derived from repository source (`supabase_client.py`,
  `auth.py`, `server.py`). Reading the live policies remains a prerequisite for B-6's amendment.
