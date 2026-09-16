// ═══════════════════════════════════════════════════════════════════════════
// src/lib/skuMasterModel.js — pure presentation model for the U2 SKU Master.
//
// Read-only. Everything here turns the governed `/masters/skus` responses into
// words without inventing a value:
//
//   • blank is not zero — a null value reads "Not recorded", 0 reads "0";
//   • a section the caller may not read says "Not visible to this caller", a
//     failed optional read says "Details unavailable", and a field whose
//     storage is not activated yet says so — never an empty value, a guessed
//     label, or a current-master substitute;
//   • SKU Set membership comes from the governed membership rows, never from
//     Plant Item Code text (CDM-03, CDM-44).
//
// The catalogue scope mirrors the skus SELECT policy: plant_access at a plant.
// That is a usability gate only; RLS remains the authority.
// ═══════════════════════════════════════════════════════════════════════════

// The split and panel-focus arithmetic is shared with every other split
// screen; re-exported here so this module stays the SKU Master's one model.
export { PANEL_FOCUS, SPLIT_DEFAULT, SPLIT_MAX, SPLIT_MIN, clampSplit, panelLayout } from "./panelSplit.js";

export const SKU_STATUSES = ["proposed", "active", "discontinued"];
export const SKU_SEARCH_MAX = 60;
export const SKU_SEARCH_MAX_TERMS = 5;
const SEARCH_CHARS = /^[A-Za-z0-9 ._/-]*$/;

// ── One search box, identity only ──────────────────────────────────────────
// The box matches identity factors and NOTHING else. Lifecycle, plant,
// portfolio and every specification field keep their own controls, so a
// lifecycle word never quietly filters the list from the search box. A retired
// Plant Item Code finds its SKU too (Product Owner, 2026-09-16).
export const SKU_SEARCH_FIELDS = ["plant_item_code", "item_name", "item_short_name",
  "customer_item_code", "softcomp_code", "legacy_plant_item_code", "customer_name"];

export const SEARCH_FIELD_LABELS = {
  plant_item_code: "Plant Item Code",
  item_name: "Item Name",
  item_short_name: "Item Short Name",
  customer_item_code: "Customer Item Code",
  softcomp_code: "SoftComp Code",
  legacy_plant_item_code: "Legacy Plant Item Code",
  customer_name: "Customer name",
};

// Why a field could not be searched. Each is a REASON, never silence.
const SEARCH_STATE_REASON = {
  schema_pending: "their storage is not activated yet",
  not_visible_to_caller: "you may not read the Customer master",
  unavailable: "that read did not succeed",
};

export const NOT_VISIBLE = "Not visible to this caller";
export const UNAVAILABLE = "Details unavailable";
export const PENDING = "Not stored yet · migration pending";

export const REFERENCE_KIND_LABELS = {
  customer_item_code: "Customer Item Code",
  legacy_plant_item_code: "Legacy Plant Item Code",
  softcomp_code: "SoftComp Code",
  alias: "Alias",
  other: "Other reference",
};

export const APPLICABILITY_SCOPE_LABELS = {
  master: "Master permission",
  batch_only: "Batch-only authorisation",
};

export const SET_ROLE_LABELS = { box: "Box", plate: "Plate", partition: "Partition" };

// ── CDM-45 pricing portfolio ───────────────────────────────────────────────
// A closed, mandatory vocabulary, RECORDED ONLY. Nothing in this module, the
// costing engine or any rate path reads it to decide a price: it is shown and
// it can be filtered on, and that is the whole of its behaviour until an
// approved rate mechanism consumes it (Amendment 03 C-04, Amendment 01 A-06).
//
// There is deliberately no edit affordance anywhere. An administrator may
// reclassify a SKU (C-03), but no governed write operation exists for the SKU
// Master at all, so a control here would promise one that does not.
export const PRICING_PORTFOLIO_NOTE =
  "Recorded only — no rate, margin or discount is derived from the pricing portfolio.";

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

export function skuSearchTerms(q) {
  const seen = new Set();
  const terms = [];
  for (const word of (q || "").trim().split(/\s+/).filter(Boolean)) {
    const key = word.toLowerCase();
    if (!seen.has(key)) { seen.add(key); terms.push(word); }
  }
  return terms;
}

// The same character, length and word rules the route enforces, so the box
// refuses locally exactly what the server would refuse.
export function skuSearchValidation(q) {
  const value = (q || "").trim();
  if (value.length > SKU_SEARCH_MAX) return `Search is limited to ${SKU_SEARCH_MAX} characters.`;
  if (!SEARCH_CHARS.test(value)) return "Search with letters, digits, spaces or . _ / - only.";
  if (skuSearchTerms(value).length > SKU_SEARCH_MAX_TERMS) {
    return `Search is limited to ${SKU_SEARCH_MAX_TERMS} words.`;
  }
  return null;
}

