// ═══════════════════════════════════════════════════════════════════════════
// src/tabs/MyBatchesScreen.jsx — caller-visible governed Batches (U4).
//
// ── SCREEN SPACE ──────────────────────────────────────────────────────────
// The TopBar already says "My Batches", so there is no page header here. One
// toolbar at the shared height carries search, Batch state and plant; the
// Owner filter and Clear all sit in a Filters disclosure. Governed Calculate
// and Send actions belong to the reopened Batch workspace, not this catalogue.
//
// Rows are 26px with the Batch reference frozen while the rest scrolls
// sideways. Every secondary fact — record identities, content version,
// Pricing Date, created timestamp, partial-detail notes — is reached through
// the row's own disclosure, so a row with extra detail is exactly as tall as
// one without. Provenance and the legend are stated once in the footer, not
// repeated on every row.
//
// Read-only with two hand-offs: reopen the current Batch in Batch Builder, and
// open the linked immutable Quote evidence. Neither invents a record.
// ═══════════════════════════════════════════════════════════════════════════
import { Fragment, useEffect, useMemo, useState } from "react";
import { apiFetch } from "../lib/apiClient.js";
import { U4_BATCH_CATALOGUE_ILLUSTRATION, searchableBatchText } from "../lib/batchCatalogueModel.js";
import { classifyResponse } from "../lib/backendError.js";
import { useAppState } from "../state/AppStateContext.js";
import { AccessDeniedState, EmptyState, LoadingState } from "../ui/appStates.jsx";
import { LifecycleBadge, PermanentCode, ProvenanceTag } from "../ui/dataDisplay.jsx";
import { PanelFocusToggle, RowDisclosure, ScreenFooter } from "../ui/screenChrome.jsx";
import {
  control, denseCell, denseHead, denseTable, frozenCell, menuPanel, menuSummary, toolbar, usePanelFocus,
} from "../ui/screenStandards.js";
import { C, T, sans } from "../theme.js";

// Calculate and Send belong to the open Batch, not to this catalogue, so they
// are not offered here at all.

const COLUMNS = ["Customer Family", "Plant", "Sector", "Pricing Basis", "State", "Owner", ""];

function dateTime(value) {
  if (!value) return "Not recorded";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}

function exactIdentity(item, codeKey, nameKey, fallback) {
  if (!item) return fallback;
  return `${item[codeKey] || "No permanent code"} · ${item[nameKey] || "Unnamed"}`;
}

const rowAction = {
  padding: "1px 6px", borderRadius: 4, border: `1px solid ${C.amber}`, background: C.white,
  color: C.amberD, fontFamily: sans, fontSize: T.label, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
};

function Notice({ tone = "warn", children }) {
  const warn = tone === "warn";
  return <div role="status" style={{
    display: "flex", alignItems: "center", gap: 6, padding: "3px 10px", flexShrink: 0,
    borderBottom: `1px solid ${warn ? C.amber : C.red}55`, background: warn ? C.amberL : C.redL,
    fontSize: T.label, color: warn ? C.amberD : C.red, lineHeight: 1.35,
  }}>{children}</div>;
}

