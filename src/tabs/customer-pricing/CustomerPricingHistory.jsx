// ═══════════════════════════════════════════════════════════════════════════
// Customer Pricing History workspace (Phase 0, P0.1) — opened from a Customer
// row inside Customer Family Details.
//
// Authority: docs/customer-pricing-history-phase-0-implementation-plan-2026-09-23.md.
// A direct-edit business record: every authorised user (read_party_master) may
// edit; there is no Checker step. Concurrency is compare-and-swap on each
// record's content_version, and a conflict NEVER discards the user's draft.
//
// P0.1 scope: one mechanism, Cycles, Lines, negotiation rounds, the compact
// first-offer / latest-counter / final-agreed row.
// P0.3: the matrix is a user-arranged VIEW of the same canonical payload
// (lib/customerPricingLayout.js) — Standard/Transposed, zones, pins, grouping,
// presets and browser-local named views. Clipboard paste is P0.4.
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { C, T, sans } from "../../theme.js";
import { useAuth } from "../../AuthContext.jsx";
import {
  CYCLE_STATUSES, FREQUENCIES, LABEL_STYLES, RATE_BASES, TAX_TREATMENTS, WEIGHT_BASES, comparisonBlockedReason, cycleBody,
  cycleFormFromRecord, cycleLabel, defaultPeriodEnd, labelOf, lineBody, mechanismBody,
  nextCycleBody, proposeNextPeriod, validateCycleForm, validateLineForm, SOB_STATES,
} from "../../lib/customerPricingModel.js";
import {
  buildFieldRegistry, buildView, cellMutation, placeUnplaced, recordLabel, resolveDisclosure,
} from "../../lib/customerPricingLayout.js";
import { fetchPricingHistory, pricingMutation, pricingPaths } from "../../lib/customerPricingActions.js";
import PricingLineDetail from "./PricingLineDetail.jsx";
import PricingMatrix from "./PricingMatrix.jsx";
import LayoutToolbar from "./LayoutToolbar.jsx";
import LayoutZonesPanel from "./LayoutZonesPanel.jsx";
import DetailsSummary, { MixedDisclosure } from "./DetailsSummary.jsx";
import useCustomerPricingLayout from "./useCustomerPricingLayout.js";
import { EMPTY_FILTERS, applyFilters, filterOptions } from "../../lib/customerPricingFilters.js";
import PricingFilters from "./PricingFilters.jsx";
import PastePreviewPanel from "./PastePreviewPanel.jsx";
import ChangeHistoryPanel from "./ChangeHistoryPanel.jsx";
import useChangeHistory from "./useChangeHistory.js";
import StableTermsPanel from "./StableTermsPanel.jsx";
import { Field, SelectIn, TextIn, VersionNotice } from "./pricingFormBits.jsx";
import { panel, primaryRowButton, rowButton } from "./pricingStyles.js";

const today = () => new Date().toISOString().slice(0, 10);
const firstOfNextMonth = () => {
  const d = new Date();
  return new Date(Date.UTC(d.getFullYear(), d.getMonth() + 1, 1)).toISOString().slice(0, 10);
};

