// ═══════════════════════════════════════════════════════════════════════════
// src/ui/GsmSelect.jsx — a construction layer's GSM picker, fed by the GSM
// Master. The value in and out is the same string the free number input used
// to carry, so no caller changes how it stores a layer GSM.
//
// States, each visibly distinct:
//   loading      — plain number input, as before
//   unavailable  — number input with a dashed amber border (free entry)
//   active value — the listed value
//   retired / not in master — kept as saved, amber border, labelled in the option
// ═══════════════════════════════════════════════════════════════════════════
import { gsmPickerModel } from "../lib/gsmMaster.js";
import { useGsmMaster } from "../state/useGsmMaster.js";
import { C } from "../theme.js";

export default function GsmSelect({ value, onChange, style = {}, ariaLabel = "GSM" }) {
  const master = useGsmMaster();

  if (master.status !== "ok") {
    const loading = master.status === "loading";
    return <input type="number" value={value ?? ""} onChange={e => onChange(e.target.value)}
      placeholder="GSM" aria-label={ariaLabel}
      title={loading ? "Loading the GSM Master…" : "GSM Master unavailable — free GSM entry until it can be read"}
      style={{ ...style, ...(loading ? {} : { border: `1px dashed ${C.amber}` }) }} />;
  }

  const model = gsmPickerModel(master.values, value);
  const flagged = model.currentKind === "retired" || model.currentKind === "off-list";
  return (
    <select value={model.selected} onChange={e => onChange(e.target.value)} aria-label={ariaLabel}
      title={flagged
        ? `${value} GSM is ${model.currentKind === "retired" ? "retired in" : "not in"} the GSM Master. It is kept as saved; choose a listed value to replace it.`
        : "GSM from the GSM Master"}
      style={{ ...style, ...(flagged ? { border: `1px solid ${C.amber}`, color: C.amberD } : {}) }}>
      <option value="">— GSM —</option>
      {model.options.map(option => (
        <option key={`${option.kind}-${option.value}`} value={option.value}>{option.label}</option>
      ))}
    </select>
  );
}
