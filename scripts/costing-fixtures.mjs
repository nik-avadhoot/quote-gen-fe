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
import { calcCosting, calcCostingOutcome, checkMissingInfo } from '../src/engine/costing.js';
import { materializeEffectiveRates } from '../src/engine/rateMaster.js';
import { INIT_SPEC, DEFAULT_RATES, DEFAULT_FREIGHT, DEFAULT_BOX_TRIM_DATA }
  from '../src/data/defaults.js';

const GOLDEN_PATH = join(dirname(fileURLToPath(import.meta.url)), 'costing-golden.json');
const FIELDS = ['finalRate', 'ratePerKg', 'calcMOQ', 'calcGSM', 'calcBS'];
const EFFECTIVE_RATES = materializeEffectiveRates(DEFAULT_RATES);

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

// S7(b) — the Interest arms. E-1 removed the destructuring default of 1.5 and
// E-2 replaced `+interest||0` with the same nz() treatment waste and conversion
// already had. Neither defect was reachable from any caller: INIT_SPEC carries
// interest:0.5 and buildSpecFromRow supplies `prof.interest ?? 0.5`, so no
// existing golden moved. These three arms make the corrected behaviour a
// GOLDEN rather than an assertion about unreachable code.
//
// Measured before/after on the box-5ply spec:
//
//   interest: 0.5   0.500% -> 0.500%   finalRate 41.25 -> 41.25   unchanged
//   interest: 0     0.000% -> 0.000%   finalRate 41.05 -> 41.05   unchanged
//   interest: ''    0.000% -> 0.500%   finalRate 41.05 -> 41.25   E-2
//   interest absent 1.500% -> 0.500%   finalRate 41.60 -> 41.25   E-1
const CASES = {
  'box-5ply':     BOX_5PLY,
  'plate':        PLATE,
  'part-L wPP=0': { ...PART_L, wastePP: 0 },
  'part-L wPP=5': { ...PART_L, wastePP: 5 },
  // explicit zero: a Pricing Group that charges no interest. Must stay 0.
  'box int=0':     { ...BOX_5PLY, interest: 0 },
  // blank: inherit the versioned 0.5% fallback (CDM-18). Used to become 0.
  'box int=blank': { ...BOX_5PLY, interest: '' },
  // absent: same fallback. Used to become the unapproved 1.5%.
  'box int=absent': (() => { const s = { ...BOX_5PLY }; delete s.interest; return s; })(),
};

/* ── Run ───────────────────────────────────────────────────────────────────*/

