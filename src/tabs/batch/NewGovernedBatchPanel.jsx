import { useEffect, useMemo, useState } from "react";
import { useAppState } from "../../state/AppStateContext.js";
import { apiFetch } from "../../lib/apiClient.js";
import { classifyResponse } from "../../lib/backendError.js";
import { runMutation } from "../../lib/runMutation.js";

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
  const { batchProfile, completeNewBatchStart, durableBatch, newBatchDialogOpen,
    profileDraft, setNewBatchDialogOpen, showToast } = useAppState();
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
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);

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
          familySectorsDenied: data.family_sectors_denied === true });

        const client = normalized(batchProfile.client);
        const matchingFamilies = families.filter(family =>
          normalized(family.name) === client
          || (family.members || []).some(member => normalized(member.display_name) === client));
        const initialFamily = matchingFamilies.length === 1 ? matchingFamilies[0] : null;
        setFamilyId(initialFamily ? String(initialFamily.id) : "");
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
    return rows.slice(0, 100);
  }, [query, state.families]);
  const selectedFamily = state.families.find(family => String(family.id) === familyId);
  const allowedSectorIds = new Set((selectedFamily?.sector_ids || []).map(String));
  const availableSectors = state.sectors.filter(sector => allowedSectorIds.has(String(sector.id)));
  const selectFamily = value => {
    setFamilyId(value);
    const family = state.families.find(item => String(item.id) === value);
    setSectorId(family?.sector_ids?.length ? String(family.sector_ids[0]) : "");
  };
  const ready = state.status === "ready" && familyId && plantId && sectorId && !busy;

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
      created.plant_id = plantId;
      created.sector_id = sectorId;
      created.sector = state.sectors.find(sector => String(sector.id) === sectorId) || null;
      onFixtureCreated?.(created);
      setNewBatchDialogOpen(false);
      showToast?.("Fixture-only Batch created in memory.", "success", 4500);
      setBusy(false);
      return;
    }
    const data = await runMutation("/batches", {
      family_id: Number(familyId),
      plant_id: Number(plantId),
      sector_id: Number(sectorId),
    }, { showToast, successMessage: "Governed Batch created" });
    if (data?.batch) {
      await releasePriorLock();
      completeNewBatchStart(data.batch);
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
        <button type="button" onClick={() => setNewBatchDialogOpen(false)} disabled={busy}
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
            <span>Clears the current local profile, SKU rows, results and Quote Items.</span>
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
          <label className="new-batch-family-search">Find Customer Family or member Customer
            <input type="search" value={query} onChange={event => setQuery(event.target.value)}
              placeholder="Family, Customer name or code" />
          </label>
          <label>Customer Family
            <select value={familyId} onChange={event => selectFamily(event.target.value)} required>
              <option value="">Select governed Customer Family</option>
              {matchingFamilies.map(family => <option key={family.id} value={family.id}>
                {family.group_customer_code || "No family code"} · {family.name} · #{family.id}
              </option>)}
            </select>
            {state.families.length > 100 && <small>Showing the first 100 matching Families; refine the search to find another.</small>}
          </label>

          {selectedFamily && <div className="new-batch-family-evidence">
            <strong>{selectedFamily.name}</strong>
            <span>{selectedFamily.group_customer_code || "No family code"} · Family #{selectedFamily.id}</span>
            {(selectedFamily.members || []).length
              ? selectedFamily.members.map(member => <span key={member.id}>
                {member.display_name} · {member.customer_code || "Prospect / no Customer code"} · {member.lifecycle_state} · Party #{member.id}
              </span>)
              : <span>No caller-visible current member Customers.</span>}
          </div>}

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

          <div className="new-batch-panel-actions">
            <button type="button" onClick={() => setNewBatchDialogOpen(false)} disabled={busy}>Cancel</button>
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
