# Limited beta operating sheet

Date: 2026-09-17

State: **Prepared — not live**

Go-live authority: Product Owner

## Fence

| Item | Beta value |
|---|---|
| Producing Plant | Pending PO confirmation (`NAG` / Nagpur proposed) |
| Maker | Pending PO name/email |
| Checker | Pending PO name/email |
| Admin | Pending PO name/email |
| Alongside period | First week; every system result compared with the existing spreadsheet |
| Production build flag | `limited_beta` plus only the approved destination flags |
| Customer issue | Not permitted until the PO declares go-live |

Authorization is server-enforced. The beta build flag controls visibility and BETA export marking;
it is not an access-control substitute. Trial users receive only the capabilities required at the
confirmed beta plant. Wrong-plant and ungranted users must remain refused.

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
- Inspect persistent calculation provenance, snapshot identities, workflow actor/time and the
  permanent Quote reference.
- Triage defects as Speedbreaker, Fix in this increment, Follow-up debt or Observation.

## Feedback channel and issue log

Feedback channel: **Pending PO nomination.** Until nominated, record defects in the active Codex task
and do not use informal messages as acceptance evidence.

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

The Product Owner provisions exactly `QCA_KEY_ID` and `QCA_KEY_HEX` in Supabase Dashboard → Edge
Functions → Secrets Management. `QCA_KEY_HEX` must be 64 lower-case hexadecimal characters (256
bits); `QCA_KEY_ID` must match the database keyring identifier. Never paste either value into this
document, a repository file, a command transcript or chat. Confirm only that both names are present.

## Known issues before entry

- Family G authenticated-read correction is locally prepared but the live migration tool rejected
  the write pending direct user confirmation.
- Wave A suite-registration migration is committed locally but not live.
- Wave B seed awaits the single Product Owner content approval.
- Edge secrets are not yet confirmed and the function is not deployed.
- Workflow HTTP/UI activation is committed; deployed-role and state-transition smoke proof remains a
  beta-entry check after Wave A–C are live.
- Supabase Auth leaked-password protection warning and five unindexed foreign keys are follow-up
  debt; neither was introduced by beta readiness work.

## Go-live checklist

- [ ] Direct confirmation received for the two Wave A live migrations; applied ledger entries and
      authenticated/anon proof recorded.
- [ ] Single Wave B content approval recorded; idempotent seed applied and inspected.
- [ ] Named users and beta plant recorded; wrong-plant and ungranted checks pass.
- [ ] `QCA_KEY_ID` and `QCA_KEY_HEX` confirmed present without reading their values.
- [ ] CP-108 passes; Edge Function deployed with JWT verification; deployed version recorded.
- [ ] Maker Calculate → Send → Checker Approve → Maker Issue smoke passes with persistent evidence.
- [ ] Backend-reported workflow activation drives enabled UI actions; unavailable actions remain
      disabled with a reason.
- [ ] Production build contains only approved beta flags; Excel and PDF exports visibly say BETA.
- [ ] Backup/restore point recorded above.
- [ ] Feedback channel named; daily checker assigned.
- [ ] Product Owner explicitly declares the limited beta live.
