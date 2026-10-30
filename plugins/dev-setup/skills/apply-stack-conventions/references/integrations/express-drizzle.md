# Express + Drizzle

An Express API over the Drizzle DAO layer: the composition root builds the DAOs once, controllers reach them through the
app's context, decode the list query, and turn DAO results into HTTP answers. The Angular full stack's `api/` uses it.

**Realises:** [Data access](../architecture/data-access.md), [REST API](../architecture/rest-api.md)

## The seam

```
server.ts ─► createDbClient() ─► new <Resource>Dao(db) ─► AppContext { db, <resource>Dao, … } ─► createApp(context)
request ─► controller ─► req.app.locals.context.<resource>Dao ─► Drizzle ─► Postgres
                │                     │
     decodes the list query     NotFoundError / null ─► createError(404)
```

- **`server.ts` builds the database client and every DAO**, puts them on the `AppContext`, and closes the pool after the
  HTTP server on `SIGINT` / `SIGTERM`. It is the only place that opens connections.
- **Controllers call DAOs through `req.app.locals.context`** and never import the ORM or a DAO class.
- **A DAO's `NotFoundError` becomes a 404 in the handler**, as does a `null` from `get`. DAOs throw no HTTP errors, so
  they stay callable from non-HTTP code.
- **The list query is decoded in the controller**: the DAO takes the structured `{ filter, sort, page, pageSize }` from
  anywhere, and the controller builds it from the query string in plain sight.
- **The health probe runs `SELECT 1` inline** on `context.db` and answers `{ status: 'ok', db: 'up', latencyMs, timestamp }`,
  or an exposed 503 `Database connection failed` with the original error as its `cause`. It is the one handler whose
  `catch` creates the error, and the reason `db` stays on the context beside the DAOs.

## Where it lives

| File                                 | Holds                                                                      |
| ------------------------------------ | -------------------------------------------------------------------------- |
| `src/server.ts`                      | the pool, the Drizzle client, every DAO, the `AppContext`, shutdown        |
| `src/models/app-context.model.ts`    | `AppContext { db: DbClient; <resource>Dao: <Resource>Dao }`                |
| `src/express.d.ts`                   | `Express.Locals { context: AppContext }`                                   |
| `src/controllers/*.controller.ts`    | list decoding, `safeParse` against the resource's schemas, the 404 mapping |
| `src/helpers/query-parser.helper.ts` | `normalizeQuery`, the one HTTP-aware helper of the data layer              |
| `tests/utils/http-mocks.ts`          | `createStubContext()`: a `vi.fn()` per DAO method                          |
| `tests/api/`                         | the real app on the real DAOs and a Testcontainers Postgres                |

## Reference code

From the REST API scaffold, which passes typecheck, lint, the unit and integration tests and its Compose smoke test;
`src/db/client.ts` is Drizzle + Postgres's and the error handler Express + Pino's.

`src/server.ts`: the composition root: settings read and checked, the client and DAOs built once, the listener, and shutdown closing the server and then the pool.

```ts
import { createApp } from './app.js';
import { EntityDao } from './daos/entity.dao.js';
import { createDbClient } from './db/client.js';
import { logger } from './logger.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is not set');
}
const port = Number(process.env.PORT);
if (!process.env.PORT || !Number.isInteger(port)) {
  throw new Error('PORT is not set');
}

const { pool, db } = createDbClient(databaseUrl);
const app = createApp({ db, entityDao: new EntityDao(db) });

const server = app.listen(port, () => {
  logger.info({ port }, 'API listening');
});

function shutdown(signal: string): void {
  logger.info({ signal }, 'Shutting down');
  server.close(() => {
    pool.end().then(
      () => process.exit(0),
      (err: unknown) => {
        logger.error({ err }, 'Closing the pool failed');
        process.exit(1);
      }
    );
  });
}

process.on('SIGINT', () => {
  shutdown('SIGINT');
});
process.on('SIGTERM', () => {
  shutdown('SIGTERM');
});
```

`src/app.ts`: the pure factory.

