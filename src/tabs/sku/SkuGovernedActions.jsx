// ═══════════════════════════════════════════════════════════════════════════
// src/tabs/sku/SkuGovernedActions.jsx — the SKU Master's governed editing UI.
//
// Canonical Amendment 04, slice 1. Every control here calls ONE governed route
// (quote-gen-be, public.sku_* as the caller) and is offered only when the caller
// holds the capability at the SKU's own plant (src/lib/skuGovernedOps.js). Until the
// operations are activated, or in the fixture preview, every control stays VISIBLE
// and DISABLED with its reason (D11) - never hidden, never live.
//
// Every change carries the content version the caller read; a stale answer tells the
// caller to reload rather than retrying (runMutation). Confirms state the consequence
// before a permanent or lifecycle step.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useState } from "react";
import { apiFetch } from "../../lib/apiClient.js";
import { classifyResponse } from "../../lib/backendError.js";
import { hasCapability } from "../../lib/capabilities.js";
import { runMutation } from "../../lib/runMutation.js";
import {
  PRICING_PORTFOLIO_OPTIONS, REFERENCE_KIND_OPTIONS, SKU_EDIT_FIELDS, SKU_FIELD_CLASS_LABELS, SKU_OP_CONFIRM,
  buildFieldChanges, fieldEditability, replacementCandidates, skuLifecycleActions, skuOpsBody,
  versionChangeVerdict, versionEditPlan, versionFieldValues,
} from "../../lib/skuGovernedOps.js";
import { control, menuPanel, menuSummary } from "../../ui/screenStandards.js";
import { C, T, mono, sans } from "../../theme.js";

const overlay = { position: "fixed", inset: 0, background: "rgba(28,43,58,.45)", display: "flex",
  alignItems: "center", justifyContent: "center", zIndex: 10000 };
const sheet = { width: "min(760px, calc(100vw - 32px))", maxHeight: "calc(100vh - 48px)", overflow: "auto",
  background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, padding: 18, fontFamily: sans,
  boxShadow: "0 8px 32px rgba(0,0,0,.2)" };
const fieldLabel = { display: "grid", gap: 3, fontSize: T.label, color: C.slateL, fontWeight: 700 };
const primary = disabled => ({ ...control, border: "none", fontWeight: 700, color: C.white,
  background: disabled ? "#CCC" : C.amber, cursor: disabled ? "not-allowed" : "pointer" });
const CLASS_TONE = { new_sku: C.red, price_driving_version: C.amberD, version: C.green };

function DisabledNote({ reason }) {
  return reason ? <span role="note" style={{ fontSize: T.label, color: C.amberD, lineHeight: 1.35 }}>{reason}</span> : null;
}

