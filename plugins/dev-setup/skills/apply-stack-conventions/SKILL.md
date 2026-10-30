---
name: apply-stack-conventions
description: "Owns the house TypeScript stacks. Recommends the stack that fits a project, resolves which one a project is or will be (a blueprint with its optional parts, or a combination composed from the docs that cover it), lists the architecture, technology, integration and example docs that apply, assembles its coding-conventions.md, and hands all of it to the calling skill. Use when bootstrap-project or design-solution needs a stack recommended or settled, when another skill needs the stack and the docs for a project, or when a project's coding-conventions.md has to be assembled again."
---

# Apply Stack Conventions

Turns a project, or a combination of technologies, into its stack, the docs that apply and an assembled
`coding-conventions.md`, and hands them to the skill that asked. It does not build or change the project: the caller
reads the docs and does the work. `<skill-dir>` is this skill's base directory; every doc lives under
`<skill-dir>/references/`, and [references/catalog.md](references/catalog.md) lists them all.

The two tables below are the one list of stacks. Other skills (`bootstrap-project`'s interview, `design-solution`) link
here rather than keep their own.

## Stacks

| Stack                                       | Suits applications like                                                                                                                          | Runs on                                          | Data out of the box                                    | Optional (`--with`)                                                                | Blueprint                                                                  |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------ | ------------------------------------------------------ | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Node package                                | libraries, CLIs, scripts, scheduled jobs: nothing runs as a server                                                                               | Node 24, no build                                | none                                                   | —                                                                                  | [node-package.md](references/stacks/node-package.md)                       |
| Hono Worker                                 | JSON APIs, webhooks, small edge services with little or no relational data                                                                       | Cloudflare Workers                               | none                                                   | —                                                                                  | [hono-worker.md](references/stacks/hono-worker.md)                         |
| REST API on Node                            | an API several clients use (web, mobile, partners), over relational data, self-hosted                                                            | Express on Node, Postgres, Docker Compose        | Postgres through Drizzle, an `entity` CRUDL resource   | —                                                                                  | [node-api.md](references/stacks/node-api.md)                               |
| React Router on Workers                     | server-rendered web apps with forms and modest data per user, nothing to operate, users anywhere: SaaS front ends, internal tools, content sites | Cloudflare Workers                               | none                                                   | `database` (D1), `authentication`, `file-storage` (R2), `storybook`                | [react-router-cloudflare.md](references/stacks/react-router-cloudflare.md) |
| React Router on Node (the React full stack) | server-rendered web apps that own their data: loaders and actions are the backend, over relational data, with long-running work, self-hosted     | Node, Postgres, Docker Compose                   | Postgres running, no data code                         | `database` (Drizzle), `authentication`, `file-storage` (S3 on RustFS), `storybook` | [react-router-docker.md](references/stacks/react-router-docker.md)         |
| Angular app                                 | single-page back-office front ends with many list, detail and form screens, over an API the project does not own                                 | static files on Nginx                            | the API it calls                                       | `angular-fundamental-ngx` (SAP Fiori)                                              | [angular-app.md](references/stacks/angular-app.md)                         |
| Angular full stack                          | back-office apps that own their data and expose a REST API other clients can use too                                                             | Nginx, Express on Node, Postgres, Docker Compose | Postgres through Drizzle, an `entity` CRUDL end to end | `angular-fundamental-ngx` (SAP Fiori)                                              | [angular-fullstack.md](references/stacks/angular-fullstack.md)             |

To recommend one, match what the project does to **Suits applications like** and give the reason in a sentence. When
two fit, recommend the one with fewer moving parts and say what would tip it the other way.

Combinations without a blueprint are composed from the docs that cover their parts. Say plainly that one has no
blueprint, and offer the nearest blueprint if it would do:

| Combination                               | Built from                                                                                                                                    | Nearest blueprint                                      |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| A React app over its own REST API         | React Router on Node for the app, REST API on Node for the API, the React Router + Drizzle rules left out                                     | React Router on Node alone: resource routes serve JSON |
| Angular on Workers or another static host | the Angular app blueprint, without Nginx and Docker Compose                                                                                   | React Router on Workers                                |
| A Hono API on Node, with Postgres         | Hono, Node, Drizzle, Postgres and Docker Compose with their pairs; the Express + Drizzle and Express + Docker Compose seams applied with Hono | REST API on Node                                       |
| A library no doc covers                   | the docs of the parts that have one, and that library's official docs (a gap)                                                                 | the blueprint the rest of the project matches          |

**Server code is Express or Hono.** A request for another server framework (Fastify, NestJS, Koa) is not composed:
say so, and offer the blueprint that fits with Express or Hono. Another language is out of scope: every doc here is
TypeScript.

## Workflow

1. **Resolve the stack.** From the combination the caller settled, or, for an existing project, from its root
   manifest(s), config files and its `coding-conventions.md` (its first paragraph names the stack). Match it to a row of
   the Stacks table, and pick the optional entries (`--with`) it has or asks for. A combination no blueprint covers is
   composed: match it to the second table, or name its parts from the "has it when it has" columns of the
   [catalog](references/catalog.md).

2. **List the docs.**
   - **With a blueprint**, the script reads them from its **Composition**, keeping only the optional entries picked,
     and its **Examples**.
   - **Composed**, take the code style concept, the shared tooling (pnpm, TypeScript, ESLint, Prettier, Vitest), the
     architecture doc of each concept the project needs (a database, endpoints, sign-in, uploads) and the docs whose
     Realises line names it and fit the runtime, the technology doc of each technology, the integration doc of each
     pair that connects, and the examples whose Demonstrates table names those docs. Order them code style, pnpm,
     TypeScript, concepts, runtime and frameworks, integrations, tooling. An integration whose other half was swapped
     for a technology the project uses instead (Express + Drizzle in a Hono API) is left out of the list, and its seam
     applied with the project's technology in its place; name each one so under **Found**.
   - Name each technology the combination has that no doc covers as a gap.

3. **Assemble the conventions** with one command, which writes `coding-conventions.md` and prints the hand-off block.
   `<scratchpad>` is the caller's scratch directory, or a new temporary one. The script fails on a missing section or a
   link that would not resolve in a project; a failure is a broken doc, reported under **Found**, not something to work
   around.

   ```sh
   # with a blueprint, a --with for each optional entry picked
   node <skill-dir>/scripts/assemble-conventions.mjs <skill-dir>/references/stacks/<stack>.md [--with <entry>]... --out <scratchpad>/coding-conventions.md
   # composed: a noun phrase for what it is, an --example for each example, then the docs from step 2 in their order
   node <skill-dir>/scripts/assemble-conventions.mjs --compose "<what it is>" [--example <example>]... --out <scratchpad>/coding-conventions.md <doc>...
   ```

   For an existing project that has a `coding-conventions.md`, diff the two: a difference means one of them moved, and
   goes under **Found** for the user to decide.

4. **Hand off.** Return the block the script printed, with the two lines only you can write added, to the caller:

   ```
   Stack: React Router on Node · with: database, authentication     (or: Composed: <what it is>)
   Blueprint: <skill-dir>/references/stacks/react-router-docker.md  (or: none)
   Docs: <path>, <path>, …                                           (absolute, in composition order)
   Examples: <path>, …
   Ports: Postgres 5432 (moved with `DB_PORT`), the app's `PORT` …   (the blueprint's ports row)
   Conventions: <scratchpad>/coding-conventions.md
   Gaps: no doc for <technology>                                     (or: none; added by you)
   Found: <a broken doc, a swapped integration, a drift from the project's coding-conventions.md>   (or: none; added by you)
   ```

   Run without a calling skill, end with the same block.

## Review Checklist

- [ ] The stack matches a blueprint row, or the composition was built from the catalog and says so
- [ ] Only the optional entries the project has or asks for were picked
- [ ] Docs are in composition order; every technology without a doc is a gap
- [ ] `coding-conventions.md` was assembled by the script with `--out`, and the script passed
- [ ] The hand-off block the script printed was returned, with Gaps and Found added
