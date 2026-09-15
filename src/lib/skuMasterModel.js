// ═══════════════════════════════════════════════════════════════════════════
// src/lib/skuMasterModel.js — pure presentation model for the U2 SKU Master.
//
// Read-only. Everything here turns the governed `/masters/skus` responses into
// words without inventing a value:
//
//   • blank is not zero — a null dimension reads "Not recorded", 0 reads "0";
//   • a section the caller may not read says "Not visible to this caller", a
//     failed optional read says "Details unavailable" — never an empty value,
//     a guessed label, or a current-master substitute;
//   • Printing Technology and colour count are declared unrecorded by the
//     backend and are never borrowed from the local Costing metadata.
//
// The catalogue scope mirrors the skus SELECT policy: plant_access at a plant.
// That is a usability gate only; RLS remains the authority.
// ═══════════════════════════════════════════════════════════════════════════

export const SKU_STATUSES = ["proposed", "active", "discontinued"];
export const SKU_SEARCH_MAX = 60;
const SEARCH_CHARS = /^[A-Za-z0-9 ._/-]*$/;

export const NOT_VISIBLE = "Not visible to this caller";
export const UNAVAILABLE = "Details unavailable";

export const REFERENCE_KIND_LABELS = {
  customer_item_code: "Customer Item Code",
  legacy_plant_item_code: "Legacy Plant Item Code",
  alias: "Alias",
  other: "Other reference",
};

export const APPLICABILITY_SCOPE_LABELS = {
  master: "Master permission",
  batch_only: "Batch-only authorisation",
};

export const UNRECORDED_FIELD_LABELS = {
  printing_technology: "Printing Technology",
  number_of_colours: "Number of colours",
};

export function skuPlantScope(profile) {
  const byPlant = profile?.plant_capabilities;
  if (!byPlant || typeof byPlant !== "object") return [];
  return Object.entries(byPlant)
    .filter(([, caps]) => Array.isArray(caps) && caps.includes("plant_access"))
    .map(([code]) => code)
    .sort();
}

export function canOpenSkuMaster(profile) {
  return skuPlantScope(profile).length > 0;
}

export function skuSearchValidation(q) {
  const value = (q || "").trim();
  if (value.length > SKU_SEARCH_MAX) return `Search is limited to ${SKU_SEARCH_MAX} characters.`;
  if (!SEARCH_CHARS.test(value)) return "Search Plant Item Codes with letters, digits, spaces or . _ / - only.";
  return null;
}

// Only filters that carry a value reach the query string; the server applies
// them in the database, so nothing unrelated is loaded and filtered here.
export function skuCatalogueQuery({ plant, status, q, familyId, partyId } = {}) {
  const params = new URLSearchParams();
  if (plant) params.set("plant", plant);
  if (status) params.set("status", status);
  const search = (q || "").trim();
  if (search) params.set("q", search);
  if (familyId) params.set("family_id", String(familyId));
  if (partyId) params.set("party_id", String(partyId));
  const text = params.toString();
  return text ? `/masters/skus?${text}` : "/masters/skus";
}

export function visibilityText(visibility) {
  if (visibility === "visible") return null;
  return visibility === "not_visible_to_caller" ? NOT_VISIBLE : UNAVAILABLE;
}

export function isRecorded(value) {
  return value !== null && value !== undefined && value !== "";
}

export function formatMeasure(value, unit = "") {
  if (!isRecorded(value)) return "Not recorded";
  const n = Number(value);
  return `${Number.isFinite(n) ? n : value}${unit}`;
}

export function dimensionSummary(spec) {
  if (!spec) return "No version recorded";
  const parts = [["L", spec.length_mm], ["W", spec.width_mm], ["H", spec.height_mm]];
  if (parts.every(([, v]) => !isRecorded(v))) return "Dimensions not recorded";
  return parts.map(([k, v]) => `${k} ${isRecorded(v) ? formatMeasure(v) : "—"}`).join(" × ") + " mm";
}

export function plantItemCodeLabel(code) {
  return code || "Plant Item Code not assigned";
}

