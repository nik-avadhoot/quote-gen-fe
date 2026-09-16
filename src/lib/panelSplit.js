// ═══════════════════════════════════════════════════════════════════════════
// src/lib/panelSplit.js — the split and panel-focus arithmetic, shared.
//
// Pure. No React, no DOM. Extracted from the SKU Master so every split screen
// clamps, defaults and focuses identically rather than each inventing its own
// bounds. `skuMasterModel.js` re-exports these under its existing names, so the
// SKU Master's imports and its named gates are unchanged.
//
// Panel focus fills the SCREEN AREA INSIDE THE APP WINDOW with one panel. The
// browser Fullscreen API is deliberately never used: it hides the app's own
// navigation and status, which is the opposite of what filling a panel is for.
// ═══════════════════════════════════════════════════════════════════════════

export const SPLIT_MIN = 25;
export const SPLIT_MAX = 75;
export const SPLIT_DEFAULT = 50;

// "list" fills the area with the catalogue, "detail" with the one record.
export const PANEL_FOCUS = ["list", "detail"];

export function clampSplit(percent) {
  const n = Number(percent);
  if (!Number.isFinite(n)) return SPLIT_DEFAULT;
  return Math.max(SPLIT_MIN, Math.min(SPLIT_MAX, Math.round(n)));
}

export function panelLayout(split, focus) {
  if (focus === "list") return { listWidth: "100%", showList: true, showDetail: false, showDivider: false };
  if (focus === "detail") return { listWidth: "0px", showList: false, showDetail: true, showDivider: false };
  return { listWidth: `calc(${clampSplit(split)}% - 3.5px)`, showList: true, showDetail: true, showDivider: true };
}
