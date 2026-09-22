// ═══════════════════════════════════════════════════════════════════════════
// scripts/screen-standard-fixtures.mjs — the shared screen-space standard on
// Commercial Policies, Rate Masters, Freight Masters, Users & Access and
// Producing Plants, then GSM Master, Customer Families and the Pricing Basis
// drill-down tables (2026-09-16). SS-31+ bring the Batch Builder grid onto the
// same standard (2026-09-18) and keep the app light-only.
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
const gsm = read("src/tabs/GsmMasterScreen.jsx");
const families = read("src/tabs/CustomerFamiliesScreen.jsx");
const pricingBasis = read("src/tabs/PricingBasisScreen.jsx");
const chrome = read("src/ui/screenChrome.jsx");
const batchGrid = read("src/tabs/batch/BatchGrid.jsx");
const batchEntry = read("src/tabs/batch/BatchEntryTab.jsx");
const styles = read("src/ui/styles.js");
const css = read("src/index.css");

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
// SS-6 CHANGED, 2026-09-22: Sector Defaults is no longer browser state, so
// Commercial Policies states provenance PER SECTION - governed for Sectors,
// local for Box Trim and Partitions, which still have no governed table.
check(policies.includes('<ProvenanceTag kind={active.provenance} />')
  && policies.includes('provenance: "governed"') && policies.includes('provenance: "local"')
  && [rates, freight].every(src => src.includes('<ProvenanceTag kind="local" />'))
  && users.includes('<ProvenanceTag kind="governed" />') && plants.includes('<ProvenanceTag kind="governed" />'),
  "SS-6 Commercial Policies states provenance per section; Rates and Freight say Local; Users and Plants say Governed");
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
// SS-10 CHANGED, 2026-09-22: Commercial Policies became the GOVERNED Sector
// master. The two behaviours this gate used to assert were properties of the
// retired browser-local list and cannot exist any more:
//   * the code-rename lock ("editable while unreferenced") - a governed Sector
//     code is PERMANENT, because Costing resolves a Sector by it and there is
//     no governed rename-the-code operation to expose;
//   * the delete confirm - no Family D table has a DELETE policy (CDM-31), so
//     deactivation is the only exit.
// The gate now asserts the governed invariants that replaced them, including
// that no local sector mutation survives anywhere on the screen.
check(policies.includes("A Sector code is permanent.")
  && policies.includes("deactivateSectorConfirmMessage")
  && policies.includes("Deactivate") && policies.includes("Reactivate")
  && !policies.includes("setSectors(")
  && !policies.includes("Code locked"),
  "SS-10 the Sector code is permanent and a Sector is deactivated, never deleted");
check(policies.includes('runMutation("/masters/sectors"')
  && policies.includes("/masters/sectors/${row.id}/commercials")
  && !policies.includes(".table(") && !policies.includes(".rpc("),
  "SS-10b every Sector write goes through a governed backend route, never direct SQL");
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

// ── GSM Master (Product Owner: every grid table follows this approach) ────
check(count(gsm, /role="toolbar"/g) === 1 && gsm.includes("denseTable") && gsm.includes("frozenCell(false, true)")
  && gsm.includes("height: 26") && !gsm.includes(">GSM Master</div>") && gsm.includes('<ProvenanceTag kind="governed" />')
  && !/fontSize: ?(?!T\.)[0-9]/.test(gsm),
  "SS-24 GSM Master: one toolbar, dense rows with the GSM frozen, no page header, provenance in the footer");
check((gsm.match(/<CapabilityGate profile=\{profile\} capability=\{MANAGE\}>/g) || []).length === 2
  && gsm.includes("window.confirm(gsmStatusConfirmMessage") && gsm.includes('runMutation("/masters/gsm-values"')
  && gsm.indexOf("+ Add GSM ▾") > gsm.indexOf("<CapabilityGate profile={profile} capability={MANAGE}>"),
  "SS-25 GSM Master: add, retire and restore keep their capability gates and confirm; Add is a gated disclosure");

// ── Customer Families ────────────────────────────────────────────────────
check(count(families, /role="toolbar"/g) === 2 && !families.includes(">Customer Families</div>")
  && families.includes("useSplitPanels(30)") && families.includes('resetLabel="30 : 70"')
  && families.includes('<PanelFocusToggle panel="list"') && families.includes('<PanelFocusToggle panel="detail"')
  && chrome.includes('resetLabel = "50 : 50"') && !/requestFullscreen/.test(families),
  "SS-26 Customer Families: list and detail panels, one toolbar each, a divider that tells the truth about its reset");
check(count(families, /frozenCell\(false, true\)/g) === 2 && families.includes("height: 26")
  && !families.includes('padding: "7px 10px", borderRadius: 7, marginBottom: 6')
  && !families.includes("minWidth: 820"),
  "SS-27 Customer Families: Families and Customers/Prospects are dense tables with the code frozen, not cards or a clipped wide table");
