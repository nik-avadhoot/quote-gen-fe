# Defect pass — sequence, clusters and rulings

**Status: Stage 1 authorised, no code written.** This document is the map for the post-split defect
pass. It supersedes nothing: [`component-split-plan.md`](component-split-plan.md) remains
**authoritative** for every defect's mechanism and evidence, and this file records only how the pass
is *sequenced* and what has been *decided*.

> ### The rule that lifts here, and the rules that do not
>
> §6 rule 8 of [`post-split-state.md`](post-split-state.md) — *"defects during structural work:
> record, do not fix, do not investigate"* — **applied during the split and lifts with this pass.**
> Investigation is now not merely allowed but the point.
>
> **Everything else in §6 stays in force.** In particular: nothing commits with verification
> outstanding, UI verification is permanently the user's, one concern per commit, never reflow, and
> `engine/costing.js` / `data/defaults.js` / `quote-gen-be/server.py` are off-limits without an
> explicit decision.

---

## 1. Scope

**In:** D-2 · D-3 · D-4 · D-5 · D-6 · D-7 · D-8 · D-9 · D-11 · D-12 · D-14 · D-15 · D-16 · D-17 ·
D-18 · **D-19** (new — see §3).

> ## 🔒 SCOPE FREEZE — standing rule, decided 2026-08-28
>
> **The register as it stood at `a178e3f` is the entire scope of this pass.** It grew D-18 → D-24
> during Stages 1 and 2, every new entry from live testing. An open list that grows while it is
> being worked has no end.
>
> Anything found from that commit onward goes to
> [`post-model-defects.md`](post-model-defects.md) as **PM-*** and **is not worked now, regardless
> of severity** — unless it **blocks a fix already in scope**. "Blocks" means the in-scope fix
> cannot be completed or verified without it: not related to, not in the same file, not cheap while
> we are here.
>
> **This is not a severity judgement.** A PM entry can be worse than anything in the register. It is
> deferred because the pass has to terminate.

**Out:**

| | Why |
|---|---|
| **D-1** | Fixed at `06c1522`, before the freeze. |
| **D-10** | **Does not exist.** The number was skipped, not lost. Do not reuse it — see §3. |
| **D-13** | **Sequenced out of this pass by decision.** It is a missing capability, not a bug, and it is a design input to the three incoming masters (CustomerFamilyMaster, CustomerMaster, SKUMaster). It does not queue behind D-1…D-12. See the interaction warning in §6 — in-scope work will partially defuse it, and that must not be mistaken for D-13 having been addressed. |

---

## 2. Findings that changed the map

Three things surfaced while reading the register in final code. Each replaced a piece of recorded
triage with a determination.

### 2.1 D-18 is a CATEGORY, not one cell — and it is resolved at source

The register left D-18 as one of two possibilities: *the export writes a stale value*, or *it writes
nothing and the template cell stands*. **Neither, exactly.**

`export/excel.js:251–252` writes `f0.interest` — **`items[0]`'s** interest — into `BJ3`/`BJ4`, which
are *sheet-level parameter cells*. Every data row from row 7 computes against them. Meanwhile
`useQuoteActions.js:266` correctly folds each row's `interestOverride` into that item's own
`sp.interest`.

**The app models interest per-row; the template models it per-sheet. Every row after the first is
costed in the workbook at row 1's interest rate.** Row 1 exports correctly, which is why the defect
presents as intermittent.

> ### ⚠️ Do NOT fix interest alone
>
> Three sibling parameters have the identical shape, all reading `f0` into sheet-level cells:
>
> | Cells | Written from | Per-row override exists? |
> |---|---|---|
> | `BJ3` / `BJ4` | `f0.interest` | **yes** — `row.interestOverride`, `BatchGrid.jsx:646` |
> | `BM3` | `f0.margin` | to be confirmed during the fix |
> | `AY3` / `BA3` | `f0.waste` / `f0.convRate` | to be confirmed during the fix |
> | `AY4` / `BA4` | `_ppSpec` with `f0` fallback | **already partially patched** |
>
> **`excel.js:244–250` is a prior partial patch of this exact defect.** The `FIX:` comment and the
> `_ppItem` / `_ppSpec` workaround exist because someone hit this once for the PP row and repaired
> that one instance without generalising. Fixing interest the same way makes the same mistake a
> third time.

