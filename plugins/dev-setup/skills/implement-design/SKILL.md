---
name: implement-design
description: Builds the slices of an approved docs/<slug>/03-design.md one at a time, writing the code and one test per acceptance criterion (titled with its ID, such as B1.2), keeping a checklist with decisions and deviations in docs/<slug>/04-progress.md, and running the project's checks until they pass. Use when the user runs /implement-design, or asks to build, code or implement a designed slice.
disable-model-invocation: true
---

# Implement Design

Phase 4 of 5: brainstorm → analyze → design → **implement** → verify.

Turn the approved design into code and tests, one slice at a time, without asking for permission at each step. The
progress file is the memory of the run: it survives a compacted context and a new session, and the user can read it
instead of the scrollback.

**Done means, for each slice:** every item on its checklist is ticked, each of its criteria has a passing test whose
title starts with the criterion ID, the tests of every tier the design gives those criteria have run and pass, all the
project's checks pass, the guard is clean against the design's base, and the Done means list in `CONSTRAINTS.md`
holds.

## When not to use

- The design is not approved: run `/design-solution` first.
- A failure with an unclear cause: use `/debug-failure`, then come back.

## Input

`/implement-design <slug> [S2 | fixes | all]`. With no slice, take what `progress.mjs` names next: the open
**Fixes from verification** section first, then the first slice that is not done. `fixes` takes the fixes section.
`all` takes the fixes section if it is open, then every remaining slice in order. If `03-design.md` does not say
`Status: Approved`, or has no `Base:` on its header line, stop and point to `/design-solution`.

```bash
node <skill-dir>/scripts/progress.mjs docs/<slug>
```

`<skill-dir>` is this skill's base directory. The script prints the Status line of each phase file, each slice's
state and open items, and what comes next. It exits 1 when a slice marked done still has an unticked item.

Before each slice, check `git status`. If there are changes outside `docs/<slug>/` that this run did not make, ask the
user to commit or stash them first, so each slice's work stays separate from theirs.

## Workflow

```
- [ ] 1. Context read
- [ ] 2. Slice checklist written to 04-progress.md
- [ ] 3. Tests and code written, item by item
- [ ] 4. Checks pass
- [ ] 5. Slice marked done; next slice or end of run
```

1. **Read the context.** Read `03-design.md` (the slice, the decisions, the data, the contracts and the Base), the
   criteria text in `02-analysis.md`, `04-progress.md` if it exists, the conventions file the design names, and
   `CONSTRAINTS.md`. Then open every file the slice touches.

2. **Write the slice's checklist** into `docs/<slug>/04-progress.md` before you write code. Use one item for each file
   change the design lists, one for each criterion's test and one for the checks. Add the section if it is missing.
   Never rewrite a slice that is already done. The fixes section already has its items, one per failure: work it like
   a slice, and add a test item for any fix whose criterion had no test.

3. **Build, item by item.** Tick each item when it lands. Add any new task you find as a new item.
   - Follow the conventions file: its architecture, its recipe for adding a resource, its naming and its test tiers.
     Copy the shape of the nearest existing example. Where a seam between two technologies is not spelled out there,
     the `apply-stack-conventions` skill's integration doc for it is (its `references/catalog.md` lists them).
   - For each criterion, write the test in the tier the design gives it. Start the test title with the criterion ID, so
     verification can trace it: `it("B1.2 rejects a second claim on a taken slot", …)`. Write the test before or with
     the code, and see it fail once for the right reason.
   - Test behaviour a caller can see, not implementation details. Prefer real dependencies to mocks.
   - Write the simplest code that makes the test pass. Three similar lines beat an abstraction nobody needs yet.
   - Run `check:fast` (or typecheck and the slice's tests) after each item, not only at the end.
   - Generate migrations with the project's own tool. Do not hand-write what the tool generates.
   - Touch only what the slice needs. When you notice something worth fixing outside it, add it to **Found** as
     "noticed, not touched" instead of fixing it.
   - When a check fails and the cause is not plain from the first error, follow the `debug-failure` skill before you
     change anything else.

4. **Run every check** the project defines: `check:task` if `CONSTRAINTS.md` defines it, otherwise the `package.json`
   scripts or the conventions file (typically `typecheck`, `lint`, `test`, `build`, `format:check`).

   `check:task` leaves the slow tiers to `check:full`. So also run the tests of every tier the design gives this
   slice's criteria, filtered to the slice's IDs with the runner's name filter (`vitest run -t "B3\."`,
   `playwright test --grep "B3\."`). An end-to-end criterion is proven when its slice closes, not first in
   verification. Then check that every criterion of the slice has a test titled with its ID, and run the guard against
   the design's base:

   ```bash
   node <skill-dir>/../verify-build/scripts/trace.mjs docs/<slug>/02-analysis.md \
     --design docs/<slug>/03-design.md --slice S2
   node <skill-dir>/../define-constraints/scripts/guard.mjs --base <Base from 03-design.md>
   ```

   Fix the code until everything passes. Never add a suppression, skip or delete a test, remove an assertion, leave a
   stub or edit `CONSTRAINTS.md` to get to green. If you cannot make a check pass, record it under **Blocked on me**.

