---
name: brainstorm-idea
description: Opens a new initiative by interviewing the user about the idea, the product as they picture it, the stack it must live with, the references that inspire it and who it is for, proposing several deliberately different directions, and recording the chosen direction, the product concept and the stack constraints in 01-brainstorm.md, under docs/<slug>/ in the project's repo or, when there is no repo yet, in an idea folder in the plugin's data. Use when the user runs /brainstorm-idea, or has a raw idea they want to explore before any requirements exist.
disable-model-invocation: true
---

# Brainstorm Idea

Phase 1 of 6: **brainstorm** → experiment → analyze → design → implement → verify.

This phase widens before it narrows. Collect what the user has in mind, show them options they had not thought of, name what is most likely to kill the idea, and stop when they have picked a direction. Two things it keeps close to the user's own picture, because the experiment builds from them: the **product concept** (what using it looks like, as they expect to have it) and the **stack constraints** (where it must run and what it must use or avoid). Leave requirements, data models and the choice of frameworks to the later phases.

**Done means:** the user picked a direction, and `docs/<slug>/01-brainstorm.md` records it with the product concept, the stack constraints, the references, the directions considered, what we are not doing and the assumptions still to test.

## When not to use

- The user already knows exactly what to build and why: start at `/analyze-problem`.
- A bug fix or a small change to an existing feature.

## Where the docs live

Every phase writes into one folder per initiative, where `<slug>` names the initiative in kebab case (`v1`, `potluck`, `billing`). Each phase reads only the files of the phases before it, plus the repo, so work can stop and resume in a new session. Which folder depends on how the brainstorm starts:

- **In the project's repo:** the current directory is the repo the idea belongs to. Write into its `docs/<slug>/`.
- **With no repo yet:** there is none, or the current directory belongs to something else. Write into the idea folder, `${CLAUDE_PLUGIN_DATA}/ideas/<slug>/`. Do not create a repo or run `git init`: an idea can be dropped before it needs one, and the design phase finds or creates the repo and moves the folder into it.

If you cannot tell which case it is, ask, with the idea folder as the default. In this file and the next phases, `docs/<slug>/` means whichever of the two holds the initiative.

- If `01-brainstorm.md` exists in that folder, read it and continue from it instead of starting over. If the idea folder holds only `MOVED.md`, the initiative already lives in the repo it names: continue there.
- Tell the user the folder's full path. Anything they want the later phases to see (notes, briefs, screenshots, exports) goes in its `references/` folder.
- If earlier initiatives exist under the repo's `docs/`, read what they handed on: the **Next initiative** section of each
  `05-verification.md`, the **Later** list of each `02-analysis.md` and the **Not doing** list of each
  `01-brainstorm.md`. Offer the items that touch this idea as references, and quote them in the file. Do not reopen a
  Not doing item without saying so.

## Workflow

```
- [ ] 1. Docs folder and slug settled
- [ ] 2. Idea, people, references, concept and stack collected
- [ ] 3. Directions proposed
- [ ] 4. Direction picked
- [ ] 5. 01-brainstorm.md written
```

1. **Settle the folder and the slug** as above.

2. **Collect.** Start from what earlier initiatives handed on, if any (see above). Then ask the user to dump everything: the idea in their own words, who has the problem, what they do today, and references (products, links, screenshots, repos, half-remembered "like X but for Y"). Read or fetch every reference they give, and everything in `references/`. Copy a file they hand you into `references/`, so it travels with the docs. If one will not open, say so and ask for another way in: never describe a reference from its name alone. Quote the user's own words in the file. Do not reword them. Then interview:
   - Ask one question at a time, about the problem or the people, not the build. Attach your guess and why: the user corrects a wrong guess faster than they answer a blank question.
   - Listen for what the user thinks they should want: "scalable", "modern", "the way most apps do it". Then ask: "If you did not have to justify this to anyone, what would you want?"
   - Ask how they picture the product: the first moment someone uses it, the two or three screens, commands or moments that matter, and what it feels like when it works. This becomes the **Product concept**, in their terms, and the experiment builds it.
   - Ask where it must run and what it must use or avoid: a platform ("a web app on Cloudflare"), a language, an existing system to plug into, a budget, a device. Record only what the user states or must live with, each with their reason. Do not pick a framework for them: what nobody stated stays open, and the experiment proposes approaches within it.
   - Stop when you can predict their answer to your next three questions.

