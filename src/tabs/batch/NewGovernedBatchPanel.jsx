import { useEffect, useMemo, useState } from "react";
import { useAppState } from "../../state/AppStateContext.js";
import { apiFetch } from "../../lib/apiClient.js";
import { classifyResponse } from "../../lib/backendError.js";
import { runMutation } from "../../lib/runMutation.js";
import { createProspectBody, likelyMatches } from "../../lib/batchQuickCreate.js";

const normalized = value => (value || "").trim().toLocaleLowerCase();

const familySearchText = family => [
  family.name,
  family.group_customer_code,
  ...(family.members || []).flatMap(member => [member.display_name, member.customer_code]),
].filter(Boolean).join(" ").toLocaleLowerCase();

export default function NewGovernedBatchPanel({
  fixtureOnly = false,
  fixtureOptions = null,
  fixtureBatch = null,
  currentFixtureBatch = null,
  onFixtureCreated = null,
}) {
  const { batchProfile, bindGovernedBatch, completeNewBatchStart, durableBatch,
    isPromoting, laneSelection, newBatchDialogOpen, profileDraft, returnToQuickCalculation,
    setNewBatchDialogOpen, showToast } = useAppState();
  const [state, setState] = useState(() => fixtureOnly
    ? { status: "ready", families: fixtureOptions?.families || [],
      plants: fixtureOptions?.plants || [], sectors: fixtureOptions?.sectors || [] }
    : { status: "loading", families: [], plants: [], sectors: [] });
  const [familyId, setFamilyId] = useState(() => fixtureOnly
    ? String(fixtureOptions?.families?.[0]?.id || "") : "");
  const [plantId, setPlantId] = useState(() => fixtureOnly
    ? String(fixtureOptions?.plants?.[0]?.id || "") : "");
  const [sectorId, setSectorId] = useState(() => fixtureOnly
    ? String(fixtureOptions?.sectors?.[0]?.id || "") : "");
  const [partyId, setPartyId] = useState(() => fixtureOnly
    && fixtureOptions?.families?.[0]?.members?.length === 1
      ? String(fixtureOptions.families[0].members[0].id) : "");
  const [shipToId, setShipToId] = useState("");
  const [billToId, setBillToId] = useState(() => fixtureOnly
    && fixtureOptions?.families?.[0]?.members?.length === 1
    && fixtureOptions.families[0].members[0].billing_locations?.length === 1
      ? String(fixtureOptions.families[0].members[0].billing_locations[0].id) : "");
  const [destinationText, setDestinationText] = useState("");
  const [billingText, setBillingText] = useState("");
  const [paymentDays, setPaymentDays] = useState("");
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [addingProspect, setAddingProspect] = useState(false);
  const [prospectName, setProspectName] = useState("");
  const [prospectFamilyId, setProspectFamilyId] = useState("");
  const [prospectSectorId, setProspectSectorId] = useState("");
  const [prospectError, setProspectError] = useState("");

  useEffect(() => {
    if (!newBatchDialogOpen || fixtureOnly) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const response = await apiFetch("/batches/create-options");
        const data = await response.json().catch(() => ({}));
        const outcome = classifyResponse({ ok: response.ok, status: response.status, data });
        if (cancelled) return;
        if (outcome.kind !== "ok") {
          setState({ status: outcome.kind === "access-denied" ? "denied" : "error",
            families: [], plants: [], sectors: [],
            message: outcome.message || "The governed Batch identities could not be loaded." });
          return;
        }
        const families = data.families || [];
        const plants = data.plants || [];
        const sectors = data.sectors || [];
        setState({ status: "ready", families, plants, sectors,
          sectorsDenied: data.sectors_denied === true,
          familySectorsDenied: data.family_sectors_denied === true,
          locationsDenied: data.locations_denied === true });

        const client = normalized(batchProfile.client);
        const matchingFamilies = families.filter(family =>
          normalized(family.name) === client
          || (family.members || []).some(member => normalized(member.display_name) === client));
        const initialFamily = matchingFamilies.length === 1 ? matchingFamilies[0] : null;
        setFamilyId(initialFamily ? String(initialFamily.id) : "");
        setPartyId(initialFamily?.members?.length === 1 ? String(initialFamily.members[0].id) : "");
        setShipToId("");
        setBillToId(initialFamily?.members?.length === 1
          && initialFamily.members[0].billing_locations?.length === 1
            ? String(initialFamily.members[0].billing_locations[0].id) : "");
        setDestinationText("");
        setBillingText("");
        setPaymentDays("");
        const matchingPlants = plants.filter(plant =>
          [plant.name, plant.plant_code].some(value => normalized(value) === normalized(batchProfile.plant)));
        setPlantId(matchingPlants.length === 1 ? String(matchingPlants[0].id)
          : plants.length === 1 ? String(plants[0].id) : "");
        const allowedSectorIds = new Set((initialFamily?.sector_ids || []).map(String));
        const matchingSectors = sectors.filter(sector => allowedSectorIds.has(String(sector.id)) &&
          [sector.name, sector.sector_code].some(value => normalized(value) === normalized(batchProfile.sector)));
        setSectorId(matchingSectors.length === 1 ? String(matchingSectors[0].id)
          : initialFamily?.sector_ids?.length ? String(initialFamily.sector_ids[0]) : "");
      } catch {
        if (!cancelled) setState({ status: "error", families: [], plants: [], sectors: [],
          message: "The Batch creation service could not be reached. Nothing was created." });
      }
    })();
    return () => { cancelled = true; };
  }, [newBatchDialogOpen, fixtureOnly, batchProfile.client, batchProfile.plant, batchProfile.sector]);

  const matchingFamilies = useMemo(() => {
    const needle = normalized(query);
    const rows = needle ? state.families.filter(family => familySearchText(family).includes(needle))
      : state.families;
    const visible = rows.slice(0, 100);
    const selected = state.families.find(family => String(family.id) === familyId);
    return selected && !visible.some(family => String(family.id) === familyId)
      ? [selected, ...visible] : visible;
  }, [query, state.families, familyId]);
  const selectedFamily = state.families.find(family => String(family.id) === familyId);
  const selectedParty = selectedFamily?.members?.find(member => String(member.id) === partyId);
  const deliveryLocations = selectedParty?.delivery_locations || [];
  const billingLocations = selectedParty?.billing_locations || [];
  const allowedSectorIds = new Set((selectedFamily?.sector_ids || []).map(String));
  const availableSectors = state.sectors.filter(sector => allowedSectorIds.has(String(sector.id)));
  const existingParties = useMemo(() => state.families.flatMap(family => family.members || []), [state.families]);
  const searchMatches = useMemo(() => likelyMatches(query, existingParties, { limit: 6 }),
    [query, existingParties]);
  const exactSearchMatch = existingParties.some(party => normalized(party.display_name) === normalized(query));
  const prospectMatches = useMemo(() => likelyMatches(prospectName, existingParties, { limit: 6 }),
    [prospectName, existingParties]);
  const prospectiveFamily = state.families.find(family => String(family.id) === prospectFamilyId);
  const prospectiveSectorIds = new Set((prospectiveFamily?.sector_ids || []).map(String));
  const prospectSectors = prospectFamilyId
    ? state.sectors.filter(sector => prospectiveSectorIds.has(String(sector.id))) : state.sectors;
  const createProspect = async () => {
    if (!prospectName.trim() || !prospectSectorId || busy) return;
    setBusy(true);
    setProspectError("");
    if (fixtureOnly) {
      const familyIdCreated = prospectFamilyId || `fixture-family-proposed-${Date.now()}`;
      const partyIdCreated = `fixture-party-proposed-${Date.now()}`;
      const party = { id: partyIdCreated, display_name: prospectName.trim(),
        customer_code: null, lifecycle_state: "prospect", status: "proposed",
        delivery_locations: [], billing_locations: [] };
      const families = prospectFamilyId
        ? state.families.map(family => String(family.id) === prospectFamilyId
          ? { ...family, members: [...(family.members || []), party] } : family)
        : [...state.families, { id: familyIdCreated, name: prospectName.trim(),
          group_customer_code: null, status: "proposed", sector_ids: [prospectSectorId], members: [party] }];
      setState(previous => ({ ...previous, families }));
      setFamilyId(String(familyIdCreated));
      setPartyId(partyIdCreated);
      setSectorId(String(prospectSectorId));
      setShipToId(""); setBillToId("");
      setQuery(party.display_name);
      setSearchOpen(false);
      setAddingProspect(false); setProspectName(""); setBusy(false);
      return;
    }
    const created = await runMutation("/masters/customer-families/prospects",
      createProspectBody(prospectName, prospectFamilyId || null, prospectSectorId),
      { showToast, successMessage: "Prospect created in Customer Master" });
    if (!created?.party_id || !created?.family_id) {
      setBusy(false);
      return;
    }
    try {
      const response = await apiFetch("/batches/create-options");
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error("Created Prospect could not be read with your customer-master authority.");
      const family = (data.families || []).find(item => String(item.id) === String(created.family_id));
      const party = family?.members?.find(item => String(item.id) === String(created.party_id));
      if (!party) throw new Error("Created Prospect is not caller-visible for Batch selection.");
      setState({ status: "ready", families: data.families || [], plants: data.plants || [],
        sectors: data.sectors || [], sectorsDenied: data.sectors_denied === true,
        familySectorsDenied: data.family_sectors_denied === true,
        locationsDenied: data.locations_denied === true });
      setFamilyId(String(family.id));
      setPartyId(String(party.id));
      setSectorId(String(prospectSectorId));
      setShipToId("");
      setBillToId("");
      setQuery(party.display_name || "");
      setSearchOpen(false);
      setAddingProspect(false);
      setProspectName("");
    } catch (error) {
      setProspectError(`${error.message} The Prospect was saved; ask for read_party_master access before creating its Batch.`);
    }
    setBusy(false);
  };
  const selectFamily = value => {
    setFamilyId(value);
    const family = state.families.find(item => String(item.id) === value);
    setPartyId(family?.members?.length === 1 ? String(family.members[0].id) : "");
    setShipToId("");
    setBillToId(family?.members?.length === 1 && family.members[0].billing_locations?.length === 1
      ? String(family.members[0].billing_locations[0].id) : "");
    setDestinationText("");
    setBillingText("");
    setSectorId(family?.sector_ids?.length ? String(family.sector_ids[0]) : "");
  };
  const ready = state.status === "ready" && familyId && partyId && plantId && sectorId
    && (shipToId || destinationText.trim()) && (billToId || billingText.trim())
    && paymentDays && !busy;
  const cancel = () => {
    setNewBatchDialogOpen(false);
    if (laneSelection?.lane === "customer" && !laneSelection.batchId) {
      returnToQuickCalculation?.();
    }
  };

  const releasePriorLock = async () => {
    if (fixtureOnly) return;
    if (!durableBatch?.id || !durableBatch.caller_holds_lock) return;
    try {
      const response = await apiFetch(`/batches/${durableBatch.id}/lock/release`, { method: "POST" });
      const data = await response.json().catch(() => ({}));
      const outcome = classifyResponse({ ok: response.ok, status: response.status, data });
      if (outcome.kind !== "ok") {
        showToast?.("⚠️ The previous Batch was unbound, but its edit lock could not be confirmed released.", "error", 9000);
      }
    } catch {
      showToast?.("⚠️ The previous Batch was unbound, but its edit-lock release outcome is unknown.", "error", 9000);
    }
  };

  const create = async event => {
    event.preventDefault();
    if (!ready) return;
    setBusy(true);
    if (fixtureOnly) {
      const created = structuredClone(fixtureBatch);
      created.family_id = familyId;
      created.customer_party_id = partyId;
      created.customer_party = selectedParty || null;
      created.family = selectedFamily || null;
      created.family_sectors = (selectedFamily?.sector_ids || []).map(id => ({
        family_id: familyId, sector_id: id,
        sector: state.sectors.find(sector => String(sector.id) === String(id)) || null,
      }));
      created.plant_id = plantId;
      created.plant = state.plants.find(plant => String(plant.id) === plantId) || null;
      created.sector_id = sectorId;
      created.sector = state.sectors.find(sector => String(sector.id) === sectorId) || null;
      created.batch_rows = [];
      created.batch_sets = [];
      created.available_constructions = (fixtureBatch.available_skus || []).flatMap(sku =>
        (sku.versions || []).map(version => ({ id: version.construction_version_id,
          construction_id: version.construction?.id,
          version_no: version.construction_version?.version_no || 1,
          construction: version.construction || null })));
      created.available_skus = (fixtureBatch.available_skus || []).filter(sku =>
        (selectedFamily?.members || []).some(member => String(member.id) === String(sku.party_id)));
      created.current_profile = { ...created.current_profile, version_no: 1,
        waste_cbb_pct: null, waste_pp_pct: null, conv_box_rate: null,
        conv_pp_rate: null, margin_box_pct: null, margin_pp_pct: null };
      const fixtureGroup = created.pricing_groups?.[0] || {};
      const fixtureRoute = fixtureGroup.delivery_groups?.[0] || {};
      created.pricing_groups = [{ ...fixtureGroup, label: "Default", content_version: 1,
        freight_basis_delivery_group_id: shipToId ? fixtureRoute.id : null,
        payment_terms_days: Number(paymentDays),
        delivery_groups: [{ ...fixtureRoute, ship_to_location_id: shipToId || null,
          bill_to_location_id: billToId || null,
          bill_to_location: billingLocations.find(location => String(location.id) === billToId) || null,
          ship_to_location: deliveryLocations.find(location => String(location.id) === shipToId) || null,
          destination_text: destinationText.trim() || null,
          billing_text: billingText.trim() || null,
          route_notes: null }] }];
      onFixtureCreated?.(created);
      setNewBatchDialogOpen(false);
      showToast?.("Fixture-only Batch created in memory.", "success", 4500);
      setBusy(false);
      return;
    }
    const data = await runMutation("/batches", {
      family_id: Number(familyId),
      customer_party_id: Number(partyId),
      plant_id: Number(plantId),
      sector_id: Number(sectorId),
      ship_to_location_id: shipToId ? Number(shipToId) : null,
      bill_to_location_id: billToId ? Number(billToId) : null,
      delivery_destination: destinationText.trim() || null,
      billing_destination: billingText.trim() || null,
      payment_terms_days: Number(paymentDays),
    }, { showToast, successMessage: "Governed Batch created" });
    if (data?.batch) {
      await releasePriorLock();
      // A PROMOTION keeps the local rows as inputs; an ordinary + New Batch
      // clears them exactly as it always did.
      completeNewBatchStart(data.batch, { keepLocalInputs: isPromoting?.() === true });
      // The ONE place a Customer-quote selection becomes governed. Until this
      // line runs the lane reads `customer_pending` and the interface does not
      // claim governed authority for anything (lib/quoteJourney.js).
      bindGovernedBatch?.(data.batch);
    }
    setBusy(false);
  };

  const clearLocalOnly = async () => {
    setBusy(true);
    if (fixtureOnly) {
      onFixtureCreated?.(null);
      setNewBatchDialogOpen(false);
      setBusy(false);
      return;
    }
    await releasePriorLock();
    completeNewBatchStart(null);
    // Cleared the local draft and unbound the Batch without creating one, so
    // the customer-quote intent recorded when this panel opened is no longer
    // true. Fall back to the private lane rather than leaving a pending
    // selection that claims a workflow the user backed out of.
    returnToQuickCalculation?.();
    setBusy(false);
  };

  if (!newBatchDialogOpen) return null;
  return <div className="new-batch-panel-scrim" role="presentation">
    <section className="new-batch-panel" role="dialog" aria-modal="true"
      aria-labelledby="new-governed-batch-title">
      <header>
        <div>
          <span>{fixtureOnly ? "U4 · FIXTURE-ONLY CREATION" : "U4 · GOVERNED CREATION"}</span>
          <h2 id="new-governed-batch-title">Start a new Batch</h2>
          <p>{fixtureOnly
            ? "This isolated illustration creates an in-memory Batch, default Pricing Group, default Delivery Group and edit lock. Nothing is persisted."
            : "The permanent reference, Pricing Basis, default Pricing Group, default Delivery Group and edit lock are created together."}</p>
        </div>
        <button type="button" onClick={cancel} disabled={busy}
          aria-label="Cancel new Batch">×</button>
      </header>

      <div className="new-batch-panel-content">
        {(fixtureOnly ? currentFixtureBatch : durableBatch) && <div className="new-batch-impact is-warning">
          Current {fixtureOnly ? "fixture" : "governed"} Batch <strong>{(fixtureOnly ? currentFixtureBatch : durableBatch).batch_reference}</strong>
          {fixtureOnly ? " will be replaced only in isolated memory." : " will remain unchanged and be unbound from this screen."}
          {!fixtureOnly && durableBatch.caller_holds_lock ? " Its edit lock will be released after the new Batch is created." : ""}
        </div>}
        <div className="new-batch-impact">
          <strong>On success</strong>
          {fixtureOnly ? <>
            <span>Replaces only this labelled, in-memory fixture workspace.</span>
            <span>Creates no Batch reference, database record, calculation, Quote or workflow action.</span>
          </> : <>
            <span>{isPromoting?.()
              ? "Keeps your SKU rows as inputs. The chosen governed Customer and route replace local profile text; every local price and Quote Item is cleared."
              : "Replaces the local profile with the saved Customer, route and terms; clears SKU rows, results and Quote Items."}</span>
            <span>{profileDraft !== null
              ? "Keeps the independent new-Batch Costing draft."
              : "Discards the same-Batch Costing draft because it belongs to the Batch being left."}</span>
            <span>Unlinks any Deep-Dive review. No calculation, Quote or workflow action is created.</span>
          </>}
        </div>

        {state.status === "loading" && <div className="new-batch-state" role="status">Loading governed Customer, Plant and Sector identities…</div>}
        {(state.status === "denied" || state.status === "error") && <div className="new-batch-state is-error" role="status">
          {state.message} No local state has been cleared.
        </div>}

        {state.status === "ready" && <form onSubmit={create}>
          <button type="button" className="new-batch-find-toggle" aria-expanded={searchOpen}
            onClick={() => setSearchOpen(open => !open)}>
            Find or create Customer/Prospect <span aria-hidden="true">▾</span>
          </button>
          {searchOpen && <div className="new-batch-search-choices">
            <label className="new-batch-family-search">Search Customer Master
              <input type="search" value={query} onChange={event => setQuery(event.target.value)}
                onKeyDown={event => {
                  if (event.key === "Escape") setSearchOpen(false);
                  if (event.key === "Enter") event.preventDefault();
                }} placeholder="Customer name, Family or code" autoFocus />
            </label>
            {query.trim() && <>
              {searchMatches.length === 0 && <small>No Customer or Prospect matches that text.</small>}
              {searchMatches.map(({ party }) => {
                const family = state.families.find(item => item.members?.some(member => member.id === party.id));
                return <button key={party.id} type="button" onClick={() => {
                  if (!family) return;
                  selectFamily(String(family.id));
                  setPartyId(String(party.id));
                  setQuery(party.display_name);
                  setSearchOpen(false);
                  setAddingProspect(false);
                }}>{party.display_name} · {party.customer_code || "Prospect"} · {family?.name || "Family unavailable"}</button>;
              })}
              {!exactSearchMatch && <button type="button" className="is-create" disabled={busy}
                onClick={() => { setAddingProspect(true); setProspectName(query.trim());
                  setProspectFamilyId(""); setProspectSectorId(sectorId); setProspectError("");
                  setSearchOpen(false); }}>
                ⊕ Create “{query.trim()}” as a new Prospect…
              </button>}
            </>}
          </div>}
          {addingProspect && <div className="new-batch-prospect-entry">
            <strong>Create a governed Prospect in this quote</strong>
            <button type="button" onClick={() => setAddingProspect(false)} disabled={busy}>Close Prospect entry</button>
            <label>Prospect name
              <input value={prospectName} onChange={event => setProspectName(event.target.value)}
                maxLength={200} placeholder="Exact customer or prospect name" />
            </label>
            {prospectMatches.length > 0 && <div role="status" className="new-batch-prospect-matches">
              <strong>Check similar existing Customers first</strong>
              {prospectMatches.map(({ party }) => <button key={party.id} type="button" onClick={() => {
                const family = state.families.find(item => item.members?.some(member => member.id === party.id));
                if (family) { selectFamily(String(family.id)); setPartyId(String(party.id));
                  setAddingProspect(false); setProspectName(""); }
              }}>{party.display_name} · {party.customer_code || "Prospect"} · use existing</button>)}
            </div>}
            <label>Customer Family
              <select value={prospectFamilyId} onChange={event => {
                setProspectFamilyId(event.target.value);
                const family = state.families.find(item => String(item.id) === event.target.value);
                setProspectSectorId(family?.sector_ids?.length ? String(family.sector_ids[0]) : "");
              }}>
                <option value="">Create a proposed Family with this Prospect</option>
                {state.families.map(family => <option key={family.id} value={family.id}>{family.name}</option>)}
              </select>
            </label>
            <label>Sector
              <select value={prospectSectorId} onChange={event => setProspectSectorId(event.target.value)}>
                <option value="">Choose Sector</option>
                {prospectSectors.map(sector => <option key={sector.id} value={sector.id}>{sector.name}</option>)}
              </select>
            </label>
            <small>The selected producing Plant stays in this quote. Finish delivery and payment terms below after creation.</small>
            {prospectError && <div role="alert">{prospectError}</div>}
            <button type="button" disabled={busy || !prospectName.trim() || !prospectSectorId}
              onClick={createProspect}>{busy ? "Creating…" : "Create and select Prospect"}</button>
          </div>}
          <label>Customer Family
            <select value={familyId} onChange={event => selectFamily(event.target.value)} required>
              <option value="">Select governed Customer Family</option>
              {matchingFamilies.map(family => <option key={family.id} value={family.id}>
                {family.group_customer_code || "No family code"} · {family.name} · #{family.id}
              </option>)}
            </select>
            {state.families.length > 100 && <small>Showing the first 100 matching Families; refine the search to find another.</small>}
          </label>

          {selectedFamily && <label>Customer or Prospect
            <select value={partyId} onChange={event => {
              const member = selectedFamily.members?.find(item => String(item.id) === event.target.value);
              setPartyId(event.target.value);
              setShipToId("");
              setBillToId(member?.billing_locations?.length === 1
                ? String(member.billing_locations[0].id) : "");
              setDestinationText("");
              setBillingText("");
            }} required>
              <option value="">{selectedFamily.members?.length > 1
                ? "Choose the exact member Customer" : "Select Customer or Prospect"}</option>
              {(selectedFamily.members || []).map(member => <option key={member.id} value={member.id}>
                {member.display_name} · {member.customer_code || "Prospect"}
              </option>)}
            </select>
            {!selectedFamily.members?.length && <small>No caller-visible current member Customer is available.</small>}
          </label>}

          <div className="new-batch-two-fields">
            <label>Producing Plant
              <select value={plantId} onChange={event => setPlantId(event.target.value)} required>
                <option value="">Select Maker Plant</option>
                {state.plants.map(plant => <option key={plant.id} value={plant.id}>
                  {plant.plant_code} · {plant.name} · #{plant.id}
                </option>)}
              </select>
              {!state.plants.length && <small>No active Plant is available with your current make-quote authority.</small>}
            </label>
            <label>Sector
              <select value={sectorId} onChange={event => setSectorId(event.target.value)}
                disabled={state.sectorsDenied || state.familySectorsDenied || !selectedFamily} required>
                <option value="">Select one Family Sector</option>
                {availableSectors.map(sector => <option key={sector.id} value={sector.id}>
                  {sector.sector_code} · {sector.name} · #{sector.id}
                </option>)}
              </select>
              {(state.sectorsDenied || state.familySectorsDenied) && <small>
                Sector classification is denied to this caller; Batch creation is unavailable.
              </small>}
              {selectedFamily && !availableSectors.length && <small>
                This Customer Family has no caller-visible Sector classification. Classify it in Customer Families before creating a Batch.
              </small>}
              {availableSectors.length > 0 && <small>
                The first attached Sector is suggested. This Batch uses exactly one; all guidance and inheritance follow the selected Sector only.
              </small>}
            </label>
          </div>

          {selectedParty && <div className="new-batch-family-evidence" aria-live="polite">
            <strong>{selectedParty.display_name} · {selectedParty.customer_code || "Prospect"}</strong>
            <span>Family: {selectedFamily.name} · {selectedFamily.group_customer_code || `#${selectedFamily.id}`}</span>
            <span>Plant: {state.plants.find(plant => String(plant.id) === plantId)?.name || "Choose Plant"}</span>
            <span>Sector: {state.sectors.find(sector => String(sector.id) === sectorId)?.name || "Choose Sector"}</span>
          </div>}

          <div className="new-batch-two-fields">
            <label>Delivery destination
              <select value={shipToId} onChange={event => {
                setShipToId(event.target.value);
                if (event.target.value) setDestinationText("");
              }}
                disabled={!selectedParty || state.locationsDenied}>
                <option value="">{deliveryLocations.length ? "Enter a quote-specific destination" : "No active Ship-to Location — enter destination"}</option>
                {deliveryLocations.map(location => <option key={location.id} value={location.id}>
                  {location.location_code || `Approved Location #${location.id}`}
                </option>)}
              </select>
              {state.locationsDenied && <small>Approved Locations are not visible; enter the destination below.</small>}
            </label>
            <label>Payment terms
              <select value={paymentDays} onChange={event => setPaymentDays(event.target.value)} required>
                <option value="">Choose credit period</option>
                {[30, 45, 60, 90].map(days => <option key={days} value={days}>≤{days} days</option>)}
              </select>
            </label>
          </div>
          {!shipToId && <label>Quote-specific delivery destination
            <input value={destinationText} maxLength={500}
              onChange={event => setDestinationText(event.target.value)}
              placeholder="Enter the delivery address or destination" required={!shipToId} />
            <small>Saved as Batch context, not an approved Location. Master-backed freight remains blocked until a Ship-to is linked.</small>
          </label>}
          {selectedParty && <label>Bill-to Location (when available)
            <select value={billToId} onChange={event => {
              setBillToId(event.target.value);
              if (event.target.value) setBillingText("");
            }}
              disabled={state.locationsDenied}>
              <option value="">No approved Bill-to Location selected</option>
              {billingLocations.map(location => <option key={location.id} value={location.id}>
                {location.location_code || `Approved Location #${location.id}`}
              </option>)}
            </select>
          </label>}
          {!billToId && <label>Quote-specific billing destination
            <input value={billingText} maxLength={500}
              onChange={event => setBillingText(event.target.value)}
              placeholder="Enter the billing address or destination" required={!billToId} />
            <small>Saved as Batch context, not an approved Location. Route readiness remains blocked until a Bill-to is linked.</small>
          </label>}

          <div className="new-batch-panel-actions">
            <button type="button" onClick={cancel} disabled={busy}>Cancel</button>
            <button type="button" className="is-secondary-danger" onClick={clearLocalOnly} disabled={busy}>
              {fixtureOnly ? "Clear fixture workspace only" : "Clear local draft only"}
            </button>
            <button type="submit" className="is-primary" disabled={!ready}>
              {busy ? "Creating…" : fixtureOnly ? "Create fixture Batch in memory" : "Create governed Batch"}
            </button>
          </div>
        </form>}
      </div>

      <footer>
        {fixtureOnly && <><strong>FIXTURE ONLY</strong> · no authoritative read or write. </>}
        Governed Calculate and Atomic Send become available in the saved Batch workspace; Submit and later workflow actions remain separate.
      </footer>
    </section>
  </div>;
}
