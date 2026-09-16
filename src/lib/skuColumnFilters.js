// ═══════════════════════════════════════════════════════════════════════════
// src/lib/skuColumnFilters.js — SKU Master column-header filters (pure).
//
// Product Owner rulings, 2026-09-16: filter from the column header, Excel-
// style; a version field matches the LATEST version (what the grid shows);
// no migration; text = contains / blank / not blank, numbers = between / blank
// / not blank, closed vocabularies = a value list; filter state is screen
// state, not the URL.
//
// Every filter is applied by the SERVER, in the database and inside the
// caller's plant_access plants (`GET /masters/skus?f=field:op:value`). Nothing
// here filters rows in the browser, except the labelled fixture preview.
//
// A column is NOT offered as a filter, with its reason stated, when:
//   * it is derived (Flute Type = Flute 1 + Flute 2 - filter those);
//   * its storage is not activated yet (Amendment 02 fields, SoftComp Code,
//     the Amendment 03 portfolio) - the route would refuse it;
//   * the caller may not read the master behind it (Customer and Location
//     need read_party_master, Construction needs read_construction_library).
// The identity search box is untouched and stays identity-only.
// ═══════════════════════════════════════════════════════════════════════════

export const COLUMN_FILTER_MAX = 8;
const VALUE_CHARS = /^[A-Za-z0-9 ._/+-]*$/;
const VALUE_MAX = 60;

const TEXT = ["contains", "blank", "not_blank"];
const NUMBER = ["between", "blank", "not_blank"];

export const COLUMN_FILTER_OP_LABELS = {
  contains: "contains", between: "between", in: "is one of", blank: "is blank", not_blank: "is not blank",
};

const text = (field, extra = {}) => ({ field, type: "text", ops: TEXT, ...extra });
const number = (field, extra = {}) => ({ field, type: "number", ops: NUMBER, ...extra });
const Q = { pending: "quote_fields" };
const CUSTOMER = { gate: "customer" };
const LOCATIONS = { gate: "locations" };
const CON = { gate: "construction" };

// Registry key (SPEC sheet column) -> the route's filter field.
export const COLUMN_FILTERS = {
  A: text("location_code", LOCATIONS),
  B: text("item_name", Q),
  C: text("item_short_name", Q),
  D: text("plant_item_code"),
  E: { field: "customer", type: "text", ops: ["contains"], ...CUSTOMER },
  F: text("customer_item_code"),
  G: text("item_family", Q),
  H: text("item_group", Q),
  I: number("ply", CON),
  J: { derived: "Derived from Flute 1 and Flute 2 — filter those columns." },
  K: text("flute_f1", CON),
  L: text("flute_f2", CON),
  N: text("print_quality", Q),
  PT: { field: "print_technology", type: "enum", ops: ["in", "blank", "not_blank"],
    values: ["Flexo", "CMYK", "Offset", "Unprinted"], ...Q },
  NC: number("number_of_colours", Q),
  O: text("colour_detail", Q),
  AA: text("cobb_value", Q),
  AE: number("length_mm"),
  AF: number("width_mm"),
  AG: number("height_mm"),
  AI: text("layer_top_code", CON), AJ: number("layer_top_gsm", CON),
  AK: text("layer_f1_code", CON), AL: number("layer_f1_gsm", CON),
  AM: text("layer_l1_code", CON), AN: number("layer_l1_gsm", CON),
  AO: text("layer_f2_code", CON), AP: number("layer_f2_gsm", CON),
  AQ: text("layer_l2_code", CON), AR: number("layer_l2_gsm", CON),
  AS: text("stated_item_gsm", Q),
  AT: number("item_weight_kg", Q),
  AU: text("stated_cs", Q),
  AV: text("stated_bs", Q),
  AW: text("stated_ect", Q),
  BH: number("ups"),
  // Lifecycle and portfolio share ONE state with their toolbar controls: the
  // header writes `filters.status` / `filters.portfolio` (a `|`-joined list).
  LC: { field: "status", type: "enum", ops: ["in"], values: ["proposed", "active", "discontinued"], shared: "status" },
  PF: { field: "pricing_portfolio", type: "enum", ops: ["in"], values: ["Transactional", "Strategic"],
    shared: "portfolio", pending: "pricing_portfolio" },
  DX: text("customer_spec_version", Q),
  // SoftComp Code is a reference kind the applied schema does not allow yet.
  DZ: text("softcomp_code", Q),
};

export const FILTERABLE_COLUMN_COUNT = Object.values(COLUMN_FILTERS).filter(s => s.field).length;

const PENDING_REASON = "Not stored yet · migration pending — this column cannot be filtered until it is activated.";
const HIDDEN_REASON = "Not visible to this caller — you may not read the master behind this column.";