export function searchScopeHint() {
  return `Searches identity only — ${SKU_SEARCH_FIELDS.map(f => SEARCH_FIELD_LABELS[f]).join(", ")}. `
    + "Every word must match somewhere, so words narrow the list. Lifecycle, plant and specification "
    + "have their own controls. Press Enter to search.";
}

// Names the identity fields that were NOT searched, and why. Returning null
// means all seven were searched - never that the question was not asked.
export function searchCoverageNotice(search) {
  if (!search || search.executed !== true) return null;
  const states = search.fields || {};
  const byReason = {};
  for (const field of SKU_SEARCH_FIELDS) {
    const state = states[field] || "unavailable";
    if (state === "searched") continue;
    (byReason[state] ||= []).push(SEARCH_FIELD_LABELS[field]);
  }
  const parts = Object.entries(byReason).map(([state, names]) =>
    `${listWords(names)} ${names.length === 1 ? "was" : "were"} not searched because `
    + `${SEARCH_STATE_REASON[state] || "that read did not succeed"}`);
  if (!parts.length) return null;
  return `${parts.join("; ")}. A SKU matching only on those was not found here.`;
}

export function searchScanNotice(search) {
  return search?.scan_truncated === true
    ? "More SKUs matched than were scanned, so this answer is partial — add a word to narrow it."
    : null;
}

