// ═══════════════════════════════════════════════════════════════════════════
// src/tabs/UserManagementTab.jsx — Users/Access (UA-1 + UA-4).
//
// The capability set is the authority. `role` is a DERIVED, READ-ONLY label:
// an editable role could express only administer_users plus one operational
// capability per plant, so using it to build a desired set would silently
// revoke the nine capabilities it cannot represent. The backend PATCH branch
// that did that is gone, and this screen no longer offers it.
//
// Every capability change is ONE governed call to
// POST /admin/users/<id>/capabilities carrying expected_content_version. A 409
// reloads that user and explains that permissions changed elsewhere — never a
// silent retry, because re-sending an unchanged desired set can only fail again.
//
// UA-5. The status change is the same discipline on the other operation: it
// carries expected_content_version too, confirms before deactivating, says what
// deactivation actually does to the person and to their records, and explains
// the last-active-administrator refusal instead of reporting "transition not
// allowed". A 409 here means somebody else changed that user while this list
// was open — it reloads and asks rather than retrying.
//
// ── SCREEN SPACE ──────────────────────────────────────────────────────────
// ONE toolbar: search, the Add user form and the unattached-account recovery
// list in disclosures, and the count. Rows are 26px with the name frozen; the
// account actions, last sign-in, the inactive consequence and the permission
// editor are one row disclosure away. No control was added and none gained
// reach: the screen still mounts only for `administer_users` (QuotationApp),
// every route still re-checks it, and every confirm, compare-and-set version
// and last-administrator refusal above is unchanged. Only containers moved.
// ═══════════════════════════════════════════════════════════════════════════
import { useState, useEffect } from "react";
import { C, T, mono, sans } from "../theme.js";
import { apiFetch } from "../lib/apiClient.js";
import { classifyResponse } from "../lib/backendError.js";
import { useAuth } from "../AuthContext.jsx";
import CapabilityMatrix from "../ui/CapabilityMatrix.jsx";
import AuthOrphansPanel from "../ui/AuthOrphansPanel.jsx";
import { AccessDeniedState, EmptyState, LoadingState } from "../ui/appStates.jsx";
import { ProvenanceTag } from "../ui/dataDisplay.jsx";
import { PanelFocusToggle, RowDisclosure, ScreenFooter, ToolbarLabel } from "../ui/screenChrome.jsx";
import {
  control, denseCell, denseHead, denseTable, frozenCell, menuPanel, menuSummary, toolbar, usePanelFocus,
} from "../ui/screenStandards.js";
import {
  INITIAL_ACCESS_PRESETS, confirmCapabilityChange, confirmDeactivation, confirmReactivation,
  deactivatesLastAdministrator, deactivationConsequence, deriveRoleLabel,
  initialAccessNote, initialAccessSeeds,
  lastAdministratorDeactivationMessage, lastAdministratorMessage,
  refusalReason, removesLastAdministrator, sameCapabilityState, setCapabilitiesBody,
  setStatusBody, staleCapabilityMessage, staleStatusMessage, statusChangeSummary,
} from "../lib/userAccessActions.js";

const btnStyle = (variant) => ({
  padding: "5px 10px", borderRadius: 5, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: sans,
  border: variant === "outline" ? `1px solid ${C.border}` : "none",
  background: variant === "danger" ? C.red : variant === "outline" ? C.white : C.amber,
  color: variant === "outline" ? C.slateM : C.white,
});

const inputStyle = { padding: "6px 8px", border: `1px solid ${C.border}`, borderRadius: 5, fontSize: 12, fontFamily: sans };

