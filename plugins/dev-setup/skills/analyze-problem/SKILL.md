---
name: analyze-problem
description: Turns a chosen direction into a framework-free analysis by interviewing the user fork by fork, then writes docs/<slug>/02-analysis.md with actors, numbered behaviours (B1…) that each carry testable acceptance criteria (B1.1…), a plain-language domain model, flows, screens, constraints and non-goals. Use when the user runs /analyze-problem, or wants requirements, a PRD or user stories for an idea before designing it.
disable-model-invocation: true
---

# Analyze Problem

Phase 2 of 5: brainstorm → **analyze** → design → implement → verify.

This phase describes the solution as the people who use it see it: what they can do, what the system knows, and what must stay true. It names no framework, table, endpoint or file. Those are building blocks, and building blocks belong to the design phase.

**Done means:** every behaviour in `docs/<slug>/02-analysis.md` can be judged true or false, has acceptance criteria a test can check, and the user approved the list with an explicit yes.

## When not to use

- A one-line change or a bug: go straight to the code, or to `/debug-failure`.
- The analysis exists and the user only wants it built: start at `/design-solution`.

## IDs

The IDs written here are used by every later phase, so give them now and never renumber:

- **B1, B2, …**: a behaviour. Its title is one sentence that can be true or false: "A guest can claim an open dish slot." Not "Slot claiming".
- **B1.1, B1.2, …**: an acceptance criterion of B1, in the form "Given …, when …, then …".

The design maps each B to a slice. The implementation starts each test title with its criterion ID (`B1.2 rejects a second claim`). Verification traces each ID to a test and to live evidence. A removed behaviour keeps its number and is marked _(dropped)_.

## Workflow

```
- [ ] 1. Inputs read
- [ ] 2. Behaviours drafted and shown to the user
- [ ] 3. Forks resolved, one at a time
- [ ] 4. Domain, flows and screens written
- [ ] 5. User approved the behaviour list
- [ ] 6. 02-analysis.md written
```

1. **Read the inputs.** Read `docs/<slug>/01-brainstorm.md` if it exists. If it does not, ask the user for the idea, the people and the references, as the brainstorm phase would. Read any notes, briefs or designs they point to. If the repo already has code, read enough to know what exists today. A behaviour the code already has is still listed, marked _(exists)_, so verification covers it.

   **Check the scope.** If the direction bundles capabilities that could ship and be checked separately (each with its own users or data, such as accounts, billing and reports), propose splitting it into several initiatives, each with its own slug, and an order to build them in. Analyze one initiative at a time.

2. **State your assumptions, then draft the behaviours.** Before the list, write what you are assuming about users, scope and limits, and ask the user to correct it now. Then write the B list as one-line titles grouped by actor, and show it before you write criteria. This is the cheapest moment to add, cut or merge. Keep the first version small: what the first live version needs, not everything the idea could become. Put the rest under **Later**.

3. **Resolve the forks.** A fork is a question whose answer changes what gets built: who can do it, what happens on conflict, what is kept and for how long, what happens offline. Ask one fork at a time, each with options, your guess and the reason for it (use AskUserQuestion when the options are clear). Ask only forks that change behaviour. A choice between equivalent technologies waits for the design phase.
   - When two sources disagree (the user's words, the brainstorm, existing code, a reference), say so and ask which one wins. Do not pick one silently.
   - Record a rejected alternative only when someone could reasonably reopen it.

4. **Write the rest in plain terms.**
   - **Domain:** the things the system knows and how they relate, in words ("A potluck has many dish slots. A slot has at most one claim."). No types and no tables.
   - **Flows:** the main paths through the behaviours, as numbered steps, plus the failure paths that matter.
   - **Screens:** each place a person goes, what they get done there, which behaviours it serves and where it leads. No layout or components.
   - **Constraints:** limits that are true whatever gets built (privacy, cost, scale, deadlines, devices).
   - **Non-goals:** what this initiative will not do, so no later phase adds it.

5. **Get an explicit yes.** Show the final behaviour list with its criteria, plus the non-goals. Apply the corrections and show it again. "Sounds good", "sure" and "whatever you think" are not a yes: ask what they would change, or offer two concrete options to choose between.

6. **Write `docs/<slug>/02-analysis.md`** from the template below. If the file exists, ask before you replace it, unless the user asked for an update. When you update it, keep the IDs.

## Template

```markdown
# <Name>: Analysis

Status: Approved <YYYY-MM-DD>

## Problem

<two or three sentences, with the user's words quoted from the brainstorm>

## Actors

- **<Actor>**: <who, and what they want>

## Behaviours

### B1: <Actor> can <do something>.

- B1.1 Given <state>, when <action>, then <observable result>.
- B1.2 …

### B2: …

## Domain

- <thing and relation, one per line>

## Flows

1. <step> (B1)
2. …

## Screens

| Screen | Job | Behaviours | Leads to |
| --- | --- | --- | --- |

## Constraints

- <constraint>

## Non-goals

- <non-goal>

## Later

- <behaviour left for a later initiative>
```

A good criterion names a state, an action and something a person or a test can observe: "Given a slot with a claim, when another guest claims it, then they see 'Already taken' and the first claim stays." A bad criterion restates the title or tests an implementation detail ("the claims table has a unique index").

## End of the run

End with three headings: **Blocked on me**, **Changed** and **Found**. Then name the next step: `/design-solution <slug>`.

## Red flags

- Criteria written before the user saw the behaviour list
- A framework, table or endpoint named in the file
- Several forks asked in one message, or a fork with no guess
- A criterion that restates its title, or that only an implementation detail can satisfy
- An initiative with behaviours for unrelated capabilities that could ship separately
- "Sounds good" taken as approval

## Review Checklist

- [ ] Assumptions were stated before the behaviours, and the scope was checked for separate initiatives
- [ ] Every behaviour title is a sentence that can be true or false
- [ ] Every behaviour has at least one Given/When/Then criterion with an observable result
- [ ] IDs are stable: nothing renumbered, dropped items marked
- [ ] No frameworks, tables, endpoints or file paths anywhere in the file
- [ ] Contradictions between sources were raised with the user, not resolved silently
- [ ] Non-goals and Later are filled, so scope cannot creep back in
- [ ] The user approved the behaviour list with an explicit yes
