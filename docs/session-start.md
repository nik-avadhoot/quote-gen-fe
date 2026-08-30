# Session start — read this first

**The standing rules in [§6 of `post-split-state.md`](post-split-state.md) were learned through
correction, not stated up front. Treat them as binding from message one.** Four in particular,
because they are the ones that get violated by a well-meaning assistant trying to be useful:

- **Defects: record, do not investigate.** One line — what was observed, and where.
- **Capability is demonstrated, not described.** Show it working before either party plans around it.
- **Nothing commits on your own verification.** Automated green does not discharge a manual guard.
- **An unproposed design decision inside an approved diff is a deviation** — even a defensible one.
  Deciding a condition during implementation that was not in the proposal is not "an implementation
  detail"; it changes when the code fires. Flag it, the way you would a changed mechanism.

You are not the first session on this repo. The rules below are the compressed cost of the
earlier ones.

---

## 1. Where the code is

Two independently-versioned repos side by side, each with its own `.git`:

| | |
|---|---|
| `quote-gen-fe` | React + Vite frontend → `github.com/nik-avadhoot/quote-gen-fe` |
| `quote-gen-be` | Flask export + auth backend → `github.com/nik-avadhoot/quote-gen-be` |

The **component split is complete**: `QuotationApp.jsx` went 5,402 → 83 lines across Phases 0–8,
merged to `main` as `0def418`. `refactor/component-split` is **local-only** and was never pushed.

**`origin/main` is current — it holds the whole split.** Local and remote both sit at `aee1121`,
two doc-only commits above the merge. The gap is closed; a fresh clone gets the split.

**The lesson stands even though the gap is closed: check `origin/main` before concluding anything
is missing.** The merge sat unpushed behind 46 local commits for two days, and a clone taken in
that window looked like the split never happened.

Auth is live: login is required, `role` comes from the signed-in profile, and `public.profiles`
is the one table in Supabase. `CLAUDE.md` now lives at `quote-gen-fe/CLAUDE.md` — it used to sit in
the shared parent directory, outside both repos, where every edit to it was unversioned.

## 2. What to read, in order

0. **`docs/defect-pass-close.md`** — ⭐ **START HERE.** The 2026-08 defect pass closed on
   2026-08-29. This is what closed, what is still open and why, the **three unmade decisions** that
   gate most remaining work, and the recurring failure patterns gathered in one place. **The
   register is that pass's deliverable, not the fixes.** Read it before the plan.
1. **`quote-gen-fe/CLAUDE.md`** — conventions and business-logic guardrails. Loads automatically in
   the frontend. **It does not load when you are working in `quote-gen-be`** — see §5.
2. **`docs/post-split-state.md`** — the handoff. Architecture, the D-1…D-24 defect register,
   §6 standing rules, §8 repository and deployment state. Start at §6.
3. **`docs/component-split-plan.md`** — the full record: every phase, decision, and mechanism.
   **Authoritative** where it and the summary disagree.
4. **`../quote-gen-be/docs/CFB_QOS_Project_Brief_v3.md`** — business logic, formulas, tab-by-tab
   behaviour. Authoritative for anything not about code structure.

## 3. The gates

```bash
npm run build
```
```bash
npm run test:costing
```
```bash
npx eslint src
```

Lint is a **ceiling that may only go down.** 76/0 was the pre-refactor baseline at `0def418`;
the defect pass took it to 67/0 and C3 of the START/REVIEW series took it to **66/0**, which is the
number to beat now — not 76, and no longer 67. A fourth, for documents rather than code:

```bash
python scripts/audit-doc-sections.py
```

A fifth, added at Stage 3 — SET Code comparison must stay in one place:

```bash
python scripts/audit-setcode.py
```

A sixth, added at the second close — the blanket-operation confirmations. Their controls are
**admin-only**, so an implementer without admin cannot trigger the dialogs at all; this fixture is
the only way that wording and its count arithmetic get verified:

```bash
npm run test:blanket
```

