// Customer Pricing History P0.3 — the active layout and the browser-local named
// views for ONE (authenticated user, Customer). Layout preferences only: the
// pricing record itself is never read from or written to browser storage.
import { useCallback, useState } from "react";
import {
  MAX_NAMED_VIEWS, STANDARD_PRESET_ID, applyLayoutOp, cleanViewName, layoutStorageKey, loadLayoutState, presetLayout,
  saveLayoutState,
} from "../../lib/customerPricingLayout.js";

export default function useCustomerPricingLayout(userId, partyId) {
  const key = layoutStorageKey(userId, partyId);
  const [state, setState] = useState(() => ({ key, ...loadLayoutState(userId, partyId) }));
  // A different user or Customer is a different stored layout: reload it
  // during render (never mix one user's/Customer's views into another's).
  let live = state;
  if (state.key !== key) {
    live = { key, ...loadLayoutState(userId, partyId) };
    setState(live);
  }

  const commit = useCallback(next => {
    setState(prev => {
      const value = typeof next === "function" ? next(prev) : next;
      if (value === prev) return prev;
      saveLayoutState(userId, partyId, value);
      return { ...value, fallback: null };
    });
  }, [userId, partyId]);

  // Any rearrangement makes the view "custom" until saved under a name.
  const apply = useCallback((op, effectiveLayout) => commit(prev => {
    const next = applyLayoutOp(effectiveLayout || prev.current, op);
    if (next === (effectiveLayout || prev.current)) return prev;
    return { ...prev, current: next,
      active: prev.active.kind === "named" ? { kind: "named-edited", name: prev.active.name } : { kind: "custom" } };
  }), [commit]);

  const choosePreset = useCallback((id, registry) => commit(prev => ({ ...prev,
    current: presetLayout(id, registry), active: { kind: "preset", id } })), [commit]);

  const chooseNamed = useCallback(name => commit(prev => (prev.named[name]
    ? { ...prev, current: prev.named[name], active: { kind: "named", name } } : prev)), [commit]);

  // → null on success, or the reason the name was refused.
  const saveAs = useCallback((rawName, effectiveLayout) => {
    const name = cleanViewName(rawName);
    if (!name) return "Enter a name of up to 40 characters.";
    if (!live.named[name] && Object.keys(live.named).length >= MAX_NAMED_VIEWS) {
      return `At most ${MAX_NAMED_VIEWS} saved views per Customer — delete one first.`;
    }
    commit(prev => ({ ...prev, current: effectiveLayout, named: { ...prev.named, [name]: effectiveLayout },
      active: { kind: "named", name } }));
    return null;
  }, [commit, live.named]);

  const deleteNamed = useCallback(name => commit(prev => {
    if (!prev.named[name]) return prev;
    const named = { ...prev.named };
    delete named[name];
    const active = prev.active.name === name ? { kind: "custom" } : prev.active;
    return { ...prev, named, active };
  }), [commit]);

  const reset = useCallback(registry => choosePreset(STANDARD_PRESET_ID, registry), [choosePreset]);

  return { layout: live.current, active: live.active, named: live.named, fallback: live.fallback,
    persisted: !!key, apply, choosePreset, chooseNamed, saveAs, deleteNamed, reset };
}
