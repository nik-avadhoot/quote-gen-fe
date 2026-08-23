// ═══════════════════════════════════════════════════════════════════════════
// src/export/pdf.js — client-side PDF export via a print window.
//
// Split out of QuotationApp.jsx (Phase 3). Pure: takes (items, meta) and
// writes an HTML document into a popup, then calls print().
//
// exportAllPDF is the live path (multi-SKU quote, grouped by SET code).
// exportPDF is the single-SKU variant from the Costing tab; it currently has
// no call site, but is retained deliberately - see the Phase 2 rationale.
// ═══════════════════════════════════════════════════════════════════════════
import { LOGO_WIDE_B64 } from "../assets/logos.js";

export const exportPDF=(spec,result)=>{
  const r=result;if(!r)return;
  const today=new Date().toLocaleDateString("en-IN");
  const html=`<html><head><style>body{font-family:'Segoe UI',sans-serif;margin:32px;color:#1C2B3A;font-size:13px}
h1{color:#D97B2E;font-size:22px;margin:0 0 4px}table{width:100%;border-collapse:collapse;margin:12px 0}
th{background:#1C2B3A;color:white;padding:7px 10px;font-size:11px;text-align:left}
td{padding:7px 10px;border-bottom:1px solid #DDD4C7}
.final{background:#D97B2E;color:white;border-radius:8px;padding:14px 18px;display:flex;justify-content:space-between;margin:16px 0}
.terms{font-size:10px;color:#4A647D;line-height:1.7;border-top:1px solid #DDD4C7;padding-top:10px}
</style></head><body>
<div style="display:flex;align-items:center;gap:16px;margin-bottom:6px">
    <img src="${LOGO_WIDE_B64}" style="height:36px;object-fit:contain"/>
    <span style="font-size:26px;font-weight:900;letter-spacing:0.05em;color:#1C2B3A">QUOTATION</span>
    </div><div style="color:#4A647D;font-size:11px;margin-bottom:20px">Avadhoot Packaging Solutions · ${today}</div>
<table>${[["To",spec.client||"—"],["Product",spec.product||"—"],["Material Code",spec.material_code||"—"],
["Dimensions",`${spec.L}×${spec.W}×${spec.H} mm (${spec.dimType||"ID"})`],
["Construction",`${spec.ply}-ply · ${spec.flute_F1||"—"}${spec.flute_F2?"/"+spec.flute_F2:""} flute · ${spec.boxType}`],
["Board GSM",`Std: ${spec.board_gsm||"—"} / Calc: ${r.calcGSM}`],
["BS NLT",`Std: ${spec.spec_bs||"—"} / Calc: ${r.calcBS} kg/cm²`],
spec.spec_bct?["BCT/CS NLT",`${spec.spec_bct} kgf`]:null,
].filter(Boolean).map(([k,v])=>`<tr><td style="color:#4A647D;width:160px">${k}</td><td>${v}</td></tr>`).join("")}</table>
<div class="final"><div><div style="font-size:26px;font-weight:800">₹${r.finalRate.toFixed(2)}</div>
<div style="font-size:11px;opacity:.8">Landed Rate per Box · Excl. GST</div></div>
<div style="text-align:right;font-size:13px"><div>₹${r.ratePerKg.toFixed(2)} / kg</div>
<div style="font-weight:700;margin-top:4px">MOQ: ${r.calcMOQ.toLocaleString()} boxes</div></div></div>
<div class="terms">Payment: ${spec.paymentDisc||"30"} days · Freight: FCL included · Unloading: Customer's account ·
GST extra at actual · Lead time first: 10–15 days, repeat: 3–7 days · Validity: current quarter</div>
</body></html>`;
  const w=window.open("","_blank");w.document.write(html);w.document.close();setTimeout(()=>w.print(),400);
};

