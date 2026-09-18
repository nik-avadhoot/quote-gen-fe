# Limited beta operating sheet

Date: 2026-09-17

State: **Prepared — not live**

Go-live authority: Product Owner

## Fence

| Item | Beta value |
|---|---|
| Producing Plant | `NAG` / Nagpur only — PO confirmed 2026-09-17 |
| Maker | `sales.01@avadhootpacks.in` — Auth invitation sent 2026-09-18; activation pending; no capabilities granted |
| Checker | `marketing@avadhootpacks.in` — Auth invitation sent 2026-09-18; activation pending; no capabilities granted |
| Admin | `nikunj@avadhootpacks.in` / NikunjRL — active login; no beta fence change yet |
| Alongside period | First week; every system result compared with the existing spreadsheet |
| Production build flag | `limited_beta` plus only the approved destination flags |
| Customer issue | Not permitted until the PO declares go-live |
| Job work | **OUT OF SCOPE** — keep every job-work enquiry on the spreadsheet |

Authorization is server-enforced. The beta build flag controls visibility and BETA export marking;
it is not an access-control substitute. Trial users receive only the capabilities required at the
confirmed beta plant. Wrong-plant and ungranted users must remain refused.

The fence remains closed until Wave C is complete. This is the readiness control for Calculate and
Send: no named beta capability is granted while attestation/Edge activation is pending.

**JOB-WORK ENQUIRIES ARE OUT OF SCOPE FOR LIMITED BETA.** `J` denotes client-owned Kraft paper and
the application has no governed job-work pricing or stock model. A Maker must not approximate job
work by selecting a non-`J` grade or by using a zero material rate; a governed immutable Quote must
never carry a fabricated paper price. Keep those enquiries on the spreadsheet.

## Approved commercial source exception

The first governed Nagpur Rate Set and Freight Set use the application's **current defaults**, not
workbook-derived masters. This exception was explicitly approved by the Product Owner on 2026-09-17.
During the alongside week, spreadsheet comparisons must label that source difference rather than
misdescribe the values as imported from `APSPL NAGPUR Master_20260720.xlsx`.

The initial Freight Set contains only exact existing governed Customer Location matches: **1 of 9
approved destination cities (Nagpur)**, represented by two ship-to-eligible location identities.
For Pune, Kolkata, Haldia, Howrah, Guwahati, Delhi, Ahmedabad and Hyderabad—or any other location
without an entry in the approved Freight Set—the Maker must set the Pricing Group to
`freight_mode = 'manual'` and enter an explicit ₹/kg value. Label the tracker entry **Maker-entered
freight**, not governed-master freight. A destination master remains a post-beta evidence-led decision.

## Daily operating check

Complete once per beta day and after any deployment:

- Record `/health` build revision and artifact SHA-256.
- Confirm the expected frontend build and `limited_beta` flag are active.
- Confirm `calculate-batch-row` is deployed with JWT verification and engine
  `engine/qe1-600adcbe1a85be59`.
- Confirm the active Pricing Basis Release and its Rate, Freight, Sector and Calculation Defaults
  version identities.
- Review failed Calculate/Send/workflow responses and Edge/Postgres logs; record only stable error
  codes, never tokens, attestations or secret values.
- For every issued beta Quote, compare final rate and inputs with the spreadsheet and record the
  explanation for every difference.
- Label freight in the tracker as either `governed-master` or `Maker-entered`; for manual mode,
  record the explicit ₹/kg value used.
- Inspect persistent calculation provenance, snapshot identities, workflow actor/time and the
  permanent Quote reference.
- Triage defects as Speedbreaker, Fix in this increment, Follow-up debt or Observation.

## Feedback channel and issue log

Feedback channel: **"NAG App Beta Tracker" Google Sheet** (Product Owner nomination, 2026-09-17).
Every defect, difference and observation is recorded there; informal messages are not acceptance
evidence. The table below mirrors the sheet's columns so an entry can be copied either way.

Daily checker: **NikunjRL** (Product Owner nomination, 2026-09-17) — owns the daily operating check
above and the alongside-week spreadsheet comparison for every issued beta Quote.