A seventh, added at C3 of the START/REVIEW series — the Costing draft model. `isDirty` has no
caller until C4 and the corrupt/validation branches need a hand-written `localStorage` blob to
reach, so this fixture is the only thing that verifies them. It covers `state/costingDraftModel.js`
only; **`test:costing` remains the costing-engine gate and is not merged with it**:

```bash
npm run test:draft
```

> ### ⚖️ SEVEN GATES, AND ALL SEVEN RUN EVERY TIME. Here is the reasoning, so nobody re-litigates it
>
> **Total runtime is a few seconds.** The question is not cost, it is whether scoping any of them
> to "when you touched that area" is safe. **It is not, and this pass is the evidence:**
>
> | Gate | Why it must run even when it "cannot" be relevant |
> |---|---|
> | `audit-setcode` | Its entire purpose is catching a `===` comparison added **somewhere nobody expected**. Scoping it to "when you touch SET Codes" defeats the gate |
> | `audit-doc-sections` | It caught a silent deletion in the implementer's **own** commit — the author is the least able to notice what they removed |
> | `test:costing` | The engine's only regression net, and the one thing standing between a refactor and a wrong price |
> | `test:blanket` | Verifies text and arithmetic **nobody without admin can see in the UI** |
> | `test:draft` | Same reason one level down: no UI path reaches the draft comparator or its corrupt branch. Its equality cases each name the rule that was NOT implemented, so a green run is evidence rather than decoration |
> | `build`, `eslint` | Cheap, and the ceiling discipline only works if the number is taken every time |
>
> **"I didn't touch that" is exactly the reasoning that lets drift in.** D-27 — two exporters
> answering the same question differently — was found because a mirror was checked when nobody
> expected it to matter. **If a gate is ever genuinely too slow, make it faster; do not make it
> conditional.**

`test:costing` passing does **not** mean the UI works — read §1 of `post-split-state.md` for what
it does not cover before trusting a green run.

## 4. What NOT to do

- **Never reflow. Never run Prettier or `eslint --fix`.** `export/excel.js` has an ASI-dependent
  statement whose terminator sits *inside a comment*. A reformat silently breaks it.
- **`engine/costing.js`, `data/defaults.js` and `quote-gen-be/server.py` are off-limits** without a
  deliberate decision. The costing formulas are mirrored between `costing.js` and `server.py` and
  must not drift. **If `test:costing` fails, the change is wrong — revert it.**
- **Never anchor a replacement range on what *follows* the target.** Anchor on what is being
  replaced. In code a bad boundary usually breaks the build; **in prose it is silent**, so documents
  need *more* care than code, not less. This has happened three times here — the prose instance ate
  two defect entries and went unnoticed for eleven commits.
- **Do not propose breaking up or re-splitting files unprompted**, and do not "fix" anything in §5
  of `post-split-state.md` — those omissions are deliberate.
- **One concern per commit.** Structural moves and behaviour changes never share a commit.

## 5. Open item — the backend has no `CLAUDE.md`

Moving `CLAUDE.md` into `quote-gen-fe/` left **`quote-gen-be` and the shared parent with none**.
Working in the backend, no conventions file loads — including the guardrail that `server.py` mirrors
the costing formulas. **Unresolved, and not to be resolved silently:** `quote-gen-be` is a separate
repo, and the likely shape (a short backend `CLAUDE.md` pointing at this one) is a call for whoever
picks up the backend.

## 6. Deployment — the failure mode that will waste your time

`quote-gen-be/.env` is gitignored and **never reaches Vercel**. The deployed backend reads
`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_SECRET_KEY` (Production-only) from the
Vercel project, and new variables need a redeploy.

```bash
curl -s https://quote-gen-be.vercel.app/health
```

`"supabase": false` means **configuration, not credentials.** `/auth/login` used to report a missing
config as *"Invalid email or password"*, which sends you into the user record while the account is
perfectly fine. Fixed in `b93dee7`; the general rule is in §8 of `post-split-state.md` — never let
one `try` span both *can I reach the service* and *are these credentials valid*.

**When a login fails, check `/health` before touching the user record.**
