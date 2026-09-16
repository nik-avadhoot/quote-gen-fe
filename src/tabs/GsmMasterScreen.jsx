// ═══════════════════════════════════════════════════════════════════════════
// src/tabs/GsmMasterScreen.jsx — the GSM Master: paper GSM values offered by
// construction layer pickers in Costing and the Construction Library.
//
// Every write is one governed backend route (add, retire, restore) and needs
// manage_construction_library; the database decides. There is no renumbering:
// a value is identity once a construction uses it. Retire and restore ask for
// confirmation first.
//
// ── SCREEN SPACE ──────────────────────────────────────────────────────────
// The shared standard, as on Commercial Masters and Users & Access: no page
// header under the TopBar; ONE toolbar with the Add GSM disclosure (shown only
// to a caller holding manage_construction_library), an Active / Retired view
// switch over the list already read, and the count; 26px rows with the GSM
// frozen; the renumbering rule and the Governed tag in the footer.
// ═══════════════════════════════════════════════════════════════════════════
import { useState } from "react";
import { useAuth } from "../AuthContext.jsx";
import {
  addGsmValueBody, gsmStatusBody, gsmStatusConfirmMessage, parseGsmInput,
} from "../lib/gsmMaster.js";
import { runMutation } from "../lib/runMutation.js";
import { useAppState } from "../state/AppStateContext.js";
import { useGsmMaster } from "../state/useGsmMaster.js";
import { AccessDeniedState, EmptyState, LoadingState } from "../ui/appStates.jsx";
import CapabilityGate from "../ui/CapabilityGate.jsx";
import { LifecycleBadge, ProvenanceTag } from "../ui/dataDisplay.jsx";
import { Btn } from "../ui/primitives.jsx";
import { PanelFocusToggle, ScreenFooter } from "../ui/screenChrome.jsx";
import {
  control, denseCell, denseHead, denseTable, frozenCell, menuPanel, menuSummary, segment, toolbar, usePanelFocus,
} from "../ui/screenStandards.js";
import { C, T, mono, sans } from "../theme.js";

const MANAGE = "manage_construction_library";
const VIEWS = [["all", "All"], ["active", "Active"], ["retired", "Retired"]];

const rowButton = { ...control, height: 20, padding: "0 8px", fontSize: T.label, fontWeight: 700, cursor: "pointer" };

