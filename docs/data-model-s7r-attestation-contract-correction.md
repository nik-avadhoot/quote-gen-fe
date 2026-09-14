# S7-R — attestation contract correction

**Amends** `data-model-s7r-trusted-execution-reconciliation.md` §4, §5 and §6. **Date:** 2026-09-10.
**Prepared by:** SD.

**Status: proposal. Authorises nothing.** No code, schema, grant, policy, test, data, repository
change, stage, commit, push or deployment was made to produce it. D-AB remains provisionally approved
for the Edge Function architecture; **deployment is not authorised.**

**Scope.** The corrected contract and its gates only. The broader boundary is not repeated.

---

## 1. The three gaps, and what replaces them

### 1.1 `jsonb` cannot carry signed bytes — demonstrated, not argued

PostgreSQL parses `jsonb` at the parameter boundary, before the function body runs. What the function
receives is a *value*, not the octets the executor signed. Run live on this server (17.6):

```
input      {"b": 1, "a": 2, "n": 1.50, "e": 1e2}          length 37
::jsonb::text
           {"a": 2, "b": 1, "e": 100, "n": 1.50}          length 37
```

Keys reordered, `1e2` rewritten as `100`, and **the two lengths are identical** — so even a length
check would not have caught it. Separately, `'{"a":1}'::jsonb = '{ "a" : 1 }'::jsonb` is **true**: two
different byte strings are one `jsonb`. An HMAC over `p_results::text` would therefore fail to verify
a payload that was signed correctly, and the "exact `p_results` bytes" the reconciliation claimed to
bind do not survive to the function at all.

**Correction — text envelope, verify then parse.** The parameter becomes `p_results_text text`. The
MAC is verified over `convert_to(p_results_text, 'UTF8')`; only after it verifies is the text parsed,
and the parsed `jsonb` is what is stored.

The alternative — a byte-exact canonical JSON serializer shared by Deno and PostgreSQL — is not
taken. It would be a second serializer to specify, implement twice and prove equal forever, for no
gain over an envelope that is already exact.

> **Recorded consequence.** The signed text is **not retained**: `batch_calculations.results` holds
> the parsed `jsonb`, so the `results_sha256` binding cannot be re-verified after the write. The
> attestation is write-time admission control, not durable non-repudiation. If durable
> non-repudiation is later wanted, that is a new column and a separate decision — it is not smuggled
> in here.

### 1.2 The human actor was not bound

The reconciliation bound the row but not the person, which is what let CP-104 conclude that a replay
by Y "records `computed_by = Y`, truthfully". It does not. The result was computed inside **X's**
trusted invocation, against X's authority; recording it as Y's computation attributes to Y work Y
never caused, in a row that becomes immutable evidence at Send.

**Correction.** The actor's immutable Supabase Auth subject **and** the resolved `app_user_id` both
enter the signed tuple, and the database recomputes both from the caller's own JWT and
`app_private.current_app_user()` — never from the attestation. An attestation issued to X cannot
verify for Y under any circumstances, including after Y legitimately acquires the lock. Y must obtain
a new trusted calculation bound to Y.

### 1.3 Computation time was the executor's word, unbound

`computed_at` was left to the column's `now()` default, so the recorded time was when the row was
*written*, not when the number was *computed*, and nothing stopped an old attestation from being
presented as current work.

**Correction.** The executor issues `computed_at`; it is inside the MAC; it is written **verbatim**;
and the database enforces a short validity window, refuses timestamps materially in the future, and
refuses an attestation whose own lifetime exceeds the maximum. Replacement is strictly-newer, and a
same-attestation retry is a true no-op — §4.

---

## 2. The `qca/1` attestation byte contract

Versioned, domain-separated, length-framed, and unambiguous by construction.

### 2.1 Framing

```
frame(b)  := int8send( octet_length(b)::bigint ) || b        -- 8-byte big-endian length, then bytes
mac_input := frame(f1) || frame(f2) || … || frame(f14)
mac       := hmac( mac_input, key, 'sha256' )                -- pgcrypto 1.3, verified present
```

`int8send` emits network byte order, so the framing is a builtin rather than a hand-rolled encoding.
Because every field is length-prefixed, no field's content can forge a boundary and no two distinct
tuples can produce one `mac_input` — the failure mode a delimiter-joined string would have.

