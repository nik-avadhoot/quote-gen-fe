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
| `VITE_API_BASE` | Production | Base URL of the export backend, no trailing slash, e.g. `https://quote-gen-be.vercel.app`. Falls back to `http://localhost:3001`. |

Vite inlines this at **build time** — changing it requires a redeploy, not just
a restart. See `.env.example`.

## Deploying to Vercel

Import this repo — Vite is detected automatically (build `npm run build`, output
`dist`). Set `VITE_API_BASE` to the deployed backend URL before the first build,
then add this app's domain to the backend's `CORS_ORIGINS` and redeploy the backend.

## Data & state

There is no database. All state lives in the browser's `localStorage` under
`cbb_*` keys — rates, freight matrix, quote items, box trim, partitions, maker
name and batch profile — seeded from the defaults in `src/data/defaults.js`.
Use the in-app backup action to export all keys as a single JSON file.

Excel export posts to the backend for full openpyxl formatting, and falls back
to client-side `xlsx-js-style` generation if the backend is unreachable.
