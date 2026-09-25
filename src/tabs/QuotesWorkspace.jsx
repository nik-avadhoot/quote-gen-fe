// ═══════════════════════════════════════════════════════════════════════════
// src/tabs/QuotesWorkspace.jsx — the Quotes screen's three views (U5).
//
// ── SCREEN SPACE ──────────────────────────────────────────────────────────
// The TopBar already says "Quotes". The view switch used to sit in a band of
// its own above whichever view was mounted, so every Quotes view spent one
// band on navigation and a second on its own controls. The switch is now
// passed INTO the active view as its toolbar's leading control, which keeps
// the standard's "one toolbar per panel" literally true. The Working view
// receives it the same way (`QuoteItemsTab toolbarLead`), so no view here
// renders a toolbar or footer of its own.
//
// Each view carries the shared provenance tag, so local working items and
// immutable governed evidence are told apart by a stable visual signal, not
// only by banner text (UX policy §3).
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useState } from "react";
import { apiFetch } from "../lib/apiClient.js";
import { classifyResponse } from "../lib/backendError.js";
import { useAppState } from "../state/AppStateContext.js";
import QuoteCatalogueScreen from "./QuoteCatalogueScreen.jsx";
import QuoteItemsTab from "./QuoteItemsTab.jsx";
import QuotesScreen from "./QuotesScreen.jsx";
import { ProvenanceTag } from "../ui/dataDisplay.jsx";
import { segment } from "../ui/screenStandards.js";
import { C, sans } from "../theme.js";

const QUOTE_VIEWS = [
  { id: "working-items", label: "Working", name: "Working Quote Items", provenance: "local" },
  { id: "governed", label: "Governed", name: "Governed Quote evidence", provenance: "immutable" },
  { id: "history", label: "History", name: "Quote History", provenance: "immutable" },
];

export default function QuotesWorkspace({ fixtureOnly = false, initialView = "working-items", onExitFixture }) {
  const {
    durableBatch, quoteView, quoteWorkspaceRequest, setBatchWorkspaceRequest, setDurableBatch,
    setQuoteHeaderContext, setQuoteView, setTab, showToast,
  } = useAppState();
  const [fixtureView, setFixtureView] = useState(initialView);
  const [sourceBatchState, setSourceBatchState] = useState({ status: "idle", batchId: null, message: "" });
  const view = fixtureOnly ? fixtureView : quoteView;
  const selectView = fixtureOnly ? setFixtureView : setQuoteView;

  useEffect(() => {
    if (fixtureOnly) return undefined;
    if (view === "working-items") {
      setQuoteHeaderContext({ kind: "working", view: "Working Quote Items",
        batchId: durableBatch?.id ?? null,
        batchReference: durableBatch?.batch_reference || null,
        revisionId: null, revisionNumber: null });
    } else {
      setQuoteHeaderContext(null);
    }
    return () => setQuoteHeaderContext(null);
  }, [durableBatch?.batch_reference, durableBatch?.id, fixtureOnly,
    setQuoteHeaderContext, view]);

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

  // Rendered as the leading control of the active view's own toolbar, so the
  // screen never spends a second band on choosing between its views.
  const viewSwitch = <div role="tablist" aria-label="Quotes views"
    style={{ display: "inline-flex", border: `1px solid ${C.border}`, borderRadius: 5,
      overflow: "hidden", flexShrink: 0, background: C.white }}>
    {QUOTE_VIEWS.map(option => <button type="button" role="tab" key={option.id}
      aria-selected={view === option.id} onClick={() => selectView(option.id)}
      title={`${option.name} — ${option.provenance === "local"
        ? "kept in this browser only" : "frozen governed evidence"}`}
      style={{ ...segment(view === option.id), display: "inline-flex", alignItems: "center", gap: 5,
        whiteSpace: "nowrap" }}>
      {option.label}
      {view === option.id && <ProvenanceTag kind={option.provenance}
        style={{ background: "transparent", color: C.white, border: "1px solid rgba(255,255,255,.4)" }} />}
    </button>)}
  </div>;

  const banner = fixtureOnly && <div className="quote-fixture-banner"><strong>U5 · FIXTURE ONLY</strong>
    Isolated Quotes illustration. No authoritative read, workflow transition, or database write occurs.
    {onExitFixture && <button type="button" onClick={onExitFixture}>Return to sign in</button>}
  </div>;

  return <div style={{ height: "100%", display: "flex", flexDirection: "column", minHeight: 0,
    fontFamily: sans, background: C.cream }}>
    {banner}
    {view === "governed" && <QuotesScreen fixtureOnly={fixtureOnly} showFixtureBanner={false}
      toolbarLead={viewSwitch}
      onContextChange={fixtureOnly ? null : setQuoteHeaderContext}
      onOpenSourceBatch={fixtureOnly ? null : openSourceBatch} sourceBatchState={sourceBatchState} />}
    {view === "working-items" && <QuoteItemsTab toolbarLead={viewSwitch} />}
    {view === "history" && <QuoteCatalogueScreen mode="history" fixtureOnly={fixtureOnly}
      toolbarLead={viewSwitch}
      initialRevisionId={fixtureOnly ? null : quoteWorkspaceRequest?.revisionId}
      initialBatchId={fixtureOnly ? null : quoteWorkspaceRequest?.batchId}
      initialAgainst={fixtureOnly ? null : quoteWorkspaceRequest?.against}
      requestId={fixtureOnly ? null : quoteWorkspaceRequest?.requestId}
      onContextChange={fixtureOnly ? null : setQuoteHeaderContext}
      onOpenSourceBatch={fixtureOnly ? null : openSourceBatch} sourceBatchState={sourceBatchState}
      showFixtureBanner={false} />}
  </div>;
}
