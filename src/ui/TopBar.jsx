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
import { C, sans } from "../theme.js";

export default function TopBar(){
  const { handleBackup, handleRestore, handleRestoreFile, restoreRef,
    setShowChangePassword, setShowProfile } = useAppState();
  return(
  <div style={{background:C.slate,display:"flex",alignItems:"center",padding:"0 16px",
    height:48,borderBottom:`2px solid ${C.amber}`,flexShrink:0,gap:8}}>
    <div style={{marginLeft:"auto",display:"flex",gap:8,alignItems:"center"}}>
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
