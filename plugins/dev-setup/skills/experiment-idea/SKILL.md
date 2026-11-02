---
name: experiment-idea
description: Validates the brainstormed idea before any requirements are written, by building a thin end-to-end version of the product concept in two or more design approaches that the stack constraints allow (such as two shapes of a web app on Cloudflare), throwaway and outside the project, with every external service behind an interface and a mock strategy so it runs without accounts, keys or network. It answers the riskiest assumptions as yes/no questions, compares the approaches, lets the user read and correct the code and records each correction (C1…), and writes docs/<slug>/01-experiment.md with the answers, the chosen approach and the corrections. Use when the user runs /experiment-idea, or wants to prototype, validate or compare approaches for an idea after /brainstorm-idea and before /analyze-problem.
disable-model-invocation: true
---

# Experiment Idea

Phase 2 of 6: brainstorm → **experiment** → analyze → design → implement → verify.

The brainstorm picked a direction, described the product as the user pictures it and named the stack it must live
with. This phase builds that product thinly from end to end, in two ways the stack allows, so the user can use it,
compare the approaches side by side and correct the code before anything becomes a requirement. Thin means the main
path works and everything around it is faked: no edge cases, no polish, no tests.

The prototypes are evidence, not a first version. They never enter the project repo, and no code is copied from them.
What carries forward is `01-experiment.md`: the answers, the approach the user picked and every correction they made.
The analysis turns behaviour corrections into requirements, and the design follows the chosen approach and the design
and convention corrections.

**Done means:** each approach runs the thin path from one command in the sandbox, each question the user agreed to has
an answer backed by what a prototype showed, the user read the code and every change they made or asked for is a
correction with its reason, the user picked an approach, and `docs/<slug>/01-experiment.md` records all of it.

## When not to use

- No `docs/<slug>/01-brainstorm.md` with a chosen direction: run `/brainstorm-idea` first.
- A change to a product that already runs, with nothing code could answer: skip to `/analyze-problem`.
- The user wants the real thing built: that is `/analyze-problem` onwards.

## Workflow

```
- [ ] 1. Brainstorm read
- [ ] 2. Thin path and questions picked, each question with what would mean yes
- [ ] 3. Approaches proposed
- [ ] 4. Plan agreed with the user
- [ ] 5. Each approach built in the sandbox, built state snapshotted
- [ ] 6. Questions answered and approaches compared by running them
- [ ] 7. User read and corrected the code; corrections recorded
- [ ] 8. Approach picked
- [ ] 9. 01-experiment.md written, brainstorm assumptions ticked
```

1. **Read the brainstorm.** Read `docs/<slug>/01-brainstorm.md`, in the repo or, before there is one, in
   `${CLAUDE_PLUGIN_DATA}/ideas/<slug>/` (see `brainstorm-idea`, Where the docs live). `docs/<slug>/` below means
   that folder. Read the **Chosen direction**, the **Product concept**, the **Stack constraints**, the **Assumptions to
   test**, the **Not doing** list and the references. If `01-experiment.md` already exists, read it and continue from
   it: add new questions and corrections, do not answer old ones again, and keep the C numbers.

2. **Pick the thin path and the questions.**
   - **The thin path** is the shortest walk through the product concept that shows the idea working end to end: "a
     host creates a potluck, a guest claims a slot, the host sees who brings what". Three to six steps. Everything off
     the path is a stub or a hard-coded value.
   - **The questions.** Turn each assumption that code can check into a yes/no question about the chosen direction,
     and put the riskiest first: the one that, if false, sends the user back to the brainstorm. Good questions: "Can a
     guest claim a slot in under three taps?", "Does the API return opening hours for most places?", "Does matching on
     name alone find the right record?". For each one, write down before you build what result means yes and what means
     no. A question with no way to fail is not a question. Leave out assumptions that need a person or a number, and say
     so.

