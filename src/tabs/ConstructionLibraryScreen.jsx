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
import { hasCapability } from "../lib/capabilities.js";
import { AccessDeniedState, EmptyState, LoadingState } from "../ui/appStates.jsx";
import { LifecycleBadge, PermanentCode } from "../ui/dataDisplay.jsx";
import { C, mono, sans } from "../theme.js";

const LAYER_ORDER = ["TOP", "F1", "L1", "F2", "L2"];

export default function ConstructionLibraryScreen() {
  const { isActive, profile } = useAuth();
  const [state, setState] = useState({ status: "loading", constructions: [], partial: false });
  // null = the plants read did not answer. Deliberately distinct from {} ("no
  // plants visible"), so a missing name is never presented as a known absence.
  const [plantNames, setPlantNames] = useState(null);
  const [readAt, setReadAt] = useState(null);
  const [expanded, setExpanded] = useState({});
  const [reloadKey, setReloadKey] = useState(0);

  const mayRead = hasCapability(profile, "read_construction_library");

  useEffect(() => {
    if (!isActive) return; // an inactive session never issues the request
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
  }, [isActive, reloadKey]);

  // Plant identity, from the governed Plants route — the honest source. Its
  // failure is not this screen's failure: adoption degrades to ids.
  useEffect(() => {
    if (!isActive || !mayRead) return;
    let cancelled = false;
    (async () => {
      const resp = await apiFetch("/masters/plants");
      if (cancelled) return;
      if (classifyResponse(resp).kind !== "ok") { setPlantNames(null); return; }
      const map = {};
      for (const p of resp.data?.plants || []) map[p.id] = p.plant_code || p.name;
      setPlantNames(map);
    })();
    return () => { cancelled = true; };
  }, [isActive, mayRead, reloadKey]);

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
    <div style={{ padding: 16, fontFamily: sans, overflowY: "auto", height: "100%" }}>
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
        <button onClick={() => setReloadKey(k => k + 1)}
          style={{ fontSize: 10, padding: "3px 9px", borderRadius: 4,
            border: `1px solid ${C.border}`, background: C.white, cursor: "pointer" }}>
          Refresh
        </button>
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
    </div>
  );
}
