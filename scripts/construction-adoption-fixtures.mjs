import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CONSTRUCTION_ADOPTION_FIXTURE } from "../src/lib/constructionAdoptionFixture.js";
import {
  ADOPTION_STATUS,
  adoptionStatusForPlant,
  callerAccessiblePlantCodes,
  callerAccessiblePlants,
  constructionVersionSummary,
  publishedApprovedConstructionVersions,
} from "../src/lib/constructionAdoptionModel.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const read = rel => fs.readFileSync(path.join(root, rel), "utf8");
const screen = read("src/tabs/ConstructionLibraryScreen.jsx");
const sidebar = read("src/ui/Sidebar.jsx");
const app = read("src/App.jsx");

let passed = 0;
const failures = [];
function check(condition, label) {
  if (condition) { passed += 1; console.log(`ok   - ${label}`); }
  else { failures.push(label); console.log(`FAIL - ${label}`); }
}

const fixture = CONSTRUCTION_ADOPTION_FIXTURE;
check(JSON.stringify(callerAccessiblePlantCodes(fixture.profile)) === JSON.stringify(["NAG", "PUN"]),
  "U2-PCA-FE-1 plant scope comes only from explicit plant_access grants");
check(callerAccessiblePlants(fixture.plants, fixture.profile).map(p => p.code).join(",") === "NAG,PUN",
  "U2-PCA-FE-2 the matrix never adds a plant merely because another capability is held there");

const rows = publishedApprovedConstructionVersions(fixture.constructions);
check(rows.length === 2 && rows.every(row => row.construction.status === "published" && row.version.approved === true),
  "U2-PCA-FE-3 only exact approved versions of published Constructions enter the matrix");
check(adoptionStatusForPlant(rows[0].version, 11) === ADOPTION_STATUS.adopted
  && adoptionStatusForPlant(rows[0].version, 12) === ADOPTION_STATUS.withdrawn
  && adoptionStatusForPlant(rows[1].version, 11) === ADOPTION_STATUS.notAdopted,
  "U2-PCA-FE-4 adopted, withdrawn and caller-scoped not-adopted remain distinct");
check(adoptionStatusForPlant(rows[1].version, 11, true) === ADOPTION_STATUS.unavailable,
  "U2-PCA-FE-5 a failed optional adoption read never becomes not-adopted");
check(constructionVersionSummary({ ply: 3, board_gsm: 0 }) === "3-ply · board 0 gsm"
  && constructionVersionSummary({ ply: 3, board_gsm: null }) === "3-ply",
  "U2-PCA-FE-6 explicit zero and blank board GSM remain different");

check(screen.includes('apiFetch("/masters/constructions")')
  && screen.includes('apiFetch("/masters/plants")')
  && screen.includes("callerAccessiblePlants(plantState.rows, profile)")
  && screen.includes("Published, approved Construction versions by the caller's exact Producing Plant scope"),
  "U2-PCA-FE-7 the screen composes only the existing caller-scoped governed reads");
check(!screen.includes("runMutation(") && !screen.includes('method: "POST"')
  && screen.includes("proposing, approving and withdrawing adoption remain outside this slice"),
  "U2-PCA-FE-8 the increment exposes no adoption mutation path");
check(sidebar.includes('item("conadoption","PA","Plant Construction Adoption"')
  && app.includes('fixtureIllustration === "u2-constructions"')
  && app.includes('<ConstructionLibraryScreen fixtureOnly initialView="adoption"'),
  "U2-PCA-FE-9 navigation and the labelled developer preview reach the same governed surface");
check(screen.includes("fixtureOnly || !isActive")
  && screen.includes("fixture mode never issues a request")
  && screen.includes("no authoritative read or write"),
  "U2-PCA-FE-10 fixture preview is isolated before every API read and permanently labelled");

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
console.log("plant construction adoption frontend fixtures PASS");
