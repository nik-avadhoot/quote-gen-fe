import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../lib/apiClient.js";
import { classifyResponse } from "../../lib/backendError.js";
import { ownerStaleLockReclaimRequest } from "../../lib/batchLockModel.js";
import { DURABLE_ROW_TYPES, durableBatchPreparation, durableRowSelection,
  durableRowSpecificationEvidence, durableRowToLocalPreview, localPreviewState,
  openDurableRowInCosting }
  from "../../lib/batchRowModel.js";
import { applyFixturePricingGroupUpdate, deliveryGroupStatusBody,
  PRICING_GROUP_FREIGHT_MODES, PRICING_GROUP_PAYMENT_DAYS, pricingGroupCreateBody,
  pricingGroupCreateValidation, pricingGroupDraft, pricingGroupDraftValidation,
  pricingGroupStatusBody, pricingGroupUpdateBody } from "../../lib/pricingGroupModel.js";
import { runMutation } from "../../lib/runMutation.js";
import { batchSkuChoices } from "../../lib/batchSkuChoice.js";
import { governedBatchActionState } from "../../lib/governedBatchActions.js";
import { useAppState } from "../../state/AppStateContext.js";
import { freshBatchProfileValues } from "../../state/costingDraftModel.js";

const shown = value => value === null || value === undefined || value === "" ? "—" : String(value);

function Identity({ label, value, detail }) {
  return <div className="batch-workspace-identity">
    <span>{label}</span>
    <strong>{shown(value)}</strong>
    {detail && <small>{detail}</small>}
  </div>;
}

function ProfileValue({ label, value }) {
  const blank = value === null || value === undefined || value === "";
  return <div className="batch-workspace-profile-value">
    <span>{label}</span>
    <strong>{blank ? "Blank" : shown(value)}</strong>
    <small>{blank ? "inherits downstream" : Number(value) === 0 ? "explicit zero" : "Batch Profile value"}</small>
  </div>;
}

const FRESHNESS_LABELS = {
  unknown: "Freshness unavailable · calculation evidence denied",
  not_calculated: "No persisted governed calculation",
  fresh: "Fresh · calculation and presentation match",
  needs_send_only: "Calculation fresh · presentation changed",
  calculation_stale: "Calculation stale · recalculate before Send",
};

function EffectiveInputEvidence({ evidence }) {
  if (!evidence || evidence.status === "idle") return null;
  if (evidence.status !== "ready") return <div className={`batch-workspace-effective-state is-${evidence.status}`}>
    {evidence.message}
  </div>;
  const resolved = evidence.resolution?.effective_inputs?.resolved || {};
  const binding = evidence.resolution?.binding || {};
  return <div className="batch-workspace-effective">
    <div className={`batch-workspace-freshness is-${evidence.freshness}`}>
      <strong>{FRESHNESS_LABELS[evidence.freshness] || evidence.freshness}</strong>
      <small>Current calculation fingerprint {binding.calculation_fingerprint || "unavailable"}</small>
      <small>Current presentation fingerprint {binding.presentation_fingerprint || "unavailable"}</small>
    </div>
    <div className="batch-workspace-effective-grid">
      {["waste", "conv", "margin", "freight", "interest"].map(key => {
        const item = resolved[key] || {};
        return <div key={key}><span>{key}</span>
          <strong>{item.value == null ? "Unresolved" : shown(item.value)}</strong>
          <small>{item.source ? `source · ${item.source}` : "no authority source"}</small></div>;
      })}
    </div>
    <p>Governed resolution preview only. It does not persist a calculation. Supplier-credit terms are not Batch Calculate inputs.</p>
  </div>;
}

const PREPARATION_LABELS = {
  incomplete: "Preparation incomplete",
  source_changed: "Governed row changed · refresh local preview",
  preview_pending: "Local preview pending",
  specification_review: "Specification review required",
  local_review_ready: "Local preview reviewed",
};

function BatchPreparationSummary({ batch, localRows, localResults, effectiveByRow, busy, fixtureOnly,
  onRefreshReadiness, onCalculateAll, onSend }) {
  const preparation = durableBatchPreparation(batch, localRows, localResults, effectiveByRow);
  const actions = governedBatchActionState(batch, preparation.structuralBlockers, effectiveByRow);
  return <section className="batch-workspace-preparation" aria-labelledby="batch-workspace-preparation-title">
    <div className="batch-workspace-section-title">
      <div><h3 id="batch-workspace-preparation-title">Preparation and readiness</h3>
        <p>Durable structure, local preview and governed evidence are reported separately.</p></div>
      <span className={`batch-workspace-preparation-state is-${preparation.status}`}>
        {PREPARATION_LABELS[preparation.status]}
      </span>
    </div>
    <div className="batch-workspace-preparation-grid">
      <div><span>Durable rows</span><strong>{preparation.rowCount}</strong><small>active governed identities</small></div>
      <div><span>Delivery routes</span><strong>{preparation.completeRouteCount}/{preparation.routeCount}</strong><small>complete Bill-to + Ship-to</small></div>
      <div><span>Local previews</span><strong>{preparation.previewed}/{preparation.rowCount}</strong><small>not persisted calculations</small></div>
      <div><span>Governed inputs</span><strong>{preparation.resolved}/{preparation.rowCount}</strong><small>resolved on demand</small></div>
      <div><span>Specification review</span><strong>{preparation.specificationReview}</strong><small>BS/GSM checks needing review</small></div>
      <div><span>Send-current rows</span><strong>{actions.freshCount + actions.sendOnlyCount}/{actions.rowCount}</strong>
        <small>{actions.staleCount} stale · {actions.notCalculatedCount} not calculated · {actions.unverifiedCount} unchecked</small></div>
    </div>
    {preparation.structuralBlockers.length > 0 && <div className="batch-workspace-preparation-blockers">
      {preparation.structuralBlockers.map(item => <span key={item}>{item}</span>)}
    </div>}
    {actions.sendBlockers.length > 0 && <div className="batch-workspace-send-blockers">
      {actions.sendBlockers.map(item => <span key={item}>{item}</span>)}
    </div>}
    <div className="batch-workspace-governed-actions">
      <button type="button" onClick={onRefreshReadiness} disabled={busy || fixtureOnly || !actions.rowCount}>
        Check governed readiness
      </button>
      <button type="button" className="is-primary" onClick={onCalculateAll}
        disabled={busy || fixtureOnly || !actions.canCalculate}>Calculate all active rows</button>
      <button type="button" className="is-send" onClick={onSend}
        disabled={busy || fixtureOnly || !actions.canSend}>Atomic Send · create draft candidate</button>
    </div>
    <p className="batch-workspace-preparation-boundary">Calculate runs the trusted executor and the database writer as this caller.
      Atomic Send creates one immutable, unnumbered draft candidate; it does not submit or issue it to the customer.</p>
  </section>;
}

function RowSpecificationEvidence({ evidence }) {
  const { targets, gaps, status } = evidence;
  return <div className={`batch-workspace-spec-evidence is-${status}`}>
    <div><strong>{status === "not_evaluated" ? "Specification not evaluated"
      : status === "review" ? "Specification review required" : "Current BS/GSM preview is within tolerance"}</strong>
      <small>{status === "not_evaluated"
        ? "Run the local preview to compare calculation-supported targets."
        : gaps.length ? gaps.map(item => `${item.field}: ${item.pct > 0 ? "+" : ""}${item.pct}%`).join(" · ")
          : "No BS/GSM variance above the current 5% review threshold."}</small></div>
    <div className="batch-workspace-spec-targets">
      <span>BS <b>{shown(targets.bs)}</b></span><span>GSM <b>{shown(targets.gsm)}</b></span>
      <span>BCT <b>{shown(targets.bct)}</b></span><span>ECT <b>{shown(targets.ect)}</b></span>
    </div>
    <p>BCT and ECT are preserved specification references; the current preview engine does not evaluate their compliance.</p>
  </div>;
}

function Location({ role, locationId, location }) {
  return <div className="batch-workspace-location">
    <span>{role}</span>
    <strong>{location
      ? `${location.location_code || "No permanent code"} · #${location.id}`
      : locationId == null ? "Not selected" : `#${locationId} · details unavailable`}</strong>
    <small>{location ? `${location.status} Customer Location` : "No hidden identity inferred"}</small>
  </div>;
}

const optionLabel = (location, parties) => {
  const party = location.party || parties.find(item => String(item.id) === String(location.party_id));
  const locationLabel = location.location_code || `Location #${location.id}`;
  if (!party) return `${locationLabel} · owner unavailable`;
  return `${locationLabel} · ${party.display_name || "Unnamed Customer"}${party.customer_code ? ` · ${party.customer_code}` : ""}`;
};

function PricingGroupEditor({ group, disabled, onCancel, onSave }) {
  const [draft, setDraft] = useState(() => pricingGroupDraft(group));
  const validation = pricingGroupDraftValidation(draft);
  const set = (key, value) => setDraft(current => ({ ...current, [key]: value }));
  const isLegacyRestatement = group.legacy_freight_source === "legacy_batch"
    && ["manual", "ex_factory"].includes(draft.freightMode);

  return <form className="batch-workspace-group-editor" onSubmit={event => {
    event.preventDefault();
    if (validation.valid) onSave(pricingGroupUpdateBody(group, draft));
  }}>
    <div className="batch-workspace-group-editor-title">
      <strong>Edit commercial terms</strong>
      <small>Pricing Group #{group.id} · replaces version {group.content_version}</small>
    </div>
    <label>Pricing Group label
      <input value={draft.label} maxLength={120} disabled={disabled}
        onChange={event => set("label", event.target.value)} />
    </label>
    <label>Freight mode
      <select value={draft.freightMode} disabled={disabled}
        onChange={event => set("freightMode", event.target.value)}>
        {PRICING_GROUP_FREIGHT_MODES.map(option => <option key={option.value} value={option.value}>
          {option.label}
        </option>)}
      </select>
    </label>
    <label>Manual freight rate
      <input type="number" min="0" max="99999999.9999" step="0.0001" value={draft.freightManualValue}
        disabled={disabled || draft.freightMode !== "manual"}
        placeholder={draft.freightMode === "manual" ? "Required · zero is deliberate" : "Not used in this mode"}
        onChange={event => set("freightManualValue", event.target.value)} />
    </label>
    <label>Structured Payment Terms
      <select value={draft.paymentTermsDays} disabled={disabled}
        onChange={event => set("paymentTermsDays", event.target.value)}>
        <option value="">Unresolved · governed fallback applies</option>
        {PRICING_GROUP_PAYMENT_DAYS.map(days => <option key={days} value={days}>{days} days</option>)}
      </select>
    </label>
    <label className="is-wide">Payment Terms wording · descriptive only
      <input value={draft.paymentTermsText} maxLength={500} disabled={disabled}
        placeholder="Optional wording; never calculates"
        onChange={event => set("paymentTermsText", event.target.value)} />
    </label>
    <label>Interest override %
      <input type="number" min="0" max="9999.999" step="0.001" value={draft.interestOverridePct}
        disabled={disabled} placeholder="Blank inherits · zero is deliberate"
        onChange={event => set("interestOverridePct", event.target.value)} />
    </label>
    <label className="is-wide">Interest override reason
      <input value={draft.interestOverrideReason} maxLength={500}
        disabled={disabled || draft.interestOverridePct === ""}
        placeholder="Required when the override differs from derived Interest"
        onChange={event => set("interestOverrideReason", event.target.value)} />
    </label>
    {isLegacyRestatement && <div className="batch-workspace-warning is-wide">
      Saving this explicit governed freight statement retires the temporary legacy Batch freight in the same write.
    </div>}
    {!validation.valid && <div className="batch-workspace-group-editor-errors is-wide">
      {validation.errors.map(error => <span key={error}>{error}</span>)}
    </div>}
    <div className="batch-workspace-group-editor-actions is-wide">
      <button type="button" onClick={onCancel}>Cancel</button>
      <button type="submit" className="is-primary" disabled={disabled || !validation.valid}>Save commercial terms</button>
    </div>
  </form>;
}

