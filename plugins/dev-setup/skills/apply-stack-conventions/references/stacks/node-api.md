# REST API on Node

A single-package Express 5 + Drizzle + Postgres REST API, compiled by `tsc` and run on Node, next to Postgres in Docker
Compose, with an `entity` CRUDL resource wired from the table to the routes. It is the API of the Angular full stack on
its own, for an API that several clients use.

## Composition

- [Code style](../architecture/code-style.md)
- [pnpm](../technologies/pnpm.md)
- [TypeScript](../technologies/typescript.md)
- [Database](../architecture/database.md)
- [Data access](../architecture/data-access.md)
- [REST API](../architecture/rest-api.md)
- [Node](../technologies/node.md)
- [Node + TypeScript](../integrations/node-typescript.md)
- [Express](../technologies/express.md)
- [Postgres](../technologies/postgres.md)
- [Drizzle](../technologies/drizzle.md)
- [Drizzle + Postgres](../integrations/drizzle-postgres.md)
- [Express + Drizzle](../integrations/express-drizzle.md)
- [Docker Compose](../technologies/docker-compose.md)
- [Postgres + Docker Compose](../integrations/postgres-docker-compose.md)
- [Express + Docker Compose](../integrations/express-docker-compose.md)
- [ESLint](../technologies/eslint.md)
- [TypeScript + ESLint](../integrations/typescript-eslint.md)
- [Prettier](../technologies/prettier.md)
- [ESLint + Prettier](../integrations/eslint-prettier.md)
- [Vitest](../technologies/vitest.md)

## Examples

- [Entity CRUDL](../examples/entity-crudl.md): its resource and its API part

## Shape

```
my-api/
├── .dockerignore / .env / .env.example / .gitignore / .prettierignore / .prettierrc
├── coding-conventions.md     # assembled from the stack blueprint
├── docker-compose.yml        # db + api
├── Dockerfile / drizzle.config.ts / eslint.config.js
├── package.json / pnpm-lock.yaml / pnpm-workspace.yaml
├── tsconfig{,.app,.node}.json / vitest.config.ts
├── db/scripts/init.sql       # no db/migrations/ is shipped
├── src/
│   ├── server.ts / app.ts / logger.ts / express.d.ts
│   ├── db/client.ts / db/schema.ts / db/schemas/entity.schema.ts
│   ├── models/               # dao.model, list-input.model, error.model, app-context.model
│   ├── helpers/              # dao.helper, list-input.helper, query-parser.helper
│   ├── daos/entity.dao.ts
│   ├── controllers/          # home, health, entity
│   └── middlewares/          # error, not-found
└── tests/
    ├── unit/                 # mirrors src/: helpers, db/schemas, controllers, middlewares
    ├── db/entity.dao.test.ts
    ├── api/entity.api.test.ts
    └── utils/                # http-mocks, test-server, pg-container, entity-seed
```

## Required values

`<App name>` is the repo name in Title Case; the database name defaults to `app`.

| What                  | Value                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ports                 | 5432 (Postgres, moved with `DB_PORT`), the API's `PORT` (default 3000)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `pnpm-workspace.yaml` | `allowBuilds` with `esbuild: true` and `cpu-features`, `protobufjs`, `ssh2` all `false`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| scripts               | `dev` `node --env-file=.env --import=tsx --watch src/server.ts \| pino-pretty --colorize --singleLine --translateTime 'HH:MM:ss.l' --ignore pid,hostname,req.headers,res.headers`; `build` `tsc -p tsconfig.app.json`; `start` `node --env-file=.env dist/server.js`; `typecheck` `tsc -p tsconfig.app.json --noEmit && tsc -p tsconfig.node.json`; `lint` `eslint .`; `test` `vitest run --project unit`; `test:integration` `vitest run --project db --project api`; `format`, `format:check`; `db:generate`, `db:migrate` as Drizzle + Postgres says, with `--env-file=.env`; `compose:up`, `compose:down` |
| dependencies          | the Express, Drizzle and Postgres docs' runtime packages                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| devDependencies       | the Express, Drizzle and Drizzle + Postgres dev packages; `eslint`, `@eslint/js`, `typescript-eslint`, `eslint-config-prettier`, `globals`, `prettier`, `@types/node@24`, `vitest@5`, and the pinned `typescript`                                                                                                                                                                                                                                                                                                                                                                                             |
| configs               | the tsconfigs from the Express doc; `drizzle.config.ts` and the three Vitest projects from Drizzle + Postgres, with `env: { LOG_LEVEL: 'silent' }` at the root; `eslint.config.js` with the shared rules, `globals.node`, the controller override (`*.controller.ts`: `@typescript-eslint/require-await` off, because every handler is `async` for one shape), ignoring `dist/**`, `db/**`, `eslint.config.js`                                                                                                                                                                                                |
| `.env.example`        | `DB_PASSWORD`, `DB_PORT=5432`, `DATABASE_URL` (`…@localhost:5432/app`), `PORT=3000`, a commented `LOG_LEVEL`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `docker-compose.yml`  | the Postgres + Docker Compose `db` service with the data at `./db/data`, and the Express + Docker Compose `api` service                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `.gitignore`          | `node_modules/`, `dist/`, `.env`, `*.log`, `*.tsbuildinfo`, `.DS_Store`, and `db/data/` under a comment                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `.prettierignore`     | `node_modules`, `dist`, `db/migrations`, `db/data`, `pnpm-lock.yaml`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `.dockerignore`       | `**/node_modules`, `dist`, `.git`, `.env`, `db`, `coverage`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |

