// ═══════════════════════════════════════════════════════════════════════════
// src/data/defaults.js
// All master data constants — DEFAULT_RATES, DEFAULT_FREIGHT, sector
// defaults, box trim table, partitions master, INIT_SPEC, PLANTS, etc.
// Pure data: no React, no side-effects. Import anywhere: engine, services, UI.
// ═══════════════════════════════════════════════════════════════════════════

/* ═══ CONSTANTS ════════════════════════════════════════════════════════════ */
export const PLANTS=["Nagpur","Pune","Kolkata"]; // Khed removed — only 3 producing plants
export const LOCATIONS=["Nagpur","Pune","Kolkata","Haldia","Howrah","Guwahati","Delhi","Ahmedabad","Hyderabad"];
export const TAKEUP={A:1.51,B:1.37,C:1.47,E:1.31};
export const TRIM={RSC:{3:[30,60],5:[35,75]},"Die-R":{3:[44,60],5:[60,85]},"Die-S":{3:[20,30],5:[20,30]},Board:{3:[10,10],5:[10,10]}};
export const DEFAULT_SECTORS_DATA=[
  {code:"PAINTS",    name:"Paints / Decorative",       wasteCBB:5,wastePP:5,  convBox:7,   convPP:10,   specLang:"ECT+BS"},
  {code:"ALCOBEV",   name:"Alcobev (Glass & PET)",     wasteCBB:5,wastePP:5,  convBox:7,   convPP:12.5, specLang:"BS"},
  {code:"ICE-CREAM", name:"Ice Cream / Dairy",         wasteCBB:5,wastePP:5,  convBox:12,  convPP:0,    specLang:"BS"},
  {code:"SOLAR-PANEL",name:"Solar — Panel Box",        wasteCBB:5,wastePP:3,  convBox:15,  convPP:0,    specLang:"BS+BCT"},
  {code:"SOLAR-CELL",name:"Solar — Cell/Ingot",        wasteCBB:5,wastePP:3,  convBox:6.5, convPP:0,    specLang:"CS+BS"},
  {code:"COOLER",    name:"Coolers / White Goods",      wasteCBB:5,wastePP:0,  convBox:11,  convPP:0,    specLang:"BS"},
  {code:"TEXTILE",   name:"Textiles / Warehousing",     wasteCBB:5,wastePP:0,  convBox:5.75,convPP:0,    specLang:"BS"},
  {code:"FOOD-SVC",  name:"Food Service / QSR",         wasteCBB:5,wastePP:0,  convBox:12,  convPP:0,    specLang:"BCT"},
  {code:"BISCUIT",   name:"Biscuits & Confectionery",   wasteCBB:4,wastePP:5,  convBox:7,   convPP:10,   specLang:"BCT+BS"},
  {code:"CHIPS",     name:"Snacks / Chips",              wasteCBB:4,wastePP:5,  convBox:6.5, convPP:10,   specLang:"BCT+BS"},
  {code:"PETROL",    name:"Petroleum / Lubricants",      wasteCBB:5,wastePP:0,  convBox:7,   convPP:0,    specLang:"BCT+BS"},
  {code:"EDIBLE-OIL",name:"FMCG / Edible Oils",         wasteCBB:5,wastePP:0,  convBox:7,   convPP:0,    specLang:"CS+BS"},
  {code:"FOOTWEAR",  name:"Footwear",                   wasteCBB:5,wastePP:0,  convBox:8,   convPP:0,    specLang:"BS"},
  {code:"ELEC-LED",  name:"Electronics / LED",           wasteCBB:6,wastePP:0,  convBox:7,   convPP:0,    specLang:"BS"},
  {code:"BEAUTY",    name:"Beauty / D2C",                wasteCBB:7,wastePP:0,  convBox:6,   convPP:0,    specLang:"BCT"},
  {code:"CHEMICAL",  name:"Chemicals / Adhesives",       wasteCBB:5,wastePP:5,  convBox:7,   convPP:0,    specLang:"BS"},
  {code:"FANS",      name:"Consumer Durables/Fans",      wasteCBB:5,wastePP:5,  convBox:8,   convPP:10,   specLang:"BS"},
  {code:"PHARMA",    name:"Pharmaceuticals",             wasteCBB:5,wastePP:5,  convBox:7,   convPP:10,   specLang:"BCT+BS"},
  {code:"FMCG-FOOD", name:"FMCG Food / Staples",        wasteCBB:5,wastePP:5,  convBox:7,   convPP:10,   specLang:"BCT+BS"},
];
export const DEFAULT_BOX_TRIM_DATA={
  RSC:     {d3:30,c3:60,d5:35,c5:75, deckleF:"(W+H)×Ups+Trim", cuttingF:"(L+W)×2+Trim"},
  "HRSC-R":{d3:30,c3:60,d5:35,c5:75, deckleF:"(W+H)×Ups+Trim", cuttingF:"(L+W)×2+Trim"},
  "HRSC-L":{d3:55,c3:75,d5:55,c5:75, deckleF:"(W+H)×Ups+Trim", cuttingF:"(L+W)×2+Trim"},
  "HRSC-O":{d3:15,c3:60,d5:15,c5:60, deckleF:"(W+H)×Ups+Trim", cuttingF:"(L+W)×2+Trim"},
  "Die-S": {d3:20,c3:30,d5:20,c5:30, deckleF:"(W+H)×Ups+Trim", cuttingF:"(L+W)×2+Trim"},
  "Die-R": {d3:44,c3:60,d5:60,c5:85, deckleF:"(W+H)×Ups+Trim", cuttingF:"(L+W)×2+Trim"},
  Board:   {d3:10,c3:10,d5:10,c5:10, deckleF:"L×Ups+Trim",     cuttingF:"W+Trim (flat piece)"},
  PP:      {d3:0, c3:0, d5:0, c5:0,  deckleF:"L×Ups (trim=0)", cuttingF:"W (trim=0)"},
  Custom:  {d3:0, c3:0, d5:0, c5:0,  deckleF:"User-defined",    cuttingF:"User-defined"},
};

