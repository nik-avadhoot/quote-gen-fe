#!/usr/bin/env python3
# ═══════════════════════════════════════════════════════════════════════════
# scripts/audit-doc-sections.py — find sections silently deleted from a
# tracked markdown document.
#
#   python scripts/audit-doc-sections.py                 # audits the plan doc
#   python scripts/audit-doc-sections.py docs/other.md   # any tracked file
#
# Exit 0 = clean, or every finding is in REVIEWED below.
# Exit 1 = a section vanished that nobody has signed off on.
#
# ── WHY THIS EXISTS ───────────────────────────────────────────────────────
# A markdown edit that replaces a range by anchoring on the NEXT heading
# silently consumes everything between the two anchors. This happened to
# docs/component-split-plan.md in commit b7cc2a4: the register ran
# D-2 → D-7 → D-6 → D-4, a rewrite of D-2 anchored on D-4, and defect
# entries D-6 and D-7 were eaten. Nobody noticed for eleven commits.
#
# That was the THIRD instance of one failure class in this project — an
# end-point chosen by what was visible rather than by what was structurally
# there. The other two were in code, where the build caught them. This one
# was in prose, where nothing does:
#
#     in code   a bad range boundary usually breaks the build
#     in prose  a bad range boundary is silent, forever
#
# Documents therefore need MORE care than code, not less — and this is the
# case where a cheap automated check beats a rule someone has to remember.
#
# ── HOW IT AVOIDS CRYING WOLF ─────────────────────────────────────────────
# Most heading changes in a living document are retitles or deliberate
# rewrites, and a naive "heading disappeared" check reports all of them.
# A tool that cries wolf is worse than no tool, so a finding must survive
# three filters before it is reported:
#
#   1. RETITLE     the same commit added a heading with the same key
#                  ("D-6", or the first five words for non-defect sections)
#   2. MOVED       the section's body text still exists in the current file
#                  under some other heading
#   3. REVIEWED    a human has already looked at it and accepted it
#
# On the real history this reduced 6 apparent losses to 1 genuine one.
#
# ── MAINTAINING THE ALLOWLIST ─────────────────────────────────────────────
# When this reports a finding you have checked and accepted, add it to
# REVIEWED with a reason. Same pattern as scripts/eslint-baseline.txt:
# the baseline may shrink freely; it grows only by deliberate review.
# ═══════════════════════════════════════════════════════════════════════════
import io
import re
import subprocess
import sys

# The tracked documents use em-dashes, arrows and emoji in headings (🚨, 🧭, 🔷),
# and this script PRINTS headings that changed. On Windows the console defaults to
# cp1252, which cannot encode them: printing one raises UnicodeEncodeError and the
# audit dies mid-run with a traceback instead of a verdict.
#
# Latent from the start — only CHANGED headings are printed, so it stayed hidden
# until a heading carrying an emoji was first retitled (D-5, at Stage 2). A gate
# that crashes on its own subject matter is worse than no gate: it exits non-zero
# and looks like a finding. The '?' characters seen in this script's output for
# en-dashes were the same problem, degrading quietly rather than fatally.
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except (AttributeError, OSError):
    pass  # pre-3.7 or a stream that cannot be reconfigured; fall through unchanged

DEFAULT_DOC = 'docs/component-split-plan.md'
MIN_FINGERPRINT_LEN = 45   # shorter lines recur across sections and match spuriously
MAX_FINGERPRINTS = 4

# (commit prefix, heading fragment) -> why this deletion is accepted.
REVIEWED = {
    ('da5ac3c', 'Session handoff'):
        'Deliberate. The section described a session-handoff capability that did '
        'not exist; the commit removing it exists precisely to correct that claim. '
        'Deleting it was the point.',

    ('c777b08', 'When they coincide'):
        'Deliberate rewrite, ruled by the product owner. The section framed D-27 as '
        '"diverges when a PP row carries an override" - an edge case. It is '
        'unconditional: server.py reads f0.wastePP, and A1-02 assigns an override '
        'only to sp.wastePP on the PP row itself, so a Box row never carries one in '
        'that field. The replacement section states exactly that. The old framing '
        'was not trimmed for length, it was WRONG, and keeping it beside the '
        'correction would leave two incompatible accounts of one defect.',
}


