# Open decisions backlog

Updated: 2026-09-25. This is the single concise register of genuinely unresolved decisions and
production follow-up from the completed S1–S5 increment. It does not reopen delivered behaviour.

| Item | Classification | Required action / owner |
|---|---|---|
| Protected authenticated Batch-to-Quote production smoke | Follow-up delivery evidence | Run with an authorised real account, record the protected path and result; no unauthenticated or broadened production check. Owner: delivery/release lead. |
| Batch-workspace Compare entry point | Product follow-up | Decide and implement the discoverable Batch entry point to existing comparison behaviour. Owner: Product Owner + frontend lead. |
| S5R-17 cross-customer test | Test follow-up | Run the coverage with a second active Party and retain the result. Owner: backend/test lead. |
| U4/CPH migration-path pin | Ownership decision | Name one owner and record the pin/reconciliation path before a change that needs it. Owner: Product Owner / technical lead. |
| Future beta reset | Deferred, destructive operation | Plan later under explicit approval: retain real beta accounts; remove only fixture/trial business data. No reset is authorised or included in this increment. Owner: Product Owner. |

All five items are non-blocking for the live S1–S5 state. Escalate only if a proposed change directly
requires one of these boundaries or would risk tenant isolation, quotation authority, audit history,
or irreversible data loss.
