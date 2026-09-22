// ═══════════════════════════════════════════════════════════════════════════
// src/lib/sectorActions.js — U5 governed Sector master helpers.
//
// Pure, framework-free request-body builders, row normalisation and
// confirm-dialog copy for the governed Sector master, kept separate from
// DefaultsTab.jsx for the same reason lib/customerFamilyActions.js is kept
// separate from CustomerFamiliesScreen.jsx: this repo has no DOM/UI harness
// (see CLAUDE.md), so the rules need a surface a Node fixture can exercise —
// scripts/sector-actions-fixtures.mjs.
//
// Nothing here calls the network. Every function takes plain values and
// returns a plain object (a request body), a plain row, or a string.
//
// ⚠️ WHAT THIS REPLACED. Commercial Policies used to edit a browser-local
// `cbb_sectors` list in localStorage that NO other screen read. A Sector added
// there never appeared in the Customer Families dropdown, because that
// dropdown reads the governed `public.sectors` table. There is now one Sector
// master and this is its client half.
// ═══════════════════════════════════════════════════════════════════════════

// The six commercial values one sector_version carries. Waste and conversion
// are nullable — blank means "inherit the calculation default" (CDM-19) — but
// margin_pct is NOT NULL by the Sector Margin ruling: a default target margin
// is a property every Sector maintains, so blank is not a state it can be in.
export const COMMERCIAL_FIELDS = [
  "wasteCBB", "wastePP", "convBox", "convPP", "margin", "specLang",
];

export function sectorCodeIsBlank(code) {
  return typeof code !== "string" || code.trim() === "";
}

export function sectorNameIsBlank(name) {
  return typeof name !== "string" || name.trim() === "";
}

// A usability pre-check, NOT the authority: the Flask route refuses a missing
// margin with INVALID_INPUT and app_private.propose_sector raises 22023 for
// one regardless of what any client sends.
export function marginIsMissing(margin) {
  if (margin === null || margin === undefined || margin === "") return true;
  return !Number.isFinite(Number(margin));
}

// Blank stays blank (inherit); a value becomes a number. Anything unparseable
// is sent as-is so the server's own validator, not this file, decides.
function numberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : value;
}

function commercialsBody(row) {
  return {
    waste_cbb_pct: numberOrNull(row?.wasteCBB),
    waste_pp_pct: numberOrNull(row?.wastePP),
    conv_box_rate: numberOrNull(row?.convBox),
    conv_pp_rate: numberOrNull(row?.convPP),
    margin_pct: numberOrNull(row?.margin),
    spec_lang: (row?.specLang || "").trim(),
  };
}

export function proposeSectorBody(row) {
  return {
    sector_code: (row?.code || "").trim().toUpperCase(),
    name: (row?.name || "").trim(),
    ...commercialsBody(row),
  };
}

export function reviseSectorCommercialsBody(row, expectedVersionNo) {
  return { expected_version_no: expectedVersionNo, ...commercialsBody(row) };
}

export function renameSectorBody(name) {
  return { name: (name || "").trim() };
}

export function setSectorStatusBody(status) {
  return { status };
}

// ── normalisation ─────────────────────────────────────────────────────────
//
// The API returns the identity row plus its approved version; the grid edits
// one flat row. `versionNo` is carried through because it is the CAS token
// the revise operation checks — a row without it cannot be saved.

export function sectorRowFromApi(sector) {
  const version = sector?.version || null;
  return {
    id: sector?.id ?? null,
    code: sector?.sector_code ?? "",
    name: sector?.name ?? "",
    status: sector?.status ?? "active",
    versionNo: version?.version_no ?? null,
    wasteCBB: version?.waste_cbb_pct ?? "",
    wastePP: version?.waste_pp_pct ?? "",
    convBox: version?.conv_box_rate ?? "",
    convPP: version?.conv_pp_rate ?? "",
    margin: version?.margin_pct ?? "",
    specLang: version?.spec_lang ?? "",
    // An active Sector with no approved version cannot resolve in Costing.
    // Surfaced rather than hidden: it means the master is genuinely broken.
    unversioned: !version,
  };
}

export function sectorRowsFromApi(sectors) {
  return (sectors || []).map(sectorRowFromApi)
    .sort((a, b) => String(a.code).localeCompare(String(b.code)));
}

// Only the six commercial values are compared. Name is saved by its own
// operation (a rename is not a new version), so a pending name edit must not
// arm the commercial Save button or the screen would mint an empty version.
export function commercialsAreDirty(row, original) {
  if (!row || !original) return false;
  return COMMERCIAL_FIELDS.some(field => {
    const a = row[field] ?? "";
    const b = original[field] ?? "";
    if (a === "" || b === "") return String(a) !== String(b);
    if (field === "specLang") return String(a).trim() !== String(b).trim();
    return Number(a) !== Number(b);
  });
}

export function nameIsDirty(row, original) {
  return String(row?.name ?? "").trim() !== String(original?.name ?? "").trim();
}

// ── confirm-dialog copy ───────────────────────────────────────────────────
//
// Names the entity and states what the schema actually makes true. No Family D
// table has a DELETE policy (CDM-31), so deactivation is the only exit and the
// copy must not imply otherwise.

export function deactivateSectorConfirmMessage(name) {
  return `Deactivate "${name}"? It stays on every Batch and Quote that already uses it and keeps `
    + `its version history, but it can no longer be chosen for a new Customer Family. `
    + `Sectors are never deleted.`;
}

export function reactivateSectorConfirmMessage(name) {
  return `Reactivate "${name}"? It becomes selectable again for new Customer Families.`;
}

export function reviseConfirmMessage(name, versionNo) {
  return `Save new commercial values for "${name}"? This approves version ${(versionNo || 0) + 1} `
    + `and supersedes version ${versionNo}. An approved version is never edited in place, so the `
    + `current one is kept in history.`;
}
