import { activeDeliveryRoutes, deliveryRouteDisplay } from "./pricingGroupModel.js";

const sameId = (left, right) => left != null && right != null && String(left) === String(right);

const activeRows = batch => (batch?.batch_rows || []).filter(row => row.status === "active");

export function batchDeliverySections(batch, localRows = []) {
  if (!batch?.id) {
    return localRows.length ? [{
      key: "ungoverned-working-rows",
      status: "unassigned",
      label: "Delivery Group not assigned",
      detail: "Assign through a governed Batch",
      localRows,
      durableRows: [],
      unloadedDurableRows: [],
    }] : [];
  }

  const durableRows = activeRows(batch);
  const sections = [];
  const assignedLocalIds = new Set();

  (batch.pricing_groups || []).filter(group => group.status === "active").forEach(group => {
    const groupDurableRows = durableRows.filter(row => sameId(row.pricing_group_id, group.id));
    const groupDurableIds = new Set(groupDurableRows.map(row => String(row.id)));
    const groupLocalRows = localRows.filter(row => sameId(row.governedPricingGroupId, group.id)
      || (row.durableRowId != null && groupDurableIds.has(String(row.durableRowId))));
    groupLocalRows.forEach(row => assignedLocalIds.add(row.id));
    const loadedDurableIds = new Set(groupLocalRows
      .filter(row => row.durableRowId != null).map(row => String(row.durableRowId)));
    const unloadedDurableRows = groupDurableRows.filter(row => !loadedDurableIds.has(String(row.id)));
    const routes = activeDeliveryRoutes(group);
    const scopedRoutes = routes.length ? routes : [null];

    scopedRoutes.forEach(route => {
      const display = route ? deliveryRouteDisplay(route) : null;
      sections.push({
        key: route ? `delivery-${route.id}` : `pricing-${group.id}-no-route`,
        status: route ? "active" : "missing-route",
        label: display?.label || "No active Delivery Group",
        detail: display ? `Bill-to ${display.billTo} → Ship-to ${display.shipTo}`
          : "Bill-to / Ship-to route required",
        pricingGroup: group,
        route,
        isFreightBasis: !!route && sameId(group.freight_basis_delivery_group_id, route.id),
        localRows: groupLocalRows,
        durableRows: groupDurableRows,
        unloadedDurableRows,
      });
    });
  });

  const unassignedRows = localRows.filter(row => !assignedLocalIds.has(row.id));
  if (unassignedRows.length) sections.push({
    key: "unassigned-working-rows",
    status: "unassigned",
    label: "Delivery Group not assigned",
    detail: "Not linked to an active Pricing Group",
    localRows: unassignedRows,
    durableRows: [],
    unloadedDurableRows: [],
  });

  return sections;
}

export function batchDeliveryGridEntries(batch, localRows = []) {
  return batchDeliverySections(batch, localRows).flatMap(section => {
    const entries = [
      ...section.localRows.map(row => ({ row, durableRow: null })),
      ...section.unloadedDurableRows.map(durableRow => ({ row: null, durableRow })),
    ];
    if (!entries.length) entries.push({ row: null, durableRow: null });
    return entries.map((entry, index) => ({
      ...entry,
      section,
      startsSection: index === 0,
    }));
  });
}

export function deliverySectionItemCount(section) {
  return (section?.localRows?.length || 0) + (section?.unloadedDurableRows?.length || 0);
}
