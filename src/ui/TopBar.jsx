// ═══ src/ui/TopBar.jsx — account menu + backup/restore ═══════════════════
//
// Extracted from QuotationApp.jsx (Phase 8). Structural move only.
//
// ⚠️ THE RESTORE TRIO MUST NOT BE SEPARATED. handleRestore fires
// restoreRef.current?.click(); restoreRef is attached to the hidden <input
// type="file"> below; that input's onChange is handleRestoreFile. Split any
// one of the three from the other two and Restore silently does nothing -
// the button still highlights, and no file dialog ever opens.
// ════════════════════════════════════════════════════════════════════════
import AccountMenu from "../AccountMenu.jsx";
import { useAppState } from "../state/AppStateContext.js";
import { ProvenanceTag } from "./dataDisplay.jsx";
import { C, T, mono, sans } from "../theme.js";

// Display names for the active destination. Presentation only — navigation and
// access still live in Sidebar.jsx / QuotationApp.jsx.
const TAB_LABELS = {
  costing: "Start Costing", batch: "Batch Builder", mybatches: "My Batches",
  approvalinbox: "Approval Inbox", items: "Quotes", families: "Customer Families",
  conlib: "Construction Library", conadoption: "Plant Construction Adoption", constrlib: "Construction Library", gsm: "GSM Master", skus: "SKU Master",
  defaults: "Commercial Policies", rates: "Rate Masters", freight: "Freight Masters",
  pricingbasis: "Pricing Basis Releases", users: "Users & Access", plants: "Producing Plants",
};

// The destinations where the journey cue describes what is on screen.
//
// Quotes is deliberately CONDITIONAL. Its Governed and History views show
// frozen evidence belonging to a particular Quote revision, and that revision's
// authority has nothing to do with whichever lane the Batch Builder work is in.
// Painting "Quick calculation" across an approved 2026 revision would attribute
// the wrong authority to immutable evidence, so on those two views the cue is
// absent and each view states its own artifact's provenance instead.
const JOURNEY_TABS = new Set(["costing", "batch"]);

