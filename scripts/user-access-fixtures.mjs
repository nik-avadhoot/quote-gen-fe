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
  confirmCapabilityChange, confirmDeactivation, confirmReactivation,
  deactivatesLastAdministrator, deactivationConsequence, deriveRoleLabel,
  isGroupCapability, isPlantCapability, lastAdministratorDeactivationMessage,
  lastAdministratorMessage, refusalReason, removesLastAdministrator, sameCapabilityState,
  setCapabilitiesBody, setStatusBody, staleCapabilityMessage, staleStatusMessage,
  statusChangeSummary,
} from "../src/lib/userAccessActions.js";
import * as UA from "../src/lib/userAccessActions.js";
import {
  ADOPTION_ROLES, adoptBody, adoptionBlockedReason, adoptionSuccessMessage,
  confirmAdoption, formatOrphanDate, orphanExplainer, orphanNote, orphanView, orphanViews,
} from "../src/lib/authOrphanActions.js";

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

// ── TRANSITION_NOT_ALLOWED: the code is broad, so the UI supplies the reason ─
//
// The database refuses a last-administrator removal or deactivation with 22023.
// The route maps that to the established public code TRANSITION_NOT_ALLOWED
// (HTTP 422), which classifyResponse reports as kind 'validation'. That code is
// shared with several unrelated refusals and is deliberately NOT narrowed, so
// the frontend must supply the reason where it knows what it attempted.
const VALIDATION = { kind: "validation", message: "That action could not be completed." };

ok("422 handling: a last-administrator REMOVAL gets the explanatory reason",
   refusalReason(VALIDATION, { removingLastAdministrator: true }) === lastAdministratorMessage());
ok("422 handling: a last-administrator DEACTIVATION gets the DEACTIVATION reason",
   refusalReason(VALIDATION, { deactivatingLastAdministrator: true })
     === lastAdministratorDeactivationMessage());
ok("422 handling: the two reasons are different - one sends you to the editor, one does not",
   lastAdministratorDeactivationMessage() !== lastAdministratorMessage()
   && !/remove it here/i.test(lastAdministratorDeactivationMessage()));
ok("422 handling: an unrelated 422 is NOT relabelled - the server's own message stands",
   refusalReason(VALIDATION, {}) === null);
ok("422 handling: the rule applies only to a validation outcome, not to denied/stale/error",
   ["access-denied", "stale", "error"].every(k =>
     refusalReason({ kind: k }, { removingLastAdministrator: true }) === null));
ok("422 handling: a missing outcome is handled without a crash",
   refusalReason(null, { removingLastAdministrator: true }) === null);
ok("422 handling: the reason names the remedy, not just the refusal",
   /Grant administer_users to another\s+active user first/.test(
     refusalReason(VALIDATION, { removingLastAdministrator: true })));

// ── stale conflict: reload and re-decide, never a silent retry ────────────
const stale = staleCapabilityMessage("R. Sharma");
ok("stale: names the user", stale.includes("R. Sharma"));
ok("stale: says the change came from somewhere else", /somewhere else/i.test(stale));
ok("stale: says the current permissions were reloaded", /reloaded/i.test(stale));
ok("stale: asks the operator to re-decide rather than promising a retry",
   /apply your change again if it is still/i.test(stale) && !/retry/i.test(stale));


// ═══════════════════════════════════════════════════════════════════════════
// UA-5 — activation and deactivation
// ═══════════════════════════════════════════════════════════════════════════

// ── the request body: versioned, and still carrying no role ───────────────
const sbody = setStatusBody(8, false);
ok("status body: carries expected_content_version",
   sbody.expected_content_version === 8);
ok("status body: active is a real boolean, never the raw input",
   setStatusBody(1, undefined).active === false && setStatusBody(1, 1).active === true);
ok("status body: carries NO role, plant or capability field",
   Object.keys(sbody).sort().join(",") === "active,expected_content_version");

// ── the last-administrator pre-check, on the deactivation path ────────────
const ADMIN_USER = { id: 1, active: true, group_capabilities: ["administer_users"] };
ok("last admin: deactivating the only active administrator is caught before the request",
   deactivatesLastAdministrator(ADMIN_USER, [1]) === true);
ok("last admin: it is fine when another active administrator remains",
   deactivatesLastAdministrator(ADMIN_USER, [1, 2]) === false);
ok("last admin: a user who does not hold administer_users is never the last administrator",
   deactivatesLastAdministrator({ id: 1, active: true, group_capabilities: ["read_party_master"] },
                                [1]) === false);
