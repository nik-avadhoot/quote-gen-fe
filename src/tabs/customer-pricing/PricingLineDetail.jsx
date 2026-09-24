// Expanded Pricing Line: every negotiation round in order, add a round,
// correct a round (CAS), and edit the line's scope and Share of Business.
// P0.2 adds the commercial basis (Stable Term / BF set / weights), component
// breakup with an exact reconciliation, each round's own BF schedule with
// overrides, equivalent comparisons, and the locked prior-cycle context.
// Every save goes to the backend; nothing is kept in browser storage.
import { Fragment, useState } from "react";
import { C, T, mono } from "../../theme.js";
import { denseCell, denseHead, denseTable } from "../../ui/screenStandards.js";
import {
  EVENT_TYPES, SOB_STATES, SOURCE_TYPES, TAX_TREATMENTS, blankEventForm, draftFromPriorAgreed, equivalentRate,
  bfFloorViolations, eventBody, formatInr, formatPct, formatRate, labelOf, lineBody, lineFormFromRecord,
  priorAgreedFor, timelineEvents,
  rateUnitLabel, reconcile, termComponentInRoundUnit, validateEventForm, validateLineForm,
  validateVoidReason, voidRoundBody, VOID_REASON_MAX,
} from "../../lib/customerPricingModel.js";
import { newClientRequestId, pricingMutation, pricingPaths } from "../../lib/customerPricingActions.js";
import BfScheduleTable from "./BfScheduleTable.jsx";
import { ChangeList, HistoryStatus } from "./ChangeHistoryPanel.jsx";
import { changesForLine } from "../../lib/customerPricingFilters.js";
import LineCommercialBasis from "./LineCommercialBasis.jsx";
import { Field, SelectIn, TextIn, VersionNotice } from "./pricingFormBits.jsx";
import { panel, primaryRowButton, rowButton } from "./pricingStyles.js";

const today = () => new Date().toISOString().slice(0, 10);

function eventForm(e) {
  return { event_type: e.event_type, event_date: e.event_date, rate_inr: e.rate_inr ?? "",
    tax_treatment: e.tax_treatment || "excluding_gst", gst_pct: e.gst_pct ?? "",
    kraft_inr: e.component_kraft_inr ?? "", conversion_inr: e.component_conversion_inr ?? "",
    freight_inr: e.component_freight_inr ?? "",
    source_type: e.source_type ?? "", source_date: e.source_date ?? "", source_ref: e.source_ref ?? "",
    notes: e.notes ?? "" };
}

