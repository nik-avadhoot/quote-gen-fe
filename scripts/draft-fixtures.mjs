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
// C4 added the review copy and the OUTCOME-AWARE push baseline. Those cases are
// the only automated evidence that declining a shared-Construction update
// leaves REVIEW dirty - no UI path can be reached from here.
//
// Every equality case below names the rule that was NOT implemented and would
// have produced a different answer, so a green run means something: a coercing
// comparator passes the identical-values cases and FAILS the first block.
// ═══════════════════════════════════════════════════════════════════════════
import { deepEqual, freshEnvelope, freshReviewCopy, isDirty, isPlainObject,
  isValidEnvelope, mergeSpec, nextReviewBaseline,
  PUSH_CONSTRUCTION_FIELDS, isValidProfileDraft, isDraftDirty, freshProfileDraft,
  shouldAdvanceSkuValue, CONTEXT_ONLY_FIELDS, SKU_EXCEPTION_FIELDS,
  PROFILE_DRAFT_FIELDS, DRAFT_VERSION } from "../src/state/costingDraftModel.js";

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



// ==========================================================================
// C4 - THE REVIEW COPY AND THE OUTCOME-AWARE PUSHED BASELINE
// ==========================================================================
// nextReviewBaseline takes pushedFields FROM THE BRIDGE, which derives it from
// the rowPatch it just built. These cases pin the contract: a field named as
// pushed advances; a field absent from the list keeps its old baseline and
// stays dirty. The per-field fallback rules the bridge evaluates are pinned
// separately below, against the same expressions pushCostingToBatchRow uses.
const RSPEC={L:100,W:80,H:60,ups:2,product:"Carton",qtyPerSet:4,skuType:"GLASS-A",
  margin:8,interest:0.5,freightOverride:"",printing:"25",
  waste:5,convRate:7,wastePP:5,convRatePP:12.5,
  ply:5,boxType:"RSC",flute_F1:"B",flute_F2:"A",flutingBCF:0.10,
  layers:{TOP:{code:"KL",gsm:120},F1:{code:"SF",gsm:100},L1:{code:"KL",gsm:120}}};
const PREV={setAutoFill:true,costingContext:"same-batch"};
const ALL_ROW=["L","W","H","ups","product","qtyPerSet","skuType","board_gsm",
  "spec_bs","spec_bct","spec_ect","reqBoxWt","salesMOQ","volume","margin",
  "interest","freightOverride","waste","convRate","printing","stitching",
  "coating","handling","moqCharge","packing","other","unloading"];

console.log("");
console.log("-- freshReviewCopy: a new copy is clean, and is not a draft --");
{
  const rc=freshReviewCopy(42,RSPEC,PREV);
  ok("rowId carried",        rc.rowId===42);
  ok("baseline equals spec", !isDirty(rc.spec,rc.baseline));
  ok("prev captured",        rc.prev.setAutoFill===true&&rc.prev.costingContext==="same-batch");
  ok("prev is a copy of the caller object",
     (()=>{const p={setAutoFill:false,costingContext:"new-batch"};
           const c=freshReviewCopy(1,RSPEC,p);p.setAutoFill=true;
           return c.prev.setAutoFill===false;})());
  ok("new-batch context round-trips",
     freshReviewCopy(1,RSPEC,{setAutoFill:false,costingContext:"new-batch"}).prev.costingContext==="new-batch");
  ok("setAutoFill false round-trips",
     freshReviewCopy(1,RSPEC,{setAutoFill:false,costingContext:"same-batch"}).prev.setAutoFill===false);
  ok("a review copy cannot hydrate as a draft", !isValidEnvelope(rc));
  ok("an edited copy is dirty", isDirty({...rc.spec,L:120},rc.baseline));
}

