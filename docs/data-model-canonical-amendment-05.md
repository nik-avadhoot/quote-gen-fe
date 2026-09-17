# Canonical Amendment 05 — SKU master Location applicability

Date: 2026-09-17
Authority: Product Owner approval of the seven-point U2 decision bundle

SKU Master owns `master` Location applicability only. Due authority is
`manage_sku_master` at the SKU's own plant; the same authorised person may propose and approve.
A Maker holding only `make_quote` cannot publish it.

The permanent lifecycle is Proposed → Approved → Withdrawn, with Withdrawn → Approved reactivating
the same row. Withdrawal and reactivation require reasons; rows are never deleted. SKU, plant,
Customer, Location and scope are immutable. Every operation is caller-token governed, compare-and-
swap protected and recorded in `sku_master_events`; actor and timestamps come from the database and
direct authenticated INSERT/UPDATE is closed.

Proposal, approval and reactivation require a currently active Location belonging to the SKU's
Customer. Later Location deactivation does not rewrite history; an inactive Location is refused at
selection until the applicability is withdrawn or the Location is restored.

`batch_only` is not master publication. No SKU Master control writes it. Existing rows remain
readable and are not reinterpreted. Any future quote exception must first gain an exact Batch,
Batch-row, Quote or Quote-revision binding in a separate Family F/G increment.

Implementation is prepared locally as an unapplied migration, caller-token routes and activation-
gated controls. This amendment does not authorise applying a remote migration or exercising a live
mutation.
