# Decisions and their reasons

Each entry names a choice the scaffold makes, the alternative it rejects, and why. Read this before changing a
convention, so a rejected alternative is not reintroduced by accident.

## Contents

- [Infrastructure](#infrastructure): API URL, Docker build context, Postgres data, migrations, env file
- [Tooling](#tooling): TypeScript, catalog, tsconfig, Prettier vs ESLint, dev loop, tests
- [API](#api): context, routers, controllers, DAOs, errors, logging, query vocabulary
- [Web](#web): URL as state, slice placement, file layout, templates, styling

## Infrastructure

### The browser calls the API directly, configured by the Angular environment file

| approach                     | verdict  | why                                                                                    |
| ---------------------------- | -------- | -------------------------------------------------------------------------------------- |
| Nginx `/api` reverse proxy   | rejected | couples the web image to the API's address; the API URL should be configuration, not a route |
| Runtime `config.json` fetch  | rejected | a startup round-trip and extra code for no gain while every environment uses the same URL shape |
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
`--env-file-if-exists`. `drizzle.config.ts` throws when `DATABASE_URL` is unset, with no fallback.

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

### Tests need no database

The API is tested at two levels that run without Postgres: the query translator through the SQL it renders with
`PgDialect`, and the controllers through `createApp` with a fake DAO on the context. The DAO itself is covered by the
Compose smoke test. The web tests the URL (de)serializer every list page depends on. `test` is a required check in both
projects.

## API

### The context is a singleton on `app.locals`, not a middleware

`app.locals.context = context` is set once in `createApp`. A middleware would suggest the context varies per request
(it does not) and add a call to every request. The same singleton is what lets tests inject a fake DAO.

### No routers

`app.get('/health', healthController)` on the app is clearer than an intermediate router at this size.

### Controllers are fully inlined

Each handler validates, calls its DAO, and translates errors itself, so it reads top to bottom. Helpers like
`parseOr400` or `translateNotFound` would hide which errors each handler can throw. The one shared piece is
`parseQuery`, which is transport-agnostic and lives in `helpers/`.

### Data access goes through DAOs, never Drizzle in controllers

The controller is the HTTP edge. Mixing SQL with request parsing makes both harder to test and to reuse from a
background job. DAOs are instantiated once in `server.ts` and placed on the context.

### "Dao", not "Repository"

One class per table returning raw rows is DAO-shaped; "Repository" promises a domain abstraction that does not exist
yet. A later domain layer can add repositories that compose DAOs.

### DAOs throw sentinel errors; controllers translate them

DAOs throw `NotFoundError` and the parser throws `QueryParseError`, both from `models/error.model.ts`. Controllers turn
them into 404 and 400 with `http-errors`. DAOs stay callable from non-HTTP code.

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

### The query parser takes a plain params dict

`parseQuery(params, schema)` works with `req.query`, another framework, `URLSearchParams.entries()` or a test fixture.
Taking an Express `Request` would tie it to one transport.

### The query vocabulary is Hasura's JSON tree, not compact triples

`?where={"name":{"_ilike":"%foo%"},"_or":[...]}` was chosen over `?filter=name:ilike:foo`:

- nestable `_and` / `_or` / `_not` at any depth;
- per-column-type operator sets with no custom parser;
- a model many developers already know;
- the UI filter builder serializes to JSON, which is cheaper than a bespoke DSL.

The UI builder is flat by default (one top-level `_and` or `_or`); the API accepts the full tree, so the UI can add
groups later without a protocol change.

### Predicates are per column type

`models/query/predicates.ts` defines one schema per column type, each listing only its valid operators. A single
predicate for every field made `_ilike` on a timestamp parse and then fail in SQL.

### Query types come from `z.infer`

The zod schemas are the source of truth (`type EntityWhere = z.infer<typeof entityWhereSchema>`). Hand-written TS
mirrors of a recursive schema drift on every operator change.

## Web

### The URL is the source of truth for list queries

List pages dispatch `router.navigate([], { queryParams })`, and a `routerNavigatedAction` effect fetches. The
alternative, a query slice synced to the URL by an effect, needs two-way sync. URL-first gets refresh, back, forward,
deep links and bookmarkable views for free. The entities slice holds only server data; the query is derived from
`router.state.queryParams` by a selector.

### One shared slice per resource, registered globally

A resource's list, detail and form pages all mutate the same data, so per-page slices would mean three copies of the
actions and three cache-invalidation stories. A slice shared across a resource's pages lives at `store/<resource>/` and
is registered in `app.config.ts`. A slice only one page needs lives at `store/<page-name>/` and is registered on its
route.

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
