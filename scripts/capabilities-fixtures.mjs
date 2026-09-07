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
import { hasCapability, hasCapabilityAtPlant } from "../src/lib/capabilities.js";

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

console.log(fails === 0 ? "\nall checks pass" : `\n${fails} FAILED`);
process.exit(fails === 0 ? 0 : 1);