// Plant assignment is a selection from the Plant Master, never typed. The old
// free-text field let an administrator invent a plant that does not exist and
// silently grant nothing; the database now refuses that outright (the
// pgrant_active_plant_only trigger), so offering a text box would only produce
// errors the user cannot act on.
function PlantPicker({ plants, selected, disabled, onChange }) {
  const active = plants.filter(p => p.status === "active");
  const toggle = (code) => {
    const next = selected.includes(code)
      ? selected.filter(c => c !== code)
      : [...selected, code];
    onChange(next);
  };
  if (!active.length) return <span style={{ fontSize: 11, color: C.slateL }}>No active plants</span>;
  return (
    <span style={{ display: "inline-flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      {active.map(p => (
        <label key={p.plant_code} title={p.name}
          style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11, color: C.slateM, cursor: disabled ? "default" : "pointer" }}>
          <input type="checkbox" disabled={disabled} checked={selected.includes(p.plant_code)}
            onChange={() => toggle(p.plant_code)} />
          {p.plant_code}
        </label>
      ))}
    </span>
  );
}

// Shown after creating a user or resetting a password — stays on screen until
// explicitly closed (no toast, no timeout) since this is the only time the
// password is ever visible. Losing it here means the account is locked out.
function CredentialModal({ displayName, email, password, onClose }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
    } catch {
      // clipboard API unavailable — the password is still selectable text below
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(28,43,58,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10000 }}>
      <div style={{ width: 360, background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, padding: 24, boxShadow: "0 8px 32px rgba(0,0,0,.2)", fontFamily: sans }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.slate, marginBottom: 4 }}>Temporary password set</div>
        <div style={{ fontSize: 11, color: C.slateM, marginBottom: 10 }}>
          For <strong>{displayName}</strong> ({email}). Share this with them now — it will not be shown again.
        </div>
        {/* Product Owner decision, 2026-09-08: this workflow is provisional for
            private development and must be replaced by a secure invitation/reset
            flow before the application is shared with anyone. Saying so here is
            part of the decision, not decoration. */}
        <div style={{ fontSize: 10.5, color: C.amberD, background: "#FEF8F0",
          border: `1px solid ${C.amber}`, borderRadius: 5, padding: "6px 8px", marginBottom: 14 }}>
          Temporary development mechanism. Passwords set this way are shown once and are not
          logged or stored anywhere else. A secure invitation and reset flow replaces this
          before the application is shared with any other user.
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", background: C.cream, border: `1px solid ${C.border}`, borderRadius: 6, marginBottom: 14 }}>
          <span style={{ flex: 1, fontFamily: mono, fontSize: 14, fontWeight: 700, color: C.slate, userSelect: "all", wordBreak: "break-all" }}>{password}</span>
          <button type="button" onClick={copy} style={btnStyle("outline")}>{copied ? "Copied ✓" : "Copy"}</button>
        </div>
        <button type="button" onClick={onClose} style={{ width: "100%", padding: "9px 0", borderRadius: 6, border: "none", background: C.amber, color: C.white, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: sans }}>
          I&apos;ve saved this — Close
        </button>
      </div>
    </div>
  );
}

// An administrator changing someone else's login email must say why. The reason
// is recorded in the audit trail; the addresses themselves are not.
function EmailChangeModal({ user, onDone, onClose, showToast }) {
  const [newEmail, setNewEmail] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      const resp = await apiFetch(`/admin/users/${user.id}/email`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ new_email: newEmail.trim(), reason: reason.trim() }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Could not change the email");
      showToast(
        data.pending_verification
          ? "✅ Email updated — the new address still needs confirming. Sessions revoked."
          : `✅ Email updated. ${data.sessions_revoked || 0} session(s) revoked.`,
        "success", 8000);
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(28,43,58,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10000 }}>
      <form onSubmit={submit} style={{ width: 380, background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, padding: 24, boxShadow: "0 8px 32px rgba(0,0,0,.2)", fontFamily: sans }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.slate, marginBottom: 4 }}>Change login email</div>
        <div style={{ fontSize: 11, color: C.slateM, marginBottom: 14 }}>
          For <strong>{user.display_name}</strong>. Their identity, history, plants and
          capabilities are unchanged. Their existing sessions will be revoked.
        </div>
        <input required type="email" placeholder="New email address" value={newEmail}
          onChange={e => setNewEmail(e.target.value)} style={{ ...inputStyle, width: "100%", marginBottom: 8 }} />
        <input required placeholder="Reason (recorded in the audit trail)" value={reason}
          onChange={e => setReason(e.target.value)} style={{ ...inputStyle, width: "100%", marginBottom: 12 }} />
        {error && <div style={{ color: C.red, fontSize: 11, marginBottom: 10 }}>{error}</div>}
        <div style={{ display: "flex", gap: 8 }}>
          <button type="submit" disabled={busy} style={{ ...btnStyle("primary"), flex: 1 }}>{busy ? "Changing…" : "Change email"}</button>
          <button type="button" onClick={onClose} style={btnStyle("outline")}>Cancel</button>
        </div>
      </form>
    </div>
  );
}