**Domain separation is the first field**, not a prefix on the outside: `qca/1` is framed like any
other field, so an input built under `qcf/1` or `qpf/1` can never collide with an attestation input
even if the remaining fields were identical.

### 2.2 The fourteen fields, in order

| # | Field | Encoding | Source at verification |
|---|---|---|---|
| 1 | attestation contract version | literal `qca/1`, UTF-8 | constant |
| 2 | `keyid` | UTF-8, `^[a-z0-9][a-z0-9_-]{0,62}$` | from the envelope, then looked up |
| 3 | actor Auth subject | canonical lowercase UUID, 8-4-4-4-12 | `auth.uid()` — **the caller's JWT** |
| 4 | actor `app_user_id` | decimal ASCII, no leading zeros | `app_private.current_app_user()` |
| 5 | `batch_id` | decimal ASCII | `batch_rows.batch_id` |
| 6 | `batch_row_id` | decimal ASCII | the parameter |
| 7 | row `content_version` | decimal ASCII | `batch_rows.content_version` |
| 8 | `pricing_basis_release_id` | decimal ASCII | `batches.pricing_basis_release_id` |
| 9 | governed `engine_version` | UTF-8, NFC | the Release's `calculation_default_versions.engine_version` |
| 10 | `calculation_fingerprint` | 64 lowercase hex | recomputed, `qcf/1` |
| 11 | `presentation_fingerprint` | 64 lowercase hex | recomputed, `qpf/1` |
| 12 | `results_sha256` | 64 lowercase hex | `sha256(convert_to(p_results_text,'UTF8'))` |
| 13 | `computed_at` | `YYYY-MM-DD"T"HH24:MI:SS.US"Z"`, UTC, microseconds | from the envelope |
| 14 | `expires_at` | same format | from the envelope |

**Only fields 2, 13 and 14 are read from the attestation.** Everything else is rebuilt from the
caller's identity and durable state, so the attestation is never a source of truth about anything the
database can determine for itself. That is also why there is exactly **one** verification failure —
`PT422 / attestation_invalid` — rather than per-field diagnostics: field-level errors would be a
forgery oracle.

Timestamp format is `to_char(v at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`, verified live to
render as `2026-09-10T14:11:33.929275Z`. Never `v::text`, which follows `DateStyle`.

### 2.3 The envelope

```
p_attestation := "qca/1" ~ keyid ~ computed_at ~ expires_at ~ mac_hex
```

Tilde-separated because `~` cannot appear in any of the five components, while `.` and `:` both occur
inside the timestamps. Version and `keyid` appear in the envelope *and* inside the MAC: the envelope
copies are what select the contract and the key before verification, and the inner copies are what
make downgrade and key substitution unforgeable.

---

## 3. Corrected RPC signature and order

```
public.calculate_batch_row(
    p_batch_row_id             bigint,
    p_expected_content_version integer,
    p_results_text             text,
    p_attestation              text
) returns bigint
```

`p_results jsonb` is gone. `p_effective_inputs` remains gone.

| # | Step | Refusal |
|---|---|---|
| 1 | `octet_length(convert_to(p_results_text,'UTF8')) <= 65536` | `PT422 / results_too_large` |
| 2 | `can_write_batch(batch)`; **and D-X** — the `submitted`/`check_quote` limb is refused | `42501`; `PT422 / calculate_requires_maker` |
| 3 | `p_expected_content_version` = `batch_rows.content_version` | `PT409` |
| 4 | Gather durable inputs; resolve every chain; refuse the meaningless states, including **D-W** retired basis Ship-to and **D-G** provenance `sku_status` | as already specified |
| 5 | Compute `qcf/1` and `qpf/1`; take `engine_version` from the Release | — |
| 6 | Parse the envelope; look up `keyid` with `status in ('active','retiring')` | `PT422 / attestation_invalid` |
| 7 | Rebuild the fourteen fields; compute the expected MAC; compare | `PT422 / attestation_invalid` |
| 8 | Enforce the time window — §4.1 | `attestation_future` · `attestation_expired` · `attestation_lifetime_exceeded` |
| 9 | `pg_input_is_valid(p_results_text,'jsonb')`, then parse | `PT422 / results_not_json` |
| 10 | Validate the closed payload contract — S9(b) Rev 2 §1.7/§1.8 shape, the closed key set, and the three internal identities | `PT422 / payload_contract` |
| 11 | Write — §4.2 | `PT409 / calculation_superseded` |

