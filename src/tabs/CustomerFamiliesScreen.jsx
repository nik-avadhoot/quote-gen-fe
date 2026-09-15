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
//
// U1 Slice A (docs/u1-customer-foundation-authorization-packet.md) adds one
// more action to the existing Party rows: editing display_name only, via
// lib/partyActions.js + PATCH /masters/parties/<id>. No deactivation, no
// merge — those remain separately authorised.
//
// U1 Slice C adds a Locations sub-list under each Party row: propose (with
// eligibility fixed at that point), edit descriptive detail (new version),
// approve, retire, assign the permanent code — via
// lib/customerLocationActions.js + the /masters/parties/<id>/locations and
// /masters/customer-locations/* routes. There is deliberately no
// eligibility-change action — post-proposal eligibility change is
// Product-Owner-blocked, not designed.
// ═══════════════════════════════════════════════════════════════════════════
import { Fragment, useEffect, useMemo, useState } from "react";
import { useAuth } from "../AuthContext.jsx";
import { apiFetch } from "../lib/apiClient.js";
import { classifyResponse } from "../lib/backendError.js";
import { runMutation } from "../lib/runMutation.js";
import {
  familyNameIsBlank,
  proposeFamilyBody, createProspectBody, updateFamilyNameBody, approveFamilyBody,
  addFamilySectorBody, addAliasBody, updateAliasBody, retireAliasBody, mergeBody,
  reassignBody, graduateBody,
  mergeConfirmMessage, reassignConfirmMessage, graduateConfirmMessage, retireAliasConfirmMessage,
  effectiveDatePrecedesMembership,
  groupExternalReferencesByParty, externalRefKindLabel,
} from "../lib/customerFamilyActions.js";
import { updatePartyBody } from "../lib/partyActions.js";
import {
  proposeLocationBody, updateLocationBody, approveLocationBody, retireLocationBody,
  retireLocationConfirmMessage, hasIncompleteDetails, LOCATION_TYPE_OPTS,
} from "../lib/customerLocationActions.js";
import { AccessDeniedState, EmptyState, LoadingState } from "../ui/appStates.jsx";
import { LifecycleBadge, PermanentCode, ProvenanceTag, SummaryRow, VersionHistory } from "../ui/dataDisplay.jsx";
import CapabilityGate from "../ui/CapabilityGate.jsx";
import { Btn, Inp, Sel } from "../ui/primitives.jsx";
import { inputSt } from "../ui/styles.js";
import { C, T, mono, sans } from "../theme.js";

const MANAGE = "manage_customer_master";
const CREATE_CAPS = [MANAGE, "make_quote"]; // mirrors the DB's own OR condition (propose / prospect)

