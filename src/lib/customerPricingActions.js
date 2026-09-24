// ═══════════════════════════════════════════════════════════════════════════
// src/lib/customerPricingActions.js — Customer Pricing History transport.
//
// Every call goes through apiFetch (the caller's own token). Nothing here is
// persisted in the browser: pricing history is business data and lives only
// in the backend (plan §9 — no cbb_* storage).
//
// Unlike runMutation(), a mutation here RETURNS its outcome kind instead of
// only toasting it, because the workspace must keep the user's unsaved entry
// on a stale-version conflict and let them reload without losing it.
// ═══════════════════════════════════════════════════════════════════════════
import { apiFetch } from "./apiClient.js";
import { classifyResponse } from "./backendError.js";

export async function fetchPricingHistory(partyId) {
  let resp, data;
  try {
    resp = await apiFetch(`/masters/parties/${partyId}/pricing-history`);
    data = await resp.json().catch(() => ({}));
  } catch {
    return { ok: false, kind: "error", message: "Network error — could not reach the server." };
  }
  if (resp.ok) return { ok: true, data };
  const outcome = classifyResponse({ ok: resp.ok, status: resp.status, data });
  return { ok: false, kind: outcome.kind, errorCode: data?.error_code, message: outcome.message };
}

// → { ok, data } | { ok:false, kind: "stale"|"access-denied"|"validation"|"duplicate"|"error",
//                    errorCode, message, outcomeUnknown }
export async function pricingMutation(path, body, method = "POST") {
  let resp, data;
  try {
    resp = await apiFetch(path, {
      method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    data = await resp.json().catch(() => ({}));
  } catch {
    return { ok: false, kind: "error", outcomeUnknown: true,
      message: "Network error — the outcome is unknown. Reload before trying again." };
  }
  if (resp.ok) return { ok: true, data };
  const outcome = classifyResponse({ ok: resp.ok, status: resp.status, data });
  // DUPLICATE_RECORD is a 409 but NOT a stale version: nothing the user read
  // is out of date; the thing they are adding already exists.
  // OVERLAPPING_VERSION (P0.2) is likewise a 409 that reload cannot fix.
  // ROUND_VOIDED (P0.5) is a 409 too: the round is voided and frozen, reload shows it.
  const kind = data?.error_code === "DUPLICATE_RECORD" ? "duplicate"
    : data?.error_code === "OVERLAPPING_VERSION" ? "overlap"
      : data?.error_code === "ROUND_VOIDED" ? "voided" : outcome.kind;
  return { ok: false, kind, errorCode: data?.error_code, message: outcome.message,
    outcomeUnknown: !!outcome.outcomeUnknown,
    // P0.4: the backend-authored text and per-operation issues of a blocked paste.
    serverMessage: typeof data?.error === "string" ? data.error : null,
    issues: Array.isArray(data?.issues) ? data.issues : null };
}

// P0.4: one bounded page of the append-only change log, newest first.
export async function fetchPricingChanges(partyId, { beforeId = null, limit = 50 } = {}) {
  const q = new URLSearchParams({ limit: String(limit) });
  if (beforeId) q.set("before_id", String(beforeId));
  let resp, data;
  try {
    resp = await apiFetch(`/masters/parties/${partyId}/pricing-history/changes?${q}`);
    data = await resp.json().catch(() => ({}));
  } catch {
    return { ok: false, kind: "error", message: "Network error — could not reach the server." };
  }
  if (resp.ok) return { ok: true, data };
  const outcome = classifyResponse({ ok: resp.ok, status: resp.status, data });
  return { ok: false, kind: outcome.kind, errorCode: data?.error_code, message: outcome.message };
}

export const pricingPaths = {
  mechanism: partyId => `/masters/parties/${partyId}/pricing-mechanism`,
  cycles: partyId => `/masters/parties/${partyId}/pricing-cycles`,
  cycle: cycleId => `/masters/pricing-cycles/${cycleId}`,
  lines: cycleId => `/masters/pricing-cycles/${cycleId}/lines`,
  line: lineId => `/masters/pricing-lines/${lineId}`,
  events: lineId => `/masters/pricing-lines/${lineId}/events`,
  event: eventId => `/masters/pricing-events/${eventId}`,
  // P0.5: void THAT round (CAS + reason); never a delete.
  voidEvent: eventId => `/masters/pricing-events/${eventId}/void`,
  // P0.2
  terms: partyId => `/masters/parties/${partyId}/pricing-terms`,
  term: termId => `/masters/pricing-terms/${termId}`,
  bfSets: partyId => `/masters/parties/${partyId}/pricing-bf-sets`,
  bfSet: setId => `/masters/pricing-bf-sets/${setId}`,
  references: lineId => `/masters/pricing-lines/${lineId}/references`,
  measures: lineId => `/masters/pricing-lines/${lineId}/measures`,
  bfOverrides: eventId => `/masters/pricing-events/${eventId}/bf-overrides`,
  nextCycle: cycleId => `/masters/pricing-cycles/${cycleId}/next`,
  // P0.4: ONE Customer-scoped preview/apply pair for a whole paste batch.
  pastePreview: partyId => `/masters/parties/${partyId}/pricing-paste/preview`,
  pasteApply: partyId => `/masters/parties/${partyId}/pricing-paste/apply`,
};

// Idempotency key for "add a round": generated once per draft, reused on a
// retry, so an unknown-outcome retry is refused as a duplicate, never doubled.
export function newClientRequestId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const b = new Uint8Array(16);
  globalThis.crypto.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map(x => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