3. **Propose the approaches.** Two by default, a third only when the user asks. They differ in shape, within the stack
   constraints: where state lives, what renders the UI, how the parts talk. Not two libraries that do the same job. For
   "a web app on Cloudflare", for example: a server-rendered Hono Worker over D1, or a React Router app with a Durable
   Object holding each potluck's live state. For each approach give:
   - a one-line shape, and the stack combination it uses (from the
     [Stacks section of `apply-stack-conventions`](../apply-stack-conventions/SKILL.md#stacks) where one fits);
   - what it is good at and what it risks;
   - which questions it should answer better.

   Then name how they will be compared: the questions, plus how the code reads, how much code the thin path took, and
   the platform's limits and cost for this idea. If the constraints leave one sensible shape, say why and build one.

4. **Agree the plan.** Show the user, in one message:
   - the thin path, step by step;
   - the questions, in order, each with its yes and no;
   - the approaches, and how each is built (below);
   - each external service it touches, and whether it is mocked or real (see below);
   - a time box (default: about two hours of code per approach) and where it goes.

   Ask to go ahead. Drop or add questions and approaches as the user says.

5. **Build each approach** in `${CLAUDE_PLUGIN_DATA}/sandbox/<slug>-experiment/<approach>/` (such as `a-worker-d1`,
   `b-durable-object`), unless the user names another place. It never enters the project repo. If the folder exists,
   ask before you reuse it. Then:
   - **On the constrained stack.** When the constraints name a platform or a framework, run `bootstrap-project` into the
     approach's folder with the lightest combination that has that shape, and leave out what the approach does not use
     (a database, auth). When they name none, use TypeScript that Node 24 runs directly (`node main.ts`), and a single
     HTML page served by `node:http` when there is something to click. Add a dependency only when the approach or a
     question is about it. A scaffold here does not choose the stack for the project: the design does.
   - **The same thin path, seed data and mocks in each approach**, so a difference between them is the approach, not
     the data.
   - Put every external service behind a strategy (below). Fake the rest of the world with in-memory data seeded from
     the brainstorm's own examples.
   - No tests, linting, build step or styling beyond what a question needs, and none added to a scaffold. Hard-coded
     values are fine. Write the code plainly enough for the user to read and change it.
   - Write a short `README.md` in `<slug>-experiment/`: the command to run each approach, the thin path, the questions,
     and how to switch each strategy.
   - **Snapshot the built state** so the user's edits show as a diff: `git init` inside `<slug>-experiment/` (the
     sandbox only, never the project, never pushed) and commit everything as `built`.

6. **Answer the questions and compare.** Run each approach and walk the thin path. When a question is about how
   something feels, give the user the command or the URL, ask them to try it, and record what they say in their words.
   For each question and approach, compare the result with the yes and no you wrote down. A "no" is a good result: it
   saved the later phases. On a "no" to the riskiest question in every approach, stop and offer to go back to
   `/brainstorm-idea` before going on.

   If the time box runs out, stop and record what is answered and what is not. A prototype that keeps growing is
   answering a question nobody asked.

7. **Hand the code over for correction.** Give the user each approach's path and ask them to read it and change what
   they would do differently: a name, the structure, where a check runs, the data shape, a step of the flow. They can
   edit the files or tell you what to change; when they tell you, make the change. Wait until they say they are done.
   Then, with `git diff` against the snapshot, record each change as a correction:
   - **C1, C2, …** in the order found, with the approach, the `path`, what changed and why. Ask for the reason when
     the change does not show it, and quote their words. Several edits with one reason are one correction.
   - Its kind: **behaviour** (what a person can do or see changes; the analysis takes it), **design** (how the
     product is built; the design follows it) or **convention** (how code is written; the design adds it to the
     project's conventions).

   Commit the corrected state as `corrected`, so a second round diffs only new edits. If the user does not want to
   read the code, write "No corrections: not reviewed" and go on.

8. **Pick the approach.** Show the comparison: each question's answer per approach, plus the other criteria from step
   3. Recommend one with the reason, and ask the user to pick one or a combination. A correction can decide it: say
   so when it does.

9. **Write `docs/<slug>/01-experiment.md`** from the template below, and leave out a section that has nothing in it.
   Then tick each assumption in `01-brainstorm.md` that the experiment answered, and add the answer and
   `(01-experiment.md)` to its line. Do not change anything else in that file.

## External services as strategies

Each external service the idea depends on (payments, email, maps, an LLM, auth, a partner API) gets one interface
named for what the idea needs from it, not for the vendor, plus one implementation per strategy. One place picks the
strategy from an environment variable, so the rest of the prototype never knows which one runs.

```ts
// services.ts
export interface PlaceSearch {
  near(lat: number, lng: number): Promise<Place[]>;
}

class MockPlaceSearch implements PlaceSearch {
  constructor(private places: Place[], private delayMs = 300, private failRate = 0) {}
  async near() {
    await new Promise((r) => setTimeout(r, this.delayMs));
    if (Math.random() < this.failRate) throw new Error("place search unavailable");
    return this.places;
  }
}

class RealPlaceSearch implements PlaceSearch {
  async near(lat: number, lng: number) {
    const res = await fetch(`https://…?lat=${lat}&lng=${lng}`, { headers: { key: process.env.PLACES_KEY! } });
    return (await res.json()).results;
  }
}

