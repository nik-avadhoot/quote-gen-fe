// ═══════════════════════════════════════════════════════════════════════════
// scripts/case4-reference.mjs — derive negative Case 4's reference numbers.
//
//   npm run ref:case4                      against DEFAULT_* (engine baseline)
//   npm run ref:case4 -- <backup.json>     against a ⬇ Backup file (UI baseline)
//
// WHY THIS EXISTS
// The plan used to carry Case 4's expected pair as a hand-written literal
// (₹2.10 / MOQ 82,200). It went stale, silently, and a stale literal at a gate
// is worse than no literal: it fails a correct build, or passes a wrong one.
//
// The staleness has a specific cause worth naming, because it will recur:
//
//   scripts/costing-fixtures.mjs  →  pinned to DEFAULT_RATES / DEFAULT_FREIGHT
//                                    / DEFAULT_BOX_TRIM_DATA. Masters-INDEPENDENT.
//   the running app             →  useMastersState.js:16 reads localStorage
//                                    'cbb_rates' and only falls back to
//                                    DEFAULT_RATES when it is absent or unparseable.
//                                    Masters-DEPENDENT.
//
// So the harness golden and the on-screen number are computed from DIFFERENT
// master data the moment anyone edits Rate Master, Freight or Defaults — which
// D-8 records as an unguarded direct write. Before any such edit the two agree
// exactly, and that agreement is what made the literal look trustworthy: it was
// never independently true, it was the engine golden wearing a UI label.
//
// Hence: the reference is DERIVED here, at check time, from the same masters
// the app will use. Nothing to transcribe, nothing to go stale.
// ═══════════════════════════════════════════════════════════════════════════
import { existsSync, readFileSync } from 'node:fs';
import { calcCosting } from '../src/engine/costing.js';
import { INIT_SPEC, DEFAULT_RATES, DEFAULT_FREIGHT, DEFAULT_BOX_TRIM_DATA }
  from '../src/data/defaults.js';

const backupPath = process.argv[2];

/* ── Masters ───────────────────────────────────────────────────────────────
   A ⬇ Backup file stores raw localStorage values, so each entry may be a JSON
   string or an already-parsed object depending on how it was written. Accept
   both, and fall back to the DEFAULT_* master exactly as the app does.       */
const pick = (bak, key, fallback) => {
  if (!bak || bak[key] == null) return { value: fallback, source: 'DEFAULT_*' };
  const raw = bak[key];
  try {
    return { value: typeof raw === 'string' ? JSON.parse(raw) : raw, source: key };
  } catch {
    return { value: fallback, source: `DEFAULT_* (${key} unparseable)` };
  }
};

let backup = null;
if (backupPath) {
  if (!existsSync(backupPath)) {
    console.error(`no such backup file: ${backupPath}`);
    process.exit(1);
  }
  backup = JSON.parse(readFileSync(backupPath, 'utf8'));
}

const rates   = pick(backup, 'cbb_rates',   DEFAULT_RATES);
const freight = pick(backup, 'cbb_freight', DEFAULT_FREIGHT);
const boxTrim = pick(backup, 'cbb_boxtrim', DEFAULT_BOX_TRIM_DATA);

/* ── The Case 4 spec ───────────────────────────────────────────────────────
   Identical to fixture 3's PART_L in costing-fixtures.mjs, so the two are
   directly comparable. Both wastePP arms are PINNED here at the spec level —
   this script never reads a sector's wastePP, so it cannot be perturbed by,
   and reveals nothing about, sector master data.                            */
const LAYERS_3PLY = { TOP:{code:"20",gsm:150}, F1:{code:"20",gsm:120}, L1:{code:"20",gsm:150},
                      F2:{code:"",gsm:""},     L2:{code:"",gsm:""} };

const PART_L = { ...INIT_SPEC, L:360, W:240, H:"", boxType:"PP", ply:3, ups:2,
  flute_F1:"B", layers:LAYERS_3PLY, plant:"Nagpur", delivery:"Pune",
  convRatePP:12.5, margin:8, interest:0.5, rowType:"Part-L" };

const arm = (wastePP) => {
  const r = calcCosting({ ...PART_L, wastePP }, rates.value, freight.value, boxTrim.value);
  if (!r) throw new Error(`calcCosting returned null for wastePP=${wastePP}`);
  return r;
};

const correct = arm(0);   // what Case 4 must show
const wrong   = arm(5);   // what a `||` fallback to a wastePP:5 sector would show

const money = n => `₹${Number(n).toFixed(2)}`;
const moq   = n => Number(n).toLocaleString('en-IN');

console.log('');
console.log('NEGATIVE CASE 4 — Part-L with wastePP explicitly set to 0');
console.log('');
console.log(`  masters   rates=${rates.source}  freight=${freight.source}  boxTrim=${boxTrim.source}`);
console.log(`  source    ${backupPath ?? 'DEFAULT_* (no backup supplied)'}`);
console.log('');
console.log(`  PASS  wastePP = 0   Final Rate ${money(correct.finalRate)}   MOQ ${moq(correct.calcMOQ)}`);
console.log(`  FAIL  wastePP = 5   Final Rate ${money(wrong.finalRate)}   MOQ ${moq(wrong.calcMOQ)}`);
console.log('');

if (correct.finalRate === wrong.finalRate) {
  console.error('VACUOUS: both arms produced the same rate — this check proves nothing.');
  console.error('The masters in use flatten the wastePP difference. Do not gate on this run.');
  process.exit(1);
}
console.log('  Enter this spec in Costing, clear wastePP to 0, and read Final Rate.');
console.log('  It must match the PASS line. The FAIL line is what a regressed');
console.log('  resolver produces — a plausible number, which is why it needs a check.');
console.log('');
