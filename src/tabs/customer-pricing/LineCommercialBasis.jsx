// A Pricing Line's commercial basis (P0.2): which Stable Term and BF set it
// references, its recorded weights/area by SOURCE, and — for a line started
// from a prior Cycle — the prior agreed values as LOCKED comparison context.
import { useState } from "react";
import { C, T, mono } from "../../theme.js";
import { denseCell, denseHead, denseTable } from "../../ui/screenStandards.js";
import {
  MEASURES, MEASURE_SOURCES, applicableVersions, effectiveLabel, formatRate, measureBody, parseMeasure,
  referencesBody, scopeLabel, termSummary,
} from "../../lib/customerPricingModel.js";
import { pricingMutation, pricingPaths } from "../../lib/customerPricingActions.js";
import { Field, SelectIn, TextIn, VersionNotice } from "./pricingFormBits.jsx";
import { fieldLabel, panel, primaryRowButton, rowButton } from "./pricingStyles.js";

function ReferencesEditor({ line, cycle, terms, bfSets, lookups, report, onChanged }) {
  const [editing, setEditing] = useState(false);
  const [termId, setTermId] = useState("");
  const [bfId, setBfId] = useState("");
  const [baseVersion, setBaseVersion] = useState(line.content_version);
  const [busy, setBusy] = useState(false);
  const term = terms.find(t => t.id === line.term_version_id);
  const bfSet = bfSets.find(s => s.id === line.bf_delta_set_id);
  const termOpts = applicableVersions(terms, line, cycle);
  const bfOpts = applicableVersions(bfSets, line, cycle);

  const open = () => {
    setTermId(line.term_version_id ? String(line.term_version_id) : "");
    setBfId(line.bf_delta_set_id ? String(line.bf_delta_set_id) : "");
    setBaseVersion(line.content_version);
    setEditing(true);
  };
  const save = async () => {
    setBusy(true);
    const res = await pricingMutation(pricingPaths.references(line.id), referencesBody(termId, bfId, baseVersion), "PUT");
    setBusy(false);
    if (report(res, "Line basis saved.")) { setEditing(false); onChanged(); }
  };

  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <span style={fieldLabel}>Stable Term</span>
        <span>{term ? `v${term.version_no} ${scopeLabel(term, lookups)} (${effectiveLabel(term)}) — ${termSummary(term)}` : "None referenced"}</span>
        <span style={fieldLabel}>BF set</span>
        <span>{bfSet ? `v${bfSet.version_no} base BF ${bfSet.base_bf_code} (${effectiveLabel(bfSet)})` : "None referenced"}</span>
        {!editing && <button type="button" style={rowButton} onClick={open}>Change basis</button>}
      </div>
      {editing && (
        <div style={{ ...panel, background: "#FFFDF9", marginTop: 4 }}>
          <VersionNotice baseVersion={baseVersion} latestVersion={line.content_version}
            onRebase={() => setBaseVersion(line.content_version)} />
          <Field label="Stable Term (applies at cycle start)">
            <SelectIn value={termId} onChange={setTermId} blank="None" width={300} aria-label="Stable Term version"
              opts={termOpts.map(t => ({ v: String(t.id), l: `v${t.version_no} · ${scopeLabel(t, lookups)} · ${effectiveLabel(t)}` }))} />
          </Field>
          <Field label="BF delta set">
            <SelectIn value={bfId} onChange={setBfId} blank="None" width={260} aria-label="BF delta set"
              opts={bfOpts.map(s => ({ v: String(s.id), l: `v${s.version_no} · base ${s.base_bf_code} · ${scopeLabel(s, lookups)}` }))} />
          </Field>
          <span style={{ display: "inline-flex", gap: 4, verticalAlign: "bottom", marginBottom: 6 }}>
            <button type="button" style={primaryRowButton} disabled={busy} onClick={save}>{busy ? "Saving…" : "Save basis"}</button>
            <button type="button" style={rowButton} disabled={busy} onClick={() => setEditing(false)}>Cancel</button>
          </span>
          <div style={{ fontSize: T.label, color: C.slateL }}>
            Only versions active on {cycle?.period_start} for this line's scope (or a wider one) are offered. Rounds
            already recorded keep the term and BF schedule they were recorded with.
          </div>
        </div>
      )}
    </div>
  );
}

