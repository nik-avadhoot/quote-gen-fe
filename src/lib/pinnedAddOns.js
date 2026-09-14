export const MAX_PINNED_ADD_ONS = 2;

export function canPinAddOn(pinned = [], key) {
  return pinned.includes(key) || pinned.length < MAX_PINNED_ADD_ONS;
}

export function togglePinnedAddOn(pinned = [], key) {
  if (pinned.includes(key)) return pinned.filter(item => item !== key);
  if (!canPinAddOn(pinned, key)) return pinned;
  return [...pinned, key];
}