// Partitions master for Alcobev glass SKU types
export const PARTITIONS_MASTER_DEFAULT=[
  {skuType:"Dip 90 (96 B)",  lwise:7, wwise:11},
  {skuType:"Dip 90 (100 B)", lwise:9, wwise:9},
  {skuType:"Nip 180",        lwise:5, wwise:7},
  {skuType:"Pint 375",       lwise:3, wwise:5},
  {skuType:"Half-Liter 500", lwise:2, wwise:5},
  {skuType:"Quart 750",      lwise:2, wwise:3},
  {skuType:"Liter 1L",       lwise:2, wwise:3},
  {skuType:"2 Liter 2L",     lwise:1, wwise:2},
];

export const CREDIT_PCT=0.015;
export const SECTORS=["PAINTS","ALCOBEV","ICE-CREAM","SOLAR-PANEL","SOLAR-CELL",
  "COOLER","TEXTILE","FOOD-SVC","BISCUIT","CHIPS","PETROL","EDIBLE-OIL","FOOTWEAR",
  "ELEC-LED","BEAUTY","CHEMICAL","FANS","PHARMA","FMCG-FOOD"];

export const DEFAULT_RATES=[
  {code:"16",   desc:"16 BF Kraft",                    price:31.5, disc:1.0,freight:0},
  {code:"18",   desc:"18 BF Kraft",                    price:32.0, disc:1.0,freight:0},
  {code:"20",   desc:"20 BF Kraft",                    price:33.5, disc:1.0,freight:0},
  {code:"22",   desc:"22 BF Kraft",                    price:35.0, disc:1.0,freight:0},
  {code:"24",   desc:"24 BF Kraft",                    price:39.0, disc:1.0,freight:0},
  {code:"28",   desc:"28 BF Kraft",                    price:44.5, disc:1.5,freight:0},
  {code:"35",   desc:"35 BF Kraft (calc as 33)",       price:51.5, disc:1.5,freight:0},
  {code:"20GY", desc:"20 BF Golden Yellow",            price:35.0, disc:1.0,freight:0},
  {code:"22GY", desc:"22 BF Golden Yellow",            price:36.5, disc:1.0,freight:0},
  {code:"24GY", desc:"24 BF Golden Yellow (=25VK)",    price:40.5, disc:1.0,freight:0},
  {code:"28GY", desc:"28 BF Golden Yellow",            price:45.5, disc:1.5,freight:0},
  {code:"35GY", desc:"35 BF Golden Yellow (calc 33)",  price:52.0, disc:1.5,freight:0},
  {code:"25WTL",desc:"25 BF White Top Liner",          price:76.0, disc:1.5,freight:0},
  {code:"14DUP",desc:"14 BF Duplex Board",             price:45.0, disc:1.5,freight:0},
  {code:"26HRCT",desc:"26 BF High Recycle Content",    price:44.5, disc:1.5,freight:0},
  {code:"40VKL",desc:"40 BF Imported Virgin Kraft",    price:68.0, disc:1.5,freight:0},
];
export const DEFAULT_FREIGHT={
  Nagpur: {Nagpur:2.0,Pune:2.5,Kolkata:4.0,Haldia:4.5,Howrah:4.0,Guwahati:5.5,Delhi:3.5,Ahmedabad:3.0,Hyderabad:3.5},
  Pune:   {Nagpur:2.0,Pune:1.8,Kolkata:4.2,Haldia:4.5,Howrah:4.2,Guwahati:5.5,Delhi:3.5,Ahmedabad:2.5,Hyderabad:3.0},
  Kolkata:{Nagpur:4.0,Pune:4.2,Kolkata:1.5,Haldia:2.0,Howrah:1.5,Guwahati:3.5,Delhi:4.0,Ahmedabad:5.0,Hyderabad:4.5},
};
export const BOX_TYPES=["RSC","Die-R","Die-S","HRSC-L","HRSC-R","HRSC-O","Board","PP","Custom"];
export const INIT_SPEC={
  client:"",product:"",material_code:"",sector:"",
  L:"",W:"",H:"",dimType:"ID",boxType:"RSC",ply:5,ups:1,
  flute_F1:"B",flute_F2:"A",
  layers:{TOP:{code:"",gsm:""},F1:{code:"",gsm:""},L1:{code:"",gsm:""},F2:{code:"",gsm:""},L2:{code:"",gsm:""}},
  board_gsm:"",spec_bs:"",spec_bct:"",spec_ect:"",reqBoxWt:"", // required box weight if customer specifies
  plant:"Nagpur",delivery:"Nagpur",
  waste:5,convRate:7,wastePP:5,convRatePP:12.5,skuType:"",freightOverride:"",margin:8,interest:0.5,
  printing:0,stitching:0,coating:0,handling:0,moqCharge:0,packing:0,other:0,unloading:0, // v6.1 order
  volume:"",salesMOQ:"",customerType:"existing",priceContext:"unknown",isRepeat:false,
  paymentDisc:"30", // credit days → auto-sets interest%
  setCode:"",rowType:"Box",qtyPerSet:1,flutingBCF:0.10, // fluting BS contribution factor (0-0.30): setCode links box+plate+partition; rowType=RS4/Plate/Partition-L/Partition-W
};

/* ═══ PART 1 — COSTING ENGINE (pure, zero AI) ═════════════════════════════ */
