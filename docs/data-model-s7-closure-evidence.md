# S7 — closure evidence, and the handover for the work that remains

**Date:** 2026-09-06 / 2026-09-07. **Performed by:** SR DEV under the Product Owner decisions of
2026-09-06 (items 1–12). **Status: S7 implementation complete and evidenced, with ONE gate
deliberately left un-run — G-B. See §9, which is written as an executable handover.**

**Nothing is pushed.** Both repositories are on the local-only branch `data-model/s0-provenance`
with no upstream. `src/tabs/batch/BatchProfileBar.jsx` carries its preserved uncommitted change,
byte-for-byte. `docs/commercial-intelligence-decisions.md` was never read, staged or committed.

---

## 1. What was authorised, and what was done

| PO decision | Disposition |
|---|---|
| **1** Annual interest, 6.000 %, 360-day | **Implemented.** Canonical + schema + gates + resolver + engine + UI |
| **2** Retain the Pricing Group override, with reason and attribution | **Implemented** (S7-2) |
| **3** Retire the fixed map, in the compatibility-safe order | **Implemented** (S7-6, applied last — see §7) |
| **4** Supplier Credit Cost separated, 1.500 %, on the Rate Set version | **Implemented** (S7-3) + label separation |
| **5** Leave pre-S7 profile literals alone | **Honoured.** Nothing migrated or backfilled — see §6.3 |
| **6** Flute profiles — approve in principle, do not implement | **Canonical only** (CDM-42). No schema, no seed |
| **7** Printing Technology / colours — canonical, vocabulary deferred to U2 | **Canonical only** (CDM-10, CDM-40). No schema |
| **8** Customer Location eligibility unchanged | **No change made.** Recorded as "no amendment required" |
| **9** Legacy five-state Item Status — defer to U2/S11 | **Not started.** Recorded as a cutover-design item |
| **10** Preserve `BatchProfileBar.jsx` | **Preserved byte-for-byte** — see §8 |
| **11** Authorisation to implement | Executed |
| **12** Closure evidence | This document |

---

## 2. Commits — nine, all local

**`quote-gen-fe`**

| Commit | Contents |
|---|---|
| `8f27531` | Canonical Amendment 01 + the amended CDM-10/18/22/26/40 and new CDM-41/42 |
| `8edd1b3` | **S7(a)** the resolver, `interestBasis`, `calcDefaults`, and a 94-assertion gate |
| `07f505f` | **S7(b)** ⚠ the two engine corrections + the golden file |
| `472205b` | **S7(c)** materialisation removal, both surfaces resolving, label separation |

**`quote-gen-be`**

| Commit | Migrations | Contents |
|---|---|---|
| `2fc96b8` | 3 | S7-1 annual basis · S7-2 override attribution · S7-3 supplier credit cost |
| `15d3b77` | 4 | S7-4 the IA gates + two fixes · S7-5 the register regression and its guard |
| `c1bca25` | 1 | S7-6 the map retired, plus the probe-matrix update |

---

## 3. Gate results

| Gate | Before | After | Note |
|---|---:|---:|---|
| `tests.run_all()` | 755 | **783 / 783** | +35 IA, +2 SR, −11 MD, −2 DS, +4 IA-31..34 |
| HTTP probe matrix | 176 | **172 / 172** | −4: probes of the retired table |
| Backend acceptance | 171 | **171** | 25 / 66 / 28 / 29 / 23 |
| `npm run build` | ok | **ok** | |
| `test:costing` | 5 | **8** | +3 interest arms, existing four unchanged |
| `test:blanket` | pass | **pass** | |
| `test:draft` | pass | **pass** | |
| **`test:resolver`** | — | **94, new** | the eighth gate |
| `eslint src` | 66 / 0 | **66 / 0** | ceiling held |
| `audit-doc-sections` | clean | **clean** | |
| `audit-setcode` | clean | **clean** | |
| `ref:case4` | 2.10 / 82,200 | **2.10 / 82,200** | unchanged |
| **G-A** | 112 ⇄ 112 | **120 ⇄ 120**, 116 bodied | fingerprint `eb0c34548a3e9665e5c82c95175d25f9`, identical both sides |
| Security advisors | 2 | **2** | the accepted carry-forwards, unchanged |
| Performance advisors | 14 INFO | **15 INFO** | +1 unused index on an empty table; **no unindexed-FK finding** |
| **G-B** | passed at 112 | **NOT RUN** | §9 |