function MechanismPanel({ partyId, mechanism, report, onChanged }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  const [baseVersion, setBaseVersion] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = k => v => setForm(f => ({ ...f, [k]: v }));

  const open = () => {
    setForm({
      review_frequency: mechanism?.review_frequency || "monthly",
      period_label_style: mechanism?.period_label_style || "financial_year",
      rate_basis: mechanism?.rate_basis || "", weight_basis: mechanism?.weight_basis || "",
      tax_treatment: mechanism?.tax_treatment || "excluding_gst", notes: mechanism?.notes || "",
    });
    setBaseVersion(mechanism?.content_version ?? null);
    setEditing(true);
  };
  const save = async () => {
    setBusy(true);
    const res = await pricingMutation(pricingPaths.mechanism(partyId), mechanismBody(form, baseVersion), "PUT");
    setBusy(false);
    if (report(res, "Pricing mechanism saved.")) { setEditing(false); onChanged(); }
  };
  const blocked = comparisonBlockedReason(mechanism);

  return (
    <div style={{ ...panel, marginBottom: 6 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: T.micro, fontWeight: 800, color: C.slateL, textTransform: "uppercase",
          letterSpacing: "0.05em" }}>Mechanism</span>
        {mechanism ? (
          <>
            <span><b>{labelOf(FREQUENCIES, mechanism.review_frequency)}</b> review</span>
            <span>{labelOf(RATE_BASES, mechanism.rate_basis)}</span>
            {mechanism.weight_basis && <span>on {labelOf(WEIGHT_BASES, mechanism.weight_basis)}</span>}
            <span>{labelOf(TAX_TREATMENTS, mechanism.tax_treatment)}</span>
            {blocked && <span style={{ color: C.amberD }}>{blocked}</span>}
            <span style={{ color: C.slateL, fontSize: T.label }}>v{mechanism.content_version}</span>
          </>
        ) : <span style={{ color: C.slateL }}>Not recorded yet — record how this Customer discusses rates before the first Cycle.</span>}
        {!editing && <button type="button" style={mechanism ? rowButton : primaryRowButton} onClick={open}>
          {mechanism ? "Edit" : "Record mechanism"}</button>}
      </div>
      {editing && (
        <div style={{ marginTop: 6 }}>
          <VersionNotice baseVersion={baseVersion} latestVersion={mechanism?.content_version ?? null}
            onRebase={() => setBaseVersion(mechanism?.content_version ?? null)} />
          <Field label="Review frequency">
            <SelectIn value={form.review_frequency} onChange={set("review_frequency")} opts={FREQUENCIES}
              aria-label="Review frequency" />
          </Field>
          <Field label="Period labels">
            <SelectIn value={form.period_label_style} onChange={set("period_label_style")} opts={LABEL_STYLES}
              width={200} aria-label="Period labels" />
          </Field>
          <Field label="Rate basis">
            <SelectIn value={form.rate_basis} onChange={set("rate_basis")} opts={RATE_BASES} blank="Not yet captured"
              width={200} aria-label="Rate basis" />
          </Field>
          <Field label="Weight basis">
            <SelectIn value={form.weight_basis} onChange={set("weight_basis")} opts={WEIGHT_BASES}
              blank="Not yet captured" width={200} aria-label="Weight basis" />
          </Field>
          <Field label="Tax">
            <SelectIn value={form.tax_treatment} onChange={set("tax_treatment")} opts={TAX_TREATMENTS} width={120}
              aria-label="Default tax treatment" />
          </Field>
          <Field label="Notes">
            <TextIn value={form.notes} onChange={set("notes")} width={220} aria-label="Mechanism notes" />
          </Field>
          <span style={{ display: "inline-flex", gap: 4, verticalAlign: "bottom", marginBottom: 6 }}>
            <button type="button" style={primaryRowButton} disabled={busy} onClick={save}>{busy ? "Saving…" : "Save"}</button>
            <button type="button" style={rowButton} disabled={busy} onClick={() => setEditing(false)}>Cancel</button>
          </span>
        </div>
      )}
    </div>
  );
}

function NewCycleForm({ partyId, mechanism, report, onDone, onCancel }) {
  const start = firstOfNextMonth();
  const [form, setForm] = useState({
    review_frequency: mechanism.review_frequency, period_start: start,
    period_end: defaultPeriodEnd(mechanism.review_frequency, start), initiated_on: today(), custom_label: "",
  });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const set = k => v => setForm(f => {
    const next = { ...f, [k]: v };
    if (k === "period_start" || k === "review_frequency") {
      next.period_end = defaultPeriodEnd(next.review_frequency, next.period_start);
    }
    return next;
  });
  const save = async () => {
    const check = validateCycleForm(form);
    setErrors(check.errors);
    if (!check.ok) return;
    setBusy(true);
    const res = await pricingMutation(pricingPaths.cycles(partyId), cycleBody(form));
    setBusy(false);
    if (report(res, "Cycle created.")) onDone(res.data?.id);
  };
  return (
    <div style={{ ...panel, background: "#FFFDF9", marginBottom: 6 }}>
      <Field label="Frequency">
        <SelectIn value={form.review_frequency} onChange={set("review_frequency")} opts={FREQUENCIES} width={140}
          aria-label="Cycle frequency" />
      </Field>
      <Field label="Period start" error={errors.period_start}>
        <TextIn type="date" value={form.period_start} onChange={set("period_start")} width={130} aria-label="Period start" />
      </Field>
      <Field label="Period end" error={errors.period_end}>
        <TextIn type="date" value={form.period_end} onChange={set("period_end")} width={130} aria-label="Period end" />
      </Field>
      <Field label="Initiated on" error={errors.initiated_on}>
        <TextIn type="date" value={form.initiated_on} onChange={set("initiated_on")} width={130} aria-label="Initiated on" />
      </Field>
      <Field label="Custom label (optional)">
        <TextIn value={form.custom_label} onChange={set("custom_label")} width={140} aria-label="Custom label"
          placeholder={cycleLabel(form, mechanism.period_label_style)} />
      </Field>
      <span style={{ display: "inline-flex", gap: 4, verticalAlign: "bottom", marginBottom: 6 }}>
        <button type="button" style={primaryRowButton} disabled={busy} onClick={save}>{busy ? "Creating…" : "Create cycle"}</button>
        <button type="button" style={rowButton} disabled={busy} onClick={onCancel}>Cancel</button>
      </span>
    </div>
  );
}

