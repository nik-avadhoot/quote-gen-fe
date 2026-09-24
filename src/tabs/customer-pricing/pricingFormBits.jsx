// Small shared controls for the Customer Pricing History workspace.
import { C, T } from "../../theme.js";
import { cellInput } from "../../ui/screenStandards.js";
import { fieldLabel, rowButton } from "./pricingStyles.js";

export function Field({ label, error, children, width }) {
  return (
    <label style={{ display: "inline-flex", flexDirection: "column", marginRight: 8, marginBottom: 4, width }}>
      <span style={fieldLabel}>{label}</span>
      {children}
      {error && <span role="alert" style={{ fontSize: T.label, color: C.red, marginTop: 1 }}>{error}</span>}
    </label>
  );
}

export function TextIn({ value, onChange, width = 110, style, ...rest }) {
  return <input value={value ?? ""} onChange={e => onChange(e.target.value)}
    style={{ ...cellInput, width, ...style }} {...rest} />;
}

export function SelectIn({ value, onChange, opts, blank, width = 150, ...rest }) {
  return (
    <select value={value ?? ""} onChange={e => onChange(e.target.value)} style={{ ...cellInput, width }} {...rest}>
      {blank !== undefined && <option value="">{blank}</option>}
      {opts.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
    </select>
  );
}

// Shown on an edit form whose record moved on after the form was opened.
// The draft is never replaced; the user decides to rebase onto the latest.
export function VersionNotice({ baseVersion, latestVersion, onRebase }) {
  if (latestVersion === undefined || latestVersion === null || latestVersion === baseVersion) return null;
  return (
    <div role="status" style={{ background: C.amberL, border: `1px solid ${C.amber}`, borderRadius: 4,
      padding: "3px 8px", margin: "4px 0", fontSize: T.label, color: C.amberD }}>
      Someone saved a newer version (v{latestVersion}) after you opened this form (v{baseVersion}).
      Your entry is kept and was not saved. Compare it with the latest values shown above, then
      <button type="button" style={{ ...rowButton, marginLeft: 6 }} onClick={onRebase}>Base my edit on v{latestVersion}</button>
    </div>
  );
}
