// ═══════════════════════════════════════════════════════════════════════════
// src/lib/backendError.js — consistent backend error translation.
//
// U1 shared foundation (post-S7 handover §9.2 / §9.5). The one rule that
// matters: an RLS-filtered write that returns 200 with zero rows changed is
// a REFUSAL, not a success — server.py's own probe-matrix discipline
// (data-model-s0a-evidence.md, S5-C2 "the authenticated half measures
// refusal correctly") reads every write result back for exactly this
// reason, and the frontend must not silently disagree by treating "the
// fetch didn't throw" as "it worked."
//
// classifyResponse() takes the parsed {ok,status,data} shape apiClient.js
// already returns (see apiFetch) plus, for a write, the row-count it
// expected to change, and returns one of:
//   'ok'             - succeeded, rows confirmed changed/returned
//   'access-denied'  - 401/403, or 200 with zero rows where rows were required
//   'stale'          - 409/412, or the backend's own CAS-conflict shape
//   'validation'     - 400/422 with a message to show verbatim
//   'error'          - anything else (5xx, network failure)
// ═══════════════════════════════════════════════════════════════════════════
export function classifyResponse({ ok, status, data }, { expectRows } = {}) {
  if (status === 401 || status === 403) return { kind: "access-denied", message: readMessage(data) };
  if (status === 409 || status === 412) return { kind: "stale", message: readMessage(data) };
  if (status === 400 || status === 422) return { kind: "validation", message: readMessage(data) };
  // D2 — an upstream timeout (backend UPSTREAM_TIMEOUT → 504) is a retryable
  // infrastructure answer, not an application fault. It stays kind 'error' so
  // no caller's handling changes, but it always carries an actionable message
  // rather than falling through to a bare "Request failed (504)".
  if (status === 502 || status === 503 || status === 504) {
    return {
      kind: "error",
      retryable: true,
      message: readMessage(data)
        || "The service did not respond in time. Nothing was changed — please try again.",
    };
  }

  if (ok) {
    if (typeof expectRows === "number") {
      const got = countRows(data);
      if (got < expectRows) {
        // The request succeeded at the HTTP layer but RLS silently filtered
        // the write to nothing — this is a denial, not a success.
        return { kind: "access-denied", message: "No matching row was visible to your account." };
      }
    }
    return { kind: "ok" };
  }

  return { kind: "error", message: readMessage(data) || `Request failed (${status})` };
}

function readMessage(data) {
  if (!data) return "";
  return data.error || data.message || "";
}

function countRows(data) {
  if (Array.isArray(data)) return data.length;
  if (data && Array.isArray(data.rows)) return data.rows.length;
  if (data && typeof data.count === "number") return data.count;
  // A single-object success payload (e.g. one updated row) counts as one.
  return data ? 1 : 0;
}