// Edits one Cycle's dates, initiation date, label, status and notes. The form
// is pinned to the version it was opened on; a stale save keeps the draft and
// the user must explicitly rebase onto the newer version before saving.
function CycleEditForm({ cycle, labelStyle, report, onDone, onCancel }) {
  const [form, setForm] = useState(() => cycleFormFromRecord(cycle));
  const [baseVersion, setBaseVersion] = useState(cycle.content_version);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const set = k => v => setForm(f => ({ ...f, [k]: v }));
  const save = async () => {
    const check = validateCycleForm(form);
    setErrors(check.errors);
    if (!check.ok) return;
    setBusy(true);
    const res = await pricingMutation(pricingPaths.cycle(cycle.id), cycleBody(form, baseVersion), "PATCH");
    setBusy(false);
    if (report(res, "Cycle saved.")) onDone();
  };
  return (
    <div style={{ ...panel, background: "#FFFDF9" }}>
      <VersionNotice baseVersion={baseVersion} latestVersion={cycle.content_version}
        onRebase={() => setBaseVersion(cycle.content_version)} />
      <Field label="Period start" error={errors.period_start}>
        <TextIn type="date" value={form.period_start} onChange={set("period_start")} width={130} aria-label="Edit period start" />
      </Field>
      <Field label="Period end" error={errors.period_end}>
        <TextIn type="date" value={form.period_end} onChange={set("period_end")} width={130} aria-label="Edit period end" />
      </Field>
      <Field label="Initiated on" error={errors.initiated_on}>
        <TextIn type="date" value={form.initiated_on} onChange={set("initiated_on")} width={130} aria-label="Edit initiated on" />
      </Field>
      <Field label="Label">
        <TextIn value={form.custom_label} onChange={set("custom_label")} width={140} aria-label="Edit cycle label"
          placeholder={cycleLabel({ ...form, custom_label: "" }, labelStyle)} />
      </Field>
      <Field label="Status">
        <SelectIn value={form.status} onChange={set("status")} opts={CYCLE_STATUSES} width={90} aria-label="Cycle status" />
      </Field>
      <Field label="Notes">
        <TextIn value={form.notes} onChange={set("notes")} width={200} aria-label="Cycle notes" />
      </Field>
      <span style={{ display: "inline-flex", gap: 4, verticalAlign: "bottom", marginBottom: 6 }}>
        <button type="button" style={primaryRowButton} disabled={busy} onClick={save}>{busy ? "Saving…" : "Save cycle"}</button>
        <button type="button" style={rowButton} disabled={busy} onClick={onCancel}>Cancel</button>
      </span>
    </div>
  );
}