function MeasureCell({ line, measure, source, row, report, onChanged }) {
  const [editing, setEditing] = useState(null); // { value, baseVersion, error }
  const [busy, setBusy] = useState(false);
  const active = row && row.status !== "withdrawn";
  const save = async withdraw => {
    const parsed = withdraw ? { ok: true, value: null } : parseMeasure(editing.value);
    if (!parsed.ok || (!withdraw && parsed.value === null)) {
      setEditing(ed => ({ ...ed, error: parsed.error || "Enter a value, or Withdraw" }));
      return;
    }
    setBusy(true);
    const res = await pricingMutation(pricingPaths.measures(line.id),
      measureBody(measure, source, parsed.value, editing.baseVersion, row?.notes), "PUT");
    setBusy(false);
    if (report(res, withdraw ? "Value withdrawn (kept in history)." : "Value saved.")) { setEditing(null); onChanged(); }
  };
  if (editing) {
    return (
      <td style={{ ...denseCell, whiteSpace: "normal" }}>
        <VersionNotice baseVersion={editing.baseVersion} latestVersion={row?.content_version ?? null}
          onRebase={() => setEditing(ed => ({ ...ed, baseVersion: row?.content_version ?? null }))} />
        <TextIn value={editing.value} onChange={v => setEditing(ed => ({ ...ed, value: v, error: null }))} width={70}
          inputMode="decimal" aria-label={`${measure} from ${source}`} />
        {editing.error && <div role="alert" style={{ color: C.red, fontSize: T.label }}>{editing.error}</div>}
        <span style={{ display: "inline-flex", gap: 3, marginLeft: 3 }}>
          <button type="button" style={primaryRowButton} disabled={busy} onClick={() => save(false)}>Save</button>
          {active && <button type="button" style={rowButton} disabled={busy} onClick={() => save(true)}>Withdraw</button>}
          <button type="button" style={rowButton} disabled={busy} onClick={() => setEditing(null)}>×</button>
        </span>
      </td>
    );
  }
  return (
    <td style={{ ...denseCell, fontFamily: mono, textAlign: "right", cursor: "pointer",
      color: active ? C.slate : C.slateL }} title={row?.notes || "Click to record"}
      onClick={() => setEditing({ value: active ? row.value : "", baseVersion: row ? row.content_version : null, error: null })}>
      {active ? row.value : row ? <s>{row.value}</s> : "—"}
    </td>
  );
}

function MeasuresEditor({ line, report, onChanged }) {
  const rows = line.measures || [];
  return (
    <div style={{ marginBottom: 6 }}>
      <span style={fieldLabel}>Weights and area per box (each source kept separately — none overwrites another)</span>
      <table style={{ ...denseTable, width: "auto" }} aria-label="Weights and area">
        <thead><tr>
          <th scope="col" style={denseHead}>Measure</th>
          {MEASURE_SOURCES.map(s => <th key={s.v} scope="col" style={denseHead}>{s.l}</th>)}
        </tr></thead>
        <tbody>
          {MEASURES.map(m => (
            <tr key={m.v} style={{ height: 24 }}>
              <td style={{ ...denseCell, fontWeight: 700 }}>{m.l} ({m.unit})</td>
              {MEASURE_SOURCES.map(s => (
                <MeasureCell key={s.v} line={line} measure={m.v} source={s.v} report={report} onChanged={onChanged}
                  row={rows.find(r => r.measure === m.v && r.source === s.v)} />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ fontSize: T.label, color: C.slateL }}>
        Paper consumed includes wastage; sheet weight excludes it (Costing). Blank means not recorded — never zero.
        Comparisons use Customer-confirmed, then Costing, then manual, then imported, and say which.
      </div>
    </div>
  );
}

// Prior agreed values are shown LOCKED. Copying them into a draft is a
// separate, explicit action and still requires the user to save the round.
function PriorContext({ prior, unitOf, onCopy }) {
  if (!prior) return null;
  if (prior.missing) {
    return <div style={{ fontSize: T.label, color: C.slateL, marginBottom: 6 }}>
      Started from an earlier line that is outside the loaded history.</div>;
  }
  const agreed = prior.agreed;
  return (
    <div style={{ ...panel, background: "#F4F1EC", marginBottom: 6, display: "flex", gap: 10, alignItems: "center",
      flexWrap: "wrap" }} aria-label="Prior agreed (locked)">
      <span style={fieldLabel}>Prior agreed 🔒</span>
      {agreed
        ? <span style={{ fontFamily: mono }}>{formatRate(agreed.rate_inr, ...unitOf(agreed))} on {agreed.event_date}</span>
        : <span style={{ color: C.slateL }}>No active agreement in the prior cycle{prior.line?.events?.some(e =>
            e.event_type === "final_agreement" && e.status === "voided") ? " (a voided agreement is kept in its history)" : ""}.</span>}
      {agreed && <button type="button" style={rowButton} onClick={() => onCopy(agreed)}
        title="Opens a draft offer pre-filled with the prior agreed values. Nothing is saved until you record it.">
        Copy prior agreed to draft offer</button>}
    </div>
  );
}

export default function LineCommercialBasis({ line, cycle, terms, bfSets, lookups, prior, unitOf, onCopyPrior,
  report, onChanged }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <PriorContext prior={prior} unitOf={unitOf} onCopy={onCopyPrior} />
      <ReferencesEditor line={line} cycle={cycle} terms={terms} bfSets={bfSets} lookups={lookups}
        report={report} onChanged={onChanged} />
      <MeasuresEditor line={line} report={report} onChanged={onChanged} />
    </div>
  );
}
