// Rate Master boundary. Supplier-credit selection and application end here.
// The costing engine receives only the resulting effective material rate.
import { CREDIT_PCT } from '../data/defaults.js';

const blank = (v) => v === '' || v === null || v === undefined || Number.isNaN(+v);

export function resolveSupplierCreditCost({ rateEntry, rateSetVersion } = {}) {
  if (rateEntry && !blank(rateEntry.interest)) {
    return { value: +rateEntry.interest, source: 'rate_entry', sourceRef: rateEntry.code ?? null };
  }
  if (rateSetVersion && !blank(rateSetVersion.creditCostPct)) {
    return { value: +rateSetVersion.creditCostPct, source: 'rate_set_version', sourceRef: rateSetVersion.id ?? null };
  }
  return { value: CREDIT_PCT * 100, source: 'system', sourceRef: 'app-mirror/rate-master' };
}

export function establishEffectiveMaterialRate(rateEntry, rateSetVersion) {
  if (!rateEntry || blank(rateEntry.price)) return null;
  const creditPct = resolveSupplierCreditCost({ rateEntry, rateSetVersion }).value;
  return +rateEntry.price + (+rateEntry.price * creditPct / 100)
    - (+rateEntry.disc || 0) + (+rateEntry.freight || 0);
}

export const materializeEffectiveRates = (rates = [], rateSetVersion) => rates.map((entry) => ({
  code: entry.code,
  effectiveRate: establishEffectiveMaterialRate(entry, rateSetVersion),
}));
