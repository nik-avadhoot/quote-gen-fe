# Post-model defects — found after the scope freeze

**This list is NOT worked during the current defect pass.** It exists because the register grew
D-18 → D-24 during Stages 1 and 2, every new entry arriving from live testing, and an open list that
grows while you work it has no end.

> ## The scope freeze
>
> **The defect register as it stood at commit `a178e3f` is the entire scope of this pass.**
>
> Anything found from that point onward is recorded **here** and **is not worked now — regardless of
> severity** — with one exception:
>
> > **it may be worked if, and only if, it blocks a fix already in scope.**
>
> "Blocks" means the in-scope fix cannot be completed or verified without it. Not *"is related to"*,
> not *"is in the same file"*, not *"would be cheap while we are here"*.
>
> This is a **standing rule for the remainder of the pass**, decided by the product owner on
> 2026-08-28. It is not a judgement about severity. A finding landing here can be worse than
> anything in the register; it is deferred because the pass has to terminate.

## Numbering

Entries here are **PM-1, PM-2, …** — a separate sequence from D-*. They are deliberately *not* given
D-numbers, so that "the register" always means the frozen list and the count of remaining work
cannot drift.

If one of these is later promoted into a pass, it keeps its PM number and gains a D-number only if
the register is formally reopened.

## What belongs here

- Anything observed after the freeze, at any severity
- Anything found while verifying an in-scope fix that is **not** that fix failing
- Design-level observations about code the pass is not touching

## What does NOT belong here

- A verification failure of an in-scope fix — that is the fix not being done
- Anything that blocks an in-scope fix — that gets worked, and recorded in the register

---

## Register

Nothing found *after* the freeze yet. The entries below were **moved here from the defect pass by
decision on 2026-08-28** — they were in scope and were deferred, which is a different thing from
being found late. Each carries the reasoning, so it is not re-litigated.

### PM-1 — D-8a, the master-data write model

> ## 🔗 PM-1 CARRIES D-11'S REMAINING QUARTER — the dependency runs both ways
>
> The draft/Save-Cancel model deferred here is **also the commit step D-11 needs.**
>
> D-11 blocks duplicate constructions at three of four creation paths. The fourth,
> `+ New Construction`, can only **warn** — the row is appended already active, every field persists
> as typed, and there is no save step to refuse at. **A block there is not a D-11-sized change; it
> is this entry.**
>
> **So PM-1 is not only about master-data safety. Closing it closes D-11.** Anyone scoping PM-1
> should count that, and anyone reading D-11 as "done" should read this.

> ## ⚠️ THIS DEFERRAL IS CONDITIONAL — it rests on two entries staying in scope
>
> **PM-1 fails test 2: unguarded per-keystroke master edits ARE wrong today.** A typo flows into
> every subsequent quote, and `useBatchInvalidation.js:34` wipes cached results so a quote costed
> this morning silently recomputes with no explanation.
>
> **It is filed here only because D-8e and D-8b remain in scope to mitigate it** — the invalidation
> warning and the blanket-operation confirmation.
>
> **If either is dropped in a later scope trim, PM-1 must come back into the register.** That
> dependency is invisible to anyone reading PM-1 alone, and it is exactly the kind of thing a scope
> trim removes without noticing what it was holding up.

**Was:** replace per-keystroke `onChange` writes on Rate Master / Freight / Defaults / Partitions
with a draft plus an explicit Save/Cancel step.

**Why deferred.** A draft/Save-Cancel model over `localStorage` and one over a server are
**different artefacts**, not the same feature in two places. The server version has to answer
optimistic updates, conflict handling, server-side validation, and who wins when two admins edit
the same rate. None of those questions exist in the `localStorage` version, and none of its answers
survive the move.

It is also **the largest single piece in the pass** and therefore the most expensive thing to build
twice. The product owner's ruling: *"building it twice is worse than living with the current write
model for longer."*

