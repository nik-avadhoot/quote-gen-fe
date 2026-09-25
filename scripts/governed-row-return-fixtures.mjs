// S3 - deliberate governed return from a Costing deep-dive to its durable
// Batch row. Behavioural fixtures over lib/governedRowReturn.js plus the
// source wiring in the bridge and SpecForm.
//
// GRR_MODULE / GRR_BRIDGE / GRR_SPECFORM point the same checks at another
// copy, so mutation runs prove each check can fail.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { durableRowToLocalPreview } from "../src/lib/batchRowModel.js";
import { freshBatchProfileValues } from "../src/state/costingDraftModel.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const modulePath = process.env.GRR_MODULE || path.join(root, "src/lib/governedRowReturn.js");
const bridge = fs.readFileSync(process.env.GRR_BRIDGE || path.join(root, "src/state/useCostingBatchBridge.js"), "utf8");
const specForm = fs.readFileSync(process.env.GRR_SPECFORM || path.join(root, "src/tabs/costing/SpecForm.jsx"), "utf8");
const panel = fs.readFileSync(process.env.GRR_PANEL || path.join(root, "src/tabs/batch/BatchWorkspacePanel.jsx"), "utf8");
const profileBar = fs.readFileSync(process.env.GRR_PROFILEBAR || path.join(root, "src/tabs/batch/BatchProfileBar.jsx"), "utf8");
const {
  appliedLocalEffects, appliedMessage, durableReviewInputs, governedRowOrigin,
  planGovernedRowReturn, runGovernedRowReturn,
} = await import(pathToFileURL(modulePath).href);

let passes = 0;
const failures = [];
function check(condition, label) {
  if (condition) { passes += 1; console.log(`ok   - ${label}`); }
  else { failures.push(label); console.log(`FAIL - ${label}`); }
}

// Batch A selects Customer A (party 501); the row's SKU belongs to Family member B (party 502).
const batchA = { id: 71, content_version: 14, customer_party_id: 501,
  customer_party: { id: 501, display_name: "Customer A" },
  customer_family: { name: "Family AB" }, current_profile: { payment_terms_days: 60 } };
const durableRow = {
  id: 351, batch_id: 71, content_version: 8, sku_id: 301, sku_version_id: 311, pricing_group_id: 81,
  row_type: "box", material_code: "NAG-301", sales_moq: 0, volume: null,
  margin_override_pct: null, waste_override_pct: null, conv_override_rate: null,
  addon_printing: 5, addon_coating: null, addon_other: 0, fluting_bcf: 0.12,
  customer: { id: 502, display_name: "Customer B" },
  sku_version: {}, effective_construction: { version_id: 901 },
};
const preview = durableRowToLocalPreview(durableRow, "local-351", batchA);
const origin = governedRowOrigin(preview);

check(origin && origin.batchId === 71 && origin.batchContentVersion === 14 && origin.rowId === 351
  && origin.rowContentVersion === 8 && origin.skuVersionId === 311 && origin.pricingGroupId === 81
  && origin.constructionVersionId === 901 && origin.rowType === "box" && origin.materialCode === "NAG-301",
  "S3-GR-1 opening captures the Batch, Batch version, row, row version and every governed identity");
check(governedRowOrigin({ ...preview, durableBatchId: null }) === null && governedRowOrigin({ id: "local-9" }) === null,
  "S3-GR-2 a review without the complete governed origin cannot apply (scratch Costing keeps Push)");

// The review baseline, as prepareBatchRowReview builds it: applyAddOns zeroes
// every add-on and fluting is fixed at 0.10 before durableReviewInputs runs.
const seeded = { margin: 8, waste: 5, convRate: 7, wastePP: 5, convRatePP: 12.5,
  printing: 0, stitching: 0, coating: 0, handling: 0, moqCharge: 0, packing: 0, other: 0, unloading: 0,
  flutingBCF: 0.10, salesMOQ: "", volume: "", spec_bs: "14", ply: 5, layers: { TOP: { code: "35GY", gsm: 170 } },
  client: "Customer A", L: 675 };
