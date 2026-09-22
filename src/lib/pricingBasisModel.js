// U3 Pricing Basis presentation rules.  This module contains no persistence,
// database client or workflow action: it only explains governed release data
// already returned by the caller-scoped backend route.

import { deriveInterestPct, STRUCTURED_PAYMENT_TERMS } from "../engine/interestBasis.js";

export function localIsoDate(now = new Date()) {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isValidDateOnly(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || "");
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= days[month - 1];
}

export function releaseEligibility(release, asOf) {
  // Deliberately validate calendar parts without constructing a Date: an
  // eligibility day is a date-only commercial value, not a timezone instant.
  if (!isValidDateOnly(asOf)) {
    return { eligible: false, tone: "warning", reason: "Choose a valid date to check eligibility." };
  }
  if (release?.status !== "approved") {
    const status = release?.status || "unknown";
    return {
      eligible: false,
      tone: status === "withdrawn" ? "muted" : "warning",
      reason: `${status[0]?.toUpperCase() || "U"}${status.slice(1)} releases are not eligible.`,
    };
  }
  if (release.effective_from && asOf < release.effective_from) {
    return {
      eligible: false,
      tone: "warning",
      reason: `Not yet effective; starts ${release.effective_from}.`,
    };
  }
  if (release.effective_until && asOf > release.effective_until) {
    return {
      eligible: false,
      tone: "muted",
      reason: `Effective period ended ${release.effective_until}.`,
    };
  }
  return {
    eligible: true,
    tone: "success",
    reason: release.is_automatic_default
      ? `Eligible automatic default for ${asOf}.`
      : `Eligible approved alternative for ${asOf}.`,
  };
}

// U3 selector model.  This remains deliberately independent of React so the
// same eligibility and ordering rules drive Batch Entry and the labelled UX
// illustration.  A Release label is never treated as identity: selection uses
// the permanent Release id throughout.
export function pricingBasisOptions(releases = [], plantCode, asOf) {
  if (!plantCode || !isValidDateOnly(asOf)) return [];
  return releases
    .filter(release => release?.plant?.plant_code === plantCode)
    .map(release => ({ release, eligibility: releaseEligibility(release, asOf) }))
    .sort((left, right) => {
      const rank = option => option.eligibility.eligible
        ? (option.release.is_automatic_default ? 0 : 1)
        : option.release.status === "draft" ? 2 : 3;
      return rank(left) - rank(right)
        || String(left.release.release_name || "").localeCompare(String(right.release.release_name || ""))
        || String(left.release.id).localeCompare(String(right.release.id));
    });
}

export function automaticPricingBasisSuggestion(options = []) {
  const matches = options.filter(option => option.eligibility.eligible
    && option.release.is_automatic_default);
  return matches.length === 1 ? matches[0].release : null;
}

export function filterPricingBasisReleases(releases = [], {
  plantCode = "all",
  asOf,
  query = "",
  scope = "eligible",
} = {}) {
  const needle = query.trim().toLocaleLowerCase();
  return releases.filter(release => {
    if (plantCode !== "all" && release?.plant?.plant_code !== plantCode) return false;
    if (needle) {
      const haystack = [release?.id, release?.release_name, release?.plant?.plant_code,
        release?.plant?.name].filter(value => value !== null && value !== undefined)
        .join(" ").toLocaleLowerCase();
      if (!haystack.includes(needle)) return false;
    }
    const verdict = releaseEligibility(release, asOf);
    if (scope === "eligible") return verdict.eligible;
    if (scope === "default") return verdict.eligible && release.is_automatic_default;
    if (scope === "alternative") return verdict.eligible && !release.is_automatic_default;
    if (scope === "draft") return release.status === "draft";
    if (scope === "withdrawn") return release.status === "withdrawn";
    return true;
  }).sort((left, right) => {
    const leftPlant = left?.plant?.plant_code || "";
    const rightPlant = right?.plant?.plant_code || "";
    return leftPlant.localeCompare(rightPlant)
      || String(right.effective_from || "").localeCompare(String(left.effective_from || ""))
      || String(left.release_name || "").localeCompare(String(right.release_name || ""))
      || String(left.id).localeCompare(String(right.id));
  });
}

