// ═══════════════════════════════════════════════════════════════════════════
// src/state/useGovernedSectors.js — the governed Sector master as the one
// Sector source for Costing, the Batch Builder and Commercial Policies.
//
// Product Owner ruling 2026-09-22: Commercial Policies becomes the governed
// Sector master. Before this, Commercial Policies edited a browser-local
// `cbb_sectors` list in localStorage that NO other screen read, while the
// Customer Families dropdown read `public.sectors`. A Sector added in
// Commercial Policies therefore never appeared anywhere else — the defect that
// started this work. There is now ONE Sector master and this slice is how the
// rest of the app reads it.
//
// ── IT NEVER FABRICATES A MASTER ──────────────────────────────────────────
// A denial, a failed read and an empty master are three different facts and
// are kept apart in `governedSectorState`. None of them is answered with the
// retired local defaults pretending to be governed: on a denial or an error
// there are simply no Sectors, and the screen says why. Substituting
// DEFAULT_SECTORS_DATA here would silently cost a quote against numbers no one
// approved — exactly the confusion this change exists to remove.
//
// ── ONE READ, NOT A POLL ──────────────────────────────────────────────────
// Masters change under governance, not per keystroke, so this reads once per
// sign-in and on an explicit refresh, which Commercial Policies calls after
// every governed write.
//
// ⚠️ UPSTREAM OF COSTING. `sectors` feeds useCostingResult's `_sectorForCalc`
// and resolveAuthority's sector tier (waste, conversion and margin). The row
// shape below is the shape those two already expect — `marginPct` included,
// which the local list never carried and resolveAuthority.js:41 already
// anticipated from `sector_versions.margin_pct`.
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "../lib/apiClient.js";
import { hasCapability } from "../lib/capabilities.js";

const IDLE = { status: "idle", rows: [], message: "" };
const LOADING = { status: "loading", rows: [], message: "" };

// The API returns the identity row plus its approved version. Costing reads a
// flat row, so the version's values are lifted onto it here.
//
// A null waste/conversion becomes "" because that is what resolveAuthority
// treats as "inherit the calculation default" (CDM-19). A stored 0 is NOT
// null and stays 0 — several Sectors legitimately convert P&P at zero.
function toEngineRow(sector) {
  const version = sector?.version || null;
  return {
    id: sector?.id ?? null,
    code: sector?.sector_code ?? "",
    name: sector?.name ?? "",
    status: sector?.status ?? "active",
    versionId: version?.id ?? null,
    versionNo: version?.version_no ?? null,
    wasteCBB: version?.waste_cbb_pct ?? "",
    wastePP: version?.waste_pp_pct ?? "",
    convBox: version?.conv_box_rate ?? "",
    convPP: version?.conv_pp_rate ?? "",
    marginPct: version?.margin_pct ?? "",
    specLang: version?.spec_lang ?? "",
  };
}

export function useGovernedSectors(st) {
  const { profile } = st;
  const [fetched, setFetched] = useState(LOADING);
  const [reloadToken, setReloadToken] = useState(0);

  // Mirrors the route's own gate, which mirrors the RLS predicate on
  // `sectors`: read_party_master OR read_construction_library.
  const enabled = hasCapability(profile, "read_party_master")
    || hasCapability(profile, "read_construction_library");

  // Derived, not stored: without the capability there is nothing to report and
  // nothing to clear.
  const state = enabled ? fetched : IDLE;

  useEffect(() => {
    if (!enabled) return undefined;
    let live = true;
    (async () => {
      try {
        const response = await apiFetch("/masters/sectors");
        if (!live) return;
        const data = await response.json().catch(() => ({}));
        if (response.status === 403) {
          setFetched({ status: "denied", rows: [],
            message: "read_party_master or read_construction_library is required to load the Sector master." });
          return;
        }
        if (!response.ok) {
          setFetched({ status: "error", rows: [],
            message: "The Sector master could not be read. No local list was substituted." });
          return;
        }
        setFetched({ status: "ready", rows: data.sectors || [], message: "" });
      } catch {
        if (live) setFetched({ status: "error", rows: [],
          message: "The Sector master could not be reached. No local list was substituted." });
      }
    })();
    return () => { live = false; };
  }, [enabled, reloadToken]);

  const refreshSectors = useCallback(() => setReloadToken(t => t + 1), []);

  // Every Sector, including inactive ones, so Commercial Policies can show and
  // reactivate them.
  const governedSectors = useMemo(
    () => (state.rows || []).map(toEngineRow), [state.rows]);

  // What Costing and the pickers resolve against. An INACTIVE Sector is
  // excluded: it may not be chosen for new work. Rows already costed against
  // one keep their stored values — nothing here rewrites a Batch.
  const sectors = useMemo(
    () => governedSectors.filter(row => row.status === "active"), [governedSectors]);

  const sectorCodes = useMemo(() => sectors.map(row => row.code), [sectors]);

  return { governedSectorState: state, governedSectors, refreshSectors, sectorCodes, sectors };
}
