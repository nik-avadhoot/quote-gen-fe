// ═══════════════════════════════════════════════════════════════════════════
// src/ui/CapabilityGate.jsx — capability-controlled action wrapper.
//
// U1 shared foundation (post-S7 handover §9.2). Wraps a single action
// control (a button, usually) and hides or disables it when the caller's
// profile does not carry the named capability. This is the usability aid
// from design-plan §2.1, NOT the access-control boundary — the backend
// route behind the action still refuses an unauthorised caller via RLS
// regardless of what this component decides to render.
//
// `capability` may be an array for OR semantics (e.g. propose_customer_family
// requires manage_customer_master OR make_quote at any plant — mirroring the
// database's own OR condition exactly, not a narrower frontend invention).
// Every name in the array is checked with the SAME plantCode (or flat, if
// omitted); a mix of plant-scoped and group-only checks in one gate is not a
// shape any current action needs.
// ═══════════════════════════════════════════════════════════════════════════
import { hasCapability, hasCapabilityAtPlant } from "../lib/capabilities.js";

export default function CapabilityGate({ profile, capability, plantCode, mode = "hide", title, children }) {
  const names = Array.isArray(capability) ? capability : [capability];
  const check = (name) => (plantCode
    ? hasCapabilityAtPlant(profile, name, plantCode)
    : hasCapability(profile, name));
  const allowed = names.some(check);

  if (allowed) return children;
  if (mode === "hide") return null;

  // mode="disable" — render the control but neutralise it, with a title
  // explaining why, rather than a silently missing button that looks like
  // a bug.
  return (
    <span title={title || "You do not have this permission"} style={{ display: "inline-block" }}>
      <fieldset disabled style={{ all: "unset", pointerEvents: "none", opacity: 0.45 }}>
        {children}
      </fieldset>
    </span>
  );
}
