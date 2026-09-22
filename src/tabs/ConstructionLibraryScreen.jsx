// ═══════════════════════════════════════════════════════════════════════════
// src/tabs/ConstructionLibraryScreen.jsx — read-only Construction Library.
//
// U2, first slice. Reads the governed `/masters/constructions` route as the
// authenticated caller. No mutation control exists on this screen: no propose,
// approve, publish, adopt, withdraw or merge. Those operations exist in
// `app_private.*` and are deliberately unreachable from here.
//
// ── THIS IS NOT THE PRODUCING PLANTS PATTERN ──────────────────────────────
// Producing Plants is broadly readable. This master is gated on the GROUP
// capability `read_construction_library`, which S4-5 proved a Maker does not
// hold (FA-6: a Maker cannot read back the version they just wrote). So
// access-denied is the PRIMARY state here, not an edge case, and it is
// rendered as a denial — never as an empty list. "No constructions exist" and
// "you may not see them" are different facts and must never share a screen
// state. The route returns 403 rather than an empty array for exactly this
// reason; this screen only has to not undo that.
//
// ── FIVE HONEST STATES ────────────────────────────────────────────────────
//   loading        skeleton, never an empty list
//   access-denied  a denial naming the capability (403)
//   empty          only reachable by a caller who DOES hold the capability
//   error          distinct from both denied and empty, with retry
//   stale          the read's timestamp plus a manual refresh; no auto-refetch
//
// ── PLANT IDENTITY ────────────────────────────────────────────────────────
// The constructions route obtains plant_id and nothing else about a plant. It
// does not fetch plant names, and it does not pretend to. Names come from the
// separately loaded, already-governed `/masters/plants` response — the same
// route Producing Plants and the plant selector use. An adoption whose plant is
// absent from that response renders as "another plant", never as a fabricated
// name and never as a bare id. If the plants read fails the screen still works
// and adoption falls back to ids, because plant identity is a convenience here
// and construction identity is the point.
//
// ── adoptions_partial ─────────────────────────────────────────────────────
// From the route, with its exact approved meaning: TRUE only when the optional
// adoption read FAILED. FALSE when it succeeded, including when RLS legitimately
// returned zero caller-visible rows — "no adopting plants you can see" is an
// answer, not a partial result. A failure of a required read never arrives here
// as partial success; it is an error state. The screen states in both cases that
// adoption is shown for the caller's accessible plants only, so a complete
// answer is never implied.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useState } from "react";
import { useAuth } from "../AuthContext.jsx";
import { apiFetch } from "../lib/apiClient.js";
import { classifyResponse } from "../lib/backendError.js";
import { hasCapability, hasCapabilityAtPlant } from "../lib/capabilities.js";
import { CONSTRUCTION_ADOPTION_FIXTURE } from "../lib/constructionAdoptionFixture.js";
import {
  ADOPTION_STATUS,
  adoptionStatusForPlant,
  callerAccessiblePlants,
  constructionIsReady,
  constructionVersionSummary,
  publishedApprovedConstructionVersions,
} from "../lib/constructionAdoptionModel.js";
import { AccessDeniedState, EmptyState, LoadingState } from "../ui/appStates.jsx";
import { LifecycleBadge, PermanentCode } from "../ui/dataDisplay.jsx";
import { C, mono, sans } from "../theme.js";

const LAYER_ORDER = ["TOP", "F1", "L1", "F2", "L2"];

const ADOPTION_TONE = {
  [ADOPTION_STATUS.adopted]: { label: "Adopted", color: C.green, background: "#EDF8F1" },
  [ADOPTION_STATUS.withdrawn]: { label: "Withdrawn", color: C.slateM, background: C.paper },
  [ADOPTION_STATUS.notAdopted]: { label: "Not adopted", color: C.amberD, background: "#FFF8ED" },
  [ADOPTION_STATUS.unavailable]: { label: "Unavailable", color: C.red, background: "#FFF1F0" },
};

