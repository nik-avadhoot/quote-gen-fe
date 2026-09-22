import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../AuthContext.jsx";
import { useAppState } from "../state/AppStateContext.js";
import { apiFetch } from "../lib/apiClient.js";
import { classifyResponse } from "../lib/backendError.js";
import {
  compareReleaseComponents,
  customerInterestPolicy,
  defaultReleaseOn,
  filterPricingBasisReleases,
  localIsoDate,
  PRICING_BASIS_ILLUSTRATION,
  releaseComponentSummary,
  releaseEligibility,
  releaseResolutionLadders,
} from "../lib/pricingBasisModel.js";
import { AccessDeniedState, EmptyState, LoadingState } from "../ui/appStates.jsx";
import { LifecycleBadge, PermanentCode } from "../ui/dataDisplay.jsx";
import {
  control, denseCell, denseHead, denseTable, frozenCell, menuPanel, menuSummary, toolbar,
} from "../ui/screenStandards.js";
import { RowDisclosure, ScreenFooter, ToolbarLabel } from "../ui/screenChrome.jsx";
import { C, T, mono, sans } from "../theme.js";
import BatchPricingCard from "./batch/BatchPricingCard.jsx";

const panel = { border: `1px solid ${C.border}`, borderRadius: 8, background: C.white };

function value(value, suffix = "") {
  return value === null || value === undefined || value === ""
    ? "Inherited fallback"
    : `${value}${suffix}`;
}

// The component's values are the point of the card, so they are shown, not
// hidden behind a disclosure. Only the full rate/freight tables stay behind a
// drill-down, and the version history behind its own.
function BasisPart({ title, eyebrow, component, historyLabel, children, drilldownLabel, drilldown }) {
  const [drilldownOpen, setDrilldownOpen] = useState(false);
  return (
    <section aria-label={`${eyebrow} component`}
      style={{ ...panel, padding: 9, minWidth: 0, display: "flex", flexDirection: "column", gap: 5 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
        <span style={{ fontSize: T.micro, fontWeight: 800, color: C.slateL,
          textTransform: "uppercase", letterSpacing: ".06em" }}>{eyebrow}</span>
        <span style={{ fontSize: T.body, fontWeight: 750, color: C.slate, minWidth: 0,
          overflow: "hidden", textOverflow: "ellipsis" }}>{title}</span>
        <span style={{ marginLeft: "auto" }}>
          <LifecycleBadge status={component?.status || "Unavailable"} />
        </span>
      </div>
      {component
        ? <div style={{ fontSize: T.body, color: C.slateM, lineHeight: 1.5 }}>{children}</div>
        : <div style={{ fontSize: T.body, color: C.slateL, lineHeight: 1.45 }}>
            This governed source was not visible in the current caller-scoped read. No value is guessed.
          </div>}
      <VersionHistory label={historyLabel} versions={component?.history} />
      {drilldown && <div>
        <button type="button" onClick={() => setDrilldownOpen(open => !open)}
          aria-expanded={drilldownOpen}
          style={{ border: `1px solid ${C.border}`, borderRadius: 5,
            background: C.white, color: C.slate, fontSize: T.label, fontWeight: 750,
            padding: "5px 8px", cursor: "pointer" }}>
          {drilldownOpen ? `Hide ${drilldownLabel}` : `View ${drilldownLabel}`}
        </button>
        {drilldownOpen && <div style={{ marginTop: 8 }}>{drilldown}</div>}
      </div>}
    </section>
  );
}

function Identity({ setLabel, component }) {
  if (!component) return null;
  return (
    <div style={{ fontFamily: mono, fontSize: T.label, color: C.slateL, overflowWrap: "anywhere" }}>
      {setLabel} #{component.set_id} · version #{component.id}
    </div>
  );
}

// The current version's values are the card's subject, so the older versions
// sit behind one native disclosure rather than lengthening every card.
function VersionHistory({ label, versions = [] }) {
  return (
    <details style={{ marginTop: 5 }}>
      <summary style={{ fontSize: T.label, color: C.slateL, fontWeight: 800, cursor: "pointer" }}>
        {label} lifecycle{versions.length ? ` · ${versions.length}` : ""}
      </summary>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 5 }}>
        {versions.length === 0
          ? <span style={{ fontSize: T.body, color: C.slateL }}>No caller-visible version history.</span>
          : versions.map(version => (
            <div key={version.id} style={{ border: `1px solid ${C.border}`, borderRadius: 5,
              padding: "4px 6px", background: C.white, fontSize: T.body, color: C.slateM }}>
              <span style={{ fontWeight: 800 }}>v{version.version_no}</span>{" "}
              <LifecycleBadge status={version.status} />
              {version.effective_from ? ` · from ${version.effective_from}` : ""}
            </div>
          ))}
      </div>
    </details>
  );
}

// Drill-down tables follow the shared dense-row standard: one 26px line per
// entry, secondary text on hover rather than a second line in the row.
function Cell({ children, emphasis = false, title }) {
  return <td title={title ?? (typeof children === "string" ? children : undefined)}
    style={{ ...denseCell, color: C.slateM, fontWeight: emphasis ? 800 : 500 }}>{children}</td>;
}

function Head({ children }) {
  return <th scope="col" style={{ ...denseHead, position: "static", background: C.paper, color: C.slateM }}>{children}</th>;
}

function DrilldownNotice({ children }) {
  return <div style={{ border: `1px solid ${C.amber}`, borderRadius: 5, padding: "7px 8px",
    background: C.amberL, color: C.slateM, fontSize: T.body, lineHeight: 1.45 }}>{children}</div>;
}

