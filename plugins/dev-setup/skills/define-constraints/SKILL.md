---
name: define-constraints
description: Writes the project's quality bar into CONSTRAINTS.md at the repo root (a floor no change may break, checks with numbers and the command behind each, measured values that must not get worse, a definition of done, and Always / Ask first / Never boundaries), wires the checks into check:fast, check:task and check:full scripts, and guards the diff against a lowered bar such as new suppressions, skipped tests or removed assertions. Use when the user runs /define-constraints, wants to set quality gates or standards, right after a project is scaffolded, or when an agent keeps silencing checks to get to green.
---

# Define Constraints

The phase skills say what to build and prove that it works. This skill writes down what "good enough" means for this
project, once, in a file that every session and every agent reads, and that a script can check. An agent writes more
code than anyone reads line by line, so the judgement has to move into checks that run close to the work.

**Done means:** `CONSTRAINTS.md` exists, every number in it has a reason and a command, the commands run today on the
current branch, and `CLAUDE.md` or `AGENTS.md` points at the file.

## When not to use

- The project has a `CONSTRAINTS.md` and nobody wants to change it: read it and follow it.
- A throwaway proof of concept or a one-off script.
- A non-interactive run (CI, a loop). The interview needs a person. Apply the floor alone, and say so.

## Workflow

```
- [ ] 1. Project read
- [ ] 2. Four questions asked, one at a time
- [ ] 3. CONSTRAINTS.md written
- [ ] 4. A tool installed for each chosen check, scripts wired
- [ ] 5. Agents pointed at the file
- [ ] 6. Trial run on the current branch
```

1. **Read before you ask.** Find the stack, the test runner, the lint config, the `package.json` scripts, the
   conventions file (such as `coding-conventions.md` from `bootstrap-project`), CI workflows and today's coverage
   if the suite writes it. Report what you found in two lines. Never ask for what you can read.

2. **Ask four questions, one at a time.** Each one comes with your guess and a default, so "I don't know" still gives a
   working file. Stop at four.
   1. Beyond the floor, which checks do you want? Coverage of changed lines, dependency and secret scanning,
      accessibility, a performance budget, architecture boundaries. Say what each costs: accessibility and performance
      need a running URL; boundaries need a rules file. _Default: coverage and secret scanning._
   2. When a check fails mid-task, block or warn? _Default: block on the floor, warn on the rest for two weeks._
   3. Target numbers, or measure today and hold that line? _Default: measure and hold._
   4. What must an agent ask before doing? _Default: schema changes on existing data, new dependencies, auth and
      permissions, payments, deleting data, CI and infrastructure changes._

3. **Write `CONSTRAINTS.md`** from the template below. Every number gets a reason. A check with a number and no command
   is a wish, not a constraint: leave it out or list it under Measured.

4. **Install what each check needs, and wire the scripts.** Use the tool the ecosystem already uses, so existing
   config keeps working:

   | Check | Tool | Gate on |
   | --- | --- | --- |
   | Types, lint, format | what the project already has | any error |
   | Coverage of changed lines | the test runner's coverage output, compared with `git diff` | below the number |
   | Secrets | `gitleaks detect --redact --no-banner` | any finding |
   | Dependencies | `osv-scanner scan source -r .` or `pnpm audit --prod` | high or above |
   | Accessibility | `@axe-core/cli` against a running URL | critical or serious |
   | Performance | Lighthouse or `size-limit` | the budget |
   | Boundaries | `dependency-cruiser` | any violation |

   Always pass `--redact` to gitleaks: without it the secret lands in the transcript. Then add three scripts and keep
   them in step with the file (the file wins if they differ):
   - `check:fast`: seconds. Types, lint, secrets. Runs after each edit.
   - `check:task`: under about 90 seconds. `check:fast` plus the tests and coverage. Runs at the end of a slice.
   - `check:full`: everything else. Runs in verification and CI.

5. **Point the agents at it.** Add one line to `CLAUDE.md` (and `AGENTS.md` if it exists): "Read CONSTRAINTS.md before
   writing code. Never weaken it to make a change pass."

