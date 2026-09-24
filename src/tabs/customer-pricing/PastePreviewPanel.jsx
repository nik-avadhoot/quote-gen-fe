// P0.4 main-grid paste: preview every pasted cell against the canonical record
// and field it lands on, let the user resolve / clear / skip explicitly, then
// prepare ONE server-validated batch and apply it atomically. The pasted text
// and every decision stay in this panel after any failure.
import { Fragment, useMemo, useState } from "react";
import { C, T, mono } from "../../theme.js";
import { denseCell, denseHead, denseTable } from "../../ui/screenStandards.js";
import { cycleLabel } from "../../lib/customerPricingModel.js";
import {
  BLOCKING, buildPastePlan, issuesToCells, mapPaste, parseClipboard, pasteRequestBody, pasteStatusLabel,
} from "../../lib/customerPricingPaste.js";
import { Field, SelectIn, TextIn } from "./pricingFormBits.jsx";
import { panel, primaryRowButton, rowButton } from "./pricingStyles.js";
import usePasteSubmit from "./usePasteSubmit.js";

const today = () => new Date().toISOString().slice(0, 10);

const STATUS_COLOR = {
  changed: C.green, new: C.green, clear: C.orange, override: C.orange, "free-text": C.amberD, matched: C.green,
  unchanged: C.slateL, blank: C.slateL, skipped: C.slateL, context: C.slateM, "matches-derived": C.slateM,
  "not-target": C.slateL, outside: C.slateL,
};
const colorOf = s => (BLOCKING.has(s) || s === "needs-override-consent" ? C.red : STATUS_COLOR[s] || C.slateM);

export function StatusChip({ status }) {
  return (
    <span style={{ fontSize: T.micro, fontWeight: 800, color: colorOf(status), textTransform: "uppercase",
      letterSpacing: "0.04em", whiteSpace: "nowrap" }}>{pasteStatusLabel[status] || status}</span>
  );
}

export function SubmitState({ submit, fixture, opsCount, onApplied }) {
  const s = submit.state;
  if (s.status === "fixture") {
    return (
      <div role="log" aria-label="Fixture paste request (not sent)" style={{ border: `1px dashed ${C.amber}`, borderRadius: 5,
        padding: "3px 8px", marginTop: 4, fontSize: T.label }}>
        <b style={{ color: C.amberD }}>FIXTURE ONLY — the one request this paste would send (nothing was sent):</b>
        <pre style={{ margin: "2px 0", whiteSpace: "pre-wrap" }}>{`${s.request.method} ${s.request.path}  ${JSON.stringify(s.request.body)}`}</pre>
      </div>
    );
  }
  if (s.status === "prepared") {
    return (
      <div role="status" style={{ color: C.green, fontSize: T.label, marginTop: 4 }}>
        Server-validated: {s.preview.operations} change{s.preview.operations === 1 ? "" : "s"} prepared for you and this
        Customer, bound to exactly what is shown · expires {String(s.preview.expires_at).slice(11, 16)} UTC.
        <button type="button" style={{ ...primaryRowButton, marginLeft: 8 }} onClick={async () => {
          const res = await submit.apply();
          if (res?.ok) onApplied(res.data);
        }}>Apply {opsCount} change{opsCount === 1 ? "" : "s"}</button>
      </div>
    );
  }
  if (s.status === "preparing" || s.status === "applying") {
    return <div role="status" style={{ color: C.slateM, fontSize: T.label, marginTop: 4 }}>
      {s.status === "preparing" ? "Validating on the server…" : "Applying the whole batch…"}</div>;
  }
  if (s.status === "blocked" || s.status === "failed") {
    const hint = s.errorCode === "STALE_VERSION" ? " Someone saved a record after you pasted. Nothing was applied — reload, then prepare again (your paste is kept)."
      : s.errorCode === "PREVIEW_EXPIRED" ? " Prepare it again." : s.outcomeUnknown ? " The outcome is unknown — reload before trying again." : "";
    return <div role="alert" style={{ color: C.red, fontSize: T.label, marginTop: 4 }}>
      {s.message}{hint}{fixture ? "" : " Your pasted draft and decisions are kept."}</div>;
  }
  return null;
}

