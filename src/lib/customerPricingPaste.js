// ═══════════════════════════════════════════════════════════════════════════
// src/lib/customerPricingPaste.js — Customer Pricing History P0.4, clipboard
// parsing and the paste PREVIEW model. Pure: no React, no network, no storage.
//
// Authority: docs/customer-pricing-history-phase-0-implementation-plan-2026-09-23.md §7.
//
// MAPPING. A pasted block lands on the active layout from an anchor cell. Each
// pasted cell is mapped through the layout's canonical field descriptor and the
// canonical record the cell renders (lib/customerPricingLayout.js) — never
// through a column letter or a guessed header — so Standard, Transposed,
// reordered, grouped and hidden-field layouts all reach the same record + field.
// Rows beyond the last shown record are NEW lines in an explicitly chosen Cycle.
//
// RULES (plan §7):
//   • a blank cell never erases — clearing needs an explicit per-cell Clear;
//   • INR is exact two-decimal text; "0" stays 0.00; a third decimal is refused;
//   • Location / Plant / SKU / BF grade match only by EXACT code — never fuzzy;
//     an unresolved item may be kept as free-text scope, never as a new identity;
//   • derived, summary, audit and elsewhere-owned fields are never write targets;
//   • duplicates and ambiguous matches stay blocked until explicitly resolved;
//   • a pasted rate ADDS a round (history is never overwritten) and keeps the
//     original wording as its source reference.
//
// The server re-validates every operation (routes: /pricing-paste/preview and
// /apply); this model exists so the user sees the verdicts before sending.
// ═══════════════════════════════════════════════════════════════════════════
import { cycleLabel, negotiationSummary, orderedEvents, parseBoxes, parseInr, parsePct, scopeDisplay, sobDisplay, toPaise,
  formatInr } from "./customerPricingModel.js";
import { recordLabel } from "./customerPricingLayout.js";

export const PASTE_MAX_CELLS = 4000;
export const PASTE_MAX_OPS = 200;

// ── clipboard ───────────────────────────────────────────────────────────────
// Excel / Google Sheets put TSV on the clipboard: tab between cells, CRLF
// between rows, and a cell containing a tab, newline or quote wrapped in
// quotes with inner quotes doubled. The trailing row break is not a row.
export function parseClipboard(text) {
  const src = String(text ?? "").replace(/\r\n?/g, "\n");
  const rows = [];
  let row = [], cell = "", i = 0, quoted = false;
  while (i < src.length) {
    const ch = src[i];
    if (quoted) {
      if (ch === "\"" && src[i + 1] === "\"") { cell += "\""; i += 2; continue; }
      if (ch === "\"") { quoted = false; i += 1; continue; }
      cell += ch; i += 1; continue;
    }
    if (ch === "\"" && cell === "") { quoted = true; i += 1; continue; }
    if (ch === "\t") { row.push(cell); cell = ""; i += 1; continue; }
    if (ch === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; i += 1; continue; }
    cell += ch; i += 1;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  const width = rows.reduce((m, r) => Math.max(m, r.length), 0);
  const cells = rows.length * width;
  if (cells > PASTE_MAX_CELLS) return { rows: [], error: `That block has ${cells} cells; paste at most ${PASTE_MAX_CELLS} at a time.` };
  return { rows: rows.map(r => [...r, ...Array(width - r.length).fill("")]), error: null };
}

// ── typed cell parsers (exact, never guessing) ─────────────────────────────
const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11,
  dec: 12, january: 1, february: 2, march: 3, april: 4, june: 6, july: 7, august: 8, september: 9, october: 10,
  november: 11, december: 12 };
const iso = (y, m, d) => {
  const t = new Date(Date.UTC(y, m - 1, d));
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== m - 1 || t.getUTCDate() !== d) return null;
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
};

