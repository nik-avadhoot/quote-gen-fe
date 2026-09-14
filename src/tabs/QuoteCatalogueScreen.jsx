import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "../lib/apiClient.js";
import { classifyResponse } from "../lib/backendError.js";
import {
  orderedQuoteRevisions, quoteActor, quoteRevisionLabel, U5_QUOTE_CATALOGUE_ILLUSTRATIONS,
  U5_QUOTE_ILLUSTRATION, U5_SUBMITTED_QUOTE_ILLUSTRATION,
} from "../lib/quoteEvidenceModel.js";
import { AccessDeniedState, EmptyState, LoadingState } from "../ui/appStates.jsx";
import { LifecycleBadge, PermanentCode } from "../ui/dataDisplay.jsx";
import { QuoteEvidence } from "./QuotesScreen.jsx";

const STATUS_OPTIONS = ["all", "draft", "submitted", "returned", "approved", "issued", "withdrawn"];
const MUTATIONS = ["Approve", "Return", "Withdraw", "Issue", "Create revision"];

function dateTime(value) {
  if (!value) return "Not recorded";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}

function searchable(row) {
  return [
    row.quote_reference, row.batch_reference, row.workflow_status, row.standing,
    row.plant?.plant_code, row.plant?.name, row.customer_family?.group_customer_code,
    row.customer_family?.name, row.created_by_actor?.display_name,
  ].filter(Boolean).join(" ").toLocaleLowerCase();
}

function fixtureQuoteFor(mode, revisionId) {
  if (mode === "inbox") return U5_SUBMITTED_QUOTE_ILLUSTRATION;
  return {
    ...U5_QUOTE_ILLUSTRATION,
    revisions: U5_QUOTE_ILLUSTRATION.revisions.filter(row => String(row.id) === String(revisionId)),
  };
}