> 🛑 **`excel.js` hazard — the ASI landmine is five lines from the fix site.**
> `const _ppItem=items.find(...) // R-2;` at `excel.js:246` has its statement terminator **inside a
> comment**. The interest writes are at `251–252`. Same screen. Any editor with format-on-save, any
> Prettier run, any `eslint --fix` silently breaks the build here. See §6 rule 1.

### 2.2 Every backup on disk carries the D-3 signature — the fixture included

The register gives the detection signature as a backup file literally containing
`"cbb_template": null`. All three files in the shared parent directory match it, on **both**
raw-string keys:

| File | `cbb_template` | `cbb_rate_date` |
|---|---|---|
| `CFB_QOS_Backup_20260824.json` | `null` | `null` |
| `CFB_QOS_Backup_20260824_fixture.json` | `null` | `null` |
| `CFB_QOS_Backup_20260825.json` | `null` | `null` |

**"What happens to backup files already written with nulls" is not an edge case — it is 100% of the
backups that exist.** The register already flagged the Phase 0 backup as a partial fixture; this
confirms the condition never stopped.

### 2.3 D-3 is not discharged without a bug that was on the cleanup list

D-3's real cost is that a restored profile loses `cbb_template`. `excel.js:176` —
`if(!tmplB64){exportExcelFull(items,rates,freight);return;}` — then routes every export into
`exportExcelFull`, **which throws `ReferenceError` on every call**: `qty` is undefined at
`excel.js:107` (twice) and `locations` at `excel.js:129`.

So: restore a backup → no template → fallback fires → export dies. **A restored profile cannot
export at all.**

> **This tie spans two documents, which is why nobody connected it.** D-3 lives in the defect
> register; the `exportExcelFull` `no-undef` bug lives in the §4 post-split cleanup list as
> deferred lint debt. Neither document points at the other. Fixing D-3 alone stops *new* losses and
> leaves every already-restored profile unable to export.

---

## 3. D-19 — `exportExcelFull` throws on every call (NEW)

**Ruled in as part of D-3's scope.** Promoted out of the §4 cleanup list into the register, because
it is a correctness defect on a live fallback path, not cosmetic lint debt.

| | |
|---|---|
| **Number** | **D-19.** Not D-10 — that number is recorded as deliberately skipped and reusing it would corrupt every prior reference. |
| **Site** | `export/excel.js:107` (`qty`, twice), `excel.js:129` (`locations`) |
| **Reached from** | `excel.js:176` (no template) and `excel.js:186` (no `ws_cbb` sheet) |
| **Severity** | High — the client-side Excel fallback does not work today, and D-3 is the mechanism that routes users onto it |
| **Detection** | `npx eslint src` reports all three as `no-undef`. Fixing them takes the count **76 → 73**, which satisfies the "may only go down" ceiling. **`scripts/eslint-baseline.txt` needs no change** — it is a Phase 0 snapshot (121/2, pre-split monolith), not a live gate, and nothing compares against it programmatically |
| **Status** | Open — Stage 1, in D-3's scope |

> **Scope caution.** D-19 is a `no-undef` fix, not a rewrite of `exportExcelFull`. What `qty` and
> `locations` *should* resolve to has to be derived from the call sites before anything is written —
> the identifiers are absent, not merely misspelled, so there is no mechanical fix.

### Verifying D-19 — two traps that produce a false pass

Both were hit while setting up Stage-1 verification. **Recorded, not investigated** — neither is a
new defect, and each will otherwise be rediscovered the hard way by the next person on this path.

1. **Restoring a null-bearing backup does NOT remove the template.** Restore skips nulls
   (`if(snap[k]!=null)`), so an existing `cbb_template` survives untouched — *the same skip that
   causes D-3 also protects what is already there.* A restore-based setup leaves the primary export
   path working and tests nothing.
