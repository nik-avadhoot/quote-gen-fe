// Style tokens shared by the Customer Pricing History components. Kept out of
// the .jsx files so Fast Refresh sees component-only modules.
import { C, T, sans } from "../../theme.js";
import { control } from "../../ui/screenStandards.js";

export const rowButton = { ...control, height: 20, padding: "0 7px", fontSize: T.label, fontWeight: 700,
  cursor: "pointer", whiteSpace: "nowrap" };
export const primaryRowButton = { ...rowButton, background: C.amber, color: C.white, border: "none" };
export const fieldLabel = { fontSize: T.micro, fontWeight: 800, color: C.slateL, textTransform: "uppercase",
  letterSpacing: "0.05em", display: "block", marginBottom: 2 };
export const panel = { border: `1px solid ${C.border}`, borderRadius: 6, background: C.white, padding: "6px 10px",
  fontFamily: sans, fontSize: T.body };
