// ═══════════════════════════════════════════════════════════════════════════
// src/tabs/CustomerFamiliesScreen.jsx — Customer Family list, detail, and the
// U1 Customer Family mutation actions.
//
// U1 (post-S7 handover S9.4), extended for the Customer Family mutation slice
// (docs/u1-customer-family-mutations-packet.md). Every action below is a
// single Flask request to a governed /masters/customer-families* route,
// which forwards to a public.* invoker wrapper over an app_private CAS-
// protected operation — this screen never calls a Postgres RPC or runs
// mutation SQL directly (binding decision: backend-only writes). Request
// bodies and confirm-dialog copy are built by the pure helpers in
// lib/customerFamilyActions.js, proven by
// scripts/customer-family-actions-fixtures.mjs.
//
// Scope: propose/edit/approve a Family; add/edit/retire an alias; merge;
// reassign with effective dating; graduate a Prospect — the nine required
// mutation actions, all on this existing screen's rows. No new screen, no
// broader Customer/Prospect mutation UI (out of scope, per the standing
// instruction).
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../AuthContext.jsx";
import { apiFetch } from "../lib/apiClient.js";
import { classifyResponse } from "../lib/backendError.js";
import {
  proposeFamilyBody, createProspectBody, updateFamilyNameBody, approveFamilyBody,
  addAliasBody, updateAliasBody, retireAliasBody, mergeBody, reassignBody, graduateBody,
  mergeConfirmMessage, reassignConfirmMessage, graduateConfirmMessage, retireAliasConfirmMessage,
  effectiveDatePrecedesMembership,
} from "../lib/customerFamilyActions.js";
import { AccessDeniedState, EmptyState, LoadingState } from "../ui/appStates.jsx";
import { LifecycleBadge, PermanentCode, VersionHistory } from "../ui/dataDisplay.jsx";
import CapabilityGate from "../ui/CapabilityGate.jsx";
import { Btn, Inp, Sel } from "../ui/primitives.jsx";
import { inputSt } from "../ui/styles.js";
import { C, mono, sans } from "../theme.js";

const MANAGE = "manage_customer_master";
const CREATE_CAPS = [MANAGE, "make_quote"]; // mirrors the DB's own OR condition (propose / prospect)

async function runMutation(path, body, { method = "POST", showToast, successMessage } = {}) {
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
  const prefix = outcome.kind === "access-denied" ? "🚫" : outcome.kind === "stale" ? "⏱" : "❌";
  const fallback = outcome.kind === "stale"
    ? "This record changed since you loaded it — reload and try again."
    : "That action could not be completed.";
  showToast?.(`${prefix} ${outcome.message || fallback}`, "error", 8000);
  return null;
}