ok("last admin: an ALREADY inactive administrator cannot be the one being deactivated",
   deactivatesLastAdministrator({ ...ADMIN_USER, active: false }, [1]) === false);
ok("last admin: missing collections are handled without a crash",
   deactivatesLastAdministrator({ id: 1, active: true }, null) === false);
ok("last admin: the deactivation message says what to DO and names the consequence",
   /Grant administer_users to another active/.test(lastAdministratorDeactivationMessage())
   && /nobody able to manage users/i.test(lastAdministratorDeactivationMessage()));

// ── the consequence, in both halves ───────────────────────────────────────
//
// An administrator hesitates over this button because they do not know whether
// it destroys anything. Saying only "they cannot sign in" leaves that unanswered.
const consequence = deactivationConsequence();
ok("consequence: says access stops", /not be able to sign in/i.test(consequence));
ok("consequence: says it is reversible", /until the account is reactivated/i.test(consequence));
ok("consequence: says nothing is deleted", /Nothing is deleted/i.test(consequence));
ok("consequence: names what is KEPT, specifically",
   /quotes, approvals/i.test(consequence) && /still attributed to them/i.test(consequence));

const cd = confirmDeactivation("R. Sharma");
ok("confirm deactivate: names the user", cd.includes("R. Sharma"));
ok("confirm deactivate: carries the whole consequence, not a summary of it",
   cd.includes(consequence));
ok("confirm deactivate: says permissions are untouched, so reactivation restores access",
   /permissions are left untouched/i.test(cd) && /reactivating restores/i.test(cd));

const cr = confirmReactivation("R. Sharma");
ok("confirm reactivate: names the user", cr.includes("R. Sharma"));
ok("confirm reactivate: promises no new access", /grants nothing on its own/i.test(cr));
ok("confirm reactivate: does NOT reuse the deactivation consequence",
   !cr.includes(consequence));

// ── stale: reload and re-decide, never a silent retry ─────────────────────
const ss = staleStatusMessage("R. Sharma");
ok("stale status: names the user", ss.includes("R. Sharma"));
ok("stale status: says the change came from somewhere else", /somewhere else/i.test(ss));
ok("stale status: says the current state was reloaded", /reloaded/i.test(ss));
ok("stale status: asks the operator to re-decide rather than promising a retry",
   /apply your change again if it is still/i.test(ss) && !/retry/i.test(ss));

ok("status summary: an active user is offered Deactivate, marked dangerous",
   statusChangeSummary({ active: true }).verb === "Deactivate"
   && statusChangeSummary({ active: true }).danger === true);
ok("status summary: an inactive user is offered Reactivate, not marked dangerous",
   statusChangeSummary({ active: false }).verb === "Reactivate"
   && statusChangeSummary({ active: false }).danger === false);
ok("status summary: a missing user does not crash the row",
   statusChangeSummary(undefined).verb === "Reactivate");

// ═══════════════════════════════════════════════════════════════════════════
// UA-6 — orphan-account recovery
// ═══════════════════════════════════════════════════════════════════════════

// The roles the adoption route accepts, read from server.py VALID_ROLES.
ok("adoption: the role list matches the backend's VALID_ROLES exactly",
   eq([...ADOPTION_ROLES].sort(), ["admin", "checker", "maker"]));
ok("adoption: the role list is frozen", Object.isFrozen(ADOPTION_ROLES));

// ── the view model carries safe fields only ───────────────────────────────
//
// The route returns `ref` - a truncated SHA-256 of the authentication uuid with
// no way back to it - alongside the uuid itself. The screen has no use for the
// uuid, so it must not travel into the view at all.
const RAW = {
  ref: "a1b2c3d4", auth_user_id: "11111111-2222-3333-4444-555555555555",
  email: "orphan@example.invalid", created_at: "2026-09-01T10:00:00Z", last_sign_in_at: "",
};
const view = orphanView(RAW);
ok("orphan view: exposes exactly ref, email, createdAt and lastSignInAt",
   eq(Object.keys(view).sort(), ["createdAt", "email", "lastSignInAt", "ref"]));
ok("orphan view: the authentication uuid is NOT carried into the view",
   !("auth_user_id" in view) && !JSON.stringify(view).includes(RAW.auth_user_id));
ok("orphan view: an account with no address still renders",
   orphanView({ ref: "x" }).email === "(no address)");