function RateDrilldown({ rate }) {
  if (!rate) return <DrilldownNotice>Rate version details are not visible to this caller. Nothing is inferred.</DrilldownNotice>;
  const entries = rate.entries || [];
  return (
    <section aria-label="Rate version drill-down" style={{ ...panel, padding: 11 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 230 }}>
          <div style={{ fontSize: T.body, color: C.slate, fontWeight: 800 }}>
            Rate Set · {rate.set_name} · v{rate.version_no}
          </div>
          <Identity setLabel="Rate Set" component={rate} />
          <div style={{ fontSize: T.body, color: C.slateM, marginTop: 3 }}>
            Owning plant: <strong>{rate.owning_plant
              ? `${rate.owning_plant.plant_code} · ${rate.owning_plant.name}`
              : "unavailable to this caller"}</strong>
          </div>
        </div>
        <LifecycleBadge status={rate.status} />
      </div>
      <div style={{ marginTop: 8, padding: "7px 8px", borderRadius: 5,
        background: C.blueL || C.paper, border: `1px solid ${C.border}`, fontSize: T.body,
        color: C.slateM, lineHeight: 1.45 }}>
        <strong>Upstream Rate Master derivation only.</strong>{" "}
        Base price + supplier-credit cost − discount + inbound freight = effective material rate.
        Supplier-credit values shown here are not Batch Calculate inputs.
      </div>
      <div style={{ marginTop: 6, padding: "7px 8px", borderRadius: 5,
        background: C.greenL, border: `1px solid ${C.green}`, fontSize: T.body,
        color: C.slateM, lineHeight: 1.45 }}>
        <strong>Downstream calculation boundary:</strong> Batch Calculate receives the grade code and governed
        effective material rate only. Raw price, discount, freight and supplier-credit terms do not cross it.
      </div>
      {rate.entries_available === false ? (
        <div style={{ marginTop: 8 }}><DrilldownNotice>
          Grade/rate entries are unavailable in this caller-scoped read. No fallback rows are displayed.
        </DrilldownNotice></div>
      ) : entries.length === 0 ? (
        <div style={{ marginTop: 8, fontSize: T.body, color: C.slateL }}>
          No governed grade entries are present in this version.
        </div>
      ) : (
        <div style={{ overflowX: "auto", marginTop: 8 }}>
          <table style={{ ...denseTable, minWidth: 720, border: `1px solid ${C.border}` }}>
            <thead><tr>
              <Head>Grade</Head><Head>Base price</Head><Head>Discount</Head><Head>Inbound freight</Head>
              <Head>Supplier credit · upstream</Head><Head>Effective material rate</Head>
            </tr></thead>
            <tbody>{entries.map(entry => (
              <tr key={entry.id}>
                <Cell emphasis title={entry.description || undefined}><PermanentCode code={entry.grade_code || "Grade unavailable"} />
                  {entry.description && <span style={{ fontWeight: 500, marginLeft: 6 }}>{entry.description}</span>}</Cell>
                <Cell>{value(entry.price, "/kg")}</Cell>
                <Cell>{value(entry.discount, "/kg")}</Cell>
                <Cell>{value(entry.freight, "/kg")}</Cell>
                <Cell>{entry.supplier_credit_source === "entry_exception"
                  ? `${value(entry.effective_supplier_credit_pct, "%")} · entry exception`
                  : `${value(entry.effective_supplier_credit_pct, "%")} · inherited from version`}</Cell>
                <Cell emphasis>{value(entry.effective_material_rate, "/kg")}</Cell>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
      <div style={{ marginTop: 7, fontSize: T.body, color: C.slateL }}>
        This schema gives Rate versions no independent effective date; the Pricing Basis Release effective period governs selection.
      </div>
    </section>
  );
}

function FreightDrilldown({ freight }) {
  if (!freight) return <DrilldownNotice>Freight version details are not visible to this caller. Nothing is inferred.</DrilldownNotice>;
  const entries = freight.entries || [];
  return (
    <section aria-label="Freight version drill-down" style={{ ...panel, padding: 11 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 230 }}>
          <div style={{ fontSize: T.body, color: C.slate, fontWeight: 800 }}>
            Freight Set · {freight.set_name} · v{freight.version_no}
          </div>
          <Identity setLabel="Freight Set" component={freight} />
          <div style={{ fontSize: T.body, color: C.slateM, marginTop: 3 }}>
            Set/version owner: <strong>{freight.owning_plant
              ? `${freight.owning_plant.plant_code} · ${freight.owning_plant.name}`
              : "unavailable to this caller"}</strong>
          </div>
          <div style={{ fontSize: T.body, color: C.slateL, marginTop: 3 }}>
            Effective from {freight.effective_from || "not recorded"}
          </div>
        </div>
        <LifecycleBadge status={freight.status} />
      </div>
      <div style={{ marginTop: 8, fontSize: T.body, color: C.slateM, lineHeight: 1.45 }}>
        Canonical lane dimensions are <strong>origin plant × destination Ship-to</strong>; the current governed
        Freight schema has no vehicle-class dimension. Basis: freight rate per kg.
        The Freight Set owner shown above is not the lane origin shown in each row.
      </div>
      {freight.entries_available === false ? (
        <div style={{ marginTop: 8 }}><DrilldownNotice>
          Freight lanes are unavailable in this caller-scoped read. No fallback lanes are displayed.
        </DrilldownNotice></div>
      ) : entries.length === 0 ? (
        <div style={{ marginTop: 8, fontSize: T.body, color: C.slateL }}>
          No lane rows are present. Every unlisted destination is missing—not zero.
        </div>
      ) : (
        <div style={{ overflowX: "auto", marginTop: 8 }}>
          <table style={{ ...denseTable, minWidth: 650, border: `1px solid ${C.border}` }}>
            <thead><tr>
              <Head>Origin plant</Head><Head>Destination Ship-to</Head><Head>Customer</Head><Head>Destination state</Head><Head>Rate / kg</Head>
            </tr></thead>
            <tbody>{entries.map(entry => {
              const destination = entry.destination;
              return <tr key={entry.id}>
                <Cell emphasis>{entry.origin_plant?.plant_code || "Origin unavailable"}</Cell>
                <Cell emphasis>{destination?.location_code || "Destination details denied"}</Cell>
                <Cell>{destination?.customer
                  ? `${destination.customer.customer_code} · ${destination.customer.display_name}`
                  : "Customer details unavailable"}</Cell>
                <Cell>{destination
                  ? `${destination.status || "unknown"}${destination.ship_to_eligible ? " · Ship-to eligible" : " · not Ship-to eligible"}`
                  : "Partial caller-visible data"}</Cell>
                <Cell emphasis>{entry.explicit_zero
                  ? <span style={{ color: C.green }}>0.0000 · explicit zero</span>
                  : value(entry.rate, "/kg")}</Cell>
              </tr>;
            })}</tbody>
          </table>
        </div>
      )}
      <div style={{ marginTop: 7, fontSize: T.body, color: C.slateL }}>
        A displayed 0.0000 is an explicit governed value. An unlisted destination or unavailable row remains missing.
      </div>
      {freight.missing_destinations_available === false ? <div style={{ marginTop: 7 }}><DrilldownNotice>
        Missing-destination coverage is unavailable in this caller-scoped read; no hidden Ship-to is named.
      </DrilldownNotice></div> : (freight.missing_destinations || []).length > 0 && (
        <div style={{ marginTop: 8, border: `1px dashed ${C.amber}`, borderRadius: 5,
          padding: "7px 8px", background: C.amberL }}>
          <div style={{ fontSize: T.label, color: C.amberD, fontWeight: 800 }}>MISSING LANES · ABSENT, NOT ZERO</div>
          {(freight.missing_destinations || []).map(destination => (
            <div key={destination.id} style={{ fontSize: T.body, color: C.slateM, marginTop: 4 }}>
              <strong>{destination.location_code || "Ship-to code unavailable"}</strong>
              {destination.customer ? ` · ${destination.customer.display_name}` : " · customer details unavailable"}
              {" · no Freight Entry exists in this version"}
            </div>
          ))}
        </div>
      )}
      {freight.destination_details_partial && <div style={{ marginTop: 7 }}><DrilldownNotice>
        One or more destination/customer identities are not visible to this caller; the lane rate is not relabelled or guessed.
      </DrilldownNotice></div>}
    </section>
  );
}

function tierText(tier, unit) {
  if (tier.state === "value") {
    const explicit = Number(tier.value) === 0 ? " · explicit zero" : "";
    return `${tier.value}${unit}${explicit}`;
  }
  if (tier.state === "inherit") return "Blank · continue down";
  if (tier.state === "batch_context") return "Evaluated in the Batch";
  if (tier.state === "active") return "No governed value resolved";
  if (tier.state === "unavailable") return "Caller-visible source unavailable";
  if (tier.state === "missing") return "Missing";
  return "Not reached";
}

function ResolutionLadder({ ladder }) {
  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: 6, padding: 8, background: C.white }}>
      <div style={{ fontSize: T.body, fontWeight: 800, color: C.slate, marginBottom: 6 }}>{ladder.label}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(118px, 1fr))",
        gap: 5, overflowX: "auto", paddingBottom: 2 }}>
        {ladder.tiers.map((tier, index) => {
          const active = tier.source === ladder.releaseSource;
          return <div key={tier.source} style={{ position: "relative", minWidth: 118,
            border: `1px solid ${active ? C.green : C.border}`, borderRadius: 5, padding: "6px 7px",
            background: active ? C.greenL : tier.state === "unavailable" || tier.state === "active" ? C.redL : C.cream }}>
            <div style={{ fontSize: T.micro, color: C.slateL, fontWeight: 800 }}>{index + 1}. {tier.label}</div>
            <div style={{ fontSize: T.body, color: active ? C.green : C.slateM,
              fontWeight: active ? 800 : 550, marginTop: 3 }}>{tierText(tier, ladder.unit)}</div>
          </div>;
        })}
      </div>
      <div style={{ marginTop: 5, fontSize: T.label, color: C.slateL }}>
        Release-side preview: {ladder.releaseSource === "sector"
          ? "Sector supplies the first visible governed value when row and Batch Profile are blank."
          : ladder.releaseSource === "system"
            ? "Sector is blank, so the Calculation Default fallback is next."
            : "Neither visible release-side tier resolves; the Batch must remain unresolved."}
      </div>
    </div>
  );
}

