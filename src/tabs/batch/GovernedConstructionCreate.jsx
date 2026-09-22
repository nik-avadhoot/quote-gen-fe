// ═══════════════════════════════════════════════════════════════════════════
// src/tabs/batch/GovernedConstructionCreate.jsx — add a governed Construction
// without leaving the Batch Builder.
//
// Beta issue log 2026-09-19 item 2: adding a Construction meant leaving Batch
// Entry for another screen and coming back. Product Owner rulings 2026-09-22:
// new Constructions go to the GOVERNED library, and an Admin who holds
// manage_construction_library plus adopt_construction_for_plant may publish and
// adopt in ONE action. This window is that action, in place, for the Batch's
// own plant.
//
// ── IT IS A TRANSPORT, NOT AN AUTHORITY ───────────────────────────────────
// Every capability check lives in the database function behind
// POST /masters/constructions/publish-and-adopt. Hiding the window when the
// caller lacks the grant is a courtesy, never the enforcement: a caller who
// reaches the route without authority is refused there, and the refusal is
// shown as it arrives.
//
// ── WHAT IT DOES NOT COLLECT ──────────────────────────────────────────────
// Box type and the BS/BCT/ECT board specs are NOT here. CDM-13 puts them on the
// SKU, not the Construction, and the governed tables have no column for them.
// They stay on the Batch row where the Maker already enters them.
//
// The permanent CON- code is allocated by the database at publication and is
// never composed here — that is the whole point of CDM-12's neutral sequence.
// ═══════════════════════════════════════════════════════════════════════════
import { useState } from "react";
import { apiFetch } from "../../lib/apiClient.js";
import { classifyResponse } from "../../lib/backendError.js";
import { C, T, mono, sans } from "../../theme.js";

const FIVE_PLY_LAYERS = ["TOP", "F1", "L1", "F2", "L2"];
const THREE_PLY_LAYERS = ["TOP", "F1", "L1"];
const COLUMN_FOR = { TOP: "top", F1: "f1", L1: "l1", F2: "f2", L2: "l2" };

const field = {
  padding: "4px 7px", borderRadius: 5, border: `1px solid ${C.border}`,
  fontSize: T.label, fontFamily: sans, background: C.white, width: "100%",
};

export default function GovernedConstructionCreate({ plant, gradeCodes = [], onCancel, onCreated }) {
  const [form, setForm] = useState({ name: "", ply: 3, flute_f1: "B", flute_f2: "A" });
  const [layers, setLayers] = useState({});
  const [state, setState] = useState({ status: "idle", message: "" });

  const keys = +form.ply === 5 ? FIVE_PLY_LAYERS : THREE_PLY_LAYERS;
  const setLayer = (key, part, value) =>
    setLayers(current => ({ ...current, [key]: { ...(current[key] || {}), [part]: value } }));

  const submit = async event => {
    event.preventDefault();
    if (!form.name.trim()) return setState({ status: "error", message: "A Construction name is required." });
    if (!plant?.id) return setState({ status: "error",
      message: "This Batch's plant is not a governed Producing Plant, so a Construction cannot be adopted for it." });
    const body = { plant_id: plant.id, name: form.name.trim(), ply: +form.ply,
      flute_f1: form.flute_f1 || null, flute_f2: +form.ply === 5 ? (form.flute_f2 || null) : null };
    keys.forEach(key => {
      const column = COLUMN_FOR[key];
      const code = (layers[key]?.code || "").trim();
      const gsm = layers[key]?.gsm;
      body[`layer_${column}_code`] = code || null;
      // Blank stays blank: a layer nobody filled must not arrive as 0 GSM.
      body[`layer_${column}_gsm`] = gsm === "" || gsm === undefined ? null : +gsm;
    });
    setState({ status: "busy", message: "Publishing and adopting…" });
    try {
      const response = await apiFetch("/masters/constructions/publish-and-adopt", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => ({}));
      const result = classifyResponse({ ok: response.ok, status: response.status, data });
      if (!response.ok) return setState({ status: "error", message: result.message });
      setState({ status: "idle", message: "" });
      onCreated?.(data);
    } catch {
      setState({ status: "error",
        message: "The Construction service could not be reached. Nothing was created." });
    }
  };

  return <form onSubmit={submit} style={{ display: "grid", gap: 8, padding: 10,
    border: `1px solid ${C.amber}`, borderRadius: 7, background: "#FFFDF8", fontFamily: sans }}>
    <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
      <strong style={{ fontSize: T.label }}>New governed Construction</strong>
      <span style={{ fontSize: T.micro, color: C.slateL }}>
        Published and adopted at {plant ? `${plant.plant_code} · ${plant.name}` : "—"}.
        Its permanent CON- code is allocated on publication.
      </span>
    </div>
    <label style={{ display: "grid", gap: 3, fontSize: T.micro, color: C.slateL, fontWeight: 700 }}>Name
      <input value={form.name} placeholder="e.g. Beta 3-ply C 25/150-16/120-18/150"
        onChange={event => setForm(f => ({ ...f, name: event.target.value }))} style={field} />
    </label>
    <div style={{ display: "flex", gap: 8 }}>
      <label style={{ display: "grid", gap: 3, fontSize: T.micro, color: C.slateL, fontWeight: 700 }}>Ply
        <select value={form.ply} onChange={event => setForm(f => ({ ...f, ply: +event.target.value }))}
          style={{ ...field, width: 70 }}><option value={3}>3</option><option value={5}>5</option></select>
      </label>
      <label style={{ display: "grid", gap: 3, fontSize: T.micro, color: C.slateL, fontWeight: 700 }}>Flute F1
        <input value={form.flute_f1} onChange={event => setForm(f => ({ ...f, flute_f1: event.target.value }))}
          style={{ ...field, width: 70, fontFamily: mono }} />
      </label>
      {+form.ply === 5 && <label style={{ display: "grid", gap: 3, fontSize: T.micro, color: C.slateL, fontWeight: 700 }}>Flute F2
        <input value={form.flute_f2} onChange={event => setForm(f => ({ ...f, flute_f2: event.target.value }))}
          style={{ ...field, width: 70, fontFamily: mono }} />
      </label>}
    </div>
    <datalist id="governed-construction-grades">
      {gradeCodes.map(code => <option key={code} value={code} />)}
    </datalist>
    <div style={{ display: "grid", gap: 4 }}>
      {keys.map(key => <div key={key} style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <span style={{ width: 34, fontSize: T.micro, fontWeight: 700, color: C.slateL, fontFamily: mono }}>{key}</span>
        <input list="governed-construction-grades" placeholder="Grade" value={layers[key]?.code || ""}
          onChange={event => setLayer(key, "code", event.target.value)}
          style={{ ...field, width: 110, fontFamily: mono }} />
        <input type="number" min="0" step="1" placeholder="GSM" value={layers[key]?.gsm ?? ""}
          onChange={event => setLayer(key, "gsm", event.target.value)}
          style={{ ...field, width: 90, fontFamily: mono }} />
      </div>)}
    </div>
    {state.message && <div role="status" style={{ fontSize: T.micro,
      color: state.status === "error" ? C.red : C.slateL }}>{state.message}</div>}
    <div style={{ display: "flex", gap: 6 }}>
      <button type="submit" disabled={state.status === "busy"}
        style={{ ...field, width: "auto", border: "none", background: C.green, color: C.white,
          fontWeight: 700, cursor: state.status === "busy" ? "wait" : "pointer" }}>
        Publish and adopt</button>
      <button type="button" onClick={onCancel}
        style={{ ...field, width: "auto", cursor: "pointer" }}>Cancel</button>
    </div>
  </form>;
}
