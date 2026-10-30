# Catalog

Every concept, technology, integration and example, with what it covers and how a project shows it has one. Read it to
find the doc a task needs, or to name the parts of a project no stack covers.

## Contents

- [Architecture](#architecture)
- [Technologies](#technologies)
- [Integrations](#integrations)
- [Examples](#examples)

## Architecture

| Doc                                              | Covers                                                                                            | The project needs it when it has    |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------- | ----------------------------------- |
| [Code style](architecture/code-style.md)         | comments that explain why, named exports, small units, suppressions with reasons, absence handled | always                              |
| [Database](architecture/database.md)             | the engine per runtime, table design, migrations, connection, one database per environment        | a database                          |
| [Data access](architecture/data-access.md)       | one layer touches the database, DAOs on the context, ordered lists, domain errors                 | a database                          |
| [REST API](architecture/rest-api.md)             | resources and methods, status codes, one error body, edge validation, the list format             | JSON endpoints, or a client of them |
| [Authentication](architecture/authentication.md) | the library that owns sessions, protected layouts, ownership checks, safe redirects               | sign-in, or per-user data           |
| [File storage](architecture/file-storage.md)     | bytes in an object store, metadata in a table, one service keeping them in step                   | uploads or stored files             |
| [UI components](architecture/ui-components.md)   | two tiers of components, one-way imports, theme tokens, states, labels and accessible names       | screens                             |

Each has **Principles** (each with its reason), **Required values** (where the concept fixes exact values),
**Conventions** and **Verify it is wired**. A concept states only what holds whatever the technology; it
names no stack. The docs that carry it out say so in a **Realises** line under their title, and an example's
Demonstrates table names the concepts it shows, so which docs realise a concept is found by searching for its name.

## Technologies

| Doc                                                      | Covers                                                                                    | The project uses it when it has         |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------- | --------------------------------------- |
| [pnpm](technologies/pnpm.md)                             | the manifest, `allowBuilds`, workspaces and the catalog, held-back versions               | `pnpm-workspace.yaml`, `packageManager` |
| [TypeScript](technologies/typescript.md)                 | one project per runtime, checking without emitting, the 6.0.x pin                         | `tsconfig*.json`                        |
| [ESLint](technologies/eslint.md)                         | flat config, type-checked rules, the shared rules, framework presets                      | `eslint.config.*`                       |
| [Prettier](technologies/prettier.md)                     | the shared config and the stacks' plugins                                                 | `.prettierrc`                           |
| [Vitest](technologies/vitest.md)                         | one config of named projects, picking an environment, how tests are written               | `vitest.config.*`                       |
| [Node](technologies/node.md)                             | running TypeScript as it is, `--env-file`, the dev loop                                   | `engines.node`, `node … .ts` scripts    |
| [Docker Compose](technologies/docker-compose.md)         | the Postgres service, images with Corepack, the root `.env`                               | `docker-compose.yml`                    |
| [Hono](technologies/hono.md)                             | the server entry every server stack's runtime drives                                      | `hono` in dependencies                  |
| [Cloudflare Workers](technologies/cloudflare-workers.md) | Wrangler, the compatibility date, the runtime types, secrets                              | `wrangler.jsonc`                        |
| [React Router](technologies/react-router.md)             | framework mode, the context, routes, route tests                                          | `react-router.config.ts`                |
| [Tailwind](technologies/tailwind.md)                     | utilities only, one global stylesheet with the theme, the build wiring per framework      | `tailwindcss` in dependencies           |
| [shadcn](technologies/shadcn.md)                         | the CLI, registries, `components.json` aliases and the `paths` they need                  | `components.json`                       |
| [Vite](technologies/vite.md)                             | one `vite.config.ts`, plugin order, aliases from `tsconfig` `paths`, client types         | `vite.config.ts`                        |
| [Storybook](technologies/storybook.md)                   | a story file beside every component, one story per state, on the app's Vite builder       | `.storybook/`                           |
| [Nginx](technologies/nginx.md)                           | static files with an SPA fallback and no proxy                                            | `nginx.conf`                            |
| [Angular](technologies/angular.md)                       | the CLI and its cleanup, signal components, the Analog tests, Storybook                   | `angular.json`                          |
| [NgRx](technologies/ngrx.md)                             | route-driven state and the request rules                                                  | `@ngrx/store` in dependencies           |
| [Express](technologies/express.md)                       | the app factory, controllers, the error shape, Pino                                       | `express` in dependencies               |
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

| Doc                                                                          | The seam                                                                                  | The project has it when it has                     |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------- |
| [Hono + React Router](integrations/hono-react-router.md)                     | one Hono handler builds the typed `appContext` and calls React Router                     | `hono` and `react-router`; `workers/app.ts`        |
| [Hono + Cloudflare Workers](integrations/hono-cloudflare-workers.md)         | the Hono app as the Worker, typed bindings, tests through `cloudflare:workers`            | `hono` and `wrangler.jsonc`                        |
| [Hono + Node](integrations/hono-node.md)                                     | `server.ts`: Vite middleware in development, `serveStatic` over the build                 | `@hono/node-server`; `server.ts`                   |
| [React Router + shadcn/ui](integrations/react-router-shadcn.md)              | Tailwind's Vite plugin, `components.json`, the shadcn primitives                          | `react-router` and `components.json`               |
| [React Router + Drizzle](integrations/react-router-drizzle.md)               | routes → services → queries → DAOs, the client on `appContext`                            | `react-router` and `drizzle-orm`                   |
| [Express + Drizzle](integrations/express-drizzle.md)                         | DAOs on the `AppContext`, list decoding, `NotFoundError` → 404                            | `express` and `drizzle-orm`                        |
| [Angular + the API contract](integrations/angular-api-contract.md)           | build-time base URL, mirrored models, one list format, one error body                     | `angular.json` and an `apiBaseUrl` in environments |
| [Angular + Fundamental NGX](integrations/angular-fundamental-ngx.md)         | the Fiori registry under `components/ui/`, its ignores, its pitfalls                      | `data-sap-theme` in `index.html`; `@angular/cdk`   |
| [Node + TypeScript](integrations/node-typescript.md)                         | TypeScript run as it is by Node, or compiled by `tsc`; `.ts` versus `.js` imports         | `node … .ts` scripts, or `tsc` to `dist/`          |
| [TypeScript + ESLint](integrations/typescript-eslint.md)                     | typed linting through the project service, the shared typed rules, the TypeScript ceiling | `typescript-eslint`                                |
| [ESLint + Prettier](integrations/eslint-prettier.md)                         | `eslint-config-prettier` and its placement; lint versus format checks                     | `eslint-config-prettier`                           |
| [React Router + ESLint](integrations/react-router-eslint.md)                 | the React and accessibility presets, the routes and tests overrides, ESLint 9             | `react-router` and `eslint`                        |
| [React Router + Prettier](integrations/react-router-prettier.md)             | import and class sorting                                                                  | `react-router` and `.prettierrc`                   |
| [React Router + Vite](integrations/react-router-vite.md)                     | `reactRouter()` last, the `~/` alias, `vite/client`, `app/env.d.ts`                       | `@react-router/dev` and `vite.config.ts`           |
| [React Router + Vitest](integrations/react-router-vitest.md)                 | route tests in browser mode through `createRoutesStub`                                    | `react-router` and `vitest`                        |
| [Angular + ESLint](integrations/angular-eslint.md)                           | angular-eslint presets, inline templates, selector prefixes                               | `angular-eslint`                                   |
| [Angular + Prettier](integrations/angular-prettier.md)                       | the Angular parser for HTML                                                               | `angular.json` and `.prettierrc`                   |
| [Angular + Vitest](integrations/angular-vitest.md)                           | Analog's builder, the `unit` and `browser` projects, `tsconfig.spec.json`                 | `@analogjs/vitest-angular`                         |
| [Angular + Tailwind](integrations/angular-tailwind.md)                       | PostCSS wiring, the layer imports, utilities plus a `host` class                          | `angular.json` and `.postcssrc.json`               |
| [Angular + Storybook](integrations/angular-storybook.md)                     | `@storybook/angular-vite` through Analog, `angular.json` targets, zoneless                | `@storybook/angular-vite`                          |
| [Angular + Nginx](integrations/angular-nginx.md)                             | `dist/<name>/browser` in the Nginx image, the router behind the SPA fallback              | `angular.json` and `nginx.conf`                    |
| [React Router + Storybook](integrations/react-router-storybook.md)           | `@storybook/react-vite` over the app's config without the React Router plugin             | `@storybook/react-vite`                            |
| [Cloudflare Workers + Vite](integrations/cloudflare-workers-vite.md)         | the Cloudflare Vite plugin: dev server and build in workerd, `vite preview`               | `@cloudflare/vite-plugin`                          |
| [Cloudflare Workers + Vitest](integrations/cloudflare-workers-vitest.md)     | tests in workerd through `cloudflare:workers`                                             | `@cloudflare/vitest-plugin`                        |
| [Postgres + Docker Compose](integrations/postgres-docker-compose.md)         | the `db` service, its healthcheck, `init.sql`, host `db`                                  | a `db` service on a Postgres image                 |
| [Nginx + Docker Compose](integrations/nginx-docker-compose.md)               | a static web image: a Node build, then Nginx; its Compose service                         | a `Dockerfile` ending `FROM nginx`                 |
| [React Router + Docker Compose](integrations/react-router-docker-compose.md) | the app image running `server.ts` over the build; its `app` service                       | `react-router` and a `Dockerfile`                  |
| [Drizzle + Postgres](integrations/drizzle-postgres.md)                       | the client on the pool, the `postgresql` dialect, Testcontainers                          | `drizzle-orm` and `pg`                             |
| [Drizzle + Cloudflare D1](integrations/drizzle-d1.md)                        | a client per request, the `sqlite` dialect, `db.batch()`, tests in workerd                | `drizzle-orm` and `d1_databases`                   |
| [Better Auth + Drizzle](integrations/better-auth-drizzle.md)                 | the auth tables in the schema, the adapter and its provider                               | `better-auth` and `drizzle-orm`                    |
| [Better Auth + React Router](integrations/better-auth-react-router.md)       | auth on `appContext`, the splat route, the protected layout, Conform forms                | `better-auth` and `react-router`                   |
| [S3 storage + Docker Compose](integrations/s3-storage-docker-compose.md)     | RustFS as a Compose service                                                               | a `rustfs` service                                 |

Each has **The seam** (what calls what, as a diagram), **Where it lives** (the files to open), **Required values**,
**Pitfalls**, **Reference code**, **Conventions** and **Verify it is wired** (what a check confirms), each only where it
has something.

## Examples

| Example                                            | What it must show                                                                 | Used by                  |
| -------------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------ |
| [Node module](examples/node-module.md)             | one exported function, its test, the entry point that runs it                     | Node package             |
| [Hono hello](examples/hono-hello.md)               | one route answered by the Worker's real entry, tested in workerd                  | Hono Worker              |
| [React Router home](examples/react-router-home.md) | a loader reading a server value from the context, a shadcn primitive, route tests | both React Router stacks |
| [Entity CRUDL](examples/entity-crudl.md)           | one resource end to end: table, DAO, API, contract, slices, pages, tests, e2e     | both Angular stacks      |

Each has **Demonstrates** (each part and the docs it applies), **Data** or **The resource** (the values it depends on),
**Behaviour** (what it does, and the contracts tests rely on: routes, names, answers), **Tests** (the behaviours each
tier covers, and the files), **Variants** (short deltas) and **Done when**, each only where it has something.
