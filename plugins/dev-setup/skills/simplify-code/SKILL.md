---
name: simplify-code
description: Makes recently changed code easier to read without changing what it does, one small change at a time with the tests run after each, staying inside the changed files and the project's conventions, and leaving blocks marked simplify-ignore alone. Use when the user runs /simplify-code, when a slice works and its checks pass but the code is heavier than it needs to be, or when asked to simplify, clean up or refactor for clarity.
---

# Simplify Code

Simpler means a new teammate understands it faster, not that it has fewer lines. The behaviour stays exactly the same:
the same output for every input, the same errors, the same side effects in the same order. The existing tests prove
it, and they pass without a single change.

**Done means:** each simplification is its own small change, the tests passed after every one of them without edits,
and the project's checks pass.

## When not to use

- The code is still failing its checks: make it work first (`/debug-failure` if the cause is unclear).
- You do not yet understand what the code does or why.
- The module is about to be rewritten.
- The "simpler" version would be measurably slower on a hot path.

## Scope

By default, simplify only what changed: the current slice, or the diff against the base branch. Code outside that
scope is out of bounds unless the user widens it. Note what you see there under **Noticed** instead of fixing it.

Never touch a block between `simplify-ignore-start` and `simplify-ignore-end` comments. Someone marked it on purpose.

## Workflow

```
- [ ] 1. Scope set, tests green before starting
- [ ] 2. Each candidate understood
- [ ] 3. Simplifications applied one at a time
- [ ] 4. Result compared with the original
```

1. **Set the scope and start green.** List the files in scope. Run the tests: if they do not pass now, stop. You cannot
   tell a broken simplification from a broken start.

2. **Understand before you touch.** For each candidate, know what calls it, what it calls, its edge cases and the tests
   that cover it. If something looks pointless, find out why it is there (`git log -L`, `git blame`) before you remove
   it. A reason may still hold: a platform quirk, a performance fix, a bug workaround.

3. **Apply one simplification at a time.** After each one, run the tests. If they pass, keep it. If they fail, revert
   it and move on. Never edit a test to make a simplification pass: a test that has to change means the behaviour
   changed. Look for:

   | Signal | Simpler form |
   | --- | --- |
   | Nesting three or more levels deep | guard clauses, early returns |
   | A function that does several jobs | smaller functions with names that say the job |
   | Nested ternaries, boolean flag parameters | `if`/`switch`, a lookup, an options object, two functions |
   | The same condition or block in several places | one named predicate or helper |
   | Vague names (`data`, `tmp`, `res`) | names that say what the value is |
   | A wrapper or abstraction with one user and no job | the direct call |
   | Dead code, unused imports, commented-out code | delete it |
   | A comment that repeats the code | delete it. Keep comments that say why |

   Match the project's conventions and the code around it. A pattern the codebase does not use is churn, not
   simplification.

4. **Compare the whole.** Read the before and after together. If the result is not clearly easier to follow, revert
   it. Not every attempt succeeds.

Keep simplifications in their own commit, separate from feature or fix work, when the user wants commits. In an
initiative, record what you changed under the slice's notes in `04-progress.md`.

## End of the run

End with three headings: **Blocked on me** (anything that needs the user to widen the scope), **Changed** (each
simplification kept, in a line, and each one reverted) and **Found** (the Noticed list). When another skill called
this one, such as `implement-design`, hand these back to it instead.

## Red flags

- A test had to change for a simplification to pass
- Error handling removed because it "looked cleaner"
- Code outside the scope changed without the user asking
- Several simplifications batched into one untested change
- The "simpler" code is longer or needs more thought to follow
- A helper inlined so that a concept lost its name

## Review Checklist

- [ ] Tests were green before the first change and after every change, with no test edited
- [ ] Every change is inside the scope; anything else is listed under Noticed
- [ ] Nothing between `simplify-ignore-start` and `simplify-ignore-end` was touched
- [ ] No error handling was removed or weakened
- [ ] The project's checks pass, and the result follows its conventions