function NewLineForm({ cycleId, locations, plants, skus = [], report, onDone, onCancel }) {
  const [form, setForm] = useState({ customer_location_id: "", plant_id: "", sku_id: "", scope_text: "",
    sob_state: "not_captured", sob_pct: "", sob_allocated_boxes: "" });
  const skuOpts = skus.filter(k => !form.plant_id || String(k.plant_id) === String(form.plant_id));
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const set = k => v => setForm(f => ({ ...f, [k]: v }));
  const save = async () => {
    const check = validateLineForm(form);
    setErrors(check.errors);
    if (!check.ok) return;
    setBusy(true);
    const res = await pricingMutation(pricingPaths.lines(cycleId), lineBody(check.normalised));
    setBusy(false);
    if (report(res, "Line added.")) onDone(res.data?.id);
  };
  return (
    <div style={{ ...panel, background: "#FFFDF9" }}>
      <Field label="Location">
        <SelectIn value={form.customer_location_id} onChange={set("customer_location_id")} blank="Any / whole Customer"
          opts={locations.map(l => ({ v: String(l.id), l: l.location_code || `Location #${l.id}` }))} width={150}
          aria-label="New line Location" />
      </Field>
      <Field label="Producing plant">
        <SelectIn value={form.plant_id} onChange={v => setForm(f => ({ ...f, plant_id: v,
          sku_id: v && f.sku_id && !skus.some(k => String(k.id) === String(f.sku_id) && String(k.plant_id) === v) ? "" : f.sku_id }))}
          blank="Any" opts={plants.map(p => ({ v: String(p.id), l: `${p.plant_code} — ${p.name}` }))} width={150}
          aria-label="New line plant" />
      </Field>
      <Field label="SKU (this Customer's)">
        <SelectIn value={form.sku_id} onChange={set("sku_id")} blank="None" width={150} aria-label="New line SKU"
          opts={skuOpts.map(k => ({ v: String(k.id), l: k.plant_item_code || `SKU #${k.id}` }))} />
      </Field>
      <Field label="Item / scope (free text)">
        <TextIn value={form.scope_text} onChange={set("scope_text")} width={180} aria-label="New line scope"
          placeholder="e.g. All RSC boxes" />
      </Field>
      <Field label="Share of business">
        <SelectIn value={form.sob_state} onChange={set("sob_state")} opts={SOB_STATES} width={160} aria-label="New line SOB" />
      </Field>
      {form.sob_state === "percentage" && (
        <Field label="SOB %" error={errors.sob_pct}>
          <TextIn value={form.sob_pct} onChange={set("sob_pct")} width={60} inputMode="decimal" aria-label="New line SOB percent" />
        </Field>
      )}
      {form.sob_state === "allocated_quantity" && (
        <Field label="Allocated boxes (this Cycle)" error={errors.sob_allocated_boxes}>
          <TextIn value={form.sob_allocated_boxes} onChange={set("sob_allocated_boxes")} width={90} inputMode="numeric"
            aria-label="New line allocated boxes" placeholder="e.g. 25000" />
        </Field>
      )}
      <span style={{ display: "inline-flex", gap: 4, verticalAlign: "bottom", marginBottom: 6 }}>
        <button type="button" style={primaryRowButton} disabled={busy} onClick={save}>{busy ? "Adding…" : "Add line"}</button>
        <button type="button" style={rowButton} disabled={busy} onClick={onCancel}>Cancel</button>
      </span>
    </div>
  );
}

// Start the next Cycle from this one's STRUCTURE (scopes, applicable Stable
// Term / BF set, weights). Rates, rounds and SOB start blank; the prior agreed
// values appear on each new line as locked comparison context.
function NextCycleForm({ cycle, mechanism, labelStyle, report, onDone, onCancel }) {
  const proposed = proposeNextPeriod(cycle, mechanism?.review_frequency);
  const [form, setForm] = useState({ ...proposed, initiated_on: today(), custom_label: "",
    review_frequency: mechanism?.review_frequency || cycle.review_frequency });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const set = k => v => setForm(f => ({ ...f, [k]: v }));
  const save = async () => {
    const check = validateCycleForm(form);
    const errs = { ...check.errors };
    if (form.period_start && form.period_start <= cycle.period_start) errs.period_start = "Must start after this cycle";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    const res = await pricingMutation(pricingPaths.nextCycle(cycle.id), nextCycleBody(form));
    setBusy(false);
    if (report(res, `Next cycle started with ${res.data?.lines ?? 0} line(s) — every rate starts blank.`)) onDone(res.data?.id);
  };
  return (
    <div style={{ ...panel, background: "#FFFDF9" }}>
      <Field label="Period start" error={errors.period_start}>
        <TextIn type="date" value={form.period_start} onChange={set("period_start")} width={130} aria-label="Next period start" />
      </Field>
      <Field label="Period end" error={errors.period_end}>
        <TextIn type="date" value={form.period_end} onChange={set("period_end")} width={130} aria-label="Next period end" />
      </Field>
      <Field label="Initiated on" error={errors.initiated_on}>
        <TextIn type="date" value={form.initiated_on} onChange={set("initiated_on")} width={130} aria-label="Next initiated on" />
      </Field>
      <Field label="Custom label (optional)">
        <TextIn value={form.custom_label} onChange={set("custom_label")} width={140} aria-label="Next cycle label"
          placeholder={cycleLabel({ ...form, custom_label: "" }, labelStyle)} />
      </Field>
      <span style={{ display: "inline-flex", gap: 4, verticalAlign: "bottom", marginBottom: 6 }}>
        <button type="button" style={primaryRowButton} disabled={busy} onClick={save}>{busy ? "Starting…" : "Start next cycle"}</button>
        <button type="button" style={rowButton} disabled={busy} onClick={onCancel}>Cancel</button>
      </span>
      <div style={{ fontSize: T.label, color: C.slateL }}>
        Proposed from the {labelOf(FREQUENCIES, form.review_frequency).toLowerCase()} frequency; adjust the dates if needed.
        Copies line scopes, the Stable Term and BF set that apply on the new start date, and recorded weights —
        never a rate. Use “Copy prior agreed to draft offer” on a line if you want the old rate as a starting draft.
      </div>
    </div>
  );
}

