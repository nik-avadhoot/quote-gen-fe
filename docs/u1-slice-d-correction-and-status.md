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