```ts
import cors from 'cors';
import express, { type Express } from 'express';
import { pinoHttp } from 'pino-http';
import { getEntity, createEntity, deleteEntity, listEntities, updateEntity } from './controllers/entity.controller.js';
import { getHealth } from './controllers/health.controller.js';
import { getHome } from './controllers/home.controller.js';
import { errorHandler } from './middlewares/error.middleware.js';
import { notFoundHandler } from './middlewares/not-found.middleware.js';
import { logger } from './logger.js';
import type { AppContext } from './models/app-context.model.js';

export function createApp(context: AppContext): Express {
  const app = express();
  app.locals.context = context;

  app.use(pinoHttp({ logger }));
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

`src/models/app-context.model.ts`:

```ts
import type { DbClient } from '../db/client.js';
import type { EntityDao } from '../daos/entity.dao.js';

export interface AppContext {
  readonly db: DbClient;
  readonly entityDao: EntityDao;
}
```

`src/express.d.ts`:

```ts
import type { AppContext } from './models/app-context.model.js';

declare global {
  namespace Express {
    interface Locals {
      context: AppContext;
    }
  }
}
```

`src/controllers/entity.controller.ts`: every list, id and body path, each 400 and 404 in plain sight.

```ts
import type { NextFunction, Request, Response } from 'express';
import createError from 'http-errors';
import { z } from 'zod';
import {
  createEntityInputSchema,
  entityIdInputSchema,
  listEntityInputSchema,
  updateEntityInputSchema
} from '../db/schemas/entity.schema.js';
import { normalizeQuery } from '../helpers/query-parser.helper.js';
import { NotFoundError } from '../models/error.model.js';

const LIST_QUERY_PARAMS: ReadonlySet<string> = new Set(['filter', 'sortField', 'sortDirection', 'page', 'pageSize']);

// Query values are strings; NaN is left for the schema to reject
function toNumber(value: unknown): number | undefined {
  return value === undefined ? undefined : Number(value);
}

export async function listEntities(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const query = normalizeQuery(req.query);
    const unknown = Object.keys(query).filter((key) => !LIST_QUERY_PARAMS.has(key));
    if (unknown.length > 0) {
      throw createError(400, `Unknown query params: ${unknown.join(', ')}`, { expose: true });
    }

    let filter: unknown;
    if (typeof query.filter === 'string') {
      try {
        filter = JSON.parse(query.filter);
      } catch (cause) {
        throw createError(400, 'filter must be valid JSON', { expose: true, cause });
      }
    }
    const sortField = query.sortField;
    const sortDirection = query.sortDirection;
    const sort =
      sortField === undefined && sortDirection === undefined ? undefined : { field: sortField, direction: sortDirection ?? 'ASC' };

    const parsed = listEntityInputSchema.safeParse({
      filter,
      sort,
      page: toNumber(query.page),
      pageSize: toNumber(query.pageSize)
    });
    if (!parsed.success) {
      throw createError(400, 'Invalid query', { expose: true, cause: z.flattenError(parsed.error) });
    }

    res.status(200).json(await req.app.locals.context.entityDao.list(parsed.data));
  } catch (err) {
    next(err);
  }
}

export async function getEntity(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const params = entityIdInputSchema.safeParse(req.params);
    if (!params.success) {
      throw createError(400, 'Invalid id', { expose: true, cause: z.flattenError(params.error) });
    }
    const row = await req.app.locals.context.entityDao.get(params.data);
    if (!row) {
      throw createError(404, `Entity not found: ${params.data.id}`, { expose: true });
    }
    res.status(200).json(row);
  } catch (err) {
    next(err);
  }
}

export async function createEntity(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = createEntityInputSchema.safeParse(req.body);
    if (!body.success) {
      throw createError(400, 'Invalid body', { expose: true, cause: z.flattenError(body.error) });
    }
    res.status(201).json(await req.app.locals.context.entityDao.create(body.data));
  } catch (err) {
    next(err);
  }
}

export async function updateEntity(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const params = entityIdInputSchema.safeParse(req.params);
    if (!params.success) {
      throw createError(400, 'Invalid id', { expose: true, cause: z.flattenError(params.error) });
    }
    const body = updateEntityInputSchema.safeParse({ ...(req.body as object | undefined), id: params.data.id });
    if (!body.success) {
      throw createError(400, 'Invalid body', { expose: true, cause: z.flattenError(body.error) });
    }
    try {
      res.status(200).json(await req.app.locals.context.entityDao.update(body.data));
    } catch (err) {
      throw err instanceof NotFoundError ? createError(404, err.message, { expose: true, cause: err }) : err;
    }
  } catch (err) {
    next(err);
  }
}

