// ═══════════════════════════════════════════════════════════════════════════
// scripts/user-access-fixtures.mjs — npm run test:user-access
//
// U1 Users/Access (UA-1 + UA-4) frontend proof. Same convention as the other
// eight gates: no DOM/UI harness in this repo, so the testable surface is the
// pure logic in lib/userAccessActions.js.
//
// The two properties worth most here are negatives: the role label can never
// become an input, and a capability request is always a COMPLETE, canonical,
// versioned replacement — because the alternative is silently revoking the nine
// capabilities the old role editor could not represent.
// ═══════════════════════════════════════════════════════════════════════════
import {
  GROUP_CAPABILITIES, PLANT_CAPABILITIES,
  canonicalGroupSet, canonicalPlantMap, capabilityChangeSummary,
  confirmCapabilityChange, deriveRoleLabel, isGroupCapability, isPlantCapability,
  lastAdministratorMessage, removesLastAdministrator, sameCapabilityState,
  setCapabilitiesBody, staleCapabilityMessage,
} from "../src/lib/userAccessActions.js";
import * as UA from "../src/lib/userAccessActions.js";

let fails = 0;
const ok = (name, cond, extra = "") => {
  if (!cond) { fails++; console.log(`FAIL  ${name}${extra ? "  " + extra : ""}`); }
  else console.log(`ok    ${name}`);
};
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ── the catalogue is pinned to public.capabilities ────────────────────────
//
// Read from the database (capability_key, scope_kind), not invented. Slice D's
// live 500 came from a hand-transcribed list the database refused, and a
// capability key is exactly the same kind of value.
const DB_GROUP = ["administer_users", "declare_cutover", "manage_construction_library",
  "manage_customer_master", "read_construction_library", "read_party_master"];
const DB_PLANT = ["adopt_construction_for_plant", "approve_commercial_master", "check_quote",
  "make_quote", "manage_sku_master", "plant_access", "propose_commercial_master"];

ok("catalogue: group capabilities match public.capabilities exactly",
   eq(GROUP_CAPABILITIES.map(c => c.key).sort(), DB_GROUP),
   `got ${JSON.stringify(GROUP_CAPABILITIES.map(c => c.key).sort())}`);
ok("catalogue: plant capabilities match public.capabilities exactly",
   eq(PLANT_CAPABILITIES.map(c => c.key).sort(), DB_PLANT),
   `got ${JSON.stringify(PLANT_CAPABILITIES.map(c => c.key).sort())}`);
ok("catalogue: every capability carries a human label",
   [...GROUP_CAPABILITIES, ...PLANT_CAPABILITIES].every(c => typeof c.label === "string" && c.label));
ok("catalogue: the five capabilities the Product Owner named are all present",
   ["read_party_master", "manage_customer_master", "read_construction_library",
    "manage_construction_library", "declare_cutover"].every(isGroupCapability));
ok("catalogue: the lists are frozen and cannot be mutated by a consumer",
   Object.isFrozen(GROUP_CAPABILITIES) && Object.isFrozen(PLANT_CAPABILITIES));

// ── scope is never crossed: the database refuses it with 22023 ────────────
ok("scope: a group key is not a plant key, and vice versa",
   isGroupCapability("read_party_master") && !isPlantCapability("read_party_master")
   && isPlantCapability("make_quote") && !isGroupCapability("make_quote"));
ok("scope: an unknown key belongs to neither scope",
   !isGroupCapability("not_a_capability") && !isPlantCapability("not_a_capability"));
ok("scope: canonicalisation DROPS a plant key placed in the group set",
   eq(canonicalGroupSet(["read_party_master", "make_quote"]), ["read_party_master"]));
ok("scope: canonicalisation DROPS a group key placed in a plant set",
   eq(canonicalPlantMap({ NAG: ["plant_access", "read_party_master"] }), { NAG: ["plant_access"] }));

// ── canonical form: distinct, sorted, so a reorder is not a change ────────
ok("canonical: duplicates collapse and the result is sorted",
   eq(canonicalGroupSet(["read_party_master", "administer_users", "read_party_master"]),
      ["administer_users", "read_party_master"]));
ok("canonical: plant capability lists are deduplicated and sorted",
   eq(canonicalPlantMap({ NAG: ["make_quote", "plant_access", "make_quote"] }),
      { NAG: ["make_quote", "plant_access"] }));
ok("canonical: plants are sorted by code, so key order never looks like a change",
   eq(Object.keys(canonicalPlantMap({ PUN: ["plant_access"], NAG: ["plant_access"] })),
      ["NAG", "PUN"]));
ok("canonical: a plant with no capabilities is absent, not an empty array",
   eq(canonicalPlantMap({ NAG: ["plant_access"], PUN: [] }), { NAG: ["plant_access"] }));
ok("canonical: null and undefined are empty, never a crash",
   eq(canonicalGroupSet(null), []) && eq(canonicalPlantMap(undefined), {}));

const STATE = { group: ["read_party_master"], plant: { NAG: ["plant_access", "make_quote"] } };
ok("equality: the same state written differently is recognised as unchanged",
   sameCapabilityState(STATE,
     { group: ["read_party_master", "read_party_master"],
       plant: { NAG: ["make_quote", "plant_access"] } }));