**Every migration file is byte-identical to the body the database recorded.** Verified individually
by MD5 at apply time and collectively by the G-A fingerprint.

---

## 4. The claim the amendment rests on, proved three ways

At 6.000 % per annum on a 360-day year the derivation reproduces the withdrawn map exactly.

| Days | Derived | Previously approved |
|---:|---:|---:|
| 30 | 0.500 % | 0.500 % |
| 45 | 0.750 % | 0.750 % |
| 60 | 1.000 % | 1.000 % |
| 90 | 1.500 % | 1.500 % |

- **Database** — IA-6..IA-9 compute from the *stored* `annual_interest_pct` and `day_count_basis`,
  not from literals, so a wrong stored value fails the gate.
- **Engine** — `test:resolver` asserts the same four against `CALC_DEFAULTS`.
- **360 is arithmetic, not preference** — IA-10 and the resolver fixture both assert that a 365-day
  year reproduces none of them. `deriveInterestPct` **throws** on any other basis; the database
  refuses it with `ck_cdv_day_count_basis_360_only`. Both layers agree.

---

## 5. The engine change (S7(b)) — the exact diff

**The golden file gained three entries and changed none.** Measured on the `box-5ply` spec:

| Interest input | old % | new % | old finalRate | new finalRate | |
|---|---:|---:|---:|---:|---|
| `0.5` — every existing fixture | 0.500 | 0.500 | 41.25 | 41.25 | unchanged |
| `0` — explicit zero | 0.000 | 0.000 | 41.05 | 41.05 | unchanged |
| `''` — blank | 0.000 | **0.500** | 41.05 | **41.25** | **E-2** |
| absent | 1.500 | **0.500** | 41.60 | **41.25** | **E-1** |

Only the last two move, and **neither was reachable**: `INIT_SPEC` carries `interest:0.5` and
`buildSpecFromRow` supplied `prof.interest ?? 0.5`, so every caller already passed a number. That is
why the four existing goldens are untouched — and why the defects survived. Three new arms make the
corrected behaviour a golden rather than an assertion about unreachable code.

---

## 6. Behaviour changes a user will see

### 6.1 The five materialisation sites, plus three more

| # | Site | Was | Is |
|---|---|---|---|
| 1 | `BatchProfileBar` Sector `<select>` | stamped 4 sector numbers into the profile | sets the Sector only |
| 2 | `BatchProfileBar` `numField` clear | **stored the sector default** | stores `null` |
| 3 | `BatchContextBar` `pickSector` | same stamping | sets the Sector only |
| 4 | `BatchProfileBar` Payment Terms | wrote Interest from a map, `\|\| 1.5` | writes the term only |
| 5 | `BatchContextBar` `pickPayment` | `PAY_INTEREST[code] \|\| 1.5` | writes the term only |
| **6** | `export/excel.js:50` | `(interest \|\| 1.5)` | null-aware, 0.5 — **and `\|\|` discarded an explicit zero** |
| **7** | `export/importExcel.js:45` | `interest:1.5` | blank, so the resolver answers |
| **8** | `export/excel.js` RATE MASTER mirror | applied `CREDIT_PCT` to every grade | resolves the per-grade exception |

Sites 6–8 were **not in the approved list of five.** They were found by sweeping for the pattern
rather than trusting the list. Site 6 is notable: line 50 and line 288 of the *same exporter*
disagreed about the fallback. Site 8 is D-27-class — an exported Rate Master disagreed with the
engine for any grade carrying a credit override.

### 6.2 Three deliberate behaviour changes, flagged not slipped in

1. **An override is now any stored value**, not only one differing from the inherited number.
   Existing Batches will show amber where they showed grey. That is decision 5 made *visible*, not a
   new state — and without it a Maker cannot tell that clearing a field changes the price.
2. **A PP row's margin no longer falls through `marginPP → margin`.** CDM-19 gives
   `row → Batch Box|PP → Sector → system` with no cross-over; `buildSpecFromRow` had an undocumented
   fourth tier. Unreachable before (the profile always carried a `marginPP`); clearing now stores
   `null`, so it became reachable and had to be settled.
3. **Payment Terms no longer clears Interest.** CDM-18 keeps an explicit override across a term
   change (fresh Send only).

