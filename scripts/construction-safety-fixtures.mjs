import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  constructionLayerIssues, findUsableConstructionMatch,
  findUsableStandardConstructionMatch, isUsableConstruction,
  requiredConstructionLayers,
} from "../src/lib/constructionIdentity.js";
import { calcCosting, checkMissingInfo } from "../src/engine/costing.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const bridge = fs.readFileSync(path.join(root, "src/state/useCostingBatchBridge.js"), "utf8");
const resultState = fs.readFileSync(path.join(root, "src/state/useCostingResult.js"), "utf8");
const overlay = fs.readFileSync(path.join(root, "src/tabs/batch/ConstructionOverlay.jsx"), "utf8");
const batchGrid = fs.readFileSync(path.join(root, "src/tabs/batch/BatchGrid.jsx"), "utf8");
const quoteActions = fs.readFileSync(path.join(root, "src/state/useQuoteActions.js"), "utf8");

let passes = 0;
const failures = [];
function check(condition, label) {
  if (condition) { passes += 1; console.log(`ok   - ${label}`); }
  else { failures.push(label); console.log(`FAIL - ${label}`); }
}

const layers5 = {
  TOP: { code: "22", gsm: 180 }, F1: { code: "18", gsm: 120 },
  L1: { code: "20", gsm: 150 }, F2: { code: "18", gsm: 120 },
  L2: { code: "22", gsm: 180 },
};
const complete5 = {
  code: "GOOD-5", ply: 5, boxType: "RSC", flute_F1: "B", flute_F2: "A",
  board_gsm: 800, spec_bs: 12, spec_bct: "", spec_ect: "", layers: layers5,
};
const incomplete5 = {
  ...complete5, code: "EMPTY-GSM", layers: { ...layers5, F2: { code: "18", gsm: "" } },
};

check(requiredConstructionLayers({ ply: 5 }).join(",") === "TOP,F1,L1,F2,L2"
  && requiredConstructionLayers({ ply: 3 }).join(",") === "TOP,F1,L1",
  "CON-SAFE-1 required structural layers follow ply count");
check(isUsableConstruction(complete5) && !isUsableConstruction(incomplete5),
  "CON-SAFE-2 every required layer needs both grade/BF and positive GSM");
check(constructionLayerIssues({ ply: 3, layers: {
  TOP: { code: "", gsm: "" }, F1: { code: "18", gsm: 0 }, L1: { code: "20", gsm: 150 },
} }).map(issue => `${issue.key}:${issue.field}`).join(",") === "TOP:code,TOP:gsm,F1:gsm",
  "CON-SAFE-3 missing grade and invalid GSM are reported separately");
check(findUsableConstructionMatch([incomplete5], incomplete5) === undefined,
  "CON-SAFE-4 an exact but incomplete library row is never reusable");
check(findUsableStandardConstructionMatch([
  { ...complete5, code: "NO-IDENTITY", board_gsm: "", spec_bs: "" },
], { ...complete5, board_gsm: "", spec_bs: "", layers: { ...layers5, TOP: { code: "24", gsm: 180 } } }) === undefined,
  "CON-SAFE-5 blank board specifications cannot manufacture a standard match");
check(findUsableStandardConstructionMatch([incomplete5, complete5], {
  ...complete5, code: "INCOMING", layers: { ...layers5, TOP: { code: "24", gsm: 180 } },
})?.code === "GOOD-5",
  "CON-SAFE-6 standard matching skips incomplete candidates and chooses a usable one");
check(bridge.includes("constructionLayerIssues(spec)")
  && bridge.includes("findUsableConstructionMatch(constructionLib,spec)")
  && bridge.includes("findUsableStandardConstructionMatch(constructionLib,spec)"),
  "CON-SAFE-7 Start Costing send uses the shared completeness and safe-match boundary");
check(resultState.includes("const _sendLayerIssues=constructionLayerIssues(spec)")
  && resultState.includes("_sendLayerIssues.length===0"),
  "CON-SAFE-8 Send readiness blocks incomplete required layers");
check(overlay.includes("constructionLib.filter(c=>(c.status||'active')==='active')")
  && overlay.includes("activeConstructions.filter(isUsableConstruction)")
  && overlay.includes("incomplete hidden"),
  "CON-SAFE-9 Batch construction selection hides unfinished library rows transparently");
check(checkMissingInfo({
  L: 100, W: 100, H: 100, ply: 5, boxType: "RSC", layers: incomplete5.layers,
  delivery: "Nagpur", volume: 1000, sector: "PAINTS", flute_F1: "B",
}, {}).blockers.some(message=>message.includes("Paper construction incomplete")),
  "CON-SAFE-10 incomplete required layers are a costing blocker, not a usable partial result");
check(calcCosting({
  L: 100, W: 100, H: 100, ply: 5, boxType: "RSC", layers: incomplete5.layers,
}, [], {}, undefined) === null,
  "CON-SAFE-11 the engine refuses partial-layer arithmetic even when called directly");
check(quoteActions.includes("!isUsableConstruction(constEntry)")
  && quoteActions.includes("Cannot send: incomplete construction")
  && batchGrid.includes("constructionUsable=!!ce&&isUsableConstruction(ce)")
  && batchGrid.includes("incomplete`"),
  "CON-SAFE-12 existing incomplete row links cannot calculate or reach Quote Items and are visibly flagged");

console.log(`\n${passes} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
console.log("Construction safety fixture gate PASS");
