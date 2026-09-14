# S7-R — trusted-execution reconciliation

**Amends** `data-model-s7r-authorization-boundary.md` Revision 1, §2.2, §2.4, §2.5, §7.2, §7.3 and
§8.1. **Date:** 2026-09-10. **Prepared by:** SD.

**Status: proposal. Authorises nothing.** No code, schema, grant, policy, test, data, repository
change, stage, commit, push or deployment was made to produce it. Revision 1 is **not** resubmitted
and must not be implemented; this document replaces its writer design.

**Scope.** Narrow. It does not restate the parts of Revision 1 that survive — §1 (the omission), §3
(durable sources), §4 (the `qcf/1` byte contract), §5 (D-S), §6 (temporary freight), §9 (gates other
than those listed in §6 below) and §10 (the S7-R / S9(b) seam) stand as written, except where a
carried ruling amends them in §7.

**Carried as settled, not reopened:** D-Y, D-X, D-W, D-F, D-G (§7), and the whole S9-P ruling set.

---

## 1. The premise Revision 1 got wrong

**A `public` function granted to `authenticated` is a PostgREST HTTP endpoint.** Supabase publishes
every such function at `POST /rest/v1/rpc/<name>`. Nothing about it requires a bespoke Python route,
a frontend client library, or any code this programme has written. The grant *is* the exposure.

Revision 1 §10.4 argued the opposite — that with "no HTTP route and no user interface", a governed
caller "cannot reach Calculate outside a test harness". That is false, and the reachability is not
theoretical here. The chain is complete today:

| Link | Evidence |
|---|---|
| The browser is handed a genuine Supabase Auth JWT | `quote-gen-be/server.py:580-581` — `/login` returns `"access_token": session.access_token` and `"refresh_token"` in the response body |
| It persists it | `quote-gen-fe/src/lib/apiClient.js:13,18,28` — `{access_token, refresh_token, expires_at}` written to a dedicated `localStorage` key |
| That token authenticates directly to PostgREST | It is the same bearer token `caller_context.get_supabase_for_caller()` attaches, and whose docstring records the design: *"PostgREST resolves it to the `authenticated` role and to auth.uid()/auth.jwt() … The backend adds no authorization of its own here: the database is the boundary"* |
| The second credential is public by design | The publishable key is a client-side key; it is not a secret and confers nothing beyond the `anon` role |

So the absence of a Python route prevents nothing. **Any person who can log in can call any RPC
granted to `authenticated`, with any arguments, from `curl`.** The frontend having no Supabase client
today (`quote-gen-fe/package.json` — `react`, `react-dom`, `xlsx`, `xlsx-js-style`, and nothing else)
narrows convenience, not authority, and it is the kind of fact that changes the first time a screen
needs one.

### 1.1 What that makes of Revision 1's writer

Revision 1 §2.4 accepted `p_results` — the twenty engine scalars and the five `row_details` — from
that caller, and defended it with three internal-consistency identities, calling the gap a "residual".

**It is not a residual. It is the whole control.** `results.engine.total`, `final_rate` and
`rate_per_kg` are the price. They land verbatim in `calculation_snapshots.total_cost`, `final_rate`
and `rate_per_kg` at Send, which is immutable. The three identities constrain internal arithmetic,
not magnitude: a caller who scales `mat`, `conv`, `total`, `final_rate`, `rate_per_kg`,
`row_details[].cost` and `add_ons` consistently satisfies every one of them and freezes any price
they like. And because the fingerprint is computed from durable state, a tampered payload is stamped
**fresh** and passes Send's staleness test cleanly.

Revision 1 therefore designed an authenticated, self-service price-setting endpoint and documented
the hole as acceptable. It is withdrawn.

### 1.2 The rule that replaces it

> **No authenticated browser caller may persist `p_results`, or any value derived from them, into
> `batch_calculations`.** Engine output is admissible only when it arrives from a trusted server
> boundary and is cryptographically bound to the exact row, version and inputs it was computed
> against.

---

## 2. The structural consequence, stated once

There is **no version of Calculate that is both safe and free of a trusted JavaScript executor.**

