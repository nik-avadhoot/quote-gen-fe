# UX Design Review — Policy & Action Items

**Status: triaged into `open-work.md` (UX Batches 1–8), which tracks implementation status.** The
§4.1 Pricing-card width guidance (~220–240px) is superseded: the card is sized like its sibling
cards. This document is the output of a
page-by-page UX review conducted outside the normal implementation flow. Per
[`README.md`](README.md)'s authority order, it carries no standing authority on its own — treat it
as a source to triage into `open-work.md` (or `feature-requests.md`) before any item here is
implemented. Nothing in this document overrides `data-model-decisions.md`,
`costing-start-review-decisions.md`, or any guarded business rule in `../CLAUDE.md`.

**Non-negotiable boundary**: every recommendation below is presentation-layer only. None of it
changes SET Code discipline, the Batch Entry CalcGate-as-sole-authority rule, capability-over-role
gating, the Sector→Batch→Row resolution hierarchy, blank/zero/unresolved distinctions, or any
confirm-before-mutate guard. Where a recommendation touches a screen that carries one of these
guards, the guard's behavior is preserved exactly — only its layout, density, or visual legibility
changes. If an implementer finds a recommendation here conflicts with a guarded rule, the guarded
rule wins and the recommendation is dropped or reworked, not forced through.

## 1. Benchmark

**Costing and Batch Builder are the UX/UI benchmark for every other screen in the app** — not
because they are finished (they have their own open items below), but because they are the most
internally consistent screens in the app today:

- A single override-vs-inherited visual convention (amber border + light-amber fill = "a value is
  stored here"; grey = "inherited/derived") applied uniformly across `BatchProfileBar.jsx`,
  `BatchContextBar.jsx`, and `SpecForm.jsx`.
- A consistent label/value grid rhythm (uppercase 9px label, mono value) reused card after card.
- A consistent card container pattern (`card` style, bordered, one topic per card).
- The clearest empty/blocked/ready state messaging in the app (`OutputPanel.jsx`'s "Complete these
  fields" and readiness banners).

Adopt this discipline everywhere else. Do **not** copy Costing/Batch Builder's literal pixel
values verbatim (see §3.2 — they carry the same font-size sprawl this document flags elsewhere);
extract the *pattern*, not the numbers, into the shared tokens in §3.2, then apply the tokens
everywhere, benchmark screens included.

## 2. Shared components and tokens to build first

These are infrastructure. Building them before touching individual master screens means every
downstream screen (including the not-yet-built SKU Master and Plant Configuration) inherits the
fix instead of needing its own retrofit later, the way `CustomerFamiliesScreen.jsx` will.

### 2.1 `SummaryRow` component (new, `src/ui/`)

A single reusable disclosure primitive: one line showing 2–4 key facts + a status badge + a
chevron, collapsed by default; click to expand into the full detail/edit block. Same visual
grammar everywhere it appears.

Replaces three independently hand-rolled attempts at the same idea:
- `BatchContextBar.jsx` / `BatchProfileBar.jsx`'s Terms group (Freight/PT/Interest), currently
  always rendered at full height whether or not anything is overridden.
- `RateMasterTab.jsx`'s "Price Rules" strip (GY Premium / Freight bands / Blanket Discount /
  Blanket Paper Credit), currently a permanently-expanded, crowded control cluster.
- `BatchPricingCard.jsx` (see §4.1), which needs to stop being a fixed-width block and become a
  properly collapsible one.

**Where to apply it once built** (in priority order — see §4 for detail on each):
1. Batch Builder — Terms group in `BatchContextBar.jsx` / `BatchProfileBar.jsx`.
2. Rate Master — Price Rules strip.
3. Pricing Basis — each `BasisPart` (Rate / Freight / Sector component).
4. Customer Families — Sectors / Aliases / Current Customers-Prospects / Membership History
   sections in `FamilyDetail`, and each Party's `LocationsList` / `ExternalReferencesList`.
5. SKU Master (not yet built) — Versions / Specifications / Location applicability.
6. Plant Configuration (not yet built) — Machines / Stations / Process Routes under a Plant.

### 2.2 Type-scale tokens (extend `theme.js`)

`theme.js` currently defines color and font-family tokens (`C`, `mono`, `sans`) but **no size
scale** — every screen hand-picks font sizes inline, which is why the same semantic role (a
section heading, a field label, a key value) renders at a different size on every screen today
(confirmed spread: RateMasterTab 9–15px, DefaultsTab 9–15px with a 15px section header where
RateMasterTab uses 13px for the same role, CustomerFamiliesScreen jumping from 9px to 18px with no
intermediate step, PricingBasisScreen topping out at 11.5px).

Add, next to `C`/`mono`/`sans`:

```js
export const T = { micro: 8, label: 9, body: 11, value: 12, title: 13, heading: 15 };
```

Seed the values from Costing/Batch Builder's *most consistently applied* sizes, not from whatever
any one screen currently uses. Adopt incrementally — apply `T` to a screen as it's touched for
other reasons (starting with whichever gets `SummaryRow` first), not as a one-shot rewrite of every
file.

### 2.3 Row-height constancy in tabular grids

Rule for any dense data-grid row (BatchGrid and any future equivalent): **content that only
sometimes appears must never change the row's height.** If a cell needs to show an occasional
badge, warning, or secondary control, it goes in that grid's existing expand-row mechanism
(`toggleRowExpand` in `BatchGrid.jsx`), never as a conditional second line inside the compact row.
A warning that must stay visible in the compact row is a border-color or a small dot, never an
added line.

### 2.4 Screen-end breathing room

Every scrollable tab must end with genuine bottom padding (40–60px) after its last actionable
control — never let the last button or table row sit flush against the container's default edge
padding. Screens stacking multiple independent sections on one page (see §4.4) additionally get a
lightweight jump-link strip at the top so the user isn't scrolling blind to discover there's a
second or third master further down.

### 2.5 Tooltip is not the only channel

Any state that changes what a control does or why it's disabled (blocked-send reasons, read-only
reasons, override-vs-inherited, PP-not-applicable-vs-not-editable) must have a visible inline cue.
A `title` attribute may add detail; it must never be the only place the distinction is stated,
since it requires hover and is invisible on touch.

