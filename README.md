# CFB Quotation Master — frontend

React 19 + Vite frontend for the CFB Quotation Operating System. The companion Flask/Supabase
repository is [`../quote-gen-be`](../quote-gen-be).

For project status and authority, start with [`docs/README.md`](docs/README.md). In particular,
[`docs/current-state.md`](docs/current-state.md) records the incomplete S9 activation boundary.

## Local development

```powershell
npm install
npm run dev
```

The Vite app normally runs at `http://localhost:5173`. Run the backend on port 3001 for authenticated
governed reads/mutations and server-side Excel export.

## Environment

| Variable | Purpose |
|---|---|
| `VITE_API_BASE` | Backend base URL. The development fallback is `http://localhost:3001`; Vite reads it at build time. |
| `VITE_FEATURE_FLAGS` | Comma-separated feature destinations. Development also has a narrow in-code default floor; inspect `src/lib/featureFlags.js` before changing rollout behavior. |

Do not put secret or service-role values in a `VITE_*` variable; Vite exposes them to the browser.
Local environment files are user-owned and must not be inspected or changed during unrelated work.

## Architecture

- `src/AuthContext.jsx` and `src/lib/apiClient.js`: authenticated frontend session and backend
  transport.
- `src/QuotationApp.jsx`: thin application shell and routed tab composition.
- `src/state/`: composed state slices. Composition order in `AppStateProvider.jsx` is significant.
- `src/tabs/`: costing, Batch, Quote, master-data, Pricing Basis, and administration screens.
- `src/engine/`: pure costing and authority-resolution modules.
- `src/lib/`: API actions, capability checks, governed Batch/Quote models, feature flags, and the
  single local-persistence seam.
- `src/export/`: PDF, client-side workbook fallback, and server-template export integration.

The application is transitional: legacy `cbb_*` state still uses browser storage, while newer
governed screens use the authenticated backend and Supabase. A browser backup is therefore not a
complete backup of governed database records.

## S9 status

Local S9 implementation, migrations, and recorded automated database verification exist. The
production attestation secret and Edge Function are not activated, and the real authenticated
Calculate/Send/workflow, runtime authorization, persistent, browser, and Product Owner journeys are
not verified. S9 is not technically or Product Owner closed. Keep the S9 records and backend
artifacts active.

## Checks

Use `npm run` to list the current fixture commands, then choose checks that exercise the affected
behavior. Common examples:

```powershell
npm run build
npm run test:module-contract
npm run test:costing
npm run test:resolver
npm run test:governed-calculate-send
npm run lint
```

Run whole-repository lint only when its scope is useful; targeted lint is acceptable for a focused
increment. Never run Prettier or `eslint --fix` across this repository.

## Guardrails

- Costing behavior is mirrored with backend export/runtime behavior; review both sides when changing
  formulas or inputs.
- Blank, zero, and unresolved values are distinct.
- Capability checks, tenant/plant boundaries, immutable Quote history, and applied migrations are
  protected authority boundaries.
- Presence of a screen, route, fixture, or migration does not by itself prove deployment, browser
  verification, or Product Owner acceptance.