- `batch_calculations.results` is `NOT NULL`, and `calculation_snapshots.total_cost`, `final_rate`
  and `rate_per_kg` are `NOT NULL`. Engine output is required, not optional.
- Every *input* is now durable — that is exactly what S9-P delivered — so the database can produce
  `effective_inputs` unaided.
- The database cannot produce `results`, because the engine is JavaScript and this programme has
  ruled, repeatedly, that there must be one engine.

So something that is neither the database nor the browser must run `calcCosting`. The only open
question is what, and that is §3.

**One simplification falls straight out and should be taken regardless of which option is chosen:**
because every input is durable, the RPC must **not accept `p_effective_inputs` at all**. It builds
that object itself from durable state. Revision 1's V-1, V-2 and V-3 comparison logic disappears with
it — there is nothing to compare, because nothing was supplied. The attack surface shrinks to one
parameter.

---

## 3. Three ways to execute or attest the engine in a trusted boundary

Assessed against the stack as it actually is: React 19 / Vite 8 frontend with **no** Supabase client;
Flask 3.1.0 backend configured for Vercel `@vercel/python` (`quote-gen-be/vercel.json`); Supabase
Postgres 17.6 with `pgcrypto 1.3` installed and **zero Edge Functions deployed**; Node v24.18.1
present on the development machine, no Deno and no Bun; nothing pushed and nothing deployed anywhere.

`src/engine/costing.js` is pure ESM with zero React and three sibling imports
(`../data/defaults.js`, `./calcDefaults.js`, `./resolveAuthority.js`). Its own header states the
intent: *"Reusable from: Web App · Node.js API · ERP · Batch processor · AI agents."* It is
importable unmodified by any JavaScript runtime.

### 3.1 The options

- **Option 1 — Supabase Edge Function (Deno) as trusted executor**, calling the RPC with the user's
  own JWT and an HMAC attestation over the result.
- **Option 2 — Flask backend + Node subprocess as trusted executor**, same RPC contract and the same
  attestation.
- **Option 3 — Re-implement the engine in PL/pgSQL.** No executor, no attestation; the RPC computes
  instead of accepting.

### 3.2 Comparison

| | **1 — Edge Function (Deno)** | **2 — Flask + Node subprocess** | **3 — PL/pgSQL engine** |
|---|---|---|---|
| **Where the governed JS engine executes** | Supabase Edge runtime, in-project. Imports `costing.js` **unmodified** as ESM. Requires the four engine modules to be bundled into the function — a **copy**, which must be hash-gated against the source | Node v24 subprocess spawned by Flask, importing `costing.js` in place, **no copy**. But `@vercel/python` provides no Node, so this works on the development machine and **not on the configured deployment target** | Nowhere. The engine is rewritten in SQL |
| **Which credential writes `batch_calculations`** | Nobody's but the caller's. The RPC stays `SECURITY DEFINER` and runs as `postgres`; the *caller* is the ordinary `authenticated` user. **No service-role key is involved** | Identical | Identical |
| **How the real app user is authenticated and recorded** | The user's own JWT is forwarded to the RPC, so `auth.uid()` → `app_private.current_app_user()` is authentic. `computed_by` is that user. The executor **never asserts an actor** | Identical. Flask already verifies the token (`auth.require_auth`) and already holds caller-scoped clients (`caller_context.get_supabase_for_caller`) | Identical |
| **How Batch authority and lock ownership are checked** | `app_private.can_write_batch(batch)` **unchanged** — lock held and unreleased, owner or active collaborator, `make_quote` at the plant, status `working`/`sent`. No actor parameter, so no impersonation surface | Identical | Identical |
| **How row id, Batch id, content version, Release, engine version and fingerprints are bound** | The attestation is an HMAC over the canonical tuple `(batch_row_id, batch_id, content_version, pricing_basis_release_id, engine_version, calculation_fingerprint, presentation_fingerprint, results_digest, expires_at)`. The RPC **recomputes** every one of those from durable state and requires equality before verifying the MAC | Identical — the binding lives in the database, not in the executor | Not applicable. Nothing is supplied, so nothing needs binding |
| **How replay and payload substitution are prevented** | **Substitution:** `results_digest` is `sha256` of the exact `p_results` bytes; altering one number breaks the MAC. **Cross-row:** `batch_row_id` and `batch_id` are in the MAC. **Stale-version:** `content_version` is in the MAC *and* the RPC recomputes `calculation_fingerprint`, which moves whenever any durable input moves. **Same-state replay is idempotent** — it can only rewrite the identical row, so no nonce table is needed; `expires_at` bounds it anyway | Identical | Structurally impossible |
| **Second pricing implementation?** | **No.** One engine, one `test:costing` golden gate. The risk is a *copy* drifting, not a second implementation — mitigable by a gate asserting the deployed bundle's hash equals the source modules' | **No**, and not even a copy | **Yes.** Two implementations of every formula, rounding rule, take-up factor and deckle arm, required to agree to the last paisa forever, with the golden gate governing only one of them |
| **Operational and testing cost** | New runtime and a real deployment to the Supabase project; a bundling step; a secret in function config; a drift gate. Test path is clean — the function is HTTP-callable and the RPC is testable in pgTAP with a fixture-computed MAC | No new hosting *today* — but the deployment target must change before this can ever ship, and Flask spawning a subprocess per calculation is poor on serverless generally. Adding a table write to `caller_context.PRIVILEGED_OPERATIONS` is **not** required and must not be done: the allow-list holds five Auth-admin entries and states that ordinary database work goes through the caller context | Largest by a wide margin, and it never ends: every future engine change must be made twice and proved equal twice |