const overlaySt = { position: "fixed", inset: 0, background: "rgba(28,43,58,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10000 };
const cardSt = { width: 380, background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, padding: 22, boxShadow: "0 8px 32px rgba(0,0,0,.2)", fontFamily: sans };
const labelSt = { fontSize: 10, fontWeight: 700, color: C.slateM, textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 4, marginTop: 10 };

export default function CustomerFamiliesScreen({ showToast }) {
  const { isActive, profile } = useAuth();
  const [state, setState] = useState({ status: "loading", families: [], aliases: [], memberships: [], parties: [] });
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [modal, setModal] = useState(null); // { kind, ...payload } | null

  const load = async (selectAfter) => {
    let resp, data;
    try {
      resp = await apiFetch("/masters/customer-families");
      data = await resp.json().catch(() => ({}));
    } catch {
      setState(s => ({ ...s, status: "error" }));
      return;
    }
    const outcome = classifyResponse({ ok: resp.ok, status: resp.status, data });
    if (outcome.kind === "ok") {
      setState({
        status: "ok",
        families: data.families || [],
        aliases: data.aliases || [],
        memberships: data.memberships || [],
        parties: data.parties || [],
      });
      if (selectAfter !== undefined) setSelectedId(selectAfter);
    } else if (outcome.kind === "access-denied") {
      setState(s => ({ ...s, status: "denied" }));
    } else {
      setState(s => ({ ...s, status: "error" }));
    }
  };

  useEffect(() => {
    if (!isActive) return;
    let cancelled = false;
    (async () => {
      if (!cancelled) await load();
    })();
    return () => { cancelled = true; };
  }, [isActive]);

  const filtered = useMemo(() => {
    return state.families.filter(f => {
      if (statusFilter && f.status !== statusFilter) return false;
      if (!query.trim()) return true;
      const q = query.trim().toLowerCase();
      return (f.name || "").toLowerCase().includes(q)
        || (f.group_customer_code || "").toLowerCase().includes(q);
    });
  }, [state.families, query, statusFilter]);

  const selected = filtered.find(f => f.id === selectedId) || filtered[0] || null;

  if (!isActive) return <AccessDeniedState reason="Your account is deactivated." />;
  if (state.status === "loading") return <LoadingState label="Loading Customer Families…" />;
  if (state.status === "denied") return <AccessDeniedState reason="You do not have access to Customer Families (requires read_party_master)." />;
  if (state.status === "error") return <AccessDeniedState reason="Customer Families could not be loaded." />;

  return (
    <div style={{ display: "flex", height: "100%", fontFamily: sans }}>
      <div style={{ width: 320, borderRight: `1px solid ${C.border}`, padding: 16, overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.slate }}>Customer Families</div>
        </div>
        <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
          <CapabilityGate profile={profile} capability={CREATE_CAPS}>
            <Btn ch="+ Family" sm v="secondary" onClick={() => setModal({ kind: "propose" })} />
          </CapabilityGate>
          <CapabilityGate profile={profile} capability={CREATE_CAPS}>
            <Btn ch="+ Prospect" sm v="secondary" onClick={() => setModal({ kind: "prospect" })} />
          </CapabilityGate>
        </div>
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search name or code…"
          style={{ ...inputSt, marginBottom: 8 }} />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ ...inputSt, marginBottom: 12 }}>
          <option value="">All statuses</option>
          {[...new Set(state.families.map(f => f.status))].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        {!state.families.length && <EmptyState title="No Customer Families" hint="None are recorded yet." />}
        {state.families.length > 0 && !filtered.length && <EmptyState title="No matches" hint="Try a different search or filter." />}
        {filtered.map(f => (
          <div key={f.id} onClick={() => setSelectedId(f.id)}
            style={{
              padding: "8px 10px", borderRadius: 6, marginBottom: 4, cursor: "pointer",
              background: selected?.id === f.id ? C.amberL : "transparent",
            }}>
            <PermanentCode code={f.group_customer_code} />
            <div style={{ fontSize: 12, color: C.slateM, marginTop: 2 }}>{f.name}</div>
            <LifecycleBadge status={f.status} />
          </div>
        ))}
      </div>
      <div style={{ flex: 1, padding: 20, overflowY: "auto" }}>
        {!selected ? (
          <EmptyState title="Select a family" />
        ) : (
          <FamilyDetail key={selected.id} family={selected} aliases={state.aliases} memberships={state.memberships}
            parties={state.parties} families={state.families} profile={profile}
            showToast={showToast} onReload={load} openModal={setModal} />
        )}
      </div>
      {modal?.kind === "propose" && (
        <ProposeFamilyModal showToast={showToast}
          onClose={() => setModal(null)}
          onDone={(id) => { setModal(null); load(id); }} />
      )}
      {modal?.kind === "prospect" && (
        <CreateProspectModal families={state.families} showToast={showToast}
          onClose={() => setModal(null)}
          onDone={(familyId) => { setModal(null); load(familyId); }} />
      )}
      {modal?.kind === "merge" && (
        <MergeModal retiring={modal.family} families={state.families} showToast={showToast}
          onClose={() => setModal(null)}
          onDone={(survivorId) => { setModal(null); load(survivorId); }} />
      )}
      {modal?.kind === "reassign" && (
        <ReassignModal party={modal.party} membership={modal.membership} families={state.families}
          currentFamilyId={modal.currentFamilyId} showToast={showToast}
          onClose={() => setModal(null)}
          onDone={(familyId) => { setModal(null); load(familyId); }} />
      )}
      {modal?.kind === "graduate" && (
        <ConfirmModal message={graduateConfirmMessage(modal.party.display_name)}
          confirmLabel="Graduate" showToast={showToast}
          onClose={() => setModal(null)}
          onConfirm={async () => {
            const data = await runMutation("/masters/customer-families/graduate",
              graduateBody(modal.party.id), { showToast });
            if (data) {
              showToast?.(`✅ Graduated — permanent Customer Code ${data.customer_code}`, "success", 10000);
              setModal(null);
              load(modal.currentFamilyId);
            }
            return !!data;
          }} />
      )}
      {modal?.kind === "retire-alias" && (
        <ConfirmModal message={retireAliasConfirmMessage(modal.alias.alias)}
          confirmLabel="Retire" danger showToast={showToast}
          onClose={() => setModal(null)}
          onConfirm={async () => {
            const data = await runMutation(`/masters/customer-family-aliases/${modal.alias.id}/retire`,
              retireAliasBody(modal.alias.content_version),
              { showToast, successMessage: "Alias retired." });
            if (data !== null) { setModal(null); load(modal.currentFamilyId); }
            return data !== null;
          }} />
      )}
      {modal?.kind === "approve" && (
        <ConfirmModal message={`Approve "${modal.family.name}"? It moves from Proposed to Active.`}
          confirmLabel="Approve" showToast={showToast}
          onClose={() => setModal(null)}
          onConfirm={async () => {
            const data = await runMutation(`/masters/customer-families/${modal.family.id}/approve`,
              approveFamilyBody(modal.family.content_version),
              { showToast, successMessage: `"${modal.family.name}" approved.` });
            if (data !== null) { setModal(null); load(modal.family.id); }
            return data !== null;
          }} />
      )}
    </div>
  );
}

