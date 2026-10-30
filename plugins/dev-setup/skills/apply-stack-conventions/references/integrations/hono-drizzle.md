# Hono + Drizzle

A Hono API over the Drizzle DAO layer: the server entry builds the DAOs once and hands them to `createApp(context)`,
handlers reach them as `c.var.context`, decode the list query, and turn DAO results into HTTP answers through
`HTTPException`. Hono API on Node uses it.

**Realises:** [Data access](../architecture/data-access.md), [REST API](../architecture/rest-api.md)

## The seam

```
server.ts ─► createDbClient() ─► new <Resource>Dao(db) ─► AppContext { db, <resource>Dao, … } ─► createApp(context)
request ─► middleware sets c.var.context ─► handler ─► c.var.context.<resource>Dao ─► Drizzle ─► Postgres
                │                         │
     decodes the list query     NotFoundError / null ─► HTTPException(404) ─► app.onError
```

- **`server.ts` builds the database client and every DAO** and passes them to `createApp`; it is the only place that
  opens connections, and it closes the pool after the server on `SIGINT` / `SIGTERM`.
- **Handlers are `(c: Context<AppEnv>) => Promise<Response>`** and reach data through `c.var.context`; they import no
  DAO class and no table.
- **A DAO's `NotFoundError` becomes a 404 `HTTPException`** in the handler, as does a `null` from `get`; DAOs throw no
  HTTP errors, so they stay callable from non-HTTP code.
- **The list query is decoded in the handler** from `c.req.queries()`, exactly as the REST API concept's wire format
  says; the DAO takes the structured `{ filter, sort, page, pageSize }`.
- **The health probe runs `SELECT 1`** through ``c.var.context.db.execute(sql`SELECT 1`)``, the one handler that imports
  from `drizzle-orm`, and throws a 503 `HTTPException`with the original error as its`cause`.

## Where it lives

| File                                  | Holds                                                                            |
| ------------------------------------- | -------------------------------------------------------------------------------- |
| `src/server.ts`                       | the pool, the Drizzle client, every DAO, `createApp(context)`, `serve`, shutdown |
| `src/app.ts`                          | `createApp(context)`: the context middleware, the shared middleware, every route |
| `src/models/app-context.model.ts`     | `AppContext` and `AppEnv` (`Variables: { context: AppContext }`)                 |
| `src/controllers/*.controller.ts`     | list decoding, `safeParse` against the resource's schemas, the 404 mapping       |
| `src/middlewares/error.middleware.ts` | `errorHandler` and `notFoundHandler`, the one place an error becomes a response  |
| `tests/utils/http-mocks.ts`           | `createStubContext()`: a `vi.fn()` per DAO method                                |
| `tests/unit/controllers/`             | `createApp(stub.context).request(…)`, so a handler test also covers its route    |
| `tests/api/`                          | the real app on the real DAOs and a Testcontainers Postgres                      |

## Reference code

`src/models/app-context.model.ts`:

```ts
import type { DbClient } from '../db/client.js';
import type { EntityDao } from '../daos/entity.dao.js';

/** What the server entry builds once and `createApp` hands to every handler. `db` stays for the health probe. */
export interface AppContext {
  readonly db: DbClient;
  readonly entityDao: EntityDao;
}

/** Hono's generics for the app: the context is read as `c.var.context`. */
export interface AppEnv {
  Variables: { context: AppContext };
}
```

`src/app.ts`:

