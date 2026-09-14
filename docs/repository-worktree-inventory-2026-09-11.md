# Repository worktree inventory — 2026-09-11

This is a preservation inventory, not a staging manifest. No file listed here was staged, committed,
pushed, deployed, or deleted. Ownership means the safest current treatment, not authorship history.

## Protected user-owned files

- `quote-gen-fe/src/tabs/batch/BatchProfileBar.jsx` — modified, user-owned. Preserved hunk hash:
  `8ad1c24106bc94fffbc25426c88d010de2877a5d69fdc5062fa962e3a46e0f3b`.
- `quote-gen-fe/docs/commercial-intelligence-decisions.md` — untracked, user-owned and prohibited
  from inspection or modification. Its contents were not read.
- `quote-gen-fe/.env.local` — user-owned and not present in Git status. It was not read or changed.

## Current S7-R reconciliation and correction

Backend, untracked unless noted:

- `quote-gen-be/scripts/bundle-engine.mjs`
- `quote-gen-be/scripts/executor-fixtures.mjs`
- `quote-gen-be/supabase/functions/calculate-batch-row/executor.mjs`
- `quote-gen-be/supabase/functions/calculate-batch-row/index.ts`
- `quote-gen-be/supabase/functions/calculate-batch-row/_engine/engine/calcDefaults.js`
- `quote-gen-be/supabase/functions/calculate-batch-row/_engine/engine/costing.js`
- `quote-gen-be/supabase/functions/calculate-batch-row/_engine/engine/costingTables.js`
- `quote-gen-be/supabase/functions/calculate-batch-row/_engine/engine/interestBasis.js`
- `quote-gen-be/supabase/functions/calculate-batch-row/_engine/engine/resolveAuthority.js`
- `quote-gen-be/supabase/functions/calculate-batch-row/_engine/manifest.js`
- `quote-gen-be/supabase/functions/calculate-batch-row/_engine/package.json`
- `quote-gen-be/supabase/migrations/20260911070000_s7r_14_effective_material_rate_boundary.sql`
- `quote-gen-be/supabase/migrations/20260911071000_s7r_15_effective_material_rate_gates.sql`

Frontend:

- `quote-gen-fe/scripts/case4-reference.mjs` — modified
- `quote-gen-fe/scripts/costing-fixtures.mjs` — modified
- `quote-gen-fe/scripts/resolver-fixtures.mjs` — modified
- `quote-gen-fe/src/data/defaults.js` — modified
- `quote-gen-fe/src/engine/calcDefaults.js` — modified
- `quote-gen-fe/src/engine/costing.js` — modified
- `quote-gen-fe/src/engine/resolveAuthority.js` — modified
- `quote-gen-fe/src/export/excel.js` — modified
- `quote-gen-fe/src/export/importExcel.js` — modified
- `quote-gen-fe/src/state/useCostingResult.js` — modified
- `quote-gen-fe/src/state/useQuoteActions.js` — modified
- `quote-gen-fe/src/tabs/RateMasterTab.jsx` — modified
- `quote-gen-fe/src/engine/costingTables.js` — untracked
- `quote-gen-fe/src/engine/rateMaster.js` — untracked

S7-R records already present and retained as user/project work:

- `quote-gen-fe/docs/data-model-s7r-attestation-contract-correction.md` — untracked
- `quote-gen-fe/docs/data-model-s7r-authorization-boundary.md` — untracked
- `quote-gen-fe/docs/data-model-s7r-trusted-execution-reconciliation.md` — untracked

## Existing local S7-R migration set reconciled against the live ledger

These 20 files were present locally before the final correction. The live migration ledger contains
the same migration versions and names through `s7r_13`; this inventory does not claim a fresh
byte-for-byte body comparison.