export default function TopBar(){
  const { batchRows, durableBatch, handleBackup, handleRestore, handleRestoreFile, journey,
    quoteView, restoreRef, setShowChangePassword, setShowProfile, setTab, tab } = useAppState();
  const workingRows = Array.isArray(batchRows) ? batchRows.length : 0;
  const showWorkingRows = workingRows > 0 && (tab === "batch" || tab === "costing");
  const showJourney = !!journey
    && (JOURNEY_TABS.has(tab) || (tab === "items" && quoteView === "working-items"));

  // The Next action must land on the control it names. Navigating to a surface
  // and leaving the user to find the button was the defect: "Build the customer
  // document" opened an EMPTY Working Quote Items view while the control that
  // fills it stayed behind on Batch Builder. So: switch surface only if needed,
  // then focus and flash the named control once it has rendered.
  const goToNext = () => {
    const { surface, focus } = journey.next;
    if (surface && surface !== tab) setTab(surface);
    if (!focus) return;
    // Two frames: one for the tab switch to mount, one for layout.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const el = document.getElementById(focus);
      if (!el) return;
      el.scrollIntoView({ block: "nearest", inline: "nearest" });
      el.focus({ preventScroll: true });
      el.animate?.([{ outline: `2px solid ${C.amber}`, outlineOffset: "2px" },
        { outline: "2px solid transparent", outlineOffset: "2px" }],
      { duration: 1400, easing: "ease-out" });
    }));
  };
  return(
  <div style={{background:C.slate,display:"flex",alignItems:"center",padding:"0 16px",
    height:48,borderBottom:`2px solid ${C.amber}`,flexShrink:0,gap:8}}>
    {/* Context for the otherwise empty bar (UX policy §3): where you are, and
        which Batch is in play — governed or local — at a glance. */}
    <div style={{display:"flex",alignItems:"center",gap:8,minWidth:0,overflow:"hidden"}}>
      <span style={{color:"rgba(255,255,255,.92)",fontSize:T.title,fontWeight:700,whiteSpace:"nowrap"}}>
        {TAB_LABELS[tab] || ""}</span>
      {durableBatch?.batch_reference && <>
        <span aria-hidden="true" style={{color:"rgba(255,255,255,.35)"}}>·</span>
        <span title="Open governed Batch" style={{color:"rgba(255,255,255,.85)",fontFamily:mono,
          fontSize:T.body,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
          {durableBatch.batch_reference}{durableBatch.content_version != null ? ` · v${durableBatch.content_version}` : ""}
        </span>
        <ProvenanceTag kind="governed"/>
      </>}
      {/* The row count keeps its place; its LOCAL tag does not. The journey
          cluster to the right now states the lane once, and two provenance
          signals 60px apart saying the same thing is the repetition the
          2026-09-22 review objects to, not a second reassurance. */}
      {showWorkingRows && <>
        <span aria-hidden="true" style={{color:"rgba(255,255,255,.35)"}}>·</span>
        <span style={{color:"rgba(255,255,255,.75)",fontSize:T.body,whiteSpace:"nowrap"}}>
          {workingRows} working {workingRows === 1 ? "row" : "rows"}</span>
      </>}
    </div>
    {/* The journey, in the band that already exists. The review's CC-13 asks for
        a persistent stage and next-required-action cue; the screen-space standard
        forbids spending a second band on it, so it goes here, where the bar was
        empty. Three facts only: which lane the work is in, how far it has got,
        and the single next thing - each one a claim the user can act on rather
        than a status word they have to interpret. */}
    {showJourney && <div style={{display:"flex",alignItems:"center",gap:8,minWidth:0,
      marginLeft:14,paddingLeft:14,borderLeft:"1px solid rgba(255,255,255,.18)"}}>
      <span title={journey.lane.authority} style={{fontSize:T.micro,fontWeight:800,
        letterSpacing:"0.05em",textTransform:"uppercase",whiteSpace:"nowrap",padding:"2px 7px",
        borderRadius:999,color:journey.lane.governed?C.white:C.amberL,
        background:journey.lane.governed?"rgba(255,255,255,.14)"
          :journey.lane.id==="undecided"||journey.lane.id==="customer_pending"
            ?"rgba(184,50,50,.55)":"rgba(217,123,46,.28)",
        border:`1px ${journey.lane.governed?"solid":"dashed"} rgba(255,255,255,.38)`}}>
        {journey.lane.label}</span>
      <span title={`${journey.stageLabel} — ${journey.stages.find(s=>s.id===journey.stage)?.question||""}`}
        style={{color:"rgba(255,255,255,.72)",fontSize:T.body,whiteSpace:"nowrap"}}>
        Step {journey.stages.findIndex(s=>s.id===journey.stage)+1} of {journey.stages.length} ·{" "}
        <b style={{color:"rgba(255,255,255,.92)",fontWeight:650}}>{journey.stageLabel}</b></span>
      <button type="button" onClick={goToNext}
        title={`Next: ${journey.next.label}\n\n${journey.next.detail}`}
        style={{display:"flex",alignItems:"center",gap:5,minWidth:0,maxWidth:340,padding:"3px 9px",
          borderRadius:5,border:`1px solid ${C.amber}`,background:"rgba(217,123,46,.22)",
          color:C.white,fontFamily:sans,fontSize:T.body,fontWeight:650,cursor:"pointer"}}>
        <span style={{fontSize:T.micro,fontWeight:800,letterSpacing:"0.05em",
          textTransform:"uppercase",color:C.amberL,flexShrink:0}}>Next</span>
        <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
          {journey.next.label}</span>
      </button>
      {/* Only once there is something to send. An empty workspace has an
          unresolved route by definition, and counting that as a fault would
          greet every new session with a red chip it cannot act on. */}
      {journey.counts.rows>0 && journey.counts.toFix>0 && <span
        title={journey.readiness.canSend
          ? "This batch can be sent, but some rows would be left out — the Batch Builder toolbar lists them"
          : "Reasons this batch cannot be sent yet — listed in full in the Batch Builder toolbar"}
        style={{fontSize:T.micro,fontWeight:800,letterSpacing:"0.04em",textTransform:"uppercase",
          whiteSpace:"nowrap",padding:"2px 7px",borderRadius:999,color:C.white,
          background:journey.readiness.canSend?"rgba(217,123,46,.75)":"rgba(184,50,50,.75)",
          border:"1px solid rgba(255,255,255,.3)"}}>
        {journey.counts.toFix} to fix</span>}
    </div>}
    <div style={{marginLeft:"auto",display:"flex",gap:8,alignItems:"center",flexShrink:0}}>
      <AccountMenu onEditProfile={()=>setShowProfile(true)} onChangePassword={()=>setShowChangePassword(true)}/>
      <button onClick={handleBackup} title="Download a full backup of all app data (rates, freight, sectors, constructions, partitions)"
        style={{padding:"4px 10px",borderRadius:5,fontSize:11,fontWeight:600,border:"1px solid rgba(255,255,255,.25)",
          background:"rgba(255,255,255,.10)",color:"rgba(255,255,255,.80)",cursor:"pointer",fontFamily:sans}}>
        ⬇ Backup
      </button>
      <button onClick={handleRestore} title="Restore all app data from a previously downloaded backup file"
        style={{padding:"4px 10px",borderRadius:5,fontSize:11,fontWeight:600,border:"1px solid rgba(255,255,255,.25)",
          background:"rgba(255,255,255,.10)",color:"rgba(255,255,255,.80)",cursor:"pointer",fontFamily:sans}}>
        ⬆ Restore
      </button>
      <input ref={restoreRef} type="file" accept="application/json" style={{display:"none"}}
        onChange={handleRestoreFile}/>
    </div>
  </div>
  );
}
