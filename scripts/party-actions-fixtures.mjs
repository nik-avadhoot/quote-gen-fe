// ═══════════════════════════════════════════════════════════════════════════
// scripts/party-actions-fixtures.mjs — npm run test:party-actions
//
// U1 Slice A Party editing, frontend proof (docs/u1-customer-foundation-
// authorization-packet.md, Slice A). Same convention as
// customer-family-actions-fixtures.mjs: no DOM/UI test harness in this repo,
// so the testable surface is the pure request-body builder in
// lib/partyActions.js.
// ═══════════════════════════════════════════════════════════════════════════
import { updatePartyBody } from "../src/lib/partyActions.js";

let fails = 0;
const ok = (name, cond, extra = "") => {
  if (!cond) { fails++; console.log(`FAIL  ${name}${extra ? "  " + extra : ""}`); }
  else console.log(`ok    ${name}`);
};
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

ok("update: trims whitespace and carries the CAS token",
   eq(updatePartyBody("  Acme Boxes Ltd  ", 3), { display_name: "Acme Boxes Ltd", expected_content_version: 3 }));

ok("update: an empty/whitespace-only name still round-trips as an empty string (server refuses it, not this helper)",
   eq(updatePartyBody("   ", 3), { display_name: "", expected_content_version: 3 }));

ok("update: a missing name is treated the same as blank",
   eq(updatePartyBody(undefined, 3), { display_name: "", expected_content_version: 3 }));

console.log();
console.log(fails === 0 ? "all checks pass" : `${fails} FAILED`);
process.exit(fails === 0 ? 0 : 1);