> **What this leaves live in the meantime:** D-8's per-keystroke writes remain unguarded. **D-8e and
> D-8b stay in scope precisely because of this** — they are the cheap mitigations that make the
> unguarded model survivable until the real one arrives.

### PM-2 — D-8d, change history / undo for master data

**Why deferred.** Same shape as PM-1 and flagged before it: history built on `localStorage` is
discarded entirely by the migration, which will have its own audit trail. Building it now is
building it twice, and the second build keeps none of the first.

### PM-3 — D-11's existing-duplicate cleanup

**Was:** consolidate the 6-of-24 duplicate constructions (groups G/U/V/W and O/T) and repoint every
batch row and quote item that references a dying code.

**Why deferred — sequenced WITH the migration, not before it.** The repointing is the painful part,
and doing it in `localStorage` and then again during the migration performs the same dangerous
operation twice on data that is about to move. Once constructions have database identity the
consolidation is a different, safer operation.

> **D-11's PREVENTION fix stays in scope** — see the plan. Only the cleanup moves here. Prevention
> stops the set growing; cleanup is what the migration should absorb.

> ## 🚨 THIS CLEANUP NEEDS A ONE-WAY STEP, OR IT CAN BE SILENTLY UNDONE — see **D-33**
>
> **Backup restore replaces `cbb_constrlib` wholesale**, writing it to `localStorage` and reloading.
> It never calls `setConstructionLib`, so no creation-time predicate can see it.
>
> **Consolidate the six duplicates, then restore a backup taken beforehand, and the consolidation is
> gone — with no warning and no trace.** The repointing described above would have to be done again,
> and nothing tells the user it was lost.
>
> **A cleanup that can be reverted by opening a file is not finished work.** Whatever form the fix
> takes — a schema version on the backup, a migration marker, a refusal to restore a pre-cleanup
> file — **the one-way step is part of PM-3, not an optional extra.** Attempting the consolidation
> without it buys a result that any old backup can erase.

### ~~PM-4~~ — MOVED INTO THE REGISTER as **D-26**, 2026-08-28

**Not withdrawn — refiled.** The two-test audit found it failed both: the masters migration makes
nothing about it tractable (a UI entry-point problem, not an identity one), and live data is wrong
today — `nosPerSet` stays at its default and multiplies through the SET rate.

**Left as a pointer rather than deleted**, so the move is traceable and nobody looks for PM-4 and
concludes it was dropped. Full entry: **D-26** in
[`component-split-plan.md`](component-split-plan.md).

### PM-5 — the add-on pin control LOOKS disabled at the limit and silently destroys a pin

**Not a styling note. A control that reads as unavailable and, when clicked, discards something the
user cannot see being discarded.**

At two pinned add-ons, the third button renders at `opacity:0.3` — the universal signal for
*disabled* — but **there is no `disabled` attribute**. It is fully clickable, and
`togglePinAddOn` (`useBatchState.js:31`) does:

```js
const next=prev.includes(k)?prev.filter(x=>x!==k):[...prev,k].slice(-2);
```

`.slice(-2)` keeps the last two, so clicking a third **silently evicts the oldest pin**. No
confirmation, no toast, no indication of which column just disappeared from the grid.

> **The affordance says "unavailable"; the behaviour says "replaces something, and you will not see
> which."** Those are contradictory, and the destructive reading is the true one.

**Also, and separately:** pinned state is signalled by **colour alone** — `C.amber` when pinned,
`C.slateL` when not. No shape, fill or text differs.

**Relationship to D-17.** D-17 is the *glyph* — a bare `⊕` that reads as "add"/"increment" rather
than "pin", with `title` as its only explanation. That is cosmetic and in scope. **This is
behavioural and was found after the freeze**, so it is here. The glyph fix touches the same lines;
whoever does it should read this first and deliberately choose not to fix it, rather than not notice.

### PM-6 — a stale Costing spec silently seeds a legitimately EMPTY batch profile