export function plantLabel(plant) {
  return plant ? `${plant.plant_code} · ${plant.name}` : UNAVAILABLE;
}

export function customerLabel(customer, visibility) {
  const hidden = visibilityText(visibility);
  if (hidden) return hidden;
  if (!customer) return UNAVAILABLE;
  return `${customer.customer_code || "No Customer Code"} · ${customer.display_name}`;
}

export function familyLabel(family, visibility) {
  const hidden = visibilityText(visibility);
  if (hidden) return hidden;
  if (!family) return "No current Family";
  return `${family.group_customer_code ? `${family.group_customer_code} · ` : ""}${family.name}`;
}

export function constructionLabel(version, visibility) {
  const c = version?.construction;
  if (c) {
    const stack = [c.ply != null ? `${c.ply}-ply` : null, c.flute_f1 && `F1 ${c.flute_f1}`,
      c.flute_f2 && `F2 ${c.flute_f2}`, c.board_gsm != null ? `board ${c.board_gsm} gsm` : null]
      .filter(Boolean).join(" · ");
    return `${c.construction_code || "Construction"} v${c.version_no}${stack ? ` · ${stack}` : ""}`;
  }
  const reason = visibilityText(visibility) || UNAVAILABLE;
  return `Construction version #${version?.construction_version_id} · ${reason}`;
}

export function adoptionLabel(version, visibility) {
  if (visibility !== "visible" || version?.plant_adoption == null) return "Plant adoption unavailable";
  const statuses = version.plant_adoption;
  if (!statuses.length) return "Not adopted at this SKU's plant";
  if (statuses.includes("adopted")) return "Adopted at this SKU's plant";
  return `Plant adoption: ${statuses.join(", ")}`;
}

export function applicabilityLocationLabel(entry, visibility) {
  if (entry?.location) return entry.location.location_code || "Location code not assigned";
  const reason = visibilityText(visibility) || UNAVAILABLE;
  return `Location #${entry?.location_id} · ${reason}`;
}

export function replacementLabel(lineage, replacementSkuId) {
  if (!replacementSkuId) return null;
  if (lineage?.replaced_by) return `Replaced by ${plantItemCodeLabel(lineage.replaced_by.plant_item_code)}`;
  return lineage?.replacement_visible === false
    ? `Replacement recorded · ${NOT_VISIBLE}` : `Replacement recorded · ${UNAVAILABLE}`;
}

export function unrecordedFieldsNotice(fields) {
  const names = (fields || []).map(f => UNRECORDED_FIELD_LABELS[f] || f);
  if (!names.length) return null;
  return `${names.join(" and ")} ${names.length === 1 ? "is" : "are"} not yet recorded on governed SKU versions.`;
}

export function latestVersionFacts(row) {
  const v = row?.latest_version;
  if (!v) return ["No versions"];
  return [
    `v${v.version_no} of ${row.version_count}`,
    v.approved ? "approved" : "unapproved",
    dimensionSummary(v),
    v.box_type || "Box type not recorded",
  ];
}

export function normaliseSkuCatalogue(data) {
  return {
    skus: Array.isArray(data?.skus) ? data.skus : [],
    truncated: data?.truncated === true,
    limit: data?.limit ?? null,
    customerVisibility: data?.detail_visibility?.customer || "unavailable",
    plantScope: Array.isArray(data?.plant_scope) ? data.plant_scope : [],
  };
}

export function specificationRows(spec) {
  const s = spec || {};
  return [
    ["Length", formatMeasure(s.length_mm, " mm")],
    ["Width", formatMeasure(s.width_mm, " mm")],
    ["Height", formatMeasure(s.height_mm, " mm")],
    ["Box type", isRecorded(s.box_type) ? s.box_type : "Not recorded"],
    ["Ups", formatMeasure(s.ups)],
    ["BS", formatMeasure(s.spec_bs)],
    ["BCT", formatMeasure(s.spec_bct)],
    ["ECT", formatMeasure(s.spec_ect)],
  ];
}