function EventForm({ initial, submitLabel, onSubmit, onCancel, baseVersion, latestVersion, onRebase, term, unit,
  rateBasis, weightBasis, measures, bfDeltas }) {
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const set = k => v => setForm(f => ({ ...f, [k]: v }));
  const submit = async () => {
    const check = validateEventForm(form);
    // Pre-check only: the database refuses a round whose BF schedule would go negative.
    const below = check.ok ? bfFloorViolations(check.normalised.rate_inr, bfDeltas) : [];
    if (below.length) check.errors.rate_inr = `BF ${below.join(", ")} would fall below ₹0.00 at this base rate`;
    setErrors(check.errors);
    if (!check.ok || below.length) return;
    setBusy(true);
    const done = await onSubmit(check.normalised);
    setBusy(false);
    if (done) setForm(initial);
  };
  // Stable-Term conversion/freight CONVERTED into this round's unit (exact,
  // half-up). A component that cannot be converted is left unfilled and says why.
  const converted = term ? {
    conversion: termComponentInRoundUnit(term, "conversion", rateBasis, weightBasis, measures),
    freight: termComponentInRoundUnit(term, "freight", rateBasis, weightBasis, measures),
  } : null;
  const fillFromTerm = () => setForm(f => ({ ...f,
    conversion_inr: converted.conversion.available ? converted.conversion.value : f.conversion_inr,
    freight_inr: converted.freight.available ? converted.freight.value : f.freight_inr }));
  const preview = reconcile(form.rate_inr, form);
  const diffNonZero = preview.diff !== null && preview.diff !== "0.00";
  return (
    <div style={{ ...panel, background: "#FFFDF9", marginTop: 6 }}>
      <VersionNotice baseVersion={baseVersion} latestVersion={latestVersion} onRebase={onRebase} />
      <Field label="Who" error={errors.event_type}>
        <SelectIn value={form.event_type} onChange={set("event_type")} opts={EVENT_TYPES} blank="Choose…"
          aria-label="Offer made by" />
      </Field>
      <Field label="Date" error={errors.event_date}>
        <TextIn type="date" value={form.event_date} onChange={set("event_date")} width={130} aria-label="Offer date" />
      </Field>
      <Field label={`Rate (₹) ${unit}`} error={errors.rate_inr}>
        <TextIn value={form.rate_inr} onChange={set("rate_inr")} width={100} inputMode="decimal"
          placeholder="0.00" aria-label="Rate in rupees" style={{ fontFamily: mono }} />
      </Field>
      <Field label="Tax">
        <SelectIn value={form.tax_treatment} onChange={set("tax_treatment")} opts={TAX_TREATMENTS} width={120}
          aria-label="Tax treatment" />
      </Field>
      {form.tax_treatment === "including_gst" && (
        <Field label="GST %" error={errors.gst_pct}>
          <TextIn value={form.gst_pct} onChange={set("gst_pct")} width={60} inputMode="decimal" aria-label="GST percent" />
        </Field>
      )}
      <div style={{ margin: "2px 0 4px" }}>
        <Field label={`Kraft paper (₹${unit})`} error={errors.kraft_inr}>
          <TextIn value={form.kraft_inr} onChange={set("kraft_inr")} width={80} inputMode="decimal"
            aria-label="Kraft paper component" style={{ fontFamily: mono }} />
        </Field>
        <Field label={`Conversion (₹${unit})`} error={errors.conversion_inr}>
          <TextIn value={form.conversion_inr} onChange={set("conversion_inr")} width={80} inputMode="decimal"
            aria-label="Conversion component" style={{ fontFamily: mono }} />
        </Field>
        <Field label={`Freight (₹${unit})`} error={errors.freight_inr}>
          <TextIn value={form.freight_inr} onChange={set("freight_inr")} width={80} inputMode="decimal"
            aria-label="Freight component" style={{ fontFamily: mono }} />
        </Field>
        {converted && (converted.conversion.available || converted.freight.available) && (
          <button type="button" style={{ ...rowButton, verticalAlign: "bottom", marginBottom: 6 }} onClick={fillFromTerm}
            title="Converts the Stable Term's ₹/kg values into this round's unit using the recorded weights">
            Fill converted Stable-Term conversion/freight</button>
        )}
        <span style={{ fontSize: T.label, color: diffNonZero ? C.orange : C.slateL, marginLeft: 6,
          verticalAlign: "bottom", display: "inline-block", marginBottom: 8 }}>
          {preview.total === null ? "Components optional"
            : `Components ${formatInr(preview.total)} · recorded ${formatInr(form.rate_inr)}`
              + (preview.diff === null ? "" : ` · difference ${formatInr(preview.diff)}`)
              + ` (all ₹${unit})`}
        </span>
        {converted && (
          <div style={{ fontSize: T.label, color: C.slateL }} aria-label="Stable-Term conversion">
            {["conversion", "freight"].map(k => (
              <div key={k}>
                {converted[k].available
                  ? `Stable-Term ${k}: ${formatInr(converted[k].value)}${unit} = ${converted[k].note}`
                  : `Stable-Term ${k} not filled — ${converted[k].reason}`}
              </div>
            ))}
          </div>
        )}
      </div>
      <Field label="Source">
        <SelectIn value={form.source_type} onChange={set("source_type")} opts={SOURCE_TYPES} blank="—" width={100}
          aria-label="Source type" />
      </Field>
      <Field label="Source date">
        <TextIn type="date" value={form.source_date} onChange={set("source_date")} width={130} aria-label="Source date" />
      </Field>
      <Field label="Reference / link">
        <TextIn value={form.source_ref} onChange={set("source_ref")} width={160} aria-label="Source reference" />
      </Field>
      <Field label="Notes">
        <TextIn value={form.notes} onChange={set("notes")} width={200} aria-label="Notes" />
      </Field>
      <span style={{ display: "inline-flex", gap: 4, verticalAlign: "bottom", marginBottom: 6 }}>
        <button type="button" style={primaryRowButton} disabled={busy} onClick={submit}>
          {busy ? "Saving…" : submitLabel}</button>
        {onCancel && <button type="button" style={rowButton} disabled={busy} onClick={onCancel}>Cancel</button>}
      </span>
    </div>
  );
}

