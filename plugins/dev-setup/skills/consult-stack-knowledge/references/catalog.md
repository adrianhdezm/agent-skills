---
type: Catalog
title: Catalog
description: Every concept, technology and integration, with what it covers and how a project shows it has one, and where a new fact belongs
---
# Catalog

Every concept, technology and integration, with what it covers and how a project shows it has one. Read it to find the
doc a task needs, to name the parts of a project no stack covers, or to find where a new fact belongs:

- **A rule that holds whatever the technology** goes in its architecture doc.
- **A fact about one technology** goes in its technology doc.
- **A fact about where code from one technology calls into another** goes in that pair's integration doc, and nowhere
  else.
- **A fact only one stack needs** goes in its blueprint.

Knowledge flows one way, architecture ← technologies ← integrations ← blueprints: a doc names nothing from a layer to
its right. After any change, `node scripts/check.mjs` from the skill's directory reports what else has to change (a
catalog row, a Composition line, a Realises line, a description, a quoted frontmatter value); run it with `--check`
before committing.

## Contents

- [Architecture](#architecture)
- [Technologies](#technologies)
- [Integrations](#integrations)
- [Blueprints](#blueprints)
- [Frontmatter](#frontmatter)

## Architecture

| Doc                                                        | Covers                                                                                                                 | The project needs it when it has                  |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| [Code style](architecture/code-style.md)                   | comments that explain why, named exports, small units, suppressions with reasons, absence handled                      | always                                            |
| [Database](architecture/database.md)                       | the engine per runtime, table design, migrations, connection, one database per environment                             | a database                                        |
| [Data access](architecture/data-access.md)                 | one layer touches the database, DAOs on the context, ordered lists, domain errors                                      | a database                                        |
| [REST API](architecture/rest-api.md)                       | resources and methods, status codes, one error body, edge validation, the list format                                  | JSON endpoints, or a client of them               |
| [Resource operations](architecture/resource-operations.md) | the five operations, one list contract, list state in the URL, one form, confirmed delete, copying the first resource  | records users list, read, create, edit and delete |
| [Authentication](architecture/authentication.md)           | the library that owns sessions, protected routes, safe redirects, sign-out                                             | sign-in, or per-user data                         |
| [Authorization](architecture/authorization.md)             | ownership by default, checked where loaded, lists filtered in the query, 404 for another's, 403 for a forbidden action | sign-in with per-user data                        |
| [File storage](architecture/file-storage.md)               | bytes in an object store, metadata in a table, one service keeping them in step                                        | uploads or stored files                           |
| [UI components](architecture/ui-components.md)             | two tiers of components, one-way imports, theme tokens, states, labels and accessible names                            | screens                                           |
| [Testing](architecture/testing.md)                         | tiers by what is real, each behaviour once at the cheapest tier, behaviour-named cases, owned data                     | tests                                             |

Each has **Principles** (each with its reason), **Required values** (where the concept fixes exact values),
**Conventions** and **Verify it is wired**. A concept states only what holds whatever the technology; it
names no stack. The docs that carry it out say so in a **Realises** line under their title, and a concept never lists
them back, so which docs realise a concept is found by searching for its name.

## Technologies

| Doc                                                      | Covers                                                                                    | The project uses it when it has         |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------- | --------------------------------------- |
| [pnpm](technologies/pnpm.md)                             | the manifest, `allowBuilds`, workspaces and the catalog, held-back versions               | `pnpm-workspace.yaml`, `packageManager` |
| [TypeScript](technologies/typescript.md)                 | one project per runtime, checking without emitting, the 6.0.x pin                         | `tsconfig*.json`                        |
| [ESLint](technologies/eslint.md)                         | flat config, type-checked rules, the shared rules, framework presets                      | `eslint.config.*`                       |
| [Prettier](technologies/prettier.md)                     | the shared config and the stacks' plugins                                                 | `.prettierrc`                           |
| [Vitest](technologies/vitest.md)                         | one config of named projects, picking an environment, how tests are written               | `vitest.config.*`                       |
| [Node](technologies/node.md)                             | running TypeScript as it is, `--env-file`, the dev loop                                   | `engines.node`, `node … .ts` scripts    |
| [Docker Compose](technologies/docker-compose.md)         | two-stage images, healthchecked services, the root `.env`                                 | `docker-compose.yml`                    |
| [Hono](technologies/hono.md)                             | the server entry every server stack's runtime drives                                      | `hono` in dependencies                  |
| [Cloudflare Workers](technologies/cloudflare-workers.md) | Wrangler, the compatibility date, the runtime types, secrets                              | `wrangler.jsonc`                        |
| [React Router](technologies/react-router.md)             | framework mode, the context, routes, route tests                                          | `react-router.config.ts`                |
| [Tailwind](technologies/tailwind.md)                     | utilities only, one global stylesheet with the theme, the build wiring per framework      | `tailwindcss` in dependencies           |
| [shadcn](technologies/shadcn.md)                         | the CLI, registries, `components.json` aliases and the `paths` they need                  | `components.json`                       |
| [Vite](technologies/vite.md)                             | one `vite.config.ts`, plugin order, aliases from `tsconfig` `paths`, client types         | `vite.config.ts`                        |
| [Storybook](technologies/storybook.md)                   | a story file beside every component, one story per state, on the app's Vite builder       | `.storybook/`                           |
| [Nginx](technologies/nginx.md)                           | static files with an SPA fallback and no proxy                                            | `nginx.conf`                            |
| [Angular](technologies/angular.md)                       | the CLI and its cleanup, signal components, two tiers of tests, a static build            | `angular.json`                          |
| [NgRx](technologies/ngrx.md)                             | route-driven state and the request rules                                                  | `@ngrx/store` in dependencies           |
| [Express](technologies/express.md)                       | the app factory, controllers, the error shape                                             | `express` in dependencies               |
| [Pino](technologies/pino.md)                             | one JSON logger, `LOG_LEVEL`, errors as `{ err }`, `pino-pretty` as a dev pipe only       | `pino` in dependencies                  |
| [Postgres](technologies/postgres.md)                     | the pool, `DATABASE_URL`, column types, transactions, test containers                     | `pg` in dependencies                    |
| [Cloudflare D1](technologies/cloudflare-d1.md)           | the binding, a client per request, SQLite column types, `db.batch()`, Wrangler migrations | `d1_databases` in `wrangler.jsonc`      |
| [Drizzle](technologies/drizzle.md)                       | the client, migrations, the DAO layer and its typed list queries                          | `drizzle-orm`, `drizzle.config.ts`      |
| [Better Auth](technologies/better-auth.md)               | email and password over the Drizzle adapter, the splat route, sessions, secret            | `better-auth` in dependencies           |
| [Cloudflare R2](technologies/cloudflare-r2.md)           | the bucket binding, its generated type, what `put()` takes                                | `r2_buckets` in `wrangler.jsonc`        |
| [S3 storage](technologies/s3-storage.md)                 | the AWS SDK v3 client, the `S3_*` settings, RustFS in Compose                             | `@aws-sdk/client-s3` in dependencies    |

Each has **Use it like this** (the principles, each with its reason), **Required values** (what must be exact),
**Pitfalls** (failures met and how to avoid them), **Reference code** (only where an exact file is the safe way) and
**Conventions** (what goes into a project's `coding-conventions.md`), each only where it has something.

## Integrations

| Doc                                                                          | The seam                                                                                       | The project has it when it has                     |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| [Hono + React Router](integrations/hono-react-router.md)                     | one Hono handler builds the typed `appContext` and calls React Router                          | `hono` and `react-router`; `workers/app.ts`        |
| [Hono + Cloudflare Workers](integrations/hono-cloudflare-workers.md)         | the Hono app as the Worker, typed bindings, tests through `cloudflare:workers`                 | `hono` and `wrangler.jsonc`                        |
| [Hono + Node](integrations/hono-node.md)                                     | `server.ts`: Vite middleware in development, `serveStatic` over the build                      | `@hono/node-server`; `server.ts`                   |
| [React Router + Tailwind](integrations/react-router-tailwind.md)             | Tailwind's Vite plugin and its order, `app/app.css` with the theme tokens, the test setup      | `react-router` and `@tailwindcss/vite`             |
| [React Router + shadcn/ui](integrations/react-router-shadcn.md)              | `components.json`, the aliases, the shadcn primitives, `cn`                                    | `react-router` and `components.json`               |
| [React Router + Drizzle](integrations/react-router-drizzle.md)               | routes → services → queries → DAOs, the client on `appContext`                                 | `react-router` and `drizzle-orm`                   |
| [Express + Drizzle](integrations/express-drizzle.md)                         | DAOs on the `AppContext`, list decoding, `NotFoundError` → 404                                 | `express` and `drizzle-orm`                        |
| [Express + Pino](integrations/express-pino.md)                               | `pino-http` first, `req.log` per request, errors logged once by the error handler              | `express` and `pino-http`                          |
| [Hono + Drizzle](integrations/hono-drizzle.md)                               | DAOs on `c.var.context`, list decoding, `NotFoundError` → a 404 `HTTPException`, one `onError` | `hono` and `drizzle-orm`                           |
| [Hono + Pino](integrations/hono-pino.md)                                     | a `requestLog` middleware on the shared logger, errors logged once by `onError`                | `hono` and `pino`                                  |
| [Angular + the API contract](integrations/angular-api-contract.md)           | build-time base URL, mirrored models, one list format, one error body                          | `angular.json` and an `apiBaseUrl` in environments |
| [Angular + Fundamental NGX](integrations/angular-fundamental-ngx.md)         | the Fiori registry under `components/ui/`, its ignores, its pitfalls                           | `data-sap-theme` in `index.html`; `@angular/cdk`   |
| [Node + TypeScript](integrations/node-typescript.md)                         | TypeScript run as it is by Node, or compiled by `tsc`; `.ts` versus `.js` imports              | `node … .ts` scripts, or `tsc` to `dist/`          |
| [TypeScript + ESLint](integrations/typescript-eslint.md)                     | typed linting through the project service, the shared typed rules, the TypeScript ceiling      | `typescript-eslint`                                |
| [ESLint + Prettier](integrations/eslint-prettier.md)                         | `eslint-config-prettier` and its placement; lint versus format checks                          | `eslint-config-prettier`                           |
| [React Router + ESLint](integrations/react-router-eslint.md)                 | the React and accessibility presets, the routes and tests overrides, ESLint 9                  | `react-router` and `eslint`                        |
| [React Router + Prettier](integrations/react-router-prettier.md)             | import and class sorting                                                                       | `react-router` and `.prettierrc`                   |
| [React Router + Vite](integrations/react-router-vite.md)                     | `reactRouter()` last, the `~/` alias, `vite/client`, `app/env.d.ts`                            | `@react-router/dev` and `vite.config.ts`           |
| [React Router + Vitest](integrations/react-router-vitest.md)                 | route tests in browser mode through `createRoutesStub`                                         | `react-router` and `vitest`                        |
| [Angular + ESLint](integrations/angular-eslint.md)                           | angular-eslint presets, inline templates, selector prefixes                                    | `angular-eslint`                                   |
| [Angular + Prettier](integrations/angular-prettier.md)                       | the Angular parser for HTML                                                                    | `angular.json` and `.prettierrc`                   |
| [Angular + Vitest](integrations/angular-vitest.md)                           | Analog's builder, the `unit` and `browser` projects, `tsconfig.spec.json`                      | `@analogjs/vitest-angular`                         |
| [Angular + Tailwind](integrations/angular-tailwind.md)                       | PostCSS wiring, the layer imports, utilities plus a `host` class                               | `angular.json` and `.postcssrc.json`               |
| [Angular + Storybook](integrations/angular-storybook.md)                     | `@storybook/angular-vite` through Analog, `angular.json` targets, zoneless                     | `@storybook/angular-vite`                          |
| [Angular + Nginx](integrations/angular-nginx.md)                             | `dist/<name>/browser` in the Nginx image, the router behind the SPA fallback                   | `angular.json` and `nginx.conf`                    |
| [React Router + Storybook](integrations/react-router-storybook.md)           | `@storybook/react-vite` over the app's config without the React Router plugin                  | `@storybook/react-vite`                            |
| [Cloudflare Workers + Vite](integrations/cloudflare-workers-vite.md)         | the Cloudflare Vite plugin: dev server and build in workerd, `vite preview`                    | `@cloudflare/vite-plugin`                          |
| [Cloudflare Workers + Vitest](integrations/cloudflare-workers-vitest.md)     | tests in workerd through `cloudflare:workers`                                                  | `@cloudflare/vitest-plugin`                        |
| [Postgres + Docker Compose](integrations/postgres-docker-compose.md)         | the `db` service, its healthcheck, `init.sql`, host `db`                                       | a `db` service on a Postgres image                 |
| [Nginx + Docker Compose](integrations/nginx-docker-compose.md)               | a static web image: a Node build, then Nginx; its Compose service                              | a `Dockerfile` ending `FROM nginx`                 |
| [Node + Docker Compose](integrations/node-docker-compose.md)                 | the compiled service image, built then run from `dist/`; its `migrate` and `api` services      | `engines.node` and a `Dockerfile` running `dist/`  |
| [React Router + Docker Compose](integrations/react-router-docker-compose.md) | the app image running `server.ts` over the build; its `app` service                            | `react-router` and a `Dockerfile`                  |
| [Drizzle + Postgres](integrations/drizzle-postgres.md)                       | the client on the pool, the `postgresql` dialect, Testcontainers                               | `drizzle-orm` and `pg`                             |
| [Drizzle + Cloudflare D1](integrations/drizzle-d1.md)                        | a client per request, the `sqlite` dialect, `db.batch()`, tests in workerd                     | `drizzle-orm` and `d1_databases`                   |
| [Better Auth + Drizzle](integrations/better-auth-drizzle.md)                 | the auth tables in the schema, the adapter and its provider                                    | `better-auth` and `drizzle-orm`                    |
| [Better Auth + React Router](integrations/better-auth-react-router.md)       | auth on `appContext`, the splat route, the protected layout, Conform forms                     | `better-auth` and `react-router`                   |
| [S3 storage + Docker Compose](integrations/s3-storage-docker-compose.md)     | RustFS as a Compose service                                                                    | a `rustfs` service                                 |
| [Drizzle + S3 storage](integrations/drizzle-s3-storage.md)                   | `FilesService`: object first and undone on failure, owner-scoped reads, delete row then object | `drizzle-orm` and `@aws-sdk/client-s3`             |

Each has **The seam** (what calls what, as a diagram), **Where it lives** (the files to open), **Required values**,
**Pitfalls**, **Reference code**, **Conventions** and **Verify it is wired** (what a check confirms), each only where it
has something.

## Blueprints

The blueprints are listed in the Stacks tables of `SKILL.md`, the one list of stacks. Each has **Composition** (its
docs as a bulleted list of links, one per line and nothing else, in the order their conventions are assembled; an entry
a project may leave out ends in ` — optional` or ` — optional (<group>)`), **Shape** (the files), **Required values**
(scripts, ports, ignores and settings only this stack fixes), **Reference code** (its configs exactly as a fresh
scaffold writes them, and the files only this stack has, each checked by scaffolding the stack), **Scaffold** (only
where building it departs from the usual order), **Starter**, **Conventions** (only what is specific to the stack) and
**Smoke test** (the live proof a fresh scaffold runs, the Starter's included).

The **Starter** is what a fresh scaffold ships so every check has code to run against, built by applying the docs,
never copied file by file. It states outcomes, not files: the names and values it depends on, the behaviour and
contracts its tests rely on, and what each test tier covers. A rule later code should follow belongs in a doc, and
exact code in a doc's Reference code. A part only an optional group ships has a `### ` heading that names the group,
``### Sign in, with `authentication` ``. A Starter several stacks share is written in each, with only that stack's
values.

## Frontmatter

`references/` is an Open Knowledge Format (OKF v0.2) bundle, so any OKF reader can browse it
([the spec](https://github.com/GoogleCloudPlatform/open-knowledge-format/blob/main/SPEC.md)). Every doc opens with:

- **`type`**: its layer's, `Architecture Concept`, `Technology`, `Integration` or `Stack Blueprint`.
- **`title`**: its H1, word for word.
- **`description`**: its row's summary in this catalog, word for word; a blueprint's is its first sentence.
- **The graph's own keys** (`realises`, `connects`, `detect`, …), listed in `scripts/lib/graph.mjs`.

Freshness is recorded with OKF's own fields:

- **A technology doc names its upstream project** in `resource`.
- **A doc that pins a version cites where to check it**: a `sources` entry (`{ id, resource, title }`, a release page
  rather than a blog post), a `[^id]` footnote on the pinned claim with its `[^id]: <title>` definition at the end of
  the doc, and `stale_after`, the datetime to re-check it by. Past that date `resolve-stack.mjs` reports the doc under
  Found and `dossier.mjs` above its rules. After re-checking, move `stale_after` forward; a review may also be recorded
  as `verified: { by: human:<id>, at: <datetime> }`. Assembled conventions and the dossier print a footnote as a link
  to its source.
- **A doc being retired gets `status: deprecated`** rather than being deleted, so links into it keep working: a
  deprecated blueprint is never matched, and a deprecated doc that still applies is reported under Found.

`index.md` (in `references/` and each layer's folder) and `graph.json` are written by `scripts/build-graph.mjs` from the
frontmatter; edit the docs, never them. `index.md` and `log.md` are reserved names, never docs.
