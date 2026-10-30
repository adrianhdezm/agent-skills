---
name: apply-stack-conventions
description: Holds the house conventions for TypeScript projects: the architecture of databases, data access, REST APIs, authentication, file storage and UI components, how each technology is used (pnpm, TypeScript, ESLint, Prettier, Vitest, Node, Docker Compose, Cloudflare Workers, Hono, React Router, Tailwind and shadcn/ui, Angular, NgRx, Fundamental NGX, Express, Drizzle), how they connect, worked examples, and the stacks they combine into. Use when writing, changing or reviewing code in a project built on them, when checking whether a project follows the conventions or how its pieces are wired, when explaining how two of these technologies connect, when adding a capability such as a database, an endpoint, login or uploads, or when bootstrap-project builds a stack.
---

# Apply Stack Conventions

The house way of building TypeScript projects, in five layers. An **architecture** doc says how a cross-cutting concept
(code style, a database, data access, a REST API, authentication, file storage, UI components) is done whatever the technology, and which docs realise it in
each stack. A **technology** doc says how one technology is used.
An **integration** doc says how two connect: where code from one calls into the other. An **example** says what a
worked case must show (its data, behaviour and tests) and which docs each part applies, so it is built from the docs,
never copied file by file. A **stack** blueprint names the concepts, technologies, integrations and examples a kind of project is
built from, its shape, its exact values and its own conventions. The same docs serve new projects (`bootstrap-project`
looks them up and builds from them), work in existing ones, and checks of how a project is wired.

`<skill-dir>`, wherever a doc uses it, is this skill's base directory.

## Stacks

| Stack                   | What it is                                                                                           | Blueprint                                                                  |
| ----------------------- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Node package            | a library, CLI or script that Node 24 runs as TypeScript, with no build                              | [node-package.md](references/stacks/node-package.md)                       |
| Hono Worker             | a Hono API on Cloudflare Workers, tested inside workerd                                              | [hono-worker.md](references/stacks/hono-worker.md)                         |
| React Router on Workers | a server-rendered React Router app whose server is a Hono Worker; Tailwind and shadcn/ui             | [react-router-cloudflare.md](references/stacks/react-router-cloudflare.md) |
| React Router on Node    | the same app on Node, run by Docker Compose next to Postgres                                         | [react-router-docker.md](references/stacks/react-router-docker.md)         |
| Angular app             | an Angular SPA with route-driven NgRx state, calling an existing API, served by Nginx                | [angular-app.md](references/stacks/angular-app.md)                         |
| Angular full stack      | that app plus an Express + Drizzle + Postgres API in a monorepo, Compose, a CRUDL example end to end | [angular-fullstack.md](references/stacks/angular-fullstack.md)             |

A blueprint has **Composition** (its docs, in the order their conventions are assembled), **Examples** (what a fresh
scaffold starts with), **Shape** (the files), **Required values** (scripts, ports, ignores and settings only this stack
fixes), **Scaffold** (only where building it departs from the usual order), **Conventions** (only what is specific to
the stack) and **Smoke test** (the live proof a fresh scaffold runs).

## Architecture

| Doc                                                         | Covers                                                                                            | The project needs it when it has    |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ----------------------------------- |
| [Code style](references/architecture/code-style.md)         | comments that explain why, named exports, small units, suppressions with reasons, absence handled | always                              |
| [Database](references/architecture/database.md)             | the engine per runtime, table design, migrations, connection, one database per environment        | a database                          |
| [Data access](references/architecture/data-access.md)       | one layer touches the database, DAOs on the context, ordered lists, domain errors                 | a database                          |
| [REST API](references/architecture/rest-api.md)             | resources and methods, status codes, one error body, edge validation, the list format             | JSON endpoints, or a client of them |
| [Authentication](references/architecture/authentication.md) | the library that owns sessions, protected layouts, ownership checks, safe redirects               | sign-in, or per-user data           |
| [File storage](references/architecture/file-storage.md)     | bytes in an object store, metadata in a table, one service keeping them in step                   | uploads or stored files             |
| [UI components](references/architecture/ui-components.md)   | two tiers of components, one-way imports, theme tokens, states, labels and accessible names       | screens                             |

