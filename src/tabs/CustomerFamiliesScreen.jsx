// ═══════════════════════════════════════════════════════════════════════════
// src/tabs/CustomerFamiliesScreen.jsx — Customer Family list and detail.
//
// U1 (post-S7 handover S9.4), read-only for this pass. Uses the new
// /masters/customer-families route (quote-gen-be), which is a plain
// caller-context read exactly mirroring /masters/plants — no new SQL, no
// new capability, RLS unchanged (gated by the existing `read_party_master`
// group capability, confirmed from pg_policies, not assumed).
//
// Merge, reassign and Proposed-family review are NOT offered here.
// app_private.merge_families / reassign_party_family / graduate_party exist
// and are tested, but have no `public` invoker wrapper, so no caller can
// reach them today - not a frontend omission, an architectural gap recorded
// in the U0 report S6. Building a direct browser write against these tables
// to fake the action would bypass that authority; this screen states the
// gap instead.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../AuthContext.jsx";
import { apiFetch } from "../lib/apiClient.js";
import { classifyResponse } from "../lib/backendError.js";
import { AccessDeniedState, EmptyState, LoadingState } from "../ui/appStates.jsx";
import { LifecycleBadge, PermanentCode, VersionHistory } from "../ui/dataDisplay.jsx";
import { inputSt } from "../ui/styles.js";
import { C, sans } from "../theme.js";

export default function CustomerFamiliesScreen() {
  const { isActive } = useAuth();
  const [state, setState] = useState({ status: "loading", families: [], aliases: [], memberships: [], parties: [] });
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    if (!isActive) return;
    let cancelled = false;
    (async () => {
      let resp, data;
      try {
        resp = await apiFetch("/masters/customer-families");
        data = await resp.json().catch(() => ({}));
      } catch {
        if (!cancelled) setState(s => ({ ...s, status: "error" }));
        return;
      }
      if (cancelled) return;
      const outcome = classifyResponse({ ok: resp.ok, status: resp.status, data });
      if (outcome.kind === "ok") {
        setState({
          status: "ok",
          families: data.families || [],
          aliases: data.aliases || [],
          memberships: data.memberships || [],
          parties: data.parties || [],
        });
      } else if (outcome.kind === "access-denied") {
        setState(s => ({ ...s, status: "denied" }));
      } else {
        setState(s => ({ ...s, status: "error" }));
      }
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
  if (!state.families.length) return <EmptyState title="No Customer Families" hint="None are recorded yet." />;

  return (
    <div style={{ display: "flex", height: "100%", fontFamily: sans }}>
      <div style={{ width: 320, borderRight: `1px solid ${C.border}`, padding: 16, overflowY: "auto" }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: C.slate, marginBottom: 10 }}>Customer Families</div>
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search name or code…"
          style={{ ...inputSt, marginBottom: 8 }} />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ ...inputSt, marginBottom: 12 }}>
          <option value="">All statuses</option>
          {[...new Set(state.families.map(f => f.status))].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        {!filtered.length && <EmptyState title="No matches" hint="Try a different search or filter." />}
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
          <FamilyDetail family={selected} aliases={state.aliases} memberships={state.memberships}
            parties={state.parties} families={state.families} />
        )}
      </div>
    </div>
  );
}

function FamilyDetail({ family, aliases, memberships, parties, families }) {
  const partyById = useMemo(() => Object.fromEntries(parties.map(p => [p.id, p])), [parties]);
  const familyAliases = aliases.filter(a => a.family_id === family.id);
  const familyMemberships = memberships
    .filter(m => m.family_id === family.id)
    .sort((a, b) => (b.effective_from || "").localeCompare(a.effective_from || ""));
  const current = familyMemberships.filter(m => m.is_current);
  const survivingInto = family.surviving_family_id
    ? families.find(f => f.id === family.surviving_family_id) : null;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <span style={{ fontSize: 18, fontWeight: 700, color: C.slate }}>{family.name}</span>
        <LifecycleBadge status={family.status} />
      </div>
      <PermanentCode code={family.group_customer_code} style={{ fontSize: 13 }} />
      {survivingInto && (
        <div style={{ marginTop: 8, fontSize: 11, color: C.red }}>
          Merged into <PermanentCode code={survivingInto.group_customer_code} /> ({survivingInto.name})
        </div>
      )}

      {familyAliases.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.slateM, textTransform: "uppercase", marginBottom: 4 }}>Aliases</div>
          <div style={{ fontSize: 12, color: C.slateM }}>{familyAliases.map(a => a.alias).join(", ")}</div>
        </div>
      )}

      <div style={{ marginTop: 14 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: C.slateM, textTransform: "uppercase", marginBottom: 4 }}>
          Current Customers / Prospects — {current.length}
        </div>
        {!current.length && <div style={{ fontSize: 11, color: C.slateL }}>None currently.</div>}
        {current.map(m => {
          const party = partyById[m.party_id];
          return (
            <div key={m.id} style={{ fontSize: 12, color: C.slateM, padding: "4px 0" }}>
              <PermanentCode code={party?.customer_code} /> — {party?.display_name || "—"}
              {party && <span style={{ marginLeft: 6 }}><LifecycleBadge status={party.lifecycle_state} /></span>}
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 14 }}>
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

      <div style={{ marginTop: 16, padding: "10px 12px", background: C.paper, borderRadius: 6, fontSize: 11, color: C.slateL }}>
        Merge, reassignment and Proposed-family review are not available yet — the underlying
        operations exist and are tested but have no governed public entry point. See the U0 report.
      </div>
    </div>
  );
}