export const placeSearch: PlaceSearch =
  process.env.PLACES === "real" ? new RealPlaceSearch() : new MockPlaceSearch(seedPlaces);
```

- **Mock by default.** The mock returns data shaped like the real service, seeded with realistic cases, including the
  awkward ones (empty results, a slow answer, an error). Make latency and failure settable, so "what if it is slow?"
  is a flag, not new code.
- **Real only when the question is about the service.** "Does the API return X?" needs the real call. Then the real
  strategy is the experiment, and the keys come from the user's environment, never from a file in the prototype.
- **A mock is an assumption.** Each mock pretends the real service behaves a certain way: the shape of its answer, its
  speed, its limits, its price. Write each pretence down. It goes into the experiment file, so the analysis treats it
  as untested.

## Template

```markdown
# <Name>: Experiment

Status: Done <YYYY-MM-DD>

## Thin path

1. <step of the product concept the prototypes walk>
2. …

## Approaches

### A: <name>

<one-line shape> · Stack: <combination> · Where: `<path>` · Run: `<command>`

### B: <name>

…

## Questions

### Q1: <yes/no question>

- **From:** <the assumption in 01-brainstorm.md>
- **Yes if:** <result> · **No if:** <result>
- **A:** <yes / no / partly>, <what showed it: an output, a number, the user's words quoted>
- **B:** <yes / no / partly>, <what showed it>

### Q2: …

## Comparison

| | A: <name> | B: <name> |
| --- | --- | --- |
| Q1 | yes | partly |
| Code for the thin path | <files, lines> | <files, lines> |
| How it reads | <the user's words> | <the user's words> |
| Platform limits and cost | <…> | <…> |

## Chosen approach

<A, B or a combination, in two or three sentences, and why: the answers, the comparison and any correction that
decided it>

## Corrections

- **C1** · design · A `src/routes/claims.ts`: <what changed>. "<the user's reason, quoted>"
- **C2** · behaviour · B `app/claim.tsx`: <what changed>. "<reason>"
- **C3** · convention · both: <what changed>. "<reason>"

## Mocked services

- **<service>**: <what the mock pretends: shape, speed, limits, cost> · Switch: `<ENV>=real`

## What changes for the analysis

- <a refuted or partly true assumption, or a behaviour correction, and what the analysis should do about it>

## What the design must keep

- <the chosen approach's shape, and each design and convention correction by its C number>

## Not answered

- <a question left open, and why: time box, needs a person, needs real data>
```

## End of the run

End with three headings: **Blocked on me**, **Changed** and **Found**. Under **Found**, put each answer that was not
"yes" and each correction that surprised you. Then name the next step: `/analyze-problem <slug>`, or
`/brainstorm-idea <slug>` if the riskiest question came back "no" in every approach.

## Red flags

- Building before the user agreed the thin path, the questions, the approaches and the plan
- A question with no result that would mean "no"
- Two approaches that differ only in a library, not in shape
- An approach outside the stack constraints the user stated
- Details off the thin path: edge cases, settings pages, polish
- A vendor SDK called straight from the prototype's code instead of through its interface
- Keys, tokens or real customer data written into the prototype
- Tests, linting, a framework or styling nobody's question or approach needs
- A user's edit with no correction, or a correction with a reason you made up
- The prototype in the project repo, or code from it copied into the project
- A mock whose pretence is not written down

## Review Checklist

- [ ] The thin path comes from the brainstorm's Product concept, and every question from its Assumptions to test,
      with its yes and no stated before the build
- [ ] Two approaches (or one, with the reason) that differ in shape and stay within the Stack constraints
- [ ] The user agreed the thin path, the questions, the approaches, the services to mock and the time box before the
      build
- [ ] The prototypes live outside the repo, share seed data and mocks, and run from the commands in the README
- [ ] Every external service sits behind one interface, with a mock strategy and a switch
- [ ] Every answer cites what showed it, per approach. The user's reactions are quoted, not reworded
- [ ] The user was handed the code. Every change since the `built` snapshot is a correction with its kind and the
      user's reason
- [ ] The user picked the approach, and the comparison behind it is in the file
- [ ] Each mock's pretence is listed under **Mocked services**
- [ ] Answered assumptions are ticked in `01-brainstorm.md`, and nothing else there changed
- [ ] The file starts with its `Status:` line
- [ ] The run ends with Blocked on me / Changed / Found and the next command
