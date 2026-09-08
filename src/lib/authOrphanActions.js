// ═══════════════════════════════════════════════════════════════════════════
// src/lib/authOrphanActions.js — U1 Users/Access (UA-6) pure helpers.
//
// WHAT AN ORPHAN IS, since the screen has to say it in words an administrator
// can act on. Creating a user spans two systems. The database half is atomic;
// the pair is not, and cannot be — there is no transaction across GoTrue and
// Postgres. The create route compensates by deleting the authentication account
// when the database half fails, but a compensating delete can itself fail, and
// what survives then is a sign-in account nothing points at.
//
// Such an account grants NOTHING. Every route resolves an application identity
// first and refuses anything that has none — that is the same resolution that
// answers "Account is not active". So this screen is a recovery tool, not an
// incident: it exists so an account that should have become a user can be
// finished, rather than argued about.
//
// SAFETY. The route already returns only safe fields, and this module narrows
// them further: `ref` is a truncated SHA-256 of the authentication uuid with no
// way back to it, and the raw uuid is deliberately NOT carried into the view
// model. No password, token or session value exists on this path at all —
// adoption attaches an identity to an account that already has its own
// credentials, and never sets or reads one.
//
// This is NOT invitation-provider integration. Nothing here sends mail, mints
// an account, or opens registration.
// ═══════════════════════════════════════════════════════════════════════════

export const ADOPTION_ROLES = Object.freeze(["maker", "checker", "admin"]);

export function orphanExplainer() {
  return "A sign-in account that exists in the authentication system but has no application "
    + "user. It usually means setting a user up failed part-way through. Nobody can use one: "
    + "every screen looks up an application user first and refuses anything that has none. "
    + "Adopting it finishes the job by giving it an identity and its starting access.";
}

// The view model the screen renders. Only these four fields, and the uuid is
// not among them — the panel has no use for it and it should not be on screen.
export function orphanView(orphan) {
  return {
    ref: orphan?.ref || "unknown",
    email: orphan?.email || "(no address)",
    createdAt: orphan?.created_at || "",
    lastSignInAt: orphan?.last_sign_in_at || "",
  };
}

export function orphanViews(orphans) {
  return (Array.isArray(orphans) ? orphans : []).map(orphanView);
}

// An account that has never been signed into is the ordinary case — a failed
// setup. One that HAS been signed into is worth saying out loud, because it
// means somebody reached the login screen and was refused.
export function orphanNote(view) {
  return view?.lastSignInAt
    ? "This account has been signed into before, so someone has tried to use it and was refused."
    : "Never signed in.";
}

export function formatOrphanDate(value) {
  if (!value) return "never";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "unknown" : d.toLocaleString();
}

// Mirrors the backend's _plant_requirement_error exactly. A Maker or Checker
// whose authority is plant-scoped and who holds no plant can sign in and do
// nothing, which reads as a broken account. An administrator may legitimately
// hold no plant: administer_users is group-scoped.
export function adoptionBlockedReason(role, plantCodes) {
  if (!ADOPTION_ROLES.includes(role)) return "Choose the starting access for this account.";
  if ((role === "maker" || role === "checker") && !(plantCodes || []).length) {
    return "A Maker or Checker needs at least one plant.";
  }
  return null;
}

export function adoptBody(email, displayName, role, plantCodes) {
  return {
    email: (email || "").trim().toLowerCase(),
    display_name: (displayName || "").trim(),
    role,
    plants: [...new Set(plantCodes || [])].sort(),
  };
}

export function confirmAdoption(view, displayName, role, plantCodes) {
  const plants = [...new Set(plantCodes || [])].sort();
  const where = plants.length ? ` at ${plants.join(", ")}` : " with no plant";
  return `Give the account ${view?.email} an application identity as "${displayName}", `
    + `starting as a ${role}${where}? They will be able to sign in with the password that `
    + `account already has. Permissions can be changed afterwards in the permission editor — `
    + `the starting access is only a starting point.`;
}

// After a successful adoption the Users list must refresh, because the adopted
// account is now one of its rows. Copy for the confirmation the screen shows.
export function adoptionSuccessMessage(view, displayName) {
  return `${view?.email} is now "${displayName}". They appear in the list below.`;
}