Each has **Principles** (each with its reason), **Required values** (where the concept fixes exact values),
**Conventions** and **Verify it is wired**. A concept states only what holds whatever the technology; it
names no stack. The docs that carry it out say so in a **Realises** line under their title, and an example's
Demonstrates table names the concepts it shows, so which docs realise a concept is found by searching for its name.

## Technologies

| Doc                                                                 | Covers                                                                                    | The project uses it when it has         |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | --------------------------------------- |
| [pnpm](references/technologies/pnpm.md)                             | the manifest, `allowBuilds`, workspaces and the catalog, held-back versions               | `pnpm-workspace.yaml`, `packageManager` |
| [TypeScript](references/technologies/typescript.md)                 | one project per runtime, checking without emitting, the 6.0.x pin                         | `tsconfig*.json`                        |
| [ESLint](references/technologies/eslint.md)                         | flat config, type-checked rules, the shared rules, framework presets                      | `eslint.config.*`                       |
| [Prettier](references/technologies/prettier.md)                     | the shared config and the stacks' plugins                                                 | `.prettierrc`                           |
| [Vitest](references/technologies/vitest.md)                         | one config of named projects, picking an environment, how tests are written               | `vitest.config.*`                       |
| [Node](references/technologies/node.md)                             | running TypeScript as it is, `--env-file`, the dev loop                                   | `engines.node`, `node … .ts` scripts    |
| [Docker Compose](references/technologies/docker-compose.md)         | the Postgres service, images with Corepack, the root `.env`                               | `docker-compose.yml`                    |
| [Hono](references/technologies/hono.md)                             | the server entry every server stack's runtime drives                                      | `hono` in dependencies                  |
| [Cloudflare Workers](references/technologies/cloudflare-workers.md) | Wrangler, the compatibility date, the runtime types, secrets                              | `wrangler.jsonc`                        |
| [React Router](references/technologies/react-router.md)             | framework mode, the context, routes, route tests                                          | `react-router.config.ts`                |
| [Tailwind](references/technologies/tailwind.md)                     | utilities only, one global stylesheet with the theme, the build wiring per framework      | `tailwindcss` in dependencies           |
| [shadcn](references/technologies/shadcn.md)                         | the CLI, registries, `components.json` aliases and the `paths` they need                  | `components.json`                       |
| [Vite](references/technologies/vite.md)                             | one `vite.config.ts`, plugin order, aliases from `tsconfig` `paths`, client types         | `vite.config.ts`                        |
| [Storybook](references/technologies/storybook.md)                   | a story file beside every component, one story per state, on the app's Vite builder       | `.storybook/`                           |
| [Nginx](references/technologies/nginx.md)                           | static files with an SPA fallback and no proxy                                            | `nginx.conf`                            |
| [Angular](references/technologies/angular.md)                       | the CLI and its cleanup, signal components, the Analog tests, Storybook                   | `angular.json`                          |
| [NgRx](references/technologies/ngrx.md)                             | route-driven state and the request rules                                                  | `@ngrx/store` in dependencies           |
| [Express](references/technologies/express.md)                       | the app factory, controllers, the error shape, Pino                                       | `express` in dependencies               |
| [Postgres](references/technologies/postgres.md)                     | the pool, `DATABASE_URL`, column types, transactions, test containers                     | `pg` in dependencies                    |
| [Cloudflare D1](references/technologies/cloudflare-d1.md)           | the binding, a client per request, SQLite column types, `db.batch()`, Wrangler migrations | `d1_databases` in `wrangler.jsonc`      |
| [Drizzle](references/technologies/drizzle.md)                       | the client, migrations, the DAO layer and its typed list queries                          | `drizzle-orm`, `drizzle.config.ts`      |
| [Better Auth](references/technologies/better-auth.md)               | email and password over the Drizzle adapter, the splat route, sessions, secret            | `better-auth` in dependencies           |
| [Cloudflare R2](references/technologies/cloudflare-r2.md)           | the bucket binding, its generated type, what `put()` takes                                | `r2_buckets` in `wrangler.jsonc`        |
| [S3 storage](references/technologies/s3-storage.md)                 | the AWS SDK v3 client, the `S3_*` settings, RustFS in Compose                             | `@aws-sdk/client-s3` in dependencies    |

