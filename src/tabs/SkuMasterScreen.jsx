// ═══════════════════════════════════════════════════════════════════════════
// src/tabs/SkuMasterScreen.jsx — read-only governed SKU Master (U2).
//
// Reads `/masters/skus` and `/masters/skus/<id>` as the authenticated caller.
// There is deliberately NO create, edit, approve, discontinue, reference or
// applicability control: no governed SKU write operation is in scope, and a
// dead control would promise one.
//
// Honest states, in the Construction Library idiom: loading, access denied
// (403 — never an empty list), error with retry, genuinely empty, and a read
// timestamp with manual refresh. Inside a SKU, a section the caller may not
// read says so, and a failed optional read says "Details unavailable"; neither
// is rendered as an absence, a guess, or a current-master substitute.
//
// Governed versus local: this screen shows governed SKUs only. Item codes and
// Printing metadata typed into Costing/Batch Builder live in this browser and
// are not SKU Master records, so they are named as such and never mixed in.
//
// `fixtureOnly` renders labelled fixture responses without any request
// (development preview from the sign-in screen).
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../AuthContext.jsx";
import { apiFetch } from "../lib/apiClient.js";
import { classifyResponse } from "../lib/backendError.js";
import { SKU_FIXTURE_DETAILS, fixtureSkuCatalogue } from "../lib/skuMasterFixture.js";
import {
  APPLICABILITY_SCOPE_LABELS, REFERENCE_KIND_LABELS, SKU_STATUSES, adoptionLabel,
  applicabilityLocationLabel, constructionLabel, customerLabel, familyLabel, latestVersionFacts,
  normaliseSkuCatalogue, plantItemCodeLabel, plantLabel, replacementLabel, skuCatalogueQuery,
  skuPlantScope, skuSearchValidation, specificationRows, unrecordedFieldsNotice, visibilityText,
} from "../lib/skuMasterModel.js";
import { AccessDeniedState, EmptyState, LoadingState } from "../ui/appStates.jsx";
import { LifecycleBadge, PermanentCode, ProvenanceTag, SummaryRow } from "../ui/dataDisplay.jsx";
import { C, T, mono, sans } from "../theme.js";

const EMPTY_FILTERS = { plant: "", status: "", q: "", familyId: "", partyId: "" };
const control = { fontSize: T.body, padding: "4px 7px", borderRadius: 5, border: `1px solid ${C.border}`,
  background: C.white, fontFamily: sans, color: C.slate };

function Notice({ children, tone = "muted" }) {
  return <div style={{ fontSize: T.label, color: tone === "warn" ? C.amberD : C.slateL, fontFamily: sans }}>{children}</div>;
}

