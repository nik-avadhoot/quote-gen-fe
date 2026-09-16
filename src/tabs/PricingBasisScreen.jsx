import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../AuthContext.jsx";
import { apiFetch } from "../lib/apiClient.js";
import { classifyResponse } from "../lib/backendError.js";
import {
  customerInterestPolicy,
  filterPricingBasisReleases,
  localIsoDate,
  PRICING_BASIS_ILLUSTRATION,
  releaseEligibility,
  releaseResolutionLadders,
} from "../lib/pricingBasisModel.js";
import { AccessDeniedState, EmptyState, LoadingState } from "../ui/appStates.jsx";
import { LifecycleBadge, PermanentCode, SummaryRow } from "../ui/dataDisplay.jsx";
import { denseCell, denseHead, denseTable } from "../ui/screenStandards.js";
import { C, T, mono, sans } from "../theme.js";
import BatchPricingCard from "./batch/BatchPricingCard.jsx";

const panel = { border: `1px solid ${C.border}`, borderRadius: 8, background: C.white };

function value(value, suffix = "") {
  return value === null || value === undefined || value === ""
    ? "Inherited fallback"
    : `${value}${suffix}`;
}

function BasisPart({ title, eyebrow, component, historyLabel, children, drilldownLabel, drilldown }) {
  const [drilldownOpen, setDrilldownOpen] = useState(false);
  const positive = ["active", "approved", "current", "published"].includes(component?.status);
  return (
    <SummaryRow title={eyebrow}
      facts={[title]}
      status={component?.status || "Unavailable"}
      statusTone={!component ? "warning" : positive ? "positive" : "neutral"}
      style={{ minWidth: 0 }}
    >
      {component
        ? <div style={{ fontSize: T.body, color: C.slateM, lineHeight: 1.55 }}>{children}</div>
        : <div style={{ fontSize: T.body, color: C.slateL, lineHeight: 1.45 }}>
            This governed source was not visible in the current caller-scoped read. No value is guessed.
          </div>}
      <VersionHistory label={historyLabel} versions={component?.history} />
      {drilldown && <div style={{ marginTop: 9 }}>
        <button type="button" onClick={() => setDrilldownOpen(open => !open)}
          aria-expanded={drilldownOpen}
          style={{ border: `1px solid ${C.border}`, borderRadius: 5,
            background: C.white, color: C.slate, fontSize: T.label, fontWeight: 750,
            padding: "6px 9px", cursor: "pointer" }}>
          {drilldownOpen ? `Hide ${drilldownLabel}` : `View ${drilldownLabel}`}
        </button>
        {drilldownOpen && <div style={{ marginTop: 8 }}>{drilldown}</div>}
      </div>}
    </SummaryRow>
  );
}

function Identity({ setLabel, component }) {
  if (!component) return null;
  return (
    <div style={{ fontFamily: mono, fontSize: 9, color: C.slateL, overflowWrap: "anywhere" }}>
      {setLabel} #{component.set_id} · version #{component.id}
    </div>
  );
}

function VersionHistory({ label, versions = [] }) {
  return (
    <div style={{ marginTop: 9 }}>
      <div style={{ fontSize: 9, color: C.slateL, fontWeight: 800, marginBottom: 5 }}>
        {label} lifecycle
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {versions.length === 0
          ? <span style={{ fontSize: 9.5, color: C.slateL }}>No caller-visible version history.</span>
          : versions.map(version => (
            <div key={version.id} style={{ border: `1px solid ${C.border}`, borderRadius: 5,
              padding: "4px 6px", background: C.white, fontSize: 9.5, color: C.slateM }}>
              <span style={{ fontWeight: 800 }}>v{version.version_no}</span>{" "}
              <LifecycleBadge status={version.status} />
              {version.effective_from ? ` · from ${version.effective_from}` : ""}
            </div>
          ))}
      </div>
    </div>
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
    background: C.amberL, color: C.slateM, fontSize: 9.5, lineHeight: 1.45 }}>{children}</div>;
}