6. **Run it on the current branch**, with the three scripts and the guard. If something fails that the user disagrees
   with, change the constraint now. A gate people learn to ignore is worse than no gate.

## The guard

The cheapest road to green is to lower the bar: skip a test, add `@ts-ignore`, drop an assertion, edit a threshold.
The guard finds these moves in the diff since a base commit, including uncommitted and untracked files:

```bash
node <skill-dir>/scripts/guard.mjs [--base <ref>]
```

`<skill-dir>` is this skill's base directory. Exit 0 is clean, 1 lists findings as `file:line kind text`, and 2 means
it could not run. It reports new suppressions, skipped or focused tests, stubs and swallowed errors, removed
assertions, deleted test files, and any change to `CONSTRAINTS.md`. Each finding needs a reason the user accepts, or a
fix. `/implement-design` runs it before closing a slice, and `/verify-build` runs it for the whole initiative, both
with `--base` set to the `Base:` commit in `03-design.md`. Without `--base` it uses the merge base with `origin/main`,
`main` or `master`; on a repo that works on `main` that is `HEAD` itself, so it scans only uncommitted changes and
says so. When `design-solution` calls this skill, it commits `CONSTRAINTS.md` with the scaffold and records that
commit as the base, so the new file is not reported as a change.

## Template

```markdown
# Constraints

Last reviewed: <YYYY-MM-DD>

## Floor

Always on. No setup needed. Checked by the guard.

- No new suppressions (`@ts-ignore`, `eslint-disable`, `istanbul ignore`, `# noqa`, …)
- No skipped, focused or deleted tests, and no removed assertions
- No stubs or empty `catch` blocks standing in for an implementation
- No secrets in source
- This file is never weakened to make a change pass

## Checks

| Check | Rule | Command | Runs at | Why this number |
| --- | --- | --- | --- | --- |
| Types | zero errors | `pnpm typecheck` | check:fast | |
| Coverage | changed lines ≥ 80% | `pnpm test --coverage` + git diff | check:task | forces a test, allows a config line |

## Measured

| Metric | Today | Direction |
| --- | --- | --- |
| Project coverage | 62.4% | must not fall |

## Done means

Applies to every slice, on top of its acceptance criteria.

- Behaviour verified at runtime, not only type-checked
- Tests fail without the change and pass with it
- Error paths handled, not only the happy path
- No dead code, debug output or unrelated changes
- `check:task` passes

## Boundaries

- **Always:** <run check:fast after each edit, validate input at the boundary, …>
- **Ask first:** <schema changes on existing data, new dependencies, auth, payments, deleting data, …>
- **Never:** <commit secrets, edit generated files by hand, force-push, …>

## Exceptions

| ID | Rule | Path | Reason | Owner | Expires |
| --- | --- | --- | --- | --- | --- |
```

**Defaults when the user has no number:** changed-line coverage ≥ 80%; project coverage held at today's value;
dependencies nothing at high or above; accessibility zero critical or serious; LCP ≤ 2500 ms and CLS ≤ 0.1; an
exception lives 90 days at most.

## End of the run

End with three headings: **Blocked on me** (a check that fails today and needs the user's call), **Changed**
(`CONSTRAINTS.md`, the scripts, the tools installed, the `CLAUDE.md` line) and **Found** (what the trial run showed).
When another skill called this one, such as `design-solution`, hand these back to it instead.

## Red flags

- The interview went past four questions, or the user cannot explain the result
- A number the code fails today, with no plan to reach it: measure and hold instead
- A check with no command, or a home-made checker where a standard tool exists
- Every check is the project's own tests: add at least one outside opinion (a scanner, axe, Lighthouse)
- `CONSTRAINTS.md` changed in the same commit as the code that was failing
- Slow checks in `check:fast`, so people start to skip it

## Review Checklist

- [ ] Asked only what could not be read, at most four questions, each with a default
- [ ] Every number has a reason and a command that runs today
- [ ] `check:fast`, `check:task` and `check:full` exist and match the file
- [ ] The floor and the guard pass on the current branch
- [ ] `CLAUDE.md` or `AGENTS.md` points at `CONSTRAINTS.md`
- [ ] Exceptions have an owner and an expiry date