// ISO, or DAY-FIRST (Indian) d/m/yyyy, d-m-yyyy, d.m.yyyy, or d-Mon-yyyy.
// A month-first US date with a day above 12 is invalid, never swapped.
export function parsePasteDate(raw) {
  const t = String(raw ?? "").trim();
  if (!t) return { ok: true, value: null };
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (m) { const v = iso(+m[1], +m[2], +m[3]); return v ? { ok: true, value: v } : { ok: false, error: "Not a real date" }; }
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(t);
  if (m) {
    const v = iso(+m[3], +m[2], +m[1]);
    return v ? { ok: true, value: v } : { ok: false, error: "Not a real date (dates are read day-first: dd/mm/yyyy)" };
  }
  m = /^(\d{1,2})[\s-]([A-Za-z]{3,9})[\s-,]*(\d{4})$/.exec(t);
  if (m && MONTHS[m[2].toLowerCase()]) {
    const v = iso(+m[3], MONTHS[m[2].toLowerCase()], +m[1]);
    return v ? { ok: true, value: v } : { ok: false, error: "Not a real date" };
  }
  if (/^\d{5}$/.test(t)) return { ok: false, error: "A spreadsheet date serial — format the column as a date and copy again" };
  return { ok: false, error: "Use a date such as 30/08/2026 or 2026-08-30" };
}

const SOB_WORDS = {
  "undefined": "undefined", "customer left undefined": "undefined", "left undefined": "undefined",
  "not applicable": "not_applicable", "n/a": "not_applicable", "na": "not_applicable",
  "not captured": "not_captured", "not yet captured": "not_captured",
};
// P0.4.1: a SOB cell is a percentage ONLY when it says "%", an allocated box
// quantity ONLY when it says "box"/"boxes". A bare number is never guessed:
// it stays blocked ("ambiguous") until the user explicitly chooses
// `mode` = "percentage" or "allocated_quantity" for that cell in the preview.
// The value is always the full triple, so the other kind is explicitly cleared.
const sobTriple = (state, pct = null, boxes = null) => ({ sob_state: state, sob_pct: pct, sob_allocated_boxes: boxes });
const asPct = (text, bare) => {
  const p = parsePct(text, { required: true });
  return p.ok ? { ok: true, bare, value: sobTriple("percentage", p.value) }
    : { ok: false, bare, error: `SOB %: ${p.error === "Must not exceed 100.00" ? "0 to 100" : p.error}` };
};
const asBoxes = (text, bare) => {
  const b = parseBoxes(text, { required: true });
  return b.ok ? { ok: true, bare, value: sobTriple("allocated_quantity", null, b.value) }
    : { ok: false, bare, error: `Allocated boxes: ${b.error}` };
};
export function parsePasteSob(raw, mode = null) {
  const t = String(raw ?? "").trim();
  if (!t) return { ok: true, value: null };
  const word = SOB_WORDS[t.toLowerCase()];
  if (word) return { ok: true, value: sobTriple(word) };
  let m = /^(.*?)\s*%$/.exec(t);
  if (m) return asPct(m[1], false);
  m = /^(.*?)\s*box(?:es)?$/i.exec(t);
  if (m) return asBoxes(m[1], false);
  if (/^[0-9][0-9.,]*$/.test(t)) {
    if (mode === "percentage") return asPct(t, true);
    if (mode === "allocated_quantity") return asBoxes(t, true);
    return { ok: false, bare: true, status: "ambiguous",
      error: `"${t}" could be a % or a number of boxes — choose "Treat as %" or "Treat as boxes" (or paste "${t}%" / "${t} boxes")` };
  }
  return { ok: false, error: "SOB is a % (40%), allocated boxes (25,000 boxes), or: undefined / not applicable / not captured" };
}

// ── paste targets: the ONLY fields a paste may write ──────────────────────
// Everything else in the registry is derived, a summary, audit, or owned by a
// form elsewhere (terms, mechanism, measures, BF rows) and is never written.
export const PASTE_TARGETS = {
  "cycle.custom_label": { kind: "cycle_text", key: "custom_label", max: 80 },
  "cycle.notes": { kind: "cycle_text", key: "notes", max: 2000 },
  "line.scope_text": { kind: "line_text", key: "scope_text", max: 200 },
  "line.notes": { kind: "line_text", key: "notes", max: 2000 },
  "line.sob": { kind: "sob" },
  "line.location": { kind: "identity", key: "customer_location_id" },
  "line.plant": { kind: "identity", key: "plant_id" },
  "line.sku": { kind: "identity", key: "sku_id" },
  "neg.our_offer": { kind: "round", eventType: "avadhoot_offer" },
  "neg.customer_offer": { kind: "round", eventType: "customer_counter" },
  "neg.final_agreed": { kind: "round", eventType: "final_agreement" },
  "neg.final_date": { kind: "round_date" },
};
const ROUND_ORDER = ["avadhoot_offer", "customer_counter", "final_agreement"];

