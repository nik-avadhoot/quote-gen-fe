import fs from "node:fs";
import {
  governedBlockerTarget, governedReadinessCounts, governedReadinessFromResponse,
  staleGovernedReadiness,
} from "../src/lib/governedReadiness.js";
import { S3_GOVERNED_BATCH } from "../src/lib/s1BrowserFixture.js";

let passes = 0;
const failures = [];
const check = (condition, label) => {
  if (condition) { passes += 1; console.log(`ok   - ${label}`); }
  else { failures.push(label); console.log(`FAIL - ${label}`); }
};

const response = {
  batch_id: 71, batch_content_version: 14, mutation: "none", evaluated_at: "2026-09-24T10:00:00+05:30",
  rows: [
    { row_id: 351, status: "ready", freshness: "fresh", pricing_group_id: 81 },
    { row_id: 352, status: "ready", freshness: "not_calculated", pricing_group_id: 82 },
  ],
  blockers: [{ scope: "row", code: "not_calculated", field: "calculation",
    row_id: 352, pricing_group_id: 82, blocks: ["send"], message: "Not calculated yet." }],
  can_calculate: true, can_send: false,
};
const readiness = governedReadinessFromResponse(response);
const counts = governedReadinessCounts(readiness);
check(readiness.status === "ready" && readiness.rows.length === 2 && readiness.canCalculate
  && !readiness.canSend && counts.total === 2 && counts.sendCurrent === 1 && counts.notCalculated === 1,
  "S3-WS-1 one fresh row cannot pass a two-row Batch; the one backend result counts every row");

const stale = staleGovernedReadiness(readiness);
check(stale.status === "stale" && !stale.canCalculate && !stale.canSend
  && stale.rows.length === 2,
  "S3-WS-2 a governed edit visibly makes both actions stale without discarding the last row evidence");

const bad = governedReadinessFromResponse({ ...response, mutation: "unexpected" });
check(bad.status === "error" && !bad.canCalculate && !bad.canSend,
  "S3-WS-3 an incomplete or mutating readiness response fails closed");

const rowTarget = governedBlockerTarget({ scope: "row", row_id: 352, field: "dimensions" });
const groupTarget = governedBlockerTarget({ scope: "group", pricing_group_id: 82, field: "delivery_route" });
const basisTarget = governedBlockerTarget({ scope: "batch", field: "pricing_basis" });
check(rowTarget.targetId === "batch-workspace-row-352" && rowTarget.opensEditor
  && groupTarget.targetId === "batch-workspace-pricing-group-82" && groupTarget.opensDelivery
  && basisTarget.targetId === "batch-pricing-basis-release",
  "S3-WS-4 every blocker resolves to its exact durable row, Pricing Group/delivery editor, or Batch field");

const entry = fs.readFileSync(new URL("../src/tabs/batch/BatchEntryTab.jsx", import.meta.url), "utf8");
const panel = fs.readFileSync(new URL("../src/tabs/batch/BatchWorkspacePanel.jsx", import.meta.url), "utf8");
const draft = fs.readFileSync(new URL("../src/state/useCostingDraft.js", import.meta.url), "utf8");
const bridge = fs.readFileSync(new URL("../src/state/useCostingBatchBridge.js", import.meta.url), "utf8");
const pricingState = fs.readFileSync(new URL("../src/state/usePricingBasisState.js", import.meta.url), "utf8");
const topBar = fs.readFileSync(new URL("../src/ui/TopBar.jsx", import.meta.url), "utf8");

check(entry.includes("{!durableBatch?.id && <>") && entry.includes("<BatchGrid")
  && entry.includes("{durableBatch?.id && <BatchWorkspacePanel") && entry.includes("embedded batchId={durableBatch.id}"),
  "S3-WS-5 a governed Batch mounts the durable product workspace instead of the local grid");
check(!panel.includes("Copy to local preview") && !panel.includes("Refresh local preview")
  && panel.includes("These durable governed rows are the only products in this customer Batch"),
  "S3-WS-6 the governed workspace exposes no duplicate preview-row system");
check(panel.includes("/readiness") && !panel.includes("/effective-inputs")
  && (panel.match(/\/readiness`/g) || []).length === 1
  && panel.includes("One backend result evaluates every active durable row"),
  "S3-WS-7 readiness is fetched once for the Batch, never assembled by selected/per-row frontend checks");
check(panel.includes("openReadinessBlocker") && panel.includes("batch-row-field-")
  && panel.includes("focusAfterOpen(target.targetId") && panel.includes("row-focus"),
  "S3-WS-8 blocker navigation opens its exact editor and governed return focuses the originating row");
check(draft.includes("if(reviewedRow?.durableRowId!=null)")
  && draft.includes("setBatchRows(rows=>rows.filter(row=>row.id!==reviewCopy.rowId))")
  && bridge.indexOf("exitReview();", bridge.indexOf("commit:()=>{")) > bridge.indexOf("commit:()=>{"),
  "S3-WS-9 the session adapter is cleaned on deliberate exit, while governed-apply cleanup stays post-success");
check(panel.includes("No products yet. Use Add product below")
  && panel.includes("+ Add product") && panel.includes("Create proposed SKU"),
  "S3-WS-10 an empty governed Batch keeps the established/proposed SKU add path");
check(S3_GOVERNED_BATCH.batch_rows.length === 2
  && S3_GOVERNED_BATCH.fixture_readiness.rows.length === 2
  && S3_GOVERNED_BATCH.fixture_readiness.can_send === false,
  "S3-WS-11 the browser evidence fixture contains two durable rows and authoritative fail-closed readiness");
check(pricingState.includes("governedBatchReadiness")
  && panel.includes("governedBatchReadiness: readiness")
  && topBar.includes("governedResultMatches")
  && topBar.includes("governedBatchReadiness.blockers.length"),
  "S3-WS-12 the workspace and shared header consume the same whole-Batch backend readiness result");

console.log(`\n${passes} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
console.log("S3 governed working surface fixture gate PASS");
