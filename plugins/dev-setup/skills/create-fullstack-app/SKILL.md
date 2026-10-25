---
name: create-fullstack-app
description: Scaffolds a pnpm-workspace monorepo with an Express 5 + Drizzle + Postgres + zod API, an Angular 22 + NgRx + Tailwind web app built as a statechart where the router feeds the store and pages read only their slice, Docker Compose, and an entity CRUDL example wired end to end, with build, typecheck, test, lint and format checks passing. Use when creating a new full-stack TypeScript app, an Angular + Express or Angular + Postgres project, a monorepo with an API and a web frontend, or when the user asks to bootstrap, scaffold, init or start a full-stack project.
disable-model-invocation: true
---

# Create Full-Stack App

Creates a pnpm-workspace monorepo with this shape:

- **`api/`: Express 5 + Drizzle + Postgres + zod + Pino.** An app factory takes a context singleton; controllers call
  DAOs, and DAOs are the only code that touches Drizzle. The DAO layer follows an AppSync-style contract: `get` /
  `list` / `create` / `update` / `delete`, typed `<Type>FilterInput`s with `and` / `or` / `not`, and page-based lists
  (see [The DAO layer](#the-dao-layer)).
- **`web/`: Angular 22 + NgRx + `@ngrx/router-store` + Tailwind v4, built as a statechart.** Each page route is a
  state and actions are the only transitions. The URL enters the store one way (`routerNavigatedAction` → the page
  reducer whose state matches), pages read only their slice, and each page loads its data from its own lifecycle.
  Templates are inline, and there are no `.html` or `.scss` files. Fundamental NGX + SAP Horizon is opt-in.
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
│   │   ├── helpers/          # dao.helper.ts (input → SQL), list-input.helper.ts (schema builders), query-parser.helper.ts (normalizeQuery)
│   │   ├── daos/             # one *.dao.ts per table, nothing else
│   │   ├── controllers/      # *.controller.ts, wired directly on the app
│   │   └── middlewares/      # error + not-found
│   └── tests/                # grouped by kind; unit/ mirrors src/:
│       ├── unit/             #   mirrors src/: helpers, db/schemas, controllers, middlewares — functions called directly, stub DAO
│       ├── db/               #   <resource>.dao.test.ts (Testcontainers)
│       ├── api/              #   API tests, end to end: <resource>.api.test.ts (real HTTP → DAO → Testcontainers)
│       └── utils/            #   shared test helpers (http-mocks, pg-container, test-server, seeds)
└── web/
    ├── Dockerfile            # multi-stage → Nginx, SPA fallback
    ├── nginx.conf
    ├── eslint.config.mjs
    ├── .storybook/           # Storybook (Vite/Analog) config
    ├── vitest.config.mts     # Vitest projects unit (jsdom) + browser (Chromium), run by ng test (Analog builder)
    ├── playwright.config.ts  # full-stack e2e runner
    ├── e2e/                  # Playwright specs (pages/) + e2e ports/DB + API seeding (utils/) + global setup/teardown
    └── src/
        ├── test-setup.ts / testing/   # setupTestBed() for unit; render() + setup for browser mode
        ├── environments/    # production, development, e2e
        └── app/
            ├── pages/ layouts/ components/   # flat *.component.ts; components/ has ConfirmDialog + its story + browser spec
            ├── models/ services/ helpers/  # resource types, EntityService (only HttpClient user), helpers; *.spec.ts beside
            └── store/        # app-context/ + app-router/ globally, one slice per page on its route; reducer/selectors/effects specs beside
```

The web app has three test layers (`ng test` unit and `pnpm test:browser` browser mode, both on Analog's Vitest builder;
`pnpm test:e2e` Playwright full-stack on its own database and ports) and Storybook for the components — see [references/web-testing.md](references/web-testing.md) and
[references/web-storybook.md](references/web-storybook.md).

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
   Fundamental NGX, unless the prompt already says. The app name shown in the UI is the repo name in Title Case
   (`my-app` → `My App`); it replaces every `<App name>` and the CLI's `<title>Web</title>` in `web/src/index.html`. Node must be 24 or newer, pnpm 11 or newer (`allowBuilds` is a
   pnpm 11 setting), and Docker must be running. Use pnpm for everything, never npm. Stop if the target directory
   already holds a `package.json`: follow [Adding to an existing repo](#adding-to-an-existing-repo) instead.

   ```sh
   node -e "process.exit(+process.versions.node.split('.')[0] >= 24 ? 0 : 1)" || echo "node 24+ required"
   pnpm --version   # 11 or newer
   docker info --format '{{.ServerVersion}}'
   for p in 5432 3000 4200 3100 4300 6006; do lsof -iTCP:$p -sTCP:LISTEN -t >/dev/null && echo "port $p in use"; done
   ```

   The ports are Postgres, the API and the web app (Compose and local dev), the e2e API and web server, and Storybook;
   stop with the user if one is taken.

2. **Create the repo and the root files** from [references/monorepo-root.md](references/monorepo-root.md):
   `package.json`, `pnpm-workspace.yaml` (packages + `allowBuilds`, no catalog yet), `.gitignore`, `.dockerignore`,
   `.env.example`, `docker-compose.yml`. Then:

   ```sh
   git init -q
   pnpm pkg set packageManager="pnpm@$(pnpm --version)"
   cp .env.example .env
   ```

3. **Write the API** from [references/api-setup.md](references/api-setup.md) (manifest, configs, app shell,
   Dockerfile), [references/api-dao.md](references/api-dao.md) (DAO contract, list-input vocabulary and builder helper,
   SQL translator, query parser, their `unit/` tests) and [references/api-entity.md](references/api-entity.md) (resource
   schema, DAO and its Testcontainers `db/` test, the three controllers and both middlewares with a `unit/` test each,
   the end-to-end `api/` test, and the shared `tests/utils/` helpers). Read the "How the layers
   fit" section of `api-dao.md` first. Write files only: every `pnpm add` runs in step 5. Add `api/.prettierrc`,
   `api/.prettierignore` and `api/eslint.config.mjs` from [references/eslint-prettier.md](references/eslint-prettier.md).
   Do not create `db/migrations/`.

4. **Scaffold the web app**, then immediately apply [references/web.md](references/web.md) in order: clean up the CLI
   output, set the scripts, add Tailwind, the environment files, the core files, the global slices, the shared model,
   one slice per page, the three pages and the spec. As in step 3, write files and run the `pnpm pkg` commands, but
   leave every `pnpm add` to step 5. Add `web/.prettierrc`, `web/.prettierignore` and
   `web/eslint.config.mjs` from [references/eslint-prettier.md](references/eslint-prettier.md).

   ```sh
   pnpm dlx @angular/cli@22 new web --directory=web --package-manager=pnpm --skip-install --skip-git \
     --style=scss --routing=true --ssr=false --defaults
   ```

   For the Fundamental NGX opt-in, layer [references/fundamental-ngx.md](references/fundamental-ngx.md) on top.

   Then add **Storybook** ([references/web-storybook.md](references/web-storybook.md)) and the **test setup**
   ([references/web-testing.md](references/web-testing.md)): the `test` target switched to
   `@analogjs/vitest-angular:test`, `vitest.config.mts` with the `unit` and `browser` projects, the setup files, every
   spec in the [spec inventory](references/web-testing.md#spec-inventory), the e2e environment, `angular.json`
   configuration and Playwright files, and the `storybook` / `build-storybook` / `test:browser` / `test:e2e` scripts.
   The `ConfirmDialog` component in `components/` (from `web.md`) is the example these build on.

5. **Add the dependencies**, in this order, each package once:
   1. the API's ([api-setup.md](references/api-setup.md#dependencies));
   2. the web's NgRx, Tailwind and angular-eslint ([web.md §3](references/web.md#3-scripts-and-dependencies));
   3. Storybook's ([web-storybook.md](references/web-storybook.md#dependencies));
   4. the test layers' ([web-testing.md §1](references/web-testing.md#dependencies) and
      [§4](references/web-testing.md#dependencies-and-script)), with the one-time `playwright install chromium`;
   5. the shared tooling ([monorepo-root.md](references/monorepo-root.md#shared-tooling)). Before it, check that the
      TypeScript peer ranges of typescript-eslint and `@angular/compiler-cli@22` still overlap, and pin the newest
      version both accept, exactly, with `pnpm add -E --save-catalog`.

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
   pnpm test:integration                         # DAO + API tests vs a Testcontainers Postgres (needs Docker + migrations)
   curl -s http://localhost:3000/health
   ```

   `test:integration` runs only now, because the `db` and `api` projects apply `db/migrations/` and those exist only
   after the first `db:generate`. Then walk through the [Review Checklist](#review-checklist).

## Version constraints

`pnpm add` resolves current versions at scaffold time; these are the constraints it works within, and why.

| what                                    | constraint                  | why                                                               |
| --------------------------------------- | --------------------------- | ----------------------------------------------------------------- |
| Node                                    | 24+                         | the Dockerfiles run `node:24-alpine`; `@types/node@24` follows it |
| pnpm                                    | 11+                         | `allowBuilds` in `pnpm-workspace.yaml`                            |
| TypeScript                              | exact 6.0.x, in catalog     | Angular 22 needs `>=6.0 <6.1`; typescript-eslint supports `<6.1`  |
| `@angular/*`, `@ngrx/*`, angular-eslint | major 22                    | NgRx and angular-eslint release in step with Angular's major      |
| `@fundamental-ngx/*`                    | exact 0.65.x                | the release whose peer range covers Angular 22                    |
| Tailwind                                | major 4                     | the CSS-first `@import` layers and `@tailwindcss/postcss` plugin  |
| Vitest, `@vitest/browser*`              | major 5, in catalog         | one major for the API and web; the browser packages match it      |
| Storybook / `@storybook/angular-vite`   | major 10                    | the Vite/Analog builder that fits the esbuild toolchain           |
| `@analogjs/vite-plugin-angular`         | major 2                     | compiles Angular under Vite for Storybook and the tests           |
| `@analogjs/vitest-angular`              | major 2                     | the `ng test` builder and `setupTestBed`                          |
| Playwright / `@playwright/test`         | major 1                     | full-stack e2e in a real browser                                  |
| Postgres / Nginx images                 | `17-alpine` / `1.27-alpine` | pinned in `docker-compose.yml` and `web/Dockerfile`               |

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
- Tests: API `tests/**/*.test.ts` grouped by kind (`unit/`, `api/`, `db/`, `utils/`), one top-level `describe` per file named for the module; web `*.spec.ts` / `*.browser.spec.ts` beside the file, same `describe` rule; e2e `e2e/pages/*.spec.ts`

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
  inputs from the `createFilterInputSchema` / `createSortInputSchema` / `createListInputSchema` builders in
  `helpers/list-input.helper.ts`. Controllers validate every input inline with `safeParse` and throw
  `createError(400, …)` on failure.
- **Tests are grouped by kind under `tests/{unit,db,api,utils}/`**, `unit/` mirroring `src/`, and each file wraps its
  suites in one top-level `describe` named for the module. A single `vitest.config.ts` defines three `projects`:
  - `pnpm test` runs **`unit`** with no database — the filter / sort translator through the SQL it renders, the
    list-input builders directly, and **every controller and middleware as a plain function**: called with
    `mockRequest` (a stub DAO on `req.app.locals.context`), `mockResponse` and `mockNext` from `tests/utils/http-mocks.ts`,
    asserting the response or the error forwarded to `next`, and what the DAO received. No app, no server.
  - `pnpm test:integration` runs **`db` + `api`** against a throwaway `postgres:17-alpine` via Testcontainers
    (`@testcontainers/postgresql`), migrated with the drizzle migrator. `db` tests the real DAO directly, `list`
    exhaustively (filter, sort, pagination, alone and combined). `api` is the **API tests, end to end**: the real app
    on the real DAO, one `<resource>.api.test.ts` per resource covering every route and the errors only the real stack
    produces, plus what `app.ts` adds around the handlers (body parsing, the route table, the not-found → error chain).
    It needs Docker and an existing `db/migrations/`, so it runs after the first `db:generate`. A new resource gets a
    controller and a schema test in `tests/unit/`, a DAO test in `tests/db/` and an API test in `tests/api/`.
- **`types: ["node"]` is explicit** in `tsconfig.app.json`: TypeScript 6 defaults `types` to `[]`. Every new config file
  goes into the `include` of `tsconfig.node.json`, or ESLint reports it as belonging to no project.
- **Pino logs plain JSON.** `pino-pretty` is only a pipe in the `dev` script.
- **`drizzle.config.ts` and `db/client.ts` throw** when `DATABASE_URL` is missing; there is no fallback URL.

### The DAO layer

Each layer has one job; the full walk-through is in [references/api-dao.md](references/api-dao.md#how-the-layers-fit).

| layer        | file                              | holds                                                                                                                                 |
| ------------ | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| contract     | `models/dao.model.ts`             | `Dao<T, ListInput, CreateInput, UpdateInput>`, `PaginatedResult`, `IdInput`; no zod, no drizzle                                       |
| vocabulary   | `models/list-input.model.ts`      | scalar filter inputs (id, string, number, date, boolean), `sortDirectionSchema`, and the derived filter types                        |
| builders     | `helpers/list-input.helper.ts`    | `createFilterInputSchema`, `createSortInputSchema`, `createListInputSchema`, and the page-size limits                                 |
| translation  | `helpers/dao.helper.ts`           | `FilterTable` / `SortTable`, `filterToSql`, `sortToSql`, `toPaginatedResult`                                                          |
| HTTP parsing | `helpers/query-parser.helper.ts`  | `normalizeQuery`                                                                                                                      |
| resource     | `db/schemas/<resource>.schema.ts` | table, create / update / filter / sort / list input schemas, default sort, and the types inferred from them                           |
| DAO          | `daos/<resource>.dao.ts`          | `implements Dao<Entity, ListEntityInput, CreateEntityInput, UpdateEntityInput>`; queries only                                         |

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

- **The app is a statechart.** Each page route declares its state in `data: { state }` (`entity-list`,
  `entity-detail`, `entity-new`, `entity-edit`, typed by `AppState`); each page's `status` union holds its sub-states;
  actions are the only transitions.
- **The router only writes state.** `AppRouterSerializer` reduces each navigation to `{ url, state, params,
  queryParams }`; on `routerNavigatedAction` the page reducer whose state matches copies its route state (the list
  input, the detail id, the form target), read with `navigatedRoute(action)`. No effect reacts to a navigation.
  Router actions fire after activation (`navigationActionTiming: PostActivation`).
- **Components never use the store**; they take `input()` / `output()`. Pages and layouts may read it.
- **Pages inject only the `Store` and read only their slice.** Route params and the list query come from the page's
  own selectors, never from router selectors; navigation is `AppRouterActions.navigate` (its effect is the only
  `Router` caller, and it takes `replaceUrl`), and forms are `new FormGroup` rather than an injected `FormBuilder`.
  Services are injected only in effects.
- **Data access lives in `services/`.** `EntityService` is the only `HttpClient` user and is called only from effects.
  Each method writes its URL explicitly and builds its params inline, with no private URL or params helper.
- **Every page loads the same way:** a watch started in `ngOnInit` (never the constructor) on the slice's route state
  — skip `null`, `distinctUntilChanged`, `takeUntilDestroyed` — dispatches `Fetch` / `Load` for each new value, and
  `ngOnDestroy` dispatches `Leave`; the slice goes `'loading'` → `'loaded'` (or `'error'`). A reused page (list page
  2 → 3, detail 42 → 43) reloads through its running watch. Each slice has one `status` union and an `error` message, never `loading` / `saving` / `deleting`
  booleans; the status-driven body is a `@switch (status())`, the error banner an `@if`.
- **Global NgRx slices:**
  - `appContext` holds `apiBaseUrl` and `appName`, and is the only consumer of Angular `environment`.
  - `appRouter` holds the serialized router state; its key is passed to `provideRouterStore({ stateKey })`. Only
    devtools read it: pages and page slices get the route from `routerNavigatedAction`.
- **One slice per page.** Each page owns `store/<page-name>/` (model, actions, reducer, selectors, effects) and
  registers it on its route with `provideState` + `provideEffects`; a page reads only its own slice. Detail and form
  each load the entity themselves. The form serves two states, so it registers its slice once on a shared parent
  route. Route-level slices outlive the page, so each resets on `Leave`, and a new id or target starts it over.
- **A list query change is a navigation.** The list page builds the next input from its slice and dispatches
  `AppRouterActions.navigate({ commands: [], queryParams: toParams(next) })`; the reducer copies the new input and the
  watch fetches it. Refresh, back, forward and deep links take the same path.
- **Actions are named for intent, not lifecycle:** `Load` (not `Enter` / `Init`), `Fetch` for one request with a given
  input, `<Action> Success` / `<Action> Failure` for results, and `Leave`.
- **Inline templates and Tailwind utilities.** There are no `.html` or `.scss` files.
- **Components are developed in Storybook and tested in three layers.** `components/` holds store-free
  `input()`/`output()` components (example: `ConfirmDialog`) with a `*.stories.ts` and a `*.component.browser.spec.ts`
  beside each; none sets `changeDetection` (`OnPush` is Angular 22's default). `ng test` runs on Analog's Vitest builder
  from one `vitest.config.mts`: project `unit` (jsdom, `*.spec.ts` — services, slices, helpers) and, with
  `-c browser`, project `browser` (components and pages in real Chromium). Every spec is in `tsconfig.spec.json`,
  because Analog compiles only that program. `pnpm test:e2e` runs Playwright against the real app + API + Postgres on
  its own database (`app_e2e`) and ports (`:4300` / `:3100`), so the dev stack is never touched. Details in
  [references/web-testing.md](references/web-testing.md) and [references/web-storybook.md](references/web-storybook.md).
- **A page past the end steps back in the slice** (`stepBackPastLastPage$`), like every other navigation: pages hold no
  navigation side effects.

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
- **API DAO layer** (how the layers fit, DAO contract, list-input vocabulary, the builder helper, errors, SQL
  translator, query normalizer, their `unit/` tests, extending the vocabulary): [references/api-dao.md](references/api-dao.md)
- **API entity example** (resource schema, table registry, DAO and its Testcontainers `db/` test, the three
  controllers, the controller and middleware unit tests, the end-to-end API test, the shared `tests/utils/` helpers,
  the schema test, adding a resource):
  [references/api-entity.md](references/api-entity.md)
- **Web scaffold** (CLI, cleanup, Tailwind, NgRx, router-store, components, pages, spec, Nginx): [references/web.md](references/web.md)
- **Web Storybook** (Vite/Analog builder, `.storybook/` config, targets, the `ConfirmDialog` story): [references/web-storybook.md](references/web-storybook.md)
- **Web tests** (Analog's Vitest builder, the unit and browser projects, full-stack Playwright e2e on its own stack): [references/web-testing.md](references/web-testing.md)
- **Fundamental NGX + SAP Horizon opt-in**: [references/fundamental-ngx.md](references/fundamental-ngx.md)
- **ESLint + Prettier per project**: [references/eslint-prettier.md](references/eslint-prettier.md)
- **Coding conventions** (copied to the repo root: architecture and building blocks of both projects, HTTP contract,
  list queries, the web statechart, the store and the router, where web state lives, naming, code style, the test
  tiers, adding a resource, a before-you-merge checklist): [references/coding-conventions.md](references/coding-conventions.md)
- **Decisions and their reasons**: [references/decisions.md](references/decisions.md)

## Review Checklist

- [ ] Node 24+, pnpm 11+ and Docker confirmed; TypeScript peer ranges checked before pinning
- [ ] `typescript` in the catalog is an exact 6.0.x; shared tools read `catalog:` in both manifests
- [ ] `pnpm install` succeeds at the root with no `ERR_PNPM_IGNORED_BUILDS`
- [ ] `pnpm build && pnpm typecheck && pnpm test && pnpm lint && pnpm format:check` passes
- [ ] `docker compose up --build` starts all three services and the `db` healthcheck passes
- [ ] `pnpm --filter api db:generate --name init` produces exactly one migration, and `db:migrate` applies it
- [ ] `pnpm test:integration` passes (DAO and API tests against a Testcontainers Postgres; needs Docker and the migration above)
- [ ] `curl http://localhost:3000/health` returns `{status:'ok', db:'up', …}`
- [ ] `curl http://localhost:4200/entities` returns 200
- [ ] `POST /entities` creates; `GET /entities?filter=<json>&sortField=…&sortDirection=…&page=&pageSize=` returns
      `{items,total,page,pageSize,totalPages}`; an unknown filter field or operator returns 400; `PATCH /entities/:id`
      updates; `DELETE /entities/:id` returns 204, and 404 for a missing id
- [ ] `.env` is git-ignored and `.env.example` is not (`git check-ignore .env`)
- [ ] `coding-conventions.md` is at the repo root
- [ ] Every page route in `app.routes.ts` declares its `data: { state }`, and no file outside `store/app-router/`
      imports a router-store selector or reacts to `routerNavigatedAction` in an effect
- [ ] `pnpm --filter web build-storybook` builds; `pnpm --filter web storybook --smoke-test --ci` starts and exits 0, and
      `storybook-static/index.json` lists the three `ConfirmDialog` stories
- [ ] `pnpm test:browser` passes (Vitest browser mode + Playwright; needs `playwright install chromium` once)
- [ ] `pnpm test:e2e` passes (Playwright full-stack; needs Docker, the root `.env` and the migration above), and the dev
      database and any running Compose services are as they were
