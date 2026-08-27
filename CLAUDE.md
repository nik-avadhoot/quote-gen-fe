# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

CFB Quotation Operating System (APSPL, CFB Division) — an internal tool that replaces manual
Excel-based costing for corrugated fibre board packaging. A costing Maker enters box/carton specs,
the app calculates a fully-loaded quote rate, and exports it as a client-facing PDF and/or a
formatted Excel workbook (via a master template).

Two independently-versioned repos live side by side here, each with its own `.git`:

```
quote-gen-fe/   React + Vite frontend  → https://github.com/nik-avadhoot/quote-gen-fe
quote-gen-be/   Flask export backend   → https://github.com/nik-avadhoot/quote-gen-be
```

**Database: Supabase** (project `czettlukuenlnnrmvhqt`), accessible via the Supabase MCP server.
This is the project's DB going forward, but the split isn't decided yet — what moves into Supabase
vs. what stays in `localStorage` is a per-feature call to be made as we go, not a wholesale
migration. **As of 2026-08-25 the Supabase project has one table: `public.profiles`** — app-level
user identity (role, display name, plant, active flag), 1:1 with `auth.users.id`, RLS enabled, all
writes going through the backend's service-role client. Auth is therefore the first feature to have
actually moved off `localStorage`; the backend is no longer stateless. All *quote/master-data* state
still lives in the browser's `localStorage` (`cbb_*` keys), and the export path is unchanged — fill
`CFB_Quotation_Master_v7.xlsx` with posted JSON and return the workbook. `quote-gen-be/schema.sql` was a forward-looking design doc for this eventual DB; revisit
it now that Supabase is actually in play rather than treating it as purely aspirational.

For the full (very detailed) design doc — business-logic tables, architectural decisions,
tab-by-tab behavior spec — see [`quote-gen-be/docs/CFB_QOS_Project_Brief_v3.md`](../quote-gen-be/docs/CFB_QOS_Project_Brief_v3.md).
Treat it as authoritative for anything not covered below.

## Commands

Run both together during development (frontend expects the backend at `localhost:3001`):

```bash
# Terminal 1 — backend
cd quote-gen-be
python -m venv venv && venv\Scripts\activate.bat
pip install -r requirements.txt
python server.py            # → http://localhost:3001

# Terminal 2 — frontend
cd quote-gen-fe
npm install
npm run dev                 # → http://localhost:5173
```

Frontend:
```bash
npm run build      # vite build
npm run lint        # eslint .
npm run preview     # preview a production build
```

Gates (frontend, run from `quote-gen-fe`):
```bash
npm run test:costing   # engine regression harness vs scripts/costing-golden.json
npm run ref:case4      # derive negative Case 4's reference pair - never transcribe it
```

There is no UI or integration test suite in either repo — `test:costing` covers `engine/costing.js`
only and **cannot see the bridge/UI guards**. There is no backend lint/format command configured.

Backend health check: `GET http://localhost:3001/health` → `{ ok, template, path }`; `template`
must be `true` (confirms `CFB_Quotation_Master_v7.xlsx` is found beside `server.py`).

## Architecture

**Frontend** (`quote-gen-fe/src/`):
> ⚠️ **The monolith is GONE.** `QuotationApp.jsx` was split into components across Phases 0–8 on
> `refactor/component-split`. Two statements that stood here for the whole life of this file — that
> all state is `useState` with no Context, and that the file must not be broken apart — are now
> **false and inverted**. Do not act on either; the split is done and it is the architecture.
> **Start with [`docs/post-split-state.md`](docs/post-split-state.md)** — final architecture, the
> store's composition order and why it is load-bearing, the defect register D-1–D-18 with beta
> blockers marked, the standing rules, and what was deliberately *not* done. The exhaustive record,
> every decision and its reasoning, is [`docs/component-split-plan.md`](docs/component-split-plan.md).

