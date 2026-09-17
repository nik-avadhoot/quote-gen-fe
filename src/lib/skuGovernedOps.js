// ═══════════════════════════════════════════════════════════════════════════
// src/lib/skuGovernedOps.js — SKU Master editing by due authority (pure).
//
// Canonical Amendment 04 (Product Owner rulings, 2026-09-16). The DATABASE is the
// authority for every rule here: the governed operations refuse what they must
// (capability, field class, lifecycle, stale token). This module only decides
// what the screen OFFERS, so that no control implies an authority the caller does
// not hold, and states each rule in words before the request is made.
//
//   D1  manage_sku_master at the SKU's plant is due authority; the same person may
//       propose and approve. A Maker (make_quote) may propose a SKU and versions.
//   D2  field classes: new SKU / price-driving version / version; a draft edits in
//       place; plant and Customer are never editable.
//   D3  Plant Item Code assignment is separate from publishing.
//   D4  discontinue needs a reason; replacement at the same plant and Customer;
//       reactivation clears the link; a proposal may be withdrawn.
//   D5  references are added and withdrawn, never edited.
//   D11 before the migration is live, controls are visible and DISABLED with the
//       reason "Schema activation pending".
// ═══════════════════════════════════════════════════════════════════════════
import { hasCapabilityAtPlant } from "./capabilities.js";

export const SKU_OPS_PENDING = "Schema activation pending — the governed SKU operations are prepared but not applied in this environment.";
export const SKU_OPS_FIXTURE = "Fixture preview — no governed write occurs here.";
export const SKU_APPLICABILITY_PENDING = "Schema activation pending — governed master Location applicability is prepared but not applied in this environment.";

// D2, mirroring app_private.sku_field_class exactly.
export const SKU_FIELD_CLASS = {
  length_mm: "new_sku", width_mm: "new_sku", height_mm: "new_sku", construction_version_id: "new_sku",
  spec_bs: "new_sku", spec_bct: "new_sku", spec_ect: "new_sku", box_type: "new_sku",
  stated_item_gsm: "new_sku", stated_cs: "new_sku", stated_bs: "new_sku", stated_ect: "new_sku",
  cobb_value: "price_driving_version", item_weight_kg: "price_driving_version", ups: "price_driving_version",
  item_name: "version", item_short_name: "version", print_quality: "version", print_technology: "version",
  number_of_colours: "version", colour_detail: "version", customer_spec_version: "version",
  item_family: "version", item_group: "version",
};

export const SKU_FIELD_CLASS_LABELS = {
  new_sku: "New SKU",
  price_driving_version: "Price-driving version",
  version: "New version",
};

export const PRINT_TECHNOLOGY_OPTIONS = ["Flexo", "CMYK", "Offset", "Unprinted"];
export const PRICING_PORTFOLIO_OPTIONS = ["Transactional", "Strategic"];
export const REFERENCE_KIND_OPTIONS = [
  ["customer_item_code", "Customer Item Code"], ["softcomp_code", "SoftComp Code"],
  ["legacy_plant_item_code", "Legacy Plant Item Code"], ["alias", "Alias"], ["other", "Other reference"],
];

// The editable specification, in SPEC sheet order where a sheet column exists.
export const SKU_EDIT_FIELDS = [
  { field: "item_name", label: "Item Name", sheet: "B", type: "text" },
  { field: "item_short_name", label: "Item Short Name", sheet: "C", type: "text" },
  { field: "item_family", label: "Item Family", sheet: "G", type: "text" },
  { field: "item_group", label: "Item Group", sheet: "H", type: "text" },
  { field: "construction_version_id", label: "Construction version", sheet: "I–L", type: "construction" },
  { field: "print_quality", label: "Graphics / Print Quality", sheet: "N", type: "text" },
  { field: "print_technology", label: "Print Technology", sheet: "+", type: "enum", options: PRINT_TECHNOLOGY_OPTIONS },
  { field: "number_of_colours", label: "Number of Colours", sheet: "+", type: "integer" },
  { field: "colour_detail", label: "Printing Colour", sheet: "O", type: "text" },
  { field: "cobb_value", label: "Cobb Value", sheet: "AA", type: "text" },
  { field: "length_mm", label: "ID Length (mm)", sheet: "AE", type: "number" },
  { field: "width_mm", label: "ID Width (mm)", sheet: "AF", type: "number" },
  { field: "height_mm", label: "ID Height (mm)", sheet: "AG", type: "number" },
  { field: "box_type", label: "Box type", sheet: "app", type: "text", required: true },
  { field: "stated_item_gsm", label: "Item GSM (stated)", sheet: "AS", type: "text" },
  { field: "item_weight_kg", label: "Item Weight (kg)", sheet: "AT", type: "number" },
  { field: "stated_cs", label: "Item CS (stated)", sheet: "AU", type: "text" },
  { field: "stated_bs", label: "Item BS (stated)", sheet: "AV", type: "text" },
  { field: "stated_ect", label: "Item ECT (stated)", sheet: "AW", type: "text" },
  { field: "spec_bs", label: "BS (check value)", sheet: "app", type: "number" },
  { field: "spec_bct", label: "BCT (check value)", sheet: "app", type: "number" },
  { field: "spec_ect", label: "ECT (check value)", sheet: "app", type: "number" },
  { field: "ups", label: "B/L Ups", sheet: "BH", type: "integer", min: 1, required: true },
  { field: "customer_spec_version", label: "Customer spec number and version", sheet: "DX", type: "text" },
];

