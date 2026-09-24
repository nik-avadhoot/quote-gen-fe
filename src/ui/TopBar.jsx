import { useEffect, useMemo, useRef, useState } from "react";
import AccountMenu from "../AccountMenu.jsx";
import { FOCUS, journeyStageDisclosure } from "../lib/quoteJourney.js";
import { useAppState } from "../state/AppStateContext.js";
import "./TopBar.css";

const TAB_LABELS = {
  costing: "Quick calculation", batch: "Batch Builder", mybatches: "Active Batches",
  approvalinbox: "Approval Inbox", items: "Quotes", families: "Customer Families",
  conlib: "Construction Library", conadoption: "Plant Construction Adoption",
  constrlib: "Construction Library", gsm: "GSM Master", skus: "SKU Master",
  defaults: "Commercial Policies", rates: "Rate Masters", freight: "Freight Masters",
  pricingbasis: "Pricing Basis Releases", users: "Users & Access", plants: "Producing Plants",
};

const STAGE_FOCUS = {
  customer: FOCUS.profile,
  products: FOCUS.addProduct,
  price: FOCUS.calculate,
  review: FOCUS.workspace,
};

function focusControl(id) {
  if (!id) return;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const element = document.getElementById(id);
    if (!element) return;
    element.scrollIntoView({ block: "nearest", inline: "nearest" });
    element.focus?.({ preventScroll: true });
    element.animate?.([
      { outline: "2px solid #e6983d", outlineOffset: "2px" },
      { outline: "2px solid transparent", outlineOffset: "2px" },
    ], { duration: 1400, easing: "ease-out" });
  }));
}

