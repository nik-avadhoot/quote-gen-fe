// ═══════════════════════════════════════════════════════════════════════════
// scripts/customer-family-actions-fixtures.mjs — npm run test:family-actions
//
// U1 Customer Family mutations, frontend proof (docs/u1-customer-family-
// mutations-packet.md §10 "Frontend"). Same convention as
// capabilities-fixtures.mjs: this repo has no DOM/UI test harness (see
// CLAUDE.md), so the testable surface is the PURE logic split out of
// CustomerFamiliesScreen.jsx into lib/customerFamilyActions.js — request-body
// shapes and confirm-dialog copy — not the rendered component itself.
//
// WHAT A GREEN RUN HAS TO MEAN. Every request-body case names the exact key
// the corresponding Flask route (server.py) reads and the exact key the
// governed RPC expects (docs §§1-2/8) — a wrong key here would be a silent
// 400 or a parameter Flask ignores, not a crash. Every confirm-copy case
// names the actual entities involved, not a generic "are you sure?" — the
// binding decision that Merge must say it is irreversible, and that a
// confirmation must name the Parties/Families it acts on, is proved here or
// nowhere, since the copy is invisible to any other gate in this repo.
// ═══════════════════════════════════════════════════════════════════════════
import {
  proposeFamilyBody, createProspectBody, updateFamilyNameBody, approveFamilyBody,
  addAliasBody, updateAliasBody, retireAliasBody, mergeBody, reassignBody, graduateBody,
  mergeConfirmMessage, reassignConfirmMessage, graduateConfirmMessage, retireAliasConfirmMessage,
  effectiveDatePrecedesMembership,
} from "../src/lib/customerFamilyActions.js";

let fails = 0;
const ok = (name, cond, extra = "") => {
  if (!cond) { fails++; console.log(`FAIL  ${name}${extra ? "  " + extra : ""}`); }
  else console.log(`ok    ${name}`);
};
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ── request-body shapes — one per route, exact keys only ───────────────────

ok("propose: trims whitespace and maps to {name}",
   eq(proposeFamilyBody("  Acme  "), { name: "Acme" }));

ok("prospect: family_id omitted entirely when not given",
   eq(createProspectBody("Beta Co", null), { display_name: "Beta Co" })
   && !("family_id" in createProspectBody("Beta Co", null)));
ok("prospect: family_id coerced to a number when given (a <select> value is a string)",
   eq(createProspectBody("Beta Co", "7"), { display_name: "Beta Co", family_id: 7 }));
ok("prospect: an empty-string family_id (the placeholder option) is treated as omitted",
   !("family_id" in createProspectBody("Beta Co", "")));

ok("update-name: carries both the new name and the CAS token",
   eq(updateFamilyNameBody("Acme Renamed", 3), { name: "Acme Renamed", expected_content_version: 3 }));

ok("approve: carries only the CAS token",
   eq(approveFamilyBody(3), { expected_content_version: 3 }));

ok("add-alias: trims and maps to {alias}",
   eq(addAliasBody("  Acme Corp  "), { alias: "Acme Corp" }));

ok("update-alias: carries the new alias and the CAS token",
   eq(updateAliasBody("Acme Corp Ltd", 1), { alias: "Acme Corp Ltd", expected_content_version: 1 }));

ok("retire-alias: carries only the CAS token",
   eq(retireAliasBody(1), { expected_content_version: 1 }));

ok("merge: names both sides' ids AND both sides' CAS tokens (dual-sided CAS, binding decision 1)",
   eq(mergeBody(7, 8, 3, 1), {
     survivor_id: 7, retired_id: 8, expected_survivor_version: 3, expected_retired_version: 1,
   }));

ok("reassign: effective_date omitted when not supplied — the server defaults to today",
   eq(reassignBody(9, 8, 2, undefined), { party_id: 9, new_family_id: 8, expected_content_version: 2 }));
ok("reassign: effective_date forwarded verbatim when supplied",
   eq(reassignBody(9, 8, 2, "2026-09-10"),
      { party_id: 9, new_family_id: 8, expected_content_version: 2, effective_date: "2026-09-10" }));

ok("graduate: carries only party_id — no CAS, the operation is idempotent",
   eq(graduateBody(9), { party_id: 9 }));

// ── confirm-dialog copy — must name the actual entities, not a placeholder ─

const mergeMsg = mergeConfirmMessage("Acme Group", "Acme Trading Co");
ok("merge confirm: names the survivor", mergeMsg.includes("Acme Group"));
ok("merge confirm: names the entity being retired", mergeMsg.includes("Acme Trading Co"));
ok("merge confirm: states irreversibility explicitly — no un-merge operation exists",
   /cannot be undone/i.test(mergeMsg));
ok("merge confirm: tells the user what happens to the retired name (kept as an alias)",
   /alias/i.test(mergeMsg));

const reassignMsg = reassignConfirmMessage("Beta Co", "Acme Group", "Gamma Holdings");
ok("reassign confirm: names the party", reassignMsg.includes("Beta Co"));
ok("reassign confirm: names the source family", reassignMsg.includes("Acme Group"));
ok("reassign confirm: names the destination family", reassignMsg.includes("Gamma Holdings"));

const graduateMsg = graduateConfirmMessage("Beta Co");
ok("graduate confirm: names the party", graduateMsg.includes("Beta Co"));
ok("graduate confirm: mentions the permanent Customer Code being minted",
   /customer code/i.test(graduateMsg));

const retireAliasMsg = retireAliasConfirmMessage("Acme Corp");
ok("retire-alias confirm: names the alias being retired", retireAliasMsg.includes("Acme Corp"));

// ── effective-date usability pre-check — a hint only, server stays authoritative ─

ok("effective date before the current membership's start is flagged",
   effectiveDatePrecedesMembership("2026-01-01", "2026-06-01") === true);
ok("effective date on the current membership's start date is NOT flagged (matches, not before)",
   effectiveDatePrecedesMembership("2026-06-01", "2026-06-01") === false);
ok("effective date after the current membership's start is not flagged",
   effectiveDatePrecedesMembership("2026-09-01", "2026-06-01") === false);
ok("a missing effective date never flags (nothing to compare)",
   effectiveDatePrecedesMembership("", "2026-06-01") === false);
ok("a missing membership start date never flags (nothing to compare)",
   effectiveDatePrecedesMembership("2026-01-01", "") === false);

console.log();
console.log(fails === 0 ? "all checks pass" : `${fails} FAILED`);
process.exit(fails === 0 ? 0 : 1);