// Everything a compact row deliberately leaves out. Reached by the row's own
// chevron, so the compact row height never changes.
function rowDetail(row) {
  return [
    ["Batch identity", `#${row.id} · content v${row.content_version}`],
    ["Customer Family", `#${row.family_id}${row.customer_family ? ` · ${row.customer_family.status}` : " · details unavailable"}`],
    ["Producing Plant", `#${row.plant_id}${row.plant ? "" : " · details unavailable"}`],
    ["Batch Sector", row.sector_id == null ? "No Sector identity"
      : `#${row.sector_id}${row.sector ? "" : " · details unavailable"}`],
    ["Pricing Basis Release", row.pricing_basis_release_id == null ? "No Release identity"
      : `#${row.pricing_basis_release_id} · ${row.pricing_basis_is_deliberate ? "deliberate" : "automatic"}`
        + `${row.pricing_basis_release?.status ? ` · ${row.pricing_basis_release.status}` : ""}`],
    ["Pricing Date", row.pricing_date || "Not recorded"],
    ["Owner", `#${row.owner_user_id} · created ${dateTime(row.created_at)}`],
    ...(row.details_partial ? [["Caller-visible detail", "Partial — no hidden identity has been inferred"]] : []),
  ];
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
  const [owner, setOwner] = useState("all");
  const [expanded, setExpanded] = useState([]);
  const [opening, setOpening] = useState({ status: "idle", id: null, message: "" });
  const { focusPanel, toggleFocus, exitFocusOnEscape } = usePanelFocus();

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
  const ownerOptions = useMemo(() => [...new Map(allRows.map(row =>
    [String(row.owner_user_id), row.owner?.display_name || `User #${row.owner_user_id}`])).entries()]
    .sort((a, b) => a[1].localeCompare(b[1])), [allRows]);
  const rows = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return allRows.filter(row => {
      if (status !== "all" && row.status !== status) return false;
      if (plant !== "all" && String(row.plant_id) !== plant) return false;
      if (owner !== "all" && String(row.owner_user_id) !== owner) return false;
      return !needle || searchableBatchText(row).includes(needle);
    });
  }, [allRows, owner, plant, query, status]);

  const anyFilter = status !== "all" || plant !== "all" || owner !== "all" || Boolean(query.trim());
  const clearFilters = () => { setQuery(""); setStatus("all"); setPlant("all"); setOwner("all"); };
  const toggleRow = id => setExpanded(list =>
    list.includes(id) ? list.filter(x => x !== id) : [...list, id]);

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

  const catalogue = state.catalogue;
  const count = state.status === "ready"
    ? `${rows.length} Batch${rows.length === 1 ? "" : "es"}${rows.length !== allRows.length ? ` of ${allRows.length}` : ""}` : "—";

  return <div onKeyDown={exitFocusOnEscape} style={{ height: "100%", display: "flex", flexDirection: "column",
    fontFamily: sans, background: C.cream, minHeight: 0 }}>
    {fixtureOnly && <div className="quote-fixture-banner"><strong>U4 · FIXTURE ONLY</strong>
      Isolated My Batches illustration. No authoritative read, write or lock operation occurs.
      {onExitFixture && <button type="button" onClick={onExitFixture}>Return to sign in</button>}
    </div>}

    <div role="toolbar" aria-label="My Batches controls" style={toolbar}>
      <input type="search" aria-label="Search displayed Batches" value={query}
        placeholder="Batch, customer, plant, sector or Release"
        title="Filters the displayed bounded list in this browser. It cannot reach Batches outside the window the server returned."
        onChange={event => setQuery(event.target.value)}
        style={{ ...control, width: 232, minWidth: 140, flex: "0 1 232px" }} />
      <select aria-label="Batch state" value={status} onChange={event => setStatus(event.target.value)} style={control}>
        <option value="all">All Batch states</option>
        {statusOptions.map(value => <option key={value} value={value}>{value}</option>)}
      </select>
      <select aria-label="Producing Plant" value={plant} onChange={event => setPlant(event.target.value)} style={control}>
        <option value="all">All visible plants</option>
        {plantOptions.map(value => <option key={value.id} value={value.id}>{value.plant_code}</option>)}
      </select>
      <details style={{ position: "relative" }}>
        <summary style={menuSummary(owner !== "all")}>Filters{owner !== "all" ? " · 1" : ""} ▾</summary>
        <div style={menuPanel}>
          <label style={{ display: "grid", gap: 3, fontSize: T.label, color: C.slateL }}>Owner
            <select aria-label="Batch owner" value={owner} onChange={event => setOwner(event.target.value)} style={control}>
              <option value="all">All visible owners</option>
              {ownerOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
          </label>
          <button type="button" onClick={clearFilters} disabled={!anyFilter}
            style={{ ...control, fontSize: T.label, cursor: "pointer" }}>Clear all filters</button>
        </div>
      </details>
      <span style={{ flex: "1 1 auto" }} />
      <span style={{ fontSize: T.label, color: C.slateL, whiteSpace: "nowrap" }}>{count}</span>
      <PanelFocusToggle panel="list" noun="Batch list" focused={focusPanel === "list"} onToggle={toggleFocus} />
    </div>

    {catalogue?.results_limited && <Notice>
      Newest {catalogue.display_limit} caller-visible Batches only. Search and filters cannot reach older Batches.
    </Notice>}
    {(catalogue?.details_partial || catalogue?.denied_sections?.length > 0) && <Notice>
      <strong>Catalogue detail is partial.</strong>
      <span>
        {catalogue.denied_sections?.length ? `Denied: ${catalogue.denied_sections.join(", ")}. ` : ""}
        {catalogue.partial_sections?.length ? `Unavailable: ${catalogue.partial_sections.join(", ")}. ` : ""}
        No hidden identity has been inferred.
      </span>
    </Notice>}
    {opening.status === "fixture" && <Notice><strong>Fixture hand-off selected.</strong><span>{opening.message}</span></Notice>}
    {opening.status === "error" && <Notice tone="error"><strong>Batch could not be opened.</strong><span>{opening.message}</span></Notice>}

    <div style={{ flex: 1, minHeight: 0, overflow: "auto", background: C.white }}>
      {state.status === "loading" && <LoadingState label="Loading My Batches…" />}
      {state.status === "denied" && <AccessDeniedState reason={state.message
        || "This Batch catalogue is not available to your caller authority."} />}
      {opening.status === "denied" && <AccessDeniedState reason={opening.message} />}
      {state.status === "error" && <div style={{ padding: 12 }}>
        <div style={{ fontSize: T.title, fontWeight: 700, color: C.red, marginBottom: 6 }}>
          Batch catalogue could not be loaded</div>
        <div style={{ fontSize: T.label, color: C.slateL }}>{state.message}</div>
      </div>}
      {state.status === "ready" && (rows.length === 0
        ? <EmptyState
            title={anyFilter ? "No displayed Batch matches these filters" : "No caller-visible Batches"}
            hint={anyFilter
              ? "Clear a filter to widen the answer. Filters only search the bounded window the server returned."
              : "Empty and access-denied remain separate states. No trial Batch or fixture is created."} />
        : <table style={denseTable}>
            <thead>
              <tr>
                <th scope="col" style={{ ...denseHead, ...frozenCell(false, true) }}>Batch</th>
                {COLUMNS.map((label, i) => <th key={label || `actions-${i}`} scope="col" style={denseHead}
                  aria-label={label || "Open Batch or linked Quote evidence"}>{label}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map(row => {
                const open = expanded.includes(row.id);
                const selected = String(opening.id) === String(row.id);
                return <Fragment key={row.id}>
                  <tr style={{ height: 26, background: selected ? "#FEF3E8" : C.white }}>
                    <td style={frozenCell(selected)}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                        <RowDisclosure open={open} onToggle={() => toggleRow(row.id)}
                          label={`Recorded detail for ${row.batch_reference}`} />
                        <PermanentCode code={row.batch_reference} />
                      </span>
                    </td>
                    <td style={denseCell} title={exactIdentity(row.customer_family, "group_customer_code", "name",
                      `Family #${row.family_id} · details unavailable`)}>
                      {exactIdentity(row.customer_family, "group_customer_code", "name",
                        `Family #${row.family_id} · details unavailable`)}</td>
                    <td style={denseCell}>{exactIdentity(row.plant, "plant_code", "name",
                      `Plant #${row.plant_id} · details unavailable`)}</td>
                    <td style={denseCell}>{exactIdentity(row.sector, "sector_code", "name",
                      row.sector_id == null ? "No Batch Sector" : `Sector #${row.sector_id} · details unavailable`)}</td>
                    <td style={denseCell}>{row.pricing_basis_release?.release_name
                      || (row.pricing_basis_release_id == null ? "Unresolved"
                        : `Release #${row.pricing_basis_release_id} · details unavailable`)}</td>
                    <td style={denseCell}><LifecycleBadge status={row.status} /></td>
                    <td style={denseCell}>{row.owner?.display_name || `User #${row.owner_user_id}`}</td>
                    <td style={{ ...denseCell, textAlign: "right" }}>
                      <span style={{ display: "inline-flex", gap: 4 }}>
                        <button type="button" onClick={() => openBatch(row)} style={rowAction}
                          disabled={opening.status === "loading"}
                          title="Reopen the current governed Batch in Batch Builder">
                          {opening.status === "loading" && selected ? "Opening…" : "Open Batch"}</button>
                        <button type="button" onClick={() => openQuoteEvidence(row)} disabled={fixtureOnly}
                          style={{ ...rowAction, borderColor: C.border, color: C.slateM }}
                          title="Open the linked immutable Quote evidence">Quote evidence</button>
                      </span>
                    </td>
                  </tr>
                  {open && <tr>
                    <td colSpan={COLUMNS.length + 1} style={{ ...denseCell, whiteSpace: "normal",
                      maxWidth: "none", background: "#FBF8F3", padding: "6px 10px 8px 26px" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "4px 14px" }}>
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

    <ScreenFooter right={`${allRows.length} in the returned window · secondary detail is one row disclosure away`}>
      <ProvenanceTag kind="governed" />
      <span>Batches ·</span>
      <ProvenanceTag kind="immutable" />
      <span title="Quote evidence is frozen at Send and is never replaced by current Batch values.">
        linked Quote evidence</span>
    </ScreenFooter>
  </div>;
}
