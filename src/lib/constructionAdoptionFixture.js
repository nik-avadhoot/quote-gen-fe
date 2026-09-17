// Developer-preview data only. It never enters an authenticated screen and it
// is never sent to an API. The cases make the read boundary visible: adopted,
// withdrawn and genuinely not adopted are all distinct.

export const CONSTRUCTION_ADOPTION_FIXTURE = Object.freeze({
  profile: {
    group_capabilities: ["read_construction_library"],
    plant_capabilities: {
      NAG: ["plant_access", "make_quote"],
      PUN: ["plant_access"],
      KOL: ["make_quote"],
    },
  },
  plants: [
    { id: 11, plant_code: "NAG", name: "Nagpur", status: "active" },
    { id: 12, plant_code: "PUN", name: "Pune", status: "active" },
    { id: 13, plant_code: "KOL", name: "Kolkata", status: "active" },
  ],
  constructions: [
    {
      id: 101,
      construction_code: "CON-000125",
      name: "5-ply BC RSC",
      status: "published",
      versions: [{
        id: 1001, version_no: 2, ply: 5, flute_f1: "B", flute_f2: "C", board_gsm: 780,
        effective_from: "2026-09-01", approved: true,
        layers: [
          { layer: "TOP", code: "24", gsm: 180 }, { layer: "F1", code: "20", gsm: 150 },
          { layer: "L1", code: "20", gsm: 150 }, { layer: "F2", code: "20", gsm: 150 },
          { layer: "L2", code: "24", gsm: 180 },
        ],
        adoptions: [
          { plant_id: 11, status: "adopted" },
          { plant_id: 12, status: "withdrawn" },
        ],
      }],
    },
    {
      id: 102,
      construction_code: "CON-000126",
      name: "3-ply B flute",
      status: "published",
      versions: [{
        id: 1002, version_no: 1, ply: 3, flute_f1: "B", flute_f2: null, board_gsm: 420,
        effective_from: null, approved: true,
        layers: [
          { layer: "TOP", code: "22", gsm: 150 }, { layer: "F1", code: "18", gsm: 120 },
          { layer: "L1", code: "22", gsm: 150 }, { layer: "F2", code: null, gsm: null },
          { layer: "L2", code: null, gsm: null },
        ],
        adoptions: [{ plant_id: 12, status: "adopted" }],
      }],
    },
    {
      id: 103,
      construction_code: "CON-000127",
      name: "Draft technical trial",
      status: "proposed",
      versions: [{ id: 1003, version_no: 1, ply: 3, approved: false, layers: [], adoptions: [] }],
    },
  ],
});
