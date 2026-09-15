import { useState } from "react";
import { apiFetch } from "../lib/apiClient.js";
import { classifyResponse } from "../lib/backendError.js";
import { useAppState } from "../state/AppStateContext.js";
import QuoteCatalogueScreen from "./QuoteCatalogueScreen.jsx";
import QuoteItemsTab from "./QuoteItemsTab.jsx";
import QuotesScreen from "./QuotesScreen.jsx";
import { ProvenanceTag } from "../ui/dataDisplay.jsx";

// Each view carries the shared provenance tag, so local working items and
// immutable governed evidence are told apart by a stable visual signal, not
// only by banner text (UX policy §3).
const QUOTE_VIEWS = [
  { id: "working-items", label: "Working Quote Items", provenance: "local" },
  { id: "governed", label: "Governed Quote evidence", provenance: "immutable" },
  { id: "history", label: "Quote History", provenance: "immutable" },
];

export default function QuotesWorkspace({ fixtureOnly = false, initialView = "working-items", onExitFixture }) {
  const {
    durableBatch, quoteView, quoteWorkspaceRequest, setBatchWorkspaceRequest, setDurableBatch,
    setQuoteView, setTab, showToast,
  } = useAppState();
  const [fixtureView, setFixtureView] = useState(initialView);
  const [sourceBatchState, setSourceBatchState] = useState({ status: "idle", batchId: null, message: "" });
  const view = fixtureOnly ? fixtureView : quoteView;
  const selectView = fixtureOnly ? setFixtureView : setQuoteView;

  const openSourceBatch = async batch => {
    if (fixtureOnly || batch?.id == null) return;
    if (durableBatch?.id && String(durableBatch.id) !== String(batch.id) && durableBatch.caller_holds_lock) {
      const message = `Close ${durableBatch.batch_reference} in Batch Builder first so its current edit lock can be released safely.`;
      setSourceBatchState({ status: "error", batchId: batch.id, message });
      showToast?.(message, "error", 8500);
      return;
    }
    setSourceBatchState({ status: "loading", batchId: batch.id, message: "Opening caller-visible current Batch state…" });
    try {
      const pricingResponse = await apiFetch(`/batches/${encodeURIComponent(batch.id)}/pricing-basis`);
      const pricingData = await pricingResponse.json().catch(() => ({}));
      const pricingOutcome = classifyResponse({ ok: pricingResponse.ok, status: pricingResponse.status, data: pricingData });
      if (pricingOutcome.kind !== "ok" || !pricingData.batch) {
        const message = pricingOutcome.message || "The source Batch Pricing Basis is no longer visible.";
        setSourceBatchState({ status: pricingOutcome.kind === "access-denied" ? "denied" : "error", batchId: batch.id, message });
        return;
      }

      const workspaceResponse = await apiFetch(`/batches/${encodeURIComponent(batch.id)}/workspace`);
      const workspaceData = await workspaceResponse.json().catch(() => ({}));
      const workspaceOutcome = classifyResponse({ ok: workspaceResponse.ok, status: workspaceResponse.status, data: workspaceData });
      if (workspaceOutcome.kind !== "ok" || !workspaceData.batch) {
        const message = workspaceOutcome.message || "The source Batch workspace is no longer visible.";
        setSourceBatchState({ status: workspaceOutcome.kind === "access-denied" ? "denied" : "error", batchId: batch.id, message });
        return;
      }

      setDurableBatch({ ...workspaceData.batch,
        pricing_basis_release: pricingData.batch.pricing_basis_release || null });
      setBatchWorkspaceRequest({
        batchId: batch.id,
        mode: "quote-source-read",
        requestId: `quote-source-${batch.id}-${Date.now()}`,
      });
      setSourceBatchState({ status: "ready", batchId: batch.id, message: "Current source Batch opened separately from frozen Quote evidence." });
      setTab("batch");
    } catch {
      setSourceBatchState({ status: "error", batchId: batch.id,
        message: "The source Batch could not be reopened. No local or fixture record was substituted." });
    }
  };

  return <div className="quotes-screen">
    {fixtureOnly && <div className="quote-fixture-banner"><strong>U5 · FIXTURE ONLY</strong>
      Isolated Quotes illustration. No authoritative read, workflow transition, or database write occurs.
      {onExitFixture && <button type="button" onClick={onExitFixture}>Return to sign in</button>}
    </div>}
    <div className="quotes-view-switch" role="tablist" aria-label="Quotes views">
      {QUOTE_VIEWS.map(option => <button type="button" role="tab" key={option.id}
        aria-selected={view === option.id} className={view === option.id ? "is-active" : ""}
        onClick={() => selectView(option.id)}>
        {option.label} <ProvenanceTag kind={option.provenance} style={{ marginLeft: 4, verticalAlign: "middle" }} />
      </button>)}
    </div>
    {view === "governed" && <QuotesScreen fixtureOnly={fixtureOnly} embedded showFixtureBanner={false}
      onOpenSourceBatch={fixtureOnly ? null : openSourceBatch} sourceBatchState={sourceBatchState} />}
    {view === "working-items" && <div className="quote-tab-panel">
      <div className="quote-local-warning">Local working items are not an immutable governed Quote revision.</div>
      <QuoteItemsTab />
    </div>}
    {view === "history" && <QuoteCatalogueScreen mode="history" fixtureOnly={fixtureOnly}
      initialRevisionId={fixtureOnly ? null : quoteWorkspaceRequest?.revisionId}
      initialBatchId={fixtureOnly ? null : quoteWorkspaceRequest?.batchId}
      requestId={fixtureOnly ? null : quoteWorkspaceRequest?.requestId}
      onOpenSourceBatch={fixtureOnly ? null : openSourceBatch} sourceBatchState={sourceBatchState}
      embedded showFixtureBanner={false} />}
  </div>;
}