function RateDrilldown({ rate }) {
  if (!rate) return <DrilldownNotice>Rate version details are not visible to this caller. Nothing is inferred.</DrilldownNotice>;
  const entries = rate.entries || [];
  return (
    <section aria-label="Rate version drill-down" style={{ ...panel, padding: 11 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 230 }}>
          <div style={{ fontSize: 10.5, color: C.slate, fontWeight: 800 }}>
            Rate Set · {rate.set_name} · v{rate.version_no}
          </div>
          <Identity setLabel="Rate Set" component={rate} />
          <div style={{ fontSize: 9.5, color: C.slateM, marginTop: 3 }}>
            Owning plant: <strong>{rate.owning_plant
              ? `${rate.owning_plant.plant_code} · ${rate.owning_plant.name}`
              : "unavailable to this caller"}</strong>
          </div>
        </div>
        <LifecycleBadge status={rate.status} />
      </div>
      <div style={{ marginTop: 8, padding: "7px 8px", borderRadius: 5,
        background: C.blueL || C.paper, border: `1px solid ${C.border}`, fontSize: 9.5,
        color: C.slateM, lineHeight: 1.45 }}>
        <strong>Upstream Rate Master derivation only.</strong>{" "}
        Base price + supplier-credit cost − discount + inbound freight = effective material rate.
        Supplier-credit values shown here are not Batch Calculate inputs.
      </div>
      <div style={{ marginTop: 6, padding: "7px 8px", borderRadius: 5,
        background: C.greenL, border: `1px solid ${C.green}`, fontSize: 9.5,
        color: C.slateM, lineHeight: 1.45 }}>
        <strong>Downstream calculation boundary:</strong> Batch Calculate receives the grade code and governed
        effective material rate only. Raw price, discount, freight and supplier-credit terms do not cross it.
      </div>
      {rate.entries_available === false ? (
        <div style={{ marginTop: 8 }}><DrilldownNotice>
          Grade/rate entries are unavailable in this caller-scoped read. No fallback rows are displayed.
        </DrilldownNotice></div>
      ) : entries.length === 0 ? (
        <div style={{ marginTop: 8, fontSize: 9.5, color: C.slateL }}>
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
      <div style={{ marginTop: 7, fontSize: 9.5, color: C.slateL }}>
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
          <div style={{ fontSize: 10.5, color: C.slate, fontWeight: 800 }}>
            Freight Set · {freight.set_name} · v{freight.version_no}
          </div>
          <Identity setLabel="Freight Set" component={freight} />
          <div style={{ fontSize: 9.5, color: C.slateM, marginTop: 3 }}>
            Set/version owner: <strong>{freight.owning_plant
              ? `${freight.owning_plant.plant_code} · ${freight.owning_plant.name}`
              : "unavailable to this caller"}</strong>
          </div>
          <div style={{ fontSize: 9.5, color: C.slateL, marginTop: 3 }}>
            Effective from {freight.effective_from || "not recorded"}
          </div>
        </div>
        <LifecycleBadge status={freight.status} />
      </div>
      <div style={{ marginTop: 8, fontSize: 9.5, color: C.slateM, lineHeight: 1.45 }}>
        Canonical lane dimensions are <strong>origin plant × destination Ship-to</strong>; the current governed
        Freight schema has no vehicle-class dimension. Basis: freight rate per kg.
        The Freight Set owner shown above is not the lane origin shown in each row.
      </div>
      {freight.entries_available === false ? (
        <div style={{ marginTop: 8 }}><DrilldownNotice>
          Freight lanes are unavailable in this caller-scoped read. No fallback lanes are displayed.
        </DrilldownNotice></div>
      ) : entries.length === 0 ? (
        <div style={{ marginTop: 8, fontSize: 9.5, color: C.slateL }}>
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
      <div style={{ marginTop: 7, fontSize: 9.5, color: C.slateL }}>
        A displayed 0.0000 is an explicit governed value. An unlisted destination or unavailable row remains missing.
      </div>
      {freight.missing_destinations_available === false ? <div style={{ marginTop: 7 }}><DrilldownNotice>
        Missing-destination coverage is unavailable in this caller-scoped read; no hidden Ship-to is named.
      </DrilldownNotice></div> : (freight.missing_destinations || []).length > 0 && (
        <div style={{ marginTop: 8, border: `1px dashed ${C.amber}`, borderRadius: 5,
          padding: "7px 8px", background: C.amberL }}>
          <div style={{ fontSize: 9, color: C.amberD, fontWeight: 800 }}>MISSING LANES · ABSENT, NOT ZERO</div>
          {(freight.missing_destinations || []).map(destination => (
            <div key={destination.id} style={{ fontSize: 9.5, color: C.slateM, marginTop: 4 }}>
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
      <div style={{ fontSize: 10, fontWeight: 800, color: C.slate, marginBottom: 6 }}>{ladder.label}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(118px, 1fr))",
        gap: 5, overflowX: "auto", paddingBottom: 2 }}>
        {ladder.tiers.map((tier, index) => {
          const active = tier.source === ladder.releaseSource;
          return <div key={tier.source} style={{ position: "relative", minWidth: 118,
            border: `1px solid ${active ? C.green : C.border}`, borderRadius: 5, padding: "6px 7px",
            background: active ? C.greenL : tier.state === "unavailable" || tier.state === "active" ? C.redL : C.cream }}>
            <div style={{ fontSize: 8.5, color: C.slateL, fontWeight: 800 }}>{index + 1}. {tier.label}</div>
            <div style={{ fontSize: 9.5, color: active ? C.green : C.slateM,
              fontWeight: active ? 800 : 550, marginTop: 3 }}>{tierText(tier, ladder.unit)}</div>
          </div>;
        })}
      </div>
      <div style={{ marginTop: 5, fontSize: 9, color: C.slateL }}>
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
              <div style={{ fontSize: 10.5, color: C.slate, fontWeight: 800 }}>
                Sector · {sector ? `${sector.sector_code} · ${sector.name} · v${sector.version_no}` : "Details unavailable"}
              </div>
              {sector && <div style={{ fontFamily: mono, fontSize: 9, color: C.slateL }}>
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
              <div style={{ fontSize: 10.5, color: C.slate, fontWeight: 800 }}>
                Calculation Default · {defaults ? `v${defaults.version_no}` : "Details unavailable"}
              </div>
              {defaults && <div style={{ fontFamily: mono, fontSize: 9, color: C.slateL }}>
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
        borderRadius: 6, background: C.paper, fontSize: 9.5, color: C.slateM, lineHeight: 1.45 }}>
        <strong>Canonical inheritance:</strong> waste, conversion and margin use Row override → Batch Profile override
        → Sector version → Calculation Default fallback → unresolved. Pricing Group is not a tier for these fields;
        it governs customer payment terms and freight.
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 8 }}>
        {ladders.map(ladder => <ResolutionLadder key={ladder.key} ladder={ladder} />)}
      </div>

      <div style={{ ...panel, marginTop: 10, padding: 10 }}>
        <div style={{ fontSize: 10.5, color: C.slate, fontWeight: 800 }}>Customer Payment-Term Interest</div>
        <div style={{ fontSize: 9.5, color: C.slateM, lineHeight: 1.45, marginTop: 4 }}>
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
                <div style={{ fontSize: 8.5, color: C.slateL, fontWeight: 800 }}>PRICING GROUP OVERRIDE</div>
                <div style={{ fontSize: 9.5, color: C.slateM, marginTop: 3 }}>Batch-specific; requires a stated reason.</div>
              </div>
              <div style={{ ...panel, padding: 8, background: C.greenL }}>
                <div style={{ fontSize: 8.5, color: C.slateL, fontWeight: 800 }}>ANNUAL POLICY · DERIVATION INPUT</div>
                <div style={{ fontSize: 9.5, color: C.green, fontWeight: 800, marginTop: 3 }}>
                  {interest.annual_interest_pct}% per annum · {interest.day_count_basis}-day basis
                </div>
              </div>
              <div style={{ ...panel, padding: 8, background: C.cream }}>
                <div style={{ fontSize: 8.5, color: C.slateL, fontWeight: 800 }}>INDEPENDENT FALLBACK</div>
                <div style={{ fontSize: 9.5, color: C.slateM, marginTop: 3 }}>
                  {value(interest.interest_fallback_pct, "%")} when no structured term resolves
                </div>
              </div>
              <div style={{ ...panel, padding: 8, background: C.redL }}>
                <div style={{ fontSize: 8.5, color: C.slateL, fontWeight: 800 }}>UNRESOLVED</div>
                <div style={{ fontSize: 9.5, color: C.slateM, marginTop: 3 }}>No override, derivation or fallback.</div>
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
          fontSize: 9.5, lineHeight: 1.45 }}>
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
          <div style={{ color: C.slateL, fontSize: 8.5, fontWeight: 800 }}>LIFECYCLE CHRONOLOGY</div>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 5 }}>
            {events.map((event, index) => <div key={`${event.label}-${index}`} style={{ display: "flex",
              alignItems: "center", gap: 5, color: C.slateM, fontSize: 8.9 }}>
              {index > 0 && <span aria-hidden="true" style={{ color: C.slateL }}>→</span>}
              <span style={{ border: `1px solid ${C.border}`, background: C.paper,
                borderRadius: 4, padding: "3px 5px" }}>
                <strong>{event.label}</strong> · {lifecycleMoment(event.at)}
              </span>
            </div>)}
          </div>
        </div>
        <div>
          <div style={{ color: C.slateL, fontSize: 8.5, fontWeight: 800 }}>COMMERCIAL EFFECTIVE PERIOD · NOT LIFECYCLE</div>
          <div style={{ color: C.slateM, fontSize: 9.2, marginTop: 6 }}>
            {release.effective_from || "Start unavailable"} → {release.effective_until || "open-ended"}
          </div>
          <div style={{ color: C.slateL, fontSize: 8.5, marginTop: 3 }}>
            No replacement link exists in the current schema. A newer governed Release may be a later basis,
            but this screen does not assert replacement lineage.
          </div>
        </div>
      </div>
    </div>
  );
}

