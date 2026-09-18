// ═══════════════════════════════════════════════════════════════════════════
// src/tabs/batch/ProspectCreateModal.jsx — create a Prospect in one window.
//
// Product Owner ruling, 2026-09-18. Creating a Prospect from the Batch Client
// field used to be a small confirmation that sent no Sector, so the backend
// refused it ("sector_id is required when proposing a new Family"), and picking
// the Batch Sector to satisfy it closed the panel and discarded the name. This
// window collects everything creation needs, in one place:
//
//   - the Prospect's name;
//   - its governed Sector (required by the database for every Family);
//   - its Producing Plant (required by the plant-assignment rule).
//
// It still shows likely duplicates first, so a spelling variant can be
// selected instead of creating a second record. Create goes through the same
// governed route as before:
//
//   POST /masters/customer-families/prospects   { display_name, sector_id }
//
// The Sector is stored on the new Family. The Plant is applied to this Batch;
// the Customer Master cannot store a Family's plants until Amendment 06 is
// built, and the window says so rather than implying otherwise.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../lib/apiClient.js";
import { classifyResponse } from "../../lib/backendError.js";
import { runMutation } from "../../lib/runMutation.js";
import {
  createProspectBody, partyOptionParts, prospectFormProblems, prospectPlantNote,
} from "../../lib/batchQuickCreate.js";
import { Btn, Inp, Sel } from "../../ui/primitives.jsx";
import { C, sans } from "../../theme.js";

const overlaySt = { position: "fixed", inset: 0, background: "rgba(28,43,58,.45)", display: "flex",
  alignItems: "center", justifyContent: "center", zIndex: 10000 };
const cardSt = { width: 460, maxHeight: "86vh", overflowY: "auto", background: C.white,
  border: `1px solid ${C.border}`, borderRadius: 10, padding: 22,
  boxShadow: "0 8px 32px rgba(0,0,0,.2)", fontFamily: sans };
const labelSt = { fontSize: 10, fontWeight: 700, color: C.slateM, textTransform: "uppercase",
  letterSpacing: "0.05em", display: "block", marginBottom: 4, marginTop: 12 };
const noteSt = { fontSize: 11, color: C.slateL, marginTop: 6, lineHeight: 1.45 };
const matchSt = { display: "block", width: "100%", textAlign: "left", border: `1px solid ${C.border}`,
  borderRadius: 4, background: C.white, padding: "5px 7px", marginTop: 4, cursor: "pointer",
  fontSize: 11, color: C.slate, fontFamily: "inherit" };

