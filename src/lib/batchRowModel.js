export const DURABLE_ROW_TYPES = Object.freeze([
  { value: "box", label: "Box" },
  { value: "plate", label: "Plate" },
  { value: "part_l", label: "Part-L" },
  { value: "part_w", label: "Part-W" },
  { value: "other", label: "Other" },
]);

const previewType = value => DURABLE_ROW_TYPES.find(option => option.value === value)?.label || "Other";

export function durableRowSelection(skus, skuId, versionId) {
  const sku = (skus || []).find(item => String(item.id) === String(skuId)) || null;
  const version = sku?.versions?.find(item => String(item.id) === String(versionId)) || null;
  return { sku, version };
}

export function durableRowToLocalPreview(row, existingId = `local-durable-${row.id}`) {
  const version = row?.sku_version || {};
  const construction = row?.effective_construction?.construction;
  return {
    id: existingId,
    durableRowId: row.id,
    durableRowContentVersion: row.content_version,
    governedSkuId: row.sku_id,
    governedSkuVersionId: row.sku_version_id,
    governedPricingGroupId: row.pricing_group_id,
    governedConstructionVersionId: row.effective_construction?.version_id ?? null,
    matCode: row.material_code || row.sku?.plant_item_code || "",
    product: row.sku?.plant_item_code || row.customer?.customer_code || `SKU #${row.sku_id}`,
    itemType: previewType(row.row_type),
    setCode: "",
    setCodeAssumed: false,
    constructionCode: construction?.construction_code || "",
    setAutoFill: true,
    L: version.length_mm ?? "",
    W: version.width_mm ?? "",
    H: version.height_mm ?? "",
    ups: version.ups ?? 1,
    boxType: version.box_type || (row.row_type === "box" ? "RSC" : "PP"),
    spec_bs: version.spec_bs ?? "",
    spec_bct: version.spec_bct ?? "",
    spec_ect: version.spec_ect ?? "",
    board_gsm: version.board_gsm ?? row?.effective_construction?.version?.board_gsm ?? "",
    nosPerSet: 1,
    salesMOQ: row.sales_moq ?? "",
    volume: row.volume ?? "",
    marginOverride: row.margin_override_pct ?? "",
    wasteConv_waste: row.waste_override_pct ?? "",
    wasteConv_conv: row.conv_override_rate ?? "",
    printing: row.addon_printing ?? "",
    stitching: row.addon_stitching ?? "",
    coating: row.addon_coating ?? "",
    handling: row.addon_handling ?? "",
    moqCharge: row.addon_moq_charge ?? "",
    packing: row.addon_packing ?? "",
    other: row.addon_other ?? "",
    unloading: row.addon_unloading ?? "",
    fluting_bcf: row.fluting_bcf ?? "",
    remarks: "Local preview copied from governed Batch row; not a persisted calculation.",
    reviewed: false,
    autoCode: false,
    status: "incomplete",
  };
}

// The Costing Profile for a durable row is the governed BATCH's, never the
// row's. `row.customer` only owns the SKU - Batch choices include established
// SKUs of any current Customer Family member - so it must not become the
// Profile Customer. The target Profile is built here, synchronously, so the
// transition prepares the review from it rather than from the previous
// render's (possibly unrelated) browser-local Profile, and only a successful
// transition hands the same object to commit.
export function openDurableRowInCosting({ batch, row, existingId, transition, commit }) {
  const preview = durableRowToLocalPreview(row, existingId || `local-durable-${row.id}`);
  const targetProfile = freshBatchProfileValues(batch);
  if (transition(preview, targetProfile) !== true) return { opened: false, preview: null, targetProfile: null };
  commit(preview, targetProfile);
  return { opened: true, preview, targetProfile };
}