## 3. Cross-cutting shell fixes

- **Sidebar (`Sidebar.jsx`)**: distinguish, visually, "capability required" pending nav items from
  "not built yet" pending nav items — the action a user takes differs completely between the two.
- **TopBar (`TopBar.jsx`)**: currently empty across roughly 80% of its width (`marginLeft:"auto"`
  pushes AccountMenu/Backup/Restore to the far right). Use the freed space for context (active
  tab, active Batch reference) rather than leaving it blank.
- **Backup/Restore (`TopBar.jsx`)**: confirm before Restore overwrites local state — this is a
  destructive, hard-to-reverse action and currently has no confirm step in the UI layer.
- **Login screen dev-preview buttons (`LoginScreen.jsx`)**: the three "Preview … · fixture only"
  buttons sit at the same visual weight as the real Sign in button. Gate them behind a dev-only
  build flag or demote them visually before this app is shared beyond the current developer.
- **Working vs. Governed distinction**: carry a consistent visual cue (not just banner text)
  everywhere the app distinguishes mutable/local from immutable/governed state — Quotes Workspace's
  three tabs, My Batches' "Open in Batch Builder" vs "Open Quote evidence" buttons, Customer
  Families' Party edit actions. Right now this relies on the user reading a warning banner every
  time rather than recognizing a stable visual signal.

## 4. Per-screen action items

### 4.1 Batch Builder

- **`BatchPricingCard.jsx` / `.batch-profile-pricing-card`** (`index.css:122-127`): drop the
  hard-coded `width:340px / min-width:340px / max-width:340px`. Size to content like its sibling
  cards (Customer Details, Commercials), or cap far lower (~220–240px), and apply `SummaryRow`
  (§2.1) so its compact state is a single line, not a fixed-size box for 2–3 lines of content.
- **Row-height growth in `BatchGrid.jsx`**: move the SET-Code "⚠ assumed / Confirm / Clear"
  controls (currently inline in the main row, `BatchGrid.jsx:487-498`) and the 🍶 Glass-SKU badge
  under Nos/Set (currently inline, `BatchGrid.jsx:509-515`) into the existing expand-row section —
  consistent with how Glass SKU Type's own dropdown is already handled there. Apply §2.3.
- **Toolbar (`BatchGrid.jsx:166-196`)**: group rarely-touched controls (Auto-code checkbox,
  "Generate Missing Codes", format hint) into a small popover so the primary-action row
  (Calculate All / Send All / Construction Library / +Box etc.) doesn't wrap before a data row is
  visible.
- **Focus mode**: add a toggle on the grid toolbar that collapses the Sidebar (reusing the existing
  `sidebarCollapsed` mechanism) and shrinks `BatchProfileBar` to a one-line summary (via
  `SummaryRow`), instead of a browser-level Fullscreen API. This addresses the "maximize visible
  rows" need without an OS-level mode switch.

### 4.2 Costing

- **Die-line preview ("KLD")**: move from `SpecForm.jsx` (currently between the Dimensions &
  Construction card and the Paper Construction card, `SpecForm.jsx:287-304`) into `OutputPanel.jsx`,
  positioned near the top, spatially parallel to where Dimensions sits in the input column. It is
  a rendered consequence of `spec.L/W/H/boxType/dimType/ups`, not an input — read-only move, no
  data-flow change.
- **Margin slider and Fluting BS Contribution slider** (`OutputPanel.jsx:153-179` and `219-242`):
  halve each and place them side by side in a 2-column grid. Check the margin preset row
  (`[0,6,8,10,12,15]%`) doesn't wrap at half width — trim the preset list or let it scroll
  horizontally if it does.
- **Layer Detail table** (`OutputPanel.jsx`, currently the last section in the panel): row order
  already matches Paper Construction's input order (`TOP, F1, L1, F2, L2` — confirmed in
  `engine/costing.js:83`), so this is a **spatial**, not data-ordering, fix. Relocate it to sit near
  the top of `OutputPanel`, at the same altitude as the Paper Construction input card, once the KLD
  move (above) has freed that space.
