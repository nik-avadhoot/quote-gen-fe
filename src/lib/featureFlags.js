// ═══════════════════════════════════════════════════════════════════════════
// src/lib/featureFlags.js — localhost/Vercel feature-flag reader.
//
// U1 shared foundation (post-S7 handover §9.2). Vite inlines env vars at
// build time (theme.js/apiClient.js convention), so VITE_FEATURE_FLAGS is
// read once at module load, not per-render. A flag is either on the
// comma-separated allow-list or it is off — there is no per-user override
// and no runtime toggle, matching "localhost and Vercel are different
// application builds" (data-model-frontend-design-plan.md §2.9): flipping a
// flag needs a rebuild/redeploy, same as VITE_API_BASE.
// ═══════════════════════════════════════════════════════════════════════════
const RAW = import.meta.env.VITE_FEATURE_FLAGS || "";
const ENABLED = new Set(
  RAW.split(",").map(s => s.trim()).filter(Boolean)
);

export function isFeatureEnabled(key) {
  return ENABLED.has(key);
}

// Hook form for parity with the rest of the app's `use*` state accessors.
// The set is fixed for the lifetime of the page load, so this never
// re-renders on its own — it exists so call sites read like state rather
// than reaching into a module-level export.
export function useFeatureFlag(key) {
  return ENABLED.has(key);
}
