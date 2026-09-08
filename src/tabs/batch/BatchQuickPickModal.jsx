// ═══════════════════════════════════════════════════════════════════════════
// src/tabs/batch/BatchQuickPickModal.jsx — U1 Slice D, the affordance itself.
//
// docs/u1-customer-foundation-authorization-packet.md, Slice D, as corrected by
// the Product Owner ruling of 2026-09-08. Kept in its own file so
// BatchProfileBar.jsx gains a button and an import and nothing else — that file
// carries a preserved, user-owned uncommitted hunk in its Commercials region,
// and the smallest possible edit there is deliberate.
//
// WHAT IT DOES.
//
// It sets ONE Batch field: `client`, the Batch Profile's free-text customer
// name. It does that by creating or selecting a governed Party first, so the
// customer is recorded properly in the Customer Master rather than existing
// only as a string somebody typed.
//
//   POST /masters/customer-families/prospects   (create_minimal_prospect)
//   GET  /masters/customer-families             (select an existing Party)
//
// WHAT IT DELIBERATELY DOES NOT DO, AND WHY.
//
// The first pass also offered this beside `delivery` and copied a Customer
// Location's label into it. That was wrong. `delivery` is a FREIGHT-DESTINATION
// MASTER KEY — BatchProfileBar resolves freight[plant][delivery] from it to
// price the Batch — not free-text Customer Location data. A Location label is
// not a key in that master, so the lookup returned 0 and produced a misleading,
// commercially unsafe pricing state. Confirmation text did not make that
// acceptable, and one field cannot carry two incompatible commercial meanings.
//
// So: no Location label reaches `delivery`, and existing-Location SELECTION is
// gone from Batch Entry altogether — not because identifiers were refused, but
// because there is no Batch field into which a selected Location could be
// represented without inventing the U4 referential state this slice must not
// introduce. Formal Location selection belongs to U4's Delivery Group UI, which
// references real Bill-to/Ship-to Locations and is the correct home for it.
//
// What remains is a CREATE-ONLY Customer Location convenience: it uses the
// governed Slice C proposal route, says up front and again afterwards that the
// Location is recorded in the Customer Master and NOT linked to this Batch, and
// leaves `client`, `delivery`, freight and every other Batch field untouched.
// There is no selected-Location state afterwards, so nothing can look linked.
//
//   POST /masters/parties/<id>/locations        (propose_customer_location)
//
// CAPABILITY, HONESTLY. Creating and browsing are different authorities and
// this modal shows them as different answers:
//   create  — manage_customer_master OR make_quote (the DB's own OR condition)
//   browse  — read_party_master, a GROUP capability; GET /masters/customer-
//             families checks it explicitly and returns 403, not an empty list
// A `make_quote`-only Maker therefore sees the create form and does NOT see a
// browse list — with a stated reason, not a silently missing control. These
// gates are usability aids (design-plan §2.1): the route and RLS refuse an
// unauthorised caller regardless of what renders here.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../AuthContext.jsx";
import { apiFetch } from "../../lib/apiClient.js";
import { classifyResponse } from "../../lib/backendError.js";
import { runMutation } from "../../lib/runMutation.js";
import {
  applyLabelToProfile, copyToBatchConfirmMessage, createProspectBody, createdButNotCopiedMessage,
  locationCreatedNotLinkedMessage, locationLabel, locationNotLinkedNotice, partyLabel,
  proposeLocationBody, quickPickAbilities,
} from "../../lib/batchQuickCreate.js";
// The location_type list is imported, never transcribed: writing `factory`
// here by hand is exactly what produced a live 500 (ck_lv_type permits only
// plant/office/warehouse/other), and the shared constant is pinned by a
// fixture so it cannot drift from the database constraint again.
import { LOCATION_TYPE_OPTS } from "../../lib/customerLocationActions.js";
import { Btn, Inp, Sel } from "../../ui/primitives.jsx";
import { C, sans } from "../../theme.js";
import { inputSt } from "../../ui/styles.js";

const overlaySt = { position: "fixed", inset: 0, background: "rgba(28,43,58,.45)", display: "flex",
  alignItems: "center", justifyContent: "center", zIndex: 10000 };