- **"Complete these fields" empty state** (`OutputPanel.jsx:82-98`): once some fields are already
  filled, collapse to a tight single-line-per-remaining-item list instead of four fully illustrated
  cards every time a new SKU is started.

### 4.3 Rate Master

- Apply `SummaryRow` to the "Price Rules" strip (GY Premium / Freight bands / Blanket Discount /
  Blanket Paper Credit) — collapsed by default (most days nobody is running a blanket edit), so the
  Rate Master table itself is the first thing visible on tab open.
- Apply §2.4 (bottom padding) — the table currently ends flush at the container edge
  (`RateMasterTab.jsx:228-230`).
- Preserve the existing `buildBlanketConfirm` confirm-before-blanket-edit discipline exactly as-is
  — this is the strongest confirm pattern in the app and should be the model other screens copy,
  not something to simplify away while restyling the strip around it.

### 4.4 Commercial Policies (`DefaultsTab.jsx`)

- Add a jump-link strip at the top ("Sector Defaults · Box Trim Defaults · Partitions Master") —
  the page stacks three independent, full-height masters on one scroll (`DefaultsTab.jsx:43-211`)
  with no landmark indicating there's a second or third one below the fold.
- Apply §2.4 (bottom padding) — Partitions Master, the last section, currently ends 20px from the
  container edge with no spacer.
- Normalize section-header size against Rate Master's (currently 15px here vs. 13px there for the
  same role) once §2.2 tokens exist.

### 4.5 Customer Families (`CustomerFamiliesScreen.jsx`)

- Convert "Current Customers/Prospects" (`:887-931`) from a linear indented list into an actual
  table: Code | Name | Status | Locations (count) | Actions — Locations expands a sub-table on
  click rather than always rendering `LocationsList`'s indented rows inline.
- Apply `SummaryRow` to Sectors (`:812-841`), Aliases (`:843-885`), and Membership History
  (`:933-948`) — each collapses to one line (e.g. "Sectors · 2 attached · PIZZA (first)") by
  default.
- Apply `SummaryRow` to each Party's `LocationsList` and `ExternalReferencesList` (`:603-680`) —
  currently rendered in full for every party in every family regardless of whether anyone asked.
- Once the above land, this screen's information architecture should match the table/card idiom
  the rest of the app already uses (Rate Master's tables, Pricing Basis's cards, My Batches' table)
  rather than being the one screen that abandons it.

### 4.6 Pricing Basis (`PricingBasisScreen.jsx`)

- Apply `SummaryRow` to each `BasisPart` (Rate / Freight / Sector component, `:31-47`) — collapsed
  to one line (e.g. "Rate Set · GY-2026-Q3 · Active · v4") by default, expanding into the existing
  detail paragraph + `VersionHistory` strip.
- `RateDrilldown` becomes the second, deeper expansion level under the Rate `BasisPart`, not a
  block that's always fully open alongside it.

### 4.7 SKU Master (not yet built)

Build with the following from day one, rather than retrofitting later:
- Header: SKU identity + status, matching the existing `PermanentCode` / `LifecycleBadge` idiom.
- Three `SummaryRow` sections: Versions ("3 versions, current: v2, approved"), Specifications
  ("1 price-driving"), Location applicability ("2 plants") — each expanding into the full
  version history / spec table / location list.
- Adopt §2.2 type-scale tokens from the start; do not hand-pick font sizes.

### 4.8 Plant Configuration (not yet built: Flute Profiles, Machines, Stations, Process Routes)

Same guidance as §4.7 — this is headed toward the same three-level nesting problem
(Plant → Machine → Station → Route) that made Customer Families hard to scan. Design the detail
view around a Plant header + `SummaryRow`s for Machines/Stations/Routes counts, each expanding into
its own list, instead of a linear indented-div stack.

`ProducingPlantsScreen.jsx` itself (read-only Plant list) is lean enough today that no change is
needed until Plant Configuration is built alongside it.

## 5. Sequencing note

Recommended order, so infrastructure lands before the screens that depend on it:

1. §2.1 `SummaryRow` component.
2. §2.2 type-scale tokens (`T` in `theme.js`).
3. §2.3 row-height rule + §2.4 bottom-padding rule (both are per-screen, no shared component
   needed — can proceed in parallel with 1–2).
4. Batch Builder fixes (§4.1) — highest daily-use screen, and validates `SummaryRow` on the
   Terms group and Pricing Card before it's reused elsewhere.
5. Costing fixes (§4.2) — independent of the above, can run in parallel.
6. Rate Master, Commercial Policies (§4.3–4.4) — reuses `SummaryRow` + tokens from step 4.
7. Customer Families, Pricing Basis (§4.5–4.6) — reuses everything above; highest-value target
   given current state.
8. SKU Master, Plant Configuration (§4.7–4.8) — build correctly from the start using the by-then-
   proven component and tokens, rather than retrofitting.

This document should be triaged into `open-work.md` (splitting items across whatever priority
tiers that register uses) before any implementation begins, per `README.md`'s authority order.
