// S3 - deliberate governed return from a Costing deep-dive to the durable
// Batch row it was opened from.
//
// Pure except runGovernedRowReturn, whose I/O (confirm, request, freshness
// read, commit) is injected so the ordering can be proved without React or a
// network: nothing is committed locally unless the governed update succeeded
// and its read-back shows the row version advanced.
//
// The request body is the EXISTING PATCH /batches/:id/rows/:rowId contract:
// identity fields are resent unchanged (the route requires them and would
// clear material_code if it were omitted), numeric inputs are sent only when
// the Maker changed them (an omitted key keeps the stored value), null means
// blank/inherit, and 0 is an explicit zero.

// Costing spec key -> governed row column. Row-owned, calculation-input fields
// only. freight_override is deliberately absent: Freight is Batch-level (C7a).
export const RETURNABLE_FIELDS = Object.freeze([
  { spec: "volume", api: "volume", kind: "integer", label: "Volume" },
  { spec: "salesMOQ", api: "sales_moq", kind: "integer", label: "MOQ" },
  { spec: "printing", api: "addon_printing", kind: "number", label: "Printing add-on" },
  { spec: "stitching", api: "addon_stitching", kind: "number", label: "Stitching add-on" },
  { spec: "coating", api: "addon_coating", kind: "number", label: "Coating add-on" },
  { spec: "handling", api: "addon_handling", kind: "number", label: "Handling add-on" },
  { spec: "moqCharge", api: "addon_moq_charge", kind: "number", label: "MOQ charge add-on" },
  { spec: "packing", api: "addon_packing", kind: "number", label: "Packing add-on" },
  { spec: "other", api: "addon_other", kind: "number", label: "Other add-on" },
  { spec: "unloading", api: "addon_unloading", kind: "number", label: "Unloading add-on" },
  { spec: "flutingBCF", api: "fluting_bcf", kind: "number", label: "Fluting BCF" },
]);

// Delta-vs-Batch overrides, resolved exactly as the local Push resolves them.
const OVERRIDE_KEYS = Object.freeze({
  margin: "margin_override_pct",
  waste: "waste_override_pct", wastePP: "waste_override_pct",
  convRate: "conv_override_rate", convRatePP: "conv_override_rate",
});

// Spec keys a Maker may change that belong to the SKU / SKU Version, the
// Construction or the Batch. Any change to one of these (or to any key this
// module does not know) blocks the WHOLE apply - never a partial one.
const OWNED_ELSEWHERE = Object.freeze({
  L: "Dimensions", W: "Dimensions", H: "Dimensions", ups: "Ups",
  ply: "Construction", flute_F1: "Construction", flute_F2: "Construction",
  layers: "Construction", boxType: "Construction",
  spec_bs: "BS", board_gsm: "GSM", spec_bct: "BCT", spec_ect: "ECT", spec_cobb: "Cobb",
  product: "SKU", material_code: "Material code", matCode: "Material code",
  skuType: "Glass SKU", qtyPerSet: "Partitions per set", setCode: "SET code",
  rowType: "Row type", reqBoxWt: "Required box weight",
  printing_technology: "Printing specification", number_of_colours: "Printing specification",
  client: "Customer", sector: "Sector", plant: "Plant", delivery: "Delivery",
  freightOverride: "Batch freight", interest: "Batch interest",
  paymentDisc: "Payment terms", customerType: "Customer type", priceContext: "Price context",
});

const blank = value => value === "" || value === null || value === undefined;
// Inputs hold text ("400") where the review baseline holds numbers (400), so a
// value typed back to what it was must compare equal - otherwise restoring a
// field still blocks the apply, and retyping one resubmits it. Blank stays
// distinct from zero; nested values (Construction layers) compare the same way.
const canonical = value => {
  if (blank(value)) return "";
  if (typeof value === "number" || (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value)))) {
    return Number(value);
  }
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  }
  return value;
};
const same = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));

