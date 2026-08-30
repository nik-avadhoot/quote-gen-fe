// ═══════════════════════════════════════════════════════════════════════════
// scripts/draft-fixtures.mjs — the seventh gate: npm run test:draft
//
// The Costing draft model has NO reachable UI path in C3: isDirty has no
// caller until C4, and the corrupt/validation branches need a hand-written
// localStorage blob to reach. This fixture is the only thing that verifies
// them — the same reason test:blanket exists for admin-only dialogs.
//
// It covers costingDraftModel.js ONLY. test:costing remains the costing-engine
// gate and this does not touch it.
//
// Every equality case below names the rule that was NOT implemented and would
// have produced a different answer, so a green run means something: a coercing
// comparator passes the identical-values cases and FAILS the first block.
// ═══════════════════════════════════════════════════════════════════════════
import { deepEqual, freshEnvelope, isDirty, isPlainObject, isValidEnvelope,
  mergeSpec } from "../src/state/costingDraftModel.js";

let fails = 0;
const ok = (name, cond, extra = "") => {
  if (!cond) { fails++; console.log(`FAIL  ${name}${extra ? "  " + extra : ""}`); }
  else console.log(`ok    ${name}`);
};

// ── EQUALITY: strict at every leaf, one NaN exception ────────────────────
// A `==` comparator would call the first four CLEAN. That is the differential.
console.log("── no coercion: \"\", 0, null, undefined and \"5\" are all distinct ──");
ok('"" vs 0 is dirty',            isDirty({a:""},   {a:0}));
ok('0 vs null is dirty',          isDirty({a:0},    {a:null}));
ok('null vs undefined is dirty',  isDirty({a:null}, {a:undefined}));
ok('"" vs null is dirty',         isDirty({a:""},   {a:null}));
ok('"" vs undefined is dirty',    isDirty({a:""},   {a:undefined}));
ok('0 vs undefined is dirty',     isDirty({a:0},    {a:undefined}));
ok('"5" vs 5 is dirty',           isDirty({a:"5"},  {a:5}));
ok('false vs 0 is dirty',         isDirty({a:false},{a:0}));
ok('same value is clean',         !isDirty({a:0},   {a:0}));
ok('"" vs "" is clean',           !isDirty({a:""},  {a:""}));

console.log("\n── the ONE exception: both-NaN is equal ──");
ok('NaN vs NaN is CLEAN',            !isDirty({a:NaN},{a:NaN}));
ok('NaN vs NaN nested is CLEAN',     !isDirty({l:{TOP:{gsm:NaN}}},{l:{TOP:{gsm:NaN}}}));
ok('NaN vs 0 is dirty',              isDirty({a:NaN},{a:0}));
ok('NaN vs null is dirty',           isDirty({a:NaN},{a:null}));
ok('NaN vs undefined is dirty',      isDirty({a:NaN},{a:undefined}));
ok('NaN vs "NaN" is dirty',          isDirty({a:NaN},{a:"NaN"}));
// Without the exception NaN would be permanently dirty against itself and no
// edit could ever clear it.
ok('=== alone would have failed this', !(NaN === NaN) && !isDirty({a:NaN},{a:NaN}));

console.log("\n── documented consequences of using === at the leaves ──");
ok('0 vs -0 is clean (=== semantics; Object.is would differ)', !isDirty({a:0},{a:-0}));
ok('absent key vs explicit undefined is clean',                !isDirty({a:1},{a:1,b:undefined}));
ok('absent key vs explicit null is DIRTY',                     isDirty({a:1},{a:1,b:null}));
ok('absent key vs explicit "" is DIRTY',                       isDirty({a:1},{a:1,b:""}));

console.log("\n── depth, identity and arrays ──");
ok('reaches leaves: layers.TOP.gsm "" vs 0 is dirty',
   isDirty({layers:{TOP:{code:"KL",gsm:""}}},{layers:{TOP:{code:"KL",gsm:0}}}));
ok('identical nested content, different objects, is clean',
   !isDirty({layers:{TOP:{code:"KL",gsm:120}}},{layers:{TOP:{code:"KL",gsm:120}}}));
ok('not comparing by reference', deepEqual({x:{y:[1,2]}},{x:{y:[1,2]}}));
ok('array reorder is dirty',     isDirty({a:[1,2]},{a:[2,1]}));
ok('array length change is dirty',isDirty({a:[1,2]},{a:[1,2,3]}));
ok('equal arrays are clean',      !isDirty({a:[1,"",null]},{a:[1,"",null]}));
ok('array vs object is dirty',    isDirty({a:[]},{a:{}}));
ok('nested undefined vs missing branch is clean', !isDirty({a:{b:1}},{a:{b:1,c:undefined}}));

// ── VALIDATION: malformed is corrupt even when JSON parses ───────────────
console.log("\n── isValidEnvelope: a blob that parses is not thereby a draft ──");
const good={v:1,spec:{},profileDraft:null,baseline:{}};
ok('the C3 envelope is valid', isValidEnvelope(good));
ok('v:2 rejected',             !isValidEnvelope({...good,v:2}));
ok('v:"1" rejected',           !isValidEnvelope({...good,v:"1"}));
ok('missing v rejected',       !isValidEnvelope({spec:{},profileDraft:null,baseline:{}}));
ok('spec:[] rejected',         !isValidEnvelope({...good,spec:[]}));
ok('spec:null rejected',       !isValidEnvelope({...good,spec:null}));
ok('spec:"x" rejected',        !isValidEnvelope({...good,spec:"x"}));
ok('missing baseline rejected',!isValidEnvelope({v:1,spec:{},profileDraft:null}));
ok('baseline:[] rejected',     !isValidEnvelope({...good,baseline:[]}));
ok('profileDraft:{} rejected in C3', !isValidEnvelope({...good,profileDraft:{}}));
ok('profileDraft undefined rejected',!isValidEnvelope({v:1,spec:{},baseline:{}}));
ok('a bare array rejected',    !isValidEnvelope([]));
ok('null rejected',            !isValidEnvelope(null));
ok('a string rejected',        !isValidEnvelope("{}"));
ok('isPlainObject excludes arrays and null',
   isPlainObject({}) && !isPlainObject([]) && !isPlainObject(null));