const cardSt = { width: 440, maxHeight: "84vh", overflowY: "auto", background: C.white,
  border: `1px solid ${C.border}`, borderRadius: 10, padding: 22,
  boxShadow: "0 8px 32px rgba(0,0,0,.2)", fontFamily: sans };
const labelSt = { fontSize: 10, fontWeight: 700, color: C.slateM, textTransform: "uppercase",
  letterSpacing: "0.05em", display: "block", marginBottom: 4, marginTop: 12 };
const noteSt = { fontSize: 11, color: C.slateL, marginTop: 6, lineHeight: 1.45 };
const rowSt = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
  padding: "5px 8px", border: `1px solid ${C.border}`, borderRadius: 5, marginTop: 4,
  fontSize: 11, color: C.slate };

const FIELD = "client"; // the only Batch field this modal may write

export default function BatchQuickPickModal({ profile, setBatchProfile, onClose, showToast }) {
  const { profile: caller } = useAuth();
  const { canCreate, canBrowse } = quickPickAbilities(caller);

  // Master rows for "select an existing" — only fetched when the caller may
  // browse. A caller who may not is never shown a list that would 403.
  const [masters, setMasters] = useState({ status: canBrowse ? "loading" : "denied", parties: [] });
  const [query, setQuery] = useState("");

  const [party, setParty] = useState(null);          // { id, display_name }
  const [partyWasCreated, setPartyWasCreated] = useState(false);
  const [newPartyName, setNewPartyName] = useState("");

  // The unlinked Customer Location convenience. `locDone` is a plain record of
  // what was created, for the confirmation line only — deliberately NOT a
  // "selected Location", because nothing consumes it and nothing may.
  const [showLocForm, setShowLocForm] = useState(false);
  const [locDraft, setLocDraft] = useState({ locationType: "", addressText: "",
    contactName: "", notes: "", billTo: false, shipTo: true });
  const [locDone, setLocDone] = useState(null);      // { label } | null

  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!canBrowse) return;
    let cancelled = false;
    (async () => {
      let resp, data;
      try {
        resp = await apiFetch("/masters/customer-families");
        data = await resp.json().catch(() => ({}));
      } catch {
        if (!cancelled) setMasters(m => ({ ...m, status: "error" }));
        return;
      }
      if (cancelled) return;
      const outcome = classifyResponse({ ok: resp.ok, status: resp.status, data });
      if (outcome.kind === "ok") {
        setMasters({ status: "ok", parties: data.parties || [] });
      } else {
        // Includes the explicit 403 from the route's own read_party_master
        // check. Browsing is unavailable; creating is a separate authority and
        // is not disabled by this.
        setMasters(m => ({ ...m, status: outcome.kind === "access-denied" ? "denied" : "error" }));
      }
    })();
    return () => { cancelled = true; };
  }, [canBrowse]);

  const partyMatches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return masters.parties
      .filter(p => !q || (p.display_name || "").toLowerCase().includes(q))
      .slice(0, 25);
  }, [masters.parties, query]);

  const label = partyLabel(party);
  const currentText = (profile?.[FIELD] || "").trim();
  const eligible = locDraft.billTo || locDraft.shipTo;

  const createProspect = async () => {
    const name = newPartyName.trim();
    if (!name) return;
    setBusy(true);
    const data = await runMutation("/masters/customer-families/prospects",
      createProspectBody(name, null),
      { showToast, successMessage: `Prospect "${name}" created.` });
    setBusy(false);
    if (!data) return;
    setParty({ id: data.party_id, display_name: name });
    setPartyWasCreated(true);
    setNewPartyName("");
  };

  // Governed Slice C proposal. Writes NOTHING to the Batch — not `delivery`,
  // not `client`, not freight. The only local effect is a note saying so.
  const proposeLocation = async () => {
    if (!party || !eligible) return;
    setBusy(true);
    const body = proposeLocationBody({
      locationType: locDraft.locationType, addressText: locDraft.addressText,
      contactName: locDraft.contactName, notes: locDraft.notes,
      billToEligible: locDraft.billTo, shipToEligible: locDraft.shipTo,
    });
    // showToast is NOT optional here. Omitting it made a real 500 from this
    // route completely invisible: the form simply sat there, which is the
    // silent-failure mode design-plan §2.7 forbids. Every governed call in
    // this file now reports its own outcome.
    const data = await runMutation(`/masters/parties/${party.id}/locations`, body,
      { showToast });
    setBusy(false);
    if (!data) return;
    const lbl = locationLabel({ id: data.id, location_code: null }, {
      address_text: body.address_text, contact_name: body.contact_name,
      notes: body.notes, location_type: body.location_type,
    });
    setLocDone({ label: lbl });
    setShowLocForm(false);
    setLocDraft({ locationType: "", addressText: "", contactName: "", notes: "",
      billTo: false, shipTo: true });
    showToast?.(locationCreatedNotLinkedMessage(lbl, party.display_name), "info", 11000);
  };

  // The ONLY write to Batch state in this slice.
  const confirmCopy = () => {
    setBatchProfile(p => applyLabelToProfile(p, FIELD, label));
    showToast?.(`✅ Client set to "${label}".`, "success", 5000);
    onClose();
  };

  // Cancel must leave the existing text unchanged — and must not pretend it
  // undid governed records that really were created.
  const cancel = () => {
    if (partyWasCreated) {
      showToast?.(createdButNotCopiedMessage("Client", partyLabel(party)), "info", 9000);
    }
    onClose();
  };

  return (
    <div style={overlaySt} role="dialog" aria-modal="true" aria-label="Set Client from Customer Master">
      <div style={cardSt}>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.slate }}>
          Set Client from the Customer Master
        </div>

        {/* The interim-representation disclosure, stated up front rather than
            only inside the confirm step, because it governs what the panel is
            FOR. */}
        <div style={{ ...noteSt, marginTop: 6, background: "#FEF8F0",
          border: `1px solid ${C.amber}`, borderRadius: 5, padding: "6px 8px" }}>
          Client is a free-text Batch value. Creating or selecting here records the customer
          properly in the Customer Master, then copies its name into the box — it does not store a
          link. The Batch keeps plain text you can edit or clear, and it will not follow later
          changes to the governed record. <strong>Delivery is not affected by anything on this
          panel</strong> — it stays a freight destination chosen from its own list.
        </div>

        {confirming ? (
          <>
            <label style={labelSt}>Confirm</label>
            <div style={{ fontSize: 12, color: C.slateM, lineHeight: 1.5 }}>
              {copyToBatchConfirmMessage(FIELD, label, currentText)}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <Btn ch="Set Client" full onClick={confirmCopy} />
              <Btn ch="Cancel" v="secondary" onClick={() => setConfirming(false)} />
            </div>
          </>
        ) : (
          <>
            {/* ── The Party — the only thing that reaches a Batch field ────── */}
            <label style={labelSt}>Customer or Prospect</label>

            {party ? (
              <div style={{ ...rowSt, borderColor: C.amber, background: "#FEF8F0" }}>
                <span><strong>{party.display_name}</strong>{partyWasCreated ? " · just created" : ""}</span>
                <Btn ch="Change" v="ghost" sm onClick={() => {
                  setParty(null); setPartyWasCreated(false);
                  setShowLocForm(false); setLocDone(null);
                }} />
              </div>
            ) : (
              <>
                {canCreate ? (
                  <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 4 }}>
                    <Inp value={newPartyName} onChange={setNewPartyName}
                      placeholder="New Prospect name" st={{ flex: 1 }} />
                    <Btn ch={busy ? "…" : "Create"} sm disabled={busy || !newPartyName.trim()}
                      onClick={createProspect} />
                  </div>
                ) : (
                  <div style={noteSt}>
                    You do not hold <code>manage_customer_master</code> or <code>make_quote</code>,
                    so you cannot create a Prospect. Type the Client by hand instead.
                  </div>
                )}

                {canBrowse && masters.status === "ok" && (
                  <>
                    <div style={{ marginTop: 10 }}>
                      <input value={query} onChange={e => setQuery(e.target.value)}
                        placeholder="…or search existing Customers and Prospects"
                        style={{ ...inputSt, width: "100%", boxSizing: "border-box" }} />
                    </div>
                    {partyMatches.length === 0 && (
                      <div style={noteSt}>No Customer or Prospect matches that search.</div>
                    )}
                    {partyMatches.map(p => (
                      <div key={p.id} style={rowSt}>
                        <span>{p.display_name}
                          {p.customer_code
                            ? <span style={{ color: C.slateL }}> · {p.customer_code}</span>
                            : <span style={{ color: C.slateL }}> · prospect</span>}
                        </span>
                        <Btn ch="Select" v="secondary" sm onClick={() => {
                          setParty(p); setPartyWasCreated(false);
                        }} />
                      </div>
                    ))}
                  </>
                )}
                {canBrowse && masters.status === "loading" && (
                  <div style={noteSt}>Loading existing Customers and Prospects…</div>
                )}
                {canBrowse && masters.status === "error" && (
                  <div style={noteSt}>Existing records could not be loaded. Creating still works.</div>
                )}
                {!canBrowse && (
                  <div style={noteSt}>
                    Browsing existing Customers and Prospects needs the{" "}
                    <code>read_party_master</code> capability, which your account does not hold.
                    {canCreate ? " Creating a new Prospect is a separate permission and is available to you." : ""}
                  </div>
                )}
              </>
            )}

            {/* ── Customer Location — create only, and explicitly unlinked ─── */}
            {party && canCreate && (
              <>
                <label style={labelSt}>Customer Location — optional, not linked to this Batch</label>
                <div style={noteSt}>{locationNotLinkedNotice()}</div>

                {locDone && (
                  <div style={{ ...rowSt, borderColor: C.green, background: "#F4FBF6" }}>
                    <span>✅ Created in Customer Master: <strong>{locDone.label}</strong>
                      <span style={{ color: C.slateL }}> · not linked to this Batch</span>
                    </span>
                  </div>
                )}

                {!showLocForm ? (
                  <div style={{ marginTop: 8 }}>
                    <Btn ch={locDone ? "Create another Location" : "Create Customer Location"}
                      v="secondary" sm onClick={() => setShowLocForm(true)} />
                  </div>
                ) : (
                  <>
                    <Sel value={locDraft.locationType}
                      onChange={v => setLocDraft(d => ({ ...d, locationType: v }))}
                      opts={LOCATION_TYPE_OPTS} ph="— type unspecified —" />
                    <div style={{ marginTop: 6 }}>
                      <Inp value={locDraft.addressText}
                        onChange={v => setLocDraft(d => ({ ...d, addressText: v }))}
                        placeholder="Address (optional)" st={{ width: "100%", boxSizing: "border-box" }} />
                    </div>
                    <div style={{ marginTop: 6 }}>
                      <Inp value={locDraft.contactName}
                        onChange={v => setLocDraft(d => ({ ...d, contactName: v }))}
                        placeholder="Contact name (optional)" st={{ width: "100%", boxSizing: "border-box" }} />
                    </div>
                    <div style={{ display: "flex", gap: 14, fontSize: 11, color: C.slateM, marginTop: 8 }}>
                      <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <input type="checkbox" checked={locDraft.billTo}
                          onChange={e => setLocDraft(d => ({ ...d, billTo: e.target.checked }))} /> Bill-to
                      </label>
                      <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <input type="checkbox" checked={locDraft.shipTo}
                          onChange={e => setLocDraft(d => ({ ...d, shipTo: e.target.checked }))} /> Ship-to
                      </label>
                    </div>
                    {/* Same rule, same wording, as the Customer Families screen —
                        a usability pre-check only; the route and
                        app_private.propose_customer_location refuse it
                        regardless of what this client sends. */}
                    {!eligible && (
                      <div style={{ marginTop: 6, fontSize: 11, color: C.red }}>
                        A Location must be Bill-to, Ship-to or both.
                      </div>
                    )}
                    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                      <Btn ch={busy ? "Creating…" : "Create in Customer Master"} sm
                        disabled={busy || !eligible} onClick={proposeLocation} />
                      <Btn ch="Cancel" v="ghost" sm disabled={busy}
                        onClick={() => setShowLocForm(false)} />
                    </div>
                  </>
                )}
              </>
            )}

            <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
              <Btn ch="Use for Client" full disabled={!label} onClick={() => setConfirming(true)} />
              <Btn ch="Cancel" v="secondary" onClick={cancel} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
