// ═══════════════════════════════════════════════════════════════════════════
// src/ui/styles.js — shared inline style objects.
//
// Separate from primitives.jsx so that file exports components only: mixing
// constant and component exports breaks React Fast Refresh
// (react-refresh/only-export-components).
// ═══════════════════════════════════════════════════════════════════════════
import { C, sans } from "../theme.js";

export const inputSt={width:"100%",padding:"5px 8px",borderRadius:5,border:`1px solid ${C.border}`,
  fontSize:12,color:C.slate,background:C.white,boxSizing:"border-box",fontFamily:sans};
