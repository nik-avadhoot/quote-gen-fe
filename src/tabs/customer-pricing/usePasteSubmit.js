// P0.4 — the ONE server round trip pair behind every paste (main grid and BF
// schedule): prepare = server-validated preview bound to the caller, Customer,
// exact payload digest and an expiry; apply = the whole batch, atomically.
// The pasted draft lives in the calling panel and survives every failure here.
import { useCallback, useState } from "react";
import { pricingMutation, pricingPaths } from "../../lib/customerPricingActions.js";

// state.status: idle | preparing | prepared | blocked | applying | applied | failed | fixture
export default function usePasteSubmit(partyId, fixture) {
  const [state, setState] = useState({ status: "idle" });

  const reset = useCallback(() => setState({ status: "idle" }), []);

  const prepare = useCallback(async body => {
    if (fixture) {
      // Fixture preview: show the exact request, send nothing.
      setState({ status: "fixture", request: { method: "POST", path: pricingPaths.pastePreview(partyId), body } });
      return;
    }
    setState({ status: "preparing" });
    const res = await pricingMutation(pricingPaths.pastePreview(partyId), body);
    if (res.ok) { setState({ status: "prepared", preview: res.data }); return; }
    if (res.errorCode === "PASTE_BLOCKED") {
      setState({ status: "blocked", issues: res.issues || [], message: res.serverMessage || res.message });
      return;
    }
    setState({ status: "failed", errorCode: res.errorCode, kind: res.kind, message: res.serverMessage || res.message });
  }, [partyId, fixture]);

  const apply = useCallback(async () => {
    if (state.status !== "prepared") return null;
    const { preview_id: previewId, digest } = state.preview;
    setState(s => ({ ...s, status: "applying" }));
    const res = await pricingMutation(pricingPaths.pasteApply(partyId), { preview_id: previewId, digest });
    if (res.ok) { setState({ status: "applied", result: res.data }); return res; }
    // Nothing was written (the database applies all or nothing). An unknown
    // outcome (network) is said as such: reload before retrying.
    setState({ status: "failed", errorCode: res.errorCode, kind: res.kind, outcomeUnknown: res.outcomeUnknown,
      message: res.serverMessage || res.message });
    return res;
  }, [state, partyId]);

  return { state, prepare, apply, reset };
}
