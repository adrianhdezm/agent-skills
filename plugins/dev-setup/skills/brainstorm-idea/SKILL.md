---
name: brainstorm-idea
description: Opens a new initiative by interviewing the user about the idea, the references that inspire it and who it is for, proposing several deliberately different directions, optionally testing the riskiest one with a throwaway proof of concept, and recording the chosen direction in docs/<slug>/01-brainstorm.md. Use when the user runs /brainstorm-idea, or has a raw idea they want to explore before any requirements exist.
disable-model-invocation: true
---

# Brainstorm Idea

Phase 1 of 5: **brainstorm** → analyze → design → implement → verify.

This phase widens before it narrows. Collect what the user has in mind, show them options they had not thought of, test the one thing most likely to kill the idea, and stop when they have picked a direction. Leave requirements, data models and frameworks to the later phases.

**Done means:** the user picked a direction, and `docs/<slug>/01-brainstorm.md` records it with the references, the directions considered, what any proof of concept showed and what we are not doing.

## When not to use

- The user already knows exactly what to build and why: start at `/analyze-problem`.
- A bug fix or a small change to an existing feature.

## Where the docs live

Every phase writes into `docs/<slug>/` at the project root, where `<slug>` names the initiative in kebab case (`v1`, `potluck`, `billing`). Each phase reads only the files of the phases before it, plus the repo, so work can stop and resume in a new session.

- If the current directory is the project, use it.
- If there is no project yet, ask where it will live (default `~/Code/<slug>`), create the folder and run `git init`. The scaffold comes later, in the design phase. The scaffold skills accept a folder that holds only `docs/`.
- If `docs/<slug>/01-brainstorm.md` exists, read it and continue from it instead of starting over.
- If earlier initiatives exist under `docs/`, read what they handed on: the **Next initiative** section of each
  `05-verification.md`, the **Later** list of each `02-analysis.md` and the **Not doing** list of each
  `01-brainstorm.md`. Offer the items that touch this idea as references, and quote them in the file. Do not reopen a
  Not doing item without saying so.

## Workflow

```
- [ ] 1. Project folder and slug settled
- [ ] 2. Idea, people and references collected
- [ ] 3. Directions proposed
- [ ] 4. Riskiest assumption tested (or skipped, with the reason)
- [ ] 5. Direction picked
- [ ] 6. 01-brainstorm.md written
```

1. **Settle the folder and the slug** as above.

2. **Collect.** Start from what earlier initiatives handed on, if any (see above). Then ask the user to dump everything: the idea in their own words, who has the problem, what they do today, and references (products, links, screenshots, repos, half-remembered "like X but for Y"). Read or fetch every reference they give. If one will not open, say so and ask for another way in: never describe a reference from its name alone. Quote the user's own words in the file. Do not reword them. Then interview:
   - Ask one question at a time, about the problem or the people, not the build. Attach your guess and why: the user corrects a wrong guess faster than they answer a blank question.
   - Listen for what the user thinks they should want: "scalable", "modern", "the way most apps do it". Then ask: "If you did not have to justify this to anyone, what would you want?"
   - Stop when you can predict their answer to your next three questions.

3. **Diverge.** Restate the idea as one "How might we …?" question. Then propose 3 to 5 directions that differ in kind, not in detail. These lenses help: invert the idea, remove a constraint (time, money, tech), serve a different user, combine it with a nearby idea, find the version that is ten times simpler, ask what an expert in the field finds obvious. Make at least one direction deliberately unusual. For each one give:
   - a one-line pitch,
   - what it takes from the references,
   - its riskiest assumption: the thing that, if false, makes the direction worthless,
   - a one-line verdict on value (who gains, how much), feasibility (the hardest part) and difference (why someone would switch).

   Be honest, not supportive. Say when a direction is weak and why. Ask the user to react, mix or add their own. Iterate while it is producing new ideas. Stop when it produces only variants.

4. **Test the riskiest assumption, if it is cheap.** Do a proof of concept (PoC) only when it answers a yes/no question about the leading direction in roughly half an hour of code. Good questions: "Can the API return X?", "Does this library do Y in the browser?", "Does the interaction feel right?". Before you start, tell the user the question and the plan and ask to go ahead. Then:
   - Build it outside the project, in `${CLAUDE_PLUGIN_DATA}/sandbox/<slug>-poc` unless the user names another place. A PoC never enters the project repo.
   - Keep it to the question. No tooling, no tests, no polish.
   - Record the question, what you ran and the answer. A "no" is a good result: it saved the later phases.

   If no question is worth a PoC, say so and skip it.

5. **Converge.** Ask the user to pick a direction or a combination. Then write down two lists with them:
   - **Not doing**: the good ideas you are saying no to, each with the reason. Focus is saying no to good ideas, and this list stops the analysis phase from reopening them.
   - **Assumptions to test**: what the direction bets is true, each with how to find out (a PoC, a conversation, a number to look up).

6. **Write `docs/<slug>/01-brainstorm.md`** from the template below. Leave out a section that has nothing in it.

## Template

```markdown
# <Name>: Brainstorm

Status: Direction chosen <YYYY-MM-DD>

## In your words

> <the user's own words, quoted, one quote per idea>

## Who has the problem

<who, what they do today, what hurts>

## References

- **<name or link>**: <what to take from it>

## How might we

<one question>

## Directions considered

### A: <name>

<pitch> · Borrows: <…> · Riskiest assumption: <…>
Value: <…> · Feasibility: <…> · Difference: <…>

### B: <name>

…

## Proof of concept

- **Question:** <yes/no question>
- **Where:** `<path>` (throwaway)
- **Answer:** <yes / no / partly, and what showed it>

## Chosen direction

<the direction, in two or three sentences, and why it won>

## Not doing

- <idea or direction>: <why not now>

## Assumptions to test

- [ ] <assumption>: <how to find out>

## Open for analysis

- <questions the analysis phase must answer>
```

## End of the run

End with three headings: **Blocked on me** (what only the user can answer), **Changed** (files written) and **Found** (anything surprising, such as a PoC answer). Then name the next step: `/analyze-problem <slug>`.

## Red flags

- A batch of questions in one message, or questions without your guess
- Directions that are variants of one idea, or none that surprised the user
- Agreeing with every idea: a partner who never says "this one is weak" is not helping
- A PoC that grew tooling, tests or a second question
- An empty Not doing list

## Review Checklist

- [ ] The user's words are quoted, not reworded
- [ ] Questions came one at a time, each with a guess
- [ ] 3 to 5 directions that differ in kind, at least one unusual, each with its riskiest assumption and a verdict
- [ ] PoC built outside the repo with the user's go-ahead, or skipped with a reason
- [ ] No frameworks, schemas or file paths in the file: those belong to later phases
- [ ] The direction is picked by the user. Not doing and Assumptions to test are filled
- [ ] Earlier initiatives' Next initiative, Later and Not doing items were read, and the relevant ones are quoted
- [ ] The file starts with its `Status:` line
- [ ] The run ends with Blocked on me / Changed / Found and the next command
