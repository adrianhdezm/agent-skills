# Maintaining the conventions

How the docs under `references/` are laid out and how to change them. Agents running the skill do not read this file.

## The five layers

An **architecture** doc says how a cross-cutting concept (code style, a database, data access, a REST API,
authentication, file storage, UI components) is done whatever the technology. A **technology** doc says how one
technology is used. An **integration** doc says how two connect: where code from one calls into the other. An
**example** says what a worked case must show (its data, behaviour and tests) and which docs each part applies, so it is
built from the docs, never copied file by file. A **stack** blueprint names the concepts, technologies, integrations and
examples a kind of project is built from, its shape, its exact values and its own conventions.

A blueprint has **Composition** (its docs, in the order their conventions are assembled), **Examples** (what a fresh
scaffold starts with), **Shape** (the files), **Required values** (scripts, ports, ignores and settings only this stack
fixes), **Reference code** (its tsconfigs, ESLint and Vitest configs exactly as a fresh scaffold writes them, each
checked by scaffolding the stack), **Scaffold** (only where building it departs from the usual order), **Conventions**
(only what is specific to the stack) and **Smoke test** (the live proof a fresh scaffold runs). The sections of the
other layers are listed under each table in [references/catalog.md](references/catalog.md).

**Composition** and **Examples** are read by `scripts/assemble-conventions.mjs`, so they hold only a bulleted list of
links, one doc per line, with no text around it. An entry the project may leave out ends in ` — optional`, picked with
`--with <file base name>`, or in ` — optional (<group>)`, picked with `--with <group>` for every entry of that group;
a group is a row's `Optional (--with)` entry in the Stacks table of `SKILL.md`. An example marked
` — optional (<group>)`, right after its link, is listed only when that group is picked.

The stacks are listed once, in the two tables under **Stacks** in `SKILL.md`: what each suits, how to choose, and the
combinations without a blueprint. `bootstrap-project`'s interview and `design-solution` link there, so adding or
changing a stack touches nothing outside this skill.

## Changing the conventions

- **A rule that holds whatever the technology goes in its architecture doc.** A fact about one technology goes in its
  technology doc. A fact about where code from one technology calls into another goes in that pair's integration doc,
  and nowhere else. A fact only one stack needs goes in its blueprint.
- **Knowledge flows one way**: architecture ← technologies ← integrations ← examples ← blueprints. A concept names no
  technology; a technology doc names no other technology that has a doc, and links only up to the concepts it realises
  (tools without a doc of their own, such as Vite or Storybook, belong to the doc that uses them; `pnpm`, `node` and
  `tsconfig` file names may appear in code as notation). Anything about two or more technologies is an integration, an
  example or a blueprint. `node scripts/check-knowledge-flow.mjs`, from this skill's directory, checks it.
- **An example states outcomes, not files**: the data and names it depends on, the behaviour and contracts tests rely
  on, the behaviours each test tier covers, and the doc each part applies. A rule that any later code should follow
  belongs in a doc, not in an example; exact code belongs in a doc's Reference code.
- **A doc or example that carries out a concept says so**: a **Realises** line under a doc's title, the concept's name
  in an example's Demonstrates table. A concept never lists them back.
- **A new concept, technology, integration, example or stack** is a new file in its folder with the sections above, a
  row in [references/catalog.md](references/catalog.md) (a stack, a row in the Stacks table of `SKILL.md`), and, for a
  doc, a line in the Composition of every blueprint that uses it (an example, a line in its Examples). Then run the
  assembly for every stack, which fails on a missing section or a link that would not resolve in a project, and the
  knowledge-flow check, from this skill's directory:

  ```sh
  for stack in references/stacks/*.md; do node scripts/assemble-conventions.mjs "$stack" > /dev/null || echo "broken: $stack"; done
  node scripts/check-knowledge-flow.mjs
  ```
