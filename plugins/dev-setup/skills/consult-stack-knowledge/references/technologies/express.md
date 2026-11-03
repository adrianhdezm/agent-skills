---
type: Technology
title: Express
description: the app factory, controllers, the error shape
resource: https://expressjs.com
role: framework
realises: [rest-api]
detect:
  dependencies: [express]
aliases: [Express, 'express()', '`express`']
stale_after: 2027-05-01T00:00:00Z
sources:
  - id: express-releases
    resource: https://github.com/expressjs/express/releases
    title: Express releases
---
# Express

Express 5[^express-releases] as an HTTP API: an app factory, a context singleton, controllers that validate with zod and
call the data layer, and one error shape.

**Realises:** [REST API](../architecture/rest-api.md)

## Use it like this

- **`server.ts` is the composition root.** It builds what the handlers use, puts it on an `AppContext`, calls
  `createApp(context)`, starts the HTTP listener, and on `SIGINT` / `SIGTERM` closes the server and then what it
  opened.
- **`app.ts` is a pure factory.** `createApp(context)` stores the context once on `app.locals.context` (a singleton,
  not a middleware: it does not vary per request), registers the request logger, `cors()` and `express.json()`,
  mounts every handler directly on the app, and ends with `notFoundHandler` then `errorHandler`. It reads no
  environment and opens no connection, so tests build an app around any context.
- **No routers**: `app.get('/entities', listEntities)` on the app reads clearer at this size. The context type reaches
  handlers through an ambient augmentation, `src/express.d.ts`, declaring `Express.Locals { context: AppContext }`.
- **Controllers are the HTTP edge, fully inlined.** One exported `async (req, res, next): Promise<void>` per route,
  named verb + resource (`listEntities`, `getEntity`, `getHealth`), with the same `try { … } catch (err) { next(err) }`
  skeleton even when nothing is awaited. Each validates every input inline with zod `safeParse` and throws
  `createError(400, …, { expose: true, cause: z.flattenError(error) })` on failure, calls a DAO through
  `req.app.locals.context`, and shapes the response. No `parseOr400` helpers: a handler shows every error it can
  produce. A file-private function for a repeated conversion (a query string to a number) keeps a list handler under
  the complexity limit and is fine; one that throws HTTP errors is not.
- **Errors leave a controller only through `next(err)`**, and `errorHandler` shapes every response as
  `{ status: 'error', message }`: the error's own message for an `http-errors` error created with `expose: true`,
  `Internal Server Error` for anything else, and hands on to Express's `next` when the headers already went out.
  `notFoundHandler` forwards `createError(404, 'Not Found: <METHOD> <path>')`.
- **Compiled, not run as it is**: `build` emits `dist/` and `start` runs it; the runtime's integration gives the
  commands.
- **Tests at two tiers.** Unit tests call each controller and middleware as a plain function with a mock `req` (a stub
  DAO on `req.app.locals.context`), a spy `res` and a spy `next`: every validation, error-mapping and logging branch is
  cheap to reach. API tests serve the real app on the real DAO and a real database and drive it over `fetch`: they
  cover what `app.ts` adds around the handlers (body parsing, the route table, the not-found → error chain) and that
  the real DAO accepts what the controller sends.

## Required values

| What                    | Value                                                                       |
| ----------------------- | --------------------------------------------------------------------------- |
| dependencies            | `express`, `cors`, `http-errors`, `zod`                                     |
| devDependencies         | `@types/express`, `@types/cors`, `@types/http-errors`                       |
| `tsconfig.app.json`     | `include: ["src/**/*.ts"]`, which picks up `src/express.d.ts`               |
| error body              | `{ status: 'error', message }`                                              |
| `express.json()` limits | malformed JSON → 400, a body over 100 kB → 413, both through `errorHandler` |

## Pitfalls

- **Express identifies an error handler by its four parameters**: keep `(err, req, res, next)` even when `next` is used
  only for headers already sent.
- **A response spy written as a method fails `unbound-method`** in `expect(res.json)`: make the spies plain
  properties.

## Reference code

`src/app.ts`: the pure factory.

