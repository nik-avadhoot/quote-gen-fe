# Defect pass — CLOSED 2026-08-29

**Read this before `component-split-plan.md`.** That file is the working record; this is the state
it left behind. **The register is the deliverable of this pass, not the fixes.** More was learned
about what is wrong with this app than was repaired, and that was the intent.

**Scope was frozen at `a178e3f`.** Everything found afterwards was recorded, not worked, unless it
blocked something already in scope. The freeze held: D-23, D-25, D-26, D-27 and PM-1…PM-6 were all
found *during* the pass, and only two (D-26, D-27) were built, each by explicit ruling.

---

## 1. What closed

### Fixed

| Defect | What it was | Commits |
|---|---|---|
| **D-19** | `exportExcelFull` threw `ReferenceError` on **every** call — the client-side export was dead | `4f6ef0a` |
| **D-3** | Backup silently discarded two raw-string keys | `a286dc9`, `309df7c` |
| **D-6** | Backup filenames could not distinguish two snapshots from one day | `c243be3` |
| **D-5** 🚨 | Autosave silently overwrote a larger batch with a smaller one | `53676f4`, `1408df8`, `73a0948` |
| **DP-2** | A file restore replaced the batch with no confirm | `fdf19a7` |
| **D-12** 🚨 | The toast overlay made a destructive button clickable by accident | `4ec8bcf`, `f1e3165` |
| **D-7** | SET Code comparison was case-sensitive across some of eight sites, so a grid-created SET could never match one sent from Costing | `0453d0a`, `50e47b5`, gate `8a88544` |
| **D-2** | `+ New Batch` warned about what was recoverable and stayed silent about what was not | `d061521` |
| **D-24** 🚨 | G1 identity guards gated on **row count** instead of on whether the profile held an identity | `3b7ac99` |
| **D-16** | Push materialised derived dims into the row, silently severing its link to the parent Box | `c5f3e85`, **regression fixed in `53935b0`** |
| **D-18** | Row-level Interest override never reached the exported xlsx | `de594c0` (fe) + `0bf8b1f` (be) |
| **D-26** | Typing a SET Code skipped the Glass SKU Nos/Set auto-fill | `ce800ca` |
| **D-1** (return leg) | `buildSpecFromRow` blanked the Glass SKU on every Deep Dive | `8b317a5` |
| **D-27** | `server.py` filled the PP waste/conv slots from the **Box** row, so **every** PP row-level waste/conv override was dropped whenever the backend served the export | `cc5ada1` (be) |

### Closed as NOT defects

| | Why |
|---|---|
| **D-14** | The guard exists, dates to the repo's first commit, is the sole route, and has no bypass. The described behaviour is not producible from this code |
| **D-15** | Correct by design. Ruled per-row: Calculate All and Send All are already effectively global, so the safety property exists where wrong attribution would escape |
| **D-22** | **Retracted** (`d3bb169`). Claimed as a data defect; it was the wrong render path entirely — the badge never consults the master |

### Built as infrastructure

`scripts/audit-setcode.py` — SET Code comparison stays centralised.
`scripts/audit-doc-sections.py` — no silent deletions from the register.

Both are live gates. The doc gate has since fired on a legitimate rewrite **and on the
implementer's own commit** — see §4.

---

## 2. What remains open, and why

### Ruled and unbuilt — a decision exists, the code does not

| | Why still open |
|---|---|
| **D-28** | **Recorded, not worked. Fix direction ruled: WARN, DO NOT PLUMB — the app design stays.** The grid offers per-row overrides for **four** parameters the export cannot carry per row: Interest and Freight (header-level in the workbook), Waste% and Conv (one per Box, one per PP). The rate the Maker sees and the rate on the document disagree. **Proposed wording and placement are recorded and NOT approved.** The dangerous state is not "an override exists" — it is **rows of the same type disagreeing** |
| **D-8e** | Warn when a master edit invalidates already-calculated rows. Smallest fix available, zero design input |
| **D-8b** | Confirmation on blanket rate operations, which write across every grade in one click |
| **D-8c** | The plausible-range values survive any migration; **where** validation runs is deferred |
| **D-23** | `+ New Batch` guards on batch state to protect spec state. **Ruled: confirm when the spec is dirty, and rewrite the message to name the spec** |
| **D-17** | The add-on pin control is a bare ⊕ with no label. Cosmetic |

### Blocked on a decision — see §3

| | Blocked on |
|---|---|
| **D-25** 🚨 | Whether `INIT_SPEC` opens up. Blank-means-inherit is **unreachable**: nothing ever starts blank, and the batch path cannot consume a blank if one arrives — it yields `NaN`, silently |
| **D-9** | The same decision as D-25. Selecting a sector converts inheritance into an override |
| **D-4** | Identity freeze is session state, lost on reload while the batch it protects survives. **Obsoleted outright** if START gets persisted draft state |
| **PM-6** | A stale Costing spec silently seeds a legitimately empty batch profile. Same condition as D-4 |
| **D-13** 🧭 | **A missing capability, not a bug.** Scratchpad work cannot become a batch without being destroyed. Design input to the incoming masters — do not queue it behind bug fixes |