- `QuotationApp.jsx` (**84 lines**) — a thin shell. It mounts `AppStateProvider`, renders
  `<Sidebar/>` and `<TopBar/>`, switches on `tab`, and holds the autosave banner, `<ToastStack/>`
  and two modals. Nothing else. **All state lives in `src/state/`, not here.**
- `state/` — the store: **one** `AppStateProvider` composed from domain-sliced hooks, exposed by a
  single `useAppState()`. **Composition order in `AppStateProvider.jsx` is load-bearing** — each
  hook destructures the accumulator on entry, so a slice cannot see anything composed below it, and
  reordering silently breaks cross-slice handlers. Read that file's header before touching it.
- `state/useCostingBatchBridge.js` — **the most consequential file in the app.** It holds the
  Costing↔Batch bridge: the two-context hard gate, the G1 identity-first guards, SET Code
  confirmation, `startNewBatch` and `copyCostingToProfile`. These were kept in one module on purpose
  — splitting them across slices is exactly how the guards get silently broken.
- `tabs/` — one file per tab; `tabs/costing/` and `tabs/batch/` are further split by panel.
  Components take **no props for shared state** — they call `useAppState()` directly.
- `ui/` — `Sidebar.jsx` (owns `NAV_ITEMS`), `TopBar.jsx`, `primitives.jsx`, `styles.js`.
- `engine/costing.js` — the costing engine. Pure JS, zero React dependency, meant to be reusable
  outside the browser. Key exports: `calcCosting`, `checkSpecCompliance`, `suggestMargin`,
  `checkMissingInfo`, `getEffectiveRate`, `buildSpecFromRow`.
- `data/defaults.js` — all `DEFAULT_*` master data constants (rates, freight matrix, sectors, box
  trim table, partitions master) and `INIT_SPEC`. Pure data, no side effects.

**Backend** (`quote-gen-be/server.py`): single-file Flask app, two routes (`/health`, `/export`).
`/export` opens `CFB_Quotation_Master_v7.xlsx` with openpyxl, writes rates/freight/quote rows into
specific named sheets/cells (`CBB+PP`, `RATE MASTER`, `DEFAULTS`), and streams the filled workbook
back. Cell addressing is hard-coded to the v7 template's layout — changing the template requires
updating the corresponding cell refs in `server.py`. `schema.sql` is a forward-looking design
document only; nothing reads or writes it yet.

**App tabs** (`tab` state in `state/useUiState.js`, switched in `QuotationApp.jsx`): Costing · Quote Items · Batch Entry ·
Construction Library · Rate Master · Freight Rates · Defaults. Roles: Maker (input + export) ·
Checker (+ review) · Admin (+ edit masters) — enforced only in the UI, not a real auth layer.

**Data flow for a quote:** Batch Entry (bulk SKU grid, the *only* route to finalize items) →
Calculate All → Send All to Quote Items → export (PDF client-side, or Excel via the backend with a
client-side `xlsx-js-style` fallback if the backend is unreachable/times out). The Costing tab is
an analysis/scratchpad workspace only — it does not add items to Quote Items directly.

## Core business logic (do not alter without understanding why)

These formulas are load-bearing and mirrored in both `engine/costing.js` and `server.py` — see the
project brief §3 for the authoritative table. Highlights:

- **Effective Paper Rate** = `Price + Price×Credit% - Discount + Freight` (Rate Master level); a
  GSM surcharge (+4 if <100gsm, +1.5 if =100gsm, +1 if >200gsm) is added per layer during costing
  only, never baked into the Rate Master.
- **Interest** is charged on `Mat + Conv + Add-ons` only — **excludes Freight**.
- **Total Cost** = `Mat + Conv + Add-ons + Interest + Freight` (a landed rate); **Final Rate** =
  `MROUND(Total × (1 + Margin%), 0.05)`.
- **35 BF** stock is always calculated as 33 BF (`bfNum` in `costing.js`).
- **PP row type** (Plate/Part-L/Part-W) uses a flat-piece deckle formula with trim=0, and its own
  waste%/conversion-rate pair (`wastePP`/`convRatePP`, default 12.5) — never fall back to `||`
  against these, since a legitimate value of `0` must be preserved (several sectors set them to 0).
