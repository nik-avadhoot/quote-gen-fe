// ═══════════════════════════════════════════════════════════════════════════
// scripts/sector-actions-fixtures.mjs — npm run test:sector-actions
//
// U5 governed Sector master, frontend proof. Same convention as
// customer-family-actions-fixtures.mjs: this repo has no DOM/UI test harness
// (see CLAUDE.md), so the testable surface is the PURE logic split out of
// DefaultsTab.jsx into lib/sectorActions.js, plus source-shape assertions on
// the screen and the state slice for the rules that live nowhere else.
//
// WHAT A GREEN RUN HAS TO MEAN. Every request-body case names the exact key
// the corresponding Flask route (server.py /masters/sectors*) reads and the
// exact key the governed RPC expects — a wrong key here is a silent 400 or a
// parameter Flask ignores, not a crash.
//
// THE DEFECT THIS SLICE EXISTS TO CLOSE. A Sector added in Commercial
// Policies used to land in a browser-local `cbb_sectors` list that no other
// screen read, so it never appeared in the Customer Families dropdown, which
// reads the governed `public.sectors` table. The last group of checks asserts
// that the local list is genuinely gone and cannot come back as a silent
// fallback — the one thing that would reintroduce the original bug.
// ═══════════════════════════════════════════════════════════════════════════
import {
  COMMERCIAL_FIELDS, commercialsAreDirty, deactivateSectorConfirmMessage, marginIsMissing,
  nameIsDirty, proposeSectorBody, reactivateSectorConfirmMessage, renameSectorBody,
  reviseConfirmMessage, reviseSectorCommercialsBody, sectorCodeIsBlank, sectorNameIsBlank,
  sectorRowFromApi, sectorRowsFromApi, setSectorStatusBody,
} from "../src/lib/sectorActions.js";
import { readFileSync } from "node:fs";

let fails = 0;
const ok = (name, cond, extra = "") => {
  if (!cond) { fails++; console.log(`FAIL  ${name}${extra ? "  " + extra : ""}`); }
  else console.log(`ok    ${name}`);
};
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ── request-body shapes — one per route, exact keys only ───────────────────

const draft = { code: " explosives ", name: "  Explosives & Defence  ",
  wasteCBB: 5, wastePP: 5, convBox: 7, convPP: 10, margin: 8, specLang: " BCT+BS " };

ok("propose: upper-cases and trims the code, trims the name, sends all six commercials",
   eq(proposeSectorBody(draft), {
     sector_code: "EXPLOSIVES", name: "Explosives & Defence",
     waste_cbb_pct: 5, waste_pp_pct: 5, conv_box_rate: 7, conv_pp_rate: 10,
     margin_pct: 8, spec_lang: "BCT+BS",
   }));

ok("revise: carries the version the operator read as the CAS token",
   eq(reviseSectorCommercialsBody(draft, 3), {
     expected_version_no: 3,
     waste_cbb_pct: 5, waste_pp_pct: 5, conv_box_rate: 7, conv_pp_rate: 10,
     margin_pct: 8, spec_lang: "BCT+BS",
   }));

// Blank waste/conversion means "inherit the calculation default" (CDM-19) and
// must reach the server as null, NOT as 0 — 0 is a real, different value that
// several Sectors legitimately use for P&P conversion.
ok("blank waste/conversion is sent as null, never coerced to zero",
   eq(proposeSectorBody({ code: "X", name: "X", wasteCBB: "", wastePP: null,
                          convBox: "", convPP: 0, margin: 8, specLang: "" }), {
     sector_code: "X", name: "X",
     waste_cbb_pct: null, waste_pp_pct: null, conv_box_rate: null, conv_pp_rate: 0,
     margin_pct: 8, spec_lang: "",
   }));

ok("rename: sends only the display name", eq(renameSectorBody("  Paints  "), { name: "Paints" }));
ok("status: sends exactly the status word", eq(setSectorStatusBody("inactive"), { status: "inactive" }));

// ── validation pre-checks (usability only; the DB is the authority) ────────

ok("a blank or whitespace-only code is not proposable",
   sectorCodeIsBlank("") && sectorCodeIsBlank("   ") && sectorCodeIsBlank(null)
   && !sectorCodeIsBlank("EXPLOSIVES"));
ok("a blank or whitespace-only name is not proposable",
   sectorNameIsBlank("") && sectorNameIsBlank("  ") && !sectorNameIsBlank("Explosives"));

// margin_pct is NOT NULL by the Sector Margin ruling: blank is not a state a
// Sector can be in, unlike waste and conversion which inherit when blank.
ok("a missing margin is refused, but zero is a real margin",
   marginIsMissing("") && marginIsMissing(null) && marginIsMissing(undefined)
   && marginIsMissing("abc") && !marginIsMissing(0) && !marginIsMissing("8"));

// ── normalisation: API shape -> the flat row the grid and engine read ──────

const apiSector = {
  id: 7, sector_code: "PAINTS", name: "Paints / Decorative", status: "active",
  version: { id: 91, version_no: 2, waste_cbb_pct: 5, waste_pp_pct: 5,
             conv_box_rate: 7, conv_pp_rate: 10, margin_pct: 8, spec_lang: "ECT+BS" },
};
const row = sectorRowFromApi(apiSector);
ok("normalisation lifts the approved version's values onto the row",
   row.code === "PAINTS" && row.versionNo === 2 && row.margin === 8
   && row.convPP === 10 && row.specLang === "ECT+BS" && row.unversioned === false);