function ReleaseCard({ release, asOf }) {
  const [policyOpen, setPolicyOpen] = useState(false);
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
            <h3 style={{ fontSize: 13, color: C.slate, margin: 0 }}>{release.release_name || "Unnamed release"}</h3>
            <LifecycleBadge status={release.status} />
            {release.is_automatic_default && (
              <span style={{ fontSize: 9, fontWeight: 800, color: C.green,
                background: C.greenL, padding: "2px 6px", borderRadius: 9 }}>AUTOMATIC DEFAULT</span>
            )}
            {release.self_approved && (
              <span title="The proposer and approver were the same authorised person."
                style={{ fontSize: 9, fontWeight: 800, color: C.amberD,
                  background: C.amberL, padding: "2px 6px", borderRadius: 9 }}>SELF-APPROVED</span>
            )}
          </div>
          <div style={{ fontSize: 10, color: C.slateL, marginTop: 5 }}>
            <strong>Pricing Basis Release plant:</strong>{" "}
            <PermanentCode code={release.plant?.plant_code || "Plant unavailable"} style={{ fontSize: 10 }} />
            {release.plant?.name ? ` · ${release.plant.name}` : ""}
            {` · effective ${release.effective_from || "—"} to ${release.effective_until || "open-ended"}`}
          </div>
        </div>
        <div style={{ border: `1px solid ${eligibilityColors.border}`, color: eligibilityColors.color,
          background: eligibilityColors.background, borderRadius: 6, padding: "6px 9px",
          maxWidth: 280, fontSize: 10, fontWeight: 700, lineHeight: 1.35 }}>
          {eligibility.eligible ? "✓ " : ""}{eligibility.reason}
        </div>
      </div>

      <ReleaseChronology release={release} />

      <div style={{ padding: 12, background: C.cream }}>
        <div style={{ fontSize: 9, color: C.slateL, fontWeight: 800, marginBottom: 7,
          textTransform: "uppercase", letterSpacing: ".06em" }}>Governed composition</div>
        <div style={{ marginBottom: 8, padding: "7px 8px", border: `1px solid ${C.green}`,
          borderRadius: 5, background: C.greenL, color: C.slateM, fontSize: 9.5, lineHeight: 1.45 }}>
          <strong>Same-plant composition is database-enforced.</strong>{" "}
          The Release, Rate version and Freight version share composite plant foreign keys; this is not frontend filtering.
        </div>
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
            <div title={defaults?.engine_version} style={{ fontFamily: mono, fontSize: 9,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {defaults?.engine_version || "Engine identity unavailable"}
            </div>
          </BasisPart>
        </div>
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginTop: 9 }}>
          <button type="button" onClick={() => setPolicyOpen(open => !open)}
            aria-expanded={policyOpen}
            style={{ border: `1px solid ${C.border}`, borderRadius: 5,
              background: C.white, color: C.slate, fontSize: 10, fontWeight: 750,
              padding: "6px 9px", cursor: "pointer" }}>
            {policyOpen ? "Hide Sector & Default details" : "View Sector & Default details"}
          </button>
        </div>
        {policyOpen && <div style={{ marginTop: 8 }}>
          <SectorDefaultDrilldown sector={sector} defaults={defaults} />
        </div>}
      </div>
    </article>
  );
}

