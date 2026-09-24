// P0.4 filters: narrow which Cycles / lines are SHOWN. Presentation only —
// the count of shown against total is always visible while a filter is on.
import { C, T } from "../../theme.js";
import { CYCLE_STATUSES } from "../../lib/customerPricingModel.js";
import { EMPTY_FILTERS, NEGOTIATION_STATES, SOB_FILTERS, filtersActive } from "../../lib/customerPricingFilters.js";
import { SelectIn, TextIn } from "./pricingFormBits.jsx";
import { rowButton } from "./pricingStyles.js";

export default function PricingFilters({ filters, onChange, options, filtered }) {
  const set = k => v => onChange({ ...filters, [k]: v });
  const active = filtersActive(filters);
  return (
    <div role="search" aria-label="Filter pricing history" style={{ display: "flex", gap: 5, alignItems: "center",
      flexWrap: "wrap", marginBottom: 6, fontSize: T.label }}>
      <span style={{ fontSize: T.micro, fontWeight: 800, color: C.slateL, textTransform: "uppercase", letterSpacing: "0.05em" }}>Filter</span>
      <SelectIn value={filters.status} onChange={set("status")} width={100} aria-label="Cycle status filter"
        opts={[{ v: "all", l: "Any status" }, ...CYCLE_STATUSES]} />
      <TextIn type="date" value={filters.from} onChange={set("from")} width={124} aria-label="Period from" title="Cycles overlapping from" />
      <TextIn type="date" value={filters.to} onChange={set("to")} width={124} aria-label="Period to" title="Cycles overlapping to" />
      <SelectIn value={filters.location} onChange={set("location")} blank="Any Location" width={150} aria-label="Location filter"
        opts={options.locations} />
      <SelectIn value={filters.plant} onChange={set("plant")} blank="Any Plant" width={110} aria-label="Plant filter" opts={options.plants} />
      <TextIn value={filters.text} onChange={set("text")} width={130} placeholder="SKU / item / scope" aria-label="SKU or scope search" />
      <SelectIn value={filters.negotiation} onChange={set("negotiation")} width={170} aria-label="Negotiation state filter"
        opts={NEGOTIATION_STATES} />
      <SelectIn value={filters.sob ?? "all"} onChange={set("sob")} width={170} aria-label="Share of Business filter"
        opts={SOB_FILTERS} />
      {options.bfGrades.length > 0 && (
        <SelectIn value={filters.bfGrade} onChange={set("bfGrade")} blank="Any BF" width={90} aria-label="Agreed BF grade filter"
          opts={options.bfGrades} />
      )}
      {active && (
        <>
          <b role="status" style={{ color: C.amberD }}>Showing {filtered.shown} of {filtered.total}</b>
          <button type="button" style={rowButton} onClick={() => onChange(EMPTY_FILTERS)}>Clear filters</button>
        </>
      )}
    </div>
  );
}