// An active Sector with no approved version cannot resolve in Costing. That is
// a broken master, and it must be visible rather than silently rendered as a
// row of blanks.
ok("a Sector with no approved version is flagged, not quietly blanked",
   sectorRowFromApi({ id: 8, sector_code: "X", name: "X", status: "active", version: null })
     .unversioned === true);

ok("rows come back sorted by code so the grid order never depends on PostgREST",
   eq(sectorRowsFromApi([
     { id: 2, sector_code: "ZINC", name: "Z", status: "active", version: null },
     { id: 1, sector_code: "ALCOBEV", name: "A", status: "active", version: null },
   ]).map(r => r.code), ["ALCOBEV", "ZINC"]));

// ── dirty tracking — a rename must not arm the commercial Save ─────────────
//
// An approved sector_version is immutable (CDM-31), so Save mints a NEW
// version. If a pending NAME edit armed that button the screen would mint a
// version whose six commercial values are identical to the one it supersedes.

ok("the six commercial fields are the unit of a version", eq(COMMERCIAL_FIELDS,
   ["wasteCBB", "wastePP", "convBox", "convPP", "margin", "specLang"]));
ok("a changed commercial value is dirty",
   commercialsAreDirty({ ...row, convBox: 9 }, row));
ok("a changed NAME is not a commercial change",
   !commercialsAreDirty({ ...row, name: "Renamed" }, row) && nameIsDirty({ ...row, name: "Renamed" }, row));
ok("a value retyped identically as a string is not dirty",
   !commercialsAreDirty({ ...row, convBox: "7" }, row));
ok("clearing a value to blank IS dirty (it changes inherit-vs-stored)",
   commercialsAreDirty({ ...row, wastePP: "" }, row));

// ── confirm copy — names the entity and states what the schema makes true ──

const deactivate = deactivateSectorConfirmMessage("Paints / Decorative");
ok("deactivate copy names the Sector and does not promise a delete",
   deactivate.includes("Paints / Decorative") && deactivate.includes("never deleted")
   && !/\bdelete\b/i.test(deactivate.replace("never deleted", "")));
ok("reactivate copy names the Sector",
   reactivateSectorConfirmMessage("Paints / Decorative").includes("Paints / Decorative"));
const revise = reviseConfirmMessage("Paints / Decorative", 2);
ok("revise copy names the version it approves and the one it supersedes",
   revise.includes("version 3") && revise.includes("supersedes version 2")
   && revise.includes("never edited in place"));

// ── the original defect must stay closed ───────────────────────────────────

const policies = readFileSync(new URL("../src/tabs/DefaultsTab.jsx", import.meta.url), "utf8");
const masters = readFileSync(new URL("../src/state/useMastersState.js", import.meta.url), "utf8");
const governed = readFileSync(new URL("../src/state/useGovernedSectors.js", import.meta.url), "utf8");
const provider = readFileSync(new URL("../src/state/AppStateProvider.jsx", import.meta.url), "utf8");

ok("Commercial Policies writes Sectors only through governed backend routes",
   policies.includes('runMutation("/masters/sectors"')
   && policies.includes("/masters/sectors/${row.id}/commercials")
   && policies.includes("/masters/sectors/${row.id}/status")
   && !policies.includes(".table(") && !policies.includes(".rpc("));

ok("Sector editing is gated on the two capabilities the database itself requires",
   policies.includes('hasCapability(profile,"propose_commercial_master")')
   && policies.includes('hasCapability(profile,"approve_commercial_master")')
   && policies.includes("const canEditSectors="));

// The U1 rule: a NEW capability check may never be satisfied by a role string.
ok("the Sector section does not fall back to the derived role label",
   !/canEditSectors\s*=\s*[^;]*isAdmin/.test(policies));

ok("the browser-local sector list is gone from state, with no silent fallback",
   !masters.includes("const[sectors,setSectors]") && !masters.includes("setItem('cbb_sectors'")
   && !masters.includes("DEFAULT_SECTORS_DATA.find")
   && governed.includes("No local list was substituted."));

ok("the governed slice replaces sectors/sectorCodes for every consumer",
   governed.includes("return { governedSectorState") && governed.includes("sectorCodes, sectors }")
   && provider.includes("useGovernedSectors(st)"));

// Ordering is load-bearing: useBatchState reads sectorCodes, so the governed
// slice must be composed above it or the picker reads an undefined list.
ok("the governed slice is composed before the batch slice that consumes it",
   provider.indexOf("useGovernedSectors(st)") < provider.indexOf("useBatchState(st)"));

ok("Costing's sector tier now receives marginPct, which the local list never had",
   governed.includes("marginPct: version?.margin_pct"));

ok("an inactive Sector is excluded from what Costing and the pickers resolve",
   governed.includes('row.status === "active"'));

console.log();
console.log(fails === 0 ? "all checks pass" : `${fails} FAILED`);
process.exit(fails === 0 ? 0 : 1);
