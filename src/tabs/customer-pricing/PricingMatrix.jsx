// P0.3 pricing matrix: renders one view (lib/customerPricingLayout.js) in the
// Standard (records × fields) or Transposed (fields × records) orientation.
//
// A cell edit is committed from the cell's OWN canonical identity (`cell.ref`
// = record type, id, canonical field, CAS version) — never from the row or
// column it happens to sit in — so every orientation and grouping sends the
// same request as the Standard view.
import { Fragment, useState } from "react";
import { C, T, mono } from "../../theme.js";
import { denseCell, denseHead, denseTable } from "../../ui/screenStandards.js";
import { SOB_STATES, cycleLabel } from "../../lib/customerPricingModel.js";
import { FIELD_GROUPS, cellEditorValue, cellFor, recordLabel, summarizeField } from "../../lib/customerPricingLayout.js";
import { SelectIn, TextIn } from "./pricingFormBits.jsx";
import { primaryRowButton, rowButton } from "./pricingStyles.js";
import { SummaryValue } from "./DetailsSummary.jsx";

const groupLabel = id => (id === "pinned" ? "Pinned" : FIELD_GROUPS.find(g => g.id === id)?.label || "");
const PIN_WIDTH = 118;

function CellEditor({ cell, data, label, onCommit, onCancel }) {
  const [value, setValue] = useState(() => cellEditorValue(cell.ref, data));
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    const res = await onCommit(cell.ref, value);
    setBusy(false);
    if (res?.ok) onCancel();
    else if (res?.errors) setErrors(res.errors);
  };
  const keys = e => { if (e.key === "Enter") save(); if (e.key === "Escape") onCancel(); };
  return (
    <span style={{ display: "inline-flex", gap: 3, alignItems: "center", flexWrap: "wrap" }} onKeyDown={keys}>
      {cell.input === "sob" ? (
        <>
          <SelectIn value={value.sob_state} onChange={v => setValue(s => ({ ...s, sob_state: v }))} opts={SOB_STATES}
            width={130} aria-label={`${label} SOB state`} />
          {value.sob_state === "percentage" && (
            <TextIn value={value.sob_pct} onChange={v => setValue(s => ({ ...s, sob_pct: v }))} width={52}
              inputMode="decimal" aria-label={`${label} SOB percent`} autoFocus />
          )}
          {value.sob_state === "allocated_quantity" && (
            <TextIn value={value.sob_allocated_boxes} onChange={v => setValue(s => ({ ...s, sob_allocated_boxes: v }))}
              width={80} inputMode="numeric" placeholder="boxes" aria-label={`${label} SOB allocated boxes`} autoFocus />
          )}
        </>
      ) : (
        <TextIn value={value} onChange={setValue} width={130} aria-label={label} autoFocus />
      )}
      <button type="button" style={primaryRowButton} disabled={busy} onClick={save}>{busy ? "…" : "Save"}</button>
      <button type="button" style={rowButton} disabled={busy} onClick={onCancel}>Cancel</button>
      {Object.values(errors).map(msg => <span key={msg} role="alert" style={{ color: C.red, fontSize: T.label }}>{msg}</span>)}
    </span>
  );
}

function CellContent({ cell, field, rec, view, data, editing, setEditing, onCommit, expanded, onToggle }) {
  const label = `${field.label} for ${recordLabel(rec, view.ctx)}`;
  const cellKey = `${cell.recordKey}|${cell.fieldId}`;
  if (field.action === "expand") {
    const open = expanded === rec.key;
    return (
      <button type="button" aria-expanded={open} style={{ ...rowButton, borderColor: open ? C.amber : C.border }}
        onClick={() => onToggle(rec)}>
        {rec.line ? cell.display : "Cycle"} {open ? "▴" : "▾"}</button>
    );
  }
  if (editing === cellKey) {
    return <CellEditor cell={cell} data={data} label={label} onCommit={onCommit} onCancel={() => setEditing(null)} />;
  }
  if (!cell.applicable) return <span style={{ color: C.slateL, fontSize: T.label, fontStyle: "italic" }}>{cell.display}</span>;
  return (
    <span style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
      <span>{cell.display}</span>
      {cell.ref && (
        <button type="button" aria-label={`Edit ${label}`} title={`Edit ${field.label}`}
          style={{ ...rowButton, height: 16, padding: "0 4px", color: C.slateL }}
          onClick={() => setEditing(cellKey)}>✎</button>
      )}
    </span>
  );
}

