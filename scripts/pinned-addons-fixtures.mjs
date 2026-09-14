import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  canPinAddOn,
  MAX_PINNED_ADD_ONS,
  togglePinnedAddOn,
} from "../src/lib/pinnedAddOns.js";

let passed = 0;
const check = (condition, message) => {
  assert.ok(condition, message);
  passed += 1;
};

check(MAX_PINNED_ADD_ONS === 2, "the main grid keeps its settled two-column pin limit");

const empty = [];
const first = togglePinnedAddOn(empty, "printing");
check(first.join(",") === "printing" && empty.length === 0,
  "pinning adds a column without mutating the prior state");

const full = togglePinnedAddOn(first, "packing");
check(full.join(",") === "printing,packing", "a second add-on can be pinned");
check(canPinAddOn(full, "printing") === true,
  "an existing pin remains actionable at the limit so it can be removed");
check(canPinAddOn(full, "coating") === false,
  "a third add-on is unavailable while two are pinned");

const refused = togglePinnedAddOn(full, "coating");
check(refused === full && refused.join(",") === "printing,packing",
  "a third pin is refused without silently evicting either visible column");

const afterUnpin = togglePinnedAddOn(full, "printing");
check(afterUnpin.join(",") === "packing", "a pinned add-on can be removed at the limit");
check(togglePinnedAddOn(afterUnpin, "coating").join(",") === "packing,coating",
  "a different add-on can be pinned after the user makes room");

const batchGridSource = readFileSync(new URL("../src/tabs/batch/BatchGrid.jsx", import.meta.url), "utf8");
check(batchGridSource.includes("disabled={!canPin}")
  && batchGridSource.includes("aria-pressed={isPinned}"),
"the grid exposes the limit as a real disabled control and the pin state to assistive technology");
check(batchGridSource.includes('isPinned?"📌✓":"📌"'),
  "the visible pin state differs without relying on colour alone");

console.log(`Pinned add-on fixtures PASS (${passed}/${passed})`);