const baseline = { ...seeded, ...durableReviewInputs(preview, seeded) };
check(baseline.printing === 5 && baseline.coating === "" && baseline.other === 0
  && baseline.flutingBCF === 0.12 && baseline.salesMOQ === 0 && baseline.volume === "",
  "S3-GR-3 the review starts from the governed row: valued, blank and zero add-ons, fluting 0.12 and a zero MOQ kept apart");

const profile = { margin: 8, waste: 5, conv: 7 };
const unresolved = { waste: 5, conv: 7, isWasteBlank: true, isConvBlank: true };
const plan = spec => planGovernedRowReturn({ spec, baseline, origin, isPP: false, profile, resolved: unresolved });

let p = plan({ ...baseline, printing: "", coating: 0 });
check(p.status === "ready" && p.body.addon_printing === null && p.body.addon_coating === 0,
  "S3-GR-4 clearing a value sends null (blank) and typing 0 into a blank sends an explicit zero");

p = plan({ ...baseline, volume: 5000 });
const identity = ["expected_content_version", "pricing_group_id", "sku_version_id", "row_type", "material_code"];
check(p.status === "ready" && JSON.stringify(p.submitted) === JSON.stringify(["volume"])
  && JSON.stringify(Object.keys(p.body).sort()) === JSON.stringify([...identity, "volume"].sort())
  && p.body.volume === 5000,
  "S3-GR-5 only the changed row-owned field is submitted, with the unchanged identities the route requires");
check(!("addon_other" in p.body) && !("margin_override_pct" in p.body) && !("sales_moq" in p.body)
  && !("fluting_bcf" in p.body),
  "S3-GR-6 unchanged fields are omitted, so the route keeps their stored values");
check(p.body.expected_content_version === 8 && p.body.material_code === "NAG-301"
  && p.body.sku_version_id === 311 && p.body.pricing_group_id === 81 && p.body.row_type === "box",
  "S3-GR-7 the request carries the row version captured at open and resends identity unchanged");

p = plan({ ...baseline, margin: 11, flutingBCF: 0.2, salesMOQ: 250 });
check(p.status === "ready" && p.body.margin_override_pct === 11 && p.body.fluting_bcf === 0.2 && p.body.sales_moq === 250,
  "S3-GR-8 margin, fluting and MOQ changes are returned as governed row inputs");
p = plan({ ...baseline, margin: 8 });
check(p.status === "no_change", "S3-GR-9 an untouched review has nothing to apply");
p = plan({ ...baseline, L: "675", volume: "", printing: "5", layers: { TOP: { code: "35GY", gsm: "170" } } });
check(p.status === "no_change",
  "S3-GR-9a values typed back to what they were (text vs number, nested layers too) are unchanged: no block, nothing resubmitted");
p = plan({ ...baseline, other: "" });
check(p.status === "ready" && p.body.addon_other === null,
  "S3-GR-9b clearing an explicit zero is still a change to blank - blank and zero never compare equal");
p = plan({ ...baseline, margin: 9 });
const back = planGovernedRowReturn({ spec: { ...baseline, margin: 8 }, baseline: { ...baseline, margin: 9 },
  origin, isPP: false, profile, resolved: unresolved });
check(p.body.margin_override_pct === 9 && back.body.margin_override_pct === null,
  "S3-GR-10 margin keeps the accepted Push rule: an explicit value, or blank when returned to the Batch figure");
p = planGovernedRowReturn({ spec: { ...baseline, waste: 0 }, baseline, origin, isPP: false, profile,
  resolved: { waste: 0, conv: 7, isWasteBlank: false, isConvBlank: true } });
check(p.status === "ready" && p.body.waste_override_pct === 0,
  "S3-GR-11 an explicit zero waste override survives as 0, never as inherit");