// ── generic one-click confirm — Approve, Retire alias, Graduate ────────────
function ConfirmModal({ message, confirmLabel, danger, onConfirm, onClose }) {
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    const ok = await onConfirm();
    setBusy(false);
    if (!ok) return; // stay open on failure so the message/toast is visible in context
  };
  return (
    <div style={overlaySt}>
      <div style={cardSt}>
        <div style={{ fontSize: 13, color: C.slateM, marginBottom: 16, lineHeight: 1.5 }}>{message}</div>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn ch={busy ? "Working…" : confirmLabel} v={danger ? "danger" : "primary"} full
            disabled={busy} onClick={submit} />
          <Btn ch="Cancel" v="secondary" onClick={onClose} disabled={busy} />
        </div>
      </div>
    </div>
  );
}

function ProposeFamilyModal({ onClose, onDone, showToast }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!name.trim()) return;
    setBusy(true);
    const data = await runMutation("/masters/customer-families", proposeFamilyBody(name),
      { showToast, successMessage: `"${name.trim()}" proposed.` });
    setBusy(false);
    if (data) onDone(data.id);
  };
  return (
    <div style={overlaySt}>
      <div style={cardSt}>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.slate }}>Propose a Family</div>
        <label style={labelSt}>Name</label>
        <Inp value={name} onChange={setName} placeholder="Family name" />
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <Btn ch={busy ? "Proposing…" : "Propose"} full disabled={busy || !name.trim()} onClick={submit} />
          <Btn ch="Cancel" v="secondary" onClick={onClose} disabled={busy} />
        </div>
      </div>
    </div>
  );
}

function CreateProspectModal({ families, onClose, onDone, showToast }) {
  const [displayName, setDisplayName] = useState("");
  const [familyId, setFamilyId] = useState("");
  const [busy, setBusy] = useState(false);
  const options = families.filter(f => f.status !== "retired")
    .map(f => ({ v: f.id, l: `${f.group_customer_code} — ${f.name}` }));
  const submit = async () => {
    if (!displayName.trim()) return;
    setBusy(true);
    const data = await runMutation("/masters/customer-families/prospects",
      createProspectBody(displayName, familyId || null),
      { showToast, successMessage: `"${displayName.trim()}" created.` });
    setBusy(false);
    if (data) onDone(data.family_id);
  };
  return (
    <div style={overlaySt}>
      <div style={cardSt}>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.slate }}>Quick-add a Prospect</div>
        <div style={{ fontSize: 11, color: C.slateL, marginTop: 4 }}>
          Leave the Family blank to silently propose a new one named after the Prospect.
        </div>
        <label style={labelSt}>Display name</label>
        <Inp value={displayName} onChange={setDisplayName} placeholder="Prospect name" />
        <label style={labelSt}>Family (optional)</label>
        <Sel value={familyId} onChange={setFamilyId} opts={options} ph="— propose a new Family —" />
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <Btn ch={busy ? "Creating…" : "Create"} full disabled={busy || !displayName.trim()} onClick={submit} />
          <Btn ch="Cancel" v="secondary" onClick={onClose} disabled={busy} />
        </div>
      </div>
    </div>
  );
}

