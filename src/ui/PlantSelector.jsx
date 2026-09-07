// ═══════════════════════════════════════════════════════════════════════════
// src/ui/PlantSelector.jsx — plant selector over the governed Plant Master.
//
// U1 shared foundation (post-S7 handover §9.2). Loads /masters/plants (the
// same route UserManagementTab.jsx already uses, unchanged), offers only
// ACTIVE plants — the same rule PlantPicker in UserManagementTab.jsx already
// enforces, so a caller is never offered a plant the backend would refuse.
// No local caching beyond the component's own lifetime: the Plant Master is
// small and rarely changes, and staleness here would be a governed-data bug,
// not a performance one.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useState } from "react";
import { apiFetch } from "../lib/apiClient.js";
import { C } from "../theme.js";
import { inputSt } from "./styles.js";
import { LoadingState } from "./appStates.jsx";

export default function PlantSelector({ value, onChange, includeAll = false }) {
  const [plants, setPlants] = useState(null); // null = loading
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const resp = await apiFetch("/masters/plants");
        const data = await resp.json();
        if (!cancelled) {
          if (resp.ok) setPlants((data.plants || []).filter(p => p.status === "active"));
          else setError(data.error || "Could not load Plant Master");
        }
      } catch {
        if (!cancelled) setError("Could not load Plant Master");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (error) return <span style={{ fontSize: 11, color: C.red }}>{error}</span>;
  if (plants === null) return <LoadingState label="Loading plants…" />;

  return (
    <select value={value ?? ""} onChange={e => onChange(e.target.value || null)} style={inputSt}>
      {includeAll && <option value="">All plants</option>}
      {plants.map(p => (
        <option key={p.plant_code} value={p.plant_code}>{p.plant_code} — {p.name}</option>
      ))}
    </select>
  );
}
