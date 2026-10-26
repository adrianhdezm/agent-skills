# Decisions and their reasons

Each entry names a choice the scaffold makes, the alternative it rejects, and why. Read this before changing a
convention, so a rejected alternative is not reintroduced by accident.

## Contents

- [Infrastructure](#infrastructure): API URL, Docker build context, Postgres data, migrations, env file
- [Tooling](#tooling): TypeScript, catalog, tsconfig, Prettier vs ESLint, dev loop, tests
- [API](#api): context, routers, controllers, errors, logging, query parsing
- [DAO layer](#dao-layer): contract, filter inputs, sorting, pagination, file layout, naming
- [Web](#web): route-driven state, store and router, request lifetimes, slice placement, file layout, templates, styling, Storybook, the three test layers

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

### Tests run in three projects: unit tests apart from end-to-end API tests

The API is tested in three vitest `projects`. `unit` runs without Postgres: the filter / sort translator through the
SQL it renders with `PgDialect`, the list-input builders directly, and every controller and middleware **called as a
plain function** — a mock `req` with a stub DAO on `req.app.locals.context`, a spy `res`, a spy `next`. `db` and `api`
use Testcontainers (`@testcontainers/postgresql`) with a throwaway `postgres:17-alpine`, migrated with the drizzle
migrator: `db` runs the real DAO directly, exercising `list`'s filter, sort and pagination exhaustively (each alone and
combined) plus the create / get / update / delete happy and edge paths; `api` serves the real app on the real DAO and
drives each route end to end.

The two tiers answer different questions. A unit test checks one function: what a controller does with its input and
with whatever the stub DAO returns, or what a middleware does with an error, so every validation, error-mapping and
logging branch is cheap to reach and assert directly (which error went to `next`, which log level the error handler
used). It cannot see what `app.ts` adds around the handlers — body parsing, the route table, the not-found → error
chain — nor show that the real DAO accepts what the controller sends. The API test covers exactly that, per resource.

The controllers were tested two other ways first. A `tests/api/` folder started the whole app on a port with a fake
DAO and drove it over `fetch`, so the folder named `api` held the narrow tests while the one real round trip lived in
`tests/db/entity.full-stack.test.ts`. Renamed to `tests/controllers/`, those tests still booted pino-http, CORS and
`express.json()` for every case: slower, and testing Express as much as the controller. Calling the handlers directly
removed the fake app factory (`fake-dao.ts`, `startTestServer`) and left `serve(app)` for the API tests only.

The Docker tiers are a separate `pnpm test:integration` script (it was `test:db` while it ran only the DAO suite), so
the default `pnpm test` (`unit`) stays Docker-free and runs in CI without a daemon; `test:integration` needs Docker
and an existing `db/migrations/` (so it runs after the first `db:generate`). The web's layers are under [Web](#web).
`test` is a required check in both projects.

### One vitest config with projects, not multiple config files

A single `api/vitest.config.ts` defines named `projects` (`unit`, `db`, `api`) selected by folder glob, with shared
options at the root that each project inherits. A second `vitest.config.db.ts` was tried and dropped: two config files
duplicated the shared setup and drifted. Scripts pick projects on the command line — `test` runs `--project unit`,
`test:integration` runs `--project db --project api` — so one config serves every suite.

### Tests are grouped by kind; unit tests mirror `src/`

`api/tests/` is split into `unit/`, `db/`, `api/` and `utils/` by test kind, which is what lets the vitest `projects`
select a suite by folder and keeps the Docker-free tier apart from the Docker ones. Inside `unit/`, files mirror
`src/` (`unit/helpers/dao.helper.test.ts`, `unit/db/schemas/entity.schema.test.ts`,
`unit/controllers/entity.controller.test.ts`, `unit/middlewares/error.middleware.test.ts`), so a module's test is found
by its path; `db/` and `api/` hold one file per resource. Each test file wraps its suites in a single top-level
`describe` named for the file's module (`describe('entity.dao')`, `describe('error.middleware')`,
`describe('entity.api')`, …), with nested describes only where a file covers several functions. `utils/` holds
shared, non-test helpers: the unit-test stand-ins (`http-mocks.ts`), the Testcontainers bootstrap (`pg-container.ts`),
`serve(app)` for the API tests (`test-server.ts`) and seed generators (`entity-seed.ts`).

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
Every source folder is plural — `controllers/`, `daos/`, `helpers/`, `middlewares/`, `models/`, `db/schemas/` — and
the files inside keep the singular suffix (`error.middleware.ts`, `entity.dao.ts`).

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
test (`tests/unit/helpers/list-input.helper.test.ts`) against an ad-hoc field config, instead of only being exercised through a
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

### Route-driven state: routes name the states

Each page route declares its state in `data: { state }`, typed by `AppState`, and each page's `status` union names
what the page is doing. Naming the states makes the app's shape readable from `app.routes.ts` alone, gives page
reducers one string to match a navigation on, and makes a misspelled state a compile error and a wrong one an e2e
failure (the page opened by its URL never loads), instead of a path comparison (`url === '/entities'`) repeated in selectors.

This was called a statechart, and a review showed the name promised more than the code does: reducers apply any action
in any status, and nothing rejected a completion that belonged to a page already left. Making it a real statechart
would mean a guard on every reducer handler, for each slice; the bugs it would have prevented are closed more cheaply
by the request-lifetime rules below. The states and status unions stay; the name is route-driven state.

### The router writes URL state into the page slice; pages read only their slice

The URL enters the store one way: `routerNavigatedAction` → the page reducer whose state matches copies the params
or query it needs (the list input, the detail id, the form target). A list query change dispatches
`AppRouterActions.navigate`, never a store action, and arrives back through the reducer. Pages read only their slice.

Two alternatives were tried or weighed:

- **List input derived from a router slice by a selector** (router-store's `routerReducer` state as the store's
  only copy of the URL). Pages read router state,
  so the store moved to the next URL while the old page was still mounted (`ROUTER_NAVIGATION` precedes the old page's
  destruction), which needed a `selectListInputOnListPage` guard returning `null` off the list URL; and the detail
  page, reading its id once on init, did not reload when Angular reused it for another id.
- **A store-owned query synced to the URL** (a `Change Query` action, then an effect writing the URL). The store is
  ahead of the URL, but every user change makes a navigation that echoes back as `routerNavigatedAction`, so the
  reducer had to recognize an equal query, and the effect had to tell a user's change from a browser's.

Router first, slice second keeps one loop with no echo and no guard; refresh, back, forward and deep links all enter
through the same action. The cost is that a query change waits for a navigation before it fetches (about 14 ms in dev
mode), which nobody notices.

### One slice per page, registered on its route

Each page owns `store/<page-name>/` and registers it with `provideState` + `provideEffects` on its route. A single
global `entities` slice shared by the list, detail and form pages was tried and replaced: in practice each page read
almost only its own fields (only the current entity was shared), and the cross-page reducer updates (prepend on
create, patch on update) were redundant once the list fetches fresh data on every visit and after a delete. Per-page
slices keep each page's actions and state together. The cost is that detail and form each load the entity, one extra
request when going from detail to edit. Resource types shared by the slices live in `models/`, and only `appContext`
stays global.

### Pages inject only the Store; templates link with `routerLink`

Pages read the route from their own slice (`selectListInput`, `selectId`, `selectTarget`); forms are built with
`new FormGroup`. With `ActivatedRoute`, `Router` and `FormBuilder` injected into pages, routing was split between
the store and the components, and a navigation after a save lived in a page `effect()` watching a `savedId` flag.
Keeping pages to the store makes every route read visible as state, and leaves service injection to effects.

Navigation has two forms. A plain link (open a row, _Edit_, _New entity_, _Back_, _Cancel_) is a `routerLink` in the
template: it is a real anchor, opens in a new tab and needs no code. A navigation computed in code (a new list query)
or caused by a result (after a save, stepping back off an empty page) dispatches `AppRouterActions.navigate`, whose
effect is the only caller of the Angular `Router`. The docs once said every navigation was an action while the
templates already used `routerLink`; links are the right tool for links, and the rule now says so. Either way the
navigation reaches the slices through `routerNavigatedAction`.

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

### Pages load from a watch started in `ngOnInit`

Navigation and data loading are separate: the router only writes route state, and the page decides when to load. Each
page starts a watch on its slice's route state in `ngOnInit` and dispatches `Fetch` / `Load` for each new value until
it is destroyed; `ngOnDestroy` dispatches `Leave`, which resets the slice. Earlier versions loaded the list from
`routerNavigatedAction` in an effect, and later from an effect that followed the URL from `Load` to `Leave`. Both put
the decision to load in the router's hands: route-level effects outlive their page, so each needed a guard against
the next page's URL. The watch lives exactly as long as the page, and a reused component keeps its watch, so page 2 →
3 and detail 42 → 43 reload without lifecycle hooks.

`ngOnInit` and not the constructor: Angular constructs the new page before `routerNavigatedAction` and runs
`ngOnInit` after it, so the first value the watch sees is the URL's. A spike logging every action, router event and
lifecycle hook (Angular 22.2, NgRx 22.0.1, zoneless) confirmed the order for deep links, back, list → detail and a
reused detail page, with one request each.

### Actions name intent, not lifecycle

The page action was first called `Enter`, which names a moment of the component lifecycle rather than what the page
asks for. The page asks for data with `Load` (detail, form) or `Fetch` (one list request for one input), results are
`<Action> Success` / `<Action> Failure`, and `Leave` resets the slice.

### A new id starts the slice over

When the router lands on the same state with another id, the reducer replaces the slice with its initial state plus
the new id. Keeping the previous entity until the new one loads showed entity 42 under the URL for 43.

### A custom serializer flattens the route

`provideRouterStore` gets `AppRouterSerializer` instead of router-store's default. The default puts the route on each
router action as a tree (`root → 'entities' → '' → ':id/edit'`, each node with its own `params` and `data`), and the two
things a page reducer checks — the deepest route's `data.state` and the `:id` param — sit at the bottom of it. The
serializer walks the tree once per navigation and writes a flat `NavigatedRoute`, `{ url, state, params, queryParams }`,
so each reducer is one comparison (`route.state === 'entity-detail' ? route.params['id'] : null`), no reducer depends on
how the routes nest (the form's componentless parent route is invisible to them), and the action payload stays four
plain fields in the devtools. It is also the one place that reads route `data`: `data: { state }` in `app.routes.ts`
means something only because the serializer lifts it out.

The alternative is the default serializer with the walk inside `navigatedRoute(action)`: it saves the class but walks
the tree once per reducer instead of once per navigation and puts the whole tree in every router action. The serializer
lives in `store/app-router/` with its model, its action and its effect: together they are the router ↔ store bridge,
the one store folder without a slice, and its model sits beside it as every slice's model does. `models/` keeps only
resource types that several slices share.

### No router slice

`provideRouterStore` runs without `routerReducer`. A global `appRouter` slice was kept for a while, with its own key,
selectors and `navigationActionTiming: PostActivation` (so it never held a URL a guard could still cancel), but once
every page took its route state from `routerNavigatedAction` into its own slice, nothing read it: only the devtools,
for URL time-travel, and a route spec. router-store dispatches its actions without the slice (it skips its
store-to-router sync when the state is missing), so dropping it removed a feature key, a selectors file, the timing
option, which then affects only `ROUTER_NAVIGATION`, an action nothing handles, and a second copy of the URL that
code could be tempted to read. The serialized route keeps `url`, which router-store's serializer contract requires.

### No spec for the route table

`app.routes.ts` is a mapping — path, page, `data.state`, the slice registered on the route — and gets no spec of its
own. An `app.routes.spec.ts` on `RouterTestingHarness` was kept for a while: one case per route, plus four
"late response" sequences (a read or a save that returns after its page was left). Every one of those repeated a
cheaper test — the effects specs cover cancelled reads, `EMPTY` for the new form and the `navigationId` checks; the
page browser specs cover `Leave` on destroy — and the per-route cases repeated the e2e suite, whose page specs each
open their page by URL in a real browser. The route table is now proven there, with the real router, API and
database; the cost is that a routing mistake fails `pnpm test:e2e` rather than `pnpm test`.

### Requests belong to the page that started them

Route-level `provideEffects` registers effects when the route is first activated, and they stay active after the
component is destroyed; resetting the slice on `Leave` cleans up state but not requests. A review drove the real
router and store through three delayed-response sequences, and each one leaked a request across pages:

- an edit form's GET that returned after moving to `/entities/new` filled the new form with the old entity. `Load`
  with a `null` id was filtered out before `switchMap`, so it cancelled nothing, and nothing cancelled on `Leave`;
- a save that succeeded after _Cancel_ redirected from the list to the saved entity: `navigateAfterSave$` navigated
  on every success;
- a list response past the end that returned after moving to a detail page rewrote `/entities/e1` to
  `/entities/e1?page=2&pageSize=1`: `filter(non-null)` inside `withLatestFrom` kept the input from before `Leave`, and
  `commands: []` navigates relative to whatever URL is current.

The rules that close them:

| request | rule | why not the alternative |
| --- | --- | --- |
| read (`Load`, `Fetch`) | the inner observable ends with `takeUntil(<Page>.leave)`; a load that needs no request returns `EMPTY` inside `switchMap` | a reducer guard per result would also need an id on every failure; ending the request removes the result instead of filtering it |
| write (`Create`, `Update`, `Delete`) | completes; its result carries the form's `navigationId` (the opening navigation's `NavigationEnd.id`), and the reducer and `navigateAfterSave$` ignore a result from another visit | cancelling a write on `Leave` would drop a save the user asked for; a reducer-generated session id would make reducers impure, and the router already numbers its navigations |
| effect reading route state | sample the nullable value, filter afterwards | filtering the source of `withLatestFrom` keeps the last non-null value forever |
| follow-up computed from a result | read the input from the result (`fetchSuccess` carries its `input`) | reading the slice gives the next request's input, or `null`, not the one this result answers |

A delete stays a plain write: its only follow-up refetches, and after `Leave` the sampled input is `null`, so it does
nothing. The cost is a `navigationId` field and two props on the form slice, and a `takeUntil` on each read. The
sequences are unit cases in each effects spec, and each page's browser spec proves it dispatches `Leave` on destroy.

### A page on several routes registers its slice once

The form page serves `entities/new` and `entities/:id/edit`. Registering its slice on both routes would add its
effects twice, so the two routes sit under one componentless parent route that provides the slice.

### Store code lives under `store/`, mirroring `pages/`

Slices are not colocated under `pages/<page>/store/`. `pages/health-page.component.ts` pairs with
`store/health-page/*.ts`.

### Flat files with the `.component.ts` suffix

`pages/health-page.component.ts`, not `health/health-page.ts`, following the Angular style guide's CLI 20+ direction.

### Two component tiers: `components/ui/` primitives and app components

`components/ui/` holds design-system base components (`UiDialog`, `UiSelect`, `UiPagination`) with the generic API of
that component, and `components/` holds app components that compose them (`DeleteDialog`). The scaffold used to ship
one `ConfirmDialog` whose defaults (_Delete_, _Deleting…_, a danger tone) made it half generic, half app-specific: each
new confirm would either add an input to it or copy it. The list page also wrote its two labelled selects and its
Previous / Next by hand, carrying the `[selected]` and `<label for>` details in page code. With two tiers, the generic
shape is written once and stays generic, and app wording sits in a component named for its purpose.

The layout follows shadcn's `components/ui/`, a shape most frontend developers recognise. `ui/` holds only commonly
recognised base components, and only the ones the app uses. With a UI library (Fundamental NGX), the library supplies
the primitives and `ui/` keeps only adaptations, each with the generic API, so swapping the library or adding one does
not reach into app components. The `ui-` / `app-` selector prefixes are enforced per folder by ESLint rather than left
to review.

### Inline templates, no HTML or SCSS files

One file per component. Angular ESLint's `processInlineTemplates` still lints the templates.

### Tailwind utilities, no SCSS or per-component CSS

Styling is Tailwind utilities in the template plus a `host` class for host-element rules. The only global stylesheet is
`src/styles.css`.

### Tailwind preflight only without Fundamental NGX

`styles.css` imports Tailwind's layers one by one. Preflight is on by default; with FD-NGX it is removed, because its
reset clobbers FD-NGX's base styles, and `body` margin and font are set by hand.

### Storybook runs on the Vite/Analog builder, not webpack

Components (`components/` and `components/ui/`, `input()`/`output()`, store-free) are developed and documented in Storybook. The Angular
webpack builder (`@storybook/angular`) would pull a second, webpack toolchain into a project that is deliberately
esbuild/Vite (`@angular/build`). `@storybook/angular-vite` compiles Angular through `@analogjs/vite-plugin-angular` on
Vite instead, so Storybook shares the app's toolchain (and the plugin `ng test` uses). `@angular/animations` comes
along as a required peer of `@storybook/angular-vite`, not because the app uses it. `zone.js` was installed with it
until it turned out to be an optional peer: the builder runs zoneless by default, like the app, so it was dropped.

### Web tests run on Analog's Vitest builder, one config with two projects

`ng test` runs on `@analogjs/vitest-angular:test`, not the CLI's `@angular/build:unit-test`. One `vitest.config.mts`
holds two projects: `unit` (jsdom — services, every slice, helpers; the required `test` check) and `browser`
(real Chromium through Playwright — components and pages with a mock store; `ng test -c browser`). The angular.json
target's `project` option picks which one runs. On top, **full-stack e2e** (`pnpm test:e2e`, Playwright Test) drives
the real app → API → Postgres. The jsdom layer is kept fast and Docker-free; the real browser and the backend only
enter the two opt-in scripts.

The CLI's builder ran the unit specs while a separate `vitest.browser.config.mts` ran the browser ones, with its own
tsconfig, an `exclude` on the test target and two compile paths. One builder and one config give one compile path
(the Analog plugin Storybook already uses), the same project layout as the API's `vitest.config.ts`, and one place to
change test options. It is named `vitest.config.*` so Storybook, which reads `vite.config.*`, never loads it.

`web` and the API share **Vitest 5** through the catalog. `web` was pinned to Vitest 4.1.12 while the browser specs had
their own config, because Vitest 5's browser mode failed there (`page` threw); on the single config through the Analog
builder, both projects pass on 5, so the pin was dropped.

### Every spec is in `tsconfig.spec.json`

Under Vitest, the Analog plugin compiles only the files in `tsconfig.spec.json`'s program; any other file falls through
to Vite's plain TypeScript transform, which skips the Angular compiler. The browser specs used to sit in a separate
`tsconfig.browser.json`, and components reached only from them were compiled without their signal `input()` /
`output()` metadata, so `setInput` and template bindings failed (`NG0303` / `NG0315`) and the scaffold's one component
was left to Storybook and e2e. With every spec, unit and browser, plus both setup files in `tsconfig.spec.json`,
signal-input components are browser-tested like pages, and each component has its own spec. Keep `input()` / `output()` on
components; never switch to `@Input()` to make a component testable.

### The web e2e is full-stack, not stubbed, and isolated from the dev stack

`pnpm test:e2e` starts the real app (`ng serve`), the real API (node) and real Postgres (compose), applies migrations
and truncates, then drives CRUD through the browser, seeding setup data through the API `request` fixture. Stubbing the
API with `page.route` was the first cut and dropped: the point of the e2e layer is the web↔API contract (the web
mirrors the API types by hand), which a stub cannot catch. The cost is that `test:e2e` needs Docker and the root
`.env`; the fast jsdom and browser-mode layers do not, so only this script depends on the backend.

It runs in its own `app_e2e` database, with its own API on `:3100` and `ng serve -c e2e` on `:4300`. The first version
used the dev `app` database, `:3000` and `:4200`: setup truncated the developer's `entity` table, the servers reused a
running dev or Compose API that pointed at that same database, and teardown ran `docker compose down`, stopping the
whole stack. Now teardown stops Postgres only if setup started it, and the dev stack can stay up during the run.

### A page past the end steps back in the list slice

When a delete empties the last page, or a deep link names a page that no longer exists, `stepBackPastLastPage$`
navigates to the last page after `Fetch Success`, with `replaceUrl`: the user did not ask for that step, so it
corrects the history entry instead of adding one. It used to be a page `effect()` watching the slice, the same pattern
the post-save navigation was moved out of (see [Pages inject only the Store](#pages-inject-only-the-store)): in the
slice, the step back is an action like every other navigation, and a unit test covers it.

### Components keep Angular's default change detection

`OnPush` is the default in Angular 22, so no component sets `changeDetection`; writing it on one component made it look
like the others were eager.
