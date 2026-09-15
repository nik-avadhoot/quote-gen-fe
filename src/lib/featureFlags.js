// ═══════════════════════════════════════════════════════════════════════════
// src/lib/featureFlags.js — localhost/Vercel feature-flag reader.
//
// U1 shared foundation (post-S7 handover §9.2). Vite inlines env vars at
// build time (theme.js/apiClient.js convention), so VITE_FEATURE_FLAGS is
// read once at module load, not per-render. There is no per-user override and
// no runtime toggle, matching "localhost and Vercel are different application
// builds" (data-model-frontend-design-plan.md §2.9): flipping a flag needs a
// rebuild/redeploy, same as VITE_API_BASE.
//
// ── DEV_DEFAULTS: development destinations ─────────────────────────────────
// u1-users-access-authorization-packet.md §5 forbids removing Users/Access's
// embedded Plant Master panel while the standalone Producing Plants screen
// "can be hidden by configuration". It could be. The ONLY thing turning these
// screens on was `.env.local`, which is UNTRACKED (.gitignore `*.local`) and
// has never been in history: a clean checkout enabled nothing, so the screens
// appeared and then disappeared with the state of one machine — the exact
// regression §5 names. A default that lives in this file cannot be lost by a
// clone, a new machine, or a deleted settings file, so §5 is satisfied and
// UA-7 may proceed.
//
// U3 adds one further development destination: u3_pricing_basis.  The Product
// Owner explicitly opened the UX-first U-phase while production deployment
// remains out of scope.  Keeping it in this development-only floor makes the
// new screen reachable without reading or changing `.env.local`; production
// remains default-off.
//
// Deliberately narrow, in three ways:
//
//   1. DEVELOPMENT ONLY. `import.meta.env.DEV` is true under `vite` and false
//      under `vite build`, so this changes the dev build alone. .env.production
//      is untouched and Vercel keeps its default-off behaviour. Turning a
//      screen on there is still a deliberate, separate decision.
//
//   2. ADDITIVE, NOT AN OVERRIDE. This is code rather than a `.env.development`
//      file on purpose: Vite ranks `.env.[mode]` ABOVE `.env.local`, so an env
//      file would silently drop flags a developer set for themselves (today,
//      u1_batch_party_link). Union semantics cannot do that.
//
//   3. DESTINATIONS ONLY. The floor carries the two U1 destinations §5 protects
//      plus the explicitly opened U3 Pricing Basis destination. It is not a
//      general "enable what is closed" list, and closure is not the test for
//      membership.
//
//      Slice D's u1_batch_party_link is deliberately absent, and NOT because
//      Slice D is unfinished: Slice D and Slice E are technically closed and
//      Product Owner validated for the limited U1 master-backed interaction
//      scope (`u1-slice-d-correction-and-status.md`, "Slice D / E closure —
//      Product Owner acceptance, 2026-09-08", which supersedes the earlier
//      status rows in that file). It is absent because it gates an affordance
//      ON an existing screen rather than a destination that can disappear, and
//      because its rollout is deliberately localhost-only with
//      .env.production untouched. That stays an explicit opt-in naming in
//      VITE_FEATURE_FLAGS — a rollout policy, not a verdict on the slice.
// ═══════════════════════════════════════════════════════════════════════════
// u2_gsm_master joins the floor on the same basis as u3_pricing_basis: the
// Product Owner approved the GSM Master destination on 2026-09-15; production
// stays default-off until its migration is activated.
// u2_sku_master joins for the read-only SKU Master increment (2026-09-15). It is
// a destination, it issues only caller-token reads, and production stays
// default-off until its rollout is a separate decision.
const DEV_DEFAULTS = ["u1_producing_plants", "u1_customer_families", "u3_pricing_basis", "u2_gsm_master",
  "u2_sku_master"];

const RAW = import.meta.env.VITE_FEATURE_FLAGS || "";
const ENABLED = new Set([
  ...(import.meta.env.DEV ? DEV_DEFAULTS : []),
  ...RAW.split(",").map(s => s.trim()).filter(Boolean),
]);

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
