import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const items = read("src/tabs/QuoteItemsTab.jsx");
const state = read("src/state/useQuoteItemsState.js");
const excel = read("src/export/excel.js");
const pdf = read("src/export/pdf.js");
const checks = [
  [!items.includes('aria-label="Quote Ref"') && !items.includes("setQuoteRef"), "local working UI has no hand-typed Quote reference"],
  [!state.includes("quoteRef") && !state.includes("setQuoteRef"), "old browser state has no Quote-reference authority seam"],
  [items.includes("QUICK CALCULATION — NOT A QUOTE") && excel.includes("QUICK CALCULATION — NOT A QUOTE")
    && pdf.includes("QUICK CALCULATION — NOT A QUOTE"), "every retained local output is conspicuously not a Quote"],
  [!items.includes("quoteRef,") && !excel.includes("quoteRef:meta.quoteRef"), "local export does not forward an official reference"],
];
let failures = 0;
for (const [ok, label] of checks) { console.log(`${ok ? "ok" : "FAIL"}   - ${label}`); if (!ok) failures += 1; }
if (failures) process.exit(1);
console.log("S4 Quick Calculation fixture PASS");
