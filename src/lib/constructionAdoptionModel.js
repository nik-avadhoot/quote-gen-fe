// Read-only projection helpers for Plant Construction Adoption (CDM-04/CDM-12).
//
// The database remains the authority: adoption rows are already filtered by
// plant_construction_adoptions_select. These helpers only turn that caller-
// scoped response into a matrix. In particular, a missing adoption row may be
// called "Not adopted" only for a plant where the resolved caller profile
// proves plant_access and only when the optional adoption read succeeded.

export const ADOPTION_STATUS = Object.freeze({
  adopted: "adopted",
  withdrawn: "withdrawn",
  notAdopted: "not_adopted",
  unavailable: "unavailable",
});

export function callerAccessiblePlantCodes(profile) {
  const byPlant = profile?.plant_capabilities;
  if (!byPlant || typeof byPlant !== "object") return [];
  return Object.entries(byPlant)
    .filter(([, capabilities]) => Array.isArray(capabilities) && capabilities.includes("plant_access"))
    .map(([plantCode]) => plantCode)
    .sort((a, b) => a.localeCompare(b));
}

export function callerAccessiblePlants(plants, profile) {
  const allowed = new Set(callerAccessiblePlantCodes(profile));
  return (plants || [])
    .filter(plant => plant?.id != null && allowed.has(plant.plant_code))
    .map(plant => ({ id: plant.id, code: plant.plant_code, name: plant.name, status: plant.status }))
    .sort((a, b) => a.code.localeCompare(b.code));
}

export function publishedApprovedConstructionVersions(constructions) {
  return (constructions || []).flatMap(construction => {
    if (construction?.status !== "published") return [];
    return (construction.versions || [])
      .filter(version => version?.approved === true)
      .map(version => ({ construction, version }));
  });
}

export function adoptionStatusForPlant(version, plantId, adoptionReadPartial = false) {
  if (adoptionReadPartial) return ADOPTION_STATUS.unavailable;
  const adoption = (version?.adoptions || []).find(row => row?.plant_id === plantId);
  if (!adoption) return ADOPTION_STATUS.notAdopted;
  return adoption.status === "withdrawn" ? ADOPTION_STATUS.withdrawn : ADOPTION_STATUS.adopted;
}

export function constructionVersionSummary(version) {
  const parts = [`${version?.ply ?? "?"}-ply`];
  if (version?.flute_f1) parts.push(`F1 ${version.flute_f1}`);
  if (version?.flute_f2) parts.push(`F2 ${version.flute_f2}`);
  if (version?.board_gsm != null) parts.push(`board ${version.board_gsm} gsm`);
  return parts.join(" · ");
}
