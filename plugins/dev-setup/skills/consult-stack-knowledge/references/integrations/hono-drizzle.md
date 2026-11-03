---
type: Integration
title: Hono + Drizzle
description: DAOs on `c.var.context`, list decoding, `NotFoundError` → a 404 `HTTPException`, one `onError`
connects: [hono, drizzle]
realises: [data-access, rest-api, resource-operations]
unless: [react-router]
---
# Hono + Drizzle

A Hono API over the Drizzle DAO layer: the server entry builds the DAOs once and hands them to `createApp(context)`,
handlers reach them as `c.var.context`, decode the list query, and turn DAO results into HTTP answers through
`HTTPException`. Hono API on Node uses it. Under React Router, where Hono only hands requests on, the data layer is
React Router + Drizzle's and this seam is not used.

**Realises:** [Data access](../architecture/data-access.md), [REST API](../architecture/rest-api.md), [Resource operations](../architecture/resource-operations.md)

## The seam

```
server.ts ─► createDbClient() ─► new <Resource>Dao(db) ─► AppContext { db, <resource>Dao, … } ─► createApp(context)
request ─► middleware sets c.var.context ─► handler ─► c.var.context.<resource>Dao ─► Drizzle ─► the database
                │                         │
     decodes the list query     NotFoundError / null ─► HTTPException(404) ─► app.onError
```

- **`server.ts` builds the database client and every DAO** and passes them to `createApp`; it is the only place that
  opens connections, and it closes the database client after the server on `SIGINT` / `SIGTERM`.
- **Handlers are `(c: Context<AppEnv>) => Promise<Response>`** and reach data through `c.var.context`; they import no
  DAO class and no table.
- **A DAO's `NotFoundError` becomes a 404 `HTTPException`** in the handler, as does a `null` from `get`; DAOs throw no
  HTTP errors, so they stay callable from non-HTTP code.
- **The list query is decoded in the handler** from `c.req.queries()`, exactly as the REST API concept's wire format
  says; the DAO takes the structured `{ filter, sort, page, pageSize }`.
- **The health probe runs `SELECT 1`** through ``c.var.context.db.execute(sql`SELECT 1`)``, the one handler that imports
  from `drizzle-orm`, and throws a 503 `HTTPException` with the original error as its `cause`.

## Where it lives

| File                              | Holds                                                                                  |
| --------------------------------- | -------------------------------------------------------------------------------------- |
| `src/server.ts`                   | the database client, every DAO, `createApp(context)`, `serve`, shutdown                |
| `src/app.ts`                      | `createApp(context)`: the context middleware, the shared middleware, every route       |
| `src/models/app-context.model.ts` | `AppContext` and `AppEnv` (`Variables: { context: AppContext }`)                       |
| `src/controllers/*.controller.ts` | list decoding, `safeParse` against the resource's schemas, the 404 mapping             |
| `tests/utils/http-mocks.ts`       | `createStubContext()`: a `vi.fn()` per DAO method                                      |
| `tests/unit/controllers/`         | `createApp(stub.context).request(…)`, so a handler test also covers its route          |
| `tests/api/`                      | the real app on the real DAOs and the engine's throwaway database (Drizzle + Postgres) |

## Reference code

`src/app.ts`, the middlewares and `tests/utils/test-server.ts` are the Hono doc's and Hono + Node's reference code.

`src/server.ts`: the composition root: reads its two settings and fails loudly, builds the context, serves, and on
`SIGINT` or `SIGTERM` closes the server and then the database client. The lines that log are the stack's logger's.

```ts
import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import { createDbClient } from './db/client.js';
import { EntityDao } from './daos/entity.dao.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is required');
}
const port = Number(process.env.PORT);
if (!Number.isInteger(port) || port <= 0) {
  throw new Error('PORT is required');
}

const { pool, db } = createDbClient(databaseUrl);
const app = createApp({ db, entityDao: new EntityDao(db) });
const server = serve({ fetch: app.fetch, port }, () => {
  // the stack's logger reports the port
});

function shutdown(signal: string): void {
  // the stack's logger reports the signal
  server.close(() => {
    pool.end().then(
      () => process.exit(0),
      () => {
        // the stack's logger reports the error
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

The context middleware in `src/app.ts`, the one line of the factory that is this seam:

```ts
  app.use(async (c, next) => {
    c.set('context', context);
    await next();
  });
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

`src/controllers/entity.controller.ts`: every list, id and body path, each 400 and 404 thrown as an `HTTPException`.

