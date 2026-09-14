import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { durableRowToLocalPreview } from "../src/lib/batchRowModel.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const panel = fs.readFileSync(path.join(root, "src/tabs/batch/BatchWorkspacePanel.jsx"), "utf8");
let passes = 0;
const failures = [];

function check(condition, label) {
  if (condition) { passes += 1; console.log(`ok   - ${label}`); }
  else { failures.push(label); console.log(`FAIL - ${label}`); }
}

const preview = durableRowToLocalPreview({
  id: 351, content_version: 8, sku_id: 301, sku_version_id: 311, pricing_group_id: 81,
  row_type: "box", addon_printing: 0, addon_coating: null, addon_other: 12.5,
  fluting_bcf: 0, sku_version: {}, effective_construction: {},
});
check(preview.printing === 0 && preview.coating === "" && preview.other === 12.5,
  "U4-ROW-FE-1 local preview preserves deliberate zero, absent and valued add-ons distinctly");
check(preview.fluting_bcf === 0,
  "U4-ROW-FE-2 deliberate-zero fluting BCF is not mistaken for inherited blank");
check(panel.includes('placeholder="Blank · not entered"')
  && panel.includes("Add-on charges have no inheritance")
  && panel.includes('placeholder="Blank · inherit default"'),
  "U4-ROW-FE-3 editor explains the different null semantics for add-ons and fluting");
check(panel.includes("addon_printing") && panel.includes("addon_unloading")
  && panel.includes('max="0.3"'),
  "U4-ROW-FE-4 every governed add-on and the bounded fluting input is visible");
check(panel.includes("/rows/${row.id}/status")
  && panel.includes("expected_content_version: row.content_version")
  && panel.includes("Remove row") && panel.includes("Restore row"),
  "U4-ROW-FE-5 reversible row lifecycle uses the dedicated CAS route");
check(panel.includes('disabled={row.status !== "active"}')
  && panel.includes("excluded from preparation and Send candidates"),
  "U4-ROW-FE-6 removed rows remain visible but cannot preview or masquerade as active");

console.log(`\n${passes} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
console.log("U4 durable-row input and lifecycle fixture gate PASS");
