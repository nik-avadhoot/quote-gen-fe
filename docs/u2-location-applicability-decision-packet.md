# U2 SKU Location applicability — decision packet

Date: 2026-09-17  
Status: **Accepted by Product Owner on 2026-09-17**; canonicalised as Amendment 05 / CDM-47

## Outcome needed

Canonical Amendment 04 deliberately deferred Location applicability to slice 3. The read-only SKU
detail already shows the recorded rows. Before a write surface is added, this packet asks for one
coherent lifecycle ruling so the database, route and UI can be implemented together.

## What exists today

`sku_location_applicabilities` already binds a SKU and Location to the same Customer through
composite foreign keys and carries the SKU's plant on every row. It records:

- `scope`: `master` or `batch_only`;
- `status`: `proposed`, `approved` or `withdrawn`;
- creator and optional approver attribution;
- one row per SKU, Location and scope.

Caller reads are plant-scoped. The historical RLS shape lets `manage_sku_master` insert or update a
row and lets a Maker insert a Proposed `batch_only` row. Amendment 04 slice 1 deliberately left this
table outside its governed operations.

That is not yet a safe slice-3 write contract:

- there is no `content_version`, so Amendment 04 D-08 compare-and-swap cannot be applied;
- writes do not append the D-09 SKU Master history;
- direct table INSERT/UPDATE remains open instead of D-10 governed operations;
- no trigger makes SKU, plant, Customer, Location and scope immutable after creation;
- withdrawal/reactivation reasons are not recorded;
- most importantly, `batch_only` has no Batch, Batch row, Quote family or Quote revision foreign key.
  Its label says quote-specific, but the row cannot identify the quote it is supposed to authorise.

The application currently reads these rows only. It exposes no Location-applicability mutation.

## Recommended ruling bundle

Accept the following as the slice-3 contract:

1. **SKU Master owns published `master` applicability only.** `batch_only` is a Quote exception and
   does not get a SKU Master control.
2. **Due authority is `manage_sku_master` at the SKU's own plant.** Consistent with Amendment 04
   D-01, the same authorised person may propose and approve; a Maker holding only `make_quote`
   cannot publish master applicability.
3. **Lifecycle is explicit and retained:** Proposed → Approved → Withdrawn, with Withdrawn →
   Approved as reactivation of the same permanent row. Withdrawal and reactivation require a
   reason. Rows are never deleted.
4. **Binding is immutable:** SKU, plant, Customer, Location and scope never change on an existing
   row. The existing composite foreign keys continue to prevent another Customer's Location.
5. **Every operation is governed:** add an applicability `content_version`; every operation takes
   the expected token; stale writes return the established conflict; actor and timestamps are
   derived in the database; each change appends `sku_master_events`; direct authenticated INSERT and
   UPDATE are revoked.
6. **Target eligibility is checked at the operation boundary:** proposal and approval require a
   currently active Location belonging to the SKU's Customer. A later Location-status change does
   not rewrite history silently; selection refuses the inactive Location until applicability is
   deliberately withdrawn or the Location is restored.
7. **Quote-specific applicability is a separate Family F/G slice.** Before any new `batch_only`
   write is exposed, replace or supplement the unbound row with an exact Batch/Batch-row or Quote
   reference and keep Checker quotation approval distinct from master publication. Existing
   `batch_only` rows remain readable and are not reinterpreted automatically.

## Smallest implementation after acceptance

1. A prepared, unapplied backend migration that introduces the token, immutable binding, governed
   functions, direct-write closure and pgTAP/static contracts for **master** applicability only.
2. Caller-token Flask routes with the established stable error mapping.
3. SKU detail controls for propose, approve, withdraw and reactivate, visibly capability-gated and
   fixture-disabled until schema activation.
4. Focused backend/frontend gates and labelled fixture-browser proof. No remote migration or live
   mutation is part of that implementation increment without separate authority.

## Product Owner decision

Approved without change on 2026-09-17. The prepared implementation remains activation-gated; no
remote migration or live mutation was authorised by this ruling.
