// ═══ src/ui/Sidebar.jsx — app navigation rail ══════════════════════════
//
// Extracted from QuotationApp.jsx (Phase 8). Structural move only.
//
// Navigation follows the canonical data-model product groups. Only destinations
// that have an implemented screen are interactive; future quote workflow is
// shown honestly as activation-pending rather than routed to a hollow page.
//
// Producing Plants and Customer Families are additionally feature-flagged
// (U1-C4 correction) — the SAME flag that gates their mount in
// QuotationApp.jsx, so a hidden nav entry can never be forced to render
// through a stale `tab` value. Customer Families also requires the actual
// read_party_master capability; Producing Plants does not (its RLS policy
// is open to any authenticated active user).
// ════════════════════════════════════════════════════════════════════════
import { useState } from "react";
import { hasCapability } from "../lib/capabilities.js";
import { isFeatureEnabled } from "../lib/featureFlags.js";
import { canOpenSkuMaster } from "../lib/skuMasterModel.js";
import { useAppState } from "../state/AppStateContext.js";
import { BrandMark, BrandWordmark } from "./BrandLogo.jsx";

export default function Sidebar(){
  const st=useAppState();
  const { constructionLib, items, profile, setSidebarCollapsed, setTab,
    sidebarCollapsed, tab } = st;
  const item = (id, icon, label, count, detail) => ({ id, icon, label, count, detail });
  const pending = (icon, label, detail) => ({ icon, label, detail, pending: true });
  const NAV_SECTIONS=[
    ["Workspace", [
      item("batch","BB","Batch Builder"),
      item("mybatches","AB","Active Batches",undefined,"Open caller-visible durable Batch work"),
      ...(hasCapability(profile,"check_quote")
        ?[item("approvalinbox","AI","Approval Inbox",undefined,"Submitted revisions awaiting an Approver")]
        :[]),
      item("items","QU","Quotes",items.length,"Governed evidence, working items and Quote History"),
      item("costing","QC","Quick calculation",undefined,
        "Private scratchpad and Batch-row Costing deep-dive; not a customer Quote"),
    ]],
    ["Reference data", [
      ...(isFeatureEnabled("u1_customer_families")&&hasCapability(profile,"read_party_master")
        ?[item("families","CF","Customer Families"),
          pending("CP","Customers and Prospects","Locations and External References included")]:[]),
      ...(isFeatureEnabled("u2_construction_library")&&hasCapability(profile,"read_construction_library")
        ?[item("conlib","CL","Construction Library",constructionLib.length)]
        :[pending("CL","Construction Library",
          isFeatureEnabled("u2_construction_library") ? "Capability required" : "U2 destination not enabled")]),
      ...(isFeatureEnabled("u2_construction_library")&&hasCapability(profile,"read_construction_library")
        ?[item("conadoption","PA","Plant Construction Adoption",undefined,
          "Read-only published Construction versions by accessible Producing Plant")]
        :[pending("PA","Plant Construction Adoption",
          isFeatureEnabled("u2_construction_library") ? "Capability required" : "U2 destination not enabled")]),
      // SKU read scope is plant_access at any plant — the skus SELECT policy.
      ...(isFeatureEnabled("u2_sku_master")&&canOpenSkuMaster(profile)
        ?[item("skus","SK","SKU Master",undefined,"Read-only governed SKUs, versions, specifications and Location applicability")]
        :[pending("SK","SKU Master",
          isFeatureEnabled("u2_sku_master") ? "Capability required" : "U2 destination not enabled")]),
      item("defaults","CP","Commercial Policies",undefined,
        "Sectors, Calculation Defaults and Annual Interest Basis"),
      item("rates","RM","Rate Masters"),
      item("freight","FM","Freight Masters"),
      ...(isFeatureEnabled("u3_pricing_basis") ?[item("pricingbasis","PB","Pricing Basis Releases")]:[]),
      pending("PC","Plant Configuration","Flute Profiles, Machines, Stations and Process Routes included"),
      ...(isFeatureEnabled("u2_gsm_master")
        ?[item("gsm","GS","GSM Master",undefined,"Paper GSM values offered by construction layer pickers")]:[]),
    ]],
    ["Administration", [
    // UA-1: gated on the CAPABILITY, not the derived label. A role string is a
    // presentation summary and must never decide what a screen can be.
      ...(hasCapability(profile,"administer_users")?[item("users","UA","Users & Access",undefined,
        "Users, Plant Assignments, Capabilities, Invitations and Orphan Recovery")]:[]),
      ...(isFeatureEnabled("u1_producing_plants")?[item("plants","PP","Producing Plants")]:[]),
      ...(hasCapability(profile,"administer_users")?[
        pending("AU","Audit History","Available when audit slice is delivered")]:[]),
    ]],
  ];

  const activeSection = NAV_SECTIONS.find(([, entries]) =>
    entries.some(entry => entry.id === tab))?.[0];
  const [openSections, setOpenSections] = useState(() =>
    new Set([activeSection || "Workspace"]));

  const toggleSection = section => setOpenSections(current => {
    return current.has(section) ? new Set() : new Set([section]);
  });
  const pendingStatus = detail => detail === "Future" ? "Future"
    : detail.includes("Backend activation") ? "Activation"
      : detail === "Capability required" ? "Restricted"
        : detail === "U2 destination not enabled" ? "Disabled"
      : detail.startsWith("In ") || detail.startsWith("Shown ") || detail.endsWith("included")
        ? "Included" : "Planned";

  return(
  <aside className={`sidebar-shell${sidebarCollapsed ? " is-collapsed" : ""}`} aria-label="Main navigation">
    <div className="sidebar-brand">
      {/* Platform brand first (the base for further modules), its positioning
          line, then the module in use. */}
      {sidebarCollapsed
        ? <BrandMark className="sidebar-brand-mark" inverse />
        : <div className="sidebar-brand-copy">
        <BrandWordmark className="sidebar-brand-wordmark" inverse />
        <small>Built for Corrugated Packaging</small>
        <small className="sidebar-brand-module">Quotation Module</small>
      </div>}
    </div>
    <nav className="sidebar-nav">
      {NAV_SECTIONS.filter(([, entries])=>entries.length).map(([section, entries])=><div key={section}
        className={`sidebar-nav-section${activeSection === section ? " is-current" : ""}`}>
        {!sidebarCollapsed&&<button type="button" className="sidebar-nav-heading"
          aria-expanded={openSections.has(section)} onClick={() => toggleSection(section)}>
          <span>{section}</span><small>{entries.length}</small><b aria-hidden="true">{openSections.has(section) ? "−" : "+"}</b>
        </button>}
        {(sidebarCollapsed || openSections.has(section))&&<div className="sidebar-nav-items">{entries.map(entry=>{
          // The reason is styled, not just named: a Restricted item needs a
          // capability grant, while Planned/Future/Disabled ones are not built or
          // not enabled yet — the user's next step differs completely.
          if (entry.pending) { const status = pendingStatus(entry.detail);
            return !sidebarCollapsed&&<div key={entry.label} className={`sidebar-nav-pending is-${status.toLowerCase()}`}
            title={`${entry.label} · ${entry.detail}`} aria-disabled="true"><span className="sidebar-nav-icon">{entry.icon}</span>
            <strong>{entry.label}</strong><small>{status}</small></div>; }
          const { id:t, icon, label:l, count, detail }=entry;
          return <button key={t} onClick={()=>{
            setOpenSections(current => current.has(section)
              ? current : new Set([section]));
            const leavingReview=st.tab==="costing"&&!!st.activeBatchRowId
              &&(t==="costing"||t==="batch");
            if(leavingReview&&!st.requestExitReview?.())return;
            if(t==="costing")st.returnToQuickCalculation?.();
            setTab(t);
          }} title={sidebarCollapsed?l:detail}
            className={`sidebar-nav-item${tab===t ? " is-active" : ""}`} aria-current={tab===t?"page":undefined}>
            <span className="sidebar-nav-icon">{icon}</span>
            {!sidebarCollapsed&&<span className="sidebar-nav-label">{l}</span>}
            {!sidebarCollapsed&&!!count&&<span className="sidebar-nav-count">{count}</span>}
            {sidebarCollapsed&&!!count&&<span className="sidebar-nav-count is-compact">{count}</span>}
          </button>})}</div>}
      </div>)}
    </nav>
    <button className="sidebar-collapse" onClick={()=>setSidebarCollapsed(v=>!v)}
      title={sidebarCollapsed?"Expand navigation":"Collapse navigation"}>
      <span>{sidebarCollapsed?"»":"«"}</span>{!sidebarCollapsed&&"Collapse navigation"}
    </button>
  </aside>
  );
}
