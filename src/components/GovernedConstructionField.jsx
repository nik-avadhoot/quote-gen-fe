// ═══════════════════════════════════════════════════════════════════════════
// src/components/GovernedConstructionField.jsx — choose a governed Construction
// version anywhere a SKU or a Batch row needs one.
//
// Product Owner, 2026-09-22 (beta issue log): the SKU Master's "Propose a SKU"
// offered a bare dropdown — "CON-000056 v1 · 3-ply" — with no way to SEE what a
// Construction actually is before choosing it, no way to search, and no way to
// add one when nothing listed fits. The Batch Builder's picker already solves
// all three, so the same picker is used here rather than a second, weaker one.
//
// ── WHAT THE CALLER SUPPLIES ──────────────────────────────────────────────
// This component owns no authority and fetches nothing. The host passes the
// candidate `entries` (already mapped to the shared construction shape), the
// governed `plant` row the new Construction would be adopted at, and a
// `onRefresh` that re-reads the library. That keeps one load per screen instead
// of one per field, and keeps this component testable as a pure surface.
//
// ── WHY IT STORES A VERSION ID, NOT A CODE ────────────────────────────────
// A SKU references an exact immutable construction_version_id (CDM-13). The
// picker works in codes because that is what a Batch row holds, so selection is
// translated here, once, at the boundary — never by string-matching a rendered
// name, which is the resolution CDM-12 forbids.
// ═══════════════════════════════════════════════════════════════════════════
import { useState } from "react";
import ConstructionPicker from "./ConstructionPicker.jsx";
import GovernedConstructionCreate from "../tabs/batch/GovernedConstructionCreate.jsx";
import { constrAutoName } from "../lib/constructionName.js";
import { C, T, mono, sans } from "../theme.js";

export default function GovernedConstructionField({
  entries = [], value, onChange, plant, gradeCodes = [], onRefresh,
  disabled = false, mayCreate = false, unavailableReason = null,
}) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState({});

  const selected = entries.find(entry => String(entry.constructionVersionId) === String(value)) || null;

  const close = () => { setOpen(false); setCreating(false); setQuery(""); };
  const select = construction => {
    onChange(construction.constructionVersionId);
    close();
  };
  const created = async data => {
    setCreating(false);
    const refreshed = await onRefresh?.();
    // Select the new version by the identity the route returned, not by name.
    if (data?.construction_version_id) onChange(data.construction_version_id);
    close();
    return refreshed;
  };

  return <div style={{ display: "grid", gap: 3 }}>
    <div style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
      <button type="button" disabled={disabled} onClick={() => setOpen(true)}
        style={{ ...pickerButton, cursor: disabled ? "not-allowed" : "pointer",
          borderColor: selected ? C.amber : C.border }}>
        {selected ? "Change…" : "Choose…"}
      </button>
      <div style={{ minWidth: 0, flex: 1 }}>
        {selected
          ? <>
              <div style={{ fontFamily: mono, fontSize: T.label, color: C.slate }}>
                {selected.code}{selected.versionNo ? ` v${selected.versionNo}` : ""}
                {selected.name ? ` · ${selected.name}` : ""}
              </div>
              <div style={{ fontSize: T.micro, color: C.slateL }}>{constrAutoName(selected)}</div>
            </>
          : <div style={{ fontSize: T.micro, color: C.slateL }}>
              {disabled ? (unavailableReason || "Unavailable")
                : "No Construction chosen. The picker shows each one's ply, flutes, grades and GSM."}
            </div>}
      </div>
    </div>
    <ConstructionPicker open={open} constructions={entries}
      query={query} onQueryChange={setQuery} filter={filter} onFilterChange={setFilter}
      selectedCode={selected?.code || ""}
      contextLabel={plant ? `Published and adopted at ${plant.plant_code}` : "No governed plant resolved"}
      onClose={close} onOpenLibrary={close} onSelect={select}
      onCreate={mayCreate ? () => setCreating(true) : null}
      createPanel={creating && mayCreate
        ? <GovernedConstructionCreate plant={plant} gradeCodes={gradeCodes}
            onCancel={() => setCreating(false)} onCreated={created} />
        : null} />
  </div>;
}

const pickerButton = {
  padding: "4px 9px", borderRadius: 5, border: `1px solid ${C.border}`, background: C.white,
  color: C.slate, fontFamily: sans, fontSize: T.label, fontWeight: 700, whiteSpace: "nowrap",
};
