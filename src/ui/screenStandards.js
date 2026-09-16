// ═══════════════════════════════════════════════════════════════════════════
// src/ui/screenStandards.js — the one screen-space standard, as tokens.
//
// The TopBar already names the active screen, so a screen NEVER repeats that
// name in its own body. What a screen owns instead is:
//
//   • ONE toolbar per panel, every one at the same `TOOLBAR_MIN_HEIGHT`, so
//     panels sitting side by side line up and no screen spends a second band
//     on controls;
//   • secondary controls inside a `<details>` disclosure (`menuSummary` /
//     `menuPanel`), so the toolbar carries only what is used constantly;
//   • dense rows with a frozen identity column, secondary facts reached
//     through an expanded row rather than by making every row taller;
//   • an expand / collapse icon on any panel that can fill the screen area,
//     INSIDE the app window - never the browser Fullscreen API;
//   • provenance and legend cues in a thin footer, stated once per screen
//     instead of repeated on every row;
//   • `T` type tokens throughout, never a hardcoded off-scale pixel size.
//
// These were first built inline in the SKU Master. They live here so "the same
// height" is one number rather than a coincidence between four files.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useRef, useState } from "react";
import { useAppState } from "../state/AppStateContext.js";
import { SPLIT_DEFAULT, clampSplit } from "../lib/panelSplit.js";
import { C, T, sans } from "../theme.js";

// Every panel toolbar in the application is this tall. Panels that sit beside
// one another therefore align without either one measuring the other.
export const TOOLBAR_MIN_HEIGHT = 43;
export const FOOTER_HEIGHT = 24;

export const control = {
  height: 26, boxSizing: "border-box", fontSize: T.body, padding: "3px 7px", borderRadius: 5,
  border: `1px solid ${C.border}`, background: C.white, fontFamily: sans, color: C.slate,
};

export const toolbar = {
  display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", rowGap: 5, padding: "6px 10px",
  boxSizing: "border-box", minHeight: TOOLBAR_MIN_HEIGHT, borderBottom: `1px solid ${C.border}`,
  background: C.cream, flexShrink: 0,
};

export const menuSummary = active => ({
  ...control, display: "inline-flex", alignItems: "center", gap: 5, cursor: "pointer",
  listStyle: "none", fontSize: T.label, fontWeight: 700, whiteSpace: "nowrap",
  color: active ? C.amberD : C.slateM, borderColor: active ? C.amber : C.border,
  background: active ? C.amberL : C.white,
});

export const menuPanel = {
  position: "absolute", left: 0, top: "calc(100% + 6px)", zIndex: 30, minWidth: 230, padding: 9,
  border: `1px solid ${C.border}`, borderRadius: 7, background: C.white,
  boxShadow: "0 8px 22px rgba(28,43,58,.18)", display: "grid", gap: 7,
};

export const iconButton = on => ({
  width: 26, height: 26, display: "inline-grid", placeItems: "center", padding: 0, borderRadius: 5,
  cursor: "pointer", flexShrink: 0, border: `1px solid ${on ? C.green : C.border}`,
  background: on ? C.greenL : C.white, color: on ? C.green : C.slateM,
});

export const segment = on => ({
  height: 22, padding: "0 7px", border: 0, borderRight: `1px solid ${C.border}`, cursor: "pointer",
  fontSize: T.label, fontWeight: 700, background: on ? C.slateM : C.white, color: on ? C.white : C.slateM,
});

// ── Panel focus and the split ──────────────────────────────────────────────
// Focus collapses the app navigation and restores exactly what was there
// before - including when the screen unmounts while still focused.
export function usePanelFocus() {
  const { setSidebarCollapsed, sidebarCollapsed } = useAppState();
  const [focusPanel, setFocusPanel] = useState(null);
  const focusRef = useRef(null);
  const sidebarBeforeFocus = useRef(sidebarCollapsed);

  const setFocus = next => {
    const was = focusRef.current;
    if (next && !was) {
      sidebarBeforeFocus.current = sidebarCollapsed;
      setSidebarCollapsed(true);
    }
    if (!next && was) setSidebarCollapsed(sidebarBeforeFocus.current);
    focusRef.current = next;
    setFocusPanel(next);
  };
  const toggleFocus = panel => setFocus(focusRef.current === panel ? null : panel);
  useEffect(() => () => {
    if (focusRef.current) setSidebarCollapsed(sidebarBeforeFocus.current);
  }, [setSidebarCollapsed]);

  // Screen-scoped, and only while a panel is focused: a global key listener
  // would steal Escape from dialogs on other screens.
  const exitFocusOnEscape = e => {
    if (e.key === "Escape" && focusRef.current) { e.stopPropagation(); setFocus(null); }
  };
  return { focusPanel, toggleFocus, exitFocusOnEscape };
}

export function useSplitPanels(initial = SPLIT_DEFAULT) {
  const [split, setSplit] = useState(initial);
  const [dragging, setDragging] = useState(false);
  const bodyRef = useRef(null);

  const startDrag = e => {
    if (!bodyRef.current) return;
    e.preventDefault();
    const rect = bodyRef.current.getBoundingClientRect();
    const move = ev => setSplit(clampSplit(((ev.clientX - rect.left) / rect.width) * 100));
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setDragging(false);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    setDragging(true);
  };
  const nudgeSplit = e => {
    if (e.key === "ArrowLeft") { e.preventDefault(); setSplit(s => clampSplit(s - 5)); }
    if (e.key === "ArrowRight") { e.preventDefault(); setSplit(s => clampSplit(s + 5)); }
  };
  return { split, setSplit, dragging, startDrag, nudgeSplit, bodyRef };
}


export const denseTable = {
  borderCollapse: "collapse", width: "100%", fontFamily: sans, fontSize: T.body, tableLayout: "auto",
  lineHeight: 1.45,
};

export const denseHead = {
  position: "sticky", top: 0, zIndex: 5, background: C.slateM, color: C.white,
  fontSize: T.micro, fontWeight: 800, letterSpacing: "0.05em", textTransform: "uppercase",
  textAlign: "left", padding: "4px 8px", whiteSpace: "nowrap", lineHeight: 1.45,
};

// 26px compact rows: 8px of padding around one 11px line, and nothing else.
export const denseCell = {
  padding: "4px 8px", borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap",
  overflow: "hidden", textOverflow: "ellipsis", maxWidth: 260, verticalAlign: "middle",
};

// The identity column stays put while the rest scrolls sideways.
export const frozenCell = (selected, header = false) => ({
  ...(header ? {} : denseCell),
  position: "sticky", left: 0, zIndex: header ? 6 : 1,
  background: header ? C.slateM : selected ? "#FEF3E8" : C.white,
  borderRight: `1px solid ${C.border}`,
});
