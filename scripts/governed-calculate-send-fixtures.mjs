import fs from "node:fs";
import { durableBatchPreparation } from "../src/lib/batchRowModel.js";
import { governedBatchActionState } from "../src/lib/governedBatchActions.js";

let passes = 0;
const failures = [];
const check = (condition, label) => {
  if (condition) { passes += 1; console.log(`ok   - ${label}`); }
  else { failures.push(label); console.log(`FAIL - ${label}`); }
};

const batch = {
  id: 71, status: "working", caller_holds_lock: true,
  pricing_basis_release_id: 11, current_profile: { id: 21 },
  batch_rows: [{ id: 91, status: "active", pricing_group_id: 81,
    sku_id: 41, sku_version_id: 51, effective_construction: { version_id: 61 } }],
  pricing_groups: [{ id: 81, status: "active", freight_mode: "master",
    freight_basis_delivery_group_id: 101,
    delivery_groups: [{ id: 101, status: "active", bill_to_location_id: 201,
      ship_to_location_id: 202 }] }],
};

const preparation = durableBatchPreparation(batch, [], {}, {});
let state = governedBatchActionState(batch, preparation.structuralBlockers, {});
check(state.canCalculate && !state.canSend && state.unverifiedCount === 1,
  "U5-CS-FE-1 a structurally ready locked Batch can Calculate but cannot Send on unchecked evidence");

state = governedBatchActionState(batch, preparation.structuralBlockers, {
  91: { status: "ready", freshness: "not_calculated" },
});
check(!state.canSend && state.notCalculatedCount === 1,
  "U5-CS-FE-2 a resolved row with no persisted calculation blocks Atomic Send");

state = governedBatchActionState(batch, preparation.structuralBlockers, {
  91: { status: "ready", freshness: "calculation_stale" },
});
check(!state.canSend && state.staleCount === 1,
  "U5-CS-FE-3 a stale governed calculation blocks Atomic Send");

state = governedBatchActionState(batch, preparation.structuralBlockers, {
  91: { status: "ready", freshness: "needs_send_only" },
});
check(state.canSend && state.sendOnlyCount === 1,
  "U5-CS-FE-4 presentation-only divergence remains eligible for a fresh Atomic Send");

const unlocked = { ...batch, caller_holds_lock: false };
state = governedBatchActionState(unlocked, preparation.structuralBlockers, {
  91: { status: "ready", freshness: "fresh" },
});
check(!state.canCalculate && !state.canSend
  && state.sendBlockers.includes("Active Batch edit lock is required"),
  "U5-CS-FE-5 Calculate and Atomic Send never bypass the active edit lock");

const removedBasis = structuredClone(batch);
removedBasis.pricing_groups[0].delivery_groups[0].status = "removed";
const removedPreparation = durableBatchPreparation(removedBasis, [], {}, {});
state = governedBatchActionState(removedBasis, removedPreparation.structuralBlockers, {
  91: { status: "ready", freshness: "fresh" },
});
check(!state.canCalculate && !state.canSend
  && state.sendBlockers.some(item => item.includes("freight-basis route")),
  "U5-CS-FE-6 a removed selected master-freight route still blocks both governed actions");

const source = fs.readFileSync(new URL("../src/tabs/batch/BatchWorkspacePanel.jsx", import.meta.url), "utf8");
check(source.includes("/calculate")
  && source.includes("Atomic Send · create draft candidate")
  && source.includes("it does not submit or issue it to the customer"),
  "U5-CS-FE-7 the workspace exposes the settled Calculate → draft-candidate boundary");
check(source.includes("expected_content_version: batch.content_version")
  && source.includes("every active row"),
  "U5-CS-FE-8 Atomic Send carries the current Batch CAS token and readiness can be refreshed in bulk");
check(source.includes("setQuoteWorkspaceRequest")
  && source.includes('setQuoteView("history")')
  && source.includes('setTab("items")')
  && source.includes("Open immutable draft evidence"),
  "U5-CS-FE-9 successful Atomic Send can hand off the exact immutable revision to Quote History");

console.log(`\n${passes} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
console.log("U5 governed Calculate and Atomic Send frontend gate PASS");

