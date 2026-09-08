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

---

# Correction 2 — `client` is a governed selection, not free text (2026-09-08)

Product Owner ruling. Slice D is not closed on the previous record; this supersedes the parts of it
that described `client` as ordinary free text.

## The intended behaviour, and what changed

Free text is the **starting point** for creating a client that does not exist yet. Once created — and
for every client that already exists — the control is a **searchable Customer/Prospect Master
dropdown**, and users select governed records instead of retyping arbitrary strings.

`BatchProfileBar.jsx`'s plain input is replaced by `BatchClientField.jsx`. The old
`BatchQuickPickModal.jsx` was renamed `BatchLocationCreateModal.jsx`, because Party selection moved
into the field and the modal is now only the Customer Location convenience.

## What is stored — unchanged, and still not a relationship

One plain string in `batchProfile.client`, written only through `applyLabelToProfile()`. It is the
**temporary U1 representation** of a governed selection. **It is not a foreign key and must not be
described as one.** No `partyId`, no `party_id`, no link object, no new Batch or localStorage field.
U4 introduces the durable Batch identity relationship.

It stays the bare `display_name` rather than `name + code`, because that value is consumed as
customer-facing output and as an identifier prefix — `export/pdf.js:30` writes `To: <client>` on the
quote sent to the customer, `export/excel.js:275` writes it into the workbook, `excel.js:179` builds
the download filename from it, and `useQuoteActions.js:396` takes its first four characters as the
SKU code prefix. A code-bearing label would corrupt all four.

## The identity limitation, recorded explicitly for U4

- A display name **is not an identity**. Two Parties may legitimately share one. `identityFromText()`
  reports that as `ambiguous` and refuses to choose.
- A later **rename** of the governed Party does not reach a Batch string written earlier, and nothing
  in this slice pretends otherwise.
- Therefore, on reload the text is resolved for **usability only** — a badge saying what it probably
  refers to — and **never** treated as proof of identity. The four states are `one` (matches one
  record by name: "a likely match, not a stored link"), `ambiguous`, `possible`, `unmatched`.

U4 must resolve identity itself from whatever text exists; it cannot assume a U1 string uniquely
designates a Party.

A behaviour worth naming: `Acme Boxes Ltd` and `Acme Boxes Private Limited` normalise identically
once the legal suffix is folded, so two such records read as **ambiguous** rather than one being
picked. That is deliberate and pinned by fixture.

## Direct "create as Customer" — a named gap, not simulated

Verified against `pg_proc`, not assumed: the **only** governed Party-creating operation is
`create_minimal_prospect`, which produces a Party in the `prospect` lifecycle. Graduating it and
minting the permanent Customer Code is a separate operation, `graduate_customer_party`, requiring
`manage_customer_master`.

**No governed direct-Customer creation exists.** This control therefore offers Prospect creation
only. It deliberately does **not** simulate direct-Customer creation by creating a Prospect and
immediately graduating it — that would invent a compound operation the data model never approved, and
would mint a permanent Customer Code from a Batch Entry side panel.

> **Product Owner / backend decision required:** whether a governed direct-Customer creation
> operation should exist at all, or whether Prospect-then-graduate remains the only sanctioned route.
> Nothing is implemented pending that decision. `DIRECT_CUSTOMER_CREATE_AVAILABLE = false` records the
> current answer in code, and a fixture asserts it.

## Capability, shown as two different answers

- **browse** — `read_party_master` (group). `GET /masters/customer-families` checks it explicitly and
  answers **403**, never an empty list.
- **create** — `manage_customer_master` OR `make_quote`, the database's own OR condition.

A `make_quote`-only caller gets a plain text box, an explicit create action, and
`cannotBrowseNotice()`: *"You cannot search the Customer Master, so this text is not known to be a
governed record."* Never a dropdown that would 403, and never any suggestion that typed text is
already governed. Backend and RLS remain decisive.

## `delivery` — untouched, again

Byte-for-byte identical to its pre-Slice-D form, verified by direct comparison against `1ec94a3`.
Same options, same `onChange`, same freight resolution, no affordance beside it, no synthetic option.
It remains exclusively the freight-destination key.

## Evidence

| Gate | Result |
|---|---|
| `test:batch-quick-create` | **101 / 101** (was 60) |
| Eight standing gates | all pass |
| `npm run build` | passes |
| `eslint .` | **66 existing errors, zero new errors, ceiling unchanged** — 13 files, none of them Slice D's |
| Audits | clean |
| Backend | untouched; hermetic **537/537**, probes **204/204**, pgTAP **859/859**, G-A **141/141**, no migration |

### Authenticated browser walkthrough — Product Owner's Chrome, signed in as `ClaudeCode`

| Check | Result |
|---|---|
| Existing **Prospect** selection | Row read `Slice D Acceptance Prospect / Prospect / Family: ...`; **only `client` changed** |
| Existing **Customer** selection | Row read `Nagpur Distillers Private Limited / Customer / G0080-001 / Family: ...`; **only `client` changed**; stored string carries **no code** |
| Typing alone | `cbb_batchprofile` **unchanged while typing** — text is never silently accepted |
| Unmatched text | Offered `Create "..." as a new Prospect... - checks for duplicates first` |
| **Duplicate guard** | `Nagpur Distilers Pvt Ltd` (misspelt) surfaced *"Did you mean one of these? Selecting avoids a duplicate record"* with the real record, and the confirm said *"1 similar record already exists"* |
| **Cancellation** | Profile byte-identical, typed text discarded, and **no `Nagpur Distilers` row exists in the database** |
| Creation | `Vidarbha Packaging Works` created as party **315**, `lifecycle_state = 'prospect'`, no `customer_code` — the canonical path |
| Newly created record is selectable | Reopened panel listed it as `Vidarbha Packaging Works / Prospect / Family: Vidarbha Packaging Works` |
| Location convenience | Created under the new Prospect; `cbb_batchprofile` **byte-identical across the create** |
| Freight destination change | `Nagpur` to `Kolkata` moved `freightOverride` to **4** = `freight['Nagpur']['Kolkata']`; `client` untouched; **13 options, no synthetic entry** |
| Reload | 15 keys, no unexpected keys, **no identity fields**, all scalars, same 12 `cbb_*` keys; autosave profile snapshot equally clean |

The Product Owner's Batch profile was restored byte-exactly afterwards (zero-difference comparison).

**Test rows left in Customer Master:** parties 314 `Slice D Acceptance Prospect` and 315 `Vidarbha
Packaging Works`, plus Locations 165 and the one under 315. Locations can be retired via Slice C;
**Party deactivation remains Product-Owner-blocked**, so the Prospects cannot be removed by any
governed operation that exists today.

## Status

| | Slice D |
|---|---|
| Implemented | Yes, with Correction 2 applied |
| Tested | Yes — 101 fixture checks plus the authenticated walkthrough |
| Technically closed | **No — awaiting Product Owner review of this correction** |
| Feature-enabled / visible | Yes, localhost only, behind `u1_batch_party_link` |
| Product Owner validated | **No** |

Slice E remains open until this correction is reviewed.