function MergeModal({ retiring, families, onClose, onDone, showToast }) {
  const [survivorId, setSurvivorId] = useState("");
  const [busy, setBusy] = useState(false);
  const options = families
    .filter(f => f.id !== retiring.id && f.status !== "retired")
    .map(f => ({ v: f.id, l: `${f.group_customer_code} — ${f.name}` }));
  const survivor = families.find(f => f.id === Number(survivorId));
  const submit = async () => {
    if (!survivor) return;
    setBusy(true);
    const data = await runMutation("/masters/customer-families/merge",
      mergeBody(survivor.id, retiring.id, survivor.content_version, retiring.content_version),
      { showToast, successMessage: `"${retiring.name}" merged into "${survivor.name}".` });
    setBusy(false);
    if (data !== null) onDone(survivor.id);
  };
  return (
    <div style={overlaySt}>
      <div style={cardSt}>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.slate }}>Merge "{retiring.name}"</div>
        <label style={labelSt}>Into (survivor)</label>
        <Sel value={survivorId} onChange={setSurvivorId} opts={options} ph="Select the surviving Family…" />
        {survivor && (
          <div style={{ marginTop: 12, fontSize: 12, color: C.red, lineHeight: 1.5 }}>
            {mergeConfirmMessage(survivor.name, retiring.name)}
          </div>
        )}
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <Btn ch={busy ? "Merging…" : "Merge"} v="danger" full disabled={busy || !survivor} onClick={submit} />
          <Btn ch="Cancel" v="secondary" onClick={onClose} disabled={busy} />
        </div>
      </div>
    </div>
  );
}

function ReassignModal({ party, membership, families, currentFamilyId, onClose, onDone, showToast }) {
  const today = new Date().toISOString().slice(0, 10);
  const [newFamilyId, setNewFamilyId] = useState("");
  const [effectiveDate, setEffectiveDate] = useState(today);
  const [busy, setBusy] = useState(false);
  const options = families
    .filter(f => f.id !== currentFamilyId && f.status !== "retired")
    .map(f => ({ v: f.id, l: `${f.group_customer_code} — ${f.name}` }));
  const target = families.find(f => f.id === Number(newFamilyId));
  const currentFamily = families.find(f => f.id === currentFamilyId);
  const tooEarly = effectiveDatePrecedesMembership(effectiveDate, membership?.effective_from);

  const submit = async () => {
    if (!target || tooEarly) return;
    setBusy(true);
    const data = await runMutation("/masters/customer-families/reassign",
      reassignBody(party.id, target.id, party.content_version, effectiveDate),
      { showToast, successMessage: `"${party.display_name}" moved to "${target.name}".` });
    setBusy(false);
    if (data !== null) onDone(target.id);
  };
  return (
    <div style={overlaySt}>
      <div style={cardSt}>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.slate }}>Reassign "{party.display_name}"</div>
        <label style={labelSt}>New Family</label>
        <Sel value={newFamilyId} onChange={setNewFamilyId} opts={options} ph="Select the target Family…" />
        <label style={labelSt}>Effective date</label>
        <input type="date" value={effectiveDate} onChange={e => setEffectiveDate(e.target.value)}
          style={{ ...inputSt, fontFamily: mono }} />
        {tooEarly && (
          <div style={{ marginTop: 6, fontSize: 11, color: C.red }}>
            The effective date cannot precede the current membership's start ({membership.effective_from}).
          </div>
        )}
        {target && currentFamily && (
          <div style={{ marginTop: 12, fontSize: 12, color: C.slateM, lineHeight: 1.5 }}>
            {reassignConfirmMessage(party.display_name, currentFamily.name, target.name)}
          </div>
        )}
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <Btn ch={busy ? "Reassigning…" : "Reassign"} full disabled={busy || !target || tooEarly} onClick={submit} />
          <Btn ch="Cancel" v="secondary" onClick={onClose} disabled={busy} />
        </div>
      </div>
    </div>
  );
}

