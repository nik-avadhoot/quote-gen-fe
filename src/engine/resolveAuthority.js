// ═══════════════════════════════════════════════════════════════════════════
// src/engine/resolveAuthority.js
//
// THE ONE CalcGate resolver (S7 / D-25). Pure JavaScript, zero React, zero I/O,
// so the goldens can execute it without a renderer.
//
// It exists because two surfaces answered the same question differently:
//
//   Costing        state/useCostingResult.js   batch ?? sector ?? literal
//   Batch Entry    state/useQuoteActions.js    row   ?? batch  ?? literal
//
// - the gate that actually produces a Quote had no Sector tier at all, so a
// Batch with a blank profile field costed one way on screen and another way at
// Send. Both now call this.
//
// WHAT IT RETURNS, AND WHY IT IS NOT JUST A NUMBER.
//
//     { value, source, sourceRef, ...inputs }
//
// CDM-22 requires Send to freeze "effective values and sources, selected
// versions". A resolver that returned only the number would make that
// impossible after the fact, and for Interest it would be worse than
// impossible: the effective percentage is now DERIVED from an approved annual
// rate, so once that rate is superseded the number cannot be re-derived from
// anything the snapshot holds unless the snapshot also holds the rate, the
// basis and the days. Those come back in the result.
//
// BLANK, ZERO AND UNRESOLVED ARE THREE STATES.
//
//   null / undefined / '' / non-numeric   →  INHERIT, advance the chain
//   0                                     →  a value the user chose, STOP
//   nothing left in the chain             →  unresolved
//
// Every tier test goes through isBlank(). Never truthiness, never `||`, never
// `+x > 0`. The blank test deliberately mirrors `nz()` in costing.js - including
// treating a non-numeric string as blank - so adopting the resolver moves no
// number that the engine was already computing.
//
// TWO TIERS ARE PRESENT BUT CURRENTLY INERT, AND THAT IS DELIBERATE.
//
//   sector.marginPct        sector_versions.margin_pct is NOT NULL in the
//                           database, but the browser-local Sector master
//                           (data/defaults.js) carries no margin column at all.
//                           The tier is wired so the chain matches CDM-19; it
//                           resolves blank today and therefore changes no price.
//                           It starts carrying values when U3 delivers Sectors
//                           from the database, and that will be a visible,
//                           reviewed change - not a silent one now.
//
//   rateSetVersion          CDM-41 puts supplier credit cost on the Rate Set
//                           version. The frontend has no Rate Set version object
//                           yet, so the caller passes null and the chain falls
//                           to the versioned system value, which is the same
//                           1.5% the engine already used.
//
// Neither tier is a guess about the future: both are the canonical chain written
// down once, so the day the data arrives nobody has to find the call sites.
// ═══════════════════════════════════════════════════════════════════════════
import { CALC_DEFAULTS } from './calcDefaults.js';
import { deriveInterestPct } from './interestBasis.js';

/**
 * Blank means inherit. Mirrors `nz()` in costing.js exactly, so the resolver and
 * the engine agree on what "not set" means. A legitimate 0 is NOT blank.
 */
export const isBlank = (v) =>
  v === null || v === undefined || v === '' || isNaN(+v);

const hit = (value, source, sourceRef = null, extra = null) =>
  ({ value: +value, source, sourceRef, ...(extra || {}) });

const UNRESOLVED = { value: null, source: 'unresolved', sourceRef: null };

// Which profile / sector keys a field reads, by row type. `isPP` is the
// Plate/Part-L/Part-W switch the engine already makes; the PP arm is not an
// edge case, it is half the model (CDM-19).
const FIELDS = {
  waste: {
    profile: (pp) => (pp ? 'wastePP' : 'waste'),
    sector:  (pp) => (pp ? 'wastePP' : 'wasteCBB'),
    system:  (pp) => (pp ? 'wastePpFallbackPct' : 'wasteCbbFallbackPct'),
  },
  convRate: {
    profile: (pp) => (pp ? 'convRatePP' : 'convRate'),
    sector:  (pp) => (pp ? 'convPP' : 'convBox'),
    system:  (pp) => (pp ? 'convPpFallbackRate' : 'convBoxFallbackRate'),
  },
  margin: {
    // CDM-19: Batch Box/PP defaults are separate tiers; the Sector keeps ONE
    // approved target margin for both.
    profile: (pp) => (pp ? 'marginPP' : 'margin'),
    sector:  () => 'marginPct',
    system:  () => 'marginFallbackPct',
  },
};

/**
 * Resolve one inheritable field.
 *
 * @param {'waste'|'convRate'|'margin'} field
 * @param {object} ctx
 *   rowOverride  the row's override for this field (blank = inherit)
 *   batchProfile the Batch Profile version
 *   sector       the Sector version
 *   calcDefaults the approved Calculation Defaults version
 *   isPP         Plate / Part-L / Part-W row
 */
