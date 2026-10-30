# Express

Express 5 as an HTTP API: an app factory, a context singleton, controllers that validate with zod and call the data
layer, one error shape, and Pino logs.

**Realises:** [REST API](../architecture/rest-api.md)

## Use it like this

- **`server.ts` is the composition root.** It builds the database client and every DAO, puts them on an `AppContext`,
  calls `createApp(context)`, starts the HTTP listener, and on `SIGINT` / `SIGTERM` closes the server and then the
  database pool. It is the only place that opens connections.
- **`app.ts` is a pure factory.** `createApp(context)` stores the context once on `app.locals.context` (a singleton,
  not a middleware: it does not vary per request), registers `pinoHttp({ logger })`, `cors()` and `express.json()`,
  mounts every handler directly on the app, and ends with `notFoundHandler` then `errorHandler`. It reads no
  environment and opens no connection, so tests build an app around any context.
- **No routers**: `app.get('/entities', listEntities)` on the app reads clearer at this size. The context type reaches
  handlers through an ambient augmentation, `src/express.d.ts`, declaring `Express.Locals { context: AppContext }`.
- **Controllers are the HTTP edge, fully inlined.** One exported `async (req, res, next): Promise<void>` per route,
  named verb + resource (`listEntities`, `getEntity`, `getHealth`), with the same `try { … } catch (err) { next(err) }`
  skeleton even when nothing is awaited. Each validates every input inline with zod `safeParse` and throws
  `createError(400, …, { expose: true, cause: z.flattenError(error) })` on failure, calls a DAO through
  `req.app.locals.context`, and shapes the response. No `parseOr400` helpers: a handler shows every error it can
  produce.
- **Errors leave a controller only through `next(err)`**, and `errorHandler` shapes every response as
  `{ status: 'error', message }`: the error's own message for an `http-errors` error created with `expose: true`,
  `Internal Server Error` for anything else. It logs 5xx at `error` and 4xx at `warn`, so routine client mistakes do
  not bury real faults, and hands on to Express's `next` when the headers already went out. `notFoundHandler` forwards
  `createError(404, 'Not Found: <METHOD> <path>')`.
- **Pino logs plain JSON**, at `LOG_LEVEL` (default `debug`, `info` when `NODE_ENV=production`). `pino-pretty` is a
  pipe in the `dev` script only, never an import or a `transport`, so the logger never depends on a dev dependency.
- **Built with `tsc` to `dist/`**: `build` is `tsc -p tsconfig.app.json`, `start` is
  `node --env-file=<root .env> dist/server.js`, and `dev` is
  `node --env-file=<root .env> --import=tsx --watch src/server.ts | pino-pretty …`, where `<root .env>` is `.env` in a
  single package and `../.env` in a workspace package. Sources import with the `.js` extension.
- **Tests at two tiers.** Unit tests call each controller and middleware as a plain function with a mock `req` (a stub
  DAO on `req.app.locals.context`), a spy `res` and a spy `next`: every validation, error-mapping and logging branch is
  cheap to reach. API tests serve the real app on the real DAO and a real database and drive it over `fetch`: they
  cover what `app.ts` adds around the handlers (body parsing, the route table, the not-found → error chain) and that
  the real DAO accepts what the controller sends.

## Required values

| What                    | Value                                                                                                                                                                                                                                                                           |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| dependencies            | `express`, `cors`, `http-errors`, `pino`, `pino-http`, `zod`                                                                                                                                                                                                                    |
| devDependencies         | `@types/express`, `@types/cors`, `@types/http-errors`, `pino-pretty`, `tsx`                                                                                                                                                                                                     |
| `tsconfig.app.json`     | `module`/`moduleResolution` `"NodeNext"`, `lib`/`target` `"ES2024"`, `outDir: "dist"`, `rootDir: "src"`, `types: ["node"]`, `strict`, `skipLibCheck`, `sourceMap`, `composite: true` with its own `tsBuildInfoFile`, `include: ["src/**/*.ts"]` (which picks up `express.d.ts`) |
| `tsconfig.node.json`    | extends the app project with `composite: false`, `noEmit: true`, `rootDir: "."`, its own `tsBuildInfoFile`; includes the config files and `tests/**/*.ts`                                                                                                                       |
| `typecheck`             | `tsc -p tsconfig.app.json --noEmit && tsc -p tsconfig.node.json`                                                                                                                                                                                                                |
| error body              | `{ status: 'error', message }`                                                                                                                                                                                                                                                  |
| `express.json()` limits | malformed JSON → 400, a body over 100 kB → 413, both through `errorHandler`                                                                                                                                                                                                     |