function FamilyDetail({ family, aliases, memberships, parties, families, profile, showToast, onReload, openModal }) {
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(family.name);
  const [nameBusy, setNameBusy] = useState(false);
  const [addingAlias, setAddingAlias] = useState(false);
  const [aliasDraft, setAliasDraft] = useState("");
  const [aliasBusy, setAliasBusy] = useState(false);
  const [editingAliasId, setEditingAliasId] = useState(null);
  const [editAliasDraft, setEditAliasDraft] = useState("");

  const partyById = useMemo(() => Object.fromEntries(parties.map(p => [p.id, p])), [parties]);
  const familyAliases = aliases.filter(a => a.family_id === family.id);
  const familyMemberships = memberships
    .filter(m => m.family_id === family.id)
    .sort((a, b) => (b.effective_from || "").localeCompare(a.effective_from || ""));
  const current = familyMemberships.filter(m => m.is_current);
  const survivingInto = family.surviving_family_id
    ? families.find(f => f.id === family.surviving_family_id) : null;
  const isRetired = family.status === "retired";

  const saveName = async () => {
    if (!nameDraft.trim() || nameDraft.trim() === family.name) { setEditingName(false); return; }
    setNameBusy(true);
    const data = await runMutation(`/masters/customer-families/${family.id}`,
      updateFamilyNameBody(nameDraft, family.content_version),
      { method: "PATCH", showToast, successMessage: "Family renamed." });
    setNameBusy(false);
    if (data !== null) { setEditingName(false); onReload(family.id); }
  };

  const submitAlias = async () => {
    if (!aliasDraft.trim()) return;
    setAliasBusy(true);
    const data = await runMutation(`/masters/customer-families/${family.id}/aliases`,
      addAliasBody(aliasDraft), { showToast, successMessage: "Alias added." });
    setAliasBusy(false);
    if (data !== null) { setAliasDraft(""); setAddingAlias(false); onReload(family.id); }
  };

  const saveAlias = async (alias) => {
    if (!editAliasDraft.trim() || editAliasDraft.trim() === alias.alias) { setEditingAliasId(null); return; }
    const data = await runMutation(`/masters/customer-family-aliases/${alias.id}`,
      updateAliasBody(editAliasDraft, alias.content_version),
      { method: "PATCH", showToast, successMessage: "Alias updated." });
    if (data !== null) { setEditingAliasId(null); onReload(family.id); }
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        {editingName ? (
          <>
            <Inp value={nameDraft} onChange={setNameDraft} st={{ width: 220 }} />
            <Btn ch="Save" sm disabled={nameBusy} onClick={saveName} />
            <Btn ch="Cancel" sm v="secondary" disabled={nameBusy}
              onClick={() => { setNameDraft(family.name); setEditingName(false); }} />
          </>
        ) : (
          <>
            <span style={{ fontSize: 18, fontWeight: 700, color: C.slate }}>{family.name}</span>
            <LifecycleBadge status={family.status} />
            <CapabilityGate profile={profile} capability={MANAGE}>
              {!isRetired && <Btn ch="Edit" sm v="ghost" onClick={() => { setNameDraft(family.name); setEditingName(true); }} />}
            </CapabilityGate>
          </>
        )}
      </div>
      <PermanentCode code={family.group_customer_code} style={{ fontSize: 13 }} />
      {survivingInto && (
        <div style={{ marginTop: 8, fontSize: 11, color: C.red }}>
          Merged into <PermanentCode code={survivingInto.group_customer_code} /> ({survivingInto.name})
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        {family.status === "proposed" && (
          <CapabilityGate profile={profile} capability={MANAGE}>
            <Btn ch="Approve" sm onClick={() => openModal({ kind: "approve", family })} />
          </CapabilityGate>
        )}
        {!isRetired && (
          <CapabilityGate profile={profile} capability={MANAGE}>
            <Btn ch="Merge into…" sm v="secondary" onClick={() => openModal({ kind: "merge", family })} />
          </CapabilityGate>
        )}
      </div>

      <div style={{ marginTop: 16 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: C.slateM, textTransform: "uppercase", marginBottom: 4 }}>
          Aliases
        </div>
        {familyAliases.map(a => (
          <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: C.slateM, padding: "3px 0" }}>
            {editingAliasId === a.id ? (
              <>
                <Inp value={editAliasDraft} onChange={setEditAliasDraft} st={{ width: 180 }} />
                <Btn ch="Save" sm onClick={() => saveAlias(a)} />
                <Btn ch="Cancel" sm v="secondary" onClick={() => setEditingAliasId(null)} />
              </>
            ) : (
              <>
                <span style={{ textDecoration: a.status === "retired" ? "line-through" : "none", color: a.status === "retired" ? C.slateL : C.slateM }}>
                  {a.alias}
                </span>
                {a.status === "retired" && <span style={{ fontSize: 9, color: C.slateL }}>(retired)</span>}
                {a.status !== "retired" && !isRetired && (
                  <CapabilityGate profile={profile} capability={MANAGE}>
                    <Btn ch="Edit" sm v="ghost" onClick={() => { setEditingAliasId(a.id); setEditAliasDraft(a.alias); }} />
                    <Btn ch="Retire" sm v="ghost" onClick={() => openModal({ kind: "retire-alias", alias: a, currentFamilyId: family.id })} />
                  </CapabilityGate>
                )}
              </>
            )}
          </div>
        ))}
        {!familyAliases.length && <div style={{ fontSize: 11, color: C.slateL }}>None yet.</div>}
        {!isRetired && (
          <CapabilityGate profile={profile} capability={MANAGE}>
            {addingAlias ? (
              <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                <Inp value={aliasDraft} onChange={setAliasDraft} placeholder="New alias" st={{ width: 180 }} />
                <Btn ch="Add" sm disabled={aliasBusy} onClick={submitAlias} />
                <Btn ch="Cancel" sm v="secondary" onClick={() => { setAddingAlias(false); setAliasDraft(""); }} />
              </div>
            ) : (
              <Btn ch="+ Alias" sm v="ghost" onClick={() => setAddingAlias(true)} />
            )}
          </CapabilityGate>
        )}
      </div>

      <div style={{ marginTop: 16 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: C.slateM, textTransform: "uppercase", marginBottom: 4 }}>
          Current Customers / Prospects — {current.length}
        </div>
        {!current.length && <div style={{ fontSize: 11, color: C.slateL }}>None currently.</div>}
        {current.map(m => {
          const party = partyById[m.party_id];
          if (!party) return null;
          return (
            <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: C.slateM, padding: "4px 0" }}>
              <PermanentCode code={party.customer_code} /> — {party.display_name}
              <LifecycleBadge status={party.lifecycle_state} />
              <CapabilityGate profile={profile} capability={MANAGE}>
                <Btn ch="Reassign" sm v="ghost"
                  onClick={() => openModal({ kind: "reassign", party, membership: m, currentFamilyId: family.id })} />
                {party.lifecycle_state === "prospect" && (
                  <Btn ch="Graduate" sm v="ghost"
                    onClick={() => openModal({ kind: "graduate", party, currentFamilyId: family.id })} />
                )}
              </CapabilityGate>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 16 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: C.slateM, textTransform: "uppercase", marginBottom: 4 }}>
          Effective-dated membership history
        </div>
        <VersionHistory entries={familyMemberships} renderEntry={m => {
          const party = partyById[m.party_id];
          return (
            <>
              <span style={{ fontWeight: 700, color: C.slateM }}>{party?.display_name || `party ${m.party_id}`}</span>
              <span style={{ color: C.slateL, marginLeft: 6 }}>
                {m.effective_from} → {m.effective_until || (m.is_current ? "current" : "—")}
              </span>
            </>
          );
        }} />
      </div>
    </div>
  );
}
