const SENDABLE_FRESHNESS = new Set(["fresh", "needs_send_only"]);

export function governedBatchActionState(batch, structuralBlockers = [], effectiveByRow = {}) {
  const rows = (batch?.batch_rows || []).filter(row => row.status === "active");
  const calculation = rows.map(row => effectiveByRow[row.id]?.freshness || "unverified");
  const freshCount = calculation.filter(value => value === "fresh").length;
  const sendOnlyCount = calculation.filter(value => value === "needs_send_only").length;
  const staleCount = calculation.filter(value => value === "calculation_stale").length;
  const notCalculatedCount = calculation.filter(value => value === "not_calculated").length;
  const unverifiedCount = calculation.filter(value => value === "unverified").length;
  const working = batch?.status === "working";
  const holdsLock = batch?.caller_holds_lock === true;

  const calculateBlockers = [...structuralBlockers];
  if (!working) calculateBlockers.push("Batch is not in working state");
  if (!holdsLock) calculateBlockers.push("Active Batch edit lock is required");

  const sendBlockers = [...calculateBlockers];
  if (rows.some((_row, index) => !SENDABLE_FRESHNESS.has(calculation[index]))) {
    sendBlockers.push("Every active row needs a current governed calculation check");
  }

  return {
    rowCount: rows.length,
    freshCount,
    sendOnlyCount,
    staleCount,
    notCalculatedCount,
    unverifiedCount,
    calculateBlockers: [...new Set(calculateBlockers)],
    sendBlockers: [...new Set(sendBlockers)],
    canCalculate: rows.length > 0 && calculateBlockers.length === 0,
    canSend: rows.length > 0 && sendBlockers.length === 0,
  };
}