export default function ProspectCreateModal({
  initialName, matches, familyOf, defaultSectorCode, defaultPlantName,
  onSelectExisting, onCreated, onClose, showToast,
}) {
  const [name, setName] = useState(initialName || "");
  const [sectorId, setSectorId] = useState("");
  const [plantId, setPlantId] = useState("");
  const [options, setOptions] = useState({ status: "loading", sectors: [], plants: [] });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let resp, data;
      try {
        resp = await apiFetch("/batches/create-options");
        data = await resp.json().catch(() => ({}));
      } catch {
        if (!cancelled) setOptions({ status: "error", sectors: [], plants: [] });
        return;
      }
      if (cancelled) return;
      const outcome = classifyResponse({ ok: resp.ok, status: resp.status, data });
      if (outcome.kind !== "ok") {
        setOptions({ status: outcome.kind === "access-denied" ? "denied" : "error", sectors: [], plants: [] });
        return;
      }
      const sectors = (data.sectors || []).filter(s => s.status === "active");
      const plants = data.plants || [];
      setOptions({ status: "ok", sectors, plants });
      // Start from what the Batch already says, when it names a governed option.
      const sector = sectors.find(s => s.sector_code === defaultSectorCode);
      if (sector) setSectorId(String(sector.id));
      const plant = plants.find(p => p.name === defaultPlantName)
        || (plants.length === 1 ? plants[0] : null);
      if (plant) setPlantId(String(plant.id));
    })();
    return () => { cancelled = true; };
  }, [defaultSectorCode, defaultPlantName]);

  const sectorOpts = useMemo(() => options.sectors.map(s => ({ v: String(s.id),
    l: `${s.name} (${s.sector_code})` })), [options.sectors]);
  const plantOpts = useMemo(() => options.plants.map(p => ({ v: String(p.id),
    l: `${p.name} (${p.plant_code})` })), [options.plants]);
  const chosenPlant = options.plants.find(p => String(p.id) === plantId) || null;
  const chosenSector = options.sectors.find(s => String(s.id) === sectorId) || null;

  const problems = prospectFormProblems({ name, sectorId, plantId });

  const submit = async () => {
    if (problems.length || busy) return;
    setBusy(true);
    const trimmed = name.trim();
    const data = await runMutation("/masters/customer-families/prospects",
      createProspectBody(trimmed, null, sectorId),
      { showToast, successMessage: `Prospect "${trimmed}" created in the Customer Master.` });
    setBusy(false);
    if (!data) return;
    onCreated({ name: trimmed, partyId: data.party_id, familyId: data.family_id,
      sectorCode: chosenSector?.sector_code || "", plantName: chosenPlant?.name || "" });
  };

  return (
    <div style={overlaySt} role="dialog" aria-modal="true" aria-label="Create a new Prospect">
      <div style={cardSt}>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.slate }}>Create a new Prospect</div>
        <div style={noteSt}>
          Creates the Prospect and its Customer Family in the Customer Master and sets this Batch's
          Client. Graduating it to a Customer with a permanent Customer Code is a separate action in
          Customer Families.
        </div>

        {matches?.length > 0 && (
          <div style={{ marginTop: 10, padding: "6px 8px", border: `1px solid ${C.amber}`,
            borderRadius: 5, background: "#FEF8F0" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.amberD }}>
              Similar records already exist. Selecting one avoids a duplicate.
            </div>
            {matches.map(({ party }) => {
              const parts = partyOptionParts(party, familyOf?.[party.id]);
              return (
                <button key={party.id} type="button" style={matchSt} onClick={() => onSelectExisting(party)}>
                  <strong>{parts.name}</strong>
                  <span style={{ color: C.slateL }}>
                    {" · "}{parts.lifecycle}{parts.code ? ` · ${parts.code}` : ""}
                    {parts.family ? ` · Family: ${parts.family}` : ""}
                  </span>
                  <span style={{ color: C.amberD, fontWeight: 700 }}> · use this</span>
                </button>
              );
            })}
          </div>
        )}

        <label style={labelSt}>Prospect name *</label>
        <Inp value={name} onChange={setName} placeholder="Customer or prospect name"
          st={{ width: "100%", boxSizing: "border-box" }} />

        <label style={labelSt}>Sector *</label>
        {options.status === "ok"
          ? <Sel value={sectorId} onChange={setSectorId} opts={sectorOpts} ph="— choose a Sector —" />
          : <div style={noteSt}>{options.status === "loading" ? "Loading Sectors and Plants…"
              : options.status === "denied" ? "You cannot read the governed Sectors, so a Prospect cannot be created here."
              : "Sectors and Plants could not be loaded. Nothing has been changed."}</div>}

        <label style={labelSt}>Producing Plant *</label>
        {options.status === "ok" && (
          plantOpts.length
            ? <Sel value={plantId} onChange={setPlantId} opts={plantOpts} ph="— choose a Plant —" />
            : <div style={noteSt}>You hold Maker access at no Producing Plant, so none can be chosen.</div>
        )}
        {chosenPlant && <div style={noteSt}>{prospectPlantNote(chosenPlant.name)}</div>}

        {problems.length > 0 && options.status === "ok" && (
          <div style={{ marginTop: 10, fontSize: 11, color: C.slateM }}>
            {problems.join(" ")}
          </div>
        )}

        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <Btn ch={busy ? "Creating…" : "Create Prospect"} full
            disabled={busy || problems.length > 0 || options.status !== "ok"} onClick={submit} />
          <Btn ch="Cancel" v="secondary" disabled={busy} onClick={onClose} />
        </div>
      </div>
    </div>
  );
}