### Deferred with reason

| | Reason |
|---|---|
| **D-8a** → PM-1 | The master-data write model. A draft/Save-Cancel model over `localStorage` and one over a server are different artefacts; building it twice is the largest waste available |
| **D-8d** → PM-2 | Change history / undo. Discarded entirely by a migration that will have its own audit trail |
| **D-11** | Four construction-creation paths, four different checks, **one absent**. The unguarded path (`+ New Construction`) appends a blank row, so no check is possible at creation and none happens later. ⚠️ **The obvious fix — unify the two `importConstrFromSpec` copies — fixes nothing observable.** Cleanup of existing duplicates deferred to PM-3 |
| **PM-5** | Post-model. (PM-4 was re-filed into the register as D-26 and fixed) |

---

## 3. The three decisions that gate the most remaining work

**None has been made. Each blocks several entries, and none can be derived by an implementer.**

### 3.1 Does START own persisted draft state?

**Blocks D-4, PM-6, D-23, and half of D-13.**

The Costing tab already has two modes named in its own source — START (`specCommitted`) and REVIEW
(`activeBatchRowId`) — and already enforces them by disabling half the toolbar. What it lacks is
**separate state**: one `spec`, one surface, mode inferred from three flags.

> **A START/REVIEW split obsoletes NOTHING on its own.** Every entry above is obsoleted by
> *separate persisted draft state* — which a split makes natural but does not require. Full
> analysis: the **Restructure read** section of `component-split-plan.md`.

D-13 splits in half here: its *destruction* half (both mandated exits destroy the scratchpad) is
obsoleted; its *graduation* half (promote a scratchpad into a batch) is a capability still to be
designed. **In-scope work will partially defuse D-13. That must not be mistaken for D-13 having
been addressed.**

### 3.2 Does `INIT_SPEC` open up — can a spec start blank?

**Blocks D-25 and D-9.**

The app declares blank-means-inherit and **nothing ever starts blank.** `INIT_SPEC` ships concrete
numbers, and `calcCosting` destructures with defaults that fire only on `undefined`, never on `""`.

> ## 🛑 THE TRAP, IF 3.1 AND 3.2 ARE TAKEN TOGETHER
>
> **A restructure is exactly when someone reasons *"let's have specs start blank so inherit finally
> works."*** It is the natural thought and it aims at a real defect. Acting on it without D-25's
> full fix **re-creates inheritance materialisation inside the new structure, where it is hardest
> to see** — the landmarks are gone and the code is unfamiliar.
>
> Concretely: **D-24's fix is safe only because the profile cannot express blank today.** Blanking
> the profile removes exactly that protection.

### 3.3 Does the template change?

**Blocks the row-level half of D-18 and D-27, and bounds what any exporter can ever do.**

`CFB_Quotation_Master_v7.xlsx` offers **two slots** per parameter — `IF(B7="Box",$X$3,$X$4)` — for
waste, conv and interest. No per-row cell exists for any of the three.

> **This is design intent, not absence.** Margin *does* have a per-row column — `BM6` "Margin %",
> pre-filled with `=IFERROR(IF(B7="Box",$BM$3,$BM$4),0)`, which both exporters overwrite with a
> literal per row. **The author demonstrably knew how to make a parameter per-row and chose not to
> for these three.** Anyone adding per-row waste columns later is overriding a choice, not filling
> a hole, and should know which they are doing.

> ## ✅ THE RULING OF 2026-08-29 ALREADY SETTLES TWO OF THE THREE
>
> **Interest and freight are header/client-level BY DESIGN and the template is correct.** Payment
> behaviour is a property of the customer; plant location is a property of the delivery. Neither
> varies by SKU inside one quote. **They are not on the table.**
>
> **So decision 3.3 is now only about WASTE and CONV** — which, unlike the other two, are
> properties of the piece being made and legitimately differ between a Box and a Partition in one
> set. That is a genuinely open question; interest and freight are not.
>
> The consequence runs the other way for the two that were settled: see **D-28**. If the template
> is right, the **grid** is what is wrong for offering overrides the export cannot carry.

> ## ⚠️ AND ON 2026-08-29 THE POSITION WIDENED TO ALL FOUR — the narrow scoping was superseded
>
> **Verified by export.** Profile-level `wastePP` of 4% populated the BOARD slot correctly and
> independently of RS4's 5% — **the two slots work.** A row-level override on one PP row produced
> **5% in both** — structurally unrepresentable, not a failure.
>
> So waste and conv sit in the same product position as interest and freight, **one level down**:
> header-level for interest and freight, **Box/PP-pair level** for waste and conv. The granularity
> differs; **the mismatch is identical.** Four parameters, one position.
>
> **The narrower scoping was ruled first and is recorded as superseded rather than deleted** — it
> was sound reasoning paired with an assumption that per-row export support existed. It does not.
>
> **Decision 3.3 therefore narrows further: the template question is now only whether it SHOULD
> gain per-row cells at all** — not which of the four are affected. All four are.