// Re-import: parse Excel back to items
// Fix ①: added meta={} parameter so quoteRef, paymentDisc, and effectiveTo reach the live PDF.
// Previously these were hard-coded. exportPDF (single-SKU from Costing) uses dead code since Fix 13.
export const exportAllPDF=(items,meta={})=>{
  if(!items.length)return;
  const client=items[0]?.spec.client||"Client";
  const today=new Date().toLocaleDateString("en-IN");
  const payDisc=meta.paymentDisc||items[0]?.spec?.paymentDisc||"30";
  const validLine=meta.effectiveTo
    ?`Rates valid until ${new Date(meta.effectiveTo).toLocaleDateString("en-IN")}, subject to review on paper price movement.`
    :"Rates valid for current quarter, subject to review on paper price movement.";
  // Group by SET for PDF
  const setMapPDF={};const standalonePDF=[];
  items.filter(i=>i.result).forEach(item=>{
    const sc=(item.spec.setCode||"").trim().toUpperCase();
    if(sc){if(!setMapPDF[sc])setMapPDF[sc]=[];setMapPDF[sc].push(item);}
    else standalonePDF.push(item);
  });
  let srNo=0;
  const itemRowHTML=item=>{
    const s=item.spec,r=item.result;srNo++;
    return`<tr>
      <td style="padding:6px 10px">${srNo}</td>
      <td style="padding:6px 10px;font-family:monospace;font-size:11px">${s.material_code||"—"}${s.rowType!=="Box"?` <span style="font-size:9px;color:#4A647D">(${s.rowType})</span>`:""}</td>
      <td style="padding:6px 10px"><strong>${s.product||"—"}</strong></td>
      <td style="padding:6px 10px;font-family:monospace">${s.L}×${s.W}${s.H?"×"+s.H:""} (${s.dimType||"ID"})</td>
      <td style="padding:6px 10px">${s.ply}-ply ${s.flute_F1||"—"}${s.flute_F2?"/"+s.flute_F2:""} ${s.boxType}</td>
      <td style="padding:6px 10px">${s.spec_bs?"BS≥"+s.spec_bs:"—"}${s.spec_bct?" / BCT≥"+s.spec_bct+" kgf":""}</td>
      <td style="padding:6px 10px;text-align:right;font-family:monospace">${r.calcMOQ.toLocaleString()}</td>
      <td style="padding:6px 10px;text-align:right;font-weight:800;color:#D97B2E;font-size:14px;font-family:monospace">₹${r.finalRate.toFixed(2)}</td>
    </tr>`;};
  const setHdrHTML=sc=>`<tr style="background:#2E4057"><td colspan="8" style="padding:6px 10px;color:#D97B2E;font-weight:700;font-size:11px">
    📦 SET: ${sc} — combined rate: <span style="font-family:monospace">₹${setMapPDF[sc].reduce((s,i)=>s+i.result.finalRate*(+(i.spec.qtyPerSet)||1),0).toFixed(2)}/set</span></td></tr>`;
  const setFtrHTML=(sc,sitems)=>`<tr style="background:#EBE3D8"><td colspan="7" style="padding:4px 10px;font-weight:600;font-size:10px;color:#2E4057">SET ${sc} total</td>
    <td style="padding:4px 10px;text-align:right;font-weight:800;font-family:monospace;color:#B5641F">₹${sitems.reduce((s,i)=>s+i.result.finalRate*(+(i.spec.qtyPerSet)||1),0).toFixed(2)}</td></tr>`;
  const rows=standalonePDF.map(itemRowHTML).join("")
    +Object.entries(setMapPDF).map(([sc,si])=>setHdrHTML(sc)+si.map(itemRowHTML).join("")+setFtrHTML(sc,si)).join("");
  const w=window.open("","_blank");
  w.document.write(`<html><head><style>
    body{font-family:'Segoe UI',sans-serif;margin:32px;color:#1C2B3A;font-size:12px}
    h1{color:#D97B2E;font-size:20px;margin:0 0 4px}
    .meta{display:flex;justify-content:space-between;margin-bottom:24px;color:#4A647D;font-size:11px}
    table{width:100%;border-collapse:collapse;margin:12px 0}
    th{background:#1C2B3A;color:white;padding:8px 10px;font-size:10px;text-align:left;font-weight:600}
    td{border-bottom:1px solid #DDD4C7}
    tr:nth-child(even){background:#FAF7F2}
    .terms{font-size:10px;color:#4A647D;line-height:1.8;border-top:2px solid #D97B2E;padding-top:12px;margin-top:24px}
    @media print{body{margin:16px}}
  </style></head><body>
    <div style="display:flex;align-items:center;gap:16px;margin-bottom:6px">
    <img src="${LOGO_WIDE_B64}" style="height:36px;object-fit:contain"/>
    <span style="font-size:26px;font-weight:900;letter-spacing:0.05em;color:#1C2B3A">QUOTATION</span>
    </div>
    <div style="color:#4A647D;font-size:11px;margin-bottom:2px">Avadhoot Packaging Solutions</div>
    <div class="meta">
      <div><strong>To:</strong> ${client}${meta.quoteRef?` &nbsp;|&nbsp; <strong>Ref:</strong> ${meta.quoteRef}`:""}</div>
      <div><strong>Date:</strong> ${today} &nbsp;|&nbsp; <strong>Items:</strong> ${items.filter(i=>i.result).length}${meta.makerName?` &nbsp;|&nbsp; <strong>Prepared by:</strong> ${meta.makerName}`:""}</div>
    </div>
    <table><thead><tr>
      <th>#</th><th>Material Code</th><th>SKU Description</th><th>Dimensions (mm)</th>
      <th>Construction</th><th>Spec (BS / BCT)</th><th style="text-align:right">MOQ (boxes)</th>
      <th style="text-align:right">Landed Rate (Rs/box, excl GST)</th>
    </tr></thead><tbody>${rows}</tbody></table>
    <div class="terms">
      <strong>Terms &amp; Conditions:</strong><br/>
      1. Rates are LANDED and EXCLUDE GST (applicable at prevailing rates).<br/>
      2. Orders on MOQ per SKU and Full Container Load (FCL) per delivery.<br/>
      3. Payment terms: ${payDisc} days from date of invoice (unless otherwise agreed).<br/>
      4. Unloading at delivery site is on customer account.<br/>
      5. First delivery: 10–15 working days. Repeat orders: 3–7 working days.<br/>
      6. ${validLine}
    </div>
  </body></html>`);
  w.document.close();setTimeout(()=>w.print(),400);
};
