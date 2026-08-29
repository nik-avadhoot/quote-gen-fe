// ═══════════════════════════════════════════════════════════════════════════
// src/tabs/ConstructionLibTab.jsx — the paper-construction library.
//
// Extracted from QuotationApp.jsx (Phase 6d). The IIFE
// `const constructionLibTab=(()=>{ … })()` is now a real component, so
// applyClTabFilter / filtered / activeCount are plain locals and the
// clTabQuery / clTabFilter / clTabExpandedConstr trio is local state.
//
// ⚠️ LEAST-TESTED TAB IN THE APP. Verification to date has run
// Costing → Batch → Quote Items; this tab and its cross-tab interactions are
// largely unexercised. Extraction here is STRUCTURAL ONLY — nothing semantic
// changed. If behaviour differs from before, treat it as a fault in this
// extraction until proven otherwise, not as a pre-existing quirk.
//
// ⚠️ DO NOT UNIFY WITH THE APP-LEVEL importConstrFromSpec. This tab carries
// its own inline copy that additionally compares spec_cobb when matching an
// existing entry. The two are deliberately different. Merging them would be a
// behaviour change hidden inside a structural one, in precisely the area with
// the least test coverage.
//
// constrAutoName comes from lib/constructionName.js — it moved there in the
// 6a prerequisite because Batch Entry consumes it too.
//
// Fragment is imported BY NAME on purpose: three sites here need a keyed
// fragment, and `<>` cannot take a key (CLAUDE.md also bans `<>` in rows).
//
// No admin gating anywhere in this tab — every control is available to a Maker.
//
// ⚠️ 6d's payoff is PARTIAL BY DESIGN. Only clTabExpandedConstr became local.
// clTabQuery and clTabFilter stay in useUiState on purpose:
//
//   * Filter and search are "I have narrowed my view" state. This component
//     unmounts on every tab switch, so making them local would clear the filter
//     each time the user glances at Batch Entry and returns. The library is meant
//     to grow into a deep reference set, so that friction scales with the data.
//   * Expansion is "I am reading this one right now" state. Resetting it on
//     return is arguably correct — a clean list beats something half-opened from
//     ten minutes ago.
//
// This is NOT an incomplete extraction. The phase goal was removing state that
// was hoisted BECAUSE Rules of Hooks forced it — not removing all shared state.
// Filter persistence is a deliberate reason to share.
//
// ⚠️ A LABEL EDIT DOES NOT PROPAGATE TO THE BATCH GRID, and that is correct.
// The grid cell renders constrAutoName(ce), which is spec-derived — ply, flutes,
// specs, grades/gsm — and never reads c.name. Editing a construction's Label
// changes this tab's list and nothing downstream; editing a SPEC changes both.
// Expect this before filing it as a bug.
// ═══════════════════════════════════════════════════════════════════════════
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { BOX_TYPES } from "../data/defaults.js";
import { constrAutoName } from "../lib/constructionName.js";
import { findDuplicate, hasIdentity, sameConstruction } from "../lib/constructionIdentity.js";
import { useAppState } from "../state/AppStateContext.js";
import { C, mono } from "../theme.js";

