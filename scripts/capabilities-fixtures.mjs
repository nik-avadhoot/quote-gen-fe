// ═══════════════════════════════════════════════════════════════════════════
// scripts/capabilities-fixtures.mjs — npm run test:capabilities
//
// U1-C2 correction. lib/capabilities.js has NO reachable UI path that proves
// its denial behaviour deliberately: CapabilityGate.jsx hides or disables a
// control, so a wrong "allowed" answer looks like nothing happened rather
// than like a bug. This fixture is the only thing that verifies it.
//
// WHAT A GREEN RUN HAS TO MEAN. Every case names the shape that would have
// answered differently:
//   · a role-based guess (the corrected-away ROLE_IMPLIES fallback) passes
//     the granted cases and FAILS every held-nothing / wrong-plant case,
//     because it invents a capability the profile never actually lists;
//   · a resolver that does not scope by plant code passes the "same
//     capability at another plant" case, which must be denied;
//   · a resolver that treats a missing profile/shape as "nothing to check,
//     so allow" passes the absent-data cases, which must all deny.
//
// Not new authority: RLS is still what actually refuses a request. This
// proves the USABILITY layer agrees with what the profile actually says,
// nothing more.
// ═══════════════════════════════════════════════════════════════════════════
import { assignedUserNamesByPlant, hasCapability, hasCapabilityAtPlant,
  loadAssignedUserNames, ownPlantAccessLabels } from "../src/lib/capabilities.js";

let fails = 0;
const ok = (name, cond, extra = "") => {
  if (!cond) { fails++; console.log(`FAIL  ${name}${extra ? "  " + extra : ""}`); }
  else console.log(`ok    ${name}`);
};

const PROFILE = {
  role: "admin", // deliberately misleading — a role string proves nothing here
  group_capabilities: ["read_party_master"],
  plant_capabilities: { NAG: ["make_quote"], PUN: ["check_quote"] },
};

// ── group capability ──────────────────────────────────────────────────────
ok("a held group capability is granted", hasCapability(PROFILE, "read_party_master") === true);
ok("an unheld group capability is denied", hasCapability(PROFILE, "manage_customer_master") === false);
ok("a role-implied but never-granted capability is denied — administer_users is not in the list",
   hasCapability(PROFILE, "administer_users") === false);

// ── plant-scoped capability ───────────────────────────────────────────────
ok("a capability held at its own plant is granted",
   hasCapabilityAtPlant(PROFILE, "make_quote", "NAG") === true);
ok("the SAME capability at a different plant is denied — wrong-plant must not leak",
   hasCapabilityAtPlant(PROFILE, "make_quote", "PUN") === false);
ok("a capability held at one plant is denied at a plant with no grant at all",
   hasCapabilityAtPlant(PROFILE, "make_quote", "KOL") === false);
ok("a group capability does not satisfy a plant-scoped check",
   hasCapabilityAtPlant(PROFILE, "read_party_master", "NAG") === false);
ok("the flat check still finds a plant-held capability somewhere",
   hasCapability(PROFILE, "check_quote") === true);

// ── absent / malformed data denies, never grants ─────────────────────────
ok("no profile at all denies", hasCapability(null, "make_quote") === false);
ok("no profile at all denies the plant-scoped form too",
   hasCapabilityAtPlant(null, "make_quote", "NAG") === false);
ok("a profile with neither field denies", hasCapability({ role: "admin" }, "make_quote") === false);
ok("a malformed plant_capabilities (not an object) denies rather than throwing",
   hasCapabilityAtPlant({ plant_capabilities: "nope" }, "make_quote", "NAG") === false);
ok("an empty capability key denies", hasCapability(PROFILE, "") === false);
ok("no plant code denies the plant-scoped form", hasCapabilityAtPlant(PROFILE, "make_quote", "") === false);

// ── Producing Plant "relevant assignments" ─────────────────────────────────
// The authority rule being protected is `pgrant_select`: a caller reads plant
// grants for THEMSELVES only, unless they hold administer_users. Own-access
// therefore needs no request; anything naming other people is administrator
// only. These cases fail loudly if that line ever moves.

const NON_ADMIN = { group_capabilities: ["read_party_master"],
                    plant_capabilities: { NAG: ["plant_access", "make_quote"] } };
const ADMIN = { group_capabilities: ["administer_users"],
                plant_capabilities: { NAG: ["plant_access"], KOL: ["plant_access", "check_quote"] } };

// -- your own access, from the resolved profile, with no request at all ------
ok("own access: labels come back for a plant the caller holds capabilities at",
   ownPlantAccessLabels(NON_ADMIN, "NAG").join(", ") === "Plant access, Make quotes");
ok("own access: canonical PLANT_CAPABILITIES order, not the profile's order",
   ownPlantAccessLabels({ plant_capabilities: { NAG: ["make_quote", "plant_access"] } }, "NAG")
     .join(", ") === "Plant access, Make quotes");
ok("own access: a plant the caller holds nothing at is empty, so the screen says No access",
   ownPlantAccessLabels(NON_ADMIN, "PUN").length === 0);
