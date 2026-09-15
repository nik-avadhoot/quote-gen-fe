// ═══════════════════════════════════════════════════════════════════════════
// src/lib/gsmMaster.js — pure GSM Master helpers: ordering, picker model,
// input validation, request bodies and confirm copy.
//
// The GSM Master is a governed list (quote-gen-be migration
// 20260915120000_gsm_master.sql). A value is identity once a construction
// uses it, so there is no renumbering: add, retire, restore. A stored layer
// GSM that is retired or not in the master is SHOWN as such and kept exactly
// as saved — never blanked, rounded or silently replaced.
// ═══════════════════════════════════════════════════════════════════════════

export const GSM_MIN = 1;
export const GSM_MAX = 2000;

export function sortGsmValues(values) {
  return (Array.isArray(values) ? values : [])
    .filter(v => v && Number.isInteger(Number(v.gsm)))
    .slice()
    .sort((a, b) => Number(a.gsm) - Number(b.gsm));
}

// What a layer picker offers for its current stored value.
//   options      — active values, plus the stored value when it is not active
//   selected     — the option value the <select> should show
//   currentKind  — "blank" | "active" | "retired" | "off-list"
export function gsmPickerModel(values, current) {
  const sorted = sortGsmValues(values);
  const options = sorted.filter(v => v.status === "active")
    .map(v => ({ value: String(v.gsm), label: String(v.gsm), kind: "active" }));
  const raw = current === null || current === undefined ? "" : String(current).trim();
  if (raw === "") return { options, selected: "", currentKind: "blank" };

  const numeric = raw !== "" && Number.isFinite(Number(raw)) ? Number(raw) : null;
  const match = numeric === null ? null : sorted.find(v => Number(v.gsm) === numeric) || null;
  if (match && match.status === "active") {
    return { options, selected: String(match.gsm), currentKind: "active" };
  }
  const kind = match ? "retired" : "off-list";
  const label = match ? `${raw} · retired` : `${raw} · not in GSM Master`;
  return { options: [...options, { value: raw, label, kind }], selected: raw, currentKind: kind };
}

export function parseGsmInput(text, existing = []) {
  const raw = String(text ?? "").trim();
  if (!raw) return { ok: false, message: "Enter a GSM value." };
  if (!/^\d+$/.test(raw)) return { ok: false, message: "GSM must be a whole number." };
  const value = Number(raw);
  if (value < GSM_MIN || value > GSM_MAX) {
    return { ok: false, message: `GSM must be between ${GSM_MIN} and ${GSM_MAX}.` };
  }
  const already = (existing || []).find(v => Number(v.gsm) === value);
  if (already) {
    return { ok: false, message: already.status === "retired"
      ? `${value} GSM already exists and is retired — restore it instead.`
      : `${value} GSM is already in the GSM Master.` };
  }
  return { ok: true, value };
}

export const addGsmValueBody = value => ({ gsm: value });

export const gsmStatusBody = (row, status) => ({
  status, expected_content_version: row.content_version,
});

export function gsmStatusConfirmMessage(row, status) {
  return status === "retired"
    ? `Retire ${row.gsm} GSM? It will no longer be offered in construction layer pickers. `
      + "Saved constructions that already use it keep the value and show it as retired."
    : `Restore ${row.gsm} GSM? It will be offered again in construction layer pickers.`;
}
