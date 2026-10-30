# Hono + Pino

Pino inside a Hono API on Node: a small request-log middleware on the one logger, and the error handler logging there
too. Hono API on Node uses it. A Hono app on Workers logs through the platform's console instead.

## The seam

```
createApp(context): app.use(requestLog) ─► await next() ─► logger.info({ method, path, status, ms }, 'request')
app.onError: HTTPException ─► logger.warn (4xx) / logger.error (5xx); anything else ─► logger.error, a 500
```

- **`requestLog` is registered right after the context middleware**, so it times the whole request and logs after the
  response is built, with its status.
- **The error handler logs each error once**, with `{ err }`, the method and the path: an `HTTPException` at `warn` for a
  4xx and `error` for a 5xx, anything else at `error`. Handlers never log errors themselves.
- **No Pino-specific middleware package**: the middleware is a few lines on the shared logger, so no request object type
  has to be augmented.

## Where it lives

| File                                        | Holds                                   |
| ------------------------------------------- | --------------------------------------- |
| `src/middlewares/request-log.middleware.ts` | `requestLog`                            |
| `src/middlewares/error.middleware.ts`       | `errorHandler`, logging as above        |
| `src/app.ts`                                | `app.use(requestLog)` after the context |

## Reference code

`src/middlewares/request-log.middleware.ts`:

```ts
import type { MiddlewareHandler } from 'hono';
import { logger } from '../logger.js';
import type { AppEnv } from '../models/app-context.model.js';

/** Logs one line per request once its response is built. */
export const requestLog: MiddlewareHandler<AppEnv> = async (c, next) => {
  const start = performance.now();
  await next();
  logger.info({ method: c.req.method, path: c.req.path, status: c.res.status, ms: Math.round(performance.now() - start) }, 'request');
};
```

## Conventions

- **Every request is logged once by `requestLog`**, after its response, with method, path, status and milliseconds.
- **Errors are logged once, by the error handler**: 4xx at `warn`, 5xx and anything unexpected at `error`.

## Verify it is wired

- `pnpm dev` prints one line per request; an unknown path logs one `warn`.
- No handler calls the logger.
