---
kind: technology
role: framework
detect:
  dependencies: [hono]
aliases: [Hono, hono]
---
# Hono

Hono as the server entry: one app that whatever runs it drives through `app.fetch`, its errors answered in one place.

## Use it like this

- **One Hono app, with no `serve()` call in it.** It is the entry file's default export where nothing has to be built
  before it, and `createApp(context)` where the server entry first builds what the handlers use (clients, data access)
  and hands it over. Whatever runs the app drives `app.fetch`: the runtime itself, or a server adapter.
- **Errors are answered by one `app.onError`**: an `HTTPException` is thrown on purpose, so its status and message go to
  the client; anything else answers 500 with a fixed message and is logged, since Hono has no `expose` flag to tell them
  apart. `app.notFound` throws a 404 `HTTPException`, so an unmatched route answers in the same shape.
- **Hono's own middleware covers the edges**: `hono/cors`, and `hono/body-limit` with an `onError` that throws a 413
  `HTTPException`. A malformed JSON body makes `c.req.json()` throw: catch it and throw a 400.
- **Configuration is typed and read once**: bindings through Hono's generics where the runtime passes them per
  request, the environment read once where the process lives on.
- **Tests reach the app through its real entry** where the runtime matters. `app.request()` is fine for a quick test of
  one route, but skips the entry point.

## Required values

| What         | Value                                                                              |
| ------------ | ---------------------------------------------------------------------------------- |
| dependencies | `hono`                                                                             |
| middleware   | `hono/cors`; `hono/body-limit` with an `onError` that throws a 413 `HTTPException` |
| body limit   | 100 kB (`MAX_BODY_BYTES`); a body over it → 413                                    |
| error body   | the REST API concept's                                                             |

## Pitfalls

- **`c.req.json()` throws on a malformed body**: catch it in the handler and throw a 400 `HTTPException`, or it
  surfaces as a 500.
- **An error thrown from `body-limit`'s default answer** has no JSON body: give it an `onError` that throws a 413
  `HTTPException`, so the error handler shapes it.

## Reference code

`src/app.ts`, the factory around a context:

```ts
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { cors } from 'hono/cors';
import { HTTPException } from 'hono/http-exception';
import { createEntity, deleteEntity, getEntity, listEntities, updateEntity } from './controllers/entity.controller.js';
import { getHealth } from './controllers/health.controller.js';
import { getHome } from './controllers/home.controller.js';
import { errorHandler, notFoundHandler } from './middlewares/error.middleware.js';
import type { AppContext, AppEnv } from './models/app-context.model.js';

const MAX_BODY_BYTES = 100 * 1024;

/** The Hono app around a context: middleware, every route, then the not-found and error handlers. It reads no environment. */
export function createApp(context: AppContext): Hono<AppEnv> {
  const app = new Hono<AppEnv>();
  app.use(async (c, next) => {
    c.set('context', context);
    await next();
  });
  // the request logger, as the logger's integration says
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
import type { AppEnv } from '../models/app-context.model.js';

/**
 * The one place an error becomes a response: `{ status: 'error', message }`. An HTTPException is thrown on purpose, so its
 * message is exposed (Hono has no `expose` flag); anything else is hidden and logged.
 */
export const errorHandler: ErrorHandler<AppEnv> = (error, c) => {
  // each branch logs the error once, as the logger's integration says
  if (error instanceof HTTPException) {
    return c.json({ status: 'error', message: error.message }, error.status);
  }
  return c.json({ status: 'error', message: 'Internal Server Error' }, 500);
};

/** Forwards an unmatched route to the error handler in the standard shape. */
export const notFoundHandler: NotFoundHandler<AppEnv> = (c) => {
  throw new HTTPException(404, { message: `Not Found: ${c.req.method} ${c.req.path}` });
};
```

## Conventions

- **The server entry is one Hono app**, the default export or `createApp(context)`; it never calls `serve()` itself.
- **Errors go through one `onError`**: `HTTPException` messages are shown, anything else is a logged 500.
- **Capabilities are wired by the server entry** (a database client, auth) and typed in the app's context.
