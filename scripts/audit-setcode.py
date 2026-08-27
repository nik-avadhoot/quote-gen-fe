#!/usr/bin/env python3
# ═══════════════════════════════════════════════════════════════════════════
# scripts/audit-setcode.py — keep SET Code comparison in ONE place.
#
#   python scripts/audit-setcode.py
#
# Exit 0 = every setCode comparison goes through sameSetCode(), or is a
#          deliberate exception listed in ALLOWED below WITH ITS REASON.
# Exit 1 = a new raw comparison appeared.
#
# ── WHY THIS EXISTS ───────────────────────────────────────────────────────
# D-7 was not a bug in any single comparison. It was that there were EIGHT of
# them across six files using THREE conventions — .trim().toUpperCase(),
# .trim() alone, and raw === with no trim — and nothing kept them aligned. A
# SET created in the grid as "Glass180" could never be matched by a row sent
# from Costing, which stores "GLASS180".
#
# The fix collapsed parent resolution onto one helper, sameSetCode() in
# engine/rowType.js. But a helper only prevents drift while people use it, and
# nothing in JavaScript stops the next === on a string. The convention that
# produced three conventions was also, at one time, a convention.
#
# Same shape as scripts/audit-doc-sections.py: a small repo-specific gate for
# a failure mode this project has actually had.
#
# ── THE ALLOWLIST CARRIES REASONS, NOT JUST PATHS ─────────────────────────
# After D-7 the codebase has a helper AND deliberate exceptions, which is
# exactly how the next drift starts: someone finds an exception, assumes it is
# the pattern, and copies it. Every entry records WHY it is different. An
# exception without its reason written where it lives is indistinguishable
# from a bug.
#
# ── DETECTION, AND WHAT IT DELIBERATELY DOES NOT CATCH ────────────────────
# A first attempt matched "setCode ... somewhere later on the line ... ===".
# It produced SIX false positives — every line where setCode sat near an
# unrelated comparison such as (r.itemType||"Box")==="Box". A gate that cries
# wolf is worse than no gate; audit-doc-sections.py says so in its own header
# and it applies here too.
#
# So this matches the ACTUAL IDIOM: a setCode property access standing
# immediately on one side of the operator, allowing only the ||"" coalesce, a
# closing paren and .trim() in between.
#
# KNOWN LIMITATION, stated rather than hidden: it does not see setCode
# embedded in a composite key — the quote-item uid in useQuoteActions.js
# builds a template literal and compares whole strings, so no setCode operand
# exists syntactically. That site is recorded in the register and in
# post-model-defects.md instead of here.
# ═══════════════════════════════════════════════════════════════════════════
import os
import re
import sys

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except (AttributeError, OSError):
    pass

SRC = 'src'
HELPER = os.path.join('src', 'engine', 'rowType.js')   # the one legal home

# (path fragment, code fragment) -> why this comparison is NOT parent resolution.
ALLOWED = {
    ('tabs/batch/BatchGrid.jsx', 'row.setCode===row.matCode'):
        "Compares setCode against matCode for AUTO-FILL, not one setCode "
        "against another. A third semantic: 'has the user diverged the SET "
        "Code from the Mat Code yet'.",

    ('tabs/costing/SpecForm.jsx', 'spec.setCode===spec.material_code'):
        "Same auto-fill semantic as BatchGrid above - setCode vs matCode.",
}

# A setCode property access standing immediately beside the operator.
RAW = re.compile(
    r"\.setCode\b"                              # property access
    r"(?:\s*\|\|\s*[\"'][^\"']*[\"'])?"         # optional ||"" coalesce
    r"\s*\)?\s*"                                # optional closing paren
    r"(?:\.trim\(\))?\s*"                       # optional .trim()
    r"(?:===|!==)\s*"
    r"(?P<rhs>[\"'][^\"']*[\"']|[A-Za-z_$][\w$.?]*)"
)
# Comparing against a string literal is an emptiness/constant test, not one
# setCode against another. Not the drift this guards.
LITERAL = re.compile(r"^[\"']")


def sources():
    for root, _dirs, files in os.walk(SRC):
        for f in files:
            if f.endswith(('.js', '.jsx')):
                yield os.path.join(root, f)


def main():
    violations, allowed_hits = [], []
    for path in sorted(sources()):
        rel = path.replace('\\', '/')
        if os.path.normpath(path) == os.path.normpath(HELPER):
            continue
        with open(path, encoding='utf-8') as fh:
            for n, line in enumerate(fh, 1):
                stripped = line.strip()
                if stripped.startswith('//') or stripped.startswith('*'):
                    continue
                # finditer, NOT search: a line can carry two comparisons, and
                # `row.setCode===""||row.setCode===row.matCode` puts the literal
                # one first. search() stopped there and the real comparison
                # behind it was never seen — a false NEGATIVE, which is the
                # dangerous direction for a gate.
                real = [m for m in RAW.finditer(line)
                        if 'setCodeAssumed' not in m.group(0)
                        and not LITERAL.match(m.group('rhs'))]
                if not real:
                    continue
                hit = next((k for k in ALLOWED if k[0] in rel and k[1] in line), None)
                (allowed_hits if hit else violations).append((rel, n, stripped, hit))

    for rel, n, _s, hit in allowed_hits:
        print('  allowed   %s:%s' % (rel, n))
        print('            %s.' % ALLOWED[hit].split('.')[0])

    print()
    print('=' * 72)
    if violations:
        print('RAW setCode COMPARISON OUTSIDE sameSetCode():')
        for rel, n, s, _h in violations:
            print('  %s:%s' % (rel, n))
            print('      %s' % s[:100])
        print()
        print('Use sameSetCode() from engine/rowType.js. If this comparison is')
        print('genuinely NOT parent resolution, add it to ALLOWED above WITH A')
        print('REASON - an exception without one is indistinguishable from a bug.')
        return 1
    print('SET CODE COMPARISON IS CENTRALISED.')
    print('%d deliberate exception(s), each with a recorded reason.' % len(allowed_hits))
    return 0


if __name__ == '__main__':
    sys.exit(main())
