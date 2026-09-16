// ═══════════════════════════════════════════════════════════════════════════
// src/tabs/QuoteCatalogueScreen.jsx — Approval Inbox and Quote History (U5).
//
// ── SCREEN SPACE ──────────────────────────────────────────────────────────
// The TopBar already names the screen, so there is no page header here.
//
// The catalogue and the immutable evidence are two PANELS, not one column:
// evidence used to open as a section below the table, so the list and the
// evidence it opened competed for the same scroll. Each panel now has exactly
// one toolbar at the shared height, the divider opens at 50 : 50 and moves by
// drag or arrow key between 25 % and 75 %, and either panel can fill the
// screen area through the shared expand icon — inside the app window, never
// the browser Fullscreen API.
//
// Rows are dense with the Quote identity frozen while the rest scrolls
// sideways; revision identities, batch state, standing and timestamps open in
// the row's own disclosure so a compact row is never made taller by them. The
// workflow actions that need S9 activation stay VISIBLE and disabled inside
// the one toolbar with their reason.
//
// ── HONEST STATES ─────────────────────────────────────────────────────────
// Read-only. A bounded window says so, partial detail names what was denied
// and what was unavailable, and empty never stands in for access-denied.
// ═══════════════════════════════════════════════════════════════════════════
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "../lib/apiClient.js";
import { classifyResponse } from "../lib/backendError.js";
import { SPLIT_DEFAULT, panelLayout } from "../lib/panelSplit.js";
import {
  orderedQuoteRevisions, quoteActor, quoteRevisionLabel, U5_QUOTE_CATALOGUE_ILLUSTRATIONS,
  U5_QUOTE_ILLUSTRATION, U5_SUBMITTED_QUOTE_ILLUSTRATION,
} from "../lib/quoteEvidenceModel.js";
import { AccessDeniedState, EmptyState, LoadingState } from "../ui/appStates.jsx";
import { LifecycleBadge, PermanentCode, ProvenanceTag } from "../ui/dataDisplay.jsx";
import {
  PanelDivider, PanelFocusToggle, PendingActions, RowDisclosure, ScreenFooter, ToolbarLabel,
} from "../ui/screenChrome.jsx";
import {
  control, denseCell, denseHead, denseTable, frozenCell, menuPanel, menuSummary, segment, toolbar,
  usePanelFocus, useSplitPanels,
} from "../ui/screenStandards.js";
import { C, T, mono, sans } from "../theme.js";
import { QuoteEvidence } from "./QuotesScreen.jsx";

const STATUS_OPTIONS = ["all", "draft", "submitted", "returned", "approved", "issued", "withdrawn"];
// S9 Speedbreaker: visible, disabled, and carrying their reason.
const PENDING_WORKFLOW = ["Approve", "Return", "Withdraw", "Issue", "Create revision"];
const COLUMNS = ["Revision", "Batch", "Customer", "Plant", "State", "Maker", "Items"];

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

// Everything the compact row leaves out, reached by its own chevron.
function rowDetail(row) {
  return [
    ["Revision identity", `#${row.id}`],
    ["Quote family", row.quote_family_id == null ? "Not recorded" : `#${row.quote_family_id}`],
    ["Permanent reference", row.quote_reference || "Allocated on first approval"],
    ["Standing", row.standing || "Not allocated"],
    ["Source Batch state", row.batch_status || "Status unavailable"],
    ["Quote date", row.quote_date || "Not recorded"],
    ["Created", dateTime(row.created_at)],
  ];
}

function Notice({ tone = "warn", children }) {
  const warn = tone === "warn";
  return <div role="status" style={{
    display: "flex", alignItems: "center", gap: 6, padding: "3px 10px", flexShrink: 0,
    borderBottom: `1px solid ${warn ? C.amber : C.red}55`, background: warn ? C.amberL : C.redL,
    fontSize: T.label, color: warn ? C.amberD : C.red, lineHeight: 1.35,
  }}>{children}</div>;
}