function NewUserForm({ plants, onCreated, showToast }) {
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState("maker");
  const [selectedPlants, setSelectedPlants] = useState([]);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const resp = await apiFetch("/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(), display_name: displayName.trim(), role,
          plants: selectedPlants,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Could not create user");
      setEmail(""); setDisplayName(""); setRole("maker"); setSelectedPlants([]);
      onCreated(data);
    } catch (err) {
      showToast("❌ " + err.message, "error", 8000);
    } finally {
      setBusy(false);
    }
  };

  // A Maker or Checker with no plant can sign in and do nothing. Said here as
  // well as enforced by the backend, so the rule is visible before submitting.
  const needsPlant = (role === "maker" || role === "checker") && selectedPlants.length === 0;

  return (
    <form onSubmit={submit} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <input required type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} style={{ ...inputStyle, width: 200 }} />
      <input required placeholder="Display name" value={displayName} onChange={e => setDisplayName(e.target.value)} style={{ ...inputStyle, width: 140 }} />
      {/* Labelled as a PRESET, never as a role. The capability matrix is the
          authority; this only decides what the new account starts with. */}
      <label style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, color: C.slateM }}>
        Initial access
        <select value={role} onChange={e => setRole(e.target.value)} style={inputStyle}>
          {INITIAL_ACCESS_PRESETS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
      </label>
      <PlantPicker plants={plants} selected={selectedPlants} onChange={setSelectedPlants} />
      <button type="submit" disabled={busy || needsPlant} style={btnStyle("primary")}>{busy ? "Creating…" : "+ Add User"}</button>
      {needsPlant && <span style={{ fontSize: 11, color: C.red }}>A {role} needs at least one plant</span>}
      <div style={{ flexBasis: "100%", fontSize: T.label, color: C.slateL, marginTop: 2 }}>
        Grants {initialAccessSeeds(role)}. {initialAccessNote()}
      </div>
    </form>
  );
}

// One place that turns a classifyResponse outcome into words, so the four
// distinct outcomes never collapse into a generic failure. `reason` lets a
// caller supply a business explanation the public error code cannot carry.
function feedback(outcome, reason) {
  const prefix = outcome.kind === "access-denied" ? "🚫"
    : outcome.kind === "stale" ? "⏱"
    : outcome.outcomeUnknown ? "⚠️" : "❌";
  const fallback = outcome.kind === "stale"
    ? "This changed since you loaded it — reload and try again."
    : outcome.outcomeUnknown
      ? "The outcome of this action is unknown — refresh to see the current state before trying again."
      : "That action could not be completed.";
  return `${prefix} ${reason || outcome.message || fallback}`;
}

