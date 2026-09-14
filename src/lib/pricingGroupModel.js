export const PRICING_GROUP_FREIGHT_MODES = Object.freeze([
  { value: "master", label: "Approved Freight Master" },
  { value: "manual", label: "Manual rate" },
  { value: "ex_factory", label: "Ex-factory · zero freight" },
]);

export const PRICING_GROUP_PAYMENT_DAYS = Object.freeze([30, 45, 60, 90]);

export function activeDeliveryRoutes(group) {
  return (group?.delivery_groups || []).filter(route => route.status === "active");
}

const locationCode = (location, locationId) => location?.location_code
  || (locationId == null ? "not selected" : `#${locationId}`);

export function deliveryRouteDisplay(route) {
  const billTo = locationCode(route?.bill_to_location, route?.bill_to_location_id);
  const shipTo = locationCode(route?.ship_to_location, route?.ship_to_location_id);
  return {
    label: route?.label || `Delivery Group #${route?.id ?? "unavailable"}`,
    billTo,
    shipTo,
    path: `${billTo} → ${shipTo}`,
  };
}

const optionalNumber = value => {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : NaN;
};

export function pricingGroupCreateValidation(label) {
  const value = typeof label === "string" ? label.trim() : "";
  return {
    valid: value.length <= 120,
    error: value.length > 120 ? "Pricing Group label must be 120 characters or fewer." : null,
  };
}

export function pricingGroupCreateBody(label) {
  const value = typeof label === "string" ? label.trim() : "";
  return { label: value || null };
}

export function pricingGroupStatusBody(group, status) {
  return { expected_content_version: group.content_version, status };
}

export function deliveryGroupStatusBody(group, status) {
  return { pricing_group_id: group.id, status };
}

export function pricingGroupDraft(group) {
  const restatedManual = group?.freight_manual_value == null
    && group?.legacy_freight_source === "legacy_batch"
    ? group.legacy_freight_value : group?.freight_manual_value;
  return {
    label: group?.label || "",
    freightMode: group?.freight_mode || "master",
    freightManualValue: restatedManual == null ? "" : String(restatedManual),
    paymentTermsDays: group?.payment_terms_days == null ? "" : String(group.payment_terms_days),
    paymentTermsText: group?.payment_terms_text || "",
    interestOverridePct: group?.interest_override_pct == null ? "" : String(group.interest_override_pct),
    interestOverrideReason: group?.interest_override_reason || "",
  };
}

export function pricingGroupDraftValidation(draft) {
  const freight = optionalNumber(draft.freightManualValue);
  const interest = optionalNumber(draft.interestOverridePct);
  const days = draft.paymentTermsDays === "" ? null : Number(draft.paymentTermsDays);
  const errors = [];
  if (draft.label.trim().length > 120) errors.push("Pricing Group label must be 120 characters or fewer.");
  if (!PRICING_GROUP_FREIGHT_MODES.some(option => option.value === draft.freightMode)) {
    errors.push("Choose a governed freight mode.");
  }
  if (draft.freightMode === "manual" && freight === null) errors.push("Enter the manual freight rate.");
  if (Number.isNaN(freight)) errors.push("Manual freight must be blank or a non-negative number.");
  if (freight !== null && freight > 99999999.9999) errors.push("Manual freight exceeds the supported maximum.");
  if (days !== null && !PRICING_GROUP_PAYMENT_DAYS.includes(days)) {
    errors.push("Structured Payment Terms must be blank, 30, 45, 60 or 90 days.");
  }
  if (draft.paymentTermsText.trim().length > 500) errors.push("Payment Terms wording must be 500 characters or fewer.");
  if (Number.isNaN(interest)) errors.push("Interest override must be blank or a non-negative number.");
  if (interest !== null && interest > 9999.999) errors.push("Interest override exceeds the supported maximum.");
  if (draft.interestOverrideReason.trim().length > 500) errors.push("Interest reason must be 500 characters or fewer.");
  return { valid: errors.length === 0, errors };
}

export function pricingGroupUpdateBody(group, draft) {
  const freight = optionalNumber(draft.freightManualValue);
  const interest = optionalNumber(draft.interestOverridePct);
  return {
    expected_content_version: group.content_version,
    label: draft.label.trim() || null,
    freight_mode: draft.freightMode,
    freight_manual_value: draft.freightMode === "manual" ? freight : null,
    payment_terms_days: draft.paymentTermsDays === "" ? null : Number(draft.paymentTermsDays),
    payment_terms_text: draft.paymentTermsText.trim() || null,
    interest_override_pct: interest,
    interest_override_reason: interest === null ? null : draft.interestOverrideReason.trim() || null,
  };
}

export function applyFixturePricingGroupUpdate(group, body) {
  const updated = { ...group, ...body, content_version: group.content_version + 1 };
  delete updated.expected_content_version;
  if (updated.freight_mode === "ex_factory") updated.freight_basis_delivery_group_id = null;
  if (group.legacy_freight_source === "legacy_batch"
      && ["manual", "ex_factory"].includes(updated.freight_mode)) {
    updated.legacy_freight_value = null;
    updated.legacy_freight_source = null;
  }
  if (updated.interest_override_pct == null) {
    updated.interest_override_derived_pct = null;
    updated.interest_override_reason = null;
    updated.interest_override_by = null;
    updated.interest_override_at = null;
  }
  return updated;
}
