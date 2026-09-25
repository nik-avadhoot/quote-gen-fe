import fs from "node:fs";
import {
  activeDeliveryRoutes,
  applyFixturePricingGroupUpdate,
  deliveryRouteDisplay,
  deliveryGroupStatusBody,
  pricingGroupCreateBody,
  pricingGroupCreateValidation,
  pricingGroupDraft,
  pricingGroupDraftValidation,
  pricingGroupStatusBody,
  pricingGroupUpdateBody,
} from "../src/lib/pricingGroupModel.js";
import { durableBatchPreparation } from "../src/lib/batchRowModel.js";
import { batchDeliveryGridEntries, batchDeliverySections,
  deliverySectionItemCount } from "../src/lib/batchDeliverySections.js";

let passes = 0;
const failures = [];
const check = (condition, label) => {
  if (condition) { passes += 1; console.log(`ok   - ${label}`); }
  else { failures.push(label); console.log(`FAIL - ${label}`); }
};

const group = {
  id: 81,
  content_version: 3,
  label: "Standard",
  freight_mode: "master",
  freight_manual_value: null,
  freight_basis_delivery_group_id: 91,
  legacy_freight_value: 2.75,
  legacy_freight_source: "legacy_batch",
  payment_terms_days: 30,
  payment_terms_text: null,
  interest_override_pct: null,
  interest_override_reason: null,
};

const restatement = pricingGroupDraft(group);
check(restatement.freightManualValue === "2.75" && restatement.interestOverridePct === "",
  "U4-PG-FE-1 temporary Batch freight is offered for explicit restatement while blank Interest stays blank");

const missingManual = { ...restatement, freightMode: "manual", freightManualValue: "" };
check(!pricingGroupDraftValidation(missingManual).valid,
  "U4-PG-FE-2 manual freight requires a deliberate value");

const zeroDecision = {
  ...restatement,
  label: "Renewal",
  freightMode: "manual",
  freightManualValue: "0",
  paymentTermsDays: "60",
  paymentTermsText: "60 days from invoice",
  interestOverridePct: "0",
  interestOverrideReason: "Interest waived for this renewal",
};
check(pricingGroupDraftValidation(zeroDecision).valid,
  "U4-PG-FE-3 deliberate zero freight and Interest are valid when the override carries a reason");
const body = pricingGroupUpdateBody(group, zeroDecision);
check(body.expected_content_version === 3 && body.freight_manual_value === 0
  && body.interest_override_pct === 0 && body.payment_terms_days === 60,
  "U4-PG-FE-4 the commercial-terms request preserves zero and carries the Pricing Group CAS token");

const inherited = pricingGroupUpdateBody(group, {
  ...zeroDecision,
  freightMode: "master",
  interestOverridePct: "",
  interestOverrideReason: "must not survive",
});
check(inherited.freight_manual_value === null && inherited.interest_override_pct === null
  && inherited.interest_override_reason === null,
  "U4-PG-FE-5 inactive manual freight and cleared Interest residue are sent as blanks, not zero");

const updated = applyFixturePricingGroupUpdate(group, body);
check(updated.content_version === 4 && updated.legacy_freight_source === null
  && updated.legacy_freight_value === null,
  "U4-PG-FE-6 the isolated fixture mirrors atomic retirement of legacy Batch freight");
const exFactory = applyFixturePricingGroupUpdate(group, {
  ...inherited, freight_mode: "ex_factory",
});
check(exFactory.freight_basis_delivery_group_id === null,
  "U4-PG-FE-7 ex-factory cannot retain a freight-basis route");

check(pricingGroupCreateValidation("Export").valid
  && !pricingGroupCreateValidation("x".repeat(121)).valid
  && pricingGroupCreateBody("  Export  ").label === "Export",
  "U4-PG-FE-8 Pricing Group creation keeps an optional governed label inside its storage limit");
check(pricingGroupStatusBody(group, "removed").expected_content_version === 3
  && pricingGroupStatusBody(group, "removed").status === "removed"
  && deliveryGroupStatusBody(group, "active").pricing_group_id === 81,
  "U4-PG-FE-9 lifecycle requests carry the Pricing Group CAS token only where the settled boundary owns one");