export async function deleteEntity(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const params = entityIdInputSchema.safeParse(req.params);
    if (!params.success) {
      throw createError(400, 'Invalid id', { expose: true, cause: z.flattenError(params.error) });
    }
    try {
      await req.app.locals.context.entityDao.delete(params.data);
    } catch (err) {
      throw err instanceof NotFoundError ? createError(404, err.message, { expose: true, cause: err }) : err;
    }
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}
```

`src/controllers/home.controller.ts`:

```ts
import type { NextFunction, Request, Response } from 'express';

export async function getHome(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json({ service: 'api', status: 'running' });
  } catch (err) {
    next(err);
  }
}
```

`src/controllers/health.controller.ts`:

```ts
import { sql } from 'drizzle-orm';
import type { NextFunction, Request, Response } from 'express';
import createError from 'http-errors';

export async function getHealth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const started = performance.now();
    try {
      await req.app.locals.context.db.execute(sql`select 1`);
    } catch (cause) {
      throw createError(503, 'Database connection failed', { expose: true, cause });
    }
    res.status(200).json({
      status: 'ok',
      db: 'up',
      latencyMs: Math.round(performance.now() - started),
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    next(err);
  }
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

`tests/utils/http-mocks.ts`: the stub context, request, response and next for unit tests.

```ts
import type { Request, Response } from 'express';
import { expect, type Mock, vi } from 'vitest';
import type { AppContext } from '../../src/models/app-context.model.js';

export interface StubContext {
  readonly context: AppContext;
  readonly entityDao: { get: Mock; list: Mock; create: Mock; update: Mock; delete: Mock };
  readonly execute: Mock;
}

export function createStubContext(): StubContext {
  const entityDao = { get: vi.fn(), list: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() };
  const execute = vi.fn();
  return { context: { db: { execute }, entityDao } as unknown as AppContext, entityDao, execute };
}

export interface MockLog {
  readonly warn: Mock;
  readonly error: Mock;
}

export function mockLog(): MockLog {
  return { warn: vi.fn(), error: vi.fn() };
}

interface MockRequestOptions {
  context?: AppContext;
  params?: Record<string, string>;
  query?: Record<string, unknown>;
  body?: unknown;
  log?: MockLog;
  method?: string;
  path?: string;
}

export function mockRequest({
  context,
  params = {},
  query = {},
  body,
  log = mockLog(),
  method = 'GET',
  path = '/'
}: MockRequestOptions = {}): Request {
  return { app: { locals: { context } }, params, query, body, log, method, path } as unknown as Request;
}

export interface MockResponse {
  readonly res: Response;
  readonly status: Mock;
  readonly json: Mock;
  readonly end: Mock;
}

export function mockResponse(headersSent = false): MockResponse {
  const spies = { status: vi.fn(), json: vi.fn(), end: vi.fn() };
  const res = { ...spies, headersSent } as unknown as Response;
  spies.status.mockReturnValue(res);
  spies.json.mockReturnValue(res);
  spies.end.mockReturnValue(res);
  return { res, ...spies };
}

export function mockNext(): Mock {
  return vi.fn();
}

export function httpError(status: number, message?: string): unknown {
  return expect.objectContaining({ status, ...(message === undefined ? {} : { message }) });
}
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

- **The composition root builds the DAOs once**: `server.ts` creates the pool and one `<Resource>Dao` per table, puts
  them on `AppContext`, and closes the pool on shutdown. Adding a resource adds its DAO there and to `AppContext`.
- **Controllers reach data only through the context's DAOs**; they import no table or DAO class, and only the health
  probe imports from the ORM, for its `SELECT 1`.
- **A DAO's `NotFoundError` becomes a 404** in the handler, as does a `null` from `get`.
- **The list query on the wire** (the REST API concept's format) is decoded by the controller in plain sight:
  `normalizeQuery`, reject unknown params, `JSON.parse` the filter, build `sort` with `ASC` when only the field is given,
  numbers for the page; then `list<Resource>InputSchema` validates the structured input.
- **Request bodies are validated against the resource's `drizzle-zod` schemas** with `safeParse`; an update merges the
  path id into the body before validating.

## Verify it is wired

- Only `server.ts` constructs a pool or a DAO; no controller imports from `db/` or `daos/`, and only the health probe
  imports from `drizzle-orm` (its `sql`).
- Every DAO method that can miss a row is mapped to a 404 by its handler.
- Every list controller rejects unknown query params and validates with its resource's list input schema.
