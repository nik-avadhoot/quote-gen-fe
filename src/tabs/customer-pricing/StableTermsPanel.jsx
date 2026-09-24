// Stable Terms and BF delta sets (P0.2): collapsed by default so long-lived
// terms are not repeated on every Cycle; expand to see every effective-dated
// version, add the next version, or make an audited CAS correction.
import { useState } from "react";
import { C, T, mono } from "../../theme.js";
import { denseCell, denseHead, denseTable } from "../../ui/screenStandards.js";
import {
  FREIGHT_TREATMENTS, RATE_BASES, SOURCE_TYPES, WASTAGE_TREATMENTS, WEIGHT_BASES, bfSetBody, bfSetCorrectionBody,
  effectiveLabel, formatInr, formatPct, labelOf, parseBfSchedule, rateUnitLabel, scopeLabel, termBody, validateTermForm,
} from "../../lib/customerPricingModel.js";
import { pricingMutation, pricingPaths } from "../../lib/customerPricingActions.js";
import { Field, SelectIn, TextIn, VersionNotice } from "./pricingFormBits.jsx";
import { fieldLabel, panel, primaryRowButton, rowButton } from "./pricingStyles.js";

const STATUSES = [{ v: "active", l: "Active" }, { v: "withdrawn", l: "Withdrawn" }];
const today = () => new Date().toISOString().slice(0, 10);

function ScopeFields({ form, set, locations, plants }) {
  return (
    <>
      <Field label="Location">
        <SelectIn value={form.customer_location_id} onChange={set("customer_location_id")} blank="Whole Customer"
          opts={locations.map(l => ({ v: String(l.id), l: l.location_code || `Location #${l.id}` }))} width={140}
          aria-label="Scope Location" />
      </Field>
      <Field label="Producing plant">
        <SelectIn value={form.plant_id} onChange={set("plant_id")} blank="Any plant"
          opts={plants.map(p => ({ v: String(p.id), l: p.plant_code }))} width={100} aria-label="Scope plant" />
      </Field>
    </>
  );
}

function SourceFields({ form, set }) {
  return (
    <>
      <Field label="Source">
        <SelectIn value={form.source_type} onChange={set("source_type")} opts={SOURCE_TYPES} blank="—" width={100}
          aria-label="Source type" />
      </Field>
      <Field label="Source date">
        <TextIn type="date" value={form.source_date} onChange={set("source_date")} width={130} aria-label="Source date" />
      </Field>
      <Field label="Reference">
        <TextIn value={form.source_ref} onChange={set("source_ref")} width={150} aria-label="Source reference" />
      </Field>
      <Field label="Notes">
        <TextIn value={form.notes} onChange={set("notes")} width={180} aria-label="Notes" />
      </Field>
    </>
  );
}

