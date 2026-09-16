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
// The S9 Speedbreaker requires every backend-dependent workflow action to stay
// VISIBLY disabled with its reason. That is a visibility rule, so these ride
// inside the one toolbar as a labelled disabled group - never behind a
// disclosure, and never as a second full-width band.
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
export function PanelDivider({ label, split, dragging, onPointerDown, onReset, onKeyDown }) {
  return (
    <div role="separator" aria-orientation="vertical" aria-label={label}
      aria-valuemin={25} aria-valuemax={75} aria-valuenow={split} tabIndex={0}
      onPointerDown={onPointerDown} onDoubleClick={onReset} onKeyDown={onKeyDown}
      title="Drag to resize · double-click for 50 : 50"
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