const preparationBase = {
  pricing_basis_release_id: 11,
  current_profile: { id: 41 },
  batch_rows: [{ id: 351, status: "active", pricing_group_id: 81, sku_id: 301,
    sku_version_id: 311, effective_construction: { version_id: 321 } }],
  pricing_groups: [{ ...group, status: "active", freight_basis_delivery_group_id: 91,
    delivery_groups: [{ id: 91, status: "active", bill_to_location_id: 101,
      ship_to_location_id: 102 }] }],
};
const deliveryDisplay = deliveryRouteDisplay({ id: 91, label: "Nagpur delivery",
  bill_to_location_id: 101, ship_to_location_id: 102,
  bill_to_location: { id: 101, location_code: "BILL-NAG" },
  ship_to_location: { id: 102, location_code: "SHIP-NAG" } });
check(deliveryDisplay.path === "BILL-NAG → SHIP-NAG"
  && deliveryDisplay.label === "Nagpur delivery",
  "U4-PG-FE-9a Delivery Group presentation differentiates the governed bill-to and ship-to route");
check(activeDeliveryRoutes({ delivery_groups: [
  { id: 91, status: "active" }, { id: 92, status: "removed" },
] }).map(route => route.id).join("|") === "91",
"U4-PG-FE-9b only active Delivery Groups participate in row applicability");
const twoRouteBatch = { ...preparationBase, id: 71,
  pricing_groups: preparationBase.pricing_groups.map(item => ({ ...item,
    delivery_groups: [...item.delivery_groups, { id: 92, label: "Pune delivery", status: "active",
      bill_to_location_id: 103, ship_to_location_id: 104 }] })) };
const deliverySections = batchDeliverySections(twoRouteBatch,
  [{ id: "local-351", durableRowId: 351, governedPricingGroupId: 81 }]);
const deliveryEntries = batchDeliveryGridEntries(twoRouteBatch,
  [{ id: "local-351", durableRowId: 351, governedPricingGroupId: 81 }]);
check(deliverySections.length === 2
  && deliverySections.map(section => section.label).join("|") === "Delivery Group #91|Pune delivery"
  && deliveryEntries.length === 2 && deliveryEntries.every(entry => entry.row.id === "local-351"),
  "U4-PG-FE-9c one governed item is sectioned under every active Delivery Group in its Pricing Group");
check(batchDeliveryGridEntries(twoRouteBatch, []).length === 2
  && batchDeliveryGridEntries(twoRouteBatch, []).every(entry => entry.durableRow?.id === 351),
  "U4-PG-FE-9d durable items remain visible in every relevant route section before local-grid loading");
const mixedRowsSection = batchDeliverySections(twoRouteBatch, [
  { id: "local-351", durableRowId: 351, governedPricingGroupId: 81 },
  { id: "local-new", governedPricingGroupId: 81 },
])[0];
check(deliverySectionItemCount(mixedRowsSection) === 2,
  "U4-PG-FE-9e the Delivery Group count includes loaded durable rows and additional local rows exactly once");
check(durableBatchPreparation({ ...preparationBase,
  pricing_groups: preparationBase.pricing_groups.map(item => ({ ...item, status: "removed" })),
}, [], {}, {}).structuralBlockers
  .includes("An active durable row references a removed or unavailable Pricing Group"),
"U4-PG-FE-10 an active row assigned to a removed Pricing Group is an explicit readiness blocker");
check(durableBatchPreparation({ ...preparationBase,
  pricing_groups: preparationBase.pricing_groups.map(item => ({ ...item,
    delivery_groups: item.delivery_groups.map(route => ({ ...route, status: "removed" })) })),
}, [], {}, {}).structuralBlockers
  .includes("A master-freight Pricing Group has no complete freight-basis route"),
"U4-PG-FE-11 removing the selected freight route blocks and never silently selects another route");
check(durableBatchPreparation({ ...preparationBase,
  pricing_groups: [...preparationBase.pricing_groups, { ...preparationBase.pricing_groups[0],
    id: 82, freight_basis_delivery_group_id: 92,
    delivery_groups: [{ ...preparationBase.pricing_groups[0].delivery_groups[0], id: 92 }] }],
}, [], {}, {}).structuralBlockers
  .includes("An active Pricing Group has no active durable rows"),
"U4-PG-FE-11a an empty Pricing Group remains valid drafting structure but blocks candidate readiness");