function TermForm({ partyId, term, mechanism, locations, plants, report, onDone, onCancel }) {
  const correcting = !!term;
  const [form, setForm] = useState(() => ({
    customer_location_id: "", plant_id: "", status: term?.status || "active",
    effective_from: term?.effective_from || today(), effective_to: term?.effective_to || "",
    rate_basis: term?.rate_basis ?? mechanism?.rate_basis ?? "", weight_basis: term?.weight_basis ?? mechanism?.weight_basis ?? "",
    wastage_treatment: term?.wastage_treatment || "not_captured", wastage_pct: term?.wastage_pct ?? "",
    freight_treatment: term?.freight_treatment || "not_captured",
    conversion_inr_per_kg: term?.conversion_inr_per_kg ?? "", freight_inr_per_kg: term?.freight_inr_per_kg ?? "",
    source_type: term?.source_type ?? "", source_date: term?.source_date ?? "", source_ref: term?.source_ref ?? "",
    notes: term?.notes ?? "",
  }));
  const [closePrior, setClosePrior] = useState(true);
  const [baseVersion, setBaseVersion] = useState(term?.content_version);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const set = k => v => setForm(f => ({ ...f, [k]: v }));
  const save = async () => {
    const check = validateTermForm(form);
    setErrors(check.errors);
    if (!check.ok) return;
    setBusy(true);
    const res = correcting
      ? await pricingMutation(pricingPaths.term(term.id), termBody(check.normalised, { expectedVersion: baseVersion }), "PATCH")
      : await pricingMutation(pricingPaths.terms(partyId), termBody(check.normalised, { closePrior }));
    setBusy(false);
    if (report(res, correcting ? "Stable Term corrected (audited)." : "New Stable Term version saved.")) onDone();
  };
  return (
    <div style={{ ...panel, background: "#FFFDF9", margin: "4px 0" }}>
      {correcting && <VersionNotice baseVersion={baseVersion} latestVersion={term.content_version}
        onRebase={() => setBaseVersion(term.content_version)} />}
      {!correcting && <ScopeFields form={form} set={set} locations={locations} plants={plants} />}
      <Field label="Effective from" error={errors.effective_from}>
        <TextIn type="date" value={form.effective_from} onChange={set("effective_from")} width={130} aria-label="Effective from" />
      </Field>
      <Field label="Effective to (optional)" error={errors.effective_to}>
        <TextIn type="date" value={form.effective_to} onChange={set("effective_to")} width={130} aria-label="Effective to" />
      </Field>
      {correcting && <Field label="Status">
        <SelectIn value={form.status} onChange={set("status")} opts={STATUSES} width={100} aria-label="Term status" />
      </Field>}
      <Field label="Rate basis">
        <SelectIn value={form.rate_basis} onChange={set("rate_basis")} opts={RATE_BASES} blank="Not yet captured" width={190}
          aria-label="Term rate basis" />
      </Field>
      <Field label="Weight basis">
        <SelectIn value={form.weight_basis} onChange={set("weight_basis")} opts={WEIGHT_BASES} blank="Not yet captured" width={190}
          aria-label="Term weight basis" />
      </Field>
      <Field label="Wastage">
        <SelectIn value={form.wastage_treatment} onChange={set("wastage_treatment")} opts={WASTAGE_TREATMENTS} width={190}
          aria-label="Wastage treatment" />
      </Field>
      {form.wastage_treatment === "added_pct" && (
        <Field label="Wastage %" error={errors.wastage_pct}>
          <TextIn value={form.wastage_pct} onChange={set("wastage_pct")} width={60} inputMode="decimal" aria-label="Wastage percent" />
        </Field>
      )}
      <Field label="Freight">
        <SelectIn value={form.freight_treatment} onChange={set("freight_treatment")} opts={FREIGHT_TREATMENTS} width={190}
          aria-label="Freight treatment" />
      </Field>
      <Field label="Conversion ₹/kg paper consumed" error={errors.conversion_inr_per_kg}>
        <TextIn value={form.conversion_inr_per_kg} onChange={set("conversion_inr_per_kg")} width={80} inputMode="decimal"
          aria-label="Conversion per kg paper consumed" style={{ fontFamily: mono }} />
      </Field>
      <Field label="Freight ₹/kg sheet weight" error={errors.freight_inr_per_kg}>
        <TextIn value={form.freight_inr_per_kg} onChange={set("freight_inr_per_kg")} width={80} inputMode="decimal"
          aria-label="Freight per kg sheet weight" style={{ fontFamily: mono }} />
      </Field>
      <SourceFields form={form} set={set} />
      {!correcting && (
        <label style={{ display: "block", fontSize: T.label, color: C.slateM, margin: "2px 0 4px" }}>
          <input type="checkbox" checked={closePrior} onChange={e => setClosePrior(e.target.checked)} />{" "}
          End the current open-ended version for this exact scope the day before this one starts (recorded as an audited change)
        </label>
      )}
      <span style={{ display: "inline-flex", gap: 4 }}>
        <button type="button" style={primaryRowButton} disabled={busy} onClick={save}>
          {busy ? "Saving…" : correcting ? "Save correction" : "Save new version"}</button>
        <button type="button" style={rowButton} disabled={busy} onClick={onCancel}>Cancel</button>
      </span>
      {correcting && <div style={{ fontSize: T.label, color: C.slateL, marginTop: 2 }}>
        A correction is audited with before/after. Rounds already recorded keep the values they were recorded with.</div>}
    </div>
  );
}