// `fixture` (development preview only): an in-memory canonical payload shown
// instead of the backend read. Nothing is fetched, and a grid edit is shown as
// the request it WOULD send — never sent.
export default function CustomerPricingHistory({ party, showToast, fixture = null }) {
  const [state, setState] = useState({ status: "loading", data: null, message: "" });
  const [conflict, setConflict] = useState(null);
  const [creatingCycle, setCreatingCycle] = useState(false);
  const [addingLineTo, setAddingLineTo] = useState(null);
  const [editingCycle, setEditingCycle] = useState(null);
  const [nextFrom, setNextFrom] = useState(null);
  const [expandedLine, setExpandedLine] = useState(null); // record key: "line:31" or "cycle:5"
  const [zonesOpen, setZonesOpen] = useState(false);
  const [disclosed, setDisclosed] = useState(null);
  const [fixtureLog, setFixtureLog] = useState([]);
  const { profile } = useAuth();
  const layoutApi = useCustomerPricingLayout(profile?.id ?? null, party.id);
  // P0.4 — session-only presentation state: filters, the paste anchor and draft.
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [anchor, setAnchor] = useState(null);
  const [paste, setPaste] = useState(null); // { text, anchor, visibleKeys, seq }
  const pasteSeq = useRef(0); // remounts the preview for each new paste
  const [historyOpen, setHistoryOpen] = useState(false);
  const { history, loadHistory, markHistoryStale } = useChangeHistory(party.id, fixture?.changes || null);

  const hasData = useRef(false);
  // The parent's toast function may be a new identity each render; reading it
  // through a ref keeps `load` (and the fetch effect) stable.
  const toastRef = useRef(showToast);
  useEffect(() => { toastRef.current = showToast; }, [showToast]);
  const toast = useCallback((...args) => toastRef.current?.(...args), []);
  const load = useCallback(async () => {
    const res = fixture ? { ok: true, data: fixture.data } : await fetchPricingHistory(party.id);
    if (res.ok) {
      // A reload after a save means any loaded change-history page is now behind.
      if (hasData.current) markHistoryStale();
      hasData.current = true;
      setState({ status: "ready", data: res.data, message: "" });
      setConflict(null);
      return;
    }
    if (hasData.current) {
      // Keep showing what was last read; never blank the record on a failed reload.
      toast(`❌ ${res.message || "Could not reload pricing history."}`, "error", 8000);
      return;
    }
    const status = res.kind === "access-denied" ? "denied"
      : res.errorCode === "MASTER_UNAVAILABLE" ? "unavailable" : "error";
    setState({ status, data: null, message: res.message || "" });
  }, [party.id, toast, fixture, markHistoryStale]);

  // Same async-IIFE shape as CustomerFamiliesScreen: setState happens after the
  // awaited read, never synchronously inside the effect body.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!cancelled) await load();
    })();
    return () => { cancelled = true; };
  }, [load]);

  // One place turns a mutation outcome into user feedback. Returns true on success.
  const report = useCallback((res, successMessage) => {
    if (res.ok) { toast(`✅ ${successMessage}`, "success", 5000); return true; }
    if (res.kind === "stale") {
      setConflict("Someone else saved this record after you opened it. Nothing of yours was saved or lost — "
        + "your entry is still in the form. Reload to see their change, then decide.");
    } else if (res.kind === "duplicate") {
      toast(`⏱ ${res.message || "That already exists."} Reload to see it.`, "error", 8000);
    } else if (res.kind === "overlap") {
      toast(`⏱ ${res.message || "Another active version already applies to that scope and period."}`, "error", 10000);
    } else {
      const prefix = res.kind === "access-denied" ? "🚫" : res.outcomeUnknown ? "⚠️" : "❌";
      toast(`${prefix} ${res.message || "That could not be saved."}`, "error", res.outcomeUnknown ? 12000 : 8000);
    }
    return false;
  }, [toast]);

  // P0.3 view: the registry and every cell derive from the canonical payload;
  // the layout decides placement only.
  const registry = useMemo(() => buildFieldRegistry(state.data), [state.data]);
  const layout = useMemo(() => placeUnplaced(layoutApi.layout, registry), [layoutApi.layout, registry]);
  const { apply } = layoutApi;
  const onOp = useCallback(op => apply(op, layout), [apply, layout]);

  // A grid edit: the request comes from the cell's canonical identity, through
  // the same body builders and route the line / cycle edit forms use.
  const commitCell = useCallback(async (ref, input) => {
    const m = cellMutation(ref, input, state.data);
    if (!m.ok) return { ok: false, errors: m.errors };
    const path = pricingPaths[m.route[0]](m.route[1]);
    if (fixture) {
      setFixtureLog(log => [{ method: m.method, path, body: m.body }, ...log].slice(0, 4));
      toast("🧪 Fixture: the request is shown below and was not sent.", "success", 4000);
      return { ok: true };
    }
    const res = await pricingMutation(path, m.body, m.method);
    if (report(res, "Saved.")) { load(); return { ok: true }; }
    return { ok: false };
  }, [state.data, fixture, toast, report, load]);

  if (state.status === "loading") return <div style={{ color: C.slateL, fontSize: T.body }}>Loading pricing history…</div>;
  if (state.status === "denied") {
    return <div style={{ color: C.red, fontSize: T.body }}>🚫 Pricing history needs the Customer master read permission.</div>;
  }
  if (state.status === "unavailable") {
    return <div style={{ color: C.slateL, fontSize: T.body }}>Pricing history is not activated in this environment yet.</div>;
  }
  if (state.status === "error") {
    return (
      <div style={{ color: C.red, fontSize: T.body }}>❌ {state.message || "Could not load pricing history."}
        <button type="button" style={{ ...rowButton, marginLeft: 8 }} onClick={load}>Retry</button></div>
    );
  }

  const { mechanism, cycles = [], locations = [], plants = [], cycles_truncated: truncated,
    term_versions: terms = [], bf_delta_sets: bfSets = [], skus = [] } = state.data;
  const labelStyle = mechanism?.period_label_style || "financial_year";
  const allLines = cycles.flatMap(c => c.lines || []);
  const view = applyFilters(buildView(state.data, layout, registry), filters);
  const fOptions = filterOptions(state.data, view.ctx);
  // The P0.1/P0.2 inline rows (detail under its line, actions under its Cycle)
  // stay in the plain Standard view; any other arrangement opens them below.
  const inline = layout.orientation === "standard" && !view.recordGroups;
  const selected = expandedLine ? view.records.find(r => r.key === expandedLine) : null;
  const disclosure = resolveDisclosure(disclosed, view);

  const renderLineDetail = rec => (
    <PricingLineDetail line={rec.line} cycle={rec.cycle} mechanism={mechanism} terms={terms}
      bfSets={bfSets} allLines={allLines} skus={skus} locations={locations} plants={plants}
      report={report} onChanged={load} partyId={party.id} fixture={!!fixture}
      history={history} onLoadHistory={loadHistory} />
  );
  // The "Paste…" button path (no clipboard event): the same rendered order the
  // matrix uses — lines only in the inline Standard view.
  const openPaste = () => setPaste({ text: "", anchor: anchor || { recordKey: view.records.find(r => inline ? r.line : true)?.key,
    fieldId: view.fields[0]?.id }, visibleKeys: (inline ? view.records.filter(r => r.line) : view.records).map(r => r.key),
    edit: true, seq: (pasteSeq.current += 1) });
  const renderCycleActions = cycle => {
    const label = cycleLabel(cycle, labelStyle);
    if (editingCycle === cycle.id) {
      return <CycleEditForm cycle={cycle} labelStyle={labelStyle} report={report}
        onCancel={() => setEditingCycle(null)} onDone={() => { setEditingCycle(null); load(); }} />;
    }
    if (nextFrom === cycle.id) {
      return <NextCycleForm cycle={cycle} mechanism={mechanism} labelStyle={labelStyle} report={report}
        onCancel={() => setNextFrom(null)} onDone={() => { setNextFrom(null); load(); }} />;
    }
    if (addingLineTo === cycle.id) {
      return <NewLineForm cycleId={cycle.id} locations={locations} plants={plants} skus={skus} report={report}
        onCancel={() => setAddingLineTo(null)}
        onDone={id => { setAddingLineTo(null); setExpandedLine(id ? `line:${id}` : null); load(); }} />;
    }
    return (
      <span style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
        <button type="button" style={rowButton} onClick={() => setAddingLineTo(cycle.id)}>
          + Line in {label}</button>
        <button type="button" style={rowButton} onClick={() => setEditingCycle(cycle.id)}>
          Edit cycle</button>
        <button type="button" style={rowButton} onClick={() => setNextFrom(cycle.id)}
          title="New cycle with the same line structure; every rate starts blank">
          Start next cycle</button>
        {cycle.status === "closed" && <span style={{ color: C.slateL, fontSize: T.label }}>Closed</span>}
        {cycle.notes && <span style={{ color: C.slateL, fontSize: T.label }} title={cycle.notes}>
          {cycle.notes}</span>}
      </span>
    );
  };

  return (
    <div style={{ fontFamily: sans, fontSize: T.body, color: C.slate }} aria-label={`Pricing history for ${party.display_name}`}>
      {conflict && (
        <div role="alert" style={{ background: C.amberL, border: `1px solid ${C.amber}`, borderRadius: 6,
          padding: "5px 10px", marginBottom: 6, color: C.amberD }}>
          ⏱ {conflict}
          <button type="button" style={{ ...rowButton, marginLeft: 8 }} onClick={load}>Reload latest</button>
        </div>
      )}

      <MechanismPanel partyId={party.id} mechanism={mechanism} report={report} onChanged={load} />
      {mechanism && (
        <StableTermsPanel partyId={party.id} mechanism={mechanism} terms={terms} bfSets={bfSets}
          locations={locations} plants={plants} report={report} onChanged={load} />
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: T.micro, fontWeight: 800, color: C.slateL, textTransform: "uppercase",
          letterSpacing: "0.05em" }}>Pricing cycles · {cycles.length}</span>
        <button type="button" style={primaryRowButton} disabled={!mechanism || creatingCycle}
          title={mechanism ? "" : "Record the mechanism first"} onClick={() => setCreatingCycle(true)}>+ Cycle</button>
        <button type="button" style={rowButton} onClick={load}>Reload</button>
        {cycles.length > 0 && <button type="button" style={rowButton} onClick={openPaste}
          title="Paste an Excel / Sheets block into the grid from the selected cell">Paste…</button>}
        <button type="button" aria-expanded={historyOpen} style={rowButton}
          onClick={() => { setHistoryOpen(o => !o); if (!historyOpen && history.status === "idle") loadHistory(false); }}>
          Change history {historyOpen ? "▴" : "▾"}</button>
        {truncated && <span style={{ color: C.amberD, fontSize: T.label }}>Showing the newest {state.data.cycle_limit} cycles.</span>}
      </div>
      {creatingCycle && mechanism && (
        <NewCycleForm partyId={party.id} mechanism={mechanism} report={report}
          onCancel={() => setCreatingCycle(false)}
          onDone={id => { setCreatingCycle(false); setAddingLineTo(id ?? null); load(); }} />
      )}

      {!cycles.length ? (
        <div style={{ color: C.slateL }}>No pricing cycles recorded yet.</div>
      ) : (
        <>
          <LayoutToolbar layout={layout} active={layoutApi.active} named={layoutApi.named}
            persisted={layoutApi.persisted} fallback={layoutApi.fallback} zonesOpen={zonesOpen}
            onToggleZones={() => setZonesOpen(o => !o)} onOp={onOp}
            onPreset={id => layoutApi.choosePreset(id, registry)} onNamed={layoutApi.chooseNamed}
            onSaveAs={name => layoutApi.saveAs(name, layout)} onDelete={layoutApi.deleteNamed}
            onReset={() => layoutApi.reset(registry)} />
          {zonesOpen && <LayoutZonesPanel layout={layout} registry={registry} onOp={onOp}
            onClose={() => setZonesOpen(false)} />}
          <PricingFilters filters={filters} onChange={setFilters} options={fOptions} filtered={view.filtered} />
          {historyOpen && <ChangeHistoryPanel history={history} onLoad={loadHistory} onClose={() => setHistoryOpen(false)} />}
          {paste && (
            <PastePreviewPanel key={paste.seq} party={party} data={state.data} view={view} input={paste} fixture={!!fixture}
              onClose={() => setPaste(null)}
              onApplied={result => { setPaste(null); toast(`✅ ${result?.applied ?? 0} pasted change(s) applied together.`, "success", 6000); load(); }} />
          )}
          <div id="cph-paste-hint" style={{ fontSize: T.label, color: C.slateL, marginBottom: 3 }}>
            Click a cell, then paste (Ctrl+V) a block copied from Excel or Sheets — nothing is saved until you review
            the preview and apply it.{anchor ? " Paste anchor is outlined." : ""}</div>
          <DetailsSummary view={view} disclosed={disclosure} onDisclose={setDisclosed} />
          {disclosure && <MixedDisclosure title={disclosure.title} summary={disclosure.summary}
            onClose={() => setDisclosed(null)} />}
          <PricingMatrix view={view} data={state.data} inline={inline} expanded={expandedLine}
            onToggle={rec => setExpandedLine(expandedLine === rec.key ? null : rec.key)}
            onBandToggle={(groupId, collapse) => onOp({ type: collapse ? "collapse" : "expand", groupId })}
            onCommit={commitCell} onDisclose={setDisclosed} disclosed={disclosure}
            renderLineDetail={renderLineDetail} renderCycleActions={renderCycleActions}
            anchor={anchor} onSelectAnchor={setAnchor}
            onPasteText={({ text, visibleKeys, anchor: at }) => setPaste({ text, anchor: at, visibleKeys, seq: (pasteSeq.current += 1) })} />
          {view.filtered.active && view.records.length === 0 && (
            <div role="status" style={{ color: C.slateL, fontSize: T.body, padding: "4px 2px" }}>
              No Cycle or line matches these filters ({view.filtered.total} hidden). Nothing was changed.</div>
          )}
          {!inline && selected && (
            <div style={{ border: `1px solid ${C.amber}`, borderRadius: 6, background: "#FBF8F3", padding: "4px 10px 6px",
              marginTop: 6 }} aria-label={`Selected: ${recordLabel(selected, view.ctx)}`}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                <b>{recordLabel(selected, view.ctx)}</b>
                <button type="button" style={{ ...rowButton, marginLeft: "auto" }} onClick={() => setExpandedLine(null)}>
                  Close</button>
              </div>
              {renderCycleActions(selected.cycle)}
              {selected.line && renderLineDetail(selected)}
            </div>
          )}
          {fixture && fixtureLog.length > 0 && (
            <div role="log" aria-label="Fixture requests (not sent)" style={{ border: `1px dashed ${C.amber}`,
              borderRadius: 6, padding: "4px 10px", marginTop: 6, fontSize: T.label, background: C.white }}>
              <b style={{ color: C.amberD }}>FIXTURE ONLY — the requests the grid would send (nothing was sent):</b>
              {fixtureLog.map((r, i) => (
                <pre key={i} style={{ margin: "2px 0", whiteSpace: "pre-wrap" }}>{`${r.method} ${r.path}  ${JSON.stringify(r.body)}`}</pre>
              ))}
            </div>
          )}
        </>
      )}
      <div style={{ fontSize: T.label, color: C.slateL, marginTop: 4 }}>
        Our offer = first Avadhoot offer · Customer offer = latest counter · Final agreed = latest agreement.
        Saved to the shared record for every user who can read this Customer; every edit is kept in its change history.
        Views are saved on this browser only, for you and this Customer — not shared, and they never change pricing data.
      </div>
    </div>
  );
}