export function resolveField(field, ctx = {}) {
  const spec = FIELDS[field];
  if (!spec) throw new Error(`resolveField: unknown field "${field}"`);

  const { rowOverride, batchProfile, sector, isPP = false } = ctx;
  const defaults = ctx.calcDefaults || CALC_DEFAULTS;

  if (!isBlank(rowOverride)) return hit(rowOverride, 'row');

  const pKey = spec.profile(isPP);
  if (batchProfile && !isBlank(batchProfile[pKey])) {
    return hit(batchProfile[pKey], 'batch', batchProfile.versionId ?? null);
  }

  const sKey = spec.sector(isPP);
  if (sector && !isBlank(sector[sKey])) {
    return hit(sector[sKey], 'sector', sector.versionId ?? sector.code ?? null);
  }

  const dKey = spec.system(isPP);
  if (defaults && !isBlank(defaults[dKey])) {
    return hit(defaults[dKey], 'system', defaults.versionLabel ?? null);
  }

  return { ...UNRESOLVED };
}

/**
 * Resolve customer Payment-Terms Interest (CDM-18, Amendment 01 A-01 to A-04).
 *
 *   explicit Pricing Group override
 *     → derived from the approved annual rate
 *       → versioned system fallback
 *
 * The derived tier is the one that replaced a stored map. It returns the three
 * inputs alongside the value because a derived number is not self-evidencing.
 */
export function resolveInterest(ctx = {}) {
  const { pricingGroup } = ctx;
  const defaults = ctx.calcDefaults || CALC_DEFAULTS;
  const days = pricingGroup ? pricingGroup.paymentTermsDays : null;

  // Tier 1 - the retained commercial escape hatch. An explicit 0 lands here and
  // means "no interest charged", which is a decision, not a blank.
  if (pricingGroup && !isBlank(pricingGroup.interestOverridePct)) {
    return hit(pricingGroup.interestOverridePct, 'pricing_group', pricingGroup.id ?? null, {
      paymentTermsDays: isBlank(days) ? null : +days,
      annualInterestPct: defaults.annualInterestPct,
      dayCountBasis: defaults.dayCountBasis,
      overrideReason: pricingGroup.interestOverrideReason ?? null,
    });
  }

  // Tier 2 - the derivation. Null when the term is not one the model calculates
  // from; null is "unresolved", never zero.
  const derived = deriveInterestPct(
    defaults.annualInterestPct, days, defaults.dayCountBasis);
  if (derived !== null) {
    return hit(derived, 'derived_annual', defaults.versionLabel ?? null, {
      paymentTermsDays: +days,
      annualInterestPct: defaults.annualInterestPct,
      dayCountBasis: defaults.dayCountBasis,
    });
  }

  // Tier 3 - the INDEPENDENT fallback. 0.5, and never 1.5. It is not the top of
  // the withdrawn map and is not derived from the annual rate.
  if (!isBlank(defaults.interestFallbackPct)) {
    return hit(defaults.interestFallbackPct, 'system', defaults.versionLabel ?? null, {
      paymentTermsDays: isBlank(days) ? null : +days,
      annualInterestPct: defaults.annualInterestPct,
      dayCountBasis: defaults.dayCountBasis,
    });
  }

  return { ...UNRESOLVED };
}

/**
 * Resolve SUPPLIER paper-credit cost (CDM-41, Amendment 01 A-05).
 *
 *   per-grade exception → Rate Set version → versioned system value
 *
 * A different tier from customer interest and never derived from it. Blank on
 * the grade inherits; an explicit 0 is a grade genuinely bought on cash terms
 * and must survive.
 */
export function resolveSupplierCreditCost(ctx = {}) {
  const { rateEntry, rateSetVersion } = ctx;
  const defaults = ctx.calcDefaults || CALC_DEFAULTS;

  if (rateEntry && !isBlank(rateEntry.interest)) {
    return hit(rateEntry.interest, 'rate_entry', rateEntry.code ?? null);
  }
  if (rateSetVersion && !isBlank(rateSetVersion.creditCostPct)) {
    return hit(rateSetVersion.creditCostPct, 'rate_set_version', rateSetVersion.id ?? null);
  }
  if (!isBlank(defaults.supplierCreditCostPct)) {
    return hit(defaults.supplierCreditCostPct, 'system', defaults.versionLabel ?? null);
  }
  return { ...UNRESOLVED };
}

/**
 * Every inheritable value for one row, in one call, with provenance for each.
 * This is the shape Send freezes (CDM-22) and the shape both surfaces consume,
 * so Costing and Batch Entry cannot drift apart again.
 */
export function resolveRowAuthority(ctx = {}) {
  const { isPP = false } = ctx;
  const shared = {
    batchProfile: ctx.batchProfile,
    sector: ctx.sector,
    calcDefaults: ctx.calcDefaults,
    isPP,
  };
  return {
    waste:    resolveField('waste',    { ...shared, rowOverride: ctx.rowWaste }),
    convRate: resolveField('convRate', { ...shared, rowOverride: ctx.rowConv }),
    margin:   resolveField('margin',   { ...shared, rowOverride: ctx.rowMargin }),
    interest: resolveInterest({ pricingGroup: ctx.pricingGroup, calcDefaults: ctx.calcDefaults }),
  };
}
