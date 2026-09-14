// Focused contract for the transitional Costing <-> Batch printing metadata bridge.
// These fields are row-owned descriptive data. They must round-trip without
// entering Construction identity, calculation, or the confirm-before-mutate gate.
import { readFileSync } from 'node:fs';
import { calcCosting, buildSpecFromRow } from '../src/engine/costing.js';
import { materializeEffectiveRates } from '../src/engine/rateMaster.js';
import {
  DEFAULT_BOX_TRIM_DATA, DEFAULT_FREIGHT, DEFAULT_RATES, INIT_SPEC,
  PRINTING_TECHNOLOGIES,
} from '../src/data/defaults.js';
import {
  isDirty, nextReviewBaseline, PUSH_CONSTRUCTION_FIELDS,
} from '../src/state/costingDraftModel.js';

let failures=0;
const ok=(label,condition)=>{
  if(condition)console.log(`ok   - ${label}`);
  else{failures++;console.error(`FAIL - ${label}`);}
};

const construction={
  code:'A',boxType:'RSC',ply:3,flute_F1:'B',flute_F2:'',
  layers:{TOP:{code:'24',gsm:180},F1:{code:'20',gsm:120},L1:{code:'24',gsm:180}},
};
const profile={client:'ACME',sector:'PAINTS',plant:'Nagpur',delivery:'Pune'};

console.log('\n-- controlled values and Batch -> Costing Deep Dive --');
ok('approved vocabulary is exact',PRINTING_TECHNOLOGIES.join('|')==='Flexo|CMYK|Offset');
{
  const spec=buildSpecFromRow({
    itemType:'Box',printing_technology:'Offset',number_of_colours:0,
  },construction,profile);
  ok('printing technology returns from the Batch row',spec.printing_technology==='Offset');
  ok('explicit zero colours survives distinctly from blank',spec.number_of_colours===0);
  const blank=buildSpecFromRow({itemType:'Box'},construction,profile);
  ok('missing printing technology returns as blank',blank.printing_technology==='');
  ok('missing colour count returns as blank',blank.number_of_colours==='');
}

console.log('\n-- REVIEW baseline and Construction boundary --');
{
  const previous={printing_technology:'',number_of_colours:''};
  const edited={printing_technology:'CMYK',number_of_colours:4};
  const next=nextReviewBaseline(previous,edited,
    ['printing_technology','number_of_colours'],false);
  ok('explicit row Push advances both metadata fields',!isDirty(edited,next));
  ok('printing technology is not Construction-gated',!PUSH_CONSTRUCTION_FIELDS.includes('printing_technology'));
  ok('colour count is not Construction-gated',!PUSH_CONSTRUCTION_FIELDS.includes('number_of_colours'));
}

console.log('\n-- no calculation effect --');
{
  const rates=materializeEffectiveRates(DEFAULT_RATES);
  const base={...INIT_SPEC,L:400,W:300,H:250,ply:3,ups:1,
    layers:construction.layers,flute_F1:'B',flute_F2:'',
    plant:'Nagpur',delivery:'Pune',volume:10000};
  const a=calcCosting({...base,printing_technology:'Flexo',number_of_colours:1},
    rates,DEFAULT_FREIGHT,DEFAULT_BOX_TRIM_DATA);
  const b=calcCosting({...base,printing_technology:'Offset',number_of_colours:8},
    rates,DEFAULT_FREIGHT,DEFAULT_BOX_TRIM_DATA);
  ok('changing printing metadata leaves the complete result identical',
    a&&b&&JSON.stringify(a)===JSON.stringify(b));
}

console.log('\n-- cross-file bridge and grid placement --');
{
  const bridge=readFileSync(new URL('../src/state/useCostingBatchBridge.js',import.meta.url),'utf8');
  const newRows=readFileSync(new URL('../src/state/useQuoteActions.js',import.meta.url),'utf8');
  const grid=readFileSync(new URL('../src/tabs/batch/BatchGrid.jsx',import.meta.url),'utf8');
  const bridgeCopies=(bridge.match(/printing_technology:spec\.printing_technology\?\?""/g)||[]).length;
  ok('Costing Push and Send both copy printing metadata',bridgeCopies===2);
  ok('new Batch rows initialise both fields blank',
    newRows.includes('printing_technology:"",number_of_colours:""'));
  ok('grid column count includes both new columns',grid.includes('BASE_GRID_COLUMN_COUNT=37'));
  ok('columns are ordered after Ups and before Std GSM',
    /"L","W","H","Ups",\s*"Colours","Print Tech","Std GSM"/.test(grid));
  ok('inline metadata edits do not invalidate calculation',
    grid.includes('upd("number_of_colours"')&&grid.includes('upd("printing_technology"'));
}

if(failures){
  console.error(`\n${failures} printing specification fixture(s) failed`);
  process.exit(1);
}
console.log('\nprinting specification fixture gate PASS');
