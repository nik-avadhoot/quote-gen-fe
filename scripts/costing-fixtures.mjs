// ═══════════════════════════════════════════════════════════════════════════
// scripts/costing-fixtures.mjs — regression gate for the component split.
//
//   npm run test:costing              compare against scripts/costing-golden.json
//   npm run test:costing -- --record  regenerate the golden file
//
// Self-baselining: if costing-golden.json is absent, the first run records it
// and exits 0. Every later run compares against it and exits 1 on any drift.
// No numbers are transcribed by hand; the golden file is generated and committed.
//
// engine/costing.js and data/defaults.js are pure (no localStorage/window/
// document/navigator), so they import straight into Node.
//
// ⚠️ SCOPE — read before trusting a green run.
// This exercises the ENGINE only. It cannot see the four bridge/UI guards in
// the Phase 4 hard stop (new-batch block, client/sector warn, SET Code gate,
// blank-vs-zero resolution). calcCosting receives _calcSpec, in which blanks
// have ALREADY been resolved to defaults — the resolver at
// QuotationApp.jsx:1127-1146 lives inside App() and is not importable.
// A green run here is NEVER sufficient to clear Phase 4.
// ═══════════════════════════════════════════════════════════════════════════
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { calcCosting } from '../src/engine/costing.js';
import { INIT_SPEC, DEFAULT_RATES, DEFAULT_FREIGHT, DEFAULT_BOX_TRIM_DATA }
  from '../src/data/defaults.js';

const GOLDEN_PATH = join(dirname(fileURLToPath(import.meta.url)), 'costing-golden.json');
const FIELDS = ['finalRate', 'ratePerKg', 'calcMOQ', 'calcGSM', 'calcBS'];

/* ── Fixture specs ─────────────────────────────────────────────────────────
   Defined in code so the golden file is always reproducible from source.   */

const LAYERS_5PLY = { TOP:{code:"24",gsm:180}, F1:{code:"20",gsm:150}, L1:{code:"20",gsm:150},
                      F2:{code:"20",gsm:150}, L2:{code:"24",gsm:180} };
const LAYERS_3PLY = { TOP:{code:"20",gsm:150}, F1:{code:"20",gsm:120}, L1:{code:"20",gsm:150},
                      F2:{code:"",gsm:""},     L2:{code:"",gsm:""} };

const BOX_5PLY = { ...INIT_SPEC, L:400, W:300, H:250, boxType:"RSC", ply:5, ups:1,
  flute_F1:"B", flute_F2:"A", layers:LAYERS_5PLY, plant:"Nagpur", delivery:"Pune",
  waste:5, convRate:7, margin:8, interest:0.5, rowType:"Box" };

const PLATE = { ...INIT_SPEC, L:380, W:280, H:"", boxType:"PP", ply:3, ups:1,
  flute_F1:"B", layers:LAYERS_3PLY, plant:"Nagpur", delivery:"Pune",
  wastePP:5, convRatePP:12.5, margin:8, interest:0.5, rowType:"Plate" };

// Fixture 3 base — run twice, wastePP 0 vs 5. See CONTRAST below.
// wastePP:5 is the value PAINTS/ALCOBEV resolve to. It is NOT a universal
// default: of the sector rows in data/defaults.js, 10 carry wastePP:5, 8 carry
// wastePP:0 and 2 carry 3. A 0-sector would make both arms identical and the
// contrast assertion vacuous, so the arms are pinned here rather than derived.
const PART_L = { ...INIT_SPEC, L:360, W:240, H:"", boxType:"PP", ply:3, ups:2,
  flute_F1:"B", layers:LAYERS_3PLY, plant:"Nagpur", delivery:"Pune",
  convRatePP:12.5, margin:8, interest:0.5, rowType:"Part-L" };

const CASES = {
  'box-5ply':     BOX_5PLY,
  'plate':        PLATE,
  'part-L wPP=0': { ...PART_L, wastePP: 0 },
  'part-L wPP=5': { ...PART_L, wastePP: 5 },
};

/* ── Run ───────────────────────────────────────────────────────────────────*/

const run = (name, spec) => {
  const r = calcCosting(spec, DEFAULT_RATES, DEFAULT_FREIGHT, DEFAULT_BOX_TRIM_DATA);
  if (!r) throw new Error(`calcCosting returned null for "${name}" — spec failed its dimension guard`);
  return Object.fromEntries(FIELDS.map(f => [f, r[f]]));
};

const actual = Object.fromEntries(
  Object.entries(CASES).map(([name, spec]) => [name, run(name, spec)]));

let failed = 0;
const fail = msg => { failed++; console.error(`FAIL  ${msg}`); };

/* ── Structural invariant, checked on every run including --record ─────────
   A `||` fallback introduced during the split silently substitutes the sector
   default for a legitimate 0, producing a PLAUSIBLE rate. Plausible is only
   catchable against a known-wrong number, so assert the two arms DIFFER.

   finalRate alone is a weak discriminator — the two arms sit ~2 MROUND(0.05)
   steps apart. calcMOQ is the robust signal: waste% feeds `wt` directly and is
   not rounded. Both are asserted.                                           */

const w0 = actual['part-L wPP=0'], w5 = actual['part-L wPP=5'];
for (const f of ['finalRate', 'calcMOQ']) {
  if (w0[f] === w5[f]) {
    fail(`contrast: part-L ${f} identical (${w0[f]}) for wastePP 0 vs 5 — ` +
         `the 0-vs-blank distinction is not being honoured`);
  }
}
const contrastBroken = failed > 0;
if (!contrastBroken) {
  console.log(`ok    contrast: wastePP 0 vs 5 differ ` +
    `(finalRate ${w0.finalRate}/${w5.finalRate}, calcMOQ ${w0.calcMOQ}/${w5.calcMOQ})`);
}

/* ── Record or compare ─────────────────────────────────────────────────────*/

const forced = process.argv.includes('--record');
const recording = forced || !existsSync(GOLDEN_PATH);

if (recording) {
  if (contrastBroken) {
    console.error('\nREFUSING to record — the contrast invariant is already broken.');
    console.error('A golden recorded now would encode the regression as expected behaviour.');
    process.exit(1);
  }
  writeFileSync(GOLDEN_PATH, JSON.stringify(actual, null, 2) + '\n');
  for (const [name, got] of Object.entries(actual)) {
    console.log(`rec   ${name}  ${FIELDS.map(f => `${f}=${got[f]}`).join('  ')}`);
  }
  console.log(`\nbaseline recorded → ${GOLDEN_PATH}`);
  if (forced) console.log('NOTE: --record overwrites the gate. Commit the diff deliberately.');
  process.exit(0);
}

const golden = JSON.parse(readFileSync(GOLDEN_PATH, 'utf8'));

for (const name of Object.keys(CASES)) {
  const got = actual[name], want = golden[name];
  if (!want) { fail(`${name}: absent from golden file — run with --record if the fixture is new`); continue; }
  const bad = FIELDS.filter(f => got[f] !== want[f]);
  if (bad.length) {
    fail(name);
    for (const f of bad) console.error(`        ${f}: expected ${want[f]}, got ${got[f]}`);
  } else {
    console.log(`ok    ${name}  ${FIELDS.map(f => `${f}=${got[f]}`).join('  ')}`);
  }
}
for (const name of Object.keys(golden)) {
  if (!CASES[name]) fail(`${name}: in golden file but no longer defined as a fixture`);
}

console.log(failed ? `\n${failed} failure(s)` : '\nall fixtures pass');
process.exit(failed ? 1 : 0);
