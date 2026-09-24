// ═══════════════════════════════════════════════════════════════════════════
// src/ui/screenChrome.jsx — the components of the shared screen-space standard.
//
// The tokens, the toolbar height and the two hooks live in
// `screenStandards.js`; this file is only what renders. Keeping them apart is
// what lets Fast Refresh work and what stops "the same height" drifting into
// four different numbers.
// ═══════════════════════════════════════════════════════════════════════════
import { CollapseIcon, ExpandIcon } from "./icons.jsx";
import { FOOTER_HEIGHT, iconButton } from "./screenStandards.js";
import { C, T, sans } from "../theme.js";

// ── Toolbar label ──────────────────────────────────────────────────────────
export const ToolbarLabel = ({ children, title }) => (
  <span title={title} style={{
    fontSize: T.micro, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase",
    color: C.slateL, whiteSpace: "nowrap",
  }}>{children}</span>
);

// ── Actions that exist but cannot run yet ──────────────────────────────────
// Legacy disabled-action presentation retained for screens that deliberately
// expose controls which cannot run yet.
export function PendingActions({ actions, reason = "Backend activation pending", label }) {
  if (!actions?.length) return null;
  return (
    <span role="group" aria-label={label || `${reason} — unavailable actions`}
      style={{
        display: "inline-flex", alignItems: "center", gap: 4, flexShrink: 0, height: 26,
        padding: "0 6px", borderRadius: 5, border: `1px solid ${C.amber}55`, background: C.amberL,
      }}>
      <span style={{ fontSize: T.micro, fontWeight: 800, letterSpacing: "0.04em", textTransform: "uppercase",
        color: C.amberD, whiteSpace: "nowrap" }}>{reason}</span>
      {actions.map(name => (
        <button key={name} type="button" disabled title={`${name} — ${reason}`}
          style={{ padding: "2px 6px", borderRadius: 4, border: `1px solid ${C.border}`, background: C.white,
            color: C.slateL, fontFamily: sans, fontSize: T.label, fontWeight: 700, whiteSpace: "nowrap" }}>
          {name}
        </button>
      ))}
    </span>
  );
}

const ACTION_LABEL = {
  calculate: "Calculate", send: "Send", submit: "Submit", approve: "Approve",
  return: "Return", withdraw: "Withdraw", share: "Share with customer",
  create_revision: "Create revision", amend: "Amend", reprice: "Reprice",
};

// Backend-reported workflow availability. A missing/malformed entry fails
// closed; no frontend state transition or capability guess can enable it.
export function GovernedActions({ actions, onAction, busy = false, label = "Governed workflow actions" }) {
  const entries = Object.entries(actions || {}).filter(([name]) => ACTION_LABEL[name]);
  if (!entries.length) return null;
  return <span role="group" aria-label={label} style={{
    display: "inline-flex", alignItems: "center", gap: 4, flexShrink: 0, height: 26,
    padding: "0 6px", borderRadius: 5, border: `1px solid ${C.border}`, background: C.white,
  }}>
    <span style={{ fontSize: T.micro, fontWeight: 800, letterSpacing: "0.04em",
      textTransform: "uppercase", color: C.slateL, whiteSpace: "nowrap" }}>Workflow</span>
    {entries.map(([name, state]) => {
      const enabled = state?.enabled === true && typeof onAction === "function" && !busy;
      const reason = state?.reason || "backend_did_not_report_available";
      return <button key={name} type="button" disabled={!enabled}
        onClick={() => enabled && onAction(name)}
        title={enabled ? ACTION_LABEL[name] : `${ACTION_LABEL[name]} — ${reason.replaceAll("_", " ")}`}
        style={{ padding: "2px 6px", borderRadius: 4, border: `1px solid ${C.border}`,
          background: enabled ? C.amberL : C.white, color: enabled ? C.amberD : C.slateL,
          fontFamily: sans, fontSize: T.label, fontWeight: 700, whiteSpace: "nowrap",
          cursor: enabled ? "pointer" : "not-allowed" }}>
        {ACTION_LABEL[name]}
      </button>;
    })}
  </span>;
}

