// ═══════════════════════════════════════════════════════════════════════════
// scripts/screen-standard-fixtures.mjs — the shared screen-space standard on
// Commercial Policies, Rate Masters, Freight Masters, Users & Access and
// Producing Plants (2026-09-16).
//
// Source-shape assertions, like the other UX gates: they prove the chrome is
// the shared one and that every guard the rewrite moved is still present. The
// row and toolbar HEIGHTS are browser facts and are recorded as browser
// measurements, not asserted here — see the two traps in screenStandards.js.
// ═══════════════════════════════════════════════════════════════════════════
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const read = rel => fs.readFileSync(path.join(root, rel), "utf8");

const policies = read("src/tabs/DefaultsTab.jsx");
const rates = read("src/tabs/RateMasterTab.jsx");
const freight = read("src/tabs/FreightTab.jsx");
const users = read("src/tabs/UserManagementTab.jsx");
const plants = read("src/tabs/ProducingPlantsScreen.jsx");
const orphans = read("src/ui/AuthOrphansPanel.jsx");
const shell = read("src/QuotationApp.jsx");
const standards = read("src/ui/screenStandards.js");

let passes = 0;
const failures = [];
function check(condition, label) {
  if (condition) { passes += 1; console.log(`ok   - ${label}`); }
  else { failures.push(label); console.log(`FAIL - ${label}`); }
}
const count = (src, re) => (src.match(re) || []).length;
const screens = { policies, rates, freight, users, plants };

// ── The shared chrome ────────────────────────────────────────────────────
check(standards.includes("export const cellInput = {") && standards.includes("height: 20")
  && standards.includes('export const inputCell = { padding: "2px 8px" }'),
  "SS-1 an editable value in a dense row is a shared 20px token, so a row of inputs stays a 26px row");
check(Object.values(screens).every(src => count(src, /role="toolbar"/g) === 1
  && src.includes("toolbar") && src.includes('from "../ui/screenStandards.js"')),
  "SS-2 each screen has exactly one toolbar, taken from the shared standard");
check(!policies.includes(">Sector Defaults</div>") && !rates.includes(">Rate Master\n")
  && !freight.includes(">Freight Rate Matrix</div>") && !users.includes(">User Management</div>")
  && !plants.includes(">Producing Plants</div>"),
  "SS-3 no page header repeats the screen name under the TopBar");
check(Object.values(screens).every(src => src.includes("denseTable") && src.includes("denseHead")
  && src.includes("frozenCell(false, true)") && src.includes("height: 26")),
  "SS-4 every table is dense with a frozen identity column and 26px rows");
check(Object.values(screens).every(src => src.includes("<ScreenFooter") && src.includes("<ProvenanceTag kind=")),
  "SS-5 provenance is stated once, in the footer");
check([policies, rates, freight].every(src => src.includes('<ProvenanceTag kind="local" />'))
  && users.includes('<ProvenanceTag kind="governed" />') && plants.includes('<ProvenanceTag kind="governed" />'),
  "SS-6 the three commercial masters say Local (browser state); Users and Plants say Governed");
check([policies, rates, freight, plants].every(src => !/fontSize: ?(?!T\.)[0-9]/.test(src)),
  "SS-7 type sizes on the four rewritten masters are T tokens, never hardcoded pixels");
check([policies, rates, freight, users].every(src => src.includes("<PanelFocusToggle") && src.includes("usePanelFocus()")
  && !/requestFullscreen|fullscreenElement/.test(src)),
  "SS-8 a screen that can fill the area does so through the shared icon, inside the app window only");

// ── Commercial Policies ──────────────────────────────────────────────────
check(policies.includes('role="tablist" aria-label="Commercial policy sections"')
  && policies.includes('{section==="sector-defaults"&&sectorTable()}')
  && policies.includes('{section==="box-trim-defaults"&&boxTrimTable()}')
  && policies.includes('{section==="partitions-master"&&partitionsTable()}')
  && !policies.includes('href={`#${id}`}'),
  "SS-9 Commercial Policies shows one section at a time behind a switch, replacing the stacked jump-link page");
check(policies.includes("const isReferenced=batchProfile.sector===row.code||")
  && policies.includes("Code locked — referenced by")
  && policies.includes('+"\\nThis cannot be undone.";')
  && policies.includes("if(window.confirm(msg))setSectors(prev=>prev.filter((_,j)=>j!==i));"),
  "SS-10 the sector code-rename lock and the sector delete confirm are unchanged");
check(policies.includes("Reset every box-type trim margin to the shipped defaults?")
  && policies.indexOf("if(!window.confirm(\"Reset every box-type trim") < policies.indexOf("setBoxTrim(fresh);")
  && policies.includes("setItem('cbb_boxtrim',JSON.stringify(fresh));")
  && policies.includes("Delete the Partitions Master row ["),
  "SS-11 Reset to Defaults and Partitions delete now confirm before writing, still through persist.js");
