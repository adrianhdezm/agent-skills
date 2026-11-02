---
name: experiment-idea
description: Tests the chosen direction of a brainstorm before any requirements are written, by turning its riskiest assumptions into yes/no questions, building a throwaway prototype outside the project that answers them, with every external service behind an interface and a mock strategy so it runs without accounts, keys or network, and recording the answers in docs/<slug>/01-experiment.md. Use when the user runs /experiment-idea, or wants to prototype, validate or try out an idea after /brainstorm-idea and before /analyze-problem.
disable-model-invocation: true
---

# Experiment Idea

Between phases 1 and 2: brainstorm → **experiment** → analyze → design → implement → verify. Optional.

The brainstorm picked a direction and listed what it bets is true. This step checks the bets that code can check, while
a "no" is still cheap. It builds the smallest prototype that answers them, runs it, and writes down what it showed. The
prototype is evidence, not a first version: it never enters the project, and the design phase starts from the analysis,
not from this code.

**Done means:** each question the user agreed to has an answer (yes, no or partly) backed by something the prototype
showed, the prototype runs from one command in the sandbox, and `docs/<slug>/01-experiment.md` records the questions,
the answers, what each mock pretended and what changes for the analysis.

## When not to use

- No `docs/<slug>/01-brainstorm.md` with a chosen direction: run `/brainstorm-idea` first.
- Every assumption to test needs a conversation or a number to look up, not code: skip to `/analyze-problem`.
- The user wants the real thing built: that is `/analyze-problem` onwards.

## Workflow

```
- [ ] 1. Brainstorm read
- [ ] 2. Questions picked, each with what would mean yes
- [ ] 3. Plan agreed with the user
- [ ] 4. Prototype built in the sandbox
- [ ] 5. Questions answered by running it
- [ ] 6. 01-experiment.md written, brainstorm assumptions ticked
```

1. **Read the brainstorm.** Read `docs/<slug>/01-brainstorm.md`, in the repo or, before there is one, in
   `${CLAUDE_PLUGIN_DATA}/ideas/<slug>/` (see `brainstorm-idea`, Where the docs live). `docs/<slug>/` below means
   that folder. Read the **Chosen direction**, the **Assumptions to test**, the **Not doing** list and the references.
   If `01-experiment.md` already exists, read it and continue from it: add new questions, do not answer old ones again.

2. **Pick the questions.** Turn each assumption that code can check into a yes/no question about the chosen direction,
   and put the riskiest first: the one that, if false, sends the user back to the brainstorm. Good questions: "Can a
   guest claim a slot in under three taps?", "Does the API return opening hours for most places?", "Does matching on
   name alone find the right record?". For each one, write down before you build what result means yes and what means
   no. A question with no way to fail is not a question. Leave out assumptions that need a person or a number, and say
   so.

3. **Agree the plan.** Show the user, in one message:
   - the questions, in order, each with its yes and no;
   - what the prototype is: a page to click through when the question is about how it feels, a script or CLI when it
     is about data or an API;
   - whether it is minimal or scaffolded (below), and for a scaffold, which combination and why;
   - each external service it touches, and whether it is mocked or real (see below);
   - a time box (default: about two hours of code) and where it goes.

   Ask to go ahead. Drop or add questions as the user says.

4. **Build it** in `${CLAUDE_PLUGIN_DATA}/sandbox/<slug>-experiment`, unless the user names another place. It never
   enters the project repo. If the folder exists, ask before you reuse it. Then:
   - **Minimal, by default.** TypeScript that Node 24 runs directly (`node main.ts`), and a single HTML page served by
     `node:http` when there is something to click. Add a dependency only when a question is about that dependency.
   - **Scaffolded, only when a question depends on the stack**, such as "Does library X run on Workers?" or "Does
     this interaction feel right in a real React UI?". Run `bootstrap-project` into the experiment folder with the
     lightest combination that answers it, and leave out the database unless a question needs one. The stack stays a
     design decision: a scaffold here does not choose it for the project.
   - Put every external service behind a strategy (below). Fake the rest of the world with in-memory data seeded from
     the brainstorm's own examples.
   - No tests, linting, build step or styling beyond what a question needs, and none added to a scaffold. Hard-coded
     values are fine.
   - Write a short `README.md` there: the command to run it, the questions, and how to switch each strategy.

5. **Answer the questions.** Run the prototype and look at what it does. When a question is about how something feels,
   give the user the command or the URL, ask them to try it, and record what they say in their words. For each
   question, compare the result with the yes and no you wrote down. A "no" is a good result: it saved the later phases.
   On a "no" to the riskiest question, stop and offer to go back to `/brainstorm-idea` before answering the rest.

   If the time box runs out, stop and record what is answered and what is not. A prototype that keeps growing is
   answering a question nobody asked.

6. **Write `docs/<slug>/01-experiment.md`** from the template below, and leave out a section that has nothing in it.
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

## Questions

### Q1: <yes/no question>

- **From:** <the assumption in 01-brainstorm.md>
- **Yes if:** <result> · **No if:** <result>
- **Answer:** <yes / no / partly>, <what showed it: an output, a number, the user's words quoted>

### Q2: …

## Prototype

- **Where:** `<path>` (throwaway)
- **Run:** `<command>`
- **What it is:** <a page / a script, and what it does, in a sentence or two>

## Mocked services

- **<service>**: <what the mock pretends: shape, speed, limits, cost> · Switch: `<ENV>=real`

## What changes for the analysis

- <a refuted or partly true assumption, and what the analysis should do about it>

## Not answered

- <a question left open, and why: time box, needs a person, needs real data>
```

## End of the run

End with three headings: **Blocked on me**, **Changed** and **Found**. Under **Found**, put each answer that was not
"yes". Then name the next step: `/analyze-problem <slug>`, or `/brainstorm-idea <slug>` if the riskiest question came
back "no".

## Red flags

- Building before the user agreed the questions and the plan
- A question with no result that would mean "no"
- A vendor SDK called straight from the prototype's code instead of through its interface
- Keys, tokens or real customer data written into the prototype
- Tests, linting, a framework or styling nobody's question needs
- A scaffold when no question depends on the stack
- The prototype in the project repo, or code from it copied into the project
- A mock whose pretence is not written down

## Review Checklist

- [ ] Every question comes from an assumption in `01-brainstorm.md` and states its yes and no before the build
- [ ] The user agreed the questions, the services to mock, minimal or scaffolded, and the time box before the build
- [ ] The prototype lives outside the repo and runs from the command in its `README.md`
- [ ] Every external service sits behind one interface, with a mock strategy and a switch
- [ ] Every answer cites what showed it. The user's reactions are quoted, not reworded
- [ ] Each mock's pretence is listed under **Mocked services**
- [ ] Answered assumptions are ticked in `01-brainstorm.md`, and nothing else there changed
- [ ] The file starts with its `Status:` line
- [ ] The run ends with Blocked on me / Changed / Found and the next command