function PricingGroupCreator({ disabled, onCancel, onSave }) {
  const [label, setLabel] = useState("");
  const validation = pricingGroupCreateValidation(label);
  return <form className="batch-workspace-group-creator" onSubmit={event => {
    event.preventDefault();
    if (validation.valid) onSave(pricingGroupCreateBody(label));
  }}>
    <div><strong>Add Pricing Group</strong>
      <small>Use a separate group only for a genuinely different price schedule.</small></div>
    <label>Pricing Group label
      <input value={label} maxLength={120} disabled={disabled}
        placeholder="Optional label" onChange={event => setLabel(event.target.value)} />
    </label>
    {validation.error && <span className="batch-workspace-warning">{validation.error}</span>}
    <div><button type="button" onClick={onCancel}>Cancel</button>
      <button type="submit" className="is-primary" disabled={disabled || !validation.valid}>
        Add Pricing Group
      </button></div>
  </form>;
}

function DeliveryRouteEditor({ group, route, locations, parties, loading, disabled, fixtureOnly,
  onCancel, onSave }) {
  const [label, setLabel] = useState(route?.label || "");
  const [billTo, setBillTo] = useState(route?.bill_to_location_id == null ? "" : String(route.bill_to_location_id));
  const [shipTo, setShipTo] = useState(route?.ship_to_location_id == null ? "" : String(route.ship_to_location_id));
  const billToOptions = locations.filter(item => item.status === "active" && item.bill_to_eligible === true);
  const shipToOptions = locations.filter(item => item.status === "active" && item.ship_to_eligible === true);
  const complete = billTo && shipTo && label.trim().length <= 120;

  return <form className="batch-workspace-delivery-editor" onSubmit={event => {
    event.preventDefault();
    if (!complete) return;
    const identity = value => fixtureOnly ? value : Number(value);
    onSave({
      pricing_group_id: group.id,
      label: label.trim(),
      bill_to_location_id: identity(billTo),
      ship_to_location_id: identity(shipTo),
    });
  }}>
    <div className="batch-workspace-delivery-editor-title">
      <strong>{route ? "Edit delivery route" : "Add delivery route"}</strong>
      <small>{route ? `Delivery Group #${route.id}` : `New route in Pricing Group #${group.id}`}</small>
    </div>
    <label>Route label
      <input value={label} maxLength={120} onChange={event => setLabel(event.target.value)}
        placeholder="e.g. Location 2 delivery" disabled={disabled} />
    </label>
    <label>Bill-to Location
      <select value={billTo} onChange={event => setBillTo(event.target.value)} disabled={disabled || loading}>
        <option value="">{loading ? "Loading Locations…" : "Select Bill-to"}</option>
        {billToOptions.map(location => <option key={location.id} value={location.id}>
          {optionLabel(location, parties)}
        </option>)}
      </select>
    </label>
    <label>Ship-to Location
      <select value={shipTo} onChange={event => setShipTo(event.target.value)} disabled={disabled || loading}>
        <option value="">{loading ? "Loading Locations…" : "Select Ship-to"}</option>
        {shipToOptions.map(location => <option key={location.id} value={location.id}>
          {optionLabel(location, parties)}
        </option>)}
      </select>
    </label>
    <div className="batch-workspace-delivery-editor-actions">
      <button type="button" onClick={onCancel}>Cancel</button>
      <button type="submit" className="is-primary" disabled={disabled || loading || !complete}>
        {route ? "Save route" : "Add Location route"}
      </button>
    </div>
  </form>;
}

const ROW_OVERRIDE_FIELDS = [
  ["waste_override_pct", "Waste override %"],
  ["conv_override_rate", "Conversion override"],
  ["margin_override_pct", "Margin override %"],
  ["freight_override", "Freight override"],
];

const ROW_ADDON_FIELDS = [
  ["addon_printing", "Printing charge"],
  ["addon_stitching", "Stitching charge"],
  ["addon_coating", "Coating charge"],
  ["addon_handling", "Handling charge"],
  ["addon_moq_charge", "MOQ charge"],
  ["addon_packing", "Packing charge"],
  ["addon_other", "Other charge"],
  ["addon_unloading", "Unloading charge"],
];

const ROW_NUMERIC_FIELDS = [...ROW_OVERRIDE_FIELDS, ...ROW_ADDON_FIELDS,
  ["fluting_bcf", "Fluting BCF"]];