export default function GsmMasterScreen() {
  const { profile } = useAuth();
  const { showToast } = useAppState();
  const master = useGsmMaster();
  const [draft, setDraft] = useState("");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [statusBusyId, setStatusBusyId] = useState(null);
  const [view, setView] = useState("all");
  const { focusPanel, toggleFocus, exitFocusOnEscape } = usePanelFocus();

  if (master.status === "loading") return <LoadingState label="Loading the GSM Master…" />;
  if (master.status === "denied") return <AccessDeniedState reason="You do not have access to the GSM Master." />;
  if (master.status !== "ok") {
    return (
      <div style={{ padding: 20, fontFamily: sans }}>
        <EmptyState
          title={master.status === "unavailable"
            ? "GSM Master not available in this environment"
            : "The GSM Master could not be loaded"}
          hint="Construction layer pickers fall back to free GSM entry, marked with a dashed amber border, until it can be read. No local list is substituted." />
        <div style={{ display: "flex", justifyContent: "center" }}>
          <Btn ch="Retry" sm v="secondary" onClick={master.reload} />
        </div>
      </div>
    );
  }

  const active = master.values.filter(v => v.status === "active");
  const retired = master.values.filter(v => v.status === "retired");
  const shown = view === "all" ? master.values : view === "active" ? active : retired;
  const parsed = parseGsmInput(draft, master.values);

  const add = async e => {
    e?.preventDefault();
    setTouched(true);
    if (!parsed.ok) return;
    setBusy(true);
    const data = await runMutation("/masters/gsm-values", addGsmValueBody(parsed.value),
      { showToast, successMessage: `${parsed.value} GSM added to the GSM Master.` });
    setBusy(false);
    if (data) { setDraft(""); setTouched(false); master.reload(); }
  };

  const changeStatus = async (row, status) => {
    if (!window.confirm(gsmStatusConfirmMessage(row, status))) return;
    setStatusBusyId(row.id);
    const data = await runMutation(`/masters/gsm-values/${row.id}/status`, gsmStatusBody(row, status),
      { showToast, successMessage: status === "retired" ? `${row.gsm} GSM retired.` : `${row.gsm} GSM restored.` });
    setStatusBusyId(null);
    if (data !== null) master.reload();
  };

  const counts = { all: master.values.length, active: active.length, retired: retired.length };

  return (
    <div onKeyDown={exitFocusOnEscape} style={{ height: "100%", display: "flex", flexDirection: "column",
      minHeight: 0, background: C.cream, fontFamily: sans }}>
      <div role="toolbar" aria-label="GSM Master controls" style={toolbar}>
        <div role="tablist" aria-label="GSM values shown" style={{ display: "inline-flex", border: `1px solid ${C.border}`,
          borderRadius: 5, overflow: "hidden", flexShrink: 0, background: C.white }}>
          {VIEWS.map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={view === id}
            onClick={() => setView(id)} style={{ ...segment(view === id), whiteSpace: "nowrap" }}>
            {label} · {counts[id]}</button>)}
        </div>
        <CapabilityGate profile={profile} capability={MANAGE}>
          <details style={{ position: "relative" }}>
            <summary style={menuSummary(!!draft)}>+ Add GSM ▾</summary>
            <form onSubmit={add} style={{ ...menuPanel, minWidth: 260 }}>
              <label style={{ display: "grid", gap: 3, fontSize: T.label, color: C.slateL, fontWeight: 700 }}>New GSM
                <input value={draft} placeholder="e.g. 125" aria-label="New GSM"
                  onChange={e => { setDraft(e.target.value); setTouched(true); }}
                  style={{ ...control, fontFamily: mono }} />
              </label>
              {touched && draft.trim() && !parsed.ok && (
                <span role="alert" style={{ fontSize: T.label, color: C.red }}>{parsed.message}</span>
              )}
              <button type="submit" disabled={busy || !parsed.ok}
                style={{ ...control, border: "none", fontWeight: 700, color: C.white,
                  background: busy || !parsed.ok ? "#CCC" : C.amber, cursor: busy || !parsed.ok ? "not-allowed" : "pointer" }}>
                {busy ? "Adding…" : "Add GSM"}</button>
            </form>
          </details>
        </CapabilityGate>
        <span style={{ fontSize: T.label, color: C.slateL, whiteSpace: "nowrap" }}>
          Offered by construction layer pickers in Costing and the Construction Library</span>
        <span style={{ flex: "1 1 auto" }} />
        <span style={{ fontSize: T.label, color: C.slateL, whiteSpace: "nowrap" }}>
          {active.length} active · {retired.length} retired</span>
        <PanelFocusToggle panel="list" noun="GSM Master" focused={focusPanel === "list"} onToggle={toggleFocus} />
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: "auto", background: C.white }}>
        {!master.values.length
          ? <EmptyState title="No GSM values" hint="None are recorded yet." />
          : !shown.length
            ? <EmptyState title={`No ${view} GSM values`} hint="Switch the view to see the others." />
            : <table style={denseTable}>
                <thead>
                  <tr>
                    <th scope="col" style={{ ...denseHead, ...frozenCell(false, true) }}>GSM</th>
                    <th scope="col" style={denseHead}>Status</th>
                    <th scope="col" style={denseHead}>Actions</th>
                    <th scope="col" style={{ ...denseHead, width: "100%" }} aria-hidden="true" />
                  </tr>
                </thead>
                <tbody>
                  {shown.map((row, i) => {
                    const background = i % 2 ? C.cream : C.white;
                    return (
                      <tr key={row.id} style={{ height: 26, background }}>
                        <td style={{ ...frozenCell(false), background, fontFamily: mono, fontWeight: 700,
                          color: row.status === "retired" ? C.slateL : C.slate }}>{row.gsm}</td>
                        <td style={denseCell}><LifecycleBadge status={row.status} /></td>
                        <td style={{ ...denseCell, padding: "2px 8px" }}>
                          <CapabilityGate profile={profile} capability={MANAGE}>
                            {row.status === "active"
                              ? <button type="button" disabled={statusBusyId !== null} style={rowButton}
                                  onClick={() => changeStatus(row, "retired")}>
                                  {statusBusyId === row.id ? "Retiring…" : "Retire"}</button>
                              : <button type="button" disabled={statusBusyId !== null} style={rowButton}
                                  onClick={() => changeStatus(row, "active")}>
                                  {statusBusyId === row.id ? "Restoring…" : "Restore"}</button>}
                          </CapabilityGate>
                        </td>
                        <td style={denseCell} aria-hidden="true" />
                      </tr>
                    );
                  })}
                </tbody>
              </table>}
      </div>

      <ScreenFooter right="Retire to stop offering a value; constructions that use it show it as retired">
        <ProvenanceTag kind="governed" />
        <span>Values are never renumbered — a saved construction keeps its GSM.</span>
      </ScreenFooter>
    </div>
  );
}
