---
name: implement-release
description: Builds the slices of an approved docs/<slug>/03-tech-plan.md one at a time, each on its own branch, starting with the S0 setup slice (scaffold, constraints, checks, CI) when the plan has one. Writes the code and one test per acceptance criterion (titled with its ID, such as B1.2), keeps a checklist with decisions and deviations in docs/<slug>/04-progress.md, runs the project's checks until they pass, then opens a pull request with the gh CLI and merges it once the checks and CI pass. With all, works through the release and goes on to verify it. Use when the user runs /implement-release, or asks to build, code or implement a planned slice or release.
disable-model-invocation: true
---

# Implement Release

Phase 5 of 6: brainstorm → experiment → specify → plan → **implement** → verify.

Turn the approved tech plan into code and tests, one slice at a time, without asking for permission at each step. Each
slice is a feature branch: it starts from the default branch, ends in a pull request, and merges once every check
passes, so the default branch only ever holds finished slices. The progress file is the memory of the run: it
survives a compacted context and a new session, and the user can read it instead of the scrollback.

**Done means, for each slice:** every item on its checklist is ticked, each of its criteria has a passing test whose
title starts with the criterion ID, the tests of every tier the plan gives those criteria have run and pass, all the
project's checks pass, the guard is clean against the plan's base, the Done means list in `CONSTRAINTS.md` holds,
and the slice's branch is merged into the default branch.

## When not to use

- The tech plan is not approved: run `/plan-release` first.
- A failure with an unclear cause: use `/debug-failure`, then come back.

## Input

