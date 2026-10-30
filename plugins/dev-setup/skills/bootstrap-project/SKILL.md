---
name: bootstrap-project
description: Scaffolds a new TypeScript project from a combination settled in a short interview (what it ships, where it runs, which frontend), by building from the docs and examples the apply-stack-conventions skill hands back for that combination (each technology, each pair that connects, the starter examples), applying what exists and filling any gap with sensible defaults it reports. Seven combinations have blueprints (a Node library or CLI, a Hono API on Workers, an Express + Postgres REST API on Node, React Router on Workers or on Node with Postgres, an Angular app, an Angular + Express + Postgres monorepo); others are composed from the docs that cover their parts. Ends with coding-conventions.md assembled and every check and smoke test passing. Use when creating, bootstrapping, scaffolding, initialising or starting a new project or app, adding the standard tooling to an existing one, or when design-solution settles the stack.
---

# Bootstrap Project

One skill for every new project. A short interview settles the combination of technologies; the
`apply-stack-conventions` skill turns it into the stack, the docs and examples that apply, the gaps and an assembled
`coding-conventions.md`; this skill builds the project from that hand-off. It keeps no list of stacks or docs of its
own: a new stack, technology, integration or example is added there, and found here through the hand-off.

Apply what the docs say. Where no doc exists, build with sensible defaults and the technology's official docs, and
record the gap.

**Done means:** the combination and the docs it uses were stated, every check passes, the smoke test passes,
`coding-conventions.md` is assembled at the root, every gap is listed under **Found**, and the
[Review Checklist](#review-checklist) holds.

## Process

Copy this checklist and tick it off:

```
- [ ] 1. Combination settled
- [ ] 2. Hand-off received, its docs and examples read, gaps named
- [ ] 3. Toolchain and ports checked, target empty
- [ ] 4. Project built
- [ ] 5. Conventions placed, checks pass
- [ ] 6. Smoke test passed
```

1. **Settle the combination** with [references/interview.md](references/interview.md). Skip every question the request,
   the analysis or the calling skill already answers; ask the rest in one message, each with its default. When the user
   asks which stack fits, recommend one as the interview says. State the result in its one-line form.

2. **Get the docs and examples** by running the `apply-stack-conventions` skill with the combination, including each
   optional entry (database, authentication, file storage, Storybook, Fundamental NGX) the request asks for. Its
   hand-off names the stack, the blueprint, the docs and examples (absolute paths), the gaps and the assembled
   `coding-conventions.md`. Read the blueprint and every doc and example it lists, then quote its `Stack`, `Docs` (by
   title), `Examples` and `Gaps` lines before writing a file. A broken doc under its `Found` goes under this run's
   **Found**.

   Stop and ask only when a gap is a technology the user named and the choice changes the project's shape (which
   database, which framework); otherwise carry on.

3. **Check the toolchain**: Node 24+, pnpm 11+, git, and Docker where a doc uses it, plus every port on the hand-off's
   `Ports` line (for a composed combination, the ports its docs name): a port is free when
   `node -e "require('net').createServer().once('error', () => process.exit(1)).listen(<port>, () => process.exit(0))"`
   exits 0. If the target already holds a `package.json`, follow
   [Adding to an existing project](#adding-to-an-existing-project) instead.

4. **Build the project**, without asking, in this order unless the blueprint's Scaffold notes say otherwise:
   1. the directory and git, or the framework's CLI where its doc says the CLI creates the package;
   2. the manifest, as the pnpm doc says, with the blueprint's scripts (or the standard script names);
   3. `pnpm-workspace.yaml` with `allowBuilds` (the blueprint's, plus each doc's additions) before the first `pnpm add`;
   4. the dependencies each doc's Required values names, then the shared tooling, then TypeScript pinned as its doc
      says;
   5. the config files, from each doc's Required values and Reference code and the blueprint's Required values;
   6. any generated types the docs name (`wrangler types`, `react-router typegen`);
   7. each example, built by applying the docs it names in its Demonstrates table, with its data, behaviour and tests,
      until its Done when holds. A part the user replaced with their own (a module, routes, a resource) keeps the
      example's shape.

   Stop only when the toolchain is missing, a port is taken, a pitfall says to stop, or a check still fails after you
   have found its cause.

5. **Place the conventions**: copy the `coding-conventions.md` named on the hand-off's `Conventions` line to the
   project root, then run `pnpm format` and every check. Confirm what the checks miss: `private` is a boolean,
   `typescript` is exact, and nothing was emitted next to the sources.

6. **Run the smoke test**: the blueprint's, or, without one, start what the project ships and exercise each example's
   Done when against it.

Then offer to commit the scaffold on its own, so later diffs show only the feature.

## Adding to an existing project

Do not run `pnpm init` and do not overwrite anything. Settle only what the project is becoming that its files do not
show, and run the `apply-stack-conventions` skill on it as in step 2: it resolves the stack from the project's files and
reports where its `coding-conventions.md` has drifted from the docs. Then set the missing fields and scripts with
`pnpm pkg set` (ask before replacing a script, a `packageManager` or a Compose file), merge `allowBuilds`, install,
write each config the project lacks and merge the rest, saying what changed. Follow the blueprint's Scaffold notes for
existing projects where it has them. Delete any `*.js`, `*.d.ts` and `*.tsbuildinfo` an earlier `tsc -b` left next to
the sources, place the conventions, then format and check.

## End of the run

End with three headings: **Blocked on me** (a check that still fails, a port to free, a file the harness would not
write, a gap that needs the user's choice), **Changed** (the project path, the combination, the docs and examples used,
and what was created) and **Found**: each gap with what was used instead, and anything that differed from a doc (a moved
peer range, a new build script to allow), each naming the doc in `apply-stack-conventions` to add or update. When
another skill called this one, such as `design-solution`, hand these back to it instead.

## Review Checklist

- [ ] The combination, and the hand-off's docs, examples and gaps, were stated before the first file was written
- [ ] `allowBuilds` was written before the first `pnpm add`; `typescript` is an exact 6.0.x; `private` is a boolean;
      `packageManager` is set
- [ ] Config files follow the docs' and the blueprint's required values; reference code was written as given
- [ ] Each example's data, behaviour and tests hold, built by applying the docs it names
- [ ] `coding-conventions.md` is the one `apply-stack-conventions` assembled, not written by hand
- [ ] `pnpm format`, then every check, pass; nothing was emitted into the tree
- [ ] The smoke test passed
- [ ] The run ended with **Blocked on me**, **Changed** and **Found**, every gap under **Found**
