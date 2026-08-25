// ═══════════════════════════════════════════════════════════════════════════
// src/components/BoxDieline.jsx — live 2-D die-line SVG preview.
//
// Split out of QuotationApp.jsx (Phase 3). Fully self-contained: derives the
// flat blank from L/W/H + box type, scales it into a fixed canvas, and draws
// panels, flaps, glue lap and dimension labels.
//
// Deliberately imports nothing - all colours are local constants, and it uses
// no hooks, so it is safe to render inside maps and conditionals.
// ═══════════════════════════════════════════════════════════════════════════

// ── BoxDieline: Live 2D die-line SVG from L×W×H + box type ──────────────────
// Renders a flat blank approximation. All dimensions derived, no external files.
// Flap height = min(W/2, H) for RSC/HRSC. Die-cut represented as rounded rect.
// KLD note: for die-cut SKUs, this is a reference approximation only.
// Actual KLD from customer supersedes.
function BoxDieline({L,W,H,boxType,dimType,ups,style={}}){
  const l=parseFloat(L)||0,w=parseFloat(W)||0,h=parseFloat(H)||0;
  if(!l||!w||!h)return(
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",
      height:160,background:"#F8F8F8",borderRadius:6,border:"1px dashed #CCC",
      fontSize:11,color:"#999",flexDirection:"column",gap:4,...style}}>
      <span>📦</span><span>Enter L×W×H to preview die-line</span>
    </div>);

  const isBoard=boxType==="Board"||boxType==="PP";
  const isCustom=boxType==="Custom";
  const isDie=boxType==="Die-R"||boxType==="Die-S";
  const isHRSC=boxType==="HRSC-L"||boxType==="HRSC-R"||boxType==="HRSC-O";
  const isRSC=!isBoard&&!isCustom&&!isDie&&!isHRSC;

  // Flat blank overall size:
  // RSC blank = (2L+2W) wide × (H + 2*flapH) tall
  // HRSC blank = (2L+2W) wide × (H + flapH) tall (bottom flaps only)
  // Flap height = min(W/2, H) per RSC standard
  const flapH=Math.min(w/2,h);
  const glueLap=Math.max(w*0.1,15); // glue lap ≈ 10% of W min 15mm

  // Blank dimensions (mm)
  let blankW, blankH;
  if(isBoard||isCustom||isDie){
    blankW=l; blankH=w; // simple rectangle or die approximation
  } else if(isHRSC){
    blankW=2*l+2*w+glueLap; blankH=h+flapH;
  } else {
    // RSC
    blankW=2*l+2*w+glueLap; blankH=h+2*flapH;
  }

  // SVG canvas — scale to fit 300×180 with 10px padding
  const PAD=12;
  const maxSVGW=300, maxSVGH=180;
  const scaleX=(maxSVGW-2*PAD)/blankW;
  const scaleY=(maxSVGH-2*PAD)/blankH;
  const sc=Math.min(scaleX,scaleY,1.2); // cap upscale to 1.2×
  const svgW=Math.round(blankW*sc+2*PAD);
  const svgH=Math.round(blankH*sc+2*PAD);

  const px=(mm)=>Math.round(mm*sc+PAD); // mm→px offset from origin
  const pw=(mm)=>Math.round(mm*sc);     // mm→px width/height

  // Colours
  const CUT="#444";    // cut line
  const FOLD="#888";   // fold/score line (dashed)
  const FILL="#F5F0E8";// blank fill
  const GLUE="#E8F5E8";// glue lap fill
  const FLAP="#F0F5FF";// flap fill
  const KLD="#E53E3E";  // KLD note colour
  const strokeW=1;

  const foldDash="3,3";

  // ── RSC panels: [leftFlap | leftPanel | frontPanel | rightPanel | glueLap] ──
  // leftPanel=W, frontPanel=L, rightPanel=W, leftFlap=L, glueLap
  // We'll lay out: glueLap at x=0, then W, L, W, L
  // Standard orientation: glue at left edge

  const x0=PAD;
  const y0=PAD;
  const yFlap=y0;                    // top flaps start
  const yBody=y0+(isHRSC?0:pw(flapH));  // body starts (RSC has top flaps above)
  const yBotFlap=yBody+pw(h);        // bottom flaps start

  // panel X positions
  const xGlue=x0;
  const xP1=xGlue+pw(glueLap);      // left (W) panel
  const xP2=xP1+pw(w);              // front (L) panel
  const xP3=xP2+pw(l);              // right (W) panel
  const xP4=xP3+pw(w);              // back (L) panel

  const totalW=pw(glueLap)+pw(w)+pw(l)+pw(w)+pw(l);

  if(isBoard||isCustom){
    // Simple rectangle
    return(
    <svg width={svgW} height={svgH} style={{display:"block",...style}}>
      <rect x={x0} y={y0} width={pw(l)} height={pw(w)} fill={FILL} stroke={CUT} strokeWidth={strokeW}/>
      {isCustom&&<text x={x0+pw(l)/2} y={y0+pw(w)/2} textAnchor="middle" dominantBaseline="middle"
        fontSize={11} fill="#AAA">Custom KLD</text>}
      <text x={x0} y={y0+pw(w)+10} fontSize={8} fill="#888">{l}×{w} mm</text>
    </svg>);
  }

  if(isDie){
    // Approximation: outer cut (rounded rect) with fold lines for walls
    const cr=Math.min(pw(20),pw(w)*0.2);
    return(
    <svg width={svgW} height={svgH} style={{display:"block",...style}}>
      <rect x={x0} y={y0} width={pw(l)} height={pw(w)} rx={cr} ry={cr}
        fill={FILL} stroke={CUT} strokeWidth={strokeW}/>
      {/* Inner fold lines suggesting panel layout */}
      <line x1={x0+pw(h)} y1={y0} x2={x0+pw(h)} y2={y0+pw(w)} stroke={FOLD} strokeWidth={strokeW} strokeDasharray={foldDash}/>
      <line x1={x0+pw(h)+pw(l-2*h)} y1={y0} x2={x0+pw(h)+pw(l-2*h)} y2={y0+pw(w)} stroke={FOLD} strokeWidth={strokeW} strokeDasharray={foldDash}/>
      <line x1={x0} y1={y0+pw(h)} x2={x0+pw(l)} y2={y0+pw(h)} stroke={FOLD} strokeWidth={strokeW} strokeDasharray={foldDash}/>
      <line x1={x0} y1={y0+pw(w)-pw(h)} x2={x0+pw(l)} y2={y0+pw(w)-pw(h)} stroke={FOLD} strokeWidth={strokeW} strokeDasharray={foldDash}/>
      <text x={x0+pw(l)/2} y={y0+pw(w)+10} fontSize={8} fill="#888">{boxType} — approx. KLD only</text>
    </svg>);
  }

  // RSC or HRSC
  const panels=[];

  // ── Glue lap (left edge) ──
  panels.push(<rect key="glue" x={xGlue} y={yBody} width={pw(glueLap)} height={pw(h)}
    fill={GLUE} stroke={CUT} strokeWidth={strokeW}/>);
  panels.push(<text key="glueTxt" x={xGlue+pw(glueLap)/2} y={yBody+pw(h)/2}
    textAnchor="middle" dominantBaseline="middle" fontSize={7} fill="#888" transform={`rotate(-90,${xGlue+pw(glueLap)/2},${yBody+pw(h)/2})`}>Mfg Joint</text>);

  // ── Body panels ──
  [{x:xP1,w_:pw(w),lbl:"W"},{x:xP2,w_:pw(l),lbl:"L"},{x:xP3,w_:pw(w),lbl:"W"},{x:xP4,w_:pw(l),lbl:"L"}].forEach(({x,w_,lbl},i)=>{
    panels.push(<rect key={`body${i}`} x={x} y={yBody} width={w_} height={pw(h)} fill={FILL} stroke={CUT} strokeWidth={strokeW}/>);
    // fold lines between panels (vertical score lines)
    if(i>0)panels.push(<line key={`fold${i}`} x1={x} y1={yBody} x2={x} y2={yBody+pw(h)} stroke={FOLD} strokeWidth={strokeW} strokeDasharray={foldDash}/>);
    // panel dimension label
    panels.push(<text key={`lbl${i}`} x={x+w_/2} y={yBody+pw(h)/2} textAnchor="middle" dominantBaseline="middle" fontSize={8} fill="#999">{lbl}</text>);
  });

  // ── Flap height label on first body panel left flap ──
  const flapXcenters=[xP1,xP2,xP3,xP4];
  const flapWidths=[pw(w),pw(l),pw(w),pw(l)];
  const flapHalfH=Math.min(pw(w/2),pw(h)); // flap height in px

  // ── Top flaps (RSC only) ──
  if(!isHRSC){
    flapXcenters.forEach((fx,i)=>{
      const fw=flapWidths[i];
      const fyTop=y0;
      // Trapezoidal top flap: full width at base, narrower at tip for visual
      panels.push(<rect key={`tflap${i}`} x={fx} y={fyTop} width={fw} height={flapHalfH}
        fill={FLAP} stroke={CUT} strokeWidth={strokeW}/>);
      panels.push(<line key={`tfscore${i}`} x1={fx} y1={fyTop+flapHalfH} x2={fx+fw} y2={fyTop+flapHalfH}
        stroke={FOLD} strokeWidth={strokeW} strokeDasharray={foldDash}/>);
    });
  }

  // ── Bottom flaps ──
  flapXcenters.forEach((fx,i)=>{
    const fw=flapWidths[i];
    panels.push(<rect key={`bflap${i}`} x={fx} y={yBotFlap} width={fw} height={flapHalfH}
      fill={FLAP} stroke={CUT} strokeWidth={strokeW}/>);
    panels.push(<line key={`bfscore${i}`} x1={fx} y1={yBotFlap} x2={fx+fw} y2={yBotFlap}
      stroke={FOLD} strokeWidth={strokeW} strokeDasharray={foldDash}/>);
  });

  // ── H dimension label ──
  panels.push(<text key="dimH" x={xGlue-2} y={yBody+pw(h)/2} textAnchor="end" dominantBaseline="middle" fontSize={7} fill="#888" transform={`rotate(-90,${xGlue-4},${yBody+pw(h)/2})`}>{h}mm H</text>);

  // ── Blank total width annotation ──
  const dimY=yBotFlap+flapHalfH+8;

  // ── Legend ──
  const legX=x0, legY=dimY+10;

  return(
    <svg width={Math.max(svgW,totalW+2*PAD+20)} height={legY+18} style={{display:"block",overflow:"visible",...style}}>
      {panels}
      {/* Legend */}
      <line x1={legX} y1={legY+4} x2={legX+14} y2={legY+4} stroke={CUT} strokeWidth={1}/>
      <text x={legX+16} y={legY+7} fontSize={7} fill="#666">Cut</text>
      <line x1={legX+36} y1={legY+4} x2={legX+50} y2={legY+4} stroke={FOLD} strokeWidth={1} strokeDasharray="3,3"/>
      <text x={legX+52} y={legY+7} fontSize={7} fill="#666">Score/fold</text>
      <rect x={legX+98} y={legY} width={8} height={8} fill={FLAP} stroke={CUT} strokeWidth={0.5}/>
      <text x={legX+108} y={legY+7} fontSize={7} fill="#666">Flap</text>
      <rect x={legX+128} y={legY} width={8} height={8} fill={GLUE} stroke={CUT} strokeWidth={0.5}/>
      <text x={legX+138} y={legY+7} fontSize={7} fill="#666">Mfg Joint</text>
      {isDie&&<text x={legX+180} y={legY+7} fontSize={7} fill={KLD}>⚠ Approx — use customer KLD</text>}
    </svg>);
}
export default BoxDieline;