// The identities captured when Costing opened the durable row. Missing any one
// means this is not a governed-origin review and the apply is unavailable.
export function governedRowOrigin(previewRow) {
  if (!previewRow || previewRow.durableRowId == null) return null;
  const origin = {
    batchId: previewRow.durableBatchId ?? null,
    batchContentVersion: previewRow.durableBatchContentVersion ?? null,
    rowId: previewRow.durableRowId,
    rowContentVersion: previewRow.durableRowContentVersion ?? null,
    pricingGroupId: previewRow.governedPricingGroupId ?? null,
    skuId: previewRow.governedSkuId ?? null,
    skuVersionId: previewRow.governedSkuVersionId ?? null,
    constructionVersionId: previewRow.governedConstructionVersionId ?? null,
    rowType: previewRow.durableRowType ?? null,
    materialCode: previewRow.durableMaterialCode ?? null,
  };
  const required = ["batchId", "rowId", "rowContentVersion", "pricingGroupId", "skuVersionId", "rowType"];
  return required.every(key => origin[key] != null) ? origin : null;
}

// The governed row's own returnable inputs, for the review baseline. The
// shared buildSpecFromRow/applyAddOns path reads a local row's addOns object,
// fixes fluting at 0.10 and turns a zero MOQ into blank; a durable review must
// start from what the governed row actually holds, blank and zero kept apart.
export function durableReviewInputs(previewRow, spec) {
  if (!previewRow || previewRow.durableRowId == null) return {};
  const inputs = {};
  for (const field of RETURNABLE_FIELDS) {
    if (field.spec === "flutingBCF") continue;
    inputs[field.spec] = blank(previewRow[field.spec]) ? "" : +previewRow[field.spec];
  }
  inputs.flutingBCF = blank(previewRow.fluting_bcf) ? spec.flutingBCF : +previewRow.fluting_bcf;
  return inputs;
}

function normalise(field, value) {
  if (blank(value)) return { ok: true, value: null };
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return { ok: false };
  if (field.kind === "integer" && !Number.isInteger(number)) return { ok: false };
  return { ok: true, value: number };
}

// isPP selects the one waste/conv pair this row type uses. `profile` holds the
// Batch-resolved margin/waste/conv the review opened against, and `resolved`
// is resolveSpecWasteConv(isPP) - the same inputs the local Push uses.
export function planGovernedRowReturn({ spec, baseline, origin, isPP, profile, resolved }) {
  if (!origin) return { status: "unavailable",
    message: "This review did not open from a governed Batch row." };
  if (!baseline) return { status: "unavailable", message: "The review baseline is missing." };
  const keys = new Set([...Object.keys(spec || {}), ...Object.keys(baseline || {})]);
  const changed = [...keys].filter(key => !same(spec?.[key], baseline?.[key]));
  const ownPair = isPP ? ["wastePP", "convRatePP"] : ["waste", "convRate"];
  const returnable = new Set([...RETURNABLE_FIELDS.map(field => field.spec), "margin", ...ownPair]);
  const blocked = changed.filter(key => !returnable.has(key));
  if (blocked.length) {
    const labels = [...new Set(blocked.map(key => OWNED_ELSEWHERE[key]
      || (OVERRIDE_KEYS[key] ? `${key} (not used by this row type)` : key)))];
    return { status: "blocked", fields: blocked, labels,
      message: `${labels.join(", ")} cannot change on a governed Batch row from Costing. `
        + "Specification changes need a new governed SKU or SKU Version; Batch terms change on the Batch. "
        + "Nothing was applied - close the review to discard them, or undo them here." };
  }

  const values = {};
  for (const field of RETURNABLE_FIELDS) {
    if (!changed.includes(field.spec)) continue;
    const next = normalise(field, spec[field.spec]);
    if (!next.ok) return { status: "invalid", field: field.spec,
      message: `${field.label} must be blank or a ${field.kind === "integer" ? "whole " : ""}non-negative number.` };
    values[field.api] = next.value;
  }
  if (changed.includes("margin")) {
    values.margin_override_pct = +spec.margin !== +profile.margin ? +spec.margin : null;
  }
  const wasteKey = isPP ? "wastePP" : "waste";
  const convKey = isPP ? "convRatePP" : "convRate";
  if (changed.includes(wasteKey)) {
    values.waste_override_pct = resolved.isWasteBlank || Math.abs(resolved.waste - profile.waste) <= 0.001
      ? null : resolved.waste;
  }
  if (changed.includes(convKey)) {
    values.conv_override_rate = resolved.isConvBlank || Math.abs(resolved.conv - profile.conv) <= 0.001
      ? null : resolved.conv;
  }
  if (!Object.keys(values).length) return { status: "no_change",
    message: "Nothing returnable changed in this review." };
  return {
    status: "ready",
    submitted: Object.keys(values),
    body: {
      expected_content_version: origin.rowContentVersion,
      pricing_group_id: origin.pricingGroupId,
      sku_version_id: origin.skuVersionId,
      row_type: origin.rowType,
      material_code: origin.materialCode,
      ...values,
    },
  };
}