function Fact({ label, value, honest }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: T.micro, fontWeight: 800, letterSpacing: "0.05em", color: C.slateL,
        textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: T.body, color: honest ? C.slateL : C.slate, fontStyle: honest ? "italic" : "normal" }}>{value}</div>
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
  const [selectedVersionId, setSelectedVersionId] = useState(null);
  const [readAt, setReadAt] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  // Filter choices are learned from rows actually returned, so no extra master
  // read is issued and no option names a record the caller has not been shown.
  const [knownFamilies, setKnownFamilies] = useState({});
  const [knownCustomers, setKnownCustomers] = useState({});

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
      const versions = data?.versions || [];
      setSelectedVersionId(versions.length ? versions[versions.length - 1].id : null);
    })();
    return () => { cancelled = true; };
  }, [fixtureOnly, selectedId, reloadKey]);

  const familyOptions = useMemo(() => Object.values(knownFamilies)
    .sort((a, b) => a.name.localeCompare(b.name)), [knownFamilies]);
  const customerOptions = useMemo(() => Object.values(knownCustomers)
    .sort((a, b) => a.display_name.localeCompare(b.display_name)), [knownCustomers]);

  const setFilter = (key, value) => setFilters(f => ({ ...f, [key]: value }));
  const applySearch = e => { e.preventDefault(); if (!searchError) setFilter("q", searchDraft.trim()); };
  const clearFilters = () => { setFilters(EMPTY_FILTERS); setSearchDraft(""); };

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

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", fontFamily: sans, background: C.cream }}>
      {fixtureBanner}
      <div style={{ padding: "12px 16px 8px", borderBottom: `1px solid ${C.border}`, background: C.white }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
          <h2 style={{ fontSize: T.heading, fontWeight: 800, color: C.slate, margin: 0 }}>SKU Master</h2>
          <ProvenanceTag kind="governed" />
          <span style={{ fontSize: T.label, color: C.slateL }}>
            read-only · plants in scope: {scope.length ? scope.join(", ") : "none"}
          </span>
          <span style={{ marginLeft: "auto", fontSize: T.label, color: C.slateL }}>
            Read at {readAt ? readAt.toLocaleTimeString() : "—"}
          </span>
          <button type="button" onClick={() => setReloadKey(k => k + 1)} style={{ ...control, fontSize: T.label }}>Refresh</button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
          <ProvenanceTag kind="local" />
          <Notice>Item codes and Printing Technology typed in Costing or Batch Builder stay in this browser and are not SKU Master records; they are not shown here.</Notice>
        </div>

        <form onSubmit={applySearch} style={{ display: "flex", gap: 6, marginTop: 9, flexWrap: "wrap", alignItems: "center" }}>
          <input aria-label="Search Plant Item Code" placeholder="Plant Item Code contains…" value={searchDraft}
            onChange={e => setSearchDraft(e.target.value)} style={{ ...control, width: 220, fontFamily: mono }} />
          <button type="submit" disabled={!!searchError} style={control}>Search</button>
          <select aria-label="Plant" value={filters.plant} onChange={e => setFilter("plant", e.target.value)} style={control}>
            <option value="">All plants in scope</option>
            {scope.map(code => <option key={code} value={code}>{code}</option>)}
          </select>
          <select aria-label="Lifecycle status" value={filters.status} onChange={e => setFilter("status", e.target.value)} style={control}>
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
          {filters.q && <Notice>Searching “{filters.q}”</Notice>}
        </form>
      </div>

      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        <div style={{ width: 380, maxWidth: "45%", flexShrink: 0, borderRight: `1px solid ${C.border}`, overflowY: "auto",
          padding: "8px 10px 48px", background: C.white }}>
          {catalogue.status === "loading" && <LoadingState label="Loading SKUs…" />}
          {catalogue.status === "error" && (
            <div style={{ padding: 12 }}>
              <div style={{ fontSize: T.title, fontWeight: 700, color: C.red, marginBottom: 6 }}>Could not load the SKU Master</div>
              <Notice>{catalogue.message || "The request did not succeed."}</Notice>
              <button type="button" onClick={() => setReloadKey(k => k + 1)} style={{ ...control, marginTop: 8 }}>Retry</button>
            </div>
          )}
          {catalogue.status === "ready" && (<>
            <Notice>
              {catalogue.skus.length} SKU{catalogue.skus.length === 1 ? "" : "s"}
              {catalogue.truncated ? ` · first ${catalogue.limit} shown — refine the search to see the rest` : ""}
            </Notice>
            {customerVisibility !== "visible" && <Notice tone="warn">Customer and Family: {visibilityText(customerVisibility)}</Notice>}
            {catalogue.skus.length === 0
              ? <EmptyState title="No governed SKUs match."
                  hint="SKUs appear here once proposed or published for a plant you can access." />
              : catalogue.skus.map(row => (
                <button key={row.id} type="button" onClick={() => setSelectedId(row.id)}
                  aria-current={selectedId === row.id ? "true" : undefined}
                  style={{ width: "100%", textAlign: "left", display: "block", marginTop: 6, padding: "7px 9px",
                    borderRadius: 6, cursor: "pointer", fontFamily: sans,
                    border: `1px solid ${selectedId === row.id ? C.amber : C.border}`,
                    background: selectedId === row.id ? C.amberL : C.white }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <PermanentCode code={plantItemCodeLabel(row.plant_item_code)}
                      style={{ fontSize: T.value, color: row.plant_item_code ? C.slate : C.slateL }} />
                    <span style={{ marginLeft: "auto" }}><LifecycleBadge status={row.status} /></span>
                  </div>
                  <div style={{ fontSize: T.label, color: C.slateM, marginTop: 2 }}>
                    {row.plant?.plant_code || "Plant unavailable"} · {customerLabel(row.customer, customerVisibility)}
                  </div>
                  <div style={{ fontSize: T.label, color: C.slateL, marginTop: 1 }}>{latestVersionFacts(row).join(" · ")}</div>
                </button>
              ))}
          </>)}
        </div>

        <div style={{ flex: 1, minWidth: 0, overflowY: "auto", padding: "12px 16px 56px" }}>
          {selectedId == null && <EmptyState title="Select a SKU" hint="Its identity, immutable versions, specifications, references and Location applicability open here." />}
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
          {selectedId != null && detail.status === "ready" && <SkuDetail data={detail.data} selectedVersionId={selectedVersionId}
            onSelectVersion={setSelectedVersionId} />}
        </div>
      </div>
    </div>
  );
}

