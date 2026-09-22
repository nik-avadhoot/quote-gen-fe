// ═══════════════════════════════════════════════════════════════════════════
// scripts/governed-construction-catalogue-fixtures.mjs
//   npm run test:governed-constructions
//
// The gate for the governed Construction catalogue the Batch Builder and
// Costing now pick from (Product Owner ruling 2026-09-22, beta issue log
// item 2). What a green run has to mean:
//
//   · adoption is a GATE, not decoration — an unadopted or withdrawn version
//     is not offered, and a Batch with no resolved plant is offered nothing;
//   · a governed version maps onto the costing shape field for field, with
//     blanks preserved, so isUsableConstruction() still refuses a hole;
//   · legacy A-Z entries still resolve, because retiring the naming must not
//     retro-invalidate rows a Maker already costed.
// ═══════════════════════════════════════════════════════════════════════════
import { constructionCatalogue, governedConstructionEntry, governedConstructionsForPlant,
  plantIdForProfilePlant } from "../src/lib/governedConstructionCatalogue.js";
import { isUsableConstruction } from "../src/lib/constructionIdentity.js";

let fails = 0;
const ok = (name, cond, extra = "") => {
  if (!cond) { fails++; console.log(`FAIL  ${name}${extra ? "  " + extra : ""}`); }
  else console.log(`ok    ${name}`);
};
const eq = (name, got, want) =>
  ok(name, got === want, `got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);

const version = (id, adoptions, extra = {}) => ({
  id, version_no: 1, approved: true, ply: 3, flute_f1: "C", flute_f2: null,
  board_gsm: "474.00", layer_top_code: "25", layer_top_gsm: "150.00",
  layer_f1_code: "16", layer_f1_gsm: "120.00", layer_l1_code: "18", layer_l1_gsm: "150.00",
  adoptions, ...extra,
});
const payload = {
  constructions: [
    { id: 1, construction_code: "CON-000056", name: "Beta 3-ply C", status: "published",
      versions: [version(11, [{ plant_id: 7, status: "adopted" }])] },
    { id: 2, construction_code: "CON-000057", name: "Withdrawn at NAG", status: "published",
      versions: [version(12, [{ plant_id: 7, status: "withdrawn" }])] },
    { id: 3, construction_code: "CON-000058", name: "Adopted elsewhere", status: "published",
      versions: [version(13, [{ plant_id: 9, status: "adopted" }])] },
    { id: 4, construction_code: null, name: "Proposed, unpublished", status: "proposed",
      versions: [{ ...version(14, [{ plant_id: 7, status: "adopted" }]), approved: false }] },
  ],
};

console.log("── adoption at the Batch's plant is the gate (CDM-12) ──");
{
  const offered = governedConstructionsForPlant(payload, 7);
  eq("only the version adopted at this plant is offered", offered.length, 1);
  eq("and it carries its permanent published code", offered[0].code, "CON-000056");
  ok("a withdrawn adoption is not an adoption",
     !offered.some(entry => entry.code === "CON-000057"));
  ok("another plant's adoption is not borrowed",
     !offered.some(entry => entry.code === "CON-000058"));
  ok("an unpublished proposal has no permanent code and is not offered",
     !offered.some(entry => entry.name === "Proposed, unpublished"));
  eq("a Batch with no resolved plant is offered NOTHING, not everything",
     governedConstructionsForPlant(payload, null).length, 0);
  eq("and a failed adoption read offers nothing rather than guessing",
     governedConstructionsForPlant(payload, 7, true).length, 0);
}

console.log("\n── the governed version maps onto the costing shape ──");
{
  const entry = governedConstructionEntry(payload.constructions[0], payload.constructions[0].versions[0]);
  eq("ply", entry.ply, 3);
  eq("flute F1", entry.flute_F1, "C");
  eq("the TOP layer grade", entry.layers.TOP.code, "25");
  eq("a numeric column becomes a number, not a string", entry.layers.TOP.gsm, 150);
  eq("board GSM likewise", entry.board_gsm, 474);
  ok("the mapped entry is usable by the costing engine", isUsableConstruction(entry));
  eq("it is marked governed", entry.governed, true);
  eq("and construction-level waste is NOT invented (CDM-13)", entry.waste, null);

  // A 3-ply version has no F2/L2. Blank must stay blank: 0 GSM is a different
  // claim, and isUsableConstruction must still be able to refuse a real hole.
  eq("an absent layer grade stays blank", entry.layers.F2.code, "");
  eq("an absent layer GSM stays blank, never 0", entry.layers.F2.gsm, "");
  const holed = governedConstructionEntry(payload.constructions[0],
    { ...payload.constructions[0].versions[0], layer_l1_gsm: null });
  ok("a version missing a structural GSM is refused, not costed", !isUsableConstruction(holed));
}

console.log("\n── legacy A-Z rows still resolve after the retirement ──");
{
  const local = [{ code: "A", name: "old kraft", ply: 3, layers: {} },
                 { code: "CON-000056", name: "stale local copy", ply: 3, layers: {} }];
  const merged = constructionCatalogue(governedConstructionsForPlant(payload, 7), local);
  eq("the legacy entry is still findable by its old code",
     merged.find(entry => entry.code === "A")?.name, "old kraft");
  eq("and is marked legacy", merged.find(entry => entry.code === "A")?.legacy, true);
  eq("a governed code wins the collision with a local copy of the same code",
     merged.filter(entry => entry.code === "CON-000056").length, 1);
  eq("and the winner is the governed one",
     merged.find(entry => entry.code === "CON-000056")?.governed, true);
}

console.log("\n── the Batch Profile's plant NAME resolves exactly, or not at all ──");
{
  const plants = [{ id: 7, plant_code: "NAG", name: "Nagpur" }, { id: 9, plant_code: "PUN", name: "Pune" }];
  eq("by name", plantIdForProfilePlant(plants, "Nagpur"), 7);
  eq("by code", plantIdForProfilePlant(plants, "NAG"), 7);
  eq("case and padding do not matter", plantIdForProfilePlant(plants, "  nagpur "), 7);
  eq("an unknown plant resolves to null, never to the first one",
     plantIdForProfilePlant(plants, "Nashik"), null);
  eq("and a blank plant likewise", plantIdForProfilePlant(plants, ""), null);
}

console.log(fails === 0 ? "\nall checks pass" : `\n${fails} FAILED`);
process.exit(fails === 0 ? 0 : 1);
