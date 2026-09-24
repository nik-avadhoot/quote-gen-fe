// One negotiation round's OWN snapshotted BF schedule (P0.2). Derived rate =
// round's base-BF rate + the signed delta frozen when the round was recorded,
// so a later BF set version never changes what this shows. An override is set
// under the round's CAS, labelled, and shown beside the derived rate.
import { useState } from "react";
import { C, T, mono } from "../../theme.js";
import { denseCell, denseHead, denseTable } from "../../ui/screenStandards.js";
import { formatInr, overrideBody, parseInr } from "../../lib/customerPricingModel.js";
import { pricingMutation, pricingPaths } from "../../lib/customerPricingActions.js";
import { TextIn } from "./pricingFormBits.jsx";
import BfPastePanel from "./BfPastePanel.jsx";
import { primaryRowButton, rowButton } from "./pricingStyles.js";

function signed(delta) {
  if (delta === null || delta === undefined) return "base";
  return delta.startsWith("-") ? `−${formatInr(delta.slice(1), { symbol: false })}` : `+${formatInr(delta, { symbol: false })}`;
}

export default function BfScheduleTable({ event, unit, report, onChanged, partyId, fixture }) {
  const [editing, setEditing] = useState(null); // { bf_code, value, baseVersion, error }
  const [busy, setBusy] = useState(false);
  const [pasting, setPasting] = useState(false);
  const rows = event.bf_schedule || [];
  // P0.5: a voided round's schedule is kept for the record and can no longer change.
  const locked = event.status === "voided";
  if (!rows.length) return <span style={{ color: C.slateL, fontSize: T.label }}>No BF schedule on this round.</span>;

  const save = async clear => {
    const parsed = clear ? { ok: true, value: null } : parseInr(editing.value, { required: true });
    if (!parsed.ok) { setEditing(ed => ({ ...ed, error: parsed.error })); return; }
    setBusy(true);
    const res = await pricingMutation(pricingPaths.bfOverrides(event.id),
      overrideBody(editing.bf_code, parsed.value, editing.baseVersion), "PUT");
    setBusy(false);
    if (report(res, clear ? `BF ${editing.bf_code} back to its derived rate.` : `BF ${editing.bf_code} override saved.`)) {
      setEditing(null);
      onChanged();
    }
  };

  return (
    <div>
    <table style={{ ...denseTable, width: "auto" }} aria-label={`BF schedule for round ${event.sequence_no}`}>
      <thead><tr>{["BF", "Delta", "Derived", "Override", "Applies", ""].map(h =>
        <th key={h} scope="col" style={denseHead}>{h}</th>)}</tr></thead>
      <tbody>
        {rows.map(row => {
          const isEditing = editing?.bf_code === row.bf_code;
          return (
            <tr key={row.bf_code} style={{ height: 24, background: row.is_base ? C.amberL : undefined }}>
              <td style={{ ...denseCell, fontWeight: 700 }}>{row.bf_code}{row.is_base ? " (base)" : ""}</td>
              <td style={{ ...denseCell, fontFamily: mono, textAlign: "right" }}>{signed(row.delta_inr)}</td>
              <td style={{ ...denseCell, fontFamily: mono, textAlign: "right" }}>{formatInr(row.derived_rate_inr)}</td>
              <td style={{ ...denseCell, fontFamily: mono, textAlign: "right" }}>
                {isEditing
                  ? <TextIn value={editing.value} onChange={v => setEditing(ed => ({ ...ed, value: v, error: null }))}
                      width={80} inputMode="decimal" aria-label={`Override for BF ${row.bf_code}`} />
                  : row.is_override
                    ? <span style={{ color: C.orange, fontWeight: 700 }} title="Explicit BF-specific exception">
                        {formatInr(row.override_rate_inr)} OVERRIDE</span>
                    : "—"}
                {isEditing && editing.error && <div role="alert" style={{ color: C.red, fontSize: T.label }}>{editing.error}</div>}
              </td>
              <td style={{ ...denseCell, fontFamily: mono, textAlign: "right", fontWeight: 700 }}>
                {formatInr(row.effective_rate_inr)} <span style={{ fontWeight: 400, color: C.slateL }}>{unit}</span></td>
              <td style={{ ...denseCell, padding: "2px 8px" }}>
                {row.is_base || locked ? null : isEditing ? (
                  <span style={{ display: "inline-flex", gap: 4 }}>
                    <button type="button" style={primaryRowButton} disabled={busy} onClick={() => save(false)}>Save</button>
                    {row.is_override && <button type="button" style={rowButton} disabled={busy} onClick={() => save(true)}>Clear</button>}
                    <button type="button" style={rowButton} disabled={busy} onClick={() => setEditing(null)}>Cancel</button>
                  </span>
                ) : (
                  <button type="button" style={rowButton}
                    onClick={() => setEditing({ bf_code: row.bf_code, value: row.override_rate_inr ?? "",
                      baseVersion: event.content_version, error: null })}>
                    {row.is_override ? "Change override" : "Override"}</button>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
    {pasting
      ? <BfPastePanel partyId={partyId} event={event} fixture={fixture} onClose={() => setPasting(false)}
          onApplied={result => { setPasting(false); report({ ok: true, data: result },
            `${result?.applied ?? 0} BF override change(s) applied together.`); onChanged(); }} />
      : partyId && !locked && <button type="button" style={{ ...rowButton, marginTop: 4 }} onClick={() => setPasting(true)}
          title="Paste grade/rate rows from Excel or Sheets into this round's schedule">Paste BF rates…</button>}
    </div>
  );
}
