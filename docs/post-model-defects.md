# Post-model defects — found after the scope freeze

**This list is NOT worked during the current defect pass.** It exists because the register grew
D-18 → D-24 during Stages 1 and 2, every new entry arriving from live testing, and an open list that
grows while you work it has no end.

> ## The scope freeze
>
> **The defect register as it stood at commit `a178e3f` is the entire scope of this pass.**
>
> Anything found from that point onward is recorded **here** and **is not worked now — regardless of
> severity** — with one exception:
>
> > **it may be worked if, and only if, it blocks a fix already in scope.**
>
> "Blocks" means the in-scope fix cannot be completed or verified without it. Not *"is related to"*,
> not *"is in the same file"*, not *"would be cheap while we are here"*.
>
> This is a **standing rule for the remainder of the pass**, decided by the product owner on
> 2026-08-28. It is not a judgement about severity. A finding landing here can be worse than
> anything in the register; it is deferred because the pass has to terminate.

## Numbering

Entries here are **PM-1, PM-2, …** — a separate sequence from D-*. They are deliberately *not* given
D-numbers, so that "the register" always means the frozen list and the count of remaining work
cannot drift.

If one of these is later promoted into a pass, it keeps its PM number and gains a D-number only if
the register is formally reopened.

## What belongs here

- Anything observed after the freeze, at any severity
- Anything found while verifying an in-scope fix that is **not** that fix failing
- Design-level observations about code the pass is not touching

## What does NOT belong here

- A verification failure of an in-scope fix — that is the fix not being done
- Anything that blocks an in-scope fix — that gets worked, and recorded in the register

---

## Register

*None yet. The freeze begins at `a178e3f`.*
