// GSM Master frontend fixtures.
//
// Run: npm run test:gsm-master
//
// Pure helper behaviour (ordering, picker model, validation, bodies, confirm
// copy) plus source-shape checks that the two construction layer GSM inputs
// use the governed picker, that an unavailable master falls back visibly
// without a substituted list, and that every write is gated and confirmed.
import { readFileSync } from "node:fs";
import {
  addGsmValueBody, gsmPickerModel, gsmStatusBody, gsmStatusConfirmMessage,
  parseGsmInput, sortGsmValues,
} from "../src/lib/gsmMaster.js";

let passes = 0;
let fails = 0;
const check = (condition, label) => {
  if (condition) { passes += 1; console.log(`ok   - ${label}`); }
  else { fails += 1; console.log(`FAIL - ${label}`); }
};
const read = path => readFileSync(new URL(path, import.meta.url), "utf8");

const values = [
  { id: 1, gsm: 120, status: "active", content_version: 1 },
  { id: 2, gsm: 80, status: "active", content_version: 1 },
  { id: 3, gsm: 230, status: "retired", content_version: 2 },
];

check(sortGsmValues(values).map(v => v.gsm).join() === "80,120,230",
  "GSM-FE-1 values sort in ascending GSM order");
check(sortGsmValues(null).length === 0 && sortGsmValues([{ gsm: "x" }]).length === 0,
  "GSM-FE-2 a missing or malformed list yields no invented values");

let model = gsmPickerModel(values, "");
check(model.options.map(o => o.value).join() === "80,120" && model.selected === "" && model.currentKind === "blank",
  "GSM-FE-3 a blank layer offers only active values and stays blank");
model = gsmPickerModel(values, "120");
check(model.selected === "120" && model.currentKind === "active" && model.options.length === 2,
  "GSM-FE-4 a stored active value is selected without an extra option");
model = gsmPickerModel(values, 120);
check(model.selected === "120" && model.currentKind === "active",
  "GSM-FE-5 a numeric stored value matches its listed string");
model = gsmPickerModel(values, "230");
check(model.currentKind === "retired" && model.selected === "230"
  && model.options.some(o => o.value === "230" && o.label === "230 · retired"),
  "GSM-FE-6 a retired stored value is kept and labelled retired, not blanked");
model = gsmPickerModel(values, "125");
check(model.currentKind === "off-list" && model.selected === "125"
  && model.options.some(o => o.value === "125" && o.label === "125 · not in GSM Master"),
  "GSM-FE-7 an off-list stored value is kept exactly and labelled, not rounded");
model = gsmPickerModel(values, "0");
check(model.currentKind === "off-list" && model.selected === "0",
  "GSM-FE-8 an explicit zero is not treated as blank");

check(parseGsmInput("", values).ok === false, "GSM-FE-9 blank input is refused");
check(parseGsmInput("12.5", values).ok === false && parseGsmInput("abc", values).ok === false,
  "GSM-FE-10 non-whole-number input is refused");
check(parseGsmInput("0", values).ok === false && parseGsmInput("2001", values).ok === false,
  "GSM-FE-11 out-of-range input is refused");
check(/already in the GSM Master/.test(parseGsmInput("120", values).message),
  "GSM-FE-12 an active duplicate is refused");
check(/restore it instead/.test(parseGsmInput("230", values).message),
  "GSM-FE-13 a retired duplicate points to Restore, not a second row");
const ok = parseGsmInput(" 125 ", values);
check(ok.ok === true && ok.value === 125, "GSM-FE-14 a new whole number is accepted");

check(JSON.stringify(addGsmValueBody(125)) === JSON.stringify({ gsm: 125 }),
  "GSM-FE-15 add body carries only the GSM");
check(JSON.stringify(gsmStatusBody(values[2], "active")) === JSON.stringify({ status: "active", expected_content_version: 2 }),
  "GSM-FE-16 status body carries the CAS version that was read");
check(/Retire 120 GSM\?/.test(gsmStatusConfirmMessage(values[0], "retired"))
  && /keep the value/.test(gsmStatusConfirmMessage(values[0], "retired"))
  && /Restore 230 GSM\?/.test(gsmStatusConfirmMessage(values[2], "active")),
  "GSM-FE-17 retire/restore confirmation states the consequence");

const specForm = read("../src/tabs/costing/SpecForm.jsx");
const conLibTab = read("../src/tabs/ConstructionLibTab.jsx");
const gsmSelect = read("../src/ui/GsmSelect.jsx");
const hook = read("../src/state/useGsmMaster.js");
const screen = read("../src/tabs/GsmMasterScreen.jsx");
const flags = read("../src/lib/featureFlags.js");
const sidebar = read("../src/ui/Sidebar.jsx");
const app = read("../src/QuotationApp.jsx");

check(specForm.includes("<GsmSelect value={spec.layers[k]?.gsm||\"\"}")
  && !specForm.includes("type=\"number\" placeholder=\"GSM\""),
  "GSM-FE-18 Costing layer GSM uses the governed picker");
check(conLibTab.includes("<GsmSelect value={(c.layers||{})[lk]?.gsm||\"\"}")
  && !conLibTab.includes("<input type=\"number\" placeholder=\"GSM\""),
  "GSM-FE-19 Construction Library layer GSM uses the governed picker");
check(gsmSelect.includes("dashed") && gsmSelect.includes("GSM Master unavailable")
  && gsmSelect.includes("kept as saved"),
  "GSM-FE-20 unavailable and off-list states are visibly distinct");
check(hook.includes("MASTER_UNAVAILABLE") && !hook.includes("localStorage")
  && !hook.includes("80, 100") && hook.includes("\"/masters/gsm-values\""),
  "GSM-FE-21 the shared read substitutes no local list and never persists one");
check(screen.includes("window.confirm(gsmStatusConfirmMessage")
  && screen.includes("const MANAGE = \"manage_construction_library\"")
  && (screen.match(/<CapabilityGate profile=\{profile\} capability=\{MANAGE\}>/g) || []).length === 2
  && screen.includes("runMutation(\"/masters/gsm-values\"")
  && !screen.includes(".rpc(") && !screen.includes(".table("),
  "GSM-FE-22 every GSM write is capability gated, confirmed where destructive, and backend routed");
check(flags.includes("\"u2_gsm_master\"")
  && sidebar.includes("isFeatureEnabled(\"u2_gsm_master\")")
  && app.includes("tab===\"gsm\"&&isFeatureEnabled(\"u2_gsm_master\")"),
  "GSM-FE-23 the destination is feature-flagged in both navigation and mount");

console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails === 0 ? 0 : 1);
