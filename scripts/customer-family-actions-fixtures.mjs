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
  groupExternalReferencesByParty, externalRefKindLabel, EXTERNAL_REF_KIND_LABELS,
  familyNameIsBlank,
  proposeFamilyBody, createProspectBody, updateFamilyNameBody, approveFamilyBody,
  addFamilySectorBody, addAliasBody, updateAliasBody, retireAliasBody, mergeBody,
  reassignBody, graduateBody,
  mergeConfirmMessage, reassignConfirmMessage, graduateConfirmMessage, retireAliasConfirmMessage,
  effectiveDatePrecedesMembership,
} from "../src/lib/customerFamilyActions.js";
import { readFileSync } from "node:fs";

let fails = 0;
const ok = (name, cond, extra = "") => {
  if (!cond) { fails++; console.log(`FAIL  ${name}${extra ? "  " + extra : ""}`); }
  else console.log(`ok    ${name}`);
};
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ── request-body shapes — one per route, exact keys only ───────────────────

ok("propose: trims whitespace and includes the required first Sector",
   eq(proposeFamilyBody("  Acme  ", "31"), { name: "Acme", sector_id: 31 }));

// ── D3: a blank Family proposal must be refused visibly, never silently ────
// The button used to LOOK disabled while staying clickable (ui/primitives.jsx
// styled it but never set the DOM `disabled` attribute), so a whitespace-only
// name produced a dead button and no message at all. The screen now derives
// both the disabled state and the inline error from this one predicate.
ok("blank check: empty string is blank", familyNameIsBlank("") === true);
ok("blank check: spaces only is blank", familyNameIsBlank("   ") === true);
ok("blank check: tab/newline only is blank", familyNameIsBlank(String.fromCharCode(9,10,32)) === true);
ok("blank check: a real name is not blank", familyNameIsBlank("Acme") === false);
ok("blank check: a name with surrounding spaces is not blank",
   familyNameIsBlank("  Acme  ") === false);
ok("blank check: undefined is blank (never proposable)", familyNameIsBlank(undefined) === true);
ok("blank check: null is blank (never proposable)", familyNameIsBlank(null) === true);
ok("blank check: a non-string is blank (never proposable)", familyNameIsBlank(42) === true);
ok("blank name and the body builder agree — what the button blocks is exactly what would send empty",
   familyNameIsBlank("   ") === true && proposeFamilyBody("   ").name === "");

ok("prospect: family_id omitted entirely when not given and first Sector retained",
   eq(createProspectBody("Beta Co", null, "31"), { display_name: "Beta Co", sector_id: 31 })
   && !("family_id" in createProspectBody("Beta Co", null)));
ok("prospect: family_id coerced to a number when given (a <select> value is a string)",
   eq(createProspectBody("Beta Co", "7"), { display_name: "Beta Co", family_id: 7 }));
ok("prospect: an empty-string family_id (the placeholder option) is treated as omitted",
   !("family_id" in createProspectBody("Beta Co", "")));

ok("add-sector: carries the selected Sector and Family CAS token",
   eq(addFamilySectorBody("32", 3), { sector_id: 32, expected_content_version: 3 }));

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

// ── U1 external references — read-only presentation ────────────────────────
// Grouping and ordering are the whole testable surface here: there is no body
// builder, because there is no write operation. What must hold is that a
// reference is attributed to the RIGHT Party and that the order does not
// depend on what order the server happened to return rows in.

const XREFS = [
  { id: 3, party_id: 9, ref_kind: "other", ref_value: "zeta" },
  { id: 1, party_id: 9, ref_kind: "legacy_customer_code", ref_value: "OLD-2" },
  { id: 2, party_id: 9, ref_kind: "legacy_customer_code", ref_value: "OLD-1" },
  { id: 4, party_id: 12, ref_kind: "customer_item_ref", ref_value: "ITEM-9" },
];
const grouped = groupExternalReferencesByParty(XREFS);

ok("external refs: grouped under the Party they belong to",
   grouped[9].length === 3 && grouped[12].length === 1);
ok("external refs: a Party with none is simply absent, not an empty key",
   grouped[99] === undefined);
ok("external refs: ordered by kind, then value, then id — not by arrival order",
   grouped[9].map(r => r.id).join(",") === "2,1,3");
ok("external refs: the same rows in a different order group identically",
   JSON.stringify(groupExternalReferencesByParty([...XREFS].reverse())) === JSON.stringify(grouped));
ok("external refs: a row with no party_id is dropped, never guessed onto a Party",
   Object.keys(groupExternalReferencesByParty([{ id: 5, ref_value: "orphan" }])).length === 0);
ok("external refs: an empty or missing payload yields an empty grouping",
   Object.keys(groupExternalReferencesByParty([])).length === 0
   && Object.keys(groupExternalReferencesByParty(undefined)).length === 0);

ok("external refs: every kind the check constraint permits has a readable label",
   externalRefKindLabel("legacy_customer_code") === "Legacy customer code"
   && externalRefKindLabel("customer_item_ref") === "Customer item reference"
   && externalRefKindLabel("other") === "Other");
ok("external refs: the label map covers exactly ck_pxr_kind's three values",
   Object.keys(EXTERNAL_REF_KIND_LABELS).sort().join(",")
     === "customer_item_ref,legacy_customer_code,other");
ok("external refs: an unrecognised kind is shown verbatim, not hidden or relabelled",
   externalRefKindLabel("something_new") === "something_new");
ok("external refs: a missing kind still renders something honest",
   externalRefKindLabel(undefined) === "Unknown");

const familyScreen = readFileSync(
  new URL("../src/tabs/CustomerFamiliesScreen.jsx", import.meta.url), "utf8");
ok("family workspace: proposal requires a first Sector and explains that more may be attached",
   familyScreen.includes("Every Customer Family requires at least one Sector")
   && familyScreen.includes("More Sectors can be attached from the Family workspace"));
ok("family workspace: additional Sector uses only the governed backend route with Family CAS",
   familyScreen.includes("/sectors`")
   && familyScreen.includes("addFamilySectorBody(newSectorId, family.content_version)")
   && !familyScreen.includes(".table(")
   && !familyScreen.includes(".rpc("));
ok("family workspace: all Family Sectors stay distinct from one-Sector Batch guidance",
   familyScreen.includes("A Customer Family needs at least one Sector and may have more")
   && familyScreen.includes("Each Batch uses exactly one attached Sector")
   && familyScreen.includes("FIRST / BATCH SUGGESTION"));
ok("family workspace: an unclassified legacy Family is a visible remediation gap",
   familyScreen.includes("Sector classification required before Family approval or Batch creation")
   && familyScreen.includes("must be classified in the Family workspace"));

console.log();
console.log(fails === 0 ? "all checks pass" : `${fails} FAILED`);
process.exit(fails === 0 ? 0 : 1);