```ts
import cors from 'cors';
import express, { type Express } from 'express';
import { getEntity, createEntity, deleteEntity, listEntities, updateEntity } from './controllers/entity.controller.js';
import { getHealth } from './controllers/health.controller.js';
import { getHome } from './controllers/home.controller.js';
import { errorHandler } from './middlewares/error.middleware.js';
import { notFoundHandler } from './middlewares/not-found.middleware.js';
import type { AppContext } from './models/app-context.model.js';

export function createApp(context: AppContext): Express {
  const app = express();
  app.locals.context = context;

  // the request logger, as the logger's integration says
  app.use(cors());
  app.use(express.json());

  app.get('/', getHome);
  app.get('/health', getHealth);
  app.get('/entities', listEntities);
  app.post('/entities', createEntity);
  app.get('/entities/:id', getEntity);
  app.patch('/entities/:id', updateEntity);
  app.delete('/entities/:id', deleteEntity);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
```

`src/middlewares/not-found.middleware.ts`:

```ts
import type { RequestHandler } from 'express';
import createError from 'http-errors';

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(createError(404, `Not Found: ${req.method} ${req.path}`, { expose: true }));
};
```

`src/middlewares/error.middleware.ts`:

```ts
import type { ErrorRequestHandler } from 'express';
import createError from 'http-errors';

export const errorHandler: ErrorRequestHandler = (err: unknown, req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }
  const httpError = createError.isHttpError(err) ? err : undefined;
  const status = httpError?.status ?? 500;
  const message = httpError?.expose ? httpError.message : 'Internal Server Error';
  // the request's child logger, as the logger's integration says
  if (status >= 500) {
    req.log.error({ err }, message);
  } else {
    req.log.warn({ err }, message);
  }
  res.status(status).json({ status: 'error', message });
};
```

`tests/utils/test-server.ts`: the real app on an ephemeral port for API tests.

```ts
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Express } from 'express';

export interface TestServer {
  readonly baseUrl: string;
  readonly close: () => Promise<void>;
}

export async function serve(app: Express): Promise<TestServer> {
  const server = await new Promise<Server>((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => {
      resolve(listening);
    });
  });
  const { port } = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${String(port)}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      })
  };
}
```

## Conventions

### Architecture

```
request ─► request log ─► cors ─► express.json() ─► route ─► controller
errors:  next(err) ─► notFoundHandler ─► errorHandler ─► { status: 'error', message }
```

- **`server.ts` is the composition root**: it builds the context, starts the listener and shuts down cleanly.
- **`app.ts` is a pure factory**: the context goes on `app.locals.context` once, handlers mount directly on the app
  (no routers), and nothing in it reads the environment.

### Building blocks

| Block      | Lives in                                       | Is                                              | Must not                                                   |
| ---------- | ---------------------------------------------- | ----------------------------------------------- | ---------------------------------------------------------- |
| controller | `controllers/<resource>.controller.ts`         | one exported `async (req, res, next)` per route | reach a dependency except through `req.app.locals.context` |
| middleware | `middlewares/<name>.middleware.ts`             | `errorHandler` (terminal) and `notFoundHandler` | call a DAO                                                 |
| context    | `models/app-context.model.ts` + `express.d.ts` | `AppContext` and its typing on `Express.Locals` | —                                                          |
| helper     | `helpers/<name>.helper.ts`                     | transport-agnostic functions                    | take an Express `Request`                                  |
| model      | `models/<name>.model.ts`                       | types and error classes                         | contain logic                                              |

### Controllers and errors

- **Every handler has one shape**: `async (req, res, next): Promise<void>` with `try { … } catch (err) { next(err) }`.
- **Every input is validated inline with `safeParse`**; a failure throws `createError(400, …, { expose: true, cause })`.
  There are no shared validation helpers, so each handler shows every error it can produce.
- **Errors leave a handler only through `next(err)`**; `errorHandler` writes `{ status: 'error', message }`, the message
  only when the error is exposed.
- **Naming**: handlers are verb + resource (`listEntities`, `getEntity`), never `entityController`; middlewares end in
  `Handler`. Folders are plural, files keep the singular suffix (`controllers/entity.controller.ts`).

### Testing the API

- **Unit tests call handlers and middlewares as functions**, with a mock request (a stub context on
  `req.app.locals.context`), a spy response and a spy next from the test utilities. They assert the response or the
  error passed to `next`, and what the DAO received; every 400 also asserts the DAO was never called. No app, no
  server.
- **API tests serve the real app on an ephemeral port**, on the real DAO and a real database, and drive it over
  `fetch`: every route's happy path, the errors only the real stack produces, and what `app.ts` adds
  (malformed JSON → 400, over 100 kB → 413, an unmatched path → 404 in the standard shape).

[^express-releases]: Express releases
