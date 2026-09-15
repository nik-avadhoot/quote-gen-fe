// ═══════════════════════════════════════════════════════════════════════════
// src/tabs/SkuMasterScreen.jsx — governed SKU Master (U2, Canonical Amendment 02).
//
// Reads `/masters/skus` and `/masters/skus/<id>` as the authenticated caller.
// There is deliberately NO create, edit, approve, discontinue, reference,
// applicability or SKU Set control: no governed write operation is in scope,
// and a dead control would promise one.
//
// ── LAYOUT ────────────────────────────────────────────────────────────────
// Left: SKUs row by row with the CDM-43 fields in SPEC sheet groups and sheet
// order, code and short name frozen. Right: one SKU in depth. The divider opens
// at 50 : 50 and can be dragged, or moved with the arrow keys, between 25 % and
// 75 %; double-click restores 50 : 50.
//
// ── HONEST STATES ─────────────────────────────────────────────────────────
// loading, access denied (403 — never an empty list), error with retry,
// genuinely empty, and a read timestamp with manual refresh. Every field goes
// through one model rule (specFieldCell): a blank reads "Not recorded", zero
// reads 0, a section the caller may not read says so, a failed optional read
// says "Details unavailable", and a field whose storage is not activated yet
// says it is pending — never a guessed or current-master value.
//
// ── GOVERNED VERSUS LOCAL ─────────────────────────────────────────────────
// Only governed SKUs appear. Item codes and printing metadata typed into
// Costing or Batch Builder live in this browser and are not SKU Master records.
//
// `fixtureOnly` renders labelled fixture responses without any request
// (development preview from the sign-in screen).
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../AuthContext.jsx";
import { apiFetch } from "../lib/apiClient.js";
import { classifyResponse } from "../lib/backendError.js";
import { SKU_FIXTURE_DETAILS, fixtureSkuCatalogue } from "../lib/skuMasterFixture.js";
import {
  PRINT_TECHNOLOGIES, PRODUCTION_BACKLOG, PRODUCTION_BACKLOG_COUNT, SKU_SPEC_FIELD_COUNT, SKU_SPEC_GROUPS,
} from "../lib/skuSpecRegistry.js";
import {
  APPLICABILITY_SCOPE_LABELS, REFERENCE_KIND_LABELS, SKU_STATUSES, SPLIT_DEFAULT, adoptionLabel,
  applicabilityLocationLabel, clampSplit, constructionLabel, customerLabel, familyLabel, gridCellText,
  normaliseSkuCatalogue, plantItemCodeLabel, plantLabel, replacementLabel, schemaPendingNotice,
  skuCatalogueQuery, skuPlantScope, skuSearchValidation, skuSetGroups, skuSetView, specFieldCell,
  specRowFromCatalogue, specRowFromDetail, visibilityText,
} from "../lib/skuMasterModel.js";
import { AccessDeniedState, EmptyState, LoadingState } from "../ui/appStates.jsx";
import { LifecycleBadge, PermanentCode, ProvenanceTag, SummaryRow } from "../ui/dataDisplay.jsx";
import { C, T, mono, sans } from "../theme.js";

const EMPTY_FILTERS = { plant: "", status: "", q: "", familyId: "", partyId: "" };
const FROZEN = ["C", "D"];
const GROUP_TONE = {
  identity: { band: C.slateM, ink: C.white, soft: "#F3F1EC", softInk: C.slateM },
  customer: { band: C.greenL, ink: C.green, soft: "#F4FAF6", softInk: C.green },
  production: { band: C.amberL, ink: C.amberD, soft: "#FFF9F2", softInk: C.amberD },
  governance: { band: C.paper, ink: C.slateM, soft: "#F8F4EE", softInk: C.slateM },
};
const STATE_INK = { value: C.slate, na: C.slateL, blank: C.slateL, hidden: C.slateL, unavailable: C.slateL, pending: C.amberD };
const LIFECYCLE_INK = { proposed: C.amberD, active: C.green, discontinued: C.red };
const LAYERS = [["Top", "AI", "AJ"], ["Flute-1", "AK", "AL"], ["Back-1", "AM", "AN"], ["Flute-2", "AO", "AP"], ["Back-2", "AQ", "AR"]];
const control = { fontSize: T.body, padding: "4px 7px", borderRadius: 5, border: `1px solid ${C.border}`,
  background: C.white, fontFamily: sans, color: C.slate };