ok("orphan view: a missing reference is named, not blank",
   orphanView({}).ref === "unknown");
ok("orphan view: null and undefined lists are empty, never a crash",
   eq(orphanViews(null), []) && eq(orphanViews(undefined), []));
ok("orphan view: a list maps one-for-one",
   orphanViews([RAW, { ref: "b" }]).length === 2);

ok("orphan note: an account that has been signed into says so explicitly",
   /tried to use it and was refused/i.test(orphanNote({ lastSignInAt: "2026-09-01T10:00:00Z" })));
ok("orphan note: one that never has says exactly that",
   orphanNote(view) === "Never signed in.");

ok("dates: an absent timestamp reads 'never', not 'Invalid Date'",
   formatOrphanDate("") === "never" && formatOrphanDate(null) === "never");
ok("dates: an unparseable timestamp is named, not rendered as garbage",
   formatOrphanDate("not-a-date") === "unknown");
ok("dates: a real timestamp is formatted",
   formatOrphanDate("2026-09-01T10:00:00Z") !== "unknown"
   && formatOrphanDate("2026-09-01T10:00:00Z") !== "never");

// ── the plant rule, mirrored from the backend, not invented ──────────────
ok("adoption rule: a Maker with no plant is blocked, with the backend's reason",
   /at least one plant/i.test(adoptionBlockedReason("maker", [])));
ok("adoption rule: a Checker with no plant is blocked too",
   adoptionBlockedReason("checker", []) !== null);
ok("adoption rule: an administrator may legitimately hold no plant",
   adoptionBlockedReason("admin", []) === null);
ok("adoption rule: a Maker WITH a plant is allowed",
   adoptionBlockedReason("maker", ["NAG"]) === null);
ok("adoption rule: an unknown role is blocked rather than sent to the server",
   adoptionBlockedReason("superuser", ["NAG"]) !== null);
ok("adoption rule: a missing plant list is treated as none, not as unrestricted",
   adoptionBlockedReason("maker", undefined) !== null);

// ── the request body ─────────────────────────────────────────────────────
const ab = adoptBody("  ORPHAN@Example.Invalid ", "  Rescued  ", "maker", ["PUN", "NAG", "NAG"]);
ok("adopt body: the address is trimmed and lower-cased, as the route compares it",
   ab.email === "orphan@example.invalid");
ok("adopt body: the display name is trimmed", ab.display_name === "Rescued");
ok("adopt body: plants are deduplicated and sorted", eq(ab.plants, ["NAG", "PUN"]));
ok("adopt body: carries no capability set - adoption seeds starting access only",
   !("group_capabilities" in ab) && !("plant_capabilities" in ab));
ok("adopt body: carries no password, token or credential of any kind",
   !/password|token|secret|credential/i.test(JSON.stringify(Object.keys(ab))));

const ca = confirmAdoption(view, "Rescued", "maker", ["NAG"]);
ok("confirm adopt: names the address being adopted", ca.includes("orphan@example.invalid"));
ok("confirm adopt: names the identity it will become", ca.includes("Rescued"));
ok("confirm adopt: names the starting access and the plant",
   ca.includes("maker") && ca.includes("NAG"));
ok("confirm adopt: says no plant when there is none",
   /with no plant/i.test(confirmAdoption(view, "R", "admin", [])));
ok("confirm adopt: says the existing password is used - nothing is set here",
   /password that account already has/i.test(ca));
ok("confirm adopt: says the starting access is only a starting point",
   /changed afterwards in the permission editor/i.test(ca));

ok("explainer: says what an orphan IS in plain words",
   /no application user/i.test(orphanExplainer()));
ok("explainer: says it grants nothing, so nobody panics",
   /Nobody can use one/i.test(orphanExplainer()));
ok("explainer: says how it happens", /failed part-way/i.test(orphanExplainer()));
ok("explainer: is not invitation-provider language",
   !/invite|invitation|email them|send/i.test(orphanExplainer()));

ok("adoption success: names the address and the new identity",
   adoptionSuccessMessage(view, "Rescued").includes("orphan@example.invalid")
   && adoptionSuccessMessage(view, "Rescued").includes("Rescued"));
ok("adoption success: says where to look for them next",
   /appear in the list below/i.test(adoptionSuccessMessage(view, "Rescued")));

console.log();
console.log(fails === 0 ? "all checks pass" : `${fails} FAILED`);
process.exit(fails === 0 ? 0 : 1);
