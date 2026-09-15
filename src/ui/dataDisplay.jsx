// ═══════════════════════════════════════════════════════════════════════════
// src/ui/dataDisplay.jsx — permanent-code, lifecycle/status, summary-
// disclosure and version-history display primitives.
//
// U1 shared foundation (post-S7 handover §9.2). Presentation-only.
// Every governed master (Plants, Families, Constructions, SKUs, ...) carries
// a permanent code and a lifecycle status; this is the one rendering for
// both, so a future screen does not reinvent the badge colours per table.
// ═══════════════════════════════════════════════════════════════════════════
import { useId, useState } from "react";
import { C, T, mono, sans } from "../theme.js";

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

// One visual signal for where a value lives (UX policy §3 "working vs
// governed"): local browser state, a governed record that can still change
// through versioned operations, or immutable evidence. The word is always
// visible; the title only adds detail.
const PROVENANCE = {
  local: {
    label: "Local", title: "Kept in this browser only — not a governed record",
    color: C.amberD, background: C.amberL, border: `1px dashed ${C.amber}`,
  },
  governed: {
    label: "Governed", title: "Saved to the governed database; changes are versioned and audited",
    color: C.slateM, background: C.white, border: `1px solid ${C.slateL}`,
  },
  immutable: {
    label: "Immutable", title: "Frozen evidence — never edited in place",
    color: C.white, background: C.slateM, border: `1px solid ${C.slateM}`,
  },
};

export const ProvenanceTag = ({ kind, label, style: sx = {} }) => {
  const p = PROVENANCE[kind] || PROVENANCE.local;
  return (
    <span title={p.title} style={{
      display: "inline-flex", alignItems: "center", gap: 3, borderRadius: 999,
      padding: "1px 6px", fontSize: T.micro, fontWeight: 800, lineHeight: 1.4,
      letterSpacing: "0.04em", textTransform: "uppercase", whiteSpace: "nowrap",
      color: p.color, background: p.background, border: p.border, fontFamily: sans, ...sx,
    }}>
      {kind === "immutable" && <span aria-hidden="true">🔒</span>}
      {label || p.label}
    </span>
  );
};

const SUMMARY_STATUS_TONES = {
  neutral: { color: C.slateM, background: C.paper },
  positive: { color: C.green, background: C.greenL },
  warning: { color: C.amberD, background: C.amberL },
  danger: { color: C.red, background: C.redL },
};

// A compact, reusable disclosure row for master-screen summaries. It owns
// only presentation and disclosure state; callers retain all domain state,
// resolution rules and mutation guards rendered inside the expanded content.
export const SummaryRow = ({
  title,
  facts = [],
  status,
  statusTone = "neutral",
  badge,
  children,
  defaultExpanded = false,
  expanded: controlledExpanded,
  onExpandedChange,
  verticalTitleWhenExpanded = false,
  titleStyle = {},
  style: sx = {},
  contentStyle = {},
}) => {
  const contentId = useId();
  const [internalExpanded, setInternalExpanded] = useState(defaultExpanded);
  const isControlled = controlledExpanded !== undefined;
  const expanded = isControlled ? controlledExpanded : internalExpanded;
  const tone = SUMMARY_STATUS_TONES[statusTone] || SUMMARY_STATUS_TONES.neutral;

  const toggle = () => {
    const nextExpanded = !expanded;
    if (!isControlled) setInternalExpanded(nextExpanded);
    onExpandedChange?.(nextExpanded);
  };

  const sharedTitleStyle = {
    fontSize: T.body, fontWeight: 800, flexShrink: 0, ...titleStyle,
  };

  return (
    <div style={{
      border: `1px solid ${C.border}`, borderRadius: 7, background: C.white,
      overflow: "hidden", fontFamily: sans,
      // An opened rail card fills the card's full height, so the rail's divider
      // runs top to bottom even when a sibling card makes the row taller.
      ...(expanded && verticalTitleWhenExpanded ? { display: "flex", flexDirection: "column" } : {}),
      ...sx,
    }}>
      {expanded && verticalTitleWhenExpanded ? (
        <div style={{ display: "flex", flex: 1, minHeight: 38, alignItems: "stretch" }}>
          <button
            type="button"
            aria-expanded={true}
            aria-controls={contentId}
            aria-label={`Collapse ${title}`}
            title={`Collapse ${title}`}
            onClick={toggle}
            style={{
              width: 24, padding: "5px 4px", border: 0,
              borderRight: `1px solid ${C.border}`,
              background: "transparent", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: sans, flexShrink: 0,
            }}
          >
            <span style={{
              ...sharedTitleStyle, writingMode: "vertical-rl",
              transform: "rotate(180deg)", lineHeight: 1,
            }}>{title}</span>
          </button>
          <div id={contentId} style={{ flex: 1, minWidth: 0, padding: "10px 12px", ...contentStyle }}>
            {children}
          </div>
        </div>
      ) : <>
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={contentId}
        onClick={toggle}
        style={{
          width: "100%", minHeight: 38, padding: "7px 10px", border: 0,
          background: "transparent", color: C.slate, cursor: "pointer",
          display: "flex", alignItems: "center", gap: 9, textAlign: "left",
          fontFamily: sans,
        }}
      >
        <span style={sharedTitleStyle}>{title}</span>
        <span style={{
          display: "flex", alignItems: "center", gap: 6, minWidth: 0,
          flex: 1, overflow: "hidden", color: C.slateL, fontSize: T.label,
          whiteSpace: "nowrap",
        }}>
          {facts.map((fact, index) => (
            <span key={index} style={{ display: "inline-flex", alignItems: "center", minWidth: 0 }}>
              {index > 0 && <span aria-hidden="true" style={{ marginRight: 6, color: C.border }}>·</span>}
              <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{fact}</span>
            </span>
          ))}
        </span>
        {badge || (status != null && (
          <span style={{
            borderRadius: 999, padding: "2px 7px", flexShrink: 0,
            color: tone.color, background: tone.background,
            fontSize: T.micro, fontWeight: 800, lineHeight: 1.4,
          }}>
            {status}
          </span>
        ))}
        <span aria-hidden="true" style={{
          color: C.slateL, fontSize: 16, lineHeight: 1, flexShrink: 0,
          transform: expanded ? "rotate(90deg)" : "none",
          transition: "transform 120ms ease",
        }}>›</span>
      </button>
      {expanded && (
        <div id={contentId} style={{
          borderTop: `1px solid ${C.border}`, padding: "10px 12px", ...contentStyle,
        }}>
          {children}
        </div>
      )}
      </>}
    </div>
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