function BfSetForm({ partyId, bfSet, locations, plants, report, onDone, onCancel }) {
  const correcting = !!bfSet;
  const [form, setForm] = useState(() => ({
    customer_location_id: "", plant_id: "", status: bfSet?.status || "active",
    effective_from: bfSet?.effective_from || today(), effective_to: bfSet?.effective_to || "",
    base_bf_code: bfSet?.base_bf_code || "", schedule: "",
    source_type: bfSet?.source_type ?? "", source_date: bfSet?.source_date ?? "", source_ref: bfSet?.source_ref ?? "",
    notes: bfSet?.notes ?? "",
  }));
  const [closePrior, setClosePrior] = useState(true);
  const [baseVersion, setBaseVersion] = useState(bfSet?.content_version);
  const [errors, setErrors] = useState([]);
  const [busy, setBusy] = useState(false);
  const set = k => v => setForm(f => ({ ...f, [k]: v }));
  const parsed = correcting ? null : parseBfSchedule(form.schedule, form.base_bf_code);
  const save = async () => {
    const errs = [];
    if (!form.effective_from) errs.push("Effective from is required");
    if (form.effective_to && form.effective_to < form.effective_from) errs.push("Effective to is before effective from");
    if (!correcting && !parsed.ok) errs.push(...parsed.errors);
    setErrors(errs);
    if (errs.length) return;
    setBusy(true);
    const res = correcting
      ? await pricingMutation(pricingPaths.bfSet(bfSet.id), bfSetCorrectionBody(form, baseVersion), "PATCH")
      : await pricingMutation(pricingPaths.bfSets(partyId), bfSetBody(form, parsed.deltas, { closePrior }));
    setBusy(false);
    if (report(res, correcting ? "BF set dates/status corrected (audited)." : "New BF delta set version saved.")) onDone();
  };
  return (
    <div style={{ ...panel, background: "#FFFDF9", margin: "4px 0" }}>
      {correcting && <VersionNotice baseVersion={baseVersion} latestVersion={bfSet.content_version}
        onRebase={() => setBaseVersion(bfSet.content_version)} />}
      {!correcting && <ScopeFields form={form} set={set} locations={locations} plants={plants} />}
      <Field label="Effective from"><TextIn type="date" value={form.effective_from} onChange={set("effective_from")} width={130}
        aria-label="BF effective from" /></Field>
      <Field label="Effective to (optional)"><TextIn type="date" value={form.effective_to} onChange={set("effective_to")} width={130}
        aria-label="BF effective to" /></Field>
      {correcting ? (
        <Field label="Status"><SelectIn value={form.status} onChange={set("status")} opts={STATUSES} width={100}
          aria-label="BF set status" /></Field>
      ) : (
        <>
          <Field label="Base BF"><TextIn value={form.base_bf_code} onChange={set("base_bf_code")} width={60}
            aria-label="Base BF" placeholder="18" /></Field>
          <Field label="Other BF deltas (₹, signed)" width={260}>
            <textarea value={form.schedule} onChange={e => set("schedule")(e.target.value)} rows={3}
              aria-label="BF delta schedule" placeholder={"16:-1.00\n20:+1.50\n22GY:+3.25"}
              style={{ width: 250, fontFamily: mono, fontSize: T.body, border: `1px solid ${C.border}`, borderRadius: 4 }} />
          </Field>
          {parsed.deltas.length > 0 && (
            <span style={{ fontSize: T.label, color: C.slateM, display: "inline-block", verticalAlign: "top", marginTop: 14 }}>
              {parsed.deltas.map(d => `${d.bf_code} ${d.delta_inr.startsWith("-") ? "" : "+"}${d.delta_inr}`).join(" · ")}
            </span>
          )}
        </>
      )}
      <SourceFields form={form} set={set} />
      {!correcting && (
        <label style={{ display: "block", fontSize: T.label, color: C.slateM, margin: "2px 0 4px" }}>
          <input type="checkbox" checked={closePrior} onChange={e => setClosePrior(e.target.checked)} />{" "}
          End the current open-ended set for this exact scope the day before this one starts (audited)
        </label>
      )}
      {errors.length > 0 && <ul role="alert" style={{ color: C.red, fontSize: T.label, margin: "2px 0 4px 14px", padding: 0 }}>
        {errors.map(e => <li key={e}>{e}</li>)}</ul>}
      <span style={{ display: "inline-flex", gap: 4 }}>
        <button type="button" style={primaryRowButton} disabled={busy} onClick={save}>
          {busy ? "Saving…" : correcting ? "Save correction" : "Save new BF set"}</button>
        <button type="button" style={rowButton} disabled={busy} onClick={onCancel}>Cancel</button>
      </span>
      <div style={{ fontSize: T.label, color: C.slateL, marginTop: 2 }}>
        {correcting ? "Deltas are fixed once saved — a different schedule is a new version."
          : "Derived BF rate = the round's base-BF rate + this signed delta. Later versions never change earlier rounds."}
      </div>
    </div>
  );
}

function deltasLabel(bfSet) {
  return (bfSet.deltas || []).map(d => `${d.bf_code} ${d.delta_inr.startsWith("-") ? "−" + d.delta_inr.slice(1) : "+" + d.delta_inr}`)
    .join(" · ") || "—";
}