3. **Diverge.** Restate the idea as one "How might we …?" question. Then propose 3 to 5 directions that differ in kind, not in detail. These lenses help: invert the idea, remove a constraint (time, money, tech), serve a different user, combine it with a nearby idea, find the version that is ten times simpler, ask what an expert in the field finds obvious. Make at least one direction deliberately unusual. For each one give:
   - a one-line pitch,
   - what it takes from the references,
   - its riskiest assumption: the thing that, if false, makes the direction worthless,
   - a one-line verdict on value (who gains, how much), feasibility (the hardest part, within the stack constraints) and difference (why someone would switch).

   Be honest, not supportive. Say when a direction is weak and why. Ask the user to react, mix or add their own. Iterate while it is producing new ideas. Stop when it produces only variants.

4. **Converge.** Ask the user to pick a direction or a combination. Restate the product concept for that direction and let them correct it. Then write down two lists with them:
   - **Not doing**: the good ideas you are saying no to, each with the reason. Focus is saying no to good ideas, and this list stops the analysis phase from reopening them.
   - **Assumptions to test**: what the direction bets is true, each with how to find out (an experiment in code, a conversation, a number to look up). Put the riskiest first. Include what the direction bets about the stack ("Durable Objects can hold a potluck's live state"): the experiment tests those too.

5. **Write `docs/<slug>/01-brainstorm.md`** from the template below. Leave out a section that has nothing in it.

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

## Chosen direction

<the direction, in two or three sentences, and why it won>

## Product concept

<the product as the user pictures it, in their terms: who opens it, what they do from the first moment to the payoff,
and the two or three screens, commands or moments that matter. Quote them where you can.>

## Stack constraints

- **<constraint>**: <why, in the user's words> (such as "a web app on Cloudflare", "TypeScript only", "free tier")
- Open: <what the stack leaves undecided, for the experiment to try>

## Not doing

- <idea or direction>: <why not now>

## Assumptions to test

- [ ] <assumption>: <how to find out>

## Open for analysis

- <questions the analysis phase must answer>
```

## End of the run

End with three headings: **Blocked on me** (what only the user can answer), **Changed** (files written) and **Found** (anything surprising). Then name the next step: `/experiment-idea <slug>`.

## Red flags

- A batch of questions in one message, or questions without your guess
- Directions that are variants of one idea, or none that surprised the user
- Agreeing with every idea: a partner who never says "this one is weak" is not helping
- An empty Not doing list
- A framework you chose written down as a stack constraint, or a constraint with no reason from the user
- A repo created or `git init` run during the brainstorm

## Review Checklist

- [ ] The docs are in the repo's `docs/<slug>/`, or in the idea folder when there is no repo, and the user knows the path
- [ ] The user's words are quoted, not reworded
- [ ] Questions came one at a time, each with a guess
- [ ] 3 to 5 directions that differ in kind, at least one unusual, each with its riskiest assumption and a verdict
- [ ] The product concept is in the user's terms, and they corrected it for the chosen direction
- [ ] Stack constraints are only what the user stated or must live with, each with its reason. No framework you picked, no schemas, no file paths
- [ ] The direction is picked by the user. Not doing and Assumptions to test are filled
- [ ] Earlier initiatives' Next initiative, Later and Not doing items were read, and the relevant ones are quoted
- [ ] The file starts with its `Status:` line
- [ ] The run ends with Blocked on me / Changed / Found and the next command