- `quote-gen-be/supabase/migrations/20260910142301_s7r_1_attestation_keyring.sql`
- `quote-gen-be/supabase/migrations/20260910142426_s7r_2_fingerprint_encoders_and_serializer.sql`
- `quote-gen-be/supabase/migrations/20260910142458_s7r_2a_fix_serializer_multiarg_unnest.sql`
- `quote-gen-be/supabase/migrations/20260910142604_s7r_3_durable_state_resolvers.sql`
- `quote-gen-be/supabase/migrations/20260910142741_s7r_4_qcf1_and_qpf1_gatherers.sql`
- `quote-gen-be/supabase/migrations/20260910142835_s7r_5_qca1_attestation_verifier.sql`
- `quote-gen-be/supabase/migrations/20260910143057_s7r_6_inheritance_resolvers.sql`
- `quote-gen-be/supabase/migrations/20260910143234_s7r_7_eligibility_effective_inputs_and_gatherer.sql`
- `quote-gen-be/supabase/migrations/20260910143344_s7r_8_calculate_batch_row_writer.sql`
- `quote-gen-be/supabase/migrations/20260910143459_s7r_8a_fix_entry_point_execute_grants.sql`
- `quote-gen-be/supabase/migrations/20260910143654_s7r_8b_fix_coalesce_is_a_sql_construct.sql`
- `quote-gen-be/supabase/migrations/20260910143806_s7r_8c_fix_hmac_lives_in_extensions.sql`
- `quote-gen-be/supabase/migrations/20260910155828_s7r_9_calculation_writer_tests.sql`
- `quote-gen-be/supabase/migrations/20260910155855_s7r_9a_fix_sku_transition_must_pass_through_active.sql`
- `quote-gen-be/supabase/migrations/20260910160244_s7r_9b_hoist_signing_out_of_authenticated_blocks.sql`
- `quote-gen-be/supabase/migrations/20260910160319_s7r_9c_fix_freight_entry_written_while_version_draft.sql`
- `quote-gen-be/supabase/migrations/20260910160346_s7r_10_register_calculation_writer_suite.sql`
- `quote-gen-be/supabase/migrations/20260910160430_s7r_11_invert_s9p_cp80_boundary_gate.sql`
- `quote-gen-be/supabase/migrations/20260911050251_s7r_12_supplier_credit_stays_in_rate_master.sql`
- `quote-gen-be/supabase/migrations/20260911050635_s7r_13_rate_master_separation_gates.sql`

## S9(b) and S9(c) current increment

- `quote-gen-be/supabase/migrations/20260911080000_s9b_atomic_send.sql` — untracked
- `quote-gen-be/supabase/migrations/20260911081000_s9b_atomic_send_gates.sql` — untracked
- `quote-gen-be/supabase/migrations/20260911090000_s9c_quote_workflow.sql` — untracked
- `quote-gen-be/supabase/migrations/20260911091000_s9c_quote_workflow_gates.sql` — untracked
- `quote-gen-fe/docs/data-model-s9b-authorization-packet.md` — untracked; revised only for the
  final S7-R effective-rate boundary and settled D-E/D-F/D-G outcomes
- `quote-gen-fe/docs/s9-technical-closure-and-u3-u6-handoff.md` — untracked; current closure record
- `quote-gen-fe/docs/repository-worktree-inventory-2026-09-11.md` — untracked; this inventory

## Earlier S9(a) and S9-P local files

All are untracked locally and all corresponding versions/names are present in the live ledger.

S9(a):

- `quote-gen-be/supabase/migrations/20260909105454_s9_1_family_g_quote_schema.sql`
- `quote-gen-be/supabase/migrations/20260909110355_s9_1_family_g_quote_schema_tests.sql`
- `quote-gen-be/supabase/migrations/20260909110640_s9_1_revoke_execute_on_quote_schema_suite.sql`
- `quote-gen-be/supabase/migrations/20260909111509_s9_1_fix_snapshot_freight_reference_integrity.sql`
- `quote-gen-be/supabase/migrations/20260909111611_s9_1_snapshot_freight_reference_integrity_tests.sql`

S9-P:

