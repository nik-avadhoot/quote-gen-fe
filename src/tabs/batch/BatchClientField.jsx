// ═══════════════════════════════════════════════════════════════════════════
// src/tabs/batch/BatchClientField.jsx — the Batch Profile Client control.
//
// PRODUCT OWNER RULING, 2026-09-08. `client` is not unrestricted free text.
// Free text is the STARTING POINT for creating a client that does not exist
// yet; once created — and for every client that already exists — this control
// is a searchable Customer/Prospect Master dropdown, and users select governed
// records instead of retyping arbitrary strings.
//
// WHAT IS STORED. Still one plain string in `batchProfile.client`, written only
// through applyLabelToProfile(). It is the TEMPORARY U1 REPRESENTATION of a
// governed selection — NOT a foreign key, and never to be described as one. No
// partyId, no party_id, no link object, no new Batch or localStorage field. U4
// introduces the durable Batch identity relationship.
//
// It stays the bare display_name because that value is customer-facing and is
// also an identifier prefix: export/pdf.js writes "To: <client>", excel.js
// writes it into the workbook and the filename, and useQuoteActions.js takes
// its first four characters as the SKU code prefix. A "name · code" label would
// corrupt all four.
//
// WHAT THE CONTROL REFUSES TO CLAIM. A display name is not an identity. Two
// Parties may share one; a later rename never reaches a string written earlier.
// So on load the text is resolved for USABILITY only — identityFromText() says
// 'one' / 'ambiguous' / 'possible' / 'unmatched', and the badge wording stops
// short of asserting identity in every one of those cases.
//
// CAPABILITY, SHOWN AS TWO DIFFERENT ANSWERS.
//   browse — read_party_master (group). GET /masters/customer-families checks
//            it explicitly and answers 403, never an empty list.
//   create — manage_customer_master OR make_quote, the database's own OR.
// A make_quote-only caller gets a plain text box, an explicit create action and
// cannotBrowseNotice() — never a dropdown that would 403, and never any
// suggestion that what they typed is already governed. Backend and RLS remain
// decisive; everything here is a usability aid (design-plan §2.1).
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../../AuthContext.jsx";
import { apiFetch } from "../../lib/apiClient.js";
import { classifyResponse } from "../../lib/backendError.js";
import {
  applyLabelToProfile, cannotBrowseNotice,
  familyNameByPartyId, identityCaveat, identityFromText, likelyMatches, partyLabel,
  partyOptionParts, profileAfterProspect, quickPickAbilities,
} from "../../lib/batchQuickCreate.js";
import { PLANTS } from "../../data/defaults.js";
import { useAppState } from "../../state/AppStateContext.js";
import BatchLocationCreateModal from "./BatchLocationCreateModal.jsx";
import ProspectCreateModal from "./ProspectCreateModal.jsx";
import { C } from "../../theme.js";

const inputSt = {
  padding: "2px 6px", borderRadius: 3, border: `1px solid ${C.border}`,
  fontSize: 10, background: C.white, color: C.slate, width: 90, minWidth: 0,
};
// The panel is portalled to <body> and positioned against the field. Rendered
// in place it was clipped by the collapsed Batch Profile strip, which hid the
// Create Prospect confirmation and its buttons.
const PANEL_W = 340;
const PANEL_MAX_H = 340;
const panelSt = {
  position: "fixed", zIndex: 9000, width: PANEL_W,
  background: C.white, border: `1px solid ${C.amber}`, borderRadius: 6,
  boxShadow: "0 8px 24px rgba(0,0,0,.18)", padding: 8, overflowY: "auto",
};

// Below the field when there is room, otherwise above; always inside the viewport.
function panelPlacement(rect) {
  const gap = 3, edge = 8;
  const vw = window.innerWidth, vh = window.innerHeight;
  const left = Math.max(edge, Math.min(rect.left, vw - PANEL_W - edge));
  const below = vh - rect.bottom - gap - edge;
  const above = rect.top - gap - edge;
  if (below >= Math.min(PANEL_MAX_H, 200) || below >= above) {
    return { left, top: rect.bottom + gap, maxHeight: Math.max(120, Math.min(PANEL_MAX_H, below)) };
  }
  const maxHeight = Math.max(120, Math.min(PANEL_MAX_H, above));
  return { left, bottom: vh - rect.top + gap, maxHeight };
}
const rowSt = {
  display: "block", width: "100%", textAlign: "left", border: `1px solid ${C.border}`,
  borderRadius: 4, background: C.white, padding: "5px 7px", marginBottom: 4,
  cursor: "pointer", fontSize: 11, color: C.slate, fontFamily: "inherit",
};
const noteSt = { fontSize: 10, color: C.slateL, lineHeight: 1.45, padding: "2px 1px" };