function BatchRowEditor({ row, groups, skus, constructionOptions, batch, loading, disabled,
  fixtureOnly, initialGroupId, onCancel, onSave, onProposeSku }) {
  const activeGroups = groups.filter(group => group.status === "active");
  const currentGroupIsActive = activeGroups.some(group =>
    String(group.id) === String(row?.pricing_group_id));
  const requestedGroup = activeGroups.find(group => String(group.id) === String(initialGroupId));
  const [skuId, setSkuId] = useState(row?.sku_id == null ? "" : String(row.sku_id));
  const [skuQuery, setSkuQuery] = useState("");
  const [proposingSku, setProposingSku] = useState(false);
  const [proposalError, setProposalError] = useState("");
  const [proposal, setProposal] = useState({ item_name: "", construction_version_id: "",
    length_mm: "", width_mm: "", height_mm: "", box_type: "RSC", ups: "1" });
  const [versionId, setVersionId] = useState(row?.sku_version_id == null ? "" : String(row.sku_version_id));
  const [groupId, setGroupId] = useState(row?.pricing_group_id != null && currentGroupIsActive
    ? String(row.pricing_group_id) : String(requestedGroup?.id || activeGroups[0]?.id || ""));
  const [rowType, setRowType] = useState(row?.row_type || "box");
  const [materialCode, setMaterialCode] = useState(row?.material_code || "");
  const [numericValues, setNumericValues] = useState(() => Object.fromEntries(
    ROW_NUMERIC_FIELDS
      .map(([key]) => [key, row?.[key] == null ? "" : String(row[key])])));
  const selection = durableRowSelection(skus, skuId, versionId);
  const filteredSkus = batchSkuChoices(skus, skuQuery);
  const proposalReady = Boolean(batch?.customer_party_id && batch?.plant?.plant_code
    && proposal.item_name.trim() && proposal.construction_version_id
    && ["length_mm", "width_mm", "height_mm", "ups"].every(key => Number(proposal[key]) > 0));
  const submitProposal = async () => {
    if (!proposalReady || disabled) return;
    setProposalError("");
    const result = await onProposeSku(proposal);
    if (!result?.versions?.[0]) {
      setProposalError("The proposed SKU was not returned as an eligible Batch-row choice. Check its Construction adoption and your read access.");
      return;
    }
    setSkuId(String(result.id));
    setVersionId(String(result.versions[0].id));
    setSkuQuery("");
    setProposingSku(false);
  };
  const versions = selection.sku?.versions || [];
  const complete = skuId && versionId && groupId && rowType;
  const identity = value => fixtureOnly ? value : Number(value);

  return <form className="batch-workspace-row-editor" onSubmit={event => {
    event.preventDefault();
    if (!complete) return;
    onSave({
      pricing_group_id: identity(groupId),
      sku_id: identity(skuId),
      sku_version_id: identity(versionId),
      row_type: rowType,
      material_code: materialCode.trim() || null,
      ...Object.fromEntries(Object.entries(numericValues).map(([key, value]) =>
        [key, value === "" ? null : Number(value)])),
      ...(row ? { expected_content_version: row.content_version } : {}),
    });
  }}>
    <div className="batch-workspace-row-editor-title">
      <strong>{row ? "Revise durable row" : "Add durable row"}</strong>
      <small>{row ? `Row #${row.id} · lineage #${row.lineage_id}`
        : "Exact governed identities; labels are never parsed"}</small>
    </div>
    {!row && <label>Find established SKU
      <input type="search" value={skuQuery} disabled={disabled || loading}
        onChange={event => setSkuQuery(event.target.value)}
        placeholder="Plant Item Code, Customer reference or description" />
      <small>Caller-visible recent use is shown first. Select an exact SKU and Version.</small>
    </label>}
    <label>Customer SKU
      <select value={skuId} disabled={disabled || loading || Boolean(row)} onChange={event => {
        setSkuId(event.target.value);
        setSkuQuery("");
        const nextSku = skus.find(item => String(item.id) === event.target.value);
        setVersionId(nextSku?.versions?.[0] ? String(nextSku.versions[0].id) : "");
      }}>
        <option value="">{loading ? "Loading governed SKUs…" : "Select established SKU"}</option>
        {filteredSkus.map(sku => <option key={sku.id} value={sku.id}>
          {sku.customer?.display_name || `Customer #${sku.party_id}`} · {sku.plant_item_code || `SKU #${sku.id}`} · {sku.versions?.[0]?.item_name || "No item name"} · {sku.status}{sku.last_used_at ? " · used recently" : ""}
        </option>)}
      </select>
      {!filteredSkus.length && <small>No matching eligible SKU. Create a proposed SKU below if this is a new item.</small>}
    </label>
    {!row && <div className="batch-workspace-sku-proposal">
      <button type="button" onClick={() => setProposingSku(value => !value)} disabled={disabled}>
        {proposingSku ? "Close proposed SKU" : "+ Create proposed SKU"}</button>
      {proposingSku && <div className="batch-workspace-sku-proposal-fields">
        <strong>New item for {batch?.customer_party?.display_name || "the selected Customer"}</strong>
        {!batch?.customer_party_id && <small>This legacy Batch has no exact selected Customer. Start a new customer quote before proposing its SKU.</small>}
        <label>Item name<input value={proposal.item_name} maxLength={200}
          onChange={event => setProposal(current => ({ ...current, item_name: event.target.value }))} /></label>
        <label>Adopted Construction Version
          <select value={proposal.construction_version_id} onChange={event => setProposal(current => ({
            ...current, construction_version_id: event.target.value }))}>
            <option value="">Choose adopted Construction</option>
            {(constructionOptions || []).map(option => <option key={option.id} value={option.id}>
              {option.construction?.construction_code || `Construction #${option.construction_id}`} · v{option.version_no}
            </option>)}
          </select>
        </label>
        {[["length_mm", "Length mm"], ["width_mm", "Width mm"], ["height_mm", "Height mm"]].map(([key,label]) =>
          <label key={key}>{label}<input type="number" min="0.001" step="0.001" value={proposal[key]}
            onChange={event => setProposal(current => ({ ...current, [key]: event.target.value }))} /></label>)}
        <label>Box type<select value={proposal.box_type} onChange={event => setProposal(current => ({
          ...current, box_type: event.target.value }))}>
          {["RSC", "Die-R", "Die-S", "HRSC-L", "HRSC-R", "HRSC-O", "Board", "PP", "Custom"]
            .map(type => <option key={type} value={type}>{type}</option>)}
        </select></label>
        <label>Ups<input type="number" min="1" step="1" value={proposal.ups}
          onChange={event => setProposal(current => ({ ...current, ups: event.target.value }))} /></label>
        <small>Creates one proposed SKU with Version 1. It is quotable but not published; calculation and Send keep their existing governed checks.</small>
        {proposalError && <div role="alert">{proposalError}</div>}
        <button type="button" onClick={submitProposal} disabled={disabled || !proposalReady}>
          Create and select proposed SKU</button>
      </div>}
    </div>}
    <label>SKU Version · Construction
      <select value={versionId} disabled={disabled || loading} onChange={event => setVersionId(event.target.value)}>
        <option value="">Select SKU version</option>
        {/* Amendment 04 D-01: an unapproved version is quotable, as a Prospect is - labelled, never hidden. */}
        {versions.map(version => <option key={version.id} value={version.id}>
          v{version.version_no} · #{version.id} · {version.construction?.construction_code || `Construction #${version.construction_version_id}`} · Cv#{version.construction_version_id}{version.approved === false ? " · unapproved" : ""}
        </option>)}
      </select>
    </label>
    <label>Pricing Group
      <select value={groupId} disabled={disabled} onChange={event => setGroupId(event.target.value)}>
        {activeGroups.map(group => <option key={group.id} value={group.id}>
          {group.label || "Unnamed"} · #{group.id}
        </option>)}
      </select>
    </label>
    {row && !currentGroupIsActive && <div className="batch-workspace-warning">
      The prior Pricing Group is removed or unavailable. Saving will explicitly reassign this row to the selected active group.
    </div>}
    <label>Row type
      <select value={rowType} disabled={disabled} onChange={event => setRowType(event.target.value)}>
        {DURABLE_ROW_TYPES.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
    <label>Material code
      <input value={materialCode} maxLength={160} disabled={disabled}
        onChange={event => setMaterialCode(event.target.value)} placeholder="Optional Batch-row code" />
    </label>
    {ROW_OVERRIDE_FIELDS.map(([key, label]) => <label key={key}>{label}
      <input type="number" min="0" step="0.001" value={numericValues[key]} disabled={disabled}
        placeholder="Blank · inherit" onChange={event => setNumericValues(current => ({
          ...current, [key]: event.target.value,
        }))} />
    </label>)}
    <div className="batch-workspace-row-override-note">
      Row override → Batch Profile → Sector Version → Calculation Default. Blank continues the ladder; zero stops it.
    </div>
    {ROW_ADDON_FIELDS.map(([key, label]) => <label key={key}>{label}
      <input type="number" min="0" step="0.0001" value={numericValues[key]} disabled={disabled}
        placeholder="Blank · not entered" onChange={event => setNumericValues(current => ({
          ...current, [key]: event.target.value,
        }))} />
    </label>)}
    <div className="batch-workspace-row-override-note">
      Add-on charges have no inheritance: blank means not entered; zero records a deliberate no-charge decision.
    </div>
    <label>Fluting BCF
      <input type="number" min="0" max="0.3" step="0.0001" value={numericValues.fluting_bcf}
        disabled={disabled} placeholder="Blank · inherit default"
        onChange={event => setNumericValues(current => ({ ...current, fluting_bcf: event.target.value }))} />
    </label>
    {selection.version && <div className="batch-workspace-row-version-evidence">
      <strong>{selection.version.construction?.name || "Construction details unavailable"}</strong>
      <small>SKU #{selection.sku.id} · Version #{selection.version.id} · Construction Version #{selection.version.construction_version_id}</small>
      <span>{selection.version.length_mm ?? "—"} × {selection.version.width_mm ?? "—"} × {selection.version.height_mm ?? "—"} mm · {selection.version.box_type} · {selection.version.ups} up</span>
    </div>}
    <div className="batch-workspace-row-editor-actions">
      <button type="button" onClick={onCancel}>Cancel</button>
      <button type="submit" className="is-primary" disabled={disabled || loading || !complete}>
        {row ? "Save row" : "Add governed row"}
      </button>
    </div>
  </form>;
}

const PROFILE_FIELDS = [
  ["conv_box_rate", "Box conversion"], ["waste_cbb_pct", "Box waste %"],
  ["margin_box_pct", "Box margin %"], ["conv_pp_rate", "PP conversion"],
  ["waste_pp_pct", "PP waste %"], ["margin_pp_pct", "PP margin %"],
];

function ProfileEditor({ profile, contentVersion, disabled, onCancel, onSave }) {
  const [values, setValues] = useState(() => Object.fromEntries(PROFILE_FIELDS.map(([key]) =>
    [key, profile?.[key] == null ? "" : String(profile[key])])));
  return <form className="batch-workspace-profile-editor" onSubmit={event => {
    event.preventDefault();
    onSave({ expected_content_version: contentVersion,
      ...Object.fromEntries(PROFILE_FIELDS.map(([key]) => [key, values[key] === "" ? null : Number(values[key])])) });
  }}>
    {PROFILE_FIELDS.map(([key, label]) => <label key={key}>{label}
      <input type="number" min="0" step="0.001" value={values[key]} disabled={disabled}
        placeholder="Blank · inherit" onChange={event => setValues(current => ({ ...current, [key]: event.target.value }))} />
    </label>)}
    <div className="batch-workspace-profile-editor-actions">
      <span>Blank inherits; 0 is an explicit override.</span>
      <button type="button" onClick={onCancel}>Cancel</button>
      <button type="submit" className="is-primary" disabled={disabled}>Create profile revision</button>
    </div>
  </form>;
}

function SetCreator({ rows, disabled, initialBoxRowId, onCancel, onSave }) {
  const boxes = rows.filter(row => row.status === "active" && row.row_type === "box");
  const requestedBox = boxes.find(row => String(row.id) === String(initialBoxRowId));
  const [boxRowId, setBoxRowId] = useState(requestedBox ? String(requestedBox.id)
    : boxes[0] ? String(boxes[0].id) : "");
  const [setCode, setSetCode] = useState("");
  return <form className="batch-workspace-set-editor" onSubmit={event => {
    event.preventDefault();
    if (boxRowId && setCode.trim()) onSave({ box_row_id: boxRowId, set_code: setCode.trim() });
  }}>
    <label>Box parent
      <select value={boxRowId} onChange={event => setBoxRowId(event.target.value)} disabled={disabled}>
        <option value="">Select active Box row</option>
        {boxes.map(row => <option key={row.id} value={row.id}>Row #{row.id} · {row.material_code || "unnamed Box"}</option>)}
      </select>
    </label>
    <label>SET code
      <input value={setCode} maxLength={80} disabled={disabled}
        onChange={event => setSetCode(event.target.value)} placeholder="e.g. SET-01" />
    </label>
    <div><button type="button" onClick={onCancel}>Cancel</button>
      <button type="submit" className="is-primary" disabled={disabled || !boxRowId || !setCode.trim()}>Start SET</button></div>
  </form>;
}

function MembershipCreator({ setItem, rows, disabled, initialRowId, onCancel, onSave }) {
  const used = new Set((setItem.memberships || []).filter(item => item.status === "active").map(item => String(item.row_id)));
  const components = rows.filter(row => row.status === "active" && row.row_type !== "box" && !used.has(String(row.id)));
  const requestedRow = components.find(row => String(row.id) === String(initialRowId));
  const initialRow = requestedRow || components[0];
  const [rowId, setRowId] = useState(initialRow ? String(initialRow.id) : "");
  const [role, setRole] = useState(initialRow?.row_type === "plate" ? "plate" : "other");
  return <form className="batch-workspace-set-editor" onSubmit={event => {
    event.preventDefault();
    if (rowId) onSave({ row_id: rowId, role });
  }}>
    <label>Component row
      <select value={rowId} onChange={event => setRowId(event.target.value)} disabled={disabled}>
        <option value="">Select active non-Box row</option>
        {components.map(row => <option key={row.id} value={row.id}>Row #{row.id} · {row.material_code || row.row_type}</option>)}
      </select>
    </label>
    <label>SET role
      <select value={role} onChange={event => setRole(event.target.value)} disabled={disabled}>
        <option value="plate">Plate</option><option value="partition">Partition</option><option value="other">Other</option>
      </select>
    </label>
    <div><button type="button" onClick={onCancel}>Cancel</button>
      <button type="submit" className="is-primary" disabled={disabled || !rowId}>Attach component</button></div>
  </form>;
}

export default function BatchWorkspacePanel({ batchId, fixtureOnly = false, fixtureWorkspace,
  initialDeliveryAction, showToast, onBatchChange, onClose }) {
  const { batchResults, batchRows: localRows, invalidateBatchRow, loadBatchRowIntoCosting,
    setBatchProfile, setBatchRows: setLocalRows, setBatchWorkspaceRequest, setQuoteView,
    setQuoteWorkspaceRequest, setTab } = useAppState();
  const [state, setState] = useState(() => fixtureOnly
    ? { status: "ready", batch: fixtureWorkspace, message: "Fixture-only workspace illustration." }
    : { status: "loading", batch: null, message: "Loading the caller-visible durable Batch…" });
  const requestedDeliveryEditor = useMemo(() => initialDeliveryAction?.pricingGroupId != null
    && ["create", "edit"].includes(initialDeliveryAction.mode)
    ? { groupId: initialDeliveryAction.pricingGroupId,
      routeId: initialDeliveryAction.mode === "edit" ? initialDeliveryAction.deliveryGroupId : null }
    : null, [initialDeliveryAction]);
  const requestedRowEditor = useMemo(() => {
    if (initialDeliveryAction?.mode === "row-create") return {
      id: "new", groupId: initialDeliveryAction.pricingGroupId ?? null,
    };
    if (initialDeliveryAction?.mode === "row-edit" && initialDeliveryAction.rowId != null) return {
      id: initialDeliveryAction.rowId, groupId: initialDeliveryAction.pricingGroupId ?? null,
    };
    return null;
  }, [initialDeliveryAction]);
  const requestedSetEditor = useMemo(() => {
    if (initialDeliveryAction?.mode === "set-create") return {
      kind: "new", boxRowId: initialDeliveryAction.rowId ?? null,
    };
    if (initialDeliveryAction?.mode === "set-member" && initialDeliveryAction.setId != null) return {
      kind: "member", setId: initialDeliveryAction.setId, rowId: initialDeliveryAction.rowId ?? null,
    };
    return null;
  }, [initialDeliveryAction]);
  const requestedRowStatus = useMemo(() => initialDeliveryAction?.mode === "row-status"
    && initialDeliveryAction.rowId != null && ["active", "removed"].includes(initialDeliveryAction.rowStatus)
    ? { rowId: initialDeliveryAction.rowId, status: initialDeliveryAction.rowStatus }
    : null, [initialDeliveryAction]);
  const [catalogue, setCatalogue] = useState(() => fixtureOnly
    ? { status: "ready", locations: fixtureWorkspace?.available_locations || [], parties: [] }
    : { status: requestedDeliveryEditor ? "loading" : "idle", locations: [], parties: [] });
  const [editing, setEditing] = useState(requestedDeliveryEditor);
  const [groupEditing, setGroupEditing] = useState(null);
  const [groupCreating, setGroupCreating] = useState(false);
  const [rowEditing, setRowEditing] = useState(requestedRowEditor?.id ?? null);
  const [rowCreateSerial, setRowCreateSerial] = useState(0);
  const [profileEditing, setProfileEditing] = useState(false);
  const [setEditor, setSetEditor] = useState(requestedSetEditor);
  const [pendingRowStatus, setPendingRowStatus] = useState(requestedRowStatus);
  const [rowCatalogue, setRowCatalogue] = useState(() => fixtureOnly
    ? { status: "ready", skus: fixtureWorkspace?.available_skus || [],
      constructionOptions: fixtureWorkspace?.available_constructions || (fixtureWorkspace?.available_skus || []).flatMap(sku =>
        (sku.versions || []).map(version => ({ id: version.construction_version_id,
          construction_id: version.construction?.id, version_no: version.construction_version?.version_no || 1,
          construction: version.construction }))) }
    : { status: requestedRowEditor ? "loading" : "idle", skus: [], constructionOptions: [] });
  const [busy, setBusy] = useState(false);
  const [effectiveByRow, setEffectiveByRow] = useState({});
  const [sentRevisionId, setSentRevisionId] = useState(null);

  const acceptBatch = (next, message) => {
    setState({ status: "ready", batch: next, message });
    onBatchChange?.(next);
  };

  useEffect(() => {
    if (fixtureOnly) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const response = await apiFetch(`/batches/${batchId}/workspace`);
        const data = await response.json().catch(() => ({}));
        const outcome = classifyResponse({ ok: response.ok, status: response.status, data });
        if (cancelled) return;
        if (outcome.kind === "ok" && data.batch) {
          setState({ status: "ready", batch: data.batch,
            message: "Caller-visible durable state loaded." });
          onBatchChange?.(data.batch);
        } else {
          setState({ status: outcome.kind === "access-denied" ? "denied" : "error",
            batch: null, message: outcome.message || "The Batch workspace could not be loaded." });
        }
      } catch {
        if (!cancelled) setState({ status: "error", batch: null,
          message: "The Batch workspace service could not be reached. No fixture was substituted." });
      }
    })();
    return () => { cancelled = true; };
  }, [batchId, fixtureOnly, onBatchChange]);

  const batch = state.batch;
  const profile = batch?.current_profile;
  const groups = batch?.pricing_groups || [];
  const durableRows = batch?.batch_rows || [];
  const batchSets = batch?.batch_sets || [];
  const lock = batch?.edit_lock;
  const reclaimRequest = ownerStaleLockReclaimRequest(batch);

  const loadRowCatalogue = async () => {
    if (fixtureOnly || rowCatalogue.status === "ready" || rowCatalogue.status === "loading") return;
    setRowCatalogue({ status: "loading", skus: [], constructionOptions: [] });
    try {
      const response = await apiFetch(`/batches/${batch.id}/row-options`);
      const data = await response.json().catch(() => ({}));
      const outcome = classifyResponse({ ok: response.ok, status: response.status, data });
      if (outcome.kind === "ok") {
        setRowCatalogue({ status: "ready", skus: data.skus || [],
          constructionOptions: data.construction_options || [] });
      } else {
        setRowCatalogue({ status: outcome.kind === "access-denied" ? "denied" : "error",
          skus: [], constructionOptions: [], message: outcome.message || "Governed SKU options are unavailable." });
      }
    } catch {
      setRowCatalogue({ status: "error", skus: [], constructionOptions: [],
        message: "Governed SKU options could not be loaded. No fixture was substituted." });
    }
  };

  const openRowEditor = async row => {
    setRowEditing(row ? row.id : "new");
    await loadRowCatalogue();
  };

  const loadEffectiveInputs = async row => {
    setEffectiveByRow(current => ({ ...current, [row.id]: {
      status: "loading", message: "Resolving governed effective inputs…",
    } }));
    if (fixtureOnly) {
      setEffectiveByRow(current => ({ ...current, [row.id]: row.fixture_effective || {
        status: "not-ready", message: "FIXTURE ONLY · governed resolution is unavailable for this row.",
      } }));
      return;
    }
    try {
      const response = await apiFetch(`/batches/${batch.id}/rows/${row.id}/effective-inputs`);
      const data = await response.json().catch(() => ({}));
      const outcome = classifyResponse({ ok: response.ok, status: response.status, data });
      if (outcome.kind === "ok") {
        const evidence = {
          status: "ready", resolution: data.resolution, calculation: data.calculation,
          freshness: data.freshness,
        };
        setEffectiveByRow(current => ({ ...current, [row.id]: evidence }));
        return evidence;
      } else {
        setEffectiveByRow(current => ({ ...current, [row.id]: {
          status: response.status === 422 ? "not-ready"
            : outcome.kind === "access-denied" ? "denied" : "error",
          message: outcome.message || data.error || "Governed effective inputs are unavailable.",
        } }));
        return null;
      }
    } catch {
      setEffectiveByRow(current => ({ ...current, [row.id]: {
        status: "error", message: "Effective-input service could not be reached. No values were inferred.",
      } }));
      return null;
    }
  };

  const calculateRow = async (row, { announce = true } = {}) => {
    const data = await runMutation(`/batches/${batch.id}/rows/${row.id}/calculate`, {}, {
      showToast, successMessage: announce ? `Governed calculation persisted for row #${row.id}` : undefined,
    });
    if (!data?.batch_calculation_id) return false;
    await loadEffectiveInputs(row);
    return true;
  };

  const calculateOne = async row => {
    setBusy(true);
    await calculateRow(row);
    setBusy(false);
  };

  const refreshGovernedReadiness = async () => {
    setBusy(true);
    const activeRows = durableRows.filter(row => row.status === "active");
    let checked = 0;
    for (const row of activeRows) {
      if (await loadEffectiveInputs(row)) checked += 1;
    }
    setBusy(false);
    if (checked === activeRows.length) {
      showToast?.("Governed calculation freshness checked for every active row.", "success", 5000);
    } else {
      showToast?.(`Governed readiness could be checked for ${checked}/${activeRows.length} active rows. Unresolved rows remain blocked.`,
        "error", 8500);
    }
  };

  const calculateAll = async () => {
    setBusy(true);
    const activeRows = durableRows.filter(row => row.status === "active");
    let completed = 0;
    for (const row of activeRows) {
      if (!await calculateRow(row, { announce: false })) break;
      completed += 1;
    }
    setBusy(false);
    if (completed === activeRows.length) {
      showToast?.(`Governed calculations persisted for ${completed} active row${completed === 1 ? "" : "s"}.`,
        "success", 6500);
    } else if (completed > 0) {
      showToast?.(`${completed} row${completed === 1 ? "" : "s"} calculated before the next row was refused. Readiness has been refreshed for completed rows.`,
        "error", 9000);
    }
  };

  const atomicSend = async () => {
    setBusy(true);
    const data = await runMutation(`/batches/${batch.id}/send`, {
      expected_content_version: batch.content_version,
    }, { showToast, successMessage: "Immutable draft Quote candidate created" });
    if (data?.revision_id) {
      setSentRevisionId(data.revision_id);
      try {
        const response = await apiFetch(`/batches/${batch.id}/workspace`);
        const refreshed = await response.json().catch(() => ({}));
        if (response.ok && refreshed.batch) {
          acceptBatch(refreshed.batch,
            `Atomic Send created draft candidate revision #${data.revision_id}; current Batch state was read back.`);
        } else {
          setState(current => ({ ...current,
            message: `Draft candidate revision #${data.revision_id} was created. Refresh the Batch before another action.` }));
        }
      } catch {
        setState(current => ({ ...current,
          message: `Draft candidate revision #${data.revision_id} was created. Its Batch read-back is unavailable; refresh before another action.` }));
      }
    }
    setBusy(false);
  };

  const openSentQuote = () => {
    if (sentRevisionId == null) return;
    setQuoteWorkspaceRequest({
      revisionId: sentRevisionId,
      requestId: `atomic-send-${batch.id}-${sentRevisionId}-${Date.now()}`,
    });
    setQuoteView("history");
    setTab("items");
    onClose?.();
  };

  const openLinkedQuote = () => {
    if (fixtureOnly || batch?.id == null) return;
    setQuoteWorkspaceRequest({
      batchId: batch.id,
      requestId: `batch-workspace-${batch.id}-${Date.now()}`,
    });
    setQuoteView("history");
    setTab("items");
    onClose?.();
  };

  const openEditor = async (group, route = null) => {
    setEditing({ groupId: group.id, routeId: route?.id ?? null });
    if (fixtureOnly || catalogue.status === "ready" || catalogue.status === "loading") return;
    setCatalogue({ status: "loading", locations: [], parties: [] });
    try {
      const response = await apiFetch("/masters/customer-families");
      const data = await response.json().catch(() => ({}));
      const outcome = classifyResponse({ ok: response.ok, status: response.status, data });
      if (outcome.kind === "ok") {
        setCatalogue({ status: "ready", locations: data.locations || [], parties: data.parties || [] });
      } else {
        setCatalogue({ status: outcome.kind === "access-denied" ? "denied" : "error",
          locations: [], parties: [], message: outcome.message || "Customer Locations are unavailable." });
      }
    } catch {
      setCatalogue({ status: "error", locations: [], parties: [],
        message: "Customer Locations could not be loaded. No fixture was substituted." });
    }
  };

  useEffect(() => {
    if (!initialDeliveryAction || state.status !== "ready") return undefined;
    const targetId = initialDeliveryAction.mode?.startsWith("row-")
      ? initialDeliveryAction.rowId != null
        ? `batch-workspace-row-${initialDeliveryAction.rowId}` : "batch-workspace-rows-title"
      : initialDeliveryAction.mode?.startsWith("set-")
        ? initialDeliveryAction.setId != null
          ? `batch-workspace-set-${initialDeliveryAction.setId}` : "batch-workspace-sets-title"
        : initialDeliveryAction.pricingGroupId != null
          ? `batch-workspace-pricing-group-${initialDeliveryAction.pricingGroupId}`
          : "batch-workspace-groups-title";
    const frame = window.requestAnimationFrame(() => {
      const target = document.getElementById(targetId);
      target?.scrollIntoView({ block: "center" });
      target?.focus?.({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [initialDeliveryAction, state.status]);

  useEffect(() => {
    if (!requestedDeliveryEditor || fixtureOnly) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const response = await apiFetch("/masters/customer-families");
        const data = await response.json().catch(() => ({}));
        const outcome = classifyResponse({ ok: response.ok, status: response.status, data });
        if (cancelled) return;
        if (outcome.kind === "ok") {
          setCatalogue({ status: "ready", locations: data.locations || [], parties: data.parties || [] });
        } else {
          setCatalogue({ status: outcome.kind === "access-denied" ? "denied" : "error",
            locations: [], parties: [], message: outcome.message || "Customer Locations are unavailable." });
        }
      } catch {
        if (!cancelled) setCatalogue({ status: "error", locations: [], parties: [],
          message: "Customer Locations could not be loaded. No fixture was substituted." });
      }
    })();
    return () => { cancelled = true; };
  }, [fixtureOnly, initialDeliveryAction, requestedDeliveryEditor]);

  useEffect(() => {
    if (!requestedRowEditor || fixtureOnly) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const response = await apiFetch(`/batches/${batchId}/row-options`);
        const data = await response.json().catch(() => ({}));
        const outcome = classifyResponse({ ok: response.ok, status: response.status, data });
        if (cancelled) return;
        if (outcome.kind === "ok") {
          setRowCatalogue({ status: "ready", skus: data.skus || [],
            constructionOptions: data.construction_options || [] });
        } else {
          setRowCatalogue({ status: outcome.kind === "access-denied" ? "denied" : "error",
            skus: [], constructionOptions: [], message: outcome.message || "Governed SKU options are unavailable." });
        }
      } catch {
        if (!cancelled) setRowCatalogue({ status: "error", skus: [], constructionOptions: [],
          message: "Governed SKU options could not be loaded. No fixture was substituted." });
      }
    })();
    return () => { cancelled = true; };
  }, [batchId, fixtureOnly, requestedRowEditor]);

  const fixtureMutation = (kind, groupId, routeId, body) => {
    const next = structuredClone(batch);
    if (kind === "createGroup") {
      const ordinal = next.pricing_groups.length + 1;
      next.pricing_groups.push({
        id: `fixture-pg-930${ordinal}`, batch_id: next.id,
        label: body.label || `Price ${ordinal}`, status: "active", content_version: 1,
        freight_mode: "master", freight_basis_delivery_group_id: null,
        freight_manual_value: null, payment_terms_days: null, payment_terms_text: null,
        interest_override_pct: null, interest_override_derived_pct: null,
        interest_override_reason: null, interest_override_by: null, interest_override_at: null,
        legacy_freight_value: null, legacy_freight_source: null, delivery_groups: [],
      });
    } else {
      const group = next.pricing_groups.find(item => String(item.id) === String(groupId));
      if (kind === "create") {
        const ordinal = group.delivery_groups.length + 1;
        group.delivery_groups.push({
          id: `fixture-dg-930${ordinal}`,
          label: body.label || `Location ${ordinal}`,
          status: "active",
          bill_to_location_id: body.bill_to_location_id,
          ship_to_location_id: body.ship_to_location_id,
          bill_to_location: catalogue.locations.find(item => String(item.id) === String(body.bill_to_location_id)),
          ship_to_location: catalogue.locations.find(item => String(item.id) === String(body.ship_to_location_id)),
        });
      } else if (kind === "update") {
        const route = group.delivery_groups.find(item => String(item.id) === String(routeId));
        Object.assign(route, body, {
          bill_to_location: catalogue.locations.find(item => String(item.id) === String(body.bill_to_location_id)),
          ship_to_location: catalogue.locations.find(item => String(item.id) === String(body.ship_to_location_id)),
        });
      } else if (kind === "basis") {
        group.freight_basis_delivery_group_id = routeId;
        group.content_version += 1;
      } else if (kind === "groupStatus") {
        group.status = body.status;
        group.content_version += 1;
      } else if (kind === "deliveryStatus") {
        const route = group.delivery_groups.find(item => String(item.id) === String(routeId));
        route.status = body.status;
      } else {
        Object.assign(group, applyFixturePricingGroupUpdate(group, body));
      }
    }
    const pricingChange = ["group", "createGroup", "groupStatus"].includes(kind);
    const message = pricingChange
      ? "Fixture-only Pricing Group structure changed in memory; no governed record was written."
      : "Fixture-only delivery structure updated in memory; no governed record was written.";
    acceptBatch(next, message);
    showToast?.(pricingChange ? "Fixture-only Pricing Group change saved in memory."
      : "Fixture-only change saved in memory.", "success", 4500);
    return next;
  };

  const saveRoute = async (group, route, body) => {
    setBusy(true);
    let saved = false;
    if (fixtureOnly) {
      fixtureMutation(route ? "update" : "create", group.id, route?.id, body);
      saved = true;
    } else {
      const path = route
        ? `/batches/${batch.id}/delivery-groups/${route.id}`
        : `/batches/${batch.id}/delivery-groups`;
      const data = await runMutation(path, body, {
        method: route ? "PATCH" : "POST", showToast,
        successMessage: route ? "Delivery route saved" : "Delivery route added",
      });
      if (data?.batch) {
        acceptBatch(data.batch, "Governed Delivery Group state was read back after the write.");
        saved = true;
      }
    }
    setBusy(false);
    if (saved) setEditing(null);
  };

  const setFreightBasis = async (group, route) => {
    setBusy(true);
    if (fixtureOnly) {
      fixtureMutation("basis", group.id, route.id, {});
    } else {
      const data = await runMutation(
        `/batches/${batch.id}/pricing-groups/${group.id}/freight-basis`,
        { delivery_group_id: route.id, expected_content_version: group.content_version },
        { method: "PATCH", showToast, successMessage: "Freight-basis route changed" });
      if (data?.batch) acceptBatch(data.batch,
        "Governed freight-basis selection was read back after the write.");
    }
    setBusy(false);
  };

  const savePricingGroup = async (group, body) => {
    setBusy(true);
    let data;
    if (fixtureOnly) {
      data = { batch: fixtureMutation("group", group.id, null, body) };
    } else {
      data = await runMutation(`/batches/${batch.id}/pricing-groups/${group.id}`, body, {
        method: "PATCH", showToast, successMessage: "Pricing Group commercial terms saved",
      });
      if (data?.batch) acceptBatch(data.batch,
        "Governed Pricing Group commercial terms were read back after the write.");
    }
    setBusy(false);
    if (data?.batch) {
      setEffectiveByRow({});
      setGroupEditing(null);
    }
  };

  const createPricingGroup = async body => {
    setBusy(true);
    let data;
    if (fixtureOnly) {
      data = { batch: fixtureMutation("createGroup", null, null, body) };
    } else {
      data = await runMutation(`/batches/${batch.id}/pricing-groups`, body, {
        method: "POST", showToast, successMessage: "Pricing Group added",
      });
      if (data?.batch) acceptBatch(data.batch,
        "The new governed Pricing Group was read back. Add its delivery route before Send.");
    }
    setBusy(false);
    if (data?.batch) setGroupCreating(false);
  };

  const changePricingGroupStatus = async (group, status) => {
    setBusy(true);
    let data;
    if (fixtureOnly) {
      data = { batch: fixtureMutation("groupStatus", group.id, null,
        pricingGroupStatusBody(group, status)) };
    } else {
      data = await runMutation(`/batches/${batch.id}/pricing-groups/${group.id}/status`,
        pricingGroupStatusBody(group, status), {
          method: "PATCH", showToast,
          successMessage: status === "active" ? "Pricing Group restored" : "Pricing Group removed",
        });
      if (data?.batch) acceptBatch(data.batch,
        "Governed Pricing Group lifecycle state was read back after the write.");
    }
    setBusy(false);
    if (data?.batch) {
      setEffectiveByRow({});
      setGroupEditing(null);
      setEditing(null);
    }
  };

  const changeDeliveryGroupStatus = async (group, route, status) => {
    setBusy(true);
    let data;
    if (fixtureOnly) {
      data = { batch: fixtureMutation("deliveryStatus", group.id, route.id,
        deliveryGroupStatusBody(group, status)) };
    } else {
      data = await runMutation(`/batches/${batch.id}/delivery-groups/${route.id}/status`,
        deliveryGroupStatusBody(group, status), {
          method: "PATCH", showToast,
          successMessage: status === "active" ? "Delivery Group restored" : "Delivery Group removed",
        });
      if (data?.batch) acceptBatch(data.batch,
        "Governed Delivery Group lifecycle state was read back after the write.");
    }
    setBusy(false);
    if (data?.batch) {
      setEffectiveByRow({});
      setEditing(null);
    }
  };

  const acquireLock = async () => {
    setBusy(true);
    const data = await runMutation(`/batches/${batch.id}/lock/acquire`, {}, {
      showToast, successMessage: "Batch edit lock acquired",
    });
    if (data?.batch) acceptBatch(data.batch,
      "The governed edit lock was acquired and its holder read back.");
    setBusy(false);
  };

  const reclaimStaleLock = async () => {
    if (!reclaimRequest) return;
    setBusy(true);
    const data = await runMutation(`/batches/${batch.id}/lock/reclaim`, reclaimRequest, {
      showToast, successMessage: "Stale Batch edit lock reclaimed",
    });
    if (data?.batch) acceptBatch(data.batch,
      "The stale lock was reclaimed and its new holder read back.");
    setBusy(false);
  };

  const fixtureRowMutation = (row, body) => {
    const next = structuredClone(batch);
    const { sku, version } = durableRowSelection(rowCatalogue.skus, body.sku_id, body.sku_version_id);
    const decorated = {
      pricing_group_id: body.pricing_group_id,
      sku_id: body.sku_id,
      sku_version_id: body.sku_version_id,
      material_code: body.material_code,
      row_type: body.row_type,
      ...Object.fromEntries(ROW_NUMERIC_FIELDS.map(([key]) => [key, body[key] ?? null])),
      sku,
      customer: sku?.customer || null,
      sku_version: version,
      effective_construction: {
        version_id: version?.construction_version_id ?? null,
        origin: "sku_version",
        version: version?.construction_version || null,
        construction: version?.construction || null,
        details_partial: !version?.construction,
      },
    };
    if (row) {
      const target = next.batch_rows.find(item => String(item.id) === String(row.id));
      Object.assign(target, decorated, { content_version: target.content_version + 1 });
    } else {
      const ordinal = next.batch_rows.length + 1;
      next.batch_rows.push({ id: `fixture-row-930${ordinal}`, lineage_id: `fixture-lineage-930${ordinal}`,
        batch_id: next.id, plant_id: next.plant_id, status: "active", content_version: 1,
        sales_moq: null, volume: null, ...decorated });
    }
    acceptBatch(next, "Fixture-only durable row changed in memory; no governed record was written.");
    showToast?.("Fixture-only row saved in memory.", "success", 4500);
  };

  const saveRow = async (row, body) => {
    setBusy(true);
    let saved = false;
    if (fixtureOnly) {
      fixtureRowMutation(row, body);
      saved = true;
    } else {
      const path = row ? `/batches/${batch.id}/rows/${row.id}` : `/batches/${batch.id}/rows`;
      const data = await runMutation(path, body, {
        method: row ? "PATCH" : "POST", showToast,
        successMessage: row ? "Durable Batch row saved" : "Durable Batch row added",
      });
      if (data?.batch) {
        acceptBatch(data.batch, "Governed Batch row state was read back after the write.");
        saved = true;
      }
    }
    setBusy(false);
    if (saved) {
      setEffectiveByRow({});
      if (row) setRowEditing(null);
      else {
        setRowCreateSerial(serial => serial + 1);
        setRowEditing("new");
      }
    }
  };

  const proposeSku = async proposal => {
    if (!batch?.customer_party_id || !batch?.plant?.plant_code) return null;
    setBusy(true);
    const body = {
      plant_code: batch.plant.plant_code,
      party_id: fixtureOnly ? batch.customer_party_id : Number(batch.customer_party_id),
      pricing_portfolio: "Transactional",
      is_price_driving: true,
      fields: {
        item_name: proposal.item_name.trim(),
        construction_version_id: fixtureOnly ? proposal.construction_version_id
          : Number(proposal.construction_version_id),
        length_mm: Number(proposal.length_mm), width_mm: Number(proposal.width_mm),
        height_mm: Number(proposal.height_mm), box_type: proposal.box_type,
        ups: Number(proposal.ups),
      },
    };
    if (fixtureOnly) {
      const option = rowCatalogue.constructionOptions.find(item =>
        String(item.id) === String(proposal.construction_version_id));
      const id = `fixture-proposed-sku-${Date.now()}`;
      const sku = { id, plant_id: batch.plant_id, party_id: batch.customer_party_id,
        plant_item_code: null, status: "proposed", customer: batch.customer_party,
        external_references: [], last_used_at: null,
        versions: [{ id: `fixture-proposed-version-${Date.now()}`, sku_id: id,
          version_no: 1, approved: false, ...body.fields,
          construction: option?.construction || null,
          construction_version: { id: option?.id, version_no: option?.version_no } }] };
      setRowCatalogue(previous => ({ ...previous, skus: [...previous.skus, sku] }));
      setBusy(false);
      return sku;
    }
    const created = await runMutation("/masters/skus", body,
      { showToast, successMessage: "Proposed SKU created for this Customer" });
    if (!created?.id) { setBusy(false); return null; }
    try {
      const response = await apiFetch(`/batches/${batch.id}/row-options`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error("New SKU choices could not be loaded.");
      setRowCatalogue({ status: "ready", skus: data.skus || [],
        constructionOptions: data.construction_options || [] });
      setBusy(false);
      return (data.skus || []).find(sku => String(sku.id) === String(created.id)) || null;
    } catch {
      setBusy(false);
      return null;
    }
  };

  const changeRowStatus = async (row, status) => {
    setBusy(true);
    let data;
    if (fixtureOnly) {
      const next = structuredClone(batch);
      const target = next.batch_rows.find(item => String(item.id) === String(row.id));
      target.status = status;
      target.content_version += 1;
      acceptBatch(next, `Fixture-only durable row marked ${status} in memory; no governed record was written.`);
      data = { batch: next };
      showToast?.(`Fixture-only row ${status === "active" ? "restored" : "removed"} in memory.`, "success", 4500);
    } else {
      data = await runMutation(`/batches/${batch.id}/rows/${row.id}/status`, {
        status, expected_content_version: row.content_version,
      }, { method: "PATCH", showToast,
        successMessage: status === "active" ? "Durable Batch row restored" : "Durable Batch row removed" });
      if (data?.batch) acceptBatch(data.batch,
        `Governed Batch row ${status} state was read back after the write.`);
    }
    setBusy(false);
    if (data?.batch) {
      setEffectiveByRow({});
      setRowEditing(null);
      setPendingRowStatus(null);
    }
  };

  const saveProfile = async body => {
    setBusy(true);
    let data;
    if (fixtureOnly) {
      const next = structuredClone(batch);
      next.content_version += 1;
      next.current_profile = { ...body, id: `fixture-profile-930${next.content_version}`,
        version_no: (profile?.version_no || 0) + 1, is_current: true };
      delete next.current_profile.expected_content_version;
      acceptBatch(next, "Fixture-only profile revision changed in memory; no governed record was written.");
      data = { batch: next };
      showToast?.("Fixture-only profile revision saved in memory.", "success", 4500);
    } else {
      data = await runMutation(`/batches/${batch.id}/profile`, body, { showToast,
        successMessage: "Governed Batch Profile revised" });
      if (data?.batch) acceptBatch(data.batch, "Governed Batch Profile revision was read back after the RPC.");
    }
    setBusy(false);
    if (data?.batch) {
      setEffectiveByRow({});
      setProfileEditing(false);
    }
  };

  const createSet = async body => {
    setBusy(true);
    let data;
    if (fixtureOnly) {
      const next = structuredClone(batch);
      const id = `fixture-set-930${(next.batch_sets || []).length + 1}`;
      next.batch_sets = [...(next.batch_sets || []), { id, batch_id: next.id,
        box_row_id: body.box_row_id, set_code: body.set_code, status: "dissolved",
        active_component_count: 0, memberships: [] }];
      acceptBatch(next, "Fixture-only SET started in memory; no governed record was written.");
      data = { batch: next };
    } else {
      data = await runMutation(`/batches/${batch.id}/sets`, {
        box_row_id: Number(body.box_row_id), set_code: body.set_code,
      }, { showToast, successMessage: "Governed SET started" });
      if (data?.batch) acceptBatch(data.batch, "Governed SET identity and derived dissolved state were read back.");
    }
    setBusy(false);
    if (data?.batch) {
      setEffectiveByRow({});
      setSetEditor(null);
    }
  };

  const attachSetMember = async (setItem, body) => {
    setBusy(true);
    let data;
    if (fixtureOnly) {
      const next = structuredClone(batch);
      const target = next.batch_sets.find(item => String(item.id) === String(setItem.id));
      target.memberships.push({ id: `fixture-member-${target.memberships.length + 1}`,
        set_id: target.id, batch_id: next.id, row_id: body.row_id, role: body.role, status: "active" });
      target.active_component_count = target.memberships.filter(item => item.status === "active").length;
      target.status = target.active_component_count ? "active" : "dissolved";
      acceptBatch(next, "Fixture-only SET membership changed in memory; no governed record was written.");
      data = { batch: next };
    } else {
      data = await runMutation(`/batches/${batch.id}/sets/${setItem.id}/memberships`, {
        row_id: Number(body.row_id), role: body.role,
      }, { showToast, successMessage: "SET component attached" });
      if (data?.batch) acceptBatch(data.batch, "Governed membership and database-derived SET state were read back.");
    }
    setBusy(false);
    if (data?.batch) {
      setEffectiveByRow({});
      setSetEditor(null);
    }
  };

  const changeMembership = async (setItem, membership, status) => {
    setBusy(true);
    if (fixtureOnly) {
      const next = structuredClone(batch);
      const target = next.batch_sets.find(item => String(item.id) === String(setItem.id));
      target.memberships.find(item => String(item.id) === String(membership.id)).status = status;
      target.active_component_count = target.memberships.filter(item => item.status === "active").length;
      target.status = target.active_component_count ? "active" : "dissolved";
      acceptBatch(next, "Fixture-only SET membership state changed in memory; no governed record was written.");
    } else {
      const data = await runMutation(`/batches/${batch.id}/set-memberships/${membership.id}`,
        { status, role: membership.role }, { method: "PATCH", showToast,
          successMessage: status === "active" ? "SET component restored" : "SET component removed" });
      if (data?.batch) acceptBatch(data.batch, "Governed membership and database-derived SET state were read back.");
    }
    setBusy(false);
    setEffectiveByRow({});
  };

  // The Profile committed with a preview is the governed Batch's own
  // (freshBatchProfileValues). row.customer owns the SKU only and is never the
  // Profile Customer: a Family member's SKU stays under the Batch's Customer.
  const commitLocalPreview = (row, preview, existing, targetProfile) => {
    setLocalRows(current => existing
      ? current.map(item => item.id === existing.id ? preview : item)
      : [...current, preview]);
    if (existing) invalidateBatchRow(existing.id);
    setBatchProfile(targetProfile);
    showToast?.("Copied exact governed row inputs to the local preview grid. No calculation was persisted.",
      "success", 6500);
    return preview;
  };

  const copyToLocalPreview = row => {
    const existing = localRows.find(item => String(item.durableRowId) === String(row.id));
    const preview = durableRowToLocalPreview(row, existing?.id || `local-durable-${row.id}`);
    return commitLocalPreview(row, preview, existing, freshBatchProfileValues(batch));
  };

  const openInCosting = row => {
    const existing = localRows.find(item => String(item.durableRowId) === String(row.id));
    openDurableRowInCosting({
      batch,
      row,
      existingId: existing?.id,
      transition: loadBatchRowIntoCosting,
      commit: (preview, targetProfile) => {
        commitLocalPreview(row, preview, existing, targetProfile);
        setBatchWorkspaceRequest({
          requestId: `costing-return-${batch.id}-${row.id}-${Date.now()}`,
          batchId: batch.id,
          mode: "row-focus",
          rowId: row.id,
        });
      },
    });
  };

  return <div className="batch-workspace-panel-scrim" role="presentation">
    <aside className="batch-workspace-panel" role="dialog" aria-modal="true"
      aria-labelledby="batch-workspace-panel-title">
      <header>
        <div>
          <span className="batch-workspace-panel-kicker">U4 · DURABLE BATCH</span>
          <h2 id="batch-workspace-panel-title">Batch workspace</h2>
          <p>{fixtureOnly
            ? "FIXTURE ONLY · isolated presentation · no authoritative read or write"
            : "Authenticated caller-visible workspace · Delivery Group writes remain governed by the active Batch lock"}</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close Batch workspace">×</button>
      </header>

      {state.status !== "ready" && <div className={`batch-workspace-panel-state is-${state.status}`}
        role="status">{state.message}</div>}

      {batch && <div className="batch-workspace-panel-content">
        {(batch.details_partial || fixtureOnly) && <div className="batch-workspace-panel-state is-partial" role="status">
          {fixtureOnly ? "Permanent fixture labelling: these identities demonstrate UX only."
            : <>Partial caller-visible result. Missing: {batch.partial_sections?.join(", ") || "none"}.
              {batch.denied_sections?.length ? ` Denied: ${batch.denied_sections.join(", ")}.` : ""}
              {" "}Hidden values have not been inferred.</>}
        </div>}

        <section aria-labelledby="batch-workspace-identity-title">
          <h3 id="batch-workspace-identity-title">Durable identity</h3>
          <div className="batch-workspace-identity-grid">
            <Identity label="Batch reference" value={batch.batch_reference} detail={`Batch #${batch.id}`} />
            <Identity label="Customer Family" value={batch.family?.name || `#${batch.family_id}`}
              detail={batch.family ? `${batch.family.group_customer_code || "No family code"} · #${batch.family.id}` : "Details unavailable"} />
            <Identity label="Selected Customer / Prospect"
              value={batch.customer_party?.display_name || (batch.customer_party_id ? "Identity unavailable" : "Not selected on this Batch")}
              detail={batch.customer_party
                ? `${batch.customer_party.customer_code || "Prospect"} · Party #${batch.customer_party.id}` : null} />
            <Identity label="Producing Plant" value={batch.plant?.name || `#${batch.plant_id}`}
              detail={batch.plant ? `${batch.plant.plant_code} · #${batch.plant.id}` : "Details unavailable"} />
            <Identity label="Owner" value={batch.owner?.display_name || `#${batch.owner_user_id}`}
              detail={batch.owner ? `User #${batch.owner.id} · ${batch.owner.status}` : "Details unavailable"} />
            <Identity label="Status" value={batch.status} detail={`Content version ${batch.content_version}`} />
            <Identity label="Sector" value={batch.sector?.name || (batch.sector_id ? `#${batch.sector_id}` : "Not selected")}
              detail={batch.sector ? `${batch.sector.sector_code} · #${batch.sector.id} · selected for this Batch` : null} />
          </div>
          <div className="batch-workspace-family-sectors">
            <strong>Customer Family Sectors</strong>
            <span>A Family may have several Sectors. This Batch uses one only; guidance and inheritance follow the selected Batch Sector above.</span>
            {(batch.family_sectors || []).length ? <div>
              {batch.family_sectors.map((membership, index) => <span key={membership.sector_id}
                className={String(membership.sector_id) === String(batch.sector_id) ? "is-selected" : ""}>
                {membership.sector?.sector_code || `Sector #${membership.sector_id}`}
                {membership.sector?.name ? ` · ${membership.sector.name}` : " · details unavailable"}
                {index === 0 ? " · first attached" : ""}
                {String(membership.sector_id) === String(batch.sector_id) ? " · BATCH SECTOR" : ""}
              </span>)}
            </div> : <small>Required Family Sector classification is unavailable; no hidden Sector has been inferred.</small>}
          </div>
        </section>

        <div className="batch-workspace-quote-link">
          <div><strong>Linked immutable Quote evidence</strong>
            <span>Resolve only the caller-visible Quote family attached to exact Batch identity #{batch.id}. A missing link remains an explicit empty result.</span></div>
          <button type="button" onClick={openLinkedQuote} disabled={fixtureOnly}>Open Quote evidence</button>
        </div>

        <section aria-labelledby="batch-workspace-access-title">
          <h3 id="batch-workspace-access-title">People and edit lock</h3>
          <div className="batch-workspace-access-row">
            <div><span>Active lock</span><strong>{lock
              ? `${lock.holder?.display_name || `User #${lock.holder_user_id}`}` : "No active lock"}</strong>
              <small>{lock ? `Heartbeat ${shown(lock.heartbeat_at)}` : "Read-only until a governed lock is acquired"}</small></div>
            <div><span>Collaborators</span><strong>{batch.collaborators?.length || 0}</strong>
              <small>{batch.collaborators?.length
                ? batch.collaborators.map(item => item.user?.display_name || `User #${item.app_user_id}`).join(" · ")
                : "No caller-visible active collaborators"}</small></div>
          </div>
          {!fixtureOnly && !lock && <button type="button" className="batch-workspace-acquire-lock"
            onClick={acquireLock} disabled={busy}>Acquire edit lock</button>}
          {!fixtureOnly && reclaimRequest && <div>
            <button type="button" className="batch-workspace-acquire-lock"
              onClick={reclaimStaleLock} disabled={busy}>Reclaim stale lock</button>
            <small>The server will allow this only after the heartbeat expires and only if the holder has not changed.</small>
          </div>}
        </section>

        <BatchPreparationSummary batch={batch} localRows={localRows} localResults={batchResults}
          effectiveByRow={effectiveByRow} busy={busy} fixtureOnly={fixtureOnly}
          onRefreshReadiness={refreshGovernedReadiness} onCalculateAll={calculateAll}
          onSend={atomicSend} />
        {sentRevisionId != null && <div className="batch-workspace-send-result">
          <div><strong>Immutable draft candidate #{sentRevisionId} was created.</strong>
            <span>Open its exact caller-visible snapshot. A permanent Quote reference is still allocated only on first approval.</span></div>
          <button type="button" onClick={openSentQuote}>Open immutable draft evidence</button>
        </div>}

        <section aria-labelledby="batch-workspace-profile-title">
          <div className="batch-workspace-section-title">
            <h3 id="batch-workspace-profile-title">Current Batch Profile · version {profile?.version_no ?? "unavailable"}</h3>
            {!profileEditing && <button type="button" onClick={() => setProfileEditing(true)}
              disabled={!batch.caller_holds_lock || busy || !profile}>Revise profile</button>}
          </div>
          {profile ? <div className="batch-workspace-profile-grid">
            <ProfileValue label="Box conversion" value={profile.conv_box_rate} />
            <ProfileValue label="Box waste %" value={profile.waste_cbb_pct} />
            <ProfileValue label="Box margin %" value={profile.margin_box_pct} />
            <ProfileValue label="PP conversion" value={profile.conv_pp_rate} />
            <ProfileValue label="PP waste %" value={profile.waste_pp_pct} />
            <ProfileValue label="PP margin %" value={profile.margin_pp_pct} />
          </div> : <div className="batch-workspace-empty">Current profile details are unavailable to this caller.</div>}
          {profileEditing && <ProfileEditor profile={profile} contentVersion={batch.content_version}
            disabled={!batch.caller_holds_lock || busy} onCancel={() => setProfileEditing(false)}
            onSave={saveProfile} />}
        </section>

        <section aria-labelledby="batch-workspace-rows-title">
          <h3 id="batch-workspace-rows-title">Durable Batch rows</h3>
          <p className="batch-workspace-group-explainer">
            A row pins one Customer SKU Version and its authoritative Construction Version to one Pricing Group. The local preview is a separate, non-authoritative working copy.
          </p>
          {!batch.caller_holds_lock && <div className="batch-workspace-warning">
            Adding or revising a durable row requires the active governed Batch lock.
          </div>}
          {(rowCatalogue.status === "denied" || rowCatalogue.status === "error") && <div
            className="batch-workspace-panel-state is-denied" role="status">
            {rowCatalogue.message} Hidden SKU or Construction identities have not been invented.
          </div>}
          {!durableRows.length && <div className="batch-workspace-empty">
            No caller-visible durable rows. This is distinct from the local preview grid.
          </div>}
          <div className="batch-workspace-rows">
            {durableRows.map(row => {
              const preview = localPreviewState(row, localRows, batchResults);
              const specification = durableRowSpecificationEvidence(row, localRows, batchResults);
              const assignedGroup = groups.find(group => String(group.id) === String(row.pricing_group_id));
              return <article id={`batch-workspace-row-${row.id}`} tabIndex={-1}
                className="batch-workspace-row" key={row.id}>
                <div className="batch-workspace-row-head">
                  <div><strong>{row.material_code || row.sku?.plant_item_code || `SKU #${row.sku_id}`}</strong>
                    <small>Row #{row.id} · lineage #{row.lineage_id} · v{row.content_version} · {row.status}</small></div>
                  <span>{DURABLE_ROW_TYPES.find(option => option.value === row.row_type)?.label || row.row_type}</span>
                </div>
                <div className="batch-workspace-row-identities">
                  <Identity label="Customer" value={row.customer?.display_name || `#${row.sku?.party_id || "—"}`}
                    detail={row.customer ? `${row.customer.customer_code || "No code"} · #${row.customer.id}` : "Details unavailable"} />
                  <Identity label="SKU · Version" value={row.sku?.plant_item_code || `SKU #${row.sku_id}`}
                    detail={`SKU #${row.sku_id} · Version #${row.sku_version_id} · ${row.sku?.status || "status unavailable"}`} />
                  <Identity label="Construction · Version"
                    value={row.effective_construction?.construction?.construction_code || `Version #${row.effective_construction?.version_id || "—"}`}
                    detail={`Construction #${row.effective_construction?.construction?.id || "—"} · Version #${row.effective_construction?.version_id || "—"} · ${row.effective_construction?.origin || "origin unavailable"}`} />
                  <Identity label="Pricing Group" value={assignedGroup?.label || `#${row.pricing_group_id}`}
                    detail={`Pricing Group #${row.pricing_group_id} · ${assignedGroup?.status || "details unavailable"}`} />
                </div>
                <div className="batch-workspace-row-overrides">
                  {[
                    ["Waste %", row.waste_override_pct], ["Conversion", row.conv_override_rate],
                    ["Margin %", row.margin_override_pct], ["Freight", row.freight_override],
                  ].map(([label, value]) => <span key={label}><small>{label}</small>
                    <strong>{value == null ? "Inherit" : Number(value) === 0 ? "0 · explicit" : shown(value)}</strong></span>)}
                </div>
                <div className="batch-workspace-row-overrides">
                  {ROW_ADDON_FIELDS.map(([key, label]) => <span key={key}><small>{label}</small>
                    <strong>{row[key] == null ? "Not entered" : Number(row[key]) === 0 ? "0 · explicit" : shown(row[key])}</strong></span>)}
                  <span><small>Fluting BCF</small><strong>{row.fluting_bcf == null
                    ? "Inherit default" : Number(row.fluting_bcf) === 0 ? "0 · explicit" : shown(row.fluting_bcf)}</strong></span>
                </div>
                {row.status === "removed" && <div className="batch-workspace-warning">
                  This row is retained as history but excluded from preparation and Send candidates.
                </div>}
                {row.status === "active" && assignedGroup?.status !== "active" && <div className="batch-workspace-warning">
                  This active row points to a removed or unavailable Pricing Group. Reassign it or restore the group before Send.
                </div>}
                {pendingRowStatus && String(pendingRowStatus.rowId) === String(row.id) && <div
                  className="batch-workspace-row-status-confirm" role="alert">
                  <span>Confirm {pendingRowStatus.status === "active" ? "restoring" : "removing"} governed row #{row.id}.
                    {pendingRowStatus.status === "removed" ? " It remains in history and leaves preparation and Send candidates." : " It returns to active preparation."}</span>
                  <button type="button" onClick={() => setPendingRowStatus(null)} disabled={busy}>Cancel</button>
                  <button type="button" className="is-primary"
                    onClick={() => changeRowStatus(row, pendingRowStatus.status)}
                    disabled={!batch.caller_holds_lock || busy}>
                    Confirm {pendingRowStatus.status === "active" ? "restore" : "remove"}
                  </button>
                </div>}
                {row.effective_construction?.details_partial && <div className="batch-workspace-warning">
                  Construction detail is partial for this caller; its exact stored Version ID remains visible.
                </div>}
                <div className="batch-workspace-row-actions">
                  <span className={`is-${preview.state}`}>{preview.label}</span>
                  <button type="button" onClick={() => copyToLocalPreview(row)} disabled={row.status !== "active"}>
                    {preview.state === "not-copied" ? "Copy to local preview" : "Refresh local preview"}
                  </button>
                  <button type="button" className="is-primary" onClick={() => openInCosting(row)}
                    disabled={row.status !== "active"}
                    title="Open a session-only Costing review of this exact durable row. Governed state is unchanged.">
                    Open in Costing
                  </button>
                  <button type="button" onClick={() => loadEffectiveInputs(row)}
                    disabled={row.status !== "active" || effectiveByRow[row.id]?.status === "loading"}>
                    {effectiveByRow[row.id]?.status === "loading" ? "Resolving…" : "Resolve values & freshness"}
                  </button>
                  <button type="button" className="is-calculate" onClick={() => calculateOne(row)}
                    disabled={fixtureOnly || row.status !== "active" || batch.status !== "working"
                      || !batch.caller_holds_lock || busy}>Calculate governed row</button>
                  <button type="button" onClick={() => openRowEditor(row)}
                    disabled={row.status !== "active" || !batch.caller_holds_lock || busy}>Edit durable row</button>
                  <button type="button" onClick={() => changeRowStatus(row,
                    row.status === "active" ? "removed" : "active")}
                    disabled={!batch.caller_holds_lock || busy}>
                    {row.status === "active" ? "Remove row" : "Restore row"}
                  </button>
                </div>
                <EffectiveInputEvidence evidence={effectiveByRow[row.id]} />
                <RowSpecificationEvidence evidence={specification} />
                {rowEditing === row.id && <BatchRowEditor key={`${row.id}-${row.content_version}`}
                  row={row} groups={groups} skus={rowCatalogue.skus}
                  constructionOptions={rowCatalogue.constructionOptions} batch={batch}
                  initialGroupId={requestedRowEditor?.groupId}
                  loading={rowCatalogue.status === "loading"}
                  disabled={!batch.caller_holds_lock || busy || ["denied", "error"].includes(rowCatalogue.status)}
                  fixtureOnly={fixtureOnly} onCancel={() => setRowEditing(null)}
                  onSave={body => saveRow(row, body)} onProposeSku={proposeSku} />}
              </article>;
            })}
          </div>
          {rowEditing === "new" && <BatchRowEditor key={`new-${rowCreateSerial}`}
            groups={groups} skus={rowCatalogue.skus}
            constructionOptions={rowCatalogue.constructionOptions} batch={batch}
            initialGroupId={requestedRowEditor?.groupId}
            loading={rowCatalogue.status === "loading"}
            disabled={!batch.caller_holds_lock || busy || ["denied", "error"].includes(rowCatalogue.status)}
            fixtureOnly={fixtureOnly} onCancel={() => setRowEditing(null)}
            onSave={body => saveRow(null, body)} onProposeSku={proposeSku} />}
          {rowEditing !== "new" && <button type="button" className="batch-workspace-add-row"
            onClick={() => openRowEditor(null)} disabled={!batch.caller_holds_lock || busy || !groups.length}>
            + Add durable row
          </button>}
        </section>

        <section aria-labelledby="batch-workspace-sets-title">
          <h3 id="batch-workspace-sets-title">SET membership</h3>
          <p className="batch-workspace-group-explainer">
            A SET has one Box parent and one or more component rows. Active/dissolved state and component count are database-derived.
          </p>
          {!batch.caller_holds_lock && <div className="batch-workspace-warning">SET changes require the active governed Batch lock.</div>}
          {!batchSets.length && <div className="batch-workspace-empty">No caller-visible SET identities.</div>}
          <div className="batch-workspace-sets">
            {batchSets.map(setItem => {
              const box = durableRows.find(row => String(row.id) === String(setItem.box_row_id));
              return <article id={`batch-workspace-set-${setItem.id}`} className="batch-workspace-set" key={setItem.id}>
                <div className="batch-workspace-set-head">
                  <div><strong>{setItem.set_code}</strong><small>SET #{setItem.id} · Box row #{setItem.box_row_id}{box?.material_code ? ` · ${box.material_code}` : ""}</small></div>
                  <span className={`is-${setItem.status}`}>{setItem.status} · {setItem.active_component_count} active</span>
                </div>
                <div className="batch-workspace-set-members">
                  {!(setItem.memberships || []).length && <span>No component history yet. This SET remains dissolved.</span>}
                  {(setItem.memberships || []).map(membership => {
                    const row = durableRows.find(item => String(item.id) === String(membership.row_id));
                    return <div key={membership.id}>
                      <span>Row #{membership.row_id} · {row?.material_code || row?.row_type || "details unavailable"}</span>
                      <strong>{membership.role} · {membership.status}</strong>
                      <button type="button" disabled={!batch.caller_holds_lock || busy}
                        onClick={() => changeMembership(setItem, membership,
                          membership.status === "active" ? "removed" : "active")}>
                        {membership.status === "active" ? "Remove" : "Restore"}
                      </button>
                    </div>;
                  })}
                </div>
                {setEditor?.kind === "member" && String(setEditor.setId) === String(setItem.id)
                  ? <MembershipCreator setItem={setItem} rows={durableRows}
                      initialRowId={setEditor.rowId}
                      disabled={!batch.caller_holds_lock || busy} onCancel={() => setSetEditor(null)}
                      onSave={body => attachSetMember(setItem, body)} />
                  : <button type="button" className="batch-workspace-add-set-member"
                      disabled={!batch.caller_holds_lock || busy || !durableRows.some(row => row.status === "active" && row.row_type !== "box")}
                      onClick={() => setSetEditor({ kind: "member", setId: setItem.id })}>+ Attach component</button>}
              </article>;
            })}
          </div>
          {setEditor?.kind === "new"
            ? <SetCreator rows={durableRows} disabled={!batch.caller_holds_lock || busy}
                initialBoxRowId={setEditor.boxRowId}
                onCancel={() => setSetEditor(null)} onSave={createSet} />
            : <button type="button" className="batch-workspace-add-row"
                disabled={!batch.caller_holds_lock || busy || !durableRows.some(row => row.status === "active" && row.row_type === "box")}
                onClick={() => setSetEditor({ kind: "new" })}>+ Start SET</button>}
        </section>

        <section aria-labelledby="batch-workspace-groups-title">
          <h3 id="batch-workspace-groups-title">Pricing and Delivery Groups</h3>
          <p className="batch-workspace-group-explainer">
            Delivery routes inside one Pricing Group share its price. Add another Pricing Group only when the price must differ.
          </p>
          {!batch.caller_holds_lock && <div className="batch-workspace-warning">
            Editing requires the active governed Batch lock. The current structure remains readable.
          </div>}
          {(catalogue.status === "denied" || catalogue.status === "error") && <div className="batch-workspace-panel-state is-denied" role="status">
            {catalogue.message} Delivery route editing is unavailable; hidden Locations have not been invented.
          </div>}
          {!groups.length && <div className="batch-workspace-empty">No caller-visible Pricing Groups.</div>}
          {groups.map(group => <article id={`batch-workspace-pricing-group-${group.id}`}
            className={`batch-workspace-group is-${group.status}`} key={group.id}>
            <div className="batch-workspace-group-head">
              <div><strong>{group.label || "Unnamed Pricing Group"}</strong>
                <small>Pricing Group #{group.id} · v{group.content_version} · {group.status} · {durableRows.filter(row =>
                  row.status === "active" && String(row.pricing_group_id) === String(group.id)).length} active rows</small></div>
              <div><span>Freight</span><strong>{group.freight_mode === "manual"
                ? `Manual · ${shown(group.freight_manual_value)}`
                : group.freight_mode === "ex_factory" ? "Ex-factory · 0" : "Approved master"}</strong></div>
              <div><span>Payment</span><strong>{group.payment_terms_days == null ? "Unresolved" : `${group.payment_terms_days} days`}</strong></div>
              <div><span>Interest</span><strong>{group.interest_override_pct == null ? "Derived / fallback" : `${group.interest_override_pct}% override`}</strong></div>
            </div>
            {group.status === "removed" && <div className="batch-workspace-warning">
              This Pricing Group and its routes are retained as history. Active rows assigned here must be reassigned or this group restored before Send.
            </div>}
            <div className="batch-workspace-group-terms">
              <div><span>Payment wording</span><strong>{group.payment_terms_text || "None · descriptive only"}</strong></div>
              <div><span>Interest basis at override</span><strong>{group.interest_override_derived_pct == null
                ? "No explicit override basis" : `${group.interest_override_derived_pct}% derived`}</strong></div>
              <div><span>Override reason</span><strong>{group.interest_override_reason || "None"}</strong>
                {group.interest_override_at && <small>Recorded {group.interest_override_at}
                  {group.interest_override_by ? ` · User #${group.interest_override_by}` : ""}</small>}</div>
              <button type="button" onClick={() => setGroupEditing(group.id)}
                disabled={!batch.caller_holds_lock || busy || group.status !== "active"}>Edit commercial terms</button>
              <button type="button" onClick={() => changePricingGroupStatus(group,
                group.status === "active" ? "removed" : "active")}
                disabled={!batch.caller_holds_lock || busy}>
                {group.status === "active" ? "Remove Pricing Group" : "Restore Pricing Group"}
              </button>
            </div>
            {group.legacy_freight_source && <div className="batch-workspace-warning">
              Temporary {group.legacy_freight_source} freight remains visible pending its governed U4 restatement.
            </div>}
            {String(groupEditing) === String(group.id) && <PricingGroupEditor key={group.content_version}
              group={group} disabled={!batch.caller_holds_lock || busy}
              onCancel={() => setGroupEditing(null)} onSave={body => savePricingGroup(group, body)} />}
            <div className="batch-workspace-deliveries">
              {!group.delivery_groups?.length && <div className="batch-workspace-empty">No caller-visible Delivery Groups.</div>}
              {group.delivery_groups?.map(delivery => <div className="batch-workspace-delivery" key={delivery.id}>
                <div><strong>{delivery.label || "Unnamed Delivery Group"}</strong>
                  <small>Delivery Group #{delivery.id} · {delivery.status}
                    {String(group.freight_basis_delivery_group_id) === String(delivery.id) ? " · freight basis" : ""}</small></div>
                <Location role="Bill-to" locationId={delivery.bill_to_location_id} location={delivery.bill_to_location} />
                <Location role="Ship-to" locationId={delivery.ship_to_location_id} location={delivery.ship_to_location} />
                {!delivery.ship_to_location_id && delivery.destination_text && <div className="batch-workspace-route-note">
                  Quote-specific destination: {delivery.destination_text}
                </div>}
                {!delivery.bill_to_location_id && delivery.billing_text && <div className="batch-workspace-route-note">
                  Quote-specific billing destination: {delivery.billing_text}
                </div>}
                <div className="batch-workspace-delivery-actions">
                  <button type="button" onClick={() => openEditor(group, delivery)}
                    disabled={!batch.caller_holds_lock || busy || group.status !== "active" || delivery.status !== "active"}>Edit route</button>
                  {String(group.freight_basis_delivery_group_id) !== String(delivery.id)
                    && delivery.status === "active" && <button type="button"
                    onClick={() => setFreightBasis(group, delivery)}
                    disabled={!batch.caller_holds_lock || busy || group.status !== "active" || !delivery.ship_to_location_id}>
                    Use for freight
                  </button>}
                  <button type="button" onClick={() => changeDeliveryGroupStatus(group, delivery,
                    delivery.status === "active" ? "removed" : "active")}
                    disabled={!batch.caller_holds_lock || busy || group.status !== "active"}>
                    {delivery.status === "active" ? "Remove route" : "Restore route"}
                  </button>
                </div>
              </div>)}
            </div>
            {group.freight_mode === "master"
              && group.delivery_groups?.some(route => route.status === "removed"
                && String(route.id) === String(group.freight_basis_delivery_group_id))
              && <div className="batch-workspace-warning">
                The selected freight-basis route is removed. Restore it or explicitly choose another active route; no fallback is assumed.
              </div>}
            {editing?.groupId === group.id && (() => {
              const route = group.delivery_groups?.find(item => String(item.id) === String(editing.routeId)) || null;
              return <DeliveryRouteEditor key={route?.id || "new"} group={group} route={route}
                locations={catalogue.locations} parties={catalogue.parties}
                loading={catalogue.status === "loading"}
                disabled={!batch.caller_holds_lock || busy || ["denied", "error"].includes(catalogue.status)}
                fixtureOnly={fixtureOnly} onCancel={() => setEditing(null)}
                onSave={body => saveRoute(group, route, body)} />;
            })()}
            <button type="button" className="batch-workspace-add-delivery"
              onClick={() => openEditor(group)} disabled={!batch.caller_holds_lock || busy || group.status !== "active"}>
              + Add delivery route
            </button>
          </article>)}
          {groupCreating
            ? <PricingGroupCreator disabled={!batch.caller_holds_lock || busy}
                onCancel={() => setGroupCreating(false)} onSave={createPricingGroup} />
            : <button type="button" className="batch-workspace-add-group"
                onClick={() => setGroupCreating(true)} disabled={!batch.caller_holds_lock || busy}>
                + Add Pricing Group for a different price
              </button>}
        </section>
      </div>}

      <footer>
        <span>Calculate and Atomic Send are governed and active. Submit, approval and Issue remain separate workflow actions.</span>
        <span>Bill-to and Ship-to remain distinct; the selected Ship-to supplies the freight destination.</span>
      </footer>
    </aside>
  </div>;
}