const chip = (on, onInk = C.white, onBg = C.slateM) => ({ height: 22, padding: "1px 8px", borderRadius: 999, cursor: "pointer",
  fontSize: T.label, fontWeight: 700, whiteSpace: "nowrap", fontFamily: sans,
  color: on ? onInk : C.slateM, background: on ? onBg : C.white, border: `1px solid ${on ? onBg : C.border}` });

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
  const [split, setSplit] = useState(SPLIT_DEFAULT);
  const [dragging, setDragging] = useState(false);
  const [hiddenGroups, setHiddenGroups] = useState([]);
  const [groupBySet, setGroupBySet] = useState(false);
  const bodyRef = useRef(null);

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
  const clearFilters = () => { setFilters(EMPTY_FILTERS); setSearchDraft(""); };
  const toggleGroup = id => setHiddenGroups(h => h.includes(id) ? h.filter(x => x !== id) : [...h, id]);

  const startDrag = e => {
    if (!bodyRef.current) return;
    e.preventDefault();
    const rect = bodyRef.current.getBoundingClientRect();
    const move = ev => setSplit(clampSplit(((ev.clientX - rect.left) / rect.width) * 100));
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setDragging(false);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    setDragging(true);
  };
  const nudgeSplit = e => {
    if (e.key === "ArrowLeft") { e.preventDefault(); setSplit(s => clampSplit(s - 5)); }
    if (e.key === "ArrowRight") { e.preventDefault(); setSplit(s => clampSplit(s + 5)); }
  };

  const fixtureBanner = fixtureOnly && (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 16px", background: C.amberL,
      borderBottom: `1px dashed ${C.amber}`, fontFamily: sans }}>
      <strong style={{ fontSize: T.label, color: C.amberD, letterSpacing: "0.05em" }}>U2 · FIXTURE ONLY</strong>
      <span style={{ fontSize: T.label, color: C.amberD }}>
        Isolated SKU Master illustration. No authoritative read or write occurs.
      </span>
      {onExitFixture && <button type="button" onClick={onExitFixture}
        style={{ ...control, marginLeft: "auto", fontSize: T.label }}>Return to sign in</button>}
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
  const fieldCols = split >= 62 ? 1 : 2;

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", fontFamily: sans, background: C.cream }}>
      {fixtureBanner}
      <div style={{ padding: "10px 16px 8px", borderBottom: `1px solid ${C.border}`, background: C.white }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
          <h2 style={{ fontSize: T.heading, fontWeight: 800, color: C.slate, margin: 0 }}>SKU Master</h2>
          <ProvenanceTag kind="governed" />
          <span style={{ fontSize: T.label, color: C.slateL }}>
            read-only · {SKU_SPEC_FIELD_COUNT} quote and costing fields · plants in scope: {scope.length ? scope.join(", ") : "none"}
          </span>
          <span style={{ marginLeft: "auto", fontSize: T.label, color: C.slateL }}>
            Read at {readAt ? readAt.toLocaleTimeString() : "—"}
          </span>
          <button type="button" onClick={() => setReloadKey(k => k + 1)} style={{ ...control, fontSize: T.label }}>Refresh</button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
          <ProvenanceTag kind="local" />
          <Notice>Item codes and printing details typed in Costing or Batch Builder stay in this browser and are not SKU Master records; they are not shown here.</Notice>
        </div>
        {pendingNotice && <div style={{ marginTop: 6, padding: "5px 8px", borderRadius: 5, background: C.amberL,
          border: `1px solid ${C.amber}55` }}><Notice tone="warn">{pendingNotice}</Notice></div>}
      </div>

      <div ref={bodyRef} style={{ flex: 1, display: "flex", minHeight: 0 }}>
        <div style={{ width: `calc(${split}% - 3.5px)`, flex: "0 0 auto", minWidth: 0, display: "flex", flexDirection: "column",
          background: C.white }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "8px 10px 7px",
            borderBottom: `1px solid ${C.border}`, background: "#FBF8F3" }}>
            <form onSubmit={applySearch} style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              <input aria-label="Search Plant Item Code" placeholder="Plant Item Code contains…" value={searchDraft}
                onChange={e => setSearchDraft(e.target.value)} style={{ ...control, width: 190, fontFamily: mono }} />
              <button type="submit" disabled={!!searchError} style={control}>Search</button>
              <select aria-label="Plant" value={filters.plant} onChange={e => setFilter("plant", e.target.value)} style={control}>
                <option value="">All plants in scope</option>
                {scope.map(code => <option key={code} value={code}>{code}</option>)}
              </select>
              <select aria-label="Lifecycle" value={filters.status} onChange={e => setFilter("status", e.target.value)} style={control}>
                <option value="">All lifecycle states</option>
                {SKU_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select aria-label="Customer Family" value={filters.familyId} disabled={!partyFiltersVisible}
                title={partyFiltersVisible ? "Families seen in results so far" : visibilityText(customerVisibility) || ""}
                onChange={e => setFilter("familyId", e.target.value)} style={control}>
                <option value="">{partyFiltersVisible ? "All Families" : "Family filter unavailable"}</option>
                {familyOptions.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
              <select aria-label="Customer" value={filters.partyId} disabled={!partyFiltersVisible}
                title={partyFiltersVisible ? "Customers seen in results so far" : visibilityText(customerVisibility) || ""}
                onChange={e => setFilter("partyId", e.target.value)} style={control}>
                <option value="">{partyFiltersVisible ? "All Customers / Prospects" : "Customer filter unavailable"}</option>
                {customerOptions.map(p => <option key={p.id} value={p.id}>{p.display_name}</option>)}
              </select>
              <button type="button" onClick={clearFilters} style={control}>Clear</button>
              {searchError && <Notice tone="warn">{searchError}</Notice>}
            </form>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontSize: T.micro, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: C.slateL }}>Column groups</span>
              {SKU_SPEC_GROUPS.filter(g => g.id !== "identity").map(g => {
                const off = hiddenGroups.includes(g.id);
                const tone = GROUP_TONE[g.source];
                return <button key={g.id} type="button" onClick={() => toggleGroup(g.id)} aria-pressed={!off}
                  title={`${g.label} · ${g.fields.length} fields · SPEC ${g.sheetRange}`}
                  style={{ height: 20, padding: "1px 6px", borderRadius: 4, cursor: "pointer", fontSize: T.label, fontWeight: 700,
                    color: off ? C.slateL : tone.ink, background: off ? C.white : tone.band,
                    border: `1px solid ${off ? C.border : "rgba(0,0,0,0.08)"}`, textDecoration: off ? "line-through" : "none" }}>
                  {g.short}</button>;
              })}
              <span style={{ flex: "1 1 auto" }} />
              <button type="button" onClick={() => setGroupBySet(v => !v)} aria-pressed={groupBySet}
                style={chip(groupBySet, C.white, C.green)}>Group rows by SKU Set</button>
            </div>
          </div>

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
              ? <EmptyState title="No governed SKUs match."
                  hint="SKUs appear here once proposed or published for a plant you can access." />
              : <SpecGrid rows={gridRows} ctx={gridCtx} groups={visibleGroups} selectedId={selectedId}
                  onSelect={setSelectedId} groupBySet={groupBySet} />)}
          </div>
          <div style={{ height: 26, flex: "0 0 26px", display: "flex", alignItems: "center", gap: 10, padding: "0 10px",
            borderTop: `1px solid ${C.border}`, background: "#FBF8F3", fontSize: T.label, color: C.slateL, overflow: "hidden", whiteSpace: "nowrap" }}>
            <span>
              {catalogue.status === "ready" ? `${gridRows.length} SKU${gridRows.length === 1 ? "" : "s"}` : "—"}
              {catalogue.truncated ? ` · first ${catalogue.limit} shown — refine the search` : ""}
            </span>
            <span style={{ marginLeft: "auto" }}>Blank = not recorded · CON = Construction authority · NEW = added field · APP = set in the app</span>
          </div>
        </div>

        <div role="separator" aria-orientation="vertical" aria-label="Resize SKU list and SKU detail"
          aria-valuemin={25} aria-valuemax={75} aria-valuenow={split} tabIndex={0}
          onPointerDown={startDrag} onDoubleClick={() => setSplit(SPLIT_DEFAULT)} onKeyDown={nudgeSplit}
          title="Drag to resize · double-click for 50 : 50"
          style={{ width: 7, flex: "0 0 7px", cursor: "col-resize", background: dragging ? "#F3E3D2" : "#FBF8F3",
            borderLeft: `1px solid ${C.border}`, borderRight: `1px solid ${C.border}`, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", gap: 3, touchAction: "none", userSelect: "none" }}>
          {[0, 1, 2].map(i => <span key={i} style={{ width: 3, height: 3, borderRadius: "50%", background: "#B5A898" }} />)}
        </div>

        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", background: C.cream }}>
          <div style={{ height: 32, flex: "0 0 32px", display: "flex", alignItems: "center", gap: 5, padding: "0 12px",
            borderBottom: `1px solid ${C.border}`, background: "#FBF8F3" }}>
            <span style={{ fontSize: T.micro, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: C.slateL }}>SKU deep-dive</span>
            <span style={{ marginLeft: "auto", fontSize: T.label, color: C.slateL }}>Panels {split} : {100 - split}</span>
            {[[50, "50:50"], [35, "35:65"], [65, "65:35"]].map(([v, label]) => (
              <button key={label} type="button" onClick={() => setSplit(v)} aria-pressed={split === v}
                style={{ ...chip(split === v), borderRadius: 4, fontFamily: mono }}>{label}</button>
            ))}
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
              <SkuDeepDive data={detail.data} fieldCols={fieldCols} onSelectSku={setSelectedId} />}
          </div>
        </div>
      </div>
    </div>
  );
}