export default function QuoteCatalogueScreen({
  embedded = false, mode = "history", fixtureOnly = false, initialRevisionId = null, initialBatchId = null,
  requestId = null, onExitFixture, onOpenSourceBatch, sourceBatchState, showFixtureBanner = true,
}) {
  const isInbox = mode === "inbox";
  const fixture = U5_QUOTE_CATALOGUE_ILLUSTRATIONS[mode];
  const [state, setState] = useState(fixtureOnly
    ? { status: "ready", catalogue: fixture }
    : { status: "loading", catalogue: null });
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState({ status: "idle", quote: null });
  const [openedBy, setOpenedBy] = useState(null);
  const openedRequestRef = useRef(null);

  useEffect(() => {
    if (fixtureOnly) return undefined;
    let live = true;
    apiFetch(`/quotes/catalogue?view=${mode}`)
      .then(async response => {
        const data = await response.json().catch(() => ({}));
        const result = classifyResponse({ ok: response.ok, status: response.status, data });
        if (!live) return;
        if (result.kind === "access-denied") {
          setState({ status: "denied", message: result.message, catalogue: null });
        } else if (!response.ok) {
          setState({ status: "error", message: result.message, catalogue: null });
        } else {
          setState({ status: "ready", catalogue: data.catalogue });
        }
      })
      .catch(() => live && setState({
        status: "error",
        message: "The Quote catalogue could not be reached. No fixture was substituted.",
        catalogue: null,
      }));
    return () => { live = false; };
  }, [fixtureOnly, mode]);

  const rows = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return (state.catalogue?.rows || []).filter(row => {
      if (!isInbox && status !== "all" && row.workflow_status !== status) return false;
      return !needle || searchable(row).includes(needle);
    });
  }, [isInbox, query, state.catalogue, status]);

  const openRevision = useCallback(async revisionId => {
    setSelectedId(revisionId);
    setOpenedBy({ kind: "revision", id: revisionId });
    if (fixtureOnly) {
      setDetail({ status: "ready", quote: fixtureQuoteFor(mode, revisionId) });
      return;
    }
    setDetail({ status: "loading", quote: null });
    try {
      const response = await apiFetch(`/quotes/workspace?revision_id=${encodeURIComponent(revisionId)}`);
      const data = await response.json().catch(() => ({}));
      const result = classifyResponse({ ok: response.ok, status: response.status, data });
      if (result.kind === "access-denied") {
        setDetail({ status: "denied", message: result.message, quote: null });
      } else if (!response.ok) {
        setDetail({ status: "error", message: result.message, quote: null });
      } else {
        setDetail({ status: "ready", quote: data.quote });
      }
    } catch {
      setDetail({ status: "error", message: "Immutable evidence could not be reached. No fixture was substituted.", quote: null });
    }
  }, [fixtureOnly, mode]);

  const openBatchQuote = useCallback(async batchId => {
    if (fixtureOnly) return;
    setSelectedId(null);
    setOpenedBy({ kind: "batch", id: batchId });
    setDetail({ status: "loading", quote: null });
    try {
      const response = await apiFetch(`/quotes/workspace?batch_id=${encodeURIComponent(batchId)}`);
      const data = await response.json().catch(() => ({}));
      const result = classifyResponse({ ok: response.ok, status: response.status, data });
      if (result.kind === "access-denied") {
        setDetail({ status: "denied", message: result.message, quote: null });
      } else if (response.status === 404) {
        setDetail({ status: "empty", message: result.message, quote: null });
      } else if (!response.ok) {
        setDetail({ status: "error", message: result.message, quote: null });
      } else {
        const preferred = orderedQuoteRevisions(data.quote?.revisions)[0]?.id ?? null;
        setSelectedId(preferred);
        setDetail({ status: "ready", quote: data.quote });
      }
    } catch {
      setDetail({ status: "error", message: "Linked Quote evidence could not be reached. No fixture was substituted.", quote: null });
    }
  }, [fixtureOnly]);

  useEffect(() => {
    if (initialRevisionId == null && initialBatchId == null) return;
    const key = requestId ?? `${mode}:${initialRevisionId ?? `batch-${initialBatchId}`}`;
    if (openedRequestRef.current === key) return;
    let active = true;
    queueMicrotask(() => {
      if (!active || openedRequestRef.current === key) return;
      openedRequestRef.current = key;
      if (initialRevisionId != null) openRevision(initialRevisionId);
      else openBatchQuote(initialBatchId);
    });
    return () => { active = false; };
  }, [initialBatchId, initialRevisionId, mode, openBatchQuote, openRevision, requestId]);

  return <div className={`quote-catalogue-screen${embedded ? " is-embedded" : ""}`}>
    {fixtureOnly && showFixtureBanner && <div className="quote-fixture-banner"><strong>U5 · FIXTURE ONLY</strong>
      Isolated {isInbox ? "Approval Inbox" : "Quote History"} illustration. No authoritative read or workflow transition occurs.
      {onExitFixture && <button type="button" onClick={onExitFixture}>Return to sign in</button>}
    </div>}
    <header className="quote-catalogue-header">
      <div><span>U5 · governed read-only operations</span>
        <h1>{isInbox ? "Approval Inbox" : "Quote History"}</h1>
        <p>{isInbox
          ? "Caller-visible submitted revisions awaiting Checker review. A permanent Quote reference appears only after first approval."
          : "Caller-visible Quote revisions, with exact standing and immutable evidence. Current Batch values are never substituted."}</p>
      </div>
      <div className="quote-catalogue-filters">
        <label htmlFor={`${mode}-search`}>Find in displayed records</label>
        <input id={`${mode}-search`} type="search" value={query}
          onChange={event => setQuery(event.target.value)} placeholder="Quote, Batch, plant or customer" />
        {!isInbox && <select aria-label="Workflow status" value={status} onChange={event => setStatus(event.target.value)}>
          {STATUS_OPTIONS.map(value => <option key={value} value={value}>{value === "all" ? "All workflow states" : value}</option>)}
        </select>}
      </div>
    </header>
    <div className="quote-disabled-actions" aria-label="Unavailable Quote workflow actions">
      <strong>Backend activation pending</strong>{MUTATIONS.map(label => <button type="button" disabled key={label}>{label}</button>)}
    </div>

    {state.status === "loading" && <LoadingState label={`Loading ${isInbox ? "Approval Inbox" : "Quote History"}…`} />}
    {state.status === "denied" && <AccessDeniedState reason={state.message || "This view is not available to your caller authority."} />}
    {state.status === "error" && <div className="quote-error-state"><strong>Catalogue could not be loaded</strong><span>{state.message}</span></div>}
    {state.status === "ready" && state.catalogue && <>
      {state.catalogue.results_limited && <div className="quote-catalogue-limit">
        Results are limited to the first {state.catalogue.display_limit} caller-visible records. This is not the complete catalogue.
      </div>}
      {(state.catalogue.details_partial || state.catalogue.denied_sections?.length > 0) && <div className="quote-partial-notice">
        <strong>Catalogue detail is partial.</strong>{" "}
        {state.catalogue.denied_sections?.length ? `Denied: ${state.catalogue.denied_sections.join(", ")}. ` : ""}
        {state.catalogue.partial_sections?.length ? `Unavailable: ${state.catalogue.partial_sections.join(", ")}.` : ""}
        No hidden identity has been inferred.
      </div>}
      {!rows.length ? <EmptyState title={query || status !== "all" ? "No displayed records match" : `No ${isInbox ? "submitted revisions" : "Quote history"} visible`}
        hint={isInbox ? "Empty and access-denied remain separate states." : "No fixture is used in the authenticated catalogue."} />
        : <div className="quote-catalogue-table-wrap"><table className="quote-catalogue-table">
          <thead><tr><th>{isInbox ? "Approval candidate" : "Quote / revision"}</th><th>Batch</th><th>Customer</th>
            <th>Plant</th><th>State</th><th>Maker / created</th><th>Items</th><th aria-label="Open evidence" /></tr></thead>
          <tbody>{rows.map(row => <tr key={row.id} className={String(selectedId) === String(row.id) ? "is-selected" : ""}>
            <td>{row.quote_reference ? <><PermanentCode code={row.quote_reference} /><small>{quoteRevisionLabel(row)}</small></>
              : <><strong>Allocated on first approval</strong><small>{quoteRevisionLabel(row)} · identity #{row.id}</small></>}</td>
            <td><PermanentCode code={row.batch_reference} /><small>{row.batch_status || "Status unavailable"}</small></td>
            <td><strong>{row.customer_family ? `${row.customer_family.group_customer_code} · ${row.customer_family.name}` : "Unavailable"}</strong></td>
            <td><strong>{row.plant ? `${row.plant.plant_code} · ${row.plant.name}` : "Unavailable"}</strong></td>
            <td><LifecycleBadge status={row.workflow_status} />{row.standing && <LifecycleBadge status={row.standing} />}</td>
            <td><strong>{quoteActor(row.created_by_actor, row.created_by)}</strong><small>{dateTime(row.created_at)}</small></td>
            <td>{row.item_count}</td>
            <td><button type="button" onClick={() => openRevision(row.id)}>Open evidence</button></td>
          </tr>)}</tbody>
        </table></div>}
    </>}

    {detail.status === "loading" && <LoadingState label="Loading immutable revision evidence…" />}
    {detail.status === "denied" && <AccessDeniedState reason={detail.message} />}
    {detail.status === "empty" && <EmptyState title="No linked Quote evidence is visible"
      hint="This Batch has no caller-visible Quote family yet. No identity or current Batch value was inferred." />}
    {detail.status === "error" && <div className="quote-error-state"><strong>Evidence could not be loaded</strong><span>{detail.message}</span></div>}
    {detail.status === "ready" && detail.quote && <section className="quote-catalogue-detail">
      {openedBy?.kind === "batch" && <div className="quote-catalogue-limit">
        Opened from exact Batch identity #{openedBy.id}. The newest caller-visible linked revision is selected.
      </div>}
      {openedBy?.kind === "revision" && selectedId != null && !rows.some(row => String(row.id) === String(selectedId)) && <div className="quote-catalogue-limit">
        Opened by exact revision identity. This revision is outside the currently displayed or filtered catalogue rows.
      </div>}
      <header><strong>Selected immutable evidence</strong><button type="button" onClick={() => {
        setSelectedId(null); setOpenedBy(null); setDetail({ status: "idle", quote: null });
      }}>Close</button></header>
      <QuoteEvidence quote={detail.quote} selectedId={selectedId} onSelect={setSelectedId}
        onOpenSourceBatch={onOpenSourceBatch} sourceBatchState={sourceBatchState} />
    </section>}
  </div>;
}