export default function TopBar() {
  const {
    activeBatchRowId, batchFocusMode, batchJourney, batchProfile, batchRows,
    durableBatch, handleBackup, handleRestore, handleRestoreFile,
    quoteHeaderContext, quoteView, requestExitReview, restoreRef,
    setBatchFocusMode, setBatchWorkspaceRequest, setQuoteView, setShowChangePassword,
    setShowProfile, setTab, tab,
  } = useAppState();
  const [journeyOpen, setJourneyOpen] = useState(false);
  const journeyRef = useRef(null);
  const returnRequestSerial = useRef(0);
  const stages = useMemo(() => journeyStageDisclosure(batchJourney), [batchJourney]);
  const currentStage = stages.find(stage => stage.state === "current");
  const customer = durableBatch?.customer_party_id != null
    ? durableBatch.customer_party?.display_name || "Customer identity unavailable"
    : batchProfile?.client || "Customer not named";
  const isDeepDive = tab === "costing" && !!activeBatchRowId;
  const isPrivateQuick = tab === "costing" && !activeBatchRowId;
  const workingQuotes = tab === "items" && quoteView === "working-items";
  const showBatchContext = isDeepDive || (!!durableBatch?.id
    && (tab === "batch" || workingQuotes));
  const showQuoteContext = tab === "items"
    || (tab === "approvalinbox" && !!quoteHeaderContext?.revisionId);

  useEffect(() => {
    if (!journeyOpen) return undefined;
    const close = event => {
      if (journeyRef.current && !journeyRef.current.contains(event.target)) setJourneyOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [journeyOpen]);
  const returnToBatch = (focusId = null) => {
    const rowId = activeBatchRowId;
    const reviewRow = (batchRows || []).find(row => row.id === rowId);
    const durableRowId = reviewRow?.durableRowId ?? null;
    if (isDeepDive && !requestExitReview?.()) return false;
    setJourneyOpen(false);
    setBatchFocusMode(false);
    if (!focusId && durableRowId != null && durableBatch?.id != null) {
      returnRequestSerial.current += 1;
      setBatchWorkspaceRequest({
        requestId: `costing-return-${durableBatch.id}-${durableRowId}-${returnRequestSerial.current}`,
        batchId: durableBatch.id,
        mode: "row-focus",
        rowId: durableRowId,
      });
    }
    setTab("batch");
    if (focusId || durableRowId == null) {
      focusControl(focusId || (rowId ? `batch-row-${rowId}` : FOCUS.workspace));
    }
    return true;
  };

  const openStage = stage => {
    if (stage.disabled) return;
    setJourneyOpen(false);
    if (stage.surface === "items") {
      setQuoteView("working-items");
      setTab("items");
      return;
    }
    if (stage.surface === "batch") returnToBatch(STAGE_FOCUS[stage.id] || FOCUS.workspace);
  };

  const goToNext = () => {
    const next = batchJourney?.next;
    if (!next) return;
    setJourneyOpen(false);
    if (next.surface === "items") {
      // Working is the customer-document preparation surface. A prior History
      // selection must not hijack this explicit journey target.
      setQuoteView("working-items");
      setTab("items");
      return;
    }
    if (next.surface === "batch") {
      if (tab === "batch") {
        if (batchFocusMode) setBatchFocusMode(false);
        focusControl(next.focus || FOCUS.workspace);
      } else {
        returnToBatch(next.focus || FOCUS.workspace);
      }
    }
  };

  const quoteIdentity = quoteHeaderContext?.quoteReference
    || (quoteHeaderContext?.revisionId != null
      ? `Quote revision #${quoteHeaderContext.revisionId}` : null);
  const revisionIdentity = quoteHeaderContext?.revisionNumber != null
    ? `Revision ${quoteHeaderContext.revisionNumber}`
    : quoteHeaderContext?.revisionId != null ? `Revision #${quoteHeaderContext.revisionId}` : null;
  const activeLocalRow = (batchRows || []).find(row => row.id === activeBatchRowId);
  const durableOriginRowId = activeLocalRow?.durableRowId ?? null;
  const rowNumber = Math.max(1, durableOriginRowId == null
    ? (batchRows || []).findIndex(row => row.id === activeBatchRowId) + 1
    : (durableBatch?.batch_rows || []).findIndex(row =>
      String(row.id) === String(durableOriginRowId)) + 1);
  const batchReference = durableBatch?.batch_reference || "Working Batch";

  return <header className="app-topbar">
    <div className="app-topbar__location">
      {isDeepDive
        ? <button type="button" className="app-topbar__back" onClick={() => returnToBatch()}>
          ← Batch Builder
        </button>
        : <strong>{TAB_LABELS[tab] || ""}</strong>}
      {isPrivateQuick && <span className="app-topbar__private">Private · no Batch context</span>}
    </div>

    {showBatchContext && <div className="app-topbar__context" aria-label="Active Batch journey">
      <span className="app-topbar__batch" title={`${batchReference} · ${customer}`}>
        <b>Batch</b> {batchReference} · {customer}
      </span>
      {isDeepDive && <span className="app-topbar__row">Row {rowNumber}</span>}
      <div className="app-topbar__journey" ref={journeyRef}>
        <button type="button" className="app-topbar__stage" aria-expanded={journeyOpen}
          onClick={() => setJourneyOpen(open => !open)}>
          {currentStage?.label || batchJourney?.stageLabel} · {Math.max(1,
            stages.findIndex(stage => stage.state === "current") + 1)} of {stages.length} ▾
        </button>
        {journeyOpen && <div className="app-topbar__stage-menu" role="menu" aria-label="Quotation stages">
          {stages.map(stage => <button type="button" role="menuitem" key={stage.id}
            className={`is-${stage.state}`} disabled={stage.disabled}
            title={stage.disabled ? stage.reason : stage.question}
            onClick={() => openStage(stage)}>
            <span aria-hidden="true">{stage.state === "complete" ? "✓"
              : stage.state === "current" ? "●" : "○"}</span>
            <span><b>{stage.label}</b><small>{stage.disabled ? stage.reason : stage.question}</small></span>
            <em>{stage.surface === "batch" ? "Batch"
              : stage.id === "approval" ? "Approval" : "Quotes"}</em>
          </button>)}
        </div>}
      </div>
      <button type="button" className="app-topbar__next" onClick={goToNext}
        title={batchJourney.next.detail}>
        <b>Next:</b> <span>{batchJourney.next.label}</span>
      </button>
      {batchJourney.counts.rows > 0 && batchJourney.counts.toFix > 0
        && <span className="app-topbar__blockers">{batchJourney.counts.toFix} to fix</span>}
    </div>}

    {showQuoteContext && <div className="app-topbar__quote-context" aria-label="Quote view context">
      <span>{quoteHeaderContext?.view || (quoteView === "working-items" ? "Working Quote Items"
        : quoteView === "governed" ? "Governed Quote" : "Quote History")}</span>
      {quoteIdentity && <b title={quoteIdentity}>{quoteIdentity}</b>}
      {revisionIdentity && <em>{revisionIdentity}</em>}
    </div>}

    <div className="app-topbar__account">
      <AccountMenu onEditProfile={() => setShowProfile(true)}
        onChangePassword={() => setShowChangePassword(true)}
        onBackup={handleBackup} onRestore={handleRestore}/>
      <input ref={restoreRef} type="file" accept="application/json" hidden
        onChange={handleRestoreFile}/>
    </div>
  </header>;
}
