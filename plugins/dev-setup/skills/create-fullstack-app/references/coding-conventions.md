# Coding Conventions

This file is **written to the root of every repo** scaffolded by the `create-fullstack-app` skill. It is the working
guide for everyone who changes the code afterwards, people and Claude sessions alike: how the two projects are put
together, what each building block may and may not do, how to name things, and which test proves what.

The rules are not suggestions: the scaffold's code follows every one of them, and a change that breaks one should
change this file in the same commit.

## Contents

1. [How to use this file](#1-how-to-use-this-file)
2. [Repository](#2-repository)
3. [API](#3-api)
4. [Web](#4-web)
5. [Naming](#5-naming)
6. [Code style](#6-code-style)
7. [Testing](#7-testing)
8. [Adding a resource](#8-adding-a-resource)
9. [Formatting, lint and Docker](#9-formatting-lint-and-docker)
10. [Not done on purpose](#10-not-done-on-purpose)
11. [Before you merge](#11-before-you-merge)

## 1. How to use this file

Read the architecture section of the project you are changing ([API](#31-architecture), [Web](#41-architecture-route-driven-state))
once, then look things up. The quickest way in is the question you have:

| I want to…                                    | where it goes                                                              | section                                   |
| --------------------------------------------- | -------------------------------------------------------------------------- | ----------------------------------------- |
| add a table or resource                       | `api/src/db/schemas/`, `daos/`, `controllers/`, then the web slice + pages | [Adding a resource](#8-adding-a-resource) |
| add an API route                              | a handler in `controllers/<resource>.controller.ts`, mounted in `app.ts`   | [API building blocks](#32-building-blocks) |
| make a column filterable or sortable          | one line in the resource's schema file                                     | [List queries](#34-list-queries)          |
| change what an error response looks like     | `middlewares/error.middleware.ts`                                          | [HTTP contract](#33-http-contract)        |
| add a reusable UI piece                       | `web/src/app/components/` + its story + its browser spec                   | [Web building blocks](#44-building-blocks) |
| keep some state on the web                    | depends on the kind of state                                               | [Where state lives](#43-where-state-lives) |
| call the API from the web                     | a method on `services/<resource>.service.ts`, called from an effect        | [Web building blocks](#44-building-blocks) |
| know which test to write                      | —                                                                          | [Which test do I write?](#73-which-test-do-i-write) |

## 2. Repository

### Shape

```
<repo>/
├── api/                    # Express 5 + Drizzle + Postgres + zod + Pino
├── web/                    # Angular 22 + NgRx + router-store + Tailwind v4
├── package.json            # root scripts; packageManager pins pnpm
├── pnpm-workspace.yaml     # packages + catalog + allowBuilds
├── docker-compose.yml      # db + api + web
├── .env / .env.example     # the single env file; only .env.example is committed
└── coding-conventions.md   # this file
```

- **pnpm 11 or newer**, as a workspace; `npm` and `yarn` are not used. The exact version is the root `packageManager`
  field, which Corepack also uses inside the Docker images.
- **Node 24 or newer.**
- **Catalog rule:** a package goes in `pnpm-workspace.yaml`'s `catalog:` only when two or more manifests use it with the
  same range; everything else is a direct dependency of the one manifest that uses it. Today the catalog holds the
  shared tooling: TypeScript (pinned **exactly** to one 6.0.x — Angular 22 needs `>=6.0 <6.1` and typescript-eslint
  `<6.1`; move it only when both ranges allow), ESLint, typescript-eslint, `@eslint/js`, `eslint-config-prettier`,
  `globals`, Prettier, `@types/node` (`^24`) and Vitest (`^5`).

### Commands

Run from the repo root.

| command                  | does                                                                     | needs                         |
| ------------------------ | ------------------------------------------------------------------------ | ----------------------------- |
| `pnpm dev:api`           | API with `node --watch`, logs through `pino-pretty`                      | Postgres, `.env`              |
| `pnpm dev:web`           | `ng serve` on `:4200`                                                    | —                             |
| `pnpm build`             | API `tsc` → `api/dist/`; web `ng build` → `web/dist/web/browser/`         | —                             |
| `pnpm typecheck`         | API: `tsconfig.app` + `tsconfig.node`; web: app + spec + e2e tsconfigs   | —                             |
| `pnpm test`              | API `unit` project; web `unit` project (jsdom)                           | —                             |
| `pnpm test:integration`  | API `db` + `api` projects (Testcontainers Postgres)                      | Docker, `api/db/migrations/`  |
| `pnpm test:browser`      | web `browser` project (Chromium)                                         | `playwright install chromium` |
| `pnpm test:e2e`          | Playwright against its own app + API + database                          | Docker, `.env`, migrations    |
| `pnpm storybook`         | Storybook on `:6006`                                                     | —                             |
| `pnpm lint` / `pnpm format` / `pnpm format:check` | ESLint / Prettier write / Prettier check, per project | —                     |
| `pnpm up` / `pnpm down`  | `docker compose up --build` / `docker compose down -v`                   | Docker                        |
| `pnpm --filter api db:generate --name <name>` / `db:migrate` | write a migration from the schema files / apply pending ones | `.env`, Postgres for `migrate` |

`build`, `typecheck`, `test`, `lint` and `format:check` are the five required checks.

### Ports and environment

| port   | what                              |
| ------ | --------------------------------- |
| `5432` | Postgres (Compose `db`)           |
| `3000` | API (local and Compose)           |
| `4200` | web (`ng serve`, Compose Nginx)   |
| `3100` | e2e API                           |
| `4300` | e2e `ng serve`                    |
| `6006` | Storybook                         |

| variable       | used by                                | default / rule                                |
| -------------- | -------------------------------------- | --------------------------------------------- |
| `DATABASE_URL` | API, drizzle-kit                       | required; both throw when it is unset         |
| `PORT`         | API                                    | `3000`                                        |
| `LOG_LEVEL`    | API logger                             | `debug`, or `info` when `NODE_ENV=production` |
| `DB_PASSWORD`  | Compose `db` and the API's Compose URL | `s3cr3t` in `.env.example`                    |

- One `.env` at the root. The API loads it with a strict `--env-file=../.env`: a missing file fails at start.
- The web has no runtime env. Its config is build-time, in `web/src/environments/`: `environment.ts` (production,
  `apiBaseUrl` derived from the page's host on port 3000), `environment.development.ts` (`localhost:3000`) and
  `environment.e2e.ts` (`localhost:3100`), swapped by `angular.json`'s `fileReplacements`. Only the `app-context` slice
  imports `environment`.

## 3. API

### 3.1 Architecture

```
server.ts  builds the AppContext once: { db, entityDao: new EntityDao(db) }
   │
   ▼
createApp(context)   app.ts — sets app.locals.context, then the pipeline:

request ─► pino-http ─► cors ─► express.json() ─► route ─► controller
                                                             │  validates its input (zod safeParse)
                                                             ▼
                                               req.app.locals.context.entityDao
                                                             │
                                                             ▼
                                         DAO ─► dao.helper (filter / sort → SQL) ─► Drizzle ─► Postgres

errors:  any throw ─► next(err) ─► … ─► notFoundHandler (no route) ─► errorHandler ─► { status: 'error', message }
```

- **`server.ts` is the composition root.** It is the only place that creates the database pool and the DAOs, puts them
  on the context, starts the HTTP listener and closes the pool on `SIGINT` / `SIGTERM`.
- **`app.ts` is a pure factory.** `createApp(context)` takes the context, stores it once on `app.locals.context` (a
  singleton, not a middleware), registers the global middleware, mounts every handler directly on the app (no routers)
  and ends with `notFoundHandler` + `errorHandler`. Nothing in it reads the environment or opens connections, which is
  what lets tests build an app around any context.
- **Controllers are the HTTP edge; DAOs are the only code that touches Drizzle.** A controller decodes and validates,
  calls a DAO through the context, and shapes the response; a DAO runs queries and knows nothing about HTTP.

### 3.2 Building blocks

| block            | lives in                                    | is                                                                     | may use                                                          | must not                                                                  |
| ---------------- | ------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------- |
| resource schema  | `db/schemas/<resource>.schema.ts`           | the table and every input schema + type of one resource                | drizzle, drizzle-zod, zod, the list-input builders and scalars   | hold logic, carry comments                                                |
| table registry   | `db/schema.ts`                              | `export const schema = { entity, … }`, passed to `drizzle()`           | the resource schemas                                             | —                                                                         |
| db client        | `db/client.ts`                              | the `pg` pool and the Drizzle client                                   | `DATABASE_URL`                                                   | fall back to a hard-coded URL                                             |
| contract         | `models/dao.model.ts`                       | `Dao<T, ListInput, CreateInput, UpdateInput>`, `PaginatedResult`, `IdInput` | —                                                           | import zod or drizzle                                                     |
| list vocabulary  | `models/list-input.model.ts`                | the scalar filter inputs, `sortDirectionSchema`, the derived types     | zod                                                              | build resource schemas                                                    |
| list builders    | `helpers/list-input.helper.ts`              | `createFilterInputSchema`, `createSortInputSchema`, `createListInputSchema`, page limits | the list vocabulary                       | know about a resource or the URL                                          |
| SQL translation  | `helpers/dao.helper.ts`                     | `filterToSql`, `sortToSql`, `toPaginatedResult`, `escapeLike`          | drizzle's SQL builders                                           | know about a resource or HTTP                                             |
| query normalizer | `helpers/query-parser.helper.ts`            | `normalizeQuery`: first value of a repeated param, empties dropped     | —                                                                | take an Express `Request`                                                 |
| errors           | `models/error.model.ts`                     | `NotFoundError(resource, id)`                                          | —                                                                | extend `http-errors`                                                      |
| DAO              | `daos/<resource>.dao.ts`                    | one class `implements Dao<…>`, created once in `server.ts`              | the db client type, its schema file, `dao.helper`, `NotFoundError` | read the request, throw `http-errors`, hold configuration of its own     |
| controller       | `controllers/<resource>.controller.ts`      | one exported `async (req, res, next)` function per route                | its schema file, `normalizeQuery`, `http-errors`, `NotFoundError`, the DAO via `req.app.locals.context` | import Drizzle or a DAO class, build SQL, log errors itself   |
| middleware       | `middlewares/<name>.middleware.ts`          | `errorHandler` (terminal) and `notFoundHandler`                         | `http-errors`, `req.log`                                         | call a DAO                                                                |
| context type     | `models/app-context.model.ts` + `express.d.ts` | `AppContext` and its typing on `Express.Locals`                     | —                                                                | —                                                                         |
| logger           | `logger.ts`                                 | one Pino instance emitting plain JSON                                   | `LOG_LEVEL`                                                      | import `pino-pretty` (the `dev` script pipes through it)                  |

**Controller shape.** Every handler has the same skeleton, even when it has nothing to await:

```ts
export async function getEntity(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // decode → safeParse → DAO call → res.json / res.status(…).json / res.status(204).send()
  } catch (err) {
    next(err);
  }
}
```

- Every input (`req.params`, `req.query`, `req.body`) is validated inline with `safeParse`; a failure throws
  `createError(400, …, { expose: true, cause: z.flattenError(error) })`. There is no shared `parseOr400` helper, so each
  handler shows every error it can produce.
- A `NotFoundError` from the DAO becomes `createError(404, err.message, { expose: true, cause: err })`; a `null` from
  `get` becomes a 404 in the handler.
- Errors leave a controller only through `next(err)`. The health controller is the one handler whose `catch` creates
  the error (`createError(503, 'Database connection failed', { expose: true, cause: err })`) instead of forwarding the
  original.
- The DAO contract is single-input: `get({ id })` → `T | null`, `list(input)` → `PaginatedResult<T>`,
  `create(input)` → `T`, `update(input)` → `T` (the input carries `id`), `delete({ id })` → `void`; `update` and
  `delete` throw `NotFoundError` for a missing row.

### 3.3 HTTP contract

| route                 | success                          | errors                                                                                   |
| --------------------- | -------------------------------- | ---------------------------------------------------------------------------------------- |
| `GET /`               | 200 `{ service, status }`        | —                                                                                        |
| `GET /health`         | 200 `{ status: 'ok', db: 'up', latencyMs, timestamp }` | 503 `Database connection failed`                                  |
| `GET /entities`       | 200 `PaginatedResult<Entity>`    | 400 `Unknown query params: …`, `filter must be valid JSON`, `Invalid query`               |
| `POST /entities`      | 201 the created row              | 400 `Invalid body`; 400 malformed JSON and 413 over 100 kB, from `express.json()`         |
| `GET /entities/:id`   | 200 the row                      | 400 `Invalid id`; 404 `Entity not found: <id>`                                           |
| `PATCH /entities/:id` | 200 the updated row              | 400 `Invalid id` / `Invalid body` (including no updatable field); 404                    |
| `DELETE /entities/:id`| 204, no body                     | 400 `Invalid id`; 404                                                                    |
| anything else         | —                                | 404 `Not Found: <METHOD> <path>`                                                         |

- **Error body:** always `{ status: 'error', message }`, written by `errorHandler`. The message is the error's own for
  an `http-errors` error created with `expose: true` (every 4xx here, and the health 503); anything else — an
  unexpected error, an unexposed http error — answers `Internal Server Error`, so internals never reach the client.
- **Log level follows status:** `errorHandler` logs 5xx at `error` and 4xx at `warn`. Nothing else logs a failed
  request; pino-http logs every request.
- **Dates** travel as ISO-8601 strings; **ids** are UUIDs. CORS is open (`cors()`), because the browser calls the API
  host directly.

### 3.4 List queries

**On the wire:** `GET /entities?filter=<json>&sortField=<field>&sortDirection=ASC|DESC&page=<n>&pageSize=<n>`. Every
param is optional; any other param is a 400.

**Decoding is the controller's job,** written out in the handler: `normalizeQuery`, reject unknown params, `JSON.parse`
the filter (invalid JSON → 400), build `sort` from `sortField` / `sortDirection` (`ASC` when only the field is given),
turn `page` / `pageSize` into numbers, then `list<Resource>InputSchema.safeParse(…)` (400 on failure) and its `data`
straight to the DAO. The schema validates the structured `{ filter, sort, page, pageSize }` and knows nothing about the
URL, so the DAO can be called with plain objects from anywhere.

**Filter inputs**, modelled on AppSync's `Model<Type>FilterInput`, one zod schema per scalar kind:

| kind                 | operators                                                                     |
| -------------------- | ----------------------------------------------------------------------------- |
| `IdFilterInput`      | `eq ne in`                                                                    |
| `StringFilterInput`  | `eq ne lt le gt ge between in contains notContains beginsWith`                |
| `NumberFilterInput`  | `eq ne lt le gt ge between in`                                                |
| `DateFilterInput`    | `eq ne lt le gt ge between in` (ISO date or date-time)                        |
| `BooleanFilterInput` | `eq ne`                                                                       |

- `between` is an inclusive `[from, to]` pair; `in` takes at most 100 values, and an empty `in` matches nothing;
  `contains` / `notContains` / `beginsWith` are case-insensitive and escape LIKE metacharacters.
- A resource declares `<resource>FilterInputSchema = createFilterInputSchema({ <column>: <kind>FilterInputSchema, … })`.
  The builder makes every field optional and adds recursive `and` / `or` (at most 20 branches each) and `not`. Schemas
  are strict: an unknown field or operator is a 400.
- Fields across a filter object are ANDed. `{}` matches every row, so an `or` containing it matches every row and
  `not {}` matches none.
- **Fields are named after the table's columns.** The DAO passes the Drizzle table itself to `filterToSql` /
  `sortToSql`, and `FilterTable` / `SortTable` make a field with no matching column a compile error; there are no column
  maps.

**Sorting:** an explicit allowlist, `<resource>SortInputSchema = createSortInputSchema(['name', …])`. The DAO falls
back to `<resource>DefaultSort` (`createdAt DESC` for `entity`), and `sortToSql` always appends an `id` tie-breaker, so
pages never repeat or skip rows.

**Pagination is page-based:** `page` (default 1) and `pageSize` (default 20, max 100) in; `{ items, total, page,
pageSize, totalPages }` out. The schema fills the defaults, so the DAO always receives both. The DAO runs the page query
and then the count query on the same `where`, one after the other: one pool connection per request, and `total` can lag
a concurrent write (wrap both in a transaction when it must not).

**Extending:** a filterable column is one line in the resource's filter schema, a sortable one one entry in its sort
allowlist; a new operator is one line in its scalar schema plus one branch in `dao.helper.ts`'s `fieldToSql`.

### 3.5 Data and migrations

- Types come from schemas: `type Entity = z.infer<typeof selectEntitySchema>`, and every input type is a `z.infer` of
  its schema — including the recursive filter type. Never write a TypeScript type that mirrors a zod schema.
- Row inputs come from drizzle-zod (`createInsertSchema` / `createUpdateSchema` / `createSelectSchema`); list inputs
  from the builders.
- **Resource schema files follow one order and carry no comments:** the table; the schemas (`select<Resource>Schema`,
  `<resource>IdInputSchema`, `create…`, `update…`, `<resource>FilterInputSchema`, `<resource>SortInputSchema`,
  `list<Resource>InputSchema`); `<resource>DefaultSort`; then the inferred types in the same order. The names and the
  builders carry the meaning; this file explains them.
- A new table is a new `db/schemas/<resource>.schema.ts` registered in `db/schema.ts`.
- **Migrations only:** `db:generate` writes a migration from the schema files (drizzle-kit reads
  `src/db/schemas/*.schema.ts`), `db:migrate` applies it. There is no `db:push`. The scaffold shipped no migrations; the
  first `db:generate --name init` created them.
- Postgres data is bind-mounted at `api/db/data/`; `rm -rf api/db/data/` resets it. `api/db/scripts/init.sql` creates
  the `app` database on first start.

### 3.6 Tooling

- **tsconfigs:** `tsconfig.json` is a pure solution file (`files: []` + `references`); `tsconfig.app.json` holds every
  compiler option, including `types: ["node"]` (TypeScript 6 defaults `types` to `[]`); `tsconfig.node.json` extends it
  with `composite: false` and includes `tests/` and every config file. A new config file goes into that `include`, or
  ESLint reports it as part of no project.
- **Dev loop:** `node --import=tsx --watch src/server.ts`, not `tsx watch`: Node restarts, tsx loads TypeScript.
- `dev`, `start`, `db:generate` and `db:migrate` all use `--env-file=../.env` (drizzle-kit does not load `.env` itself).

## 4. Web

### 4.1 Architecture: route-driven state

The web app's state is driven by the route. Each page route is a **state**, named in its `data: { state }` and typed
by `AppState`; each page's `status` union names what the page is doing. The route table in `app.routes.ts` is the list
of states. The names are for reading and matching: reducers do not restrict which action may follow which, so a
request's result is kept from the wrong page by the [request rules](#45-the-page-contract), not by the reducer.

```
                       open row                          Edit
  ┌───────────────┐ ───────────────► ┌───────────────┐ ───────────────► ┌───────────────┐
  │ entity-list   │                  │ entity-detail │                  │ entity-edit   │
  │ query change ↺│ ◄─────────────── │ another id   ↺│ ◄─────────────── │               │
  └───────────────┘   Back           └───────────────┘   Save Success   └───────────────┘
      │      ▲                               ▲                                   │
  New │      │ Cancel                        │ Save Success                      │ Cancel → entity-list
      ▼      │                               │
  ┌───────────────┐ ─────────────────────────┘
  │ entity-new    │
  └───────────────┘
```

| state           | route                                            | slice              | sub-states (`status`)                                  |
| --------------- | ------------------------------------------------ | ------------------ | ------------------------------------------------------ |
| `entity-list`   | `/entities?filter&sortField&sortDirection&page&pageSize` | `entityListPage`   | `idle` → `loading` → `loaded` ⇄ `deleting`, `error`     |
| `entity-detail` | `/entities/:id`                                  | `entityDetailPage` | `idle` → `loading` → `loaded`, `error`                  |
| `entity-new`    | `/entities/new`                                  | `entityFormPage`   | `idle` → `ready` → `saving`, `error`                    |
| `entity-edit`   | `/entities/:id/edit`                             | `entityFormPage`   | `idle` → `loading` → `ready` → `saving`, `error`        |

Data moves one way, in two loops that share the page reducer and the page:

```
             routerLink in a template ─────────────────────────────────────┐
navigation   from code ────► AppRouterActions.navigate ──► navigate$ ──► Router ──► URL
                                                                           │  ▲ back · forward · deep link
                                                                           ▼
                                                     routerNavigatedAction (@ngrx/router-store)
                                                                           │ only the reducer whose state matches
                                                                           ▼
data         page ◄── selectors ◄── page slice ◄── page reducer ◄── <Action> Success / Failure
               │                                                                 ▲
               └── watch from ngOnInit ──► Fetch / Load ──► effect ──► service ──► API
```

- **The router only writes state; the page decides when to load.** No effect reacts to a navigation, and no
  navigation starts a request.
- **Pages talk to the store, effects talk to the world.** A page reads selectors of its own slice and dispatches
  actions; its template links with `routerLink`; effects call the service and map results to actions; `navigate$` is
  the only code that calls the Angular `Router`.
- **Each page owns one slice, registered on its route** (`provideState` + `provideEffects` in `app.routes.ts`). Only
  `appContext` and `appRouter` are global, in `app.config.ts`. Route-level slices and effects stay registered after the
  page is left, which is why every page resets its slice on `Leave` and every read ends on it.

### 4.2 Store and router

The URL enters the store in one direction only, and components read only their page slice: to them, the store is the
single source of truth.

| state                                 | written by                                                   | read by                                 |
| ------------------------------------- | ------------------------------------------------------------ | --------------------------------------- |
| the URL                               | the Angular `Router`, through `routerLink` or `navigate$`    | `@ngrx/router-store`                    |
| `appRouter` (`{ url, state, params, queryParams }`) | `routerReducer`, through `AppRouterSerializer`  | devtools; no page, no page slice        |
| a page's route state (list input, detail id, form target) | its page reducer, on `routerNavigatedAction` for its own state | that page, through its selectors |
| server data and `status`              | its page reducer, on `Fetch` / `Load` results                | that page                               |

**Loading data: the page watch.** In `ngOnInit` a page starts a watch on its route state — `filter` out `null`,
`distinctUntilChanged`, `takeUntilDestroyed` — and dispatches `Fetch` / `Load` for each value; `ngOnDestroy` dispatches
`Leave`. A reused component (list page 2 → 3, detail 42 → 43) reloads because its watch is still running. Loads that
are not navigations stay effects: `fetchAfterDelete$` fetches again with the slice's input.

**When the URL changes outside the app,** it arrives through the same door as a change the app made, and needs no code
of its own:

| trigger                              | what Angular does                                         | what the store and page do                                               |
| ------------------------------------ | --------------------------------------------------------- | ------------------------------------------------------------------------ |
| deep link or refresh                 | registers the route's slice and effects, creates the page, `NavigationEnd` | the reducer stores the URL's state; `ngOnInit`'s watch loads it once     |
| back / forward to another page       | destroys the old page, creates the new one                | the old page dispatches `Leave`; the new one loads as on a deep link     |
| back / forward within the list       | reuses the page; no lifecycle hooks                       | the reducer stores the input; the running watch fetches it               |
| an edited URL or a link to another id | reuses the detail page                                   | the reducer stores the id and drops the old entity; the watch loads it   |
| a guard cancels                      | `NavigationCancel`, no `NavigationEnd`                    | no `routerNavigatedAction`: no slice changes                             |

**When the app changes what the URL holds,** it follows a link or dispatches `AppRouterActions.navigate`, and waits:
the new value reaches the slice only through `routerNavigatedAction`. Nothing writes URL-backed state into a slice
directly, so nothing has to sync back.

| situation                                         | who navigates                            | with                                                          |
| ------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------- |
| the user opens a row, edits, creates, cancels     | a `routerLink` in the page's template    | `['/entities', id]`, `'/entities/new'` and the like           |
| the user changes filter, sort, page or page size  | the list page, `navigate`                | `{ commands: [], queryParams: toParams(next) }`               |
| a save succeeds, and its form is still open       | `navigateAfterSave$`, `navigate`         | `{ commands: ['/entities', entity.id] }`                      |
| a page past the end (a delete, a stale deep link) | `stepBackPastLastPage$`, `navigate`      | `{ commands: [], queryParams, replaceUrl: true }`             |

A user's change adds a history entry, so back undoes it; a correction the user did not ask for replaces the entry.
State that does not belong in the URL — a filter draft, a row pending delete, server data — never goes through
`navigate`.

**Pitfalls.**

- **Start the watch in `ngOnInit`, never the constructor.** Angular constructs the new page before
  `routerNavigatedAction` and runs `ngOnInit` after it.
- **A new id or target starts the slice over.** The reducer drops the previous entity with the new id, or the page
  shows entity 42 under the URL for 43 until the request returns.
- **Read the route with `navigatedRoute(action)`**, the one cast from router-store's payload type to `AppRouterState`.
- **`navigationActionTiming: PostActivation`** keeps `appRouter` from holding a URL the router never commits (a guard
  can cancel before activation).
- **The watch's `distinctUntilChanged` is the only dedupe.** A navigation that lands on an equal input fetches nothing;
  reducers never compare to avoid an update.
- **A response can outlive its page.** Route-level effects keep running after `Leave`. A read without
  `takeUntil(<Page>.leave)` lands in the next visit's slice; a write's follow-up without a page check navigates from
  wherever the user went. See [the page contract](#45-the-page-contract).
- **Filter after `withLatestFrom`, never inside it.** `withLatestFrom(store.select(x).pipe(filter(nonNull)))` keeps the
  last non-null value after `Leave` resets the slice; sample `store.select(x)` and filter the pair afterwards.
- **`commands: []` is relative to the current URL,** whatever page that is by the time the action runs. Use it only
  from the page itself or from an effect whose request ended on `Leave`.

### 4.3 Where state lives

| state                                         | lives in                                                       | example                                          |
| --------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------ |
| what the user is looking at, shareable        | the URL, copied into the page slice by its reducer             | list filter, sort, page; the `:id` of a page     |
| server data and the request's status          | the page's slice                                               | `items`, `total`, `entity`, `status`, `error`    |
| UI-only, short-lived                          | a signal in the page (`signal` / `linkedSignal`)               | the filter strip's draft, the row pending delete |
| build-time config                             | `environment*.ts`, read only by `appContext`                   | `apiBaseUrl`, `appName`                          |

Derive UI state from the store with `linkedSignal` when it must follow it — the filter draft resyncs from the slice's
input on every change, the pending delete closes when a new page of items arrives — instead of syncing it by hand in
an `effect()`.

### 4.4 Building blocks

| block            | lives in                                   | is                                                              | may use                                                    | must not                                                       |
| ---------------- | ------------------------------------------ | --------------------------------------------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------- |
| component        | `components/<name>.component.ts`           | a store-free UI piece: signal `input()` / `output()`            | other components                                           | inject the `Store`, a service or the `Router`                  |
| layout           | `layouts/<name>-layout.component.ts`       | the shell around the pages                                      | the `Store` (read)                                         | inject services                                                |
| page             | `pages/<name>-page.component.ts`           | one state's screen; loads from its watch                        | the `Store` (its own slice's selectors, dispatch), `RouterLink`, components, local signals | inject services, `Router`, `ActivatedRoute`, `FormBuilder`; select from `appRouter` |
| slice            | `store/<page-name>/<page-name>.{model,actions,reducer,selectors}.ts` | one page's route state, data and status | resource models, helpers, `navigatedRoute`         | hold another page's data, read another state's route           |
| effects          | `store/<page-name>/<page-name>.effects.ts` | functional effects (`{ functional: true }`)                     | services, `Store`, `AppRouterActions.navigate`              | call the `Router` or `HttpClient` directly; react to `routerNavigatedAction`; let a read outlive `Leave` |
| app-router slice | `store/app-router/`                        | `AppState`, the serializer, `navigatedRoute`, `Navigate` + `navigate$` | the Angular `Router` (`navigate$` only)             | —                                                              |
| app-context slice| `store/app-context/`                       | `apiBaseUrl` + `appName`, seeded from `environment`             | `environment`                                              | change after start                                             |
| service          | `services/<resource>.service.ts`           | every HTTP call for one resource (`providedIn: 'root'`)          | `HttpClient`, `selectApiBaseUrl`, helpers                  | be injected outside effects, keep state                        |
| helper           | `helpers/<name>.helper.ts`                 | pure functions (URL params, filter form mapping, error message) | models                                                     | inject anything                                                |
| model            | `models/<resource>.model.ts`               | the resource's types, mirroring the API by name and shape       | —                                                          | contain logic                                                  |

- **Services write each request in full:** the method builds its URL (`` `${this.apiBaseUrl()}/entities/${id}` ``) and
  params inline, with no private URL or params helper, and returns an `Observable`. `list` reuses the shared `toParams`
  so the page URL and the API request use one format.
- **Resource models mirror the API by hand** (`Entity`, `CreateEntityInput`, `EntityFilterInput`, `ListEntityInput`,
  `PaginatedResult<T>`, …). The web cannot import the API package: change both sides in the same commit.
- **Forms** are `new FormGroup` / `new FormControl`, validated like the API's schemas (`name` required, max 200;
  `description` max 2000). Save trims the values and sends an empty description as `null`.

### 4.5 The page contract

- **Watch and Leave.** Every page starts its watch in `ngOnInit` ([Store and router](#42-store-and-router)) and
  dispatches `Leave` in `ngOnDestroy`; the reducer resets to the initial state on `Leave`, so a revisit never shows
  stale data. Detail and form load the entity themselves; there are no cross-page reducer updates.
- **Each slice holds the route state its page needs** (the list input, the detail id, the form target), `null` until
  the router writes it, and writes it only on `routerNavigatedAction` for its own state.
- **One `status` union per slice, never boolean flags:** list `'idle' | 'loading' | 'loaded' | 'deleting' | 'error'`,
  detail `'idle' | 'loading' | 'loaded' | 'error'`, form `'idle' | 'loading' | 'ready' | 'saving' | 'error'`, plus
  `error: string | null`, set only in `'error'`.
- **Actions name intent, not lifecycle:** `Load` (not `Enter` / `Init`), `Fetch` for one request with a given input,
  `<Action> Success` / `<Action> Failure` for its results — `Fetch Success` on the list, `Load Success` on detail and
  form. The action group's `source` is the page name (`'Entity List Page'`).
- **Writes use `concatMap`, reads `switchMap`.** A second save never cancels the first; a newer fetch cancels an older
  one.
- **Reads end on `Leave`.** Each read's inner observable ends with `takeUntil(actions$.pipe(ofType(<Page>.leave)))`.
  A load that needs no request (the new form's `null` id) returns `EMPTY` inside `switchMap` rather than being
  filtered out before it, so it still cancels the read before it.
- **Writes finish, and carry their page.** A save is never cancelled. The form slice keeps the `navigationId` of the
  navigation that opened it (`routerNavigatedAction`'s `event.id`), `null` after `Leave`; `create$` / `update$` record it
  with `withLatestFrom` as the save starts and put it on `Save Success` / `Save Failure`. The reducer and
  `navigateAfterSave$` act on a result only when its `navigationId` is the slice's.
- **A follow-up reads the request it follows.** `Fetch Success` carries the `input` it was made for, and
  `stepBackPastLastPage$` steps back from that input, not from the slice's.
- **Navigation after a result is an effect**, never page code: `navigateAfterSave$` goes to the detail page when the
  form that saved is still open; on the list, `fetchAfterDelete$` refetches (unless the page was left) and
  `stepBackPastLastPage$` moves off a page past the end, replacing the history entry. Plain links are `routerLink`.
- **A page used by several routes registers its slice once,** on a shared componentless parent route (the form on
  `new` and `:id/edit`), so its effects do not run twice.

### 4.6 UI rules

- **One file per component:** inline `template`, no `.html` / `.scss` siblings. Angular ESLint lints inline templates.
- **Styling:** Tailwind utilities in the template, plus a `host` class for the host element. The only global
  stylesheet is `src/styles.css`. Tailwind's preflight is on unless Fundamental NGX is installed, whose base styles it
  would clobber.
- **No component sets `changeDetection`:** `OnPush` is Angular 22's default.
- **Templates:** the status-driven body is an `@switch (status())`; the error banner over it is an
  `@if (status() === 'error')`. Bind a component's signal inputs with property syntax (`[title]="'Delete entity'"`).
- **Forms and accessibility:** every input, select and textarea has a `name` and a label; free-text inputs that are
  not personal data set `autocomplete="off"`. A select gets its own `<label for>` + `id` (a wrapping label folds the
  option text into its accessible name), and each `<option>` reflects the current value with `[selected]`.
- **Accessible names are a test contract.** Specs find elements by role and name (`getByRole('button', { name: 'Save' })`,
  `getByLabelText('Sort')`), so renaming a heading, label or button is a change to its specs.
- **Dates:** a date filter is a day in the viewer's time zone, sent as local midnight in ISO-8601; dates are shown
  with `date: 'medium'`.
- **Components are built in Storybook** (`@storybook/angular-vite`): each has a `*.stories.ts` beside it with one story
  per meaningful state, `args` for its inputs and `fn()` for its outputs.

## 5. Naming

**Files**

| what                     | pattern                                              | example                                         |
| ------------------------ | ---------------------------------------------------- | ----------------------------------------------- |
| API resource schema      | `db/schemas/<resource>.schema.ts`                    | `entity.schema.ts`                              |
| API DAO                  | `daos/<resource>.dao.ts`                             | `entity.dao.ts`                                 |
| API controller           | `controllers/<resource>.controller.ts`               | `entity.controller.ts`                          |
| API middleware           | `middlewares/<name>.middleware.ts`                   | `error.middleware.ts`                           |
| helper (API and web)     | `helpers/<name>.helper.ts`                           | `dao.helper.ts`, `entity-list-params.helper.ts` |
| model (API and web)      | `models/<name>.model.ts`                             | `dao.model.ts`, `entity.model.ts`               |
| web component / layout / page | `<name>.component.ts`, flat in its folder       | `pages/entity-list-page.component.ts`           |
| web service              | `services/<resource>.service.ts`                     | `entity.service.ts`                             |
| NgRx slice               | `store/<page-name>/<page-name>.{model,actions,reducer,selectors,effects}.ts` | `entity-list-page.effects.ts` |
| story                    | `<name>.stories.ts`, beside the component            | `confirm-dialog.stories.ts`                     |
| API unit test            | `tests/unit/<src path>/<file>.test.ts`               | `tests/unit/controllers/entity.controller.test.ts` |
| API DAO / API test       | `tests/db/<resource>.dao.test.ts`, `tests/api/<resource>.api.test.ts` | `entity.api.test.ts`             |
| web unit / browser spec  | `<file>.spec.ts` / `<file>.browser.spec.ts`, beside the file | `entity.service.spec.ts`                 |
| e2e spec                 | `e2e/pages/<page>.spec.ts`                           | `entity-list-page.spec.ts`                      |

Folders are plural (`controllers/`, `daos/`, `helpers/`, `middlewares/`, `models/`, `schemas/`); the file keeps the
singular suffix. Angular files sit flat in their folder — `pages/entity-list-page.component.ts`, never
`pages/entity-list/entity-list-page.component.ts` — and a slice lives under `store/`, not beside its page.

**Identifiers**

| what                    | pattern                                       | example                                                        |
| ----------------------- | --------------------------------------------- | -------------------------------------------------------------- |
| input type / schema     | `<Operation><Resource>Input` / `<operation><Resource>InputSchema` | `CreateEntityInput`, `listEntityInputSchema` |
| resource list pieces    | `<resource><Kind>`                            | `entityFilterInputSchema`, `entitySortInputSchema`, `entityDefaultSort` |
| schema builders         | `create<Thing>Schema`                         | `createFilterInputSchema`                                      |
| controller handler      | verb + resource                               | `listEntities`, `getEntity`, `getHealth` — never `entityController` |
| middleware              | `<name>Handler`                               | `errorHandler`, `notFoundHandler`                              |
| DAO class               | `<Resource>Dao`                               | `EntityDao`                                                    |
| NgRx action group       | `<Page>Actions`, `source` = page name         | `EntityListPageActions`, `'Entity List Page'`                  |
| feature key / selectors | `<PAGE>_FEATURE_KEY`, `select<Thing>`          | `ENTITY_LIST_PAGE_FEATURE_KEY`, `selectListInput`              |
| effect                  | `<what it does>$`                             | `stepBackPastLastPage$`, `navigateAfterSave$`                  |
| page / component class  | the name without a suffix                     | `EntityListPage`, `ConfirmDialog`, `MainLayout`                |

"Dao", not "Repository": a class per table returning rows is DAO-shaped. `PaginatedResult`, not `Connection`, which
names a cursor-paginated result.

## 6. Code style

- **API imports end in `.js`** (`'../models/error.model.js'`), as Node's ESM resolution requires; the web imports
  without an extension.
- **Type-only imports are inline:** `import { type Entity } from …` (`@typescript-eslint/consistent-type-imports`).
- **Named exports only.** A default export appears only where a tool requires one: config files, a story's `meta`,
  Playwright's global setup and teardown.
- **Comments explain why, and only where the code cannot.** Declaration files — resource schemas,
  `list-input.model.ts`, `dao.helper.ts`, DAOs, controllers — carry none; their names and structure carry the meaning,
  and this file explains them.
- **No non-null assertions (`!`), always braces (`curly`).** Unused variables are errors unless they start with `_`
  (`_next`, `_req`).
- **Size guardrails warn, they do not fail:** complexity 10, depth 4, 75 lines per function, 20 statements, 4 params,
  400 lines per file, 3 nested callbacks. Reducers skip the complexity rule; tests skip the function-length rule (and,
  on the web, the nesting rule).
- `*.controller.ts` files turn off `@typescript-eslint/require-await`, because every handler is `async` for one shape.

## 7. Testing

### 7.1 The tiers

| tier                         | answers                                                         | real                                     | stubbed                          | lives in                               | run                      |
| ---------------------------- | --------------------------------------------------------------- | ---------------------------------------- | -------------------------------- | -------------------------------------- | ------------------------ |
| API unit                     | does this function do the right thing with this input?           | the function                             | DAO, `req` / `res` / `next`, log | `api/tests/unit/` (mirrors `src/`)     | `pnpm test`              |
| API DAO                      | does the DAO's SQL return the right rows from a real Postgres?   | DAO, Drizzle, Postgres                   | —                                | `api/tests/db/`                        | `pnpm test:integration`  |
| API end to end               | does the API answer correctly over HTTP, all layers together?    | HTTP, Express, controllers, DAO, Postgres| —                                | `api/tests/api/`                       | `pnpm test:integration`  |
| web unit                     | is this service / slice / effect / helper / route right?         | the unit, `TestBed`                      | HTTP, store, actions, services   | `*.spec.ts` beside the file            | `pnpm test`              |
| web browser                  | does this component or page render and behave in a real browser? | the component, Chromium, Tailwind        | the store (mock), the router     | `*.browser.spec.ts` beside the file    | `pnpm test:browser`      |
| e2e                          | does a user flow work against the real API and database?         | everything                               | —                                | `web/e2e/pages/`                       | `pnpm test:e2e`          |

Storybook is not a test: it is where components are built and their states reviewed.

### 7.2 What each tier is for

**API unit — helpers and schemas** (`tests/unit/helpers/`, `tests/unit/db/schemas/`)
- *Real / stubbed:* pure functions and zod schemas; no database. SQL builders are checked through the SQL they render
  with `PgDialect`.
- *Assert:* every exported function, a happy case and at least one edge case. The list builders are tested against an
  ad-hoc field config (defaults, strictness, branch cap, allowlists), so a resource's schema test covers only its own
  columns and sort fields.
- *Not here:* anything that needs rows.
- *Add one when:* you add or change a helper, an operator, a scalar kind, or a resource's filter / sort wiring.

**API unit — controllers and middlewares** (`tests/unit/controllers/`, `tests/unit/middlewares/`)
- *Real / stubbed:* the handler is real and called directly. `mockRequest({ context, params, query, body })` puts a
  stub DAO from `createStubContext()` on `req.app.locals.context`; `mockResponse()` gives chainable `status` / `json` /
  `send` spies; `mockNext()` a spy `next`; `mockLog()` a spy `req.log` — all in `tests/utils/http-mocks.ts`. No app,
  no server.
- *Assert:* the response (`res.status`, `res.json`, `res.send`), or the error passed to `next`
  (`httpError(400)`), and what the DAO received. Every 400 also asserts the DAO was never called. The error handler's
  test asserts the status, the body, whether the message is hidden and the log level.
- *Not here:* body parsing, routing, real SQL — the API test and the DAO test own those; each rule of a list schema —
  the schema and builder tests own those, so a list handler needs one schema rejection, not one per rule.
- *Add one when:* you add a handler, a validation rule, an error mapping or a middleware.

**API DAO** (`tests/db/<resource>.dao.test.ts`)
- *Real / stubbed:* the real DAO on a throwaway `postgres:17-alpine` from Testcontainers, migrated with the drizzle
  migrator (the same `db/migrations/` and `__migrations__` table as drizzle-kit). One container per suite; each test
  clears the table first and seeds what it needs through `tests/utils/<resource>-seed.ts`.
- *Assert:* every method's happy path and edge cases (`NotFoundError`, `null` columns, partial updates); `list` for
  what only real rows show — pagination, sort with the tie-breaker and the default sort, the filters whose result
  depends on Postgres (case-insensitive matches, dates, an empty `in`), `and` / `or` / `not`, all combined — and that
  LIKE metacharacters and hostile input are treated as data.
- *Not here:* HTTP status codes or validation; the SQL each operator renders — the `dao.helper` test owns that.
- *Add one when:* you add a DAO method or a query path, or an operator whose result depends on Postgres.

**API end to end** (`tests/api/<resource>.api.test.ts`)
- *Real / stubbed:* the real app from `createApp`, served by `serve(app)` from `tests/utils/test-server.ts` on the real
  DAO and a Testcontainers Postgres, driven over `fetch`. Nothing is stubbed.
- *Assert:* every route's happy path; the errors only the real stack produces (a missing row's 404 on get / update /
  delete, a filter + sort + page sent as a real query string and answered from seeded rows, ISO-8601 dates in the
  JSON); and what `app.ts` adds around the handlers (malformed JSON → 400, a body over 100 kB → 413, an unmatched path →
  404 in the standard error shape).
- *Not here:* each validation branch — the controller unit test owns those.
- *Add one when:* you add a resource or a route, or change what `app.ts` mounts.

**Web unit** (`*.spec.ts`, jsdom)
- *Real / stubbed:* the unit under test inside `TestBed`. Services run against `provideHttpClientTesting` +
  `HttpTestingController`; effects get `provideMockActions` and fake services; anything reading the store gets
  `provideMockStore` with selector overrides.
- *Assert:* services — method, URL, params and body of each call; reducers — every action's resulting state, as plain
  function calls, with each navigation a `navigated({ state, params, queryParams })` fixture (into the page's own state
  and into another); selectors — `.projector(…)` for anything with logic; effects — the action each input maps to,
  plus the RxJS operators that matter (`switchMap` cancellation, `concatMap` ordering, `takeUntil` on `Leave`), driven
  by a `Subject` of actions; routes — every path renders its page and lands its `data.state` through
  `RouterTestingHarness`, and a response that returns after its page was left changes nothing, on the real router; the
  serializer — the deepest state and the merged params; helpers — a happy case and an edge case each.
- *Not here:* rendering details and styling — the browser spec owns those.
- *Add one when:* you add or change a service method, an action, a reducer branch, a selector with logic, an effect,
  a route or a helper. Every slice has its reducer and effects specs; selectors get a spec only once one has logic.

**Web browser** (`*.browser.spec.ts`, Chromium)
- *Real / stubbed:* the component or page rendered by Angular in real Chromium with Tailwind applied. Pages get
  `provideMockStore` and `provideRouter([])`; a component is mounted by hand — `TestBed.createComponent`, `setInput`
  for every required input, append to `document.body`, `autoDetectChanges()` — because `render()` (in
  `src/testing/render.ts`) starts change detection before inputs are set.
- *Assert:* through the `page` locators, by role and accessible name: each UI state of the status union, what a click
  or input dispatches (spy on `MockStore.dispatch` before `createComponent`), the page watch (the first route state
  loads, an equal one does not, a new one on the same component does, `Leave` on destroy — moved with
  `overrideSelector` + `refreshState()`), and for a component the outputs it emits.
- *Not here:* HTTP or effects — there is no backend; the e2e owns the full path.
- *Add one when:* you add a page, a component, a UI state or a control.

**e2e** (`web/e2e/pages/<page>.spec.ts`)
- *Real / stubbed:* everything — `ng serve -c e2e` on `:4300`, the API on `:3100`, Postgres in its own `app_e2e`
  database, created, migrated and emptied by the global setup. The dev database and any running dev or Compose stack
  are never touched; teardown stops Postgres only if setup started it.
- *Assert:* a user's flow end to end, seeding data through the API (`e2e/utils/api.ts`) and driving the UI: list,
  filter (and the filter in the URL), a deep link to a later page, back after _Next_, delete, stepping back off an
  emptied page; create and edit; a detail page and a missing one.
- *Not here:* edge cases a unit or browser spec can cover faster.
- *Add one when:* you add a page or a user-visible flow.

### 7.3 Which test do I write?

| change                                         | tests                                                                                   |
| ---------------------------------------------- | --------------------------------------------------------------------------------------- |
| new filter operator or scalar kind             | `unit/helpers/dao.helper.test.ts`, `unit/helpers/list-input.helper.test.ts`; a DAO test case only when its result depends on Postgres |
| new filterable / sortable column               | the resource's schema test                                                              |
| new validation rule or error mapping           | the controller unit test                                                                |
| new route                                      | the controller unit test, the resource's API test                                       |
| new DAO method or query path                   | the DAO test, the API test for its route                                                |
| change to `app.ts` (middleware, body limit)    | the API test                                                                            |
| new service method                             | the service spec                                                                        |
| new action / page state                        | the reducer spec, the effects spec if it requests, the page's browser spec               |
| new effect that requests                       | the effects spec, including a response after `Leave` (read) or after the page changed (write) |
| new component                                  | its browser spec and its story                                                          |
| new page or user flow                          | the slice specs, the page's browser spec, an e2e spec, a route in `app.routes.spec.ts`  |
| new resource                                   | all of the above — see [Adding a resource](#8-adding-a-resource)                         |

### 7.4 How tests are written

- **One top-level `describe` per file, named for the file's module:** `describe('entity.controller')`,
  `describe('error.middleware')`, `describe('entity.dao')`, `describe('entity.api')`,
  `describe('entity-list-page.effects')`. Nested `describe`s group functions or behaviours; hooks sit inside the
  top-level `describe`.
- **Name a case for the behaviour,** in plain words: `'forwards a 400 for an unknown param without reaching the DAO'`,
  not `'test list error'`.
- **Arrange / Act / Assert,** with `// Arrange` / `// Act` / `// Assert` comments once a case has more than one line
  in a phase.
- **Import test functions from `vitest`** (`describe`, `it`, `expect`, `vi`); no globals.
- **Find UI by role and accessible name**, never by CSS class or test id.
- **Mocks and fixtures live in `tests/utils/`** on the API and in `src/testing/` / `e2e/utils/` on the web, not in
  test files.
- The API's `vitest.config.ts` defines the projects `unit`, `db` and `api`; the web's `vitest.config.mts` defines
  `unit` and `browser`, run by `ng test` on Analog's Vitest builder. Every web spec and both setup files are in
  `tsconfig.spec.json`, because Analog compiles only that program; a spec outside it loses Angular's compiler (signal
  inputs stop working).

### 7.5 What not to test

A test is code to maintain: it earns its place by catching a bug no other test catches.

- **Name the bug first.** Before adding a test, name the failure only it would catch. If a lower tier, another test or
  the compiler already catches it, do not add it.
- **Test a behaviour once, at the cheapest tier that can see it.** Go up a tier only for what the lower one cannot see:
  real SQL (the DAO test), real HTTP and `app.ts` (the API test), the real router with route-level effects
  (`app.routes.spec.ts`), a real browser (browser specs), the whole stack (e2e). The higher tier covers that addition,
  not the lower tier's cases again.
- **No specs for wiring without logic:** the root component, layouts, a `createReducer(initial)` with no `on`, a
  one-line cast (`navigatedRoute`), an effect that only forwards to an Angular API (`navigate$`), a handler that returns
  a literal (`GET /`), a middleware the API test already drives (`notFoundHandler`). The tests that run through them
  prove them.
- **No specs for selectors that only pick a field,** and no case asserting that an action changes nothing because no
  reducer handles it.
- **Nothing the compiler enforces:** a filter or sort field naming a real column, a union type, a required input.
- **A caller tests its own branches, not its callee's rules.** A controller test needs one schema rejection, not every
  rule of the schema; a service spec checks method, URL, params and body, not how `toParams` drops defaults.
- **One behaviour per case.** Cases that differ only in data are one `it.each`; a case another one already implies goes.

## 8. Adding a resource

For a resource `user`:

**API**
1. `db/schemas/user.schema.ts`: copy `entity.schema.ts` — the table, then every schema and type in the fixed order,
   no comments.
2. `db/schema.ts`: `export const schema = { entity, user }`.
3. `daos/user.dao.ts`: copy `entity.dao.ts`, `implements Dao<User, ListUserInput, CreateUserInput, UpdateUserInput>`.
4. `models/app-context.model.ts`: add `userDao: UserDao`; `server.ts`: `userDao: new UserDao(db)`.
5. `controllers/user.controller.ts`: copy `entity.controller.ts`, swap the schemas and the DAO; mount the five
   handlers in `app.ts`.
6. Tests: `tests/unit/db/schemas/user.schema.test.ts`, `tests/unit/controllers/user.controller.test.ts` (add `userDao`
   to `createStubContext`), `tests/db/user.dao.test.ts` with `tests/utils/user-seed.ts`, `tests/api/user.api.test.ts`.
7. `pnpm --filter api db:generate --name add-user`, then `db:migrate`.

**Web**
1. `models/user.model.ts`: mirror `User`, its inputs, `UserFilterInput`, `UserSortInput`, `ListUserInput`.
2. `services/user.service.ts` and `helpers/user-list-params.helper.ts` (+ a filter-form helper if the list has one).
3. The new states (`user-list`, `user-detail`, `user-new`, `user-edit`) in `AppState`
   (`store/app-router/app-router.model.ts`), and one route per state in `app.routes.ts` with its `data: { state }`.
4. One slice per page under `store/user-<page>-page/`, registered on its route, its reducer writing its route state on
   `routerNavigatedAction` for its own state.
5. The pages under `pages/`, following [the page contract](#45-the-page-contract), each with its watch.
6. Tests: the service, helper and slice specs, a browser spec per page, e2e specs per page, the new routes and states
   in `app.routes.spec.ts`.

## 9. Formatting, lint and Docker

- **Prettier formats, ESLint judges.** `eslint-config-prettier` is the last entry of each flat config and switches off
  every formatting rule; `eslint-plugin-prettier` is not used. `pnpm lint` reports code problems, `pnpm format:check`
  formatting; CI runs both. Each project owns its `.prettierrc` / `.prettierignore` (`singleQuote`, `printWidth: 140`,
  `trailingComma: 'none'`); there is no root config.
- ESLint runs type-checked (`recommendedTypeChecked`, `projectService`); the web adds angular-eslint (with inline
  templates) and Storybook's rules.
- **Docker:** both images build with the repo root as context (`catalog:` resolves only against the root
  `pnpm-workspace.yaml` and lockfile), from one root `.dockerignore`. The API image runs `node:24-alpine`; the web image
  builds with Node and serves the bundle from `nginx:1.27-alpine` with an SPA fallback and no `/api` proxy. Postgres is
  `postgres:17-alpine`, its data bind-mounted at `api/db/data/`.

## 10. Not done on purpose

Each was tried or considered and rejected; the reason is the line after the dash.

- **No `/api` reverse proxy, no runtime `config.json`** — the API URL is build-time config, and a proxy would couple the
  web image to the API's address.
- **No routers** — direct mounts on the app read clearer at this size.
- **No context middleware** — the context does not vary per request; it is a singleton on `app.locals`.
- **No `parseOr400` / `translateNotFound` helpers** — inlined validation shows every error a handler can produce.
- **No Drizzle outside DAOs, no "Repository"** — DAOs keep SQL out of the HTTP edge; "Repository" promises a domain
  layer that does not exist.
- **No `checkDatabase()` helper** — the health probe is one `SELECT 1`.
- **No `pino-pretty` import** — the logger always emits JSON; `dev` pipes it.
- **No hand-written TypeScript mirrors of zod schemas** — every type is a `z.infer`, so the two cannot drift.
- **No column maps for filters and sorts** — fields are named after the columns, and the compiler checks them.
- **No cursor pagination** — admin tables need a total and random page access.
- **No `db:push`, no shipped migrations, no `--env-file-if-exists`** — schema changes go through migrations, and a
  missing `.env` fails loudly.
- **No caret on TypeScript** — one exact 6.0.x for both projects, inside both peer ranges.
- **No `eslint-plugin-prettier`** — formatting is `format:check`'s job.
- **No per-project Docker build context** — `catalog:` needs the root lockfile.
- **No `types/` folder** — `models/` holds shapes and errors; `express.d.ts` stays at `src/`.
- **No global per-resource slice** — each page owns its slice, with the route state it needs.
- **No `ActivatedRoute`, `Router`, router selectors or `FormBuilder` in pages** — every route read reaches a page through
  its slice; links are `routerLink`, and every other navigation is an action.
- **No "statechart" claim** — routes name states, but reducers do not guard transitions; the request rules keep late
  results out instead.
- **No cancelling a save on `Leave`** — the user asked for it; its result carries its page instead.
- **No loading from the router** — no effect reacts to `routerNavigatedAction`; the page's watch decides when to load.
- **No query written to a slice by the app** — a filter, sort or page change navigates, and the reducer copies the new
  URL; there is no store → URL sync to keep in step.
- **No boolean `loading` / `saving` flags** — one status union cannot contradict itself.
- **No SCSS or per-component CSS files** — Tailwind utilities in inline templates.
- **No `@Input()` decorators** — components keep signal `input()` / `output()`, and their browser specs set them with
  `setInput`.
- **No `zone.js`** — the app, the tests and Storybook all run zoneless.
- **No webpack Storybook, no `@angular/build:unit-test`** — Storybook and the tests share the app's Vite / Analog
  toolchain.
- **No HTTP server in API unit tests** — controllers and middlewares are functions, tested as functions.
- **No stubbed web e2e, no e2e against the dev database** — the e2e proves the web↔API contract on its own stack.

## 11. Before you merge

- [ ] `pnpm build && pnpm typecheck && pnpm test && pnpm lint && pnpm format:check` passes.
- [ ] `pnpm test:integration` passes if you touched the API's DAOs, schemas, controllers or `app.ts`.
- [ ] `pnpm test:browser` passes if you touched a component or page; `pnpm test:e2e` if you changed a user flow or the
      web↔API contract.
- [ ] A new page route declares its `data: { state }`, and the page reads only its slice and loads from its watch.
- [ ] A new read effect ends on its page's `Leave`; a write's follow-up acts only for the page that started it.
- [ ] A schema change comes with its migration (`db:generate`), committed.
- [ ] An API type change is mirrored in the web's `models/`.
- [ ] Every new building block has the tests [7.3](#73-which-test-do-i-write) lists, and none [7.5](#75-what-not-to-test)
      rules out; a new component has a story.
- [ ] This file still describes the code: a change to a rule changes it here in the same commit.
