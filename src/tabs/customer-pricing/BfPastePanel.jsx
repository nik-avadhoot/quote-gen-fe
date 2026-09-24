// P0.4 BF-schedule paste into ONE round's own snapshotted schedule. Grades
// match by exact code only; a value equal to the derived rate stays derived;
// a different value becomes an OVERRIDE only with explicit consent; clearing an
// override is an explicit per-row decision. Same preview/apply pair as the grid.
import { useMemo, useState } from "react";
import { C, T, mono } from "../../theme.js";
import { denseCell, denseHead, denseTable } from "../../ui/screenStandards.js";
import { formatInr } from "../../lib/customerPricingModel.js";
import { buildBfPastePlan, parseClipboard } from "../../lib/customerPricingPaste.js";
import { panel, primaryRowButton, rowButton } from "./pricingStyles.js";
import { StatusChip, SubmitState } from "./PastePreviewPanel.jsx";
import usePasteSubmit from "./usePasteSubmit.js";

export default function BfPastePanel({ partyId, event, fixture, onClose, onApplied }) {
  const [text, setText] = useState("");
  const [anchorGrade, setAnchorGrade] = useState(event.bf_schedule?.[0]?.bf_code || null);
  const [acceptOverrides, setAcceptOverrides] = useState(false);
  const [decisions, setDecisions] = useState({ clear: new Set(), skip: new Set() });
  const submit = usePasteSubmit(partyId, fixture);
  const { reset } = submit;
  const plan = useMemo(() => buildBfPastePlan({ event, rows: parseClipboard(text).rows, anchorGrade, decisions,
    options: { acceptOverrides } }), [event, text, anchorGrade, decisions, acceptOverrides]);
  const toggle = (kind, key) => {
    setDecisions(d => { const n = new Set(d[kind]); if (n.has(key)) n.delete(key); else n.add(key); return { ...d, [kind]: n }; });
    reset();
  };
  return (
    <div style={{ ...panel, marginTop: 4, borderColor: C.amber }} aria-label={`BF paste for round ${event.sequence_no}`}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 4 }}>
        <b>Paste BF rates</b>
        <span style={{ fontSize: T.label, color: C.slateM }}>
          into round #{event.sequence_no} (record {event.id}, version v{event.content_version}) ·
          paste “GRADE ⇥ RATE” rows, or one column of rates starting at
        </span>
        <select value={anchorGrade || ""} onChange={e => { setAnchorGrade(e.target.value); reset(); }} aria-label="Start at BF grade"
          style={{ ...rowButton, height: 20 }}>
          {(event.bf_schedule || []).map(r => <option key={r.bf_code} value={r.bf_code}>BF {r.bf_code}</option>)}
        </select>
        <button type="button" style={{ ...rowButton, marginLeft: "auto" }} onClick={onClose}>Close</button>
      </div>
      <textarea value={text} rows={4} aria-label="Pasted BF rates" placeholder={"16\t53.25\n20\t55.75"}
        onChange={e => { setText(e.target.value); reset(); }}
        onPaste={e => { const t = e.clipboardData?.getData("text/plain"); if (t) { e.preventDefault(); setText(t); reset(); } }}
        style={{ width: "100%", fontFamily: mono, fontSize: T.label, boxSizing: "border-box" }} />
      {text.trim() && (
        <>
          <div style={{ fontSize: T.label, color: C.slateM, margin: "3px 0" }}>
            Read as {plan.mode === "grade-keyed" ? "grade-keyed rows" : "one column laid on the schedule"} ·{" "}
            {Object.entries(plan.counts).filter(([k]) => k !== "blank").map(([k, n]) => `${n} ${k}`).join(" · ")}
          </div>
          <table style={{ ...denseTable, width: "auto" }} aria-label="BF paste preview">
            <thead><tr>{["BF", "Pasted", "Derived", "Current override", "Verdict", ""].map(h =>
              <th key={h} scope="col" style={denseHead}>{h}</th>)}</tr></thead>
            <tbody>
              {plan.items.filter(it => it.status !== "blank" || it.canClear).map(it => (
                <tr key={it.key}>
                  <td style={{ ...denseCell, fontWeight: 700 }}>{it.grade || "—"}</td>
                  <td style={{ ...denseCell, fontFamily: mono }}>{it.text || "(blank)"}</td>
                  <td style={{ ...denseCell, fontFamily: mono }}>{formatInr(it.derived)}</td>
                  <td style={{ ...denseCell, fontFamily: mono }}>{formatInr(it.override)}</td>
                  <td style={{ ...denseCell, whiteSpace: "normal", maxWidth: 300 }}>
                    <StatusChip status={it.status} /> <span style={{ fontSize: T.label, color: C.slateM }}>{it.message}</span></td>
                  <td style={{ ...denseCell, padding: "2px 6px" }}>
                    <span style={{ display: "inline-flex", gap: 3 }}>
                      {it.canClear && (it.status === "blank" || it.status === "matches-derived" || it.status === "clear") && (
                        <button type="button" style={rowButton} onClick={() => toggle("clear", it.key)}>
                          {decisions.clear.has(it.key) ? "Keep override" : "Clear override"}</button>)}
                      {it.status !== "blank" && (
                        <button type="button" style={rowButton} onClick={() => toggle("skip", it.key)}>
                          {decisions.skip.has(it.key) ? "Include" : "Skip"}</button>)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <label style={{ fontSize: T.label, display: "inline-flex", gap: 4, alignItems: "center", marginTop: 4 }}>
            <input type="checkbox" checked={acceptOverrides} onChange={e => { setAcceptOverrides(e.target.checked); reset(); }} />
            Record values that differ from the derived rate as BF overrides
          </label>
          <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 4 }}>
            <button type="button" style={primaryRowButton}
              disabled={plan.blocking > 0 || !plan.ops.length || ["preparing", "applying", "prepared"].includes(submit.state.status)}
              onClick={() => submit.prepare({ operations: plan.ops })}>
              {fixture ? "Show the request (fixture)" : `Validate ${plan.ops.length} override change(s)`}</button>
            {plan.blocking > 0 && <span style={{ color: C.red, fontSize: T.label }}>{plan.blocking} blocked — resolve or skip</span>}
          </div>
          <SubmitState submit={submit} fixture={fixture} opsCount={plan.ops.length} onApplied={onApplied} />
        </>
      )}
    </div>
  );
}
