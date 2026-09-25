// ═══════════════════════════════════════════════════════════════════════════
// src/lib/batchRowImport.js — resolving free-text local grid rows into
// governed durable-row identities, for the "Import local rows" action in
// BatchWorkspacePanel's Products section.
//
// WHY THIS EXISTS. `+ New Batch` (the ordinary, non-promotion path) clears the
// in-memory local grid (useCostingBatchBridge.js completeNewBatchStart) but
// archives whatever cbb_batch_autosave held into ONE-SLOT cbb_batch_previous
// first. That archive has had no reader anywhere in the app — a Maker who
// typed 15 SKUs into the local grid, then created a governed Batch, landed in
// a workspace with zero rows and no way back to what they typed except
// retyping every row, one at a time, through "+ Add product".
//
// WHAT A LOCAL ROW IS NOT. It carries no governed identity — `matCode` and
// `constructionCode` are free text the Maker typed, matched only against a
// browser-local construction library (BatchGrid.jsx), never against SKU
// Master. A durable row requires an established `sku_id` + `sku_version_id`
// (lib/batchRowModel.js, BatchRowEditor). So importing is IDENTITY
// RESOLUTION, not a copy: every local row is either matched to an existing
// governed SKU, proposed as a new one (reusing the same governed
// `proposeSku` write the "+ Create proposed SKU" button already makes), or
// left for the Maker to resolve by hand — never silently guessed.
// ═══════════════════════════════════════════════════════════════════════════
import { matchScore } from "./batchQuickCreate.js";

export const IMPORTABLE_ARCHIVE_KEY = "cbb_batch_previous";

// A local row counts as "real" only once it has an identifying material code
// or product label AND at least one non-zero dimension — an untouched blank
// grid row (BatchGrid always keeps one trailing blank row for entry) must not
// be offered as something to import.
export function isImportableLocalRow(row) {
  if (!row) return false;
  const hasLabel = Boolean((row.matCode || row.product || "").trim());
  const hasDimension = [row.L, row.W, row.H].some(value => Number(value) > 0);
  return hasLabel && hasDimension;
}

export function readImportableArchive(getItem) {
  const raw = getItem(IMPORTABLE_ARCHIVE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    const rows = (parsed?.rows || []).filter(isImportableLocalRow);
    if (!rows.length) return null;
    return { rows, savedAt: parsed.archivedAt || parsed.ts || null };
  } catch {
    return null;
  }
}

const ITEM_TYPE_TO_ROW_TYPE = { Box: "box", Plate: "plate", "Part-L": "part_l", "Part-W": "part_w" };
export const localRowType = row => ITEM_TYPE_TO_ROW_TYPE[row?.itemType] || "other";

// SKU MATCH THRESHOLD IS DELIBERATELY HIGHER than the 0.34 duplicate-warning
// threshold in batchQuickCreate.js. There, a low-confidence match is shown as
// a caution beside a create action the Maker still controls. Here, a
// low-confidence "match" would auto-select which existing governed SKU a row
// is silently attached to — a wrong pick corrupts pricing identity, not just
// a display label. Below this bar the row is left unresolved instead.
export const SKU_MATCH_THRESHOLD = 0.6;

// Best governed SKU/Version match for a local row's typed matCode/product,
// scored against plant_item_code and the SKU's first Version's item_name.
// Returns null rather than a weak guess — see the threshold note above.
export function matchLocalRowToSku(row, skus) {
  const needle = (row?.matCode || row?.product || "").trim();
  if (!needle) return null;
  let best = null;
  for (const sku of skus || []) {
    const version = sku.versions?.[0];
    if (!version) continue;
    const score = Math.max(
      matchScore(needle, sku.plant_item_code || ""),
      matchScore(needle, version.item_name || ""));
    if (score >= SKU_MATCH_THRESHOLD && (!best || score > best.score)) best = { score, sku, version };
  }
  return best;
}

// Exact match only, by design: a Construction identity feeds cost formulas
// directly (waste, board spec), so this never falls back to fuzzy scoring the
// way the SKU match above does. No match => the row needs a manual pick.
export function matchLocalRowToConstruction(row, constructionOptions) {
  const code = (row?.constructionCode || "").trim().toLocaleLowerCase();
  if (!code) return null;
  return (constructionOptions || [])
    .find(option => (option.construction?.construction_code || "").toLocaleLowerCase() === code) || null;
}

// Resolves what an import row needs before it can be created: an existing
// governed SKU (skip proposal), or a Construction identity to propose a new
// one from, or neither (stays unresolved until the Maker picks one by hand).
export function resolveLocalRowIdentity(row, { skus, constructionOptions }) {
  const skuMatch = matchLocalRowToSku(row, skus);
  if (skuMatch) return { kind: "matched", skuId: skuMatch.sku.id, skuVersionId: skuMatch.version.id,
    label: `${skuMatch.sku.plant_item_code || `SKU #${skuMatch.sku.id}`} · ${skuMatch.version.item_name || "no item name"}` };
  const constructionMatch = matchLocalRowToConstruction(row, constructionOptions);
  if (constructionMatch) return { kind: "propose", constructionVersionId: constructionMatch.id,
    label: `New SKU on ${constructionMatch.construction?.construction_code || `Construction #${constructionMatch.construction_id}`}` };
  return { kind: "unresolved", label: "Needs a Construction or SKU selection" };
}

// The body `proposeSku` (BatchWorkspacePanel) needs to mint a governed SKU
// from a local row whose Construction resolved but whose SKU did not.
export function localRowProposalFields(row, constructionVersionId) {
  const rowType = localRowType(row);
  return {
    item_name: (row.matCode || row.product || "Untitled item").trim().slice(0, 200),
    construction_version_id: constructionVersionId,
    length_mm: Number(row.L) || 0,
    width_mm: Number(row.W) || 0,
    height_mm: Number(row.H) || 0,
    box_type: row.boxType || (rowType === "box" ? "RSC" : "PP"),
    ups: Number(row.ups) || 1,
  };
}

const numericOrNull = value => value === "" || value === null || value === undefined ? null : Number(value);

// The POST body for `/batches/:id/rows`, once an sku_id/sku_version_id is
// known (matched or freshly proposed) and a Pricing Group is chosen. Mirrors
// BatchRowEditor's onSave (ROW_NUMERIC_FIELDS) field-for-field.
export function localRowToDurableRowBody(row, { skuId, skuVersionId, pricingGroupId }) {
  return {
    pricing_group_id: pricingGroupId,
    sku_id: skuId,
    sku_version_id: skuVersionId,
    row_type: localRowType(row),
    material_code: (row.matCode || "").trim() || null,
    waste_override_pct: numericOrNull(row.wasteConv_waste),
    conv_override_rate: numericOrNull(row.wasteConv_conv),
    margin_override_pct: numericOrNull(row.marginOverride),
    addon_printing: numericOrNull(row.printing),
    addon_stitching: numericOrNull(row.stitching),
    addon_coating: numericOrNull(row.coating),
    addon_handling: numericOrNull(row.handling),
    addon_moq_charge: numericOrNull(row.moqCharge),
    addon_packing: numericOrNull(row.packing),
    addon_other: numericOrNull(row.other),
    addon_unloading: numericOrNull(row.unloading),
    fluting_bcf: numericOrNull(row.fluting_bcf),
  };
}
