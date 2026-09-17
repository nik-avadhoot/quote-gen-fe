import { readFileSync } from 'node:fs';

let passed = 0;
const failures = [];
const check = (condition, label) => {
  if (condition) { passed += 1; console.log(`ok   - ${label}`); }
  else { failures.push(label); console.log(`FAIL - ${label}`); }
};

const quoteItems = readFileSync(new URL('../src/tabs/QuoteItemsTab.jsx', import.meta.url), 'utf8');
const excel = readFileSync(new URL('../src/export/excel.js', import.meta.url), 'utf8');
const pdf = readFileSync(new URL('../src/export/pdf.js', import.meta.url), 'utf8');

check(quoteItems.includes('isFeatureEnabled("limited_beta")')
  && quoteItems.includes('beta:betaExport'),
  'BR-5-1 the production build flag reaches both export paths');
check(excel.includes("meta.beta?'BETA_':''")
  && excel.includes("meta.beta?'BETA | ':'")
  && excel.includes('beta:meta.beta===true'),
  'BR-5-2 the template export is visibly labelled and tells the backend');
check(excel.includes('beta?"BETA — QUOTATION":"QUOTATION"')
  && excel.includes('exportExcelFull(items,rates,freight,meta.beta===true)'),
  'BR-5-3 the no-template fallback carries the same BETA mark');
check(pdf.includes("meta.beta?'<span class=\"beta\">BETA</span>':''"),
  'BR-5-4 the printable PDF visibly carries the BETA mark');

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
console.log('Limited beta export marking gate PASS');