### 3.3 Verdicts

**Option 3 is rejected** on the criterion the Product Owner set. S7 was spent removing second answers
to single questions — the destructuring default at `costing.js:35`, the `||` at `:81`, the fixed
interest map, five materialisation sites. Introducing a second implementation of the *entire engine*
to fix an authorisation defect would trade a closable hole for a permanent divergence, and the
divergence would be invisible until two builds priced one Batch differently.

**Option 2 is sound in design and unsound in deployment.** Its trust model is identical to Option 1's
and it avoids the engine copy entirely, which is a genuine advantage. But `vercel.json` builds
`server.py` with `@vercel/python`, a runtime with no Node, so the executor would work on the
development machine and stop working at the first deployment. Building a trusted boundary that is
known to break on the intended target is building a dead end.

**Option 1 is recommended.** It is the only option where the governed engine runs in a runtime that
already belongs to this project's own infrastructure, unmodified, with no new hosting, no new
dependency in the Python runtime, no change to how the browser authenticates, no service-role key on
the write path, and no second implementation. Its one real cost — a bundled copy of four engine
modules — is a *measurable* risk with a *mechanical* control, which is the kind of risk this
programme accepts elsewhere.

---

## 4. The corrected Calculate contract

```
public.calculate_batch_row(
    p_batch_row_id             bigint,
    p_expected_content_version integer,
    p_results                  jsonb,
    p_attestation              text        -- keyid.expiry.hex-mac
) returns bigint
```

`p_effective_inputs` **is gone.** The RPC assembles `effective_inputs` from durable state — the same
gatherer the fingerprint uses — so the object it stores is by construction what the database holds,
not what a caller claimed.

**Order of operations, all before the single write:**

1. `can_write_batch(batch)` — else `42501`.
2. `p_expected_content_version` = `batch_rows.content_version` — else `PT409`.
3. Assemble `effective_inputs` from durable state; resolve every chain, including freight, by §6 of
   Revision 1. Refuse the meaningless states of Revision 1 §7.4 (`pricing_basis_absent`,
   `pricing_basis_invalid`, `freight_unresolved`, `dimensions_incomplete`,
   `construction_reference_invalid`), plus D-W and D-G per §7 below.
4. Compute `calculation_fingerprint` (`qcf/1`) and `presentation_fingerprint` (`qpf/1`) from durable
   state. Take `engine_version` from the Release's `calculation_default_versions`.
5. **Verify the attestation** against the tuple rebuilt from steps 3–4 — else
   `PT422 / attestation_invalid`. Expired — `PT422 / attestation_expired`.
6. Validate `p_results` against the shape rules of S9(b) Rev 2 §1.7/§1.8 and the three internal
   identities. These are retained, demoted to what they always were: **shape checks, not authority.**
7. `insert … on conflict (batch_row_id) do update`.