export function durableRowSpecificationEvidence(row, localRows, localResults) {
  const preview = (localRows || []).find(item => String(item.durableRowId) === String(row.id));
  const result = preview ? localResults?.[preview.id] : null;
  const targets = {
    bs: preview?.spec_bs ?? row?.sku_version?.spec_bs ?? null,
    gsm: preview?.board_gsm ?? row?.effective_construction?.version?.board_gsm ?? null,
    bct: preview?.spec_bct ?? row?.sku_version?.spec_bct ?? null,
    ect: preview?.spec_ect ?? row?.sku_version?.spec_ect ?? null,
  };
  if (!result) return { status: "not_evaluated", targets, gaps: [] };
  const gaps = checkSpecCompliance({ spec_bs: targets.bs, board_gsm: targets.gsm }, result);
  return { status: gaps.length ? "review" : "meets", targets, gaps };
}

export function durableBatchPreparation(batch, localRows, localResults, effectiveByRow = {}) {
  const rows = (batch?.batch_rows || []).filter(row => row.status === "active");
  const groups = (batch?.pricing_groups || []).filter(group => group.status === "active");
  const activeGroupIds = new Set(groups.map(group => String(group.id)));
  const routes = groups.flatMap(group => (group.delivery_groups || [])
    .filter(route => route.status === "active").map(route => ({ ...route, group })));
  const completeRoutes = routes.filter(route => route.bill_to_location_id && route.ship_to_location_id);
  const structuralBlockers = [];
  if (!batch?.pricing_basis_release_id) structuralBlockers.push("Pricing Basis Release not selected");
  if (!batch?.current_profile) structuralBlockers.push("Current Batch Profile unavailable");
  if (!rows.length) structuralBlockers.push("No active durable rows");
  if (!groups.length) structuralBlockers.push("No active Pricing Group");
  if (rows.some(row => !activeGroupIds.has(String(row.pricing_group_id)))) {
    structuralBlockers.push("An active durable row references a removed or unavailable Pricing Group");
  }
  if (groups.some(group => !rows.some(row =>
    String(row.pricing_group_id) === String(group.id)))) {
    structuralBlockers.push("An active Pricing Group has no active durable rows");
  }
  if (groups.some(group => !(group.delivery_groups || []).some(route => route.status === "active"
      && route.bill_to_location_id && route.ship_to_location_id))) {
    structuralBlockers.push("A Pricing Group has no complete Bill-to and Ship-to route");
  }
  if (groups.some(group => group.freight_mode === "master" && !(group.delivery_groups || [])
    .some(route => route.status === "active"
      && String(route.id) === String(group.freight_basis_delivery_group_id)
      && route.ship_to_location_id))) {
    structuralBlockers.push("A master-freight Pricing Group has no complete freight-basis route");
  }
  if (rows.some(row => !row.sku_id || !row.sku_version_id || !row.pricing_group_id
      || !row.effective_construction?.version_id)) {
    structuralBlockers.push("A durable row has incomplete governed identities");
  }

  const previewed = rows.filter(row => localPreviewState(row, localRows, localResults).state === "previewed").length;
  const sourceChanged = rows.filter(row => localPreviewState(row, localRows, localResults).state === "source-changed").length;
  const resolved = rows.filter(row => effectiveByRow[row.id]?.status === "ready").length;
  const specificationReview = rows.filter(row =>
    durableRowSpecificationEvidence(row, localRows, localResults).status === "review").length;
  const status = structuralBlockers.length ? "incomplete"
    : sourceChanged ? "source_changed"
      : previewed < rows.length ? "preview_pending"
        : specificationReview ? "specification_review" : "local_review_ready";
  return {
    status, structuralBlockers, rowCount: rows.length, routeCount: routes.length,
    completeRouteCount: completeRoutes.length, previewed, sourceChanged, resolved,
    specificationReview,
  };
}

export function localPreviewState(row, localRows, localResults) {
  const preview = (localRows || []).find(item => String(item.durableRowId) === String(row.id));
  if (!preview) return { state: "not-copied", label: "Not in local preview" };
  if (Number(preview.durableRowContentVersion) !== Number(row.content_version)) {
    return { state: "source-changed", label: "Governed row changed · copy again" };
  }
  if (localResults?.[preview.id]) {
    return { state: "previewed", label: "Local preview run · not governed" };
  }
  return { state: "ready", label: "Copied · local preview not yet run" };
}
import { checkSpecCompliance } from "../engine/costing.js";
import { freshBatchProfileValues } from "../state/costingDraftModel.js";