function ReleaseSummaryRow({ release, asOf }) {
  const [expanded, setExpanded] = useState(false);
  const eligibility = releaseEligibility(release, asOf);
  return (
    <article style={{ ...panel, overflow: "hidden" }}>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(230px, 1.5fr) minmax(170px, .8fr) minmax(210px, 1fr) auto",
        alignItems: "center", gap: 10, padding: "8px 10px" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
            <span style={{ color: C.slate, fontSize: 11, fontWeight: 800, overflow: "hidden",
              textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{release.release_name || "Unnamed Release"}</span>
            <LifecycleBadge status={release.status} />
          </div>
          <div style={{ marginTop: 2, color: C.slateL, fontSize: 8.8, fontFamily: mono }}>
            Release #{release.id}
          </div>
        </div>
        <div style={{ color: C.slateM, fontSize: 9.5 }}>
          <strong>{release.plant?.plant_code || "Plant unavailable"}</strong>
          {release.plant?.name ? ` · ${release.plant.name}` : ""}
          <div style={{ color: C.slateL, fontSize: 8.7 }}>Release owner</div>
        </div>
        <div style={{ color: C.slateM, fontSize: 9.5 }}>
          {release.effective_from || "No start"} → {release.effective_until || "open-ended"}
          <div style={{ color: eligibility.eligible ? C.green : C.slateL, fontSize: 8.7,
            fontWeight: eligibility.eligible ? 750 : 500 }}>
            {eligibility.reason}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6 }}>
          {release.is_automatic_default
            ? <span style={{ color: C.green, background: C.greenL, borderRadius: 8,
                padding: "2px 5px", fontSize: 8.2, fontWeight: 800 }}>DEFAULT</span>
            : release.status === "approved"
              ? <span style={{ color: C.slateL, background: C.paper, borderRadius: 8,
                  padding: "2px 5px", fontSize: 8.2, fontWeight: 800 }}>ALTERNATIVE</span>
              : null}
          {release.self_approved && <span title="The proposer and approver were the same authorised person."
            style={{ color: C.amberD, background: C.amberL, borderRadius: 8,
              padding: "2px 5px", fontSize: 8.2, fontWeight: 800 }}>SELF-APPROVED</span>}
          <button type="button" onClick={() => setExpanded(open => !open)} aria-expanded={expanded}
            style={{ border: `1px solid ${C.border}`, background: C.white, color: C.slate,
              borderRadius: 4, padding: "4px 7px", fontSize: 9, fontWeight: 750, cursor: "pointer" }}>
            {expanded ? "Close" : "Details"}
          </button>
        </div>
      </div>
      {expanded && <div style={{ padding: "0 8px 8px", background: C.cream }}>
        <ReleaseCard release={release} asOf={asOf} />
      </div>}
    </article>
  );
}