## Scaffold

- **Check the ports first**; stop with the user if one is taken, or set another `PORT` in `.env`.
- **The manifest is written by the tools** (`pnpm init`, `pnpm pkg set`), with `type: "module"`.
- **`cp .env.example .env`** once `.env.example` is written.
- **Bring the stack up for the smoke test**; `db:generate --name init` produces exactly one migration.

## Conventions

### Layout

| Path               | Holds                                                                              |
| ------------------ | ---------------------------------------------------------------------------------- |
| `src/server.ts`    | the composition root: the pool, the DAOs, the `AppContext`, the listener, shutdown |
| `src/app.ts`       | `createApp(context)`: middleware, every route, the not-found and error handlers    |
| `src/controllers/` | one file per resource, one handler per route                                       |
| `src/daos/`        | one DAO per table                                                                  |
| `src/db/`          | the client, the schema registry, one schema file per resource                      |
| `tests/`           | `unit/` mirrors `src/`; `db/` per DAO; `api/` per resource; `utils/`               |
| `db/`              | `scripts/init.sql`, the bind-mounted data, and the generated `migrations/`         |

### Commands

| Command                                      | Does                                                    | Needs                          |
| -------------------------------------------- | ------------------------------------------------------- | ------------------------------ |
| `pnpm dev`                                   | the API with `node --watch`, logs through `pino-pretty` | Postgres, `.env`               |
| `pnpm build` / `pnpm start`                  | compile to `dist/` / run it                             | — / Postgres, `.env`           |
| `pnpm test:integration`                      | the `db` and `api` projects (Testcontainers)            | Docker, `db/migrations/`       |
| `pnpm compose:up` / `pnpm compose:down`      | the API image next to Postgres                          | Docker                         |
| `pnpm db:generate --name <n>` / `db:migrate` | write a migration / apply pending ones                  | `.env`, Postgres for `migrate` |

`build`, `typecheck`, `test`, `lint` and `format:check` are the five required checks.

### HTTP contract

| Route                  | Success                                                | Errors                                                                      |
| ---------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------- |
| `GET /`                | 200 `{ service, status }`                              | —                                                                           |
| `GET /health`          | 200 `{ status: 'ok', db: 'up', latencyMs, timestamp }` | 503 `Database connection failed`                                            |
| `GET /entities`        | 200 `PaginatedResult<Entity>`                          | 400 `Unknown query params: …`, `filter must be valid JSON`, `Invalid query` |
| `POST /entities`       | 201 the created row                                    | 400 `Invalid body`; 400 malformed JSON, 413 over 100 kB                     |
| `GET /entities/:id`    | 200 the row                                            | 400 `Invalid id`; 404 `Entity not found: <id>`                              |
| `PATCH /entities/:id`  | 200 the updated row                                    | 400 `Invalid id` / `Invalid body` (including no updatable field); 404       |
| `DELETE /entities/:id` | 204, no body                                           | 400 `Invalid id`; 404                                                       |
| anything else          | —                                                      | 404 `Not Found: <METHOD> <path>`                                            |

### Testing tiers

| Tier       | Lives in                       | Real                                      | Run                     |
| ---------- | ------------------------------ | ----------------------------------------- | ----------------------- |
| unit       | `tests/unit/` (mirrors `src/`) | the function; DAO and HTTP stubbed        | `pnpm test`             |
| DAO        | `tests/db/`                    | DAO, Drizzle, Postgres                    | `pnpm test:integration` |
| end to end | `tests/api/`                   | HTTP, Express, controllers, DAO, Postgres | `pnpm test:integration` |

| Change                             | Tests                                                                         |
| ---------------------------------- | ----------------------------------------------------------------------------- |
| a filter operator or scalar kind   | the translator and builder unit tests; a DAO case only if Postgres decides it |
| a filterable or sortable column    | the resource's schema test                                                    |
| a validation rule or error mapping | the controller unit test                                                      |
| a route                            | the controller unit test and the resource's API test                          |
| a DAO method or query path         | the DAO test and the API test for its route                                   |
| a change to `app.ts`               | the API test                                                                  |

### Adding a resource

Copy `entity.schema.ts` (the same order, no comments) and register the table in `db/schema.ts`; copy `entity.dao.ts`;
add the DAO to `AppContext` and build it in `server.ts`; copy `entity.controller.ts` and mount its handlers in `app.ts`;
add the schema, controller (with a stub in `createStubContext`), DAO (with a seed file) and API tests; then
`pnpm db:generate --name add-<resource>` and `pnpm db:migrate`.

### Before you merge

- [ ] The five checks pass; `pnpm test:integration` if you touched the DAOs, schemas, controllers or `app.ts`.
- [ ] A schema change comes with its migration, committed.
- [ ] A change to a response's shape is a change to the API's clients, made in the same commit where they live here.

## Smoke test

```sh
pnpm compose:up
pnpm db:generate --name init && pnpm db:migrate
pnpm test:integration
curl -s http://localhost:3000/health          # {"status":"ok","db":"up",…}
```

`db:generate` produces exactly one migration. Through the API, `POST /entities` creates, a filtered, sorted, paged
`GET /entities` answers `{ items, total, page, pageSize, totalPages }`, an unknown filter field is a 400, `PATCH`
updates, `DELETE` answers 204 and then 404.