```ts
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import {
  createEntityInputSchema,
  entityIdInputSchema,
  listEntityInputSchema,
  updateEntityInputSchema
} from '../db/schemas/entity.schema.js';
import { normalizeQuery } from '../helpers/query-parser.helper.js';
import type { AppEnv } from '../models/app-context.model.js';
import { NotFoundError } from '../models/error.model.js';

const LIST_PARAMS: ReadonlySet<string> = new Set(['filter', 'sortField', 'sortDirection', 'page', 'pageSize']);

export async function listEntities(c: Context<AppEnv>): Promise<Response> {
  const query = normalizeQuery(c.req.queries());
  const unknown = Object.keys(query).filter((key) => !LIST_PARAMS.has(key));
  if (unknown.length > 0) {
    throw new HTTPException(400, { message: `Unknown query params: ${unknown.join(', ')}` });
  }

  let filter: unknown;
  if (typeof query.filter === 'string') {
    try {
      filter = JSON.parse(query.filter);
    } catch (error) {
      throw new HTTPException(400, { message: 'filter must be valid JSON', cause: error });
    }
  }
  const sort =
    query.sortField === undefined && query.sortDirection === undefined
      ? undefined
      : { field: query.sortField, direction: query.sortDirection ?? 'ASC' };
  const parsed = listEntityInputSchema.safeParse({
    filter,
    sort,
    page: query.page === undefined ? undefined : Number(query.page),
    pageSize: query.pageSize === undefined ? undefined : Number(query.pageSize)
  });
  if (!parsed.success) {
    throw new HTTPException(400, { message: 'Invalid query', cause: z.flattenError(parsed.error) });
  }

  return c.json(await c.var.context.entityDao.list(parsed.data));
}

export async function getEntity(c: Context<AppEnv>): Promise<Response> {
  const params = entityIdInputSchema.safeParse({ id: c.req.param('id') });
  if (!params.success) {
    throw new HTTPException(400, { message: 'Invalid id', cause: z.flattenError(params.error) });
  }
  const row = await c.var.context.entityDao.get(params.data);
  if (!row) {
    throw new HTTPException(404, { message: `Entity not found: ${params.data.id}` });
  }
  return c.json(row);
}

export async function createEntity(c: Context<AppEnv>): Promise<Response> {
  const body = await readJson(c);
  const parsed = createEntityInputSchema.safeParse(body);
  if (!parsed.success) {
    throw new HTTPException(400, { message: 'Invalid body', cause: z.flattenError(parsed.error) });
  }
  return c.json(await c.var.context.entityDao.create(parsed.data), 201);
}

export async function updateEntity(c: Context<AppEnv>): Promise<Response> {
  const body = await readJson(c);
  const parsed = updateEntityInputSchema.safeParse({ ...(typeof body === 'object' ? body : {}), id: c.req.param('id') });
  if (!parsed.success) {
    const idIssue = parsed.error.issues.some((issue) => issue.path[0] === 'id');
    throw new HTTPException(400, { message: idIssue ? 'Invalid id' : 'Invalid body', cause: z.flattenError(parsed.error) });
  }
  try {
    return c.json(await c.var.context.entityDao.update(parsed.data));
  } catch (error) {
    throw mapNotFound(error);
  }
}

export async function deleteEntity(c: Context<AppEnv>): Promise<Response> {
  const params = entityIdInputSchema.safeParse({ id: c.req.param('id') });
  if (!params.success) {
    throw new HTTPException(400, { message: 'Invalid id', cause: z.flattenError(params.error) });
  }
  try {
    await c.var.context.entityDao.delete(params.data);
  } catch (error) {
    throw mapNotFound(error);
  }
  return c.body(null, 204);
}

async function readJson(c: Context<AppEnv>): Promise<unknown> {
  try {
    return await c.req.json();
  } catch (error) {
    throw new HTTPException(400, { message: 'Malformed JSON body', cause: error });
  }
}

function mapNotFound(error: unknown): unknown {
  return error instanceof NotFoundError ? new HTTPException(404, { message: error.message, cause: error }) : error;
}
```

`src/controllers/home.controller.ts`:

```ts
import type { Context } from 'hono';
import type { AppEnv } from '../models/app-context.model.js';

export async function getHome(c: Context<AppEnv>): Promise<Response> {
  return c.json({ service: 'api', status: 'running' });
}
```

`src/controllers/health.controller.ts`:

```ts
import { sql } from 'drizzle-orm';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { AppEnv } from '../models/app-context.model.js';

export async function getHealth(c: Context<AppEnv>): Promise<Response> {
  const start = performance.now();
  try {
    await c.var.context.db.execute(sql`SELECT 1`);
  } catch (error) {
    throw new HTTPException(503, { message: 'Database connection failed', cause: error });
  }
  return c.json({ status: 'ok', db: 'up', latencyMs: Math.round(performance.now() - start), timestamp: new Date().toISOString() });
}
```

## Conventions

- **The server entry builds the DAOs once** and hands them to `createApp(context)`; adding a resource adds its DAO
  there and to `AppContext`.
- **Handlers reach data only through `c.var.context`**; they import no table or DAO class, and only the health probe
  imports from `drizzle-orm`.
- **A DAO's `NotFoundError` becomes a 404 `HTTPException`** in the handler, as does a `null` from `get`.
- **Request bodies are validated against the resource's strict `drizzle-zod` schemas** with `safeParse`; an update
  merges the path id into the body before validating.
- **Handler tests go through `createApp(stub.context).request(…)`**, so they cover the route table as well.

## Verify it is wired

- Only `server.ts` constructs a database client or a DAO; no handler but the health probe imports from `drizzle-orm`.
- Every DAO method that can miss a row is mapped to a 404 by its handler.
- `POST` with a malformed body answers 400, with an unknown field 400, over the limit 413, all as `{ status: 'error', message }`.
