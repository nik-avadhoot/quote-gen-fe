# U1 Slice D — Batch Entry light integration: correction record and status

**Status: implemented, correction applied, tested at fixture level, visible behind its localhost
flag, NOT technically closed, NOT Product Owner validated. Slice E remains incomplete.**

Statuses use the vocabulary fixed by `data-model-frontend-design-plan.md` §2.1 item 7. They are not
interchangeable, and none of them is claimed here beyond what has actually been demonstrated.

---

## 1. What was built, and what was wrong with the first pass

Slice D adds a governed quick-create/select affordance beside Batch Entry's `client` field: create a
minimal Prospect, or select an existing Customer/Prospect where the caller may browse, then copy the
governed Party's `display_name` into the existing free-text `client` value after explicit
confirmation.

The first pass (`b8f8447`) also placed that affordance beside `delivery` and copied a Customer
Location's label into it. **That was wrong and is withdrawn.**

`delivery` is not free-text Customer Location data. It is a **freight-destination master key**:
`BatchProfileBar.jsx` resolves `freight[plant][delivery]` from it to price the Batch, and its
`<select>` is bound to the freight master (`cbb_locations`). A Customer Location's label is not a key
in that master, so the lookup returned **0**. The first pass disclosed that consequence in confirm
text and rendered the unmatched value as a synthetic `<option>` so the control would not misreport
what the Batch held.

Disclosure did not redeem it. A zero freight rate presented as a normal priced state is a misleading
and **commercially unsafe pricing state**, and one field cannot carry two incompatible commercial
meanings. The Product Owner refused technical closure on this basis, correctly.

## 2. The correction

| Removed | Retained |
|---|---|
| Every code path copying a Customer Location label into `profile.delivery` | Prospect/Customer quick-create and selection, copying the Party `display_name` into free-text `client` after explicit confirmation |
| The synthetic `<option>` that made an unmatched Location label look valid in the freight-destination control | Ordinary manual typing in `client`, unchanged |
| Existing-Location **selection** from Batch Entry | A clearly labelled **create-only** Customer Location convenience (below) |
| `deliveryLabelIsOffFreightMatrix()` and `deliveryFreightWarning()` — helpers that existed only to disclose the unsafe write | |

`delivery` is now **byte-for-byte identical to its pre-Slice-D form** — same options, same
`onChange`, same freight resolution, no affordance beside it, no title override. Verified by direct
comparison against `1ec94a3`.

`BATCH_TEXT_FIELDS` is narrowed from `["client", "delivery"]` to `["client"]`, so
`applyLabelToProfile()` — the only write this slice makes — **mechanically refuses** `delivery`.
This is enforcement, not documentation: a future edit cannot re-open the unsafe path without
changing that line and failing its fixtures.

### The retained Customer Location convenience

It uses the governed Slice C proposal route (`POST /masters/parties/<id>/locations`,
`propose_customer_location`), states **before** the create and again **after** it that the Location
is recorded in the Customer Master and is **not linked to this Batch**, and leaves `client`,
`delivery`, freight selection and every other Batch field unchanged. There is no
selected-Location state afterwards, so no misleading selection can persist.

## 3. Why formal Location selection is deferred to U4 — the actual reason

**Not** because identifiers were refused, and **not** because Slice D was too small to finish.

There is no Batch field into which a chosen Customer Location can be represented. `delivery` is
already spoken for by freight authority, and borrowing it would put two incompatible commercial
meanings in one field — the defect above. Inventing a second field, an id, or a link object would be
exactly the U4 referential state this slice is forbidden to introduce, and which the authorisation
packet's own Slice D draft already removed once for that reason.

The correct home is **U4's Delivery Group UI**, which references real Bill-to and Ship-to Customer
Locations (`data-model-frontend-design-plan.md` §3.3, §6 U4). This deferral preserves correct freight
authority; it is a commercial-meaning decision, not a scope shortfall.

A related product question is now open and worth a decision at the U4 boundary: whether `delivery`
should remain a freight-destination key, become a customer site, or be split into two fields. It
cannot cleanly be both.

## 4. Evidence

Frontend, all re-run after the correction:

| Gate | Result |
|---|---|
| `test:batch-quick-create` | **60 / 60** (49 before the correction) |
| Eight standing gates | all pass |
| `audit-doc-sections.py` / `audit-setcode.py` | clean |
| `npm run build` | passes |
| `eslint .` | **66 existing errors, zero new errors, ceiling unchanged** — no Slice D file appears in the error list |

Backend — unchanged by this slice (no commits, clean tree), re-run because the retained
Location-create flow still calls it:

| Gate | Result |
|---|---|
| Hermetic suite, 11 files | **537 / 537** |
| HTTP probe matrix | **204 / 204**, teardown clean |
| pgTAP `tests.run_all()` | **859 / 859** |
| G-A | 141 local / 141 remote, fingerprint `839b2a7d…` identical; **no migration in this slice** |

Fixture assertions added specifically for the correction: writing `delivery` is refused and returns
the same profile object; a refused write leaves `delivery` and `freightOverride` exactly as they
were; a Location label cannot reach **any** Batch field; the create request body carries no Batch
field; the unlinked-create copy names the Location, says "Customer Master", says "NOT linked to this
Batch", names Delivery and freight as unchanged, and does not claim Delivery was set; and neither
removed freight helper survives in the module's exports.

## 5. Status, separated

| | Slice D |
|---|---|
| Implemented | Yes, with the correction applied |
| Tested | Yes, at **fixture level** |
| Technically closed | **No — correction pending authenticated validation** |
| Feature-enabled / currently visible | Yes, localhost only, behind `u1_batch_party_link` (default-off; `.env.production` untouched) |
| Product Owner validated | **No** |