// ── Actions ▾ in the detail toolbar ─────────────────────────────────────────
export function SkuActionsMenu({ data, rows, authority, mode, showToast, onChanged, onEditVersion }) {
  const { sku, versions = [] } = data;
  const [code, setCode] = useState("");
  const [reason, setReason] = useState("");
  const [replacement, setReplacement] = useState("");
  const [portfolio, setPortfolio] = useState("");
  const [busy, setBusy] = useState(false);
  const actions = skuLifecycleActions(sku, versions, authority);
  if (mode.state === "none" || !actions.length) return null;
  const live = mode.state === "live";
  const label = sku.plant_item_code || `SKU #${sku.id}`;
  const plan = versionEditPlan(versions);

  const run = async (path, body, successMessage, confirmText) => {
    if (!live || busy) return;
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    const result = await runMutation(path, body, { showToast, successMessage });
    setBusy(false);
    if (result !== null) { setCode(""); setReason(""); setReplacement(""); setPortfolio(""); onChanged(); }
  };
  const token = skuOpsBody(sku.content_version);
  const candidates = replacementCandidates(sku, rows);

  return (
    <details style={{ position: "relative" }}>
      <summary style={menuSummary(false)} title={live ? "Governed SKU actions" : mode.reason}>Actions ▾</summary>
      <div style={{ ...menuPanel, left: "auto", right: 0, minWidth: 300, maxWidth: 360 }}>
        {!live && <DisabledNote reason={mode.reason} />}
        {actions.map(a => {
          const disabled = !live || !a.enabled || busy;
          const note = a.reason && <DisabledNote reason={a.reason} />;
          if (a.id === "edit_version") {
            return <div key={a.id} style={{ display: "grid", gap: 3 }}>
              <button type="button" disabled={disabled} onClick={() => onEditVersion(plan)} style={primary(disabled)}>{a.label}</button>{note}</div>;
          }
          if (a.id === "approve_version") {
            return <div key={a.id} style={{ display: "grid", gap: 3 }}>
              <button type="button" disabled={disabled} style={primary(disabled)}
                onClick={() => run(`/masters/sku-versions/${plan.version.id}/approve`, skuOpsBody(plan.version.content_version),
                  `Version v${plan.version.version_no} approved.`, SKU_OP_CONFIRM.approve_version(label, plan.version.version_no))}>
                {a.label}</button>
              {plan.version.content_version == null && <DisabledNote reason="This version carries no token yet - reload after activation." />}
              {note}</div>;
          }
          if (a.id === "assign_code") {
            const blank = !code.trim();
            return <label key={a.id} style={fieldLabel}>Plant Item Code (permanent)
              <span style={{ display: "flex", gap: 6 }}>
                <input value={code} maxLength={60} disabled={!live} onChange={e => setCode(e.target.value)}
                  aria-label="Plant Item Code" style={{ ...control, flex: 1, fontFamily: mono }} />
                <button type="button" disabled={disabled || blank} style={primary(disabled || blank)}
                  onClick={() => run(`/masters/skus/${sku.id}/plant-item-code`, { ...token, plant_item_code: code.trim() },
                    "Plant Item Code assigned.", SKU_OP_CONFIRM.assign_code(code.trim()))}>Assign</button>
              </span>{note}</label>;
          }
          if (a.id === "publish" || a.id === "reactivate") {
            return <div key={a.id} style={{ display: "grid", gap: 3 }}>
              <button type="button" disabled={disabled} style={{ ...control, fontWeight: 700, cursor: disabled ? "not-allowed" : "pointer" }}
                onClick={() => run(`/masters/skus/${sku.id}/${a.id}`, { ...token, ...(a.id === "reactivate" && reason.trim() ? { reason: reason.trim() } : {}) },
                  a.id === "publish" ? "SKU published." : "SKU reactivated.", SKU_OP_CONFIRM[a.id](label))}>{a.label}</button>{note}</div>;
          }
          if (a.id === "discontinue" || a.id === "withdraw") {
            const needsReason = a.id === "discontinue";
            const blocked = disabled || (needsReason && !reason.trim());
            return <div key={a.id} style={{ display: "grid", gap: 5, borderTop: `1px solid ${C.border}`, paddingTop: 7 }}>
              <label style={fieldLabel}>{needsReason ? "Reason (required)" : "Reason (optional)"}
                <input value={reason} maxLength={500} disabled={!live} onChange={e => setReason(e.target.value)} style={control} />
              </label>
              {needsReason && <label style={fieldLabel}>Replacement (same plant and Customer, optional)
                <select value={replacement} disabled={!live} onChange={e => setReplacement(e.target.value)} style={control}>
                  <option value="">No replacement</option>
                  {candidates.map(r => <option key={r.id} value={r.id}>{r.plant_item_code || `SKU #${r.id}`}</option>)}
                </select>
                <span style={{ fontWeight: 400 }}>Only SKUs already shown in the list are offered. A replacement is linked, never substituted.</span>
              </label>}
              <button type="button" disabled={blocked} style={{ ...control, fontWeight: 700, color: C.red, borderColor: `${C.red}66`,
                cursor: blocked ? "not-allowed" : "pointer" }}
                onClick={() => run(`/masters/skus/${sku.id}/${a.id}`,
                  { ...token, ...(reason.trim() ? { reason: reason.trim() } : {}),
                    ...(needsReason && replacement ? { replacement_sku_id: Number(replacement) } : {}) },
                  needsReason ? "SKU discontinued." : "Proposal withdrawn.", SKU_OP_CONFIRM[a.id](label))}>{a.label.replace("…", "")}</button>
              {note}</div>;
          }
          if (a.id === "set_portfolio") {
            const choice = portfolio || "";
            const blocked = disabled || !choice || choice === sku.pricing_portfolio;
            return <label key={a.id} style={{ ...fieldLabel, borderTop: `1px solid ${C.border}`, paddingTop: 7 }}>
              Pricing portfolio · now {sku.pricing_portfolio || "pending"}
              <span style={{ display: "flex", gap: 6 }}>
                <select value={choice} disabled={!live || !a.enabled} onChange={e => setPortfolio(e.target.value)} style={{ ...control, flex: 1 }}>
                  <option value="">Choose…</option>
                  {PRICING_PORTFOLIO_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                <button type="button" disabled={blocked} style={primary(blocked)}
                  onClick={() => run(`/masters/skus/${sku.id}/pricing-portfolio`, { ...token, pricing_portfolio: choice },
                    "Pricing portfolio changed.", SKU_OP_CONFIRM.set_portfolio(label, choice))}>Change</button>
              </span>
              <span style={{ fontWeight: 400 }}>Recorded only — no price is set from it (CDM-45).</span>
              {note}</label>;
          }
          return null;
        })}
      </div>
    </details>
  );
}

// ── The version editor (new version, or the open draft in place) ────────────
export function SkuVersionEditor({ data, plan, onClose, onSaved, showToast }) {
  const target = plan.mode === "edit_draft" ? plan.version : plan.base;
  const original = versionFieldValues(target);
  const baseValues = plan.mode === "edit_draft" ? versionFieldValues(plan.base) : original;
  const [inputs, setInputs] = useState(() => Object.fromEntries(SKU_EDIT_FIELDS.map(d => [d.field, original[d.field] ?? ""])));
  const [priceDriving, setPriceDriving] = useState(plan.mode === "edit_draft" ? !!plan.version.is_price_driving : false);
  const [busy, setBusy] = useState(false);
  const { fields, errors } = buildFieldChanges(inputs, original);
  const verdict = versionChangeVerdict(plan, baseValues, fields, priceDriving);
  const priceDrivingChanged = plan.mode === "edit_draft" && priceDriving !== !!plan.version.is_price_driving;
  const canSave = !busy && !Object.keys(errors).length && (verdict.ok || (priceDrivingChanged && !Object.keys(fields).length));

  const save = async () => {
    if (!canSave) return;
    setBusy(true);
    const result = plan.mode === "edit_draft"
      ? await runMutation(`/masters/sku-versions/${plan.version.id}`,
          { expected_content_version: plan.version.content_version, is_price_driving: priceDriving, fields },
          { method: "PATCH", showToast, successMessage: `Draft v${plan.version.version_no} saved.` })
      : await runMutation(`/masters/skus/${data.sku.id}/versions`,
          { expected_content_version: data.sku.content_version, is_price_driving: priceDriving, fields },
          { showToast, successMessage: "New version created - it needs approval." });
    setBusy(false);
    if (result !== null) onSaved();
  };

  return (
    <div style={overlay} role="dialog" aria-label={plan.mode === "edit_draft" ? "Edit draft version" : "New version"}
      onKeyDown={e => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } }}>
      <div style={sheet}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
          <strong style={{ fontSize: T.title, color: C.slate }}>
            {plan.mode === "edit_draft" ? `Edit draft v${plan.version.version_no}` : `New version of ${data.sku.plant_item_code || `SKU #${data.sku.id}`}`}</strong>
          <span style={{ fontSize: T.label, color: C.slateL }}>Plant and Customer are never edited. Blank means not recorded; 0 is a value.</span>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", margin: "8px 0", fontSize: T.label }}>
          {Object.entries(SKU_FIELD_CLASS_LABELS).map(([cls, text]) => <span key={cls} style={{ color: CLASS_TONE[cls], fontWeight: 700 }}>● {text}</span>)}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8 }}>
          {SKU_EDIT_FIELDS.map(def => {
            const { editable, cls, reason } = fieldEditability(def.field, plan);
            const value = inputs[def.field] ?? "";
            const common = { disabled: !editable || busy, value, "aria-label": def.label,
              onChange: e => setInputs(prev => ({ ...prev, [def.field]: e.target.value })),
              style: { ...control, width: "100%", fontFamily: def.type === "text" ? sans : mono,
                borderColor: errors[def.field] ? C.red : fields[def.field] !== undefined ? C.amber : C.border } };
            return <label key={def.field} style={fieldLabel} title={reason || undefined}>
              <span><span style={{ fontFamily: mono }}>{def.sheet}</span> {def.label}
                <span style={{ color: CLASS_TONE[cls], marginLeft: 4 }}>●</span></span>
              {def.type === "enum"
                ? <select {...common}><option value="">Not recorded</option>{def.options.map(o => <option key={o} value={o}>{o}</option>)}</select>
                : <input {...common} inputMode={def.type === "text" ? undefined : "decimal"} />}
              {errors[def.field] && <span role="alert" style={{ color: C.red, fontWeight: 400 }}>{errors[def.field]}</span>}
              {!editable && <span style={{ fontWeight: 400 }}>{reason}</span>}
            </label>;
          })}
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10, fontSize: T.body, color: C.slateM }}>
          <input type="checkbox" checked={priceDriving} disabled={busy} onChange={e => setPriceDriving(e.target.checked)} />
          Price-driving change (required for Cobb value, item weight or ups)
        </label>
        <div role="status" style={{ marginTop: 8, fontSize: T.body, color: verdict.ok ? C.slateM : C.amberD }}>{verdict.message}</div>
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button type="button" disabled={!canSave} onClick={save} style={primary(!canSave)}>{busy ? "Saving…" : "Save"}</button>
          <button type="button" disabled={busy} onClick={onClose} style={control}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── References: add and withdraw (D5) ───────────────────────────────────────
