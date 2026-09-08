// ═══════════════════════════════════════════════════════════════════════════
// src/lib/runMutation.js — one governed write, with its outcome told honestly.
//
// Lifted verbatim out of tabs/CustomerFamiliesScreen.jsx (U1 Slice D) where it
// was module-private. Moved rather than copied: Slice D's Batch Entry
// quick-create calls the SAME two governed routes as that screen, and a second
// copy of this logic would be a second place for the D2 outcome vocabulary to
// drift. Behaviour is unchanged — the screen now imports what it used to
// define, and its callers pass exactly the same arguments.
//
// The distinction this function exists to preserve (D2):
//   🚫 denied          — you may not do this; retrying changes nothing.
//   ⏱ stale conflict   — someone else moved first; reload, then redo.
//   ⚠️ outcome unknown  — the response was lost; the write MAY have landed,
//                        so look before acting rather than resubmitting.
//   ❌ plain failure    — it did not happen.
//
// classifyResponse() (lib/backendError.js) decides which, including the rule
// that an RLS-filtered write returning 200 with zero rows is a REFUSAL and not
// a success.
// ═══════════════════════════════════════════════════════════════════════════
import { apiFetch } from "./apiClient.js";
import { classifyResponse } from "./backendError.js";

export async function runMutation(path, body, { method = "POST", showToast, successMessage } = {}) {
  let resp, data;
  try {
    resp = await apiFetch(path, {
      method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    data = await resp.json().catch(() => ({}));
  } catch {
    showToast?.("❌ Network error — could not reach the server.", "error", 8000);
    return null;
  }
  const outcome = classifyResponse({ ok: resp.ok, status: resp.status, data });
  if (outcome.kind === "ok") {
    if (successMessage) showToast?.("✅ " + successMessage, "success", 6000);
    return data;
  }
  const prefix = outcome.kind === "access-denied" ? "🚫"
    : outcome.kind === "stale" ? "⏱"
    : outcome.outcomeUnknown ? "⚠️" : "❌";
  const fallback = outcome.kind === "stale"
    ? "This record changed since you loaded it — reload and try again."
    : outcome.outcomeUnknown
      ? "The outcome of this action is unknown — refresh to see the current state before trying again."
      : "That action could not be completed.";
  showToast?.(`${prefix} ${outcome.message || fallback}`,
              "error", outcome.outcomeUnknown ? 12000 : 8000);
  return null;
}
