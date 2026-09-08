// ═══════════════════════════════════════════════════════════════════════════
// src/tabs/batch/BatchLocationCreateModal.jsx — U1 Slice D, the Customer
// Location convenience, and nothing else.
//
// Was BatchQuickPickModal.jsx, which also selected and created the Party. That
// belongs in the Client control itself now (BatchClientField.jsx) per the
// Product Owner ruling that `client` is a governed selection rather than free
// text, so this file was renamed to what it actually is.
//
// CREATE ONLY, AND LINKED TO NOTHING.
//
// It proposes a Customer Location for an already-resolved Party through the
// governed Slice C route, states before and after that the Location is recorded
// in the Customer Master and NOT linked to this Batch, and leaves `client`,
// `delivery`, freight selection and every other Batch field untouched. There is
// no selected-Location state afterwards, so nothing can look linked.
//
//   POST /masters/parties/<id>/locations        (propose_customer_location)
//
// `delivery` is a FREIGHT-DESTINATION MASTER KEY — BatchProfileBar resolves
// freight[plant][delivery] from it to price the Batch. A Location label is not
// a key in that master, so writing one there returned a 0 freight rate: a
// misleading, commercially unsafe pricing state that confirmation text did not
// redeem. Formal Location selection for a Batch belongs to U4's Delivery Group
// UI, which references real Bill-to/Ship-to Locations.
// ═══════════════════════════════════════════════════════════════════════════
import { useState } from "react";
import { runMutation } from "../../lib/runMutation.js";
import {
  locationCreatedNotLinkedMessage, locationLabel, locationNotLinkedNotice, proposeLocationBody,
} from "../../lib/batchQuickCreate.js";
// The location_type list is imported, never transcribed: writing `factory` here
// by hand is exactly what produced a live 500 (ck_lv_type permits only
// plant/office/warehouse/other), and the shared constant is pinned by a fixture
// so it cannot drift from the database constraint again.
import { LOCATION_TYPE_OPTS } from "../../lib/customerLocationActions.js";
import { Btn, Inp, Sel } from "../../ui/primitives.jsx";
import { C, sans } from "../../theme.js";

const overlaySt = { position: "fixed", inset: 0, background: "rgba(28,43,58,.45)", display: "flex",
  alignItems: "center", justifyContent: "center", zIndex: 10000 };
const cardSt = { width: 430, maxHeight: "84vh", overflowY: "auto", background: C.white,
  border: `1px solid ${C.border}`, borderRadius: 10, padding: 22,
  boxShadow: "0 8px 32px rgba(0,0,0,.2)", fontFamily: sans };
const labelSt = { fontSize: 10, fontWeight: 700, color: C.slateM, textTransform: "uppercase",
  letterSpacing: "0.05em", display: "block", marginBottom: 4, marginTop: 12 };
const noteSt = { fontSize: 11, color: C.slateL, marginTop: 6, lineHeight: 1.45 };

export default function BatchLocationCreateModal({ party, onClose, showToast }) {
  const [draft, setDraft] = useState({ locationType: "", addressText: "", contactName: "",
    notes: "", billTo: false, shipTo: true });
  const [done, setDone] = useState(null);   // { label } | null — a receipt, not a selection
  const [busy, setBusy] = useState(false);
  const eligible = draft.billTo || draft.shipTo;

  const submit = async () => {
    if (!party || !eligible) return;
    setBusy(true);
    const body = proposeLocationBody({
      locationType: draft.locationType, addressText: draft.addressText,
      contactName: draft.contactName, notes: draft.notes,
      billToEligible: draft.billTo, shipToEligible: draft.shipTo,
    });
    // showToast is NOT optional. Omitting it once made a real 500 from this
    // route completely invisible — the form just sat there, which is the
    // silent-failure mode design-plan §2.7 forbids.
    const data = await runMutation(`/masters/parties/${party.id}/locations`, body, { showToast });
    setBusy(false);
    if (!data) return;
    const lbl = locationLabel({ id: data.id, location_code: null }, {
      address_text: body.address_text, contact_name: body.contact_name,
      notes: body.notes, location_type: body.location_type,
    });
    setDone({ label: lbl });
    setDraft({ locationType: "", addressText: "", contactName: "", notes: "",
      billTo: false, shipTo: true });
    showToast?.(locationCreatedNotLinkedMessage(lbl, party.display_name), "info", 11000);
  };

  return (
    <div style={overlaySt} role="dialog" aria-modal="true" aria-label="Create a Customer Location">
      <div style={cardSt}>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.slate }}>
          Create a Customer Location for &quot;{party?.display_name}&quot;
        </div>
        <div style={{ ...noteSt, marginTop: 6, background: "#FEF8F0",
          border: `1px solid ${C.amber}`, borderRadius: 5, padding: "6px 8px" }}>
          {locationNotLinkedNotice()}
        </div>

        {done && (
          <div style={{ marginTop: 10, padding: "6px 8px", border: `1px solid ${C.green}`,
            borderRadius: 5, background: "#F4FBF6", fontSize: 11, color: C.slate }}>
            ✅ Created in Customer Master: <strong>{done.label}</strong>
            <span style={{ color: C.slateL }}> · not linked to this Batch</span>
          </div>
        )}

        <label style={labelSt}>Type</label>
        <Sel value={draft.locationType} onChange={v => setDraft(d => ({ ...d, locationType: v }))}
          opts={LOCATION_TYPE_OPTS} ph="— type unspecified —" />
        <label style={labelSt}>Address</label>
        <Inp value={draft.addressText} onChange={v => setDraft(d => ({ ...d, addressText: v }))}
          placeholder="Address (optional)" st={{ width: "100%", boxSizing: "border-box" }} />
        <label style={labelSt}>Contact</label>
        <Inp value={draft.contactName} onChange={v => setDraft(d => ({ ...d, contactName: v }))}
          placeholder="Contact name (optional)" st={{ width: "100%", boxSizing: "border-box" }} />
        <label style={labelSt}>Eligibility — fixed at proposal, cannot be changed later</label>
        <div style={{ display: "flex", gap: 14, fontSize: 11, color: C.slateM }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input type="checkbox" checked={draft.billTo}
              onChange={e => setDraft(d => ({ ...d, billTo: e.target.checked }))} /> Bill-to
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input type="checkbox" checked={draft.shipTo}
              onChange={e => setDraft(d => ({ ...d, shipTo: e.target.checked }))} /> Ship-to
          </label>
        </div>
        {/* Usability pre-check only; the route and app_private.propose_customer_
            location refuse it regardless of what this client sends. */}
        {!eligible && (
          <div style={{ marginTop: 6, fontSize: 11, color: C.red }}>
            A Location must be Bill-to, Ship-to or both.
          </div>
        )}

        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <Btn ch={busy ? "Creating…" : "Create in Customer Master"} full
            disabled={busy || !eligible} onClick={submit} />
          <Btn ch={done ? "Done" : "Cancel"} v="secondary" disabled={busy} onClick={onClose} />
        </div>
      </div>
    </div>
  );
}
