// ═══════════════════════════════════════════════════════════════════════════
// src/ui/AuthOrphansPanel.jsx — UA-6, orphan-account recovery.
//
// Lives inside Users/Access rather than behind its own navigation entry. It is
// a recovery tool for user accounts and has no other home — unlike the embedded
// Plant Master panel above it, which DUPLICATES a standalone screen and is UA-7's
// problem. Adding a nav item for a list that is empty almost all the time would
// be the worse trade.
//
// Deliberately collapsed by default and loaded only on expand: the route reads
// the whole authentication account listing, and that is not work to do on every
// visit to Users.
//
// Nothing here touches a credential. Adoption attaches an application identity
// to an account that already has its own password; no password, token or
// session value is read, set, displayed or logged on this path.
// ═══════════════════════════════════════════════════════════════════════════
import { useState } from "react";
import { C, mono, sans } from "../theme.js";
import { apiFetch } from "../lib/apiClient.js";
import { classifyResponse } from "../lib/backendError.js";
import { AccessDeniedState, EmptyState, LoadingState } from "./appStates.jsx";
import {
  adoptBody, adoptionBlockedReason, adoptionSuccessMessage,
  confirmAdoption, formatOrphanDate, orphanExplainer, orphanNote, orphanViews,
} from "../lib/authOrphanActions.js";
import { INITIAL_ACCESS_PRESETS, initialAccessNote, initialAccessSeeds }
  from "../lib/userAccessActions.js";

const btn = (variant) => ({
  padding: "5px 10px", borderRadius: 5, fontSize: 11, fontWeight: 600,
  cursor: "pointer", fontFamily: sans,
  border: variant === "outline" ? `1px solid ${C.border}` : "none",
  background: variant === "outline" ? C.white : C.amber,
  color: variant === "outline" ? C.slateM : C.white,
});

const input = {
  padding: "6px 8px", border: `1px solid ${C.border}`, borderRadius: 5,
  fontSize: 12, fontFamily: sans,
};

function AdoptForm({ view, plants, busy, onAdopt }) {
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState("maker");
  const [codes, setCodes] = useState([]);

  const active = plants.filter(p => p.status === "active");
  const blocked = !displayName.trim()
    ? "Give this account a display name."
    : adoptionBlockedReason(role, codes);

  const toggle = (code) => setCodes(c =>
    c.includes(code) ? c.filter(x => x !== code) : [...c, code]);

  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 8 }}>
      <input value={displayName} onChange={e => setDisplayName(e.target.value)}
        placeholder="Display name" style={{ ...input, width: 180 }} />
      {/* A starting preset, exactly as on creation - not a role, and not the
          authority. The capability editor owns permissions afterwards. */}
      <label style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, color: C.slateM }}>
        Initial access
        <select value={role} onChange={e => setRole(e.target.value)} style={input}>
          {INITIAL_ACCESS_PRESETS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
      </label>
      {active.map(p => (
        <label key={p.plant_code} title={p.name}
          style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11, color: C.slateM }}>
          <input type="checkbox" checked={codes.includes(p.plant_code)}
            onChange={() => toggle(p.plant_code)} />
          {p.plant_code}
        </label>
      ))}
      <button disabled={busy || !!blocked} style={{ ...btn("primary"), opacity: blocked ? 0.45 : 1,
          cursor: blocked ? "not-allowed" : "pointer" }}
        onClick={() => onAdopt(view, displayName.trim(), role, codes)}>
        {busy ? "Adopting…" : "Adopt account"}
      </button>
      {blocked && <span style={{ fontSize: 10.5, color: C.slateL }}>{blocked}</span>}
      <div style={{ flexBasis: "100%", fontSize: 10, color: C.slateL }}>
        Grants {initialAccessSeeds(role)}. {initialAccessNote()}
      </div>
    </div>
  );
}