```ts
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { cors } from 'hono/cors';
import { HTTPException } from 'hono/http-exception';
import { createEntity, deleteEntity, getEntity, listEntities, updateEntity } from './controllers/entity.controller.js';
import { getHealth } from './controllers/health.controller.js';
import { getHome } from './controllers/home.controller.js';
import { errorHandler, notFoundHandler } from './middlewares/error.middleware.js';
import { requestLog } from './middlewares/request-log.middleware.js';
import type { AppContext, AppEnv } from './models/app-context.model.js';

const MAX_BODY_BYTES = 100 * 1024;

/** The Hono app around a context: middleware, every route, then the not-found and error handlers. It reads no environment. */
export function createApp(context: AppContext): Hono<AppEnv> {
  const app = new Hono<AppEnv>();
  app.use(async (c, next) => {
    c.set('context', context);
    await next();
  });
  app.use(requestLog);
  app.use(cors());
  app.use(
    bodyLimit({
      maxSize: MAX_BODY_BYTES,
      onError: () => {
        throw new HTTPException(413, { message: 'Payload Too Large' });
      }
    })
  );

  app.get('/', getHome);
  app.get('/health', getHealth);
  app.get('/entities', listEntities);
  app.post('/entities', createEntity);
  app.get('/entities/:id', getEntity);
  app.patch('/entities/:id', updateEntity);
  app.delete('/entities/:id', deleteEntity);

  app.notFound(notFoundHandler);
  app.onError(errorHandler);
  return app;
}
```

`src/middlewares/error.middleware.ts`:

```ts
import type { ErrorHandler, NotFoundHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { logger } from '../logger.js';
import type { AppEnv } from '../models/app-context.model.js';

/**
 * The one place an error becomes a response: `{ status: 'error', message }`. An HTTPException is thrown on purpose, so its
 * message is exposed (Hono has no `expose` flag); anything else is hidden and logged.
 */
export const errorHandler: ErrorHandler<AppEnv> = (error, c) => {
  if (error instanceof HTTPException) {
    const status = error.status;
    const log = status >= 500 ? logger.error.bind(logger) : logger.warn.bind(logger);
    log({ err: error, status, method: c.req.method, path: c.req.path }, error.message);
    return c.json({ status: 'error', message: error.message }, status);
  }
  logger.error({ err: error, method: c.req.method, path: c.req.path }, 'Unhandled error');
  return c.json({ status: 'error', message: 'Internal Server Error' }, 500);
};

/** Forwards an unmatched route to the error handler in the standard shape. */
export const notFoundHandler: NotFoundHandler<AppEnv> = (c) => {
  throw new HTTPException(404, { message: `Not Found: ${c.req.method} ${c.req.path}` });
};
```

`tests/utils/http-mocks.ts`:

```ts
import { vi } from 'vitest';
import type { AppContext } from '../../src/models/app-context.model.js';

/** A context with a `vi.fn()` per DAO method and the db's `execute`; tests override what they exercise. */
export function createStubContext() {
  const entityDao = {
    get: vi.fn(),
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn()
  };
  const db = { execute: vi.fn() };
  return { entityDao, db, context: { db, entityDao } as unknown as AppContext };
}
```

## Pitfalls

- **`c.req.json()` throws on a malformed body**: catch it in the handler and throw a 400 `HTTPException`, or it
  surfaces as a 500.
- **An error thrown from `body-limit`'s default answer** has no JSON body: give it an `onError` that throws a 413
  `HTTPException`, so the error handler shapes it.

## Conventions

- **The server entry builds the DAOs once** and hands them to `createApp(context)`; adding a resource adds its DAO
  there and to `AppContext`.
- **Handlers reach data only through `c.var.context`**; they import no table or DAO class, and only the health probe
  imports from `drizzle-orm`.
- **A DAO's `NotFoundError` becomes a 404 `HTTPException`** in the handler, as does a `null` from `get`.
- **Every error answers through `app.onError`** in the REST API concept's error body; an `HTTPException` is thrown on
  purpose and shown, anything else is a logged 500.
- **Request bodies are validated against the resource's strict `drizzle-zod` schemas** with `safeParse`; an update
  merges the path id into the body before validating.
- **Handler tests go through `createApp(stub.context).request(…)`**, so they cover the route table as well.

## Verify it is wired

- Only `server.ts` constructs a pool or a DAO; no handler but the health probe imports from `drizzle-orm`.
- Every DAO method that can miss a row is mapped to a 404 by its handler.
- `POST` with a malformed body answers 400, with an unknown field 400, over the limit 413, all as `{ status: 'error', message }`.