## Pitfalls

- **Express identifies an error handler by its four parameters**: keep `(err, req, res, next)` even when `next` is used
  only for headers already sent.
- **A response spy written as a method fails `unbound-method`** in `expect(res.json)`: make the spies plain
  properties.
- **`tsconfig.node.json` must switch `composite` off**: the tests import from `src/`, which that project does not list.

## Conventions

### Architecture

```
server.ts  builds the AppContext once: { db, <resource>Dao: new <Resource>Dao(db), … }
   │
createApp(context)   app.ts sets app.locals.context, then:
request ─► pino-http ─► cors ─► express.json() ─► route ─► controller ─► DAO ─► Postgres
errors:  any throw ─► next(err) ─► notFoundHandler (no route) ─► errorHandler ─► { status: 'error', message }
```

- **`server.ts` is the composition root**: the only place that creates the pool and the DAOs, starts the listener and
  closes the pool on shutdown.
- **`app.ts` is a pure factory**: the context goes on `app.locals.context` once, handlers mount directly on the app
  (no routers), and nothing in it reads the environment.
- **Controllers are the HTTP edge; DAOs are the only code that touches the database.**

### Building blocks

| Block      | Lives in                                       | Is                                              | Must not                                                    |
| ---------- | ---------------------------------------------- | ----------------------------------------------- | ----------------------------------------------------------- |
| controller | `controllers/<resource>.controller.ts`         | one exported `async (req, res, next)` per route | import the ORM or a DAO class, build SQL, log errors itself |
| middleware | `middlewares/<name>.middleware.ts`             | `errorHandler` (terminal) and `notFoundHandler` | call a DAO                                                  |
| context    | `models/app-context.model.ts` + `express.d.ts` | `AppContext` and its typing on `Express.Locals` | —                                                           |
| logger     | `logger.ts`                                    | one Pino instance emitting JSON                 | import `pino-pretty`                                        |
| helper     | `helpers/<name>.helper.ts`                     | transport-agnostic functions                    | take an Express `Request`                                   |
| model      | `models/<name>.model.ts`                       | types and error classes                         | contain logic                                               |

### Controllers and errors

- **Every handler has one shape**: `async (req, res, next): Promise<void>` with `try { … } catch (err) { next(err) }`.
- **Every input is validated inline with `safeParse`**; a failure throws `createError(400, …, { expose: true, cause })`.
  There are no shared validation helpers, so each handler shows every error it can produce.
- **Errors leave a handler only through `next(err)`**; `errorHandler` writes `{ status: 'error', message }`, the message
  only when the error is exposed, and logs 5xx at `error` and 4xx at `warn`.
- **Naming**: handlers are verb + resource (`listEntities`, `getEntity`), never `entityController`; middlewares end in
  `Handler`. Folders are plural, files keep the singular suffix (`controllers/entity.controller.ts`).
- **Logs are JSON**; `pnpm dev` pipes them through `pino-pretty`.

### Testing the API

- **Unit tests call handlers and middlewares as functions**, with `mockRequest({ context, params, query, body })`,
  `mockResponse()`, `mockNext()` and `mockLog()` from the test utilities, and a stub DAO from `createStubContext()`.
  They assert the response or the error passed to `next`, and what the DAO received; every 400 also asserts the DAO
  was never called. No app, no server.
- **API tests serve the real app** (`serve(createApp(context))`) on the real DAO and a real database, and
  drive it over `fetch`: every route's happy path, the errors only the real stack produces, and what `app.ts` adds
  (malformed JSON → 400, over 100 kB → 413, an unmatched path → 404 in the standard shape).