export default function ConstructionLibTab(){
  const {
    showToast, constructionLib, setConstructionLib,
    rates, sectorCodes, spec, batchProfile, batchRows,
    clTabQuery, setClTabQuery, clTabFilter, setClTabFilter,
  } = useAppState();
  const[clTabExpandedConstr,setClTabExpandedConstr]=useState(null);

  // ── D-11 PATH 3: the DERIVED duplicate warning ─────────────────────────────
  // "+ New Construction" has NO commit point. The row is appended already
  // status:"active", every field is edited inline, and there is no save button,
  // no blur handler and no collapse-with-changes anywhere in this tab — every
  // keystroke persists immediately. So there is no instant at which to BLOCK.
  //
  // ⚠️ THIS PATH WARNS WHERE THE OTHER THREE BLOCK. The asymmetry is structural,
  // not an oversight — see D-11 in the register, and PM-1, which carries the
  // draft/Save-Cancel model that a real block here would need.
  //
  // Derived state, same shape as D-28: recomputed from the library itself, so it
  // needs no trigger. It appears the moment a row identity matches another and
  // disappears if the Maker edits it apart. Blank drafts are excluded via
  // hasIdentity, or every fresh row would flag against every other fresh row.
  const _dupOf=useMemo(()=>{
    const m={};
    (constructionLib||[]).forEach((c,i)=>{
      if(!hasIdentity(c))return;
      const twin=(constructionLib||[]).find((o,j)=>j<i&&hasIdentity(o)&&sameConstruction(o,c));
      if(twin)m[c.code]=twin.code;
    });
    return m;
  },[constructionLib]);

  // ── D-20: bring the expanded entry into view ───────────────────────────────
  // "+ New Construction" appends at the BOTTOM of the list. The entry was already
  // being expanded correctly (setClTabExpandedConstr uses the full-array index,
  // which matches the ci computed at the row map) — it was simply off-screen, so
  // the Maker saw nothing happen and could not tell the click had registered.
  //
  // Reclassified from UX to load-bearing when D-11 shipped: path 3 can only WARN
  // about a duplicate, and the warning renders on the very row that cannot be
  // seen. A warning nobody sees is not a warning.
  //
  // block:"nearest" IS the guard. It scrolls the minimum distance and does
  // NOTHING when the element is already fully in view, so expanding a row the
  // Maker just clicked on does not jump the page. No extra visibility test needed.
  const _rowRefs=useRef({});
  useEffect(()=>{
    if(clTabExpandedConstr==null)return;              // collapse — nothing to show
    const el=_rowRefs.current[clTabExpandedConstr];
    // NO behavior:"smooth" — MEASURED as a no-op in this scroll container. With it,
    // scrollTop stayed at 0; without it the same call scrolls 0 -> 1264. Instant is
    // also the correct behaviour here: the Maker clicked something and needs to see
    // it, not watch it travel.
    if(el&&el.scrollIntoView)el.scrollIntoView({block:"nearest"});
  },[clTabExpandedConstr]);

    // Filter logic for the full tab
    const applyClTabFilter=c=>{
      if(clTabFilter.status!=='all'&&(c.status||'active')!==clTabFilter.status)return false;
      if(clTabFilter.sector&&(c.sector||'')!==clTabFilter.sector)return false;
      if(clTabFilter.client&&(c.client||'')!==clTabFilter.client)return false;
      if(clTabFilter.gsm_min&&+c.board_gsm<+clTabFilter.gsm_min)return false;
      if(clTabFilter.gsm_max&&+c.board_gsm>+clTabFilter.gsm_max)return false;
      if(clTabFilter.bs_min&&+c.spec_bs<+clTabFilter.bs_min)return false;
      if(clTabFilter.bct_min&&+c.spec_bct<+clTabFilter.bct_min)return false;
      if(clTabFilter.ect_min&&+c.spec_ect<+clTabFilter.ect_min)return false;
      if(clTabFilter.cobb_max&&c.spec_cobb&&+c.spec_cobb>+clTabFilter.cobb_max)return false;
      // text search
      if(clTabQuery){
        const q=clTabQuery.toLowerCase();
        const autoN=constrAutoName(c).toLowerCase();
        if(!c.code.toLowerCase().includes(q)&&!autoN.includes(q)&&
           !(c.name||'').toLowerCase().includes(q)&&
           !(c.sector||'').toLowerCase().includes(q)&&
           !(c.client||'').toLowerCase().includes(q))return false;
      }
      return true;
    };
    const filtered=constructionLib.filter(applyClTabFilter);
    const activeCount=constructionLib.filter(c=>(c.status||'active')==='active').length;
    const archivedCount=constructionLib.filter(c=>(c.status||'active')==='archived').length;
    const hasFilter=clTabFilter.status!=='active'||clTabFilter.sector||clTabFilter.client||
      clTabFilter.gsm_min||clTabFilter.gsm_max||clTabFilter.bs_min||clTabFilter.bct_min||
      clTabFilter.ect_min||clTabFilter.cobb_max||clTabQuery;
    return(
    <div style={{display:"flex",height:"100%",overflow:"hidden"}}>
      {/* LEFT SIDEBAR: Filters + Stats */}
      <div style={{width:240,flexShrink:0,borderRight:`1px solid ${C.border}`,overflowY:"auto",
        padding:"14px 12px",background:C.cream,display:"flex",flexDirection:"column",gap:8}}>
        <div style={{fontSize:13,fontWeight:700,color:C.slate}}>Construction Library</div>
        {/* Stats strip */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:5}}>
          {[["Total",constructionLib.length,C.slateM],["Active",activeCount,C.green],
            ["Archived",archivedCount,C.slateL],
            ["Sectors",[...new Set(constructionLib.map(c=>c.sector||'').filter(Boolean))].length,C.amber]].map(([l,v,col])=>(
            <div key={l} style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:6,padding:"7px 10px",textAlign:"center"}}>
              <div style={{fontSize:16,fontWeight:800,color:col,fontFamily:mono}}>{v}</div>
              <div style={{fontSize:9,color:C.slateL,textTransform:"uppercase",letterSpacing:"0.06em"}}>{l}</div>
            </div>))}
        </div>
        {/* Search */}
        <div style={{position:"relative"}}>
          <input value={clTabQuery} onChange={e=>setClTabQuery(e.target.value)}
            placeholder="Search code, name, sector, client…"
            style={{width:"100%",padding:"5px 22px 5px 8px",border:`1px solid ${clTabQuery?C.amber:C.border}`,
              borderRadius:5,fontSize:11,boxSizing:"border-box"}}/>
          {clTabQuery&&<button onClick={()=>setClTabQuery('')}
            style={{position:"absolute",right:4,top:"50%",transform:"translateY(-50%)",
              background:"none",border:"none",cursor:"pointer",fontSize:11,color:C.slateL}}>✕</button>}
        </div>
        {/* Status filter */}
        <div>
          <div style={{fontSize:9,fontWeight:700,color:C.slateL,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:4}}>Status</div>
          <div style={{display:"flex",gap:3}}>
            {["active","archived","all"].map(s=>(
              <button key={s} onClick={()=>setClTabFilter(p=>({...p,status:s}))}
                style={{flex:1,padding:"3px 0",borderRadius:4,fontSize:10,fontWeight:600,cursor:"pointer",
                  border:`1px solid ${clTabFilter.status===s?C.amber:C.border}`,
                  background:clTabFilter.status===s?C.amber:C.white,
                  color:clTabFilter.status===s?C.white:C.slateL,textTransform:"capitalize"}}>
                {s}</button>))}
          </div>
        </div>
        {/* Sector */}
        <div>
          <div style={{fontSize:9,fontWeight:700,color:C.slateL,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:4}}>Sector</div>
          <select value={clTabFilter.sector||''} onChange={e=>setClTabFilter(p=>({...p,sector:e.target.value,client:''}))}
            style={{width:"100%",padding:"4px 6px",border:`1px solid ${clTabFilter.sector?C.amber:C.border}`,borderRadius:4,fontSize:11,color:C.slate,background:C.white}}>
            <option value="">All Sectors</option>
            {[...new Set(constructionLib.map(c=>c.sector||'').filter(Boolean))].sort()
              .map(s=><option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        {/* Client */}
        <div>
          <div style={{fontSize:9,fontWeight:700,color:C.slateL,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:4}}>Client</div>
          <select value={clTabFilter.client||''} onChange={e=>setClTabFilter(p=>({...p,client:e.target.value}))}
            style={{width:"100%",padding:"4px 6px",border:`1px solid ${clTabFilter.client?C.amber:C.border}`,borderRadius:4,fontSize:11,color:C.slate,background:C.white}}>
            <option value="">All Clients</option>
            {[...new Set(constructionLib
              .filter(c=>!clTabFilter.sector||(c.sector||'')===clTabFilter.sector)
              .map(c=>c.client||'').filter(Boolean))].sort()
              .map(cl=><option key={cl} value={cl}>{cl}</option>)}
          </select>
        </div>
        {/* Spec range filters */}
        <div>
          <div style={{fontSize:9,fontWeight:700,color:C.slateL,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:4}}>Spec Ranges</div>
          <div style={{display:"flex",flexDirection:"column",gap:4}}>
            {[["gsm_min","GSM ≥"],["gsm_max","GSM ≤"],["bs_min","BS ≥"],
              ["bct_min","BCT ≥"],["ect_min","ECT ≥"],["cobb_max","Cobb ≤"]].map(([k,lbl])=>(
              <div key={k} style={{display:"flex",alignItems:"center",gap:5}}>
                <span style={{fontSize:9,color:C.slateL,minWidth:52}}>{lbl}</span>
                <input type="number" step={0.25} value={clTabFilter[k]||''}
                  onChange={e=>setClTabFilter(p=>({...p,[k]:e.target.value}))}
                  style={{flex:1,padding:"3px 5px",border:`1px solid ${clTabFilter[k]?C.amber:C.border}`,
                    borderRadius:4,fontSize:10,textAlign:"center"}}/>
              </div>))}
          </div>
        </div>
        {hasFilter&&<button onClick={()=>{setClTabFilter({sector:'',client:'',status:'active'});setClTabQuery('');}}
          style={{padding:"4px",borderRadius:5,border:`1px solid ${C.red}33`,
            background:"transparent",color:C.red,fontSize:10,cursor:"pointer",fontWeight:600}}>
          ✕ Clear all filters
        </button>}
        <div style={{fontSize:9,color:C.slateL,borderTop:`1px solid ${C.border}`,paddingTop:6,marginTop:4}}>
          {filtered.length}/{constructionLib.length} shown
        </div>
      </div>

      {/* RIGHT: Library entries */}
      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
        {/* Toolbar */}
        <div style={{padding:"8px 16px",borderBottom:`1px solid ${C.border}`,
          display:"flex",gap:8,alignItems:"center",background:C.cream,flexShrink:0}}>
          <button onClick={()=>{
            // Fix 14: first unused letter, not array.length — prevents code reuse after deletions
            const _LETTERS="ABCDEFGHIJKLMNOPQRSTUVWXYZ";
            const _used=new Set(constructionLib.map(c=>c.code));
            const code=_LETTERS.split("").find(l=>!_used.has(l))||`C${constructionLib.length}`;
            const newEntry={code,name:"",boxType:"RSC",ply:5,
              flute_F1:"B",flute_F2:"A",
              layers:{TOP:{code:"",gsm:""},F1:{code:"",gsm:""},
                L1:{code:"",gsm:""},F2:{code:"",gsm:""},L2:{code:"",gsm:""}},
              waste:null,convRate:null,wastePP:null,convRatePP:null,
              sector:batchProfile.sector||"",client:batchProfile.client||"",status:"active",
              mill_preferences:{TOP:{grade:"",mill:""},F1:{grade:"",mill:""},L1:{grade:"",mill:""},
                F2:{grade:"",mill:""},L2:{grade:"",mill:""}},
              // D-11 enabler — see the note at the bridge's creation path. Additive only.
              // This is the UNGUARDED path (no duplicate check at all) and hypothesis A's
              // candidate, so its provenance is the one most worth recording.
              createdVia:"tab-new",createdAt:new Date().toISOString()};
            setConstructionLib(prev=>[...prev,newEntry]);
            setClTabExpandedConstr(String(constructionLib.length));
            // D-20: this was the only append path that gave NO feedback at all.
            // tab-import already toasts. Name the code and say what to do next,
            // matching D-11's badge discipline.
            showToast(`✅ New construction [${code}] — fill in its specs`,'success',4000);
            setClTabFilter({sector:'',client:'',status:'active'});
            setClTabQuery('');
          }} style={{padding:"5px 14px",borderRadius:6,border:"none",
            background:C.green,color:C.white,fontSize:12,fontWeight:700,cursor:"pointer"}}>
            + New Construction
          </button>
          <button onClick={()=>{
            // ── Duplicate check: exact match on all 5 STDs + Sector ──────────
            // If an existing construction matches on board_gsm, spec_bs, spec_bct,
            // spec_ect, spec_cobb AND sector, it is the same construction regardless
            // of client. Prompt user to add client to the existing entry instead.
            const incomingSector=spec.sector||batchProfile.sector||"";
            // D-11: was 4 board specs + spec_cobb + SECTOR. Now the shared 9-field
            // predicate — drops sector AND spec_cobb, gains ply/flutes/boxType/layers.
            // The client-merge branch below is KEPT and will now fire more often,
            // including ACROSS SECTORS. That is the ruling working: a construction
            // used by two clients in different sectors is one construction with two
            // client tags.
            const duplicate=findDuplicate(constructionLib,spec);
            if(duplicate){
              const incomingClient=spec.client||batchProfile.client||"";
              const existingClient=duplicate.client||"";
              const msg=incomingClient&&incomingClient!==existingClient
                // D-11: the old text named SECTOR as a matched field and listed Cobb —
                // both wrong now, and wrong in the exact case this branch fires most.
                // A Maker reading it learned the wrong model of what makes two
                // constructions the same. It now names the fields that ACTUALLY matched.
                //
                // D-35: it also states the sector asymmetry PLAINLY rather than
                // explaining it away. Client tags accumulate; sector tags do not. Saying
                // so is more useful than implying sector does not matter — the Maker can
                // then decide what to do about it.
                ?`[${duplicate.code}] is the same construction — same board specs `+
                 `(GSM ${duplicate.board_gsm||"—"}, BS ${duplicate.spec_bs||"—"}), `+
                 `ply ${duplicate.ply||"—"}, flutes ${duplicate.flute_F1||"—"}/${duplicate.flute_F2||"—"}, `+
                 `box type ${duplicate.boxType||"—"} and paper layers.\n\n`+
                 `Sector and client are tags, not identity. `+
                 `[${duplicate.code}] stays tagged ${duplicate.sector||"—"} — this import's `+
                 `${incomingSector||"—"} tag is not added.\n\n`+
                 `OK = add "${incomingClient}" to [${duplicate.code}]'s client tags\n`+
                 `Cancel = leave [${duplicate.code}] unchanged`
                :`[${duplicate.code}] is the same construction — same board specs `+
                 `(GSM ${duplicate.board_gsm||"—"}, BS ${duplicate.spec_bs||"—"}), `+
                 `ply ${duplicate.ply||"—"}, flutes ${duplicate.flute_F1||"—"}/${duplicate.flute_F2||"—"}, `+
                 `box type ${duplicate.boxType||"—"} and paper layers.\n\n`+
                 `Sector and client are tags, not identity.\n\nNo duplicate will be created.`;
              if(incomingClient&&incomingClient!==existingClient){
                if(window.confirm(msg)){
                  // Add incoming client to existing construction's client field
                  const mergedClient=existingClient?`${existingClient}, ${incomingClient}`:incomingClient;
                  setConstructionLib(prev=>prev.map(c=>c.code===duplicate.code?{...c,client:mergedClient}:c));
                  // Expand the existing entry so user can review
                  const idx=constructionLib.findIndex(c=>c.code===duplicate.code);
                  setClTabExpandedConstr(String(idx));
                  setClTabFilter({sector:'',client:'',status:'active'});
                  setClTabQuery('');
                  showToast(`✅ Client "${incomingClient}" added to existing [${duplicate.code}]`,'success',4000);
                }
              } else {
                window.alert(msg);
                // Highlight the existing entry
                const idx=constructionLib.findIndex(c=>c.code===duplicate.code);
                setClTabExpandedConstr(String(idx));
              }
              return; // always stop — never create the duplicate
            }
            // ── No duplicate — proceed with import ───────────────────────────
            // Fix 14: first unused letter, not array.length
            const _ltrs="ABCDEFGHIJKLMNOPQRSTUVWXYZ";
            const _usedC=new Set(constructionLib.map(c=>c.code));
            const nextCode=_ltrs.split("").find(l=>!_usedC.has(l))||`C${constructionLib.length}`;
            const newConstr={
              code:nextCode,name:"",
              boxType:spec.boxType||"RSC",ply:spec.ply||5,
              flute_F1:spec.flute_F1||"B",flute_F2:spec.flute_F2||"A",
              layers:JSON.parse(JSON.stringify(spec.layers||{})),
              board_gsm:spec.board_gsm||"",spec_bs:spec.spec_bs||"",
              spec_bct:spec.spec_bct||"",spec_ect:spec.spec_ect||"",
              waste:null,convRate:null,wastePP:null,convRatePP:null,
              sector:incomingSector,
              client:spec.client||batchProfile.client||"",
              status:"active",
              mill_preferences:{TOP:{grade:"",mill:""},F1:{grade:"",mill:""},L1:{grade:"",mill:""},
                F2:{grade:"",mill:""},L2:{grade:"",mill:""}},
              // D-11 enabler — see the note at the bridge's creation path. Additive only.
              createdVia:"tab-import",createdAt:new Date().toISOString(),
            };
            setConstructionLib(prev=>[...prev,newConstr]);
            setClTabExpandedConstr(String(constructionLib.length));
            showToast(`✅ Imported as [${nextCode}] — review and save`,'success');
          }} style={{padding:"5px 14px",borderRadius:6,border:`1px solid ${C.amber}`,
            background:C.amberL,color:C.amberD,fontSize:12,fontWeight:700,cursor:"pointer"}}>
            ↓ Import from Costing
          </button>
          <div style={{fontSize:11,color:C.slateL,marginLeft:4}}>
            {constructionLib.length===0?"Library is empty — create your first construction."
              :`${filtered.length} construction${filtered.length!==1?"s":""} shown`}
          </div>
        </div>

        {/* Scrollable entries */}
        <div style={{flex:1,overflowY:"auto",padding:"12px 16px"}}>
          {constructionLib.length===0&&(
            <div style={{textAlign:"center",padding:"40px 0",color:C.slateL}}>
              <div style={{fontSize:32,marginBottom:10}}>🏗</div>
              <div style={{fontSize:14,fontWeight:600,color:C.slateM,marginBottom:6}}>No constructions yet</div>
              <div style={{fontSize:12}}>Click "+ New Construction" above to build your first construction profile,<br/>
                or switch to Costing tab, set up a paper construction, then click "↓ Import from Costing".</div>
            </div>)}

          {filtered.length===0&&constructionLib.length>0&&(
            <div style={{textAlign:"center",padding:"32px 0",color:C.slateL}}>
              <div style={{fontSize:13,fontWeight:600}}>No matches</div>
              <div style={{fontSize:11,marginTop:4}}>Try clearing filters on the left</div>
            </div>)}

          {filtered.map(c=>{
            const ci=constructionLib.indexOf(c);
            const expandKey=String(ci);
            const autoN=constrAutoName(c);
            const isArchived=(c.status||'active')==='archived';
            // Traceability: which batch rows use this construction
            const batchUses=batchRows.filter(r=>r.constructionCode===c.code);
            return(
            <div key={expandKey} ref={el=>{_rowRefs.current[expandKey]=el;}}
              style={{marginBottom:8,border:`1px solid ${clTabExpandedConstr===expandKey?C.amber:C.border}`,
              borderRadius:7,opacity:isArchived?0.65:1,background:C.white}}>
              {/* Header row */}
              <div style={{display:"flex",alignItems:"flex-start",padding:"10px 14px",
                background:clTabExpandedConstr===expandKey?C.amberL:C.white,
                borderRadius:clTabExpandedConstr===expandKey?"7px 7px 0 0":"7px",
                cursor:"pointer"}}
                onClick={()=>setClTabExpandedConstr(clTabExpandedConstr===expandKey?null:expandKey)}>
                {/* Code badge */}
                <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2,marginRight:10,flexShrink:0}}>
                  <span style={{fontWeight:900,color:C.amber,fontFamily:mono,fontSize:15,lineHeight:1}}>{c.code}</span>
                  {isArchived&&<span style={{fontSize:7,color:C.slateL,background:"#eee",borderRadius:2,padding:"0 3px",textTransform:"uppercase"}}>arch</span>}
                </div>
                {/* Auto-name + tags */}
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:12,fontWeight:700,color:C.slateM,lineHeight:1.3}}>{autoN}</div>
                  {c.name&&<div style={{fontSize:10,color:C.slateL,fontStyle:"italic",marginTop:1}}>{c.name}</div>}
                  <div style={{display:"flex",gap:4,marginTop:4,flexWrap:"wrap",alignItems:"center"}}>
                    {c.sector&&<span style={{fontSize:9,background:C.amberL,color:C.amberD,borderRadius:3,padding:"1px 5px"}}>{c.sector}</span>}
                    {c.client&&<span style={{fontSize:9,background:"#EEF4FB",color:"#2E6094",borderRadius:3,padding:"1px 5px"}}>{c.client}</span>}
                    {c.spec_bs&&<span style={{fontSize:9,background:"#F0FFF4",color:C.green,borderRadius:3,padding:"1px 5px"}}>BS≥{c.spec_bs}</span>}
                    {c.spec_bct&&<span style={{fontSize:9,background:"#F0FFF4",color:C.green,borderRadius:3,padding:"1px 5px"}}>BCT≥{c.spec_bct}kgf</span>}
                    {c.board_gsm&&<span style={{fontSize:9,background:C.cream,color:C.slateM,borderRadius:3,padding:"1px 5px"}}>{c.board_gsm}gsm</span>}
                    {batchUses.length>0&&<span style={{fontSize:9,background:"#EEF4FB",color:"#2E6094",borderRadius:3,padding:"1px 5px"}}>
                      ↳ {batchUses.length} batch row{batchUses.length>1?"s":""}</span>}
                    {/* D-11 path 3: the badge says SAVED on purpose. This path cannot
                        refuse — there is no save step to refuse at — so the entry exists
                        whether or not the Maker acts. Stating that is the limitation
                        disclosed where it is met, rather than only in the register. The
                        tooltip's second paragraph exists so "SAVED" reads as a known
                        limit and not as a bug. */}
                    {_dupOf[c.code]&&<span
                      title={`[${_dupOf[c.code]}] is the same construction — same board specs, ply, flutes, box type and paper layers. Sector and client are tags, not identity.\n\nThis entry was saved. The library has no save step, so a duplicate here cannot be refused — only flagged.\n\nEdit it into something distinct, or delete it and use [${_dupOf[c.code]}].`}
                      style={{fontSize:9,background:"#FFF1F0",color:C.red,border:`1px solid ${C.red}55`,
                        borderRadius:3,padding:"1px 5px",fontWeight:700}}>
                      ⚠ SAVED as a duplicate of [{_dupOf[c.code]}] — edit or delete</span>}
                  </div>
                </div>
                {/* Actions */}
                <div style={{display:"flex",gap:4,flexShrink:0,marginLeft:8,alignItems:"center"}}>
                  <button onClick={e=>{e.stopPropagation();
                    setConstructionLib(prev=>prev.map((x,j)=>j===ci?{...x,status:isArchived?"active":"archived"}:x));}}
                    title={isArchived?"Restore":"Archive"}
                    style={{background:"none",border:`1px solid ${C.border}`,borderRadius:4,
                      color:C.slateL,cursor:"pointer",fontSize:11,padding:"3px 6px"}}>
                    {isArchived?"↩ Restore":"📦 Archive"}</button>
                  <button onClick={e=>{e.stopPropagation();
                    // Fix 14: name affected batch rows before deleting — batchUses already computed
                    const msg=batchUses.length>0
                      ?`Delete construction [${c.code}]?\n\n⚠️ ${batchUses.length} batch row(s) use this construction:\n${batchUses.map(r=>`  · ${r.matCode||"(no code)"} ${r.product?`— ${r.product}`:""}`).join("\n")}\n\nThose rows will lose their construction and be dropped by Send All. This cannot be undone.`
                      :`Delete construction [${c.code}]? This cannot be undone.`;
                    if(window.confirm(msg)){
                      setConstructionLib(prev=>prev.filter((_,j)=>j!==ci));
                      if(clTabExpandedConstr===expandKey)setClTabExpandedConstr(null);
                    }}}
                    style={{background:"none",border:`1px solid ${C.red}44`,borderRadius:4,
                      color:C.red,cursor:"pointer",fontSize:11,padding:"3px 6px"}}>Delete</button>
                  <span style={{fontSize:11,color:C.slateL}}>{clTabExpandedConstr===expandKey?"▴":"▾"}</span>
                </div>
              </div>

              {/* Expanded editor */}
              {clTabExpandedConstr===expandKey&&(
              <div style={{padding:"14px 16px",borderTop:`1px solid ${C.border}`,background:"#FAFAFA",
                borderRadius:"0 0 7px 7px"}}>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px 20px"}}>
                  {/* Left col: Identity + Tagging */}
                  <div>
                    <div style={{fontSize:10,fontWeight:700,color:C.amber,textTransform:"uppercase",
                      letterSpacing:"0.07em",marginBottom:8,borderBottom:`1px solid ${C.border}`,paddingBottom:4}}>
                      Identity &amp; Classification
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"80px 1fr",gap:"5px 10px",alignItems:"center"}}>
                      {[["Code","code"],["Label","name"]].map(([lbl,k])=>(
                        <Fragment key={k}>
                          <div style={{fontSize:10,color:C.slateL,fontWeight:600}}>{lbl}</div>
                          <input value={c[k]||""} onChange={e=>setConstructionLib(prev=>prev.map((x,j)=>j===ci?{...x,[k]:e.target.value}:x))}
                            style={{padding:"4px 8px",border:`1px solid ${C.border}`,borderRadius:4,fontSize:11}}/>
                        </Fragment>))}
                      <div style={{fontSize:10,color:C.slateL,fontWeight:600}}>Sector</div>
                      <select value={c.sector||""} onChange={e=>setConstructionLib(prev=>prev.map((x,j)=>j===ci?{...x,sector:e.target.value}:x))}
                        style={{padding:"4px 6px",border:`1px solid ${C.border}`,borderRadius:4,fontSize:10,color:C.slate}}>
                        <option value="">— any —</option>
                        {sectorCodes.map(s=><option key={s} value={s}>{s}</option>)}
                      </select>
                      <div style={{fontSize:10,color:C.slateL,fontWeight:600}}>Client</div>
                      <input value={c.client||""} placeholder="e.g. Indorama, ITC"
                        onChange={e=>setConstructionLib(prev=>prev.map((x,j)=>j===ci?{...x,client:e.target.value}:x))}
                        style={{padding:"4px 8px",border:`1px solid ${C.border}`,borderRadius:4,fontSize:11}}/>
                      <div style={{fontSize:10,color:C.slateL,fontWeight:600}}>Status</div>
                      <select value={c.status||"active"} onChange={e=>setConstructionLib(prev=>prev.map((x,j)=>j===ci?{...x,status:e.target.value}:x))}
                        style={{padding:"4px 6px",border:`1px solid ${C.border}`,borderRadius:4,fontSize:11,color:C.slate}}>
                        <option value="active">Active</option>
                        <option value="archived">Archived</option>
                      </select>
                    </div>
                    {/* Std specs */}
                    <div style={{fontSize:10,fontWeight:700,color:C.amber,textTransform:"uppercase",
                      letterSpacing:"0.07em",margin:"12px 0 8px",borderBottom:`1px solid ${C.border}`,paddingBottom:4}}>
                      Standard Specification
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"80px 1fr",gap:"5px 10px",alignItems:"center"}}>
                      {[["board_gsm","Board GSM","g/m²"],["spec_bs","BS NLT","kg/cm²"],
                        ["spec_bct","BCT NLT","kgf"],["spec_ect","ECT NLT","kN/m"],
                        ["spec_cobb","Cobb Max","g/m²"]].map(([fk,lbl,unit])=>(
                        <Fragment key={fk}>
                          <div style={{fontSize:10,color:C.slateL}}>{lbl} <span style={{fontSize:8}}>({unit})</span></div>
                          <input type="number" step={fk==="board_gsm"?5:0.25} value={c[fk]||""}
                            onChange={e=>setConstructionLib(prev=>prev.map((x,j)=>j===ci?{...x,[fk]:e.target.value}:x))}
                            style={{padding:"4px 8px",border:`1px solid ${C.border}`,borderRadius:4,fontSize:11,width:100}}
                            placeholder={lbl}/>
                        </Fragment>))}
                    </div>
                    {/* Traceability */}
                    {batchUses.length>0&&(
                      <div style={{marginTop:12,padding:"7px 10px",background:"#EEF4FB",
                        border:"1px solid #6A9FD433",borderRadius:5}}>
                        <div style={{fontSize:9,fontWeight:700,color:"#2E6094",marginBottom:3}}>
                          ↳ Used in current Batch Entry ({batchUses.length} row{batchUses.length>1?"s":""})</div>
                        {batchUses.map(r=>(
                          <div key={r.id} style={{fontSize:9,color:"#2E6094",paddingLeft:6}}>
                            · {r.matCode||"—"} {r.product?`— ${r.product}`:""}</div>))}
                      </div>)}
                  </div>

                  {/* Right col: Construction + Paper Layers */}
                  <div>
                    <div style={{fontSize:10,fontWeight:700,color:C.amber,textTransform:"uppercase",
                      letterSpacing:"0.07em",marginBottom:8,borderBottom:`1px solid ${C.border}`,paddingBottom:4}}>
                      Construction
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"80px 1fr",gap:"5px 10px",alignItems:"center",marginBottom:10}}>
                      <div style={{fontSize:10,color:C.slateL}}>Ply</div>
                      <select value={c.ply||5} onChange={e=>{
                        const newPly=+e.target.value;
                        // Fix 7: switching to 3-ply must clear F2/L2 layers — leaving them causes ~40-60% overcost
                        if(newPly===3&&(c.layers?.F2?.code||c.layers?.F2?.gsm||c.layers?.L2?.code||c.layers?.L2?.gsm)){
                          if(!window.confirm("Switch to 3-ply? F2 and L2 layer data will be cleared. This prevents overcost from unused layers."))return;
                          setConstructionLib(prev=>prev.map((x,j)=>j===ci?{...x,ply:3,flute_F2:"",
                            layers:{...x.layers,F2:{code:"",gsm:""},L2:{code:"",gsm:""}}}:x));
                        } else {
                          setConstructionLib(prev=>prev.map((x,j)=>j===ci?{...x,ply:newPly}:x));
                        }
                      }}
                        style={{padding:"4px 6px",border:`1px solid ${C.border}`,borderRadius:4,fontSize:11}}>
                        <option value={3}>3-ply</option><option value={5}>5-ply</option>
                      </select>
                      <div style={{fontSize:10,color:C.slateL}}>Box Type</div>
                      <select value={c.boxType||"RSC"} onChange={e=>setConstructionLib(prev=>prev.map((x,j)=>j===ci?{...x,boxType:e.target.value}:x))}
                        style={{padding:"4px 6px",border:`1px solid ${C.border}`,borderRadius:4,fontSize:11}}>
                        {BOX_TYPES.map(b=><option key={b} value={b}>{b}</option>)}
                      </select>
                      <div style={{fontSize:10,color:C.slateL}}>F1 Flute</div>
                      <select value={c.flute_F1||"B"} onChange={e=>setConstructionLib(prev=>prev.map((x,j)=>j===ci?{...x,flute_F1:e.target.value}:x))}
                        style={{padding:"4px 6px",border:`1px solid ${C.border}`,borderRadius:4,fontSize:11}}>
                        {["A","B","C","E"].map(f=><option key={f} value={f}>{f}</option>)}
                      </select>
                      {+c.ply===5&&<Fragment>
                        <div style={{fontSize:10,color:C.slateL}}>F2 Flute</div>
                        <select value={c.flute_F2||"A"} onChange={e=>setConstructionLib(prev=>prev.map((x,j)=>j===ci?{...x,flute_F2:e.target.value}:x))}
                          style={{padding:"4px 6px",border:`1px solid ${C.border}`,borderRadius:4,fontSize:11}}>
                          {["A","B","C","E"].map(f=><option key={f} value={f}>{f}</option>)}
                        </select>
                      </Fragment>}
                    </div>
                    <div style={{fontSize:10,fontWeight:700,color:C.amber,textTransform:"uppercase",
                      letterSpacing:"0.07em",marginBottom:6,borderBottom:`1px solid ${C.border}`,paddingBottom:4}}>
                      Paper Layers
                    </div>
                    {[["TOP","TOP Liner",false],["F1","F1 Medium",true],["L1","L1 Liner",false],
                      ...(+c.ply===5?[["F2","F2 Medium",true],["L2","L2 Liner",false]]:[])].map(([lk,llbl])=>(
                      <div key={lk} style={{display:"grid",gridTemplateColumns:"60px 1fr 70px",gap:"3px 6px",marginBottom:4,alignItems:"center"}}>
                        <div style={{fontSize:10,color:C.slateL,fontWeight:600}}>{llbl}</div>
                        <select value={(c.layers||{})[lk]?.code||""}
                          onChange={e=>setConstructionLib(prev=>prev.map((x,j)=>j===ci?{...x,layers:{...x.layers,[lk]:{...(x.layers?.[lk]||{}),code:e.target.value}}}:x))}
                          style={{padding:"3px 5px",border:`1px solid ${C.border}`,borderRadius:4,fontSize:10,fontFamily:mono}}>
                          <option value="">—</option>{rates.map(r=><option key={r.code} value={r.code}>{r.code}</option>)}
                        </select>
                        <input type="number" placeholder="GSM" value={(c.layers||{})[lk]?.gsm||""}
                          onChange={e=>setConstructionLib(prev=>prev.map((x,j)=>j===ci?{...x,layers:{...x.layers,[lk]:{...(x.layers?.[lk]||{}),gsm:e.target.value}}}:x))}
                          style={{padding:"3px 5px",border:`1px solid ${C.border}`,borderRadius:4,fontSize:10,textAlign:"center"}}/>
                      </div>))}
                  </div>
                </div>
              </div>)}
            </div>);
          })}
        </div>
      </div>
    </div>);
}