// ── Whether a customer may be given THIS revision ──────────────────────────
// Two separate facts, because CDM-24 keeps them separate: approval makes a
// revision shareable, Issue records that it actually was shared, and a download
// proves neither. The verdict comes from `revisionShareability` so the wording
// cannot drift between the governed view and Quote History.
//
// Scoped to the revision it is rendered beside. It must never be fed the lane
// of whatever Batch Builder work happens to be open — that work has nothing to
// do with the authority of a frozen revision.
export function ShareabilityNote({ shareable, shared, reason }) {
  const tone = shareable ? { color: C.green, background: C.greenL, border: `${C.green}55` }
    : { color: C.slateM, background: C.paper, border: C.border };
  return (
    <span title={reason} style={{
      display: "inline-flex", alignItems: "center", gap: 5, padding: "2px 8px", borderRadius: 999,
      border: `1px solid ${tone.border}`, background: tone.background, color: tone.color,
      fontFamily: sans, fontSize: T.label, fontWeight: 700, whiteSpace: "nowrap",
    }}>
      <span style={{ fontSize: T.micro, fontWeight: 800, letterSpacing: "0.05em",
        textTransform: "uppercase", opacity: .8 }}>Customer</span>
      {shareable ? (shared ? "Shared · may be re-sent" : "May be shared") : "Not shareable"}
    </span>
  );
}

// ── The thin footer that carries provenance and legend once ────────────────
export function ScreenFooter({ children, right }) {
  return (
    <div style={{
      height: FOOTER_HEIGHT, flex: `0 0 ${FOOTER_HEIGHT}px`, display: "flex", alignItems: "center", gap: 6,
      padding: "0 10px", borderTop: `1px solid ${C.border}`, background: "#FBF8F3", fontFamily: sans,
      fontSize: T.label, color: C.slateL, overflow: "hidden", whiteSpace: "nowrap",
    }}>
      {children}
      {right && <span style={{ marginLeft: "auto" }}>{right}</span>}
    </div>
  );
}

// ── A panel that can fill the screen area ──────────────────────────────────
export function PanelFocusToggle({ panel, noun, focused, onToggle, disabled, disabledTitle }) {
  return (
    <button type="button" aria-pressed={focused} onClick={() => onToggle(panel)} disabled={disabled && !focused}
      aria-label={focused ? `Collapse ${noun}` : `Expand ${noun}`}
      title={focused ? `Collapse ${noun} · show both panels (Esc)`
        : disabled ? (disabledTitle || `Select a record first`)
          : `Expand ${noun} to fill the screen area`}
      style={iconButton(focused)}>
      {focused ? <CollapseIcon size={14} /> : <ExpandIcon size={14} />}
    </button>
  );
}

// ── The draggable divider ──────────────────────────────────────────────────
export function PanelDivider({ label, split, dragging, onPointerDown, onReset, onKeyDown, resetLabel = "50 : 50" }) {
  return (
    <div role="separator" aria-orientation="vertical" aria-label={label}
      aria-valuemin={25} aria-valuemax={75} aria-valuenow={split} tabIndex={0}
      onPointerDown={onPointerDown} onDoubleClick={onReset} onKeyDown={onKeyDown}
      title={`Drag to resize · double-click for ${resetLabel}`}
      style={{
        width: 7, flex: "0 0 7px", cursor: "col-resize", background: dragging ? "#F3E3D2" : "#FBF8F3",
        borderLeft: `1px solid ${C.border}`, borderRight: `1px solid ${C.border}`, display: "flex",
        flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3,
        touchAction: "none", userSelect: "none",
      }}>
      {[0, 1, 2].map(i => <span key={i} style={{ width: 3, height: 3, borderRadius: "50%", background: "#B5A898" }} />)}
    </div>
  );
}

// ── Dense rows ─────────────────────────────────────────────────────────────
// Secondary facts belong in an expanded row, never in a taller compact row.
// The chevron is the only thing a compact row gains, so row height stays
// constant whether or not a row has extra detail.
export function RowDisclosure({ open, onToggle, label }) {
  return (
    <button type="button" onClick={onToggle} aria-expanded={open} aria-label={label}
      title={open ? "Hide the recorded detail" : "Show the recorded detail"}
      style={{
        width: 14, height: 14, flexShrink: 0, display: "inline-grid", placeItems: "center", padding: 0,
        border: 0, borderRadius: 3, background: "transparent", color: C.slateL, cursor: "pointer",
        fontSize: T.micro, lineHeight: 1,
      }}>
      <span aria-hidden="true" style={{ transform: open ? "rotate(90deg)" : "none", transition: "transform .12s" }}>▶</span>
    </button>
  );
}