`/implement-release <slug> [S2 | fixes | all] [local | no commits]`. With no slice, take what `progress.mjs` names
next: the open **Fixes from verification** section first, then the first slice that is not done. `fixes` takes the
fixes section. `all` takes the fixes section if it is open, then every remaining slice of the planned releases in
order, then verifies the release (see [Keep going, or stop](#keep-going-or-stop)). If `03-tech-plan.md` does not say
`Status: Approved`, stop and point to `/plan-release`. If it has no `Base:` commit, the next slice must be S0 (its
header says `Base: after S0`); otherwise stop and point to `/plan-release`.

How slices reach the default branch:

- **Pull requests, by default**, when the repo has a GitHub remote and `gh auth status` passes: push the branch, open a
  PR, merge it when the checks pass. The approved plan covers these pushes and merges.
- **`local`**, or no GitHub remote: merge each branch into the default branch locally, and push nothing.
- **`no commits`**: no branches and no commits. The work stays in the tree for the user to commit.

```bash
node <skill-dir>/scripts/progress.mjs docs/<slug>
```

`<skill-dir>` is this skill's base directory. The script prints the Status line of each phase file, each slice's
state and open items, each release with its slices, and what comes next. It exits 1 when a slice marked done still
has an unticked item.

## Workflow

```
- [ ] 1. Context read, branch created
- [ ] 2. Slice checklist written to 04-progress.md
- [ ] 3. Tests and code written, item by item
- [ ] 4. Checks pass
- [ ] 5. Slice closed: PR merged (or merged locally), marked done; next slice or verification
```

1. **Read the context and branch.** Read `03-tech-plan.md` (the slice and its sequence diagram, the decisions,
   the corrections from the experiment, the data, the contracts, the modules class diagram and the Base), the criteria
   text and the lifecycle statecharts in `02-spec.md`, `04-progress.md` if it exists, the conventions file the plan names, and `CONSTRAINTS.md`. Then open every file the slice touches.

   Check `git status`. If there are changes outside `docs/<slug>/` that this run did not make, ask the user to commit
   or stash them first, so each slice's work stays separate from theirs. Then start the slice's branch from an up to
   date default branch (`main` unless the repo says otherwise):

   ```bash
   git switch main && git pull --ff-only     # skip the pull with no remote
   git switch -c <slug>/s2-<three-word-title>
   ```

   If the branch already exists from an earlier session, switch to it and continue. The fixes section gets its own
   branch, `<slug>/fixes-<n>`, numbered on from the last one.

2. **Write the slice's checklist** into `docs/<slug>/04-progress.md` before you write code. Use one item for each file
   change the plan lists, one for each criterion's test and one for the checks. Add the section
   if it is missing. Never rewrite a slice that is already done. The fixes section already has its items, one per
   failure: work it like a slice, and add a test item for any fix whose criterion had no test.

3. **Build, item by item.** Tick each item when it lands. Add any new task you find as a new item.
   - Follow the conventions file: its architecture, its recipe for adding a resource, its naming and its test tiers.
     Copy the shape of the nearest existing example. Where a seam between two technologies is not spelled out there,
     the `consult-stack-knowledge` skill's integration doc for it is (its `references/catalog.md` lists them).
   - Build the path the slice's sequence diagram draws: the same modules, calling each other in that order, with its
     failure paths. Each lifecycle transition the slice's behaviours cite is made in one place and refused from every
     other state.
   - Honour each correction from the experiment that the plan maps to this slice. Read the prototype for its
     shape if it helps; never copy its code.
   - For each criterion, write the test in the tier the plan gives it. Start the test title with the criterion ID, so
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

   `check:task` leaves the slow tiers to `check:full`. So also run the tests of every tier the plan gives this
   slice's criteria, filtered to the slice's IDs with the runner's name filter (`vitest run -t "B3\."`,
   `playwright test --grep "B3\."`). An end-to-end criterion is proven when its slice closes, not first in
   verification. Then check that every criterion of the slice has a test titled with its ID, and run the guard against
   the plan's base:

   ```bash
   node <skill-dir>/../verify-release/scripts/trace.mjs docs/<slug>/02-spec.md \
     --plan docs/<slug>/03-tech-plan.md --slice S2
   node <skill-dir>/../define-constraints/scripts/guard.mjs --base <Base from 03-tech-plan.md>
   ```

   Fix the code until everything passes. Never add a suppression, skip or delete a test, remove an assertion, leave a
   stub or edit `CONSTRAINTS.md` to get to green. If you cannot make a check pass, record it under **Blocked on me**.

5. **Close the slice.** If the code works but is heavier than it needs to be, run the `simplify-code` skill on the
   slice, with the checks green before and after. Run `progress.mjs docs/<slug> --slice S2`: it exits 1 while any
   item of the slice is unticked. Then mark the slice `done` and commit on the slice's branch: one commit for the slice (and a separate one for simplifications), staging only the files the slice touched
   plus `04-progress.md`. Never `git add -A`. Then merge it:
   - **Pull request:** `git push -u origin <branch>`, then
     `gh pr create --base main --title "<slug> S2: <slice title>" --body "<the B numbers it delivers, its checklist, the checks run>"`.
     If the repo has CI, wait for it with `gh pr checks <pr> --watch`. When CI fails, fix it on the branch the way
     step 3 says, push, and wait again. When it passes, `gh pr merge <pr> --squash --delete-branch`, then
     `git switch main && git pull --ff-only`. Add `PR: #<n> · merged <sha>` under the slice's heading in the progress
     file as the first change of the next branch (or of verification, after the last slice).
   - **Local:** `git switch main && git merge --no-ff <branch>`, then `git branch -d <branch>`.
   - **No commits:** skip the branch and the merge. The guard still sees the work, because it compares the working
     tree with the base.

   With `all`, go on to the next slice.

## The setup slice (S0)

S0 has no behaviours and no criteria. Its checklist is what the plan's S0 lists, in this order, each with the
checks it must pass:

1. `bootstrap-project` with the combination the plan names, into the repo, which holds only `docs/` so far. It asks
   only what is still open.
2. The `define-constraints` skill. Its short interview is the one point where S0 waits for the user, and "the floor
   only" is a fine answer. Its scripts give the project `check:fast`, `check:task` and `check:full`.
3. Any missing check script the plan lists, the CI workflow (`.github/workflows/checks.yml`, running `check:task` on
   every pull request with the project's package manager), and each convention correction for the conventions file.
4. Every check passes locally. On the pull request, CI must pass too: it is the first proof the workflow works.

After S0 merges, start the next slice's branch with two changes to `03-tech-plan.md`, before any feature code: write
`git rev-parse --short HEAD` of the default branch as `Base:` on the header line, and open each path marked
_(after S0)_ in the release's slices. Where the scaffold put something elsewhere, correct the path in the slice and
record it as a deviation; then drop the mark. With `no commits`, record the HEAD the run started from as the Base, and
say under **Found** that the scaffold will show in every guard run until it is committed.

## Keep going, or stop

Keep going while the next step needs nothing from the user. Put status notes in the same message as the next action.
With `all`, when every slice of the release is done, go on to verify it in the same run: follow
[verify-release's SKILL.md](../verify-release/SKILL.md) for that release. Its continue step brings the run back here for
any fixes.

Stop and ask only when:

- the plan cannot be built as written, and the fix changes a behaviour, a contract or the data. Explain why, propose
  the change, and update `03-tech-plan.md` once the user agrees;
- a check or CI still fails after `debug-failure`, or three fixes did not hold;
- a merge has a conflict that is not mechanical, a push is rejected, or the PR needs a review or approval before it can
  merge;
- the next step is on the **Ask first** list in `CONSTRAINTS.md` and the plan does not already approve it, or it
  touches auth, permissions, payments or secrets;
- the next step is destructive or reaches outside the repo: deleting data, rewriting a migration that already ran,
  force-pushing, changing infrastructure beyond S0's CI workflow.

A small departure that changes no behaviour or contract does not stop the run. Record it as a deviation. When it
changes a module or a call the tech plan draws, update that class or sequence diagram in `03-tech-plan.md` in the same
slice, so the diagrams stay true to the code.

## Progress file

```markdown
# <Name>: Progress

Status: In progress

## S0: The project builds, lints and tests on every pull request · done

PR: #1 · merged `4e1a2b9`

- [x] bootstrap-project: Hono API on Workers
- [x] define-constraints: CONSTRAINTS.md, check:fast / check:task / check:full
- [x] new `.github/workflows/checks.yml`
- [x] checks: typecheck, lint, test, build, format:check; CI green

## S1: <title> · done

PR: #2 · merged `9c1e2f0`

- [x] new `src/db/schema.ts`: potlucks and slots tables
- [x] new `migrations/0001_potlucks.sql` (generated)
- [x] B1.1 test (integration)
- [x] B1.2 test (unit)
- [x] checks: typecheck, lint, test, build

**Decisions**

- <a choice the plan left open, and why>

**Deviations**

- <where the code departs from the plan, and why>

**Found**

- <a surprise worth knowing later>

## S2: <title> · in progress

- [ ] …
```

Leave out an empty notes heading. Verification adds or reopens a `## Fixes from verification · in progress` section
with one checklist item per failure. `progress.mjs` names it next until every item is ticked; then mark it `done`.
Set the file's `Status:` to `Done <YYYY-MM-DD>` when every slice of every release and the fixes section are done.

## End of the run

End with three headings: **Blocked on me**, **Changed** (slices finished, PRs merged, files touched) and **Found**.
Then name the next step: `/implement-release <slug>` for the next slice, or `/verify-release <slug> <R>` when every slice
of the release is done and the run did not go on to verify it.

## Red flags

- A test that passed the first time it ran: it may not test what its title says
- A new suppression, skipped test or removed assertion in the diff
- A change outside the slice that was not asked for
- A second fix attempt without understanding why the first one failed
- An abstraction with one user
- `git add -A` with other people's changes in the tree
- Two slices on one branch, or a slice committed straight to the default branch
- A PR merged while a check or CI is red
- Feature code in S0, or a slice started before S0 merged
- A slice closed while one of its criteria's tiers never ran
- The guard run without `--base`

## Review Checklist

- [ ] Each slice had its own branch from an up to date default branch, and merged only after its checks (and CI)
      passed
- [ ] S0 ran first when the plan has one, and the Base was recorded from the default branch after it merged
- [ ] The checklist was written before the code and ticked as work landed
- [ ] Every criterion of the slice has a test titled with its ID, in the tier the plan gives it, and the slice's trace
      has no gap
- [ ] The tests of every tier the slice's criteria use ran and pass, not only `check:task`
- [ ] Code follows the conventions file, the nearest existing example and the experiment's corrections
- [ ] Every project check passes and the guard is clean. Nothing was weakened or skipped
- [ ] Anything noticed outside the slice is under Found, not fixed
- [ ] A change to behaviour, contract or data stopped the run and updated the tech plan. Small departures are recorded as
      deviations
- [ ] `progress.mjs --slice` passed before the slice was marked done
- [ ] One commit per slice, staging only its files, unless the user said no commits
