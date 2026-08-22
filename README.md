# CFB Quotation Master — Frontend

React + Vite frontend for the CFB Quotation Operating System (APSPL, CFB Division).

Backend repo: https://github.com/nik-avadhoot/quote-gen-be

## Structure

```
├── src/
│   ├── QuotationApp.jsx     # Main application component
│   ├── data/defaults.js     # Master data constants (rates, freight, partitions)
│   └── engine/costing.js    # Pure-JS costing engine
├── index.html
├── vite.config.js
└── package.json
```

## Local development

```bash
npm install
npm run dev                 # → http://localhost:5173
```

With no `VITE_API_BASE` set, the app calls the backend at `http://localhost:3001`.
Run the backend repo alongside it for full-fidelity Excel export.

## Environment

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_BASE` | Optional | Base URL of the export backend, no trailing slash. Set to `https://quote-gen-be.vercel.app` in the committed `.env.production`, so production builds need no dashboard configuration. Falls back to `http://localhost:3001` for `npm run dev`. |

Vite inlines this at **build time** — changing it requires a redeploy, not just
a restart. A `VITE_API_BASE` set in the Vercel dashboard overrides
`.env.production`.

## Deploying to Vercel

Import this repo — Vite is detected automatically (build `npm run build`, output
`dist`), and the backend URL comes from `.env.production`. No environment
variables needed for a standard deploy.

The backend already allows this app's production domain. If you deploy to a
different domain, or test from a preview URL (each gets its own unique
`*.vercel.app` domain), add it to `CORS_ORIGINS` on the backend or the browser
will block the export request.

## Data & state

There is no database. All state lives in the browser's `localStorage` under
`cbb_*` keys — rates, freight matrix, quote items, box trim, partitions, maker
name and batch profile — seeded from the defaults in `src/data/defaults.js`.
Use the in-app backup action to export all keys as a single JSON file.

Excel export posts to the backend for full openpyxl formatting, and falls back
to client-side `xlsx-js-style` generation if the backend is unreachable.