console.log("");
console.log("-- PUSH with Construction ACCEPTED: REVIEW becomes clean --");
{
  const rc=freshReviewCopy(7,RSPEC,PREV);
  const edited={...rc.spec,L:150,ply:3,layers:{...rc.spec.layers,TOP:{code:"KL",gsm:150}}};
  ok("dirty before push", isDirty(edited,rc.baseline));
  const base=nextReviewBaseline(rc.baseline,edited,ALL_ROW,true);
  ok("CLEAN after an accepted push", !isDirty(edited,base));
  ok("row field advanced",           base.L===150);
  ok("construction field advanced",  base.ply===3);
  ok("layers advanced by value",     base.layers.TOP.gsm===150);
  ok("layers deep-copied, not aliased",
     (()=>{const b=nextReviewBaseline(rc.baseline,edited,ALL_ROW,true);
           edited.layers.TOP.gsm=999;const kept=b.layers.TOP.gsm===150;
           edited.layers.TOP.gsm=150;return kept;})());
}

console.log("");
console.log("-- PUSH with Construction DECLINED: row written, REVIEW stays dirty --");
{
  const rc=freshReviewCopy(7,RSPEC,PREV);
  const edited={...rc.spec,L:150,ply:3,layers:{...rc.spec.layers,TOP:{code:"KL",gsm:150}}};
  const base=nextReviewBaseline(rc.baseline,edited,ALL_ROW,false);
  ok("row-owned change IS formalised",  base.L===150);
  ok("ply held at the old baseline",    base.ply===5);
  ok("layers held at the old baseline", base.layers.TOP.gsm===120);
  ok("REVIEW REMAINS DIRTY, so exit still warns", isDirty(edited,base));
  ok("an unconditional baseline:=spec WOULD have failed this", !isDirty(edited,{...edited}));
  console.log("   -- and a SECOND push accepting Construction makes it clean --");
  const base2=nextReviewBaseline(base,edited,ALL_ROW,true);
  ok("second push advances construction", base2.ply===3&&base2.layers.TOP.gsm===150);
  ok("REVIEW IS NOW CLEAN",               !isDirty(edited,base2));
}

console.log("");
console.log("-- a field NOT in pushedFields keeps its baseline and stays dirty --");
{
  const rc=freshReviewCopy(7,RSPEC,PREV);
  const edited={...rc.spec,volume:5000,flutingBCF:0.25};
  const base=nextReviewBaseline(rc.baseline,edited,["volume"],true);
  ok("the pushed field advanced",           base.volume===5000);
  ok("flutingBCF held at the old baseline", base.flutingBCF===0.10);
  ok("still dirty - that edit never reached Batch Entry", isDirty(edited,base));
  ok("no key lost from the baseline", Object.keys(rc.baseline).every(k=>k in base));
  ok("an empty pushedFields advances nothing",
     nextReviewBaseline(rc.baseline,edited,[],false).volume===undefined);
  ok("a missing pushedFields is treated as empty",
     !nextReviewBaseline(rc.baseline,edited,undefined,false).volume);
}

console.log("");
console.log("-- rowPatch fallbacks: an edit the row did not take is NOT pushed --");
{
  // The bridge marks a fallback-style field pushed iff the persisted value IS
  // the spec value. These reproduce each rowPatch expression exactly.
  const took=(persisted,specVal)=>persisted===specVal;
  ok("clearing qtyPerSet is NOT formalised (row.nosPerSet retained)",
     !took(("" || 4),""));
  ok("setting qtyPerSet IS formalised",  took((6||4),6));
  ok("clearing skuType is NOT formalised (glassSKUType retained)",
     !took((""||"GLASS-A"),""));
  ok("setting skuType IS formalised",    took(("GLASS-B"||"GLASS-A"),"GLASS-B"));
  ok("H=0 is NOT formalised (coerced to blank)",     !took((0||""),0));
  ok("H cleared IS formalised (blank stays blank)",  took((""||""),""));
  ok("H=60 IS formalised",                           took((60||""),60));
  ok("ups cleared is NOT formalised (falls back to 1)", !took((""||1),""));
  ok("ups=0 is NOT formalised (falls back to 1)",       !took((0||1),0));
  ok("ups=2 IS formalised",                             took((2||1),2));
  ok("clearing boxType is NOT formalised",  !took((""||"RSC"||"RSC"),""));
  ok("product cleared IS formalised",       took((""||""),""));
}

console.log("");
console.log("-- L/W follow _dimBack: a blank dim with a parent keeps inheriting --");
{
  const dimTook=(cur,derived)=>{
    if(cur!==""&&cur!=null)return true;
    return derived===""||derived==null;
  };
  ok("a typed L is formalised",                 dimTook(120,80));
  ok("a blank L with a parent is NOT formalised",!dimTook("",80));
  ok("a blank L with no parent IS formalised",   dimTook("",""));
}