2. **`AuthProvider` calls `refreshSession()` on mount** (`AuthContext.jsx:14`) and its `catch` nulls
   the profile, so **any reload with the backend down logs you out.** Backend-down setups that
   require a reload — and D-19's does, to clear in-memory `templateB64` — are structurally
   impossible, not merely awkward.

> **Working setup:** both servers up · log in · delete `cbb_template` from localStorage · reload ·
> devtools **Block request URL** on `localhost:3001/export` · export. `/auth/*` keeps working, so
> reloads stay safe and the session survives, while `/export` fails and the fallback runs.
>
> `exportExcelFull` needs **both** conditions — the backend not returning a successful download
> **and** no template from either `templateB64Arg` or `getItem('cbb_template')`. The backend attempt
> comes first and returns early on `resp.ok` (`excel.js:186`), so an absent template alone never
> reaches it.

---

## 4. Stage-1 rulings — DECIDED

### 4.1 D-3 — existing nulls

**Decided: fix the backup leg, re-take fresh backups, and have restore warn on a null template.**

Old files will circulate regardless, so restore must degrade loudly rather than silently. The fix
need only be correct for the three keys that escape the post-loop overwrite — `cbb_template`,
`cbb_rate_date`, `cbb_batch_autosave` — per the register's narrowed scope.

**Re-taking the fresh backups is the user's action, not the implementer's.**

### 4.2 D-5 — hydrate on mount

**Decided: hydrate `batchRows` from storage on mount.** Not "make `Dismiss` clear the stored
autosave."

The register's framing is that the write is not the bug — the state/storage divergence that precedes
it is. Hydrating removes the divergence; clearing-on-dismiss guards a symptom of it. A guard at the
write can only ever see row counts, and **counts cannot encode intent** — deliberate shrinking must
persist, and only shrinking the user did not ask for is the defect. D-4 then follows naturally from
the same change rather than being separate work.

> ### ⚠️ This changes behaviour BEYOND the defect. Recorded deliberately, not absorbed.
>
> **Today:** a Maker who deliberately walks away from a batch can ignore the recovery banner and
> start fresh. The rows stay in `localStorage`, `batchRows` stays empty, and nothing loads. Ignoring
> the banner *is* the way to start clean.
>
> **After this change:** the old batch **loads on every mount.** Starting fresh stops being the
> default consequence of ignoring a banner and becomes an explicit act — `+ New Batch`.
>
> **This is a real workflow change for anyone who has been using Dismiss-and-ignore as their way to
> begin a new day's work.** It is accepted as the cost of removing the divergence, and it is written
> down here so it is never discovered as a surprise and mistaken for a regression.
>
> **Open sub-question for the diff proposal:** what the recovery banner is *for* once rows hydrate
> automatically. It cannot keep its current meaning. Settle this when proposing, not while writing.

> ### 🛑 BLOCKING CONSTRAINT ON D-5 — raised at Stage-1 verification, before Stage 2 starts
>
> The banner is currently doing **double duty**. Besides being D-5's symptom, it is the
> confirmation step that stands between a manual Restore and the batch grid being replaced —
> recorded as **DP-2** in [`component-split-plan.md`](component-split-plan.md) and ruled
> **deliberate**, not accidental.
>
> **Hydrate-on-mount removes the banner as the route back to the data, and would therefore silently
> delete a guard the product owner has explicitly said they want kept.**
>
> **D-5's proposed fix MUST either:**
> 1. preserve a confirmation step before grid data is replaced on a manual Restore, **or**
> 2. state explicitly why it cannot, and what replaces it.
>
> Not to be solved now. **This must be answered in the D-5 proposal, not discovered during it.**
>
> **Both conditions, not one.** The guard DP-2 records is age-gated at 7 days
> (`useBatchState.js:64`), after which the rows persist in `localStorage` with **no UI route back to
> them at all** — so DP-2 describes an intent rather than current behaviour, and the expiry is a hole
> in the guard rather than a footnote on it. A replacement must therefore:
>
> * **preserve the confirmation** before grid data is replaced on a manual Restore, **and**
> * **not inherit the 7-day expiry.**
>
> Satisfying one and not the other does not discharge this constraint.