**Severity proposed: HIGH.** Silent wrong-customer attribution, no guard, and **no ruled fix covers
it.** Found at Stage 4 while ruling D-2. **Recorded here rather than as D-26 because of the scope
freeze** — it does not block D-2, which ships with mitigation. If you would rather it sat in the
register, it is a one-line move.

#### Mechanism

After `+ New Batch`, `batchRows` is `[]` and `batchProfile` is fresh — but **since D-2 the `spec`
survives**, still carrying the previous batch's `client` and `sector`. On the next Send:

1. **The G1 identity guards do not fire** — they are wrapped in `if(batchRows.length>0)`, and there
   are no rows.
2. **The seeding block fires** — `if(batchRows.length===0)` → `if(spec.client)
   profilePatch.client=spec.client`.

**The blank profile is seeded with the old customer, silently.** The SKU is then filed under a
client the Maker never chose for this batch.

#### D-2 CREATES this exposure, and the ruling behind it is still correct

Before D-2, `+ New Batch` wiped the spec, so the client was blank and the Maker had to type one.
After D-2 it persists and can be sent without a second thought. **That is a genuine cost of a ruling
that remains right** — the spec has nothing to do with the batch, and re-keying client and sector is
the saving a same-customer Maker most wants.

#### ⚠️ D-24's FIX WILL NOT CLOSE THIS — do not assume it does

**Two independent reasons:**

* The guard requires **both** sides non-empty — `if(_specClient && _profClient && _specClient !== _profClient)`.
  A fresh profile has `client:''`, so the comparison is skipped **however the outer row-count
  condition is rewritten.** There is nothing to mismatch against.
* **D-24's case is a *populated* profile being overwritten.** Here the profile is genuinely blank,
  and seeding it from the Costing proposal is the block's **intended** behaviour.

**This is a different hole that D-24 was never going to cover:** a *stale* spec seeding a
*legitimately empty* profile.

#### The mitigation is visibility, NOT a guard — so the hole stays open

D-2's confirm now **names the retained client and sector** at the moment of the decision. That is
the earliest and cheapest point to catch it, and it degrades to plain wording when neither is set.

> **But a Maker who clicks through the confirm can still file under the wrong customer.** Visibility
> is not a guard. Nothing downstream will stop them, and nothing will tell them afterwards — rows
> carry no client of their own, so the mis-attribution is invisible once made.

#### Why post-model is the right window, not merely convenient

When **CustomerMaster** arrives, `client` stops being free text that persists in a form and becomes a
**selected entity**. "Stale client" changes shape entirely: you would pick a customer for the batch,
and a spec carrying a previous customer's id becomes detectable rather than indistinguishable. **The
real fix is customer identity, not another guard on a string.**