function cellStyle(field, cell) {
  const money = field.kind === "money";
  return { ...denseCell, fontFamily: money ? mono : undefined, textAlign: money ? "right" : undefined,
    fontWeight: field.emphasis ? 700 : field.id === "cycle.label" ? 700 : undefined,
    color: field.emphasis && cell.raw !== null ? C.green : undefined };
}

export default function PricingMatrix({ view, data, inline, expanded, onToggle, onBandToggle, onCommit, onDisclose,
  disclosed, renderLineDetail, renderCycleActions, anchor = null, onSelectAnchor, onPasteText }) {
  const [editing, setEditing] = useState(null);
  const [collapsedRecordGroups, setCollapsedRecordGroups] = useState(() => new Set()); // session only
  const shared = { view, data, editing, setEditing, onCommit, expanded, onToggle };
  const { fields, records, ctx } = view;
  const toggleGroup = key => setCollapsedRecordGroups(s => {
    const n = new Set(s);
    if (n.has(key)) n.delete(key); else n.add(key);
    return n;
  });
  // Toggle: a second click on the same Mixed values closes it.
  const disclose = (groupKey, fieldId) => onDisclose(disclosed?.key === `group|${groupKey}|${fieldId}` ? null
    : { kind: "group", groupKey, fieldId });
  const pinnedStyle = i => (i < view.pinnedCount
    ? { position: "sticky", left: i * PIN_WIDTH, zIndex: 1, background: "#FFFCF6", minWidth: PIN_WIDTH, maxWidth: PIN_WIDTH,
      boxShadow: i === view.pinnedCount - 1 ? `inset -1px 0 0 ${C.amber}` : undefined }
    : {});
  // P0.4 paste: the records in the order they are RENDERED as data rows /
  // columns (collapsed groups, Cycle action rows and detail rows excluded), so a
  // pasted block maps onto exactly what the user sees — through each cell's
  // canonical identity, never a raw position in the payload.
  const visibleKeys = (view.orientation === "transposed" ? records
    : inline ? records.filter(r => r.line)
      : (view.recordGroups || [{ key: "all", records }]).flatMap(g => (collapsedRecordGroups.has(g.key) ? [] : g.records)))
    .map(r => r.key);
  const isAnchor = (rec, f) => anchor && anchor.recordKey === rec.key && anchor.fieldId === f.id;
  const anchorStyle = { outline: `2px solid ${C.amber}`, outlineOffset: -2 };
  const select = (rec, f) => () => onSelectAnchor?.({ recordKey: rec.key, fieldId: f.id });
  const onPaste = e => {
    if (!onPasteText || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName || "")) return;
    const text = e.clipboardData?.getData("text/plain");
    if (!text) return;
    e.preventDefault();
    onPasteText({ text, visibleKeys, anchor: anchor || { recordKey: visibleKeys[0], fieldId: fields[0]?.id } });
  };
  const wrap = { tabIndex: 0, onPaste, "aria-describedby": "cph-paste-hint" };

  // Group bands are shown only when fields are grouped (a lone Pinned band is not a group).
  const bandHeader = view.bands.some(b => b.groupId && b.groupId !== "pinned");
  const bandToggle = band => (band.groupId && band.groupId !== "pinned" && band.ids.length + (band.hiddenCount || 0) > 1
    ? <button type="button" aria-expanded={!band.collapsed} style={{ ...rowButton, height: 16, padding: "0 4px", marginLeft: 4 }}
        aria-label={`${band.collapsed ? "Expand" : "Collapse"} ${groupLabel(band.groupId)}`}
        onClick={() => onBandToggle(band.groupId, !band.collapsed)}>
        {band.collapsed ? `+${band.hiddenCount} ▸` : "◂"}</button>
    : null);

  // ── Transposed: fields as rows, records as columns ──────────────────────
  if (view.orientation === "transposed") {
    const fieldById = new Map(fields.map(f => [f.id, f]));
    return (
      <div {...wrap} style={{ overflowX: "auto", border: `1px solid ${C.border}`, borderRadius: 6, background: C.white }}>
        <table style={{ ...denseTable, width: "auto" }} aria-label="Pricing history (transposed)">
          <thead>
            {view.recordGroups && (
              <tr>
                <th scope="col" style={denseHead} colSpan={bandHeader ? 2 : 1} />
                {view.recordGroups.map(g => (
                  <th key={g.key} scope="colgroup" colSpan={g.records.length} style={{ ...denseHead, textAlign: "center" }}>
                    {view.groupField.label}: {g.label} ({g.records.length})</th>
                ))}
              </tr>
            )}
            <tr>
              {bandHeader && <th scope="col" style={denseHead}>Group</th>}
              <th scope="col" style={{ ...denseHead, position: "sticky", left: 0, zIndex: 6 }}>Field</th>
              {records.map(rec => (
                <th key={rec.key} scope="col" style={{ ...denseHead, whiteSpace: "normal", minWidth: 110, maxWidth: 170 }}
                  title={recordLabel(rec, ctx)}>
                  {recordLabel(rec, ctx)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {view.bands.map(band => band.ids.map((id, bi) => {
              const field = fieldById.get(id);
              const pinned = band.pinned;
              return (
                <tr key={field.id} style={{ height: 26, background: pinned ? "#FFFCF6" : undefined }}>
                  {bandHeader && bi === 0 && (
                    <th scope="rowgroup" rowSpan={band.ids.length} style={{ ...denseHead, position: "static", verticalAlign: "top" }}>
                      {groupLabel(band.groupId)}{bandToggle(band)}</th>
                  )}
                  <th scope="row" style={{ ...denseHead, position: "sticky", top: "auto", left: 0, zIndex: 1, textAlign: "left" }}>
                    {pinned ? "📌 " : ""}{field.label}</th>
                  {records.map(rec => {
                    const cell = cellFor(field, rec, ctx);
                    return <td key={rec.key} style={{ ...cellStyle(field, cell), ...(isAnchor(rec, field) ? anchorStyle : {}) }}
                      onClick={select(rec, field)}>
                      <CellContent cell={cell} field={field} rec={rec} {...shared} /></td>;
                  })}
                </tr>
              );
            }))}
          </tbody>
        </table>
      </div>
    );
  }

  // ── Standard: records as rows, fields as columns ────────────────────────
  const headerCells = fields.map((f, i) => (
    <th key={f.id} scope="col" style={{ ...denseHead, ...pinnedStyle(i), background: denseHead.background,
      zIndex: i < view.pinnedCount ? 6 : denseHead.zIndex }}>
      {f.label}</th>
  ));
  const recordRow = (rec, prev) => {
    const sameCycle = inline && prev && prev.cycle.id === rec.cycle.id;
    return (
      <tr key={rec.key} style={{ height: 26, background: expanded === rec.key ? C.amberL : undefined }}>
        {fields.map((f, i) => {
          const cell = cellFor(f, rec, ctx);
          // Standard/inline shows a Cycle's own values once per Cycle, as P0.1 did.
          const suppress = sameCycle && f.owner === "cycle";
          return (
            <td key={f.id} style={{ ...cellStyle(f, cell), ...pinnedStyle(i), ...(isAnchor(rec, f) ? anchorStyle : {}) }}
              title={suppress ? undefined : cell.display} onClick={select(rec, f)}>
              {suppress ? "" : <CellContent cell={cell} field={f} rec={rec} {...shared} />}
            </td>
          );
        })}
      </tr>
    );
  };
  const detailRow = rec => (inline && expanded === rec.key && rec.line ? (
    <tr key={`${rec.key}:detail`}><td colSpan={fields.length} style={{ ...denseCell, whiteSpace: "normal", maxWidth: "none",
      background: "#FBF8F3", padding: "4px 10px 6px 20px" }}>{renderLineDetail(rec)}</td></tr>
  ) : null);

  let body;
  if (inline) {
    // P0.1/P0.2 journey preserved: lines, their inline detail, then the Cycle's action row.
    const byCycle = [];
    for (const rec of records) {
      const last = byCycle[byCycle.length - 1];
      if (last && last.cycle.id === rec.cycle.id) last.recs.push(rec);
      else byCycle.push({ cycle: rec.cycle, recs: [rec] });
    }
    body = byCycle.map(({ cycle, recs }) => {
      const lines = recs.filter(r => r.line);
      return (
        <Fragment key={cycle.id}>
          {lines.map((rec, i) => <Fragment key={rec.key}>{recordRow(rec, lines[i - 1])}{detailRow(rec)}</Fragment>)}
          <tr>
            <td style={{ ...denseCell, fontWeight: lines.length ? 400 : 700 }}>{lines.length ? "" : cycleLabel(cycle, ctx.labelStyle)}</td>
            <td colSpan={Math.max(fields.length - 1, 1)} style={{ ...denseCell, whiteSpace: "normal", maxWidth: "none" }}>
              {renderCycleActions(cycle)}</td>
          </tr>
        </Fragment>
      );
    });
  } else {
    body = (view.recordGroups || [{ key: "all", records }]).map(g => {
      const collapsed = collapsedRecordGroups.has(g.key);
      return (
        <Fragment key={g.key}>
          {view.recordGroups && (
            <tr style={{ background: "#F5EFE6" }}>
              {fields.map((f, i) => {
                if (i === 0) {
                  return (
                    <th key={f.id} scope="rowgroup" style={{ ...denseHead, top: "auto", textAlign: "left", ...pinnedStyle(0),
                      background: denseHead.background }}>
                      <button type="button" aria-expanded={!collapsed} style={{ ...rowButton, marginRight: 4 }}
                        aria-label={`${collapsed ? "Expand" : "Collapse"} ${view.groupField.label}: ${g.label}`}
                        onClick={() => toggleGroup(g.key)}>{collapsed ? "▸" : "▾"}</button>
                      <span title={`${view.groupField.label}: ${g.label} (${g.records.length})`}>
                        {g.label} ({g.records.length})</span></th>
                  );
                }
                if (f.action) return <td key={f.id} style={{ ...denseCell, ...pinnedStyle(i) }} />;
                const summary = summarizeField(f, g.records, ctx);
                return (
                  <td key={f.id} style={{ ...denseCell, fontSize: T.label, ...pinnedStyle(i) }}>
                    <SummaryValue summary={summary} money={f.kind === "money"}
                      onDisclose={() => disclose(g.key, f.id)} />
                  </td>
                );
              })}
            </tr>
          )}
          {!collapsed && g.records.map((rec, i) => <Fragment key={rec.key}>{recordRow(rec, g.records[i - 1])}</Fragment>)}
        </Fragment>
      );
    });
  }

  return (
    <div {...wrap} style={{ overflowX: "auto", border: `1px solid ${C.border}`, borderRadius: 6, background: C.white }}>
      <table style={denseTable} aria-label="Pricing history">
        <thead>
          {bandHeader && (
            <tr>
              {view.bands.map(band => (
                <th key={band.groupId || "all"} scope="colgroup" colSpan={band.ids.length}
                  style={{ ...denseHead, textAlign: "left", borderBottom: `2px solid ${C.amber}`,
                    ...(band.pinned ? { position: "sticky", left: 0, zIndex: 2 } : {}) }}>
                  {groupLabel(band.groupId)}{bandToggle(band)}</th>
              ))}
            </tr>
          )}
          <tr>{headerCells}</tr>
        </thead>
        <tbody>{body}</tbody>
      </table>
    </div>
  );
}
