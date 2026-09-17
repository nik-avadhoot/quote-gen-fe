// ═══════════════════════════════════════════════════════════════════════════
// src/tabs/SkuMasterScreen.jsx — governed SKU Master (U2, Canonical Amendment 02).
//
// Reads `/masters/skus` and `/masters/skus/<id>` as the authenticated caller.
// Governed editing (Canonical Amendment 04, slice 1) lives in
// ./sku/SkuGovernedActions.jsx: Propose in the list toolbar, Actions ▾ in the
// detail toolbar, a version editor, and reference controls. Each control is
// offered only to a caller holding the capability at the SKU's plant, and stays
// visible but DISABLED with its reason until the operations are activated (and
// always in the fixture preview). Location applicability and SKU Set membership
// have no control: their operations do not exist yet.
//
// ── LAYOUT ────────────────────────────────────────────────────────────────
// The TopBar already names the screen, so there is no second page header.
// ── ONE SEARCH BOX, IDENTITY ONLY ─────────────────────────────────────────
// The box matches identity and nothing else: Plant Item Code, Item Name, Item
// Short Name, Customer Item Code, SoftComp Code and the owning Customer's name.
// Every word must match somewhere, so words narrow. Lifecycle, plant and every
// specification field keep their own controls. The server searches in the
// database, caller-scoped, and reports which of the seven it ACTUALLY reached;
// a field with no storage yet or one this caller may not read is named on the
// screen rather than quietly missing rows.
//
// ── COLUMN-HEADER FILTERS ─────────────────────────────────────────────────
// Every filterable column has a funnel in its header (src/lib/skuColumnFilters.js).
// Filters are applied by the server, in the database, inside the caller's
// plants; a version column matches the SKU's latest version; a column whose
// storage is pending, which is derived, or whose master the caller may not read
// shows a disabled funnel with that reason. Lifecycle and portfolio share one
// state with their toolbar controls. Filter state is screen state (ruled).
//
// Left: one toolbar (search, lifecycle, plant, Filters ▾, Columns ▾, count,
// refresh, expand — the Batch Builder toolbar idiom) above SKUs row by row with
// the CDM-43 fields in SPEC sheet groups and sheet order, code and short name
// frozen. Right: a slim header (selected code, split presets, expand) above one
// SKU in depth. The divider opens at 50 : 50 and can be dragged, or moved with
// the arrow keys, between 25 % and 75 %; double-click restores 50 : 50.
//
// Each panel has an expand icon, like a browser pane: it fills the SKU Master
// area inside the app window, hides the other panel and the divider, and
// collapses the app navigation (the Batch Builder focus-mode precedent). The
// collapse icon or Escape restores both panels, the split and the navigation.
// The browser Fullscreen API is deliberately not used.
//
// ── HONEST STATES ─────────────────────────────────────────────────────────
// loading, access denied (403 — never an empty list), error with retry,
// genuinely empty, and a read timestamp on the refresh control. Every field goes
// through one model rule (specFieldCell): a blank reads "Not recorded", zero
// reads 0, a section the caller may not read says so, a failed optional read
// says "Details unavailable", and a field whose storage is not activated yet
// says it is pending — never a guessed or current-master value.
//
// ── GOVERNED VERSUS LOCAL ─────────────────────────────────────────────────
// Only governed SKUs appear. Item codes and printing metadata typed into
// Costing or Batch Builder live in this browser and are not SKU Master records;
// the list footer says so with both provenance tags.
//
// `fixtureOnly` renders labelled fixture responses without any request
// (development preview from the sign-in screen).
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../AuthContext.jsx";
import { useAppState } from "../state/AppStateContext.js";
import { apiFetch } from "../lib/apiClient.js";
import { classifyResponse } from "../lib/backendError.js";
import { SKU_FIXTURE_DETAILS, fixtureSkuCatalogue } from "../lib/skuMasterFixture.js";
import {
  PRICING_PORTFOLIOS, PRINT_TECHNOLOGIES, PRODUCTION_BACKLOG, PRODUCTION_BACKLOG_COUNT,
  SKU_SPEC_FIELD_COUNT, SKU_SPEC_GROUPS,
} from "../lib/skuSpecRegistry.js";
import {
  APPLICABILITY_SCOPE_LABELS, PENDING, PRICING_PORTFOLIO_NOTE, REFERENCE_KIND_LABELS, SKU_STATUSES, SPLIT_DEFAULT,
  adoptionLabel,
  applicabilityLocationLabel, constructionLabel, customerLabel, familyLabel, gridCellText,
  normaliseSkuCatalogue, panelLayout, plantItemCodeLabel, plantLabel, replacementLabel, schemaPendingNotice,
  searchCoverageNotice, searchScanNotice, searchScopeHint, skuCatalogueQuery, skuEmptyState, skuPlantScope,
  skuSearchValidation, skuSetGroups, skuSetView, specFieldCell,
  specRowFromCatalogue, specRowFromDetail, visibilityText,
} from "../lib/skuMasterModel.js";
import {
  COLUMN_FILTERS, COLUMN_FILTER_MAX, COLUMN_FILTER_OP_LABELS, columnFilterAvailability, columnFilterScanNotice,
  columnFilterSummary, columnFilterValidation, sharedFilterFromState, sharedStateFromFilter,
} from "../lib/skuColumnFilters.js";
import { skuOpsAuthority, skuOpsMode, skuProposalPlants } from "../lib/skuGovernedOps.js";
import { SkuActionsMenu, SkuProposeForm, SkuReferenceControls, SkuVersionEditor } from "./sku/SkuGovernedActions.jsx";
import { AccessDeniedState, EmptyState, LoadingState } from "../ui/appStates.jsx";
import { LifecycleBadge, PermanentCode, ProvenanceTag, SummaryRow } from "../ui/dataDisplay.jsx";
import { RefreshIcon } from "../ui/icons.jsx";
import { PanelDivider, PanelFocusToggle } from "../ui/screenChrome.jsx";
import {
  control, iconButton, menuPanel, menuSummary, segment, toolbar, usePanelFocus, useSplitPanels,
} from "../ui/screenStandards.js";
import { C, T, mono, sans } from "../theme.js";

const EMPTY_FILTERS = { plant: "", status: "", q: "", portfolio: "", familyId: "", partyId: "", columns: {} };
const FIELD_BY_KEY = Object.fromEntries(SKU_SPEC_GROUPS.flatMap(g => g.fields.map(f => [f.key, f])));
const LABEL_BY_API_FIELD = Object.fromEntries(Object.entries(COLUMN_FILTERS)
  .filter(([, s]) => s.field).map(([key, s]) => [s.field, FIELD_BY_KEY[key]?.label]));
// Frozen identity, in this order and always leftmost: the Plant Item Code
// (SPEC D) first, then Item Short Name (Product Owner, 2026-09-16).
const FROZEN = ["D", "C"];
const GROUP_TONE = {
  identity: { band: C.slateM, ink: C.white, soft: "#F3F1EC", softInk: C.slateM },
  customer: { band: C.greenL, ink: C.green, soft: "#F4FAF6", softInk: C.green },
  production: { band: C.amberL, ink: C.amberD, soft: "#FFF9F2", softInk: C.amberD },
  governance: { band: C.paper, ink: C.slateM, soft: "#F8F4EE", softInk: C.slateM },
};
const STATE_INK = { value: C.slate, na: C.slateL, blank: C.slateL, hidden: C.slateL, unavailable: C.slateL, pending: C.amberD };
const LIFECYCLE_INK = { proposed: C.amberD, active: C.green, discontinued: C.red };
const LAYERS = [["Top", "AI", "AJ"], ["Flute-1", "AK", "AL"], ["Back-1", "AM", "AN"], ["Flute-2", "AO", "AP"], ["Back-2", "AQ", "AR"]];
// Toolbar height, controls, disclosures and icon buttons are the shared
// screen-space standard (src/ui/screenChrome.jsx), not this screen's own.

