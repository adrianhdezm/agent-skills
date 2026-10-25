# Decisions and their reasons

Each entry names a choice the scaffold makes, the alternative it rejects, and why. Read this before changing a
convention, so a rejected alternative is not reintroduced by accident.

## Contents

- [Infrastructure](#infrastructure): API URL, Docker build context, Postgres data, migrations, env file
- [Tooling](#tooling): TypeScript, catalog, tsconfig, Prettier vs ESLint, dev loop, tests
- [API](#api): context, routers, controllers, errors, logging, query parsing
- [DAO layer](#dao-layer): contract, filter inputs, sorting, pagination, file layout, naming
- [Web](#web): URL as state, slice placement, file layout, templates, styling, Storybook, the three test layers

## Infrastructure

### The browser calls the API directly, configured by the Angular environment file

| approach                     | verdict  | why                                                                                                |
| ---------------------------- | -------- | -------------------------------------------------------------------------------------------------- |
| Nginx `/api` reverse proxy   | rejected | couples the web image to the API's address; the API URL should be configuration, not a route       |
| Runtime `config.json` fetch  | rejected | a startup round-trip and extra code for no gain while every environment uses the same URL shape    |
| **Angular environment file** | chosen   | zero runtime cost; one build works on any host by deriving the URL from `window.location.hostname` |

So the browser calls the API host on port 3000, and Nginx serves static files with an SPA fallback only.

### Docker images build from the repo root

Each manifest uses `catalog:` entries, which resolve only against the root `pnpm-workspace.yaml` and `pnpm-lock.yaml`.
A context of `./api` or `./web` cannot see them, and `pnpm install` fails. Both Dockerfiles therefore take the repo root
as context, copy the root manifests plus their own, and install with `--filter <pkg> --frozen-lockfile`. Corepack reads
the pnpm version from the root `packageManager` field, so no Dockerfile hardcodes it.

### Postgres data is bind-mounted, not a named volume

`./api/db/data/` is easier to inspect from the host and to reset (`rm -rf api/db/data/`) than a Docker-managed volume.

### No migrations ship with the scaffold

The first `pnpm --filter api db:generate --name init` emits one clean snapshot, named and timestamped by the user. A
shipped migration would carry the skill's clock, diverge from the schema source on the first edit, and imply a history
that does not exist on day one. There is no `db:push`: schema changes always go through `db:generate` + `db:migrate`.

### `--env-file` is strict

The API should fail fast when `.env` is missing, so `dev` and `start` use `--env-file=../.env`, not
`--env-file-if-exists`. `drizzle.config.ts` throws when `DATABASE_URL` is unset, with no fallback — and `db/client.ts`
does the same at runtime: it reads `process.env.DATABASE_URL` and throws if it is absent, rather than defaulting to a
hardcoded local connection string (which would both embed a credential in source and mask a misconfiguration).

## Tooling

### TypeScript is pinned exactly, once, in the catalog

Angular 22 requires TypeScript `>=6.0 <6.1` and typescript-eslint supports `<6.1`. Pinning both projects to the same
exact 6.0.x version keeps the API and web on one compiler and lets TypeScript live in the catalog. A caret range would
let an install pick up a 6.1 that typescript-eslint rejects. Move both together when the peer ranges move.

### The catalog holds only shared packages

A package goes in `catalog:` only when two or more manifests use it with the same range. Everything else is a direct
dependency of the one manifest that uses it. Versions are resolved by `pnpm add` at scaffold time, not copied from a
table, so a new project starts on current releases within the pinned majors.

### The tsconfig solution root has no compilerOptions

`tsconfig.json` is a pure solution file (`files: []` + `references`). All compiler options live in `tsconfig.app.json`;
`tsconfig.node.json` extends it for the tests and config files, sets `composite: false` because the tests import from
`src/`, and lists every config file in `include` so ESLint's project service finds them. `types: ["node"]` is explicit
because TypeScript 6 defaults `types` to `[]`.

### Prettier formats, ESLint judges

`eslint-config-prettier` switches off ESLint's formatting rules; `eslint-plugin-prettier` is not used. Running Prettier
inside ESLint makes `lint` slower, reports formatting as code problems, and duplicates `format:check`. CI runs both
`lint` and `format:check`. This matches the other `create-*` scaffolds.

### Prettier configs are per project

Each project owns its `.prettierrc` and `.prettierignore`, so the web's Angular HTML override does not leak into the
API. To share one config later, add a root `.prettierrc` and delete the per-project ones.

### The dev loop is `node --import=tsx --watch`, not `tsx watch`

Node's `--watch` provides the restart loop and `--import=tsx` the TypeScript loader: stock Node, one concern each.

### Tests run in three projects; only the DAO tier needs a database

The API is tested in three vitest `projects`. `unit` and `api` run without Postgres: the filter / sort translator
through the SQL it renders with `PgDialect`, the list-input builders directly, and the controllers through `createApp`
with a fake DAO on the context, driven over real HTTP with `fetch` (not `supertest`). The `db` project uses
Testcontainers (`@testcontainers/postgresql`) to run the real DAO against a throwaway `postgres:17-alpine`, migrated
with the drizzle migrator. The DAO used to be covered only by the Compose smoke test; the `db` tier now exercises
`list`'s filter, sort and pagination exhaustively (each alone and combined) against real Postgres, plus the create /
get / update / delete happy and edge paths. It is a separate `pnpm test:db` script so the default `pnpm test`
(`unit` + `api`) stays Docker-free and runs in CI without a daemon; `test:db` needs Docker and an existing
`db/migrations/` (so it runs after the first `db:generate`). The web tests the URL (de)serializer every list page
depends on. `test` is a required check in both projects.

### One vitest config with projects, not multiple config files

A single `api/vitest.config.ts` defines named `projects` (`unit`, `api`, `db`) selected by folder glob, with shared
options at the root that each project inherits. A second `vitest.config.db.ts` was tried and dropped: two config files
duplicated the shared setup and drifted. Scripts pick projects on the command line — `test` runs
`--project unit --project api`, `test:db` runs `--project db` — so one config serves every suite.

### Tests are grouped by kind, each file one describe

`api/tests/` is split into `unit/`, `api/`, `db/` and `utils/` by test kind, not mirrored against `src/`. Each test
file wraps its suites in a single top-level `describe` named for the module under test (`describe('entity.dao')`,
`describe('dao.helper')`, …), with nested describes only where a file covers several functions. There is one route-test
file per controller (`entity` / `home` / `health`). `utils/` holds shared, non-test helpers: the Testcontainers
bootstrap (`pg-container.ts`), the fake-DAO / app factory (`fake-dao.ts`), the HTTP test-server helper
(`test-server.ts`) and seed generators (`entity-seed.ts`). Grouping by kind is what lets the vitest `projects` select a
suite by folder and keeps the Docker-free tiers apart from the DB tier.

## API

### The context is a singleton on `app.locals`, not a middleware

`app.locals.context = context` is set once in `createApp`. A middleware would suggest the context varies per request
(it does not) and add a call to every request. The same singleton is what lets tests inject a fake DAO.

### No routers

`app.get('/health', getHealth)` on the app is clearer than an intermediate router at this size. Controller handlers are
named verb+resource — `listEntities`, `getEntity`, `createEntity`, `updateEntity`, `deleteEntity`, and likewise
`getHealth` / `getHome` — not `<noun>Controller`. Middleware exports pair as `errorHandler` + `notFoundHandler` (the
`*Handler` suffix; the files keep the `*.middleware.ts` name).

### Controllers are fully inlined

Each handler validates, calls its DAO, and translates errors itself, so it reads top to bottom. Helpers like
`parseOr400` or `translateNotFound` would hide which errors each handler can throw, so the list handler validates
its query with `safeParse` like the body and id, rather than through a throwing `parseQuery` helper. The one shared
piece is `normalizeQuery`, which is transport-agnostic and lives in `helpers/`.

### Data access goes through DAOs, never Drizzle in controllers

The controller is the HTTP edge. Mixing SQL with request parsing makes both harder to test and to reuse from a
background job. DAOs are instantiated once in `server.ts` and placed on the context.

### "Dao", not "Repository"

One class per table returning raw rows is DAO-shaped; "Repository" promises a domain abstraction that does not exist
yet. A later domain layer can add repositories that compose DAOs.

### DAOs throw sentinel errors; controllers translate them

DAOs throw `NotFoundError` from `models/error.model.ts`, and controllers turn it into a 404 with `http-errors`. DAOs
stay callable from non-HTTP code. Validation failures need no sentinel: the controller sees the `safeParse` result
directly and answers 400. A `QueryParseError` thrown by a `parseQuery` helper was removed with that helper.

### Error severity follows status

The error handler logs 5xx at `error` and 4xx at `warn`. Logging every 404 as an error buries the real faults.

### `pino-pretty` is a pipe, never an import

The logger always emits JSON; the `dev` script pipes it through `pino-pretty`. Configuring a `transport` in code would
couple the logger to a devDependency.

### The health probe runs `SELECT 1` inline

A `checkDatabase()` helper would wrap one line. The probe is not a resource, so it has no DAO.

### `models/` and `helpers/`, not `types/`

`models/` holds `*.model.ts` type files and error classes, matching the web's model convention. `helpers/` holds
transport-agnostic functions. `express.d.ts` stays at the `src/` root: it is TypeScript tooling, not a model.

### The query normalizer takes a plain params dict

`normalizeQuery(params)` works with `req.query`, another framework, `URLSearchParams.entries()` or a test fixture.
Taking an Express `Request` would tie it to one transport.

## DAO layer

### Filter inputs follow AppSync's `Model<Type>FilterInput`

| approach                                           | verdict  | why                                                                                                                                                                                                        |
| -------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hasura `where` tree (`_eq`, `_ilike`, `_and`, …)   | rejected | the zod side was typed, but the SQL translator worked on `Record<string, unknown>` and a string-keyed column map, so the types stopped where they mattered most                                            |
| flat per-resource filters (`name`, `createdAfter`) | rejected | every new case is a new field plus a new SQL clause, and OR / NOT cannot be expressed                                                                                                                      |
| **typed filter input per column kind**             | chosen   | `IdFilterInput`, `StringFilterInput`, `NumberFilterInput`, `DateFilterInput`, `BooleanFilterInput`, plus nestable `and` / `or` / `not`: a familiar model, fully inferred, and one translator for all kinds |

AppSync's set is adapted: `between` is a validated `[from, to]` pair, `in` exists for every kind except boolean,
`contains` / `notContains` / `beginsWith` are case-insensitive, and ids drop the string operators that make no sense
on a uuid.

### One contract, single-input methods

`Dao<T, ListInput, CreateInput, UpdateInput>` with `get({ id })`, `list(input)`, `create(input)`, `update(input)` and
`delete({ id })`. Each method takes one named input object, so new fields never break call sites. The update input
carries its `id`, as AppSync's `UpdateXInput` does. `delete` returns `void`. The list input is one generic
(`ListEntityInput`), not separate filter and sort-field generics, so a DAO never names those types. `findOne`,
`getMany`, an `{ attrs }` wrapper and `deleteMany` were dropped.

### Page-based pagination with a total, not cursors

`page` / `pageSize` with `{ items, total, page, pageSize, totalPages }` suits admin tables: jump to any page, show
"page X of Y". Cursor pagination (`limit` + `nextToken`) has no total and no random access. Revisit it for feeds or
very large tables.

### Filter and sort fields are named after their columns

The DAO passes the drizzle table itself to `filterToSql` / `sortToSql`, and `FilterTable` / `SortTable` make a field
without a matching column a compile error. Explicit field-to-column maps, and later a `ListConfig` object holding
them, were tried and removed: they repeated the table line for line. If an API field ever needs a different name or a
computed expression, that resource brings a map back.

### `list` runs its two queries one after the other

The page query and the count query run in sequence, not with `Promise.all`. In parallel they would take two pool
connections per request to save one round trip; in sequence the code reads top to bottom and each request holds one
connection at a time. Neither form is a consistent snapshot: when `total` must match the page exactly, wrap both in a
transaction. A single query with `count(*) over ()` was rejected because a page past the end returns no rows and so
no total.

### Every resource declares a default sort

Without `ORDER BY`, Postgres returns rows in no guaranteed order, so pages can repeat or skip rows. The DAO uses
`<resource>DefaultSort` when no sort is given, and `sortToSql` always appends an `id` tie-breaker.

### Resource-specific pieces live in the resource schema file

`db/schemas/<resource>.schema.ts` holds the table, the create / update / list inputs and their schemas, and the
default sort, so the DAO only runs queries. `db/schema.ts` is a registry, `export const schema = { entity }`, imported
by the client as `{ schema }`. `drizzle.config.ts` points at `src/db/schemas/*.schema.ts`, because drizzle-kit finds
tables from module exports, not inside an object.

### The vocabulary is built with `create<Thing>Schema` builders, kept in a helper

`createFilterInputSchema({ column: scalarFilterInputSchema, … })`, `createSortInputSchema([...])` and
`createListInputSchema({ filter, sort })` make every list piece read the same way in each resource schema. The three
builders and the page-size limits live together in `helpers/list-input.helper.ts`, while `models/list-input.model.ts`
keeps the scalar filter inputs, `sortDirectionSchema` and the inferred types. The split follows the suffix rule —
`*.helper.ts` is functions, `*.model.ts` is shapes and types — and the helper imports the scalar schema type from the
model (no cycle: the model never imports the helper). Keeping the builders out of the model also gives them a direct
test (`tests/unit/list-input.helper.test.ts`) against an ad-hoc field config, instead of only being exercised through a
resource's schema test. `models/dao.model.ts` keeps only the contract (`Dao`, `PaginatedResult`, `IdInput`), with no
zod and no drizzle.

### The list input type is inferred from its schema

`ListEntityInput = z.infer<typeof listEntityInputSchema>`, like every other input. A hand-written generic `List<Filter,
SortField>` in `dao.model.ts` was removed: it was the one input type not derived from a schema, and it described page
fields as optional although the schema always fills them in. `Dao`'s list parameter needs no constraint, because
`sortToSql` already rejects a sort field that is not a column of the table.

### One translator for every scalar kind

The zod schemas already reject operators a kind does not support, so `filterToSql` handles every operator without
knowing the kind. Five per-kind translators were tried first and collapsed into one. `FieldFilterInput`, the
translator's input type, is derived from the scalar inputs, so the two cannot drift.

### Types come from `z.infer`

The zod schemas are the source of truth (`type EntityFilterInput = z.infer<typeof entityFilterInputSchema>`). The row
type follows the same rule, `type Entity = z.infer<typeof selectEntitySchema>` rather than `typeof entity.$inferSelect`,
so every type in a resource schema file comes from a schema. The
recursive filter type is inferred through the builder's getters; a hand-written mirror would drift on every operator
change.

### The controller decodes the URL; the list input schema does not

The list input schema validates the structured `{ filter, sort, page, pageSize }` the DAO takes, and the list
controller turns the URL into that shape in plain sight: reject unknown params, `JSON.parse` the filter, build `sort`
from `sortField` / `sortDirection`, convert the page numbers. A schema that also decoded JSON strings and coerced
numbers (a `jsonQueryParam` inside it) made the DAO's input type depend on the HTTP encoding, so the DAO could not be
called cleanly from code that already holds objects.

### Names follow the operation

Inputs are `<Operation><Resource>Input` (`CreateEntityInput`, `UpdateEntityInput`, `ListEntityInput`) with schemas
`<operation><Resource>InputSchema`; per-resource list pieces are `<resource><Kind>` (`entityFilterInputSchema`,
`entitySortInputSchema`, `entityDefaultSort`). `PaginatedResult` was chosen over AppSync's `Connection`, which names a
cursor-paginated result.

## Web

### Web list types mirror the API by hand

`models/<resource>.model.ts` repeats `EntityFilterInput`, `EntitySortInput`, `ListEntityInput` and
`PaginatedResult` with the API's names and shapes. Sharing a types package between the projects was not worth its
build wiring at this size; keeping the names identical makes a drift easy to spot in review.

### The URL is the source of truth for list queries

List pages dispatch `AppRouterActions.navigate({ commands: [], queryParams })`, and the list effect loads whenever
the list input in the URL changes. The
alternative, a query slice synced to the URL by an effect, needs two-way sync. URL-first gets refresh, back, forward,
deep links and bookmarkable views for free. The list page slice holds only server data; the list input is derived
from `router.state.queryParams` by a selector.

### One slice per page, registered on its route

Each page owns `store/<page-name>/` and registers it with `provideState` + `provideEffects` on its route. A single
global `entities` slice shared by the list, detail and form pages was tried and replaced: in practice each page read
almost only its own fields (only the current entity was shared), and the cross-page reducer updates (prepend on
create, patch on update) were redundant once the list fetches fresh data on every visit and after a delete. Per-page
slices keep each page's actions and state together. The cost is that detail and form each load the entity, one extra
request when going from detail to edit. Resource types shared by the slices live in `models/`, and only `appContext`
and the router state (`appRouter`) stay global.

### Pages inject only the Store

Pages read the route from the app-router slice (`selectRouteParam`, `selectQueryParams`) and navigate by dispatching
`AppRouterActions.navigate`, whose effect is the only caller of the Angular `Router`; forms are built with
`new FormGroup`. With `ActivatedRoute`, `Router` and `FormBuilder` injected into pages, routing was split between
the store and the components, and a navigation after a save lived in a page `effect()` watching a `savedId` flag.
Keeping pages to the store makes every route read and every navigation visible as state and actions, and leaves
service injection to effects.

### Data access lives in a service, called from effects

`services/entity.service.ts` holds every HTTP call for the resource. Effects used to build URLs, params and the
`apiBaseUrl` lookup themselves, repeated across three page slices; with one service the request shape is written once,
and effects only map results to actions. The service is injected only in effects, so pages still talk to the store
alone.

### One status union per page, not boolean flags

Each page state has `status: 'idle' | 'loading' | 'loaded' | … | 'error'` and an `error` message. Independent
booleans (`loading`, `saving`, `deleting`, plus separate error fields) could contradict each other, `loading` and an
error at once, and made templates combine flags. A single union names every state the page can be in, and the
template switches on it.

### Pages load through Load and Leave

Every page dispatches `Load` on init and `Leave` on destroy, and reducers reset on both. The list page used to load
from `routerNavigatedAction` alone; it now dispatches `Load` like the others, and its effect follows the list input
in the URL until `Leave`, dispatching `Fetch({ input })` for each value, so the first load and later query changes
take the same path.

### Actions name intent, not lifecycle

The page action was first called `Enter`, which names a moment of the component lifecycle rather than what the page
asks for. It is `Load`: the page wants its data, and the same action would fit a refresh button or a retry. The list's
per-request action is `Fetch` (one request for one input), and results are `<Action> Success` / `<Action> Failure`. A selector that returns
`null` while the URL belongs to another page stops a navigation away from loading the list once more.

### A page on several routes registers its slice once

The form page serves `entities/new` and `entities/:id/edit`. Registering its slice on both routes would add its
effects twice, so the two routes sit under one componentless parent route that provides the slice.

### Store code lives under `store/`, mirroring `pages/`

Slices are not colocated under `pages/<page>/store/`. `pages/health-page.component.ts` pairs with
`store/health-page/*.ts`.

### Flat files with the `.component.ts` suffix

`pages/health-page.component.ts`, not `health/health-page.ts`, following the Angular style guide's CLI 20+ direction.

### Inline templates, no HTML or SCSS files

One file per component. Angular ESLint's `processInlineTemplates` still lints the templates.

### Tailwind utilities, no SCSS or per-component CSS

Styling is Tailwind utilities in the template plus a `host` class for host-element rules. The only global stylesheet is
`src/styles.css`.

### Tailwind preflight only without Fundamental NGX

`styles.css` imports Tailwind's layers one by one. Preflight is on by default; with FD-NGX it is removed, because its
reset clobbers FD-NGX's base styles, and `body` margin and font are set by hand.

### Storybook runs on the Vite/Analog builder, not webpack

Components (`components/`, `input()`/`output()`, store-free) are developed and documented in Storybook. The Angular
webpack builder (`@storybook/angular`) would pull a second, webpack toolchain into a project that is deliberately
esbuild/Vite (`@angular/build`). `@storybook/angular-vite` compiles Angular through `@analogjs/vite-plugin-angular` on
Vite instead, so Storybook shares the app's toolchain (and the one the browser tests use). `zone.js` and
`@angular/animations` come along as peers of the Storybook Angular tooling, not because the app uses them — the app is
zoneless.

### Web tests are three layers, and `web` is pinned to Vitest 4

`ng test` (Vitest + jsdom, via the Angular builder) covers services, every slice and the helpers as `*.spec.ts` beside
the file — the required `test` check. On top, **browser-mode** page tests (`pnpm test:browser`, Vitest browser mode +
Playwright) render each page in real Chromium with a mocked store, and **full-stack e2e** (`pnpm test:e2e`, Playwright
Test) drives the real app → API → Postgres. The jsdom layer is kept fast and Docker-free; the real browser and the
backend only enter the two opt-in scripts.

`web` is pinned to **Vitest 4** (`vitest`, `@vitest/browser`, `@vitest/browser-playwright` all pinned to the one exact
version `4.1.12`, no caret — so the tightly-coupled browser-mode family cannot drift to different 4.x minors, the same
reasoning as the exact TypeScript pin). Vitest 5's
browser mode never injects its `@vitest/browser/context` virtual module here — the toolchain (Storybook, Analog,
`@angular/build`, the API) resolves several `vitest@5` realms, so the `vitest` running the browser plugin and the
`@vitest/browser` the test imports are different instances and `page` throws. `@angular/build` accepts
`vitest ^4.0.8 || ^5.0.0`, so `ng test` is unaffected; the API, a separate package, stays on Vitest 5. Revisit when
browser mode works on 5 in this workspace.

### The web e2e is full-stack, not stubbed

`pnpm test:e2e` starts the real app (`ng serve`), the real API (node) and real Postgres (compose), applies migrations
and truncates, then drives CRUD through the browser, seeding setup data through the API `request` fixture. Stubbing the
API with `page.route` was the first cut and dropped: the point of the e2e layer is the web↔API contract (the web
mirrors the API types by hand), which a stub cannot catch. The cost is that `test:e2e` needs Docker and the root
`.env`; the fast jsdom and browser-mode layers do not, so only this script depends on the backend.

### Signal-input components are covered by Storybook + e2e, not browser-mode unit tests

Analog's browser-mode compile emits empty `inputs`/`outputs` metadata for components that use signal `input()` /
`output()` (a rendered component's `ɵcmp.inputs` is `[]`), so neither a parent template binding nor `setInput` can
reach them in Vitest browser mode (`NG0303` / `NG0315`). AOT, JIT, split projects/processes and the
`vitest-browser-angular` helper were all tried; none recovered the metadata. Rather than drop signal inputs (switching
`ConfirmDialog` to `@Input()`/`@Output()` would make it browser-testable but abandons the component convention), such
components are exercised in **Storybook** and through the **e2e** flow, and the browser-mode layer sticks to the pages
(which read the store, not component inputs). The list page's browser spec therefore asserts rendering only; the delete
flow through `ConfirmDialog` is an e2e test.
