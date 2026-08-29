// ═══════════════════════════════════════════════════════════════════════════
// src/lib/blanketConfirm.js — D-8b. The blanket-operation confirmations.
//
// Three controls on the Rate Master rewrite EVERY grade on one click:
// Disc → All, Credit% → All, and Apply GY. None of them asked first.
//
// ⚠️ PURE ON PURPOSE. No React, no window, no DOM. The implementer cannot reach
// these controls — they are admin-only (`role!=="admin"` disables the inputs and
// the Apply buttons do not render), so the DIALOG cannot be triggered or read by
// whoever wrote it. Keeping the text and the arithmetic in a pure function is what
// makes them verifiable in Node, outside the browser. Only the WIRING needs a
// human with admin. See §6 rule 6's exception conditions.
//
// ── WHY THE COUNT AND NOT "ALL" ──────────────────────────────────────────────
// `Apply GY` touches only *GY grades that have a natural pair — a SUBSET. A
// confirm that said "all grades" for it would be the app describing itself
// inaccurately, which is the same class of defect as D-11's stale messages.
// Every string here states affected-of-total.
//
// ── WHY gyAffected() LIVES HERE ──────────────────────────────────────────────
// `Apply GY` used to count inside its own setRates updater, so the number existed
// only AFTER the write — too late for a confirm. One helper now feeds BOTH the
// dialog and the updater, so the dialog's "6" and the toast's "6" cannot
// disagree. Mirror drift prevented before it exists rather than found later
// (cf. D-7, D-27).
// ═══════════════════════════════════════════════════════════════════════════

const EXAMPLE_LIMIT = 3;      // full 'desc + value' phrases — long
const CODE_LIMIT = 8;         // bare grade codes — short, so more fit readably

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// Renders "a, b, c (3 of 16 shown)" — the suffix appears ONLY when truncated.
// Without it a Maker cannot tell whether the ellipsis hides two grades or
// thirteen, and conveying the SPREAD is the whole point of the line.
const sample = (parts, total, limit = EXAMPLE_LIMIT) => {
  if (!parts || !parts.length) return "";
  if (parts.length <= limit) return parts.join(", ");
  return `${parts.slice(0, limit).join(", ")} (${limit} of ${total} shown)`;
};

// Do the CURRENT values actually differ? Dedupe on the VALUE, never on the rendered
// phrase — "16 BF ₹1.00" and "18 BF ₹1.00" are different strings and the same rate.
// Getting that wrong claimed variation where there was none; the Node fixture caught it.
// Entries may be plain strings (no value known → assume they vary) or {text, value}.
const _varies = (vals) => {
  const withValue = vals.filter((v) => v && typeof v === "object" && "value" in v);
  if (withValue.length !== vals.length) return true;
  return new Set(withValue.map((v) => String(v.value))).size > 1;
};

const scopeLine = (affected, total) =>
  affected === total
    ? `ALL ${plural(total, "grade", "grades")}`
    : `${affected} of ${plural(total, "grade", "grades")}`;

// Which *GY grades Apply GY would actually rewrite, and to what.
// A GY grade with no natural pair is skipped — the original updater returned it
// unchanged, and that behaviour is preserved exactly.
export const gyAffected = (rates, gyPremLow, gyPremHigh) =>
  (rates || [])
    .filter((gr) => (gr.code || "").endsWith("GY"))
    .map((gr) => {
      const bf = parseInt(gr.code) || 0;
      const nat = (rates || []).find((x) => x.code === gr.code.replace("GY", ""));
      if (!nat) return null;
      return {
        code: gr.code,
        from: gr.price,
        to: +(nat.price + (bf <= 24 ? gyPremLow : gyPremHigh)).toFixed(2),
      };
    })
    .filter(Boolean);

// Returns { text, actionable }.
//   actionable false  → nothing would change; the caller shows `text` and stops.
//   actionable true   → the caller passes `text` to window.confirm.
//
// kind "set"    — every affected grade is given the SAME new value.
// kind "recalc" — each affected grade gets its own derived value (Apply GY).
export const buildBlanketConfirm = ({
  kind = "set",
  label,
  valueText,
  affected,
  total,
  currentValues = [],   // [{text, value}] preferred; bare strings assumed to vary
  affectedCodes = [],
  detail = "",
} = {}) => {
  const n = +affected || 0;
  const t = +total || 0;

  if (n === 0)
    return {
      actionable: false,
      text: `No grades to change — ${label} would affect 0 of ${plural(t, "grade", "grades")}.`,
    };

  const head =
    kind === "recalc"
      ? `Recalculate ${label} on ${scopeLine(n, t)}?`
      : `Set ${label} to ${valueText} on ${scopeLine(n, t)}?`;

  const body =
    kind === "recalc"
      ? [detail, affectedCodes.length ? `Grades affected: ${sample(affectedCodes, n, CODE_LIMIT)}` : ""]
          .filter(Boolean)
          .join(" ")
      : `This overwrites ${label} on every grade in the Rate Master, including grades you have not looked at.` +
        (currentValues.length
          // "Current values vary" is a CLAIM, and it is FALSE when they are all the
          // same. Saying it anyway would be the app describing itself inaccurately —
          // the same defect as D-11's stale messages. Caught by running this in Node,
          // where the fixture happened to give every grade the same discount.
          ? ` ${_varies(currentValues) ? "Current values vary" : "Current values"}: ${sample(currentValues.map((v) => v.text ?? v), t)}`
          : "");

  return {
    actionable: true,
    text:
      `${head}\n\n${body}\n\n` +
      `Every calculated batch row will be cleared and must be recalculated.\n\n` +
      `OK = ${kind === "recalc" ? "recalculate" : "apply to"} ${n} · Cancel = change nothing`,
  };
};
