import { useMemo, useState } from "react";
import { apiFetch } from "../lib/apiClient.js";
import { isFeatureEnabled } from "../lib/featureFlags.js";
import { classifyResponse } from "../lib/backendError.js";
import {
  orderedQuoteRevisions, quoteActor, quoteRevisionLabel, U5_QUOTE_ILLUSTRATION,
} from "../lib/quoteEvidenceModel.js";
import { AccessDeniedState, EmptyState, LoadingState } from "../ui/appStates.jsx";
import { LifecycleBadge, PermanentCode, ProvenanceTag } from "../ui/dataDisplay.jsx";
import { GovernedActions, ScreenFooter } from "../ui/screenChrome.jsx";
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

export function QuoteEvidence({ quote, selectedId, onSelect, onOpenSourceBatch, sourceBatchState }) {
  const revisions = useMemo(() => orderedQuoteRevisions(quote.revisions), [quote.revisions]);
  const revision = revisions.find(row => String(row.id) === String(selectedId)) || revisions[0];
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
          <div><LifecycleBadge status={revision.workflow_status} />{revision.standing && <LifecycleBadge status={revision.standing} />}</div>
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
        {(revision.addressee_name || (revision.addressee_details && Object.keys(revision.addressee_details).length > 0))
          && <section className="quote-evidence-section"><h3>Frozen issue presentation</h3>
            <div className="quote-revision-facts">
              <EvidencePair label="Addressee">{revision.addressee_name || "Not recorded"}</EvidencePair>
            </div>
            {revision.addressee_details && Object.keys(revision.addressee_details).length > 0
              && <details className="quote-frozen-json"><summary>Frozen addressee details</summary>
                <pre>{JSON.stringify(revision.addressee_details, null, 2)}</pre>
              </details>}
          </section>}
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
        <section className="quote-evidence-section"><h3>Customer outcome stream</h3>
          <CustomerOutcomeTimeline events={revision.customer_outcomes} />
        </section>
      </main> : <EmptyState title="No revisions visible" hint="The Quote family is visible, but it has no caller-visible revision evidence." />}
    </div>
  </>;
}

export default function QuotesScreen({
  fixtureOnly = false, onExitFixture, onOpenSourceBatch, sourceBatchState,
  showFixtureBanner = true, toolbarLead = null,
}) {
  const [reference, setReference] = useState(fixtureOnly ? U5_QUOTE_ILLUSTRATION.quote_reference : "");
  const [state, setState] = useState(fixtureOnly
    ? { status: "ready", quote: U5_QUOTE_ILLUSTRATION }
    : { status: "idle", quote: null });
  const [selectedId, setSelectedId] = useState(null);
  const [workflow, setWorkflow] = useState({ status: "idle", message: "" });

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
  const runWorkflow = async action => {
    if (fixtureOnly || !selectedRevision) return;
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
    } else if (action === "issue") {
      const addressee = window.prompt("Issue addressee name", selectedRevision.addressee_name || "");
      if (addressee == null) return;
      const quoteDate = window.prompt("Quote date (YYYY-MM-DD)", new Date().toISOString().slice(0, 10));
      if (quoteDate == null) return;
      const validity = window.prompt("Offer valid to (YYYY-MM-DD, blank if not set)", selectedRevision.offer_validity_to || "");
      if (validity == null) return;
      Object.assign(body, { addressee_name: addressee, addressee_details: null,
        quote_date: quoteDate || null, offer_validity_to: validity || null });
    } else if (["approve", "create_revision"].includes(action)
      && !window.confirm(`${action === "approve" ? "Approve" : "Create the next revision from"} this immutable revision?`)) return;
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
        onOpenSourceBatch={onOpenSourceBatch} sourceBatchState={sourceBatchState} />}
    </div>
    <ScreenFooter right="Read-only · a permanent reference is allocated on first approval">
      <ProvenanceTag kind="immutable" />
      <span title="Frozen at Send. Current Batch and master values never replace snapshot evidence.">
        Quote evidence · never edited in place</span>
    </ScreenFooter>
  </div>;
}