export function SkuReferenceControls({ data, references, authority, mode, showToast, onChanged }) {
  const [kind, setKind] = useState("customer_item_code");
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  if (!authority.manage || mode.state === "none") return null;
  const live = mode.state === "live";
  const token = skuOpsBody(data.sku.content_version);
  const run = async (path, body, message, confirmText) => {
    if (!live || busy) return;
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    const result = await runMutation(path, body, { showToast, successMessage: message });
    setBusy(false);
    if (result !== null) { setValue(""); onChanged(); }
  };
  const blocked = !live || busy || !value.trim();
  return (
    <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
      {!live && <DisabledNote reason={mode.reason} />}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        <select value={kind} disabled={!live} onChange={e => setKind(e.target.value)} aria-label="Reference kind" style={control}>
          {REFERENCE_KIND_OPTIONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <input value={value} maxLength={120} disabled={!live} onChange={e => setValue(e.target.value)}
          aria-label="Reference value" placeholder="Value" style={{ ...control, fontFamily: mono, flex: "1 1 160px" }} />
        <button type="button" disabled={blocked} style={primary(blocked)}
          onClick={() => run(`/masters/skus/${data.sku.id}/references`, { ...token, reference_kind: kind, reference_value: value.trim() },
            "Reference added.")}>+ Reference</button>
      </div>
      {references.filter(r => r.status === "active").map(r => (
        <button key={r.id} type="button" disabled={!live || busy}
          onClick={() => run(`/masters/sku-references/${r.id}/withdraw`, token, "Reference withdrawn.", SKU_OP_CONFIRM.withdraw_reference(r.reference_value))}
          style={{ ...control, justifySelf: "start", height: 22, fontSize: T.label, color: C.red, cursor: live ? "pointer" : "not-allowed" }}>
          Withdraw {r.reference_value}</button>
      ))}
    </div>
  );
}

// ── Propose a SKU (D1: a Maker may) ─────────────────────────────────────────
export function SkuProposeForm({ plants, profile, mode, onClose, onSaved, showToast }) {
  const live = mode.state === "live";
  const canReadParties = hasCapability(profile, "read_party_master");
  const canReadConstructions = hasCapability(profile, "read_construction_library");
  const [plant, setPlant] = useState(plants[0] || "");
  const [party, setParty] = useState("");
  const [portfolio, setPortfolio] = useState("");
  const [priceDriving, setPriceDriving] = useState(true);
  const [inputs, setInputs] = useState({ box_type: "RSC", ups: "1" });
  const [parties, setParties] = useState({ status: canReadParties && live ? "loading" : "idle", rows: [] });
  const [constructions, setConstructions] = useState({ status: canReadConstructions && live ? "loading" : "idle", rows: [] });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!live) return undefined;
    let cancelled = false;
    const load = async (path, pick, set, allowed) => {
      if (!allowed) return;
      try {
        const resp = await apiFetch(path);
        const body = await resp.json().catch(() => ({}));
        const outcome = classifyResponse({ ok: resp.ok, status: resp.status, data: body });
        if (!cancelled) set(outcome.kind === "ok" ? { status: "ready", rows: pick(body) } : { status: "unavailable", rows: [] });
      } catch {
        if (!cancelled) set({ status: "unavailable", rows: [] });
      }
    };
    load("/masters/customer-families", body => (body.parties || []).filter(p => p.status !== "retired"), setParties, canReadParties);
    load("/masters/constructions", body => (body.constructions || []).filter(c => c.status === "published")
      .flatMap(c => (c.versions || []).filter(v => v.approved_at || v.approved).map(v => ({ id: v.id, label: `${c.construction_code || c.name} v${v.version_no} · ${v.ply ?? "?"}-ply` }))),
      setConstructions, canReadConstructions);
    return () => { cancelled = true; };
  }, [live, canReadParties, canReadConstructions]);

  const { fields, errors } = buildFieldChanges(
    Object.fromEntries(Object.entries(inputs).filter(([, v]) => v !== "")), {});
  const missing = !plant ? "Choose a plant." : !party ? "Choose the Customer or Prospect." : !portfolio ? "Choose a pricing portfolio (CDM-45)."
    : !fields.construction_version_id ? "Choose a Construction version (CDM-13)." : null;
  const blocked = !live || busy || !!missing || Object.keys(errors).length > 0;

  const save = async () => {
    if (blocked) return;
    setBusy(true);
    const result = await runMutation("/masters/skus", { plant_code: plant, party_id: Number(party), pricing_portfolio: portfolio,
      is_price_driving: priceDriving, fields }, { showToast, successMessage: "SKU proposed." });
    setBusy(false);
    if (result !== null) onSaved(result.id);
  };
  const set = field => e => setInputs(prev => ({ ...prev, [field]: e.target.value }));
  const quick = SKU_EDIT_FIELDS.filter(d => ["item_name", "item_short_name", "length_mm", "width_mm", "height_mm", "box_type", "ups",
    "print_technology", "number_of_colours"].includes(d.field));

  return (
    <div style={overlay} role="dialog" aria-label="Propose a SKU" onKeyDown={e => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } }}>
      <div style={sheet}>
        <strong style={{ fontSize: T.title, color: C.slate }}>Propose a SKU</strong>
        <div style={{ fontSize: T.label, color: C.slateL, margin: "2px 0 10px" }}>
          A proposal can be quoted before its Plant Item Code is assigned; publishing is a separate step (CDM-11, Amendment 04).</div>
        {!live && <DisabledNote reason={mode.reason} />}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8, marginTop: 6 }}>
          <label style={fieldLabel}>Producing Plant
            <select value={plant} disabled={!live} onChange={e => setPlant(e.target.value)} style={control}>
              {plants.map(p => <option key={p} value={p}>{p}</option>)}
            </select></label>
          <label style={fieldLabel}>Customer / Prospect
            <select value={party} disabled={!live || parties.status !== "ready"} onChange={e => setParty(e.target.value)} style={control}>
              <option value="">{!canReadParties ? "Needs read_party_master" : parties.status === "ready" ? "Choose…" : parties.status === "loading" ? "Loading…" : "Unavailable"}</option>
              {parties.rows.map(p => <option key={p.id} value={p.id}>{p.customer_code ? `${p.customer_code} · ` : ""}{p.display_name}</option>)}
            </select></label>
          <label style={fieldLabel}>Construction version
            <select value={inputs.construction_version_id || ""} disabled={!live || constructions.status !== "ready"}
              onChange={set("construction_version_id")} style={control}>
              <option value="">{!canReadConstructions ? "Needs read_construction_library" : constructions.status === "ready" ? "Choose…" : constructions.status === "loading" ? "Loading…" : "Unavailable"}</option>
              {constructions.rows.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select></label>
          <label style={fieldLabel}>Pricing portfolio
            <select value={portfolio} disabled={!live} onChange={e => setPortfolio(e.target.value)} style={control}>
              <option value="">Choose…</option>
              {PRICING_PORTFOLIO_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
            </select></label>
          {quick.map(def => <label key={def.field} style={fieldLabel}>{def.label}
            {def.type === "enum"
              ? <select value={inputs[def.field] || ""} disabled={!live} onChange={set(def.field)} style={control}>
                  <option value="">Not recorded</option>{def.options.map(o => <option key={o} value={o}>{o}</option>)}</select>
              : <input value={inputs[def.field] ?? ""} disabled={!live} onChange={set(def.field)} style={{ ...control, fontFamily: def.type === "text" ? sans : mono }} />}
            {errors[def.field] && <span role="alert" style={{ color: C.red, fontWeight: 400 }}>{errors[def.field]}</span>}
          </label>)}
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10, fontSize: T.body, color: C.slateM }}>
          <input type="checkbox" checked={priceDriving} disabled={!live} onChange={e => setPriceDriving(e.target.checked)} />
          Price-driving version</label>
        {missing && live && <div role="status" style={{ marginTop: 6, fontSize: T.body, color: C.amberD }}>{missing}</div>}
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button type="button" disabled={blocked} onClick={save} style={primary(blocked)}>{busy ? "Proposing…" : "Propose"}</button>
          <button type="button" onClick={onClose} disabled={busy} style={control}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