### 6.3 How decisions 1 and 5 interact — benignly, and only because the rate is 6.000 %

Pre-S7 profiles carry a materialised `interest: 0.5`. Under decision 5 that stays and now reads as
an **override**. At 30 days the derivation is also 0.5 %, so the effective number is identical. Had
the rate been 12 %, every existing Batch would have silently kept 0.5 % while new ones derived
1.0 %. The UI now shows `0.5% · override` versus `0.5% · derived`, so the distinction is visible
rather than latent.

### 6.4 Two resolver tiers are wired and currently inert — on purpose

- `sector.marginPct` — the browser-local Sector master has no margin column, so it resolves blank
  and **moves no price today**. It goes live when U3 delivers Sectors from the database.
- `rateSetVersion.creditCostPct` — no Rate Set version object exists in the frontend yet.

The resolver fixtures assert **both** that each tier is inert now and that it activates the moment
data arrives, so neither is a silent time bomb.

---

## 7. The removal order, and why it is safe

A-03 made the order canonical. S7-6 is the **sixth** migration, not the first:

1. annual fields added additively (S7-1) → 2. gates state the derivation (S7-4) → 3. resolver is the
single authority (S7a) → 4. engine carries no unapproved fallback (S7b) → 5. no runtime path reads
any map (S7c, verified by sweep) → 6. **only then** the table is dropped (S7-6) → 7. G-A re-run.

**One local, non-deployed commit series guarantees this, and here is the argument.** Nothing is
pushed and nothing is deployed, so no build exists in the wild that could observe an intermediate
state. Within the series the invariant is: *at no commit does the map's absence coexist with a build
that reads it.* Commits 1–5 leave the table present while the app is migrated off it; commit 6
removes it only after the app no longer reads it. The migration history stays linear and replayable
— G-B replays it in order and the drop simply happens last.

Two facts make the removal lower-risk than the general rule assumes:

- **No deployed build ever read this table.** The frontend has no Supabase client and the backend
  exposes no route touching it; its only readers were ever the pgTAP suites.
- **The rollback window is benign for interest specifically.** Because the approved rate is 6.000 %,
  a build older than S7 substitutes 0.5 / 0.75 / 1.0 / 1.5 — exactly what the derivation produces.
  The S7 packet's standing warning still holds for **waste and conversion**: a build older than S7
  reads a stored `null` with `||` and substitutes its own literal.

---

## 8. Preserved file — exact status

`src/tabs/batch/BatchProfileBar.jsx` contains **both** the preserved Product Owner change and the
S7(c) edits. The file's diff was split into its seven hunks; the preserved hunk (the
`gridTemplateColumns` change from `1fr` to `52px`, with its comment) was **excluded from the index**
and the other six staged. The result:

- `git diff HEAD -- src/tabs/batch/BatchProfileBar.jsx` shows **exactly and only** the preserved
  hunk — 8 lines added, 2 removed, identical to how it stood at the start of this work.
- It was not committed, reverted or altered.

---

## 9. THE HANDOVER — what remains, and exactly how to do it

### 9.1 G-B — the one gate not run

**Why it was not run.** It is a destructive replay of the live project's application state, and the
Product Owner was logged into the running app during this session. Interrupting a live session with
a drop-and-replay is not something to do incidentally at the end of a long working pass. It is
**authorised** (decision 11.5) and it is the **last outstanding item** for S7 closure.