export function notTargetReason(field) {
  if (!field) return "Outside the shown layout — not pasted";
  if (field.id.startsWith("bf:")) return "Agreed BF rates are pasted in the expanded BF schedule";
  if (field.owner === "term" || field.owner === "mechanism" || field.owner === "bf_set") {
    return "Owned by the Customer's Stable Terms / mechanism — edit it there";
  }
  if (field.owner === "measure") return "Weights and area are recorded per source in the line detail";
  return "Derived or summary value — never a paste target";
}

// ── mapping through the active layout ─────────────────────────────────────
// visibleKeys: the record keys in the order they are RENDERED (collapsed
// groups and non-data rows excluded). anchor: { recordKey, fieldId }.
export function mapPaste({ rows, view, visibleKeys, anchor }) {
  const byKey = new Map(view.records.map(r => [r.key, r]));
  const records = (visibleKeys || view.records.map(r => r.key)).map(k => byKey.get(k)).filter(Boolean);
  const fields = view.fields;
  const r0 = Math.max(0, records.findIndex(r => r.key === anchor?.recordKey));
  const f0 = Math.max(0, fields.findIndex(f => f.id === anchor?.fieldId));
  const transposed = view.orientation === "transposed";
  const out = [];
  rows.forEach((row, i) => row.forEach((text, j) => {
    const ri = r0 + (transposed ? j : i);
    const fi = f0 + (transposed ? i : j);
    const field = fields[fi] || null;
    const record = records[ri] || null;
    out.push({ key: `${i}:${j}`, i, j, text, field, record, slot: record ? null : ri - records.length });
  }));
  return out;
}

// ── identity resolution: EXACT code only ─────────────────────────────────
const ANY_WORDS = { customer_location_id: ["any location", "whole customer"], plant_id: ["any plant"], sku_id: [] };
export function resolveIdentity(key, raw, data, plantId = null) {
  const t = String(raw ?? "").trim();
  if (!t || ANY_WORDS[key].includes(t.toLowerCase())) return { ok: true, id: null };
  let hits = [];
  if (key === "customer_location_id") hits = (data.locations || []).filter(l => l.location_code === t);
  if (key === "plant_id") hits = (data.plants || []).filter(p => p.plant_code === t);
  if (key === "sku_id") {
    hits = (data.skus || []).filter(k => k.plant_item_code === t && (plantId == null || k.plant_id === plantId));
  }
  if (hits.length === 1) return { ok: true, id: hits[0].id };
  if (hits.length > 1) return { ok: false, status: "ambiguous", error: `"${t}" matches ${hits.length} records — resolve it in the master first` };
  return { ok: false, status: "unresolved", error: `"${t}" is not an exact ${key === "customer_location_id" ? "Location code"
    : key === "plant_id" ? "Plant code" : "SKU code"} of this Customer — nothing is linked` };
}

const scopeKey = s => [s.customer_location_id ?? 0, s.plant_id ?? 0, s.sku_id ?? 0,
  String(s.scope_text ?? "").trim().toLowerCase()].join("|");
const blankish = v => v === null || v === undefined || v === "";
const same = (a, b) => (blankish(a) && blankish(b)) || a === b;
const clip = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const sobText = s => sobDisplay(s);
const sobModeOf = (D, key) => (D.sobAsPct.has(key) ? "percentage" : D.sobAsBoxes.has(key) ? "allocated_quantity" : null);

export const BLOCKING = new Set(["invalid", "unresolved", "ambiguous", "duplicate", "identity-mismatch", "conflict"]);