5. **Close the slice.** If the code works but is heavier than it needs to be, run the `simplify-code` skill on the
   slice, with the checks green before and after. Run `progress.mjs docs/<slug> --slice S2`: it exits 1 while any
   item of the slice is unticked. Then mark the slice `done` in the progress file. Commit the slice unless the user
   said not to ("no commits"): one commit per slice (and a separate one for simplifications), staging only the files
   the slice touched plus `04-progress.md`. Never `git add -A`. Without commits the guard still sees the work, because
   it compares the working tree with the base. With `all`, go on to the next slice.

## Keep going, or stop

Keep going while the next step needs nothing from the user. Put status notes in the same message as the next action.
Stop and ask only when:

- the design cannot be built as written, and the fix changes a behaviour, a contract or the data. Explain why, propose
  the change, and update `03-design.md` once the user agrees;
- a check still fails after `debug-failure`, or three fixes did not hold;
- the next step is on the **Ask first** list in `CONSTRAINTS.md`, or touches auth, permissions, payments or secrets;
- the next step is destructive or reaches outside the repo: deleting data, rewriting a migration that already ran,
  force-pushing, changing infrastructure.

A small departure that changes no behaviour or contract does not stop the run. Record it as a deviation.

## Progress file

```markdown
# <Name>: Progress

Status: In progress

## S1: <title> · done

- [x] new `src/db/schema.ts`: potlucks and slots tables
- [x] new `migrations/0001_potlucks.sql` (generated)
- [x] B1.1 test (integration)
- [x] B1.2 test (unit)
- [x] checks: typecheck, lint, test, build

**Decisions**

- <a choice the design left open, and why>

**Deviations**

- <where the code departs from the design, and why>

**Found**

- <a surprise worth knowing later>

## S2: <title> · in progress

- [ ] …
```

Leave out an empty notes heading. Verification adds or reopens a `## Fixes from verification · in progress` section
with one checklist item per failure. `progress.mjs` names it next until every item is ticked; then mark it `done`.
Set the file's `Status:` to `Done <YYYY-MM-DD>` when every slice and the fixes section are done.

## End of the run

End with three headings: **Blocked on me**, **Changed** (slices finished, files touched) and **Found**. Then name the
next step: `/implement-design <slug>` for the next slice, or `/verify-build <slug>` when every slice is done.

## Red flags

- A test that passed the first time it ran: it may not test what its title says
- A new suppression, skipped test or removed assertion in the diff
- A change outside the slice that was not asked for
- A second fix attempt without understanding why the first one failed
- An abstraction with one user
- `git add -A` with other people's changes in the tree
- A slice closed while one of its criteria's tiers never ran
- The guard run without `--base`

## Review Checklist

- [ ] The checklist was written before the code and ticked as work landed
- [ ] Every criterion of the slice has a test titled with its ID, in the tier the design gives it, and the slice's trace
      has no gap
- [ ] The tests of every tier the slice's criteria use ran and pass, not only `check:task`
- [ ] Code follows the conventions file and the nearest existing example
- [ ] Every project check passes and the guard is clean. Nothing was weakened or skipped
- [ ] Anything noticed outside the slice is under Found, not fixed
- [ ] A change to behaviour, contract or data stopped the run and updated the design. Small departures are recorded as
      deviations
- [ ] `progress.mjs --slice` passed before the slice was marked done
- [ ] One commit per slice, staging only its files, unless the user said no commits