const isPlain = state => state === "value" || state === "na";
const fieldTag = f => f.origin === "new" ? "NEW" : f.origin === "app" ? "APP" : f.authority ? "CON" : "";

function Notice({ children, tone = "muted" }) {
  return <div style={{ fontSize: T.label, color: tone === "warn" ? C.amberD : C.slateL, fontFamily: sans, lineHeight: 1.4 }}>{children}</div>;
}

function Fact({ label, value, honest }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: T.micro, fontWeight: 800, letterSpacing: "0.05em", color: C.slateL, textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: T.body, color: honest ? C.slateL : C.slate, fontStyle: honest ? "italic" : "normal", overflowWrap: "anywhere" }}>{value}</div>
    </div>
  );
}

export default function SkuMasterScreen({ fixtureOnly = false, onExitFixture }) {
  const { isActive, profile } = useAuth();
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [searchDraft, setSearchDraft] = useState("");
  const [catalogue, setCatalogue] = useState({ status: "loading" });
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState({ status: "idle" });
  const [readAt, setReadAt] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  // Filter choices are learned from rows actually returned, so no extra master
  // read is issued and no option names a record the caller has not been shown.
  const [knownFamilies, setKnownFamilies] = useState({});
  const [knownCustomers, setKnownCustomers] = useState({});
  const [hiddenGroups, setHiddenGroups] = useState([]);
  const [groupBySet, setGroupBySet] = useState(false);
  const [openFilter, setOpenFilter] = useState(null); // { key, anchor } | null
  const { showToast } = useAppState();
  const [editPlan, setEditPlan] = useState(null);   // the version editor's plan, or null
  const [proposing, setProposing] = useState(false);
  const { focusPanel, toggleFocus, exitFocusOnEscape } = usePanelFocus();
  const { split, setSplit, dragging, startDrag, nudgeSplit, bodyRef } = useSplitPanels(SPLIT_DEFAULT);

  const scope = fixtureOnly ? ["NAG", "PUN"] : skuPlantScope(profile);
  const query = skuCatalogueQuery(filters);
  const searchError = skuSearchValidation(searchDraft);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setCatalogue(c => ({ ...c, status: "loading" }));
      let data;
      if (fixtureOnly) {
        data = fixtureSkuCatalogue(filters);
      } else {
        if (!isActive) return;
        const resp = await apiFetch(query);
        if (cancelled) return;
        const verdict = classifyResponse(resp);
        if (verdict.kind === "access-denied") { setCatalogue({ status: "denied", message: verdict.message }); return; }
        if (verdict.kind !== "ok") { setCatalogue({ status: "error", message: verdict.message }); return; }
        data = resp.data;
      }
      if (cancelled) return;
      const normal = normaliseSkuCatalogue(data);
      setCatalogue({ status: "ready", ...normal });
      setReadAt(new Date());
      setKnownFamilies(prev => {
        const next = { ...prev };
        for (const row of normal.skus) if (row.family) next[row.family.id] = row.family;
        return next;
      });
      setKnownCustomers(prev => {
        const next = { ...prev };
        for (const row of normal.skus) if (row.customer) next[row.customer.id] = row.customer;
        return next;
      });
    })();
    return () => { cancelled = true; };
  // `filters` is represented by `query`; the fixture path reads the same object.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fixtureOnly, isActive, query, reloadKey]);

  useEffect(() => {
    if (selectedId == null) return; // no selection renders the idle prompt directly
    let cancelled = false;
    (async () => {
      setDetail({ status: "loading" });
      let data;
      if (fixtureOnly) {
        data = SKU_FIXTURE_DETAILS[selectedId];
        if (!data) { setDetail({ status: "missing" }); return; }
      } else {
        const resp = await apiFetch(`/masters/skus/${selectedId}`);
        if (cancelled) return;
        if (resp.status === 404) { setDetail({ status: "missing" }); return; }
        const verdict = classifyResponse(resp);
        if (verdict.kind === "access-denied") { setDetail({ status: "denied", message: verdict.message }); return; }
        if (verdict.kind !== "ok") { setDetail({ status: "error", message: verdict.message }); return; }
        data = resp.data;
      }
      if (cancelled) return;
      setDetail({ status: "ready", data });
    })();
    return () => { cancelled = true; };
  }, [fixtureOnly, selectedId, reloadKey]);

  const familyOptions = useMemo(() => Object.values(knownFamilies)
    .sort((a, b) => a.name.localeCompare(b.name)), [knownFamilies]);
  const customerOptions = useMemo(() => Object.values(knownCustomers)
    .sort((a, b) => a.display_name.localeCompare(b.display_name)), [knownCustomers]);
  const gridRows = useMemo(() => (catalogue.skus || []).map(specRowFromCatalogue), [catalogue.skus]);
  const visibleGroups = SKU_SPEC_GROUPS.filter(g => g.id === "identity" || !hiddenGroups.includes(g.id));

  const setFilter = (key, value) => setFilters(f => ({ ...f, [key]: value }));
  const applySearch = e => { e.preventDefault(); if (!searchError) setFilter("q", searchDraft.trim()); };
  const clearFilters = () => { setFilters(EMPTY_FILTERS); setSearchDraft(""); setOpenFilter(null); };
  // Lifecycle and portfolio live in their shared toolbar state; every other
  // column lives in `filters.columns`. Either way the server applies it.
  const columnFilterOf = key => COLUMN_FILTERS[key]?.shared
    ? sharedFilterFromState(filters[COLUMN_FILTERS[key].shared]) : filters.columns[key] || null;
  const setColumnFilter = (key, filter) => {
    const shared = COLUMN_FILTERS[key]?.shared;
    if (shared) setFilter(shared, sharedStateFromFilter(filter));
    else setFilters(f => {
      const columns = { ...f.columns };
      if (filter) columns[key] = filter; else delete columns[key];
      return { ...f, columns };
    });
    setOpenFilter(null);
  };
  const activeColumnKeys = Object.keys(COLUMN_FILTERS).filter(key => columnFilterOf(key));
  const columnLimitReached = Object.keys(filters.columns).length
    + [filters.status, filters.portfolio].filter(v => (v || "").includes("|")).length >= COLUMN_FILTER_MAX;
  const toggleGroup = id => setHiddenGroups(h => h.includes(id) ? h.filter(x => x !== id) : [...h, id]);

  const fixtureBanner = fixtureOnly && (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 12px", background: C.amberL,
      borderBottom: `1px dashed ${C.amber}`, fontFamily: sans }}>
      <strong style={{ fontSize: T.label, color: C.amberD, letterSpacing: "0.05em" }}>U2 · FIXTURE ONLY</strong>
      <span style={{ fontSize: T.label, color: C.amberD }}>
        Isolated SKU Master illustration. No authoritative read or write occurs.
      </span>
      {onExitFixture && <button type="button" onClick={onExitFixture}
        style={{ ...control, height: 22, marginLeft: "auto", fontSize: T.label }}>Return to sign in</button>}
    </div>
  );

  if (catalogue.status === "denied") {
    return <AccessDeniedState reason={catalogue.message
      || "You do not have access to the SKU Master. This requires plant_access at a Producing Plant."} />;
  }

  const customerVisibility = catalogue.customerVisibility;
  const partyFiltersVisible = customerVisibility === "visible";
  const gridCtx = { visibility: catalogue.visibility || {}, schemaPending: catalogue.schemaPending || {} };
  const pendingNotice = schemaPendingNotice(catalogue.schemaPending);
  // A pending portfolio cannot be filtered on: the column does not exist yet,
  // and the route refuses rather than quietly answering a different question.
  const portfolioPending = catalogue.schemaPending?.pricing_portfolio === true;
  // What the one identity box actually reached on this read, in words.
  const searchCoverage = searchCoverageNotice(catalogue.search);
  const searchScan = searchScanNotice(catalogue.search);
  const layout = panelLayout(split, focusPanel);
  const fieldCols = focusPanel === "detail" ? 3 : split >= 62 ? 1 : 2;
  const columnKeysInMenu = activeColumnKeys.filter(key => !COLUMN_FILTERS[key].shared);
  const moreFilters = [filters.portfolio, filters.familyId, filters.partyId].filter(Boolean).length + columnKeysInMenu.length;
  const anyFilter = [filters.plant, filters.status, filters.q, filters.portfolio, filters.familyId, filters.partyId]
    .some(Boolean) || columnKeysInMenu.length > 0;
  const columnSummaries = activeColumnKeys.map(key => columnFilterSummary(FIELD_BY_KEY[key]?.label || key, columnFilterOf(key)));
  const filterScan = columnFilterScanNotice(catalogue.columnFilters, field => LABEL_BY_API_FIELD[field]);
  const filterCtx = { visibility: catalogue.visibility || {}, schemaPending: catalogue.schemaPending || {} };
  const openColumn = openFilter && FIELD_BY_KEY[openFilter.key];
  const selectedCode = selectedId == null ? null
    : plantItemCodeLabel(gridRows.find(r => r.id === selectedId)?.plant_item_code ?? detail.data?.sku?.plant_item_code);
  // Governed editing: the authority is read at the SKU's OWN plant. The fixture
  // shows every control, disabled and labelled, and never writes.
  const detailData = detail.status === "ready" ? detail.data : null;
  const detailAuthority = fixtureOnly ? { manage: true, propose: true }
    : skuOpsAuthority(profile, detailData?.sku?.plant?.plant_code);
  const detailMode = skuOpsMode({ fixtureOnly, schemaPending: detailData?.schema_pending || {}, authority: detailAuthority });
  const proposalPlants = fixtureOnly ? scope : skuProposalPlants(profile, scope);
  const proposalMode = skuOpsMode({ fixtureOnly, schemaPending: catalogue.schemaPending || {},
    authority: { propose: proposalPlants.length > 0 } });
  const refreshAfterWrite = () => { setEditPlan(null); setReloadKey(k => k + 1); };
  const skuCount = catalogue.status === "ready"
    ? `${gridRows.length} SKU${gridRows.length === 1 ? "" : "s"}${catalogue.truncated ? ` · first ${catalogue.limit}` : ""}` : "—";

  return (
    <div onKeyDown={exitFocusOnEscape} style={{ height: "100%", display: "flex", flexDirection: "column", fontFamily: sans, background: C.cream }}>
      {fixtureBanner}
      {pendingNotice && <div style={{ padding: "4px 12px", background: C.amberL, borderBottom: `1px solid ${C.amber}55` }}>
        <Notice tone="warn">{pendingNotice}</Notice></div>}

      <div ref={bodyRef} style={{ flex: 1, display: "flex", minHeight: 0 }}>
        {layout.showList && <div aria-label="SKU list" style={{ width: layout.listWidth, flex: layout.showDetail ? "0 0 auto" : "1 1 auto",
          minWidth: 0, display: "flex", flexDirection: "column", background: C.white }}>
          <div role="toolbar" aria-label="SKU list controls" style={toolbar}>
            <form onSubmit={applySearch} style={{ display: "contents" }}>
              <input type="search" aria-label="Search SKU identity" placeholder="Code, name or customer… ↵" value={searchDraft}
                title={searchError || searchScopeHint()}
                onChange={e => setSearchDraft(e.target.value)}
                style={{ ...control, width: 232, minWidth: 140, flex: "0 1 232px", fontFamily: mono,
                  borderColor: searchError ? C.red : searchCoverage ? C.amber : C.border }} />
            </form>
            <select aria-label="Lifecycle" value={filters.status} onChange={e => setFilter("status", e.target.value)} style={control}>
              <option value="">All lifecycles</option>
              {filters.status.includes("|") && <option value={filters.status}>{filters.status.split("|").join(" + ")}</option>}
              {SKU_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select aria-label="Plant" value={filters.plant} onChange={e => setFilter("plant", e.target.value)} style={control}>
              <option value="">All plants</option>
              {scope.map(code => <option key={code} value={code}>{code}</option>)}
            </select>
            <details style={{ position: "relative" }}>
              <summary style={menuSummary(moreFilters > 0)}>Filters{moreFilters ? ` · ${moreFilters}` : ""} ▾</summary>
              <div style={menuPanel}>
                <label style={{ display: "grid", gap: 3, fontSize: T.label, color: C.slateL }}>Pricing Portfolio
                <select aria-label="Pricing Portfolio" value={filters.portfolio} disabled={portfolioPending}
                  title={portfolioPending ? PENDING : PRICING_PORTFOLIO_NOTE}
                  onChange={e => setFilter("portfolio", e.target.value)} style={control}>
                  <option value="">{portfolioPending ? "Portfolio pending" : "All portfolios"}</option>
                  {filters.portfolio.includes("|") && <option value={filters.portfolio}>{filters.portfolio.split("|").join(" + ")}</option>}
                  {!portfolioPending && PRICING_PORTFOLIOS.map(value =>
                    <option key={value} value={value}>{value}</option>)}
                </select>
                <span style={{ fontSize: T.micro, color: C.slateL, lineHeight: 1.35 }}>{PRICING_PORTFOLIO_NOTE}</span>
              </label>
              <label style={{ display: "grid", gap: 3, fontSize: T.label, color: C.slateL }}>Customer Family
                  <select aria-label="Customer Family" value={filters.familyId} disabled={!partyFiltersVisible}
                    title={partyFiltersVisible ? "Families seen in results so far" : visibilityText(customerVisibility) || ""}
                    onChange={e => setFilter("familyId", e.target.value)} style={control}>
                    <option value="">{partyFiltersVisible ? "All Families" : "Family filter unavailable"}</option>
                    {familyOptions.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                </label>
                <label style={{ display: "grid", gap: 3, fontSize: T.label, color: C.slateL }}>Customer / Prospect
                  <select aria-label="Customer" value={filters.partyId} disabled={!partyFiltersVisible}
                    title={partyFiltersVisible ? "Customers seen in results so far" : visibilityText(customerVisibility) || ""}
                    onChange={e => setFilter("partyId", e.target.value)} style={control}>
                    <option value="">{partyFiltersVisible ? "All Customers / Prospects" : "Customer filter unavailable"}</option>
                    {customerOptions.map(p => <option key={p.id} value={p.id}>{p.display_name}</option>)}
                  </select>
                </label>
                <div style={{ display: "grid", gap: 4, borderTop: `1px solid ${C.border}`, paddingTop: 7 }}>
                  <span style={{ fontSize: T.micro, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: C.slateL }}>
                    Column filters · from the headers</span>
                  {columnKeysInMenu.length === 0 && <span style={{ fontSize: T.label, color: C.slateL }}>
                    None. Use the funnel in a column header.</span>}
                  {columnKeysInMenu.map(key => <span key={key} style={{ display: "flex", alignItems: "center", gap: 6,
                    fontSize: T.label, color: C.amberD }}>
                    <span style={{ flex: 1, minWidth: 0 }}>{columnFilterSummary(FIELD_BY_KEY[key]?.label || key, filters.columns[key])}</span>
                    <button type="button" aria-label={`Remove the ${FIELD_BY_KEY[key]?.label} filter`} onClick={() => setColumnFilter(key, null)}
                      style={{ border: 0, background: "transparent", color: C.red, cursor: "pointer", fontSize: T.title, lineHeight: 1 }}>×</button>
                  </span>)}
                </div>
                <button type="button" onClick={clearFilters} disabled={!anyFilter && !searchDraft}
                  style={{ ...control, fontSize: T.label, cursor: "pointer" }}>Clear all filters</button>
              </div>
            </details>
            <details style={{ position: "relative" }}>
              <summary style={menuSummary(hiddenGroups.length > 0 || groupBySet)}>
                Columns{hiddenGroups.length ? ` · ${hiddenGroups.length} hidden` : ""} ▾</summary>
              <div style={menuPanel}>
                <div style={{ fontSize: T.micro, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: C.slateL }}>
                  SPEC groups · identity always shown</div>
                {SKU_SPEC_GROUPS.filter(g => g.id !== "identity").map(g => (
                  <label key={g.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: T.body, color: C.slateM, cursor: "pointer" }}>
                    <input type="checkbox" checked={!hiddenGroups.includes(g.id)} onChange={() => toggleGroup(g.id)}
                      style={{ accentColor: C.amber }} />
                    <span style={{ flex: 1 }}>{g.label}</span>
                    <span style={{ fontSize: T.label, color: C.slateL }}>{g.fields.length}</span>
                  </label>
                ))}
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: T.body, color: C.slateM, cursor: "pointer",
                  borderTop: `1px solid ${C.border}`, paddingTop: 7 }}>
                  <input type="checkbox" checked={groupBySet} onChange={() => setGroupBySet(v => !v)} style={{ accentColor: C.green }} />
                  Group rows by SKU Set
                </label>
              </div>
            </details>
            {proposalMode.state !== "none" && <button type="button" onClick={() => setProposing(true)}
              title={proposalMode.state === "live" ? "Propose a SKU at a plant you may propose at" : proposalMode.reason}
              style={{ ...control, fontWeight: 700, color: C.green, cursor: "pointer", whiteSpace: "nowrap" }}>+ Propose</button>}
            <span style={{ flex: "1 1 auto" }} />
            <span style={{ fontSize: T.label, color: C.slateL, whiteSpace: "nowrap" }}>{skuCount}</span>
            <button type="button" onClick={() => setReloadKey(k => k + 1)} aria-label="Refresh SKU list"
              title={`Refresh · read at ${readAt ? readAt.toLocaleTimeString() : "—"}`} style={iconButton(false)}>
              <RefreshIcon size={14} /></button>
            <PanelFocusToggle panel="list" noun="list" focused={focusPanel === "list"} onToggle={toggleFocus} />
          </div>

          {filterScan && (
            <div role="status" style={{ display: "flex", alignItems: "center", gap: 6, padding: "3px 10px", flexShrink: 0,
              borderBottom: `1px solid ${C.amber}55`, background: C.amberL, fontSize: T.label, color: C.amberD, lineHeight: 1.35 }}>
              <span style={{ fontWeight: 800, letterSpacing: "0.05em", textTransform: "uppercase", fontSize: T.micro, whiteSpace: "nowrap" }}>
                Filter reach</span>
              <span style={{ minWidth: 0 }}>{filterScan}</span>
            </div>
          )}
          {(searchCoverage || searchScan) && (
            <div role="status" style={{ display: "flex", alignItems: "center", gap: 6, padding: "3px 10px", flexShrink: 0,
              borderBottom: `1px solid ${C.amber}55`, background: C.amberL, fontSize: T.label, color: C.amberD,
              lineHeight: 1.35 }}>
              <span style={{ fontWeight: 800, letterSpacing: "0.05em", textTransform: "uppercase",
                fontSize: T.micro, whiteSpace: "nowrap" }}>Search reach</span>
              <span style={{ minWidth: 0 }}>{[searchCoverage, searchScan].filter(Boolean).join(" ")}</span>
            </div>
          )}

          <div style={{ flex: 1, minHeight: 0, overflow: "auto", background: C.white }}>
            {catalogue.status === "loading" && <LoadingState label="Loading SKUs…" />}
            {catalogue.status === "error" && (
              <div style={{ padding: 12 }}>
                <div style={{ fontSize: T.title, fontWeight: 700, color: C.red, marginBottom: 6 }}>Could not load the SKU Master</div>
                <Notice>{catalogue.message || "The request did not succeed."}</Notice>
                <button type="button" onClick={() => setReloadKey(k => k + 1)} style={{ ...control, marginTop: 8 }}>Retry</button>
              </div>
            )}
            {catalogue.status === "ready" && (gridRows.length === 0
              ? <EmptyState {...skuEmptyState({ search: catalogue.search, anyFilter, columnSummaries,
                  plantScope: fixtureOnly ? scope : catalogue.plantScope })} />
              : <SpecGrid rows={gridRows} ctx={gridCtx} groups={visibleGroups} selectedId={selectedId}
                  onSelect={setSelectedId} groupBySet={groupBySet}
                  filterOf={columnFilterOf} availability={key => columnFilterAvailability(key, filterCtx)}
                  openFilterKey={openFilter?.key} limitReached={columnLimitReached}
                  onOpenFilter={(key, anchor) => setOpenFilter(o => o?.key === key ? null : { key, anchor })} />)}
            {openColumn && <ColumnFilterMenu key={openFilter.key} column={openColumn} anchor={openFilter.anchor}
              filter={columnFilterOf(openFilter.key)} onClose={() => setOpenFilter(null)}
              onApply={draft => setColumnFilter(openFilter.key, draft)} onClear={() => setColumnFilter(openFilter.key, null)} />}
          </div>
          <div style={{ height: 24, flex: "0 0 24px", display: "flex", alignItems: "center", gap: 6, padding: "0 10px",
            borderTop: `1px solid ${C.border}`, background: "#FBF8F3", fontSize: T.label, color: C.slateL, overflow: "hidden", whiteSpace: "nowrap" }}>
            <ProvenanceTag kind="governed" />
            <span>SKUs only ·</span>
            <ProvenanceTag kind="local" />
            <span title="Item codes and printing details typed in Costing or Batch Builder stay in this browser and are not SKU Master records.">
              Costing / Batch Builder codes not shown</span>
            <span style={{ marginLeft: "auto" }}>{SKU_SPEC_FIELD_COUNT} fields · Blank = not recorded · CON · NEW · APP</span>
          </div>
        </div>}

        {layout.showDivider && <PanelDivider label="Resize SKU list and SKU detail" split={split} dragging={dragging}
          onPointerDown={startDrag} onReset={() => setSplit(SPLIT_DEFAULT)} onKeyDown={nudgeSplit} />}

        {layout.showDetail && <div aria-label="SKU detail" style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", background: C.cream }}>
          <div role="toolbar" aria-label="SKU detail controls" style={{ ...toolbar, flexWrap: "nowrap" }}>
            <span style={{ fontSize: T.micro, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: C.slateL }}>Detail</span>
            <span style={{ fontFamily: mono, fontSize: T.body, fontWeight: 700, color: selectedCode ? C.slate : C.slateL,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>
              {selectedCode || "No SKU selected"}</span>
            {detailData && <SkuActionsMenu data={detailData} rows={catalogue.skus || []} authority={detailAuthority}
              mode={detailMode} showToast={showToast} onChanged={refreshAfterWrite} onEditVersion={setEditPlan} />}
            <span style={{ flex: "1 1 auto" }} />
            {!focusPanel && (
              <div role="group" aria-label="Split" title="Split between list and detail · or drag the divider"
                style={{ display: "inline-flex", border: `1px solid ${C.border}`, borderRadius: 5, overflow: "hidden", flexShrink: 0 }}>
                {[[35, "35:65"], [50, "50:50"], [65, "65:35"]].map(([v, label]) => (
                  <button key={label} type="button" onClick={() => setSplit(v)} aria-pressed={split === v} style={segment(split === v)}>{label}</button>
                ))}
              </div>
            )}
            {focusPanel === "detail" && <span style={{ fontSize: T.label, color: C.slateL, whiteSpace: "nowrap" }}>Esc to restore</span>}
            <PanelFocusToggle panel="detail" noun="detail" focused={focusPanel === "detail"} onToggle={toggleFocus}
              disabled={selectedId == null} disabledTitle="Select a SKU first" />
          </div>
          <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "12px 14px 56px" }}>
            {selectedId == null && <EmptyState title="Select a SKU" hint="Its identity, quote and costing fields, SKU Set, versions, references and Location applicability open here." />}
            {selectedId != null && detail.status === "loading" && <LoadingState label="Loading SKU…" />}
            {selectedId != null && detail.status === "missing" && <EmptyState title="This SKU is not visible to you." hint="It may not exist, or it belongs to a plant outside your access." />}
            {selectedId != null && detail.status === "denied" && <AccessDeniedState reason={detail.message || "You do not have access to this SKU."} />}
            {selectedId != null && detail.status === "error" && (
              <div>
                <div style={{ fontSize: T.title, fontWeight: 700, color: C.red, marginBottom: 6 }}>Could not load this SKU</div>
                <Notice>{detail.message || "The request did not succeed."}</Notice>
                <button type="button" onClick={() => setReloadKey(k => k + 1)} style={{ ...control, marginTop: 8 }}>Retry</button>
              </div>
            )}
            {selectedId != null && detail.status === "ready" &&
              <SkuDeepDive data={detail.data} fieldCols={fieldCols} onSelectSku={setSelectedId}
                authority={detailAuthority} mode={detailMode} showToast={showToast} onChanged={refreshAfterWrite} />}
          </div>
        </div>}
      </div>
      {editPlan && detailData && detailMode.state === "live" && <SkuVersionEditor data={detailData} plan={editPlan}
        showToast={showToast} onClose={() => setEditPlan(null)} onSaved={refreshAfterWrite} />}
      {proposing && <SkuProposeForm plants={proposalPlants} profile={profile} mode={proposalMode} showToast={showToast}
        onClose={() => setProposing(false)}
        onSaved={id => { setProposing(false); setSelectedId(id); setReloadKey(k => k + 1); }} />}
    </div>
  );
}


