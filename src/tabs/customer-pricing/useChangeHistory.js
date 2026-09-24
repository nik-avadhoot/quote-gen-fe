// P0.4 change history: loaded on request, one bounded page at a time (never per
// row or cell). Every state is said honestly: not loaded, loading, denied,
// unavailable, failed, empty, partial (older pages / unreadable names) and
// stale (the record was saved after this page was read).
import { useCallback, useState } from "react";
import { fetchPricingChanges } from "../../lib/customerPricingActions.js";

export default function useChangeHistory(partyId, fixtureChanges = null) {
  const [state, setState] = useState({ status: "idle", items: [], hasMore: false, nextBefore: null,
    namesPartial: false, stale: false });

  const load = useCallback(async (older = false) => {
    if (fixtureChanges) {
      setState({ status: "ready", items: fixtureChanges.changes, hasMore: fixtureChanges.has_more,
        nextBefore: fixtureChanges.next_before_id, namesPartial: fixtureChanges.actor_names_partial, stale: false,
        fixture: true });
      return;
    }
    setState(s => ({ ...s, status: older ? "loading-older" : "loading" }));
    const res = await fetchPricingChanges(partyId, { beforeId: older ? state.nextBefore : null });
    if (!res.ok) {
      const status = res.kind === "access-denied" ? "denied" : res.errorCode === "MASTER_UNAVAILABLE" ? "unavailable" : "failed";
      // A failed "older" page keeps what was already shown.
      setState(s => (older ? { ...s, status: "ready", olderError: res.message } : { ...s, status, message: res.message }));
      return;
    }
    const d = res.data;
    setState(s => ({ status: "ready", items: older ? [...s.items, ...d.changes] : d.changes, hasMore: !!d.has_more,
      nextBefore: d.next_before_id, namesPartial: !!d.actor_names_partial || (older && s.namesPartial), stale: false }));
  }, [partyId, fixtureChanges, state.nextBefore]);

  const markStale = useCallback(() => setState(s => (s.status === "ready" ? { ...s, stale: true } : s)), []);

  return { history: state, loadHistory: load, markHistoryStale: markStale };
}