**The key.** One HMAC-SHA256 key, held in an `app_private` single-row table with no grants to any
role and read only inside the definer, and in the Edge Function's secret configuration. `pgcrypto
1.3` is installed, so `hmac(data bytea, key bytea, 'sha256')` is available with no new extension.
Rotation is a new key row plus a new `keyid`; the attestation carries the `keyid` it was signed with.

**The grant does not change and does not need to.** `authenticated` may still call the RPC — that is
what keeps `auth.uid()` authentic and `can_write_batch` unchanged. What a direct PostgREST caller
cannot do is *produce a valid attestation*, so the endpoint remains reachable and becomes useless to
forge against. This is deliberately not "revoke and trust a service role": a trusted role writing on
a user's behalf would require the database to accept an asserted actor, which is a permanent
impersonation surface and would leave `computed_by` unprovable.

---

## 5. The S7-R implementation boundary, restated for the recommended option

**In scope**

| Item | Note |
|---|---|
| `app_private.fingerprint_serialize` + `app_private.calculation_fingerprint` (`qcf/1`) | Revision 1 §4 unchanged, plus the D-F fields of §7 |
| `app_private.presentation_serialize` + `app_private.presentation_fingerprint` (`qpf/1`) | **D-Y.** Genuine serializer, same byte discipline, over §10.4's presentation list. No classifier, no divergence states, no UI |
| The database-side freight resolver | Revision 1 §6 unchanged |
| `app_private.calculate_batch_row` + `public` invoker shim | §4 above |
| `app_private.calculation_attestation_key` + verification | Single row, no grants, `keyid` for rotation |
| The Edge Function `calculate-batch-row` | Verifies JWT, reads durable inputs through a read-only definer RPC as the caller, runs `calcCosting` unmodified, signs, calls the RPC with the caller's JWT |
| The engine-bundle drift gate | The deployed function's engine modules hash-equal `quote-gen-fe/src/engine/*.js` and `src/data/defaults.js` |
| `FS-14′` and the gates of §6 | |

**Out of scope, unchanged from Revision 1 §10.2:** any Send operation, any Family G write, any
`batches.status` transition, the staleness comparison itself, U4 divergence classification and UI, any
frontend screen, retirement of either temporary freight tier, and any engine or golden-file change.

**Also out of scope, and stated because this correction could invite it:** no service-role credential
on the write path; no new entry in `caller_context.PRIVILEGED_OPERATIONS`; no re-expression of
`can_write_batch` to take an actor parameter.

---

## 6. Gates this correction adds

Beyond Revision 1 §9, which stands.

| Gate | Requirement |
|---|---|
| **`CP-100` direct-PostgREST bypass** | A valid `authenticated` caller who holds the lock and satisfies every authority check, calling the RPC **with no attestation**, and again with a syntactically well-formed but wrong MAC, is refused `PT422 / attestation_invalid`. **No `batch_calculations` row is written in either case.** This is the gate that would have failed Revision 1 |
| **`CP-101` tampered result** | Obtain a valid attestation for a row, then alter one number in `p_results` — including a *consistently scaled* set that satisfies all three internal identities — and resubmit. Refused; nothing written. Asserted for `final_rate`, `total`, `rate_per_kg` and one `row_details[].cost` |
| **`CP-102` cross-row replay** | A valid attestation issued for row A, replayed with row B's `p_batch_row_id` (and with B's expected version), is refused. Both A's and B's calculations are unchanged. Also asserted where A and B have **identical inputs**, so the defence is the bound row id and not an incidental fingerprint difference |
| **`CP-103` stale-version replay** | A valid attestation, then a durable input changes (an add-on, then `batches.pricing_date`, then the basis Delivery Group's Ship-to). Replay is refused — once on `PT409`, and once with a matching `p_expected_content_version` to prove the **recomputed fingerprint** refuses independently of the version token |
| **`CP-104` false actor** | User X legitimately calculates and obtains an attestation. User Y replays it with Y's own JWT: refused `42501` while Y lacks the lock. With the lock transferred to Y it succeeds — and `computed_by` is **Y**, not X, proving the executor cannot assert an actor and that the record names whoever actually wrote it |
| **`CP-105` idempotent same-state replay** | Replaying a valid attestation over an unchanged row rewrites the identical row: same fingerprints, same `results`, `uk_bc_row` still one row. Proves the no-nonce argument rather than assuming it |
| **`CP-106` attestation expiry** | An attestation past `expires_at` is refused `PT422 / attestation_expired` even when every other field still matches |
| **`CP-107` no supplied inputs** | The RPC signature has **no** `p_effective_inputs` parameter, and the stored `effective_inputs` equals the object rebuilt from durable state — asserted by comparing the stored jsonb against a fresh gather |
| **`CP-108` engine-bundle fidelity** | The engine modules deployed with the Edge Function hash-equal the repository source. A drifted copy fails before it can price anything |

Every refusal gate asserts the four unchanged quantities of Revision 1 §9.6.

---

## 7. How the five carried rulings land

| Ruling | Effect on this design |
|---|---|
| **D-Y** — build the genuine `qpf/1` serializer now; U4 classification and UI excluded | Added to §5. `presentation_fingerprint` is now a real value, so `ck_bc_fingerprints` is satisfied honestly and nothing meaningless is frozen at Send. It is covered by the attestation tuple, so a tampered presentation hash is refused with the rest |
| **D-X** — Checker Calculate is refused; recalculation returns to the Maker | `can_write_batch` **is not sufficient on its own**: its second limb admits a `check_quote` holder on a `submitted` Batch. Calculate must therefore add an explicit refusal for that limb — `PT422 / calculate_requires_maker` — and Revision 1 §2.3's third consequence is struck. The deferred caller-path equality gate (`CP-55`) is **withdrawn, not deferred**: with one eligible persona there are no two paths to compare |
| **D-W** — refuse calculation against a retired freight-basis Ship-to; historical snapshots remain valid | A new refusal in step 3: in `master` mode, if the basis Delivery Group's `ship_to_location_id` resolves to a retired `customer_locations` row, refuse `PT422 / basis_ship_to_retired`. It is a **Calculate** refusal, not only a Send one, so a retired destination cannot reach a calculation at all. Existing `calculation_snapshots` are untouched and remain readable and re-exportable — the ruling is forward-only |
| **D-F** — include `spec_bs`, `spec_bct`, `spec_ect` in entered inputs and `qcf/1` | Durable source confirmed live: `sku_versions.spec_bs`, `spec_bct`, `spec_ect`, each `numeric(10,2)` nullable. They enter `entered` and add three `qcf/1` lines — `skuv.spec_bs`, `skuv.spec_bct`, `skuv.spec_ect` — emitted always, `\N` when absent. An issued Quote can now evidence the compliance claim it made, which is what `calc_bs` and `checkSpecCompliance` compare against |
| **D-G** — permit a discontinued SKU only with the status frozen in provenance; no automatic substitution | `provenance` gains one key, `sku_status`, non-null, from `skus.status`. Calculate does **not** read `skus.replacement_sku_id` and does not substitute. R-3's `proposed` refusal is unaffected |

**Consequence to note, not to decide.** D-F and D-G change the `qcf/1` field set and the payload
contract. Both are being ruled **before** any implementation and before any Send has ever run, so the
contract version stays `qcf/1` / `contract_version 1` and nothing is re-staled. That is the whole
value of ruling them now rather than after.

---

## 8. What remains open

Nothing in this reconciliation is a decision I have taken for the Product Owner. Two items need a
ruling before S7-R can be authorised on the recommended option:

| # | Decision |
|---|---|
| **D-AB** | **Approve Option 1**, and with it a first deployment of a Supabase Edge Function to the development project — the first component of this programme to run outside the database and the local machine. If that deployment is not acceptable under the current private-development posture, Option 2 is the fallback and its dead-end deployment cost is accepted knowingly |
| **D-AC** | **Where the attestation key lives, and its rotation owner.** An `app_private` single-row table is proposed. Supabase Vault is the alternative. Either way a person must own rotation, and the key is the one secret whose compromise would restore exactly the hole this document closes |

---

**Nothing here is implemented, and Revision 1 remains unauthorised.** S7-R begins only on explicit
authorisation of a corrected boundary incorporating this reconciliation.