check(count(families, /runMutation\(/g) === 16 && count(families, /openModal\(\{ kind/g) === 10
  && families.includes("<CapabilityGate profile={profile} capability={CREATE_CAPS}>\n            <details")
  && families.includes("addFamilySectorBody(newSectorId, family.content_version)")
  && families.includes("FIRST / BATCH SUGGESTION") && families.includes("Every Customer Family requires at least one Sector"),
  "SS-28 Customer Families: every governed call, modal, gate and Sector rule is unchanged; + Family / + Prospect share one CREATE_CAPS gate");
check(families.includes("function LocationsList({ party, locations, locationVersions, profile, currentFamilyId, openModal })")
  && !families.includes("defaultExpanded") && families.includes('<ProvenanceTag kind="governed" />'),
  "SS-29 Customer Families: a Party's Locations and References open directly from the row, not behind a second disclosure");

// ── Pricing Basis drill-down tables ──────────────────────────────────────
check(count(pricingBasis, /\.\.\.denseTable, minWidth/g) === 3 && pricingBasis.includes("function Head({ children })")
  && pricingBasis.includes("style={{ ...denseCell, color: C.slateM, fontWeight: emphasis ? 800 : 500 }}")
  && !pricingBasis.includes('fontSize: 8.5, color: C.slateL }}>'),
  "SS-30 Pricing Basis: the Rate, Freight and interest drill-down tables use dense one-line rows");

// ── Batch Builder grid (2026-09-18) ──────────────────────────────────────
// Browser-measured at 1440x900, fixture-browser: rows 41 -> 26px, grid toolbar
// 53 -> 43px, table header 39 -> 20px, Delivery Group band 33 -> 27px. The
// Batch Profile bar above the grid is deliberately untouched.
// 2026-09-22: the local `gap:8` override is gone. The shared toolbar's own gap
// is 6, and at the beta 1366px width those two extra pixels across seven gaps
// were part of what wrapped this toolbar onto a second row. Only the override
// was dropped; the shared token and the pinned line-height are unchanged.
check(batchGrid.includes('role="toolbar" aria-label="Batch Builder grid controls" style={{...toolbar,lineHeight:1.3}}')
  && !batchGrid.includes("{...toolbar,gap:8")
  && batchGrid.includes('import { iconButton, toolbar } from "../../ui/screenStandards.js"')
  && !batchGrid.includes('padding:"8px 12px"'),
  "SS-31 Batch Builder: the grid toolbar is the shared 43px toolbar, with its line-height pinned");
check(batchGrid.includes("onClick={onToggleFocusMode}") && batchGrid.includes("style={iconButton(focusMode)}")
  && batchGrid.includes("{focusMode?<CollapseIcon size={14}/>:<ExpandIcon size={14}/>}")
  && batchGrid.includes('aria-label={focusMode?"Collapse the grid":"Expand the grid"}')
  && !/>\s*\{?\s*focusMode\?"Exit focus":"Focus mode"/.test(batchGrid)
  && !/requestFullscreen|fullscreenElement/.test(batchGrid + batchEntry),
  "SS-32 Batch Builder: focus mode is the shared expand / collapse icon, not a text button, inside the app window only");
check(batchEntry.includes("setSidebarCollapsed(true)") && batchEntry.includes("setSidebarCollapsed(sidebarBeforeFocus.current)")
  && batchEntry.includes("onExpandedChange={toggleFocusMode}"),
  "SS-33 Batch Builder: the icon drives the SAME focus handler - navigation collapse and restore are unchanged");
check(styles.includes("export const compactGridRowSt={height:26};")
  && batchGrid.includes('<table style={{borderCollapse:"collapse",fontSize:T.body,lineHeight:1.3,minWidth:1400,width:"100%"}}>')
  && batchGrid.includes('padding:"4px 5px",color:C.white,fontSize:T.label,fontWeight:600,'),
  "SS-34 Batch Builder: compact rows are 26px, with the grid's line-height pinned and a one-line header");
const compact = batchGrid.slice(batchGrid.indexOf("<tr style={{...compactGridRowSt"),
  batchGrid.indexOf("{expandedRows.has(row.id)&&(()=>{"));
check(compact.length > 1000 && !compact.includes('<td style={{padding:"3px 4px"')
  && !compact.includes('flexDirection:"column",alignItems:"center",gap:1')
  && batchGrid.includes('<div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:1}}>'),
  "SS-35 Batch Builder: no compact-row cell is taller than one line - the Status icon and chevron sit side by side");
check(batchGrid.indexOf("onClick={startNewBatch}") < batchGrid.indexOf("onClick={onToggleFocusMode}")
  && batchGrid.includes("onClick={copyCostingToProfile}") && batchGrid.includes("Code tools ▾"),
  "SS-36 Batch Builder: Import profile, New batch and Code tools keep their places in the grid toolbar");

// ── Light only ────────────────────────────────────────────────────────────
check(css.includes("  color-scheme: light;\n") && !css.includes("color-scheme: light dark")
  && !css.includes("prefers-color-scheme: dark") && !css.includes("#social .button-icon"),
  "SS-37 the app is light-only: no dark color-scheme, so a dark-mode OS cannot paint inputs white-on-white");


console.log(`\n${passes} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
console.log("Screen-space standard fixture gate PASS");