// ── the plan ──────────────────────────────────────────────────────────────
// decisions: { clear:Set<cellKey>, skip:Set<cellKey>, keepAsText:Set<cellKey>, acceptDuplicate:Set<cellKey>,
//              sobAsPct:Set<cellKey>, sobAsBoxes:Set<cellKey> }  (the explicit mode for a bare SOB number)
// options:   { newLineCycleId, roundDate, gstPct }
// → { cells, targets, ops, opCells, counts, blocking, planIssues }
export function buildPastePlan({ entries, data, ctx, decisions = {}, options = {} }) {
  const D = { clear: new Set(), skip: new Set(), keepAsText: new Set(), acceptDuplicate: new Set(),
    sobAsPct: new Set(), sobAsBoxes: new Set(), ...decisions };
  const cells = entries.map(e => ({ ...e, status: "blank", message: "Blank — nothing changes", before: null, after: null,
    canClear: false }));
  const planIssues = [];
  const roundDate = parsePasteDate(options.roundDate);
  const mechTax = data?.mechanism?.tax_treatment || "excluding_gst";
  const gst = mechTax === "including_gst" ? parsePct(options.gstPct, { required: true, allowZero: false }) : { ok: true, value: null };
  const cycles = new Map((data?.cycles || []).map(c => [c.id, c]));
  const cycleOps = new Map(); const lineOps = new Map(); const newLines = new Map(); const rounds = [];
  const byRow = new Map();

  const set = (cell, status, message, before = null, after = null) => Object.assign(cell, { status, message, before, after });
  for (const cell of cells) {
    const rowKey = cell.record ? cell.record.key : `new:${cell.slot}`;
    if (!byRow.has(rowKey)) byRow.set(rowKey, []);
    byRow.get(rowKey).push(cell);
  }

  for (const rowCells of byRow.values()) {
    const rec = rowCells[0].record;
    const isNew = !rec;
    const nonBlank = rowCells.some(c => String(c.text).trim() !== "");
    const dateCell = rowCells.find(c => c.field && PASTE_TARGETS[c.field.id]?.kind === "round_date");
    let finalDate = null;
    if (dateCell && String(dateCell.text).trim()) {
      const d = parsePasteDate(dateCell.text);
      if (!d.ok) set(dateCell, "invalid", d.error);
      else { finalDate = d.value; set(dateCell, "context", `Agreement date for this row's final agreement: ${d.value}`); }
    }
    const newLine = isNew && nonBlank ? { key: `n${rowCells[0].slot + 1}`, cells: [], scope: {}, sob: null, notes: undefined, text: [] } : null;

    for (const cell of rowCells) {
      if (cell === dateCell) continue;
      const text = String(cell.text ?? "");
      const t = text.trim();
      if (D.skip.has(cell.key)) { set(cell, "skipped", "Skipped by you — not applied"); continue; }
      if (!cell.field) { if (t) set(cell, "outside", "Outside the shown layout — not pasted"); continue; }
      const target = PASTE_TARGETS[cell.field.id];
      if (!target) { if (t) set(cell, "not-target", notTargetReason(cell.field)); continue; }
      if (isNew && !newLine) continue;

      // ── existing record ───────────────────────────────────────────────
      if (!isNew) {
        const line = rec.line; const cycle = rec.cycle;
        if (target.kind === "cycle_text") {
          const cur = cycle[target.key] || null;
          cell.canClear = !blankish(cur);
          if (!t) {
            if (D.clear.has(cell.key) && cell.canClear) {
              set(cell, "clear", "Clear — accepted by you", cur, null);
              pushCycle(cycleOps, cycle, target.key, null, cell);
            }
            continue;
          }
          if (t.length > target.max) { set(cell, "invalid", `At most ${target.max} characters`); continue; }
          if (same(t, cur)) { set(cell, "unchanged", "Same as recorded", cur, t); continue; }
          set(cell, "changed", "Changes the Cycle", cur, t);
          pushCycle(cycleOps, cycle, target.key, t, cell);
          continue;
        }
        if (!line) { if (t) set(cell, "not-target", "This Cycle has no line here — add a line first"); continue; }
        if (target.kind === "line_text") {
          const cur = line[target.key] || null;
          cell.canClear = !blankish(cur);
          if (!t) {
            if (D.clear.has(cell.key) && cell.canClear) {
              set(cell, "clear", "Clear — accepted by you", cur, null);
              pushLine(lineOps, line, { [target.key]: null }, cell);
            }
            continue;
          }
          if (t.length > target.max) { set(cell, "invalid", `At most ${target.max} characters`); continue; }
          if (same(t, cur)) { set(cell, "unchanged", "Same as recorded", cur, t); continue; }
          set(cell, "changed", "Changes the line", cur, t);
          pushLine(lineOps, line, { [target.key]: t }, cell);
          continue;
        }
        if (target.kind === "sob") {
          const state = line.sob_state || "not_captured";
          const cur = sobTriple(state, state === "percentage" ? line.sob_pct ?? null : null,
            state === "allocated_quantity" ? line.sob_allocated_boxes ?? null : null);
          cell.canClear = cur.sob_state !== "not_captured";
          if (!t) {
            if (D.clear.has(cell.key) && cell.canClear) {
              set(cell, "clear", "Clear — back to Not yet captured (both % and boxes emptied)", sobText(cur),
                sobText(sobTriple("not_captured")));
              pushLine(lineOps, line, sobTriple("not_captured"), cell);
            }
            continue;
          }
          const p = parsePasteSob(t, sobModeOf(D, cell.key));
          cell.sobModeChoice = !!p.bare;
          if (!p.ok) { set(cell, p.status || "invalid", p.error); continue; }
          if (p.value.sob_state === cur.sob_state && same(p.value.sob_pct, cur.sob_pct)
              && same(p.value.sob_allocated_boxes, cur.sob_allocated_boxes)) {
            set(cell, "unchanged", "Same as recorded", sobText(cur), sobText(p.value)); continue;
          }
          set(cell, "changed", "Changes Share of Business", sobText(cur), sobText(p.value));
          pushLine(lineOps, line, p.value, cell);
          continue;
        }
        if (target.kind === "identity") {
          if (!t) continue;
          const res = resolveIdentity(target.key, t, data, line.plant_id ?? null);
          if (res.ok && same(res.id, line[target.key])) { set(cell, "unchanged", "Matches this line's scope"); continue; }
          set(cell, "identity-mismatch", "Paste never changes an existing line's scope — skip this cell, or edit the line");
          continue;
        }
        if (target.kind === "round") {
          if (!t) continue;
          const r = parseInr(t, { required: true });
          if (!r.ok) { set(cell, "invalid", r.error); continue; }
          const s = negotiationSummary(line.events);
          const cur = target.eventType === "avadhoot_offer" ? s.ourOffer
            : target.eventType === "customer_counter" ? s.customerOffer : s.finalAgreed;
          if (cur && toPaise(cur.rate_inr) === toPaise(r.value)) {
            set(cell, "unchanged", "Same as the recorded value", formatInr(cur.rate_inr), formatInr(r.value)); continue;
          }
          if (target.eventType === "avadhoot_offer" && cur) {
            set(cell, "invalid", "The first offer is already recorded — correct it in the round history, not by paste",
              formatInr(cur.rate_inr), formatInr(r.value));
            continue;
          }
          const date = target.eventType === "final_agreement" && finalDate ? finalDate : roundDate.value;
          const dup = orderedEvents(line.events).find(e => e.event_type === target.eventType && e.event_date === date
            && toPaise(e.rate_inr) === toPaise(r.value));
          if (dup && !D.acceptDuplicate.has(cell.key)) {
            set(cell, "duplicate", `The same round is already recorded (round #${dup.sequence_no}) — accept to record it again`,
              formatInr(cur?.rate_inr), formatInr(r.value));
            continue;
          }
          set(cell, "changed", `Adds a new ${labelOfRound(target.eventType)} round${date ? ` dated ${date}` : ""}`,
            formatInr(cur?.rate_inr), formatInr(r.value));
          rounds.push({ cell, line_id: line.id, event_type: target.eventType, rate_inr: r.value, event_date: date, original: t,
            accept: !!dup });
          continue;
        }
        continue;
      }

      // ── new line (row beyond the shown records) ───────────────────────
      if (target.kind === "cycle_text") { if (t) set(cell, "not-target", "A new line cannot change its Cycle here"); continue; }
      newLine.cells.push(cell);
      if (!t) continue;
      if (target.kind === "identity") {
        const plantId = newLine.scope.plant_id ?? null;
        const res = resolveIdentity(target.key, t, data, target.key === "sku_id" ? plantId : null);
        if (res.ok) { newLine.scope[target.key] = res.id; set(cell, "matched", res.id == null ? "Whole Customer — no identity" : "Exact match", null, t); continue; }
        if (D.keepAsText.has(cell.key) && res.status === "unresolved") {
          newLine.text.push(t);
          set(cell, "free-text", "Kept as free-text item scope — no identity linked", null, t);
          continue;
        }
        set(cell, res.status, res.error);
        continue;
      }
      if (target.kind === "line_text") {
        if (t.length > target.max) { set(cell, "invalid", `At most ${target.max} characters`); continue; }
        if (target.key === "scope_text") newLine.text.unshift(t); else newLine.notes = t;
        set(cell, target.key === "scope_text" ? "free-text" : "new", target.key === "scope_text"
          ? "Free-text item scope — no identity invented" : "New line notes", null, t);
        continue;
      }
      if (target.kind === "sob") {
        const p = parsePasteSob(t, sobModeOf(D, cell.key));
        cell.sobModeChoice = !!p.bare;
        if (!p.ok) { set(cell, p.status || "invalid", p.error); continue; }
        newLine.sob = p.value;
        set(cell, "new", "New line SOB", null, sobText(p.value));
        continue;
      }
      if (target.kind === "round") {
        const r = parseInr(t, { required: true });
        if (!r.ok) { set(cell, "invalid", r.error); continue; }
        const date = target.eventType === "final_agreement" && finalDate ? finalDate : roundDate.value;
        set(cell, "new", `First ${labelOfRound(target.eventType)} round on the new line${date ? ` dated ${date}` : ""}`, null, formatInr(r.value));
        rounds.push({ cell, line_key: newLine.key, event_type: target.eventType, rate_inr: r.value, event_date: date, original: t });
      }
    }
    if (newLine) newLines.set(newLine.key, newLine);
  }

  // Scope identity of each new line, then deterministic duplicate detection:
  // an existing active line, or an EARLIER new row, with the same exact scope.
  const cycleId = options.newLineCycleId ? Number(options.newLineCycleId) : null;
  const targetCycle = cycleId ? cycles.get(cycleId) : null;
  const existingScopes = new Set((targetCycle?.lines || []).filter(l => (l.status || "active") === "active").map(scopeKey));
  const seenNew = new Set();
  for (const nl of newLines.values()) {
    const blocked = nl.cells.some(c => BLOCKING.has(c.status));
    nl.scope.scope_text = nl.text.join(" · ").slice(0, 200) || null;
    const k = scopeKey(nl.scope);
    if (!blocked && (existingScopes.has(k) || seenNew.has(k))) {
      for (const c of nl.cells) if (c.status !== "blank") set(c, "duplicate", "A line with exactly this scope already exists in that Cycle");
    }
    seenNew.add(k);
  }

  // Conflicting values for one Cycle field (several lines of one Cycle pasted differently).
  for (const entry of cycleOps.values()) {
    for (const [key, cellsFor] of Object.entries(entry.cellsBy)) {
      const values = new Set(cellsFor.map(c => (c.status === "clear" ? null : String(c.text).trim())));
      if (values.size > 1) for (const c of cellsFor) set(c, "conflict", "Different values pasted for one Cycle field");
      if (values.size > 1) delete entry.set[key];
    }
  }

  const hasNew = [...newLines.values()].some(nl => nl.cells.some(c => c.status !== "blank"));
  if (hasNew && !targetCycle) planIssues.push("Choose the Cycle the new lines belong to");
  if (rounds.length && !roundDate.value) planIssues.push(roundDate.ok ? "Set the round date" : `Round date: ${roundDate.error}`);
  if (rounds.length && !gst.ok) planIssues.push("This Customer's rates include GST — enter the GST % that applied");

  // ── operations (blocked cells contribute nothing) ─────────────────────
  const ops = []; const opCells = [];
  const ok = c => !BLOCKING.has(c.status);
  for (const e of cycleOps.values()) {
    if (Object.keys(e.set).length && e.cells.every(ok)) {
      ops.push({ op: "update_cycle", cycle_id: e.cycle.id, expected_version: e.cycle.content_version, set: e.set });
      opCells.push(e.cells.map(c => c.key));
    }
  }
  for (const e of lineOps.values()) {
    if (e.cells.every(ok)) {
      ops.push({ op: "update_line", line_id: e.line.id, expected_version: e.line.content_version, set: e.set });
      opCells.push(e.cells.map(c => c.key));
    }
  }
  const liveNew = new Set();
  for (const nl of newLines.values()) {
    const filled = nl.cells.filter(c => c.status !== "blank" && c.status !== "skipped");
    if (!filled.length || !filled.every(ok) || !targetCycle) continue;
    liveNew.add(nl.key);
    ops.push({ op: "create_line", key: nl.key, cycle_id: targetCycle.id,
      customer_location_id: nl.scope.customer_location_id ?? null, plant_id: nl.scope.plant_id ?? null,
      sku_id: nl.scope.sku_id ?? null, scope_text: nl.scope.scope_text,
      ...(nl.sob ? nl.sob : {}), ...(nl.notes !== undefined ? { notes: nl.notes } : {}) });
    opCells.push(filled.filter(c => c.field && PASTE_TARGETS[c.field.id]?.kind !== "round").map(c => c.key));
  }
  const sortedRounds = rounds.slice().sort((a, b) => ROUND_ORDER.indexOf(a.event_type) - ROUND_ORDER.indexOf(b.event_type));
  for (const r of sortedRounds) {
    if (!ok(r.cell) || (r.line_key && !liveNew.has(r.line_key)) || !r.event_date) continue;
    ops.push({ op: "add_round", ...(r.line_key ? { line_key: r.line_key } : { line_id: r.line_id }),
      event_type: r.event_type, event_date: r.event_date, rate_inr: r.rate_inr,
      ...(mechTax === "including_gst" ? { tax_treatment: "including_gst", gst_pct: gst.value } : {}),
      source_ref: clip(`Excel/Sheets paste: ${r.original}`, 500),
      ...(r.accept ? { accept_possible_duplicate: true } : {}) });
    opCells.push([r.cell.key]);
  }

  const counts = { newRecords: liveNew.size, matched: new Set(cells.filter(c => c.record && c.status !== "blank").map(c => c.record.key)).size };
  for (const c of cells) counts[c.status] = (counts[c.status] || 0) + 1;
  const blocking = cells.filter(c => BLOCKING.has(c.status)).length + planIssues.length;
  if (ops.length > PASTE_MAX_OPS) planIssues.push(`At most ${PASTE_MAX_OPS} changes per batch — paste fewer rows`);

  const targets = [...byRow.entries()].map(([rowKey, rowCells]) => {
    const rec = rowCells[0].record;
    return { rowKey, isNew: !rec, label: rec ? recordLabel(rec, ctx) : `New line ${rowCells[0].slot + 1}`
      + (targetCycle ? ` in ${cycleLabel(targetCycle, ctx.labelStyle)}` : ""),
      cells: rowCells };
  });
  return { cells, targets, ops, opCells, counts, blocking: blocking + (ops.length > PASTE_MAX_OPS ? 1 : 0), planIssues };
}

