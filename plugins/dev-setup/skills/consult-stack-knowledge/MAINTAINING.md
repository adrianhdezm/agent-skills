# Maintaining the knowledge base

How the docs under `references/` are laid out, how they form a graph, and how to change them. Agents running the skill
do not read this file.

## The four layers

An **architecture** doc says how a cross-cutting concept (code style, a database, data access, a REST API,
authentication, file storage, UI components, testing) is done whatever the technology. A **technology** doc says how one
technology is used. An **integration** doc says how two connect: where code from one calls into the other. A **stack**
blueprint names the concepts, technologies and integrations a kind of project is built from, its shape, its exact
values, what a fresh scaffold ships and its own conventions.

A blueprint has **Composition** (its docs, in the order their conventions are assembled), **Shape** (the files), **Required values** (scripts, ports, ignores and settings only this stack
fixes), **Reference code** (its tsconfigs, ESLint, Vite and Vitest configs exactly as a fresh scaffold writes them, and
the files only this stack has (the Angular full stack's Playwright suite), each checked by scaffolding the stack),
**Scaffold** (only where building it departs from the usual order), **Starter** (what a fresh scaffold ships so every
check has code to run against: its names, values, behaviours and tests), **Conventions** (only what is specific to the
stack) and **Smoke test** (the live proof a fresh scaffold runs, the Starter's included). The sections of the other layers are listed under
each table in [references/catalog.md](references/catalog.md).

**Composition** is read by `scripts/assemble-conventions.mjs`, so it holds only a bulleted list of links, one doc per
line, with no text around it. An entry the project may leave out ends in ` — optional`, picked with
`--with <file base name>`, or in ` — optional (<group>)`, picked with `--with <group>` for every entry of that group;
a group is a row's `Optional (--with)` entry in the Stacks table of `SKILL.md`.

**Starter** is what the scaffold builds by applying the docs, never copied file by file: values, behaviours and the
tests each tier holds, with the rules left to the docs they come from. A part only an optional group ships is a `### `
part whose heading says so, ``### Sign in, with `authentication` ``; the scripts list it only when that group is picked,
and `build-graph.mjs` checks that it names one of the stack's groups. A Starter shared by several stacks is written in
each, with only that stack's values (where a setting comes from, where its tests run).

The stacks are listed once, in the two tables under **Stacks** in `SKILL.md`: what each suits, how to choose, and the
combinations without a blueprint. `bootstrap-project`'s interview and `plan-release` link there, so adding or
changing a stack touches nothing outside this skill.

## The graph

Every doc starts with YAML frontmatter that states its edges, and `scripts/lib/graph.mjs` loads the docs into one graph
that `resolve-stack.mjs`, `dossier.mjs` and the checks read. The prose repeats some edges for readers (a doc's Realises
line, the catalog's rows, a blueprint's Composition, the Stacks table in `SKILL.md`); the frontmatter is
the source and `scripts/build-graph.mjs` fails when the two disagree. `references/graph.json` is the same graph written
out for reading and diffing: generated, committed, and checked for being current.

The frontmatter is a small YAML subset: `key: value`, `key: [a, b]` (lists nest), and one level of indented `key:`
maps. The fields by kind:

| Kind        | Fields                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| concept     | `always: true` on the one every project has (code style)                                                                                                                                                                                                                                                                                                                                                                                                 |
| technology  | `role` (`toolchain`, `runtime`, `framework`, `service`, `library`, `tooling`: the composition order), `realises` (concept ids, the same as its Realises line), `detect` (below), `aliases` (how its name appears in prose, for the knowledge-flow check: a word, or a literal such as `@angular/`), `family` (a technology whose vocabulary this doc may use: the Cloudflare products name Workers and Wrangler, NgRx names Angular)                     |
| integration | `connects` (the technologies it joins; a name with no doc is an external technology, known by name, detected through this doc, never listed), `realises`, `detect` (needed when it connects an external technology; otherwise both ends present means the seam is present), `unless` (technologies whose presence means the seam is not used: Hono + Drizzle and Cloudflare Workers + Vitest do not apply once React Router owns the data and the tests) |
| stack       | `technologies` (the required ones), `optional` (group → the technologies it adds; a group is a row's `Optional (--with)` entry), `requires` (group → the groups it needs: `authentication` needs `database`), `concepts` (concepts the stack is built around that none of its technologies realises: REST API for the Hono Worker)                                                                                                                       |

`detect` says how a project shows the technology: `files` (globs over paths, a trailing `/` for a directory),
`dependencies` (in any `package.json`, dependencies or devDependencies), `manifest` (key paths such as `engines.node`),
`scripts` (regexes over script values) and `fileContains` (`<file>=<needle>`, such as `wrangler.jsonc=d1_databases`).
A project is scanned three levels deep, skipping build output, so a workspace's packages count.

What a set of technologies brings (its **closure**) is: the always-on concepts, the concepts its technologies and
integrations realise, and every integration whose ends are all present and no `unless` rules out. A blueprint's
Composition must be exactly the closure of its technologies with every
group picked; an entry marked `— optional (<group>)` must be brought by that group and not by the stack alone; an entry
the stack lists unconditionally though only a group brings it (the React Router stacks list Database, Data access and
React Router + Drizzle ahead of the `database` group) is allowed, since the assembly keeps it. `resolve-stack.mjs` matches a project to a blueprint when every detected technology belongs to it and
whatever required technology is missing is toolchain or tooling.

## Changing the knowledge

- **A rule that holds whatever the technology goes in its architecture doc.** A fact about one technology goes in its
  technology doc. A fact about where code from one technology calls into another goes in that pair's integration doc,
  and nowhere else. A fact only one stack needs goes in its blueprint.
- **Knowledge flows one way**: architecture ← technologies ← integrations ← blueprints. A concept names no
  technology; a technology doc names no other technology that has a doc, and links only up to the concepts it realises
  (tools without a doc of their own, such as Vite or Storybook, belong to the doc that uses them; `pnpm`, `node` and
  `tsconfig` file names may appear in code as notation; test code in Reference code may import the test runner (Vitest)
  as notation). Anything about two or more technologies is an integration or a blueprint.
  `node scripts/check-knowledge-flow.mjs`, from this skill's directory, checks it, recognising each technology by its
  doc's `aliases`.
- **A Starter states outcomes, not files**: the data and names it depends on, the behaviour and contracts tests rely
  on, and the behaviours each test tier covers. A rule that any later code should follow belongs in a doc, not in a
  Starter; exact code belongs in a doc's Reference code.
- **A doc that carries out a concept says so** in a **Realises** line under its title. A concept never lists them back.
- **A new concept, technology, integration or stack** is a new file in its folder with its frontmatter and the
  sections above, a row in [references/catalog.md](references/catalog.md) (a stack, a row in the Stacks table of
  `SKILL.md`), and, for a doc, a line in the Composition of every blueprint whose technologies bring it;
  `build-graph.mjs` names each blueprint that lacks one. A technology's frontmatter carries its
  `detect` and `aliases`, so the scripts find it in a project and the knowledge-flow check sees its name. Then rebuild
  the graph, run the assembly for every stack, which fails on a missing section or a link that would not resolve in a
  project, and the knowledge-flow check, from this skill's directory:

  ```sh
  node scripts/build-graph.mjs
  for stack in references/stacks/*.md; do node scripts/assemble-conventions.mjs "$stack" > /dev/null || echo "broken: $stack"; done
  node scripts/check-knowledge-flow.mjs
  ```

  `node scripts/build-graph.mjs --check` runs the same checks without writing, and fails when `graph.json` is stale;
  run it before committing.
- **Where a file is claimed**: `dossier.mjs` answers from the "Where it lives" and "Layout" tables and the files a
  doc's Required values name. A doc that owns a file says so in one of those, and a file a doc stops owning leaves
  them.