for (const [label, spec] of [
  ["BS", { ...baseline, volume: 5000, spec_bs: "16" }],
  ["Construction", { ...baseline, printing: 7, layers: { TOP: { code: "28GY", gsm: 170 } } }],
  ["Dimensions", { ...baseline, L: 700 }],
  ["Customer", { ...baseline, client: "Stale Customer C" }],
]) {
  const blocked = plan(spec);
  check(blocked.status === "blocked" && !blocked.body && blocked.labels.includes(label)
    && blocked.message.includes("new governed SKU or SKU Version") && blocked.message.includes("Nothing was applied"),
    `S3-GR-12 a ${label} change blocks the WHOLE apply and says a new governed SKU/SKU Version is needed`);
}
check(plan({ ...baseline, wastePP: 9 }).status === "blocked",
  "S3-GR-13 the other row type's waste/conv pair is not silently dropped: it blocks");
check(plan({ ...baseline, volume: 12.5 }).status === "invalid" && plan({ ...baseline, other: -1 }).status === "invalid",
  "S3-GR-14 a fractional volume or negative add-on is refused before any request");

const readyPlan = plan({ ...baseline, volume: 5000 });
const okResponse = (cv = 9) => ({ ok: true, json: async () => ({ batch: { id: 71,
  batch_rows: [{ id: 351, content_version: cv, volume: 5000 }] } }) });
const errResponse = (status, code) => ({ ok: false, status, json: async () => ({ error_code: code, error: `${code} text` }) });
async function run({ confirm = true, response = okResponse(), freshness = "calculation_stale", throws = false } = {}) {
  const log = [];
  const result = await runGovernedRowReturn({ plan: readyPlan, origin,
    confirm: () => { log.push("confirm"); return confirm; },
    request: async (url, body) => { log.push(`request ${url} v${body.expected_content_version}`);
      if (throws) throw new Error("offline"); return response; },
    readFreshness: async () => { log.push("freshness"); return { freshness }; },
    commit: () => log.push("commit") });
  return { result, log };
}

let r = await run();
check(r.result.outcome === "applied" && r.result.row.content_version === 9
  && JSON.stringify(r.log) === JSON.stringify(["confirm", "request /batches/71/rows/351 v8", "freshness", "commit"]),
  "S3-GR-15 success: CAS request, read-back shows the version advanced, freshness read, THEN local commit");
check(r.result.freshness === "calculation_stale" && appliedMessage("calculation_stale").includes("recalculate before Send")
  && appliedMessage("not_calculated").includes("recalculate before Send") && !appliedMessage("fresh").includes("price is out of date"),
  "S3-GR-16 the governed calculation is reported stale from the backend's own freshness, never assumed or priced locally");
r = await run({ response: errResponse(409, "STALE_VERSION") });
check(r.result.outcome === "conflict" && !r.log.includes("commit") && r.result.message.includes("review is kept"),
  "S3-GR-17 a stale row version is a conflict: nothing local changes and the review is kept");
r = await run({ response: errResponse(403, "CAPABILITY_REQUIRED") });
check(r.result.outcome === "forbidden" && !r.log.includes("commit"), "S3-GR-18 a permission refusal commits nothing");
r = await run({ response: errResponse(400, "INVALID_INPUT") });
check(r.result.outcome === "invalid" && !r.log.includes("commit") && r.result.message.includes("INVALID_INPUT text"),
  "S3-GR-19 a validation refusal commits nothing and shows the route's reason");
r = await run({ throws: true });
check(r.result.outcome === "network" && !r.log.includes("commit"), "S3-GR-20 a network failure commits nothing");
r = await run({ confirm: false });
check(r.result.outcome === "cancelled" && JSON.stringify(r.log) === JSON.stringify(["confirm"]),
  "S3-GR-21 cancelling the confirmation sends nothing and changes nothing");
r = await run({ response: okResponse(8) });
check(r.result.outcome === "unverified" && !r.log.includes("commit"),
  "S3-GR-22 a success whose read-back does not show a newer row version is not treated as applied");