function LineEditForm({ line, locations, plants, skus, onSaved, onCancel, report }) {
  const [form, setForm] = useState(() => lineFormFromRecord(line));
  const [baseVersion, setBaseVersion] = useState(line.content_version);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const set = k => v => setForm(f => ({ ...f, [k]: v }));
  const save = async () => {
    const check = validateLineForm(form);
    setErrors(check.errors);
    if (!check.ok) return;
    setBusy(true);
    const res = await pricingMutation(pricingPaths.line(line.id), lineBody(check.normalised, baseVersion), "PATCH");
    setBusy(false);
    if (report(res, "Line saved.")) onSaved();
  };
  // Only this Customer's SKUs, and only the chosen Plant's when one is chosen
  // (the database refuses any other combination regardless).
  const skuOpts = (skus || []).filter(k => !form.plant_id || String(k.plant_id) === String(form.plant_id));
  return (
    <div style={{ ...panel, background: "#FFFDF9", marginBottom: 6 }}>
      <VersionNotice baseVersion={baseVersion} latestVersion={line.content_version}
        onRebase={() => setBaseVersion(line.content_version)} />
      <Field label="Location">
        <SelectIn value={form.customer_location_id} onChange={set("customer_location_id")} blank="Any / whole Customer"
          opts={locations.map(l => ({ v: String(l.id), l: l.location_code || `Location #${l.id}` }))} width={150}
          aria-label="Customer Location" />
      </Field>
      <Field label="Producing plant">
        <SelectIn value={form.plant_id} onChange={v => setForm(f => ({ ...f, plant_id: v,
          sku_id: v && f.sku_id && !(skus || []).some(k => String(k.id) === String(f.sku_id) && String(k.plant_id) === v) ? "" : f.sku_id }))}
          blank="Any" opts={plants.map(p => ({ v: String(p.id), l: `${p.plant_code} — ${p.name}` }))} width={150}
          aria-label="Producing plant" />
      </Field>
      <Field label="SKU (this Customer's)">
        <SelectIn value={form.sku_id} onChange={set("sku_id")} blank="None" width={150} aria-label="SKU"
          opts={skuOpts.map(k => ({ v: String(k.id), l: k.plant_item_code || `SKU #${k.id}` }))} />
      </Field>
      <Field label="Item / scope (free text)">
        <TextIn value={form.scope_text} onChange={set("scope_text")} width={180} aria-label="Scope" />
      </Field>
      <Field label="Share of business">
        <SelectIn value={form.sob_state} onChange={set("sob_state")} opts={SOB_STATES} width={160} aria-label="SOB state" />
      </Field>
      {form.sob_state === "percentage" && (
        <Field label="SOB %" error={errors.sob_pct}>
          <TextIn value={form.sob_pct} onChange={set("sob_pct")} width={60} inputMode="decimal" aria-label="SOB percent" />
        </Field>
      )}
      {form.sob_state === "allocated_quantity" && (
        <Field label="Allocated boxes (this Cycle)" error={errors.sob_allocated_boxes}>
          <TextIn value={form.sob_allocated_boxes} onChange={set("sob_allocated_boxes")} width={90} inputMode="numeric"
            aria-label="SOB allocated boxes" placeholder="e.g. 25000" />
        </Field>
      )}
      <span style={{ display: "inline-flex", gap: 4, verticalAlign: "bottom", marginBottom: 6 }}>
        <button type="button" style={primaryRowButton} disabled={busy} onClick={save}>{busy ? "Saving…" : "Save line"}</button>
        <button type="button" style={rowButton} disabled={busy} onClick={onCancel}>Cancel</button>
      </span>
    </div>
  );
}

