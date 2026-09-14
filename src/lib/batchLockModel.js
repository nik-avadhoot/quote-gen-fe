// The database decides whether a lock is stale and whether the caller may
// reclaim it. This helper only decides whether the owner has a truthful UI
// action and preserves the holder identity they actually observed, so a
// changed lock cannot be reclaimed by a stale browser response.
export function ownerStaleLockReclaimRequest(batch) {
  if (!batch || batch.caller_holds_lock || !batch.edit_lock) return null;
  if (String(batch.caller_id) !== String(batch.owner_user_id)) return null;

  const expectedHolderId = Number(batch.edit_lock.holder_user_id);
  if (!Number.isSafeInteger(expectedHolderId) || expectedHolderId < 1) return null;
  return { expected_holder_id: expectedHolderId };
}
