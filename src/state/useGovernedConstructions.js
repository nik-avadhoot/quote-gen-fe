// ═══════════════════════════════════════════════════════════════════════════
// src/state/useGovernedConstructions.js — the governed Construction Library as
// the Batch Builder's and Costing's construction source.
//
// Product Owner ruling 2026-09-22 (beta issue log item 2): new Constructions go
// to the governed library, and the local A–Z codes are retired. This slice
// loads `/masters/constructions` and `/masters/plants` on the caller's own
// token and hands the pickers `constructionCatalogue` — governed entries for
// the Batch's plant, with the browser-held legacy entries kept behind them so
// rows already stored against an A–Z code still resolve and still cost.
//
// ── IT NEVER FABRICATES A LIBRARY ─────────────────────────────────────────
// A denial, a failed read and an empty library are three different facts and
// are kept apart in `governedConstructionState`. None of them is answered with
// local data pretending to be governed: on a denial or an error the catalogue
// simply contains no governed entries, and the picker says why.
//
// ── ONE READ, NOT A POLL ──────────────────────────────────────────────────
// Masters change under governance, not per keystroke, so this reads once per
// sign-in (and on an explicit refresh, which the Admin publish-and-adopt form
// calls after it creates one) rather than re-fetching per render or per row.
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useMemo, useState } from "react";
import { constructionCatalogue, governedConstructionsForPlant, plantIdForProfilePlant }
  from "../lib/governedConstructionCatalogue.js";
import { apiFetch } from "../lib/apiClient.js";
import { hasCapability } from "../lib/capabilities.js";
import { isFeatureEnabled } from "../lib/featureFlags.js";

const IDLE = { status: "idle", payload: null, message: "" };
const LOADING = { status: "loading", payload: null, message: "" };

export function useGovernedConstructions(st) {
  const { batchProfile, constructionLib, profile } = st;
  const [fetched, setFetched] = useState(LOADING);
  const [plantRows, setPlants] = useState([]);
  const [reloadToken, setReloadToken] = useState(0);

  const enabled = isFeatureEnabled("u2_construction_library")
    && hasCapability(profile, "read_construction_library");

  // Derived, not stored: without the flag or the capability there is nothing to
  // report and nothing to clear. Writing that state from the effect would only
  // re-render to reach the value this line already has.
  const state = enabled ? fetched : IDLE;
  // Memoised so the disabled branch keeps ONE array identity: a fresh [] each
  // render would re-run every memo below it on every render.
  const plants = useMemo(() => (enabled ? plantRows : []), [enabled, plantRows]);

  useEffect(() => {
    if (!enabled) return undefined;
    let live = true;
    (async () => {
      try {
        const [constructionsResponse, plantsResponse] = await Promise.all([
          apiFetch("/masters/constructions"),
          apiFetch("/masters/plants").catch(() => null),
        ]);
        if (!live) return;
        const data = await constructionsResponse.json().catch(() => ({}));
        if (constructionsResponse.status === 403) {
          setFetched({ status: "denied", payload: null,
            message: "read_construction_library is required to load the governed Construction Library." });
          return;
        }
        if (!constructionsResponse.ok) {
          setFetched({ status: "error", payload: null,
            message: "The governed Construction Library could not be read. No local library was substituted." });
          return;
        }
        if (plantsResponse?.ok) {
          const plantData = await plantsResponse.json().catch(() => ({}));
          if (live) setPlants(plantData.plants || plantData.rows || []);
        }
        if (live) setFetched({ status: "ready", payload: data, message: "" });
      } catch {
        if (live) setFetched({ status: "error", payload: null,
          message: "The governed Construction Library could not be reached. No local library was substituted." });
      }
    })();
    return () => { live = false; };
  }, [enabled, reloadToken]);

  const refreshGovernedConstructions = useCallback(() => setReloadToken(token => token + 1), []);

  // The Batch Profile still stores a plant NAME; adoption is keyed by plant id.
  const batchPlantId = useMemo(
    () => plantIdForProfilePlant(plants, batchProfile?.plant), [plants, batchProfile?.plant]);

  const governedConstructions = useMemo(
    () => governedConstructionsForPlant(
      state.payload, batchPlantId, state.payload?.adoptions_partial === true),
    [state.payload, batchPlantId]);

  const catalogue = useMemo(
    () => constructionCatalogue(governedConstructions, constructionLib),
    [governedConstructions, constructionLib]);

  // The exact caller-visible plant row the Batch sits at, or null. The create
  // form needs the id (adoption is keyed by it) and the code (the caller's
  // adopt_construction_for_plant grant is keyed by that), and must offer
  // nothing at all when the Batch Profile's plant matches no governed plant.
  const batchPlant = useMemo(
    () => (plants || []).find(plant => plant?.id === batchPlantId) || null,
    [plants, batchPlantId]);

  return {
    constructionCatalogue: catalogue,
    governedConstructions,
    // The caller-visible plant rows, for any screen that must name the exact
    // plant a Construction would be adopted at (the SKU proposal form does).
    governedPlants: plants,
    governedConstructionBatchPlant: batchPlant,
    governedConstructionState: { ...state, enabled, plantResolved: batchPlantId !== null },
    refreshGovernedConstructions,
  };
}
