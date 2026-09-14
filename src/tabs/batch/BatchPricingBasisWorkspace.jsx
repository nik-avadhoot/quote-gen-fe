import { useEffect, useState } from "react";
import { apiFetch } from "../../lib/apiClient.js";
import { classifyResponse } from "../../lib/backendError.js";
import { runMutation } from "../../lib/runMutation.js";
import {
  automaticPricingBasisSuggestion,
  pricingBasisOptions,
  PRICING_BASIS_ILLUSTRATION,
} from "../../lib/pricingBasisModel.js";
import { C, mono, sans } from "../../theme.js";
import BatchPricingBasisSelector from "./BatchPricingBasisSelector.jsx";
import BatchWorkspacePanel from "./BatchWorkspacePanel.jsx";
import NewGovernedBatchPanel from "./NewGovernedBatchPanel.jsx";
import { useAppState } from "../../state/AppStateContext.js";

const FIXTURE_BATCH = Object.freeze({
  id: "fixture-batch-9301",
  batch_reference: "FIXTURE/NAG/BAT/U4/009301",
  plant_id: "fixture-nag",
  plant: { id: "fixture-nag", plant_code: "NAG", name: "Nagpur", status: "active" },
  status: "working",
  content_version: 7,
  pricing_date: "2026-09-11",
  pricing_basis_release_id: "fixture-current",
  pricing_basis_is_deliberate: false,
  pricing_basis_release: PRICING_BASIS_ILLUSTRATION[0],
  details_partial: false,
});