// ── Column-header filter menu ──────────────────────────────────────────────
// Opens under the header's funnel, positioned in the viewport so the grid's
// clipped header cells cannot cut it off. Its draft is local until Apply, so a
// half-typed value never issues a read.
const FUNNEL = <svg width="9" height="9" viewBox="0 0 10 10" aria-hidden="true">
  <path d="M0.5 1h9L6 5.2V9L4 8V5.2z" fill="currentColor" /></svg>;

function ColumnFilterMenu({ column, filter, anchor, onApply, onClear, onClose }) {
  const spec = COLUMN_FILTERS[column.key];
  const [op, setOp] = useState(filter?.op || spec.ops[0]);
  const [textValue, setTextValue] = useState(filter?.op === "contains" ? filter.value : "");
  const [range, setRange] = useState(filter?.op === "between" ? filter.value.map(v => v ?? "") : ["", ""]);
  const [picked, setPicked] = useState(filter?.op === "in" ? filter.value : []);
  const ref = useRef(null);
  const draft = { op, value: op === "contains" ? textValue : op === "between" ? range : op === "in" ? picked : null };
  const error = columnFilterValidation(column.key, draft);

  useEffect(() => {
    const away = e => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [onClose]);

  const left = Math.max(8, Math.min(anchor.left, window.innerWidth - 268));
  const apply = e => { e.preventDefault(); if (!error) onApply(draft); };
  return (
    <form ref={ref} role="dialog" aria-label={`Filter ${column.label}`} onSubmit={apply}
      onKeyDown={e => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } }}
      style={{ ...menuPanel, position: "fixed", left, top: anchor.bottom + 4, width: 260, minWidth: 0, zIndex: 60 }}>
      <div style={{ fontSize: T.label, fontWeight: 800, color: C.slateM }}>
        {column.label}<span style={{ fontWeight: 400, color: C.slateL }}> · SPEC {column.sheet || column.key}</span></div>
      <select aria-label="Operator" value={op} onChange={e => setOp(e.target.value)} style={control}>
        {spec.ops.map(o => <option key={o} value={o}>{COLUMN_FILTER_OP_LABELS[o]}</option>)}
      </select>
      {op === "contains" && <input autoFocus aria-label="Contains" value={textValue}
        onChange={e => setTextValue(e.target.value)} style={{ ...control, fontFamily: mono }} />}
      {op === "between" && <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <input autoFocus aria-label="Minimum" inputMode="decimal" placeholder="min" value={range[0]}
          onChange={e => setRange([e.target.value, range[1]])} style={{ ...control, width: "100%", fontFamily: mono }} />
        <span style={{ fontSize: T.body, color: C.slateL }}>–</span>
        <input aria-label="Maximum" inputMode="decimal" placeholder="max" value={range[1]}
          onChange={e => setRange([range[0], e.target.value])} style={{ ...control, width: "100%", fontFamily: mono }} />
      </span>}
      {op === "in" && <div style={{ display: "grid", gap: 4 }}>
        {spec.values.map(v => <label key={v} style={{ display: "flex", gap: 6, alignItems: "center", fontSize: T.body, color: C.slateM }}>
          <input type="checkbox" checked={picked.includes(v)} style={{ accentColor: C.amber }}
            onChange={() => setPicked(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v])} />{v}</label>)}
      </div>}
      {spec.pending === "quote_fields" || spec.gate === "construction" || ["AE", "AF", "AG", "BH"].includes(column.key)
        ? <span style={{ fontSize: T.micro, color: C.slateL, lineHeight: 1.35 }}>Matches each SKU's latest version.</span> : null}
      {(op === "blank") && <span style={{ fontSize: T.micro, color: C.slateL, lineHeight: 1.35 }}>
        Blank is not zero: a recorded 0 does not match.</span>}
      {error && op !== "blank" && op !== "not_blank" && <span role="alert" style={{ fontSize: T.label, color: C.red }}>{error}</span>}
      <span style={{ display: "flex", gap: 6 }}>
        <button type="submit" disabled={!!error} style={{ ...control, flex: 1, fontWeight: 700, border: "none",
          background: error ? "#CCC" : C.amber, color: C.white, cursor: error ? "not-allowed" : "pointer" }}>Apply</button>
        <button type="button" onClick={onClear} disabled={!filter} style={{ ...control, cursor: "pointer" }}>Clear</button>
      </span>
    </form>
  );
}

