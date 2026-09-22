import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyConstructionToSpec, constructionLayerIssues, findUsableConstructionMatch,
  findUsableStandardConstructionMatch, isUsableConstruction,
  requiredConstructionLayers, sameConstruction,
} from "../src/lib/constructionIdentity.js";
import { calcCosting, checkMissingInfo } from "../src/engine/costing.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const bridge = fs.readFileSync(path.join(root, "src/state/useCostingBatchBridge.js"), "utf8");
const resultState = fs.readFileSync(path.join(root, "src/state/useCostingResult.js"), "utf8");
const overlay = fs.readFileSync(path.join(root, "src/tabs/batch/ConstructionOverlay.jsx"), "utf8");
const picker = fs.readFileSync(path.join(root, "src/components/ConstructionPicker.jsx"), "utf8");
const costingTab = fs.readFileSync(path.join(root, "src/tabs/costing/CostingTab.jsx"), "utf8");
const specForm = fs.readFileSync(path.join(root, "src/tabs/costing/SpecForm.jsx"), "utf8");
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
const draft={client:"ACME",sector:"PAINTS",material_code:"SKU-1",product:"Carton",
  L:400,W:300,H:250,margin:11,waste:4,layers:{}};
const applied=applyConstructionToSpec(draft,{...complete5,spec_cobb:125});
check(applied.constructionCode==="GOOD-5"&&sameConstruction(applied,complete5),
  "CON-SAFE-6a Costing selection carries an exact reusable construction reference");
check(applied.client===draft.client&&applied.sector===draft.sector&&applied.material_code===draft.material_code
  &&applied.product===draft.product&&applied.L===draft.L&&applied.margin===draft.margin
  &&applied.waste===draft.waste&&applied.spec_cobb===125,
  "CON-SAFE-6b Costing selection changes construction/spec fields but not Batch, SKU or commercial context");
applied.layers.TOP.gsm=999;
check(complete5.layers.TOP.gsm===180,
  "CON-SAFE-6c Costing selection deep-copies layers instead of mutating the shared library entry");
check(bridge.includes("constructionLayerIssues(spec)")
  // 2026-09-22: the source is the governed catalogue (published + adopted at the
  // Batch's plant, with legacy A-Z entries behind it), not the browser library.
  // The boundary this check exists for — active-only, shared completeness,
  // safe matching — is unchanged; only where the candidates come from moved.
  && bridge.includes("selectableConstructionLib=constructionCatalogue.filter")
  && bridge.includes("findUsableConstructionMatch(selectableConstructionLib,spec)")
  && bridge.includes("findUsableStandardConstructionMatch(selectableConstructionLib,spec)"),
  "CON-SAFE-7 Start Costing send uses the shared completeness, active-only and safe-match boundary");
check(resultState.includes("const _sendLayerIssues=constructionLayerIssues(spec)")
  && resultState.includes("_sendLayerIssues.length===0"),
  "CON-SAFE-8 Send readiness blocks incomplete required layers");
check(picker.includes("filter(c=>(c.status||'active')==='active')")
  && picker.includes("activeConstructions.filter(isUsableConstruction)")
  && picker.includes("incomplete hidden")
  && overlay.includes("<ConstructionPicker")&&costingTab.includes("<ConstructionPicker")
  && specForm.includes("Paper Construction")&&specForm.includes('aria-label="Detach construction"')
  && !specForm.includes(">Existing Construction</div>"),
  "CON-SAFE-9 shared picker is compact in the Paper Construction header and hides unfinished rows");
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