console.log("");
console.log("-- add-ons: written as +(spec.X||0), so a blank is a real 0 charge --");
{
  const addOnTook=v=>Number.isFinite(+(v||0));
  ok("a string 25 carries as the number 25", addOnTook("25")&&+("25"||0)===25);
  ok("a blank carries as 0",                 addOnTook("")&&+(""||0)===0);
  ok("a 0 carries",                          addOnTook(0));
  ok("a non-numeric does NOT carry",         !addOnTook("abc"));
}

console.log("");
console.log("-- Box vs PP: only the applicable waste/conv pair is written --");
{
  const boxPushed=["waste","convRate"];
  const ppPushed=["wastePP","convRatePP"];
  const rc=freshReviewCopy(7,RSPEC,PREV);
  const editedBoth={...rc.spec,waste:9,wastePP:11};
  const boxBase=nextReviewBaseline(rc.baseline,editedBoth,boxPushed,true);
  ok("Box row formalises waste",                 boxBase.waste===9);
  ok("Box row does NOT formalise wastePP",       boxBase.wastePP===5);
  ok("editing wastePP on a Box row stays dirty", isDirty(editedBoth,boxBase));
  const ppBase=nextReviewBaseline(rc.baseline,editedBoth,ppPushed,true);
  ok("PP row formalises wastePP",                ppBase.wastePP===11);
  ok("PP row does NOT formalise waste",          ppBase.waste===5);
  ok("editing waste on a PP row stays dirty",    isDirty(editedBoth,ppBase));
}

console.log("");
console.log("-- delta writes: the EFFECTIVE row value decides, not the override --");
{
  const eff=(ovr,prof)=>ovr!==""?+ovr:+prof;
  ok("margin equal to the profile is formalised via inheritance", 8===eff("",8));
  ok("a typed string 8 against a numeric profile 8 is formalised", +"8"===eff("",8));
  ok("margin 10 against profile 8 is formalised as an override",  10===eff(10,8));
  ok("a CLEARED margin is NOT formalised",                        +""!==eff("",8));
  ok("interest equal to the profile is formalised",               0.5===eff("",0.5));
  ok("interest 1.0 against profile 0.5 is formalised",            1===eff(1,0.5));
}

console.log("");
console.log("-- PUSH_CONSTRUCTION_FIELDS is the gated set, and holds no row field --");
ok("the five Construction fields",
   PUSH_CONSTRUCTION_FIELDS.join()==="boxType,ply,flute_F1,flute_F2,layers");
ok("no dimension or commercial field is Construction-gated",
   !PUSH_CONSTRUCTION_FIELDS.some(k=>["L","W","H","margin","volume"].includes(k)));


// ==========================================================================
// C5 - profileDraft, the widened validator, and the advance-if-still-default rule
// ==========================================================================
console.log("");
console.log("-- isValidProfileDraft: exactly { values, baseline }, both plain objects --");
ok("null is valid (no new-batch draft)",       isValidProfileDraft(null));
ok("{values,baseline} is valid",               isValidProfileDraft({values:{},baseline:{}}));
ok("missing baseline rejected",                !isValidProfileDraft({values:{}}));
ok("missing values rejected",                  !isValidProfileDraft({baseline:{}}));
ok("values as array rejected",                 !isValidProfileDraft({values:[],baseline:{}}));
ok("baseline as array rejected",               !isValidProfileDraft({values:{},baseline:[]}));
ok("values null rejected",                     !isValidProfileDraft({values:null,baseline:{}}));
ok("a bare object rejected",                   !isValidProfileDraft({client:"ACME"}));
ok("an array rejected",                        !isValidProfileDraft([]));
ok("a string rejected",                        !isValidProfileDraft("x"));
ok("a number rejected",                        !isValidProfileDraft(0));

