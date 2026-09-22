// ═══════════════════════════════════════════════════════════════════════════
// src/lib/governedConstructionCatalogue.js — governed Constructions, in the
// shape the costing engine and the shared picker already read.
//
// Product Owner ruling 2026-09-22 (beta issue log item 2): new Constructions go
// to the GOVERNED library, and the local A–Z codes (A, B, C … then C26) are
// retired. CDM-12 gives the identity this catalogue presents: a permanent
// `CON-000125` allocated at PUBLICATION plus a non-unique descriptive name.
//
// ── WHY MAPPING, NOT A SECOND ENGINE ──────────────────────────────────────
// engine/costing.js reads a construction as {code, name, ply, flute_F1,
// flute_F2, layers:{TOP|F1|L1|F2|L2:{code,gsm}}, board_gsm}. A governed
// construction_version holds exactly those facts under database column names.
// This module renames them and nothing else: no default is invented, no blank
// becomes a zero, and a version missing a layer keeps it missing so
// isUsableConstruction() still refuses it rather than costing a hole.
//
// ── WHAT IS DELIBERATELY ABSENT ───────────────────────────────────────────
// boxType, spec_bs, spec_bct and spec_ect are NOT here. CDM-13 puts them on the
// SKU, not on the Construction, and the governed tables do not carry them. The
// picker therefore leaves those row fields alone instead of patching them from
// a construction, which is what the local library used to do.
//
// ── ADOPTION IS THE GATE ──────────────────────────────────────────────────
// CDM-12: formal published use requires exact plant adoption. Only a PUBLISHED
// construction with an APPROVED version ADOPTED at the Batch's plant is
// offered. A withdrawn adoption is not an adoption. Plant identity is matched
// on the caller-visible plant row, never on a name typed into a Batch Profile.
// ═══════════════════════════════════════════════════════════════════════════
import { ADOPTION_STATUS, adoptionStatusForPlant, publishedApprovedConstructionVersions } from "./constructionAdoptionModel.js";

const LAYER_KEYS = [["TOP", "top"], ["F1", "f1"], ["L1", "l1"], ["F2", "f2"], ["L2", "l2"]];

const blank = value => value === null || value === undefined || value === "";

// A numeric column arrives as a string from PostgREST ("337.00"). Keep a real
// blank blank: 0 GSM and "no GSM recorded" are different facts to the engine.
const numberOrBlank = value => (blank(value) ? "" : +value);

/**
 * One governed construction version in the local construction shape.
 * `code` is the permanent published code; a construction without one is not
 * offered, because an unpublished identity has nothing stable to store on a row.
 */
export function governedConstructionEntry(construction, version) {
  const layers = {};
  LAYER_KEYS.forEach(([key, column]) => {
    layers[key] = {
      code: construction && version && !blank(version[`layer_${column}_code`])
        ? String(version[`layer_${column}_code`]) : "",
      gsm: numberOrBlank(version?.[`layer_${column}_gsm`]),
    };
  });
  return {
    code: construction?.construction_code || "",
    name: construction?.name || "",
    ply: version?.ply ?? "",
    flute_F1: version?.flute_f1 || "",
    flute_F2: version?.flute_f2 || "",
    layers,
    board_gsm: numberOrBlank(version?.board_gsm),
    status: "active",
    // Provenance the local library never had. `governed` is what every editor
    // and delete path checks before offering to change a row it does not own.
    governed: true,
    constructionId: construction?.id ?? null,
    constructionVersionId: version?.id ?? null,
    versionNo: version?.version_no ?? null,
    // Waste/conversion are NOT construction-level authority (CDM-13).
    waste: null, convRate: null, wastePP: null, convRatePP: null,
  };
}

/**
 * The governed constructions a Batch at `plantId` may use.
 * Returns [] for a missing plant: "no plant chosen yet" must not silently widen
 * into "every construction", which is the exact mistake adoption exists to stop.
 */
export function governedConstructionsForPlant(payload, plantId, adoptionReadPartial = false) {
  if (plantId === null || plantId === undefined || plantId === "") return [];
  return publishedApprovedConstructionVersions(payload?.constructions)
    .filter(({ version }) =>
      adoptionStatusForPlant(version, plantId, adoptionReadPartial) === ADOPTION_STATUS.adopted)
    .map(({ construction, version }) => governedConstructionEntry(construction, version))
    .filter(entry => entry.code);
}

/**
 * Resolve a Batch Profile's plant NAME to the caller-visible plant row id.
 * The legacy Batch Profile stores a display name ("Nagpur"); adoption is keyed
 * by plant id. Matching is exact on code or name and never fuzzy: an
 * unrecognised plant yields null, which offers nothing, rather than a guess
 * that would offer another plant's constructions.
 */
export function plantIdForProfilePlant(plants, plantName) {
  if (blank(plantName)) return null;
  const needle = String(plantName).trim().toLocaleLowerCase();
  const match = (plants || []).find(plant =>
    String(plant?.plant_code || "").trim().toLocaleLowerCase() === needle
    || String(plant?.name || "").trim().toLocaleLowerCase() === needle);
  return match?.id ?? null;
}

/**
 * What the pickers and every construction lookup read.
 *
 * Governed entries come first, so a governed code always wins a code collision.
 * Local entries are kept so Batch rows and Quote Items stored against the old
 * A–Z codes still resolve and still cost — retiring the naming must not
 * retro-invalidate work already on a Maker's screen. `legacy: true` is what the
 * UI uses to mark them.
 */
export function constructionCatalogue(governed, local) {
  const governedEntries = governed || [];
  const seen = new Set(governedEntries.map(entry => entry.code));
  const legacy = (local || [])
    .filter(entry => entry && !seen.has(entry.code))
    .map(entry => ({ ...entry, governed: false, legacy: true }));
  return [...governedEntries, ...legacy];
}
