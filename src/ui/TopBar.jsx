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
  conlib: "Construction Library", constrlib: "Construction Library", gsm: "GSM Master",
  defaults: "Commercial Policies", rates: "Rate Masters", freight: "Freight Masters",
  pricingbasis: "Pricing Basis Releases", users: "Users & Access", plants: "Producing Plants",
};

export default function TopBar(){
  const { batchRows, durableBatch, handleBackup, handleRestore, handleRestoreFile, restoreRef,
    setShowChangePassword, setShowProfile, tab } = useAppState();
  const workingRows = Array.isArray(batchRows) ? batchRows.length : 0;
  const showWorkingRows = workingRows > 0 && (tab === "batch" || tab === "costing");
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
      {showWorkingRows && <>
        <span aria-hidden="true" style={{color:"rgba(255,255,255,.35)"}}>·</span>
        <span style={{color:"rgba(255,255,255,.75)",fontSize:T.body,whiteSpace:"nowrap"}}>
          {workingRows} working {workingRows === 1 ? "row" : "rows"}</span>
        <ProvenanceTag kind="local"/>
      </>}
    </div>
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