- `quote-gen-be/supabase/migrations/20260910033547_s9p_1_row_addons_and_fluting_bcf.sql`
- `quote-gen-be/supabase/migrations/20260910033606_s9p_2_calculation_defaults_fluting_bcf.sql`
- `quote-gen-be/supabase/migrations/20260910033631_s9p_3_batch_pricing_basis.sql`
- `quote-gen-be/supabase/migrations/20260910033657_s9p_4_pricing_group_temporary_freight.sql`
- `quote-gen-be/supabase/migrations/20260910033733_s9p_5_create_batch_pricing_basis_init.sql`
- `quote-gen-be/supabase/migrations/20260910033811_s9p_6_set_batch_pricing_basis.sql`
- `quote-gen-be/supabase/migrations/20260910034505_s9p_7_calculation_persistence_tests.sql`
- `quote-gen-be/supabase/migrations/20260910034533_s9p_8_register_calculation_persistence_suite.sql`
- `quote-gen-be/supabase/migrations/20260910034825_s9p_7a_fix_approver_needs_group_read_to_approve_components.sql`
- `quote-gen-be/supabase/migrations/20260910034910_s9p_6a_fix_set_batch_pricing_basis_execute_grant.sql`
- `quote-gen-be/supabase/migrations/20260910035820_s9p_7b_suite_tears_down_its_own_fixtures.sql`
- `quote-gen-be/supabase/migrations/20260910035905_s9p_7c_calculation_persistence_is_self_contained.sql`
- `quote-gen-be/supabase/migrations/20260910035952_s9p_3a_fix_composite_fk_index_coverage.sql`
- `quote-gen-be/supabase/migrations/20260910084955_s9p_9_revoke_batch_write_authority.sql`
- `quote-gen-be/supabase/migrations/20260910085025_s9p_10_drop_pricing_date_server_default.sql`
- `quote-gen-be/supabase/migrations/20260910085122_s9p_11a_batch_sets_fixture_supplies_plant_local_pricing_date.sql`
- `quote-gen-be/supabase/migrations/20260910085343_s9p_11b_batch_workspace_fixture_supplies_plant_local_pricing_date.sql`
- `quote-gen-be/supabase/migrations/20260910090154_s9p_12_authority_correction_gates.sql`
- `quote-gen-be/supabase/migrations/20260910101030_s9p_13_cp96b_proves_effective_column_authority.sql`
- `quote-gen-fe/docs/data-model-s9p-persistence-authorization-packet.md` — untracked

## Preserved user-owned and earlier-tranche work outside this increment

Backend:

- `quote-gen-be/auth.py` — modified; authenticated-request reliability/U1 lane
- `quote-gen-be/caller_context.py` — modified; authenticated-request reliability/U1 lane
- `quote-gen-be/server.py` — modified; authenticated-request reliability and route lane
- `quote-gen-be/tests/test_customer_families_route.py` — modified; U1 route lane
- `quote-gen-be/tests/test_auth_transport_bound.py` — untracked; authenticated-request lane
- `quote-gen-be/tests/test_constructions_route.py` — untracked; U2 Construction Library lane

Frontend:

- `quote-gen-fe/.env.example` — modified; environment/auth configuration lane
- `quote-gen-fe/docs/u1-users-access-authorization-packet.md` — modified; U1 record
- `quote-gen-fe/package.json` — modified; mixed project test/script registration, preserved
- `quote-gen-fe/scripts/capabilities-fixtures.mjs` — modified; U1 capability lane
- `quote-gen-fe/scripts/customer-family-actions-fixtures.mjs` — modified; U1 customer-family lane
- `quote-gen-fe/src/QuotationApp.jsx` — modified; application shell/U2 lane
- `quote-gen-fe/src/lib/capabilities.js` — modified; U1 capability lane
- `quote-gen-fe/src/lib/customerFamilyActions.js` — modified; U1 customer-family lane
- `quote-gen-fe/src/lib/featureFlags.js` — modified; application shell/U2 lane
- `quote-gen-fe/src/state/useBatchState.js` — modified; existing Batch/S9-P lane
- `quote-gen-fe/src/state/useCostingDraft.js` — modified; existing costing UI lane
- `quote-gen-fe/src/tabs/CustomerFamiliesScreen.jsx` — modified; U1 lane
- `quote-gen-fe/src/tabs/ProducingPlantsScreen.jsx` — modified; U1 lane
- `quote-gen-fe/src/tabs/UserManagementTab.jsx` — modified; U1 lane
- `quote-gen-fe/src/tabs/costing/OutputPanel.jsx` — modified; S8/costing UI lane
- `quote-gen-fe/src/tabs/costing/SpecForm.jsx` — modified; S8/costing UI lane
- `quote-gen-fe/src/ui/Sidebar.jsx` — modified; application shell/U2 lane
- `quote-gen-fe/src/tabs/ConstructionLibraryScreen.jsx` — untracked; U2 lane
- `quote-gen-fe/docs/data-model-s8-closure-evidence.md` — untracked; S8 record
- `quote-gen-fe/docs/u1-external-references-and-plant-assignments-closure.md` — untracked; U1 record

## Authorized cleanup result

`quote-gen-be/supabase/functions/calculate-batch-row/_engine/data/defaults.js` was re-verified as
outside `_engine/manifest.js` and the executor import closure, then deleted under the Product Owner's
2026-09-11 narrow cleanup authorization. A post-deletion CP-108 run confirms the governed five-file
bundle is complete and remains regenerable from the frontend engine sources.

No other file was deleted. The remaining untracked files are implementation, test, migration, or
project-record inputs and must be preserved.