export function skuOpsAuthority(profile, plantCode) {
  const manage = hasCapabilityAtPlant(profile, "manage_sku_master", plantCode);
  return { manage, propose: manage || hasCapabilityAtPlant(profile, "make_quote", plantCode) };
}

// Plants at which the caller may propose a SKU at all.
export function skuProposalPlants(profile, plantScope = []) {
  return plantScope.filter(code => skuOpsAuthority(profile, code).propose);
}

// Whether controls render live, disabled pending activation, disabled in the fixture, or not at all.
export function skuOpsMode({ fixtureOnly = false, schemaPending = {}, authority }) {
  if (!authority?.propose) return { state: "none", reason: null };
  if (fixtureOnly) return { state: "disabled", reason: SKU_OPS_FIXTURE };
  if (schemaPending.governed_operations) return { state: "disabled", reason: SKU_OPS_PENDING };
  return { state: "live", reason: null };
}

export function skuApplicabilityMode({ fixtureOnly = false, schemaPending = {}, authority }) {
  if (!authority?.manage) return { state: "none", reason: null };
  if (fixtureOnly) return { state: "disabled", reason: SKU_OPS_FIXTURE };
  if (schemaPending.location_applicability_operations) return { state: "disabled", reason: SKU_APPLICABILITY_PENDING };
  return { state: "live", reason: null };
}

// The current values of a version, flattened to the operation's field names.
export function versionFieldValues(version) {
  if (!version) return {};
  const spec = version.specification || {};
  const quote = version.quote_fields || {};
  const out = { construction_version_id: version.construction_version_id ?? null };
  for (const { field } of SKU_EDIT_FIELDS) {
    if (field === "construction_version_id") continue;
    out[field] = field in spec ? spec[field] ?? null : quote[field] ?? null;
  }
  return out;
}

// Edit the open draft in place, or start a new version from the latest approved one.
export function versionEditPlan(versions = []) {
  const ordered = [...versions].sort((a, b) => (a.version_no ?? 0) - (b.version_no ?? 0));
  const latest = ordered[ordered.length - 1] || null;
  if (!latest) return { mode: "none", version: null, base: null };
  if (!latest.approved) {
    const base = ordered.length > 1 ? ordered[ordered.length - 2] : null;
    return { mode: "edit_draft", version: latest, base };
  }
  return { mode: "new_version", version: null, base: latest };
}

// D2 per field: may the caller change it in this plan, and if not, why.
export function fieldEditability(field, plan) {
  const cls = SKU_FIELD_CLASS[field];
  const firstDraft = plan.mode === "edit_draft" && (plan.version?.version_no ?? 0) === 1;
  if (cls === "new_sku" && !firstDraft) {
    return { editable: false, cls, reason: "A change here is a NEW SKU (CDM-10). Propose a new SKU instead." };
  }
  return { editable: true, cls, reason: null };
}

function sameValue(a, b) {
  const norm = v => (v === "" || v === undefined ? null : v);
  return norm(a) === norm(b) || (norm(a) !== null && norm(b) !== null && Number(a) === Number(b) && !Number.isNaN(Number(a)));
}

// The classes of fields that differ from the base (for a new version or a later draft).
export function changedClasses(baseValues, nextValues) {
  const classes = new Set();
  for (const [field, cls] of Object.entries(SKU_FIELD_CLASS)) {
    if (field in nextValues && !sameValue(baseValues[field], nextValues[field])) classes.add(cls);
  }
  return classes;
}

// Parse one form input. Blank text is null (not ""); zero stays zero.
export function parseFieldInput(def, raw) {
  const text = raw === null || raw === undefined ? "" : String(raw);
  if (def.type === "text" || def.type === "enum") {
    const value = text.trim();
    if (!value) return def.required ? { error: `${def.label} is required.` } : { value: null };
    if (value.length > 200) return { error: `${def.label} is at most 200 characters.` };
    if (def.type === "enum" && !def.options.includes(value)) return { error: `${def.label} must be ${def.options.join(", ")}.` };
    return { value };
  }
  if (!text.trim()) return def.required || def.type === "construction" ? { error: `${def.label} is required.` } : { value: null };
  const n = Number(text.trim());
  if (!Number.isFinite(n) || n < (def.min ?? 0)) return { error: `${def.label} must be a number of ${def.min ?? 0} or more.` };
  if ((def.type === "integer" || def.type === "construction") && !Number.isInteger(n)) {
    return { error: `${def.label} must be a whole number.` };
  }
  return { value: n };
}