const present = value => value !== null && value !== undefined && value !== "";

// ── the four governed components, in the order the screen reads them ───────
const COMPONENT_PARTS = Object.freeze([
  { key: "rate", label: "Rate", nameField: "set_name" },
  { key: "freight", label: "Freight", nameField: "set_name" },
  { key: "sector", label: "Sector", nameField: "name" },
  { key: "calculation_defaults", label: "Calculation", nameField: null },
]);

// Values worth naming when two Releases differ. Version identity is the
// verdict; these say what the difference means in commercial terms.
const COMPARED_VALUES = Object.freeze({
  sector: [
    { field: "margin_pct", label: "Target margin", unit: "%" },
    { field: "waste_cbb_pct", label: "Waste · Box", unit: "%" },
    { field: "waste_pp_pct", label: "Waste · PP", unit: "%" },
    { field: "conv_box_rate", label: "Conversion · Box", unit: "/kg" },
    { field: "conv_pp_rate", label: "Conversion · PP", unit: "/kg" },
  ],
  calculation_defaults: [
    { field: "annual_interest_pct", label: "Annual interest", unit: "%" },
    { field: "day_count_basis", label: "Day count", unit: " days" },
    { field: "rounding_step", label: "Rounding", unit: "" },
  ],
});

const versionText = component => !component ? "unavailable"
  : present(component.version_no) ? `v${component.version_no}` : "version unavailable";

// Identity, never the label: two versions are the same one only when the
// governed row id matches. Version numbers alone are not identity across sets.
const componentIdentity = component => !component ? null
  : present(component.id) ? `id:${component.id}`
    : present(component.version_no) ? `no-id:v${component.version_no}` : null;

// One compact line per Release for the catalogue row, so the composition is
// readable without opening anything.
export function releaseComponentSummary(release) {
  const parts = release?.components || {};
  return COMPONENT_PARTS.map(({ key, label, nameField }) => {
    const component = parts[key];
    const name = component && nameField ? component[nameField] : null;
    return {
      key,
      label,
      name: present(name) ? name : null,
      version: versionText(component),
      available: !!component,
      text: [present(name) ? name : null, versionText(component)].filter(Boolean).join(" "),
      // Rate and Freight set names are long, so the compact line carries the
      // version alone; the Sector's name is short and says what it means.
      compact: key === "sector" && present(name)
        ? `${label} ${name} ${versionText(component)}`
        : `${label} ${versionText(component)}`,
    };
  });
}

// What differs between a Release and the Release that is the automatic default
// on the chosen date. A component the caller cannot see is reported as
// "cannot compare", never as same and never as different.
export function compareReleaseComponents(release, baseline) {
  if (!release || !baseline || String(release.id) === String(baseline.id)) return null;
  const mineParts = release.components || {};
  const baseParts = baseline.components || {};
  const rows = COMPONENT_PARTS.map(({ key, label }) => {
    const mine = mineParts[key];
    const theirs = baseParts[key];
    const comparable = !!mine && !!theirs
      && componentIdentity(mine) !== null && componentIdentity(theirs) !== null;
    const differs = comparable ? componentIdentity(mine) !== componentIdentity(theirs) : null;
    const values = (differs && COMPARED_VALUES[key] ? COMPARED_VALUES[key] : [])
      .map(({ field, label: valueLabel, unit }) => ({
        label: valueLabel,
        baseline: present(theirs[field]) ? `${theirs[field]}${unit}` : "not set",
        current: present(mine[field]) ? `${mine[field]}${unit}` : "not set",
        changed: String(theirs[field] ?? "") !== String(mine[field] ?? ""),
      }))
      .filter(value => value.changed);
    return { key, label, comparable, differs, values,
      current: versionText(mine), baseline: versionText(theirs) };
  });
  return {
    baselineId: baseline.id,
    baselineName: release.release_name && baseline.release_name === release.release_name
      ? `Release #${baseline.id}` : (baseline.release_name || `Release #${baseline.id}`),
    rows,
    differing: rows.filter(row => row.differs === true).length,
    incomparable: rows.filter(row => row.comparable === false).length,
  };
}