ok("equality: a genuine change is not mistaken for no change",
   !sameCapabilityState(STATE,
     { group: ["read_party_master", "manage_customer_master"], plant: STATE.plant }));
ok("equality: dropping a plant is a change",
   !sameCapabilityState(STATE, { group: STATE.group, plant: {} }));

// ── the request body: complete, canonical, versioned ──────────────────────
const body = setCapabilitiesBody(7, ["read_party_master", "make_quote"],
  { NAG: ["plant_access", "make_quote"], PUN: [] });
ok("body: carries expected_content_version",
   body.expected_content_version === 7);
ok("body: both collections are always present — there is no partial-update mode",
   Array.isArray(body.group_capabilities) && typeof body.plant_capabilities === "object"
   && body.plant_capabilities !== null);
ok("body: the group set is canonical and scope-filtered",
   eq(body.group_capabilities, ["read_party_master"]));
ok("body: the plant map is canonical, and an empty plant is omitted",
   eq(body.plant_capabilities, { NAG: ["make_quote", "plant_access"] }));
ok("body: clearing everything sends empty collections, NOT null",
   (() => {
     const b = setCapabilitiesBody(2, [], {});
     return eq(b.group_capabilities, []) && eq(b.plant_capabilities, {})
       && b.group_capabilities !== null && b.plant_capabilities !== null;
   })());
ok("body: carries NO role field — a role can never become an input",
   !("role" in body) && !("plant" in body) && !("plants" in body));

// ── the derived role label is output only ─────────────────────────────────
ok("role label: administer_users reads as Administrator",
   deriveRoleLabel(["administer_users"], {}) === "Administrator");
ok("role label: check_quote at any plant reads as Checker",
   deriveRoleLabel([], { NAG: ["make_quote"], PUN: ["check_quote"] }) === "Checker");
ok("role label: a Maker at one plant and a Checker at another reads as Checker",
   deriveRoleLabel([], { NAG: ["plant_access", "make_quote"],
                         PUN: ["plant_access", "check_quote"] }) === "Checker");
ok("role label: otherwise Maker",
   deriveRoleLabel([], { NAG: ["make_quote"] }) === "Maker"
   && deriveRoleLabel([], {}) === "Maker");
ok("role label: administer_users wins over a plant capability",
   deriveRoleLabel(["administer_users"], { NAG: ["check_quote"] }) === "Administrator");
ok("role label: the module exports NO way to set a role",
   Object.keys(UA).every(k => !/^setRole|^applyRole|roleBody/i.test(k)));

// ── the last-administrator rule, explained before it is refused ───────────
const ADMIN = { id: 1 };
ok("last admin: removing administer_users from the only active administrator is caught",
   removesLastAdministrator(ADMIN, [], [1]) === true);
ok("last admin: it is fine when another active administrator remains",
   removesLastAdministrator(ADMIN, [], [1, 2]) === false);
ok("last admin: keeping administer_users is never a violation",
   removesLastAdministrator(ADMIN, ["administer_users"], [1]) === false);
ok("last admin: a scope-invalid key does not accidentally satisfy the check",
   removesLastAdministrator(ADMIN, ["make_quote"], [1]) === true);
ok("last admin: the message says what to DO, not just that it was refused",
   (() => {
     const m = lastAdministratorMessage();
     return /at least one active administrator/i.test(m) && /Grant administer_users to another/i.test(m);
   })());

// ── confirm copy names the user and the actual delta ──────────────────────
const before = { group: ["read_party_master"], plant: { NAG: ["plant_access"] } };
const after = { group: ["manage_customer_master"], plant: { NAG: ["plant_access", "make_quote"] } };
const summary = capabilityChangeSummary(before, after);
ok("summary: names what is granted and what is revoked",
   eq(summary.granted, ["manage_customer_master"]) && eq(summary.revoked, ["read_party_master"]));
ok("summary: names the plants whose permissions changed",
   eq(summary.plantChanges, ["NAG"]));
ok("summary: an unchanged state reports no delta at all",
   (() => {
     const s = capabilityChangeSummary(STATE, STATE);
     return !s.granted.length && !s.revoked.length && !s.plantChanges.length;
   })());

const confirm = confirmCapabilityChange("R. Sharma", before, after);
ok("confirm: names the user", confirm.includes("R. Sharma"));
ok("confirm: says it replaces the COMPLETE set", /complete permission set/i.test(confirm));
ok("confirm: names the granted and revoked capabilities",
   confirm.includes("manage_customer_master") && confirm.includes("read_party_master"));
ok("confirm: says the database decides access, not the screen",
   /database decides access, not this screen/i.test(confirm));

// ── stale conflict: reload and re-decide, never a silent retry ────────────
const stale = staleCapabilityMessage("R. Sharma");
ok("stale: names the user", stale.includes("R. Sharma"));
ok("stale: says the change came from somewhere else", /somewhere else/i.test(stale));
ok("stale: says the current permissions were reloaded", /reloaded/i.test(stale));
ok("stale: asks the operator to re-decide rather than promising a retry",
   /apply your change again if it is still/i.test(stale) && !/retry/i.test(stale));

console.log();
console.log(fails === 0 ? "all checks pass" : `${fails} FAILED`);
process.exit(fails === 0 ? 0 : 1);