const panel = fs.readFileSync(new URL("../src/tabs/batch/BatchWorkspacePanel.jsx", import.meta.url), "utf8");
const pricingCard = fs.readFileSync(new URL("../src/tabs/batch/BatchPricingCard.jsx", import.meta.url), "utf8");
const pricingWorkspace = fs.readFileSync(new URL("../src/tabs/batch/BatchPricingBasisWorkspace.jsx", import.meta.url), "utf8");
const entryTab = fs.readFileSync(new URL("../src/tabs/batch/BatchEntryTab.jsx", import.meta.url), "utf8");
const grid = fs.readFileSync(new URL("../src/tabs/batch/BatchGrid.jsx", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../src/index.css", import.meta.url), "utf8");
const profileBar = fs.readFileSync(new URL("../src/tabs/batch/BatchProfileBar.jsx", import.meta.url), "utf8");
const server = fs.readFileSync(new URL("../../quote-gen-be/server.py", import.meta.url), "utf8");
check(panel.includes("Edit commercial terms") && panel.includes("Structured Payment Terms")
  && panel.includes("Payment Terms wording · descriptive only")
  && panel.includes("Blank inherits · zero is deliberate"),
  "U4-PG-FE-12 the workspace exposes the governed terms and their blank/zero/descriptive meanings");
check(panel.includes("/pricing-groups/${group.id}")
  && panel.includes("pricingGroupUpdateBody(group, draft)")
  && !panel.includes(".table("),
  "U4-PG-FE-13 the editor writes only through the authenticated backend route");
check(server.includes('def update_pricing_group(batch_id, pricing_group_id):')
  && server.includes('.eq("content_version", expected)')
  && server.includes('interest_override_derived_pct'),
  "U4-PG-FE-14 backend persistence retains CAS and derived-Interest evidence");
check(panel.includes("+ Add Pricing Group for a different price")
  && panel.includes("Remove Pricing Group") && panel.includes("Restore Pricing Group")
  && panel.includes("Remove route") && panel.includes("Restore route")
  && panel.includes("Reassign it or restore the group before Send"),
  "U4-PG-FE-15 the workspace exposes reversible group lifecycle and visible row-assignment repair");
check(panel.includes("/pricing-groups/${group.id}/status")
  && panel.includes("/delivery-groups/${route.id}/status")
  && server.includes("def create_pricing_group(batch_id):")
  && server.includes("def update_pricing_group_status(batch_id, pricing_group_id):")
  && server.includes("def update_delivery_group_status(batch_id, delivery_group_id):"),
  "U4-PG-FE-16 lifecycle mutations stay behind authenticated backend routes");
check(grid.includes("batch-grid-delivery-line") && grid.includes("section.detail")
  && grid.includes("Freight basis") && grid.includes("batch-grid-delivery-pricing")
  && grid.includes("batch-grid-delivery-count"),
  "U4-PG-FE-17 each compact grid separator names the route, Pricing Group, item count and freight-basis role");
check(grid.includes("DeliverySectionHeader")
  && grid.includes("section.detail")
  && grid.includes("Durable row #${durableRow.id} is relevant to this route")
  && grid.includes("batchDeliveryGridEntries(durableBatch,batchRows)"),
  "U4-PG-FE-18 the main Batch grid renders Delivery Group headers followed by every relevant item row");
// The invariant is "one shared span", not a historical column count: every
// full-width row derives from the single base constant plus pinned add-ons,
// and no full-width row carries its own literal span that could drift.
check(grid.includes("const BASE_GRID_COLUMN_COUNT=37;")
  && (grid.match(/BASE_GRID_COLUMN_COUNT\+pinnedAddOns\.length/g) || []).length === 3
  && !/colSpan=\{\d/.test(grid)
  && !/\b3[15]\+pinnedAddOns\.length/.test(grid),
  "U4-PG-FE-18a Delivery headers, durable placeholders and expanded item details span the complete 37-column grid plus pinned add-ons");
check(grid.includes("durableRowToLocalPreview(durableRow")
  && grid.includes("onClick={()=>copyDurableToGrid(durableRow)}")
  && grid.includes("Load into grid")
  && grid.includes("No calculation was persisted."),
  "U4-PG-FE-18b a durable placeholder can create the existing local preview directly from the grid");
// The Pricing summary is a flexible card in the profile band (UX Batch 4 and
// the 3-row profile bars), not the superseded fixed 340px card. Parsed from the
// rule body so the check is line-ending independent and tests bounds, not pixels.
const pricingCardRule = css.match(/\.batch-profile-pricing-card\s*\{([^}]*)\}/)?.[1] || "";
check(pricingCard.includes("BatchPricingBasisWorkspace compact")
  && entryTab.includes("const pricingCard=<BatchPricingCard")
  && entryTab.includes("<BatchProfileBar pricingCard={pricingCard}/>")
  && profileBar.includes('className="batch-profile-pricing-card"')
  // S3: still the Profile bar's own disclosure state, opened also while a
  // Costing return targets this Batch's workspace (see governed-row-return S3-GR-31).
  && profileBar.includes("cloneElement(pricingCard,{expanded:pricingExpanded")
  && profileBar.includes("const pricingExpanded=openCards.pricing||workspaceRequested;")
  && /width:\s*auto;/.test(pricingCardRule)
  && /min-width:\s*\d+px;/.test(pricingCardRule)
  && /max-width:\s*\d+px;/.test(pricingCardRule)
  && /flex:\s*1 1 \d+px;/.test(pricingCardRule)
  && !/340px/.test(css)
  && !css.includes(".batch-workspace-pricing-slot")
  && !css.includes("right: 29.5%"),
  "U4-PG-FE-19 the flexible Pricing summary card is a bounded, disclosure-controlled card in the profile band, never a fixed-width overlay taking grid height");
check(grid.includes("+ Delivery Group") && grid.includes("Manage Delivery Groups")
  && grid.includes("setBatchWorkspaceRequest")
  && pricingWorkspace.includes("initialDeliveryAction={batchWorkspaceRequest}")
  && panel.includes("[\"create\", \"edit\"].includes(initialDeliveryAction.mode)")
  && panel.includes("initialDeliveryAction.mode === \"edit\"")
  && panel.includes("useState(requestedDeliveryEditor)"),
  "U4-PG-FE-20 compact grid actions open the existing governed add or edit Delivery Group workflow");
check(grid.includes('onWorkspace("row-create", section)')
  && grid.includes('openWorkspaceAction("row-edit"')
  && grid.includes('openWorkspaceAction("row-status"')
  && grid.includes('openWorkspaceAction("set-manage"')
  && grid.includes("Edit governed row") && grid.includes("SET membership"),
  "U4-PG-FE-20a Delivery Group and expanded-row actions open governed row and SET workflows in context");
check(panel.includes('initialDeliveryAction?.mode === "row-create"')
  && panel.includes('initialDeliveryAction?.mode === "row-edit"')
  && panel.includes('initialDeliveryAction?.mode === "row-status"')
  && panel.includes('initialDeliveryAction?.mode === "set-create"')
  && panel.includes("batch-workspace-row-status-confirm")
  && panel.includes("Confirm {pendingRowStatus.status")
  && panel.includes("initialGroupId={requestedRowEditor?.groupId}"),
  "U4-PG-FE-20b grid requests reuse the lock-gated drawer editors and require confirmation before row lifecycle writes");
check(css.includes(".batch-workspace-profile-card {\n  position: relative;\n  z-index: 20;")
  && css.includes(".batch-profile-bar {\n  min-width: 0;\n  overflow: visible;"),
  "U4-PG-FE-21 the customer dropdown can escape the compact header without changing grid height");

console.log(`\n${passes} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