const run = (name, spec) => {
  const r = calcCosting(spec, EFFECTIVE_RATES, DEFAULT_FREIGHT, DEFAULT_BOX_TRIM_DATA);
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
/* The same discipline for Interest (S7 / E-2). A blank and an explicit zero
   both produced 0% before this slice, so the two arms were identical and the
   distinction was invisible. Assert they DIFFER, and that blank lands on the
   versioned 0.5% fallback rather than on the withdrawn 1.5%.               */
const i0 = actual['box int=0'], iB = actual['box int=blank'], iA = actual['box int=absent'];
if (i0.finalRate === iB.finalRate) {
  fail(`contrast: box interest 0 and BLANK are identical (${i0.finalRate}) — ` +
       `blank is being read as zero (E-2)`);
}
if (iB.finalRate !== iA.finalRate) {
  fail(`contrast: BLANK (${iB.finalRate}) and ABSENT (${iA.finalRate}) differ — ` +
       `both must reach the one versioned fallback, not two different answers`);
}
if (iB.finalRate !== actual['box-5ply'].finalRate) {
  fail(`contrast: BLANK (${iB.finalRate}) did not land on the 0.5% fallback ` +
       `(${actual['box-5ply'].finalRate}) — check interestFallbackPct`);
}

const contrastBroken = failed > 0;
if (!contrastBroken) {
  console.log(`ok    contrast: wastePP 0 vs 5 differ ` +
    `(finalRate ${w0.finalRate}/${w5.finalRate}, calcMOQ ${w0.calcMOQ}/${w5.calcMOQ})`);
  console.log(`ok    contrast: interest 0 vs blank differ ` +
    `(finalRate ${i0.finalRate}/${iB.finalRate}), and blank == absent == 0.5% fallback`);
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


/* ══ S8(a) — THE OUTCOME BOUNDARY ══════════════════════════════════════════
   These arms are NOT golden entries. `run()` above throws on a null result,
   and recording an unresolved case into the golden as `null` would be the
   wrong shape — it would encode "no rate on file" as an expected NUMBER, the
   very collapse this slice removes. They are asserted directly instead.     */

const outcomeOk = (name, cond, extra = '') => {
  if (cond) console.log(`ok    ${name}`);
  else { fail(`${name}${extra ? ` — ${extra}` : ''}`); }
};

// A destination that is genuinely absent from DEFAULT_FREIGHT. Nagpur ships to
// Pune (2.5) but there is no Nashik row anywhere in the mirror.
const UNRESOLVABLE = { ...BOX_5PLY, delivery: 'Nashik' };
const FLAG_ON  = { authorityV2: true };
const FLAG_OFF = { authorityV2: false };
const args = s => [s, EFFECTIVE_RATES, DEFAULT_FREIGHT, DEFAULT_BOX_TRIM_DATA];

console.log('\n── S8(a) flag-off parity: the LEGACY function, not an emulation ──');
{
  // Blank, explicit zero, positive, and a missing pair. Flag off must equal the
  // unchanged legacy call in every one — INCLUDING the legacy treatment of zero,
  // which `if(override&&+override>0)` DISCARDS. Parity means bit-identical to
  // what shipped, defects and all; the corrected semantics arrive with the flag.
  const parity = [
    ['blank override',   { ...BOX_5PLY, freightOverride: '' }],
    ['explicit zero',    { ...BOX_5PLY, freightOverride: 0 }],
    ['positive override',{ ...BOX_5PLY, freightOverride: 9.5 }],
    ['missing pair',     UNRESOLVABLE],
  ];
  for (const [label, spec] of parity) {
    const legacy  = calcCosting(...args(spec));
    const flagOff = calcCostingOutcome(...args(spec), FLAG_OFF);
    outcomeOk(`${label}: flag-off result is identical to the legacy call`,
      JSON.stringify(flagOff.result) === JSON.stringify(legacy));
    outcomeOk(`${label}: and invents no provenance`, flagOff.freightResolution === null);
  }
  // The legacy defect is still present with the flag OFF. Asserted, not assumed:
  // this is what makes "bit-identical" a claim with teeth rather than a hope.
  const zeroOff  = calcCostingOutcome(...args({ ...BOX_5PLY, freightOverride: 0 }), FLAG_OFF);
  const blankOff = calcCostingOutcome(...args({ ...BOX_5PLY, freightOverride: '' }), FLAG_OFF);
  outcomeOk('flag off: explicit zero is STILL indistinguishable from blank (pre-S8 behaviour)',
    zeroOff.result.finalRate === blankOff.result.finalRate);
  outcomeOk('flag off: a missing pair STILL silently prices at 0 freight (pre-S8 behaviour)',
    calcCostingOutcome(...args(UNRESOLVABLE), FLAG_OFF).result.frRate === 0);
}

console.log('\n── S8(a) flag on: explicit zero and unresolved become distinct ──');
{
  const zero  = calcCostingOutcome(...args({ ...BOX_5PLY, freightOverride: 0 }), FLAG_ON);
  const blank = calcCostingOutcome(...args({ ...BOX_5PLY, freightOverride: '' }), FLAG_ON);
  outcomeOk('an explicit zero override survives as a value',
    zero.freightResolution.value === 0 && zero.freightResolution.source === 'legacy_batch');
  outcomeOk('and it PRICES differently from blank, which inherits 2.5',
    zero.result.frRate === 0 && blank.result.frRate === 2.5
    && zero.result.finalRate !== blank.result.finalRate);
  outcomeOk('blank inherits from the temporary mirror, and says so',
    blank.freightResolution.source === 'legacy_matrix'
    && blank.freightResolution.authority === 'temporary');
  outcomeOk('the mirror never claims approved-master authority',
    blank.freightResolution.source !== 'master'
    && blank.freightResolution.sourceRef === 'app-mirror/default-freight');
}

console.log('\n── S8(a) unresolved produces NO usable calculation ──');
{
  const out = calcCostingOutcome(...args(UNRESOLVABLE), FLAG_ON);
  outcomeOk('result is null — the arithmetic never ran', out.result === null);
  outcomeOk('but the reason survives the null result',
    out.freightResolution.source === 'unresolved'
    && out.freightResolution.reason === 'no_legacy_pair');
  outcomeOk('no total, final rate or freight rate exists to be misread',
    out.result === null);
  outcomeOk('the value is null, never 0 and never NaN',
    out.freightResolution.value === null && !Number.isNaN(out.freightResolution.value));

  // checkMissingInfo receives the SAME object and turns it into a blocker.
  const missing = checkMissingInfo(UNRESOLVABLE, out.result, out.freightResolution);
  outcomeOk('checkMissingInfo raises a freight BLOCKER, not an assumption',
    missing.blockers.some(b => b.startsWith('Freight unresolved')));
  outcomeOk('and no longer offers the misleading matrix assumption',
    !missing.assumptions.includes('Freight from plant×location matrix'));
  outcomeOk('the blocker names the route it could not price',
    missing.blockers.some(b => b.includes('Nagpur → Nashik')));

  // Same call with NO resolution keeps the pre-S8 line exactly.
  const legacyMissing = checkMissingInfo(UNRESOLVABLE, calcCosting(...args(UNRESOLVABLE)));
  outcomeOk('omitting the resolution preserves the pre-S8 assumption verbatim',
    legacyMissing.assumptions.includes('Freight from plant×location matrix')
    && !legacyMissing.blockers.some(b => b.startsWith('Freight unresolved')));
}

console.log('\n── S8(a) the wrapper cannot be mistaken for a result ──');
{
  const out = calcCostingOutcome(...args(BOX_5PLY), FLAG_ON);
  outcomeOk('it carries no costing fields of its own',
    out.finalRate === undefined && out.total === undefined && out.frRate === undefined);
  outcomeOk('it is frozen', Object.isFrozen(out));
  outcomeOk('and exposes exactly two keys',
    JSON.stringify(Object.keys(out).sort()) === JSON.stringify(['freightResolution', 'result']));
  outcomeOk('calcCosting itself still returns a bare result, never a wrapper',
    calcCosting(...args(BOX_5PLY)).finalRate === 41.25);
}

console.log(failed ? `\n${failed} failure(s)` : '\nall fixtures pass');
process.exit(failed ? 1 : 0);