**Authenticate before parsing**, and the time window after the MAC: an unauthenticated timestamp must
not drive behaviour. `pg_input_is_valid(text,'jsonb')` was verified live on 17.6 — `true` for
`{"a":1}`, `false` for `{oops` — so invalid JSON becomes a controlled refusal rather than a raised
`22P02`.

---

## 4. Time, replacement and genuine idempotency

### 4.1 The window

With **L = 120 seconds** (maximum attestation lifetime) and **S = 5 seconds** (clock-skew allowance):

| Rule | Refusal |
|---|---|
| `computed_at <= now() + S` | `attestation_future` |
| `expires_at > now()` | `attestation_expired` |
| `expires_at > computed_at` and `expires_at - computed_at <= L` | `attestation_lifetime_exceeded` |

The three together imply `computed_at > now() - L - S`, so no separate floor is needed. The lifetime
ceiling is what stops a trusted executor — or anyone who ever obtains the key — from minting a
long-lived attestation.

### 4.2 Replacement is an explicit conditional, not a bare upsert

Given an existing row for this `batch_row_id`:

| Incoming versus stored | Action | Rationale |
|---|---|---|
| No existing row | insert | — |
| `computed_at` strictly newer | **replace** — all columns, including `computed_by` and `computed_at` verbatim | A newly executed calculation supersedes |
| Identical in `computed_by`, `computed_at`, both fingerprints and `results` | **no-op**, return the existing id | Genuine idempotency: nothing advances, nothing is rewritten, the row does not appear newly computed |
| Anything else — older, or same instant but different | `PT409 / calculation_superseded` | A lost update must be loud |

Written as a bare `on conflict … do update … where stored.computed_at < excluded.computed_at`, the
last two cases would both silently affect zero rows and return success. They are separated
deliberately.

`computed_at` is named explicitly in the insert so the column's `now()` default never applies.

> **Recorded residual.** `computed_at` is the *executor's* clock. Two Edge Function instances with
> skewed clocks could order two genuine calculations wrongly, and the later one would be refused
> `calculation_superseded` rather than silently dropped. That is fail-closed and visible, which is the
> right side to err on, but it is a real operational property and not an oversight.

---

## 5. D-AC — the keyring, as ruled

```sql
create table app_private.attestation_keys (
  keyid       text primary key check (keyid ~ '^[a-z0-9][a-z0-9_-]{0,62}$'),
  key         bytea not null check (octet_length(key) = 32),   -- 256-bit
  status      text  not null check (status in ('active','retiring')),
  created_at  timestamptz not null default now(),
  retiring_at timestamptz
);
create unique index uk_attestation_key_active
  on app_private.attestation_keys (status) where status = 'active';
revoke all on app_private.attestation_keys from public, anon, authenticated;
```

| Rule | |
|---|---|
| **The migration creates the table empty** | Key material never appears in a migration, repository file, fixture, log, error message or report. It is generated out of band as 256 random bits and provisioned into the Edge Function secret configuration and this table by the Product Owner |
| Signing | `active` only — and exactly one exists, by partial unique index |
| Verification | `active` or `retiring` |
| Overlap | A key may be `retiring` for at most **L**; verification refuses a `retiring` key whose `retiring_at` is older than L, and the row may then be deleted |
| Rotation owner | Nikunj / Product Owner, for this private-development project |
| Reachability | No grants to any role; readable only inside the `SECURITY DEFINER` verifier |

> **Recorded residual.** The MAC comparison in PL/pgSQL is an ordinary `bytea` equality and is not
> constant-time. Forging requires guessing a 256-bit value and each probe is a full network
> round-trip, so the practical exposure is negligible — but it is a property of this design and is
> stated rather than left for someone to discover.

---

## 6. Gates

Revised and new against the reconciliation §6. Every refusal gate additionally asserts the four
unchanged quantities: `count(batch_calculations)`, the row's `content_version`, the target row's
existing calculation (fingerprints, `computed_by`, `computed_at`), and `count(calculation_snapshots)`.

