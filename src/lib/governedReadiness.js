export const emptyGovernedReadiness = () => ({
  status: "idle",
  batchId: null,
  batchContentVersion: null,
  rows: [],
  blockers: [],
  canCalculate: false,
  canSend: false,
  evaluatedAt: null,
  message: "Governed readiness has not been checked yet.",
});

export function governedReadinessFromResponse(data) {
  if (!data || !Array.isArray(data.rows) || !Array.isArray(data.blockers)
      || data.mutation !== "none") {
    return {
      ...emptyGovernedReadiness(),
      status: "error",
      message: "The readiness response was incomplete. Calculate and Send remain unavailable.",
    };
  }
  return {
    status: "ready",
    batchId: data.batch_id ?? null,
    batchContentVersion: data.batch_content_version ?? null,
    rows: data.rows,
    blockers: data.blockers,
    canCalculate: data.can_calculate === true,
    canSend: data.can_send === true,
    evaluatedAt: data.evaluated_at || null,
    message: "Every active durable row was evaluated by the governed readiness route.",
  };
}

export function staleGovernedReadiness(current, message = "Governed inputs changed. Rechecking every active row…") {
  return {
    ...(current || emptyGovernedReadiness()),
    status: "stale",
    canCalculate: false,
    canSend: false,
    message,
  };
}

export function governedReadinessCounts(readiness) {
  const rows = readiness?.rows || [];
  return rows.reduce((counts, row) => {
    counts.total += 1;
    if (row.status === "ready") counts.inputReady += 1;
    if (row.freshness === "fresh" || row.freshness === "needs_send_only") counts.sendCurrent += 1;
    if (row.freshness === "calculation_stale") counts.stale += 1;
    if (row.freshness === "not_calculated") counts.notCalculated += 1;
    if (row.freshness === "unknown") counts.unknown += 1;
    return counts;
  }, { total: 0, inputReady: 0, sendCurrent: 0, stale: 0, notCalculated: 0, unknown: 0 });
}

export function governedBlockerTarget(blocker) {
  if (!blocker) return { kind: "workspace", targetId: "batch-workspace-preparation-title" };
  if (blocker.scope === "row" && blocker.row_id != null) {
    const opensEditor = ["sku", "dimensions", "construction", "pricing_group"].includes(blocker.field);
    return {
      kind: "row",
      rowId: blocker.row_id,
      opensEditor,
      field: blocker.field || null,
      targetId: `batch-workspace-row-${blocker.row_id}`,
    };
  }
  if (blocker.scope === "group" && blocker.pricing_group_id != null) {
    return {
      kind: "group",
      pricingGroupId: blocker.pricing_group_id,
      opensDelivery: blocker.field === "delivery_route",
      opensGroupEditor: ["freight", "freight_basis", "payment_terms", "interest"].includes(blocker.field),
      field: blocker.field || null,
      targetId: `batch-workspace-pricing-group-${blocker.pricing_group_id}`,
    };
  }
  if (blocker.field === "pricing_basis") {
    return { kind: "batch", field: blocker.field, targetId: "batch-pricing-basis-release" };
  }
  if (blocker.field === "lock") {
    return { kind: "batch", field: blocker.field, targetId: "batch-workspace-access-title" };
  }
  if (blocker.field === "rows") {
    return { kind: "batch", field: blocker.field, opensNewRow: true,
      targetId: "batch-workspace-rows-title" };
  }
  return { kind: "batch", field: blocker.field || null,
    targetId: blocker.field === "status" ? "batch-workspace-identity-title" : "batch-workspace-preparation-title" };
}