export default function PastePreviewPanel({ party, data, view, input, fixture, onClose, onApplied }) {
  const [text, setText] = useState(input.text);
  const [editing, setEditing] = useState(!!input.edit);
  const [decisions, setDecisions] = useState({ clear: new Set(), skip: new Set(), keepAsText: new Set(),
    acceptDuplicate: new Set(), sobAsPct: new Set(), sobAsBoxes: new Set() });
  const anchorRec = view.records.find(r => r.key === input.anchor?.recordKey) || view.records[0];
  const [options, setOptions] = useState({ newLineCycleId: anchorRec ? String(anchorRec.cycle.id) : "", roundDate: today(), gstPct: "" });
  const submit = usePasteSubmit(party.id, fixture);
  const { reset } = submit;

  const parsed = useMemo(() => parseClipboard(text), [text]);
  const plan = useMemo(() => {
    const entries = mapPaste({ rows: parsed.rows, view, visibleKeys: input.visibleKeys, anchor: input.anchor });
    return buildPastePlan({ entries, data, ctx: view.ctx, decisions, options });
  }, [parsed, view, input, data, decisions, options]);
  const serverIssues = submit.state.status === "blocked" ? issuesToCells(plan, submit.state.issues) : new Map();

  // Any change to what would be sent invalidates a prepared preview.
  const toggle = (kind, key) => {
    setDecisions(d => {
      const next = new Set(d[kind]);
      if (next.has(key)) next.delete(key); else next.add(key);
      return { ...d, [kind]: next };
    });
    reset();
  };
  // A bare SOB number is % OR boxes only by the user's explicit choice; one
  // choice per cell (choosing one withdraws the other; choosing it again undoes it).
  const chooseSobMode = (kind, key) => {
    setDecisions(d => {
      const other = kind === "sobAsPct" ? "sobAsBoxes" : "sobAsPct";
      const mine = new Set(d[kind]); const theirs = new Set(d[other]);
      if (mine.has(key)) mine.delete(key); else { mine.add(key); theirs.delete(key); }
      return { ...d, [kind]: mine, [other]: theirs };
    });
    reset();
  };
  const setOpt = k => v => { setOptions(o => ({ ...o, [k]: v })); reset(); };
  const anchorField = view.fields.find(f => f.id === input.anchor?.fieldId) || view.fields[0];
  const hasNew = plan.targets.some(t => t.isNew && t.cells.some(c => c.status !== "blank"));
  const hasRounds = plan.cells.some(c => c.field && /^neg\.(our_offer|customer_offer|final_agreed)$/.test(c.field.id)
    && String(c.text).trim());
  const including = data?.mechanism?.tax_treatment === "including_gst";
  const countLine = Object.entries(plan.counts).filter(([k, n]) => n && k !== "blank")
    .map(([k, n]) => `${n} ${k === "newRecords" ? "new line(s)" : k === "matched" ? "matched record(s)" : (pasteStatusLabel[k] || k).toLowerCase()}`)
    .join(" · ");

  return (
    <div style={{ ...panel, marginBottom: 6, borderColor: C.amber }} aria-label="Paste preview">
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 4 }}>
        <b>Paste preview</b>
        <span style={{ fontSize: T.label, color: C.slateM }}>
          {parsed.rows.length} row(s) × {parsed.rows[0]?.length || 0} column(s) from
          {" "}<b>{anchorRec ? `${cycleLabel(anchorRec.cycle, view.ctx.labelStyle)}` : "—"}</b> · <b>{anchorField?.label}</b>
          {" "}({view.orientation === "transposed" ? "Transposed: pasted rows are fields" : "Standard: pasted rows are lines"})</span>
        <button type="button" style={rowButton} onClick={() => setEditing(e => !e)}>{editing ? "Hide pasted text" : "Edit pasted text"}</button>
        <button type="button" style={{ ...rowButton, marginLeft: "auto" }} onClick={onClose}>Close</button>
      </div>
      {editing && (
        <textarea value={text} onChange={e => { setText(e.target.value); reset(); }} rows={5} aria-label="Pasted text"
          style={{ width: "100%", fontFamily: mono, fontSize: T.label, boxSizing: "border-box" }} />
      )}
      {parsed.error && <div role="alert" style={{ color: C.red, fontSize: T.label }}>{parsed.error}</div>}
      {(hasNew || hasRounds || including) && (
        <div style={{ margin: "2px 0 4px" }}>
          {hasNew && (
            <Field label="New lines go to Cycle">
              <SelectIn value={options.newLineCycleId} onChange={setOpt("newLineCycleId")} blank="Choose…" width={170}
                aria-label="Cycle for new lines" opts={(data.cycles || []).map(c => ({ v: String(c.id), l: cycleLabel(c, view.ctx.labelStyle) }))} />
            </Field>
          )}
          {hasRounds && (
            <Field label="Round date (pasted rates add rounds)">
              <TextIn type="date" value={options.roundDate} onChange={setOpt("roundDate")} width={140} aria-label="Round date" />
            </Field>
          )}
          {hasRounds && including && (
            <Field label="GST % that applied">
              <TextIn value={options.gstPct} onChange={setOpt("gstPct")} width={60} inputMode="decimal" aria-label="GST percent" />
            </Field>
          )}
        </div>
      )}
      <div style={{ fontSize: T.label, color: C.slateM, marginBottom: 4 }}>{countLine || "Nothing to change."}</div>
      {plan.planIssues.map(m => <div key={m} role="alert" style={{ color: C.red, fontSize: T.label }}>{m}</div>)}
      <div style={{ maxHeight: 320, overflow: "auto", border: `1px solid ${C.border}`, borderRadius: 5 }}>
        <table style={{ ...denseTable, width: "100%" }} aria-label="Pasted cells">
          <thead><tr>{["Target record", "Field", "Pasted", "Verdict", "Before → after", ""].map(h =>
            <th key={h} scope="col" style={denseHead}>{h}</th>)}</tr></thead>
          <tbody>
            {plan.targets.map(t => {
              const shown = t.cells.filter(c => c.status !== "blank" || c.canClear);
              if (!shown.length) return null;
              return (
                <Fragment key={t.rowKey}>
                  {shown.map((c, idx) => {
                    const server = serverIssues.get(c.key);
                    return (
                      <tr key={c.key} style={{ background: BLOCKING.has(c.status) || server ? "#FDF0EE" : undefined }}>
                        <td style={{ ...denseCell, fontWeight: idx === 0 ? 700 : 400, color: idx === 0 ? C.slate : C.slateL }}>
                          {idx === 0 ? `${t.isNew ? "＋ " : ""}${t.label}` : ""}</td>
                        <td style={denseCell}>{c.field?.label || "—"}</td>
                        <td style={{ ...denseCell, fontFamily: mono }} title={c.text}>{c.text || "(blank)"}</td>
                        <td style={{ ...denseCell, whiteSpace: "normal", maxWidth: 320 }}>
                          <StatusChip status={c.status} /> <span style={{ fontSize: T.label, color: C.slateM }}>{c.message}</span>
                          {server && <div role="alert" style={{ color: C.red, fontSize: T.label }}>Server: {server.message}</div>}
                        </td>
                        <td style={{ ...denseCell, fontFamily: mono }}>
                          {c.before !== null || c.after !== null ? `${c.before ?? "—"} → ${c.after ?? "(cleared)"}` : ""}</td>
                        <td style={{ ...denseCell, padding: "2px 6px" }}>
                          <span style={{ display: "inline-flex", gap: 3 }}>
                            {!String(c.text).trim() && c.canClear && (
                              <button type="button" aria-pressed={decisions.clear.has(c.key)} style={rowButton}
                                onClick={() => toggle("clear", c.key)}>{decisions.clear.has(c.key) ? "Keep" : "Clear"}</button>)}
                            {(c.status === "unresolved" || (c.status === "free-text" && decisions.keepAsText.has(c.key))) && c.field?.id !== "line.scope_text" && (
                              <button type="button" style={rowButton} onClick={() => toggle("keepAsText", c.key)}>
                                {decisions.keepAsText.has(c.key) ? "Undo free text" : "Keep as free text"}</button>)}
                            {(c.status === "duplicate" && c.field && /^neg\./.test(c.field.id) || decisions.acceptDuplicate.has(c.key)) && (
                              <button type="button" style={rowButton} onClick={() => toggle("acceptDuplicate", c.key)}>
                                {decisions.acceptDuplicate.has(c.key) ? "Undo" : "Record anyway"}</button>)}
                            {c.sobModeChoice && c.status !== "skipped" && (<>
                              <button type="button" style={rowButton} aria-pressed={decisions.sobAsPct.has(c.key)}
                                onClick={() => chooseSobMode("sobAsPct", c.key)}>Treat as %</button>
                              <button type="button" style={rowButton} aria-pressed={decisions.sobAsBoxes.has(c.key)}
                                onClick={() => chooseSobMode("sobAsBoxes", c.key)}>Treat as boxes</button>
                            </>)}
                            {c.status !== "blank" && (
                              <button type="button" style={rowButton} onClick={() => toggle("skip", c.key)}>
                                {decisions.skip.has(c.key) ? "Include" : "Skip"}</button>)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 6, flexWrap: "wrap" }}>
        <button type="button" style={primaryRowButton}
          disabled={plan.blocking > 0 || !plan.ops.length || ["preparing", "applying", "prepared"].includes(submit.state.status)}
          onClick={() => submit.prepare(pasteRequestBody(plan))}
          title={plan.blocking ? "Resolve or skip every blocked cell first" : ""}>
          {fixture ? "Show the request (fixture)" : `Validate ${plan.ops.length} change${plan.ops.length === 1 ? "" : "s"} on the server`}</button>
        <span style={{ fontSize: T.label, color: plan.blocking ? C.red : C.slateL }}>
          {plan.blocking ? `${plan.blocking} blocked — resolve or skip them` : "One batch, one request; applied all together or not at all."}</span>
      </div>
      <SubmitState submit={submit} fixture={fixture} opsCount={plan.ops.length} onApplied={onApplied} />
    </div>
  );
}
