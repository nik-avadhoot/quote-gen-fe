// ═══════════════════════════════════════════════════════════════════════════
// src/ui/dataDisplay.jsx — permanent-code, lifecycle/status and version-
// history display primitives.
//
// U1 shared foundation (post-S7 handover §9.2). Stateless and hook-free.
// Every governed master (Plants, Families, Constructions, SKUs, ...) carries
// a permanent code and a lifecycle status; this is the one rendering for
// both, so a future screen does not reinvent the badge colours per table.
// ═══════════════════════════════════════════════════════════════════════════
import { C, mono, sans } from "../theme.js";

// A permanent internal code (Plant Code, Family Code, SKU code, ...) is
// identity, not a label — always mono, always as typed, never truncated.
export const PermanentCode = ({ code, style: sx = {} }) => (
  <span style={{ fontFamily: mono, fontWeight: 700, color: C.slate, fontSize: 12, ...sx }}>
    {code || "—"}
  </span>
);

// Lifecycle vocabulary spans several governed masters (Proposed, Draft,
// Approved, Published, Withdrawn, Retired, Discontinued, plus the simpler
// active/inactive Plants and app_users carry today) — one status-to-colour
// map instead of one per screen, per design-plan principle 4 ("states remain
// visibly distinct").
const STATUS_COLORS = {
  active: C.green, approved: C.green, published: C.green, current: C.green,
  proposed: C.amber, draft: C.amber, pending: C.amber,
  inactive: C.slateL, withdrawn: C.slateL, superseded: C.slateL,
  retired: C.red, discontinued: C.red, deactivated: C.red, voided: C.red,
};

export const LifecycleBadge = ({ status }) => {
  const key = (status || "").toLowerCase();
  const color = STATUS_COLORS[key] || C.slateL;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700,
      color, fontFamily: sans, textTransform: "capitalize",
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: color }} />
      {status || "unknown"}
    </span>
  );
};

// A read-only timeline of prior versions/effective-dated rows. Each entry
// names who/when/what changed — the shape every U1+ history requirement
// (Family membership history, merge lineage, Batch Profile revisions) asks
// for, rendered once.
export const VersionHistory = ({ entries = [], renderEntry }) => {
  if (!entries.length) {
    return <div style={{ fontSize: 11, color: C.slateL, fontFamily: sans }}>No history yet.</div>;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {entries.map((e, i) => (
        <div key={e.id ?? i} style={{
          padding: "6px 10px", borderLeft: `2px solid ${C.border}`, fontSize: 11, fontFamily: sans,
        }}>
          {renderEntry ? renderEntry(e) : (
            <>
              <span style={{ fontWeight: 700, color: C.slateM }}>{e.label ?? e.action ?? "—"}</span>
              {e.at && <span style={{ color: C.slateL, marginLeft: 6 }}>{e.at}</span>}
              {e.by && <span style={{ color: C.slateL, marginLeft: 6 }}>by {e.by}</span>}
            </>
          )}
        </div>
      ))}
    </div>
  );
};
