# Coding Conventions

This file is **written to the root of every repo** scaffolded by the `create-fullstack-app` skill. It documents the rules the scaffold applies so future contributors (and future Claude sessions) stay consistent with the original intent.

## Contents

- [Repository shape](#repository-shape)
- [pnpm catalog rule](#pnpm-catalog-rule)
- [File-naming suffixes](#file-naming-suffixes)
- [API source tree](#api-source-tree)
- [API conventions](#api-conventions)
- [Web conventions](#web-conventions)
- [Tests](#tests)
- [Formatting & lint](#formatting--lint)
- [Docker](#docker)
- [Decisions deliberately NOT taken](#decisions-deliberately-not-taken)
- [Review checklist](#review-checklist)

## Repository shape

```
<repo>/
├── api/              # Express 5 + Drizzle + Pino + zod (DAO pattern, AppSync-style filter inputs)
├── web/              # Angular 22 + NgRx + router-store + Tailwind (URL as source of truth)
├── pnpm-workspace.yaml   # catalog + allowBuilds
├── docker-compose.yml    # db + api + web (Nginx static serving)
├── .env  / .env.example  # single root env
└── coding-conventions.md # this file
```

- **Package manager**: pnpm 11 or newer, as a workspace. `npm` / `yarn` are not supported. The exact version is the
  root `packageManager` field.
- **Node**: 24 or newer.
- **Env**: a single `.env` at the repo root. API loads it with strict `--env-file=../.env` (fails fast if missing). Web reads `apiBaseUrl` / `appName` from Angular `environment.ts` only.

## pnpm catalog rule

A package belongs in `pnpm-workspace.yaml`'s `catalog:` **only when used in ≥ 2 manifests with the same version range**. Everything else is a direct dep in the one manifest that uses it.

**TypeScript is in the catalog, pinned exactly** to one 6.0.x version for both projects. Angular 22 requires `>=6.0 <6.1`
and typescript-eslint supports `<6.1`; move the pin only when both peer ranges allow it.

## File-naming suffixes

| area                             | pattern                                                                        |
| -------------------------------- | ------------------------------------------------------------------------------ |
| API handlers                     | `*.controller.ts`                                                              |
| API middleware                   | `*.middleware.ts`                                                              |
| API data access                  | `*.dao.ts`                                                                     |
| API transport-agnostic utilities | `*.helper.ts`                                                                  |
| API shared types + errors        | `*.model.ts` (under `src/models/`)                                             |
| Web components                   | `*.component.ts` (flat, no wrapping folder)                                    |
| NgRx slice                       | `*.model.ts`, `*.actions.ts`, `*.reducer.ts`, `*.selectors.ts`, `*.effects.ts` |

Angular files live flat under `components/`, `layouts/`, `pages/` — no `health/health-page.component.ts` wrapping folder; it is `pages/health-page.component.ts`.

## API source tree

```
src/
├── express.d.ts            # ambient Express.Locals (stays at src root — tooling, not model)
├── logger.ts
├── app.ts                  # createApp(context) — pure factory
├── server.ts               # http listener + composition root (DAO wiring)
├── db/
│   ├── client.ts
│   ├── schema.ts           # `export const schema = { entity, … }` — every table, passed to drizzle()
│   └── schemas/
│       └── <resource>.schema.ts   # drizzle table + create/update inputs + <resource>FilterInput + List<Resource>Input / list<Resource>InputSchema + <resource>DefaultSort
├── models/                 # contract types, error classes, and the zod building blocks for list inputs
│   ├── app-context.model.ts
│   ├── dao.model.ts        # Dao<T,ListInput,CreateInput,UpdateInput> + PaginatedResult<T> + IdInput
│   ├── list-input.model.ts     # Id / String / Number / Date / Boolean FilterInput (zod + inferred types) + createFilterInputSchema / createSortInputSchema / createListInputSchema builders + page limits + derived ScalarFilterInput / FieldFilterInput / LogicalFilterInput / FilterField
│   └── error.model.ts      # NotFoundError
├── helpers/                # transport-agnostic utilities
│   ├── dao.helper.ts            # FilterTable / SortTable / filterToSql / sortToSql / toPaginatedResult
│   └── query-parser.helper.ts   # normalizeQuery
├── daos/                   # only classes implementing Dao — one *.dao.ts per table
│   └── <resource>.dao.ts
├── controllers/            # thin HTTP edge; validates input and translates DAO errors to http-errors
└── middleware/
```

**`models/` vs `types/`.** The folder is named `models/` to match the `.model.ts` suffix and to signal "shapes of things". Ambient `.d.ts` files (framework glue) stay at `src/` root — they aren't models.

## API conventions

- **App factory + composition root**: `createApp(context)` in `src/app.ts`; `src/server.ts` constructs the context — including every DAO instance — and wires the HTTP listener. The context is a **singleton on `app.locals.context`**, set once at `createApp` time (not a middleware).
- **No routers**. Controllers are mounted directly: `app.get('/entities', listEntities)`.
- **Uniform controller shape**, even for synchronous-looking handlers:
  ```ts
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try { … }
    catch (err) { next(err); }
  }
  ```
- **Errors forward via `next(err)` only.** Responses are shaped by the error handler using `http-errors`: `createError(status, msg, { expose, cause })`. Severity follows status (`5xx → error`, `4xx → warn`); do not log every error at `error`.
- **DAO layer** — the core of the API. Each layer has one job, and types flow downward:

  | layer                 | file                              | holds                                                                                                                                                                                                                                                                                                |
  | --------------------- | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | contract              | `models/dao.model.ts`             | `Dao<T, ListInput, CreateInput, UpdateInput>`, `PaginatedResult`, `IdInput`. No zod, no drizzle.                                                                                                                                                                                                     |
  | list-input vocabulary | `models/list-input.model.ts`      | the scalar filter inputs (id, string, number, date, boolean), `createFilterInputSchema`, `sortDirectionSchema`, `SortInput`, `createSortInputSchema`, `createListInputSchema`, the page-size limits, and the derived `ScalarFilterInput` / `FieldFilterInput` / `LogicalFilterInput` / `FilterField` |
  | resource schema       | `db/schemas/<resource>.schema.ts` | the drizzle table, `Create<Resource>Input` / `Update<Resource>Input` (drizzle-zod), `<resource>FilterInputSchema`, `<resource>SortInputSchema`, `list<Resource>InputSchema` (the structured `List<Resource>Input`), `<resource>DefaultSort`, and every type inferred from them                       |
  | table registry        | `db/schema.ts`                    | `export const schema = { entity, … }`, passed to `drizzle()`                                                                                                                                                                                                                                         |
  | translation           | `helpers/dao.helper.ts`           | `FilterTable` / `SortTable`, `filterToSql`, `sortToSql`, `toPaginatedResult` — resource-agnostic                                                                                                                                                                                                     |
  | HTTP parsing          | `helpers/query-parser.helper.ts`  | `normalizeQuery` (first value of a repeated param, empty values dropped); the rest of the URL decoding is written in the controller                                                                                                                                                                  |
  | DAO                   | `daos/<resource>.dao.ts`          | one class implementing `Dao`; runs queries, nothing else                                                                                                                                                                                                                                             |

- **DAO contract**:
  - `class EntityDao implements Dao<Entity, ListEntityInput, CreateEntityInput, UpdateEntityInput>`. `Dao` takes the resource's list input as one generic, so DAOs never name the filter or sort-field types. Every input type is inferred from its schema; `dao.model.ts` defines none of them.
  - Methods are generic, each taking a single input object: `get({ id })` → `T | null`, `list(input)` → `PaginatedResult<T>`, `create(input)`, `update(input)` (the input carries `id`), `delete({ id })` → `void`.
  - The DAO holds no configuration of its own: everything resource-specific lives in `<resource>.schema.ts`.
  - Resource schema files (`db/schemas/<resource>.schema.ts`) carry **no comments**: they are declarations whose meaning comes from the naming patterns and the builders. The explanations live in this file. They follow one order: the table; the schemas (`select<Resource>Schema`, `<resource>IdInputSchema`, `create…`, `update…`, `<resource>FilterInputSchema`, `<resource>SortInputSchema`, `list<Resource>InputSchema`); `<resource>DefaultSort`; then every inferred type, in the same order.
  - Controllers call DAOs; drizzle calls never appear in controllers.
  - DAOs are transport-agnostic — they throw `NotFoundError` / regular errors, never `http-errors`.
  - Controllers validate every input inline with `safeParse` and throw `createError(400, …)` on failure, and translate `NotFoundError → 404` from the DAO.
  - DAOs are instantiated once in `server.ts` and placed on the context; they're not per-request.
- **Filter inputs** (modelled on AppSync's `Model<Type>FilterInput`):
  - One zod schema per scalar kind in `models/list-input.model.ts`, with the TS type inferred: `IdFilterInput` (`eq ne in`), `StringFilterInput` (`eq ne lt le gt ge between in contains notContains beginsWith`; the last three case-insensitive), `NumberFilterInput` (any number) / `DateFilterInput` (ISO date or date-time) (`eq ne lt le gt ge between in`), `BooleanFilterInput` (`eq ne`). `between` is an inclusive `[from, to]` pair; `in` takes up to 100 values, and an empty list matches nothing.
  - Each resource declares `<resource>FilterInputSchema = createFilterInputSchema({ <column>: <scalar>FilterInputSchema, … })`, mirroring `<resource>SortInputSchema = createSortInputSchema([...])`. The builder makes every field optional and adds recursive `and` / `or` / `not` (zod 4 getters, so the type is inferred — no hand-written mirror). Schemas are strict: unknown fields and operators are rejected.
  - Filter and sort fields are **named after the table's columns**, and the DAO passes the drizzle table itself as the column source: `filterToSql(filter, entity)`, `sortToSql(sort, entity)`. `FilterTable` / `SortTable` make a field without a matching column a compile error.
  - One translator serves all scalar kinds, because the zod schemas already restrict which operators each kind accepts.
  - Translation rules (`helpers/dao.helper.ts`): fields are ANDed; a filter that matches every row (`{}`) makes an enclosing `or` match every row, and `not {}` matches none; an empty `in` matches nothing; LIKE metacharacters in `contains` / `notContains` / `beginsWith` values are escaped; every sort gets an `id` tie-breaker. The file has no comments: public API first (`FilterTable` / `SortTable`, `filterToSql`, `sortToSql`, `toPaginatedResult`, `escapeLike`), then the private helpers in the order they are called.
  - `models/list-input.model.ts` follows one order and, like the resource schemas, carries no comments: the limits; the operator groups (`equatable` = `eq ne`, `comparable` = those plus `lt le gt ge between in`, `oneOf` for `in`); the five scalar schemas, each composed from those groups; the builders (`createFilterInputSchema`, `createSortInputSchema`, `createListInputSchema`); then the types. The operator semantics are the ones listed above.
  - Adding a filterable column is one line in the filter input schema; adding an operator is one line in the scalar schema and one in `dao.helper.ts`.
- **list**: `list({ filter?, sort?, page, pageSize })` → `PaginatedResult<T>` = `{ items, total, page, pageSize, totalPages }`. Page-based (no cursors). `List<Resource>Input = z.infer<typeof list<Resource>InputSchema>`: the schema applies the page defaults (1, `DEFAULT_PAGE_SIZE`) and enforces their range, so `page` / `pageSize` always arrive set. The DAO falls back to `<resource>DefaultSort` (rows need a defined order to page reliably) and always adds an `id` tie-breaker. It runs the page query, then the count query, one after the other on the same `where`: simple and predictable on the pool, at the cost of one extra round trip (the two are not one snapshot, so `total` can lag a concurrent write). Sortable fields are an explicit allowlist: `entitySortInputSchema = createSortInputSchema(['name', …])`, from which `EntitySortInput` / `EntitySortField` are inferred.
- **URL query transport**: `?filter=<json>&sortField=<field>&sortDirection=ASC|DESC&page=<n>&pageSize=<n>` (`pageSize` ≤ `MAX_PAGE_SIZE`). Decoding the URL is the **controller's** job, written out in the handler: `normalizeQuery` (first value of a repeated param, empties dropped), reject unknown params with a 400, `JSON.parse` the `filter` (invalid JSON → 400), build `sort` from `sortField` / `sortDirection` (`ASC` by default), and turn `page` / `pageSize` into numbers. The result goes to `list<Resource>InputSchema.safeParse(...)` (400 on failure) and its `data` straight to `list`. The list input schema itself knows nothing about the URL: `createListInputSchema({ filter, sort })` validates the structured `{ filter, sort, page, pageSize }`, so the DAO's input type carries no transport detail.
- **Naming**: inputs follow `<Operation><Resource>Input` (`CreateEntityInput`, `UpdateEntityInput`, `ListEntityInput`) and their schemas `<operation><Resource>InputSchema`; resource list pieces follow `<resource><Kind>` (`entityFilterInputSchema`, `entitySortInputSchema`, `entityDefaultSort`); builders are `create<Thing>Schema`.
- **drizzle-zod** generates `createInsertSchema` / `createUpdateSchema` / `createSelectSchema` from each drizzle table. Row-level validation (POST / PATCH bodies) uses these, and the row type comes from the select schema: `type Entity = z.infer<typeof selectEntitySchema>`, not `typeof entity.$inferSelect`, so every resource type in the schema file is a `z.infer`.
- **Logger**: Pino emits plain JSON always. `pino-pretty` is a devDependency piped by the `dev` script externally — never imported in code.
- **Drizzle config throws** when `DATABASE_URL` is unset. No fallback. Its `schema` points at `src/db/schemas/*.schema.ts`, because drizzle-kit discovers tables from module exports, not from the `schema` object.
- **New table**: add `src/db/schemas/<resource>.schema.ts` and register the table in `src/db/schema.ts`.
- **Migrations only**: use `db:generate` + `db:migrate`. `db:push` is deliberately absent.
- **No migrations are shipped by the scaffold.** The first `pnpm db:generate` emits a single fresh schema snapshot locally.
- **tsconfigs** (three files):
  - `tsconfig.json` — solution root, pure (`files: []` + `references`), no `compilerOptions`.
  - `tsconfig.app.json` — all app compiler options live here.
  - `tsconfig.app.json` sets `types: ['node']` explicitly; TypeScript 6 defaults `types` to `[]`.
  - `tsconfig.node.json` — extends `app` with `composite: false`, and `include`s `tests/` and every config file
    (`drizzle.config.ts`, `vitest.config.ts`). A new config file goes into that `include`, or ESLint reports it as
    belonging to no project.
- **Dev loop**: `node --import=tsx --watch src/server.ts`. Node provides the restart loop; tsx provides the TS loader. Do not use `tsx watch`.

## Web conventions

- **Structure**: `src/app/{components,layouts,pages,models,services,helpers,store}/`. `models/` holds resource types shared by several slices (`entity.model.ts`), `services/` one data-access service per resource (`entity.service.ts`), `helpers/` plain functions (`entity-list-params.helper.ts`, `http-error.helper.ts`), and `store/` the global slices plus one slice per page; pages dispatch via `router.navigate` or action creators.
- **Inline templates only** — no `.html` or `.scss` sibling files. The `@Component` decorator carries `template:` directly. Angular ESLint's `processInlineTemplates` keeps them linted.
- **Styling**: Tailwind utilities in the inline template + one `host` class per component for host-element rules. The only global stylesheet is `src/styles.css` (Tailwind imports + `body` reset).
- **Tailwind preflight**: enabled only when Fundamental NGX is **not** in use. When FD-NGX is enabled, use theme + utilities layers only; preflight clobbers FD-NGX base styles.
- **Components take `input()` / `output()`** — components do not touch the store. Only **pages** and **layouts** may read the store.
- **Pages and layouts inject only the `Store`.** Route params come from the app-router selectors (`selectRouteParam('id')`, `selectQueryParams`), never from `ActivatedRoute`. Navigation is an action, `AppRouterActions.navigate({ commands, queryParams })`, dispatched by pages or page effects; the app-router `navigate$` effect is the only code that calls the Angular `Router`. Forms use `new FormGroup` / `new FormControl`, not an injected `FormBuilder`. Services (`EntityService`, `Router`) are injected only in effects.
- **Data access goes through a service.** `services/<resource>.service.ts` (`providedIn: 'root'`) is the only code that uses `HttpClient`; its methods (`list`, `get`, `create`, `update`, `delete`) return `Observable`s and read `apiBaseUrl` from the app-context slice. Each method writes its full URL explicitly (`` `${this.apiBaseUrl()}/entities/${id}` ``) and builds its own params inline; there is no private URL or params helper, so a method reads as the request it sends. Effects call it and map the result to success / failure actions.
- **Pages load through `Load` / `Leave`.** Every page dispatches `Load` in `ngOnInit` and `Leave` in `ngOnDestroy`; the reducers reset on both. `Load` moves the slice to `'loading'` and an effect calls the service; success moves it to `'loaded'` (`'ready'` for the form) with the data, failure to `'error'`. The list page's `Load` starts an effect that follows the list input in the URL until `Leave` and dispatches `Fetch({ input })` for the first value and every change, so the first load and every query change go through the same path.
- **Actions are named for what they do, not for a lifecycle moment.** A page asks for its data with `Load`, not `Enter` / `Init` / `Mounted`, even though it dispatches it from `ngOnInit`; a request for one specific input is `Fetch`; results are `<Action> Success` / `<Action> Failure`. The action group's `source` is the page name (`'Entity List Page'`).
- **One `status` per page state, no boolean flags.** Each slice has `status`, a union of that page's states (list `'idle' | 'loading' | 'loaded' | 'deleting' | 'error'`, detail `'idle' | 'loading' | 'loaded' | 'error'`, form `'idle' | 'loading' | 'ready' | 'saving' | 'error'`), plus `error: string | null` set only in `'error'`. No `loading` / `saving` / `deleting` booleans. Templates branch with `@switch (status())`.
- **NgRx slice placement**:
  - **One slice per page.** Each page owns `store/<page-name>/` (`<page-name>.model.ts`, `.actions.ts`, `.reducer.ts`, `.selectors.ts`, `.effects.ts`), named after its component (`entity-list-page`, `entity-detail-page`, `entity-form-page`), and **registers it on its route** with `provideState` + `provideEffects`. A page reads only its own slice.
  - Data two pages both show is loaded by each page for itself (detail and form each load the entity); there are no cross-page reducer updates.
  - A page component used by several routes (the form on `new` and `:id/edit`) registers its slice once, on a shared componentless parent route, so its effects do not run twice.
  - Route-level effects stay registered after the page is left: an effect that reacts to navigation filters by path.
  - Pages dispatch `Load` on init and `Leave` on destroy, and reset their state on both, so a revisit never shows stale data.
  - Only `appContext` (`apiBaseUrl` + `appName`, the only consumer of Angular `environment.ts`) and the router state (`store/app-router/`, feature key `appRouter`: `provideRouterStore({ stateKey: ROUTER_FEATURE_KEY })`, read through `getRouterSelectors(selectRouterState)`) are **global**, in `app.config.ts`, which also calls `provideEffects()` once so route-level effects can join.
- **Web resource types mirror the API** in `models/<resource>.model.ts`, by name and shape: `EntityFilterInput` (with the scalar filter inputs it uses), `EntitySortInput`, `ListEntityInput`, `PaginatedResult<T>`. The web cannot import the API package, so change both sides together.
- **router-store + URL as source of truth**: `@ngrx/router-store` is registered globally. For list pages (filter / sort / pagination), the URL is the single source of truth — pages dispatch `AppRouterActions.navigate({ commands: [], queryParams })`, and the list page's effect, running from `Load` to `Leave`, fetches whenever the list input in the URL changes. Do not duplicate the query in a reducer slice.
- **Forms**: every input, select and textarea has a `name`; free-text fields that are not personal data set `autocomplete="off"`. Date filters are days in the viewer's time zone, sent as local midnight in ISO-8601.
- **Lists stay consistent after writes**: a delete from the list page fetches the list again (totals change), and a page past the end steps back to the last page.
- **Angular `environment.ts`** is the single consumer of build-time config. The browser calls the API host directly on `apiBaseUrl` — there is **no `/api` reverse proxy** and **no runtime `config.json`** fetch.

## Tests

- **Both projects have a `test` script, and it must pass.** API: `vitest run`; web: `ng test --watch=false`.
- **API tests** live in `api/tests/`, mirroring `src/`, one `*.test.ts` per module, in Arrange / Act / Assert. They
  need no database: SQL builders are tested through the SQL they render (`PgDialect`), controllers through
  `createApp(context)` with a fake DAO on the context.
- **Web specs** sit next to the file they test as `*.spec.ts` (Angular's convention).
- A new resource gets a controller test, copied from the entity one; a new scalar filter input or operator gets a `dao.helper` test and a rejection case in the resource schema test (`tests/db/schemas/<resource>.schema.test.ts`). URL decoding is tested through the controller test.

## Formatting & lint

- **Per-project ESLint + Prettier configs**. No shared root `.prettierrc`. If a future project wants shared formatting, re-add a root `.prettierrc` and remove the per-project ones.
- **Prettier formats, ESLint judges.** `eslint-config-prettier` (last in each config) switches off ESLint's formatting
  rules; `eslint-plugin-prettier` is not used. `pnpm lint` reports code problems, `pnpm format:check` reports formatting.
  Run both in CI.

## Docker

- **Postgres** runs on `postgres:17-alpine`. Data is **bind-mounted** at `./api/db/data/` (not a named volume) so the host can inspect and `rm -rf` it to reset.
- The `app` database is created by `./api/db/scripts/init.sql`.
- **Web Dockerfile** is multi-stage → `nginx:1.27-alpine` serving static files with SPA fallback. **No `/api` reverse proxy**; the browser calls the API host directly.
- **API Dockerfile** uses `node:24-alpine`.
- **Both images build from the repo root** (`context: .`, `dockerfile: api/Dockerfile`), because `catalog:` entries only
  resolve against the root `pnpm-workspace.yaml` and lockfile. One root `.dockerignore` serves both. Corepack picks the
  pnpm version from `packageManager`.

## Decisions deliberately NOT taken

The reason behind each one is recorded in the `create-fullstack-app` skill's decisions reference. In short:

- **No Nginx `/api` reverse proxy**, no runtime `config.json`.
- **No `pino-pretty` import in code** — piped externally in the `dev` script.
- **No context middleware** — context is a singleton on `app.locals`.
- **No `checkDatabase()` helper** — controllers run `SELECT 1` inline.
- **No routers** — direct controller mounts.
- **No SCSS, no per-component CSS files** — Tailwind + inline templates only.
- **No `db:push` script** — migrations only.
- **No shipped migrations** — scaffold writes schema source; user runs the first `db:generate`.
- **No `--env-file-if-exists`** — strict `--env-file`.
- **No caret range on TypeScript** — one exact 6.0.x pin in the catalog for both projects.
- **No `eslint-plugin-prettier`** — formatting is checked by `format:check`, not `lint`.
- **No per-project Docker build context** — both images build from the repo root.
- **No hand-written TS mirrors of zod schemas** — always `z.infer`.
- **No `types/` folder for runtime models** — `models/` for shapes + errors, `express.d.ts` at src root.
- **No reducer slice for the list query** — URL (via router-store) is the source of truth.
- **No global slice per resource** — every page owns its slice, registered on its route.

## Review checklist

Before considering the scaffold complete:

- [ ] `pnpm install` succeeds at the root (no `ERR_PNPM_IGNORED_BUILDS`).
- [ ] `pnpm -r build` succeeds (api → `dist/`; web → `dist/web/browser/`).
- [ ] `pnpm -r typecheck` passes (api runs both tsconfigs).
- [ ] `pnpm -r test`, `pnpm -r lint` and `pnpm -r format:check` pass.
- [ ] `docker compose up --build` starts all three services.
- [ ] `pnpm --filter api db:generate` emits one fresh migration file; `pnpm --filter api db:migrate` applies it.
- [ ] `curl http://localhost:3000/health` → `{status:'ok', db:'up', …}`.
- [ ] `curl http://localhost:4200/` → 200 HTML; the entity list renders at `/entities`.
- [ ] Entity CRUDL works end-to-end: `POST /entities`, `GET /entities?filter=<json>&sortField=…&sortDirection=…&page=&pageSize=`, `PATCH /entities/:id`, `DELETE /entities/:id` (404 on missing id).
- [ ] `.env` is **not** committed; `.env.example` is.
- [ ] `coding-conventions.md` is at the repo root.
