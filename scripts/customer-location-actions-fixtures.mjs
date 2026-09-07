// ═══════════════════════════════════════════════════════════════════════════
// scripts/customer-location-actions-fixtures.mjs — npm run test:location-actions
//
// U1 Slice C Customer Location proposal/version/approval/retirement, frontend
// proof (docs/u1-customer-foundation-authorization-packet.md, Slice C). Same
// convention as customer-family-actions-fixtures.mjs / party-actions-fixtures.mjs:
// no DOM/UI test harness in this repo, so the testable surface is the pure
// logic in lib/customerLocationActions.js.
// ═══════════════════════════════════════════════════════════════════════════
import {
  proposeLocationBody, updateLocationBody, approveLocationBody, retireLocationBody,
  retireLocationConfirmMessage, hasIncompleteDetails,
} from "../src/lib/customerLocationActions.js";

let fails = 0;
const ok = (name, cond, extra = "") => {
  if (!cond) { fails++; console.log(`FAIL  ${name}${extra ? "  " + extra : ""}`); }
  else console.log(`ok    ${name}`);
};
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ── propose: eligibility is the ONLY thing fixed at this call, per the
// narrowed Slice C scope — no eligibility-change body builder exists ────────

ok("propose: builds the full body, trims text fields, nulls out blanks",
   eq(proposeLocationBody({ locationType: "plant", addressText: "  1 Industrial Ave  ",
     contactName: "  A  ", notes: "", billToEligible: true, shipToEligible: false }),
     { location_type: "plant", address_text: "1 Industrial Ave", contact_name: "A",
       notes: null, bill_to_eligible: true, ship_to_eligible: false }));

ok("propose: an unset locationType is null, not an empty string",
   proposeLocationBody({ billToEligible: true, shipToEligible: false }).location_type === null);

ok("propose: both eligibility flags coerce to booleans, not truthy leftovers",
   eq(proposeLocationBody({ billToEligible: 1, shipToEligible: 0 }),
     { location_type: null, address_text: null, contact_name: null, notes: null,
       bill_to_eligible: true, ship_to_eligible: false }));

// ── update: descriptive detail + CAS only — no eligibility, no location_type ─

ok("update: carries the CAS token and trims text, no eligibility field exists on this body",
   eq(updateLocationBody({ addressText: " 2 New Ave ", contactName: "B", notes: "n2" }, 3),
     { address_text: "2 New Ave", contact_name: "B", notes: "n2", expected_content_version: 3 })
   && !("bill_to_eligible" in updateLocationBody({}, 3))
   && !("ship_to_eligible" in updateLocationBody({}, 3))
   && !("location_type" in updateLocationBody({}, 3)));

ok("approve: carries only the CAS token", eq(approveLocationBody(2), { expected_content_version: 2 }));
ok("retire: carries only the CAS token", eq(retireLocationBody(2), { expected_content_version: 2 }));

// ── confirm copy ─────────────────────────────────────────────────────────

const retireMsg = retireLocationConfirmMessage("C-009-01");
ok("retire confirm: names the Location", retireMsg.includes("C-009-01"));
ok("retire confirm: says what retirement means for selection, not a generic warning",
   /Bill-to or Ship-to/i.test(retireMsg));

// ── incomplete-details indicator (CDM-08: "details may remain incomplete") ──

ok("incomplete: no current version at all counts as incomplete",
   hasIncompleteDetails(null) === true);
ok("incomplete: a version with every descriptive field blank is incomplete",
   hasIncompleteDetails({ address_text: null, contact_name: null, notes: null }) === true);
ok("incomplete: a version with just an address is NOT incomplete",
   hasIncompleteDetails({ address_text: "1 Ave", contact_name: null, notes: null }) === false);
ok("incomplete: a version with just a contact name is NOT incomplete",
   hasIncompleteDetails({ address_text: null, contact_name: "A", notes: null }) === false);

console.log();
console.log(fails === 0 ? "all checks pass" : `${fails} FAILED`);
process.exit(fails === 0 ? 0 : 1);