### 4.3 D-2 — preserve the spec, clear only the batch

**Decided: `+ New Batch` clears the batch and leaves the Costing scratchpad intact.**

The three options were not equal. Naming the scratchpad in the confirm only tells the user what they
are about to lose — it removes the surprise, not the loss. **The spec has nothing to do with the
batch; there is no reason clearing one should clear the other.**

**Additionally: the confirm must name all ten state changes, not four.** The current text names
`setBatchProfile`, `setBatchRows`, `setBatchResults`, `setItems` and stays silent on six others,
three of which change Costing's *mode* rather than its content — context reverts to same-batch, the
identity freeze releases, and any Deep-Dive link breaks.

---

## 5. Stage-1 constraints

1. **The `createdVia` / `createdAt` enabler is ADDITIVE ONLY.** New Construction Library entries get
   the fields. **Existing entries stay untouched — no backfill, no migration, and no inference about
   where the 24 existing entries came from.** The enabler exists to make D-11's hypotheses A and B
   decidable *going forward*; inventing provenance for entries that predate it would defeat exactly
   the purpose it serves.
2. **D-3 and D-6 are two commits, same session.** They share a file and a verification pass, not a
   concern. §6 rule 5 is stricter than the register's convenience grouping, and splitting them costs
   nothing.
3. **Propose diffs before writing them.** Every Stage-1 change.
4. **The lint ceiling is not headroom to spend.** It is 76/0 and may only go down — but
   *"still under the ceiling"* is not the test. A change that fixes three errors and introduces two
   passes the ceiling while leaving the codebase worse.

   > Caught live in Stage 1. The D-19 fix should have taken the count 76 → 73; the first run
   > reported **75**, and the cause was the implementer's own `catch(e){}` — an unused binding plus
   > an empty block, two fresh errors. Rewritten as `catch{…}` and the count came to 73.
   >
   > **Quietly spending headroom on your own sloppiness is how a ceiling becomes a target.** The
   > standard this repo already holds — *every file created by the split lints at zero* — is the one
   > that applies to new code in this pass. **Predict the post-change count before running the gate,
   > and treat any gap between prediction and result as a defect in the change**, not as slack to
   > absorb.

---

## 6. The map

### 6.1 Clusters — shared root cause or file

| | Cluster | Members | Binding tie |
|---|---|---|---|
| **A** | Backup integrity | D-3 · D-6 · **D-19** | `useQuoteActions.js` `handleBackup`; D-19 joins by consequence, not by file |
| **B** | Reload divergence | D-5 · D-4 | One question twice: what survives a reload, and does the other half agree? D-5 is rows in storage but not state; D-4 is the freeze in state but never in storage |
| **C** | SET identity and gating | D-7 · D-15 · D-14 · D-16 | Three layers of one subject — D-7 string identity, D-14/D-15 the confirmation gate, D-16 link lifecycle |
| **D** | Destructive-action chain | D-12 → D-2 → D-5 | D-12 is how a user arrives by reflex, D-2 is what they are told, D-5 is what happens to the batch after |
| **E** | Master-data authority | D-9 · D-8 | D-8 is unguarded writes *into* masters; D-9 is masters silently copied *out of* inheritance into override. They meet on the Defaults surface and the waste/conv model |
| **F** | Construction identity | D-11 | Four creation paths, four different checks, one absent |
| **G** | Export | D-18 | Now a category — see §2.1 |

**Genuinely independent:** D-17 (`BatchGrid.jsx:635`, plus the header hint at `:126`) and D-18.
D-6 is independent by cause and clustered only by file.