> ## 🔑 TWO TESTS, NOT ONE — and they answer different questions
>
> **An earlier version of this note said string-identity problems "should wait for the masters". That
> collapsed two questions into one, and D-7 is the counter-example that separates them.**
>
> | Test | What it decides |
> |---|---|
> | **1 · Does the migration make this tractable?** | Whether the *eventual* fix is cheap |
> | **2 · Is live data wrong TODAY, and unmitigated?** | Whether we can *wait* |
>
> **These come apart.** Test 1 tells you what the migration makes easy. It says nothing about what
> can afford to stay broken until then.
>
> * **D-7 answered YES to both, and shipped anyway.** Its fix *was* a better string comparison —
>   exactly the interim work the migration would discard — but live data was already broken: a Part
>   row was visually inside a SET the grid could not see. Wrong today beat cheap later.
> * **PM-6 answers YES to the first and NO to the second.** A stale client *can* mis-attribute a
>   batch, but nothing is wrong yet, and the confirm now names the retained client. So it waits.
>
> **THE SORTING RULE FOR THIS FILE IS THE PAIR, NOT "the masters will handle it."** An entry belongs
> here when the migration makes it tractable **and** nothing is wrong today that the migration's
> delay would leave broken. Failing either test means it belongs somewhere else — in the register if
> data is wrong now, or in an ordinary backlog if the migration was never going to help.
>
> ### What the masters work inherits — the string-identity group
>
> Several open items carry identity as **free text** — a client name, a SET Code, a construction
> code, a key built by concatenation — and then ask *"are these the same thing?"* by comparing,
> normalising or guarding strings. **Every such guard approximates an identity the data does not
> carry.** Once identity is an entity with a key, sameness becomes a key comparison, duplicates
> become a constraint, and staleness becomes a detectable prior id.
>
> | Entry | The string standing in for identity | Test 1 | Test 2 |
> |---|---|---|---|
> | **PM-6** | `spec.client` as free text persisting in a form | ✅ | ✅ nothing wrong yet |
> | **PM-3** | repointing rows at a surviving construction code | ✅ | ✅ — the duplicates are **identical on all 9 fields**, so they cost the same. Messy, not wrong |
> | **D-11** | code allocated A–Z with a `C${length}` fallback; sameness by a 9-field predicate | ✅ | in scope — prevention only, deliberately minimal |
> | **D-24** | client/sector guards comparing normalised strings | ✅ | in scope — silent reassignment is wrong **now** |
> | **quote-item `uid`** *(deferred from D-7)* | four fields concatenated into one string | ✅ | ✅ |
> | **D-13** | Prospect → Customer graduation | ✅ | out of pass by decision |
>
> ### ⚠️ AUDIT OF THIS FILE AGAINST THE PAIR — two entries are MISFILED
>
> | Entry | Test 1 | Test 2 | Verdict |
> |---|---|---|---|
> | **PM-1** D-8a write model | ✅ | ⚠️ wrong today — **mitigated by D-8e/D-8b, in scope** | **CONDITIONALLY filed** — see the warning on PM-1 itself |
> | **PM-2** D-8d change history | ✅ | ✅ absence of history corrupts nothing | **Correctly filed** |
> | **PM-3** D-11 cleanup | ✅ | ✅ duplicates are identical, so costings are unaffected | **Correctly filed** |
> | ~~**PM-4**~~ typing skips Nos/Set auto-fill | ❌ | ❌ | **WAS MISFILED — now moved to the register as D-26** |
> | **PM-5** pin control silent eviction | ❌ pure UI, unaffected by entities | ✅ a lost pin loses a view, not data | **MISFILED by category** — deferred work, but never post-model work |
>
> **PM-4 is the one that matters.** It fails both tests: the migration will not help, and it can
> produce a wrong number today. **It is in the wrong list**, and under the scope freeze that is a
> ruling for the product owner rather than a move I should make.
>
> **PM-5 is misfiled harmlessly** — it belongs in an ordinary backlog rather than here, since nothing
> about it becomes tractable when entities arrive. Left in place unless the product owner wants a
> third list; noting it is enough.

### PM-7 — a Quote Item does not know which Batch row produced it

**Found 2026-09-01, while scoping C4 of the START/REVIEW series. Documentation only — no
mechanism, no migration and no fix is approved.** C4 was deliberately built around this gap
rather than over it.

> **The governing rule this protects, and which stays intact:** **Batch Entry is the sole
> CalcGate** — a calculation change becomes quotable only by passing through a Batch row,
> Calculate All and Send All. **Quote Items is the SendGate / export staging surface only.** C4
> removed the last writable path from Quote Items back into Costing (`loadItem`) precisely so that
> nothing can shortcut it. Everything below is about what the *link* cannot currently express; none
> of it licenses a second authority over a number.

#### (a) There is no stable Quote Item → Batch row identity

A Quote Item is `{ id, spec, result, status, note, timestamp }`. **No field names the row it came
from, under any name, in any creation path.**

`sendAllToQuoteItems` — the only live creation path — reads `row.id` at `useQuoteActions.js:313`
solely to fetch `batchResults[row.id]`, then discards it and stamps a **fresh**
`id: Date.now()+Math.random()` (`:348`). The row's identity is never carried.

#### (b) Re-send matching is ambiguous

