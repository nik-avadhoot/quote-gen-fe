# U2 Plant Construction Adoption — read-only increment

Date: 2026-09-17  
Status: landed and locally verified  
Implementation: `2de4c15 feat(masters): show plant construction adoption matrix`

## Outcome

The governed Construction surface now has two views: the existing Construction Library and a
read-only Plant Construction Adoption matrix. The sidebar's former pending entry opens the matrix on
the same surface.

The matrix shows only approved versions of published Constructions. Columns are limited to Producing
Plants where the resolved caller profile explicitly holds `plant_access`, matching the database RLS
predicate on `plant_construction_adoptions`. Each visible cell is one of `Adopted`, `Withdrawn`,
`Not adopted`, or `Unavailable`.

`Not adopted` is used only when the optional adoption read succeeded. If that read failed,
`adoptions_partial` makes every cell `Unavailable`; a failed read is never presented as an absence.
Plant identity comes from the existing governed `/masters/plants` read. If it fails, the matrix is
unavailable while the Construction Library remains readable.

## Deliberate boundary

This increment adds no mutation. It does not propose, approve, adopt or withdraw a Construction and
does not alter any schema, RLS policy, RPC, migration, Batch selection rule or S9 state. The existing
caller-token routes remain the only data sources:

- `GET /masters/constructions` for Constructions, exact versions and caller-visible adoption rows;
- `GET /masters/plants` for Producing Plant identity.

Authorised adoption proposal, approval and withdrawal remain later U2 work. Authenticated-live and
Product Owner validation are also still outstanding.

## Files

- `src/tabs/ConstructionLibraryScreen.jsx` — shared Library/Adoption surface and matrix.
- `src/lib/constructionAdoptionModel.js` — plant-scope and honest-state projection.
- `src/lib/constructionAdoptionFixture.js` — permanently labelled developer-only illustration.
- `src/ui/Sidebar.jsx`, `src/ui/TopBar.jsx`, `src/QuotationApp.jsx` — navigation to the same surface.
- `src/App.jsx`, `src/LoginScreen.jsx` — development-only preview entry.
- `scripts/construction-adoption-fixtures.mjs` — focused gate.

## Verification

- `npm run test:construction-adoption`: **10 passed, 0 failed**.
- `npm run test:sku-master`: **126 passed, 0 failed**.
- `npm run test:pricing-basis`: **98 passed, 0 failed** (includes canonical navigation checks).
- targeted ESLint over the changed frontend files: exit 0.
- `npm run test:module-contract`: exit 0.
- backend `tests/test_constructions_route.py` under `venv`: **38 passed, 0 failed**.
- backend Amendment 04 evidence rechecked: SKU route **195 passed, 0 failed** and static governed-
  operations contract **85 passed, 0 failed**.

Browser evidence is a developer fixture, not authenticated-live evidence. At
`?fixture=u2-constructions`, the page was visibly and permanently labelled `U2 · FIXTURE ONLY`, the
Plant Construction Adoption tab rendered NAG and PUN only, and two versions exercised Adopted,
Withdrawn and Not adopted. Switching to Construction Library and back retained both views. Fixture
mode short-circuits before both API reads and exposes no write control.