export default function PricingBasisScreen({ fixtureOnly = false, onExitFixture }) {
  const { isActive } = useAuth();
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
  const groups = useMemo(() => shown.reduce((result, release) => {
    const code = release.plant?.plant_code || "Plant unavailable";
    const existing = result.find(group => group.code === code);
    if (existing) existing.releases.push(release);
    else result.push({ code, name: release.plant?.name || "", releases: [release] });
    return result;
  }, []), [shown]);

  if (!isActive) return <AccessDeniedState reason="Your account is deactivated." />;
  if (state.status === "loading") return <LoadingState label="Loading governed Pricing Basis Releases…" />;
  if (state.status === "denied") {
    return <AccessDeniedState reason={state.message || "Pricing Basis access requires plant access."} />;
  }
  if (state.status === "error") {
    return (
      <div style={{ padding: 24, fontFamily: sans }}>
        <div style={{ fontSize: 13, fontWeight: 750, color: C.red }}>Could not load Pricing Basis Releases</div>
        <div style={{ fontSize: 11, color: C.slateM, margin: "5px 0 12px" }}>
          {state.message || "The governed read did not succeed. No local value has been substituted."}
        </div>
        <button type="button" onClick={() => setReloadKey(k => k + 1)} style={{ fontSize: 11,
          padding: "5px 12px", borderRadius: 4, border: `1px solid ${C.border}`,
          background: C.white, cursor: "pointer" }}>Retry</button>
      </div>
    );
  }

  return (
    <div className="screen-end-padded"
      style={{ height: "100%", overflowY: "auto", padding: 16, fontFamily: sans, boxSizing: "border-box" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
        <div style={{ flex: 1, minWidth: 260 }}>
          <h2 style={{ margin: 0, fontSize: 16, color: C.slate }}>Pricing Basis</h2>
          <div style={{ marginTop: 4, fontSize: 10.5, color: C.slateL, lineHeight: 1.45 }}>
            See which governed Rate, Freight, Sector and Calculation versions form each release—and why it is eligible for a plant and date.
          </div>
        </div>
        <span style={{ fontSize: 9, fontWeight: 800, color: C.green, background: C.greenL,
          borderRadius: 10, padding: "4px 8px" }}>GOVERNED READ · NO MUTATIONS</span>
      </div>

      {illustrating && (
        <div role="status" style={{ padding: "8px 10px", borderRadius: 6, marginBottom: 10,
          border: `1px solid ${C.amber}`, background: C.amberL, color: C.slateM,
          fontSize: 10.5, fontWeight: 650 }}>
          Illustrative UX fixture — not authoritative data, not saved, and never mixed with the live response.
          <button type="button" onClick={() => {
            if (fixtureOnly) onExitFixture?.();
            else { setIllustrating(false); setPlantCode("all"); }
          }}
            style={{ marginLeft: 10, border: "none", background: "transparent", color: C.amberD,
              cursor: "pointer", fontWeight: 800, fontSize: 10 }}>
            {fixtureOnly ? "Exit illustration" : "Return to live data"}
          </button>
        </div>
      )}

      {fixtureOnly && <div style={{ marginBottom: 10, border: `1px solid ${C.border}`, borderRadius: 8,
        overflow: "hidden" }}>
        <BatchPricingCard fixtureOnly fallbackPlantCode="NAG" />
      </div>}

      {state.partial && !illustrating && (
        <div role="status" style={{ padding: "8px 10px", borderRadius: 6, marginBottom: 10,
          border: `1px solid ${C.amber}`, background: C.amberL, color: C.slateM, fontSize: 10.5 }}>
          Some governed component details are unavailable to this caller. Missing values are labelled; none are guessed.
        </div>
      )}

      <div style={{ ...panel, padding: "9px 11px", display: "flex", alignItems: "end", gap: 10,
        flexWrap: "wrap", marginBottom: 10 }}>
        <label style={{ fontSize: 9.5, color: C.slateL, fontWeight: 700 }}>
          Producing Plant
          <select value={plantCode} onChange={e => { setPlantCode(e.target.value); setVisibleCount(50); }}
            style={{ display: "block", marginTop: 3, minWidth: 155, padding: "5px 7px", fontSize: 11,
              border: `1px solid ${C.border}`, borderRadius: 4, background: C.white }}>
            <option value="all">All accessible plants</option>
            {plantCodes.map(code => <option value={code} key={code}>{code}</option>)}
          </select>
        </label>
        <label style={{ fontSize: 9.5, color: C.slateL, fontWeight: 700 }}>
          Eligibility date
          <input type="date" value={asOf} onChange={e => { setAsOf(e.target.value); setVisibleCount(50); }}
            style={{ display: "block", marginTop: 3, padding: "4px 7px", fontSize: 11,
              border: `1px solid ${C.border}`, borderRadius: 4, background: C.white }} />
        </label>
        <label style={{ minWidth: 210, flex: 1, fontSize: 9.5, color: C.slateL, fontWeight: 700 }}>
          Find Release
          <input type="search" value={query} onChange={event => { setQuery(event.target.value); setVisibleCount(50); }}
            placeholder="Name, permanent ID or plant"
            style={{ display: "block", width: "100%", boxSizing: "border-box", marginTop: 3,
              padding: "5px 7px", fontSize: 11, border: `1px solid ${C.border}`,
              borderRadius: 4, background: C.white }} />
        </label>
        <label style={{ fontSize: 9.5, color: C.slateL, fontWeight: 700 }}>
          Show
          <select value={scope} onChange={event => { setScope(event.target.value); setVisibleCount(50); }}
            style={{ display: "block", marginTop: 3, minWidth: 155, padding: "5px 7px", fontSize: 11,
              border: `1px solid ${C.border}`, borderRadius: 4, background: C.white }}>
            <option value="eligible">Eligible on date</option>
            <option value="default">Automatic defaults</option>
            <option value="alternative">Approved alternatives</option>
            <option value="draft">Drafts</option>
            <option value="withdrawn">Withdrawn</option>
            <option value="all">All lifecycle states</option>
          </select>
        </label>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 7 }}>
          <span style={{ fontSize: 9.5, color: C.slateL }}>
            {matches.length} match{matches.length === 1 ? "" : "es"} · {illustrating ? "Fixture view" : `Live read ${readAt ? readAt.toLocaleTimeString() : "—"}`}
          </span>
          {!fixtureOnly && <button type="button" onClick={() => { setIllustrating(false); setReloadKey(k => k + 1); }}
            style={{ fontSize: 10, padding: "4px 9px", borderRadius: 4,
              border: `1px solid ${C.border}`, background: C.white, cursor: "pointer" }}>Refresh live</button>}
        </div>
      </div>

      {source.length === 0 ? (
        <div style={panel}>
          <EmptyState title="No Pricing Basis Releases are available for your plants."
            hint="This is the live governed result. A release must be created and approved before it can become eligible." />
          {import.meta.env.DEV && (
            <div style={{ textAlign: "center", paddingBottom: 20 }}>
              <button type="button" onClick={() => { setIllustrating(true); setPlantCode("all"); }}
                style={{ fontSize: 10.5, padding: "6px 11px", borderRadius: 5,
                  border: `1px solid ${C.amber}`, color: C.amberD, background: C.amberL,
                  cursor: "pointer", fontWeight: 700 }}>View labelled UX illustration</button>
            </div>
          )}
        </div>
      ) : shown.length === 0 ? (
        <div style={panel}><EmptyState title="No Releases match these filters."
          hint="Change the date, plant, lifecycle view or search. No hidden record is inferred." /></div>
      ) : (
        <>
          <div style={{ margin: "0 1px 8px", fontSize: 9.2, color: C.slateL }}>
            Brief catalogue view. Details and governed composition open only when requested.
            Customer-focused Releases are found by governed Release name; no customer relationship is inferred.
          </div>
          {shown.length < matches.length && <div role="status" style={{ margin: "0 1px 8px",
            padding: "6px 8px", border: `1px solid ${C.amber}`, borderRadius: 5,
            background: C.amberL, color: C.slateM, fontSize: 9.2 }}>
            Results limited to the first {shown.length} matching Releases. This is not the complete matching catalogue;
            {matches.length - shown.length} more match{matches.length - shown.length === 1 ? "es" : ""} the current filters.
          </div>}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {groups.map(group => <section key={group.code} aria-label={`Pricing Basis Releases for ${group.code}`}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6, margin: "0 2px 5px" }}>
                <h3 style={{ margin: 0, fontSize: 10.5, color: C.slate }}>{group.code}</h3>
                {group.name && <span style={{ fontSize: 9, color: C.slateL }}>· {group.name}</span>}
                <span style={{ marginLeft: "auto", fontSize: 8.7, color: C.slateL }}>
                  {group.releases.length} shown
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {group.releases.map(release => <ReleaseSummaryRow key={release.id} release={release} asOf={asOf} />)}
              </div>
            </section>)}
          </div>
          {shown.length < matches.length && <div style={{ textAlign: "center", marginTop: 10 }}>
            <button type="button" onClick={() => setVisibleCount(count => count + 50)}
              style={{ border: `1px solid ${C.border}`, borderRadius: 5, padding: "6px 12px",
                background: C.white, color: C.slate, fontSize: 10, fontWeight: 750, cursor: "pointer" }}>
              Show 50 more · {matches.length - shown.length} remaining
            </button>
          </div>}
        </>
      )}

      <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 7,
        background: C.paper, border: `1px solid ${C.border}`, display: "flex",
        alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 250 }}>
          <div style={{ fontSize: 10.5, fontWeight: 800, color: C.slate }}>Backend activation pending</div>
          <div style={{ fontSize: 9.5, color: C.slateL, marginTop: 2 }}>
            Governed Calculate, Atomic Send, approval, return, issue and revision actions remain unavailable. This screen performs reads only.
          </div>
        </div>
        <button type="button" disabled title="Backend activation pending"
          style={{ border: `1px solid ${C.border}`, background: C.white, color: C.slateL,
            opacity: .65, padding: "6px 10px", borderRadius: 5, fontSize: 10, fontWeight: 700 }}>
          Governed Calculate · Backend activation pending
        </button>
      </div>
    </div>
  );
}
