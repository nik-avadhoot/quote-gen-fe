// ── API client + session storage ────────────────────────────────────────────
// The frontend never talks to Supabase directly — every auth/data call goes
// through the Flask backend. Session tokens live here (module state, mirrored
// to a single dedicated localStorage key), not in the app's cbb_* data model.

const STORAGE_KEY = "qgos_session";

// Base URL of the Flask backend. Set VITE_API_BASE in the Vercel project (or
// a local .env) to point at the deployed backend; falls back to the local
// dev server. Vite inlines this at build time, so changing it needs a rebuild.
export const API_BASE = (import.meta.env.VITE_API_BASE || "http://localhost:3001").replace(/\/$/, "");

let session = loadFromStorage(); // {access_token, refresh_token, expires_at} | null
const listeners = new Set();

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function persist(next) {
  session = next;
  try {
    if (next) localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    else localStorage.removeItem(STORAGE_KEY);
  } catch { /* localStorage unavailable — session just won't persist across reloads */ }
}

function notify(profile) {
  for (const cb of listeners) cb(session, profile);
}

// Subscribe to session changes (login, logout, or a background refresh that
// happened inside apiFetch). Returns an unsubscribe function.
export function subscribe(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function hasSession() {
  return !!session;
}

async function postJson(path, body) {
  const resp = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await resp.json().catch(() => ({}));
  return { ok: resp.ok, status: resp.status, data };
}

export async function login(email, password) {
  const { ok, data } = await postJson("/auth/login", { email, password });
  if (!ok) throw new Error(data.error || "Login failed");
  persist({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: data.expires_at,
  });
  notify(data.profile);
  return data.profile;
}

// Re-validates the current session and fetches the latest profile — used on
// app load, and internally by apiFetch to recover from an expired access
// token. Also how a deactivation/role change made by an Admin gets picked up
// without waiting for the user to log out and back in.
export async function refreshSession() {
  if (!session?.refresh_token) throw new Error("No session");
  const { ok, data } = await postJson("/auth/refresh", { refresh_token: session.refresh_token });
  if (!ok) {
    persist(null);
    notify(null);
    throw new Error(data.error || "Session expired");
  }
  persist({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: data.expires_at,
  });
  notify(data.profile);
  return data.profile;
}

export async function logout() {
  const prev = session;
  persist(null);
  notify(null);
  if (prev) {
    try {
      await fetch(`${API_BASE}/auth/logout`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${prev.access_token}` },
      });
    } catch { /* best-effort revoke — frontend clears its own tokens regardless */ }
  }
}

// Authenticated fetch — attaches the access token, and on a 401 refreshes
// the session once and retries before giving up.
export async function apiFetch(path, options = {}) {
  if (!session) throw new Error("Not authenticated");

  const doFetch = (token) =>
    fetch(`${API_BASE}${path}`, {
      ...options,
      headers: { ...(options.headers || {}), Authorization: `Bearer ${token}` },
    });

  let resp = await doFetch(session.access_token);
  if (resp.status === 401) {
    await refreshSession(); // throws (and clears session) if the refresh token is also invalid
    resp = await doFetch(session.access_token);
  }
  return resp;
}
