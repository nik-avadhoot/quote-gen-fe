// ═══════════════════════════════════════════════════════════════════════════
// scripts/batch-row-import-fixtures.mjs — npm run test:batch-row-import
//
// No DOM/UI test harness in this repo (see batch-quick-create-fixtures.mjs),
// so the testable surface is the pure identity-resolution logic in
// lib/batchRowImport.js — the "Import local rows" action in
// BatchWorkspacePanel's Products section, which resolves free-text local
// grid rows (BatchGrid.jsx) into governed SKU/Construction identities before
// they can become durable Batch rows.
//
// The point of most of these checks is NEGATIVE, same as the SKU match
// threshold's own comment: a wrong auto-match silently attaches a row's
// pricing to the WRONG governed SKU, which is worse than leaving it
// unresolved for a human to pick. So most assertions prove what does NOT
// resolve, not just what does.
// ═══════════════════════════════════════════════════════════════════════════
import {
  IMPORTABLE_ARCHIVE_KEY, isImportableLocalRow, localRowProposalFields,
  localRowToDurableRowBody, localRowType, matchLocalRowToConstruction,
  matchLocalRowToSku, readImportableArchive, resolveLocalRowIdentity,
  SKU_MATCH_THRESHOLD,
} from "../src/lib/batchRowImport.js";

let fails = 0;
const ok = (name, cond, extra = "") => {
  if (!cond) { fails++; console.log(`FAIL  ${name}${extra ? "  " + extra : ""}`); }
  else console.log(`ok    ${name}`);
};
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ── isImportableLocalRow — the trailing blank BatchGrid row must not offer ──

ok("blank trailing grid row is not importable", !isImportableLocalRow({ matCode: "", L: "", W: "", H: "" }));
ok("a label with no dimensions is not importable",
  !isImportableLocalRow({ matCode: "ABC-123", L: "", W: "", H: "" }));
ok("dimensions with no label are not importable",
  !isImportableLocalRow({ matCode: "", product: "", L: 300, W: 200, H: 150 }));
ok("a labelled row with one real dimension is importable",
  isImportableLocalRow({ matCode: "ABC-123", L: 300, W: 0, H: 0 }));
ok("product name alone (no matCode) counts as a label",
  isImportableLocalRow({ matCode: "", product: "5-ply RSC", L: 300, W: 200, H: 150 }));

// ── readImportableArchive — the cbb_batch_previous reader ──────────────────

const storage = {};
const getItem = key => Object.prototype.hasOwnProperty.call(storage, key) ? storage[key] : null;

ok("no archive key => null, not a thrown error", readImportableArchive(getItem) === null);

storage[IMPORTABLE_ARCHIVE_KEY] = "not json";
ok("unparseable archive => null, never throws", readImportableArchive(getItem) === null);

storage[IMPORTABLE_ARCHIVE_KEY] = JSON.stringify({ rows: [], archivedAt: 123 });
ok("archive with zero rows => null, not an empty offer", readImportableArchive(getItem) === null);

storage[IMPORTABLE_ARCHIVE_KEY] = JSON.stringify({
  rows: [{ matCode: "", L: "", W: "", H: "" }, { matCode: "ABC", L: 300, W: 200, H: 150 }],
  archivedAt: 456,
});
{
  const archive = readImportableArchive(getItem);
  ok("archive filters out the non-importable blank row and keeps the real one",
    archive && archive.rows.length === 1 && archive.rows[0].matCode === "ABC",
    JSON.stringify(archive));
  ok("archive carries the archivedAt timestamp through as savedAt", archive.savedAt === 456);
}

// ── localRowType — BatchGrid itemType label -> governed row_type value ─────

ok("Box -> box", localRowType({ itemType: "Box" }) === "box");
ok("Plate -> plate", localRowType({ itemType: "Plate" }) === "plate");
ok("Part-L -> part_l", localRowType({ itemType: "Part-L" }) === "part_l");
ok("Part-W -> part_w", localRowType({ itemType: "Part-W" }) === "part_w");
ok("an unrecognised or missing itemType falls back to other, never silently to box",
  localRowType({ itemType: "PP" }) === "other" && localRowType({}) === "other");

// ── matchLocalRowToSku — fuzzy, but gated by SKU_MATCH_THRESHOLD ───────────

const SKUS = [
  { id: 1, plant_item_code: "APSPL-1001", versions: [{ id: 11, item_name: "ITC Classmate Box" }] },
  { id: 2, plant_item_code: "APSPL-1002", versions: [{ id: 21, item_name: "Nestle Maggi Carton" }] },
];

ok("exact plant_item_code match resolves to that SKU/Version",
  eq(matchLocalRowToSku({ matCode: "APSPL-1001" }, SKUS)?.sku.id, 1));
ok("a row with no matCode or product has nothing to match against",
  matchLocalRowToSku({ matCode: "", product: "" }, SKUS) === null);
ok("unrelated free text stays unmatched rather than guessing the nearest SKU",
  matchLocalRowToSku({ matCode: "Totally unrelated widget" }, SKUS) === null);
