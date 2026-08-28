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

### PM-4 — typing a SET Code silently skips the Nos/Set auto-fill

**Found at Stage 3 while verifying D-7. Pre-existing, unrelated to D-7, found after the freeze —
so it is here rather than in the register.** It blocks nothing in scope.

**Two behaviours both depend on resolving the same parent Box, and they have different entry
points:**

* **Auto-dims** run on render, via `autoCalcPPDims` in `useBatchState.js`.
* **Nos/Set auto-fill** runs *only* inside `handleConfirm` (`BatchGrid.jsx:250`), which is reachable
  only while `setCodeAssumed` is true.

**Typing in the SET Code field clears `setCodeAssumed`** (`BatchGrid.jsx:311`), which removes the
confirm control from the DOM. So a user who types a SET Code gets auto-dims and **silently no
Nos/Set** — no error, no toast, nothing to indicate a step was skipped.

> Demonstrated live: a Part-L created with SET Code typed as `glass180` resolved its parent for dims
> and did not auto-fill Nos/Set. Initially read as a D-7 failure; it is neither a D-7 failure nor a
> gate — the code path simply never executes.

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

> ## 🔑 THE GENERAL PRINCIPLE — string identity becomes tractable when entities become real
>
> **This is the strongest argument in the register for why some entries should wait**, and it is not
> specific to PM-6.
>
> Several open items are **string-identity problems**: the app carries identity as free text —
> a client name, a SET Code, a construction code, a composite key built by concatenation — and then
> tries to answer *"are these two the same thing?"* by comparing, normalising or guarding strings.
> **Every such guard is an approximation of an identity the data does not carry.**
>
> Once the masters land and identity is an **entity with a key**, those questions stop being
> approximations. Sameness becomes a key comparison; duplicates become a constraint; staleness
> becomes a detectable reference to a prior id rather than an indistinguishable string.
>
> ### What the masters work inherits — name it now rather than rediscovering it
>
> | Entry | The string standing in for identity | What an entity makes possible |
> |---|---|---|
> | **PM-6** | `spec.client` as free text that persists in a form | A stale customer becomes a *detectable prior id*, not an indistinguishable name |
> | **D-11** | construction code allocated A–Z with a `C${length}` fallback, sameness decided by a 9-field predicate | Duplicates become a **uniqueness constraint**; the predicate disappears |
> | **PM-3** | repointing rows and quote items at a surviving construction code | A foreign key, repointed once during migration rather than twice by hand |
> | **D-24** | client/sector guards comparing normalised strings | Identity comparison instead of `trim().toLowerCase()` heuristics |
> | **the quote-item `uid`** *(deferred from D-7)* | `product` + `material_code` + `rowType` + `setCode` concatenated into one string | A real key, and the case question stops mattering |
> | **D-13** | Prospect → Customer graduation, already noted as carrying two codes for this reason | The transition the masters were designed to model |
>
> **The pattern to apply when scoping any of these: ask whether the fix is a better string comparison
> or a real identity.** If the honest answer is the first, it is probably interim work that the
> migration discards — which is a reason to keep it minimal, not necessarily to skip it. **D-7 is the
> counter-example worth remembering:** its fix *was* a better string comparison, it shipped anyway
> because live data was already broken, and it was deliberately scoped small for exactly this reason.

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