Each has **Use it like this** (the principles, each with its reason), **Required values** (what must be exact),
**Pitfalls** (failures met and how to avoid them), **Reference code** (only where an exact file is the safe way) and
**Conventions** (what goes into a project's `coding-conventions.md`), each only where it has something.

## Integrations

| Doc                                                                                 | The seam                                                                                  | The project has it when it has                     |
| ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------- |
| [Hono + React Router](references/integrations/hono-react-router.md)                 | one Hono handler builds the typed `appContext` and calls React Router                     | `hono` and `react-router`; `workers/app.ts`        |
| [Hono + Cloudflare Workers](references/integrations/hono-cloudflare-workers.md)     | the Hono app as the Worker, typed bindings, tests through `cloudflare:workers`            | `hono` and `wrangler.jsonc`                        |
| [Hono + Node](references/integrations/hono-node.md)                                 | `server.ts`: Vite middleware in development, `serveStatic` over the build                 | `@hono/node-server`; `server.ts`                   |
| [React Router + shadcn/ui](references/integrations/react-router-shadcn.md)          | Tailwind's Vite plugin, `components.json`, the shadcn primitives                          | `react-router` and `components.json`               |
| [React Router + Drizzle](references/integrations/react-router-drizzle.md)           | routes → services → queries → DAOs, the client on `appContext`                            | `react-router` and `drizzle-orm`                   |
| [Express + Drizzle](references/integrations/express-drizzle.md)                     | DAOs on the `AppContext`, list decoding, `NotFoundError` → 404                            | `express` and `drizzle-orm`                        |
| [Angular + the API contract](references/integrations/angular-api-contract.md)       | build-time base URL, mirrored models, one list format, one error body                     | `angular.json` and an `apiBaseUrl` in environments |
| [Angular + Fundamental NGX](references/integrations/angular-fundamental-ngx.md)     | the Fiori registry under `components/ui/`, its ignores, its pitfalls                      | `data-sap-theme` in `index.html`; `@angular/cdk`   |
| [Node + TypeScript](references/integrations/node-typescript.md)                     | TypeScript run as it is by Node, or compiled by `tsc`; `.ts` versus `.js` imports         | `node … .ts` scripts, or `tsc` to `dist/`          |
| [TypeScript + ESLint](references/integrations/typescript-eslint.md)                 | typed linting through the project service, the shared typed rules, the TypeScript ceiling | `typescript-eslint`                                |
| [ESLint + Prettier](references/integrations/eslint-prettier.md)                     | `eslint-config-prettier` and its placement; lint versus format checks                     | `eslint-config-prettier`                           |
| [React Router + ESLint](references/integrations/react-router-eslint.md)             | the React and accessibility presets, the routes and tests overrides, ESLint 9             | `react-router` and `eslint`                        |
| [React Router + Prettier](references/integrations/react-router-prettier.md)         | import and class sorting                                                                  | `react-router` and `.prettierrc`                   |
| [React Router + Vite](references/integrations/react-router-vite.md)                 | `reactRouter()` last, the `~/` alias, `vite/client`, `app/env.d.ts`                       | `@react-router/dev` and `vite.config.ts`           |
| [React Router + Vitest](references/integrations/react-router-vitest.md)             | route tests in browser mode through `createRoutesStub`                                    | `react-router` and `vitest`                        |
| [Angular + ESLint](references/integrations/angular-eslint.md)                       | angular-eslint presets, inline templates, selector prefixes                               | `angular-eslint`                                   |
| [Angular + Prettier](references/integrations/angular-prettier.md)                   | the Angular parser for HTML                                                               | `angular.json` and `.prettierrc`                   |
| [Angular + Vitest](references/integrations/angular-vitest.md)                       | Analog's builder, the `unit` and `browser` projects, `tsconfig.spec.json`                 | `@analogjs/vitest-angular`                         |
| [Angular + Tailwind](references/integrations/angular-tailwind.md)                   | PostCSS wiring, the layer imports, utilities plus a `host` class                          | `angular.json` and `.postcssrc.json`               |
| [Angular + Storybook](references/integrations/angular-storybook.md)                 | `@storybook/angular-vite` through Analog, `angular.json` targets, zoneless                | `@storybook/angular-vite`                          |
| [Angular + Nginx](references/integrations/angular-nginx.md)                         | `dist/<name>/browser` in the Nginx image, the router behind the SPA fallback              | `angular.json` and `nginx.conf`                    |
| [React Router + Storybook](references/integrations/react-router-storybook.md)       | `@storybook/react-vite` over the app's config without the React Router plugin             | `@storybook/react-vite`                            |
| [Cloudflare Workers + Vite](references/integrations/cloudflare-workers-vite.md)     | the Cloudflare Vite plugin: dev server and build in workerd, `vite preview`               | `@cloudflare/vite-plugin`                          |
| [Cloudflare Workers + Vitest](references/integrations/cloudflare-workers-vitest.md) | tests in workerd through `cloudflare:workers`                                             | `@cloudflare/vitest-plugin`                        |
| [Postgres + Docker Compose](references/integrations/postgres-docker-compose.md)     | the `db` service, its healthcheck, `init.sql`, host `db`                                  | a `db` service on a Postgres image                 |
| [Drizzle + Postgres](references/integrations/drizzle-postgres.md)                   | the client on the pool, the `postgresql` dialect, Testcontainers                          | `drizzle-orm` and `pg`                             |
| [Drizzle + Cloudflare D1](references/integrations/drizzle-d1.md)                    | a client per request, the `sqlite` dialect, `db.batch()`, tests in workerd                | `drizzle-orm` and `d1_databases`                   |
| [Better Auth + Drizzle](references/integrations/better-auth-drizzle.md)             | the auth tables in the schema, the adapter and its provider                               | `better-auth` and `drizzle-orm`                    |
| [Better Auth + React Router](references/integrations/better-auth-react-router.md)   | auth on `appContext`, the splat route, the protected layout, Conform forms                | `better-auth` and `react-router`                   |
| [S3 storage + Docker Compose](references/integrations/s3-storage-docker-compose.md) | RustFS as a Compose service                                                               | a `rustfs` service                                 |

Each has **The seam** (what calls what, as a diagram), **Where it lives** (the files to open), **Required values**,
**Pitfalls**, **Reference code**, **Conventions** and **Verify it is wired** (what a check confirms), each only where it
has something.

## Examples

| Example                                                       | What it must show                                                                 | Used by                  |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------ |
| [Node module](references/examples/node-module.md)             | one exported function, its test, the entry point that runs it                     | Node package             |
| [Hono hello](references/examples/hono-hello.md)               | one route answered by the Worker's real entry, tested in workerd                  | Hono Worker              |
| [React Router home](references/examples/react-router-home.md) | a loader reading a server value from the context, a shadcn primitive, route tests | both React Router stacks |
| [Entity CRUDL](references/examples/entity-crudl.md)           | one resource end to end: table, DAO, API, contract, slices, pages, tests, e2e     | both Angular stacks      |

Each has **Demonstrates** (each part and the docs it applies), **Data** or **The resource** (the values it depends on),
**Behaviour** (what it does, and the contracts tests rely on: routes, names, answers), **Tests** (the behaviours each
tier covers, and the files), **Variants** (short deltas) and **Done when**, each only where it has something.

**Done means:** the project's stack and the docs that apply were named before anything else, and the work, the check or
the explanation followed those docs; a check lists every drift with `file:line`, and an explanation maps each seam to
the project's own files.

## Workflow

1. **Identify the project.** Read its root manifest(s) and config files, and its `coding-conventions.md` when there is
   one: its first paragraph names the stack. Match the signals in the tables above to a stack. State it in one line,
   with the docs that apply, before anything else:

   ```
   Stack: React Router on Node · docs: React Router, Hono + React Router, Hono + Node, React Router + shadcn/ui, …
   ```

   A project no stack covers is a mix: name the technologies and integrations it has and say no blueprint applies.

2. **Load only what the task needs.** For a change in one area, the architecture doc of the concept it touches (a
   query, an endpoint, a protected page, an upload), the technology doc of that area, and every integration that names
   it; for a check or an explanation of the whole project, the blueprint and every doc in its Composition. Adding a
   capability a stack does not ship yet (login, uploads) starts from its architecture doc, then the docs whose Realises
   line names it and fit the stack's runtime; where none fits, fill the gap from the principles and the library's
   official docs, and say so.

3. **Then do one of three things:**
   - **Work in the project.** Follow the loaded docs' Required values and Conventions in every file you write. To add
     something an example already shows (a resource, a route), build it to the example's shape, with the project's own
     names and data. Where the task needs a change that breaks a convention, say so before writing it; if the user
     agrees, the change updates `coding-conventions.md` in the same commit. Where the project's own `coding-conventions.md` and a doc here differ,
     the project's file holds for the project, and the difference goes under **Found**.
   - **Check the project.** Compare the files against each loaded doc's Required values, Conventions and Verify it is
     wired. Do not fix anything. Also re-assemble the conventions into the scratchpad
     (`node <skill-dir>/scripts/assemble-conventions.mjs <skill-dir>/references/stacks/<stack>.md [--with <optional entry>] > <scratchpad>/coding-conventions.md`)
     with a `--with` for each optional entry the project has (the groups `database`,
     `authentication`, `file-storage`, `storybook`, or `angular-fundamental-ngx`), and diff it against the project's `coding-conventions.md`: a difference means one of the two moved, and the user
     decides which is right.
   - **Explain the wiring.** For each seam the question touches, walk the integration's diagram through the project's
     own files, with `file:line` at each hop, and say where the project departs from the doc.

Keep going while the next step needs nothing from the user. Stop only for a convention the task would break, or before
anything destructive or outside the repo.

## End of the run

End with three headings: **Blocked on me** (a convention the task would break, waiting for a yes; a question only the
user can answer), **Changed** (the files written, or "nothing" for a check or an explanation) and **Found**. For a
check, **Found** lists each drift, most serious first, as `file:line`, the doc and rule it breaks, and what the project
does instead; then one line on what matched. A difference between the project's `coding-conventions.md` and the
assembled one goes there too. When `bootstrap-project` called this skill, hand these back to it instead.

## Changing the conventions

- **A rule that holds whatever the technology goes in its architecture doc.** A fact about one technology goes in its
  technology doc. A fact about where code from one technology calls into another goes in that pair's integration doc,
  and nowhere else. A fact only one stack needs goes in its blueprint.
- **Knowledge flows one way**: architecture ← technologies ← integrations ← examples ← blueprints. A concept names no
  technology; a technology doc names no other technology that has a doc, and links only up to the concepts it realises
  (tools without a doc of their own, such as Vite or Storybook, belong to the doc that uses them; `pnpm`, `node` and
  `tsconfig` file names may appear in code as notation). Anything about two or more technologies is an integration, an
  example or a blueprint. `node <skill-dir>/scripts/check-knowledge-flow.mjs` checks it.
- **An example states outcomes, not files**: the data and names it depends on, the behaviour and contracts tests rely
  on, the behaviours each test tier covers, and the doc each part applies. A rule that any later code should follow
  belongs in a doc, not in an example; exact code belongs in a doc's Reference code.
- **A doc or example that carries out a concept says so**: a **Realises** line under a doc's title, the concept's name
  in an example's Demonstrates table. A concept never lists them back.
- **A new concept, technology, integration, example or stack** is a new file in its folder with the sections above, a row in the
  table here, and, for a doc, a line in the Composition of every blueprint that uses it (an example, a line in its
  Examples). Then run the assembly for every stack, which fails on a missing section or a link that would not resolve in a project,
  and the knowledge-flow check.

## Review Checklist

- [ ] The stack and the docs that apply were stated in one line before the work began
- [ ] Only the docs the task needed were loaded
- [ ] Work: every file written follows the loaded docs; a broken convention was agreed first and changed
      `coding-conventions.md` in the same commit
- [ ] Check: nothing was changed; every drift has `file:line`, its doc and rule; the assembled conventions were diffed
- [ ] Explain: each hop of each seam points at a file in the project
- [ ] The run ended with **Blocked on me**, **Changed** and **Found**