> **Post-split line numbers.** Every site reference in the register points at the pre-split
> 5,402-line `QuotationApp.jsx`. Current locations for the main ones: the toast stack is
> `ui/ToastStack.jsx` (extracted from the shell at Stage 2; it was `QuotationApp.jsx:78`),
> autosave is `useBatchState.js:69–80`,
> `startNewBatch` is in `useCostingBatchBridge.js`, the SET Code inputs are `SpecForm.jsx:147`
> (uppercases) and `BatchGrid.jsx:309` (does not), and the sector selects are `SpecForm.jsx:88`
> and `BatchProfileBar.jsx:51`.

### 6.2 Where fixing one changes another

| Fix | Effect |
|---|---|
| **D-5** framing | Determines D-4. Hydrate-on-mount (**decided**) makes rehydrating the freeze natural and D-4 largely falls out |
| **D-15** decision | Sets D-14's scope. **D-14 cannot be specified until D-15 is ruled on** |
| **D-7** | Unconfounds cluster C. While codes mismatch on case, a "parent not found" in D-14/D-16 is ambiguous between gate bug and case mismatch. **D-1's landed fallback currently masks D-7** — quiet symptom, loud diagnostic noise |
| **D-12** | Reduces D-2's frequency, fixes none of it |
| **D-2** | ⚠️ **Partially defuses D-13, which is out of scope.** Both D-13 toasts instruct the user toward `+ New Batch`; once that is non-destructive to the spec, the instruction stops destroying work. **The capability gap remains.** Do not let the severity drop be read as D-13 having been addressed |
| **D-9** | Must precede D-8's Defaults surface. D-9 decides what a sector default *means*; D-8 then guards edits to it |
| **D-11** prevention | Does **not** remove the 6-of-24 existing duplicates. Cleanup additionally requires repointing every batch row and quote item referencing a dying code |
| **D-18** | Scoped to interest alone, leaves margin/waste/conv siblings broken — see §2.1 |
| **D-3** | Not discharged without **D-19** — see §2.3 |

### 6.3 D-8 — scoping

Split by **mechanism**, not by surface: one write model replicated across four surfaces is cheaper
than four bespoke guards.

| | Piece | Effort | Needs |
|---|---|---|---|
| **D-8e** | **Warn on backward propagation.** `useBatchInvalidation.js:34` wipes every cached result on any rate change, so a quote costed this morning silently recomputes. Report *"this edit invalidated N calculated rows."* | Smallest | Nothing |
| **D-8b** | **Blanket operations.** Confirmed at source: `blanketDisc` runs `setRates(prev=>prev.map(r=>({...r,disc:blanketDisc})))` — every grade, one click. `Apply GY` and `blanketInterest` likewise. Confirmation naming scope and affected count | Small | Nothing |
| **D-8a** | **The write model.** Per-keystroke `onChange` → draft plus explicit Save/Cancel. Build on Rate Master as the pattern, then replicate | Large | Confirm the pattern on one surface before replicating |
| **D-8c** | **Plausible-range validation.** ₹450 for ₹45 | Medium | **Domain input — the ranges. Cannot be derived by an implementer** |
| **D-8d** | **Change history / undo** | Largest | **Recommend deferring** — masters are heading to Supabase per §2 of the handoff, and building history on `localStorage` first builds it twice |

**Do D-8e and D-8b first.** Highest value per unit of effort, zero design input, and D-8e alone
converts the defect's worst property — that the damage is invisible where it occurs — into something
visible.

> **One existing guard, easily misread as protection.** These controls are gated on
> `role!=="admin"`. That is **authorization, not confirmation**: it stops the wrong person editing,
> not the right person fat-fingering.

---

## 7. Sequence

**The binding constraint is not implementation — it is that UI verification is the user's**, so every
fix waits on a session. The order below batches fixes that verify in one sitting.

### Stage 1 — Trust the safety net ✅ AUTHORISED
`D-3` · `D-19` · `D-6` · the `createdVia`/`createdAt` enabler

Backups first: every later stage's rollback story rests on these files, and all three currently
misreport their own contents. One verification pass — take two backups a minute apart, restore one,
export from the restored profile. The D-11 enabler rides along (additive, no behaviour change)
because it needs a data-gathering window before Stage 5 arrives.

