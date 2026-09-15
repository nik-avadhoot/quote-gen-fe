// ═══════════════════════════════════════════════════════════════════════════
// src/state/useGsmMaster.js — one shared read of the GSM Master for every GSM
// picker on the page and the GSM Master screen.
//
// Deliberately outside AppStateProvider: it is an independent read with no
// dependency on composed state, and it must not reorder that composition.
// A failed or unavailable read is reported as such — no local list is ever
// substituted — and pickers fall back to visibly-marked free entry.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useState } from "react";
import { apiFetch } from "../lib/apiClient.js";
import { classifyResponse } from "../lib/backendError.js";
import { sortGsmValues } from "../lib/gsmMaster.js";

let snapshot = { status: "loading", values: [], canManage: false };
let inflight = null;
const listeners = new Set();

async function readGsmMaster() {
  let resp, data;
  try {
    resp = await apiFetch("/masters/gsm-values");
    data = await resp.json().catch(() => ({}));
  } catch {
    return { status: "error", values: [], canManage: false };
  }
  const outcome = classifyResponse({ ok: resp.ok, status: resp.status, data });
  if (outcome.kind === "ok") {
    return { status: "ok", values: sortGsmValues(data.values), canManage: data.can_manage === true };
  }
  if (outcome.kind === "access-denied") return { status: "denied", values: [], canManage: false };
  return { status: data?.error_code === "MASTER_UNAVAILABLE" ? "unavailable" : "error",
    values: [], canManage: false };
}

export function reloadGsmMaster() {
  if (inflight) return inflight;
  inflight = readGsmMaster().then(next => {
    snapshot = next;
    inflight = null;
    listeners.forEach(listener => listener(next));
    return next;
  });
  return inflight;
}

export function useGsmMaster() {
  const [state, setState] = useState(snapshot);
  useEffect(() => {
    listeners.add(setState);
    if (snapshot.status === "loading") reloadGsmMaster();
    else setState(snapshot);
    return () => { listeners.delete(setState); };
  }, []);
  return { ...state, reload: reloadGsmMaster };
}
