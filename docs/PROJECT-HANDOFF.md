# Quotation app documentation handoff

Updated: 2026-09-25. This is the authoritative entry point for future product and engineering work
across `quote-gen-fe` and `quote-gen-be`.

## Read this first

1. [`current-state.md`](current-state.md) — what exists and is live, including deployment commits.
2. [`OPEN-DECISIONS-BACKLOG.md`](OPEN-DECISIONS-BACKLOG.md) — the only active unresolved-decision
   list.
3. The decision register below — use the single source named for the boundary you are changing.
4. The repository instructions: [`../../AGENTS.md`](../../AGENTS.md),
   [`../CLAUDE.md`](../CLAUDE.md), and [`../../quote-gen-be/AGENTS.md`](../../quote-gen-be/AGENTS.md).

## Live position

S1–S5 are implemented and live: backend production deployment `6d1d84b`, frontend production
deployment `e627007`. S6 pilot/consolidation is pending. Do not use a historical roadmap, closure
packet, or exploratory proposal to reverse those facts.

## Canonical decision register

| Decision domain | Canonical source | Use it for |
|---|---|---|
| Live delivery status and deployment | [`current-state.md`](current-state.md) | What is implemented, live, pending, or follow-up |
| Data model, authorization, audit and immutable-history rules | [`data-model-decisions.md`](data-model-decisions.md) | Governing product/data architecture decisions |
| Costing START/REVIEW behaviour | [`costing-start-review-decisions.md`](costing-start-review-decisions.md) | Costing-entry and review decisions |
| Quote-journey product choices for S1–S5 | [`quotation-simplification-h0-s1-evidence-2026-09-22.md`](quotation-simplification-h0-s1-evidence-2026-09-22.md) | The accepted D-1–D-9 selections; the earlier alternatives are rationale only |
| Current unresolved decisions and assigned next actions | [`OPEN-DECISIONS-BACKLOG.md`](OPEN-DECISIONS-BACKLOG.md) | Work that needs an owner or a later decision |
| Backend reset boundary | [`../../quote-gen-be/docs/beta-main-reset-package-2026-09-24.md`](../../quote-gen-be/docs/beta-main-reset-package-2026-09-24.md) | Historical reset evidence and the current non-destructive reset constraint |

If sources conflict, the domain-specific source in this table wins; implementation and deployment
evidence then resolves its present status. A dated plan, generic review, or conversation summary is
not standing authority.

## Documentation inventory and classification

| Class | Documents | How to use them |
|---|---|---|
| Canonical | This handoff, `current-state.md`, `data-model-decisions.md`, `costing-start-review-decisions.md`, the accepted S1–S5 evidence, and the open-decision backlog | Start here; update these only when their governed facts change |
| Operational evidence | `beta-*`, `u1-*` through `u4-*`, `s9-*`, `data-model-s7*` through `data-model-s9*`, closure evidence, implementation packets, and regression records | Trace a specific implementation, test, or approval; they do not define current status alone |
| Historical / superseded | `data-model-canonical-amendment-*`, early `data-model-*` design/brief/proposal/review files, `component-split-plan.md`, `post-split-state.md`, `defect-pass-*`, and archive contents | Preserve for audit and rationale; do not place on a newcomer’s implementation path |
| Exploratory / request sources | `feature-requests.md`, `commercial-intelligence-decisions.md`, UX reviews, discovery reports, and pre-acceptance design packets | Context only until an item is explicitly accepted into a canonical source |

The existing `docs/README.md` remains a preserved user-owned working file. This handoff supersedes
it as the newcomer route for this cleanup increment without overwriting its uncommitted work.

## Practical handoff

- For a product change, identify its decision-domain source above, check `current-state.md`, then
  update the backlog only if a real unresolved decision remains.
- For an implementation change, verify the matching frontend and backend boundary; do not assume a
  frontend commit alone proves deployment or that a backend migration alone proves UI behaviour.
- For historical context, follow links from the relevant packet. Keep old evidence intact and label
  a new status in the canonical record rather than rewriting history.