r = await run({ freshness: null });
check(r.result.outcome === "applied" && r.result.freshness === "unknown"
  && appliedMessage("unknown").includes("recalculate before Send"),
  "S3-GR-23 an unreadable freshness still applies but never claims the calculation is current");

const others = [{ id: "local-1" }, { id: "local-351", durableRowId: 351 }, { id: "local-352", durableRowId: 352 }];
const effects = appliedLocalEffects({ rows: others, previewId: "local-351", origin, requestId: "req-1" });
check(JSON.stringify(effects.rows.map(row => row.id)) === JSON.stringify(["local-1", "local-352"]),
  "S3-GR-24 only the temporary preview this review created is removed");
check(effects.tab === "batch" && effects.workspaceRequest.mode === "row-focus"
  && effects.workspaceRequest.batchId === 71 && effects.workspaceRequest.rowId === 351,
  "S3-GR-25 the return reopens the Batch workspace focused on the exact originating durable row");

const forbiddenKeys = ["customer_party_id", "customer_family_id", "party_id", "plant_id", "sku_id",
  "construction_version_id", "client", "customer"];
const profileA = freshBatchProfileValues(batchA);
check(!forbiddenKeys.some(key => key in readyPlan.body) && profileA.client === "Customer A"
  && readyPlan.body.sku_version_id === durableRow.sku_version_id,
  "S3-GR-26 A/B/C: the request carries no Customer, Family, Plant or SKU authority; Customer A stays the Profile, B stays row evidence");

// Source wiring - the bridge and SpecForm.
const applyStart = bridge.indexOf("const applyCostingToGovernedRow=async()=>{");
const applyBody = bridge.slice(applyStart, bridge.indexOf("\n  };", applyStart));
const beforeRun = applyBody.slice(0, applyBody.indexOf("runGovernedRowReturn("));
const commitBody = applyBody.slice(applyBody.indexOf("commit:()=>{"));
check(applyStart > 0 && !/exitReview\(|setBatchRows\(|setBatchWorkspaceRequest|setTab\(/.test(beforeRun)
  && ["exitReview()", "setBatchRows(", "setBatchWorkspaceRequest?.(", "setTab(effects.tab)"].every(token => commitBody.includes(token)),
  "S3-GR-27 cleanup and navigation live only inside the post-success commit");
check(!/setBatchProfile\(|setBatchResults\(/.test(applyBody),
  "S3-GR-28 the apply never writes the Batch Profile or a local price");
const governedBranch = specForm.slice(specForm.indexOf("{_governed?<div"), specForm.indexOf(":<div style={{display:\"flex\",gap:8,marginTop:4}}>"));
check(governedBranch.includes("onClick={applyGoverned}") && !governedBranch.includes("pushCostingToBatchRow")
  && governedBranch.includes("Apply to Batch row") && governedBranch.includes("marks its previous calculation stale")
  && specForm.includes("await applyCostingToGovernedRow()"),
  "S3-GR-29 a governed-origin review offers only Apply to Batch row; the local Push stays for scratch reviews");

const load = panel.slice(panel.indexOf("const response = await apiFetch(`/batches/${batchId}/workspace`);") - 200,
  panel.indexOf("}, [batchId, fixtureOnly]);") + 30);
check(panel.includes("}, [batchId, fixtureOnly]);") && !panel.includes("}, [batchId, fixtureOnly, onBatchChange]);")
  && load.includes("onBatchChangeRef.current?.(data.batch);"),
  "S3-GR-30 the workspace the return reopens loads once per Batch, not again on every parent render");
check(profileBar.includes("const pricingExpanded=openCards.pricing||workspaceRequested;")
  && profileBar.includes("expanded:pricingExpanded") && profileBar.includes("setBatchWorkspaceRequest?.(null)"),
  "S3-GR-31 a pending return opens the Pricing card that hosts the workspace; collapsing it withdraws the request");

console.log(`\n${passes} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
console.log("S3 governed row return fixture gate PASS");