### Stage 2 — The data-loss chain
`D-12` → `D-5` → `D-2` → `D-4`

The beta blockers, in the order a user meets them. D-12 leads: cheapest, no product decision, purely
positional, and it closes the accidental entrance to the chain.

> **D-12 is two commits, not one.** The toast stack lives at `QuotationApp.jsx:78`, inside the
> 83-line shell. The z-order fix is a behaviour change; moving the stack into `ui/` is a structural
> move. **§6 rule 5 forbids sharing a commit.**

### Stage 3 — SET identity
`D-7` → `D-15` (decide) → `D-14` → `D-16`

D-7 strictly first — it is the confounder. All of this verifies in one flow: Costing → send → grid →
confirm → Deep Dive → Unlink.

> **D-16 carries a question that is the user's to answer, not the implementer's:** whether conv/waste
> re-resolve per sector after a Set Role or Box Type change post-Unlink. **Awaiting the user's
> check in Stage 3.** It cannot be settled from source.

### Stage 4 — Master data
`D-9` survey → `D-9` fix → `D-8e` → `D-8b` → `D-8a`

**The D-9 survey is investigation, not code.** The register is explicit that the full write-site set
must be derived exhaustively first, because a partial fix produces inconsistent behaviour between
paths — worse than the current uniform wrongness. Its four known sites now live in three files.

### Stage 5 — Construction identity
`D-11` decision → prevention across **all four** paths → existing-duplicate cleanup as its own task

Latest: most design input needed, and the enabler has been collecting data since Stage 1.

> 🛑 **The register's trap holds.** Unify the two `importConstrFromSpec` copies and leave
> `ConstructionLibTab.jsx:196` (`+ New Construction`, **no check at all**) unguarded, and the library
> keeps duplicating. The obvious fix fixes nothing observable.

### Floating
`D-18` · `D-17`

Both independent of the stages. **D-18 is not filler despite being small** — see the ASI hazard in
§2.1. D-17 is genuine end-of-pass work.

---

## 8. Open decisions — later stages

None of these blocks Stage 1. Each blocks its own stage.

| Stage | Defect | The decision |
|---|---|---|
| 2 | D-5 | What the recovery banner *means* once rows hydrate automatically (see §4.2) |
| 3 | D-7 | Normalise at input (uppercase both) or compare case-insensitively (both predicates)? **Affects mixed-case data already stored** |
| 3 | D-15 | Is per-row blocking correct by design, or should an unconfirmed SET Code block globally? **Determines D-14** |
| 3 | D-16 | **User's check** — do conv/waste re-resolve per sector after Set Role / Box Type change post-Unlink? |
| 4 | D-9 | Pre-fill sector values into `spec` (friendlier), or leave blank with the default shown as placeholder (what the design says)? |
| 4 | D-8c | The plausible ranges, per field. Domain input |
| 4 | D-8d | Defer until masters move to Supabase? |
| 5 | D-11 | What *constitutes* the same construction — is sector/client identity or metadata? Must layers match, or only board specs? |
| Float | D-18 | Interest only, or all four sheet-level parameters? (§2.1 recommends all four) |
| — | **Order quantity on a quote** | **Should a quote carry an order quantity and line value at all?** Surfaced by D-19: the OFFER sheet's data row was written to emit `qty` and `finalRate*qty`, but no order-quantity field was ever built and the header never got the two columns. The Stage-1 fix drops the values rather than inventing the field. **Recorded, not investigated** — a product question, not a bug |

---

## 9. Provenance

| | |
|---|---|
| Register, authoritative | [`component-split-plan.md`](component-split-plan.md) §*Defect register* |
| Register summary | [`post-split-state.md`](post-split-state.md) §3 |
| Standing rules | [`post-split-state.md`](post-split-state.md) §6 |
| Session brief | [`session-start.md`](session-start.md) |

This document was written before any Stage-1 code. The three Stage-1 rulings in §4 and the two
constraints in §5 are decisions of the user's, recorded here rather than in conversation so the next
session does not re-derive them.