// The Release a Batch at this plant would price with on this date: the single
// eligible automatic default. None, or more than one, yields null rather than
// a guess.
export function defaultReleaseOn(releases = [], plantCode, asOf) {
  return automaticPricingBasisSuggestion(pricingBasisOptions(releases, plantCode, asOf));
}

const FIELD_RULES = Object.freeze([
  { key: "waste_cbb", label: "Waste · Box / CBB", unit: "%",
    sector: "waste_cbb_pct", system: "waste_cbb_fallback_pct" },
  { key: "waste_pp", label: "Waste · PP / parts", unit: "%",
    sector: "waste_pp_pct", system: "waste_pp_fallback_pct" },
  { key: "conv_box", label: "Conversion · Box", unit: "/kg",
    sector: "conv_box_rate", system: "conv_box_fallback_rate" },
  { key: "conv_pp", label: "Conversion · PP / parts", unit: "/kg",
    sector: "conv_pp_rate", system: "conv_pp_fallback_rate" },
  { key: "margin", label: "Target margin", unit: "%",
    sector: "margin_pct", system: "margin_fallback_pct" },
]);

// A Release cannot know the future Batch row or Batch Profile values. This
// model therefore shows the canonical ladder and the first release-side value,
// without claiming to have calculated an effective Batch value.
export function releaseResolutionLadders(components = {}) {
  const sector = components.sector;
  const defaults = components.calculation_defaults;
  return FIELD_RULES.map(rule => {
    const sectorValue = sector?.[rule.sector];
    const defaultValue = defaults?.[rule.system];
    const releaseSource = present(sectorValue)
      ? "sector"
      : present(defaultValue) ? "system" : "unresolved";
    return {
      key: rule.key,
      label: rule.label,
      unit: rule.unit,
      releaseSource,
      tiers: [
        { source: "row", label: "Row override", state: "batch_context", value: null },
        { source: "batch", label: "Batch Profile override", state: "batch_context", value: null },
        { source: "sector", label: "Sector version", state: present(sectorValue) ? "value" : sector ? "inherit" : "unavailable", value: sectorValue ?? null },
        { source: "system", label: "Calculation Default fallback", state: present(defaultValue) ? "value" : defaults ? "missing" : "unavailable", value: defaultValue ?? null },
        { source: "unresolved", label: "Unresolved / missing", state: releaseSource === "unresolved" ? "active" : "not_reached", value: null },
      ],
    };
  });
}

export function customerInterestPolicy(defaults) {
  if (!defaults) return { state: "unavailable", examples: [] };
  const annual = defaults.annual_interest_pct;
  const basis = defaults.day_count_basis;
  const examples = STRUCTURED_PAYMENT_TERMS.map(days => ({
    days,
    effective_interest_pct: present(annual) && present(basis)
      ? deriveInterestPct(+annual, days, +basis)
      : null,
  }));
  return {
    state: present(annual) && present(basis) ? "governed" : "unresolved",
    annual_interest_pct: annual ?? null,
    day_count_basis: basis ?? null,
    interest_fallback_pct: defaults.interest_fallback_pct ?? null,
    examples,
  };
}