function SkuDetail({ data, selectedVersionId, onSelectVersion }) {
  const { sku, versions = [], external_references: references = [], location_applicability: applicability = [],
    lineage = {}, detail_visibility: visibility = {} } = data;
  const replacement = replacementLabel(lineage, sku.replacement_sku_id);
  const selected = versions.find(v => v.id === selectedVersionId) || versions[versions.length - 1] || null;
  const unrecorded = unrecordedFieldsNotice(data.unrecorded_specification_fields);
  const customerHidden = !!visibilityText(visibility.customer);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 980 }}>
      <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, background: C.white, padding: "10px 12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <PermanentCode code={plantItemCodeLabel(sku.plant_item_code)}
            style={{ fontSize: T.heading, color: sku.plant_item_code ? C.slate : C.slateL }} />
          <LifecycleBadge status={sku.status} />
          <ProvenanceTag kind="governed" />
          <span style={{ fontSize: T.label, color: C.slateL, marginLeft: "auto" }}>SKU #{sku.id} · content v{sku.content_version}</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, marginTop: 9 }}>
          <Fact label="Producing Plant" value={plantLabel(sku.plant)} honest={!sku.plant} />
          <Fact label="Customer / Prospect" value={customerLabel(sku.customer, visibility.customer)}
            honest={customerHidden || !sku.customer} />
          <Fact label="Customer Family" value={familyLabel(sku.family, visibility.customer)}
            honest={customerHidden || !sku.family} />
          <Fact label="Replacement" value={replacement || "No replacement recorded"}
            honest={!lineage.replaced_by} />
        </div>
        {!!lineage.replaces?.length && (
          <div style={{ fontSize: T.label, color: C.slateM, marginTop: 7 }}>
            Replaces: {lineage.replaces.map(r => `${plantItemCodeLabel(r.plant_item_code)} (${r.status})`).join(", ")}
          </div>
        )}
      </div>

      <SummaryRow title="Versions" defaultExpanded
        facts={[`${versions.length} immutable version${versions.length === 1 ? "" : "s"}`,
          `${versions.filter(v => v.approved).length} approved`]}>
        {versions.length === 0 ? <Notice>No SKU version has been recorded yet.</Notice> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {visibilityText(visibility.construction) && <Notice tone="warn">Construction: {visibilityText(visibility.construction)}</Notice>}
            {versions.map(v => (
              <div key={v.id} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
                padding: "6px 8px", borderRadius: 6, border: `1px solid ${v.id === selected?.id ? C.amber : C.border}` }}>
                <button type="button" onClick={() => onSelectVersion(v.id)} style={{ ...control, fontWeight: 800 }}
                  aria-pressed={v.id === selected?.id}>v{v.version_no}</button>
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

      <SummaryRow title="Specifications" defaultExpanded
        facts={[selected ? `v${selected.version_no}` : "No version", "blank is not zero"]}>
        {!selected ? <Notice>No specification exists without a SKU version.</Notice> : (<>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 8 }}>
            {specificationRows(selected.specification).map(([label, value]) => (
              <Fact key={label} label={label} value={value} honest={value === "Not recorded"} />
            ))}
          </div>
          {unrecorded && <div style={{ marginTop: 8 }}><Notice>{unrecorded}</Notice></div>}
        </>)}
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
    </div>
  );
}