const overlaySt = { position: "fixed", inset: 0, background: "rgba(28,43,58,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10000 };
const cardSt = { width: 380, background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, padding: 22, boxShadow: "0 8px 32px rgba(0,0,0,.2)", fontFamily: sans };
const labelSt = { fontSize: 10, fontWeight: 700, color: C.slateM, textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 4, marginTop: 10 };

export default function CustomerFamiliesScreen({ showToast }) {
  const { isActive, profile } = useAuth();
  const [state, setState] = useState({ status: "loading", families: [], aliases: [], memberships: [], parties: [], locations: [], locationVersions: [], externalReferences: [], familySectors: [], sectors: [] });
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
        locations: data.locations || [],
        externalReferences: data.external_references || [],
        locationVersions: data.location_versions || [],
        familySectors: data.family_sectors || [],
        sectors: data.sectors || [],
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
      <div style={{ width: 280, flexShrink: 0, borderRight: `1px solid ${C.border}`, padding: 14, overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <div style={{ fontSize: T.heading, fontWeight: 700, color: C.slate, whiteSpace: "nowrap" }}>Customer Families</div>
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            <CapabilityGate profile={profile} capability={CREATE_CAPS}>
              <Btn ch="+ Family" sm v="secondary" onClick={() => setModal({ kind: "propose" })} />
            </CapabilityGate>
            <CapabilityGate profile={profile} capability={CREATE_CAPS}>
              <Btn ch="+ Prospect" sm v="secondary" onClick={() => setModal({ kind: "prospect" })} />
            </CapabilityGate>
          </div>
        </div>
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search name or code…"
          style={{ ...inputSt, marginBottom: 8 }} />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ ...inputSt, marginBottom: 12 }}>
          <option value="">All statuses</option>
          {[...new Set(state.families.map(f => f.status))].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        {!state.families.length && <EmptyState title="No Customer Families" hint="None are recorded yet." />}
        {state.families.length > 0 && !filtered.length && <EmptyState title="No matches" hint="Try a different search or filter." />}
        {filtered.map(f => {
          const isSelected = selected?.id === f.id;
          return (
            <div key={f.id} onClick={() => setSelectedId(f.id)}
              style={{
                padding: "7px 10px", borderRadius: 7, marginBottom: 6, cursor: "pointer",
                border: `1px solid ${isSelected ? C.amber : C.border}`,
                background: isSelected ? C.amberL : C.white,
              }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <PermanentCode code={f.group_customer_code} />
                <LifecycleBadge status={f.status} />
              </div>
              <div style={{ fontSize: T.value, color: C.slateM, marginTop: 3 }}>{f.name}</div>
            </div>
          );
        })}
      </div>
      <div className="screen-end-padded" style={{ flex: 1, padding: 20, overflowY: "auto" }}>
        {!selected ? (
          <EmptyState title="Select a family" />
        ) : (
          <FamilyDetail key={selected.id} family={selected} aliases={state.aliases} memberships={state.memberships}
            parties={state.parties} families={state.families} locations={state.locations} externalReferences={state.externalReferences}
            locationVersions={state.locationVersions} familySectors={state.familySectors}
            sectors={state.sectors} profile={profile}
            showToast={showToast} onReload={load} openModal={setModal} />
        )}
      </div>
      {modal?.kind === "propose" && (
        <ProposeFamilyModal sectors={state.sectors} showToast={showToast}
          onClose={() => setModal(null)}
          onDone={(id) => { setModal(null); load(id); }} />
      )}
      {modal?.kind === "prospect" && (
        <CreateProspectModal families={state.families} sectors={state.sectors}
          familySectors={state.familySectors} showToast={showToast}
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
      {modal?.kind === "propose-location" && (
        <ProposeLocationModal party={modal.party} showToast={showToast}
          onClose={() => setModal(null)}
          onDone={() => { setModal(null); load(modal.currentFamilyId); }} />
      )}
      {modal?.kind === "edit-location" && (
        <EditLocationModal location={modal.location} currentVersion={modal.currentVersion} showToast={showToast}
          onClose={() => setModal(null)}
          onDone={() => { setModal(null); load(modal.currentFamilyId); }} />
      )}
      {modal?.kind === "approve-location" && (
        <ConfirmModal message={`Approve this Location? It moves from Proposed to Active.`}
          confirmLabel="Approve" showToast={showToast}
          onClose={() => setModal(null)}
          onConfirm={async () => {
            const data = await runMutation(`/masters/customer-locations/${modal.location.id}/approve`,
              approveLocationBody(modal.location.content_version),
              { showToast, successMessage: "Location approved." });
            if (data !== null) { setModal(null); load(modal.currentFamilyId); }
            return data !== null;
          }} />
      )}
      {modal?.kind === "retire-location" && (
        <ConfirmModal message={retireLocationConfirmMessage(modal.location.location_code || "this Location")}
          confirmLabel="Retire" danger showToast={showToast}
          onClose={() => setModal(null)}
          onConfirm={async () => {
            const data = await runMutation(`/masters/customer-locations/${modal.location.id}/retire`,
              retireLocationBody(modal.location.content_version),
              { showToast, successMessage: "Location retired." });
            if (data !== null) { setModal(null); load(modal.currentFamilyId); }
            return data !== null;
          }} />
      )}
      {modal?.kind === "assign-location-code" && (
        <ConfirmModal message={`Mint the permanent Location Code for this Location? This is permanent and cannot be reissued.`}
          confirmLabel="Assign Code" showToast={showToast}
          onClose={() => setModal(null)}
          onConfirm={async () => {
            const resp = await apiFetch(`/masters/customer-locations/${modal.location.id}/assign-code`,
              { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
            const data = await resp.json().catch(() => ({}));
            const outcome = classifyResponse({ ok: resp.ok, status: resp.status, data });
            if (outcome.kind === "ok") {
              showToast?.(`✅ Permanent Location Code ${data.location_code}`, "success", 10000);
              setModal(null);
              load(modal.currentFamilyId);
              return true;
            }
            showToast?.(`❌ ${outcome.message || "Could not assign the Location Code."}`, "error", 8000);
            return false;
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

function ProposeFamilyModal({ sectors, onClose, onDone, showToast }) {
  const [name, setName] = useState("");
  const [sectorId, setSectorId] = useState("");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  // D3 - a blank or whitespace-only name is refused here, visibly. The guard in
  // submit() stays as the last line of defence, and the database remains the
  // authority: app_private.propose_customer_family raises 22023 on a blank
  // name regardless of what any client sends.
  const blank = familyNameIsBlank(name);
  const submit = async () => {
    if (blank || !sectorId) { setTouched(true); return; }
    setBusy(true);
    const data = await runMutation("/masters/customer-families", proposeFamilyBody(name, sectorId),
      { showToast, successMessage: `"${name.trim()}" proposed.` });
    setBusy(false);
    if (data) onDone(data.id);
  };
  return (
    <div style={overlaySt}>
      <div style={cardSt}>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.slate }}>Propose a Family</div>
        <label style={labelSt}>Name</label>
        <Inp value={name} placeholder="Family name"
          onChange={v => { setName(v); setTouched(true); }} />
        {touched && blank && (
          <div style={{ marginTop: 6, fontSize: 11, color: C.red }}>
            A Family name is required — it cannot be blank or only spaces.
          </div>
        )}
        <label style={labelSt}>First Sector</label>
        <Sel value={sectorId} onChange={setSectorId}
          opts={(sectors || []).filter(s => s.status === "active").map(s => ({
            v: s.id, l: `${s.sector_code} — ${s.name}`,
          }))}
          ph="Select the Family's first Sector…" />
        {touched && !sectorId && <div style={{ marginTop: 6, fontSize: 11, color: C.red }}>
          Every Customer Family requires at least one Sector.
        </div>}
        <div style={{ marginTop: 6, fontSize: 10, color: C.slateL, lineHeight: 1.45 }}>
          More Sectors can be attached from the Family workspace after proposal.
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <Btn ch={busy ? "Proposing…" : "Propose"} full disabled={busy || blank || !sectorId} onClick={submit} />
          <Btn ch="Cancel" v="secondary" onClick={onClose} disabled={busy} />
        </div>
      </div>
    </div>
  );
}

function CreateProspectModal({ families, sectors, familySectors, onClose, onDone, showToast }) {
  const [displayName, setDisplayName] = useState("");
  const [familyId, setFamilyId] = useState("");
  const [sectorId, setSectorId] = useState("");
  const [busy, setBusy] = useState(false);
  const options = families.filter(f => f.status !== "retired")
    .map(f => ({ v: f.id, l: `${f.group_customer_code} — ${f.name}` }));
  const selectedFamilySectorIds = familySectors
    .filter(item => String(item.family_id) === String(familyId))
    .map(item => String(item.sector_id));
  const availableSectors = sectors.filter(sector => sector.status === "active"
    && (!familyId || selectedFamilySectorIds.includes(String(sector.id))));
  const needsNewFamilySector = !familyId;
  const selectedFamilyIsClassified = !familyId || selectedFamilySectorIds.length > 0;
  const submit = async () => {
    if (!displayName.trim() || !selectedFamilyIsClassified || (needsNewFamilySector && !sectorId)) return;
    setBusy(true);
    const data = await runMutation("/masters/customer-families/prospects",
      createProspectBody(displayName, familyId || null, sectorId || null),
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
        <Sel value={familyId} onChange={value => { setFamilyId(value); setSectorId(""); }}
          opts={options} ph="— propose a new Family —" />
        <label style={labelSt}>{needsNewFamilySector ? "First Sector" : "Family Sector (optional context)"}</label>
        <Sel value={sectorId} onChange={setSectorId}
          opts={availableSectors.map(s => ({ v: s.id, l: `${s.sector_code} — ${s.name}` }))}
          ph={needsNewFamilySector ? "Select the new Family's first Sector…" : "— no Batch context yet —"} />
        <div style={{ marginTop: 6, fontSize: 10, color: C.slateL, lineHeight: 1.45 }}>
          {needsNewFamilySector
            ? "The implicit Customer Family and its first Sector are created atomically."
            : "The Prospect joins the selected Family; this does not choose a Sector for a Batch."}
        </div>
        {!selectedFamilyIsClassified && <div style={{ marginTop: 6, fontSize: 11, color: C.red }}>
          This existing Family must be classified in the Family workspace before another Prospect can join it.
        </div>}
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <Btn ch={busy ? "Creating…" : "Create"} full
            disabled={busy || !displayName.trim() || !selectedFamilyIsClassified
              || (needsNewFamilySector && !sectorId)} onClick={submit} />
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


// U1 Slice C — propose a Customer Location. Eligibility is fixed here, at
// proposal; there is no later action to change it (Product-Owner-blocked —
// see docs/u1-customer-foundation-authorization-packet.md, Slice C).
function ProposeLocationModal({ party, onClose, onDone, showToast }) {
  const [locationType, setLocationType] = useState("");
  const [addressText, setAddressText] = useState("");
  const [contactName, setContactName] = useState("");
  const [notes, setNotes] = useState("");
  const [billTo, setBillTo] = useState(true);
  const [shipTo, setShipTo] = useState(false);
  const [busy, setBusy] = useState(false);
  const eligible = billTo || shipTo;
  const submit = async () => {
    if (!eligible) return;
    setBusy(true);
    const data = await runMutation(`/masters/parties/${party.id}/locations`,
      proposeLocationBody({ locationType, addressText, contactName, notes, billToEligible: billTo, shipToEligible: shipTo }),
      { showToast, successMessage: "Location proposed." });
    setBusy(false);
    if (data) onDone();
  };
  return (
    <div style={overlaySt}>
      <div style={cardSt}>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.slate }}>Propose a Location for "{party.display_name}"</div>
        <label style={labelSt}>Type</label>
        <Sel value={locationType} onChange={setLocationType} opts={LOCATION_TYPE_OPTS} ph="— unspecified —" />
        <label style={labelSt}>Address</label>
        <Inp value={addressText} onChange={setAddressText} placeholder="Address (optional)" />
        <label style={labelSt}>Contact</label>
        <Inp value={contactName} onChange={setContactName} placeholder="Contact name (optional)" />
        <label style={labelSt}>Notes</label>
        <Inp value={notes} onChange={setNotes} placeholder="Notes (optional)" />
        <label style={labelSt}>Eligibility — fixed at proposal, cannot be changed later</label>
        <div style={{ display: "flex", gap: 14, fontSize: 12, color: C.slateM }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input type="checkbox" checked={billTo} onChange={e => setBillTo(e.target.checked)} /> Bill-to
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input type="checkbox" checked={shipTo} onChange={e => setShipTo(e.target.checked)} /> Ship-to
          </label>
        </div>
        {!eligible && <div style={{ marginTop: 6, fontSize: 11, color: C.red }}>A Location must be Bill-to, Ship-to or both.</div>}
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <Btn ch={busy ? "Proposing…" : "Propose"} full disabled={busy || !eligible} onClick={submit} />
          <Btn ch="Cancel" v="secondary" onClick={onClose} disabled={busy} />
        </div>
      </div>
    </div>
  );
}

// U1 Slice C — edit descriptive detail only (creates a new version). Eligibility
// and location_type are not editable through this action.
function EditLocationModal({ location, currentVersion, onClose, onDone, showToast }) {
  const [addressText, setAddressText] = useState(currentVersion?.address_text || "");
  const [contactName, setContactName] = useState(currentVersion?.contact_name || "");
  const [notes, setNotes] = useState(currentVersion?.notes || "");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    const data = await runMutation(`/masters/customer-locations/${location.id}`,
      updateLocationBody({ addressText, contactName, notes }, location.content_version),
      { method: "PATCH", showToast, successMessage: "Location updated." });
    setBusy(false);
    if (data !== null) onDone();
  };
  return (
    <div style={overlaySt}>
      <div style={cardSt}>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.slate }}>Edit Location {location.location_code || ""}</div>
        <label style={labelSt}>Address</label>
        <Inp value={addressText} onChange={setAddressText} placeholder="Address (optional)" />
        <label style={labelSt}>Contact</label>
        <Inp value={contactName} onChange={setContactName} placeholder="Contact name (optional)" />
        <label style={labelSt}>Notes</label>
        <Inp value={notes} onChange={setNotes} placeholder="Notes (optional)" />
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <Btn ch={busy ? "Saving…" : "Save"} full disabled={busy} onClick={submit} />
          <Btn ch="Cancel" v="secondary" onClick={onClose} disabled={busy} />
        </div>
      </div>
    </div>
  );
}

// U1 Slice C — a Party's Customer Locations: code, eligibility (fixed at
// proposal), status, incomplete-details indication, and the actions this
// slice authorises (Propose/Edit/Approve/Retire/Assign-Code). No eligibility
// action exists — post-proposal eligibility change is Product-Owner-blocked.
function LocationsList({ party, locations, locationVersions, profile, currentFamilyId, openModal,
  defaultExpanded = false }) {
  const activeCount = locations.filter(location => location.status === "active").length;
  const incompleteCount = locations.filter(location => {
    const currentVersion = locationVersions.find(version => version.location_id === location.id
      && version.status === "current");
    return hasIncompleteDetails(currentVersion);
  }).length;
  return (
    <SummaryRow title="Locations"
      facts={[
        `${locations.length} ${locations.length === 1 ? "location" : "locations"}`,
        `${activeCount} active`,
        ...(incompleteCount ? [`${incompleteCount} incomplete`] : []),
      ]}
      status={locations.length ? "Recorded" : "None"}
      statusTone={incompleteCount ? "warning" : locations.length ? "positive" : "neutral"}
      defaultExpanded={defaultExpanded}
    >
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: locations.length ? 8 : 0 }}>
        <CapabilityGate profile={profile} capability={CREATE_CAPS}>
          <Btn ch="+ Location" sm v="ghost" onClick={() => openModal({ kind: "propose-location", party, currentFamilyId })} />
        </CapabilityGate>
      </div>
      {locations.length ? (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", minWidth: 620, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: C.paper, color: C.slateM, textAlign: "left", fontSize: T.label }}>
                <th style={{ padding: "7px 8px" }}>Code</th>
                <th style={{ padding: "7px 8px" }}>Eligibility</th>
                <th style={{ padding: "7px 8px" }}>Status</th>
                <th style={{ padding: "7px 8px" }}>Detail</th>
                <th style={{ padding: "7px 8px" }}>Actions</th>
              </tr>
            </thead>
            <tbody>{locations.map(loc => {
              const currentVersion = locationVersions.find(v => v.location_id === loc.id && v.status === "current");
              const incomplete = hasIncompleteDetails(currentVersion);
              const eligibility = [loc.bill_to_eligible && "Bill-to", loc.ship_to_eligible && "Ship-to"]
                .filter(Boolean).join(" / ");
              return (
                <tr key={loc.id} style={{ borderTop: `1px solid ${C.border}` }}>
                  <td style={{ padding: "7px 8px" }}><PermanentCode code={loc.location_code} style={{ fontSize: T.body }} /></td>
                  <td style={{ padding: "7px 8px", fontSize: T.body, color: C.slateM }}>{eligibility}</td>
                  <td style={{ padding: "7px 8px" }}><LifecycleBadge status={loc.status} /></td>
                  <td style={{ padding: "7px 8px", fontSize: T.label, color: incomplete ? C.amberD : C.slateL }}>
                    {incomplete ? "Details incomplete" : "Complete"}
                  </td>
                  <td style={{ padding: "4px 8px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
                      <CapabilityGate profile={profile} capability={MANAGE}>
                        <Btn ch="Edit" sm v="ghost"
                          onClick={() => openModal({ kind: "edit-location", location: loc, currentVersion, currentFamilyId })} />
                        {loc.status === "proposed" && (
                          <Btn ch="Approve" sm v="ghost"
                            onClick={() => openModal({ kind: "approve-location", location: loc, currentFamilyId })} />
                        )}
                        {loc.status === "active" && (
                          <Btn ch="Retire" sm v="ghost"
                            onClick={() => openModal({ kind: "retire-location", location: loc, currentFamilyId })} />
                        )}
                        {!loc.location_code && party.customer_code && (
                          <Btn ch="Assign Code" sm v="ghost"
                            onClick={() => openModal({ kind: "assign-location-code", location: loc, currentFamilyId })} />
                        )}
                      </CapabilityGate>
                    </div>
                  </td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
      ) : <div style={{ fontSize: T.body, color: C.slateL }}>None yet.</div>}
    </SummaryRow>
  );
}

// U1 external references — READ-ONLY. Whatever legacy or customer-side
// identifiers were recorded against this Party, shown so an operator can
// recognise the record. There is no create/edit/retire/delete control here
// and no route behind one: propose/edit are Deferred
// (u1-customer-foundation-authorization-packet.md).
//
// `ref_value` is rendered as plain monospace text, deliberately NOT through
// <PermanentCode>. That component denotes a GOVERNED permanent code
// (customer_code, location_code); an external reference is neither a Customer
// Code nor a Batch linkage, and borrowing its styling would assert exactly
// that. The caption says so in words rather than relying on the reader to
// infer it.
//
// These belong to the Customer/Prospect (party_external_references.party_id),
// not to any Location: the table's References column opens them on their own.
function ExternalReferencesList({ refs, defaultExpanded = false }) {
  return (
    <SummaryRow title="External references"
      facts={[`${refs.length} ${refs.length === 1 ? "reference" : "references"}`, "Recognition only"]}
      status="Read-only"
      defaultExpanded={defaultExpanded}
    >
      {refs.map(r => (
        <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: T.body, color: C.slateM, padding: "2px 0" }}>
          <span style={{ color: C.slateL }}>{externalRefKindLabel(r.ref_kind)}</span>
          <span style={{ fontFamily: mono, fontSize: T.body, color: C.slate }}>{r.ref_value}</span>
        </div>
      ))}
      {refs.length
        ? <div style={{ fontSize: T.label, color: C.slateL, marginTop: 2 }}>
            Recorded for recognition only — not a Customer Code, and not a Batch link.
          </div>
        : <div style={{ fontSize: T.body, color: C.slateL }}>None recorded.</div>}
    </SummaryRow>
  );
}

function FamilyDetail({ family, aliases, memberships, parties, families, locations, locationVersions,
  externalReferences, familySectors, sectors, profile, showToast, onReload, openModal }) {
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(family.name);
  const [nameBusy, setNameBusy] = useState(false);
  const [addingAlias, setAddingAlias] = useState(false);
  const [aliasDraft, setAliasDraft] = useState("");
  const [aliasBusy, setAliasBusy] = useState(false);
  const [editingAliasId, setEditingAliasId] = useState(null);
  const [editAliasDraft, setEditAliasDraft] = useState("");
  const [editingPartyId, setEditingPartyId] = useState(null);
  const [editPartyDraft, setEditPartyDraft] = useState("");
  const [partyBusy, setPartyBusy] = useState(false);
  const [newSectorId, setNewSectorId] = useState("");
  const [sectorBusy, setSectorBusy] = useState(false);
  const [expandedParty, setExpandedParty] = useState(null); // { id, section: "locations" | "references" }
  const [headerSection, setHeaderSection] = useState(null); // "sectors" | "aliases" | null

  const partyById = useMemo(() => Object.fromEntries(parties.map(p => [p.id, p])), [parties]);
  // Grouped once per payload, not per Party row: the deterministic ordering
  // lives in the helper so it is provable by fixture rather than by eye.
  const refsByParty = useMemo(
    () => groupExternalReferencesByParty(externalReferences), [externalReferences]);
  const familyAliases = aliases.filter(a => a.family_id === family.id);
  const attachedSectors = familySectors
    .filter(item => item.family_id === family.id)
    .map(item => ({ ...item, sector: sectors.find(sector => sector.id === item.sector_id) || null }))
    .sort((a, b) => String(a.created_at || "").localeCompare(String(b.created_at || ""))
      || Number(a.sector_id) - Number(b.sector_id));
  const unattachedSectors = sectors.filter(sector => sector.status === "active"
    && !attachedSectors.some(item => item.sector_id === sector.id));
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

  // U1 Slice A — Party display_name edit only. No deactivation, no merge,
  // no Location action here — those are separate slices/packets.
  const saveParty = async (party) => {
    if (!editPartyDraft.trim() || editPartyDraft.trim() === party.display_name) {
      setEditingPartyId(null);
      return;
    }
    setPartyBusy(true);
    const data = await runMutation(`/masters/parties/${party.id}`,
      updatePartyBody(editPartyDraft, party.content_version),
      { method: "PATCH", showToast, successMessage: "Party renamed." });
    setPartyBusy(false);
    if (data !== null) { setEditingPartyId(null); onReload(family.id); }
  };

  const addSector = async () => {
    if (!newSectorId) return;
    setSectorBusy(true);
    const data = await runMutation(`/masters/customer-families/${family.id}/sectors`,
      addFamilySectorBody(newSectorId, family.content_version),
      { showToast, successMessage: "Sector attached to Customer Family." });
    setSectorBusy(false);
    if (data !== null) { setNewSectorId(""); onReload(family.id); }
  };

  return (
    <div>
      {/* Identity header — the same bordered card language as the SummaryRow
          sections below it. Presentation only: every action keeps its gate. */}
      <div style={{ border: `1px solid ${C.border}`, borderRadius: 7, background: C.white, padding: "10px 12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              {editingName ? (
                <>
                  <Inp value={nameDraft} onChange={setNameDraft} st={{ width: 220 }} />
                  <Btn ch="Save" sm disabled={nameBusy} onClick={saveName} />
                  <Btn ch="Cancel" sm v="secondary" disabled={nameBusy}
                    onClick={() => { setNameDraft(family.name); setEditingName(false); }} />
                </>
              ) : (
                <>
                  <span style={{ fontSize: T.heading, fontWeight: 700, color: C.slate }}>{family.name}</span>
                  <LifecycleBadge status={family.status} />
                </>
              )}
            </div>
            <PermanentCode code={family.group_customer_code} style={{ display: "inline-block", marginTop: 3, fontSize: T.title }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            {!editingName && (
              <CapabilityGate profile={profile} capability={MANAGE}>
                {!isRetired && <Btn ch="Edit" sm v="ghost" onClick={() => { setNameDraft(family.name); setEditingName(true); }} />}
              </CapabilityGate>
            )}
            {family.status === "proposed" && (
              <CapabilityGate profile={profile} capability={MANAGE}>
                <Btn ch="Approve" sm disabled={!attachedSectors.length}
                  onClick={() => openModal({ kind: "approve", family })} />
              </CapabilityGate>
            )}
            {!isRetired && (
              <CapabilityGate profile={profile} capability={MANAGE}>
                <Btn ch="Merge into…" sm v="secondary" onClick={() => openModal({ kind: "merge", family })} />
              </CapabilityGate>
            )}
          </div>
        </div>
        {survivingInto && (
          <div style={{ marginTop: 8, fontSize: T.body, color: C.red }}>
            Merged into <PermanentCode code={survivingInto.group_customer_code} /> ({survivingInto.name})
          </div>
        )}

        {/* Sectors and Aliases are part of the Family profile: two tiles side by
            side; an opened tile spans the full header width. Content unchanged. */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8, marginTop: 10 }}>
      <SummaryRow title="Sectors"
        facts={[
          `${attachedSectors.length} attached`,
          attachedSectors[0]?.sector?.sector_code
            ? `${attachedSectors[0].sector.sector_code} first` : "Classification required",
        ]}
        status={attachedSectors.length ? "Classified" : "Required"}
        statusTone={attachedSectors.length ? "positive" : "danger"}
        expanded={headerSection === "sectors"}
        onExpandedChange={open => setHeaderSection(open ? "sectors" : null)}
        style={{ gridColumn: headerSection === "sectors" ? "1 / -1" : "auto",
          borderColor: attachedSectors.length ? C.border : C.red,
          background: attachedSectors.length ? C.white : "#fff5f3" }}
      >
        <div style={{ fontSize: 11, color: C.slateL, lineHeight: 1.45, marginBottom: 7 }}>
          A Customer Family needs at least one Sector and may have more. Each Batch uses exactly one attached Sector; its guidance and inheritance follow only that selected Sector.
        </div>
        {attachedSectors.map((item, index) => <div key={item.sector_id}
          style={{ display: "flex", alignItems: "center", gap: 8, padding: "3px 0", fontSize: 12 }}>
          <span style={{ fontFamily: mono, fontWeight: 700, color: C.slate }}>
            {item.sector?.sector_code || `Sector #${item.sector_id}`}
          </span>
          <span style={{ color: C.slateM }}>{item.sector?.name || "Identity details unavailable"}</span>
          <span style={{ color: C.slateL }}>#{item.sector_id}</span>
          {index === 0 && <span style={{ fontSize: 9, color: C.amber, fontWeight: 700 }}>FIRST / BATCH SUGGESTION</span>}
        </div>)}
        {!attachedSectors.length && <div style={{ fontSize: 11, color: C.red, fontWeight: 700 }}>
          Sector classification required before Family approval or Batch creation.
        </div>}
        {!isRetired && <CapabilityGate profile={profile} capability={MANAGE}>
          <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 8 }}>
            <Sel value={newSectorId} onChange={setNewSectorId}
              opts={unattachedSectors.map(s => ({ v: s.id, l: `${s.sector_code} — ${s.name}` }))}
              ph={unattachedSectors.length ? "Add another Sector…" : "No other active Sector available"} />
            <Btn ch={sectorBusy ? "Adding…" : "Add Sector"} sm disabled={sectorBusy || !newSectorId}
              onClick={addSector} />
          </div>
        </CapabilityGate>}
      </SummaryRow>

      <SummaryRow title="Aliases"
        facts={[
          `${familyAliases.length} ${familyAliases.length === 1 ? "alias" : "aliases"}`,
          familyAliases[0]?.alias || "None recorded",
        ]}
        status={familyAliases.length ? "Recorded" : "None"}
        expanded={headerSection === "aliases"}
        onExpandedChange={open => setHeaderSection(open ? "aliases" : null)}
        style={{ gridColumn: headerSection === "aliases" ? "1 / -1" : "auto" }}
      >
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
      </SummaryRow>
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <div style={{ fontSize: T.label, fontWeight: 800, color: C.slateM, textTransform: "uppercase", marginBottom: 6 }}>
          Current Customers / Prospects — {current.length}
          {/* Edits here are governed, versioned Master changes — not local drafts. */}
          <ProvenanceTag kind="governed" style={{ marginLeft: 6, verticalAlign: "middle" }} />
        </div>
        {!current.length && <div style={{ fontSize: T.body, color: C.slateL }}>None currently.</div>}
        {!!current.length && <div style={{ overflowX: "auto", border: `1px solid ${C.border}`, borderRadius: 7 }}>
          <table style={{ width: "100%", minWidth: 820, borderCollapse: "collapse", background: C.white }}>
            <thead>
              <tr style={{ background: C.slate, color: C.white, textAlign: "left", fontSize: T.label }}>
                <th style={{ padding: "8px 9px" }}>Code</th>
                <th style={{ padding: "8px 9px" }}>Name</th>
                <th style={{ padding: "8px 9px" }}>Status</th>
                <th style={{ padding: "8px 9px" }}>Locations</th>
                <th style={{ padding: "8px 9px" }}>References</th>
                <th style={{ padding: "8px 9px" }}>Actions</th>
              </tr>
            </thead>
            <tbody>{current.map(m => {
          const party = partyById[m.party_id];
          if (!party) return null;
          const isEditingParty = editingPartyId === party.id;
          const partyLocations = locations.filter(l => l.party_id === party.id);
          const partyRefs = refsByParty[party.id] || [];
          // Locations and External References are separate Party-level lists, so
          // each has its own toggle; opening one never reveals the other.
          const locationsOpen = expandedParty?.id === party.id && expandedParty.section === "locations";
          const referencesOpen = expandedParty?.id === party.id && expandedParty.section === "references";
          return (
            <Fragment key={m.id}>
              <tr style={{ borderTop: `1px solid ${C.border}` }}>
                <td style={{ padding: "8px 9px" }}><PermanentCode code={party.customer_code} /></td>
                <td style={{ padding: "8px 9px", fontSize: T.body, color: C.slateM }}>
                  {isEditingParty
                    ? <Inp value={editPartyDraft} onChange={setEditPartyDraft} st={{ width: 190 }} />
                    : party.display_name}
                </td>
                <td style={{ padding: "8px 9px" }}><LifecycleBadge status={party.lifecycle_state} /></td>
                <td style={{ padding: "5px 9px" }}>
                  <button type="button" aria-expanded={locationsOpen}
                    onClick={() => setExpandedParty(locationsOpen ? null : { id: party.id, section: "locations" })}
                    style={{ border: `1px solid ${locationsOpen ? C.amber : C.border}`, background: C.white, borderRadius: 5,
                      padding: "5px 8px", color: C.slateM, fontSize: T.label, fontWeight: 750,
                      cursor: "pointer", whiteSpace: "nowrap" }}>
                    {partyLocations.length} {partyLocations.length === 1 ? "location" : "locations"} {locationsOpen ? "▴" : "▾"}
                  </button>
                </td>
                <td style={{ padding: "5px 9px" }}>
                  <button type="button" aria-expanded={referencesOpen}
                    title="Legacy codes and customer item references recorded against this Customer/Prospect — recognition only"
                    onClick={() => setExpandedParty(referencesOpen ? null : { id: party.id, section: "references" })}
                    style={{ border: `1px solid ${referencesOpen ? C.amber : C.border}`, background: C.white, borderRadius: 5,
                      padding: "5px 8px", color: partyRefs.length ? C.slateM : C.slateL, fontSize: T.label, fontWeight: 750,
                      cursor: "pointer", whiteSpace: "nowrap" }}>
                    {partyRefs.length} {partyRefs.length === 1 ? "reference" : "references"} {referencesOpen ? "▴" : "▾"}
                  </button>
                </td>
                <td style={{ padding: "4px 9px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
                    {isEditingParty ? (
                      <>
                        <Btn ch="Save" sm disabled={partyBusy} onClick={() => saveParty(party)} />
                        <Btn ch="Cancel" sm v="secondary" disabled={partyBusy} onClick={() => setEditingPartyId(null)} />
                      </>
                    ) : (
                      <CapabilityGate profile={profile} capability={MANAGE}>
                        <Btn ch="Edit" sm v="ghost"
                          onClick={() => { setEditPartyDraft(party.display_name); setEditingPartyId(party.id); }} />
                        <Btn ch="Reassign" sm v="ghost"
                          onClick={() => openModal({ kind: "reassign", party, membership: m, currentFamilyId: family.id })} />
                        {party.lifecycle_state === "prospect" && (
                          <Btn ch="Graduate" sm v="ghost"
                            onClick={() => openModal({ kind: "graduate", party, currentFamilyId: family.id })} />
                        )}
                      </CapabilityGate>
                    )}
                  </div>
                </td>
              </tr>
              {(locationsOpen || referencesOpen) && <tr style={{ background: C.cream }}>
                <td colSpan={6} style={{ padding: 9, borderTop: `1px solid ${C.border}` }}>
                  {locationsOpen
                    ? <LocationsList party={party} locations={partyLocations} locationVersions={locationVersions}
                        profile={profile} currentFamilyId={family.id} openModal={openModal} defaultExpanded />
                    : <ExternalReferencesList refs={partyRefs} defaultExpanded />}
                </td>
              </tr>}
            </Fragment>
          );
        })}</tbody>
          </table>
        </div>}
      </div>

      <SummaryRow title="Membership history"
        facts={[
          `${familyMemberships.length} ${familyMemberships.length === 1 ? "period" : "periods"}`,
          `${current.length} current`,
        ]}
        status="Effective-dated"
        style={{ marginTop: 12 }}
      >
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
      </SummaryRow>
    </div>
  );
}