function AdoptionMatrix({ constructions, plantState, profile, partial }) {
  if (plantState.status === "loading") return <LoadingState label="Loading producing plants…" />;
  if (plantState.status !== "ready") {
    return <div role="status" style={{ padding: 14, border: `1px solid ${C.amber}55`, borderRadius: 7,
      color: C.amberD, background: "#FFF8ED", fontSize: 11 }}>
      Producing Plant identities could not be read, so the adoption matrix is unavailable. The Construction Library remains readable.
    </div>;
  }

  const plants = callerAccessiblePlants(plantState.rows, profile);
  const rows = publishedApprovedConstructionVersions(constructions);
  if (plants.length === 0) {
    return <EmptyState title="No Producing Plant access is assigned to this caller."
      hint="Plant adoption is plant-owned. Reading the global Construction Library does not grant a plant scope." />;
  }
  if (rows.length === 0) {
    return <EmptyState title="No published, approved Construction versions are available."
      hint="Only an approved version of a published Construction can be adopted for formal use." />;
  }

  return <div style={{ overflowX: "auto", border: `1px solid ${C.border}`, borderRadius: 7, background: C.white }}>
    <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 620, fontSize: 10.5 }}>
      <thead>
        <tr style={{ background: C.paper, color: C.slateM, textAlign: "left" }}>
          <th style={{ padding: "7px 9px", borderBottom: `1px solid ${C.border}` }}>Construction version</th>
          <th style={{ padding: "7px 9px", borderBottom: `1px solid ${C.border}` }}>Technical identity</th>
          {plants.map(plant => <th key={plant.id} title={plant.name}
            style={{ padding: "7px 9px", borderBottom: `1px solid ${C.border}`, textAlign: "center" }}>
            {plant.code}<div style={{ fontSize: 8.5, fontWeight: 400, color: C.slateL }}>{plant.name}</div>
          </th>)}
        </tr>
      </thead>
      <tbody>
        {rows.map(({ construction, version }) => <tr key={version.id}>
          <td style={{ padding: "8px 9px", borderBottom: `1px solid ${C.border}` }}>
            <PermanentCode code={construction.construction_code} />
            <div style={{ marginTop: 3, color: C.slate, fontWeight: 600 }}>{construction.name} · v{version.version_no}</div>
          </td>
          <td style={{ padding: "8px 9px", borderBottom: `1px solid ${C.border}`, color: C.slateM }}>
            {constructionVersionSummary(version)}
          </td>
          {plants.map(plant => {
            const status = adoptionStatusForPlant(version, plant.id, partial);
            const tone = ADOPTION_TONE[status];
            return <td key={plant.id} style={{ padding: "8px 9px", borderBottom: `1px solid ${C.border}`, textAlign: "center" }}>
              <span style={{ display: "inline-block", minWidth: 70, padding: "3px 7px", borderRadius: 10,
                color: tone.color, background: tone.background, fontSize: 9, fontWeight: 700 }}>
                {tone.label}
              </span>
            </td>;
          })}
        </tr>)}
      </tbody>
    </table>
  </div>;
}

const LAYER_FIELDS = [
  ["TOP", "layer_top_code", "layer_top_gsm"],
  ["F1", "layer_f1_code", "layer_f1_gsm"],
  ["L1", "layer_l1_code", "layer_l1_gsm"],
  ["F2", "layer_f2_code", "layer_f2_gsm"],
  ["L2", "layer_l2_code", "layer_l2_gsm"],
];

const EMPTY_ADMIN_FORM = {
  plant_id: "", name: "", ply: "", flute_f1: "", flute_f2: "", board_gsm: "",
  layer_top_code: "", layer_top_gsm: "",
  layer_f1_code: "", layer_f1_gsm: "",
  layer_l1_code: "", layer_l1_gsm: "",
  layer_f2_code: "", layer_f2_gsm: "",
  layer_l2_code: "", layer_l2_gsm: "",
};