// Badge colours by what the text can honestly be said to mean.
const BADGE = {
  one: { bg: "#F4FBF6", fg: "#2F7D4F", mark: "≈" },
  ambiguous: { bg: "#FEF6E7", fg: C.amberD, mark: "⚠" },
  possible: { bg: "#FEF6E7", fg: C.amberD, mark: "?" },
  unmatched: { bg: C.cream, fg: C.slateL, mark: "—" },
};

export default function BatchClientField({ batchProfile, setBatchProfile, showToast }) {
  const { profile: caller } = useAuth();
  const { sectorCodes, locations } = useAppState();
  const { canCreate, canBrowse } = quickPickAbilities(caller);

  const stored = batchProfile.client || "";
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [masters, setMasters] = useState({ status: canBrowse ? "loading" : "denied",
    parties: [], families: [], memberships: [] });
  const [pendingCreate, setPendingCreate] = useState(null); // { name, matches } | null — the window is open
  const [locationFor, setLocationFor] = useState(null);     // party | null
  const wrapRef = useRef(null);
  const panelRef = useRef(null);
  const [place, setPlace] = useState(null);

  // Keep the portalled panel attached to the field while open.
  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      if (wrapRef.current) setPlace(panelPlacement(wrapRef.current.getBoundingClientRect()));
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open]);

  const renderPanel = (children) => open && place && createPortal(
    <div ref={panelRef} style={{ ...panelSt, ...place }}>{children}</div>,
    document.body);

  // Loaded once on mount, not on open: the resolution badge beside the field
  // has to be meaningful straight after a reload (ruling item 8), and it cannot
  // be without the master list. Non-blocking — the field renders and accepts
  // typing while this is in flight.
  const load = async () => {
    let resp, data;
    try {
      resp = await apiFetch("/masters/customer-families");
      data = await resp.json().catch(() => ({}));
    } catch {
      setMasters(m => ({ ...m, status: "error" }));
      return null;
    }
    const outcome = classifyResponse({ ok: resp.ok, status: resp.status, data });
    if (outcome.kind === "ok") {
      const next = { status: "ok", parties: data.parties || [], families: data.families || [],
        memberships: data.memberships || [] };
      setMasters(next);
      return next;
    }
    setMasters(m => ({ ...m, status: outcome.kind === "access-denied" ? "denied" : "error" }));
    return null;
  };

  useEffect(() => {
    if (!canBrowse) return;
    let cancelled = false;
    (async () => { if (!cancelled) await load(); })();
    return () => { cancelled = true; };
  }, [canBrowse]);

  // Close on an outside click. Closing DISCARDS the draft — typed text is never
  // silently accepted as a final value (ruling item 4); only Select or Create
  // writes anything.
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)
          && !(panelRef.current && panelRef.current.contains(e.target))) {
        setOpen(false); setPendingCreate(null);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const familyOf = useMemo(
    () => familyNameByPartyId(masters.memberships, masters.families),
    [masters.memberships, masters.families]);

  // What the STORED value resolves to — usability only, never identity.
  const resolved = useMemo(
    () => identityFromText(stored, masters.parties),
    [stored, masters.parties]);

  // What the CURRENT typing matches. Blank draft lists everything, so opening
  // the control shows the master rather than an empty box.
  const results = useMemo(() => {
    const q = draft.trim();
    if (!q) {
      return masters.parties.slice()
        .sort((a, b) => (a.display_name || "").localeCompare(b.display_name || ""))
        .slice(0, 30)
        .map(party => ({ party, score: 0 }));
    }
    return likelyMatches(q, masters.parties, { limit: 30, threshold: 0.2 });
  }, [draft, masters.parties]);

  const draftExactlyExists = useMemo(() => {
    const q = draft.trim();
    if (!q) return true;
    return identityFromText(q, masters.parties).exact.length > 0;
  }, [draft, masters.parties]);

  // The ONLY write to Batch state in this control.
  const commit = (name) => {
    setBatchProfile(p => applyLabelToProfile(p, "client", name));
    setOpen(false); setPendingCreate(null); setDraft("");
  };

  const selectParty = (party) => {
    commit(partyLabel(party));
    showToast?.(`✅ Client set to "${partyLabel(party)}" from the Customer Master.`, "success", 5000);
  };

  const askToCreate = (name) => {
    // Opens the one-window Prospect form (PO ruling 2026-09-18). The duplicate
    // guard still runs first: likely matches are computed and SHOWN in the
    // window, so a spelling variation does not silently mint a second record.
    setPendingCreate({ name: (name || "").trim(),
      matches: likelyMatches(name, masters.parties, { limit: 6 }) });
    setOpen(false);
  };

  const onProspectCreated = async ({ name, partyId, sectorCode, plantName, delivery, customerType }) => {
    setPendingCreate(null);
    // Refresh so the new record is genuinely selectable from the master list,
    // not merely assumed to exist (ruling item 5). If the refetch fails, splice
    // the created row in locally so the control is still consistent.
    const next = canBrowse ? await load() : null;
    if (!next) {
      setMasters(m => ({ ...m,
        parties: [...m.parties, { id: partyId, display_name: name,
          lifecycle_state: "prospect", customer_code: null, status: "active" }] }));
    }
    setBatchProfile(p => profileAfterProspect(p, { name, sectorCode, plantName, delivery, customerType },
      { sectorCodes, plantNames: PLANTS, deliveryOptions: locations }));
    setDraft("");
    const sectorSet = !!sectorCode && (sectorCodes || []).includes(sectorCode);
    showToast?.(`✅ Prospect "${name}" created and applied to this Batch.`
      + (sectorCode && !sectorSet ? ` Sector ${sectorCode} is not in this Batch's Sector list; choose it there.` : ""),
      "success", 6000);
  };

  // The one-window Prospect form, shared by both variants below.
  const prospectWindow = pendingCreate && (
    <ProspectCreateModal initialName={pendingCreate.name} matches={pendingCreate.matches}
      familyOf={familyOf} defaultSectorCode={batchProfile.sector} defaultPlantName={batchProfile.plant}
      deliveryOptions={locations} defaultDelivery={batchProfile.delivery}
      onSelectExisting={(party) => { setPendingCreate(null); selectParty(party); }}
      onCreated={onProspectCreated} onClose={() => setPendingCreate(null)} showToast={showToast} />
  );

  // ── caller may not browse: a plain box, an explicit create, and the truth ──
  if (!canBrowse) {
    return (
      <div ref={wrapRef} style={{ position: "relative", display: "flex", gap: 3, alignItems: "center", minWidth: 0 }}>
        <input value={stored} onChange={e => setBatchProfile(p => ({ ...p, client: e.target.value }))}
          onFocus={() => setOpen(true)} style={inputSt}
          title="You cannot search the Customer Master. This text is not a governed record until you create it." />
        {canCreate && (
          <button type="button" onClick={() => askToCreate(stored)}
            disabled={!stored.trim()}
            title="Create this name as a Prospect in the Customer Master"
            style={{ padding: "1px 4px", borderRadius: 3, border: `1px solid ${C.amber}`,
              background: C.white, color: C.amber, fontSize: 9, fontWeight: 700,
              cursor: stored.trim() ? "pointer" : "not-allowed", opacity: stored.trim() ? 1 : 0.45,
              lineHeight: 1.3, flexShrink: 0 }}>⊕</button>
        )}
        {renderPanel(
          <>
            <div style={{ ...noteSt, color: C.amberD }}>{cannotBrowseNotice()}</div>
          </>
        )}
        {prospectWindow}
      </div>
    );
  }

  // ── caller may browse: the governed searchable control ────────────────────
  const badge = BADGE[resolved.kind] || BADGE.unmatched;
  const resolvedParty = resolved.kind === "one" ? resolved.exact[0] : null;

  return (
    <div ref={wrapRef} style={{ position: "relative", display: "flex", gap: 3, alignItems: "center", minWidth: 0 }}>
      <input
        value={open ? draft : stored}
        placeholder={open ? "Search Customer Master…" : ""}
        onChange={e => { setDraft(e.target.value); setPendingCreate(null); }}
        onFocus={() => { setDraft(stored); setOpen(true); }}
        onKeyDown={e => {
          if (e.key === "Escape") { setOpen(false); setPendingCreate(null); }
          // Enter never commits raw text — an unmatched name must go through
          // the explicit create step, matches must be selected deliberately.
          if (e.key === "Enter") { e.preventDefault(); if (!draftExactlyExists && canCreate) askToCreate(draft); }
        }}
        style={inputSt}
        title={masters.status === "ok"
          ? identityCaveat(resolved.kind, resolved.exact.length)
          : "Customer Master is still loading — the match indicator appears once it arrives."} />

      {masters.status === "ok" && stored && (
        <span title={identityCaveat(resolved.kind, resolved.exact.length)
            + (resolvedParty ? ` · Family: ${familyOf[resolvedParty.id] || "not recorded"}` : "")}
          style={{ fontSize: 8, fontWeight: 700, padding: "1px 3px", borderRadius: 3,
            background: badge.bg, color: badge.fg, border: `1px solid ${badge.fg}33`,
            flexShrink: 0, cursor: "help", fontFamily: resolvedParty?.customer_code ? "monospace" : "inherit" }}>
          {/* Display only: the stored value stays the bare name (ruling above).
              The code is shown beside the ≈ mark, never asserted as identity. */}
          {badge.mark}{resolvedParty?.customer_code ? ` ${resolvedParty.customer_code}` : ""}
        </span>
      )}

      <button type="button" onClick={() => { setDraft(stored); setOpen(o => !o); }}
        title="Search or create a governed Customer or Prospect"
        style={{ padding: "1px 4px", borderRadius: 3, border: `1px solid ${C.amber}`,
          background: C.white, color: C.amber, fontSize: 9, fontWeight: 700,
          cursor: "pointer", lineHeight: 1.3, flexShrink: 0 }}>▾</button>

      {renderPanel(
        <>
          {/* What the stored text can honestly be said to mean. */}
          {stored && masters.status === "ok" && (
            <div style={{ ...noteSt, background: badge.bg, color: badge.fg, borderRadius: 4,
              padding: "4px 6px", marginBottom: 6 }}>
              {badge.mark} {identityCaveat(resolved.kind, resolved.exact.length)}
            </div>
          )}
          {masters.status === "loading" && <div style={noteSt}>Loading the Customer Master…</div>}
          {masters.status === "error" && (
            <div style={noteSt}>The Customer Master could not be loaded. Existing records cannot be
              listed right now; nothing has been changed.</div>
          )}

          {(
            <>
              {masters.status === "ok" && results.length === 0 && (
                <div style={noteSt}>No Customer or Prospect matches that text.</div>
              )}
              {results.map(({ party }) => {
                const parts = partyOptionParts(party, familyOf[party.id]);
                return (
                  <button key={party.id} type="button" style={rowSt}
                    onClick={() => selectParty(party)}>
                    <strong>{parts.name}</strong>
                    <span style={{ color: C.slateL }}>
                      {" · "}{parts.lifecycle}{parts.code ? ` · ${parts.code}` : ""}
                      {parts.family ? ` · Family: ${parts.family}` : ""}
                      {parts.inactive ? " · inactive" : ""}
                    </span>
                  </button>
                );
              })}

              {/* Unmatched text is never accepted as a final value on its own —
                  it becomes an explicit governed create action. */}
              {draft.trim() && !draftExactlyExists && masters.status === "ok" && (
                canCreate ? (
                  <button type="button" style={{ ...rowSt, borderColor: C.amber, background: "#FEF8F0" }}
                    onClick={() => askToCreate(draft)}>
                    ⊕ Create <strong>&quot;{draft.trim()}&quot;</strong> as a new Prospect…
                  </button>
                ) : (
                  <div style={noteSt}>
                    No match, and you do not hold <code>manage_customer_master</code> or{" "}
                    <code>make_quote</code>, so you cannot create a Customer Master record.
                  </div>
                )
              )}

              {/* Location convenience — offered only once a governed record is
                  actually resolved, and it changes no Batch field. */}
              {resolvedParty && canCreate && (
                <button type="button" style={{ ...rowSt, marginTop: 6 }}
                  onClick={() => { setLocationFor(resolvedParty); setOpen(false); }}>
                  ＋ Create a Customer Location for <strong>{resolvedParty.display_name}</strong>
                  <span style={{ color: C.slateL }}> · Customer Master only, not linked to this Batch</span>
                </button>
              )}
            </>
          )}
        </>
      )}

      {locationFor && (
        <BatchLocationCreateModal party={locationFor} showToast={showToast}
          onClose={() => setLocationFor(null)} />
      )}
      {prospectWindow}
    </div>
  );
}