const FIXTURE_WORKSPACE = Object.freeze({
  ...FIXTURE_BATCH,
  family_id: "fixture-family-9301",
  owner_user_id: "fixture-maker-9301",
  sector_id: "fixture-sector-9301",
  price_validity_from: "2026-09-11",
  price_validity_to: "2026-10-10",
  family: { id: "fixture-family-9301", group_customer_code: "FIX-FAM-9301",
    name: "__U4_FIXTURE_ONLY__ Customer Family", status: "active", content_version: 2 },
  owner: { id: "fixture-maker-9301", display_name: "Fixture Maker", status: "active" },
  sector: { id: "fixture-sector-9301", sector_code: "PIZZA", name: "Pizza", status: "active" },
  family_sectors: [
    { family_id: "fixture-family-9301", sector_id: "fixture-sector-9301",
      created_at: "2026-09-01T08:00:00Z",
      sector: { id: "fixture-sector-9301", sector_code: "PIZZA", name: "Pizza", status: "active" } },
    { family_id: "fixture-family-9301", sector_id: "fixture-sector-9302",
      created_at: "2026-09-02T08:00:00Z",
      sector: { id: "fixture-sector-9302", sector_code: "FMCG", name: "FMCG", status: "active" } },
  ],
  current_profile: { id: "fixture-profile-9301", version_no: 3,
    conv_box_rate: 7, waste_cbb_pct: null, margin_box_pct: 8,
    conv_pp_rate: 12.5, waste_pp_pct: 0, margin_pp_pct: 8 },
  collaborators: [{ id: "fixture-collab-9301", app_user_id: "fixture-collaborator-9301",
    user: { id: "fixture-collaborator-9301", display_name: "Fixture Collaborator", status: "active" } }],
  edit_lock: { id: "fixture-lock-9301", holder_user_id: "fixture-maker-9301",
    heartbeat_at: "2026-09-11T08:25:00Z",
    holder: { id: "fixture-maker-9301", display_name: "Fixture Maker", status: "active" } },
  caller_id: "fixture-maker-9301",
  caller_holds_lock: true,
  available_locations: [
    { id: "fixture-bill-9301", party_id: "fixture-party-9301", location_code: "FIX-BILL-9301",
      bill_to_eligible: true, ship_to_eligible: false, status: "active",
      party: { id: "fixture-party-9301", customer_code: "FIX-CUST-9301", display_name: "Fixture Customer" } },
    { id: "fixture-ship-9301", party_id: "fixture-party-9301", location_code: "FIX-SHIP-9301",
      bill_to_eligible: false, ship_to_eligible: true, status: "active",
      party: { id: "fixture-party-9301", customer_code: "FIX-CUST-9301", display_name: "Fixture Customer" } },
    { id: "fixture-ship-9302", party_id: "fixture-party-9301", location_code: "FIX-SHIP-9302",
      bill_to_eligible: false, ship_to_eligible: true, status: "active",
      party: { id: "fixture-party-9301", customer_code: "FIX-CUST-9301", display_name: "Fixture Customer · Location 2" } },
  ],
  available_skus: [{
    id: "fixture-sku-9301", plant_id: "fixture-nag", party_id: "fixture-party-9301",
    plant_item_code: "FIX-NAG-SKU-9301", status: "active", replacement_sku_id: null,
    content_version: 2,
    customer: { id: "fixture-party-9301", customer_code: "FIX-CUST-9301",
      display_name: "Fixture Customer", lifecycle_state: "customer", status: "active" },
    external_references: [{ id: "fixture-sku-ref-9301", reference_kind: "customer_item_code",
      reference_value: "FIX-CUSTOMER-BOX-9301", status: "active" }],
    versions: [{
      id: "fixture-sku-version-9301", sku_id: "fixture-sku-9301", version_no: 2,
      construction_version_id: "fixture-construction-version-9301", is_price_driving: false,
      length_mm: 400, width_mm: 300, height_mm: 250, box_type: "RSC", ups: 1,
      spec_bs: 8, spec_bct: 120, spec_ect: 32, approved_at: "2026-09-01T08:00:00Z",
      construction_version: { id: "fixture-construction-version-9301",
        construction_id: "fixture-construction-9301", version_no: 4, ply: 5,
        flute_f1: "B", flute_f2: "C", board_gsm: 720, effective_from: "2026-09-01" },
      construction: { id: "fixture-construction-9301", construction_code: "FIX-5P-9301",
        name: "__U4_FIXTURE_ONLY__ 5-ply Construction", status: "published" },
    }],
  }],
  batch_rows: [{
    id: "fixture-row-9301", lineage_id: "fixture-lineage-9301",
    batch_id: "fixture-batch-9301", plant_id: "fixture-nag",
    pricing_group_id: "fixture-pg-9301", sku_id: "fixture-sku-9301",
    sku_version_id: "fixture-sku-version-9301", proposed_construction_version_id: null,
    material_code: "FIX-NAG-SKU-9301", row_type: "box", status: "active", content_version: 2,
    sales_moq: 1000, volume: 5000, waste_override_pct: null, margin_override_pct: null,
    conv_override_rate: null, freight_override: null,
    sku: { id: "fixture-sku-9301", plant_id: "fixture-nag", party_id: "fixture-party-9301",
      plant_item_code: "FIX-NAG-SKU-9301", status: "active", content_version: 2 },
    customer: { id: "fixture-party-9301", customer_code: "FIX-CUST-9301",
      display_name: "Fixture Customer", lifecycle_state: "customer", status: "active" },
    sku_version: { id: "fixture-sku-version-9301", sku_id: "fixture-sku-9301", version_no: 2,
      construction_version_id: "fixture-construction-version-9301", is_price_driving: false,
      length_mm: 400, width_mm: 300, height_mm: 250, box_type: "RSC", ups: 1,
      spec_bs: 8, spec_bct: 120, spec_ect: 32, approved_at: "2026-09-01T08:00:00Z" },
    effective_construction: {
      version_id: "fixture-construction-version-9301", origin: "sku_version", details_partial: false,
      version: { id: "fixture-construction-version-9301", construction_id: "fixture-construction-9301",
        version_no: 4, ply: 5, flute_f1: "B", flute_f2: "C", board_gsm: 720 },
      construction: { id: "fixture-construction-9301", construction_code: "FIX-5P-9301",
        name: "__U4_FIXTURE_ONLY__ 5-ply Construction", status: "published" },
    },
    fixture_effective: { status: "ready", freshness: "not_calculated", calculation: null,
      resolution: { binding: { calculation_fingerprint: "fixture-qcf-current-9301",
        presentation_fingerprint: "fixture-qpf-current-9301" }, effective_inputs: { resolved: {
        waste: { value: 5, source: "sector" }, conv: { value: 7, source: "batch" },
        margin: { value: 8, source: "batch" }, freight: { value: 0, source: "master" },
        interest: { value: 0.5, source: "derived_annual" },
      } } } },
  }, {
    id: "fixture-row-9302", lineage_id: "fixture-lineage-9302",
    batch_id: "fixture-batch-9301", plant_id: "fixture-nag",
    pricing_group_id: "fixture-pg-9301", sku_id: "fixture-sku-9301",
    sku_version_id: "fixture-sku-version-9301", proposed_construction_version_id: null,
    material_code: "FIX-PLATE-9302", row_type: "plate", status: "active", content_version: 1,
    waste_override_pct: 0, margin_override_pct: null, conv_override_rate: null, freight_override: null,
    sku: { id: "fixture-sku-9301", plant_id: "fixture-nag", party_id: "fixture-party-9301",
      plant_item_code: "FIX-NAG-SKU-9301", status: "active", content_version: 2 },
    customer: { id: "fixture-party-9301", customer_code: "FIX-CUST-9301",
      display_name: "Fixture Customer", lifecycle_state: "customer", status: "active" },
    sku_version: { id: "fixture-sku-version-9301", sku_id: "fixture-sku-9301", version_no: 2,
      construction_version_id: "fixture-construction-version-9301", approved_at: "2026-09-01T08:00:00Z" },
    effective_construction: { version_id: "fixture-construction-version-9301", origin: "sku_version",
      details_partial: false, version: { id: "fixture-construction-version-9301" },
      construction: { id: "fixture-construction-9301", construction_code: "FIX-5P-9301",
        name: "__U4_FIXTURE_ONLY__ 5-ply Construction", status: "published" } },
    fixture_effective: { status: "ready", freshness: "calculation_stale",
      calculation: { calculation_fingerprint: "fixture-qcf-old-9302" },
      resolution: { binding: { calculation_fingerprint: "fixture-qcf-current-9302",
        presentation_fingerprint: "fixture-qpf-current-9302" }, effective_inputs: { resolved: {
        waste: { value: 0, source: "row" }, conv: { value: 12.5, source: "batch" },
        margin: { value: 8, source: "batch" }, freight: { value: 0, source: "master" },
        interest: { value: 0.5, source: "derived_annual" },
      } } } },
  }],
  batch_sets: [{ id: "fixture-set-9301", batch_id: "fixture-batch-9301",
    box_row_id: "fixture-row-9301", set_code: "FIX-SET-9301", status: "active",
    active_component_count: 1, memberships: [{ id: "fixture-member-9301",
      set_id: "fixture-set-9301", batch_id: "fixture-batch-9301", row_id: "fixture-row-9302",
      role: "plate", status: "active" }] }],
  pricing_groups: [{ id: "fixture-pg-9301", label: "Standard", status: "active", content_version: 2,
    freight_mode: "master", freight_basis_delivery_group_id: "fixture-dg-9301",
    payment_terms_days: 30, interest_override_pct: null,
    legacy_freight_value: null, legacy_freight_source: null,
    delivery_groups: [{ id: "fixture-dg-9301", label: "Nagpur delivery", status: "active",
      bill_to_location_id: "fixture-bill-9301", ship_to_location_id: "fixture-ship-9301",
      bill_to_location: { id: "fixture-bill-9301", location_code: "FIX-BILL-9301", status: "active" },
      ship_to_location: { id: "fixture-ship-9301", location_code: "FIX-SHIP-9301", status: "active" } }] }],
  partial_sections: [],
  denied_sections: [],
});