// Build a field set from form inputs, returning only fields that differ from `original`.
export function buildFieldChanges(inputs, original) {
  const fields = {};
  const errors = {};
  for (const def of SKU_EDIT_FIELDS) {
    if (!(def.field in inputs)) continue;
    const parsed = parseFieldInput(def, inputs[def.field]);
    if (parsed.error) { errors[def.field] = parsed.error; continue; }
    if (!sameValue(original[def.field], parsed.value)) fields[def.field] = parsed.value;
  }
  return { fields, errors };
}

// What a version change will be, in words, before it is sent.
export function versionChangeVerdict(plan, baseValues, nextFields, isPriceDriving) {
  const next = { ...baseValues, ...nextFields };
  const classes = plan.mode === "edit_draft" && (plan.version?.version_no ?? 0) === 1
    ? new Set() : changedClasses(baseValues, next);
  if (classes.has("new_sku")) return { ok: false, message: "This change is a new SKU (CDM-10) — it cannot be saved as a version." };
  if (!Object.keys(nextFields).length) return { ok: false, message: "Nothing has changed yet." };
  if (classes.has("price_driving_version") && !isPriceDriving) {
    return { ok: false, message: "A Cobb value, item weight or ups change is a price-driving version — tick price-driving." };
  }
  return { ok: true, message: plan.mode === "edit_draft"
    ? `Saves the unapproved draft v${plan.version.version_no} in place.`
    : `Creates unapproved version v${(plan.base?.version_no ?? 0) + 1}; it can be quoted now, as a Prospect can, and approved later.` };
}

// D1/D3/D4/D5: the lifecycle and record actions the screen offers for one SKU.
export function skuLifecycleActions(sku, versions = [], authority = {}) {
  if (!sku) return [];
  const plan = versionEditPlan(versions);
  const hasApproved = versions.some(v => v.approved);
  const status = sku.status;
  const actions = [];
  const add = (id, label, show, enabled, reason) => { if (show) actions.push({ id, label, enabled, reason }); };

  add("edit_version", plan.mode === "edit_draft" ? `Edit draft v${plan.version.version_no}` : "New version",
    authority.propose && plan.mode !== "none",
    !["withdrawn", "discontinued"].includes(status),
    ["withdrawn", "discontinued"].includes(status) ? `A ${status} SKU takes no new version.` : null);
  add("approve_version", plan.mode === "edit_draft" ? `Approve v${plan.version.version_no}` : "Approve version",
    authority.manage && plan.mode === "edit_draft", status !== "withdrawn",
    status === "withdrawn" ? "A withdrawn SKU takes no approval." : null);
  add("assign_code", "Assign Plant Item Code", authority.manage && status === "proposed" && !sku.plant_item_code, true, null);
  const publishBlock = !sku.plant_item_code ? "Assign the Plant Item Code first."
    : !hasApproved ? "Approve a version first."
      : !sku.pricing_portfolio ? "Record a pricing portfolio first." : null;
  add("publish", "Publish", authority.manage && status === "proposed", !publishBlock, publishBlock);
  add("discontinue", "Discontinue…", authority.manage && status === "active", true, null);
  add("reactivate", "Reactivate", authority.manage && status === "discontinued", true, null);
  add("withdraw", "Withdraw proposal…", authority.manage && status === "proposed", true, null);
  add("set_portfolio", "Change pricing portfolio…", authority.manage && status !== "withdrawn", !!sku.pricing_portfolio,
    sku.pricing_portfolio ? null : "The portfolio storage is not activated yet.");
  return actions;
}

// Replacement candidates (D4): different, active SKUs of the same plant and Customer,
// taken only from rows the caller has already been shown.
export function replacementCandidates(sku, rows = []) {
  return rows.filter(r => r.id !== sku.id && r.status === "active"
    && r.plant?.plant_code === sku.plant?.plant_code && r.party_id === sku.party_id);
}

export const SKU_OP_CONFIRM = {
  assign_code: code => `Assign "${code}" as this SKU's permanent Plant Item Code?\n\nIt can never be changed, released or reissued (CDM-09). The SKU stays Proposed until it is published.`,
  publish: code => `Publish ${code}?\n\nIt becomes Active and can be selected for quotation.`,
  discontinue: code => `Discontinue ${code}?\n\nIt can no longer be newly selected. Open Batches may finish with a warning, and a replacement is linked, never substituted (CDM-11).`,
  reactivate: code => `Reactivate ${code}?\n\nIts identity and Plant Item Code are kept, and any replacement link is cleared (kept in history).`,
  withdraw: code => `Withdraw the proposal ${code}?\n\nWithdrawn is final. A proposal already used on a Batch row cannot be withdrawn.`,
  set_portfolio: (code, portfolio) => `Reclassify ${code} as ${portfolio}?\n\nThis records a classification only - it sets no price (CDM-45).`,
  approve_version: (code, n) => `Approve version v${n} of ${code}?\n\nAn approved version is immutable; a later change is a new version.`,
  withdraw_reference: value => `Withdraw the reference "${value}"?\n\nReferences are withdrawn, never edited.`,
};

export function skuOpsBody(expected, extra = {}) {
  return { expected_content_version: expected, ...extra };
}
