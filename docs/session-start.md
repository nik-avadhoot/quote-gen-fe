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
the defect pass has taken it to **67/0** and that is the number to beat now, not 76. A fourth, for documents rather than code:

```bash
python scripts/audit-doc-sections.py
```

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
