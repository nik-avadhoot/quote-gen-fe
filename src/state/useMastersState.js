// ═══════════════════════════════════════════════════════════════════════════
// src/state/useMastersState.js
//
// Master reference data + its localStorage persistence.
// rates, freight, locations, sectors, boxTrim, partitionsMaster and
// constructionLib, plus the rate-master pricing knobs.
//
// Extracted verbatim from QuotationApp.jsx (Phase 4). The bodies below are
// byte-identical to the monolith; only the surrounding closure changed.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useState } from "react";
import { DEFAULT_BOX_TRIM_DATA, DEFAULT_FREIGHT, DEFAULT_RATES, DEFAULT_SECTORS_DATA, PARTITIONS_MASTER_DEFAULT } from "../data/defaults.js";
import { getItem, setItem } from "../lib/persist.js";

export function useMastersState(){
  const[rates,setRates]=useState(()=>{try{const s=getItem('cbb_rates');return s?JSON.parse(s):DEFAULT_RATES;}catch(e){return DEFAULT_RATES;}});
  const[gyPremLow,setGyPremLow]=useState(1.5);   // GY premium for 16-24 BF grades
  const[gyPremHigh,setGyPremHigh]=useState(0.5);  // GY premium for 28+ BF grades
  const[blanketDisc,setBlanketDisc]=useState(1.5);
  const[blanketInterest,setBlanketInterest]=useState(1.5); // credit cost % for blanket apply
  const[freightBands,setFreightBands]=useState([0,0,0]); // blanket discount applied to all grades
  const[rateUpdatedAt,setRateUpdatedAt]=useState(()=>getItem('cbb_rate_date')||'');
  const touchRateDate=()=>{
    const d=new Date().toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'});
    setRateUpdatedAt(d);
    try{setItem('cbb_rate_date',d);}catch(e){}
  };
  const[freight,setFreight]=useState(()=>{try{const s=getItem('cbb_freight');return s?JSON.parse(s):DEFAULT_FREIGHT;}catch(e){return DEFAULT_FREIGHT;}});
  const[sectors,setSectors]=useState(()=>{
    try{
      const s=getItem('cbb_sectors');
      // First run only — no stored data yet: seed from defaults.
      // All subsequent runs use stored data exclusively so deliberate
      // admin deletions (or additions) are never overwritten by defaults.
      if(!s)return DEFAULT_SECTORS_DATA;
      const stored=JSON.parse(s);
      // Deduplicate by code (guards against backup/restore duplicates).
      // Field-merge with defaults so new schema keys propagate to stale backups,
      // but stored values always win — user edits are never silently reverted.
      // The re-seed loop (adding back deleted codes) has been removed: a sector
      // deleted by admin must stay deleted across refreshes.
      const seen=new Set();
      const deduped=[];
      for(const row of stored){
        if(!seen.has(row.code)){
          seen.add(row.code);
          const def=DEFAULT_SECTORS_DATA.find(d=>d.code===row.code)||{};
          deduped.push({...def,...row}); // stored wins; def fills missing keys only
        }
      }
      return deduped.length?deduped:DEFAULT_SECTORS_DATA;
    }catch(e){return DEFAULT_SECTORS_DATA;}
  });
  const[boxTrim,setBoxTrim]=useState(()=>{
    try{
      const s=getItem('cbb_boxtrim');
      if(!s)return DEFAULT_BOX_TRIM_DATA;
      const stored=JSON.parse(s);
      // Merge: DEFAULT supplies new keys (PP), stored keys preserve user edits.
      // PP always forced to 0-trim since it's new and 0 is the correct default.
      return{...DEFAULT_BOX_TRIM_DATA,...stored,
        PP:stored.PP??DEFAULT_BOX_TRIM_DATA.PP,          // ensure PP exists with 0 trim
        Custom:{...DEFAULT_BOX_TRIM_DATA.Custom,...(stored.Custom||{})}};  // keep user Custom edits
    }catch(e){return DEFAULT_BOX_TRIM_DATA;}
  });
  const[partitionsMaster,setPartitionsMaster]=useState(()=>{try{const s=getItem('cbb_partitions');return s?JSON.parse(s):PARTITIONS_MASTER_DEFAULT;}catch(e){return PARTITIONS_MASTER_DEFAULT;}});
  // A3: locations must be a persisted master — every other master has all three mechanisms.
  // On init: read cbb_locations from localStorage, fallback to hardcoded array, then UNION
  // with location keys found in cbb_freight so already-orphaned rates resurface immediately.
  const DEFAULT_LOCATIONS=["Nagpur","Pune","Kolkata","Haldia","Howrah","Guwahati","Delhi","Ahmedabad","Hyderabad"];
  const[locations,setLocations]=useState(()=>{
    try{
      const stored=getItem('cbb_locations');
      const base=stored?JSON.parse(stored):DEFAULT_LOCATIONS;
      // Union with freight keys to resurface any locations that were added before this fix
      const freightStored=getItem('cbb_freight');
      const freightKeys=freightStored
        ?Object.values(JSON.parse(freightStored)).flatMap(d=>Object.keys(d||{}))
        :[];
      const union=[...new Set([...base,...freightKeys])].sort();
      return union.length?union:DEFAULT_LOCATIONS;
    }catch(e){return DEFAULT_LOCATIONS;}
  });
  const[constructionLib,setConstructionLib]=useState(()=>{
    try{const s=getItem('cbb_constrlib');return s?JSON.parse(s):[];}catch(e){return [];}
  });
  // A3: persist locations whenever the list changes
  useEffect(()=>{try{setItem('cbb_locations',JSON.stringify(locations));}catch(e){};},[locations]);
  // Persist all masters on change — rates was missing its useEffect
  useEffect(()=>{try{setItem('cbb_rates',JSON.stringify(rates));}catch(e){}},[rates]);
  useEffect(()=>{try{setItem('cbb_freight',JSON.stringify(freight));}catch(e){}},[freight]);
  useEffect(()=>{try{setItem('cbb_sectors',JSON.stringify(sectors));}catch(e){}},[sectors]);
  useEffect(()=>{try{setItem('cbb_boxtrim',JSON.stringify(boxTrim));}catch(e){}},[boxTrim]);
  useEffect(()=>{try{setItem('cbb_partitions',JSON.stringify(partitionsMaster));}catch(e){}},[partitionsMaster]);
  useEffect(()=>{try{setItem('cbb_constrlib',JSON.stringify(constructionLib));}catch(e){}},[constructionLib]);
  // Derived sector code list — always from sectors state so dynamic additions appear everywhere.
  // SECTORS constant from defaults.js is used only as the initial seed in DEFAULT_SECTORS_DATA.
  const sectorCodes=sectors.map(s=>s.code);
  const gradeCodes=["",...rates.map(r=>r.code)];

  return { DEFAULT_LOCATIONS, blanketDisc, blanketInterest, boxTrim, constructionLib, freight, freightBands, gradeCodes, gyPremHigh, gyPremLow, locations, partitionsMaster, rateUpdatedAt, rates, sectorCodes, sectors, setBlanketDisc, setBlanketInterest, setBoxTrim, setConstructionLib, setFreight, setFreightBands, setGyPremHigh, setGyPremLow, setLocations, setPartitionsMaster, setRateUpdatedAt, setRates, setSectors, touchRateDate };
}
