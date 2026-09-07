// ═══════════════════════════════════════════════════════════════════════════
// src/ui/appStates.jsx — shared loading/empty/access-denied/stale states.
//
// U1 shared foundation (post-S7 handover §9.2). Stateless and hook-free,
// same convention as ui/primitives.jsx. Every U1+ screen renders one of
// these instead of inventing its own inline "no data" div, so an empty
// result and a denied request never look the same by accident.
// ═══════════════════════════════════════════════════════════════════════════
import { C, sans } from "../theme.js";
import { Btn } from "./primitives.jsx";

const wrap = { padding: "28px 16px", textAlign: "center", fontFamily: sans };

export const LoadingState = ({ label = "Loading…" }) => (
  <div style={wrap}>
    <div style={{ fontSize: 12, color: C.slateL, fontWeight: 600 }}>{label}</div>
  </div>
);

export const EmptyState = ({ title = "Nothing here yet", hint }) => (
  <div style={wrap}>
    <div style={{ fontSize: 13, color: C.slateM, fontWeight: 700 }}>{title}</div>
    {hint && <div style={{ fontSize: 11, color: C.slateL, marginTop: 4 }}>{hint}</div>}
  </div>
);

// Deliberately distinct from EmptyState — an unauthorised or wrong-plant
// caller must never see "no data" where the truth is "you cannot see this."
export const AccessDeniedState = ({ reason = "You do not have access to this." }) => (
  <div style={{ ...wrap, background: C.redL, borderRadius: 8, border: `1px solid ${C.red}` }}>
    <div style={{ fontSize: 13, color: C.red, fontWeight: 700 }}>Access denied</div>
    <div style={{ fontSize: 11, color: C.slateM, marginTop: 4 }}>{reason}</div>
  </div>
);

export const StaleState = ({ onReload, message = "This record changed since you loaded it." }) => (
  <div style={{ ...wrap, background: C.amberL, borderRadius: 8, border: `1px solid ${C.amber}` }}>
    <div style={{ fontSize: 13, color: C.amberD, fontWeight: 700 }}>Out of date</div>
    <div style={{ fontSize: 11, color: C.slateM, marginTop: 4, marginBottom: 10 }}>{message}</div>
    {onReload && <Btn ch="Reload" onClick={onReload} v="secondary" sm />}
  </div>
);
