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
