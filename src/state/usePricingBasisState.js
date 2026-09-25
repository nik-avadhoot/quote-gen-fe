import { useState } from "react";
import { emptyGovernedReadiness, governedReadinessFromResponse } from "../lib/governedReadiness.js";
import { localIsoDate } from "../lib/pricingBasisModel.js";
import { isS1ActiveBrowserFixture, isS3GovernedBrowserFixture, S1_ACTIVE_BATCH,
  S3_GOVERNED_BATCH } from "../lib/s1BrowserFixture.js";

// Session fallback while no governed Batch is open. U4 hydrates its durable
// selection from the Batch route and never copies it into localStorage or the
// legacy Batch Profile.
export function usePricingBasisState() {
  const [u3PricingBasisDraft, setU3PricingBasisDraft] = useState(() => ({
    pricingDate: localIsoDate(),
    releaseId: null,
    selectionMode: null,
  }));
  // One application-wide durable Batch binding. Keeping this above both the
  // PRICING card and the legacy grid/profile state prevents those surfaces
  // from quietly pointing at different governed Batches.
  const [durableBatch, setDurableBatch] = useState(() =>
    isS3GovernedBrowserFixture() ? S3_GOVERNED_BATCH
      : isS1ActiveBrowserFixture() ? S1_ACTIVE_BATCH : null);
  const [newBatchDialogOpen, setNewBatchDialogOpen] = useState(false);
  const [batchWorkspaceRequest, setBatchWorkspaceRequest] = useState(null);
  // The governed workspace and the shared journey header consume this same
  // whole-Batch result, including while a row is open in Costing.
  const [governedBatchReadiness, setGovernedBatchReadiness] = useState(() =>
    isS3GovernedBrowserFixture()
      ? governedReadinessFromResponse(S3_GOVERNED_BATCH.fixture_readiness)
      : emptyGovernedReadiness());

  return {
    batchWorkspaceRequest,
    durableBatch,
    governedBatchReadiness,
    newBatchDialogOpen,
    setBatchWorkspaceRequest,
    setDurableBatch,
    setGovernedBatchReadiness,
    setNewBatchDialogOpen,
    setU3PricingBasisDraft,
    u3PricingBasisDraft,
  };
}