function labelOfRound(t) {
  return t === "avadhoot_offer" ? "Our offer" : t === "customer_counter" ? "Customer counter" : "Final agreement";
}

function pushCycle(map, cycle, key, value, cell) {
  if (!map.has(cycle.id)) map.set(cycle.id, { cycle, set: {}, cells: [], cellsBy: {} });
  const e = map.get(cycle.id);
  e.set[key] = value; e.cells.push(cell);
  (e.cellsBy[key] ||= []).push(cell);
}

function pushLine(map, line, values, cell) {
  if (!map.has(line.id)) map.set(line.id, { line, set: {}, cells: [] });
  const e = map.get(line.id);
  Object.assign(e.set, values); e.cells.push(cell);
}

export const pasteRequestBody = plan => ({ operations: plan.ops });

// Server issues (by operation index) back onto the pasted cells that made them.
export function issuesToCells(plan, issues) {
  const out = new Map();
  for (const issue of issues || []) {
    for (const key of plan.opCells[issue.index] || []) out.set(key, issue);
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════════════════
// BF schedule paste — into ONE round's own snapshotted schedule.
//
// Accepts "GRADE <tab> RATE" rows, or a single column of rates laid on the
// schedule's rows from the anchor grade down. The rate is the effective rate
// the Customer states. Equal to the derived rate: no change (an existing
// override is only cleared by an explicit decision). Different: it becomes an
// OVERRIDE — never silently; the preview needs `acceptOverrides`.
// ═══════════════════════════════════════════════════════════════════════════
const GRADE = /^[0-9]{1,3}[A-Za-z]{0,4}$/;
export function buildBfPastePlan({ event, rows, anchorGrade = null, decisions = {}, options = {} }) {
  const D = { clear: new Set(), skip: new Set(), ...decisions };
  const schedule = event?.bf_schedule || [];
  const nonEmpty = rows.filter(r => r.some(c => String(c).trim() !== ""));
  const keyed = nonEmpty.length > 0 && nonEmpty.every(r => r.length >= 2 && GRADE.test(String(r[0]).trim()));
  const start = Math.max(0, schedule.findIndex(s => s.bf_code === anchorGrade));
  const seen = new Set();
  const items = [];
  rows.forEach((row, i) => {
    const key = `bf:${i}`;
    const rawGrade = keyed ? String(row[0]).trim() : schedule[start + i]?.bf_code;
    const text = String(keyed ? row[1] : row[0] ?? "").trim();
    const item = { key, i, grade: rawGrade ? String(rawGrade).toUpperCase() : null, text, status: "blank",
      message: "Blank — nothing changes", derived: null, override: null, after: null, canClear: false };
    items.push(item);
    if (!keyed && !String(row[0] ?? "").trim() && !rawGrade) return;
    if (D.skip.has(key)) { Object.assign(item, { status: "skipped", message: "Skipped by you — not applied" }); return; }
    if (!item.grade) { if (text) Object.assign(item, { status: "outside", message: "Below the last grade of this round — not pasted" }); return; }
    const row0 = schedule.find(s => s.bf_code === item.grade);
    if (!row0) {
      Object.assign(item, { status: "unresolved", message: `BF ${item.grade} is not in this round's snapshotted schedule — a new grade needs a new BF set version` });
      return;
    }
    item.derived = row0.derived_rate_inr; item.override = row0.override_rate_inr;
    item.canClear = row0.override_rate_inr != null;
    if (seen.has(item.grade)) { Object.assign(item, { status: "duplicate", message: `BF ${item.grade} is pasted more than once` }); return; }
    seen.add(item.grade);
    if (!text) {
      if (D.clear.has(key) && item.canClear) Object.assign(item, { status: "clear", message: "Clear the override — back to the derived rate", after: null });
      return;
    }
    const r = parseInr(text, { required: true });
    if (!r.ok) { Object.assign(item, { status: "invalid", message: r.error }); return; }
    item.after = r.value;
    if (row0.is_base) {
      Object.assign(item, toPaise(r.value) === toPaise(row0.derived_rate_inr)
        ? { status: "unchanged", message: "Base BF — equals the round's rate" }
        : { status: "invalid", message: "The base BF is the round's own rate — correct the round instead" });
      return;
    }
    if (row0.override_rate_inr != null && toPaise(r.value) === toPaise(row0.override_rate_inr)) {
      Object.assign(item, { status: "unchanged", message: "Same as the recorded override" }); return;
    }
    if (row0.derived_rate_inr != null && toPaise(r.value) === toPaise(row0.derived_rate_inr)) {
      Object.assign(item, row0.override_rate_inr == null
        ? { status: "unchanged", message: "Equals the derived rate — stays derived (no override)" }
        : D.clear.has(key)
          ? { status: "clear", message: "Clear the override — back to the derived rate (chosen by you)", after: null }
          : { status: "matches-derived", message: "Equals the derived rate; the override is kept unless you choose Clear" });
      return;
    }
    Object.assign(item, options.acceptOverrides
      ? { status: "override", message: `Becomes an OVERRIDE (derived ${formatInr(row0.derived_rate_inr)})` }
      : { status: "needs-override-consent", message: `Differs from the derived ${formatInr(row0.derived_rate_inr)} — tick “Record as overrides” to accept` });
  });
  const ops = []; const opCells = [];
  for (const it of items) {
    if (it.status === "override" || it.status === "clear") {
      ops.push({ op: "set_bf_override", event_id: event.id, expected_version: event.content_version, bf_code: it.grade,
        override_rate_inr: it.status === "clear" ? null : it.after });
      opCells.push([it.key]);
    }
  }
  const blockingStatuses = new Set(["invalid", "unresolved", "duplicate", "needs-override-consent"]);
  const counts = {};
  for (const it of items) counts[it.status] = (counts[it.status] || 0) + 1;
  return { mode: keyed ? "grade-keyed" : "positional", items, ops, opCells, counts,
    blocking: items.filter(it => blockingStatuses.has(it.status)).length,
    target: event ? { eventId: event.id, version: event.content_version, sequence: event.sequence_no } : null };
}

export const pasteStatusLabel = {
  changed: "Change", unchanged: "Unchanged", blank: "Blank (kept)", clear: "Clear", invalid: "Invalid",
  unresolved: "Unresolved", ambiguous: "Ambiguous", duplicate: "Possible duplicate", "identity-mismatch": "Scope differs",
  conflict: "Conflict", "not-target": "Not a paste target", outside: "Outside layout", skipped: "Skipped",
  "free-text": "Free-text scope", matched: "Exact match", new: "New", context: "Date context",
  override: "Override", "matches-derived": "= derived", "needs-override-consent": "Needs override consent",
};

export function scopeOf(line, data) {
  return scopeDisplay(line, { locations: data?.locations || [], plants: data?.plants || [] });
}