| Gate | Requirement |
|---|---|
| `CP-100` | **Direct-PostgREST bypass.** A lock-holding, fully authorised caller with no attestation, and again with a well-formed wrong MAC, is refused `attestation_invalid`; nothing written |
| `CP-101` *(revised)* | **Tampered result.** Alter one number in `p_results_text` — including a consistently scaled set satisfying all three internal identities — and resubmit the original attestation. Refused. Asserted for `final_rate`, `total`, `rate_per_kg` and one `row_details[].cost` |
| **`CP-109`** *(new)* | **JSON formatting and substitution.** (a) Re-serialise the signed text with different whitespace and key order so it parses to the **same** `jsonb`: refused, because the digest is over bytes. (b) A text parsing to a **different** `jsonb`: refused. (c) `{oops` and a bare `[]`: refused `results_not_json` / `payload_contract`, never an unmapped `22P02`. (d) The stored `results` equals `p_results_text::jsonb` — the parsed value, asserted explicitly so nobody later assumes the bytes were kept |
| `CP-102` | **Cross-row replay**, including where both rows have identical inputs |
| `CP-103` | **Stale-version replay** — once on `PT409`, once with a matching version token to prove the recomputed fingerprint refuses independently |
| **`CP-104`** *(revised)* | **Actor replay after lock transfer.** X computes and obtains an attestation. Y acquires the lock **legitimately** and replays X's attestation: **refused**, nothing written. Y then obtains a fresh attestation bound to Y and succeeds, with `computed_by = Y`. Asserted at both the Auth-subject and `app_user_id` fields by mutating each independently |
| **`CP-105`** *(revised)* | **Genuinely idempotent retry.** The same attestation submitted twice: the second call writes nothing new — `computed_at` unchanged to the microsecond, `computed_by` unchanged, both fingerprints unchanged, `results` unchanged, `id` unchanged, `uk_bc_row` still one row — and returns the same id |
| **`CP-110`** *(new)* | **Old-attestation timestamp replay.** A valid, unexpired attestation with an **older** `computed_at` than the stored calculation raises `calculation_superseded`; the newer calculation is untouched |
| **`CP-111`** *(new)* | **Future timestamps.** `computed_at` at `now() + S + 1s` refused `attestation_future`; `now() + S − 1s` accepted. The skew allowance is proved to be bounded, not unbounded |
| **`CP-112`** *(new)* | **Expiry boundaries.** `expires_at` one microsecond past `now()` accepted; one microsecond before refused `attestation_expired`. And `expires_at − computed_at = L` accepted, `L + 1s` refused `attestation_lifetime_exceeded` |
| **`CP-113`** *(new)* | **Attestation byte contract golden vector.** A fixed fourteen-field tuple and a fixed test key produce a hard-coded MAC hex. Plus **domain separation**: the same field values framed under `qcf/1` do not reproduce the `qca/1` MAC. Plus **framing**: two tuples that would collide under delimiter joining (a value containing the delimiter) produce different MACs |
| **`CP-114`** *(new)* | **Keyring hygiene.** `app_private.attestation_keys` grants `SELECT/INSERT/UPDATE/DELETE` to `public`, `anon` and `authenticated` are all false, at table **and column** level; exactly one `active` key; a `retiring` key verifies but never signs; a `retiring` key older than L is refused |
| **`CP-115`** *(new)* | **No key material in the migration set.** After a from-empty G-B replay, `app_private.attestation_keys` has **zero rows** — mechanical proof that no migration inserted a key |
| **`CP-116`** *(new)* | **`computed_at` verbatim.** The stored `computed_at` equals the attested value to the microsecond and is **not** the transaction time; asserted by attesting a time deliberately offset from `now()` within the window |
| `CP-106` | Superseded by `CP-112` |
| `CP-107` | The signature has no `p_effective_inputs`, and the stored `effective_inputs` equals a fresh gather from durable state |
| `CP-108` | Engine-bundle fidelity — the deployed modules hash-equal the repository source |

---

## 7. What is unchanged

`can_write_batch` still takes no actor parameter; no service-role credential is on the write path; no
entry is added to `caller_context.PRIVILEGED_OPERATIONS`; `authenticated` keeps EXECUTE on the shim so
`auth.uid()` stays authentic; and the five carried rulings (D-Y, D-X, D-W, D-F, D-G) are unaffected
except where §3 step 2 and step 4 name them.

---

**Nothing here is implemented or deployed.** D-AB stays provisionally approved for the architecture
only; deployment remains unauthorised, and S7-R begins on explicit authorisation of a corrected
boundary incorporating this contract.