const adminFieldLabelStyle = { display: "flex", flexDirection: "column", gap: 2, fontSize: 9.5, color: C.slateM, fontWeight: 600 };
const adminInputStyle = { fontSize: 11, padding: "4px 7px", borderRadius: 4, border: `1px solid ${C.border}`, fontFamily: sans, background: C.white };

// S4-7: the single-step Admin shortcut (beta issue log 2026-09-19 item 2,
// Product Owner ruling 2026-09-22). A manage_construction_library holder
// creates, approves, publishes and adopts a Construction in one call - no
// separate propose/approve steps. The multi-role propose->approve->publish
// ->adopt lifecycle is UNCHANGED and remains the path for a Maker's proposal;
// this is an additional entry point, not a replacement.
//
// `plants` is pre-filtered by the caller: only plants where this caller
// holds BOTH manage_construction_library (group-wide, checked by the parent
// before rendering this form at all) AND adopt_construction_for_plant at
// that specific plant - the same two checks the backend RPC makes before
// writing anything. A caller who cannot see a plant here could not have
// used it anyway, so an empty list renders nothing rather than a dead form.
function AdminPublishAdoptForm({ plants, onDone }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_ADMIN_FORM);
  const [submitState, setSubmitState] = useState({ status: "idle" });

  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    const plantId = Number(form.plant_id);
    const ply = Number(form.ply);
    if (!plantId || !form.name.trim() || !Number.isInteger(ply) || ply < 1 || ply > 11) {
      setSubmitState({ status: "error", message: "Plant, name and a ply count from 1 to 11 are required." });
      return;
    }
    const numeric = (v) => {
      if (v === "" || v == null) return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };
    const text = (v) => (v && v.trim() ? v.trim() : null);
    const body = {
      plant_id: plantId, name: form.name.trim(), ply,
      flute_f1: text(form.flute_f1), flute_f2: text(form.flute_f2),
      board_gsm: numeric(form.board_gsm),
      layer_top_code: text(form.layer_top_code), layer_top_gsm: numeric(form.layer_top_gsm),
      layer_f1_code: text(form.layer_f1_code), layer_f1_gsm: numeric(form.layer_f1_gsm),
      layer_l1_code: text(form.layer_l1_code), layer_l1_gsm: numeric(form.layer_l1_gsm),
      layer_f2_code: text(form.layer_f2_code), layer_f2_gsm: numeric(form.layer_f2_gsm),
      layer_l2_code: text(form.layer_l2_code), layer_l2_gsm: numeric(form.layer_l2_gsm),
    };

    setSubmitState({ status: "busy" });
    const resp = await apiFetch("/masters/constructions/publish-and-adopt", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const data = await resp.json().catch(() => ({}));
    const verdict = classifyResponse({ ok: resp.ok, status: resp.status, data });
    if (verdict.kind !== "ok") {
      setSubmitState({ status: "error", message: verdict.message || "The publish and adopt request did not succeed." });
      return;
    }
    setSubmitState({ status: "success", message: `Published and adopted ${data.construction_code || "the new Construction"}.` });
    setForm(EMPTY_ADMIN_FORM);
    onDone?.();
  };

  if (plants.length === 0) return null;

  return (
    <div style={{ border: `1px solid ${C.amber}55`, borderRadius: 7, background: "#FFF8ED", marginBottom: 12 }}>
      <button type="button" onClick={() => setOpen(o => !o)}
        style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "9px 12px",
          border: "none", background: "transparent", cursor: "pointer", textAlign: "left", fontFamily: sans }}>
        <span style={{ fontSize: 9, color: C.amberD, width: 10 }}>{open ? "▾" : "▸"}</span>
        <span style={{ fontSize: 11.5, fontWeight: 700, color: C.amberD, flex: 1 }}>
          Publish and adopt a Construction (Admin)
        </span>
        <span style={{ fontSize: 9.5, color: C.amberD }}>
          One step: creates, approves, publishes and adopts
        </span>
      </button>

      {open && (
        <form onSubmit={submit} style={{ padding: "4px 12px 14px 30px", display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <label style={adminFieldLabelStyle}>
              Name
              <input value={form.name} onChange={set("name")} required
                style={adminInputStyle} placeholder="e.g. 3-ply 20BF Kraft" />
            </label>
            <label style={adminFieldLabelStyle}>
              Ply
              <input type="number" min={1} max={11} value={form.ply} onChange={set("ply")} required
                style={{ ...adminInputStyle, width: 60 }} />
            </label>
            <label style={adminFieldLabelStyle}>
              Plant (adopt at)
              <select value={form.plant_id} onChange={set("plant_id")} required style={adminInputStyle}>
                <option value="">Select…</option>
                {plants.map(p => <option key={p.id} value={p.id}>{p.plant_code} · {p.name}</option>)}
              </select>
            </label>
            <label style={adminFieldLabelStyle}>
              Flute F1
              <input value={form.flute_f1} onChange={set("flute_f1")} style={{ ...adminInputStyle, width: 70 }} />
            </label>
            <label style={adminFieldLabelStyle}>
              Flute F2
              <input value={form.flute_f2} onChange={set("flute_f2")} style={{ ...adminInputStyle, width: 70 }} />
            </label>
            <label style={adminFieldLabelStyle}>
              Board GSM
              <input type="number" min={0} value={form.board_gsm} onChange={set("board_gsm")} style={{ ...adminInputStyle, width: 80 }} />
            </label>
          </div>

          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {LAYER_FIELDS.map(([label, codeKey, gsmKey]) => (
              <div key={label} style={{ display: "flex", alignItems: "flex-end", gap: 4, padding: "5px 7px",
                border: `1px solid ${C.border}`, borderRadius: 5, background: C.white }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: C.slateL, width: 20 }}>{label}</span>
                <label style={adminFieldLabelStyle}>
                  Code
                  <input value={form[codeKey]} onChange={set(codeKey)} style={{ ...adminInputStyle, width: 60 }} />
                </label>
                <label style={adminFieldLabelStyle}>
                  GSM
                  <input type="number" min={0} value={form[gsmKey]} onChange={set(gsmKey)} style={{ ...adminInputStyle, width: 60 }} />
                </label>
              </div>
            ))}
          </div>

          {submitState.status === "error" && (
            <div role="alert" style={{ fontSize: 10.5, color: C.red }}>{submitState.message}</div>
          )}
          {submitState.status === "success" && (
            <div role="status" style={{ fontSize: 10.5, color: C.green }}>{submitState.message}</div>
          )}

          <div>
            <button type="submit" disabled={submitState.status === "busy"}
              style={{ fontSize: 11, fontWeight: 700, padding: "6px 14px", borderRadius: 5,
                border: `1px solid ${C.amberD}`, background: C.amberD, color: C.white,
                cursor: submitState.status === "busy" ? "wait" : "pointer" }}>
              {submitState.status === "busy" ? "Publishing…" : "Publish and adopt"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export default function ConstructionLibraryScreen({ initialView = "library", fixtureOnly = false, onExitFixture }) {
  const { isActive, profile } = useAuth();
  const effectiveProfile = fixtureOnly ? CONSTRUCTION_ADOPTION_FIXTURE.profile : profile;
  const [view, setView] = useState(initialView === "adoption" ? "adoption" : "library");
  const [state, setState] = useState(() => fixtureOnly
    ? { status: "ready", constructions: CONSTRUCTION_ADOPTION_FIXTURE.constructions, partial: false }
    : { status: "loading", constructions: [], partial: false });
  const [plantState, setPlantState] = useState(() => fixtureOnly
    ? { status: "ready", rows: CONSTRUCTION_ADOPTION_FIXTURE.plants }
    : { status: "loading", rows: [] });
  const [readAt, setReadAt] = useState(() => fixtureOnly ? new Date("2026-09-17T10:00:00+05:30") : null);
  const [expanded, setExpanded] = useState({});
  const [reloadKey, setReloadKey] = useState(0);

  const mayRead = hasCapability(effectiveProfile, "read_construction_library");
  const mayAdminPublish = hasCapability(effectiveProfile, "manage_construction_library");
  const adoptablePlants = plantState.status === "ready"
    ? plantState.rows.filter(p => hasCapabilityAtPlant(effectiveProfile, "adopt_construction_for_plant", p.plant_code))
    : [];

  useEffect(() => {
    if (fixtureOnly || !isActive) return; // fixture mode never issues a request
    let cancelled = false;

    (async () => {
      setState(s => ({ ...s, status: "loading" }));
      const resp = await apiFetch("/masters/constructions");
      if (cancelled) return;

      const verdict = classifyResponse(resp);
      if (verdict.kind === "access-denied") {
        setState({ status: "denied", constructions: [], partial: false, message: verdict.message });
        return;
      }
      if (verdict.kind !== "ok") {
        setState({ status: "error", constructions: [], partial: false, message: verdict.message });
        return;
      }
      setState({
        status: "ready",
        constructions: resp.data?.constructions || [],
        partial: resp.data?.adoptions_partial === true,
      });
      setReadAt(new Date());
    })();

    return () => { cancelled = true; };
  }, [fixtureOnly, isActive, reloadKey]);

  // Plant identity, from the governed Plants route — the honest source. Its
  // failure is not this screen's failure: adoption degrades to ids.
  useEffect(() => {
    if (fixtureOnly || !isActive || !mayRead) return;
    let cancelled = false;
    (async () => {
      setPlantState({ status: "loading", rows: [] });
      const resp = await apiFetch("/masters/plants");
      if (cancelled) return;
      if (classifyResponse(resp).kind !== "ok") { setPlantState({ status: "unavailable", rows: [] }); return; }
      setPlantState({ status: "ready", rows: resp.data?.plants || [] });
    })();
    return () => { cancelled = true; };
  }, [fixtureOnly, isActive, mayRead, reloadKey]);

  const plantNames = plantState.status === "ready"
    ? Object.fromEntries(plantState.rows.map(plant => [plant.id, plant.plant_code || plant.name]))
    : null;

  const plantLabel = (id) => {
    if (plantNames && plantNames[id]) return plantNames[id];
    // Not a fabricated name and not a bare id presented as identity.
    return plantNames ? "another plant" : `plant #${id}`;
  };

  if (state.status === "loading") return <LoadingState label="Loading the Construction Library…" />;

  if (state.status === "denied") {
    return (
      <AccessDeniedState
        reason={state.message
          || "You do not have access to the Construction Library. This requires the read_construction_library capability."} />
    );
  }

  if (state.status === "error") {
    return (
      <div style={{ padding: 24, fontFamily: sans }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.red, marginBottom: 6 }}>
          Could not load the Construction Library
        </div>
        <div style={{ fontSize: 11, color: C.slateM, marginBottom: 12 }}>
          {state.message || "The request did not succeed."}
        </div>
        <button onClick={() => setReloadKey(k => k + 1)}
          style={{ fontSize: 11, padding: "5px 12px", borderRadius: 4,
            border: `1px solid ${C.border}`, background: C.white, cursor: "pointer" }}>
          Retry
        </button>
      </div>
    );
  }

  const { constructions, partial } = state;

  return (
    <div style={{ padding: 16, fontFamily: sans, overflowY: "auto", height: "100%",
      boxSizing: "border-box", background: C.cream }}>
      {fixtureOnly && <div role="status" style={{ marginBottom: 10, padding: "7px 10px", border: `1px solid ${C.amber}`,
        borderRadius: 6, background: "#FFF8ED", color: C.amberD, fontSize: 10 }}>
        <strong>U2 · FIXTURE ONLY</strong> · illustrative read-only data; no authoritative read or write.
        <button type="button" onClick={onExitFixture} style={{ marginLeft: 10, border: 0, background: "transparent",
          color: C.amberD, textDecoration: "underline", cursor: "pointer", fontSize: 10 }}>Exit preview</button>
      </div>}
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 4 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: C.slate, margin: 0 }}>
          Construction Library
        </h2>
        <span style={{ fontSize: 10, color: C.slateL }}>
          {constructions.length} construction{constructions.length === 1 ? "" : "s"} · read-only
        </span>
      </div>

      {/* Stale: the read's own timestamp and a manual refresh. No background
          auto-refetch, so what is on screen is always a read the user made. */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 10, color: C.slateL }}>
          Read at {readAt ? readAt.toLocaleTimeString() : "—"}
        </span>
        <button disabled={fixtureOnly} onClick={() => setReloadKey(k => k + 1)}
          style={{ fontSize: 10, padding: "3px 9px", borderRadius: 4,
            border: `1px solid ${C.border}`, background: C.white, cursor: fixtureOnly ? "not-allowed" : "pointer",
            opacity: fixtureOnly ? 0.55 : 1 }}>
          {fixtureOnly ? "Fixture snapshot" : "Refresh"}
        </button>
      </div>

      <div role="tablist" aria-label="Construction master views" style={{ display: "flex", gap: 4, marginBottom: 12 }}>
        {[["library", "Construction Library"], ["adoption", "Plant Construction Adoption"]].map(([id, label]) =>
          <button key={id} type="button" role="tab" aria-selected={view === id} onClick={() => setView(id)}
            style={{ padding: "5px 10px", borderRadius: 5, border: `1px solid ${view === id ? C.amber : C.border}`,
              background: view === id ? "#FFF8ED" : C.white, color: view === id ? C.amberD : C.slateM,
              fontWeight: view === id ? 700 : 500, fontSize: 10, cursor: "pointer" }}>{label}</button>)}
      </div>

      {/* Adoption scope is stated in BOTH cases, so completeness is never implied. */}
      <div style={{ fontSize: 10, color: partial ? C.amberD : C.slateL, marginBottom: 12,
        background: partial ? "#FFF8ED" : "transparent",
        border: partial ? `1px solid ${C.amber}44` : "none",
        borderRadius: partial ? 5 : 0, padding: partial ? "6px 9px" : 0 }}>
        {partial
          ? "⚠️ Plant adoption could not be read, so no adoption is shown below. This is a failed read, not an absence of adoptions."
          : "Plant adoption is shown for your accessible plants only."}
      </div>

      {view === "adoption" ? <>
        <div style={{ marginBottom: 10, color: C.slateM, fontSize: 10.5 }}>
          Published, approved Construction versions by the caller's exact Producing Plant scope. This is selection evidence only;
          proposing, approving and withdrawing adoption remain outside this slice.
        </div>
        <AdoptionMatrix constructions={constructions} plantState={plantState} profile={effectiveProfile} partial={partial} />
      </> : <>
        {mayAdminPublish && !fixtureOnly && (
          <AdminPublishAdoptForm plants={adoptablePlants} onDone={() => setReloadKey(k => k + 1)} />
        )}
        {constructions.length === 0
          ? <EmptyState title="No constructions have been created yet."
              hint="Constructions are proposed from Batch Entry and published by the Construction Library owner." />
          : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {constructions.map(c => {
              const open = !!expanded[c.id];
              return (
                <div key={c.id} style={{ border: `1px solid ${C.border}`, borderRadius: 6,
                  background: C.white, overflow: "hidden" }}>
                  <button onClick={() => setExpanded(e => ({ ...e, [c.id]: !e[c.id] }))}
                    style={{ width: "100%", display: "flex", alignItems: "center", gap: 10,
                      padding: "8px 10px", border: "none", background: "transparent",
                      cursor: "pointer", textAlign: "left", fontFamily: sans }}>
                    <span style={{ fontSize: 9, color: C.slateL, width: 10 }}>{open ? "▾" : "▸"}</span>
                    <PermanentCode code={c.construction_code} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: C.slate, flex: 1 }}>
                      {c.name}
                    </span>
                    <LifecycleBadge status={c.status} />
                    {!partial && constructionIsReady(c) && (
                      <span title="Published, approved and adopted by at least one plant you can see"
                        style={{ display: "inline-flex", alignItems: "center", fontSize: 9, fontWeight: 700,
                          color: C.green, background: C.greenL, border: `1px solid ${C.green}55`,
                          borderRadius: 10, padding: "2px 7px" }}>
                        Ready
                      </span>
                    )}
                    <span style={{ fontSize: 10, color: C.slateL }}>
                      {c.versions.length} version{c.versions.length === 1 ? "" : "s"}
                    </span>
                  </button>

                  {open && (
                    <div style={{ borderTop: `1px solid ${C.border}`, padding: "8px 10px 10px 30px" }}>
                      {c.versions.length === 0
                        ? <div style={{ fontSize: 10, color: C.slateL }}>No versions.</div>
                        : c.versions.map(v => (
                          <div key={v.id} style={{ marginBottom: 10 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                              <span style={{ fontSize: 11, fontWeight: 700, color: C.slate }}>
                                v{v.version_no}
                              </span>
                              <span style={{ fontSize: 10, color: C.slateM }}>
                                {v.ply}-ply
                                {v.flute_f1 ? ` · F1 ${v.flute_f1}` : ""}
                                {v.flute_f2 ? ` · F2 ${v.flute_f2}` : ""}
                                {v.board_gsm != null ? ` · board ${v.board_gsm} gsm` : ""}
                              </span>
                              <span style={{ fontSize: 9, fontWeight: 700,
                                color: v.approved ? C.green : C.amberD }}>
                                {v.approved ? "APPROVED" : "UNAPPROVED"}
                              </span>
                              {v.effective_from && (
                                <span style={{ fontSize: 9, color: C.slateL }}>
                                  from {v.effective_from}
                                </span>
                              )}
                            </div>

                            {/* The compact technical stack. Five layers, code and
                                GSM, in fixed TOP→L2 order so two versions can be
                                compared by eye. An unused layer says so rather
                                than vanishing, which would make a 3-ply and a
                                5-ply stack look alike. */}
                            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 3 }}>
                              {LAYER_ORDER.map(name => {
                                const l = (v.layers || []).find(x => x.layer === name) || {};
                                const used = !!(l.code || l.gsm != null);
                                return (
                                  <span key={name} title={`${name} layer`}
                                    style={{ fontFamily: mono, fontSize: 9.5,
                                      padding: "2px 6px", borderRadius: 3,
                                      border: `1px solid ${C.border}`,
                                      background: used ? "#F7F7F7" : "transparent",
                                      color: used ? C.slate : C.slateL,
                                      opacity: used ? 1 : 0.55 }}>
                                    <b style={{ color: C.slateL, fontWeight: 700 }}>{name}</b>
                                    {" "}
                                    {used ? `${l.code || "—"} · ${l.gsm != null ? l.gsm : "—"}` : "not used"}
                                  </span>
                                );
                              })}
                            </div>

                            <div style={{ fontSize: 9.5, color: C.slateL }}>
                              {partial
                                ? "Adoption unavailable"
                                : v.adoptions.length === 0
                                  ? "Not adopted by any plant you can access"
                                  : `Adopted: ${v.adoptions
                                      .map(a => `${plantLabel(a.plant_id)}${a.status === "withdrawn" ? " (withdrawn)" : ""}`)
                                      .join(", ")}`}
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </>}
    </div>
  );
}
