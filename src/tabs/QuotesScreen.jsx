import { useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "../lib/apiClient.js";
import { isFeatureEnabled } from "../lib/featureFlags.js";
import { classifyResponse } from "../lib/backendError.js";
import { revisionShareability } from "../lib/quoteJourney.js";
import {
  orderedQuoteRevisions, quoteActor, quoteRevisionLabel, U5_QUOTE_ILLUSTRATION,
} from "../lib/quoteEvidenceModel.js";
import { AccessDeniedState, EmptyState, LoadingState } from "../ui/appStates.jsx";
import { LifecycleBadge, PermanentCode, ProvenanceTag } from "../ui/dataDisplay.jsx";
import { GovernedActions, ScreenFooter, ShareabilityNote } from "../ui/screenChrome.jsx";
import { control, toolbar } from "../ui/screenStandards.js";
import { C, T, mono, sans } from "../theme.js";

function dateTime(value) {
  if (!value) return "Not recorded";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}

function identity(value) {
  return value === null || value === undefined || value === "" ? "—" : `#${value}`;
}

function EvidencePair({ label, children, mono = false }) {
  return <div className="quote-evidence-pair">
    <span>{label}</span><strong className={mono ? "is-mono" : ""}>{children ?? "—"}</strong>
  </div>;
}

function WorkflowTimeline({ events = [] }) {
  if (!events.length) return <div className="quote-evidence-muted">No caller-visible workflow events.</div>;
  return <ol className="quote-event-timeline">{events.map(event => <li key={event.id}>
    <LifecycleBadge status={event.event_type} />
    <span>{dateTime(event.occurred_at)}</span>
    <strong>{quoteActor(event.actor, event.actor_user_id)}</strong>
    {event.note && <p>{event.note}</p>}
  </li>)}</ol>;
}

function CustomerOutcomeTimeline({ events = [] }) {
  if (!events.length) return <div className="quote-evidence-muted">No caller-visible customer outcome has been recorded.</div>;
  return <ol className="quote-event-timeline">{events.map(event => <li key={event.id}>
    <LifecycleBadge status={event.outcome} />
    <span>{dateTime(event.occurred_at)}</span>
    <strong>{quoteActor(event.recorded_by_actor, event.recorded_by)}</strong>
    {(event.acceptance_date || event.acceptance_reference) && <p>
      {event.acceptance_date ? `Acceptance date ${event.acceptance_date}` : "Acceptance date not recorded"}
      {event.acceptance_reference ? ` · reference ${event.acceptance_reference}` : ""}
    </p>}
    {event.note && <p>{event.note}</p>}
  </li>)}</ol>;
}

function SnapshotCard({ item, index }) {
  const snapshot = item.calculation_snapshot;
  if (!snapshot) return <article className="quote-snapshot-card is-partial">
    <header><strong>Quote Item {index + 1}</strong><span>Snapshot unavailable</span></header>
    <p>This immutable calculation evidence is not caller-visible. No current Batch value is substituted.</p>
  </article>;
  return <article className="quote-snapshot-card">
    <header>
      <div><strong>Quote Item {index + 1}</strong><small>Item {identity(item.id)} · row lineage {identity(item.batch_row_lineage_id)} · pricing group {identity(item.pricing_group_id)}</small></div>
      <span>Frozen snapshot {identity(snapshot.id)}</span>
    </header>
    <div className="quote-evidence-grid">
      <EvidencePair label="Snapshot link" mono>{identity(item.calculation_snapshot_id)}</EvidencePair>
      <EvidencePair label="Snapshot schema">{snapshot.schema_version}</EvidencePair>
      <EvidencePair label="Calculated by">{quoteActor(snapshot.calculated_by_actor, snapshot.calculated_by)}</EvidencePair>
      <EvidencePair label="Computed at">{dateTime(snapshot.calculated_at)}</EvidencePair>
      <EvidencePair label="Engine" mono>{snapshot.engine_version}</EvidencePair>
      <EvidencePair label="Rounding rule" mono>{snapshot.rounding_rule_version}</EvidencePair>
      <EvidencePair label="Pricing date">{snapshot.pricing_date}</EvidencePair>
      <EvidencePair label="Pricing Basis Release" mono>{identity(snapshot.pricing_basis_release_id)}</EvidencePair>
      <EvidencePair label="Calculation Default" mono>{identity(snapshot.calculation_default_version_id)}</EvidencePair>
      <EvidencePair label="Waste">{snapshot.effective_waste_pct} · {snapshot.waste_source}</EvidencePair>
      <EvidencePair label="Conversion">{snapshot.effective_conv_rate} · {snapshot.conv_source}</EvidencePair>
      <EvidencePair label="Margin">{snapshot.effective_margin_pct} · {snapshot.margin_source}</EvidencePair>
      <EvidencePair label="Interest">{snapshot.effective_interest_pct} · {snapshot.interest_source}</EvidencePair>
      <EvidencePair label="Total cost">{snapshot.total_cost}</EvidencePair>
      <EvidencePair label="Final rate">{snapshot.final_rate}</EvidencePair>
      <EvidencePair label="Rate / kg">{snapshot.rate_per_kg}</EvidencePair>
      <EvidencePair label="Calculation MOQ">{snapshot.calc_moq}</EvidencePair>
      <EvidencePair label="Freight">{snapshot.effective_freight} · {snapshot.freight_source} / {snapshot.freight_authority}</EvidencePair>
      <EvidencePair label="Freight Set Version" mono>{identity(snapshot.freight_set_version_id)}</EvidencePair>
      <EvidencePair label="Freight Entry" mono>{identity(snapshot.freight_entry_id)}</EvidencePair>
      <EvidencePair label="Delivery Groups">{item.delivery_groups?.length
        ? item.delivery_groups.map(link => identity(link.delivery_group_id)).join(", ") : "None visible"}</EvidencePair>
    </div>
    <div className="quote-fingerprints">
      <EvidencePair label="Calculation fingerprint" mono>{snapshot.calculation_fingerprint}</EvidencePair>
      <EvidencePair label="Presentation fingerprint" mono>{snapshot.presentation_fingerprint}</EvidencePair>
    </div>
    <details className="quote-frozen-json">
      <summary>Frozen effective inputs and results</summary>
      <div><section><strong>Effective inputs</strong><pre>{JSON.stringify(snapshot.effective_inputs, null, 2)}</pre></section>
        <section><strong>Results</strong><pre>{JSON.stringify(snapshot.results, null, 2)}</pre></section></div>
    </details>
  </article>;
}

// Compact customer view.  It reads only the selected revision and its frozen
// snapshots — never the source Batch, Family, SKU master, or local calculator.
function CustomerDocumentPreview({ quote, revision }) {
  const approved = revision.workflow_status === "approved" && revision.standing !== "superseded";
  const share = revision.share_events?.[0];
  return <section className="quote-evidence-section" aria-label="Customer document preview">
    <h3>Customer document preview</h3>
    <div className="quote-revision-facts">
      <EvidencePair label="Quote">{quote.quote_reference || "Candidate — not approved"}{revision.revision_no != null ? ` · Revision ${revision.revision_no}` : ""}</EvidencePair>
      <EvidencePair label="Recipient">{revision.addressee_name || "Exact recipient unavailable"}</EvidencePair>
      <EvidencePair label="Quote date">{revision.quote_date || "Set when shared"}</EvidencePair>
      <EvidencePair label="Valid to">{revision.offer_validity_to || "Not recorded"}</EvidencePair>
      <EvidencePair label="Customer state">{approved ? "Approved current revision — ready to share" : revision.workflow_status === "issued" ? "Shared revision" : "Candidate only — not shareable"}</EvidencePair>
    </div>
    <div className="quote-snapshot-card">
      {(revision.items || []).map((item, index) => {
        const snapshot = item.calculation_snapshot;
        const entered = snapshot?.effective_inputs?.entered || {};
        const provenance = snapshot?.effective_inputs?.provenance || {};
        const terms = snapshot?.effective_inputs?.resolved?.interest || {};
        return <div key={item.id} className="quote-evidence-grid" style={{ marginBottom: index < revision.items.length - 1 ? 10 : 0 }}>
          <EvidencePair label="Product / SKU">{entered.item_name || `Frozen item ${index + 1}`} · {provenance.row_type || "Product"}</EvidencePair>
          <EvidencePair label="Quantity / MOQ">{entered.volume ?? "Not recorded"} / {entered.sales_moq ?? snapshot?.calc_moq ?? "Not recorded"}</EvidencePair>
          <EvidencePair label="Quoted rate">{snapshot?.final_rate == null ? "Unavailable" : `₹${snapshot.final_rate}`}</EvidencePair>
          <EvidencePair label="Commercial terms">{terms.payment_terms_days == null ? "Not recorded" : `${terms.payment_terms_days} payment days`} · freight {snapshot?.effective_freight ?? "not recorded"}</EvidencePair>
        </div>;
      })}
    </div>
    {share && <div className="quote-revision-facts" style={{ marginTop: 8 }}>
      <EvidencePair label="Shared by">{quoteActor(share.shared_by_actor, share.shared_by)}</EvidencePair>
      <EvidencePair label="Sharing evidence">{share.channel} · {share.shared_on}{share.external_reference ? ` · ${share.external_reference}` : ""}</EvidencePair>
    </div>}
  </section>;
}

function _factValue(value) {
  return value === "unavailable" || value === null || value === undefined ? "Unavailable" : String(value);
}

function _identityLabel(row) {
  if (row.sku_id != null) return `SKU #${row.sku_id}${row.sku_version_id != null ? ` · v${row.sku_version_id}` : ""}`;
  return row.batch_row_lineage_id != null ? `Lineage #${row.batch_row_lineage_id}` : "Unidentified row";
}

function RevisionCompareRow({ row }) {
  return <tr>
    <td>{_identityLabel(row)}
      {row.descriptive_identity === "descriptive_identity_unavailable_only_frozen_id"
        && <small style={{ display: "block", opacity: 0.7 }}>Descriptive name unavailable — internal id only</small>}
      {row.match_basis === "ambiguous_sku_duplicate" && <small style={{ display: "block", color: C.amberD }}>
        Duplicate SKU on one side — not auto-matched</small>}
    </td>
    <td><LifecycleBadge status={row.status} /></td>
    <td>{_factValue(row.previous_rate)}</td>
    <td>{_factValue(row.current_rate)}</td>
    <td>{row.rate_movement === "unavailable" ? "Unavailable" : row.rate_movement}</td>
    <td>{_factValue(row.previous_monthly_volume)}</td>
    <td>{_factValue(row.current_monthly_volume)}</td>
    <td>{_factValue(row.previous_cost_before_margin_per_pc)}</td>
    <td>{_factValue(row.current_cost_before_margin_per_pc)}</td>
    <td>{_factValue(row.previous_margin_pct)}</td>
    <td>{_factValue(row.current_margin_pct)}</td>
  </tr>;
}

// A deterministic, fully-shaped fixture result - rendered through the exact
// same table/disclosure JSX as a real response, so the isolated browser
// fixture proves the render code works (not just that a network call would
// have been made). One matched row (rate + monthly-volume movement, a
// missing frozen cost fact left "Unavailable" rather than zero), one added
// row, one ambiguous-duplicate-SKU row, and a mixed-engine flag.
const U5_COMPARE_FIXTURE = {
  current_revision_id: 9302, prior_revision_id: 9201,
  prior_revision_no: 1, prior_standing: "superseded", prior_workflow_status: "issued",
  same_chain: false, mixed_engine: true, ambiguous_sku_ids: [7742],
  line_total_note: "This schema records no genuine frozen customer order quantity or quote line "
    + "total. Quoted rate leads the comparison; monthly volume is a calculation input, not an order quantity.",
  added_count: 1, removed_count: 0,
  rows: [
    { batch_row_lineage_id: 5501, status: "matched", match_basis: "sku_identity",
      sku_id: 6601, sku_version_id: 2, descriptive_identity: "descriptive_identity_unavailable_only_frozen_id",
      previous_rate: 42.2, current_rate: 43.1, rate_movement: 0.9000000000000057,
      previous_monthly_volume: 12000, current_monthly_volume: 12000,
      previous_cost_before_margin_per_pc: 38.4, current_cost_before_margin_per_pc: "unavailable",
      previous_margin_pct: 8, current_margin_pct: 8.5 },
    { batch_row_lineage_id: null, status: "added", match_basis: "sku_identity",
      sku_id: 6620, sku_version_id: 1, descriptive_identity: "descriptive_identity_unavailable_only_frozen_id",
      previous_rate: "unavailable", current_rate: 51.0, rate_movement: "unavailable",
      previous_monthly_volume: "unavailable", current_monthly_volume: 4000,
      previous_cost_before_margin_per_pc: "unavailable", current_cost_before_margin_per_pc: 44.8,
      previous_margin_pct: "unavailable", current_margin_pct: 12 },
    { batch_row_lineage_id: 5599, status: "removed", match_basis: "ambiguous_sku_duplicate",
      sku_id: 7742, sku_version_id: 1, descriptive_identity: "descriptive_identity_unavailable_only_frozen_id",
      previous_rate: 39.5, current_rate: "unavailable", rate_movement: "unavailable",
      previous_monthly_volume: 8000, current_monthly_volume: "unavailable",
      previous_cost_before_margin_per_pc: 35.0, current_cost_before_margin_per_pc: "unavailable",
      previous_margin_pct: 8, current_margin_pct: "unavailable" },
  ],
};

// S5 Slice B: price first (D-5), then disclosure. Never re-derives values
// from current Batch/SKU/master data - every cell is frozen evidence or the
// literal "Unavailable". `against` is an explicit, server-verified prior
// revision identity (the Slice A cross-Batch "Last Quote" journey); when
// absent, the natural intra-chain source_revision_id is used instead.
function RevisionCompare({ revisionId, sourceRevisionId, against, fixtureOnly }) {
  const [state, setState] = useState({ status: "idle", comparison: null });
  const requestedRef = useRef(null);
  const [disclosureOpen, setDisclosureOpen] = useState(false);
  const target = against ?? sourceRevisionId;

  useEffect(() => {
    if (fixtureOnly || revisionId == null || target == null) return undefined;
    const key = `${revisionId}:${target}:${against ? "against" : "source"}`;
    if (requestedRef.current === key) return undefined;
    requestedRef.current = key;
    let cancelled = false;
    setState({ status: "loading", comparison: null });
    (async () => {
      try {
        const path = against != null
          ? `/quotes/revisions/${encodeURIComponent(revisionId)}/compare?against=${encodeURIComponent(against)}`
          : `/quotes/revisions/${encodeURIComponent(revisionId)}/compare`;
        const response = await apiFetch(path);
        const data = await response.json().catch(() => ({}));
        if (cancelled) return;
        if (!response.ok) {
          const result = classifyResponse({ ok: response.ok, status: response.status, data });
          setState({ status: "error", message: result.message, comparison: null });
          return;
        }
        setState({ status: "ready", comparison: data.comparison || null });
      } catch {
        if (!cancelled) setState({ status: "error",
          message: "The comparison service could not be reached.", comparison: null });
      }
    })();
    return () => { cancelled = true; };
  }, [revisionId, target, against, fixtureOnly]);

  if (!fixtureOnly && (revisionId == null || target == null)) return <div className="quote-evidence-muted">
    No source revision recorded for this Quote — nothing to compare against.</div>;
  if (!fixtureOnly && (state.status === "idle" || state.status === "loading")) return <div className="quote-evidence-muted">
    Loading comparison…</div>;
  if (!fixtureOnly && state.status === "error") return <div className="quote-error-state">
    <strong>Comparison unavailable</strong><span>{state.message}</span></div>;
  const comparison = fixtureOnly ? U5_COMPARE_FIXTURE : state.comparison;
  if (!comparison) return <div className="quote-evidence-muted">No comparison evidence returned.</div>;
  return <div>
    {fixtureOnly && <p className="quote-evidence-muted">
      Fixture-only workspace illustration; no network call is made — deterministic sample evidence only.</p>}
    {comparison.line_total_note && <p className="quote-evidence-muted">{comparison.line_total_note}</p>}
    {!comparison.same_chain && <div className="batch-workspace-panel-state is-partial" role="status">
      Different Batch/Quote chain — rows are matched by frozen SKU identity, one-to-one only.
      {comparison.ambiguous_sku_ids?.length > 0
        ? ` ${comparison.ambiguous_sku_ids.length} SKU(s) had duplicate rows and were left unmatched (shown as added/removed).`
        : ""}
    </div>}
    {comparison.mixed_engine && <div className="batch-workspace-panel-state is-partial" role="status">
      Rows in this comparison were calculated on different engine versions — read the authority
      disclosure before treating a rate movement as a like-for-like change.
    </div>}
    <table className="quote-compare-table"><thead><tr>
      <th>Item</th><th>Status</th><th>Prev rate</th><th>Rate</th><th>Δ rate</th>
      <th>Prev monthly volume</th><th>Monthly volume</th>
      <th>Prev cost before margin/pc</th><th>Cost before margin/pc</th>
      <th>Prev margin %</th><th>Margin %</th>
    </tr></thead><tbody>
      {comparison.rows.map((row, index) => <RevisionCompareRow
        key={row.batch_row_lineage_id ?? `${row.status}-${row.sku_id}-${index}`} row={row} />)}
    </tbody></table>
    {(comparison.added_count > 0 || comparison.removed_count > 0) && <p className="quote-evidence-muted">
      {comparison.added_count} row(s) added, {comparison.removed_count} row(s) removed since the prior revision.</p>}
    <details open={disclosureOpen} onToggle={event => setDisclosureOpen(event.target.open)}>
      <summary>Input differences (dimensions, Construction, waste, conversion, MOQ)</summary>
      {comparison.rows.map(row => <div key={`in-${row.batch_row_lineage_id}`} className="quote-frozen-json">
        <strong>{row.sku_id != null ? `SKU #${row.sku_id}` : `Lineage #${row.batch_row_lineage_id}`}</strong>
        <pre>{JSON.stringify({ previous: row.previous_input_disclosure, current: row.current_input_disclosure }, null, 2)}</pre>
      </div>)}
    </details>
    <details>
      <summary>Authority differences (Pricing Basis, engine, rounding, interest, freight)</summary>
      {comparison.rows.map(row => <div key={`auth-${row.batch_row_lineage_id}`} className="quote-frozen-json">
        <strong>{row.sku_id != null ? `SKU #${row.sku_id}` : `Lineage #${row.batch_row_lineage_id}`}</strong>
        <pre>{JSON.stringify({ previous: row.previous_authority_disclosure, current: row.current_authority_disclosure }, null, 2)}</pre>
      </div>)}
    </details>
  </div>;
}

export function QuoteEvidence({ quote, selectedId, onSelect, onOpenSourceBatch, sourceBatchState,
  fixtureOnly = false, compareAgainst = null }) {
  const revisions = useMemo(() => orderedQuoteRevisions(quote.revisions), [quote.revisions]);
  const revision = revisions.find(row => String(row.id) === String(selectedId)) || revisions[0];
  // compareAgainst is scoped to the exact revision the navigation targeted -
  // switching to a different revision in the rail must not carry it along.
  const against = revision && compareAgainst && String(compareAgainst.revisionId) === String(revision.id)
    ? compareAgainst.priorRevisionId : null;
  const batch = quote.batch;
  const sourceBatchStateApplies = batch?.id != null
    && String(sourceBatchState?.batchId) === String(batch.id);
  return <>
    {(quote.details_partial || quote.denied_sections?.length > 0) && <div className="quote-partial-notice">
      <strong>Caller-visible evidence is partial.</strong>{" "}
      {quote.denied_sections?.length ? `Denied: ${quote.denied_sections.join(", ")}. ` : ""}
      {quote.partial_sections?.length ? `Unavailable: ${quote.partial_sections.join(", ")}.` : ""}
      No hidden identity or current master value has been inferred.
    </div>}
    <section className="quote-identity-card">
      <div><span>Permanent Quote reference</span>{quote.quote_reference
        ? <PermanentCode code={quote.quote_reference} />
        : <strong>Allocated on first approval</strong>}</div>
      <div className="quote-source-batch-identity"><span>Source Batch</span>
        <PermanentCode code={batch?.batch_reference || identity(quote.batch_id)} />
        {batch?.id != null && <><button type="button" onClick={() => onOpenSourceBatch?.(batch)}
          disabled={!onOpenSourceBatch || (sourceBatchStateApplies && sourceBatchState?.status === "loading")}>
          {sourceBatchStateApplies && sourceBatchState?.status === "loading" ? "Opening current Batch…" : "Open current Batch"}
        </button><small>Current mutable Batch state · separate from this frozen Quote evidence</small></>}
      </div>
      <div><span>Customer family</span><strong>{batch?.customer_family
        ? `${batch.customer_family.group_customer_code} · ${batch.customer_family.name}` : "Unavailable"}</strong></div>
      <div><span>Producing plant</span><strong>{batch?.plant
        ? `${batch.plant.plant_code} · ${batch.plant.name}` : "Unavailable"}</strong></div>
      <div><span>Family state</span><LifecycleBadge status={quote.status} /></div>
      <div><span>Pricing Basis</span><strong>{batch?.pricing_basis_release_id
        ? `${identity(batch.pricing_basis_release_id)}${batch.pricing_basis_is_deliberate ? " · deliberate" : " · automatic"}`
        : "Unavailable"}</strong></div>
    </section>
    {sourceBatchStateApplies && ["denied", "error"].includes(sourceBatchState?.status) && <div className="quote-source-batch-state" role="status">
      <strong>Source Batch could not be opened</strong><span>{sourceBatchState.message}</span>
    </div>}
    <div className="quote-workspace-grid">
      <aside className="quote-revision-rail" aria-label="Quote revision history">
        <header><strong>Revision history</strong><span>{revisions.length} frozen {revisions.length === 1 ? "revision" : "revisions"}</span></header>
        {revisions.map(row => <button type="button" key={row.id}
          className={String(row.id) === String(revision?.id) ? "is-selected" : ""}
          onClick={() => onSelect(row.id)}>
          <div><strong>{quoteRevisionLabel(row)}</strong><LifecycleBadge status={row.workflow_status} /></div>
          <span>{row.standing ? <LifecycleBadge status={row.standing} /> : "Standing not allocated"}</span>
          <small>Created {dateTime(row.created_at)}</small>
          {row.source_revision_id && <small>From revision identity {identity(row.source_revision_id)}</small>}
        </button>)}
      </aside>
      {revision ? <main className="quote-revision-detail">
        <header className="quote-revision-heading">
          <div><span>Immutable Quote evidence</span><h2>{quoteRevisionLabel(revision)}</h2></div>
          {/* This revision's own authority, not the lane of any current Batch
              Builder work. Approval makes it shareable; Issue records that it
              was actually sent (CDM-24). */}
          <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
            <LifecycleBadge status={revision.workflow_status} />
            {revision.standing && <LifecycleBadge status={revision.standing} />}
            <ShareabilityNote {...revisionShareability(revision)} />
          </div>
        </header>
        <section className="quote-revision-facts">
          <EvidencePair label="Revision identity" mono>{identity(revision.id)}</EvidencePair>
          <EvidencePair label="Source revision" mono>{identity(revision.source_revision_id)}</EvidencePair>
          <EvidencePair label="Quote date">{revision.quote_date || "Not recorded"}</EvidencePair>
          <EvidencePair label="Offer valid to">{revision.offer_validity_to || "Not recorded"}</EvidencePair>
          <EvidencePair label="Created by">{quoteActor(revision.created_by_actor, revision.created_by)}</EvidencePair>
          <EvidencePair label="Created at">{dateTime(revision.created_at)}</EvidencePair>
          <EvidencePair label="Approved by">{quoteActor(revision.approved_by_actor, revision.approved_by)}</EvidencePair>
          <EvidencePair label="Approved at">{dateTime(revision.approved_at)}</EvidencePair>
          <EvidencePair label="Issued by">{quoteActor(revision.issued_by_actor, revision.issued_by)}</EvidencePair>
          <EvidencePair label="Issued at">{dateTime(revision.issued_at)}</EvidencePair>
        </section>
        <CustomerDocumentPreview quote={quote} revision={revision} />
        {revision.addressee_details?.identity_authority === "batches.customer_party_id"
          ? <section className="quote-evidence-section"><h3>Frozen recipient identity</h3>
            <div className="quote-revision-facts">
              <EvidencePair label="Addressee">{revision.addressee_name || "Not recorded"}</EvidencePair>
            </div>
            {revision.addressee_details && Object.keys(revision.addressee_details).length > 0
              && <details className="quote-frozen-json"><summary>Frozen addressee details</summary>
                <pre>{JSON.stringify(revision.addressee_details, null, 2)}</pre>
              </details>}
          </section>
          : <section className="quote-evidence-section"><h3>Recipient identity unavailable</h3>
            <p>This legacy revision has no exact Batch-selected Customer identity. Any earlier addressee text is non-authoritative.</p>
          </section>}
        <section className="quote-evidence-section">
          <h3>{against != null && String(against) !== String(revision.source_revision_id)
            ? "Compare with prior Quote" : "Compare with source revision"}</h3>
          <RevisionCompare revisionId={revision.id} sourceRevisionId={revision.source_revision_id}
            against={against} fixtureOnly={fixtureOnly} />
        </section>
        {revision.return_note && <div className="quote-return-note"><strong>Recorded return note</strong>{revision.return_note}</div>}
        {revision.withdraw_reason && <div className="quote-return-note"><strong>Recorded withdrawal reason</strong>{revision.withdraw_reason}</div>}
        {revision.void_reason && <div className="quote-return-note"><strong>Recorded void reason</strong>{revision.void_reason}
          <span>Voided by {quoteActor(revision.voided_by_actor, revision.voided_by)} · {dateTime(revision.voided_at)}</span>
        </div>}
        <section className="quote-evidence-section"><h3>Workflow chronology</h3><WorkflowTimeline events={revision.workflow_events} /></section>
        <section className="quote-evidence-section"><h3>Frozen Quote Items</h3>
          {revision.items?.length ? revision.items.map((item, index) => <SnapshotCard key={item.id} item={item} index={index} />)
            : <EmptyState title="No caller-visible Quote Items" hint="This revision has no visible immutable item evidence." />}
        </section>
        <section className="quote-evidence-section"><h3>Customer response</h3>
          {revision.customer_outcomes?.length
            ? (() => {
              const latest = [...revision.customer_outcomes]
                .sort((a, b) => (a.occurred_at || "").localeCompare(b.occurred_at || "") || (a.id - b.id))
                .at(-1);
              return <div className="quote-revision-facts" style={{ marginBottom: 8 }}>
                <EvidencePair label="Latest response"><LifecycleBadge status={latest.outcome} /></EvidencePair>
                <EvidencePair label="Recorded">{dateTime(latest.occurred_at)}</EvidencePair>
                <EvidencePair label="Recorded by">{quoteActor(latest.recorded_by_actor, latest.recorded_by)}</EvidencePair>
              </div>;
            })()
            : <div className="quote-evidence-muted">No caller-visible customer outcome has been recorded yet.</div>}
          <details><summary>Full append-only response history</summary>
            <CustomerOutcomeTimeline events={revision.customer_outcomes} />
          </details>
        </section>
      </main> : <EmptyState title="No revisions visible" hint="The Quote family is visible, but it has no caller-visible revision evidence." />}
    </div>
  </>;
}

export default function QuotesScreen({
  fixtureOnly = false, onExitFixture, onOpenSourceBatch, sourceBatchState,
  showFixtureBanner = true, toolbarLead = null, onContextChange = null,
}) {
  const [reference, setReference] = useState(fixtureOnly ? U5_QUOTE_ILLUSTRATION.quote_reference : "");
  const [state, setState] = useState(fixtureOnly
    ? { status: "ready", quote: U5_QUOTE_ILLUSTRATION }
    : { status: "idle", quote: null });
  const [selectedId, setSelectedId] = useState(null);
  const [workflow, setWorkflow] = useState({ status: "idle", message: "" });
  const [shareOpen, setShareOpen] = useState(false);
  const [share, setShare] = useState({ channel: "Email", shared_on: new Date().toISOString().slice(0, 10), external_reference: "" });
  const [outcomeOpen, setOutcomeOpen] = useState(false);
  const [outcome, setOutcome] = useState({ outcome: "accepted", acceptance_date: "", acceptance_reference: "", note: "" });

  const openQuote = async event => {
    event?.preventDefault();
    if (fixtureOnly || !reference.trim()) return;
    setState({ status: "loading", quote: null });
    try {
      const response = await apiFetch(`/quotes/workspace?reference=${encodeURIComponent(reference.trim())}`);
      const data = await response.json().catch(() => ({}));
      const result = classifyResponse({ ok: response.ok, status: response.status, data });
      if (result.kind === "access-denied") return setState({ status: "denied", message: result.message, quote: null });
      if (!response.ok) return setState({ status: response.status === 404 ? "empty" : "error", message: result.message, quote: null });
      setState({ status: "ready", quote: data.quote });
      setSelectedId(null);
    } catch {
      setState({ status: "error", message: "The Quote service could not be reached. No fixture was substituted.", quote: null });
    }
  };

  const selectedRevision = orderedQuoteRevisions(state.quote?.revisions || [])
    .find(row => String(row.id) === String(selectedId))
    || orderedQuoteRevisions(state.quote?.revisions || [])[0];
  useEffect(() => {
    if (!onContextChange) return undefined;
    if (state.status === "ready" && state.quote && selectedRevision) {
      onContextChange({ kind: "governed", view: "Governed Quote",
        quoteReference: state.quote.quote_reference || null,
        batchReference: state.quote.batch?.batch_reference || null,
        revisionId: selectedRevision.id,
        revisionNumber: selectedRevision.revision_number ?? null,
        workflowStatus: selectedRevision.workflow_status || null,
        customer: state.quote.batch?.customer_family?.name || null });
    } else {
      onContextChange(null);
    }
    return () => onContextChange(null);
  }, [onContextChange, selectedRevision, state.quote, state.status]);
  const runWorkflow = async action => {
    if (fixtureOnly || !selectedRevision) return;
    if (action === "share") return setShareOpen(true);
    if (action === "record_outcome") {
      setOutcome({ outcome: "accepted", acceptance_date: "", acceptance_reference: "", note: "" });
      return setOutcomeOpen(true);
    }
    const body = {};
    if (action === "submit") {
      const expected = state.quote?.batch?.content_version;
      if (!Number.isInteger(expected) || expected < 1) return setWorkflow({ status: "error",
        message: "Reload the source Batch before Submit; its content version is unavailable." });
      body.expected_content_version = expected;
    } else if (action === "return") {
      const note = window.prompt("Return note (required)"); if (note == null) return; body.note = note;
    } else if (action === "withdraw") {
      const reason = window.prompt("Withdrawal reason (required)"); if (reason == null) return; body.reason = reason;
    } else if (action === "approve" && !window.confirm("Approve this immutable revision?")) return;
    else if (action === "create_revision" && !window.confirm(
      "The issued document remains immutable and stays exactly as sent. "
      + "The source Batch will reopen for the next revision — you will edit and recalculate "
      + "governed rows and Send again before anything new is issued. Continue?")) return;
    const route = action === "create_revision" ? "create-revision" : action;
    setWorkflow({ status: "busy", message: `${action.replaceAll("_", " ")} in progress…` });
    try {
      const response = await apiFetch(`/quotes/revisions/${encodeURIComponent(selectedRevision.id)}/${route}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => ({}));
      const result = classifyResponse({ ok: response.ok, status: response.status, data });
      if (!response.ok) return setWorkflow({ status: "error", message: result.message });
      setWorkflow({ status: "success", message: `${action.replaceAll("_", " ")} completed.` });
      if (action === "create_revision") onOpenSourceBatch?.(state.quote.batch);
      else await openQuote();
    } catch {
      setWorkflow({ status: "error", message: "The workflow service could not be reached. Refresh before retrying." });
    }
  };
  const submitShare = async event => {
    event.preventDefault();
    if (fixtureOnly || !selectedRevision) return;
    setWorkflow({ status: "busy", message: "Recording customer sharing…" });
    try {
      const response = await apiFetch(`/quotes/revisions/${encodeURIComponent(selectedRevision.id)}/share`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(share),
      });
      const data = await response.json().catch(() => ({}));
      const result = classifyResponse({ ok: response.ok, status: response.status, data });
      if (!response.ok) return setWorkflow({ status: "error", message: result.message });
      setShareOpen(false);
      setWorkflow({ status: "success", message: "Sharing was recorded. Downloading the frozen workbook…" });
      await exportQuote();
    } catch {
      setWorkflow({ status: "error", message: "Sharing may not have been recorded. Refresh before retrying." });
    }
  };
  const submitOutcome = async event => {
    event.preventDefault();
    if (fixtureOnly || !selectedRevision) return;
    setWorkflow({ status: "busy", message: "Recording the customer response…" });
    try {
      const response = await apiFetch(`/quotes/revisions/${encodeURIComponent(selectedRevision.id)}/outcome`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
          outcome: outcome.outcome,
          acceptance_date: outcome.outcome === "accepted" && outcome.acceptance_date ? outcome.acceptance_date : null,
          acceptance_reference: outcome.outcome === "accepted" && outcome.acceptance_reference.trim()
            ? outcome.acceptance_reference.trim() : null,
          note: outcome.note.trim() || null,
        }),
      });
      const data = await response.json().catch(() => ({}));
      const result = classifyResponse({ ok: response.ok, status: response.status, data });
      if (!response.ok) return setWorkflow({ status: "error", message: result.message });
      setOutcomeOpen(false);
      setWorkflow({ status: "success", message: "Customer response recorded." });
      await openQuote();
    } catch {
      setWorkflow({ status: "error", message: "The response may not have been recorded. Refresh before retrying." });
    }
  };

  // The governed Quote document (Product Owner, 2026-09-22): the SAME master
  // workbook as the working export, and the only one that carries the permanent
  // reference. The backend refuses anything before approval, so this button is
  // offered only where a document may legitimately exist.
  const exportable = ["approved", "issued"].includes(selectedRevision?.workflow_status);
  const exportQuote = async () => {
    if (fixtureOnly || !selectedRevision) return;
    setWorkflow({ status: "busy", message: "Building the governed Quote workbook…" });
    try {
      const response = await apiFetch(
        `/quotes/revisions/${encodeURIComponent(selectedRevision.id)}/export?beta=${isFeatureEnabled("limited_beta")}`);
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        const result = classifyResponse({ ok: false, status: response.status, data });
        return setWorkflow({ status: "error", message: result.message });
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Quote_${(state.quote?.quote_reference || selectedRevision.id).replaceAll("/", "-")}.xlsx`;
      document.body.appendChild(link);
      link.click();
      setTimeout(() => { document.body.removeChild(link); URL.revokeObjectURL(url); }, 200);
      setWorkflow({ status: "success", message: "Governed Quote workbook downloaded." });
    } catch {
      setWorkflow({ status: "error", message: "The export service could not be reached. No workbook was produced." });
    }
  };

  // The TopBar already says "Quotes", so there is no page header here: one
  // toolbar at the shared height carries the reference lookup and the
  // backend-reported governed actions, and the evidence takes the rest of the height.
  return <div style={{ height: "100%", display: "flex", flexDirection: "column", minHeight: 0,
    fontFamily: sans, background: C.cream }}>
    {fixtureOnly && showFixtureBanner && <div className="quote-fixture-banner"><strong>U5 · FIXTURE ONLY</strong>
      Isolated browser illustration. No authoritative read, workflow transition, or database write occurs.
      {onExitFixture && <button type="button" onClick={onExitFixture}>Return to sign in</button>}
    </div>}
    <div role="toolbar" aria-label="Governed Quote evidence controls" style={toolbar}>
      {toolbarLead}
      <form onSubmit={openQuote} style={{ display: "contents" }}>
        <input id="quote-reference" aria-label="Permanent Quote reference" value={reference}
          onChange={event => setReference(event.target.value)} disabled={fixtureOnly}
          placeholder="NAG/QUO/2026-27/00001 ↵"
          title="Open a governed Quote by its permanent reference. Current Batch and master values never replace snapshot evidence."
          style={{ ...control, width: 232, minWidth: 150, flex: "0 1 232px", fontFamily: mono }} />
        <button type="submit" disabled={fixtureOnly || !reference.trim()}
          style={{ ...control, fontSize: T.label, fontWeight: 700, cursor: "pointer",
            borderColor: C.amber, color: C.amberD }}>Open Quote</button>
      </form>
      <GovernedActions actions={selectedRevision?.actions || state.quote?.actions} onAction={runWorkflow}
        busy={workflow.status === "busy"} label="Backend-reported Quote workflow actions" />
      <button type="button" onClick={exportQuote} disabled={fixtureOnly || !exportable || workflow.status === "busy"}
        title={exportable ? "Download the governed Quote workbook, carrying its permanent reference"
          : "A Quote can be exported once it is approved; before that it has no permanent reference"}
        style={{ ...control, fontSize: T.label, fontWeight: 700, whiteSpace: "nowrap",
          cursor: exportable ? "pointer" : "not-allowed",
          borderColor: exportable ? C.green : C.border, color: exportable ? C.green : C.slateL }}>
        ↓ Quote workbook</button>
      <span style={{ flex: "1 1 auto" }} />
    </div>
    {shareOpen && selectedRevision && <form onSubmit={submitShare} style={{ display: "flex", gap: 8, alignItems: "end",
      padding: "8px 12px", borderBottom: `1px solid ${C.border}`, background: C.white, fontSize: T.label }}>
      <strong style={{ color: C.amberD }}>Share exact revision with {selectedRevision.addressee_name || "the frozen recipient"}</strong>
      <label>Channel<select value={share.channel} onChange={event => setShare(value => ({ ...value, channel: event.target.value }))} style={control}>
        {["Email", "WhatsApp", "Printed/hand-delivered", "Customer portal", "Other"].map(value => <option key={value}>{value}</option>)}</select></label>
      <label>Date<input required type="date" value={share.shared_on} onChange={event => setShare(value => ({ ...value, shared_on: event.target.value }))} style={control} /></label>
      <label>External reference <input maxLength="200" value={share.external_reference} onChange={event => setShare(value => ({ ...value, external_reference: event.target.value }))} style={control} /></label>
      <button type="submit" disabled={workflow.status === "busy"} style={{ ...control, borderColor: C.green, color: C.green, fontWeight: 700 }}>Record and download</button>
      <button type="button" onClick={() => setShareOpen(false)} style={control}>Cancel</button>
    </form>}
    {outcomeOpen && selectedRevision && <form onSubmit={submitOutcome} style={{ display: "flex", gap: 8, alignItems: "end",
      flexWrap: "wrap", padding: "8px 12px", borderBottom: `1px solid ${C.border}`, background: C.white, fontSize: T.label }}>
      <strong style={{ color: C.amberD }}>Record customer response for this issued revision</strong>
      <label>Outcome
        <select value={outcome.outcome} onChange={event => setOutcome(value => ({ ...value, outcome: event.target.value }))} style={control}>
          {["awaiting_response", "accepted", "rejected", "expired"].map(value => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}
        </select>
      </label>
      {outcome.outcome === "accepted" && <>
        <label>Acceptance date <input type="date" value={outcome.acceptance_date}
          onChange={event => setOutcome(value => ({ ...value, acceptance_date: event.target.value }))} style={control} /></label>
        <label>Customer PO/reference <input maxLength="200" value={outcome.acceptance_reference}
          onChange={event => setOutcome(value => ({ ...value, acceptance_reference: event.target.value }))} style={control} /></label>
      </>}
      <label>Note <input maxLength="2000" value={outcome.note}
        onChange={event => setOutcome(value => ({ ...value, note: event.target.value }))} style={{ ...control, minWidth: 200 }} /></label>
      <button type="submit" disabled={workflow.status === "busy"} style={{ ...control, borderColor: C.green, color: C.green, fontWeight: 700 }}>Record response</button>
      <button type="button" onClick={() => setOutcomeOpen(false)} style={control}>Cancel</button>
    </form>}
    <div style={{ flex: 1, minHeight: 0, overflow: "auto", padding: "10px 12px 16px" }}>
      {workflow.status !== "idle" && <div className="quote-error-state" role="status">
        <strong>Workflow</strong><span>{workflow.message}</span>
      </div>}
      {state.status === "idle" && <EmptyState title="Open a governed Quote" hint="Enter its permanent reference. No fixture is used in the authenticated workspace." />}
      {state.status === "loading" && <LoadingState label="Loading immutable Quote evidence…" />}
      {state.status === "denied" && <AccessDeniedState reason={state.message || "This Quote is not visible to your caller and plant authority."} />}
      {state.status === "empty" && <EmptyState title="Quote not found" hint="No caller-visible Quote matches that permanent reference." />}
      {state.status === "error" && <div className="quote-error-state"><strong>Quote could not be loaded</strong><span>{state.message}</span></div>}
      {state.status === "ready" && state.quote && <QuoteEvidence quote={state.quote} selectedId={selectedId} onSelect={setSelectedId}
        onOpenSourceBatch={onOpenSourceBatch} sourceBatchState={sourceBatchState} fixtureOnly={fixtureOnly} />}
    </div>
    <ScreenFooter right="Read-only · a permanent reference is allocated on first approval">
      <ProvenanceTag kind="immutable" />
      <span title="Frozen at Send. Current Batch and master values never replace snapshot evidence.">
        Quote evidence · never edited in place</span>
    </ScreenFooter>
  </div>;
}