function SectorDefaultDrilldown({ sector, defaults }) {
  const ladders = releaseResolutionLadders({ sector, calculation_defaults: defaults });
  const interest = customerInterestPolicy(defaults);
  return (
    <section aria-label="Sector and Calculation Default drill-down" style={{ ...panel, padding: 11 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(270px, 1fr))", gap: 8 }}>
        <div style={{ ...panel, padding: 9 }}>
          <div style={{ display: "flex", gap: 7, alignItems: "flex-start" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: T.body, color: C.slate, fontWeight: 800 }}>
                Sector · {sector ? `${sector.sector_code} · ${sector.name} · v${sector.version_no}` : "Details unavailable"}
              </div>
              {sector && <div style={{ fontFamily: mono, fontSize: T.label, color: C.slateL }}>
                Sector #{sector.sector_id} · version #{sector.id}
              </div>}
            </div>
            {sector && <LifecycleBadge status={sector.status} />}
          </div>
          {!sector && <div style={{ marginTop: 7 }}><DrilldownNotice>
            Sector details are unavailable to this caller. The screen does not fill them from fixture or fallback data.
          </DrilldownNotice></div>}
        </div>
        <div style={{ ...panel, padding: 9 }}>
          <div style={{ display: "flex", gap: 7, alignItems: "flex-start" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: T.body, color: C.slate, fontWeight: 800 }}>
                Calculation Default · {defaults ? `v${defaults.version_no}` : "Details unavailable"}
              </div>
              {defaults && <div style={{ fontFamily: mono, fontSize: T.label, color: C.slateL }}>
                Calculation Default version #{defaults.id}
              </div>}
            </div>
            {defaults && <LifecycleBadge status={defaults.status} />}
          </div>
          {!defaults && <div style={{ marginTop: 7 }}><DrilldownNotice>
            Calculation Default details are unavailable. Any chain that reaches this tier remains unresolved here.
          </DrilldownNotice></div>}
        </div>
      </div>

      <div style={{ marginTop: 10, padding: "8px 9px", border: `1px solid ${C.border}`,
        borderRadius: 6, background: C.paper, fontSize: T.body, color: C.slateM, lineHeight: 1.45 }}>
        <strong>Canonical inheritance:</strong> waste, conversion and margin use Row override → Batch Profile override
        → Sector version → Calculation Default fallback → unresolved. Pricing Group is not a tier for these fields;
        it governs customer payment terms and freight.
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 8 }}>
        {ladders.map(ladder => <ResolutionLadder key={ladder.key} ladder={ladder} />)}
      </div>

      <div style={{ ...panel, marginTop: 10, padding: 10 }}>
        <div style={{ fontSize: T.body, color: C.slate, fontWeight: 800 }}>Customer Payment-Term Interest</div>
        <div style={{ fontSize: T.body, color: C.slateM, lineHeight: 1.45, marginTop: 4 }}>
          Pricing Group override → derive from its structured payment-term days using the approved annual policy
          → independent system fallback → unresolved. There is no row or Sector tier.
        </div>
        {interest.state === "unavailable" ? (
          <div style={{ marginTop: 7 }}><DrilldownNotice>
            Annual policy and fallback are unavailable to this caller, so no effective customer interest is inferred.
          </DrilldownNotice></div>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
              gap: 6, marginTop: 8 }}>
              <div style={{ ...panel, padding: 8, background: C.cream }}>
                <div style={{ fontSize: T.micro, color: C.slateL, fontWeight: 800 }}>PRICING GROUP OVERRIDE</div>
                <div style={{ fontSize: T.body, color: C.slateM, marginTop: 3 }}>Batch-specific; requires a stated reason.</div>
              </div>
              <div style={{ ...panel, padding: 8, background: C.greenL }}>
                <div style={{ fontSize: T.micro, color: C.slateL, fontWeight: 800 }}>ANNUAL POLICY · DERIVATION INPUT</div>
                <div style={{ fontSize: T.body, color: C.green, fontWeight: 800, marginTop: 3 }}>
                  {interest.annual_interest_pct}% per annum · {interest.day_count_basis}-day basis
                </div>
              </div>
              <div style={{ ...panel, padding: 8, background: C.cream }}>
                <div style={{ fontSize: T.micro, color: C.slateL, fontWeight: 800 }}>INDEPENDENT FALLBACK</div>
                <div style={{ fontSize: T.body, color: C.slateM, marginTop: 3 }}>
                  {value(interest.interest_fallback_pct, "%")} when no structured term resolves
                </div>
              </div>
              <div style={{ ...panel, padding: 8, background: C.redL }}>
                <div style={{ fontSize: T.micro, color: C.slateL, fontWeight: 800 }}>UNRESOLVED</div>
                <div style={{ fontSize: T.body, color: C.slateM, marginTop: 3 }}>No override, derivation or fallback.</div>
              </div>
            </div>
            <div style={{ overflowX: "auto", marginTop: 8 }}>
              <table style={{ ...denseTable, minWidth: 420, border: `1px solid ${C.border}` }}>
                <thead><tr>
                  <Head>Customer payment term</Head><Head>Approved derivation</Head><Head>Effective customer interest</Head>
                </tr></thead>
                <tbody>{interest.examples.map(example => <tr key={example.days}>
                  <Cell emphasis>{example.days} days</Cell>
                  <Cell>{interest.annual_interest_pct}% × {example.days} ÷ {interest.day_count_basis}</Cell>
                  <Cell emphasis>{example.effective_interest_pct === null ? "Unresolved" : `${example.effective_interest_pct.toFixed(3)}%`}</Cell>
                </tr>)}</tbody>
              </table>
            </div>
          </>
        )}
        <div style={{ marginTop: 8, padding: "7px 8px", borderRadius: 5,
          border: `1px solid ${C.amber}`, background: C.amberL, color: C.slateM,
          fontSize: T.body, lineHeight: 1.45 }}>
          <strong>Separate commercial authority:</strong> supplier paper-credit cost belongs only to upstream
          Rate Master derivation. It is neither this annual policy nor customer Payment-Term Interest.
        </div>
      </div>
    </section>
  );
}