ok(`a match below SKU_MATCH_THRESHOLD (${SKU_MATCH_THRESHOLD}) is refused, not returned weakly`,
  matchLocalRowToSku({ matCode: "ITC" }, SKUS) === null
  || matchLocalRowToSku({ matCode: "ITC" }, SKUS).score >= SKU_MATCH_THRESHOLD);

// ── matchLocalRowToConstruction — EXACT match only, never fuzzy ────────────

const CONSTRUCTIONS = [
  { id: 101, construction_id: 1, version_no: 2, construction: { construction_code: "3PLY-RSC-700" } },
];

ok("exact (case-insensitive) construction code match resolves",
  matchLocalRowToConstruction({ constructionCode: "3ply-rsc-700" }, CONSTRUCTIONS)?.id === 101);
ok("a near-miss construction code does NOT resolve — cost formulas cannot take a fuzzy guess",
  matchLocalRowToConstruction({ constructionCode: "3PLY-RSC-750" }, CONSTRUCTIONS) === null);
ok("no typed construction code => no match",
  matchLocalRowToConstruction({ constructionCode: "" }, CONSTRUCTIONS) === null);

// ── resolveLocalRowIdentity — the three-way outcome a row can land in ──────

{
  const catalogue = { skus: SKUS, constructionOptions: CONSTRUCTIONS };
  const matched = resolveLocalRowIdentity({ matCode: "APSPL-1001" }, catalogue);
  ok("a matched SKU resolves as kind: matched, with governed identities attached",
    matched.kind === "matched" && matched.skuId === 1 && matched.skuVersionId === 11);

  const proposable = resolveLocalRowIdentity({ matCode: "New Item Co", constructionCode: "3PLY-RSC-700" }, catalogue);
  ok("no SKU match but a matched Construction resolves as kind: propose",
    proposable.kind === "propose" && proposable.constructionVersionId === 101);

  const unresolved = resolveLocalRowIdentity({ matCode: "New Item Co", constructionCode: "Unknown Code" }, catalogue);
  ok("neither a SKU nor a Construction match => kind: unresolved, never a forced guess",
    unresolved.kind === "unresolved");
}

// ── localRowProposalFields — the body proposeSku() needs ───────────────────

{
  const fields = localRowProposalFields(
    { matCode: "New Item Co", L: "300", W: "200", H: "150", boxType: "RSC", ups: "2", itemType: "Box" },
    101);
  ok("proposal carries the given Construction Version id",
    fields.construction_version_id === 101);
  ok("dimensions are coerced to numbers",
    fields.length_mm === 300 && fields.width_mm === 200 && fields.height_mm === 150);
  ok("ups is coerced to a number", fields.ups === 2);
  ok("item_name falls back to product when matCode is blank, and never to a blank string",
    localRowProposalFields({ product: "Untyped item", L: 1, W: 1, H: 1, itemType: "Box" }, 101).item_name
      === "Untyped item");
  ok("box_type defaults from row_type when the row never set one (Box -> RSC)",
    localRowProposalFields({ matCode: "X", L: 1, W: 1, H: 1, itemType: "Box" }, 101).box_type === "RSC");
  ok("box_type defaults to PP for a non-Box row_type",
    localRowProposalFields({ matCode: "X", L: 1, W: 1, H: 1, itemType: "Part-L" }, 101).box_type === "PP");
}

// ── localRowToDurableRowBody — the POST /batches/:id/rows body ─────────────

{
  const body = localRowToDurableRowBody(
    { matCode: "APSPL-1001", itemType: "Box", marginOverride: "12.5", wasteConv_waste: "", wasteConv_conv: 0,
      printing: "3.5", stitching: null, coating: "", handling: undefined, moqCharge: 0,
      packing: "", other: "", unloading: "", fluting_bcf: "1.4" },
    { skuId: 1, skuVersionId: 11, pricingGroupId: 501 });
  ok("identity fields pass through exactly as resolved",
    body.sku_id === 1 && body.sku_version_id === 11 && body.pricing_group_id === 501);
  ok("row_type is derived from itemType", body.row_type === "box");
  ok("material_code is trimmed matCode", body.material_code === "APSPL-1001");
  ok("a blank override is written as null (inherit), never coerced to 0",
    body.waste_override_pct === null);
  ok("an explicit 0 override is written as 0, not treated as blank",
    body.conv_override_rate === 0 && body.addon_moq_charge === 0);
  ok("a populated override/addon is coerced to a number",
    body.margin_override_pct === 12.5 && body.addon_printing === 3.5);
  ok("null/undefined addon inputs are written as null, not NaN or 0",
    body.addon_stitching === null && body.addon_handling === null);
  ok("fluting_bcf is coerced through the same numeric-or-null rule",
    body.fluting_bcf === 1.4);
  ok("a row create body never invents a freight_override the local grid did not carry",
    !("freight_override" in body) || body.freight_override == null);
}

console.log(fails ? `\n${fails} FAILED` : "\nAll batch-row-import fixtures passed.");
process.exit(fails ? 1 : 0);