// P0.5: the deliberate "Void round" confirmation. The reason and any failure
// live in the parent's `voiding` state, so a stale or failed response never
// loses what the user typed; only success closes the panel.
function VoidRoundPanel({ event, rateText, voiding, setVoiding, onConfirm, onRebase }) {
  const busy = !!voiding.busy;
  const behind = event.content_version !== voiding.baseVersion;
  return (
    <div role="alertdialog" aria-label={`Void round ${event.sequence_no}`}
      style={{ ...panel, margin: "4px 0", borderColor: C.red, background: "#FDF6F4" }}>
      <div style={{ fontWeight: 700, color: C.red, marginBottom: 2 }}>Void this round?</div>
      <div style={{ fontSize: T.label, marginBottom: 4 }}>
        <b>{labelOf(EVENT_TYPES, event.event_type)}</b> · {event.event_date} · <span style={{ fontFamily: mono }}>{rateText}</span>
        {" "}— round #{event.sequence_no}, read at v{voiding.baseVersion}.
      </div>
      <div style={{ fontSize: T.label, color: C.slateM, marginBottom: 4 }}>
        The round stays in the timeline exactly as recorded, marked Voided, and stops counting as the current
        offer, counter or agreement. It cannot be un-voided or deleted — to re-state a position, record a new round.
      </div>
      <Field label="Reason (required)" error={voiding.reasonError}>
        <TextIn value={voiding.reason} width={420} aria-label="Void reason" maxLength={VOID_REASON_MAX}
          onChange={v => setVoiding(s => ({ ...s, reason: v, reasonError: null }))}
          placeholder="e.g. entered against the wrong line" />
      </Field>
      {voiding.error && <div role="alert" style={{ color: C.red, fontSize: T.label, margin: "2px 0" }}>{voiding.error}</div>}
      {behind && (
        <div style={{ fontSize: T.label, color: C.orange, margin: "2px 0" }}>
          This round is now at v{event.content_version}. Check it, then confirm against the latest version.{" "}
          <button type="button" style={rowButton} onClick={onRebase}>Use latest version</button>
        </div>
      )}
      {voiding.fixtureRequest && (
        <pre style={{ fontSize: T.label, background: "#F7F4EE", padding: 4, margin: "2px 0", whiteSpace: "pre-wrap" }}>
          FIXTURE ONLY — the request this would send (nothing was sent):{"\n"}
          {voiding.fixtureRequest.method} {voiding.fixtureRequest.path}  {JSON.stringify(voiding.fixtureRequest.body)}
        </pre>
      )}
      <span style={{ display: "inline-flex", gap: 4, marginTop: 4 }}>
        <button type="button" style={{ ...primaryRowButton, background: C.red }} disabled={busy} onClick={onConfirm}>
          {busy ? "Voiding…" : "Void round"}</button>
        <button type="button" style={rowButton} disabled={busy} onClick={() => setVoiding(null)}>Cancel</button>
      </span>
    </div>
  );
}

function componentsCell(e) {
  if (!e.components_recorded || !e.components_recorded.length) return "—";
  const bits = [["kraft", e.component_kraft_inr], ["conv", e.component_conversion_inr], ["freight", e.component_freight_inr]]
    .filter(([, v]) => v != null).map(([k, v]) => `${k} ${formatInr(v, { symbol: false })}`);
  return `${bits.join(" + ")} = ${formatInr(e.component_total_inr)}`;
}

