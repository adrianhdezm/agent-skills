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
├── api/              # Express 5 + Drizzle + Pino + zod (DAO pattern, Hasura-style list queries)
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

| area                     | pattern                                                                 |
| ------------------------ | ----------------------------------------------------------------------- |
| API handlers             | `*.controller.ts`                                                       |
| API middleware           | `*.middleware.ts`                                                       |
| API data access          | `*.dao.ts`                                                              |
| API transport-agnostic utilities | `*.helper.ts`                                                   |
| API shared types + errors        | `*.model.ts` (under `src/models/`)                              |
| Web components           | `*.component.ts` (flat, no wrapping folder)                             |
| NgRx slice               | `*.model.ts`, `*.actions.ts`, `*.reducer.ts`, `*.selectors.ts`, `*.effects.ts` |

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
│   └── schema.ts           # drizzle tables + drizzle-zod + list-query schema (builders)
├── models/                 # pure types + error classes (no runtime behavior beyond `extends Error`)
│   ├── app-context.model.ts
│   ├── dao.model.ts        # Dao<T,C,U,ListQuery> + ListResult<T>
│   ├── error.model.ts      # NotFoundError, QueryParseError
│   └── query/              # reusable Hasura-flavored query vocabulary
│       ├── predicates.ts   # textPredicate / dateTimePredicate / numberPredicate / …
│       ├── where.ts        # whereSchema(fields) builder
│       ├── list.ts         # listQuerySchema({ where, sortFields }) builder
│       └── index.ts
├── helpers/                # transport-agnostic utilities
│   └── query-parser.helper.ts   # jsonQueryParam / intQueryParam / parseQuery
├── daos/                   # one *.dao.ts per table + the shared SQL translator
│   ├── query.ts            # whereToSql / orderByToSql / countRows
│   └── <resource>.dao.ts
├── controllers/            # thin HTTP edge; translates DAO/parser errors to http-errors
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
- **DAO pattern**:
  - Every table has a `*.dao.ts` under `src/daos/` implementing the shared `Dao<T, C, U, ListQuery>` interface.
  - Controllers call DAOs; drizzle calls never appear in controllers.
  - DAOs are transport-agnostic — they throw `NotFoundError` / regular errors, never `http-errors`.
  - Controllers translate sentinel errors (`NotFoundError → 404`, `QueryParseError → 400`) in the outer `catch`.
  - DAOs are instantiated once in `server.ts` and placed on the context; they're not per-request.
- **Query vocabulary** (filter / sort / pagination):
  - Hasura-flavored: `where` is a tree with field predicates (`_eq`, `_ilike`, …) and `_and`/`_or`/`_not` combinators (nestable); `orderBy` is `[{field,dir}]`; `limit`/`offset` for pagination.
  - Operators are enumerated **once per column type** in `models/query/predicates.ts`. A new operator is a one-line change there plus one line in the `daos/query.ts` `OPERATORS` map.
  - Per-resource list queries are built declaratively: `entityListQuerySchema = listQuerySchema({ where: entityWhereSchema, sortFields: [...] as const })`.
  - TS types are **derived** via `z.infer` — do not hand-write recursive TS mirrors of zod schemas.
- **URL query transport**: `where` and `orderBy` are JSON-encoded; `limit` and `offset` are integer strings. The `parseQuery` helper handles all coercion. Controllers read `req.query` and call `parseQuery(req.query, entityListQuerySchema)` — no per-field unwrapping.
- **drizzle-zod** generates `createInsertSchema` / `createUpdateSchema` / `createSelectSchema` from each drizzle table. Row-level validation (POST / PATCH bodies) uses these.
- **Logger**: Pino emits plain JSON always. `pino-pretty` is a devDependency piped by the `dev` script externally — never imported in code.
- **Drizzle config throws** when `DATABASE_URL` is unset. No fallback.
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

- **Structure**: `src/app/{components,layouts,pages,store}/` — no `services/` unless needed. Store holds global + resource slices; pages dispatch via `router.navigate` or action creators.
- **Inline templates only** — no `.html` or `.scss` sibling files. The `@Component` decorator carries `template:` directly. Angular ESLint's `processInlineTemplates` keeps them linted.
- **Styling**: Tailwind utilities in the inline template + one `host` class per component for host-element rules. The only global stylesheet is `src/styles.css` (Tailwind imports + `body` reset).
- **Tailwind preflight**: enabled only when Fundamental NGX is **not** in use. When FD-NGX is enabled, use theme + utilities layers only; preflight clobbers FD-NGX base styles.
- **Components take `input()` / `output()`** — components do not touch the store. Only **pages** and **layouts** may read the store.
- **NgRx slice placement**:
  - A slice **shared across pages** of one resource (list, detail, form) lives at `store/<resource>/` and is **registered globally** in `app.config.ts` (e.g. the `entities` slice).
  - A slice **scoped to one page** lives at `store/<page-name>/` and is **registered on the route** via `provideState` + `provideEffects`.
  - The global `appContext` slice (holding `apiBaseUrl` + `appName`) is always registered globally; it is the only consumer of Angular `environment.ts`.
- **router-store + URL as source of truth**: `@ngrx/router-store` is registered globally. For list pages (filter / sort / pagination), the URL is the single source of truth — pages dispatch `router.navigate([], { queryParams })`, and an effect filters `routerNavigatedAction` by path to trigger the fetch. Do not duplicate the query in a reducer slice.
- **Angular `environment.ts`** is the single consumer of build-time config. The browser calls the API host directly on `apiBaseUrl` — there is **no `/api` reverse proxy** and **no runtime `config.json`** fetch.

## Tests

- **Both projects have a `test` script, and it must pass.** API: `vitest run`; web: `ng test --watch=false`.
- **API tests** live in `api/tests/`, mirroring `src/`, one `*.test.ts` per module, in Arrange / Act / Assert. They
  need no database: SQL builders are tested through the SQL they render (`PgDialect`), controllers through
  `createApp(context)` with a fake DAO on the context.
- **Web specs** sit next to the file they test as `*.spec.ts` (Angular's convention).
- A new resource gets a controller test, copied from the entity one; a new operator gets a `whereToSql` test.

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
- **No per-page NgRx slice for a resource shared across routes** — one global slice.

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
- [ ] Entity CRUDL works end-to-end: `POST /entities`, `GET /entities?where=…&orderBy=…&limit=&offset=`, `PATCH /entities/:id`, `DELETE /entities/:id` (404 on missing id).
- [ ] `.env` is **not** committed; `.env.example` is.
- [ ] `coding-conventions.md` is at the repo root.