Re-sending onto an existing item matches on
`(i.spec.material_code||"")===row.matCode && (i.spec.rowType||"Box")===(row.itemType||"Box")`
(`useQuoteActions.js:344–345`). With `matCode` blank on both sides, `""===""` matches the **first**
blank-coded item of the same row type. Two uncoded rows of one type collide, and the wrong item is
overwritten silently.

> **Do not "fix" this by inferring linkage from Material Code, Product, SET Code, row type,
> array position, construction code or any fuzzy match.** The existing match *is* such a guess, and
> it is the thing to replace, not the pattern to extend.

#### (c) Batch row IDs can collide

Row ids are `Date.now()` — `useQuoteActions.js:379` (`addBatchRow`) and the `newId` used at
`useCostingBatchBridge.js:550` (Send from Costing). Two rows created inside one millisecond share
an id. **This matters even though nothing consumes row ids across surfaces today:** it is the
identifier any future linkage would be built on, and it is the same millisecond-collision shape as
the deferred toast-ID defect.

#### (d) A stale Quote Item stays exportable after its Batch row changes

Push writes the row and calls `invalidateBatchRow` (`useCostingBatchBridge.js:251–256`); it touches
no item. `sendAllToQuoteItems` blocks on any stale row (`useQuoteActions.js:294–300`), which
protects the **row → item** direction. Nothing protects the other side: an item already sent keeps
its old `spec` and `result` and **remains exportable** through both export buttons
(`QuoteItemsTab.jsx:188`, `:194`).

**Verified in the browser on 2026-09-01** (throwaway data, restored byte-identically): pushing a
row-owned change flipped that row's grid badge to 🔄 and Send All refused with
`🔄 Stale results — run Calculate All first. Affected: Row 3 [ZZTEST-A]`, while the previously-sent
Quote Item was byte-identical throughout. Calculate All cleared the block and only then did the item
update. **The gate works in the direction it covers; the exported item can still be older than its
source, and with no row reference on the item nothing can currently detect that.**

#### What a later phase needs — recorded, not designed

1. **Stable linkage** — a durable, unique originating Batch-row identity carried on the item, and an
   id generator that cannot collide.
2. **Divergence detection** — being able to answer "has this item's source row changed since it was
   sent?", which (a) and (c) make impossible today.
3. **Export blocking** — whether a diverged item may be exported at all, and what the Maker is told.
4. **Database-backed quote history** — what a "sent" quote *is* once quotes outlive one browser, and
   how re-sends version rather than overwrite.

These are one cluster: none of them is reachable without (1). Sequencing, storage and UI are all
open, and the product owner rules them.

#### Why this is here and not in the register

Found after the freeze, in code the pass is not touching, and it is squarely post-model: every part
of it becomes tractable when quotes and rows are entities with real keys, and none of it is
tractable while both live as `localStorage` blobs. It is **not** a C5/C6/C7 concern and must not be
folded into the START/REVIEW series.

---

## Migration requirements

**Not defects, and not deferred work.** These are questions the masters migration has to *answer*.
Recorded here because they were noticed during the defect pass and would otherwise be rediscovered
mid-migration.

### MR-1 — what does "backup" mean once masters live in Supabase?

The backup/restore model repaired in Stage 1 (D-3, D-6, `cbb_pinned_addons`) is **`localStorage`-shaped**:
`handleBackup` snapshots browser keys into a JSON file, and `handleRestoreFile` writes them back.

**Once CustomerMaster, CustomerFamilyMaster, SKUMaster — or the Construction Library — live in
Supabase, that file stops being a complete snapshot.** It will contain the browser's half and
silently omit the server's. D-3's repaired guarantee — *"a backup round-trips everything"* — quietly
weakens to *"a backup round-trips what is still local"*, with nothing in the UI saying so.

**The migration must state what backup means afterwards**: whether the JSON file is still offered,
what it covers, and whether restoring one onto a different server state is coherent. **A partial
backup that presents as complete is the D-3 failure mode again, one layer up.**
