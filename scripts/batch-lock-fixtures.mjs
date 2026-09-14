import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ownerStaleLockReclaimRequest } from "../src/lib/batchLockModel.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const panel = fs.readFileSync(path.join(root, "src/tabs/batch/BatchWorkspacePanel.jsx"), "utf8");
let passes = 0;
const failures = [];

function check(condition, label) {
  if (condition) { passes += 1; console.log(`ok   - ${label}`); }
  else { failures.push(label); console.log(`FAIL - ${label}`); }
}

const batch = {
  id: 71, owner_user_id: 4, caller_id: 4, caller_holds_lock: false,
  edit_lock: { holder_user_id: 99, heartbeat_at: "2026-09-12T08:00:00Z" },
};
check(ownerStaleLockReclaimRequest(batch)?.expected_holder_id === 99,
  "U4-LOCK-FE-1 the Batch owner sends the exact observed lock holder");
check(ownerStaleLockReclaimRequest({ ...batch, caller_id: 5 }) === null,
  "U4-LOCK-FE-2 a non-owner is not shown the owner reclaim action");
check(ownerStaleLockReclaimRequest({ ...batch, caller_holds_lock: true }) === null,
  "U4-LOCK-FE-3 the current holder cannot reclaim their own lock");
check(ownerStaleLockReclaimRequest({ ...batch, edit_lock: null }) === null,
  "U4-LOCK-FE-4 no active lock means there is nothing to reclaim");
check(panel.includes("/lock/reclaim") && panel.includes("Reclaim stale lock")
  && panel.includes("only after the heartbeat expires")
  && !panel.includes("/lock/takeover"),
  "U4-LOCK-FE-5 the visible journey is stale reclaim only; unaudited active takeover stays unavailable");

console.log(`\n${passes} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
console.log("U4 stale-lock reclaim fixture gate PASS");
