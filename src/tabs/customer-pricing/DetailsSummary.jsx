// P0.3 Details zone and the `Mixed values` disclosure. A field shown here is
// summarised across the records in view: one value ONLY when every applicable
// canonical value is identical (blank and ₹0.00 differ); otherwise `Mixed
// values`, which discloses each contributing canonical record. Nothing here is
// editable and nothing is copied into any record.
import { C, T, mono } from "../../theme.js";
import { summarizeField } from "../../lib/customerPricingLayout.js";
import { rowButton } from "./pricingStyles.js";

const TYPE_LABEL = { mechanism: "Mechanism", cycle: "Cycle", line: "Line", term: "Stable Term", bf_set: "BF set",
  event: "Round", measure: "Weight/area record" };

export function MixedDisclosure({ title, summary, onClose }) {
  return (
    <div role="region" aria-label={`Contributing records for ${title}`}
      style={{ border: `1px solid ${C.amber}`, borderRadius: 5, background: C.white, padding: "4px 8px", margin: "4px 0" }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: T.label }}>
        <b>{title}</b>
        <span style={{ color: C.slateL }}>
          {summary.contributors.length} different canonical record{summary.contributors.length === 1 ? "" : "s"}
          {summary.notApplicable ? ` · not applicable to ${summary.notApplicable} shown` : ""}</span>
        {onClose && <button type="button" style={{ ...rowButton, marginLeft: "auto" }} onClick={onClose}>Close</button>}
      </div>
      <ul style={{ margin: "3px 0 0", paddingLeft: 16, fontSize: T.label }}>
        {summary.contributors.map(c => (
          <li key={`${c.recordType}:${c.recordId}`}>
            <span style={{ fontFamily: mono }}>{c.display}</span>
            <span style={{ color: C.slateM }}> — {TYPE_LABEL[c.recordType] || c.recordType} #{c.recordId}
              {c.version != null ? ` v${c.version}` : ""}{c.absent ? ` (${c.absent})` : ""}</span>
            <span style={{ color: C.slateL }}> · {c.usedBy.join("; ")}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SummaryValue({ summary, onDisclose, money = false }) {
  if (summary.state === "mixed") {
    return (
      <button type="button" style={{ ...rowButton, color: C.orange, borderColor: C.orange }}
        title="These records hold different values — show them" onClick={onDisclose}>Mixed values ▾</button>
    );
  }
  if (summary.state === "none") return <span style={{ color: C.slateL, fontStyle: "italic" }}>Not applicable</span>;
  return <span style={{ fontFamily: money ? mono : undefined, color: summary.blank ? C.slateL : C.slate }}>{summary.display}</span>;
}

export default function DetailsSummary({ view, disclosed, onDisclose }) {
  if (!view.details.length) return null;
  return (
    <div aria-label="Details" style={{ display: "flex", flexWrap: "wrap", gap: "2px 14px", alignItems: "center",
      border: `1px solid ${C.border}`, borderRadius: 6, background: "#FBF8F3", padding: "3px 10px", marginBottom: 6,
      fontSize: T.body }}>
      <span style={{ fontSize: T.micro, fontWeight: 800, color: C.slateL, textTransform: "uppercase",
        letterSpacing: "0.05em" }}>Details · {view.records.length} shown</span>
      {view.details.map(field => {
        const summary = summarizeField(field, view.records, view.ctx);
        return (
          <span key={field.id} style={{ display: "inline-flex", gap: 5, alignItems: "center" }}>
            <span style={{ color: C.slateM }}>{field.label}:</span>
            <SummaryValue summary={summary} money={field.kind === "money"}
              onDisclose={() => onDisclose(disclosed?.key === `details|${field.id}` ? null
                : { kind: "details", fieldId: field.id })} />
          </span>
        );
      })}
    </div>
  );
}
