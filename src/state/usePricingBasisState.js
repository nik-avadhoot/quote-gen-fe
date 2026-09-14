import { useState } from "react";
import { localIsoDate } from "../lib/pricingBasisModel.js";

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
  const [durableBatch, setDurableBatch] = useState(null);
  const [newBatchDialogOpen, setNewBatchDialogOpen] = useState(false);
  const [batchWorkspaceRequest, setBatchWorkspaceRequest] = useState(null);

  return {
    batchWorkspaceRequest,
    durableBatch,
    newBatchDialogOpen,
    setBatchWorkspaceRequest,
    setDurableBatch,
    setNewBatchDialogOpen,
    setU3PricingBasisDraft,
    u3PricingBasisDraft,
  };
}