export default function QuoteCatalogueScreen({
  mode = "history", fixtureOnly = false, initialRevisionId = null, initialBatchId = null,
  requestId = null, onExitFixture, onOpenSourceBatch, sourceBatchState, showFixtureBanner = true,
  toolbarLead = null,
}) {
  const isInbox = mode === "inbox";
  const noun = isInbox ? "Approval Inbox" : "Quote History";
  const fixture = U5_QUOTE_CATALOGUE_ILLUSTRATIONS[mode];
  const [state, setState] = useState(fixtureOnly
    ? { status: "ready", catalogue: fixture }
    : { status: "loading", catalogue: null });
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [selectedId, setSelectedId] = useState(null);
  const [expanded, setExpanded] = useState([]);
  const [detail, setDetail] = useState({ status: "idle", quote: null });
  const [openedBy, setOpenedBy] = useState(null);
  const openedRequestRef = useRef(null);
  const { focusPanel, toggleFocus, exitFocusOnEscape } = usePanelFocus();
  const { split, setSplit, dragging, startDrag, nudgeSplit, bodyRef } = useSplitPanels();

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

  const catalogue = state.catalogue;
  const allRows = catalogue?.rows || [];
  const anyFilter = status !== "all" || Boolean(query.trim());
  const toggleRow = id => setExpanded(list => list.includes(id) ? list.filter(x => x !== id) : [...list, id]);
  const closeDetail = () => { setSelectedId(null); setOpenedBy(null); setDetail({ status: "idle", quote: null }); };
  const hasDetail = detail.status !== "idle";
  const layout = panelLayout(split, focusPanel);
  const count = state.status === "ready"
    ? `${rows.length} row${rows.length === 1 ? "" : "s"}${rows.length !== allRows.length ? ` of ${allRows.length}` : ""}` : "—";
  const selectedRow = rows.find(row => String(row.id) === String(selectedId));
  const selectedLabel = openedBy?.kind === "batch" ? `Batch #${openedBy.id}`
    : selectedRow ? (selectedRow.quote_reference || quoteRevisionLabel(selectedRow))
      : selectedId != null ? `Revision #${selectedId}` : null;

  return <div onKeyDown={exitFocusOnEscape} style={{ height: "100%", display: "flex",
    flexDirection: "column", fontFamily: sans, background: C.cream, minHeight: 0 }}>
    {fixtureOnly && showFixtureBanner && <div className="quote-fixture-banner"><strong>U5 · FIXTURE ONLY</strong>
      Isolated {noun} illustration. No authoritative read or workflow transition occurs.
      {onExitFixture && <button type="button" onClick={onExitFixture}>Return to sign in</button>}
    </div>}

    <div ref={bodyRef} style={{ flex: 1, display: "flex", minHeight: 0 }}>
      {layout.showList && <div aria-label={`${noun} list`} style={{ width: layout.listWidth,
        flex: layout.showDetail ? "0 0 auto" : "1 1 auto", minWidth: 0, display: "flex",
        flexDirection: "column", background: C.white }}>
        <div role="toolbar" aria-label={`${noun} controls`} style={toolbar}>
          {toolbarLead}
          <input type="search" aria-label={`Search displayed ${noun} records`} value={query}
            placeholder="Quote, Batch, plant or customer"
            title="Filters the displayed bounded list in this browser. It cannot reach records outside the window the server returned."
            onChange={event => setQuery(event.target.value)}
            style={{ ...control, width: 150, minWidth: 110, flex: "0 1 150px" }} />
          {!isInbox && <select aria-label="Workflow status" value={status}
            onChange={event => setStatus(event.target.value)} style={control}>
            {STATUS_OPTIONS.map(value => <option key={value} value={value}>
              {value === "all" ? "All states" : value}</option>)}
          </select>}
          <details style={{ position: "relative" }}>
            <summary style={menuSummary(false)}>Filters ▾</summary>
            <div style={menuPanel}>
              <div style={{ fontSize: T.label, color: C.slateL, lineHeight: 1.4 }}>
                {isInbox
                  ? "The Approval Inbox is already scoped to submitted revisions awaiting Checker review."
                  : "Workflow state is on the toolbar. Further filtering would need a server-side catalogue query."}
              </div>
              <button type="button" onClick={() => { setQuery(""); setStatus("all"); }} disabled={!anyFilter}
                style={{ ...control, fontSize: T.label, cursor: "pointer" }}>Clear all filters</button>
              <div role="group" aria-label="Split" style={{ display: "grid", gap: 3,
                borderTop: `1px solid ${C.border}`, paddingTop: 7 }}>
                <span style={{ fontSize: T.label, color: C.slateL }}>
                  Split · or drag the divider, or move it with the arrow keys</span>
                <div style={{ display: "inline-flex", border: `1px solid ${C.border}`, borderRadius: 5,
                  overflow: "hidden", width: "fit-content" }}>
                  {[[35, "35:65"], [50, "50:50"], [65, "65:35"]].map(([value, label]) => (
                    <button key={label} type="button" onClick={() => setSplit(value)} aria-pressed={split === value}
                      style={{ ...segment(split === value), fontFamily: mono }}>{label}</button>))}
                </div>
              </div>
            </div>
          </details>
          <span style={{ flex: "1 1 auto" }} />
          <span style={{ fontSize: T.label, color: C.slateL, whiteSpace: "nowrap" }}>{count}</span>
          <PanelFocusToggle panel="list" noun={`${noun} list`} focused={focusPanel === "list"} onToggle={toggleFocus} />
        </div>

        {catalogue?.results_limited && <Notice>
          First {catalogue.display_limit} caller-visible records only. This is not the complete catalogue.
        </Notice>}
        {(catalogue?.details_partial || catalogue?.denied_sections?.length > 0) && <Notice>
          <strong>Catalogue detail is partial.</strong>
          <span>
            {catalogue.denied_sections?.length ? `Denied: ${catalogue.denied_sections.join(", ")}. ` : ""}
            {catalogue.partial_sections?.length ? `Unavailable: ${catalogue.partial_sections.join(", ")}. ` : ""}
            No hidden identity has been inferred.
          </span>
        </Notice>}

        <div style={{ flex: 1, minHeight: 0, overflow: "auto", background: C.white }}>
          {state.status === "loading" && <LoadingState label={`Loading ${noun}…`} />}
          {state.status === "denied" && <AccessDeniedState reason={state.message
            || "This view is not available to your caller authority."} />}
          {state.status === "error" && <div style={{ padding: 12 }}>
            <div style={{ fontSize: T.title, fontWeight: 700, color: C.red, marginBottom: 6 }}>
              Catalogue could not be loaded</div>
            <div style={{ fontSize: T.label, color: C.slateL }}>{state.message}</div>
          </div>}
          {state.status === "ready" && (rows.length === 0
            ? <EmptyState
                title={anyFilter ? "No displayed record matches these filters"
                  : `No ${isInbox ? "submitted revisions" : "Quote history"} visible to you`}
                hint={anyFilter
                  ? "Clear a filter to widen the answer. Filters only search the bounded window the server returned."
                  : "Empty and access-denied remain separate states. No fixture is used in the authenticated catalogue."} />
            : <table style={denseTable}>
                <thead>
                  <tr>
                    <th scope="col" style={{ ...denseHead, ...frozenCell(false, true) }}>
                      {isInbox ? "Approval candidate" : "Quote"}</th>
                    {COLUMNS.map(label => <th key={label} scope="col" style={denseHead}>{label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(row => {
                    const open = expanded.includes(row.id);
                    const selected = String(selectedId) === String(row.id);
                    return <Fragment key={row.id}>
                      <tr style={{ height: 26, background: selected ? "#FEF3E8" : C.white, cursor: "pointer" }}
                        onClick={() => openRevision(row.id)}>
                        <td style={frozenCell(selected)}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                            <span onClick={event => event.stopPropagation()} style={{ display: "inline-flex" }}>
                              <RowDisclosure open={open} onToggle={() => toggleRow(row.id)}
                                label={`Recorded detail for ${row.quote_reference || quoteRevisionLabel(row)}`} />
                            </span>
                            {row.quote_reference
                              ? <PermanentCode code={row.quote_reference} />
                              : <span style={{ fontSize: T.body, color: C.slateL, fontStyle: "italic" }}>
                                  Allocated on first approval</span>}
                          </span>
                        </td>
                        <td style={denseCell}>{quoteRevisionLabel(row)}</td>
                        <td style={{ ...denseCell, fontFamily: mono }}>{row.batch_reference || "—"}</td>
                        <td style={denseCell}>{row.customer_family
                          ? `${row.customer_family.group_customer_code} · ${row.customer_family.name}` : "Unavailable"}</td>
                        <td style={denseCell}>{row.plant ? `${row.plant.plant_code} · ${row.plant.name}` : "Unavailable"}</td>
                        <td style={denseCell}>
                          <span style={{ display: "inline-flex", gap: 6 }}>
                            <LifecycleBadge status={row.workflow_status} />
                            {row.standing && <LifecycleBadge status={row.standing} />}
                          </span>
                        </td>
                        <td style={denseCell}>{quoteActor(row.created_by_actor, row.created_by)}</td>
                        <td style={{ ...denseCell, textAlign: "right" }}>{row.item_count}</td>
                      </tr>
                      {open && <tr>
                        <td colSpan={COLUMNS.length + 1} style={{ ...denseCell, whiteSpace: "normal",
                          maxWidth: "none", background: "#FBF8F3", padding: "6px 10px 8px 26px" }}>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
                            gap: "4px 14px" }}>
                            {rowDetail(row).map(([label, value]) => <div key={label} style={{ minWidth: 0 }}>
                              <span style={{ fontSize: T.micro, fontWeight: 800, letterSpacing: "0.05em",
                                textTransform: "uppercase", color: C.slateL }}>{label}</span>
                              <div style={{ fontSize: T.body, color: C.slate, overflowWrap: "anywhere" }}>{value}</div>
                            </div>)}
                          </div>
                        </td>
                      </tr>}
                    </Fragment>;
                  })}
                </tbody>
              </table>)}
        </div>

        <ScreenFooter right={`${allRows.length} in the returned window · read-only`}>
          <ProvenanceTag kind="immutable" />
          <span title="Frozen at Send. Current Batch and master values never replace snapshot evidence.">
            Quote evidence · never edited in place</span>
        </ScreenFooter>
      </div>}

      {layout.showDivider && <PanelDivider label={`Resize the ${noun} list and the evidence`}
        split={split} dragging={dragging} onPointerDown={startDrag}
        onReset={() => setSplit(SPLIT_DEFAULT)} onKeyDown={nudgeSplit} />}

      {layout.showDetail && <div aria-label="Immutable Quote evidence" style={{ flex: 1, minWidth: 0,
        display: "flex", flexDirection: "column", background: C.cream }}>
        <div role="toolbar" aria-label="Quote evidence controls" style={{ ...toolbar, flexWrap: "nowrap" }}>
          <ToolbarLabel>Evidence</ToolbarLabel>
          <span style={{ fontFamily: mono, fontSize: T.body, fontWeight: 700,
            color: selectedLabel ? C.slate : C.slateL, overflow: "hidden", textOverflow: "ellipsis",
            whiteSpace: "nowrap", minWidth: 0 }}>{selectedLabel || "No revision selected"}</span>
          <PendingActions actions={PENDING_WORKFLOW} label="Quote workflow actions awaiting backend activation" />
          <span style={{ flex: "1 1 auto" }} />
          {focusPanel === "detail" && <span style={{ fontSize: T.label, color: C.slateL, whiteSpace: "nowrap" }}>
            Esc to restore</span>}
          {hasDetail && <button type="button" onClick={closeDetail} style={{ ...control, fontSize: T.label,
            cursor: "pointer", flexShrink: 0 }}>Close</button>}
          <PanelFocusToggle panel="detail" noun="evidence" focused={focusPanel === "detail"} onToggle={toggleFocus}
            disabled={!hasDetail} disabledTitle="Select a revision first" />
        </div>

        <div style={{ flex: 1, minHeight: 0, overflow: "auto", padding: hasDetail ? "10px 12px 16px" : 0 }}>
          {detail.status === "idle" && <EmptyState title="Select a revision"
            hint="Its frozen identity, workflow chronology, Quote Items and customer outcomes open here." />}
          {detail.status === "loading" && <LoadingState label="Loading immutable revision evidence…" />}
          {detail.status === "denied" && <AccessDeniedState reason={detail.message} />}
          {detail.status === "empty" && <EmptyState title="No linked Quote evidence is visible"
            hint="This Batch has no caller-visible Quote family yet. No identity or current Batch value was inferred." />}
          {detail.status === "error" && <div style={{ padding: 12 }}>
            <div style={{ fontSize: T.title, fontWeight: 700, color: C.red, marginBottom: 6 }}>
              Evidence could not be loaded</div>
            <div style={{ fontSize: T.label, color: C.slateL }}>{detail.message}</div>
          </div>}
          {detail.status === "ready" && detail.quote && <>
            {openedBy?.kind === "batch" && <Notice>
              Opened from exact Batch identity #{openedBy.id}. The newest caller-visible linked revision is selected.
            </Notice>}
            {openedBy?.kind === "revision" && selectedId != null
              && !rows.some(row => String(row.id) === String(selectedId)) && <Notice>
              Opened by exact revision identity. This revision is outside the currently displayed or filtered catalogue rows.
            </Notice>}
            <QuoteEvidence quote={detail.quote} selectedId={selectedId} onSelect={setSelectedId}
              onOpenSourceBatch={onOpenSourceBatch} sourceBatchState={sourceBatchState} />
          </>}
        </div>
      </div>}
    </div>
  </div>;
}