def git(*args):
    r = subprocess.run(('git',) + args, capture_output=True, text=True,
                       encoding='utf-8', errors='replace')
    return r.stdout


def headings(text):
    return [l.rstrip() for l in text.split('\n') if re.match(r'^#{2,4} ', l)]


def key_of(heading):
    """Identity of a section, stable across retitles.

    Defect entries are keyed by their D-number; everything else by its first
    five words, which survives a subtitle change but not a real replacement."""
    m = re.search(r'\bD-(\d+)\b', heading)
    if m:
        return 'D-' + m.group(1)
    words = re.sub(r'^#+\s*', '', heading).split()
    return ' '.join(words[:5]).lower()


def body_of(lines, heading):
    """Lines under `heading`, stopping at the next same-or-higher-level heading."""
    try:
        i = lines.index(heading)
    except ValueError:
        return []
    level = len(heading) - len(heading.lstrip('#'))
    out = []
    for l in lines[i + 1:]:
        if re.match(r'^#{1,%d} ' % level, l):
            break
        if l.strip():
            out.append(l.strip())
    return out


def reviewed_reason(sha, heading):
    for (c, frag), why in REVIEWED.items():
        if sha.startswith(c) and frag in heading:
            return why
    return None


def main():
    doc = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_DOC
    current = io.open(doc, encoding='utf-8').read()

    log = git('log', '--all', '--reverse', '--format=%H %s', '--', doc).strip()
    commits = [c for c in log.split('\n') if c]
    if not commits:
        print('no history for %s' % doc)
        return 1

    print('auditing %s across %d commits\n' % (doc, len(commits)))

    prev_headings, prev_sha = None, None
    retitled, moved, accepted, losses = [], [], [], []

    for entry in commits:
        sha, subject = entry.split(' ', 1)
        text = git('show', sha + ':' + doc)
        if not text:
            continue
        cur_headings = headings(text)

        if prev_headings is not None:
            added_keys = {key_of(h) for h in cur_headings} - {key_of(h) for h in prev_headings}
            still = {key_of(h) for h in cur_headings}
            for h in prev_headings:
                if h in cur_headings:
                    continue
                k = key_of(h)

                # 1. retitled in place?
                if k in still or k in added_keys:
                    retitled.append((sha, subject, h))
                    continue

                # 2. body survived somewhere in the file today?
                prev_lines = git('show', prev_sha + ':' + doc).split('\n')
                body = body_of(prev_lines, h)
                fps = sorted((b for b in body
                              if len(b) > MIN_FINGERPRINT_LEN and not b.startswith('|')),
                             key=len, reverse=True)[:MAX_FINGERPRINTS]
                kept = sum(1 for f in fps if f in current)
                if fps and kept == len(fps):
                    moved.append((sha, subject, h))
                    continue

                # 3. already reviewed?
                why = reviewed_reason(sha, h)
                if why:
                    accepted.append((sha, h, why))
                    continue

                losses.append((sha, subject, h, kept, len(fps)))

        prev_headings, prev_sha = cur_headings, sha

    for sha, subject, h in retitled:
        print('  retitled  %s  %s' % (sha[:7], h[:72]))
    for sha, subject, h in moved:
        print('  moved     %s  %s' % (sha[:7], h[:72]))
    for sha, h, why in accepted:
        print('  accepted  %s  %s' % (sha[:7], h[:72]))
        print('            %s' % why)
    if retitled or moved or accepted:
        print()

    if not losses:
        print('=' * 72)
        print('NO SILENT DELETIONS.')
        print('%d retitled, %d moved, %d reviewed-and-accepted.'
              % (len(retitled), len(moved), len(accepted)))
        return 0

    for sha, subject, h, kept, total in losses:
        print('!! SILENT DELETION  %s  %s' % (sha[:7], subject[:52]))
        print('     section: %s' % h[:78])
        print('     body fingerprints surviving in HEAD: %d of %d' % (kept, total))
        print('     recover with:  git show %s^:%s' % (sha[:7], doc))
        print('     if intentional, add it to REVIEWED at the top of this file')
        print()
    print('=' * 72)
    print('%d section(s) lost content without replacement.' % len(losses))
    return 1


if __name__ == '__main__':
    sys.exit(main())