// ── CORRUPT RECOVERY: what the hook does with each rejected blob ─────────
// The hook's branch is: parse -> validate -> on failure preserve the raw string
// once and start clean. Here we prove the decision half, which is what decides
// whether a user's draft is discarded.
console.log("\n── corrupt recovery: every one of these must route to 'start clean' ──");
const CORRUPT_BLOBS=[
  ['unparseable',            '{not json'],
  ['empty object',           '{}'],
  ['null literal',           'null'],
  ['array literal',          '[1,2,3]'],
  ['a bare spec, no envelope','{"client":"ACME"}'],
  ['unknown version',        '{"v":9,"spec":{},"profileDraft":null,"baseline":{}}'],
  ['spec as array',          '{"v":1,"spec":[],"profileDraft":null,"baseline":{}}'],
  ['baseline missing',       '{"v":1,"spec":{},"profileDraft":null}'],
  ['profileDraft populated', '{"v":1,"spec":{},"profileDraft":{"client":"X"},"baseline":{}}'],
];
CORRUPT_BLOBS.forEach(([name,raw])=>{
  let env=null; try{ env=JSON.parse(raw); }catch{ env=null; }
  ok(`corrupt: ${name}`, !isValidEnvelope(env));
});
// Positive control: a well-formed blob must NOT be treated as corrupt, or the
// whole set above would pass for the wrong reason.
{
  const raw='{"v":1,"spec":{"client":"ACME"},"profileDraft":null,"baseline":{"client":"ACME"}}';
  ok('POSITIVE CONTROL: a good blob is accepted', isValidEnvelope(JSON.parse(raw)));
}

// ── HYDRATION MERGE ──────────────────────────────────────────────────────
console.log("\n── mergeSpec: top level, layers map, and each layer's fields ──");
const INIT={a:1,b:"",n:0,layers:{TOP:{code:"",gsm:""},F1:{code:"",gsm:""},L1:{code:"",gsm:""}}};
{
  const m=mergeSpec(INIT,{a:9});
  ok('stored top-level value wins',        m.a===9);
  ok('missing top-level key filled',       m.b==="");
  ok('a stored 0 is NOT overwritten',      mergeSpec(INIT,{a:0}).a===0);
  ok('a stored "" is NOT overwritten',     mergeSpec(INIT,{n:""}).n==="");
  ok('a stored null is NOT overwritten',   mergeSpec(INIT,{a:null}).a===null);
  ok('layer map filled when absent',       Object.keys(m.layers).sort().join()==="F1,L1,TOP");
}
{
  // The case a shallow top-level merge gets WRONG: stored layers lack a key.
  const m=mergeSpec(INIT,{layers:{TOP:{code:"KL",gsm:120}}});
  ok('missing layer key restored',         !!m.layers.F1 && !!m.layers.L1);
  ok('restored layer has code AND gsm',    m.layers.F1.code==="" && m.layers.F1.gsm==="");
  ok('stored layer values preserved',      m.layers.TOP.code==="KL" && m.layers.TOP.gsm===120);
  // A shallow {...INIT, ...saved} would have left layers.F1 undefined here.
  ok('shallow merge WOULD have failed this', ({...INIT,...{layers:{TOP:{}}}}).layers.F1===undefined);
}
{
  // A layer present but half-populated — the shape a write to a missing layer
  // produces ({gsm} with no code). The merge must complete it.
  const m=mergeSpec(INIT,{layers:{TOP:{gsm:140}}});
  ok('half-populated layer completed',     m.layers.TOP.code==="" && m.layers.TOP.gsm===140);
}
{
  const m=mergeSpec(INIT,{layers:{X9:{code:"NEW",gsm:200}}});
  ok('an unknown stored layer is kept',    m.layers.X9.code==="NEW");
}
ok('non-object saved treated as empty',    mergeSpec(INIT,null).a===1 && mergeSpec(INIT,"x").b==="");
ok('merge does not mutate INIT_SPEC',      INIT.layers.TOP.code==="" && INIT.a===1);
{
  // Why BOTH sides are merged in the hook: merging one side only manufactures
  // dirt out of a field that was added to INIT_SPEC, not edited by anyone.
  const stored={a:1,layers:{TOP:{code:"KL",gsm:120}}};
  ok('merging both sides stays clean',
     !isDirty(mergeSpec(INIT,stored),mergeSpec(INIT,stored)));
  ok('merging one side only reports FALSE DIRT',
     isDirty(mergeSpec(INIT,stored),stored));
}

// ── FRESH ENVELOPE ───────────────────────────────────────────────────────
console.log("\n── freshEnvelope: baseline initialised from the seeded spec ──");
{
  const seeded={...INIT,plant:"Nagpur",delivery:"Pune"};
  const env=freshEnvelope(seeded);
  ok('is a valid envelope',                isValidEnvelope(env));
  ok('v is 1',                             env.v===1);
  ok('profileDraft is null in C3',         env.profileDraft===null);
  ok('baseline equals the seeded spec',    !isDirty(env.spec,env.baseline));
  ok('a fresh draft is therefore clean',   !isDirty(env.spec,env.baseline));
}

console.log(fails === 0 ? "\nall checks pass" : `\n${fails} FAILED`);
process.exit(fails === 0 ? 0 : 1);
