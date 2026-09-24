// P0.4 change history: actor, time, record identity, operation and the material
// before → after of every direct edit, read from the append-only change log.
// Nothing here is editable, and an unavailable/partial log is never shown as
// "no changes".
import { C, T, mono } from "../../theme.js";
import { rowButton } from "./pricingStyles.js";
import { SOB_STATES, formatBoxes, formatPct, labelOf } from "../../lib/customerPricingModel.js";

const ENTITY = { mechanism: "Mechanism", cycle: "Cycle", line: "Line", negotiation_event: "Round",
  term_version: "Stable Term", bf_delta_set: "BF set", bf_delta: "BF delta", line_measure: "Weight/area",
  event_bf_rate: "Round BF rate" };
const show = v => (v === null || v === undefined || v === "" ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v));
// P0.4.1: SOB mode and values in words, so "percentage → allocated quantity"
// and "25,000 → 0 boxes" read as what changed. Blank stays "—", zero stays zero.
const FIELD_LABEL = { sob_state: "SOB mode", sob_pct: "SOB %", sob_allocated_boxes: "SOB allocated boxes",
  status: "Status", void_reason: "Void reason" };
const blank = v => v === null || v === undefined || v === "";
const FIELD_VALUE = {
  sob_state: v => (blank(v) ? "—" : labelOf(SOB_STATES, v)),
  sob_pct: v => (blank(v) ? "—" : formatPct(v)),
  sob_allocated_boxes: v => (blank(v) ? "—" : formatBoxes(v)),
};
const showField = (field, v) => (FIELD_VALUE[field] || show)(v);

export function ChangeList({ items, emptyText = "No changes recorded yet." }) {
  if (!items.length) return <div style={{ color: C.slateL, fontSize: T.label }}>{emptyText}</div>;
  return (
    <ol style={{ margin: 0, paddingLeft: 16, fontSize: T.label }} aria-label="Change entries">
      {items.map(c => (
        <li key={c.id} style={{ marginBottom: 3 }}>
          <span style={{ fontFamily: mono }}>{String(c.occurred_at).replace("T", " ").slice(0, 16)}</span>
          {" · "}<b>{c.actor_name || `User #${c.actor_app_user_id} (name not visible to you)`}</b>
          {" · "}{c.operation === "create" ? "created" : "changed"} {ENTITY[c.entity_type] || c.entity_type} #{c.entity_id}
          {c.content_version != null ? ` → v${c.content_version}` : ""}
          {c.fields?.length > 0 && (
            <ul style={{ margin: "1px 0 0", paddingLeft: 14, color: C.slateM }}>
              {c.fields.slice(0, 12).map(f => (
                <li key={f.field}><span style={{ color: C.slate }}>{FIELD_LABEL[f.field] || f.field}</span>:{" "}
                  <span style={{ fontFamily: mono }}>{c.operation === "create" ? showField(f.field, f.after)
                    : `${showField(f.field, f.before)} → ${showField(f.field, f.after)}`}</span></li>
              ))}
              {c.fields.length > 12 && <li>… {c.fields.length - 12} more field(s)</li>}
            </ul>
          )}
        </li>
      ))}
    </ol>
  );
}

export function HistoryStatus({ history, onLoad }) {
  const s = history.status;
  if (s === "idle") return <button type="button" style={rowButton} onClick={() => onLoad(false)}>Load change history</button>;
  if (s === "loading") return <span role="status" style={{ color: C.slateL, fontSize: T.label }}>Loading change history…</span>;
  if (s === "denied") return <span role="alert" style={{ color: C.red, fontSize: T.label }}>🚫 You cannot read this change history.</span>;
  if (s === "unavailable") return <span style={{ color: C.slateL, fontSize: T.label }}>Change history is not activated in this environment yet.</span>;
  if (s === "failed") {
    return <span role="alert" style={{ color: C.red, fontSize: T.label }}>❌ {history.message || "Could not load the change history."}
      <button type="button" style={{ ...rowButton, marginLeft: 6 }} onClick={() => onLoad(false)}>Retry</button></span>;
  }
  return (
    <span style={{ fontSize: T.label, color: C.slateM, display: "inline-flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
      {history.fixture && <b style={{ color: C.amberD }}>FIXTURE ENTRIES</b>}
      {history.items.length} newest entr{history.items.length === 1 ? "y" : "ies"} loaded
      {history.hasMore ? " — older entries exist" : " — complete"}
      {history.namesPartial && " · some actor names are not visible to you"}
      {history.stale && <b style={{ color: C.amberD }}>· records changed since this was read</b>}
      {history.olderError && <span style={{ color: C.red }}>· {history.olderError}</span>}
      <button type="button" style={rowButton} onClick={() => onLoad(false)}>{history.stale ? "Reload" : "Refresh"}</button>
      {history.hasMore && <button type="button" style={rowButton} disabled={s === "loading-older"}
        onClick={() => onLoad(true)}>{s === "loading-older" ? "Loading…" : "Load older"}</button>}
    </span>
  );
}

export default function ChangeHistoryPanel({ history, onLoad, onClose }) {
  return (
    <div aria-label="Change history" style={{ border: `1px solid ${C.border}`, borderRadius: 6, background: C.white,
      padding: "4px 10px 6px", marginBottom: 6 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
        <span style={{ fontSize: T.micro, fontWeight: 800, color: C.slateL, textTransform: "uppercase",
          letterSpacing: "0.05em" }}>Change history</span>
        <HistoryStatus history={history} onLoad={onLoad} />
        <button type="button" style={{ ...rowButton, marginLeft: "auto" }} onClick={onClose}>Close</button>
      </div>
      {(history.status === "ready" || history.status === "loading-older") && (
        <div style={{ maxHeight: 280, overflowY: "auto" }}><ChangeList items={history.items} /></div>
      )}
    </div>
  );
}