const REFUSALS = Object.freeze({
  STALE_VERSION: ["conflict", "This Batch row changed after you opened it. Nothing was applied; your review is kept. Close the review and reopen the row to see the current values."],
  CAPABILITY_REQUIRED: ["forbidden", "You cannot change this Batch row. Nothing was applied; your review is kept."],
  TRANSITION_NOT_ALLOWED: ["refused", "This Batch row can no longer be edited (it was removed or the Batch moved on). Nothing was applied."],
  RECORD_NOT_FOUND: ["refused", "The Batch row could not be found. Nothing was applied."],
  INVALID_INPUT: ["invalid", "The Batch row refused these values. Nothing was applied."],
});

// The whole return. `commit` runs only after the governed update succeeded AND
// its read-back shows the same row at a higher content version; every other
// path leaves the review, the local preview and navigation untouched.
export async function runGovernedRowReturn({ plan, origin, confirm, request, readFreshness, commit }) {
  if (plan?.status !== "ready") return { outcome: plan?.status || "unavailable", message: plan?.message };
  if (!confirm()) return { outcome: "cancelled", message: "Apply cancelled. Nothing was changed." };
  let response;
  let data;
  try {
    response = await request(`/batches/${origin.batchId}/rows/${origin.rowId}`, plan.body);
    data = await response.json().catch(() => null);
  } catch {
    return { outcome: "network", message: "The Batch row could not be reached. Nothing was applied locally; check the row before retrying." };
  }
  if (!response.ok) {
    const [outcome, message] = REFUSALS[data?.error_code] || ["failed",
      data?.error || "The Batch row update failed. Nothing was applied locally."];
    return { outcome, code: data?.error_code || null, message: data?.error_code === "INVALID_INPUT" && data?.error
      ? `${message} ${data.error}` : message };
  }
  const batch = data?.batch || null;
  const row = (batch?.batch_rows || []).find(item => String(item.id) === String(origin.rowId)) || null;
  if (!row || !(Number(row.content_version) > Number(origin.rowContentVersion))) {
    return { outcome: "unverified", message: "The update was sent but its read-back did not show this row's new version. Close the review and reopen the row before continuing." };
  }
  let freshness;
  try { freshness = (await readFreshness(origin))?.freshness || "unknown"; } catch { freshness = "unknown"; }
  const result = { outcome: "applied", batch, row, freshness };
  commit(result);
  return result;
}

// The local consequences of a SUCCESSFUL return, as data: drop only the
// temporary preview this review created, and reopen the Batch workspace on the
// exact originating durable row. Applied by the caller inside `commit`.
export function appliedLocalEffects({ rows, previewId, origin, requestId }) {
  return {
    rows: (rows || []).filter(row => row.id !== previewId),
    workspaceRequest: { requestId, batchId: origin.batchId, mode: "row-focus", rowId: origin.rowId },
    tab: "batch",
  };
}

export function appliedMessage(freshness) {
  if (freshness === "calculation_stale" || freshness === "not_calculated") {
    return "Applied to the Batch row. Its governed price is out of date - recalculate before Send.";
  }
  if (freshness === "unknown") {
    return "Applied to the Batch row. Its calculation state could not be read - recalculate before Send.";
  }
  return `Applied to the Batch row. Governed calculation state: ${freshness}.`;
}
