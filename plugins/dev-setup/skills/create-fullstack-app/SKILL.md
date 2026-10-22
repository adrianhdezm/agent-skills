---
name: create-fullstack-app
description: Scaffolds a pnpm-workspace monorepo with an Express 5 + Drizzle + Postgres + zod API, an Angular 22 + NgRx + Tailwind web app whose list state lives in the URL, Docker Compose, and an entity CRUDL example wired end to end, with build, typecheck, test, lint and format checks passing. Use when creating a new full-stack TypeScript app, an Angular + Express or Angular + Postgres project, a monorepo with an API and a web frontend, or when the user asks to bootstrap, scaffold, init or start a full-stack project.
---

# Create Full-Stack App

Creates a pnpm-workspace monorepo with this shape:

- **`api/`: Express 5 + Drizzle + Postgres + zod + Pino.** An app factory takes a context singleton; controllers call
  DAOs, and DAOs are the only code that touches Drizzle. The DAO layer follows an AppSync-style contract: `get` /
  `list` / `create` / `update` / `delete`, typed `<Type>FilterInput`s with `and` / `or` / `not`, and page-based lists
  (see [The DAO layer](#the-dao-layer)).
- **`web/`: Angular 22 + NgRx + `@ngrx/router-store` + Tailwind v4.** The URL is the single source of truth for list
  queries. Templates are inline, and there are no `.html` or `.scss` files. Fundamental NGX + SAP Horizon is opt-in.
- **Docker Compose** runs `db` + `api` + `web`, both images built from the repo root; Nginx serves the web app
  statically. A single root `.env` feeds everything.
- **An `entity` CRUDL example** runs end to end, from DAO to Angular pages. It is a placeholder and the template for
  every later resource: one schema file, one DAO, one controller, and the web slice.
- **pnpm**, with TypeScript pinned exactly on 6.0.x in the catalog (Angular 22 and typescript-eslint both stop below
  6.1), and the rest resolved by `pnpm add` at scaffold time.
- **Prettier formats, ESLint judges.** ESLint runs with type information; its formatting rules are switched off.
- **Five checks, all required to pass:** `build`, `typecheck`, `test`, `lint`, `format:check`. Then a live smoke test
  through Compose.

The Angular CLI creates `web/` and the tools' own CLIs create what they can (`git init`, `pnpm pkg set`, `pnpm add`);
every other file is written from the specifications under `references/`. `coding-conventions.md` is copied to the new
repo's root so future sessions follow the same rules.

## What gets created

```
my-app/
├── .dockerignore             # one file for both images: the build context is the root
├── .env / .env.example       # single root env; only .env.example is committed
├── .gitignore
├── coding-conventions.md     # copied from references/coding-conventions.md
├── docker-compose.yml        # db + api + web
├── package.json              # packageManager pins the local pnpm
├── pnpm-lock.yaml
├── pnpm-workspace.yaml       # packages + catalog + allowBuilds
├── api/
│   ├── Dockerfile
│   ├── drizzle.config.ts
│   ├── eslint.config.mjs
│   ├── tsconfig{,.app,.node}.json
│   ├── vitest.config.ts
│   ├── db/scripts/init.sql   # creates the app DB; no db/migrations/ is shipped
│   ├── src/
│   │   ├── server.ts / app.ts / logger.ts / express.d.ts
│   │   ├── db/
│   │   │   ├── client.ts / schema.ts   # schema.ts: the table registry
│   │   │   └── schemas/      # one <resource>.schema.ts: table + every input of the resource
│   │   ├── models/           # dao.model.ts (contract), list-input.model.ts (filter/sort vocabulary), errors
│   │   ├── helpers/          # dao.helper.ts (input → SQL), query-parser.helper.ts (normalizeQuery)
│   │   ├── daos/             # one *.dao.ts per table, nothing else
│   │   ├── controllers/      # *.controller.ts, wired directly on the app
│   │   └── middleware/       # error + not-found
│   └── tests/                # mirrors src/, one *.test.ts per module, no database
└── web/
    ├── Dockerfile            # multi-stage → Nginx, SPA fallback
    ├── nginx.conf
    ├── eslint.config.mjs
    └── src/app/
        ├── pages/ layouts/ components/   # flat *.component.ts
        ├── models/ services/ helpers/  # resource types, EntityService (only HttpClient user), helpers
        └── store/            # app-context/ + app-router/ globally, one slice per page on its route; *.spec.ts beside the code
```

## Process

Copy this checklist and tick it off:

```
- [ ] 1. Inputs confirmed, toolchain checked
- [ ] 2. Repo, root files and packageManager written
- [ ] 3. API files written
- [ ] 4. Web scaffolded, cleaned up and restructured
- [ ] 5. Dependencies added, TypeScript pinned in the catalog
- [ ] 6. Conventions copied, formatted and checked
- [ ] 7. Compose up, first migration, smoke test
```

1. **Confirm the inputs and check the toolchain.** Ask for the repo name, the DB name (default `app`) and whether to add
   Fundamental NGX, unless the prompt already says. Node must be 24 or newer, pnpm 11 or newer (`allowBuilds` is a
   pnpm 11 setting), and Docker must be running. Use pnpm for everything, never npm. Stop if the target directory
   already holds a `package.json`: follow [Adding to an existing repo](#adding-to-an-existing-repo) instead.

   ```sh
   node -e "process.exit(+process.versions.node.split('.')[0] >= 24 ? 0 : 1)" || echo "node 24+ required"
   pnpm --version   # 11 or newer
   docker info --format '{{.ServerVersion}}'
   ```

2. **Create the repo and the root files** from [references/monorepo-root.md](references/monorepo-root.md):
   `package.json`, `pnpm-workspace.yaml` (packages + `allowBuilds`, no catalog yet), `.gitignore`, `.dockerignore`,
   `.env.example`, `docker-compose.yml`. Then:

   ```sh
   git init -q
   pnpm pkg set packageManager="pnpm@$(pnpm --version)"
   cp .env.example .env
   ```

3. **Write the API** from [references/api-setup.md](references/api-setup.md) (manifest, configs, app shell,
   Dockerfile), [references/api-dao.md](references/api-dao.md) (DAO contract, list-input vocabulary, SQL translator,
   query parser, their tests) and [references/api-entity.md](references/api-entity.md) (resource schema, DAO,
   controllers, their test). Read the "How the layers fit" section of `api-dao.md` first. Add `api/.prettierrc`, `api/.prettierignore` and `api/eslint.config.mjs` from
   [references/eslint-prettier.md](references/eslint-prettier.md). Do not create `db/migrations/`.

4. **Scaffold the web app**, then immediately apply [references/web.md](references/web.md) in order: clean up the CLI
   output, set the scripts, add Tailwind, the environment files, the core files, the global slices, the shared model,
   one slice per page, the three pages and the spec. Add `web/.prettierrc`, `web/.prettierignore` and
   `web/eslint.config.mjs` from [references/eslint-prettier.md](references/eslint-prettier.md).

   ```sh
   pnpm dlx @angular/cli@22 new web --directory=web --package-manager=pnpm --skip-install --skip-git \
     --style=scss --routing=true --ssr=false --defaults
   ```

   For the Fundamental NGX opt-in, layer [references/fundamental-ngx.md](references/fundamental-ngx.md) on top.

5. **Add the dependencies**: the API's (in `api-setup.md`), the web's (in `web.md`), then the shared tooling (in
   `monorepo-root.md`). Before the shared step, check that the TypeScript peer ranges of typescript-eslint and
   `@angular/compiler-cli@22` still overlap, and pin the newest version both accept, exactly, with
   `pnpm add -E --save-catalog`.

6. **Copy the conventions, format and run the checks.** `<skill-dir>` is this skill's base directory.

   ```sh
   cp <skill-dir>/references/coding-conventions.md coding-conventions.md
   pnpm install
   pnpm format
   pnpm build && pnpm typecheck && pnpm test && pnpm lint && pnpm format:check
   ```

   All five pass. Then confirm what the checks miss: `typescript` in the catalog has an exact version with no `^` or
   `~`, every shared tool in both manifests reads `catalog:`, and `web/package.json` has no `packageManager`.

7. **Bring up Compose and smoke-test it.**

   ```sh
   docker compose up --build -d
   pnpm --filter api db:generate --name init && pnpm --filter api db:migrate
   curl -s http://localhost:3000/health
   ```

   Then walk through the [Review Checklist](#review-checklist).

## Version constraints

`pnpm add` resolves current versions at scaffold time; these are the constraints it works within, and why.

| what                                   | constraint              | why                                                                   |
| -------------------------------------- | ----------------------- | --------------------------------------------------------------------- |
| Node                                   | 24+                     | the Dockerfiles run `node:24-alpine`; `@types/node@24` follows it     |
| pnpm                                   | 11+                     | `allowBuilds` in `pnpm-workspace.yaml`                                |
| TypeScript                             | exact 6.0.x, in catalog | Angular 22 needs `>=6.0 <6.1`; typescript-eslint supports `<6.1`      |
| `@angular/*`, `@ngrx/*`, angular-eslint | major 22                | NgRx and angular-eslint release in step with Angular's major          |
| `@fundamental-ngx/*`                   | exact 0.65.x            | the release whose peer range covers Angular 22                        |
| Tailwind                               | major 4                 | the CSS-first `@import` layers and `@tailwindcss/postcss` plugin      |
| Postgres / Nginx images                | `17-alpine` / `1.27-alpine` | pinned in `docker-compose.yml` and `web/Dockerfile`               |

**Catalog rule:** a package goes in `catalog:` only when two or more manifests use it with the same range. Everything
else is a direct dependency of the one manifest that uses it.

## Rules the scaffold enforces

These bite first when writing code in the project. The full set is in
[references/coding-conventions.md](references/coding-conventions.md), and the reason behind each in
[references/decisions.md](references/decisions.md).

### File-naming suffixes

- API: `*.controller.ts`, `*.middleware.ts`, `*.dao.ts`, `*.helper.ts`, `db/schemas/*.schema.ts`
- API and web types and errors: `*.model.ts`
- Web: `*.component.ts`, flat under `components/` / `layouts/` / `pages/` with no wrapping folder
- NgRx slices: `*.model.ts`, `*.actions.ts`, `*.reducer.ts`, `*.selectors.ts`, `*.effects.ts`
- Tests: API `tests/**/*.test.ts` mirroring `src/`; web `*.spec.ts` beside the file

### API

- **App factory + context singleton.** `createApp(context)` is in `app.ts`. `server.ts` builds the context (DAO
  instances included) and wires the HTTP listener. The context lives on `app.locals.context`, not in a middleware.
  There are no routers: controllers wire directly on the app.
- **Uniform controller shape**, even for handlers that look synchronous:
  ```ts
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try { … }
    catch (err) { next(err); }
  }
  ```
  Errors forward through `next(err)` only. The error handler shapes responses with `http-errors`
  (`createError(status, msg, { expose, cause })`).
- **The DAO layer** is the core of the API; its rules are in [The DAO layer](#the-dao-layer) below.
- **zod + drizzle-zod.** Row inputs come from `createInsertSchema` / `createUpdateSchema` / `createSelectSchema`; list
  inputs from the `createFilterInputSchema` / `createSortInputSchema` / `createListInputSchema` builders. Controllers
  validate every input inline with `safeParse` and throw `createError(400, …)` on failure.
- **Tests need no database.** The filter / sort translator is tested through the SQL it renders; controllers through
  `createApp` with a fake DAO on the context. A new resource gets a controller test copied from the entity one.
- **`types: ["node"]` is explicit** in `tsconfig.app.json`: TypeScript 6 defaults `types` to `[]`. Every new config file
  goes into the `include` of `tsconfig.node.json`, or ESLint reports it as belonging to no project.
- **Pino logs plain JSON.** `pino-pretty` is only a pipe in the `dev` script.
- **`drizzle.config.ts` throws** when `DATABASE_URL` is missing.

### The DAO layer

Each layer has one job; the full walk-through is in [references/api-dao.md](references/api-dao.md#how-the-layers-fit).

| layer | file | holds |
| --- | --- | --- |
| contract | `models/dao.model.ts` | `Dao<T, ListInput, CreateInput, UpdateInput>`, `PaginatedResult`, `IdInput`; no zod, no drizzle |
| vocabulary | `models/list-input.model.ts` | scalar filter inputs (id, string, number, date, boolean), `createFilterInputSchema`, `createSortInputSchema`, `createListInputSchema` |
| translation | `helpers/dao.helper.ts` | `FilterTable` / `SortTable`, `filterToSql`, `sortToSql`, `toPaginatedResult` |
| HTTP parsing | `helpers/query-parser.helper.ts` | `normalizeQuery` |
| resource | `db/schemas/<resource>.schema.ts` | table, create / update / filter / sort / list input schemas, default sort, and the types inferred from them |
| DAO | `daos/<resource>.dao.ts` | `implements Dao<Entity, ListEntityInput, CreateEntityInput, UpdateEntityInput>`; queries only |

- **One contract, single-input methods:** `get({ id })` → `T | null`, `list(input)` → `PaginatedResult<T>`,
  `create(input)`, `update(input)` with the `id` inside the input, `delete({ id })` → `void`. DAOs throw
  `NotFoundError`; controllers turn it into a 404.
- **Typed filter inputs, AppSync-style:** a resource declares
  `createFilterInputSchema({ name: stringFilterInputSchema, createdAt: dateFilterInputSchema, … })`, which adds
  recursive `and` / `or` / `not`. Operators are fixed per kind: `eq ne lt le gt ge between in`, plus case-insensitive
  `contains notContains beginsWith` for strings; ids take `eq ne in`, booleans `eq ne`. Strict schemas reject unknown
  fields and operators.
- **Fields are named after columns.** The DAO passes its drizzle table to `filterToSql` / `sortToSql`; a field with no
  matching column does not compile. There are no column maps.
- **Sorting:** an allowlist via `createSortInputSchema([...])`, a `<resource>DefaultSort`, and an `id` tie-breaker
  appended to every sort.
- **Pagination is page-based:** `page` / `pageSize` in, `{ items, total, page, pageSize, totalPages }` out. The list
  input schema applies the defaults (1, 20) and the range (max 100), so the DAO receives both set.
- **URL decoding lives in the controller.** `?filter=<json>&sortField=…&sortDirection=ASC|DESC&page=…&pageSize=…`
  is decoded in the handler (unknown params → 400, `JSON.parse` the filter, build `sort`, numbers for the page) and
  then validated by `list<Resource>InputSchema = createListInputSchema({ filter, sort })`, which takes the structured
  input and knows nothing about the URL.
- **Resource schema files carry no comments and follow one order:** the table, the schemas (select, id, create,
  update, filter, sort, list), the default sort, then the inferred types in the same order. The naming patterns and
  the builders carry the meaning, and the conventions file explains them.
- **Types come from `z.infer`**, including the recursive filter type and `List<Resource>Input`; `dao.model.ts`
  defines no input types. The web mirrors the API's resource types by name
  in `models/<resource>.model.ts`.

### Web

- **Components never use the store**; they take `input()` / `output()`. Pages and layouts may read it.
- **Pages inject only the `Store`.** Route params come from `selectRouteParam` / `selectQueryParams` in the app-router
  slice, navigation is `AppRouterActions.navigate` (its effect is the only `Router` caller), and forms are
  `new FormGroup` rather than an injected `FormBuilder`. Services are injected only in effects.
- **Data access lives in `services/`.** `EntityService` is the only `HttpClient` user and is called only from effects.
  Each method writes its URL explicitly and builds its params inline, with no private URL or params helper.
- **Every page loads the same way:** `Load` on init, `Leave` on destroy; the slice goes `'loading'` → `'loaded'` (or
  `'error'`). Each slice has one `status` union and an `error` message, never `loading` / `saving` / `deleting`
  booleans, and templates use `@switch (status())`.
- **Global NgRx slices:**
  - `appContext` holds `apiBaseUrl` and `appName`, and is the only consumer of Angular `environment`.
  - `appRouter` (`store/app-router/app-router.selectors.ts`) holds the `@ngrx/router-store` state; its key is passed
    to `provideRouterStore({ stateKey })` and its selectors come from `getRouterSelectors(selectRouterState)`.
- **One slice per page.** Each page owns `store/<page-name>/` (model, actions, reducer, selectors, effects) and
  registers it on its route with `provideState` + `provideEffects`; a page reads only its own slice. Detail and form
  each load the entity themselves. The form serves two routes, so it registers its slice once on a shared parent
  route. Route-level effects outlive the page, so navigation effects filter by path.
- **The URL is the source of truth.** The list page dispatches `Load` and navigates with
  `AppRouterActions.navigate({ commands: [], queryParams })`; its effect loads whenever the list input in the URL
  changes (`Fetch({ input })`), until `Leave`.
- **Actions are named for intent, not lifecycle:** `Load` (not `Enter` / `Init`), `Fetch` for one request with a given
  input, and `<Action> Success` / `<Action> Failure` for results. This is
  what makes back, forward, refresh and deep links work.
- **Inline templates and Tailwind utilities.** There are no `.html` or `.scss` files.

### Infra

- Both images build with the **repo root** as context, because `catalog:` entries resolve only against the root
  `pnpm-workspace.yaml` and lockfile. Corepack takes the pnpm version from `packageManager`.
- `./api/db/scripts/init.sql` creates the Postgres `app` DB, and its data is bind-mounted at `./api/db/data/`.
- The web image ends in Nginx, serving static files with an SPA fallback and no reverse proxy to the API.

## Adding to an existing repo

When the target already has a `package.json`, do not overwrite it. Ask whether to add `api/` and `web/` to it as a
pnpm workspace, then:

1. Merge `api` and `web` into the existing `pnpm-workspace.yaml` `packages` (create the file if there is none) and add
   the `allowBuilds` entries that are missing.
2. Add the root scripts that do not exist yet with `pnpm pkg set`. Check with the user before replacing a script of the
   same name, and before replacing an existing `packageManager`.
3. Merge the `.gitignore` and `.dockerignore` entries; keep an existing `docker-compose.yml` and add the three services
   to it, or ask before creating a second Compose file.
4. Run steps 3 to 7 as written. If the repo already pins TypeScript or the shared tooling in a catalog, keep its
   versions when they satisfy the constraints above, and say so when they do not.

## References

- **Root files** (workspace, manifest, shared tooling, ignore files, env, Compose):
  [references/monorepo-root.md](references/monorepo-root.md)
- **API setup** (manifest, dependencies, tsconfigs, app shell, Dockerfile): [references/api-setup.md](references/api-setup.md)
- **API DAO layer** (how the layers fit, DAO contract, list-input vocabulary, errors, SQL translator, query normalizer,
  tests, extending the vocabulary): [references/api-dao.md](references/api-dao.md)
- **API entity example** (resource schema, table registry, DAO, controllers, controller test, adding a resource):
  [references/api-entity.md](references/api-entity.md)
- **Web scaffold** (CLI, cleanup, Tailwind, NgRx, router-store, pages, spec, Nginx): [references/web.md](references/web.md)
- **Fundamental NGX + SAP Horizon opt-in**: [references/fundamental-ngx.md](references/fundamental-ngx.md)
- **ESLint + Prettier per project**: [references/eslint-prettier.md](references/eslint-prettier.md)
- **Coding conventions** (copied to the repo root): [references/coding-conventions.md](references/coding-conventions.md)
- **Decisions and their reasons**: [references/decisions.md](references/decisions.md)

## Review Checklist

- [ ] Node 24+, pnpm 11+ and Docker confirmed; TypeScript peer ranges checked before pinning
- [ ] `typescript` in the catalog is an exact 6.0.x; shared tools read `catalog:` in both manifests
- [ ] `pnpm install` succeeds at the root with no `ERR_PNPM_IGNORED_BUILDS`
- [ ] `pnpm build && pnpm typecheck && pnpm test && pnpm lint && pnpm format:check` passes
- [ ] `docker compose up --build` starts all three services and the `db` healthcheck passes
- [ ] `pnpm --filter api db:generate --name init` produces exactly one migration, and `db:migrate` applies it
- [ ] `curl http://localhost:3000/health` returns `{status:'ok', db:'up', …}`
- [ ] `curl http://localhost:4200/entities` returns 200
- [ ] `POST /entities` creates; `GET /entities?filter=<json>&sortField=…&sortDirection=…&page=&pageSize=` returns
      `{items,total,page,pageSize,totalPages}`; an unknown filter field or operator returns 400; `PATCH /entities/:id`
      updates; `DELETE /entities/:id` returns 204, and 404 for a missing id
- [ ] `.env` is not committed and `.env.example` is
- [ ] `coding-conventions.md` is at the repo root
