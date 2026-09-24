// Development-only browser evidence for the S1 active-Batch layout. The query
// flag is ignored by production builds. These objects never reach an API and
// the state hooks skip local persistence while the fixture is active.
export function isS1ActiveBrowserFixture() {
  if (!import.meta.env.DEV || typeof window === "undefined") return false;
  const query = new URLSearchParams(window.location.search);
  return query.get("activeBatch") === "1" && query.get("fixture")?.startsWith("s1-");
}

export const S1_ACTIVE_BATCH = {
  id: "s1-batch-1842",
  batch_reference: "NAG/BAT/2026-27/01842",
  content_version: 4,
  customer_family: { id: "s1-family", group_customer_code: "ACME", name: "Acme Foods" },
  plant: { id: "s1-plant", plant_code: "NAG", name: "Nagpur" },
  pricing_groups: [],
  caller_holds_lock: false,
};

export const S1_ACTIVE_PROFILE = {
  client: "Acme Foods", sector: "FMCG-FOOD", plant: "Nagpur", delivery: "Nagpur",
  paymentDisc: "30", freightOverride: "", margin: 8, interest: 0.5,
};

export const S1_ACTIVE_CONSTRUCTION = {
  code: "S1-5P",
  ply: 5,
  boxType: "RSC",
  flute_F1: "B",
  flute_F2: "A",
  board_gsm: 750,
  spec_bs: 12,
  spec_bct: "",
  spec_ect: "",
  layers: {
    TOP: { code: "22", gsm: 180 },
    F1: { code: "18", gsm: 120 },
    L1: { code: "20", gsm: 150 },
    F2: { code: "18", gsm: 120 },
    L2: { code: "22", gsm: 180 },
  },
};

export const S1_ACTIVE_ROWS = Array.from({ length: 6 }, (_, index) => ({
  id: `s1-row-${index + 1}`,
  matCode: `ACME-${String(index + 1).padStart(3, "0")}`,
  product: `Customer SKU ${index + 1}`,
  itemType: "Box", setCode: `ACME-${String(index + 1).padStart(3, "0")}`,
  setCodeAssumed: false, constructionCode: "S1-5P", setAutoFill: true,
  L: 400, W: 300, H: 250, ups: 1, printing_technology: "", number_of_colours: "",
  boxType: "RSC", spec_bs: "", spec_bct: "", nosPerSet: 1,
  salesMOQ: "", volume: "", marginOverride: "", remarks: "",
  reviewed: false, autoCode: false, status: "incomplete",
}));
