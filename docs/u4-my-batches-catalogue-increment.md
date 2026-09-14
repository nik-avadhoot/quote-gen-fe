# U4 — My Batches catalogue increment

## Outcome and boundary

This increment adds a caller-visible, read-only **My Batches** operational list and connects a selected
record to the existing durable Batch Builder. The list and reopen journey use only the authenticated
caller's token and existing RLS-governed Batch read surfaces. It does not create a Batch, acquire a
lock, calculate, send, submit or perform a Quote workflow transition. S9 activation and S10 remain
outside this increment.

The catalogue returns the newest 50 caller-visible Batches and exposes exact Batch, Customer Family,
Producing Plant, selected Sector, Pricing Basis Release, Pricing Date, selection mode, Batch status,
owner and content-version identities. Supporting-detail denials remain explicit partial results; no
hidden identity is inferred or replaced by fixture data.

## Scalability debt and concrete trigger

Search, Batch-status filtering and Producing-Plant filtering currently apply to the bounded records
already returned to the browser. The server reads 51 rows and returns at most 50 so the UI can state
when that displayed window is incomplete.

Implement cursor-based server pagination and server-side search/filtering before either of these
conditions is accepted as normal production use:

1. `GET /batches/catalogue` returns `results_limited: true` for any operational caller; or
2. a Product Owner requires finding a Batch outside the newest 50 caller-visible records.

Until then, the UI explicitly says that displayed-list search and filters cannot reach older records.

## Verification classification

- Implemented: yes, locally.
- Automated-test verified: yes; focused backend/frontend gates, U3/U4/U5 regressions, affected lint
  and the production build passed.
- Fixture-browser verified: yes; the explicitly labelled local fixture rendered the exact identities,
  partial disclosure and blocked actions, filtered to one status, produced a distinct no-match empty
  state, and selected a fixture Batch for the no-API/no-lock Batch Builder hand-off.
- Authenticated-live browser verified: deferred; no credentials or live session were supplied.
- Technically closed: yes, for this local read-only increment.
- Product Owner validated: deferred.