**Slice E remains incomplete.** The authenticated walkthrough still to be performed:

- quick-create a Prospect and confirm **only** `client` changes;
- select an existing Party and confirm **only** `client` changes;
- create a Customer Location, confirm it appears in Customer Master while Batch `delivery` and
  freight remain unchanged;
- manually change the freight-destination selection and confirm its rate behaviour is unchanged;
- reload and prove no new Batch/localStorage shape exists.

## 6. Preserved work

`src/tabs/batch/BatchProfileBar.jsx`'s user-owned uncommitted hunk (the Commercials grid-width fix)
is excluded from every commit in this slice and left in the working tree byte-for-byte as found —
content fingerprint `ea4aa9d8…`, recorded before the first edit and re-verified after each commit.
`docs/commercial-intelligence-decisions.md` has not been read, modified, staged or committed.

---

# Addendum — two defects found in authenticated browser validation, 2026-09-08

The authenticated walkthrough found two defects. **Both were mine, both in Slice D code, and neither
could have been caught by any gate that was passing.** Recorded here rather than folded silently into
a green report.

## D-D1 — a `location_type` value the database refuses

`BatchQuickPickModal.jsx` carried its own hand-transcribed copy of the location-type option list and
offered **`factory`**. `ck_lv_type` on `customer_location_versions` permits only
`plant | office | warehouse | other` (or NULL) — read directly from `pg_constraint`, not assumed.
Postgres raised `23514 check_violation`, which `_RPC_ERROR_MAP` does not map, so the route answered
**500 INTERNAL_ERROR**. That is correct backend behaviour for an unmapped code. The bug was entirely
client-side.

The cause was duplication: `CustomerFamiliesScreen.jsx` had the list right (`plant`), and the copy
drifted the moment it was made. `LOCATION_TYPE_OPTS` now lives once in
`lib/customerLocationActions.js`, both screens import it, and
`customer-location-actions-fixtures.mjs` pins the four values to the constraint — including an
explicit assertion that `factory` is not offered.

## D-D2 — a silent failure, which is the worse of the two

The Location create called `runMutation(path, body)` **without `showToast`**. The 500 above therefore
produced **no toast, no inline error, nothing** — the form simply sat there. A user would have
concluded the button was dead.

This is precisely the failure mode `data-model-frontend-design-plan.md` §2.7 forbids: "silent RLS
no-ops must not be presented as success", and an unreported 500 is worse than that. Every governed
call in the file now passes `showToast` and reports its own outcome through the D2 vocabulary
(denied / stale / outcome-unknown / failed).

## Why the gates did not catch either

Worth stating plainly, because the gate numbers were green while both defects were live:

- the **hermetic route tests** (108/108) use a recording fake client — they prove which RPC the route
  calls with which parameters, never what the real database accepts;
- the **HTTP probe matrix** (204/204) proves *refusals* for unauthorised personas; it never exercises
  the authorised happy path with a novel field value;
- **pgTAP** (859/859) tests the database functions directly, with values that were already valid;
- the **frontend fixtures** tested the body builder, which faithfully forwarded whatever the UI gave
  it — the invalid value was in the component's option list, which had no test.

The gap was a UI constant with no test, reachable only by an authenticated human action against the
real database. That is exactly what the §2.1 item 8 real-browser requirement exists to catch, and it
did. The new fixture closes it for the future.

---

# Authenticated walkthrough — results

Performed in the Product Owner's own Chrome, signed in as `ClaudeCode`, against the live backend and
Supabase project, after the two fixes above.

| Step | Result |
|---|---|
| Quick-create a Prospect ("Slice D Acceptance Prospect"), confirm | **Only `client` changed** — `Nagpur Distillers` to `Slice D Acceptance Prospect`. `delivery` `Nagpur`, `freightOverride` `2`, matrix rate `2`, 15/15 keys, no new `cbb_*` key |
| Select an existing Party ("Nagpur Distillers Private Limited, G0080-001"), confirm | **Only `client` changed.** `delivery`, freight, key set, localStorage key count all unchanged |
| Nothing written before confirmation | Verified: after the Prospect was created and before Confirm, `cbb_batchprofile` was **byte-identical** to baseline |
| Create a Customer Location | Created as `customer_locations.id = 165`, party 314, `location_type = 'plant'`, ship-to, `status 'proposed'`, version 1 `'current'` — confirmed by direct SQL. Panel showed "Created in Customer Master ... not linked to this Batch". **`cbb_batchprofile` byte-identical across the create** |
| Cancel after creating | Batch profile **byte-identical**; the governed rows correctly remained |
| Manually change freight destination | `Nagpur` to `Pune`; `freightOverride` `2` to **`2.5`**, exactly `freight['Nagpur']['Pune']`. Freight resolution behaviour unchanged |
| Reload | 15 keys, **no unexpected keys**, no `partyId`/`locationId`/link/stale keys, every value a scalar, same 12 `cbb_*` keys, autosave profile snapshot equally clean |
| Delivery control | Renders exactly the 12 freight-master destinations, **no synthetic Location option** |

The Product Owner's Batch profile was restored byte-exactly to its pre-walkthrough state after the
run; verified field-by-field with a zero-difference comparison.

**Test rows left in the Customer Master** (deliberately, as Slice E evidence): party 314 "Slice D
Acceptance Prospect" and its Location 165. The Location can be retired through the existing Slice C
action; Party deactivation remains Product-Owner-blocked, so the Prospect cannot be removed through
any governed operation that exists today.
