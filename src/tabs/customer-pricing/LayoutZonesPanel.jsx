// P0.3 layout zones: Rows, Columns, Details, Hidden. Every drag has a menu
// equivalent on the chip (⋯), and both dispatch the SAME layout op
// (dropOp / fieldMenuActions in lib/customerPricingLayout.js). Moving a field
// here changes only where it is displayed — never its owner or its data.
import { useState } from "react";
import { C, T } from "../../theme.js";
import { FIELD_GROUPS, ZONES, ZONE_LABELS, dropOp, fieldMenuActions, layoutZones } from "../../lib/customerPricingLayout.js";
import { panel, rowButton } from "./pricingStyles.js";

const DRAG_TYPE = "text/x-cph-field";
const groupLabel = id => FIELD_GROUPS.find(g => g.id === id)?.label || id;

function FieldChip({ field, zone, layout, onOp, pinned, openMenu, setOpenMenu }) {
  const [over, setOver] = useState(false);
  const menuOpen = openMenu === field.id;
  const actions = fieldMenuActions(layout, field.id);
  return (
    <li draggable onDragStart={e => { e.dataTransfer.setData(DRAG_TYPE, field.id); e.dataTransfer.effectAllowed = "move"; }}
      onDragOver={e => { if (e.dataTransfer.types.includes(DRAG_TYPE)) { e.preventDefault(); setOver(true); } }}
      onDragLeave={() => setOver(false)}
      onDrop={e => {
        const id = e.dataTransfer.getData(DRAG_TYPE);
        setOver(false);
        if (!id) return;
        e.preventDefault(); e.stopPropagation();
        onOp(dropOp(id, zone, field.id));
      }}
      style={{ listStyle: "none", position: "relative", display: "flex", alignItems: "center", gap: 4,
        border: `1px solid ${pinned ? C.amber : C.border}`, borderTop: over ? `2px solid ${C.amber}` : undefined,
        borderRadius: 4, padding: "1px 3px 1px 6px", marginBottom: 3, background: C.white, cursor: "grab",
        fontSize: T.label }}>
      <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
        title={`${field.label} — ${groupLabel(field.group)} (owned by the ${field.owner.replace("_", " ")} record)`}>
        {pinned ? "📌 " : ""}{field.label}</span>
      <button type="button" aria-haspopup="menu" aria-expanded={menuOpen}
        aria-label={`Layout actions for ${field.label}`} style={{ ...rowButton, height: 18, padding: "0 5px" }}
        onClick={() => setOpenMenu(menuOpen ? null : field.id)}>⋯</button>
      {menuOpen && (
        <div role="menu" aria-label={`${field.label} layout actions`}
          onKeyDown={e => { if (e.key === "Escape") setOpenMenu(null); }}
          style={{ position: "absolute", right: 0, top: "100%", zIndex: 40, background: C.white,
            border: `1px solid ${C.border}`, borderRadius: 5, boxShadow: "0 6px 16px rgba(28,43,58,.18)",
            padding: 4, display: "grid", gap: 2, minWidth: 210 }}>
          {actions.map(a => (
            <button key={a.id} type="button" role="menuitem" style={{ ...rowButton, textAlign: "left", fontWeight: 600 }}
              onClick={() => { onOp(a.op); setOpenMenu(null); }}>{a.label}</button>
          ))}
        </div>
      )}
    </li>
  );
}

export default function LayoutZonesPanel({ layout, registry, onOp, onClose }) {
  const [openMenu, setOpenMenu] = useState(null);
  const [overZone, setOverZone] = useState(null);
  const zones = layoutZones(layout);
  return (
    <div style={{ ...panel, marginBottom: 6 }} aria-label="Layout zones">
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: T.micro, fontWeight: 800, color: C.slateL, textTransform: "uppercase",
          letterSpacing: "0.05em" }}>Layout</span>
        <span style={{ fontSize: T.label, color: C.slateL }}>
          Drag fields between zones, or use ⋯ on a field. This changes only where a value is shown on this
          browser — never the pricing record.</span>
        <button type="button" style={{ ...rowButton, marginLeft: "auto" }} onClick={onClose}>Done</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(150px, 1fr))", gap: 8 }}>
        {ZONES.map(zone => (
          <section key={zone} aria-label={`${ZONE_LABELS[zone]} zone`}
            onDragOver={e => { if (e.dataTransfer.types.includes(DRAG_TYPE)) { e.preventDefault(); setOverZone(zone); } }}
            onDragLeave={() => setOverZone(null)}
            onDrop={e => {
              const id = e.dataTransfer.getData(DRAG_TYPE);
              setOverZone(null);
              if (!id) return;
              e.preventDefault();
              onOp(dropOp(id, zone, null));
            }}
            style={{ border: `1px dashed ${overZone === zone ? C.amber : C.border}`, borderRadius: 5, padding: 5,
              background: overZone === zone ? C.amberL : "#FBF8F3", minHeight: 60, maxHeight: 260, overflowY: "auto" }}>
            <div style={{ fontSize: T.micro, fontWeight: 800, color: C.slateM, marginBottom: 4 }}>
              {ZONE_LABELS[zone].toUpperCase()} · {zones[zone].filter(id => id !== "@records").length}</div>
            <ul style={{ margin: 0, padding: 0 }}>
              {zones[zone].map(id => {
                if (id === "@records") {
                  return (
                    <li key={id} style={{ listStyle: "none", fontSize: T.label, color: C.slateM, fontWeight: 700,
                      padding: "1px 6px", marginBottom: 3, border: `1px solid ${C.slateL}`, borderRadius: 4 }}>
                      Cycles / lines{zones[zone].length > 1 ? " — grouped by:" : ""}</li>
                  );
                }
                const field = registry.byId.get(id);
                if (!field) return null;
                return <FieldChip key={id} field={field} zone={zone} layout={layout} onOp={onOp}
                  pinned={layout.pinned.includes(id)} openMenu={openMenu} setOpenMenu={setOpenMenu} />;
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
