// ═══════════════════════════════════════════════════════════════════════════
// src/tabs/batch/BatchQuickPickModal.jsx — U1 Slice D, the affordance itself.
//
// docs/u1-customer-foundation-authorization-packet.md, Slice D. Kept in its
// own file so BatchProfileBar.jsx gains a button and an import and nothing
// else — that file carries a preserved, user-owned uncommitted hunk in its
// Commercials region, and the smallest possible edit there is deliberate.
//
// WHAT IT DOES, AND WHERE IT STOPS.
//
// Two governed calls, sequenced by the user, never composed into one request:
//   POST /masters/customer-families/prospects   (create_minimal_prospect)
//   POST /masters/parties/<id>/locations        (propose_customer_location)
// plus, for selecting an existing record, the read the Customer Families
// screen already uses: GET /masters/customer-families.
//
// The ONLY thing it writes to Batch state is one string, through
// applyLabelToProfile(). No partyId, no locationId, no link object, no
// staleness state, no new Batch Profile key, no new localStorage key. See the
// boundary note at the top of lib/batchQuickCreate.js.
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
  deliveryFreightWarning, deliveryLabelIsOffFreightMatrix, fieldTitle, locationLabel, partyLabel,
  proposeLocationBody, quickPickAbilities,
} from "../../lib/batchQuickCreate.js";
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

const LOCATION_TYPE_OPTS = [
  { v: "factory", l: "Factory" }, { v: "office", l: "Office" },
  { v: "warehouse", l: "Warehouse" }, { v: "other", l: "Other" },
];

