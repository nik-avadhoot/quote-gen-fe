// ═══════════════════════════════════════════════════════════════════════════
// src/state/useQuoteActions.js
//
// Cross-slice handlers that are not part of the Costing<->Batch bridge:
// backup/restore, quote-item add/remove/load, per-row calculation, bulk send
// to Quote Items, material-code generation and construction import.
//
// generateCode/generateMissingCodes are kept adjacent on purpose: they derive
// the code prefix from batchProfile.client free text, and that is where the
// Prospect-temp-code -> Customer-code conversion will land when
// CustomerMaster / SKUMaster arrive.
//
// Extracted verbatim from QuotationApp.jsx (Phase 4). The bodies below are
// byte-identical to the monolith; only the surrounding closure changed.
// ═══════════════════════════════════════════════════════════════════════════
import { buildSpecFromRow, calcCosting, checkSpecCompliance } from "../engine/costing.js";
import { applyAddOns, isPPType } from "../engine/rowType.js";
import { parseImportedExcel } from "../export/importExcel.js";
import { toB64 } from "../export/toB64.js";
import { C } from "../theme.js";
import { getItem, setItem } from "../lib/persist.js";

export function useQuoteActions(st){
  const { autoCalcPPDims, autoCodeEnabled, autoCodeSeq, batchProfile, batchResults, batchRows, boxTrim, constructionLib, freight, items, locations, missing, partitionsMaster, r, rates, restoreRef, sectors, setActiveBatchRowId, setAiNotes, setAutoCodeSeq, setBatchResults, setBatchRows, setConstructionLib, setItems, setSavedQuotes, setSetAutoFill, setSpec, setSpecCommitted, setTab, setTemplateB64, setTemplateLoaded, showToast, spec } = st;


  // ── BACKUP & RESTORE ──────────────────────────────────────────────────────
  // Backup: download all 10 localStorage keys as a single JSON file.
  // Fix 3: cbb_batch_autosave added so batch rows are included in manual JSON backups.
  const BACKUP_KEYS=['cbb_rates','cbb_freight','cbb_sectors','cbb_boxtrim',
    'cbb_partitions','cbb_constrlib','cbb_template',
    'cbb_rate_date','cbb_batchprofile','cbb_quoteitems','cbb_batch_autosave',
    'cbb_locations']; // A3: locations is a persisted master

  const handleBackup=()=>{
    const snap={_version:1,_ts:new Date().toISOString()};
    // D-3: cbb_template holds raw base64 and cbb_rate_date a raw string. Neither is
    // JSON, so JSON.parse threw, the catch wrote null, and handleRestoreFile skips
    // nulls — so neither key ever round-tripped. Fall back to the raw string, which
    // mirrors what the restore leg below already does correctly.
    //
    // An ABSENT key stays absent (the profile never had it); only a file written by a
    // pre-fix build carries an explicit null. After this, null means exactly that.
    BACKUP_KEYS.forEach(k=>{
      const v=getItem(k);
      if(v==null)return;
      try{snap[k]=JSON.parse(v);}catch(e){snap[k]=v;}
    });
    // Also include current in-memory state for anything not yet flushed to localStorage
    snap.cbb_rates=rates;
    snap.cbb_freight=freight;
    snap.cbb_sectors=sectors;
    snap.cbb_boxtrim=boxTrim;
    snap.cbb_partitions=partitionsMaster;
    snap.cbb_constrlib=constructionLib;
    snap.cbb_batchprofile=batchProfile;
    snap.cbb_locations=locations; // A3
    snap.cbb_quoteitems=items;
    const blob=new Blob([JSON.stringify(snap,null,2)],{type:'application/json'});
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    const d=new Date();
    a.download=`CFB_QOS_Backup_${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    showToast('✅ Backup downloaded','success');
  };

  const handleRestore=()=>{
    if(!window.confirm('Restore from backup? This will overwrite your current Rate Master, Freight, Sectors, Construction Library, and all other settings. The page will reload after restore.'))return;
    restoreRef.current?.click();
  };

  const handleRestoreFile=async(e)=>{
    const f=e.target.files?.[0];
    if(!f)return;
    try{
      const text=await f.text();
      const snap=JSON.parse(text);
      if(!snap._version)throw new Error('Not a valid CFB QOS backup file');
      BACKUP_KEYS.forEach(k=>{
        if(snap[k]!=null){
          try{
            // cbb_template, cbb_rate_date are stored as raw strings, not JSON.
            // JSON.stringify("abc") produces '"abc"' — the surrounding quotes corrupt base64
            // and string values. Only stringify objects/arrays; pass strings through as-is.
            const v=typeof snap[k]==='string'?snap[k]:JSON.stringify(snap[k]);
            setItem(k,v);
          }catch(err){}
        }
      });
      // D-3: an explicit null means this file was written by a pre-fix build that
      // discarded the raw-string keys. ABSENT is different — that profile simply had
      // no template — so only null warns.
      //
      // Deliberately window.alert, NOT showToast: the reload 1200ms below destroys any
      // toast before it can be read. A warning that cannot be seen is not a warning.
      // Consistent with handleRestore, which already gates this flow on window.confirm.
      if(snap.cbb_template===null){
        window.alert('⚠️ No Excel template in this backup.\n\n'
          +'It was written by a build that silently discarded the template (D-3). '
          +'Any template already on this machine has been kept, but if there is none, '
          +'exports will fail until you load one again from Quote Items.');
      }
      showToast('✅ Backup restored — reloading…','success');
      setTimeout(()=>window.location.reload(),1200);
    }catch(err){showToast('❌ Restore failed: '+err.message,'error');}
    e.target.value=''; // reset input so same file can be re-selected if needed
  };
  // pinnedAddOns: up to 2 add-on keys shown as main grid columns. Persisted.
  const addItem=()=>{
    if(!r||missing.blockers.length>0)return;
    // Point 3: Customer grouping — warn if client changes mid-quote
    const prevClient=(items[0]?.spec.client||"").trim();
    const curClient=(spec.client||"").trim();
    if(items.length>0&&prevClient&&curClient&&prevClient!==curClient){
      if(window.confirm(`Current quote has ${items.length} item(s) for "${prevClient}".\n\nOK = Save "${prevClient}" as draft and start fresh for "${curClient}"\nCancel = Keep all items together`)){
        setSavedQuotes(prev=>({...prev,[prevClient]:{items:[...items],savedAt:new Date().toLocaleString("en-IN")}}));
        setItems([]);
      }
    }
    // Point 2: Duplicate check — unique identity = product|material_code
    const uid=`${(spec.product||"").trim()}|${(spec.material_code||"").trim()}|${spec.rowType||"Box"}|${(spec.setCode||"").trim()}`;
    if(uid!=="|"){
      const existIdx=items.findIndex(i=>`${(i.spec.product||"").trim()}|${(i.spec.material_code||"").trim()}|${i.spec.rowType||"Box"}|${(i.spec.setCode||"").trim()}`===uid);
      if(existIdx>=0){
        if(window.confirm(`"${spec.product||"SKU"}" (${spec.material_code||"no code"}) already in quote.\n\nOK = Replace  |  Cancel = Add as separate entry`)){
          showToast(`🔄 "${spec.product||spec.material_code||'Item'}" replaced in Quote Items`,'info');
          setItems(prev=>prev.map((item,idx)=>idx===existIdx
            ?{...item,spec:{...spec},result:r,status:"updated",timestamp:new Date().toLocaleString("en-IN")}:item));
          setAiNotes(`✅ "${spec.product||"Item"}" updated in quote.`);
          return;
        }
      }
    }
    const id=Date.now();
    setItems(prev=>[...prev,{id,spec:{...spec},result:r,status:"draft",
      note:"",timestamp:new Date().toLocaleString("en-IN")}]);
    showToast(`✅ "${spec.product||spec.material_code||"Item"}" added to Quote Items`);
    setAiNotes(`✅ "${spec.product||"Item"}" added. ${items.length+1} item(s) in quote.`);
  };
  const removeItem=id=>setItems(prev=>prev.filter(i=>i.id!==id));
  // A4: clear activeBatchRowId so reviewing a Quote Item cannot hijack the push target.
  // Without this, a green "Push to Batch Row" button would silently overwrite an unrelated batch row.
  const loadItem=item=>{setSpec({...item.spec});setSetAutoFill(true);setActiveBatchRowId(null);setSpecCommitted(false);setTab("costing");};


  // ── BATCH ENTRY HELPERS ─────────────────────────────────────────────────
  // Auto-derives Plate/Part-L/Part-W dims from the nearest preceding Box row when
  // the row's own L/W is left blank — an explicit App-side value always overrides
  // this (matches the "App input wins, formula is only a fallback" xlsx rule).
  //
  // A1-01 (BATCH-03 FIX): The parent Box search is now restricted to rows that
  // share the same SET Code as this Plate/Partition row.
  //
  // Gate: if SET Code is still "assumed" (unconfirmed), auto-dims are suppressed —
  // we must not silently apply dimensions based on an unconfirmed relationship.
  // If SET Code was explicitly cleared (empty string, not assumed), the row is
  // standalone and auto-dims are disabled — user must enter L/W manually.
  const calcBatchRow=(row)=>{
    const constEntry=constructionLib.find(c=>c.code===row.constructionCode);
    if(!constEntry)return null;
    const dimRow=autoCalcPPDims(row);
    const isPP=isPPType(dimRow.itemType); // R-2
    // Unified waste/conv: single column interpreted by row type
    const rowWaste=row.wasteConv_waste; // blank = inherit profile
    const rowConv=row.wasteConv_conv;
    const profWaste=isPP?(batchProfile.wastePP??5):(batchProfile.waste??5);
    const profConv=isPP?(batchProfile.convRatePP??12.5):(batchProfile.convRate??7);
    const effWaste=rowWaste!==""&&rowWaste!=null?+rowWaste:profWaste;
    const effConv=rowConv!==""&&rowConv!=null?+rowConv:profConv;
    const sp=buildSpecFromRow(dimRow,constEntry,batchProfile);
    if(!sp)return null;
    // Apply row-level overrides on top of buildSpecFromRow output
    sp.waste=isPP?sp.waste:effWaste; sp.convRate=isPP?sp.convRate:effConv;
    sp.wastePP=isPP?effWaste:sp.wastePP; sp.convRatePP=isPP?effConv:sp.convRatePP;
    if(row.interestOverride!==""&&row.interestOverride!=null)sp.interest=+row.interestOverride;
    if(row.freightRowOverride!==""&&row.freightRowOverride!=null)sp.freightOverride=row.freightRowOverride;
    applyAddOns(sp,row); // R-1: single injection point
    return calcCosting(sp,rates,freight,boxTrim);
  };

  const calculateAll=()=>{
    // Gate: block if any non-Box row has an unconfirmed SET Code
    const unconfirmed=batchRows.filter(r=>r.itemType!=="Box"&&r.setCodeAssumed);
    if(unconfirmed.length>0){
      const list=unconfirmed.map((r,i)=>`Row ${batchRows.indexOf(r)+1}${r.matCode?` [${r.matCode}]`:""}`).join(", ");
      showToast(`⚠️ Confirm SET Codes first: ${list}`,'error',5000);
      return;
    }
    const newResults={};
    batchRows.forEach(row=>{newResults[row.id]=calcBatchRow(row);});
    setBatchResults(newResults);
    setBatchRows(prev=>prev.map(r=>({...r,status:newResults[r.id]?"draft":"incomplete"})));
  };

  const getBatchRowStatus=(row)=>{
    const dimRow=autoCalcPPDims(row);
    if(!dimRow.L||!dimRow.W||!row.constructionCode)return"incomplete";
    const constEntry=constructionLib.find(c=>c.code===row.constructionCode);
    if(!constEntry)return"incomplete";
    // Plate/Partition rows are flat pieces — H not required
    const isFlatPiece=isPPType(row.itemType); // R-2
    if(!isFlatPiece&&!row.H)return"incomplete";
    const res=batchResults[row.id];
    // Fix 1: "stale" — row was previously calculated (row.status indicates it) but result was invalidated
    if(!res&&(row.status==="draft"||row.status==="reviewed"||row.status==="override"||row.status==="spec-gap"))return"stale";
    if(!res)return"draft-uncalc";
    if(row.reviewed)return"reviewed";
    if(row.marginOverride!=null&&row.marginOverride!=="")return"override";
    const sp=buildSpecFromRow(dimRow,constEntry,batchProfile);
    const comp=sp?checkSpecCompliance(sp,res):[];
    if(comp.some(c=>c.severity==="high"))return"spec-gap";
    return"draft";
  };

  const sendAllToQuoteItems=()=>{
    if(!batchProfile.plant||!batchProfile.delivery){
      showToast("❌ Select Avadhoot Plant and Client Plant in the Batch Profile before sending to Quote Items",'error',5000);
      return;
    }
    // Fix 5: client-mismatch guard — if Quote Items already has items for a different client, warn
    if(items.length>0&&batchProfile.client){
      const existingClient=(items[0]?.spec?.client||"").trim();
      const newClient=batchProfile.client.trim();
      if(existingClient&&newClient&&existingClient!==newClient){
        if(!window.confirm(`Quote Items currently has ${items.length} item(s) for "${existingClient}".\n\nThis batch is for "${newClient}".\n\nOK = Proceed (items will mix clients)\nCancel = Stop`)){
          return;
        }
      }
    }
    // Change 3: Cobb ≤ 125 coating check — scan all rows before sending
    // Same pattern as SET completeness check. Missing coating on moisture-sensitive
    // board is a quoting error; Maker must explicitly confirm to proceed.
    const cobbUncoated=batchRows.filter(r=>
      r.spec_cobb&&+r.spec_cobb<=125&&+(r.addOns?.coating||0)===0
    );
    if(cobbUncoated.length>0){
      const names=cobbUncoated.map(r=>`Row ${batchRows.indexOf(r)+1}${r.matCode?` [${r.matCode}]`:""} — Cobb ≤ ${r.spec_cobb} g/m²`);
      const proceed=window.confirm(
        `⚠️ Cobb ≤ 125 g/m² — Missing Coating Charge\n\n`+
        `The following ${cobbUncoated.length} row(s) specify moisture-sensitive board `+
        `but have no coating add-on charge (₹0/pc):\n\n`+
        `${names.join("\n")}\n\n`+
        `OK = Proceed and send without coating charge\n`+
        `Cancel = Go back and enter coating rates`
      );
      if(!proceed)return;
    }

    // Fix 1: block if any row has a stale result (inputs changed since last Calculate All)
    const staleRows=batchRows.filter(r=>getBatchRowStatus(r)==="stale");
    if(staleRows.length>0){
      const list=staleRows.map(r=>`Row ${batchRows.indexOf(r)+1}${r.matCode?` [${r.matCode}]`:""}`).join(", ");
      showToast(`🔄 Stale results — run Calculate All first. Affected: ${list}`,'error',6000);
      return;
    }
    // Gate: block if any non-Box row has an unconfirmed SET Code
    const unconfirmed=batchRows.filter(r=>r.itemType!=="Box"&&r.setCodeAssumed);
    if(unconfirmed.length>0){
      const list=unconfirmed.map(r=>`Row ${batchRows.indexOf(r)+1}${r.matCode?` [${r.matCode}]`:""}`).join(", ");
      showToast(`⚠️ Confirm SET Codes first: ${list}`,'error',5000);
      return;
    }
    const newItems=[];
    const sentRowIds=new Set(); // Fix 4: track which rows actually sent
    const skippedRows=[]; // Fix 4: collect skipped row numbers for toast
    batchRows.forEach((row,ri)=>{
      const res=batchResults[row.id];
      if(!res){skippedRows.push(`Row ${ri+1}${row.matCode?` [${row.matCode}]`:""}`);return;}
      const constEntry=constructionLib.find(c=>c.code===row.constructionCode);
      if(!constEntry){skippedRows.push(`Row ${ri+1}${row.matCode?` [${row.matCode}]`:""} (no construction)`);return;}
      const dimRow=autoCalcPPDims(row); // A1-01: use SET-Code-aware dim resolution
      const sp=buildSpecFromRow(dimRow,constEntry,batchProfile);
      const isPP=isPPType(dimRow.itemType); // R-2

      // ── A1-02: Apply row-level waste/conv overrides to the spec ──────────
      // calcBatchRow and loadBatchRowIntoCosting both apply these overrides —
      // sendAllToQuoteItems must do the same so the spec stored in Quote Items
      // (used for Excel export columns AY3/AY4/BA3/BA4) reflects the exact
      // effective values the engine used, not the profile defaults.
      const rowWaste=row.wasteConv_waste;
      const rowConv=row.wasteConv_conv;
      const profWaste=isPP?(batchProfile.wastePP??5):(batchProfile.waste??5);
      const profConv=isPP?(batchProfile.convRatePP??12.5):(batchProfile.convRate??7);
      sp.waste=isPP?sp.waste:(rowWaste!==""&&rowWaste!=null?+rowWaste:profWaste);
      sp.convRate=isPP?sp.convRate:(rowConv!==""&&rowConv!=null?+rowConv:profConv);
      sp.wastePP=isPP?(rowWaste!==""&&rowWaste!=null?+rowWaste:profWaste):sp.wastePP;
      sp.convRatePP=isPP?(rowConv!==""&&rowConv!=null?+rowConv:profConv):sp.convRatePP;
      if(row.interestOverride!==""&&row.interestOverride!=null)sp.interest=+row.interestOverride;
      if(row.freightRowOverride!==""&&row.freightRowOverride!=null)sp.freightOverride=row.freightRowOverride;
      // ─────────────────────────────────────────────────────────────────────

      // ── Add-on costs from batch row into the spec ─────────────────────────
      applyAddOns(sp,row); // R-1: single injection point — see module-level applyAddOns
      // ─────────────────────────────────────────────────────────────────────
      const existing=items.findIndex(i=>
        (i.spec.material_code||"")===row.matCode&&(i.spec.rowType||"Box")===(row.itemType||"Box"));
      sentRowIds.add(row.id); // Fix 4: record that this row was actually sent
      if(existing>=0){
        // Update existing
        setItems(prev=>prev.map((item,idx)=>idx===existing
          ?{...item,spec:sp,result:res,status:"batch-updated"}:item));
      } else {
        newItems.push({id:Date.now()+Math.random(),spec:sp,result:res,
          status:"batch",note:"",timestamp:new Date().toLocaleString("en-IN")});
      }
    });
    if(newItems.length)setItems(prev=>[...prev,...newItems]);
    // Fix 4: only mark rows that were actually sent as Reviewed — not rows that were skipped
    setBatchRows(prev=>prev.map(r=>sentRowIds.has(r.id)?{...r,reviewed:true,status:"reviewed"}:r));
    if(skippedRows.length>0){
      showToast(`⚠️ ${skippedRows.length} row(s) skipped (no result): ${skippedRows.join(", ")}`,'error',7000);
    }
    setTab("items");
  };

  const generateCode=(seq)=>{
    const cli=(batchProfile.client||"SKU").replace(/\s+/g,"").substring(0,4).toUpperCase();
    const d=new Date();
    const ym=`${String(d.getFullYear()).slice(-2)}${String(d.getMonth()+1).padStart(2,"0")}`;
    return `${cli}${ym}-${String(seq).padStart(3,"0")}`;
  };

  const generateMissingCodes=()=>{
    let seq=autoCodeSeq;
    setBatchRows(prev=>prev.map(r=>{
      if(r.matCode)return r;
      const code=generateCode(seq++);
      return{...r,matCode:code,autoCode:true};
    }));
    setAutoCodeSeq(seq);
  };

  const addBatchRow=(itemType="Box")=>{
    const id=Date.now();
    const matCode=autoCodeEnabled?generateCode(autoCodeSeq):"";
    if(autoCodeEnabled)setAutoCodeSeq(s=>s+1);
    setBatchRows(prev=>{
      // For Main Box: SET Code = Mat Code (same identity)
      // For non-Box rows (Plate/Part-L/Part-W/Other): find the nearest preceding
      // confirmed Main Box and inherit its SET Code (not its Mat Code — they may
      // have diverged if the user renamed the SET Code manually).
      // Guard: only inherit if the parent Box's own SET Code is confirmed
      // (setCodeAssumed===false). If the parent itself is unconfirmed, leave blank
      // rather than stacking assumption on assumption.
      let setCode="";
      let setCodeAssumed=false;
      if(itemType==="Box"){
        setCode=matCode; // Main Box: SET Code = own Mat Code
      } else {
        // Walk backwards to find the nearest preceding confirmed Main Box
        const boxes=[...prev].reverse().filter(r=>r.itemType==="Box"&&r.matCode&&!r.setCodeAssumed);
        if(boxes.length>0){
          setCode=boxes[0].setCode||boxes[0].matCode; // prefer setCode; fall back to matCode
          setCodeAssumed=true; // flag: assumed from preceding Box, confirm/override
        }
      }
      return[...prev,{
        id,matCode,product:"",itemType,setCode,setCodeAssumed,constructionCode:"",setAutoFill:true,
        L:"",W:"",H:"",ups:1,
        boxType:itemType==="Box"?"RSC":"PP",
        spec_bs:"",spec_bct:"",nosPerSet:1,
        salesMOQ:"",volume:"",marginOverride:"",remarks:"",
        reviewed:false,autoCode:autoCodeEnabled,status:"incomplete",
      }];
    });
  };

  const importConstrFromSpec=()=>{
    // Fix 14: shared helper — first UNUSED letter, not array.length (which reuses deleted codes)
    const LETTERS="ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const usedCodes=new Set(constructionLib.map(c=>c.code));
    const nextCode=LETTERS.split("").find(l=>!usedCodes.has(l))||`C${constructionLib.length}`;
    // Fix 14: duplicate check (was missing from this path; the Construction Library tab has it, this didn't)
    const incomingSector=spec.sector||batchProfile.sector||"";
    const toStr=v=>(v===undefined||v===null||v===""?"":String(v).trim());
    const duplicate=constructionLib.find(c=>
      toStr(c.board_gsm)===toStr(spec.board_gsm)&&
      toStr(c.spec_bs)===toStr(spec.spec_bs)&&
      toStr(c.spec_bct)===toStr(spec.spec_bct)&&
      toStr(c.spec_ect)===toStr(spec.spec_ect)&&
      toStr(c.sector)===toStr(incomingSector)
    );
    if(duplicate){
      window.alert(`A construction with identical STDs already exists as [${duplicate.code}]. No duplicate created.`);
      setTab("constrlib");
      return;
    }
    const newConstr={
      code:nextCode,
      // name left blank — auto-derives from spec in constrAutoName; user can override
      name:"",
      boxType:spec.boxType||"RSC",ply:spec.ply||5,
      flute_F1:spec.flute_F1||"B",flute_F2:spec.flute_F2||"A",
      layers:JSON.parse(JSON.stringify(spec.layers||{})),
      board_gsm:spec.board_gsm||"",spec_bs:spec.spec_bs||"",
      spec_bct:spec.spec_bct||"",spec_ect:spec.spec_ect||"",
      waste:null,convRate:null,wastePP:null,convRatePP:null,
      // tagging fields
      sector:spec.sector||batchProfile.sector||"",
      client:spec.client||batchProfile.client||"",
      status:"active",
      // mill_preferences: per-layer grade+mill preference for rate lookup.
      // Populated via UI once GSheets Mill Master cache is live.
      // Grade: A/B/C from Mill Master. Mill: specific mill name (optional — grade alone is valid).
      // Empty object = no preference (engine uses lowest available price).
      mill_preferences:{
        TOP:{grade:"",mill:""},F1:{grade:"",mill:""},L1:{grade:"",mill:""},
        F2:{grade:"",mill:""},L2:{grade:"",mill:""},
      },
    };
    setConstructionLib(prev=>[...prev,newConstr]);
    setTab("batch");
  };

  const handleTemplateLoad=async(e)=>{
    const file=e.target.files[0];if(!file)return;
    const b64=await toB64(file);
    setTemplateB64(b64);
    setTemplateLoaded(true);
    try{setItem('cbb_template',b64);}catch(e){} // persist across refreshes if possible
    setAiNotes('✅ Master template loaded. All Excel exports will now use your master format with formulas and formatting intact.');
    e.target.value='';
  };

  const handleImport=async(e)=>{
    const f=e.target.files[0];if(!f)return;
    try{const parsed=await parseImportedExcel(f,rates,freight,boxTrim);
      setItems(prev=>[...prev,...parsed]);
      setTab("items");setAiNotes(`✅ Imported ${parsed.length} item(s) from Excel.`);
    }catch(err){setAiNotes("❌ Import failed: "+err.message);}
    e.target.value="";
  };

  const card={background:C.white,border:`1px solid ${C.border}`,borderRadius:7,padding:"10px 12px",marginBottom:7};

  // ── SIDEBAR (left nav) ────────────────────────────────────────────────────

  return { BACKUP_KEYS, addBatchRow, addItem, calcBatchRow, calculateAll, card, generateCode, generateMissingCodes, getBatchRowStatus, handleBackup, handleImport, handleRestore, handleRestoreFile, handleTemplateLoad, importConstrFromSpec, loadItem, removeItem, sendAllToQuoteItems };
}
