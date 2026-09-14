import {
  automaticPricingBasisSuggestion,
  pricingBasisOptions,
  releaseEligibility,
} from "./pricingBasisModel.js";

export function pricingBasisDraftFromBatch(batch) {
  if (!batch) return null;
  return {
    pricingDate: batch.pricing_date || "",
    releaseId: batch.pricing_basis_release_id ?? null,
    selectionMode: batch.pricing_basis_is_deliberate
      ? "deliberate"
      : batch.pricing_basis_release_id == null ? null : "automatic_default",
  };
}

export function suggestForUnresolvedBatch(batch, releases) {
  if (!batch || batch.pricing_basis_release_id != null) return null;
  return automaticPricingBasisSuggestion(pricingBasisOptions(
    releases,
    batch.plant?.plant_code,
    batch.pricing_date,
  ));
}

export function persistedSelectionState(batch, releases, draft) {
  const releaseId = draft?.releaseId ?? null;
  const selected = releases.find(release => String(release.id) === String(releaseId)) || null;
  if (releaseId == null) {
    return {
      selected: null,
      eligible: false,
      warning: "No Pricing Basis Release is selected. Calculate and Send remain unavailable.",
    };
  }
  if (!selected) {
    return {
      selected: null,
      eligible: false,
      warning: `Persisted Release #${releaseId} is not visible in this caller's catalogue. It has not been replaced.`,
    };
  }
  if (selected.plant?.plant_code !== batch?.plant?.plant_code) {
    return {
      selected,
      eligible: false,
      warning: "The visible Release belongs to another plant. It has not been substituted.",
    };
  }
  const eligibility = releaseEligibility(selected, draft?.pricingDate);
  return {
    selected,
    eligible: eligibility.eligible,
    warning: eligibility.eligible ? null
      : `${eligibility.reason} The persisted selection is retained until the Maker deliberately changes it.`,
  };
}

export function pricingBasisDraftIsDirty(batch, draft) {
  if (!batch || !draft) return false;
  const deliberate = draft.selectionMode === "deliberate";
  return draft.pricingDate !== batch.pricing_date
    || String(draft.releaseId ?? "") !== String(batch.pricing_basis_release_id ?? "")
    || deliberate !== (batch.pricing_basis_is_deliberate === true);
}

export function setBatchPricingBasisBody(batch, draft) {
  return {
    expected_content_version: batch.content_version,
    pricing_date: draft.pricingDate,
    // Null is the governed RPC's explicit instruction to re-resolve the one
    // automatic default. A non-null id is always a deliberate selection.
    release_id: draft.selectionMode === "automatic_default" ? null : draft.releaseId,
  };
}