function lifecycleMoment(value) {
  if (!value) return "Date unavailable";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleString();
}

function ReleaseChronology({ release }) {
  const approvalRole = release.status === "withdrawn"
    ? "Approved · former default/alternative role is not retained by this record"
    : release.is_automatic_default ? "Approved as automatic default" : "Approved as alternative";
  const events = [
    { label: "Proposed / draft", at: release.created_at },
    ...(release.approved_at ? [{ label: approvalRole, at: release.approved_at }] : []),
    ...(release.withdrawn_at ? [{ label: "Withdrawn", at: release.withdrawn_at }] : []),
  ];
  return (
    <div style={{ padding: "8px 12px", borderBottom: `1px solid ${C.border}`, background: C.white }}>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(220px, 1fr) minmax(220px, 1fr)",
        gap: 10 }}>
        <div>
          <div style={{ color: C.slateL, fontSize: T.micro, fontWeight: 800 }}>LIFECYCLE CHRONOLOGY</div>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 5 }}>
            {events.map((event, index) => <div key={`${event.label}-${index}`} style={{ display: "flex",
              alignItems: "center", gap: 5, color: C.slateM, fontSize: T.label }}>
              {index > 0 && <span aria-hidden="true" style={{ color: C.slateL }}>→</span>}
              <span style={{ border: `1px solid ${C.border}`, background: C.paper,
                borderRadius: 4, padding: "3px 5px" }}>
                <strong>{event.label}</strong> · {lifecycleMoment(event.at)}
              </span>
            </div>)}
          </div>
        </div>
        <div>
          <div style={{ color: C.slateL, fontSize: T.micro, fontWeight: 800 }}>COMMERCIAL EFFECTIVE PERIOD · NOT LIFECYCLE</div>
          <div style={{ color: C.slateM, fontSize: T.label, marginTop: 6 }}>
            {release.effective_from || "Start unavailable"} → {release.effective_until || "open-ended"}
          </div>
        </div>
      </div>
    </div>
  );
}