function SpecGrid({ rows, ctx, groups, selectedId, onSelect, groupBySet }) {
  const cols = groups.flatMap(g => g.fields.map(f => ({ ...f, group: g })));
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
    const first = !segments.some(s => s.groupId === c.group.id);
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
        {cols.map(c => (
          <div key={c.key} role="columnheader" title={`${c.sheet ? `${c.sheet} · ` : ""}${c.label}\nUsed for: ${c.use}`}
            style={{ width: c.width, flex: `0 0 ${c.width}px`, ...stick(c, 4), height: 40, padding: "4px 6px",
              background: c.origin === "new" ? C.amberL : c.origin === "app" ? "#EEF3F0" : "#FBF8F3",
              borderRight: `1px solid ${edge(c)}`, borderBottom: `1px solid ${C.border}`, overflow: "hidden", boxSizing: "border-box" }}>
            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
              <span style={{ fontFamily: mono, fontSize: T.micro + 0.5, fontWeight: 700, color: c.origin === "new" ? C.amberD : C.slateL }}>
                {c.sheet || (c.origin === "new" ? "+" : "app")}</span>
              <span style={{ fontSize: T.micro, fontWeight: 800, color: C.slateL }}>{fieldTag(c)}</span>
            </div>
            <div style={{ fontSize: T.label, fontWeight: 700, color: C.slateM, lineHeight: 1.15, overflow: "hidden",
              display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{c.label}</div>
          </div>
        ))}
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

function SkuDeepDive({ data, fieldCols, onSelectSku }) {
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
  const pendingNotice = schemaPendingNotice(ctx.schemaPending);
  const shownGroups = focus === "all" ? SKU_SPEC_GROUPS : SKU_SPEC_GROUPS.filter(g => g.id === focus);
  const showLayers = ["all", "std_carton", "std_board"].includes(focus);
  const card = { background: C.white, border: `1px solid ${C.border}`, borderRadius: 7, overflow: "hidden" };

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

      {pendingNotice && <div style={{ padding: "6px 9px", borderRadius: 5, background: C.amberL, border: `1px solid ${C.amber}55` }}>
        <Notice tone="warn">{pendingNotice}</Notice></div>}

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