function SpecGrid({ rows, ctx, groups, selectedId, onSelect, groupBySet, filterOf, availability, openFilterKey,
  limitReached, onOpenFilter }) {
  const registryCols = groups.flatMap(g => g.fields.map(f => ({ ...f, group: g })));
  // Frozen columns lead, in FROZEN order, so "first frozen" is also "first".
  const cols = [...FROZEN.map(key => registryCols.find(c => c.key === key)).filter(Boolean),
    ...registryCols.filter(c => !FROZEN.includes(c.key))];
  const width = cols.reduce((t, c) => t + c.width, 0);
  const lefts = {};
  let offset = 0;
  for (const c of cols) if (FROZEN.includes(c.key)) { lefts[c.key] = offset; offset += c.width; }
  const lastFrozen = FROZEN[FROZEN.length - 1];
  const stick = (c, z) => FROZEN.includes(c.key) ? { position: "sticky", left: lefts[c.key], zIndex: z } : {};
  const edge = c => c.key === lastFrozen ? "#C9BCAA" : "#F0EAE0";

  const segments = [];
  for (const c of cols) {
    const frozen = FROZEN.includes(c.key);
    const prev = segments[segments.length - 1];
    if (!frozen && prev && !prev.frozen && prev.groupId === c.group.id) { prev.width += c.width; continue; }
    const first = !segments.some(s => s.groupId === c.group.id && !s.frozen);
    segments.push({ key: `${c.group.id}-${c.key}`, groupId: c.group.id, frozen, column: c, width: c.width,
      label: frozen ? (c.key === FROZEN[0] ? "Frozen · identity" : "") : first ? c.group.label : `${c.group.short} (cont.)`,
      tone: GROUP_TONE[c.group.source] });
  }
  const sections = groupBySet ? skuSetGroups(rows) : [{ key: "all", label: null, rows }];

  return (
    <div role="grid" aria-label="SKU Master" style={{ width, position: "relative" }}>
      <div style={{ display: "flex", position: "sticky", top: 0, zIndex: 6, height: 22 }}>
        {segments.map(s => (
          <div key={s.key} title={`${s.column.group.label} · SPEC ${s.column.group.sheetRange}`}
            style={{ width: s.width, flex: `0 0 ${s.width}px`, ...stick(s.column, 4), background: s.tone.band, color: s.tone.ink,
              height: 22, padding: "5px 7px 0", fontSize: T.micro + 0.5, fontWeight: 800, letterSpacing: "0.05em",
              textTransform: "uppercase", borderRight: "1px solid rgba(0,0,0,0.06)", borderBottom: `1px solid ${C.border}`,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", boxSizing: "border-box" }}>{s.label}</div>
        ))}
      </div>
      <div style={{ display: "flex", position: "sticky", top: 22, zIndex: 5, height: 40 }}>
        {cols.map(c => {
          const filter = filterOf(c.key);
          const { available, reason } = availability(c.key);
          const blockedByLimit = available && !filter && limitReached;
          return (
          <div key={c.key} role="columnheader" aria-sort="none" title={`${c.sheet ? `${c.sheet} · ` : ""}${c.label}\nUsed for: ${c.use}`}
            style={{ width: c.width, flex: `0 0 ${c.width}px`, ...stick(c, 4), height: 40, padding: "4px 6px",
              background: filter ? "#FCE9D6" : c.origin === "new" ? C.amberL : c.origin === "app" ? "#EEF3F0" : "#FBF8F3",
              borderRight: `1px solid ${edge(c)}`, borderBottom: `1px solid ${filter ? C.amber : C.border}`, overflow: "hidden", boxSizing: "border-box" }}>
            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
              <span style={{ fontFamily: mono, fontSize: T.micro + 0.5, fontWeight: 700, color: c.origin === "new" ? C.amberD : C.slateL }}>
                {c.sheet || (c.origin === "new" ? "+" : "app")}</span>
              <span style={{ fontSize: T.micro, fontWeight: 800, color: C.slateL }}>{fieldTag(c)}</span>
              <button type="button" aria-label={filter ? `Filter on ${c.label}: ${columnFilterSummary(c.label, filter)}` : `Filter ${c.label}`}
                aria-haspopup="dialog" aria-expanded={openFilterKey === c.key}
                disabled={!available || blockedByLimit}
                title={!available ? reason : blockedByLimit ? `At most ${COLUMN_FILTER_MAX} column filters at once.`
                  : filter ? columnFilterSummary(c.label, filter) : `Filter ${c.label}`}
                onClick={e => { e.stopPropagation(); onOpenFilter(c.key, e.currentTarget.getBoundingClientRect()); }}
                style={{ marginLeft: "auto", width: 16, height: 14, display: "inline-grid", placeItems: "center", padding: 0,
                  borderRadius: 3, border: `1px solid ${filter ? C.amber : "transparent"}`,
                  background: filter ? C.amber : "transparent", color: filter ? C.white : C.slateL,
                  opacity: available && !blockedByLimit ? 1 : 0.3, cursor: available && !blockedByLimit ? "pointer" : "not-allowed" }}>
                {FUNNEL}</button>
            </div>
            <div style={{ fontSize: T.label, fontWeight: 700, color: C.slateM, lineHeight: 1.15, overflow: "hidden",
              display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{c.label}</div>
          </div>
          );
        })}
      </div>
      {sections.map(section => (
        <div key={section.key} role="rowgroup">
          {section.label && (
            <div style={{ height: 22, background: "#EEF3F0", borderTop: "1px solid #9FC4B2", borderBottom: "1px solid #CFE3D8" }}>
              <div style={{ position: "sticky", left: 0, display: "inline-block", padding: "5px 9px 0", fontSize: T.label,
                fontWeight: 800, letterSpacing: "0.03em", color: "#244C3D", whiteSpace: "nowrap" }}>
                {section.label} · {section.rows.length} SKU{section.rows.length === 1 ? "" : "s"}</div>
            </div>
          )}
          {section.rows.map((row, index) => {
            const on = row.id === selectedId;
            const bg = on ? C.amberL : index % 2 ? "#FDFBF8" : C.white;
            return (
              <div key={row.id} role="row" aria-selected={on} onClick={() => onSelect(row.id)}
                style={{ display: "flex", height: 26, cursor: "pointer" }}>
                {cols.map(c => {
                  const value = specFieldCell(c.key, row, ctx);
                  return (
                    <div key={c.key} role="gridcell" title={`${c.label}: ${value.title}`}
                      style={{ width: c.width, flex: `0 0 ${c.width}px`, ...stick(c, 3), background: bg,
                        color: STATE_INK[value.state], fontStyle: isPlain(value.state) ? "normal" : "italic",
                        fontWeight: c.key === "C" || c.key === "D" ? 700 : 500, fontFamily: c.key === "D" ? mono : sans,
                        fontSize: T.body - 1, height: 26, padding: "6px 7px 0", boxSizing: "border-box",
                        borderRight: `1px solid ${edge(c)}`, borderBottom: "1px solid #F0EAE0",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        boxShadow: c.key === FROZEN[0] ? `inset 3px 0 0 ${LIFECYCLE_INK[row.status] || C.border}` : undefined }}>
                      {gridCellText(value)}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function SkuDeepDive({ data, fieldCols, onSelectSku, authority, mode, showToast, onChanged }) {
  const [focus, setFocus] = useState("all");
  const row = specRowFromDetail(data);
  const visibility = data.detail_visibility || {};
  const ctx = { visibility, schemaPending: data.schema_pending || {} };
  const { sku, versions = [], external_references: references = [], location_applicability: applicability = [],
    lineage = {} } = data;
  const replacement = replacementLabel(lineage, sku.replacement_sku_id);
  const customerHidden = !!visibilityText(visibility.customer);
  const sets = skuSetView(data.sets, sku.id);
  const shortName = specFieldCell("C", row, ctx);
  const itemName = specFieldCell("B", row, ctx);
  const shownGroups = focus === "all" ? SKU_SPEC_GROUPS : SKU_SPEC_GROUPS.filter(g => g.id === focus);
  const showLayers = ["all", "std_carton", "std_board"].includes(focus);
  const card = { background: C.white, border: `1px solid ${C.border}`, borderRadius: 7, overflow: "hidden" };
  const chip = on => ({ height: 22, padding: "1px 8px", borderRadius: 999, cursor: "pointer", fontSize: T.label, fontWeight: 700,
    whiteSpace: "nowrap", fontFamily: sans, color: on ? C.white : C.slateM, background: on ? C.slateM : C.white,
    border: `1px solid ${on ? C.slateM : C.border}` });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 1100 }}>
      <div style={{ ...card, borderRadius: 8, padding: "10px 12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <PermanentCode code={plantItemCodeLabel(sku.plant_item_code)}
            style={{ fontSize: T.heading, color: sku.plant_item_code ? C.slate : C.slateL }} />
          <LifecycleBadge status={sku.status} />
          <ProvenanceTag kind="governed" />
          <span style={{ fontSize: T.label, color: C.slateL, marginLeft: "auto" }}>SKU #{sku.id} · content v{sku.content_version}</span>
        </div>
        <div style={{ fontSize: T.title, fontWeight: 700, color: STATE_INK[shortName.state], marginTop: 6,
          fontStyle: isPlain(shortName.state) ? "normal" : "italic" }}>{shortName.text}</div>
        <div style={{ fontSize: T.body, color: C.slateL, fontStyle: isPlain(itemName.state) ? "normal" : "italic" }}>{itemName.text}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10, marginTop: 9 }}>
          <Fact label="Producing Plant" value={plantLabel(sku.plant)} honest={!sku.plant} />
          <Fact label="Customer / Prospect" value={customerLabel(sku.customer, visibility.customer)} honest={customerHidden || !sku.customer} />
          <Fact label="Customer Family" value={familyLabel(sku.family, visibility.customer)} honest={customerHidden || !sku.family} />
          <Fact label="Replacement" value={replacement || "No replacement recorded"} honest={!lineage.replaced_by} />
        </div>
        {!!lineage.replaces?.length && (
          <div style={{ fontSize: T.label, color: C.slateM, marginTop: 7 }}>
            Replaces: {lineage.replaces.map(r => `${plantItemCodeLabel(r.plant_item_code)} (${r.status})`).join(", ")}
          </div>
        )}
      </div>

      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderBottom: `1px solid ${C.border}`, background: "#EEF3F0" }}>
          <span style={{ fontSize: T.body, fontWeight: 800, color: C.slate }}>SKU Set</span>
          <span style={{ fontSize: T.label, color: C.slateL }}>Independent SKUs for production and costing, linked by confirmed membership</span>
        </div>
        <div style={{ padding: "8px 10px", display: "flex", flexDirection: "column", gap: 8 }}>
          {data.sets == null && <Notice tone="warn">SKU Set membership: {visibilityText(visibility.sets) || "Details unavailable"}</Notice>}
          {data.sets != null && !sets.length && <Notice>Not in a SKU Set.</Notice>}
          {sets.map(s => (
            <div key={s.id} style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <PermanentCode code={s.label} style={{ fontSize: T.value }} />
                <LifecycleBadge status={s.status} />
                <span style={{ fontSize: T.label, color: C.slateM }}>This SKU: {s.role} {s.qty} · {s.memberStatus}</span>
              </div>
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                {s.members.map(m => (
                  <button key={m.skuId} type="button" disabled={!m.visible || m.isCurrent}
                    onClick={() => onSelectSku(m.skuId)} title={`${m.code} · member ${m.status}`}
                    style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 8px", borderRadius: 5,
                      cursor: m.visible && !m.isCurrent ? "pointer" : "default", fontFamily: sans,
                      border: `1px solid ${m.isCurrent ? C.slateM : C.border}`, background: m.isCurrent ? C.slateM : C.white,
                      color: m.isCurrent ? C.white : C.slate }}>
                    <span style={{ fontSize: T.micro, fontWeight: 800, textTransform: "uppercase" }}>{m.role}</span>
                    <span style={{ fontFamily: mono, fontSize: T.label, fontWeight: 700 }}>{m.code}</span>
                    <span style={{ fontSize: T.label }}>{m.qty}</span>
                    {m.status !== "confirmed" && <span style={{ fontSize: T.micro, fontStyle: "italic" }}>{m.status}</span>}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        {[{ id: "all", label: `All fields ${SKU_SPEC_FIELD_COUNT}` }, ...SKU_SPEC_GROUPS.map(g => ({ id: g.id, label: `${g.short} ${g.fields.length}` }))]
          .map(n => <button key={n.id} type="button" onClick={() => setFocus(n.id)} aria-pressed={focus === n.id}
            style={chip(focus === n.id)}>{n.label}</button>)}
      </div>

      {showLayers && (
        <div style={card}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, padding: "7px 10px", borderBottom: `1px solid ${C.border}`, flexWrap: "wrap" }}>
            <span style={{ fontSize: T.body, fontWeight: 800, color: C.slate }}>Construction layers</span>
            <span style={{ fontSize: T.label, color: C.slateL, fontFamily: row.construction ? mono : sans }}>
              {row.version ? constructionLabel({ construction: row.construction, construction_version_id: row.version.construction_version_id }, visibility.construction)
                : "No SKU version"}
            </span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "80px repeat(2, minmax(0, 1fr))", fontSize: T.body }}>
            {["Layer", "BF · AI AK AM AO AQ", "GSM · AJ AL AN AP AR"].map(h => (
              <div key={h} style={{ padding: "5px 8px", fontSize: T.micro, fontWeight: 800, letterSpacing: "0.05em", textTransform: "uppercase",
                color: C.slateL, background: "#FBF8F3", borderBottom: `1px solid ${C.border}` }}>{h}</div>
            ))}
            {LAYERS.map(([name, bfKey, gsmKey]) => [
              <div key={`${name}-n`} style={{ padding: "5px 8px", fontWeight: 800, color: C.slateM, borderBottom: "1px solid #F0EAE0" }}>{name}</div>,
              ...[bfKey, gsmKey].map(k => {
                const v = specFieldCell(k, row, ctx);
                return <div key={`${name}-${k}`} title={v.title} style={{ padding: "5px 8px", fontFamily: mono, borderBottom: "1px solid #F0EAE0",
                  color: STATE_INK[v.state], fontStyle: isPlain(v.state) ? "normal" : "italic", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.text}</div>;
              }),
            ])}
          </div>
        </div>
      )}

      {shownGroups.map(g => {
        const tone = GROUP_TONE[g.source];
        const cells = g.fields.map(f => ({ f, v: specFieldCell(f.key, row, ctx) }));
        const recorded = cells.filter(({ v }) => isPlain(v.state)).length;
        return (
          <div key={g.id} style={card}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderBottom: `1px solid ${C.border}`, background: tone.soft }}>
              <span style={{ fontSize: T.body, fontWeight: 800, color: C.slate }}>{g.label}</span>
              <span style={{ fontSize: T.micro, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: tone.softInk }}>SPEC {g.sheetRange}</span>
              <span style={{ marginLeft: "auto", fontSize: T.label, color: C.slateL }}>{recorded} of {g.fields.length} recorded</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${fieldCols}, minmax(0, 1fr))` }}>
              {cells.map(({ f, v }) => {
                const tag = fieldTag(f);
                const text = f.key === "PT" && v.state === "blank" ? `Not recorded · ${PRINT_TECHNOLOGIES.join(" / ")}` : v.text;
                return (
                  <div key={f.key} title={`Used for: ${f.use}`} style={{ display: "flex", gap: 7, alignItems: "baseline", padding: "5px 10px",
                    borderBottom: "1px solid #F0EAE0", borderRight: "1px solid #F0EAE0", minWidth: 0,
                    background: f.origin === "new" ? "#FFF9F2" : C.white }}>
                    <span style={{ fontFamily: mono, fontSize: T.label, fontWeight: 700, color: f.origin === "new" ? C.amberD : C.slateL,
                      width: 26, flex: "0 0 26px" }}>{f.sheet || (f.origin === "new" ? "+" : "app")}</span>
                    <span style={{ fontSize: T.label, color: C.slateL, width: "42%", flex: "0 0 42%", lineHeight: 1.25 }}>{f.label}</span>
                    <span title={v.title} style={{ flex: "1 1 auto", minWidth: 0, fontSize: T.body, lineHeight: 1.3, overflowWrap: "anywhere",
                      color: STATE_INK[v.state], fontStyle: isPlain(v.state) ? "normal" : "italic", fontWeight: isPlain(v.state) ? 600 : 500 }}>{text}</span>
                    {tag && <span style={{ flex: "0 0 auto", fontSize: T.micro, fontWeight: 800, borderRadius: 3, padding: "0 3px",
                      color: tag === "CON" ? C.slateM : C.white, background: tag === "NEW" ? C.amber : tag === "APP" ? C.green : "#E4E9EE" }}>{tag}</span>}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      <SummaryRow title="Versions" facts={[`${versions.length} immutable version${versions.length === 1 ? "" : "s"}`,
        `${versions.filter(v => v.approved).length} approved`]}>
        {versions.length === 0 ? <Notice>No SKU version has been recorded yet.</Notice> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {versions.map(v => (
              <div key={v.id} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", padding: "5px 8px",
                borderRadius: 6, border: `1px solid ${C.border}` }}>
                <strong style={{ fontSize: T.body, color: C.slate }}>v{v.version_no}</strong>
                {v.approved ? <ProvenanceTag kind="immutable" label="Approved" />
                  : <span style={{ fontSize: T.label, color: C.amberD, fontWeight: 700 }}>Unapproved</span>}
                <span style={{ fontSize: T.label, color: C.slateM }}>
                  {v.is_price_driving === true ? "Price-driving change" : v.is_price_driving === false ? "Non-price-driving change" : "Change kind unavailable"}
                </span>
                <span style={{ fontSize: T.label, color: v.construction ? C.slate : C.slateL, fontFamily: mono }}>
                  {constructionLabel(v, visibility.construction)}
                </span>
                <span style={{ fontSize: T.label, color: C.slateL }}>{adoptionLabel(v, visibility.plant_adoption)}</span>
              </div>
            ))}
          </div>
        )}
      </SummaryRow>

      <SummaryRow title="External references" facts={[`${references.length} recorded`, "non-authoritative"]}>
        {references.length === 0 ? <Notice>No external reference is recorded for this SKU.</Notice> : (
          <table style={{ borderCollapse: "collapse", fontSize: T.body, width: "100%" }}>
            <tbody>
              {references.map(r => (
                <tr key={r.id} style={{ borderTop: `1px solid ${C.border}` }}>
                  <td style={{ padding: "4px 6px", color: C.slateM }}>{REFERENCE_KIND_LABELS[r.reference_kind] || r.reference_kind}</td>
                  <td style={{ padding: "4px 6px", fontFamily: mono, color: C.slate }}>{r.reference_value}</td>
                  <td style={{ padding: "4px 6px" }}><LifecycleBadge status={r.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <SkuReferenceControls data={data} references={references} authority={authority} mode={mode}
          showToast={showToast} onChanged={onChanged} />
      </SummaryRow>

      <SummaryRow title="History" facts={data.history == null
        ? [visibility.history === undefined ? "Not recorded in this preview" : visibilityText(visibility.history)]
        : [`${data.history.length} governed change${data.history.length === 1 ? "" : "s"}`, "append-only"]}>
        {data.history == null && <Notice tone="warn">History: {visibility.history === undefined
          ? "not recorded in this preview" : visibilityText(visibility.history)}. It arrives with the governed SKU operations.</Notice>}
        {data.history != null && data.history.length === 0 && <Notice>No governed change has been recorded for this SKU yet.</Notice>}
        {data.history != null && data.history.length > 0 && (
          <table style={{ borderCollapse: "collapse", fontSize: T.body, width: "100%" }}>
            <tbody>
              {data.history.map(e => (
                <tr key={e.id} style={{ borderTop: `1px solid ${C.border}` }}>
                  <td style={{ padding: "4px 6px", fontFamily: mono, color: C.slateL, whiteSpace: "nowrap" }}>
                    {e.occurred_at ? new Date(e.occurred_at).toLocaleString() : "—"}</td>
                  <td style={{ padding: "4px 6px", color: C.slate, fontWeight: 700 }}>{String(e.operation).replaceAll("_", " ")}</td>
                  <td style={{ padding: "4px 6px", color: C.slateM }}>User #{e.actor}</td>
                  <td style={{ padding: "4px 6px", color: C.slateL }}>{e.reason || ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </SummaryRow>

      <SummaryRow title="Location applicability" facts={[`${applicability.length} recorded`]}>
        {visibilityText(visibility.locations) && <Notice tone="warn">Location details: {visibilityText(visibility.locations)}</Notice>}
        {applicability.length === 0 ? <Notice>No Location applicability is recorded for this SKU.</Notice> : (
          <table style={{ borderCollapse: "collapse", fontSize: T.body, width: "100%" }}>
            <tbody>
              {applicability.map(a => (
                <tr key={a.id} style={{ borderTop: `1px solid ${C.border}` }}>
                  <td style={{ padding: "4px 6px", fontFamily: mono, color: a.location ? C.slate : C.slateL }}>
                    {applicabilityLocationLabel(a, visibility.locations)}
                  </td>
                  <td style={{ padding: "4px 6px", color: C.slateM }}>{APPLICABILITY_SCOPE_LABELS[a.scope] || a.scope}</td>
                  <td style={{ padding: "4px 6px" }}><LifecycleBadge status={a.status} /></td>
                  <td style={{ padding: "4px 6px", color: C.slateL }}>{a.approved ? "approved" : "not approved"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </SummaryRow>

      <SummaryRow title="Production data" facts={[`${PRODUCTION_BACKLOG_COUNT} SPEC columns`, "backlog · not implemented · not required"]}>
        <Notice>Kept as a reference list for a later production module. Nothing here is stored on a SKU or asked for when a SKU is created (CDM-43).</Notice>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${fieldCols}, minmax(0, 1fr))`, gap: 10, marginTop: 8 }}>
          {PRODUCTION_BACKLOG.map(g => (
            <div key={g.id} style={{ border: `1px dashed ${C.border}`, borderRadius: 6, padding: "6px 8px" }}>
              <div style={{ fontSize: T.label, fontWeight: 800, color: C.slateM, marginBottom: 3 }}>{g.label} · {g.columns.length}</div>
              {g.columns.map(col => (
                <div key={col.sheet} style={{ display: "flex", gap: 6, fontSize: T.label, color: C.slateL, lineHeight: 1.45 }}>
                  <span style={{ fontFamily: mono, width: 22, flex: "0 0 22px" }}>{col.sheet}</span>
                  <span>{col.label}{col.note ? ` — ${col.note}` : ""}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </SummaryRow>
    </div>
  );
}