check(policies.includes("+ Add sector ▾") && policies.includes("<details"),
  "SS-12 the Add sector form sits in a disclosure");

// ── Rate Masters ─────────────────────────────────────────────────────────
check(count(rates, /buildBlanketConfirm\(\{kind:/g) === 3
  && rates.includes('buildBlanketConfirm({kind:"recalc",label:"GY prices",')
  && rates.includes('buildBlanketConfirm({kind:"set",label:"Discount",')
  && rates.includes('buildBlanketConfirm({kind:"set",label:"Paper Credit%",')
  && count(rates, /if\(!_c\.actionable\)\{showToast\(_c\.text,["']info["'],5000\);return;\}/g) === 3
  && count(rates, /if\(!window\.confirm\(_c\.text\)\)return;/g) === 3
  && rates.includes("const _hits=gyAffected(rates,gyPremLow,gyPremHigh);"),
  "SS-13 all three blanket operations keep buildBlanketConfirm exactly: computed before the write, confirm or explain");
check(rates.includes("Price rules ▾") && rates.includes("+ New grade ▾")
  && rates.indexOf("Price rules ▾") < rates.indexOf('label:"GY prices"')
  && !rates.includes("<SummaryRow"),
  "SS-14 Price rules and New grade are toolbar disclosures, so the rate table leads");
check(rates.includes("Fix 6: count constructions using this grade before deleting")
  && rates.includes("if(window.confirm(msg))setRates(prev=>prev.filter((_,j)=>j!==i));"),
  "SS-15 the grade delete still counts constructions and confirms");

// ── Freight Masters ──────────────────────────────────────────────────────
check(freight.includes("+ Add location ▾")
  && freight.indexOf("if(!window.confirm(`Delete delivery location [${loc}]?") < freight.indexOf("setLocations(prev=>prev.filter(l=>l!==loc));"),
  "SS-16 Freight: Add location is a disclosure and deleting a location confirms first");

// ── Role-label gating: wording corrected, gate recorded as debt ──────────
check([policies, rates, freight].every(src => !/Switch to Admin/.test(src)
  && src.includes('role==="admin"') && src.includes("editing needs an administrator account")),
  "SS-17 no screen promises a 'Switch to Admin' control that does not exist; the role gate itself is unchanged debt");

// ── Users & Access: capability-bearing ───────────────────────────────────
check(shell.includes('tab==="users"&&hasCapability(profile,"administer_users")&&<UserManagementTab'),
  "SS-18 Users & Access still mounts only for administer_users");
check(users.includes("setCapabilitiesBody(user.content_version, edited.group, edited.plant)")
  && users.includes("setStatusBody(user.content_version, !user.active)")
  && users.includes("confirmCapabilityChange(user.display_name, current, edited)")
  && users.includes("if (wouldStrandAdmins) { showToast(")
  && users.includes("disabled={busy || isSelf} onClick={changeStatus}")
  && users.includes("You cannot deactivate your own account.</span>"),
  "SS-19 versioned writes, confirms, the last-administrator refusal and the self-deactivation block are unchanged, with a visible reason");
check(users.includes("<RowDisclosure open={open}") && users.includes("colSpan={6}")
  && users.indexOf("<CapabilityMatrix") > users.indexOf("{open && (")
  && !users.includes('display: "flex", gap: 6, flexWrap: "wrap" }}>\n          <button disabled={busy} onClick={() => setOpen'),
  "SS-20 account actions and the permission editor are one row disclosure away, not a wrapped button cell");
check(users.includes("{orphansOpen && <AuthOrphansPanel embedded")
  && orphans.includes("embedded = false") && orphans.includes("{!embedded && <button")
  && orphans.includes("if (embedded) Promise.resolve().then(load);"),
  "SS-21 the unattached-account list mounts only while its disclosure is open, so each open re-reads it");
check(count(users, /apiFetch\(/g) === 8 && count(orphans, /apiFetch\(/g) === 2 && count(plants, /apiFetch\(/g) === 2,
  "SS-22 no request was added (8 / 2 / 2 apiFetch calls, as before the rewrite) to Users & Access, the recovery list or Producing Plants");

// ── Producing Plants ─────────────────────────────────────────────────────
check(plants.includes("{assignedNames && <th") && plants.includes('others.length ? others.join(", ") : "nobody"')
  && plants.includes("if (!isActive || !isAdministrator) return;")
  && plants.includes('mine.length ? mine.join(", ") : "No access"'),
  "SS-23 Plants: own access and assigned people are separate one-line columns; 'nobody' stays distinct from not available, admin-only");

console.log(`\n${passes} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
console.log("Screen-space standard fixture gate PASS");