| Date/time | Quote/Batch reference | Reporter | Classification | Summary | Owner | State |
|---|---|---|---|---|---|---|
| — | — | — | — | No beta entries yet | — | Prepared |

## Kill switch

Use the narrowest lane that contains the problem.

1. Immediately revoke the affected beta user's plant capabilities at the beta plant. For a full
   beta stop, revoke `make_quote` from Makers and `check_quote` from Checkers; retain only the access
   needed to investigate read-only evidence.
2. Confirm the running backend refuses the revoked caller. This is the immediate, server-enforced
   stop and does not wait for a frontend deployment.
3. Redeploy the frontend without `limited_beta` and without the beta destination flags. Flags are
   build-time, so an existing build does not change until redeployed.
4. If trusted Calculate itself is implicated, remove the route from use by revoking Maker capability;
   do not expose, rotate or delete attestation material in a debugging transcript.
5. Preserve all Quote revisions, calculations and workflow events. Do not delete evidence to unwind
   a beta action.

## Backup and recovery record

The pre-go-live backup is a go-live gate and has not been taken yet.

| Field | Value |
|---|---|
| Backup timestamp | Pending |
| Backup method / platform record | Pending |
| Latest migration | Pending final Wave A/B application |
| Restore target/check | Pending |
| Recorded by | Pending |

At go-live, record the Supabase backup/PITR status and restore point before granting beta
capabilities. Do not claim recovery readiness from configuration alone.

## Edge secret handoff

The Product Owner confirmed on 2026-09-17 that exactly `QCA_KEY_ID` and `QCA_KEY_HEX` are provisioned
in Supabase Dashboard → Edge Functions → Secrets Management. `QCA_KEY_HEX` must be 64 lower-case hexadecimal characters (256
bits); `QCA_KEY_ID` must match the database keyring identifier. Never paste either value into this
document, a repository file, a command transcript or chat. Confirm only that both names are present.

## Known issues before entry

- Wave A is live and verified as migrations `20260917182121` and `20260917182138`.
- Wave B freight handling is approved: one of nine destination cities matches; every unmatched
  destination uses explicit Maker-entered manual freight. The governed Nagpur lane will bind only
  to the new approved and coded Ship-to for Nagpur Distillers; locations 122 and 165 stay untouched.
- The Product Owner ruled that Construction 2 uses a distinct governed grade `25`, not `25WTL` or
  `24GY`, and its evidence name will be `Beta 3-ply C 25/150-16/120-18/150`. Wave B remains unapplied
  until the new grade's price, discount, incoming freight and description are supplied.
- Job-work enquiries are excluded from limited beta and stay on the spreadsheet.
- Maker and Checker Auth invitations were sent on 2026-09-18; both must activate their logins before
  any capability grant.
- Edge secret names are confirmed provisioned; the function is not deployed because Wave B must
  complete first.
- Workflow HTTP/UI activation is committed; deployed-role and state-transition smoke proof remains a
  beta-entry check after Wave A–C are live.
- Supabase Auth leaked-password protection warning and five unindexed foreign keys are follow-up
  debt; neither was introduced by beta readiness work.

## Go-live checklist

- [x] Direct confirmation received for the two Wave A live migrations; applied ledger entries and
      authenticated/anon proof recorded.
- [ ] Single Wave B content approval recorded; idempotent seed applied and inspected.
- [ ] Named users and beta plant recorded; wrong-plant and ungranted checks pass.
- [x] `QCA_KEY_ID` and `QCA_KEY_HEX` confirmed present without reading their values.
- [ ] CP-108 passes; Edge Function deployed with JWT verification; deployed version recorded.
- [ ] Maker Calculate → Send → Checker Approve → Maker Issue smoke passes with persistent evidence.
- [ ] Backend-reported workflow activation drives enabled UI actions; unavailable actions remain
      disabled with a reason.
- [ ] Production build contains only approved beta flags; Excel and PDF exports visibly say BETA.
- [ ] Backup/restore point recorded above.
- [x] Feedback channel named; daily checker assigned.
- [ ] Product Owner explicitly declares the limited beta live.