export default function BatchQuickPickModal({ field, profile, setBatchProfile,
  freightLocations, onClose, showToast }) {
  const { profile: caller } = useAuth();
  const { canCreate, canBrowse } = quickPickAbilities(caller);
  const title = fieldTitle(field);
  const needsLocation = field === "delivery";

  // Master rows for "select an existing" — only fetched when the caller may
  // browse. A caller who may not is never shown a list that would 403.
  const [masters, setMasters] = useState({ status: canBrowse ? "loading" : "denied",
    parties: [], locations: [], locationVersions: [] });
  const [query, setQuery] = useState("");

  // The Party is the first step for BOTH fields: `client` copies its name, and
  // a Location cannot be proposed without its parent Party.
  const [party, setParty] = useState(null);          // { id, display_name }
  const [partyWasCreated, setPartyWasCreated] = useState(false);
  const [newPartyName, setNewPartyName] = useState("");

  // The Location, for `delivery` only.
  const [picked, setPicked] = useState(null);        // { location, version }
  const [locDraft, setLocDraft] = useState({ locationType: "", addressText: "",
    contactName: "", notes: "", billTo: false, shipTo: true });
  const [locWasCreated, setLocWasCreated] = useState(false);

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
        setMasters({ status: "ok", parties: data.parties || [], locations: data.locations || [],
          locationVersions: data.location_versions || [] });
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
    const rows = masters.parties.filter(p => !q || (p.display_name || "").toLowerCase().includes(q));
    return rows.slice(0, 25);
  }, [masters.parties, query]);

  // Only this Party's Locations. Slice D deliberately reaches no further: a
  // cross-Family third-party Bill-to/Ship-to search belongs to U4's Delivery
  // Group UI, per the packet's own deferral.
  const partyLocations = useMemo(() => {
    if (!party) return [];
    const versionFor = (locId) => masters.locationVersions
      .filter(v => v.location_id === locId)
      .sort((a, b) => (b.version_no || 0) - (a.version_no || 0))[0] || null;
    return masters.locations
      .filter(l => l.party_id === party.id && l.status !== "inactive")
      .map(l => ({ location: l, version: versionFor(l.id) }));
  }, [masters.locations, masters.locationVersions, party]);

  const label = needsLocation
    ? locationLabel(picked?.location, picked?.version)
    : partyLabel(party);
  const currentText = (profile?.[field] || "").trim();
  const offMatrix = needsLocation && deliveryLabelIsOffFreightMatrix(label, freightLocations);

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

  const proposeLocation = async () => {
    if (!party || !(locDraft.billTo || locDraft.shipTo)) return;
    setBusy(true);
    const body = proposeLocationBody({
      locationType: locDraft.locationType, addressText: locDraft.addressText,
      contactName: locDraft.contactName, notes: locDraft.notes,
      billToEligible: locDraft.billTo, shipToEligible: locDraft.shipTo,
    });
    const data = await runMutation(`/masters/parties/${party.id}/locations`, body,
      { showToast, successMessage: "Location proposed." });
    setBusy(false);
    if (!data) return;
    setPicked({
      location: { id: data.id, location_code: null, party_id: party.id, status: "proposed" },
      version: { address_text: body.address_text, contact_name: body.contact_name,
        notes: body.notes, location_type: body.location_type },
    });
    setLocWasCreated(true);
  };

  // The ONLY write to Batch state in this slice.
  const confirmCopy = () => {
    setBatchProfile(p => applyLabelToProfile(p, field, label));
    showToast?.(`✅ ${title} set to "${label}".`, "success", 5000);
    onClose();
  };

  // Cancel must leave the existing text unchanged — and must not pretend it
  // undid a governed create that really happened.
  const cancel = () => {
    if (partyWasCreated || locWasCreated) {
      const created = locWasCreated ? locationLabel(picked?.location, picked?.version)
        : partyLabel(party);
      showToast?.(createdButNotCopiedMessage(title, created), "info", 9000);
    }
    onClose();
  };

  const eligible = locDraft.billTo || locDraft.shipTo;

  return (
    <div style={overlaySt} role="dialog" aria-modal="true" aria-label={`Set ${title} from Customer Master`}>
      <div style={cardSt}>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.slate }}>
          Set {title} from the Customer Master
        </div>

        {/* The interim-representation disclosure, stated up front rather than
            only inside the confirm step, because it governs what the whole
            panel is FOR. */}
        <div style={{ ...noteSt, marginTop: 6, background: "#FEF8F0",
          border: `1px solid ${C.amber}`, borderRadius: 5, padding: "6px 8px" }}>
          {title} is a free-text Batch value. Creating or selecting here records the customer
          properly in the Customer Master, then copies its name into the box — it does not store a
          link. The Batch keeps plain text you can edit or clear, and it will not follow later
          changes to the governed record.
        </div>

        {confirming ? (
          <>
            <label style={labelSt}>Confirm</label>
            <div style={{ fontSize: 12, color: C.slateM, lineHeight: 1.5 }}>
              {copyToBatchConfirmMessage(field, label, currentText)}
            </div>
            {offMatrix && (
              <div style={{ ...noteSt, color: C.red, marginTop: 10 }}>
                ⚠️ {deliveryFreightWarning(label)}
              </div>
            )}
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <Btn ch={`Set ${title}`} full onClick={confirmCopy} />
              <Btn ch="Cancel" v="secondary" onClick={() => setConfirming(false)} />
            </div>
          </>
        ) : (
          <>
            {/* ── STEP 1 — the Party ──────────────────────────────────────── */}
            <label style={labelSt}>
              {needsLocation ? "1 · Customer or Prospect (the Location's owner)" : "Customer or Prospect"}
            </label>

            {party ? (
              <div style={{ ...rowSt, borderColor: C.amber, background: "#FEF8F0" }}>
                <span><strong>{party.display_name}</strong>{partyWasCreated ? " · just created" : ""}</span>
                <Btn ch="Change" v="ghost" sm onClick={() => {
                  setParty(null); setPartyWasCreated(false); setPicked(null); setLocWasCreated(false);
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
                    so you cannot create a Prospect. Type the {title} by hand instead.
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

            {/* ── STEP 2 — the Location, delivery only ────────────────────── */}
            {needsLocation && party && (
              <>
                <label style={labelSt}>2 · Location</label>
                {picked ? (
                  <div style={{ ...rowSt, borderColor: C.amber, background: "#FEF8F0" }}>
                    <span><strong>{label}</strong>{locWasCreated ? " · just proposed" : ""}</span>
                    <Btn ch="Change" v="ghost" sm
                      onClick={() => { setPicked(null); setLocWasCreated(false); }} />
                  </div>
                ) : (
                  <>
                    {canBrowse && partyLocations.map(({ location, version }) => (
                      <div key={location.id} style={rowSt}>
                        <span>{locationLabel(location, version)}
                          <span style={{ color: C.slateL }}> · {location.status}
                            {location.bill_to_eligible ? " · bill-to" : ""}
                            {location.ship_to_eligible ? " · ship-to" : ""}</span>
                        </span>
                        <Btn ch="Select" v="secondary" sm
                          onClick={() => setPicked({ location, version })} />
                      </div>
                    ))}
                    {canBrowse && partyLocations.length === 0 && (
                      <div style={noteSt}>
                        This {partyWasCreated ? "new Prospect has no Locations yet" : "Party has no selectable Locations"}.
                        Propose one below.
                      </div>
                    )}
                    {!canBrowse && (
                      <div style={noteSt}>
                        Existing Locations cannot be listed without <code>read_party_master</code>.
                        You can still propose a new one.
                      </div>
                    )}

                    {canCreate && (
                      <>
                        <label style={labelSt}>Propose a new Location</label>
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
                        {/* Same rule, same wording, as the Customer Families
                            screen — a usability pre-check only; the route and
                            app_private.propose_customer_location refuse it
                            regardless of what this client sends. */}
                        {!eligible && (
                          <div style={{ marginTop: 6, fontSize: 11, color: C.red }}>
                            A Location must be Bill-to, Ship-to or both.
                          </div>
                        )}
                        <div style={{ marginTop: 8 }}>
                          <Btn ch={busy ? "Proposing…" : "Propose Location"} sm
                            disabled={busy || !eligible} onClick={proposeLocation} />
                        </div>
                      </>
                    )}
                  </>
                )}
              </>
            )}

            <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
              <Btn ch={`Use for ${title}`} full disabled={!label} onClick={() => setConfirming(true)} />
              <Btn ch="Cancel" v="secondary" onClick={cancel} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

