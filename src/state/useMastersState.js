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
import { DEFAULT_BOX_TRIM_DATA, DEFAULT_FREIGHT, DEFAULT_RATES, PARTITIONS_MASTER_DEFAULT } from "../data/defaults.js";
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
  // ── SECTORS ARE NO LONGER HELD HERE ──────────────────────────────────────
  // The browser-local `cbb_sectors` list was retired on 2026-09-22 when
  // Commercial Policies became the GOVERNED Sector master. `sectors` and
  // `sectorCodes` now come from state/useGovernedSectors.js, which reads
  // /masters/sectors on the caller's own token. Nothing reads or writes the
  // localStorage key any more, and DEFAULT_SECTORS_DATA is not a fallback:
  // substituting it would cost a quote against numbers no one approved.
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
  useEffect(()=>{try{setItem('cbb_boxtrim',JSON.stringify(boxTrim));}catch(e){}},[boxTrim]);
  useEffect(()=>{try{setItem('cbb_partitions',JSON.stringify(partitionsMaster));}catch(e){}},[partitionsMaster]);
  useEffect(()=>{try{setItem('cbb_constrlib',JSON.stringify(constructionLib));}catch(e){}},[constructionLib]);
  const gradeCodes=["",...rates.map(r=>r.code)];

  return { DEFAULT_LOCATIONS, blanketDisc, blanketInterest, boxTrim, constructionLib, freight, freightBands, gradeCodes, gyPremHigh, gyPremLow, locations, partitionsMaster, rateUpdatedAt, rates, setBlanketDisc, setBlanketInterest, setBoxTrim, setConstructionLib, setFreight, setFreightBands, setGyPremHigh, setGyPremLow, setLocations, setPartitionsMaster, setRateUpdatedAt, setRates, touchRateDate };
}