// Whether a column's header filter can be offered to THIS caller on THIS read.
export function columnFilterAvailability(key, { visibility = {}, schemaPending = {} } = {}) {
  const spec = COLUMN_FILTERS[key];
  if (!spec) return { available: false, reason: "This column cannot be filtered." };
  if (spec.derived) return { available: false, reason: spec.derived };
  if (spec.pending && schemaPending[spec.pending]) return { available: false, reason: PENDING_REASON };
  if (spec.gate && visibility[spec.gate] === "not_visible_to_caller") return { available: false, reason: HIDDEN_REASON };
  return { available: true, reason: null };
}

function numberText(v) {
  return v === null || v === undefined || v === "" ? "" : String(v);
}

// The same rules the route enforces, so the header refuses locally exactly
// what the server would refuse. Returns an error message or null.
export function columnFilterValidation(key, filter) {
  const spec = COLUMN_FILTERS[key];
  if (!spec?.field) return "This column cannot be filtered.";
  if (!filter || !spec.ops.includes(filter.op)) return "Choose how to filter this column.";
  if (filter.op === "contains") {
    const value = (filter.value || "").trim();
    if (!value) return "Type what the value should contain.";
    if (value.length > VALUE_MAX || !VALUE_CHARS.test(value)) {
      return "Use at most 60 letters, digits, spaces or . _ / - + characters.";
    }
  }
  if (filter.op === "between") {
    const [low, high] = filter.value || [];
    const lo = numberText(low), hi = numberText(high);
    if (!lo && !hi) return "Give a minimum, a maximum, or both.";
    if ((lo && !Number.isFinite(Number(lo))) || (hi && !Number.isFinite(Number(hi)))) return "Minimum and maximum must be numbers.";
    if (lo && hi && Number(lo) > Number(hi)) return "The minimum is larger than the maximum.";
  }
  if (filter.op === "in") {
    const values = filter.value || [];
    if (!values.length) return "Tick at least one value.";
    if (values.some(v => !spec.values.includes(v))) return "Choose from the listed values.";
  }
  return null;
}

// `field:op:value` for the query string.
export function columnFilterParam(key, filter) {
  const spec = COLUMN_FILTERS[key];
  if (filter.op === "contains") return `${spec.field}:contains:${filter.value.trim()}`;
  if (filter.op === "between") {
    const [low, high] = filter.value || [];
    return `${spec.field}:between:${numberText(low).trim()},${numberText(high).trim()}`;
  }
  if (filter.op === "in") return `${spec.field}:in:${filter.value.join("|")}`;
  return `${spec.field}:${filter.op}`;
}

// Words for a chip or an empty state: "Length (mm) between 300 and 400".
export function columnFilterSummary(label, filter) {
  if (filter.op === "contains") return `${label} contains "${filter.value}"`;
  if (filter.op === "between") {
    const [low, high] = (filter.value || []).map(numberText);
    if (low && high) return `${label} between ${low} and ${high}`;
    return low ? `${label} ≥ ${low}` : `${label} ≤ ${high}`;
  }
  if (filter.op === "in") return `${label} is ${filter.value.join(" or ")}`;
  return `${label} ${COLUMN_FILTER_OP_LABELS[filter.op]}`;
}

// A shared lifecycle / portfolio control stores a `|`-joined list.
export function sharedFilterFromState(value) {
  const values = (value || "").split("|").filter(Boolean);
  return values.length ? { op: "in", value: values } : null;
}

export function sharedStateFromFilter(filter) {
  return filter ? filter.value.join("|") : "";
}

// Words for the filter-reach band: which filters stopped at a scan cap.
export function columnFilterScanNotice(report, labelFor) {
  const capped = (report || []).filter(r => r.scan_truncated);
  if (!capped.length) return null;
  const names = capped.map(r => labelFor(r.field) || r.field);
  return `${names.join(", ")} reached ${capped.length === 1 ? "its" : "their"} scan limit, so more SKUs may match than are shown.`;
}

// ── Fixture preview only ──────────────────────────────────────────────────
// The labelled preview has no server, so it applies the same operators to the
// cell the grid shows (the latest version). Never used on governed reads.
export function fixtureCellMatches(filter, cell) {
  const recorded = cell && (cell.state === "value" || cell.state === "na");
  if (filter.op === "blank") return cell?.state === "blank";
  if (filter.op === "not_blank") return !!recorded;
  if (!recorded) return false;
  const textValue = String(cell.text);
  if (filter.op === "contains") return textValue.toLowerCase().includes(filter.value.trim().toLowerCase());
  if (filter.op === "in") return filter.value.includes(textValue);
  const n = Number(textValue);
  if (!Number.isFinite(n)) return false;
  const [low, high] = (filter.value || []).map(numberText);
  return (!low || n >= Number(low)) && (!high || n <= Number(high));
}