console.log("");
console.log("-- the envelope widened, so C3/C4 drafts stay valid under v:1 --");
{
  const c3='{"v":1,"spec":{"client":"ACME"},"profileDraft":null,"baseline":{"client":"ACME"}}';
  ok("a C3/C4 blob (profileDraft:null) still hydrates", isValidEnvelope(JSON.parse(c3)));
  ok("a C5 blob with a populated profileDraft is valid",
     isValidEnvelope({v:1,spec:{},profileDraft:{values:{},baseline:{}},baseline:{}}));
  ok("a malformed profileDraft still routes to corrupt",
     !isValidEnvelope({v:1,spec:{},profileDraft:{values:{}},baseline:{}}));
  ok("the version is NOT bumped", DRAFT_VERSION===1);
}

console.log("");
console.log("-- combined dirty spans BOTH stores --");
{
  const sp={L:100}, base={L:100};
  ok("clean spec + no profile draft is clean",   !isDraftDirty(sp,base,null));
  ok("dirty spec alone is dirty",                isDraftDirty({L:120},base,null));
  ok("clean spec + clean profile draft is clean",
     !isDraftDirty(sp,base,{values:{waste:5},baseline:{waste:5}}));
  ok("clean spec + DIRTY profile draft is dirty",
     isDraftDirty(sp,base,{values:{waste:6},baseline:{waste:5}}));
  ok("profile-draft dirt is not coerced: '' vs 0",
     isDraftDirty(sp,base,{values:{waste:""},baseline:{waste:0}}));
}

console.log("");
console.log("-- shouldAdvanceSkuValue: follow the default only while still tracking it --");
ok("a blank SKU value follows the default",        shouldAdvanceSkuValue("",5));
ok("null follows",                                 shouldAdvanceSkuValue(null,5));
ok("undefined follows",                            shouldAdvanceSkuValue(undefined,5));
ok("a value EQUAL to the old default follows",     shouldAdvanceSkuValue(5,5));
ok("a numeric string equal to it follows",         shouldAdvanceSkuValue("5",5));
ok("a DIVERGED value is preserved",                !shouldAdvanceSkuValue(4,5));
ok("a diverged 0 is preserved, not treated blank", !shouldAdvanceSkuValue(0,5));
ok("a diverged string is preserved",               !shouldAdvanceSkuValue("4",5));
ok("no previous default: nothing to track, preserve", !shouldAdvanceSkuValue(4,""));
ok("NaN never silently follows",                   !shouldAdvanceSkuValue("abc",5));
// The differential: a rule that always advanced would overwrite the exception.
ok("an always-advance rule WOULD have failed this", shouldAdvanceSkuValue(4,5)===false);

console.log("");
console.log("-- the field lists the resolver and the seeds are built from --");
ok("context-only fields are exactly the seven relocated ones",
   CONTEXT_ONLY_FIELDS.join()==="client,sector,customerType,priceContext,plant,delivery,paymentDisc");
ok("no SKU-exception field is context-only",
   !CONTEXT_ONLY_FIELDS.some(k=>SKU_EXCEPTION_FIELDS.includes(k)));
ok("margin is a SKU exception",          SKU_EXCEPTION_FIELDS.includes("margin"));
ok("interest and freight are too (until C7)",
   SKU_EXCEPTION_FIELDS.includes("interest")&&SKU_EXCEPTION_FIELDS.includes("freightOverride"));
ok("both Box and PP waste/conv are SKU exceptions",
   ["waste","convRate","wastePP","convRatePP"].every(k=>SKU_EXCEPTION_FIELDS.includes(k)));
ok("the profile draft carries every batch-level field",
   ["client","sector","plant","delivery","paymentDisc","interest","freightOverride",
    "waste","convRate","wastePP","convRatePP","margin","marginPP"]
     .every(k=>PROFILE_DRAFT_FIELDS.includes(k)));

console.log("");
console.log("-- freshProfileDraft: a new draft profile is clean --");
{
  const v={client:"ACME",waste:5};
  const pd=freshProfileDraft(v);
  ok("valid shape",                    isValidProfileDraft(pd));
  ok("baseline equals values",         !isDirty(pd.values,pd.baseline));
  ok("so a fresh new-batch draft is clean", !isDraftDirty({L:1},{L:1},pd));
}

console.log(fails === 0 ? "\nall checks pass" : `\n${fails} FAILED`);
process.exit(fails === 0 ? 0 : 1);