const FIXTURE_CREATE_OPTIONS = Object.freeze({
  families: [{ id: "fixture-family-9301", group_customer_code: "FIX-FAM-9301",
    name: "__U4_FIXTURE_ONLY__ Customer Family", status: "active",
    sector_ids: ["fixture-sector-9301", "fixture-sector-9302"],
    members: [{ id: "fixture-party-9301", display_name: "__U4_FIXTURE_ONLY__ Customer",
      customer_code: "FIX-CUST-9301", lifecycle_state: "customer" }] }],
  plants: [{ id: "fixture-nag", plant_code: "NAG", name: "Nagpur", status: "active" }],
  sectors: [
    { id: "fixture-sector-9301", sector_code: "PIZZA", name: "Pizza", status: "active" },
    { id: "fixture-sector-9302", sector_code: "FMCG", name: "FMCG", status: "active" },
  ],
});

const FIXTURE_NEW_WORKSPACE = Object.freeze({
  ...FIXTURE_WORKSPACE,
  id: "fixture-new-batch-unpersisted",
  batch_reference: "FIXTURE/NOT-ALLOCATED/U4/NEW",
  content_version: 1,
  pricing_basis_is_deliberate: false,
});

export default function BatchPricingBasisWorkspace({
  fallbackPlantCode,
  draft,
  setDraft,
  fixtureOnly = false,
  showToast,
  compact = false,
}) {
  const { batchWorkspaceRequest, durableBatch, newBatchDialogOpen, setBatchWorkspaceRequest,
    setDurableBatch, setNewBatchDialogOpen } = useAppState();
  const [reference, setReference] = useState(fixtureOnly
    ? FIXTURE_WORKSPACE.batch_reference : durableBatch?.batch_reference || "");
  const [fixtureStored, setFixtureStored] = useState(FIXTURE_WORKSPACE);
  const [fixtureBatch, setFixtureBatch] = useState(FIXTURE_WORKSPACE);
  const [status, setStatus] = useState(fixtureOnly || durableBatch ? "ready" : "idle");
  const [message, setMessage] = useState(fixtureOnly
    ? "Labelled fixture workspace. Its in-memory save/reopen behavior is not authoritative persistence."
    : durableBatch
      ? "This header, grid and workspace are bound to the same governed Batch."
      : "Start a governed Batch or open one by its permanent reference.");
  const [saving, setSaving] = useState(false);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const batch = fixtureOnly ? fixtureBatch : durableBatch;
  const updateBatch = next => fixtureOnly ? setFixtureBatch(next) : setDurableBatch(next);
  const workspaceRequested = !!batchWorkspaceRequest && !!batch?.id
    && String(batchWorkspaceRequest.batchId) === String(batch.id);
  const workspaceVisible = workspaceOpen || workspaceRequested;

  const closeWorkspace = () => {
    setWorkspaceOpen(false);
    setBatchWorkspaceRequest(null);
  };

  // A newly created Batch already belongs to the Maker. Keep that ephemeral
  // edit lock alive while this one application-wide binding remains open.
  useEffect(() => {
    if (fixtureOnly || !durableBatch?.id || durableBatch.caller_holds_lock !== true) return undefined;
    let active = true;
    const heartbeat = async () => {
      try {
        const response = await apiFetch(`/batches/${durableBatch.id}/lock/heartbeat`, { method: "POST" });
        if (!response.ok && active) {
          setDurableBatch(current => current?.id === durableBatch.id
            ? { ...current, caller_holds_lock: false } : current);
          showToast?.("⚠️ This Batch's edit lock is no longer held. Reacquire it before editing.", "error", 9000);
        }
      } catch {
        if (active) showToast?.("⚠️ Batch lock heartbeat could not be confirmed. Check the lock before editing.", "error", 9000);
      }
    };
    const timer = window.setInterval(heartbeat, 60_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [durableBatch?.caller_holds_lock, durableBatch?.id, fixtureOnly, setDurableBatch, showToast]);

  const acceptResponse = async response => {
    const data = await response.json().catch(() => ({}));
    const outcome = classifyResponse({ ok: response.ok, status: response.status, data });
    if (outcome.kind !== "ok" || !data.batch) {
      setStatus(outcome.kind === "access-denied" ? "denied" : "error");
      setMessage(outcome.message || "The governed Batch could not be opened.");
      return null;
    }
    let accepted = data.batch;
    if (!fixtureOnly) {
      try {
        const workspaceResponse = await apiFetch(`/batches/${data.batch.id}/workspace`);
        const workspaceData = await workspaceResponse.json().catch(() => ({}));
        const workspaceOutcome = classifyResponse({ ok: workspaceResponse.ok,
          status: workspaceResponse.status, data: workspaceData });
        if (workspaceOutcome.kind === "ok" && workspaceData.batch) {
          accepted = { ...workspaceData.batch,
            pricing_basis_release: data.batch.pricing_basis_release || null };
        }
      } catch {
        accepted = { ...data.batch, details_partial: true };
      }
    }
    updateBatch(accepted);
    setReference(data.batch.batch_reference);
    setStatus("ready");
    setMessage("Persisted Batch values loaded as the authenticated caller.");
    return accepted;
  };

  const open = async () => {
    if (!reference.trim()) {
      setStatus("error");
      setMessage("Enter a permanent Batch reference.");
      return;
    }
    if (fixtureOnly) {
      updateBatch({ ...fixtureStored });
      setStatus("ready");
      setMessage("Fixture reopened from isolated in-memory state; no governed record was read or written.");
      return;
    }
    setStatus("loading");
    setMessage("Loading the caller-visible Batch…");
    try {
      await acceptResponse(await apiFetch(`/batches/pricing-basis?reference=${encodeURIComponent(reference.trim())}`));
    } catch {
      setStatus("error");
      setMessage("The Batch service could not be reached. No local record was substituted.");
    }
  };

  const reopen = async () => {
    if (!batch) return open();
    if (fixtureOnly) {
      updateBatch({ ...fixtureStored });
      setMessage("Fixture reopened: the same isolated selection returned. This is contract evidence, not live verification.");
      return;
    }
    setStatus("loading");
    try {
      await acceptResponse(await apiFetch(`/batches/${batch.id}/pricing-basis`));
    } catch {
      setStatus("error");
      setMessage("The Batch could not be reopened. The prior view has not been presented as current.");
    }
  };

  const persist = async ({ draft: nextDraft, body }) => {
    setSaving(true);
    if (fixtureOnly) {
      const automatic = automaticPricingBasisSuggestion(pricingBasisOptions(
        PRICING_BASIS_ILLUSTRATION, batch.plant.plant_code, nextDraft.pricingDate));
      const releaseId = body.release_id == null ? automatic?.id ?? null : body.release_id;
      const selected = PRICING_BASIS_ILLUSTRATION.find(release => String(release.id) === String(releaseId));
      const next = {
        ...batch,
        content_version: batch.content_version + 1,
        pricing_date: nextDraft.pricingDate,
        pricing_basis_release_id: releaseId,
        pricing_basis_is_deliberate: body.release_id != null,
        pricing_basis_release: selected || null,
      };
      setFixtureStored(next);
      updateBatch(next);
      setMessage("Fixture save completed in isolated memory. Reopen can demonstrate return behavior; nothing was persisted.");
      setSaving(false);
      return;
    }
    const data = await runMutation(`/batches/${batch.id}/pricing-basis`, body, {
      showToast,
      successMessage: "Pricing Basis saved to the governed Batch",
    });
    if (data?.batch) {
      updateBatch({ ...batch, ...data.batch });
      setMessage("The governed RPC completed and its persisted Batch values were read back.");
    }
    setSaving(false);
  };

  const closeDurableBatch = async () => {
    if (fixtureOnly || !batch) return;
    if (batch.caller_holds_lock) {
      try {
        const response = await apiFetch(`/batches/${batch.id}/lock/release`, { method: "POST" });
        if (!response.ok) showToast?.("⚠️ The Batch was closed locally, but its lock release could not be confirmed.", "error", 9000);
      } catch {
        showToast?.("⚠️ The Batch was closed locally, but its lock-release outcome is unknown.", "error", 9000);
      }
    }
    setDurableBatch(null);
    setWorkspaceOpen(false);
    setBatchWorkspaceRequest(null);
  };

  const acceptFixtureCreation = next => {
    setWorkspaceOpen(false);
    if (!next) {
      setFixtureBatch(null);
      setFixtureStored(null);
      setReference("");
      setStatus("idle");
      setMessage("Fixture workspace cleared in memory. No governed record changed.");
      return;
    }
    setFixtureBatch(next);
    setFixtureStored(next);
    setReference(next.batch_reference);
    setStatus("ready");
    setMessage("New fixture Batch exists only in memory; its default groups and lock are ready to inspect.");
  };

  const fixtureDialog = fixtureOnly && newBatchDialogOpen
    ? <NewGovernedBatchPanel fixtureOnly fixtureOptions={FIXTURE_CREATE_OPTIONS}
        fixtureBatch={FIXTURE_NEW_WORKSPACE} currentFixtureBatch={batch}
        onFixtureCreated={acceptFixtureCreation} />
    : null;

  if (compact) {
    const batchOpenControls = <div className="batch-pb-open-actions">
      <button type="button" onClick={open} disabled={status === "loading"}>
        {batch ? "Open" : "Open Batch"}
      </button>
      {batch && <button type="button" onClick={reopen} disabled={status === "loading"}
        title="Reopen persisted selection">↻</button>}
      {batch && <button type="button" onClick={() => setWorkspaceOpen(true)}
        title="View durable Batch identity, profile, people and groups">Workspace</button>}
      {batch && !fixtureOnly && <button type="button" onClick={closeDurableBatch}
        title="Close this governed Batch and release its edit lock">Close</button>}
      {fixtureOnly && <button type="button" onClick={() => setNewBatchDialogOpen(true)}>
        + New fixture Batch
      </button>}
    </div>;
    return <>
      <section className="batch-pb-compact" aria-label="Durable Batch Pricing Basis workspace">
        <div className="batch-pb-workspace-line">
          <strong className="batch-pb-compact-label">BATCH</strong>
          <input aria-label="Permanent Batch reference" value={reference}
            onChange={event => setReference(event.target.value)} disabled={fixtureOnly}
            placeholder="NAG/BAT/2026-27/00001" />
          <span className={`batch-pb-workspace-state ${status === "error" || status === "denied" ? "is-warning" : ""}`}
            title={message}>{status === "loading" ? "Loading…" : fixtureOnly ? "FIXTURE ONLY" : message}</span>
        </div>
        {batch && <div className="batch-pb-workspace-meta">
          <span title={batch.batch_reference}><strong>Ref</strong> {batch.batch_reference}</span>
          <span><strong>Batch</strong> #{batch.id}</span>
          <span><strong>Plant</strong> {batch.plant
            ? `${batch.plant.plant_code} · #${batch.plant.id}` : `#${batch.plant_id} · hidden`}</span>
          <span><strong>v</strong>{batch.content_version}</span>
          {batch.details_partial && <span className="is-warning">Partial caller-visible identity</span>}
        </div>}
        {batch ? <BatchPricingBasisSelector compact fixtureOnly={fixtureOnly}
            plantCode={batch.plant?.plant_code} persistedBatch={batch}
            onPersist={persist} saving={saving} batchOpenControls={batchOpenControls} />
          : <BatchPricingBasisSelector compact plantCode={fallbackPlantCode}
              draft={draft} setDraft={setDraft} batchOpenControls={batchOpenControls} />}
      </section>
      {workspaceVisible && batch && <BatchWorkspacePanel
        key={`${batch.id}-${batchWorkspaceRequest?.requestId || "manual"}`} batchId={batch.id}
        fixtureOnly={fixtureOnly} fixtureWorkspace={batch}
        initialDeliveryAction={batchWorkspaceRequest}
        showToast={showToast}
        onBatchChange={next => updateBatch({ ...batch, ...next })}
        onClose={closeWorkspace} />}
      {fixtureDialog}
    </>;
  }

  return (
    <section aria-label="Durable Batch Pricing Basis workspace" style={{ fontFamily: sans,
      borderBottom: `1px solid ${C.border}`, background: C.cream }}>
      <div style={{ padding: "7px 14px", display: "flex", alignItems: "end", gap: 8, flexWrap: "wrap" }}>
        <div style={{ minWidth: 205, flex: 1 }}>
          <div style={{ fontSize: 10.5, fontWeight: 800, color: C.slate }}>Durable Batch workspace · Pricing Basis</div>
          <div style={{ fontSize: 8.8, color: fixtureOnly ? C.amberD : C.slateL, marginTop: 1 }}>
            {fixtureOnly ? "FIXTURE-ONLY · isolated demonstration · no database writes" : message}
          </div>
        </div>
        <label style={{ minWidth: 275, flex: 1, fontSize: 8.8, color: C.slateL, fontWeight: 750 }}>
          Permanent Batch reference
          <input value={reference} onChange={event => setReference(event.target.value)}
            disabled={fixtureOnly}
            placeholder="NAG/BAT/2026-27/00001"
            style={{ display: "block", boxSizing: "border-box", width: "100%", marginTop: 2,
              padding: "4px 6px", border: `1px solid ${C.border}`, borderRadius: 4,
              background: fixtureOnly ? C.paper : C.white, fontFamily: mono, fontSize: 10 }} />
        </label>
        <button type="button" onClick={open} disabled={status === "loading"}
          style={{ border: `1px solid ${C.border}`, borderRadius: 4, background: C.white,
            color: C.slate, padding: "5px 9px", fontSize: 9.5, fontWeight: 750, cursor: "pointer" }}>
          {batch ? "Open by reference" : "Open Batch"}
        </button>
        {batch && <button type="button" onClick={reopen} disabled={status === "loading"}
          style={{ border: `1px solid ${C.border}`, borderRadius: 4, background: C.white,
            color: C.slate, padding: "5px 9px", fontSize: 9.5, fontWeight: 750, cursor: "pointer" }}>
          Reopen persisted selection
        </button>}
        {batch && <button type="button" onClick={() => setWorkspaceOpen(true)}
          style={{ border: `1px solid ${C.border}`, borderRadius: 4, background: C.white,
            color: C.slate, padding: "5px 9px", fontSize: 9.5, fontWeight: 750, cursor: "pointer" }}>
          View Batch workspace
        </button>}
        {fixtureOnly && <button type="button" onClick={() => setNewBatchDialogOpen(true)}
          style={{ border: `1px solid ${C.amber}`, borderRadius: 4, background: C.amberL,
            color: C.amberD, padding: "5px 9px", fontSize: 9.5, fontWeight: 750, cursor: "pointer" }}>
          + New fixture Batch
        </button>}
      </div>

      {(status === "error" || status === "denied" || status === "loading" || fixtureOnly) && (
        <div role="status" style={{ margin: "0 14px 7px", padding: "5px 7px", borderRadius: 4,
          border: `1px solid ${status === "error" || status === "denied" ? C.red : C.border}`,
          background: status === "error" || status === "denied" ? C.redL : C.white,
          color: status === "error" || status === "denied" ? C.red : C.slateL,
          fontSize: 8.9 }}>{message}</div>
      )}

      {batch && <div style={{ margin: "0 14px 7px", display: "flex", gap: 8, flexWrap: "wrap",
        color: C.slateM, fontSize: 9 }}>
        <span><strong>Batch:</strong> <span style={{ fontFamily: mono }}>{batch.batch_reference}</span> · #{batch.id}</span>
        <span><strong>Plant:</strong> {batch.plant
          ? `${batch.plant.plant_code} · ${batch.plant.name} · #${batch.plant.id}` : `#${batch.plant_id} · details unavailable`}</span>
        <span><strong>Release:</strong> {batch.pricing_basis_release_id == null
          ? "unresolved" : `#${batch.pricing_basis_release_id}`}</span>
        <span><strong>Mode:</strong> {batch.pricing_basis_is_deliberate ? "deliberate" : "automatic"}</span>
        {batch.details_partial && <span style={{ color: C.amberD, fontWeight: 750 }}>
          Partial caller-visible identity; hidden details are not inferred.
        </span>}
      </div>}

      {batch ? <BatchPricingBasisSelector
          fixtureOnly={fixtureOnly}
          plantCode={batch.plant?.plant_code}
          persistedBatch={batch}
          onPersist={persist}
          saving={saving} />
        : <BatchPricingBasisSelector plantCode={fallbackPlantCode} draft={draft} setDraft={setDraft} />}
      {workspaceVisible && batch && <BatchWorkspacePanel
        key={`${batch.id}-${batchWorkspaceRequest?.requestId || "manual"}`} batchId={batch.id}
        fixtureOnly={fixtureOnly} fixtureWorkspace={batch}
        initialDeliveryAction={batchWorkspaceRequest}
        showToast={showToast}
        onBatchChange={next => updateBatch({ ...batch, ...next })}
        onClose={closeWorkspace} />}
      {fixtureDialog}
    </section>
  );
}