// Development-only presentation fixture.  It is never submitted, persisted or
// merged into live results.  The screen exposes it only behind an explicit
// "View labelled illustration" control and keeps a permanent fixture banner on
// screen while it is active.
export const PRICING_BASIS_ILLUSTRATION = Object.freeze([
  {
    id: "fixture-current",
    release_name: "Nagpur Standard · September 2026",
    status: "approved",
    effective_from: "2026-09-01",
    effective_until: null,
    is_automatic_default: true,
    self_approved: false,
    created_at: "2026-08-27T09:00:00Z",
    approved_at: "2026-08-29T09:30:00Z",
    plant: { id: "fixture-nag", plant_code: "NAG", name: "Nagpur", status: "active" },
    components: {
      rate: { id: "fixture-rate", set_id: "fixture-rate-set", set_name: "Nagpur Board Rates",
        owning_plant: { id: "fixture-nag", plant_code: "NAG", name: "Nagpur", status: "active" },
        version_no: 4, status: "approved", approved: true, approved_at: "2026-08-28T08:00:00Z",
        credit_cost_pct: "1.500", entries_available: true,
        entries: [
          { id: "fixture-rate-kraft", grade_code: "KRAFT-180", description: "Kraft liner 180 GSM",
            price: "42.0000", discount: "1.2500", freight: "0.7500", supplier_credit_pct: null,
            supplier_credit_source: "version_default", effective_supplier_credit_pct: "1.500",
            effective_material_rate: "42.1300" },
          { id: "fixture-rate-flute", grade_code: "FLUTE-150", description: "Fluting medium 150 GSM",
            price: "38.0000", discount: "0.5000", freight: "0.0000", supplier_credit_pct: "0.000",
            supplier_credit_source: "entry_exception", effective_supplier_credit_pct: "0.000",
            effective_material_rate: "37.5000" },
        ],
        history: [
          { id: "fixture-rate-v5", version_no: 5, status: "draft", approved_at: null },
          { id: "fixture-rate", version_no: 4, status: "approved", approved_at: "2026-08-28T08:00:00Z" },
          { id: "fixture-rate-v3", version_no: 3, status: "withdrawn", approved_at: "2026-07-01T08:00:00Z" },
        ] },
      freight: { id: "fixture-freight", set_name: "Nagpur Freight Matrix", version_no: 3,
        owning_plant: { id: "fixture-nag", plant_code: "NAG", name: "Nagpur", status: "active" },
        set_id: "fixture-freight-set", effective_from: "2026-09-01", status: "approved", approved: true,
        approved_at: "2026-08-28T08:05:00Z", entries_available: true, destination_details_partial: false,
        missing_destinations_available: true,
        missing_destinations: [{ id: "fixture-missing", location_code: "NAG-MISSING",
          status: "active", customer: { display_name: "Illustrative Customer" } }],
        entries: [
          { id: "fixture-lane-pune", origin_plant: { plant_code: "NAG", name: "Nagpur" },
            destination: { location_code: "PUN-WH", status: "active", ship_to_eligible: true,
              customer: { customer_code: "DEV-CUST", display_name: "Illustrative Customer", status: "active" } },
            rate: "3.2500", explicit_zero: false, destination_visible: true },
          { id: "fixture-lane-local", origin_plant: { plant_code: "NAG", name: "Nagpur" },
            destination: { location_code: "NAG-LOCAL", status: "active", ship_to_eligible: true,
              customer: { customer_code: "DEV-CUST", display_name: "Illustrative Customer", status: "active" } },
            rate: "0.0000", explicit_zero: true, destination_visible: true },
        ],
        history: [
          { id: "fixture-freight-v4", version_no: 4, status: "draft", effective_from: "2026-10-01", approved_at: null },
          { id: "fixture-freight", version_no: 3, status: "approved", effective_from: "2026-09-01", approved_at: "2026-08-28T08:05:00Z" },
          { id: "fixture-freight-v2", version_no: 2, status: "withdrawn", effective_from: "2026-07-01", approved_at: "2026-06-28T08:05:00Z" },
        ] },
      sector: { id: "fixture-sector", sector_code: "PHARMA", name: "Pharmaceuticals", version_no: 3,
        sector_id: "fixture-sector-set",
        waste_cbb_pct: "5.000", waste_pp_pct: "0.000", conv_box_rate: "7.0000",
        conv_pp_rate: "12.5000", margin_pct: "8.000", status: "approved", approved: true,
        approved_at: "2026-08-28T08:10:00Z", history: [
          { id: "fixture-sector-v4", version_no: 4, status: "draft", approved_at: null },
          { id: "fixture-sector", version_no: 3, status: "approved", approved_at: "2026-08-28T08:10:00Z" },
          { id: "fixture-sector-v2", version_no: 2, status: "superseded", approved_at: "2026-06-01T08:10:00Z" },
        ] },
      calculation_defaults: { id: "fixture-defaults", version_no: 7, annual_interest_pct: "6.000",
        day_count_basis: 360, interest_fallback_pct: "0.500", waste_cbb_fallback_pct: "5.000",
        waste_pp_fallback_pct: "5.000", conv_box_fallback_rate: "7.0000",
        conv_pp_fallback_rate: "12.5000", margin_fallback_pct: "8.000",
        rounding_step: "0.0500", engine_version: "engine/qe1-7c2ceac1972460ba",
        rounding_rule_version: "round/nearest-0.05", status: "approved", approved: true,
        approved_at: "2026-08-28T08:15:00Z", history: [
          { id: "fixture-defaults-v8", version_no: 8, status: "draft", approved_at: null },
          { id: "fixture-defaults", version_no: 7, status: "approved", approved_at: "2026-08-28T08:15:00Z" },
          { id: "fixture-defaults-v6", version_no: 6, status: "superseded", approved_at: "2026-06-01T08:15:00Z" },
        ] },
    },
  },
  {
    id: "fixture-alternative",
    release_name: "Nagpur Export Alternative · October 2026",
    status: "approved",
    effective_from: "2026-10-01",
    effective_until: "2026-12-31",
    is_automatic_default: false,
    self_approved: true,
    created_at: "2026-09-08T09:00:00Z",
    approved_at: "2026-09-10T12:00:00Z",
    plant: { id: "fixture-nag", plant_code: "NAG", name: "Nagpur", status: "active" },
    components: {
      rate: { id: "fixture-rate-alt", set_id: "fixture-rate-alt-set", set_name: "Nagpur Export Rates",
        owning_plant: { id: "fixture-nag", plant_code: "NAG", name: "Nagpur", status: "active" },
        version_no: 2, status: "approved", approved: true, approved_at: "2026-09-08T10:00:00Z",
        credit_cost_pct: "1.500", entries_available: false, entries: [], history: [
          { id: "fixture-rate-alt", version_no: 2, status: "approved", approved_at: "2026-09-08T10:00:00Z" },
        ] },
      freight: { id: "fixture-freight-alt", set_name: "Export Freight Matrix", version_no: 1,
        owning_plant: { id: "fixture-nag", plant_code: "NAG", name: "Nagpur", status: "active" },
        set_id: "fixture-freight-alt-set", effective_from: "2026-10-01", status: "approved", approved: true,
        approved_at: "2026-09-08T10:05:00Z", entries_available: true, destination_details_partial: true,
        missing_destinations_available: false, missing_destinations: [],
        entries: [{ id: "fixture-lane-hidden", origin_plant: { plant_code: "NAG", name: "Nagpur" },
          destination: null, rate: "4.7500", explicit_zero: false, destination_visible: false }],
        history: [{ id: "fixture-freight-alt", version_no: 1, status: "approved",
          effective_from: "2026-10-01", approved_at: "2026-09-08T10:05:00Z" }] },
      sector: { id: "fixture-sector-alt", sector_code: "EXPORT", name: "Export", version_no: 2,
        sector_id: "fixture-sector-alt-set",
        waste_cbb_pct: null, waste_pp_pct: "4.500", conv_box_rate: null,
        conv_pp_rate: "13.0000", margin_pct: "10.000", status: "approved", approved: true,
        approved_at: "2026-09-08T10:10:00Z", history: [
          { id: "fixture-sector-alt", version_no: 2, status: "approved", approved_at: "2026-09-08T10:10:00Z" },
        ] },
      calculation_defaults: null,
    },
  },
  {
    id: "fixture-draft-release",
    release_name: "Nagpur Draft Review · November 2026",
    status: "draft",
    effective_from: "2026-11-01",
    effective_until: null,
    is_automatic_default: false,
    self_approved: false,
    created_at: "2026-09-11T07:30:00Z",
    approved_at: null,
    withdrawn_at: null,
    plant: { id: "fixture-nag", plant_code: "NAG", name: "Nagpur", status: "active" },
    components: {},
  },
  {
    id: "fixture-withdrawn-release",
    release_name: "Nagpur Withdrawn Historical Basis",
    status: "withdrawn",
    effective_from: "2026-07-01",
    effective_until: "2026-08-31",
    is_automatic_default: false,
    self_approved: false,
    created_at: "2026-06-25T09:00:00Z",
    approved_at: "2026-06-28T12:00:00Z",
    withdrawn_at: "2026-09-01T08:00:00Z",
    plant: { id: "fixture-nag", plant_code: "NAG", name: "Nagpur", status: "active" },
    components: {},
  },
]);