export default function AuthOrphansPanel({ plants, onAdopted, showToast }) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState("idle");  // idle|loading|ok|denied|error
  const [error, setError] = useState("");
  const [views, setViews] = useState([]);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setState("loading");
    let resp, data;
    try {
      resp = await apiFetch("/admin/auth-orphans");
      data = await resp.json().catch(() => ({}));
    } catch {
      setState("error");
      setError("Could not reach the server.");
      return;
    }
    const outcome = classifyResponse({ ok: resp.ok, status: resp.status, data });
    if (outcome.kind === "ok") {
      setViews(orphanViews(data.orphans));
      setState("ok");
      setError("");
    } else if (outcome.kind === "access-denied") {
      setState("denied");
    } else {
      setState("error");
      setError(outcome.message || "Could not read the authentication accounts.");
    }
  };

  // Re-read on EVERY expand, not only the first. An administrator who expands
  // this, fixes something, collapses it and expands it again must not be shown
  // the answer from before the fix - a recovery list that can be stale is worse
  // than one that costs a request.
  const expand = () => {
    const next = !open;
    setOpen(next);
    if (next) load();
  };

  const adopt = async (view, displayName, role, codes) => {
    if (!window.confirm(confirmAdoption(view, displayName, role, codes))) return;
    setBusy(true);
    let resp, data;
    try {
      resp = await apiFetch("/admin/users/adopt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(adoptBody(view.email, displayName, role, codes)),
      });
      data = await resp.json().catch(() => ({}));
    } catch {
      setBusy(false);
      showToast("❌ Network error — could not reach the server. Nothing was changed.", "error", 8000);
      return;
    }
    setBusy(false);
    const outcome = classifyResponse({ ok: resp.ok, status: resp.status, data });
    if (outcome.kind === "ok") {
      showToast("✅ " + adoptionSuccessMessage(view, displayName), "success", 8000);
      await load();          // the adopted account is no longer an orphan
      onAdopted();           // and is now a row in the Users list
      return;
    }
    if (outcome.kind === "access-denied") {
      showToast("🚫 " + (outcome.message || "You do not have permission to adopt an account."),
                "error", 8000);
      return;
    }
    // An adoption that timed out may already have committed — say so rather
    // than inviting a second attempt that would fail on the unique constraint.
    showToast((outcome.outcomeUnknown ? "⚠️ " : "❌ ")
      + (outcome.message || "That account could not be adopted."),
      "error", outcome.outcomeUnknown ? 12000 : 8000);
    if (outcome.outcomeUnknown) load();
  };

  return (
    <div style={{ marginBottom: 12, background: C.white, border: `1px solid ${C.border}`, borderRadius: 7 }}>
      <button type="button" onClick={expand}
        style={{ ...btn("outline"), width: "100%", textAlign: "left", borderRadius: 7,
                 border: "none", background: "transparent", padding: "9px 12px" }}>
        {open ? "▾" : "▸"} Unattached sign-in accounts
        {state === "ok" && ` — ${views.length}`}
      </button>

      {open && (
        <div style={{ padding: "0 12px 12px" }}>
          <div style={{ fontSize: 11, color: C.slateM, marginBottom: 10, maxWidth: 780 }}>
            {orphanExplainer()}
          </div>

          {state === "loading" && <LoadingState label="Checking the authentication accounts…" />}

          {state === "denied" && (
            <AccessDeniedState reason="Reading the authentication accounts needs the administer_users capability, which your account does not hold." />
          )}

          {state === "error" && (
            <div style={{ fontSize: 12, color: C.red, marginBottom: 8 }}>
              {error} Nothing has been changed.{" "}
              <button onClick={load} style={btn("outline")}>Try again</button>
            </div>
          )}

          {state === "ok" && (
            <div style={{ marginBottom: 8 }}>
              <button onClick={load} disabled={busy} style={btn("outline")}>Refresh</button>
            </div>
          )}

          {state === "ok" && views.length === 0 && (
            <EmptyState title="No unattached accounts"
              hint="Every sign-in account has an application user. Nothing to recover." />
          )}

          {state === "ok" && views.length > 0 && (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ color: C.slateM }}>
                  {["Reference", "Address", "Created", "Last sign-in", "Recover"].map(h => (
                    <th key={h} style={{ padding: "4px 8px", textAlign: "left", fontSize: 10,
                                         fontWeight: 700, textTransform: "uppercase" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {views.map(v => (
                  <tr key={v.ref} style={{ borderTop: `1px solid ${C.border}`, verticalAlign: "top" }}>
                    <td style={{ padding: "6px 8px", fontFamily: mono, fontSize: 11, color: C.slateM }}>{v.ref}</td>
                    <td style={{ padding: "6px 8px", fontFamily: mono, fontSize: 11, color: C.slate }}>{v.email}</td>
                    <td style={{ padding: "6px 8px", fontSize: 10, color: C.slateL, fontFamily: mono }}>
                      {formatOrphanDate(v.createdAt)}
                    </td>
                    <td style={{ padding: "6px 8px", fontSize: 10, color: C.slateL, fontFamily: mono }}>
                      {formatOrphanDate(v.lastSignInAt)}
                    </td>
                    <td style={{ padding: "6px 8px" }}>
                      <div style={{ fontSize: 10.5, color: C.slateL }}>{orphanNote(v)}</div>
                      <AdoptForm view={v} plants={plants} busy={busy} onAdopt={adopt} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
