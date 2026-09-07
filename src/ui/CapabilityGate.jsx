// ═══════════════════════════════════════════════════════════════════════════
// src/ui/CapabilityGate.jsx — capability-controlled action wrapper.
//
// U1 shared foundation (post-S7 handover §9.2). Wraps a single action
// control (a button, usually) and hides or disables it when the caller's
// profile does not carry the named capability. This is the usability aid
// from design-plan §2.1, NOT the access-control boundary — the backend
// route behind the action still refuses an unauthorised caller via RLS
// regardless of what this component decides to render.
// ═══════════════════════════════════════════════════════════════════════════
import { hasCapability, hasCapabilityAtPlant } from "../lib/capabilities.js";

export default function CapabilityGate({ profile, capability, plantCode, mode = "hide", title, children }) {
  const allowed = plantCode
    ? hasCapabilityAtPlant(profile, capability, plantCode)
    : hasCapability(profile, capability);

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
