# Documentation index

This index is the entry point for project documentation. It separates current authority from
implementation evidence and historical records so an old plan cannot silently become a current
instruction.

## Authority order

When documents disagree, use this order:

1. [`../../AGENTS.md`](../../AGENTS.md) — governing development and review posture.
2. [`data-model-decisions.md`](data-model-decisions.md) and
   [`costing-start-review-decisions.md`](costing-start-review-decisions.md) — accepted product and
   architecture decisions. The data-model record wins over its earlier design drafts.
3. [`current-state.md`](current-state.md) and
   [`data-model-frontend-design-plan.md`](data-model-frontend-design-plan.md) — current handoff and
   delivery roadmap.
4. [`../CLAUDE.md`](../CLAUDE.md), [`../README.md`](../README.md), and
   [`../../quote-gen-be/AGENTS.md`](../../quote-gen-be/AGENTS.md) — repository-specific working
   instructions.
5. [`open-work.md`](open-work.md) — current open-work register.
6. Implementation packets and closure evidence — proof and context, not standing authority.
7. Historical plans and reviews — reference only.

Conversation summaries do not override a higher authority. A newer document does not win merely
because it is newer; it must state and possess the relevant authority.

## Current governing authority

- [`README.md`](README.md) — this authority map and complete documentation inventory.
- [`../../AGENTS.md`](../../AGENTS.md) — cautious optimism, proportionate verification, and the
  Development Speedbreaker standard.
- [`../CLAUDE.md`](../CLAUDE.md) — frontend technical guardrails.
- [`../../quote-gen-be/AGENTS.md`](../../quote-gen-be/AGENTS.md) — backend-specific guardrails.

## Current product or architecture authority

- [`data-model-decisions.md`](data-model-decisions.md) — canonical data-model decisions.
- [`costing-start-review-decisions.md`](costing-start-review-decisions.md) — accepted Costing
  START/REVIEW decisions, including explicitly deferred rules.
- [`data-model-frontend-design-plan.md`](data-model-frontend-design-plan.md) — U-series delivery
  structure; planning authority only where consistent with the canonical decisions.

The protected `commercial-intelligence-decisions.md` workstream is excluded from this hierarchy.
It remains untracked user-owned material and must not be read, changed, or treated as authority
without explicit Product Owner scope.

## Current implementation handoff

- [`session-start.md`](session-start.md) — short startup path.
- [`current-state.md`](current-state.md) — implemented-state and repository handoff.
- [`beta-readiness-plan.md`](beta-readiness-plan.md) — approved 2026-09-17: beta-entry versus
  beta-exit gate split, the four waves to a limited beta, and the beta rulings (BR-1 to BR-7).
- [`s9-technical-closure-and-u3-u6-handoff.md`](s9-technical-closure-and-u3-u6-handoff.md) — active
  S9 record. It truthfully records that S9 is not technically or Product Owner closed.
- [`u4-my-batches-catalogue-increment.md`](u4-my-batches-catalogue-increment.md) — current U4
  read-only increment record.
- [`u2-plant-construction-adoption-increment.md`](u2-plant-construction-adoption-increment.md) —
  read-only Plant Construction Adoption matrix and local verification.

## Current open work

- [`open-work.md`](open-work.md) — the single startup register.
- [`feature-requests.md`](feature-requests.md) — unprioritised request source; items must be promoted
  into `open-work.md` before implementation.
- [`post-model-defects.md`](post-model-defects.md) — legacy deferred-defect source; it is not a
  standing instruction to expand an unrelated increment.
- [`u1-party-merge-decision-packet.md`](u1-party-merge-decision-packet.md) — unresolved Party-merge
  product decision.
- [`u2-location-applicability-decision-packet.md`](u2-location-applicability-decision-packet.md) —
  accepted decision packet for governed SKU Master Location applicability (Amendment 05).

## Active S9 material — do not archive

These records remain easy to find until activation, end-to-end verification, and Product Owner
validation are complete:

- [`data-model-s7r-trusted-execution-reconciliation.md`](data-model-s7r-trusted-execution-reconciliation.md)
- [`data-model-s7r-attestation-contract-correction.md`](data-model-s7r-attestation-contract-correction.md)
- [`data-model-s7r-authorization-boundary.md`](data-model-s7r-authorization-boundary.md)
- [`data-model-s9p-persistence-authorization-packet.md`](data-model-s9p-persistence-authorization-packet.md)
- [`data-model-s9b-authorization-packet.md`](data-model-s9b-authorization-packet.md)
- [`s9-technical-closure-and-u3-u6-handoff.md`](s9-technical-closure-and-u3-u6-handoff.md)
- [`s9-qualification-seed-and-quote-read-fix-plan.md`](s9-qualification-seed-and-quote-read-fix-plan.md)
  — prepared, unapplied Quote read fix and qualification test-data seeding plan
- [`repository-worktree-inventory-2026-09-11.md`](repository-worktree-inventory-2026-09-11.md)

