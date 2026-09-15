import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../lib/apiClient.js";
import { U4_BATCH_CATALOGUE_ILLUSTRATION, searchableBatchText } from "../lib/batchCatalogueModel.js";
import { classifyResponse } from "../lib/backendError.js";
import { useAppState } from "../state/AppStateContext.js";
import { AccessDeniedState, EmptyState, LoadingState } from "../ui/appStates.jsx";
import { LifecycleBadge, PermanentCode, ProvenanceTag } from "../ui/dataDisplay.jsx";

const ACTION_LABELS = {
  calculate: "Calculate", send: "Send", submit: "Submit",
  approve: "Approve", return: "Return", issue: "Issue",
};

function dateTime(value) {
  if (!value) return "Not recorded";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}

function exactIdentity(item, codeKey, nameKey, fallback) {
  if (!item) return fallback;
  return `${item[codeKey] || "No permanent code"} · ${item[nameKey] || "Unnamed"}`;
}

export default function MyBatchesScreen({ fixtureOnly = false, onExitFixture }) {
  const {
    durableBatch, setDurableBatch, setQuoteView, setQuoteWorkspaceRequest, setTab,
  } = useAppState();
  const fixture = U4_BATCH_CATALOGUE_ILLUSTRATION;
  const [state, setState] = useState(fixtureOnly
    ? { status: "ready", catalogue: fixture }
    : { status: "loading", catalogue: null });
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [plant, setPlant] = useState("all");
  const [opening, setOpening] = useState({ status: "idle", id: null, message: "" });

  useEffect(() => {
    if (fixtureOnly) return undefined;
    let live = true;
    apiFetch("/batches/catalogue")
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
        message: "The Batch catalogue could not be reached. No fixture was substituted.",
        catalogue: null,
      }));
    return () => { live = false; };
  }, [fixtureOnly]);

  const allRows = useMemo(() => state.catalogue?.rows || [], [state.catalogue]);
  const statusOptions = useMemo(() => [...new Set(allRows.map(row => row.status).filter(Boolean))].sort(), [allRows]);
  const plantOptions = useMemo(() => [...new Map(allRows.filter(row => row.plant).map(row =>
    [String(row.plant.id), row.plant])).values()].sort((a, b) =>
    String(a.plant_code || "").localeCompare(String(b.plant_code || ""))), [allRows]);
  const rows = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return allRows.filter(row => {
      if (status !== "all" && row.status !== status) return false;
      if (plant !== "all" && String(row.plant_id) !== plant) return false;
      return !needle || searchableBatchText(row).includes(needle);
    });
  }, [allRows, plant, query, status]);

  const openBatch = async row => {
    if (fixtureOnly) {
      setOpening({ status: "fixture", id: row.id,
        message: `${row.batch_reference} selected for the Batch Builder hand-off. No authoritative API or lock operation ran.` });
      return;
    }
    if (durableBatch?.id && String(durableBatch.id) !== String(row.id) && durableBatch.caller_holds_lock) {
      setOpening({ status: "error", id: row.id,
        message: `Close ${durableBatch.batch_reference} in Batch Builder first so its current edit lock can be released safely.` });
      return;
    }
    setOpening({ status: "loading", id: row.id, message: "Reopening caller-visible Batch state…" });
    try {
      const pricingResponse = await apiFetch(`/batches/${encodeURIComponent(row.id)}/pricing-basis`);
      const pricingData = await pricingResponse.json().catch(() => ({}));
      const pricingOutcome = classifyResponse({ ok: pricingResponse.ok, status: pricingResponse.status, data: pricingData });
      if (pricingOutcome.kind !== "ok" || !pricingData.batch) {
        setOpening({ status: pricingOutcome.kind === "access-denied" ? "denied" : "error", id: row.id,
          message: pricingOutcome.message || "The selected Batch Pricing Basis is no longer visible." });
        return;
      }

      const workspaceResponse = await apiFetch(`/batches/${encodeURIComponent(row.id)}/workspace`);
      const workspaceData = await workspaceResponse.json().catch(() => ({}));
      const workspaceOutcome = classifyResponse({ ok: workspaceResponse.ok, status: workspaceResponse.status, data: workspaceData });
      if (workspaceOutcome.kind !== "ok" || !workspaceData.batch) {
        setOpening({ status: workspaceOutcome.kind === "access-denied" ? "denied" : "error", id: row.id,
          message: workspaceOutcome.message || "The selected Batch workspace is no longer visible." });
        return;
      }

      setDurableBatch({ ...workspaceData.batch,
        pricing_basis_release: pricingData.batch.pricing_basis_release || null });
      setOpening({ status: "ready", id: row.id, message: "Caller-visible Batch reopened." });
      setTab("batch");
    } catch {
      setOpening({ status: "error", id: row.id,
        message: "The selected Batch could not be reopened. No local or fixture record was substituted." });
    }
  };

  const openQuoteEvidence = row => {
    if (fixtureOnly) return;
    setQuoteWorkspaceRequest({
      batchId: row.id,
      requestId: `batch-catalogue-${row.id}-${Date.now()}`,
    });
    setQuoteView("history");
    setTab("items");
  };

  return <div className="batch-catalogue-screen">
    {fixtureOnly && <div className="quote-fixture-banner"><strong>U4 · FIXTURE ONLY</strong>
      Isolated My Batches illustration. No authoritative read, write or lock operation occurs.
      {onExitFixture && <button type="button" onClick={onExitFixture}>Return to sign in</button>}
    </div>}
    <header className="batch-catalogue-header">
      <div><span>U4 · caller-visible durable operations</span><h1>My Batches</h1>
        <p>Newest caller-visible governed Batches. Search and filters apply only to the displayed bounded list.</p></div>
      <div className="batch-catalogue-filters">
        <label htmlFor="my-batches-search">Find in displayed records</label>
        <input id="my-batches-search" type="search" value={query} onChange={event => setQuery(event.target.value)}
          placeholder="Batch, customer, plant, sector or Release" />
        <select aria-label="Batch status" value={status} onChange={event => setStatus(event.target.value)}>
          <option value="all">All Batch states</option>
          {statusOptions.map(value => <option key={value} value={value}>{value}</option>)}
        </select>
        <select aria-label="Producing Plant" value={plant} onChange={event => setPlant(event.target.value)}>
          <option value="all">All visible plants</option>
          {plantOptions.map(value => <option key={value.id} value={value.id}>{value.plant_code} · {value.name}</option>)}
        </select>
      </div>
    </header>

    <div className="quote-disabled-actions" aria-label="Unavailable later workflow actions">
      <strong>Open a Batch to Calculate or create its draft candidate · later workflow remains separate</strong>
      {Object.keys(state.catalogue?.actions || ACTION_LABELS)
        .filter(name => !["calculate", "send"].includes(name)).map(name =>
        <button type="button" disabled key={name}>{ACTION_LABELS[name] || name}</button>)}
    </div>

    {state.status === "loading" && <LoadingState label="Loading My Batches…" />}
    {state.status === "denied" && <AccessDeniedState reason={state.message || "This Batch catalogue is not available to your caller authority."} />}
    {state.status === "error" && <div className="quote-error-state"><strong>Batch catalogue could not be loaded</strong><span>{state.message}</span></div>}
    {state.status === "ready" && state.catalogue && <>
      {state.catalogue.results_limited && <div className="quote-catalogue-limit">
        Results are limited to the newest {state.catalogue.display_limit} caller-visible Batches. Search and filters cannot reach older Batches.
      </div>}
      {(state.catalogue.details_partial || state.catalogue.denied_sections?.length > 0) && <div className="quote-partial-notice">
        <strong>Catalogue detail is partial.</strong>{" "}
        {state.catalogue.denied_sections?.length ? `Denied: ${state.catalogue.denied_sections.join(", ")}. ` : ""}
        {state.catalogue.partial_sections?.length ? `Unavailable: ${state.catalogue.partial_sections.join(", ")}.` : ""}
        No hidden identity has been inferred.
      </div>}
      {!rows.length ? <EmptyState title={query || status !== "all" || plant !== "all"
        ? "No displayed Batches match" : "No caller-visible Batches"}
        hint="Empty and access-denied remain separate states. No trial Batch or fixture is created." />
        : <div className="batch-catalogue-table-wrap"><table className="batch-catalogue-table">
          <thead><tr><th>Batch</th><th>Customer Family</th><th>Plant / Sector</th>
            <th>Pricing Basis</th><th>Status</th><th>Owner / created</th><th aria-label="Open Batch or linked Quote evidence" /></tr></thead>
          <tbody>{rows.map(row => <tr key={row.id} className={String(opening.id) === String(row.id) ? "is-selected" : ""}>
            <td><PermanentCode code={row.batch_reference} /><small>Batch #{row.id} · content v{row.content_version}</small></td>
            <td><strong>{exactIdentity(row.customer_family, "group_customer_code", "name", `Family #${row.family_id} · details unavailable`)}</strong>
              <small>Family #{row.family_id}{row.customer_family ? ` · ${row.customer_family.status}` : ""}</small></td>
            <td><strong>{exactIdentity(row.plant, "plant_code", "name", `Plant #${row.plant_id} · details unavailable`)}</strong>
              <small>Plant #{row.plant_id}</small><strong>{exactIdentity(row.sector, "sector_code", "name", row.sector_id == null ? "No Batch Sector" : `Sector #${row.sector_id} · details unavailable`)}</strong>
              <small>{row.sector_id == null ? "No Sector identity" : `Sector #${row.sector_id}`}</small></td>
            <td><strong>{row.pricing_basis_release?.release_name || (row.pricing_basis_release_id == null ? "Unresolved" : `Release #${row.pricing_basis_release_id} · details unavailable`)}</strong>
              <small>{row.pricing_basis_release_id == null ? "No Release identity" : `Release #${row.pricing_basis_release_id}`} · {row.pricing_basis_is_deliberate ? "deliberate" : "automatic"}</small>
              <small>Pricing Date {row.pricing_date || "not recorded"}{row.pricing_basis_release?.status ? ` · ${row.pricing_basis_release.status}` : ""}</small></td>
            <td><LifecycleBadge status={row.status} />{row.details_partial && <small>Partial caller-visible detail</small>}</td>
            <td><strong>{row.owner?.display_name || `User #${row.owner_user_id}`}</strong>
              <small>Owner #{row.owner_user_id} · {dateTime(row.created_at)}</small></td>
            <td><div className="batch-catalogue-actions"><button type="button" onClick={() => openBatch(row)}
              disabled={opening.status === "loading"}>
              {opening.status === "loading" && String(opening.id) === String(row.id) ? "Opening…" : "Open in Batch Builder"}
              {" "}<ProvenanceTag kind="governed" style={{ verticalAlign: "middle" }} />
            </button><button type="button" onClick={() => openQuoteEvidence(row)} disabled={fixtureOnly}>
              Open Quote evidence{" "}<ProvenanceTag kind="immutable" style={{ verticalAlign: "middle" }} />
            </button></div></td>
          </tr>)}</tbody>
        </table></div>}
    </>}

    {opening.status === "denied" && <AccessDeniedState reason={opening.message} />}
    {opening.status === "error" && <div className="quote-error-state"><strong>Batch could not be opened</strong><span>{opening.message}</span></div>}
    {opening.status === "fixture" && <div className="batch-catalogue-handoff" role="status"><strong>Fixture hand-off selected</strong><span>{opening.message}</span></div>}
  </div>;
}
