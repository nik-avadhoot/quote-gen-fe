// ═══════════════════════════════════════════════════════════════════════════
// src/tabs/GsmMasterScreen.jsx — the GSM Master: paper GSM values offered by
// construction layer pickers in Costing and the Construction Library.
//
// Every write is one governed backend route (add, retire, restore) and needs
// manage_construction_library; the database decides. There is no renumbering:
// a value is identity once a construction uses it. Retire and restore ask for
// confirmation first.
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
import { LifecycleBadge } from "../ui/dataDisplay.jsx";
import { Btn, Inp } from "../ui/primitives.jsx";
import { C, T, mono, sans } from "../theme.js";

const MANAGE = "manage_construction_library";

export default function GsmMasterScreen() {
  const { profile } = useAuth();
  const { showToast } = useAppState();
  const master = useGsmMaster();
  const [draft, setDraft] = useState("");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [statusBusyId, setStatusBusyId] = useState(null);

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
  const parsed = parseGsmInput(draft, master.values);

  const add = async () => {
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

  return (
    <div className="screen-end-padded" style={{ height: "100%", overflowY: "auto", padding: 20, fontFamily: sans }}>
      <div style={{ maxWidth: 640 }}>
        <div style={{ border: `1px solid ${C.border}`, borderRadius: 7, background: C.white, padding: "10px 12px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <div>
              <div style={{ fontSize: T.heading, fontWeight: 700, color: C.slate }}>GSM Master</div>
              <div style={{ fontSize: T.label, color: C.slateL, marginTop: 2 }}>
                {active.length} active · {retired.length} retired · offered by construction layer pickers in Costing and the Construction Library
              </div>
            </div>
          </div>
          <CapabilityGate profile={profile} capability={MANAGE}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10 }}>
              <Inp value={draft} onChange={value => { setDraft(value); setTouched(true); }}
                placeholder="New GSM, e.g. 125" st={{ width: 160, fontFamily: mono }} />
              <Btn ch={busy ? "Adding…" : "Add GSM"} sm disabled={busy || !parsed.ok} onClick={add} />
              {touched && draft.trim() && !parsed.ok && (
                <span style={{ fontSize: T.label, color: C.red }}>{parsed.message}</span>
              )}
            </div>
          </CapabilityGate>
          <div style={{ fontSize: T.label, color: C.slateL, marginTop: 8, lineHeight: 1.45 }}>
            Values are never renumbered — a saved construction keeps its GSM. Retire a value to stop offering it;
            constructions that already use it show it as retired.
          </div>
        </div>

        <div style={{ marginTop: 12, border: `1px solid ${C.border}`, borderRadius: 7, overflow: "hidden" }}>
          {!master.values.length
            ? <EmptyState title="No GSM values" hint="None are recorded yet." />
            : <table style={{ width: "100%", borderCollapse: "collapse", background: C.white }}>
                <thead>
                  <tr style={{ background: C.slate, color: C.white, textAlign: "left", fontSize: T.label }}>
                    <th style={{ padding: "8px 9px" }}>GSM</th>
                    <th style={{ padding: "8px 9px" }}>Status</th>
                    <th style={{ padding: "8px 9px" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {master.values.map(row => (
                    <tr key={row.id} style={{ borderTop: `1px solid ${C.border}` }}>
                      <td style={{ padding: "7px 9px", fontFamily: mono, fontWeight: 700, fontSize: T.value,
                        color: row.status === "retired" ? C.slateL : C.slate }}>{row.gsm}</td>
                      <td style={{ padding: "7px 9px" }}><LifecycleBadge status={row.status} /></td>
                      <td style={{ padding: "4px 9px" }}>
                        <CapabilityGate profile={profile} capability={MANAGE}>
                          {row.status === "active"
                            ? <Btn ch={statusBusyId === row.id ? "Retiring…" : "Retire"} sm v="ghost"
                                disabled={statusBusyId !== null} onClick={() => changeStatus(row, "retired")} />
                            : <Btn ch={statusBusyId === row.id ? "Restoring…" : "Restore"} sm v="ghost"
                                disabled={statusBusyId !== null} onClick={() => changeStatus(row, "active")} />}
                        </CapabilityGate>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>}
        </div>
      </div>
    </div>
  );
}
