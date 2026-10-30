# Express + Pino

Pino inside an Express API: `pino-http` as the first middleware, so every request is logged with its status and timing
and carries a child logger, and the error handler logging through that child. REST API on Node and the Angular full
stack's `api/` use it.

## The seam

```
createApp(context): app.use(pinoHttp({ logger })) ─► req.log (a child of logger, per request) ─► … ─► errorHandler: req.log.warn / req.log.error
pnpm dev: node … src/server.ts | pino-pretty … --ignore pid,hostname,req.headers,res.headers
```

- **`pinoHttp({ logger })` is the first middleware**, built on the one logger from `src/logger.ts`: it writes one line per
  response and gives every request `req.log`.
- **The error handler logs through `req.log`**, 5xx at `error` and 4xx at `warn`, with the error as `{ err }`, so each
  line carries the request it belongs to. Controllers never log errors themselves.
- **The `dev` pipe also hides `req.headers` and `res.headers`**, which `pino-http` adds to every line.

## Required values

| What           | Value                                                                                    |
| -------------- | ---------------------------------------------------------------------------------------- |
| dependencies   | `pino-http`, beside Pino's own                                                           |
| middleware     | `app.use(pinoHttp({ logger }))` before `cors()` and `express.json()`                     |
| `dev` pipe     | Pino's, with `--ignore pid,hostname,req.headers,res.headers`                             |
| test utilities | `mockLog()`: `req.log` as an object of `vi.fn()` spies, so a unit test asserts the level |

## Reference code

`src/middlewares/error.middleware.ts`'s error handler:

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
  if (status >= 500) {
    req.log.error({ err }, message);
  } else {
    req.log.warn({ err }, message);
  }
  res.status(status).json({ status: 'error', message });
};
```

## Conventions

- **Every request is logged by `pino-http`**, the first middleware, on the one logger.
- **Errors are logged once, by `errorHandler`, through `req.log`**: 5xx at `error`, 4xx at `warn`.

## Verify it is wired

- `pnpm dev` prints one line per request, and an unknown path logs one `warn` with the request's id.
- No controller calls the logger.