// What this Release changes against the one a Batch would actually price with
// today. Version identity decides; a component the caller cannot see is
// reported as such rather than counted as same or different.
function ComparisonPanel({ comparison }) {
  return (
    <section aria-label="Comparison with the automatic default"
      style={{ ...panel, padding: 10, marginTop: 8 }}>
      <div style={{ fontSize: T.body, color: C.slateM, marginBottom: 7 }}>
        Compared with <strong>{comparison.baselineName}</strong>, the automatic default on this date.{" "}
        {comparison.differing === 0
          ? "No governed component differs."
          : `${comparison.differing} of 4 components differ.`}
        {comparison.incomparable > 0
          && ` ${comparison.incomparable} cannot be compared from this caller's read.`}
      </div>
      <table style={denseTable}>
        <thead><tr>
          <Head>Component</Head><Head>Default</Head><Head>This release</Head><Head>Verdict</Head>
        </tr></thead>
        <tbody>
          {comparison.rows.map(row => (
            <tr key={row.key}>
              <Cell emphasis>{row.label}</Cell>
              <Cell>{row.baseline}</Cell>
              <Cell>{row.current}</Cell>
              <Cell>
                {!row.comparable
                  ? <span style={{ color: C.slateL }}>Cannot compare</span>
                  : row.differs
                    ? <span style={{ color: C.amberD, fontWeight: 750 }}>Differs</span>
                    : <span style={{ color: C.green }}>Same version</span>}
                {row.values.length > 0 && <div style={{ color: C.slateM, marginTop: 2 }}>
                  {row.values.map(value => (
                    <div key={value.label}>{value.label}: {value.baseline} → {value.current}</div>
                  ))}
                </div>}
              </Cell>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function ReleaseCard({ release, asOf, defaultRelease }) {
  const [policyOpen, setPolicyOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const comparison = useMemo(() => compareReleaseComponents(release, defaultRelease),
    [release, defaultRelease]);
  const eligibility = releaseEligibility(release, asOf);
  const parts = release.components || {};
  const rate = parts.rate;
  const freight = parts.freight;
  const sector = parts.sector;
  const defaults = parts.calculation_defaults;
  const eligibilityColors = eligibility.eligible
    ? { color: C.green, background: C.greenL, border: C.green }
    : eligibility.tone === "warning"
      ? { color: C.amberD, background: C.amberL, border: C.amber }
      : { color: C.slateL, background: C.paper, border: C.border };

  return (
    <article style={{ ...panel, overflow: "hidden" }}>
      <div style={{ padding: "12px 14px", borderBottom: `1px solid ${C.border}`,
        display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 230 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <h3 style={{ fontSize: T.title, color: C.slate, margin: 0 }}>{release.release_name || "Unnamed release"}</h3>
            <LifecycleBadge status={release.status} />
            {release.is_automatic_default && (
              <span style={{ fontSize: T.label, fontWeight: 800, color: C.green,
                background: C.greenL, padding: "2px 6px", borderRadius: 9 }}>AUTOMATIC DEFAULT</span>
            )}
            {release.self_approved && (
              <span title="The proposer and approver were the same authorised person."
                style={{ fontSize: T.label, fontWeight: 800, color: C.amberD,
                  background: C.amberL, padding: "2px 6px", borderRadius: 9 }}>SELF-APPROVED</span>
            )}
          </div>
          <div style={{ fontSize: T.body, color: C.slateL, marginTop: 5 }}>
            <strong>Pricing Basis Release plant:</strong>{" "}
            <PermanentCode code={release.plant?.plant_code || "Plant unavailable"} style={{ fontSize: T.body }} />
            {release.plant?.name ? ` · ${release.plant.name}` : ""}
            {` · effective ${release.effective_from || "—"} to ${release.effective_until || "open-ended"}`}
          </div>
        </div>
        <div style={{ border: `1px solid ${eligibilityColors.border}`, color: eligibilityColors.color,
          background: eligibilityColors.background, borderRadius: 6, padding: "6px 9px",
          maxWidth: 280, fontSize: T.body, fontWeight: 700, lineHeight: 1.35 }}>
          {eligibility.eligible ? "✓ " : ""}{eligibility.reason}
        </div>
      </div>

      <ReleaseChronology release={release} />

      <div style={{ padding: 12, background: C.cream }}>
        <div style={{ fontSize: T.label, color: C.slateL, fontWeight: 800, marginBottom: 7,
          textTransform: "uppercase", letterSpacing: ".06em" }}>Governed composition</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 8 }}>
          <BasisPart eyebrow="Rate" component={rate}
            title={rate ? `${rate.set_name} · v${rate.version_no}` : "Rate Set version"}
            historyLabel="Rate version" drilldownLabel="Rate details"
            drilldown={<RateDrilldown rate={rate} />}>
            <div>Owning plant: {rate?.owning_plant
              ? `${rate.owning_plant.plant_code} · ${rate.owning_plant.name}`
              : "unavailable"}</div>
            <div>The governed material-rate version used by this release.</div>
          </BasisPart>

          <BasisPart eyebrow="Freight" component={freight}
            title={freight ? `${freight.set_name} · v${freight.version_no}` : "Freight Set version"}
            historyLabel="Freight version" drilldownLabel="Freight details"
            drilldown={<FreightDrilldown freight={freight} />}>
            <div>Owning plant: {freight?.owning_plant
              ? `${freight.owning_plant.plant_code} · ${freight.owning_plant.name}`
              : "unavailable"}</div>
            {freight?.effective_from ? `Effective from ${freight.effective_from}. ` : ""}
            Missing routes remain missing; an explicit zero remains zero.
          </BasisPart>

          <BasisPart eyebrow="Sector" component={sector}
            title={sector ? `${sector.name} · v${sector.version_no}` : "Sector version"}
            historyLabel="Sector version">
            <div>Waste: CBB {value(sector?.waste_cbb_pct, "%")} · PP {value(sector?.waste_pp_pct, "%")}</div>
            <div>Conversion: Box {value(sector?.conv_box_rate, "/kg")} · PP {value(sector?.conv_pp_rate, "/kg")}</div>
            <div>Target margin: {value(sector?.margin_pct, "%")}</div>
          </BasisPart>

          <BasisPart eyebrow="Calculation" component={defaults}
            title={defaults ? `Calculation basis · v${defaults.version_no}` : "Calculation Default version"}
            historyLabel="Calculation Default">
            <div>Annual interest: {value(defaults?.annual_interest_pct, "%")} / {value(defaults?.day_count_basis, " days")}</div>
            <div>Rounding: nearest {value(defaults?.rounding_step)}</div>
            <div title={defaults?.engine_version} style={{ fontFamily: mono, fontSize: T.label,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {defaults?.engine_version || "Engine identity unavailable"}
            </div>
          </BasisPart>
        </div>
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginTop: 9 }}>
          <button type="button" onClick={() => setPolicyOpen(open => !open)}
            aria-expanded={policyOpen}
            style={{ border: `1px solid ${C.border}`, borderRadius: 5,
              background: C.white, color: C.slate, fontSize: T.body, fontWeight: 750,
              padding: "6px 9px", cursor: "pointer" }}>
            {policyOpen ? "Hide Sector & Default details" : "View Sector & Default details"}
          </button>
          {comparison && <button type="button" onClick={() => setCompareOpen(open => !open)}
            aria-expanded={compareOpen}
            style={{ border: `1px solid ${C.border}`, borderRadius: 5,
              background: C.white, color: C.slate, fontSize: T.body, fontWeight: 750,
              padding: "6px 9px", cursor: "pointer" }}>
            {compareOpen ? "Hide comparison" : `Compare with today's default${
              comparison.differing > 0 ? ` · ${comparison.differing} differ` : ""}`}
          </button>}
        </div>
        {compareOpen && comparison && <ComparisonPanel comparison={comparison} />}
        {policyOpen && <div style={{ marginTop: 8 }}>
          <SectorDefaultDrilldown sector={sector} defaults={defaults} />
        </div>}
      </div>
    </article>
  );
}

export default function PricingBasisScreen({ fixtureOnly = false, onExitFixture }) {
  const { isActive } = useAuth();
  // Only the localhost-only Batch pricing card reads these.
  const { batchProfile, u3PricingBasisDraft, setU3PricingBasisDraft, showToast } = useAppState();
  const [state, setState] = useState({ status: fixtureOnly ? "ready" : "loading", releases: [], partial: false });
  const [reloadKey, setReloadKey] = useState(0);
  const [readAt, setReadAt] = useState(null);
  const [asOf, setAsOf] = useState(() => localIsoDate());
  const [plantCode, setPlantCode] = useState("all");
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState("eligible");
  // Follow-up scalability debt, deliberately not infrastructure now: move
  // summary filtering to the server only when a real catalogue exceeds this
  // bounded UX or measured payload/latency becomes unacceptable.
  const [visibleCount, setVisibleCount] = useState(50);
  const [openRows, setOpenRows] = useState(() => new Set());
  const [illustrating, setIllustrating] = useState(fixtureOnly);

  useEffect(() => {
    if (!isActive || fixtureOnly) return;
    let cancelled = false;
    (async () => {
      setState(s => ({ ...s, status: "loading" }));
      let resp, data;
      try {
        resp = await apiFetch("/masters/pricing-basis-releases");
        data = await resp.json().catch(() => ({}));
      } catch {
        if (!cancelled) setState({ status: "error", releases: [], partial: false });
        return;
      }
      if (cancelled) return;
      const verdict = classifyResponse({ ok: resp.ok, status: resp.status, data });
      if (verdict.kind === "access-denied") {
        setState({ status: "denied", releases: [], partial: false, message: verdict.message });
      } else if (verdict.kind === "ok") {
        setState({
          status: "ready",
          releases: Array.isArray(data.releases) ? data.releases : [],
          partial: data.components_partial === true,
        });
        setReadAt(new Date());
      } else {
        setState({ status: "error", releases: [], partial: false, message: verdict.message });
      }
    })();
    return () => { cancelled = true; };
  }, [fixtureOnly, isActive, reloadKey]);

  const source = illustrating ? PRICING_BASIS_ILLUSTRATION : state.releases;
  const plantCodes = useMemo(() => [...new Set(source.map(r => r.plant?.plant_code).filter(Boolean))].sort(), [source]);
  const matches = useMemo(() => filterPricingBasisReleases(source, {
    plantCode, asOf, query, scope,
  }), [asOf, plantCode, query, scope, source]);
  const shown = matches.slice(0, visibleCount);

  if (!isActive) return <AccessDeniedState reason="Your account is deactivated." />;
  if (state.status === "loading") return <LoadingState label="Loading governed Pricing Basis Releases…" />;
  if (state.status === "denied") {
    return <AccessDeniedState reason={state.message || "Pricing Basis access requires plant access."} />;
  }
  if (state.status === "error") {
    return (
      <div style={{ padding: 24, fontFamily: sans }}>
        <div style={{ fontSize: T.title, fontWeight: 750, color: C.red }}>Could not load Pricing Basis Releases</div>
        <div style={{ fontSize: T.body, color: C.slateM, margin: "5px 0 12px" }}>
          {state.message || "The governed read did not succeed. No local value has been substituted."}
        </div>
        <button type="button" onClick={() => setReloadKey(k => k + 1)} style={{ fontSize: T.body,
          padding: "5px 12px", borderRadius: 4, border: `1px solid ${C.border}`,
          background: C.white, cursor: "pointer" }}>Retry</button>
      </div>
    );
  }

  // Plants in view, and the Release each one prices with on the chosen date.
  const plantsInView = plantCode !== "all" ? [plantCode] : plantCodes;
  const defaultsNow = plantsInView
    .map(code => ({ code, release: defaultReleaseOn(source, code, asOf) }))
    .filter(entry => entry.release);

  const toggleRow = id => setOpenRows(open => {
    const next = new Set(open);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column",
      fontFamily: sans, boxSizing: "border-box", overflow: "hidden" }}>

      {/* ONE toolbar, at the shared height. The screen name lives in the TopBar,
          so it is not repeated here; the fixture preview has no TopBar. */}
      <div role="toolbar" aria-label="Pricing Basis controls" style={toolbar}>
        {fixtureOnly && <ToolbarLabel title="Fixture preview has no TopBar">Pricing Basis</ToolbarLabel>}
        <select aria-label="Producing Plant" value={plantCode} style={control}
          onChange={e => { setPlantCode(e.target.value); setVisibleCount(50); }}>
          <option value="all">All accessible plants</option>
          {plantCodes.map(code => <option value={code} key={code}>{code}</option>)}
        </select>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 4,
          fontSize: T.label, color: C.slateL, fontWeight: 700 }}>
          on
          <input type="date" aria-label="Eligibility date" value={asOf} style={control}
            onChange={e => { setAsOf(e.target.value); setVisibleCount(50); }} />
        </label>
        <select aria-label="Show" value={scope} style={control}
          onChange={event => { setScope(event.target.value); setVisibleCount(50); }}>
          <option value="eligible">Eligible on date</option>
          <option value="default">Automatic defaults</option>
          <option value="alternative">Approved alternatives</option>
          <option value="draft">Drafts</option>
          <option value="withdrawn">Withdrawn</option>
          <option value="all">All lifecycle states</option>
        </select>
        <input type="search" aria-label="Find Release" value={query}
          placeholder="Name, permanent ID or plant"
          onChange={event => { setQuery(event.target.value); setVisibleCount(50); }}
          style={{ ...control, flex: "1 1 190px", minWidth: 130 }} />
        <details style={{ position: "relative" }}>
          <summary style={menuSummary(false)}>How to read this</summary>
          <div style={{ ...menuPanel, minWidth: 360, fontSize: T.label,
            color: C.slateM, lineHeight: 1.5 }}>
            <div><strong>A Release is one frozen set of four governed masters</strong> — a Rate, Freight,
              Sector and Calculation version — that a Batch at one plant prices with on a date.</div>
            <div><strong>DEFAULT</strong> applies automatically. <strong>ALTERNATIVE</strong> is approved
              but has to be chosen deliberately on the Batch. <strong>Draft</strong> and
              <strong> Withdrawn</strong> price nothing.</div>
            <div><strong>Eligible</strong> means approved and inside its effective period on the date
              above — nothing else.</div>
            <div>Brief catalogue view. Details and governed composition open only when requested.
              Customer-focused Releases are found by governed Release name; no customer relationship is inferred.</div>
            <div>Same-plant composition is database-enforced — the Release, Rate version and Freight version
              share composite plant foreign keys, so this is not frontend filtering. No replacement link exists
              in the current schema, so this screen does not assert replacement lineage between Releases.</div>
          </div>
        </details>
        <span style={{ marginLeft: "auto", fontSize: T.label, color: C.slateL, whiteSpace: "nowrap" }}>
          {matches.length} match{matches.length === 1 ? "" : "es"}
        </span>
        {!fixtureOnly && <button type="button" style={control}
          onClick={() => { setIllustrating(false); setReloadKey(k => k + 1); }}>Refresh</button>}
      </div>

      {/* The question this screen exists to answer, before any catalogue. */}
      <div style={{ display: "flex", gap: 9, flexWrap: "wrap", alignItems: "baseline",
        padding: "5px 10px", borderBottom: `1px solid ${C.border}`, background: C.white,
        fontSize: T.label, color: C.slateM, flexShrink: 0 }}>
        <ToolbarLabel title="The Release a Batch at this plant prices with on the chosen date">
          Applies on {asOf}
        </ToolbarLabel>
        {defaultsNow.length === 0
          ? <span style={{ color: C.slateL }}>
              No plant in view has an automatic default on this date.
            </span>
          : defaultsNow.map(({ code, release }) => (
            <span key={code} style={{ minWidth: 0 }}>
              <strong style={{ fontFamily: mono }}>{code}</strong>{" "}
              {release.release_name || `Release #${release.id}`}
              <span style={{ color: C.slateL }}>
                {" · "}{releaseComponentSummary(release).map(part => part.compact).join(" · ")}
              </span>
            </span>
          ))}
      </div>

      {illustrating && (
        <div role="status" style={{ padding: "5px 10px", borderBottom: `1px solid ${C.amber}`,
          background: C.amberL, color: C.slateM, fontSize: T.label, fontWeight: 650, flexShrink: 0 }}>
          Illustrative UX fixture — not authoritative data, not saved, and never mixed with the live response.
          <button type="button" onClick={() => {
            if (fixtureOnly) onExitFixture?.();
            else { setIllustrating(false); setPlantCode("all"); }
          }}
            style={{ marginLeft: 8, border: "none", background: "transparent", color: C.amberD,
              cursor: "pointer", fontWeight: 800, fontSize: T.label }}>
            {fixtureOnly ? "Exit illustration" : "Return to live data"}
          </button>
        </div>
      )}

      {state.partial && !illustrating && (
        <div role="status" style={{ padding: "5px 10px", borderBottom: `1px solid ${C.amber}`,
          background: C.amberL, color: C.slateM, fontSize: T.label, flexShrink: 0 }}>
          Some governed component details are unavailable to this caller. Missing values are labelled; none are guessed.
        </div>
      )}

      {/* PO ruling 2026-09-22: the Batch pricing card belongs on localhost only,
          never on the deployed application. import.meta.env.DEV is false under
          vite build, so a production bundle has no path to it. */}
      {import.meta.env.DEV && <div style={{ borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        {fixtureOnly
          ? <BatchPricingCard fixtureOnly fallbackPlantCode="NAG" />
          : <BatchPricingCard fallbackPlantCode={batchProfile?.plant}
              draft={u3PricingBasisDraft} setDraft={setU3PricingBasisDraft} showToast={showToast} />}
      </div>}

      <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
        {source.length === 0 ? (
          <div style={{ padding: 12 }}>
            <EmptyState title="No Pricing Basis Releases are available for your plants."
              hint="This is the live governed result. A release must be created and approved before it can become eligible." />
            {import.meta.env.DEV && (
              <div style={{ textAlign: "center", paddingBottom: 20 }}>
                <button type="button" style={control}
                  onClick={() => { setIllustrating(true); setPlantCode("all"); }}>
                  Show the labelled UX illustration
                </button>
              </div>
            )}
          </div>
        ) : matches.length === 0 ? (
          <div style={{ padding: 12 }}>
            <EmptyState title="No Releases match these filters."
              hint="Change the date, plant, lifecycle view or search. No hidden record is inferred." />
          </div>
        ) : (
          <>
            <table style={denseTable}>
              <thead>
                <tr>
                  <th scope="col" style={{ ...denseHead, ...frozenCell(false, true) }}>Release</th>
                  <th scope="col" style={denseHead}>Plant</th>
                  <th scope="col" style={denseHead}>Effective period</th>
                  <th scope="col" style={denseHead}>Composition</th>
                  <th scope="col" style={denseHead}>Role</th>
                  <th scope="col" style={denseHead}>On {asOf}</th>
                </tr>
              </thead>
              <tbody>
                {shown.map(release => (
                  <ReleaseRow key={release.id} release={release} asOf={asOf}
                    defaultRelease={defaultReleaseOn(source, release.plant?.plant_code, asOf)}
                    expanded={openRows.has(release.id)}
                    onToggle={() => toggleRow(release.id)} />
                ))}
              </tbody>
            </table>
            {shown.length < matches.length && (
              <div style={{ padding: "8px 10px", display: "flex", alignItems: "center", gap: 8,
                fontSize: T.label, color: C.slateM }}>
                <button type="button" style={control}
                  onClick={() => setVisibleCount(count => count + 50)}>
                  Show 50 more
                </button>
                <span role="status">
                  Results limited to the first {shown.length} matching Releases. This is not the complete matching catalogue;
                  {" "}{matches.length - shown.length} more
                  match{matches.length - shown.length === 1 ? "es" : ""} the current filters.
                </span>
              </div>
            )}
          </>
        )}
      </div>

      <ScreenFooter right={illustrating ? "Fixture view"
        : `Live read ${readAt ? readAt.toLocaleTimeString() : "—"}`}>
        <span>Governed read · no mutations</span>
        <span>· DEFAULT applies automatically · ALTERNATIVE must be chosen on the Batch · Draft and Withdrawn price nothing</span>
      </ScreenFooter>
    </div>
  );
}

// One dense catalogue row: identity frozen at the left, the four component
// versions readable without opening anything, and every secondary fact inside
// the expanded row rather than in a taller row.
function ReleaseRow({ release, asOf, defaultRelease, expanded, onToggle }) {
  const eligibility = releaseEligibility(release, asOf);
  const composition = releaseComponentSummary(release);
  const role = release.is_automatic_default
    ? { label: "DEFAULT", fg: C.green, bg: C.greenL }
    : release.status === "approved"
      ? { label: "ALTERNATIVE", fg: C.slateL, bg: C.paper }
      : { label: release.status || "unknown", fg: C.slateM, bg: C.paper };
  const chip = tone => ({ color: tone.fg, background: tone.bg, borderRadius: 8,
    padding: "1px 5px", fontSize: T.micro, fontWeight: 800, textTransform: "uppercase" });
  // The full sentence stays on hover; the cell carries the verdict alone.
  const shortReason = eligibility.eligible ? "Eligible"
    : String(eligibility.reason || "").split(/[;.]/)[0];
  return (
    <>
      <tr>
        <td style={{ ...frozenCell(expanded), maxWidth: 260 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5, minWidth: 0 }}>
            <RowDisclosure open={expanded} onToggle={onToggle}
              label={`Detail for ${release.release_name || release.id}`} />
            <span title={`${release.release_name || "Unnamed Release"} · Release #${release.id}`}
              style={{ fontWeight: 750, color: C.slate, overflow: "hidden", textOverflow: "ellipsis" }}>
              {release.release_name || "Unnamed Release"}
            </span>
          </div>
        </td>
        <td style={denseCell} title={release.plant?.name || ""}>
          <span style={{ fontFamily: mono }}>{release.plant?.plant_code || "—"}</span>
        </td>
        <td style={denseCell}>
          {release.effective_from || "—"} → {release.effective_until || "open-ended"}
        </td>
        <td style={{ ...denseCell, maxWidth: 330 }}
          title={composition.map(part => part.text).join(" · ")}>
          {composition.map(part => part.compact).join(" · ")}
        </td>
        <td style={denseCell}>
          <span style={chip(role)}>{role.label}</span>
          {release.self_approved && <span title="The proposer and approver were the same authorised person."
            style={{ ...chip({ fg: C.amberD, bg: C.amberL }), marginLeft: 4 }}>Self-approved</span>}
        </td>
        <td style={denseCell} title={eligibility.reason}>
          <span style={{ color: eligibility.eligible ? C.green : C.slateL,
            fontWeight: eligibility.eligible ? 750 : 500 }}>{shortReason}</span>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={6} style={{ padding: 8, background: C.cream,
            borderBottom: `1px solid ${C.border}` }}>
            <ReleaseCard release={release} asOf={asOf} defaultRelease={defaultRelease} />
          </td>
        </tr>
      )}
    </>
  );
}