- **SET concept**: an RSC box + its liner plates + partitions are quoted as one combined rate,
  linked by `setCode`. Non-Box rows inherit `setCode` from the nearest preceding *confirmed* Box
  row. An unconfirmed (`setCodeAssumed===true`) SET Code blocks auto-dims, Calculate All, Deep
  Dive, and Send-to-Quote-Items until confirmed — this is a deliberate anti-silent-mis-attribution
  gate, not a bug.

## Frontend coding conventions

- **Inline styles only** — no CSS files (besides `index.css` reset), no Tailwind, no className
  based styling. Color constants: `C.amber`, `C.slateM`, `C.slateL`, `C.white`, `C.cream`,
  `C.border`, `C.green`, `C.red`, `C.amberL`, `C.amberD`. Fonts: `mono` (numbers/codes), `sans` (UI
  text).
- **Hooks only at the top level of a component or a `state/` hook** — never inside `.map()`, IIFEs,
  conditionals, or callbacks; this has caused blank-screen crashes before.
- **`tabs/batch/BatchGrid.jsx` is deliberately one ~700-line file.** Its frozen-column cumulative
  `left:` offsets, its `<Fragment key={row.id}>` rows, its per-row `upd`/`updC`, its expanded-row
  IIFE, and the toolbar IIFE that returns an array and chains `.map()` **inside itself** are all
  load-bearing. Never reflow it, and never run Prettier or `eslint --fix` over this repo — there is
  an ASI-dependent statement in `export/excel.js` whose terminator sits inside a comment.
- Module-level functions (e.g. `exportFromTemplate`) cannot close over React state — they must
  receive it via parameters.
- **JSX/esbuild landmines** (project brief §5 has the full rationale): don't use `<>` fragments
  inside ternaries in table rows — use `{cond && <td>...}` / `{!cond && <td>...}` instead. If an
  IIFE inside JSX returns an array, chain `.map()` directly on it (`{(()=>{...return arr})().map(...)}`);
  splitting the call from the `.map()` renders raw JS objects as children and crashes React.
- Notifications go through `showToast(msg, type, duration)` with `type` ∈ `'success' | 'info' | 'error'`.
- Nomenclature is finalized — don't revert: `RS4` → **Box** (rowType), `Item Type` → **Set Role**,
  `Conv RS4` → **Conv Box**, `Constr` column → **Paper Construction**.

## Environment

| Var | Where | Purpose |
|---|---|---|
| `VITE_API_BASE` | frontend | Backend base URL, no trailing slash. Falls back to `http://localhost:3001`. Set at build time (`.env.production` already points at the deployed backend) — changing it needs a redeploy, not just a restart. |
| `CORS_ORIGINS` | backend | Comma-separated allowed browser origins. Defaults cover the production frontend + local Vite dev server. |
| `SUPABASE_URL` | backend (`quote-gen-be/.env`) | Supabase project API URL. |
| `SUPABASE_PUBLISHABLE_KEY` | backend (`quote-gen-be/.env`) | Anon/publishable key — RLS enforced. Used by `get_supabase()` in `supabase_client.py`. |
| `SUPABASE_SECRET_KEY` | backend (`quote-gen-be/.env`) | Service-role key — bypasses RLS. Used by `get_supabase_admin()`. Backend-only, never expose to the frontend. |
| `SUPABASE_JWKS_URL` | backend (`quote-gen-be/.env`) | JWKS endpoint for local Supabase Auth JWT verification. Read but not wired to any route yet. |

Deploys to Vercel: backend via `vercel.json` (`builds`/`routes`, not `rewrites` — a rewrite would
swap out the request path and break routing to `server.py`); frontend auto-detected as a Vite app.
Vercel Hobby caps function execution at 10s, which the frontend's client-side export fallback
exists to cover.