export default function StableTermsPanel({ partyId, mechanism, terms, bfSets, locations, plants, report, onChanged }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(null); // { kind: "term"|"bf", target? }
  const lookups = { locations, plants };
  const activeTerms = terms.filter(t => t.status === "active");
  const activeBf = bfSets.filter(s => s.status === "active");
  const done = () => { setForm(null); onChanged(); };
  return (
    <div style={{ ...panel, marginBottom: 6 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={fieldLabel}>Stable Terms</span>
        <span>{activeTerms.length} active {activeTerms.length === 1 ? "version" : "versions"}
          {activeTerms[0] ? ` · latest ${scopeLabel(activeTerms[0], lookups)} from ${activeTerms[0].effective_from}` : ""}</span>
        <span style={fieldLabel}>BF sets</span>
        <span>{activeBf.length ? `${activeBf.length} active · base BF ${activeBf[0].base_bf_code}` : "none"}</span>
        <button type="button" style={rowButton} aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? "Hide versions ▴" : "Show versions ▾"}</button>
      </div>
      {open && (
        <div style={{ marginTop: 6 }}>
          <table style={{ ...denseTable, width: "auto" }} aria-label="Stable Term versions">
            <thead><tr>{["Scope", "v", "Effective", "Status", "Rate basis", "Wastage", "Freight", "Conv /kg PC",
              "Freight /kg SW", ""].map(h => <th key={h} scope="col" style={denseHead}>{h}</th>)}</tr></thead>
            <tbody>
              {!terms.length && <tr><td colSpan={10} style={{ ...denseCell, color: C.slateL }}>No Stable Terms yet.</td></tr>}
              {terms.map(t => (
                <tr key={t.id} style={{ height: 24, color: t.status === "active" ? C.slate : C.slateL }}>
                  <td style={denseCell}>{scopeLabel(t, lookups)}</td>
                  <td style={denseCell}>v{t.version_no}</td>
                  <td style={denseCell}>{effectiveLabel(t)}</td>
                  <td style={denseCell}>{t.status}</td>
                  <td style={denseCell}>{t.rate_basis ? `${labelOf(RATE_BASES, t.rate_basis)} ${rateUnitLabel(t.rate_basis, t.weight_basis)}` : "—"}</td>
                  <td style={denseCell}>{t.wastage_treatment === "added_pct" ? `+${formatPct(t.wastage_pct)}` : labelOf(WASTAGE_TREATMENTS, t.wastage_treatment)}</td>
                  <td style={denseCell}>{labelOf(FREIGHT_TREATMENTS, t.freight_treatment)}</td>
                  <td style={{ ...denseCell, fontFamily: mono, textAlign: "right" }}>{formatInr(t.conversion_inr_per_kg)}</td>
                  <td style={{ ...denseCell, fontFamily: mono, textAlign: "right" }}>{formatInr(t.freight_inr_per_kg)}</td>
                  <td style={{ ...denseCell, padding: "2px 8px" }}>
                    <button type="button" style={rowButton} onClick={() => setForm({ kind: "term", target: t })}>Correct</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          {form?.kind === "term"
            ? <TermForm key={form.target?.id ?? "new"} partyId={partyId} term={form.target} mechanism={mechanism}
                locations={locations} plants={plants} report={report} onDone={done} onCancel={() => setForm(null)} />
            : <button type="button" style={{ ...primaryRowButton, margin: "4px 0 8px" }}
                onClick={() => setForm({ kind: "term" })}>+ New Stable Term version</button>}

          <table style={{ ...denseTable, width: "auto" }} aria-label="BF delta sets">
            <thead><tr>{["Scope", "v", "Effective", "Status", "Base BF", "Deltas (₹)", ""].map(h =>
              <th key={h} scope="col" style={denseHead}>{h}</th>)}</tr></thead>
            <tbody>
              {!bfSets.length && <tr><td colSpan={7} style={{ ...denseCell, color: C.slateL }}>No BF delta sets yet.</td></tr>}
              {bfSets.map(s => (
                <tr key={s.id} style={{ height: 24, color: s.status === "active" ? C.slate : C.slateL }}>
                  <td style={denseCell}>{scopeLabel(s, lookups)}</td>
                  <td style={denseCell}>v{s.version_no}</td>
                  <td style={denseCell}>{effectiveLabel(s)}</td>
                  <td style={denseCell}>{s.status}</td>
                  <td style={{ ...denseCell, fontWeight: 700 }}>{s.base_bf_code}</td>
                  <td style={{ ...denseCell, fontFamily: mono, maxWidth: 320 }} title={deltasLabel(s)}>{deltasLabel(s)}</td>
                  <td style={{ ...denseCell, padding: "2px 8px" }}>
                    <button type="button" style={rowButton} onClick={() => setForm({ kind: "bf", target: s })}>Correct</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          {form?.kind === "bf"
            ? <BfSetForm key={form.target?.id ?? "new"} partyId={partyId} bfSet={form.target} locations={locations}
                plants={plants} report={report} onDone={done} onCancel={() => setForm(null)} />
            : <button type="button" style={{ ...primaryRowButton, marginTop: 4 }}
                onClick={() => setForm({ kind: "bf" })}>+ New BF delta set version</button>}
        </div>
      )}
    </div>
  );
}
