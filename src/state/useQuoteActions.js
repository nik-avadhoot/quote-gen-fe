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
import { buildSpecFromRow, calcCostingOutcome, checkSpecCompliance, freightBlockerText } from "../engine/costing.js";
import { isFeatureEnabled } from "../lib/featureFlags.js";
import { resolveBatchCommercialDefaults, resolveBatchInterest, resolveField } from "../engine/resolveAuthority.js";
import { materializeEffectiveRates } from "../engine/rateMaster.js";
import { applyAddOns, isPPType } from "../engine/rowType.js";
import { findDuplicate, isUsableConstruction } from "../lib/constructionIdentity.js";
import { calculatedRowCount, firstRefusal, journeyState, localWorkBlockers, sendReadiness } from "../lib/quoteJourney.js";
import { parseImportedExcel } from "../export/importExcel.js";
import { toB64 } from "../export/toB64.js";
import { C } from "../theme.js";
import { getItem, setItem } from "../lib/persist.js";

export function useQuoteActions(st){
  const { _sendReady, autoCalcPPDims, autoCodeEnabled, autoCodeSeq, batchFreight, batchProfile, batchResults, batchRows, boxTrim, constructionCatalogue, constructionLib, durableBatch, freight, items, laneSelection, locations, missing, partitionsMaster, r, rates, restoreRef, sectors, setAiNotes, setAutoCodeSeq, setBatchFreight, setBatchResults, setBatchRows, setConstructionLib, setItems, setQuoteView, setSavedQuotes, setTab, setTemplateB64, setTemplateLoaded, showToast, spec } = st;
  const batchCommercialDefaults=resolveBatchCommercialDefaults(batchProfile,
    sectors.find(sector=>sector.code===batchProfile.sector));


  // ── BACKUP & RESTORE ──────────────────────────────────────────────────────
  // Backup: download every persisted localStorage key as a single JSON file.
  // Fix 3: cbb_batch_autosave added so batch rows are included in manual JSON backups.
  const BACKUP_KEYS=['cbb_rates','cbb_freight','cbb_boxtrim',
    'cbb_partitions','cbb_constrlib','cbb_template',
    'cbb_rate_date','cbb_batchprofile','cbb_quoteitems','cbb_batch_autosave',
    'cbb_locations', // A3: locations is a persisted master
    'cbb_pinned_addons']; // written by useBatchState:33; was absent, so pinned grid
                          // columns did not survive a backup/restore round trip

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
    // cbb_sectors is deliberately absent: Sectors became a GOVERNED master on
    // 2026-09-22 and no longer live in this browser. Writing them into a local
    // backup would imply a restore could put them back, which it cannot.
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
    // D-6: date alone cannot separate two snapshots taken the same day. The browser
    // saves the second as "…(1).json" and provenance becomes guesswork within hours.
    // HHMM added; the _ts inside the file remains the authority.
    const _p2=n=>String(n).padStart(2,'0');
    // Named for the PKGCanvas platform. Restore validates the file's contents
    // (_version), never its name, so older MFGCanvas_Backup_* and
    // CFB_QOS_Backup_* files still restore.
    a.download=`PKGCanvas_Backup_${d.getFullYear()}${_p2(d.getMonth()+1)}${_p2(d.getDate())}`
      +`_${_p2(d.getHours())}${_p2(d.getMinutes())}.json`;
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
      if(!snap._version)throw new Error('Not a valid PKGCanvas backup file');
      // ── DP-2: confirm BEFORE the write, not after the reload ─────────────────
      // Restoring a file replaces the batch grid. Before D-5 the recovery banner
      // stood between a restore and the grid being repopulated, which is the guard
      // DP-2 records — but it only appeared after the reload, and it expired after
      // 7 days. Asking here is strictly stronger: it happens where the user has
      // context, before anything is written, and it cannot time out.
      //
      // Session recovery (reload, crash) hydrates silently and correctly — those
      // are the user's own rows. A FILE restore is different: they may not have
      // looked inside it. Only this path asks.
      //
      // UNCONDITIONAL — it fires even when the current grid is empty.
      //
      // An earlier version gated this on `_currentRows>0`, reasoning that replacing
      // an empty grid destroys nothing and that a second dialog invites click-through.
      // That misreads which risk matters. Dialog fatigue is a hazard of ROUTINE
      // actions; a file restore is rare and deliberate. And the exempted case is
      // exactly the one where the user does not yet KNOW the grid is empty —
      // restoring onto a machine they have not looked at. The message is not only a
      // warning about what is lost, it is information about what is ARRIVING, and
      // that is wanted regardless of what is already there.
      const _incomingRows=snap.cbb_batch_autosave?.rows?.length||0;
      const _currentRows=batchRows.length;
      const _currentDesc=_currentRows>0
        ?`Your current batch has ${_currentRows} row${_currentRows!==1?'s':''} and will be REPLACED.`
        :`Your current batch is empty.`;
      if(!window.confirm(
        `This backup contains ${_incomingRows} batch row${_incomingRows!==1?'s':''}.\n\n`
        +`${_currentDesc}\n\n`
        +`OK = Restore  |  Cancel = Keep the current batch`
      )){
        showToast('Restore cancelled — current batch kept','info');
        e.target.value='';
        return;
      }
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
  // C4 REMOVED loadItem. Clicking a Quote Item used to load its stored spec into
  // Costing, which after C3 means overwriting a PERSISTED draft from one click on
  // a list row, and after C4 would mean writing whichever surface happened to be
  // active. It is gone, and nothing replaced it in Costing.
  //
  // Batch Entry is the sole CalcGate: a calculation change becomes quotable only
  // by going through a Batch row, Calculate All and Send All. A writable path
  // from Quote Items back into Costing would be a second authority over the same
  // number. QuoteItemsTab now routes the click to Batch Entry and writes nothing.
  //
  // It cannot resolve WHICH row, and deliberately does not guess: a Quote Item
  // carries no batch-row identity (sendAllToQuoteItems stamps a fresh
  // Date.now()+Math.random() id, never row.id), and inferring one from Material
  // Code, Product, SET Code, row type or position is exactly the fuzzy match this
  // app must not grow. Recorded for the Quote Items / data-model phase.


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
  // The ONE Batch interest figure. calcBatchRow costs with it and
  // sendAllToQuoteItems stores it on the item, which is what the exporter writes
  // to CBB+PP BJ3/BJ4. Send used to keep buildSpecFromRow's `prof.interest??0.5`,
  // so a Batch whose interest was DERIVED from Payment Terms (no override) was
  // costed at the derived rate on screen but exported at 0.5%.
  const batchInterestPct=()=>resolveBatchInterest(batchProfile).value;
  const calcBatchRow=(row)=>{
    const constEntry=constructionCatalogue.find(c=>c.code===row.constructionCode);
    if(!constEntry||!isUsableConstruction(constEntry))return null;
    const dimRow=autoCalcPPDims(row);
    const isPP=isPPType(dimRow.itemType); // R-2
    // Unified waste/conv: single column interpreted by row type
    const rowWaste=row.wasteConv_waste; // blank = inherit
    const rowConv=row.wasteConv_conv;
    // ── S7: THE ONE RESOLVER, AND THE TIER THIS SURFACE NEVER HAD ──────────
    // These lines used to read `row ?? profile ?? literal`. Costing read
    // `batch ?? sector ?? literal`. The Sector was missing HERE - at the sole
    // CalcGate, the gate that actually produces a Quote - so a Batch with a
    // blank profile field costed one way on screen and another way at Send.
    // Both surfaces now call resolveField and the disagreement is closed (B-1).
    const _sector=sectors.find(x=>x.code===batchProfile.sector);
    const _ctx={batchProfile,sector:_sector,isPP};
    const effWaste=resolveField('waste',{..._ctx,rowOverride:rowWaste}).value;
    const effConv =resolveField('convRate',{..._ctx,rowOverride:rowConv}).value;
    const sp=buildSpecFromRow(dimRow,constEntry,batchProfile);
    if(!sp)return null;
    // Apply the resolved values on top of buildSpecFromRow output
    sp.waste=isPP?sp.waste:effWaste; sp.convRate=isPP?sp.convRate:effConv;
    sp.wastePP=isPP?effWaste:sp.wastePP; sp.convRatePP=isPP?effConv:sp.convRatePP;
    // Margin and Interest come from the same resolver rather than from
    // buildSpecFromRow's own defaults, so there is exactly one answer per field.
    //
    // ⚠️ ONE DELIBERATE BEHAVIOUR CHANGE, flagged rather than slipped in.
    // buildSpecFromRow resolves a PP row's margin as `marginPP ?? margin ?? 8` -
    // an undocumented fourth tier. CDM-19 gives `row → Batch Box|PP → Sector →
    // system`, with no fall-through from the PP default to the Box one. The
    // resolver implements the canonical chain. It was unreachable before, because
    // the profile always carried a marginPP; clearing a field now stores null, so
    // it becomes reachable and had to be settled rather than left ambiguous.
    sp.margin=resolveField('margin',{..._ctx,rowOverride:row.marginOverride}).value;
    sp.interest=batchInterestPct();
    // WAVE 3: no row-level Interest/Freight override. sp already carries the
    // canonical Batch figures from buildSpecFromRow, and calcCosting resolves
    // freight as override-else-matrix (getFreightRate, engine/costing.js:29-32).
    applyAddOns(sp,row); // R-1: single injection point
    // S8(a). The second application boundary, and it injects the SAME flag as
    // the Costing screen so the two surfaces cannot price freight differently -
    // which is the whole reason the resolver exists. Returns the outcome pair;
    // calculateAll splits it so batchResults keeps holding a bare result.
    return calcCostingOutcome(sp,materializeEffectiveRates(rates),freight,boxTrim,
      {authorityV2:isFeatureEnabled("freight_authority_v2")});
  };

  // The two SET-Code and Construction gates that used to be written out here
  // now come from `localWorkBlockers` (lib/quoteJourney.js) so that the toolbar
  // can show the SAME refusal, in the same words, BEFORE the click instead of
  // as a toast afterwards. Stale results are not a Calculate gate - Calculate
  // is how a stale row is cleared - so no rowStatus is passed here.
  const calculateAll=()=>{
    const refusal=firstRefusal(localWorkBlockers({batchRows,batchProfile,
      constructionCatalogue,isUsableConstruction}),"calculate");
    if(refusal){showToast(refusal.text,'error',refusal.duration);return;}
    const newResults={},newFreight={};
    batchRows.forEach(row=>{
      // Destructured on the line it is created: the wrapper never enters state.
      const outcome=calcBatchRow(row);
      newResults[row.id]=outcome?outcome.result:null;
      newFreight[row.id]=outcome?outcome.freightResolution:null;
    });
    setBatchResults(newResults);
    setBatchFreight(newFreight);
    setBatchRows(prev=>prev.map(r=>({...r,status:newResults[r.id]?"draft":"incomplete"})));
  };

  const getBatchRowStatus=(row)=>{
    const dimRow=autoCalcPPDims(row);
    if(!dimRow.L||!dimRow.W||!row.constructionCode)return"incomplete";
    const constEntry=constructionCatalogue.find(c=>c.code===row.constructionCode);
    if(!constEntry||!isUsableConstruction(constEntry))return"incomplete";
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

  // Every reason Send refuses, computed once, in one place, and shown in the
  // Batch Builder toolbar before the Maker clicks (review CC-10). `localBlockers`
  // must stay BELOW getBatchRowStatus: the stale check calls it.
  const localBlockers=()=>localWorkBlockers({batchRows,batchProfile,
    constructionCatalogue,isUsableConstruction,rowStatus:getBatchRowStatus});

  const sendAllToQuoteItems=()=>{
    // CHANGED IN THIS INCREMENT: all four refusals are now evaluated BEFORE the
    // two confirmations below, instead of route/construction first and
    // stale/SET-Code after them. Nothing that was permitted becomes blocked and
    // nothing blocked becomes permitted - the Maker is simply no longer asked to
    // confirm a mixed-client or uncoated send that was about to be refused
    // anyway. The refusal order is now the register's order in quoteJourney.js.
    const refusal=firstRefusal(localBlockers(),"send");
    if(refusal){showToast(refusal.text,'error',refusal.duration);return;}
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

    // The stale-result and assumed-SET-Code refusals that used to stand here
    // are in the single `firstRefusal(localBlockers(),"send")` gate above.
    const newItems=[];
    const sentRowIds=new Set(); // Fix 4: track which rows actually sent
    const skippedRows=[]; // Fix 4: collect skipped row numbers for toast
    batchRows.forEach((row,ri)=>{
      const res=batchResults[row.id];
      if(!res){
        // S8(a). The row was already refused - Calculate All produced no result,
        // so it cannot become a Quote Item. What changes is that the Maker is
        // told WHY, from the same resolution that refused it. No recomputation.
        const _fr=batchFreight?.[row.id];
        const _why=_fr&&_fr.source==="unresolved"?` — ${freightBlockerText(spec,_fr)}`:"";
        skippedRows.push(`Row ${ri+1}${row.matCode?` [${row.matCode}]`:""}${_why}`);return;}
      const constEntry=constructionCatalogue.find(c=>c.code===row.constructionCode);
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
      const profWaste=isPP?batchCommercialDefaults.wastePP:batchCommercialDefaults.waste;
      const profConv=isPP?batchCommercialDefaults.convRatePP:batchCommercialDefaults.convRate;
      const profMargin=isPP?batchCommercialDefaults.marginPP:batchCommercialDefaults.margin;
      sp.waste=isPP?sp.waste:(rowWaste!==""&&rowWaste!=null?+rowWaste:profWaste);
      sp.convRate=isPP?sp.convRate:(rowConv!==""&&rowConv!=null?+rowConv:profConv);
      sp.wastePP=isPP?(rowWaste!==""&&rowWaste!=null?+rowWaste:profWaste):sp.wastePP;
      sp.convRatePP=isPP?(rowConv!==""&&rowConv!=null?+rowConv:profConv):sp.convRatePP;
      sp.margin=row.marginOverride!==""&&row.marginOverride!=null?+row.marginOverride:profMargin;
      // Interest must be the figure calcBatchRow costed `res` with, or the
      // exported workbook (BJ3/BJ4) recomputes a different rate.
      sp.interest=batchInterestPct();
      // WAVE 3: as in calcBatchRow above - the other Batch figures already on
      // sp are what reaches the item, and from there the exporter and backend.
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
    setQuoteView("working-items");
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
        printing_technology:"",number_of_colours:"",
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
    // D-11: was 4 board specs + SECTOR, with its own local toStr. Now the shared
    // 9-field predicate. Drops sector (metadata, ruled 2026-08-29) and gains
    // ply/flutes/boxType/layers, so it is stricter about the board and blind to
    // the tag — which is the model.
    const duplicate=findDuplicate(constructionLib,spec);
    if(duplicate){
      // D-11: "identical STDs" understated what is compared and said nothing about
      // sector. The predicate is nine fields and IGNORES sector and client, so an
      // import from a different sector lands here now — the message has to say why.
      window.alert(
        `[${duplicate.code}] is the same construction — same board specs `+
        `(GSM ${duplicate.board_gsm||"—"}, BS ${duplicate.spec_bs||"—"}), `+
        `ply ${duplicate.ply||"—"}, flutes ${duplicate.flute_F1||"—"}/${duplicate.flute_F2||"—"}, `+
        `box type ${duplicate.boxType||"—"} and paper layers.\n\n`+
        `Sector and client are tags, not identity.\n\nNo duplicate created.`);
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
      // D-11 enabler — see the note at the bridge's creation path. Additive only.
      createdVia:"app-import",createdAt:new Date().toISOString(),
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
      setQuoteView("working-items");
      setTab("items");setAiNotes(`✅ Imported ${parsed.length} item(s) from Excel.`);
    }catch(err){setAiNotes("❌ Import failed: "+err.message);}
    e.target.value="";
  };

  const card={background:C.white,border:`1px solid ${C.border}`,borderRadius:7,padding:"10px 12px",marginBottom:7};

  // ── SIDEBAR (left nav) ────────────────────────────────────────────────────

  // One derived answer to "where am I in the journey, and what is left?", read
  // by the TopBar and the Batch Builder toolbar. Same blocker objects the two
  // actions above refuse on, so the shell can never promise a readiness the
  // click then denies.
  const quoteBlockers=localBlockers();
  const journey=journeyState({laneSelection,durableBatch,batchRows,batchResults,batchProfile,
    quoteItems:items,blockers:quoteBlockers,hasScratchDraft:!!_sendReady});
  // The shared header describes the governed Batch that is actually open,
  // independently of a private Quick draft parked elsewhere. This is a
  // presentation context only: it grants no authority and runs no transition.
  const batchJourney=journeyState({
    laneSelection:durableBatch?.id
      ?{lane:"customer",batchId:String(durableBatch.id)}:laneSelection,
    durableBatch,batchRows,batchResults,batchProfile,quoteItems:items,
    blockers:quoteBlockers,hasScratchDraft:!!_sendReady});
  // ONE readiness verdict for the toolbar, the TopBar and the Send button, so
  // the three cannot describe three different permitted behaviours. Built from
  // the truthful result count, never from batchResults' key count.
  const quoteReadiness=sendReadiness(quoteBlockers,
    {rowCount:batchRows.length,calculated:calculatedRowCount(batchRows,batchResults)});

  return { BACKUP_KEYS, addBatchRow, addItem, batchJourney, calcBatchRow, calculateAll, card, generateCode, generateMissingCodes, getBatchRowStatus, handleBackup, handleImport, handleRestore, handleRestoreFile, handleTemplateLoad, importConstrFromSpec, journey, quoteBlockers, quoteReadiness, removeItem, sendAllToQuoteItems };
}