**Method — the same one used at S1, S4, S5 and S6** (`data-model-s0a-evidence.md`, "Part 7 — G-B,
replayed again with NO repairs"):

1. **Capture** the governed identities first — `app_users`, `group_capability_grants`,
   `plant_capability_grants`, `app_private.pending_invitations` — as ready-to-run `INSERT`s.
   `auth.users` is **never** touched, so FK targets survive and the restore cannot fail.
2. **In ONE transaction**: drop the application objects by name (public application tables, the
   `app_private` and `tests` schemas, the `ensure_rls` event trigger, the lineage sequence), then
   replay **all 120 migrations in version order**, then verify. One transaction is the safety
   property: any failure rolls the whole thing back to the current state.
   *Tip that avoids re-sending 120 files:* the bodies are already in
   `supabase_migrations.schema_migrations`, which is **not** in the drop set — a `DO` block can
   iterate it in version order and `execute` each body. The four bodyless repair rows must be staged
   from their local files and MD5-verified, as previous runs did.
3. **Expect `tests.run_all()` → 783 / 783 with zero application identities** (the suites mint their
   own owners — the S4-6 rule).
4. **Restore** the captured identities and grants; re-run → **783 / 783** again.
5. **Re-run G-A** — must still be 120 ⇄ 120, fingerprint `eb0c34548a3e9665e5c82c95175d25f9`.
6. Re-run the backend acceptance suites (171) and the probe matrix (172).

**Verify before starting:** `select count(*) from auth.users;` and record it — it must be unchanged
afterwards.

### 9.2 Deliberately pending — decisions 6, 7, 9 (canonical only, no code)

| Item | State | What the next session must do |
|---|---|---|
| **CDM-42 flute profiles** | Approved in principle. **No schema, no seed.** | Prepare **after S8**. Requires a plant-by-plant reconciliation table and a named operational owner per value *before* authorisation. The conflict is real: Nagpur C is **1.45** in the Operations Master and **1.47** in the quotation template and in `data/defaults.js`. The template's `DEFAULTS!M3:Q6` already varies by plant (Kolkata B 1.35 / E 1.30; Pune B 1.35) and its own note leaves a third plant's C flute at "1.48 — confirm exact value". **Do not seed `NA = 0` as a factor**: both the workbook and `tuFor` treat an absent flute as multiplier **1**, and a 0 would drive flute weight, material cost and BS to zero. Also carry the `tuFor` `\|\| 1` silent-fallback defect — live source data contains `'c'` and `'B '`. |
| **CDM-10/40 printing fields** | Canonical only. **No columns added.** | U2. Proposed: `sku_versions.printing_technology`, `number_of_colours integer >= 0`, `printing_detail text`. **The vocabulary does not exist in either source** — the only evidence is one sector note, `DEFAULTS!K18`: *"Print type drives conv: SG=8, FFG=8.5, Offset=12.5."* That is a PO decision, not a derivation. `propose_sku` and its public wrapper need three defaulted parameters. |
| **Item Status five states** | Not started | U2 / S11 cutover design. Source has Underdeveloped, Developed, Running, Slow Moving, Discontinued; `skus.status` does not. Distinguish source-data migration from the canonical workflow **before** requesting a lifecycle amendment. |

### 9.3 Decision 8 — closed, no work

Every Customer Location must declare a commercial purpose. `ck_loc_eligible` already enforces it.
"Details may remain incomplete" refers to the address/site record. **No amendment was made and none
is needed.**

### 9.4 Carried forward, unchanged by this slice

- **E-3 / freight** (`costing.js:29-32`) — an explicit-zero override is discarded and a matrix miss
  returns `0` where CDM-17 requires **block**. **This is S8** and was deliberately not touched.
- **`tuFor` silent `|| 1`** — belongs with the flute package, after S8.
- The two accepted advisor carry-forwards (leaked-password protection; `rls_enabled_no_policy` on
  `app_private.email_change_audit`).
- **UI verification remains Product Owner-led** (§9.4 of the brief). This session confirmed the app
  boots clean against the dev server — login screen renders, **zero console errors** — but did not
  authenticate.

### 9.5 A defect this slice created, found, and fixed — read this before editing `run_all`

S7-4 rewrote `tests.run_all()` by retyping the suite list from `s6_16`, which was **not** the newest
register — `s6_18` had since appended `content_version_boundary`. Four assertions vanished silently.
It was caught by **reconciling the count** (35 new assertions but the total moved by 31), not by any
gate. S7-5 restored it and added `tests.suite_registration()`, which now fails loudly if any suite
in the `tests` schema is missing from `run_all`.

**Two rules follow, and S7-6 already applies them:** splice, never retype, when editing a live
function; and predict the assertion delta *before* running the suite, then reconcile it.

---

## 10. Position

**S7 is implementation-complete and evidenced at 783 / 783, 172 / 172, 171, eight frontend gates and
G-A 120 ⇄ 120 with one fingerprint identical on both sides.** The golden file changed only by
addition. Advisors sit at the two accepted carry-forwards.

**S7 is not declared closed.** It is submitted for independent review with G-B outstanding (§9.1).

S8 and later are not begun. Flute governance, Product Master frontend screens and
machine/station/process-route work are not begun and are not authorised. Commercial Intelligence
remains entirely excluded. **Nothing is pushed.**
