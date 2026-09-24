// P0.3 view toolbar: preset / saved view selector, transpose, field grouping,
// Date display, Layout zones, save-as, delete and reset. Presentation state
// only; saved views live in this browser for this user and Customer.
import { useState } from "react";
import { C, T } from "../../theme.js";
import { DATE_MODES, PRESETS } from "../../lib/customerPricingLayout.js";
import { SelectIn, TextIn } from "./pricingFormBits.jsx";
import { primaryRowButton, rowButton } from "./pricingStyles.js";

const segment = on => ({ ...rowButton, background: on ? C.amberL : C.white, borderColor: on ? C.amber : C.border,
  color: on ? C.amberD : C.slateM });

export default function LayoutToolbar({ layout, active, named, persisted, fallback, zonesOpen, onToggleZones, onPreset,
  onNamed, onOp, onSaveAs, onDelete, onReset }) {
  const [naming, setNaming] = useState(null); // draft name or null
  const [error, setError] = useState(null);
  const names = Object.keys(named).sort((a, b) => a.localeCompare(b));
  const value = active.kind === "preset" ? `preset:${active.id}`
    : active.kind === "named" ? `named:${active.name}` : "custom";
  const choose = v => {
    if (v.startsWith("preset:")) onPreset(v.slice(7));
    else if (v.startsWith("named:")) onNamed(v.slice(6));
  };
  const save = () => {
    const problem = onSaveAs(naming);
    if (problem) setError(problem); else { setNaming(null); setError(null); }
  };
  const edited = active.kind === "named-edited" ? active.name : null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 6 }}
      aria-label="Pricing history view">
      <label style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: T.label, color: C.slateM }}>
        View
        <select value={value} onChange={e => choose(e.target.value)} aria-label="Pricing history view"
          style={{ ...rowButton, height: 22, fontWeight: 600 }}>
          <optgroup label="Presets">
            {PRESETS.map(p => <option key={p.id} value={`preset:${p.id}`}>{p.label}</option>)}
          </optgroup>
          {names.length > 0 && (
            <optgroup label="Saved on this browser">
              {names.map(n => <option key={n} value={`named:${n}`}>{n}</option>)}
            </optgroup>
          )}
          {value === "custom" && <option value="custom">{edited ? `${edited} (changed)` : "Custom (unsaved)"}</option>}
        </select>
      </label>
      <button type="button" aria-pressed={layout.orientation === "transposed"} style={segment(layout.orientation === "transposed")}
        title="Swap rows and columns: fields as rows, cycles/lines as columns" onClick={() => onOp({ type: "transpose" })}>
        ⇄ Transpose</button>
      <button type="button" aria-pressed={layout.grouped} style={segment(layout.grouped)}
        onClick={() => onOp({ type: layout.grouped ? "ungroup" : "group" })}>
        {layout.grouped ? "Ungroup fields" : "Group fields"}</button>
      <label style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: T.label, color: C.slateM }}>
        Date shows
        <SelectIn value={layout.dateMode} onChange={mode => onOp({ type: "dateMode", mode })} opts={DATE_MODES} width={140}
          aria-label="Date display" />
      </label>
      <button type="button" aria-expanded={zonesOpen} style={segment(zonesOpen)} onClick={onToggleZones}>Layout ▾</button>
      {naming === null ? (
        <button type="button" style={rowButton} onClick={() => { setNaming(active.name || ""); setError(null); }}
          disabled={!persisted} title={persisted ? "Save this arrangement for this Customer on this browser"
            : "Saved views need a signed-in user"}>Save view…</button>
      ) : (
        <span style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
          <TextIn value={naming} onChange={setNaming} width={140} aria-label="View name" placeholder="View name" autoFocus
            onKeyDown={e => { if (e.key === "Enter") save(); if (e.key === "Escape") setNaming(null); }} />
          <button type="button" style={primaryRowButton} onClick={save}>Save</button>
          <button type="button" style={rowButton} onClick={() => { setNaming(null); setError(null); }}>Cancel</button>
        </span>
      )}
      {active.kind === "named" && (
        <button type="button" style={rowButton} onClick={() => onDelete(active.name)}
          title="Delete this saved view from this browser">Delete view</button>
      )}
      <button type="button" style={rowButton} onClick={onReset} title="Back to the standard Customer-pricing layout">Reset</button>
      {error && <span role="alert" style={{ color: C.red, fontSize: T.label }}>{error}</span>}
      {fallback && (
        <span role="status" style={{ color: C.amberD, fontSize: T.label }}>
          The saved layout on this browser could not be used ({fallback}); showing the standard layout. Pricing data is unaffected.
        </span>
      )}
    </div>
  );
}