export default function PricingLineDetail({ line, cycle, mechanism, terms = [], bfSets = [], allLines = [],
  locations, plants, skus = [], onChanged, report, partyId = null, fixture = false, history = null, onLoadHistory }) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState(null); // explicit copy of the prior agreed values, or null
  const [requestId, setRequestId] = useState(newClientRequestId);
  const [correcting, setCorrecting] = useState(null); // { id, baseVersion }
  const [voiding, setVoiding] = useState(null); // { id, baseVersion, reason, reasonError, error, busy, fixtureRequest }
  const [editingLine, setEditingLine] = useState(false);
  const [openBf, setOpenBf] = useState(null);
  // P0.4 timeline: every round in chronology, voided ones kept and marked.
  const events = timelineEvents(line.events);
  const voidedCount = events.filter(e => e.status === "voided").length;
  const lookups = { locations, plants };
  const term = terms.find(t => t.id === line.term_version_id) || null;
  const prior = priorAgreedFor(line, allLines);
  // A round's unit is its OWN snapshot; the line's term/mechanism only for new rounds.
  const unitOf = e => [e.rate_basis ?? term?.rate_basis ?? mechanism?.rate_basis,
    e.weight_basis ?? term?.weight_basis ?? mechanism?.weight_basis];
  const newBasis = [term?.rate_basis ?? mechanism?.rate_basis, term?.weight_basis ?? mechanism?.weight_basis];
  const newUnit = rateUnitLabel(...newBasis);

  const addRound = async form => {
    // The same request id is reused until this draft succeeds, so a retry
    // after an unknown outcome is refused as a duplicate, never recorded twice.
    const res = await pricingMutation(pricingPaths.events(line.id),
      eventBody(form, { clientRequestId: requestId }));
    if (!report(res, "Round recorded.")) return false;
    setRequestId(newClientRequestId());
    setAdding(false);
    setDraft(null);
    onChanged();
    return true;
  };

  const correctRound = event => async form => {
    const res = await pricingMutation(pricingPaths.event(event.id),
      eventBody(form, { expectedVersion: correcting.baseVersion }), "PATCH");
    if (!report(res, "Round corrected — the previous value is kept in the change history.")) return false;
    setCorrecting(null);
    onChanged();
    return true;
  };

  // P0.5: void under CAS with a reason. Failure keeps the panel and the reason.
  const confirmVoid = event => async () => {
    const check = validateVoidReason(voiding.reason);
    if (!check.ok) { setVoiding(s => ({ ...s, reasonError: check.error })); return; }
    const path = pricingPaths.voidEvent(event.id);
    const body = voidRoundBody(partyId, voiding.baseVersion, check.value);
    if (fixture) { setVoiding(s => ({ ...s, error: null, fixtureRequest: { method: "POST", path, body } })); return; }
    setVoiding(s => ({ ...s, busy: true, error: null }));
    const res = await pricingMutation(path, body, "POST");
    if (res.ok) {
      report(res, "Round voided — it stays in the timeline and no longer counts as the current position.");
      setVoiding(null);
      onChanged();
      return;
    }
    const error = res.kind === "stale"
      ? "Someone changed this round since you opened it, so nothing was voided. Your reason is kept — reload, check the round, then confirm again."
      : res.kind === "voided" ? "This round is already voided. Reload to see it."
        : `${res.message || "The round could not be voided."} Nothing was changed; your reason is kept.`;
    setVoiding(s => (s ? { ...s, busy: false, error } : s));
  };

  const copyPrior = agreed => {
    setDraft(draftFromPriorAgreed(agreed, mechanism, today()));
    setAdding(true);
  };

  const COLS = ["#", "Date", "Who", "Rate", "Components", "Equivalent", "Tax", "Source", "Notes", ""];
  return (
    <div style={{ padding: "4px 0 6px" }}>
      <LineCommercialBasis line={line} cycle={cycle} terms={terms} bfSets={bfSets} lookups={lookups} prior={prior}
        unitOf={unitOf} onCopyPrior={copyPrior} report={report} onChanged={onChanged} />
      {editingLine
        ? <LineEditForm line={line} locations={locations} plants={plants} skus={skus} report={report}
            onSaved={() => { setEditingLine(false); onChanged(); }} onCancel={() => setEditingLine(false)} />
        : <button type="button" style={{ ...rowButton, marginBottom: 6 }} onClick={() => setEditingLine(true)}>
            Edit scope / SOB</button>}
      <table style={{ ...denseTable, width: "auto", minWidth: 760 }} aria-label="Negotiation rounds">
        <thead>
          <tr>{COLS.map(h => <th key={h} scope="col" style={denseHead}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {!events.length && (
            <tr><td colSpan={COLS.length} style={{ ...denseCell, color: C.slateL }}>No rounds recorded yet.</td></tr>
          )}
          {events.map(e => {
            const isCorrecting = correcting?.id === e.id;
            const isVoiding = voiding?.id === e.id;
            const voided = e.status === "voided";
            const [rb, wb] = unitOf(e);
            const eq = equivalentRate(e.rate_inr, rb, wb, line.measures);
            const diff = e.reconciliation_diff_inr;
            return (
              <Fragment key={e.id}>
                <tr style={{ height: 26, background: isCorrecting ? C.amberL : voided ? "#F4F1EC" : undefined,
                  color: voided ? C.slateL : undefined }} aria-label={voided ? `Round ${e.sequence_no} (voided)` : undefined}>
                  <td style={{ ...denseCell, color: C.slateL }}>{e.sequence_no}</td>
                  <td style={denseCell}>{e.event_date}</td>
                  <td style={{ ...denseCell, fontWeight: 700,
                    color: e.event_type === "final_agreement" ? C.green : e.event_type === "customer_counter" ? C.orange : C.slateM }}>
                    {labelOf(EVENT_TYPES, e.event_type)}{voided && <span style={{ color: C.red, fontSize: T.micro }}> VOIDED</span>}</td>
                  <td style={{ ...denseCell, fontFamily: mono, textAlign: "right" }}>
                    {formatRate(e.rate_inr, rb, wb)}{e.base_bf_code ? ` (BF ${e.base_bf_code})` : ""}</td>
                  <td style={{ ...denseCell, fontFamily: mono, maxWidth: 144 }} title={componentsCell(e)}>
                    {componentsCell(e)}
                    {diff != null && diff !== "0.00" && (
                      <span style={{ color: C.orange, fontWeight: 700 }} title="Recorded total minus component sum; the recorded total is kept">
                        {` Δ ${formatInr(diff)}`}</span>)}
                  </td>
                  <td style={{ ...denseCell, maxWidth: 200 }} title={eq.available ? eq.note : eq.reason}>
                    {eq.available
                      ? <span style={{ fontFamily: mono }}>≈ {formatInr(eq.value)} {eq.unit}</span>
                      : <span style={{ color: C.slateL, fontSize: T.label }}>{eq.reason}</span>}
                  </td>
                  <td style={denseCell}>{e.tax_treatment === "including_gst" ? `Incl. GST ${formatPct(e.gst_pct)}` : "Ex-GST"}</td>
                  <td style={{ ...denseCell, maxWidth: 144 }} title={[labelOf(SOURCE_TYPES, e.source_type), e.source_date, e.source_ref].filter(x => x && x !== "—").join(" · ")}>
                    {[labelOf(SOURCE_TYPES, e.source_type), e.source_date, e.source_ref].filter(x => x && x !== "—").join(" · ") || "—"}
                  </td>
                  <td style={{ ...denseCell, maxWidth: 144 }} title={[e.notes, voided && e.void_reason ? `Voided: ${e.void_reason}` : ""].filter(Boolean).join(" · ")}>
                    {voided && e.void_reason && <span style={{ color: C.red }}>Voided: {e.void_reason}{e.notes ? " · " : ""}</span>}
                    {e.notes || ""}
                    {/* a void adds exactly one version and freezes the round, so only v3+ on a voided round was corrected */}
                    {e.content_version > (voided ? 2 : 1) && <span style={{ color: C.slateL, fontSize: T.label }}
                      title="Corrected after it was recorded — the change history keeps every before/after">
                      {` (corrected, v${e.content_version})`}</span>}</td>
                  <td style={{ ...denseCell, padding: "2px 8px" }}>
                    {/* keeps Correct · Void round side by side and wraps BF under them, so the timeline fits 1366 wide */}
                    <span style={{ display: "inline-flex", flexWrap: "wrap", gap: 4, minWidth: 116, maxWidth: 120 }}>
                      {!isCorrecting && !isVoiding && !voided && <button type="button" style={rowButton}
                        onClick={() => { setVoiding(null); setCorrecting({ id: e.id, baseVersion: e.content_version }); }}>Correct</button>}
                      {!isCorrecting && !isVoiding && !voided && <button type="button"
                        style={{ ...rowButton, color: C.red, borderColor: C.red }}
                        aria-label={`Void round ${e.sequence_no}`}
                        onClick={() => { setCorrecting(null); setVoiding({ id: e.id, baseVersion: e.content_version, reason: "",
                          reasonError: null, error: null, busy: false, fixtureRequest: null }); }}>Void round</button>}
                      {e.base_bf_code && <button type="button" style={rowButton} aria-expanded={openBf === e.id}
                        onClick={() => setOpenBf(openBf === e.id ? null : e.id)}>BF {openBf === e.id ? "▴" : "▾"}</button>}
                    </span>
                  </td>
                </tr>
                {openBf === e.id && (
                  <tr><td colSpan={COLS.length} style={{ ...denseCell, whiteSpace: "normal", maxWidth: "none",
                    background: "#FFFDF9", padding: "4px 10px" }}>
                    <BfScheduleTable event={e} unit={rateUnitLabel(rb, wb)} report={report} onChanged={onChanged}
                      partyId={voided ? null : partyId} fixture={fixture} />
                  </td></tr>
                )}
                {isVoiding && (
                  <tr><td colSpan={COLS.length} style={{ padding: "0 8px" }}>
                    <VoidRoundPanel event={e} rateText={formatRate(e.rate_inr, rb, wb)} voiding={voiding} setVoiding={setVoiding}
                      onConfirm={confirmVoid(e)}
                      onRebase={() => setVoiding(s => ({ ...s, baseVersion: e.content_version, error: null }))} />
                  </td></tr>
                )}
                {isCorrecting && (
                  <tr><td colSpan={COLS.length} style={{ padding: 0 }}>
                    <EventForm initial={eventForm(e)} submitLabel="Save correction" onSubmit={correctRound(e)}
                      onCancel={() => setCorrecting(null)} baseVersion={correcting.baseVersion}
                      latestVersion={e.content_version} term={term} unit={rateUnitLabel(rb, wb)}
                      rateBasis={rb} weightBasis={wb} measures={line.measures}
                      bfDeltas={(e.bf_schedule || []).filter(r => !r.is_base)}
                      onRebase={() => setCorrecting({ id: e.id, baseVersion: e.content_version })} />
                  </td></tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
      {adding
        ? <EventForm key={draft ? "draft-from-prior" : "blank"}
            initial={draft || blankEventForm(mechanism, today())} submitLabel="Record round" onSubmit={addRound}
            term={term} unit={newUnit} rateBasis={newBasis[0]} weightBasis={newBasis[1]} measures={line.measures}
            bfDeltas={bfSets.find(b => b.id === line.bf_delta_set_id)?.deltas || []}
            onCancel={() => { setAdding(false); setDraft(null); }} />
        : <button type="button" style={{ ...primaryRowButton, marginTop: 6 }} onClick={() => setAdding(true)}>
            + Record a round</button>}
      {history && (
        <div style={{ marginTop: 6 }} aria-label="Change history for this line">
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 2 }}>
            <span style={{ fontSize: T.micro, fontWeight: 800, color: C.slateL, textTransform: "uppercase",
              letterSpacing: "0.05em" }}>This line's change history</span>
            <HistoryStatus history={history} onLoad={onLoadHistory} />
          </div>
          {history.status === "ready" && (
            <ChangeList items={changesForLine(history.items, line)}
              emptyText={history.hasMore ? "No entries for this line in the loaded page — load older entries to look further back."
                : "No changes recorded for this line."} />
          )}
        </div>
      )}
      <div style={{ fontSize: T.label, color: C.slateL, marginTop: 4 }}>
        {voidedCount > 0 && `${voidedCount} voided round(s) are shown for the record and never count as the current position. `}
        Every round is kept. A correction changes only that round and is recorded with who, when, before and after;
        a void marks a round entered in error without removing it.
        Each round keeps the Stable Term and BF schedule it was recorded under.
      </div>
    </div>
  );
}
