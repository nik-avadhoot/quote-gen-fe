// ═══════════════════════════════════════════════════════════════════════════
// src/ui/ToastStack.jsx — the toast overlay.
//
// Moved out of QuotationApp.jsx, where it stood as a single ~400-character line.
// The move is BEHAVIOUR-NEUTRAL and exists for one reason: so the D-12
// pointer-events fix lands as a readable three-line diff instead of an edit
// buried inside that line. The diff is the evidence, and it has to be legible.
//
// The rendered output is identical to what stood in the shell. The only change
// is that the `toasts.length>0 &&` JSX guard became an early return — same
// condition, same result, no wrapper element introduced.
//
// ⚠️ D-12 LIVES HERE. The container sets pointerEvents:"none", so a click on a
// toast passes STRAIGHT THROUGH to whatever sits beneath it — on the Costing
// panel that is the `+ New Batch` button. Do not remove that property, and do
// not reposition this stack, without reading D-12 first: the property is not a
// mistake, it is there so the stack does not block the UI underneath, and the
// fix has to keep that property true of the GAPS while making the toasts
// themselves opaque to clicks.
// ═══════════════════════════════════════════════════════════════════════════
import { useAppState } from "../state/AppStateContext.js";
import { C } from "../theme.js";

export default function ToastStack(){
  const { toasts } = useAppState();
  if(!toasts.length)return null;
  return(
    <div style={{position:"fixed",top:68,right:20,zIndex:9999,display:"flex",flexDirection:"column",gap:7,pointerEvents:"none"}}>{toasts.map(t=>(<div key={t.id} style={{padding:"10px 18px",borderRadius:8,fontSize:12,fontWeight:700,color:"white",boxShadow:"0 4px 18px rgba(0,0,0,.2)",maxWidth:300,background:t.type==="success"?C.green:t.type==="error"?C.red:C.amberD}}>{t.msg}</div>))}</div>
  );
}
