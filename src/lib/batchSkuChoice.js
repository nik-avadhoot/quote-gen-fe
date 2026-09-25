export function skuChoiceText(sku) {
  const version = sku.versions?.[0] || {};
  return [sku.plant_item_code, sku.customer?.display_name, sku.customer?.customer_code,
    version.item_name, version.item_short_name,
    ...(sku.external_references || []).map(reference => reference.reference_value)]
    .filter(Boolean).join(" ").toLocaleLowerCase();
}

export function batchSkuChoices(skus, query) {
  const words = (query || "").trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return (skus || []).filter(sku => words.every(word => skuChoiceText(sku).includes(word)))
    .sort((a, b) => String(b.last_used_at || "").localeCompare(String(a.last_used_at || ""))
      || String(a.plant_item_code || a.id).localeCompare(String(b.plant_item_code || b.id)));
}
