// ═══════════════════════════════════════════════════════════════════════════
// src/ui/icons.jsx — small stroke icons for dense toolbars.
//
// Presentation only. Each icon is 24-unit inline SVG drawn with currentColor,
// so it takes the button's text colour and scales with `size`. Icons never
// carry meaning alone: the button that holds one supplies aria-label and title.
// ═══════════════════════════════════════════════════════════════════════════

const base = size => ({
  width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor",
  strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, focusable: "false",
});

// Two arrows pointing out to opposite corners: fill the available area.
export const ExpandIcon = ({ size = 16 }) => (
  <svg {...base(size)}>
    <polyline points="15 3 21 3 21 9" />
    <polyline points="9 21 3 21 3 15" />
    <line x1="21" y1="3" x2="14" y2="10" />
    <line x1="3" y1="21" x2="10" y2="14" />
  </svg>
);

// Two arrows pointing back in: return to the shared layout.
export const CollapseIcon = ({ size = 16 }) => (
  <svg {...base(size)}>
    <polyline points="4 14 10 14 10 20" />
    <polyline points="20 10 14 10 14 4" />
    <line x1="14" y1="10" x2="21" y2="3" />
    <line x1="3" y1="21" x2="10" y2="14" />
  </svg>
);

export const RefreshIcon = ({ size = 16 }) => (
  <svg {...base(size)}>
    <path d="M21 12a9 9 0 1 1-2.64-6.36" />
    <polyline points="21 3 21 9 15 9" />
  </svg>
);