ok("own access: a group capability is NOT reported as plant access",
   ownPlantAccessLabels({ group_capabilities: ["administer_users"], plant_capabilities: {} }, "NAG").length === 0);
ok("own access: absent or malformed data denies rather than throwing",
   ownPlantAccessLabels(null, "NAG").length === 0
   && ownPlantAccessLabels({ plant_capabilities: "nope" }, "NAG").length === 0
   && ownPlantAccessLabels(NON_ADMIN, "").length === 0);

// -- the administrator projection: names only, nothing else -----------------
const ADMIN_USERS = [
  { id: 1, display_name: "Zoe", email: "zoe@x.invalid", active: true,
    last_sign_in_at: "2026-09-01", status: "active",
    group_capabilities: ["administer_users"], plant_capabilities: { NAG: ["plant_access"] } },
  { id: 2, display_name: "Adam", email: "adam@x.invalid", active: true,
    last_sign_in_at: null, status: "active",
    group_capabilities: [], plant_capabilities: { NAG: ["make_quote"], KOL: ["plant_access"] } },
  { id: 3, display_name: "Ghost", email: "ghost@x.invalid", active: false,
    last_sign_in_at: null, status: "deactivated",
    group_capabilities: [], plant_capabilities: { NAG: ["plant_access"] } },
  { id: 4, display_name: "Empty", email: "empty@x.invalid", active: true,
    last_sign_in_at: null, status: "active",
    group_capabilities: [], plant_capabilities: { PUN: [] } },
];
const projected = assignedUserNamesByPlant(ADMIN_USERS);

ok("assignments: grouped by plant code",
   projected.NAG.join(",") === "Adam,Zoe" && projected.KOL.join(",") === "Adam");
ok("assignments: sorted by name, not by arrival order", projected.NAG[0] === "Adam");
ok("assignments: a deactivated account is not listed as a current assignee",
   !projected.NAG.includes("Ghost"));
ok("assignments: a plant with an empty capability list yields no assignee",
   projected.PUN === undefined);
ok("assignments: the projection carries ONLY display names, grouped by plant",
   JSON.stringify(projected) === JSON.stringify({ NAG: ["Adam", "Zoe"], KOL: ["Adam"] }));
ok("assignments: no email, last sign-in, status, id or capability survives the projection",
   !/x\.invalid|last_sign_in|deactivated|administer_users|"id"/.test(JSON.stringify(projected)));
ok("assignments: an empty or absent response yields an empty map, never a throw",
   Object.keys(assignedUserNamesByPlant([])).length === 0
   && Object.keys(assignedUserNamesByPlant(undefined)).length === 0);

// -- the optional read: who may even ASK, and what failure costs ------------
const spy = (resp) => {
  const f = async () => { f.calls++; if (resp instanceof Error) throw resp; return resp; };
  f.calls = 0;
  return f;
};
const okResp = () => ({ ok: true, json: async () => ({ users: ADMIN_USERS }) });

const nonAdminSpy = spy(okResp());
const nonAdminResult = await loadAssignedUserNames({ profile: NON_ADMIN, isActive: true, fetchUsers: nonAdminSpy });
ok("optional read: a NON-ADMINISTRATOR never calls /admin/users at all - zero requests, not a hidden response",
   nonAdminSpy.calls === 0);
ok("optional read: and gets null, so the screen shows own-access only", nonAdminResult === null);

const inactiveSpy = spy(okResp());
await loadAssignedUserNames({ profile: ADMIN, isActive: false, fetchUsers: inactiveSpy });
ok("optional read: an inactive session issues no request either", inactiveSpy.calls === 0);

const adminSpy = spy(okResp());
const adminResult = await loadAssignedUserNames({ profile: ADMIN, isActive: true, fetchUsers: adminSpy });
ok("optional read: an ADMINISTRATOR does call it, exactly once", adminSpy.calls === 1);
ok("optional read: and receives the projected names",
   JSON.stringify(adminResult) === JSON.stringify({ NAG: ["Adam", "Zoe"], KOL: ["Adam"] }));

const forbidden = await loadAssignedUserNames({ profile: ADMIN, isActive: true,
  fetchUsers: spy({ ok: false, status: 403, json: async () => ({ error: "denied" }) }) });
ok("degradation: a 403 returns null - the Plant Master keeps rendering own-access", forbidden === null);

const thrown = await loadAssignedUserNames({ profile: ADMIN, isActive: true,
  fetchUsers: spy(new Error("network down")) });
ok("degradation: a thrown network error returns null rather than propagating", thrown === null);

const badJson = await loadAssignedUserNames({ profile: ADMIN, isActive: true,
  fetchUsers: spy({ ok: true, json: async () => { throw new Error("bad json"); } }) });
ok("degradation: malformed JSON returns null, never a partial map", badJson === null);

ok("degradation: null is distinguishable from 'nobody assigned' - the screen must not conflate them",
   forbidden === null && JSON.stringify(assignedUserNamesByPlant([])) === "{}");

console.log(fails === 0 ? "\nall checks pass" : `\n${fails} FAILED`);
process.exit(fails === 0 ? 0 : 1);
