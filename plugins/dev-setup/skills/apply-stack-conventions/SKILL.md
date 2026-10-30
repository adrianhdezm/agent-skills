---
name: apply-stack-conventions
description: "Resolves which house TypeScript stack a project is or will be (a blueprint with its optional parts, or a combination composed from the docs that cover it), lists the architecture, technology, integration and example docs that apply, assembles its coding-conventions.md, and hands all of it to the calling skill. Use when bootstrap-project settles a combination, when another skill needs the stack and the docs for a project, or when a project's coding-conventions.md has to be assembled again."
---

# Apply Stack Conventions

Turns a project, or a combination of technologies, into its stack, the docs that apply and an assembled
`coding-conventions.md`, and hands them to the skill that asked. It does not build or change the project: the caller
reads the docs and does the work. `<skill-dir>` is this skill's base directory; every doc lives under
`<skill-dir>/references/`, and [references/catalog.md](references/catalog.md) lists them all.

## Stacks

| Stack                                       | Suits applications like                                                                                                                      | Runs on                                          | Data out of the box                                    | Optional (`--with`)                                                                | Blueprint                                                                  |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------ | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Node package                                | libraries, CLIs, scripts, scheduled jobs: nothing runs as a server                                                                           | Node 24, no build                                | none                                                   | —                                                                                  | [node-package.md](references/stacks/node-package.md)                       |
| Hono Worker                                 | JSON APIs, webhooks, small edge services with little or no relational data                                                                   | Cloudflare Workers                               | none                                                   | —                                                                                  | [hono-worker.md](references/stacks/hono-worker.md)                         |
| REST API on Node                            | an API several clients use (web, mobile, partners), over relational data, self-hosted                                                        | Express on Node, Postgres, Docker Compose        | Postgres through Drizzle, an `entity` CRUDL resource   | —                                                                                  | [node-api.md](references/stacks/node-api.md)                               |
| React Router on Workers                     | server-rendered web apps with forms and modest data per user, with nothing to operate: SaaS front ends, internal tools, content sites        | Cloudflare Workers                               | none                                                   | `database` (D1), `authentication`, `file-storage` (R2), `storybook`                | [react-router-cloudflare.md](references/stacks/react-router-cloudflare.md) |
| React Router on Node (the React full stack) | server-rendered web apps that own their data: loaders and actions are the backend, over relational data, with long-running work, self-hosted | Node, Postgres, Docker Compose                   | Postgres running, no data code                         | `database` (Drizzle), `authentication`, `file-storage` (S3 on RustFS), `storybook` | [react-router-docker.md](references/stacks/react-router-docker.md)         |
| Angular app                                 | single-page back-office front ends with many list, detail and form screens, over an API the project does not own                             | static files on Nginx                            | the API it calls                                       | `angular-fundamental-ngx` (SAP Fiori)                                              | [angular-app.md](references/stacks/angular-app.md)                         |
| Angular full stack                          | back-office apps that own their data and expose a REST API other clients can use too                                                         | Nginx, Express on Node, Postgres, Docker Compose | Postgres through Drizzle, an `entity` CRUDL end to end | `angular-fundamental-ngx` (SAP Fiori)                                              | [angular-fullstack.md](references/stacks/angular-fullstack.md)             |

Combinations without a blueprint are composed from the docs that cover their parts:

| Combination                       | Suits                                                  | Built from                                                                                                |
| --------------------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| A React app over its own REST API | the React full stack with an API other clients use too | React Router on Node for the app, REST API on Node for the API, the React Router + Drizzle rules left out |
| Angular on any static host        | the Angular app without containers                     | the Angular app blueprint, without Nginx and Docker Compose                                               |

## Workflow

1. **Resolve the stack.** From the combination the caller settled, or, for an existing project, from its root
   manifest(s), config files and its `coding-conventions.md` (its first paragraph names the stack). Match it to a row of
   the Stacks table, and pick the optional entries (`--with`) it has or asks for. A combination no blueprint covers is
   composed: match it to the second table, or name its parts from the "has it when it has" columns of the
   [catalog](references/catalog.md).

2. **List the docs.**

   - **With a blueprint**, read its **Composition** (the docs, keeping only the optional entries picked) and its
     **Examples**.
   - **Composed**, take the code style concept, the shared tooling (pnpm, TypeScript, ESLint, Prettier, Vitest), the
     architecture doc of each concept the project needs (a database, endpoints, sign-in, uploads) and the docs whose
     Realises line names it and fit the runtime, the technology doc of each technology, the integration doc of each
     pair that connects, and the examples whose Demonstrates table names those docs. Order them code style, pnpm,
     TypeScript, concepts, runtime and frameworks, integrations, tooling.
   - Name each technology the combination has that no doc covers as a gap.

3. **Assemble the conventions** into the scratchpad. The script fails on a missing section or a link that would not
   resolve in a project; a failure is a broken doc, reported under **Found**, not something to work around.

   ```sh
   # with a blueprint, a --with for each optional entry picked
   node <skill-dir>/scripts/assemble-conventions.mjs <skill-dir>/references/stacks/<stack>.md [--with <entry>]... > <scratchpad>/coding-conventions.md
   # composed, the docs from step 2 in their order
   node <skill-dir>/scripts/assemble-conventions.mjs --compose "<what it is>" <doc>... > <scratchpad>/coding-conventions.md
   ```

   For an existing project that has a `coding-conventions.md`, diff the two: a difference means one of them moved, and
   goes under **Found** for the user to decide.

4. **Hand off.** Return this block to the caller, with paths absolute so it can read each one:

   ```
   Stack: React Router on Node · with: database, authentication     (or: Composed: <what it is>)
   Blueprint: <skill-dir>/references/stacks/react-router-docker.md  (or: none)
   Docs: <path>, <path>, …                                           (in composition order)
   Examples: <path>, …
   Gaps: no doc for Fastify                                          (or: none)
   Conventions: <scratchpad>/coding-conventions.md
   Found: <a broken doc, a drift from the project's coding-conventions.md>   (or: none)
   ```

   Run without a calling skill, end with the same block.

## Review Checklist

- [ ] The stack matches a blueprint row, or the composition was built from the catalog and says so
- [ ] Only the optional entries the project has or asks for were picked
- [ ] Docs are in composition order; every technology without a doc is a gap
- [ ] `coding-conventions.md` was assembled by the script, and the script passed
- [ ] The hand-off block was returned with absolute paths