function listWords(names) {
  if (names.length <= 1) return names[0] || "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

// Four different empty answers, never one. "Nothing matched" and "nothing is
// visible to you" are different facts, and RLS makes absent and hidden the
// same answer, so the wording says which claim is actually being made.
export function skuEmptyState({ search, anyFilter, plantScope } = {}) {
  if (!(plantScope || []).length) {
    return { title: "No plant is in your access scope.",
      hint: "The SKU Master lists SKUs at plants where you hold plant access. That is a visibility "
        + "limit, not an empty master." };
  }
  const coverage = searchCoverageNotice(search);
  if (search?.executed === true) {
    const words = (search.terms || []).map(t => `"${t}"`).join(" + ");
    return { title: `No SKU visible to you matches ${words || "that search"}.`,
      hint: coverage || `All ${SKU_SEARCH_FIELDS.length} identity factors were searched. Lifecycle, plant `
        + "and specification are not searched from this box — use their own controls. A SKU you cannot "
        + "see reads the same as one that does not exist." };
  }
  if (anyFilter) {
    return { title: "No governed SKU visible to you matches these filters.",
      hint: "Clear a filter to widen the answer. A SKU you cannot see reads the same as one that does not exist." };
  }
  return { title: "No governed SKUs are visible to you here.",
    hint: "SKUs appear here once proposed or published for a plant you can access." };
}

// Only filters that carry a value reach the query string; the server applies
// them in the database - including the identity search - so nothing unrelated
// is loaded and filtered here, and no other plant's rows are ever fetched.
export function skuCatalogueQuery({ plant, status, q, portfolio, familyId, partyId } = {}) {
  const params = new URLSearchParams();
  if (plant) params.set("plant", plant);
  if (status) params.set("status", status);
  if (portfolio) params.set("portfolio", portfolio);
  const search = (q || "").trim();
  if (search) params.set("q", search);
  if (familyId) params.set("family_id", String(familyId));
  if (partyId) params.set("party_id", String(partyId));
  const text = params.toString();
  return text ? `/masters/skus?${text}` : "/masters/skus";
}

export function visibilityText(visibility) {
  if (visibility === "visible") return null;
  if (visibility === "schema_pending") return PENDING;
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
    visibility: data?.detail_visibility || {},
    schemaPending: data?.schema_pending || {},
    search: data?.search || null,
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

// ── CDM-43 field cells ─────────────────────────────────────────────────────
// One normalised row shape for both the catalogue and the detail response, so
// the grid and the deep-dive render every field through the same rule.

export function specRowFromCatalogue(row) {
  return {
    id: row.id, plant_item_code: row.plant_item_code, status: row.status, plant: row.plant,
    pricing_portfolio: row.pricing_portfolio ?? null,
    customer: row.customer ?? null, family: row.family ?? null, party_id: row.party_id,
    replacement_sku_id: row.replacement_sku_id, content_version: row.content_version,
    version: row.latest_version ?? null, version_count: row.version_count ?? 0,
    construction: row.construction ?? null, references: row.references ?? null,
    locations: row.locations ?? null, sets: row.sets ?? null,
  };
}

export function specRowFromDetail(detail) {
  const versions = detail?.versions || [];
  const latest = versions[versions.length - 1] || null;
  const references = {};
  for (const r of detail?.external_references || []) {
    if (r.status === "active") (references[r.reference_kind] ||= []).push(r.reference_value);
  }
  return {
    ...(detail?.sku || {}),
    version: latest ? {
      id: latest.id, version_no: latest.version_no, approved: latest.approved,
      is_price_driving: latest.is_price_driving, construction_version_id: latest.construction_version_id,
      ...(latest.specification || {}), quote_fields: latest.quote_fields ?? null,
    } : null,
    version_count: versions.length,
    construction: latest?.construction ?? null,
    references,
    locations: (detail?.location_applicability || []).map(a => ({
      location_id: a.location_id, location_code: a.location?.location_code ?? null, scope: a.scope, status: a.status,
    })),
    sets: detail?.sets ?? null,
  };
}

const QUOTE_KEY = {
  B: "item_name", C: "item_short_name", G: "item_family", H: "item_group", N: "print_quality",
  PT: "print_technology", NC: "number_of_colours", O: "colour_detail", AA: "cobb_value",
  AS: "stated_item_gsm", AT: "item_weight_kg", AU: "stated_cs", AV: "stated_bs", AW: "stated_ect",
  DX: "customer_spec_version",
};
const VERSION_KEY = { AE: "length_mm", AF: "width_mm", AG: "height_mm", BH: "ups" };
const LAYER_KEY = {
  AI: ["top", "bf"], AJ: ["top", "gsm"], AK: ["flute_1", "bf"], AL: ["flute_1", "gsm"],
  AM: ["back_1", "bf"], AN: ["back_1", "gsm"], AO: ["flute_2", "bf"], AP: ["flute_2", "gsm"],
  AQ: ["back_2", "bf"], AR: ["back_2", "gsm"],
};
const CONSTRUCTION_KEY = { I: "ply", K: "flute_f1", L: "flute_f2" };

export const SPEC_FIELD_KEYS = [
  "A", "B", "C", "D", "E", "F", "G", "H",
  ...Object.keys(CONSTRUCTION_KEY), "J", ...Object.keys(LAYER_KEY),
  ...Object.keys(QUOTE_KEY).filter(k => !["B", "C", "G", "H"].includes(k)),
  ...Object.keys(VERSION_KEY), "LC", "PF", "DZ",
];

const cell = (state, text, title) => ({ state, text, title: title || text });

function valueCell(raw) {
  if (!isRecorded(raw)) return cell("blank", "Not recorded");
  if (raw === "NA") return cell("na", "NA");
  if (typeof raw === "number") return cell("value", formatMeasure(raw));
  return cell("value", String(raw));
}

function hiddenCell(visibility) {
  // A response that does not report a section's visibility has no such gate.
  if (visibility === undefined) return null;
  const text = visibilityText(visibility);
  return text ? cell(visibility === "schema_pending" ? "pending" : visibility === "not_visible_to_caller" ? "hidden" : "unavailable", text) : null;
}

// Returns { state, text, title }. state is value · blank · na · hidden ·
// unavailable · pending, and every state other than value is worded.
export function specFieldCell(key, row, ctx = {}) {
  const vis = ctx.visibility || {};
  const pending = ctx.schemaPending || {};
  if (!row) return cell("unavailable", UNAVAILABLE);

  if (key in QUOTE_KEY) {
    if (pending.quote_fields) return cell("pending", PENDING);
    if (!row.version) return cell("blank", "No SKU version");
    if (row.version.quote_fields == null) return cell("pending", PENDING);
    return valueCell(row.version.quote_fields[QUOTE_KEY[key]]);
  }
  if (key in VERSION_KEY) {
    if (!row.version) return cell("blank", "No SKU version");
    return valueCell(row.version[VERSION_KEY[key]]);
  }
  if (key in CONSTRUCTION_KEY || key in LAYER_KEY || key === "J") {
    const hidden = hiddenCell(vis.construction);
    if (hidden) return hidden;
    if (!row.version) return cell("blank", "No SKU version");
    const c = row.construction;
    if (!c) return cell("unavailable", `Construction version #${row.version.construction_version_id} · ${UNAVAILABLE}`);
    if (key === "J") {
      const flutes = [c.flute_f1, c.flute_f2].filter(f => isRecorded(f) && f !== "NA");
      return flutes.length ? cell("value", flutes.join("")) : cell("blank", "Not recorded");
    }
    if (key in CONSTRUCTION_KEY) return valueCell(c[CONSTRUCTION_KEY[key]]);
    const [layer, part] = LAYER_KEY[key];
    return valueCell(c.layers?.[layer]?.[part]);
  }
  switch (key) {
    case "D":
      return row.plant_item_code ? cell("value", row.plant_item_code) : cell("blank", "Plant Item Code not assigned");
    case "LC":
      return valueCell(row.status);
    case "PF":
      // Pending storage is not a blank portfolio: CDM-45 makes one mandatory,
      // so "nothing recorded" can only mean the migration is not applied.
      if (pending.pricing_portfolio) return cell("pending", PENDING);
      return valueCell(row.pricing_portfolio);
    case "E": {
      const hidden = hiddenCell(vis.customer);
      if (hidden) return hidden;
      return row.customer ? cell("value", customerLabel(row.customer, "visible")) : cell("unavailable", UNAVAILABLE);
    }
    case "F":
    case "DZ": {
      if (row.references == null) return cell("unavailable", UNAVAILABLE);
      const list = row.references[key === "F" ? "customer_item_code" : "softcomp_code"] || [];
      return list.length ? cell("value", list.join(", ")) : cell("blank", "Not recorded");
    }
    case "A": {
      if (row.locations == null) return cell("unavailable", UNAVAILABLE);
      if (!row.locations.length) return cell("blank", "No Location applicability recorded");
      const hiddenReason = vis.locations === undefined ? null : visibilityText(vis.locations);
      const text = row.locations.map(l => l.location_code
        || `Location #${l.location_id}${hiddenReason ? ` · ${hiddenReason}` : ""}`).join(", ");
      return cell(row.locations.some(l => l.location_code) ? "value" : hiddenReason ? "hidden" : "unavailable", text);
    }
    default:
      return cell("unavailable", UNAVAILABLE);
  }
}

// Short text for a dense grid cell; the full wording stays in the title.
export function gridCellText(c) {
  if (c.state === "value" || c.state === "na") return c.text;
  if (c.state === "blank") return "";
  if (c.state === "pending") return "pending";
  if (c.state === "hidden") return "not visible";
  return "unavailable";
}

export function schemaPendingNotice(pending) {
  const parts = [];
  if (pending?.quote_fields) parts.push("item names, printing, Cobb and stated strength fields");
  if (pending?.sku_sets) parts.push("SKU Sets");
  if (pending?.pricing_portfolio) parts.push("the pricing portfolio");
  if (!parts.length) return null;
  return `The SKU Master storage for ${parts.join(" and ")} is not activated yet, so those fields show as pending rather than blank.`;
}

// ── CDM-44 SKU Sets ────────────────────────────────────────────────────────

export function qtyPerSetText(qty) {
  return isRecorded(qty) ? `× ${formatMeasure(qty)}` : "quantity per set not recorded";
}

export function skuSetView(sets, currentSkuId) {
  return (sets || []).map(s => ({
    id: s.id, label: s.label, status: s.status,
    role: SET_ROLE_LABELS[s.role] || s.role, qty: qtyPerSetText(s.qty_per_set), memberStatus: s.member_status,
    members: (s.members || []).map(m => ({
      skuId: m.sku_id, isCurrent: m.sku_id === currentSkuId,
      code: m.sku_visible === false ? `SKU #${m.sku_id} · ${NOT_VISIBLE}` : plantItemCodeLabel(m.plant_item_code),
      role: SET_ROLE_LABELS[m.role] || m.role, qty: qtyPerSetText(m.qty_per_set), status: m.status,
      skuStatus: m.sku_status, visible: m.sku_visible !== false,
    })),
  }));
}

// Grid grouping by governed membership. A SKU in no set, or whose set read is
// unavailable, is listed under its own honest heading, never guessed into one.
export function skuSetGroups(rows) {
  const order = [];
  const byKey = {};
  for (const row of rows || []) {
    let key, label;
    if (row.sets == null) { key = "__unavailable"; label = "SKU Set membership unavailable"; }
    else if (!row.sets.length) { key = "__none"; label = "Not in a SKU Set"; }
    else { key = `set-${row.sets[0].id}`; label = `SKU Set ${row.sets[0].label} · ${row.sets[0].status}`; }
    if (!byKey[key]) { byKey[key] = { key, label, rows: [] }; order.push(key); }
    byKey[key].rows.push(row);
  }
  return order.map(k => byKey[k]);
}