function UserRow({ user, plants, isSelf, activeAdminIds, onChanged, onCredential,
                  onChangeEmail, showToast }) {
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(null);   // { group, plant } | null

  const current = {
    group: user.group_capabilities || [],
    plant: user.plant_capabilities || {},
  };
  const edited = draft || current;
  const unchanged = sameCapabilityState(current, edited);
  const wouldStrandAdmins = removesLastAdministrator(user, edited.group, activeAdminIds);
  const wouldStrandByDeactivating = deactivatesLastAdministrator(user, activeAdminIds);

  // display_name / active only. Capability changes never come through here.
  const patch = async (body) => {
    setBusy(true);
    let resp, data;
    try {
      resp = await apiFetch(`/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      data = await resp.json().catch(() => ({}));
    } catch {
      setBusy(false);
      showToast("❌ Network error — could not reach the server. Nothing was changed.", "error", 8000);
      return;
    }
    setBusy(false);
    const outcome = classifyResponse({ ok: resp.ok, status: resp.status, data });
    const changingStatus = "active" in body;
    if (outcome.kind === "ok") {
      if (changingStatus) {
        showToast(data.active
          ? `✅ "${user.display_name}" can sign in again.`
          : `✅ "${user.display_name}" is deactivated and can no longer sign in. Their records are unchanged.`,
          "success", 7000);
      }
      onChanged();
      return;
    }
    if (outcome.kind === "stale") {
      // Someone else changed this user while the list was open. Reload and let
      // the operator re-decide; retrying the same version can only fail again.
      showToast("⏱ " + staleStatusMessage(user.display_name), "error", 12000);
      onChanged();
      return;
    }
    // The database refuses the last active administrator with the broad public
    // code TRANSITION_NOT_ALLOWED. The code stays as it is; the reason is
    // supplied here, because "transition not allowed" tells nobody what to do.
    showToast(feedback(outcome, refusalReason(outcome, {
                deactivatingLastAdministrator: body.active === false && wouldStrandByDeactivating })),
              "error", outcome.outcomeUnknown ? 12000 : 8000);
  };

  // UA-5 — confirmed, versioned, and refused up front when it would strand the
  // administrators. The database enforces the invariant regardless; this only
  // means the operator is told BEFORE the request instead of after it.
  const changeStatus = async () => {
    if (user.active) {
      if (wouldStrandByDeactivating) {
        showToast("🚫 " + lastAdministratorDeactivationMessage(), "error", 10000);
        return;
      }
      if (!window.confirm(confirmDeactivation(user.display_name))) return;
    } else if (!window.confirm(confirmReactivation(user.display_name))) {
      return;
    }
    await patch(setStatusBody(user.content_version, !user.active));
  };

  // UA-4 — the ONE governed capability write. Complete replacement, versioned.
  const saveCapabilities = async () => {
    if (unchanged) return;
    if (wouldStrandAdmins) { showToast("🚫 " + lastAdministratorMessage(), "error", 10000); return; }
    if (!window.confirm(confirmCapabilityChange(user.display_name, current, edited))) return;
    setBusy(true);
    let resp, data;
    try {
      resp = await apiFetch(`/admin/users/${user.id}/capabilities`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(setCapabilitiesBody(user.content_version, edited.group, edited.plant)),
      });
      data = await resp.json().catch(() => ({}));
    } catch {
      setBusy(false);
      showToast("❌ Network error — could not reach the server.", "error", 8000);
      return;
    }
    setBusy(false);
    const outcome = classifyResponse({ ok: resp.ok, status: resp.status, data });
    if (outcome.kind === "ok") {
      setDraft(null);
      showToast(data.changed === false
        ? `No change — "${user.display_name}" already had exactly these permissions.`
        : `✅ Permissions updated for "${user.display_name}".`, "success", 6000);
      onChanged();
      return;
    }
    if (outcome.kind === "stale") {
      // Reload and re-decide. Never a silent retry: an unchanged desired set
      // can only fail again, which is why this is PT409 and not 40001.
      setDraft(null);
      showToast("⏱ " + staleCapabilityMessage(user.display_name), "error", 12000);
      onChanged();
      return;
    }
    showToast(feedback(outcome, refusalReason(outcome,
                { removingLastAdministrator: wouldStrandAdmins })),
              "error", outcome.outcomeUnknown ? 12000 : 8000);
  };

  const resetPassword = async () => {
    setBusy(true);
    try {
      const resp = await apiFetch(`/admin/users/${user.id}/reset-password`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data.error || "Reset failed");
      onCredential({ display_name: user.display_name, email: user.email, temp_password: data.temp_password });
    } catch (err) {
      showToast("❌ " + err.message, "error", 8000);
    } finally {
      setBusy(false);
    }
  };

  const roleLabel = deriveRoleLabel(user.group_capabilities, user.plant_capabilities);
  const plantCodes = Object.keys(user.plant_capabilities || {}).sort();

  const lastSignIn = user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : "never";
  const background = open ? "#FEF3E8" : C.white;

  // One 26px row. Last sign-in, the inactive consequence, the account actions
  // and the permission editor are one row disclosure away, so a row is never
  // made taller by a second line or a wrapped button group.
  return (
    <>
      <tr style={{ height: 26, background, opacity: busy ? 0.5 : 1 }}>
        <td style={{ ...frozenCell(open), fontWeight: 600, color: C.slate }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            <RowDisclosure open={open} onToggle={() => setOpen(o => !o)}
              label={`Permissions and account actions for ${user.display_name}`} />
            {user.display_name}{isSelf && <span style={{ color: C.slateL, fontWeight: 400 }}> (you)</span>}
          </span>
        </td>
        <td style={{ ...denseCell, color: C.slateM, fontFamily: mono }} title={user.email}>{user.email}</td>
        {/* Derived, read-only. The capability set below is the authority. */}
        <td style={{ ...denseCell, color: C.slateM }}
            title="Derived from this user's capabilities. Not editable — permissions are the authority.">
          {roleLabel}
        </td>
        <td style={{ ...denseCell, color: C.slateM, fontFamily: mono }}>
          {plantCodes.length ? plantCodes.join(", ") : <span style={{ color: C.slateL }}>none</span>}
        </td>
        <td style={{ ...denseCell, color: C.slateL, fontFamily: mono }}>{lastSignIn}</td>
        <td style={denseCell} title={user.active ? undefined : "Cannot sign in. Records kept. Deactivation blocks access; it deletes nothing."}>
          <span style={{ fontWeight: 700, color: user.active ? C.green : C.red }}>{user.active ? "● Active" : "○ Inactive"}</span>
        </td>
      </tr>
      {open && (
        <tr style={{ background: "#FBF8F3" }}>
          <td colSpan={6} style={{ ...denseCell, whiteSpace: "normal", maxWidth: "none", padding: "8px 12px 10px 26px" }}>
            <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
              <ToolbarLabel>Account</ToolbarLabel>
              <button type="button" disabled={busy} onClick={() => onChangeEmail(user)} style={btnStyle("outline")}>Change email</button>
              <button type="button" disabled={busy} onClick={resetPassword} style={btnStyle("outline")}>Reset password</button>
              <button type="button" disabled={busy || isSelf} onClick={changeStatus}
                title={isSelf ? "You cannot deactivate your own account."
                              : user.active ? deactivationConsequence()
                                            : "They will be able to sign in again with the permissions they hold now."}
                style={btnStyle(statusChangeSummary(user).danger ? "danger" : "outline")}>
                {statusChangeSummary(user).verb}
              </button>
              {isSelf && <span style={{ fontSize: T.label, color: C.slateL }}>You cannot deactivate your own account.</span>}
              {!user.active && <span style={{ fontSize: T.label, color: C.slateL }}>Cannot sign in. Records kept.</span>}
              <span style={{ fontSize: T.label, color: C.slateL }}>Last sign-in {lastSignIn}</span>
            </div>
            <CapabilityMatrix groupKeys={edited.group} plantMap={edited.plant}
              plants={plants} editable onChange={setDraft} />
            {wouldStrandAdmins && (
              <div style={{ marginTop: 8, fontSize: T.body, color: C.red }}>
                🚫 {lastAdministratorMessage()}
              </div>
            )}
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10 }}>
              <button type="button" disabled={busy || unchanged || wouldStrandAdmins} onClick={saveCapabilities}
                style={{ ...btnStyle("primary"), opacity: (unchanged || wouldStrandAdmins) ? 0.45 : 1,
                  cursor: (unchanged || wouldStrandAdmins) ? "not-allowed" : "pointer" }}>
                {busy ? "Saving…" : "Save permissions"}
              </button>
              <button type="button" disabled={busy || unchanged} onClick={() => setDraft(null)} style={btnStyle("outline")}>
                Discard changes
              </button>
              <span style={{ fontSize: T.label, color: C.slateL }}>
                {unchanged
                  ? "No changes to apply."
                  : "Saving replaces this user's complete permission set in one governed operation."}
              </span>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function UserManagementTab({ showToast }) {
  const { profile, isActive } = useAuth();
  const [users, setUsers] = useState(null);
  const [plants, setPlants] = useState([]);
  const [status, setStatus] = useState("loading"); // loading|ok|denied|error
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [credential, setCredential] = useState(null); // {display_name, email, temp_password} | null
  const [emailTarget, setEmailTarget] = useState(null);
  const [orphansOpen, setOrphansOpen] = useState(false);
  const { focusPanel, toggleFocus, exitFocusOnEscape } = usePanelFocus();

  const load = async () => {
    let resp, data;
    try {
      resp = await apiFetch("/admin/users");
      data = await resp.json().catch(() => ({}));
    } catch {
      setStatus("error");
      setError("Could not reach the server.");
      return;
    }
    const outcome = classifyResponse({ ok: resp.ok, status: resp.status, data });
    if (outcome.kind === "ok") {
      setUsers(data.users || []);
      setStatus("ok");
      setError("");
    } else if (outcome.kind === "access-denied") {
      setStatus("denied");
    } else {
      setStatus("error");
      setError(outcome.message || "Could not load users.");
    }
  };

  useEffect(() => {
    // An inactive session never issues the request - the same discipline
    // ProducingPlantsScreen already applies.
    if (!isActive) return;   // an inactive session never issues the request
    let cancelled = false;
    (async () => {
      let uResp, pResp, uData;
      try {
        [uResp, pResp] = await Promise.all([
          apiFetch("/admin/users"),
          apiFetch("/masters/plants"),
        ]);
        uData = await uResp.json().catch(() => ({}));
      } catch {
        if (!cancelled) { setStatus("error"); setError("Could not reach the server."); }
        return;
      }
      if (cancelled) return;
      const outcome = classifyResponse({ ok: uResp.ok, status: uResp.status, data: uData });
      if (outcome.kind === "ok") {
        const pData = pResp.ok ? await pResp.json().catch(() => ({})) : { plants: [] };
        if (!cancelled) { setUsers(uData.users || []); setPlants(pData.plants || []); setStatus("ok"); }
      } else if (outcome.kind === "access-denied") {
        setStatus("denied");
      } else {
        setStatus("error");
        setError(outcome.message || "Could not load users.");
      }
    })();
    return () => { cancelled = true; };
  }, [isActive]);

  const handleCreated = (data) => {
    load();
    if (data.temp_password) setCredential(data);
  };

  // Who currently holds administer_users AND is active. The database enforces
  // the invariant; this lets the UI explain it before the request is sent.
  const activeAdminIds = (users || [])
    .filter(u => u.active && (u.group_capabilities || []).includes("administer_users"))
    .map(u => u.id);

  const q = query.trim().toLowerCase();
  const shown = (users || []).filter(u => !q
    || (u.display_name || "").toLowerCase().includes(q)
    || (u.email || "").toLowerCase().includes(q));

  // Derived, not set inside the effect: an inactive session is a denial, and
  // calling setState synchronously in an effect triggers cascading renders.
  if (!isActive || status === "denied") {
    return (
      <div style={{ padding: 16 }}>
        <AccessDeniedState reason="Managing users needs the administer_users capability, which your account does not hold." />
      </div>
    );
  }
  if (status === "loading") {
    return <div style={{ padding: 16 }}><LoadingState label="Loading users and permissions…" /></div>;
  }

  const activeCount = (users || []).filter(u => u.active).length;
  const countLabel = `${q ? `${shown.length} of ` : ""}${(users || []).length} users · ${activeCount} active`;

  return (
    <div onKeyDown={exitFocusOnEscape} style={{ height: "100%", display: "flex", flexDirection: "column",
      minHeight: 0, background: C.cream, fontFamily: sans }}>
      <div role="toolbar" aria-label="Users and Access controls" style={toolbar}>
        <input type="search" value={query} onChange={e => setQuery(e.target.value)}
          aria-label="Search users by name or email" placeholder="Search by name or email"
          style={{ ...control, width: 240 }} />
        <details style={{ position: "relative" }}>
          <summary style={menuSummary(false)}>+ Add user ▾</summary>
          <div style={{ ...menuPanel, minWidth: 420 }}>
            <NewUserForm plants={plants} onCreated={handleCreated} showToast={showToast} />
          </div>
        </details>
        <details style={{ position: "relative" }} onToggle={e => setOrphansOpen(e.currentTarget.open)}>
          <summary style={menuSummary(orphansOpen)}
            title="Sign-in accounts with no application user. Read afresh every time this opens.">
            Unattached accounts ▾</summary>
          <div style={{ ...menuPanel, minWidth: 720, maxHeight: "65vh", overflow: "auto" }}>
            {/* Mounted only while open, so every open re-reads the listing. */}
            {orphansOpen && <AuthOrphansPanel embedded plants={plants} onAdopted={load} showToast={showToast} />}
          </div>
        </details>
        <span style={{ flex: "1 1 auto" }} />
        <span style={{ fontSize: T.label, color: C.slateL, whiteSpace: "nowrap" }}>{countLabel}</span>
        <PanelFocusToggle panel="list" noun="user list" focused={focusPanel === "list"} onToggle={toggleFocus} />
      </div>
      {status === "error" && (
        <div role="alert" style={{ flexShrink: 0, color: C.red, fontSize: T.body, padding: "5px 10px",
          background: C.redL, borderBottom: `1px solid ${C.border}` }}>
          {error} Nothing has been changed.
        </div>
      )}
      <div style={{ flex: 1, minHeight: 0, overflow: "auto", background: C.white }}>
        {status === "ok" && shown.length === 0 && (
          <EmptyState title={q ? "No user matches that search" : "No users yet"}
            hint={q ? "Clear the search to see everyone." : undefined} />
        )}
        {status === "ok" && shown.length > 0 && (
          <table style={denseTable}>
            <thead>
              <tr>
                <th scope="col" style={{ ...denseHead, ...frozenCell(false, true) }}>Name</th>
                {["Email", "Role (derived)", "Plants", "Last sign-in", "Status"].map(h => (
                  <th key={h} scope="col" style={denseHead}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map(u => (
                <UserRow key={u.id} user={u} plants={plants} isSelf={u.id === profile?.id}
                  activeAdminIds={activeAdminIds}
                  onChanged={load} onCredential={setCredential} onChangeEmail={setEmailTarget}
                  showToast={showToast} />
              ))}
            </tbody>
          </table>
        )}
      </div>
      <ScreenFooter right="Every change is one versioned, governed operation">
        <ProvenanceTag kind="governed" />
        <span title="Screens and routes gate on capabilities. The role column is a derived presentation label and is never sent anywhere.">
          Capabilities are the authority · Role is a derived label</span>
      </ScreenFooter>
      {credential && (
        <CredentialModal
          displayName={credential.display_name}
          email={credential.email}
          password={credential.temp_password}
          onClose={() => setCredential(null)}
        />
      )}
      {emailTarget && (
        <EmailChangeModal
          user={emailTarget}
          showToast={showToast}
          onDone={() => { setEmailTarget(null); load(); }}
          onClose={() => setEmailTarget(null)}
        />
      )}
    </div>
  );
}