The applied S9 migrations, database tests, backend routes, and undeployed Edge Function artifacts
live in `quote-gen-be` and are active project material, not documentation residue.

## Supporting implementation and closure evidence

- [`data-model-s0a-evidence.md`](data-model-s0a-evidence.md)
- [`data-model-s1-implementation-packet.md`](data-model-s1-implementation-packet.md)
- [`data-model-s7-authorization-packet.md`](data-model-s7-authorization-packet.md)
- [`data-model-s7-closure-evidence.md`](data-model-s7-closure-evidence.md)
- [`data-model-s8-closure-evidence.md`](data-model-s8-closure-evidence.md)
- [`u0-frontend-discovery-and-gap-report.md`](u0-frontend-discovery-and-gap-report.md)
- [`u1-customer-family-mutations-packet.md`](u1-customer-family-mutations-packet.md)
- [`u1-customer-foundation-authorization-packet.md`](u1-customer-foundation-authorization-packet.md)
- [`u1-customers-prospects-locations-packet.md`](u1-customers-prospects-locations-packet.md)
- [`u1-slice-a-closure-evidence.md`](u1-slice-a-closure-evidence.md)
- [`u1-slice-c-closure-evidence.md`](u1-slice-c-closure-evidence.md)
- [`u1-slice-d-correction-and-status.md`](u1-slice-d-correction-and-status.md)
- [`u1-users-access-authorization-packet.md`](u1-users-access-authorization-packet.md)
- [`u1-external-references-and-plant-assignments-closure.md`](u1-external-references-and-plant-assignments-closure.md)
- [`repository-worktree-inventory-2026-09-11.md`](repository-worktree-inventory-2026-09-11.md)

These documents may contain status tables that were true at a particular checkpoint. Use
`current-state.md` for the present handoff and the individual record for its exact scope.

## Historical or superseded records

- [`component-split-plan.md`](component-split-plan.md) — completed component-split history; retained
  in place because the section-loss audit and source comments refer to this path.
- [`post-split-state.md`](post-split-state.md) — historical post-split snapshot.
- [`data-model-implementation-brief.md`](data-model-implementation-brief.md) — early programme brief,
  superseded for current status by implemented state and later records.
- [`data-model-canonical-amendment-01.md`](data-model-canonical-amendment-01.md) — amendment trail;
  canonical wording now lives in `data-model-decisions.md`.
- [`data-model-canonical-amendment-02.md`](data-model-canonical-amendment-02.md) — SKU Master field
  scope (CDM-43), SKU Sets (CDM-44), lifecycle and printing vocabulary.
- [`data-model-canonical-amendment-03.md`](data-model-canonical-amendment-03.md) — the SKU pricing
  portfolio (CDM-45), including why it is NOT NULL rather than a publication gate.
- [`data-model-canonical-amendment-04.md`](data-model-canonical-amendment-04.md) — SKU Master editing by due authority (CDM-46): rulings D-01 to D-12, slice 1, and the open settled-customer questions.
- [`data-model-canonical-amendment-05.md`](data-model-canonical-amendment-05.md) — master-only SKU Location applicability lifecycle and quote-exception boundary (CDM-47).
- [`archive/data-model-design/data-model-design-for-approval.md`](archive/data-model-design/data-model-design-for-approval.md)
- [`archive/data-model-design/data-model-sr-dev-proposal.md`](archive/data-model-design/data-model-sr-dev-proposal.md)
- [`archive/data-model-design/data-model-sr-dev-review.md`](archive/data-model-design/data-model-sr-dev-review.md)
- [`archive/defect-pass/defect-pass-plan.md`](archive/defect-pass/defect-pass-plan.md)
- [`archive/defect-pass/defect-pass-close.md`](archive/defect-pass/defect-pass-close.md)
- [`archive/README.md`](archive/README.md) — archive purpose and navigation.

Compatibility redirects keep old links and historical source comments resolvable:

- [`data-model-design-for-approval.md`](data-model-design-for-approval.md)
- [`data-model-sr-dev-proposal.md`](data-model-sr-dev-proposal.md)
- [`data-model-sr-dev-review.md`](data-model-sr-dev-review.md)
- [`defect-pass-plan.md`](defect-pass-plan.md)
- [`defect-pass-close.md`](defect-pass-close.md)

Archive-local compatibility pointers, classified as historical redirects, are linked from
[`archive/README.md`](archive/README.md). They preserve the moved records' original relative links
without changing the archived bytes.

## Source business document

- [`../../quote-gen-be/docs/CFB_QOS_Project_Brief_v3.md`](../../quote-gen-be/docs/CFB_QOS_Project_Brief_v3.md)
  — August 2026 business source and formula background. Its architecture snapshot is historical;
  use current source and the current handoff for implementation state.

## Repository entry points

- [`../README.md`](../README.md) — frontend setup and architecture.
- [`../../quote-gen-be/README.md`](../../quote-gen-be/README.md) — backend setup and architecture.

No retained document is classified as generated residue. Generated build outputs and caches are
not documentation authorities and should not be added to this index.