**No amount of access to `server.py` creates a cell that does not exist.** The constraint is the
workbook, not the code that fills it.

---

## 4. The patterns — gathered here because they are otherwise spread across entries

**Each recurred. Each has more than one instance.**

### Mode A — extent undercount. The mechanism was right; the scope was low

| Recorded | Actual |
|---|---|
| D-5: a guard that "never lets a smaller batch overwrite a larger one" | fires only at mount; every other path writes straight through it |
| D-7: four comparison sites | **eight sites, six files, three conventions** |
| D-18: "all four sheet-level parameters" | **five** — and the unnamed one was the worst |
| "the shell is 83 lines" | **84** |
| "the lint ceiling is 75" | **67** — 75 was a transient bad count, remembered as the standard |

**Cause:** a set described from memory instead of derived. **Remedy:** treat any stated count as a
**floor** and re-derive the set before proposing.

> **"Floor" understates it — the set moves SIDEWAYS.** A survey expected to find five sites found
> four: one *recorded* site turned out correct, and one *unrecorded* site turned out broken.
> **Counting is not the check; tracing each site is.**

### Mode B — untraced observation. The symptom was recorded; the code path never was

| Recorded | Actual |
|---|---|
| D-22: a data defect, "D-8's mechanism in the wild" | the wrong render path entirely |
| D-14: an unconfirmed SET Code does not block Deep Dive | the guard exists and has no bypass |
| D-16: the trigger is Unlink | **Unlink writes nothing.** The trigger is Push |
| D-26: `qtyPerSet` multiplies the SET rate at `costing.js:212` | `:212` is an **assignment**, not arithmetic — a grep hit never checked for read-versus-write |

**Cause:** an observation entered the register without anyone confirming which code produced it —
the designed cost of *record, do not investigate*, which was right for a refactor and deferred the
bill to this pass. **Remedy: confirm the code path from source BEFORE scoping any entry.**

> **The two modes need opposite reflexes.** Mode A says *look wider than the entry*. Mode B says
> *do not trust the entry at all until the code confirms it*. **An entry can suffer both.**

### Inheritance materialisation — a blank meaning "inherit" is filled with the value it was inheriting

Four sites, one design failure. D-9 fills the blank on **sector selection**; D-16 on **push**;
`bridge:568` on **first Send**; D-25 is why the model was never reachable to begin with.

> **Why it is invisible: the number written is identical to the one displayed.** Nothing changes on
> screen. The link is severed, and the only evidence is an update that arrives later — or never.
>
> **Fixing any one alone leaves the model broken.**

### Mirror drift — two implementations of one parameter

`export/excel.js` and `quote-gen-be/server.py` fill the **same** template.

> **The off-limits rule, obeyed literally, CREATES the drift it exists to prevent.** D-18's defect
> existed identically in both. "`server.py` is off-limits" makes the obedient move *fix the
> frontend and stop* — which would have made a quote cost differently depending on whether the
> backend happened to be up.
>
> **A one-sided fix to a mirrored parameter is not a partial fix. It is a new and worse defect**,
> because divergence is invisible from either side alone.
>
> **Check the mirror before scoping, and ask for the approval as part of the proposal.** D-27 was
> found by doing exactly that.

> ### 🧨 Porting hazard — `??` is not falsy-coalescing
>
> `??` falls through on `null`/`undefined` **only** — never on `""`, never on `0`. Python's `or`
> skips both, **and several sectors set `wastePP`/`convRatePP` to 0.** Three failures of this one
> distinction in this pass. `server.py` has `first_set()` for it.

### Verification that proves nothing

Twice in this pass a check "passed" while testing nothing: an injection that never landed, and a
change-detection test whose stale element ref put focus on a different row.

> **A test whose pass condition is "nothing happened" is worthless without a paired demonstration
> that something *could* have happened.** Assert the precondition, then run a positive control on
> the same element.

---

## 5. Where the next reader will get hurt

- **`quote-gen-be/README.md`** carries an open question with real teeth: **nothing identifies which
  code a running backend process holds.** No version string, no SHA, nothing in `/health`, and the
  reloader is off. *"I restarted it"* is an assertion nobody can check, and a verification against
  a stale process looks exactly like one against a fixed process.
- **The lint ceiling is 67**, not 76 or 73. Predict the post-change count before running the gate,
  and treat any gap between prediction and result as a defect in the change.
- **Never reflow this repo.** `export/excel.js` has an ASI-dependent statement whose terminator
  sits inside a comment.
- **The doc gate fires on legitimate rewrites and cannot tell them from silent deletions.** That is
  **the point, not a limitation** — distinguishing them would mean guessing at intent, and it would
  guess wrong in the case that matters. Register the rewrite in `REVIEWED` with a reason.
