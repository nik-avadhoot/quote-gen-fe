// ═══════════════════════════════════════════════════════════════════════════
// src/ui/CapabilityMatrix.jsx — what a user can actually do, shown honestly.
//
// UA-1 renders it read-only; UA-4 passes `onChange` and it becomes the editor.
// Scope-aware by construction: a GROUP capability is never offered per plant
// and a PLANT capability is never offered group-wide, because the database
// refuses a scope mismatch (22023) and a control that can compose a refused
// request is a control that lies about what is possible.
//
// The role label is rendered by the caller as a derived summary. Nothing here
// reads or writes it.
// ═══════════════════════════════════════════════════════════════════════════
import { GROUP_CAPABILITIES, PLANT_CAPABILITIES } from "../lib/userAccessActions.js";
import { C } from "../theme.js";

const chip = (held, editable) => ({
  display: "inline-flex", alignItems: "center", gap: 5,
  padding: "2px 7px", margin: "2px 4px 2px 0", borderRadius: 11, fontSize: 10.5,
  border: `1px solid ${held ? C.amber : C.border}`,
  background: held ? "#FEF8F0" : C.white,
  color: held ? C.amberD : C.slateL,
  cursor: editable ? "pointer" : "default",
  fontWeight: held ? 700 : 500,
});
const groupTitle = {
  fontSize: 9.5, fontWeight: 700, color: C.slateM, textTransform: "uppercase",
  letterSpacing: "0.06em", marginTop: 8, marginBottom: 2,
};

function Chip({ cap, held, editable, onToggle }) {
  const body = (
    <>
      {editable && (
        <input type="checkbox" checked={held} onChange={onToggle}
          style={{ margin: 0, width: 11, height: 11 }} />
      )}
      {cap.label}
    </>
  );
  if (!editable) {
    return <span style={chip(held, false)} title={cap.note || cap.key}>{body}</span>;
  }
  return (
    <label style={chip(held, true)} title={cap.note || cap.key}>{body}</label>
  );
}

export default function CapabilityMatrix({
  groupKeys = [], plantMap = {}, plants = [], editable = false, onChange,
}) {
  const held = new Set(groupKeys);

  const toggleGroup = (key) => {
    if (!onChange) return;
    const next = new Set(held);
    if (next.has(key)) next.delete(key); else next.add(key);
    onChange({ group: [...next], plant: plantMap });
  };

  const togglePlant = (code, key) => {
    if (!onChange) return;
    const current = new Set(plantMap[code] || []);
    if (current.has(key)) current.delete(key); else current.add(key);
    const nextMap = { ...plantMap };
    if (current.size) nextMap[code] = [...current]; else delete nextMap[code];
    onChange({ group: groupKeys, plant: nextMap });
  };

  // Read-only view lists only the plants the user actually holds something at;
  // the editor lists every active plant, because you cannot grant at a plant
  // that is not on screen.
  const activePlants = plants.filter(p => p.status === "active");
  const plantCodes = editable
    ? activePlants.map(p => p.plant_code)
    : Object.keys(plantMap).sort();

  return (
    <div style={{ fontFamily: "inherit" }}>
      <div style={groupTitle}>Group permissions</div>
      <div>
        {GROUP_CAPABILITIES.map(cap => {
          const on = held.has(cap.key);
          if (!editable && !on) return null;
          return <Chip key={cap.key} cap={cap} held={on} editable={editable}
                       onToggle={() => toggleGroup(cap.key)} />;
        })}
        {!editable && groupKeys.length === 0 && (
          <span style={{ fontSize: 11, color: C.slateL }}>None</span>
        )}
      </div>

      <div style={groupTitle}>Plant permissions</div>
      {plantCodes.length === 0 && (
        <div style={{ fontSize: 11, color: C.slateL }}>
          {editable ? "No active plants." : "None"}
        </div>
      )}
      {plantCodes.map(code => {
        const keys = new Set(plantMap[code] || []);
        return (
          <div key={code} style={{ marginTop: 4 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: C.slate,
              display: "inline-block", minWidth: 44 }}>{code}</span>
            {PLANT_CAPABILITIES.map(cap => {
              const on = keys.has(cap.key);
              if (!editable && !on) return null;
              return <Chip key={cap.key} cap={cap} held={on} editable={editable}
                           onToggle={() => togglePlant(code, cap.key)} />;
            })}
            {!editable && keys.size === 0 && (
              <span style={{ fontSize: 11, color: C.slateL }}>None</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
