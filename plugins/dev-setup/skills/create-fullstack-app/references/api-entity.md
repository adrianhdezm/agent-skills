# API entity example

The `entity` resource wired end to end: table, inputs, DAO, controllers and tests. It is a placeholder for the first
real resource, and the template for every later one. The resource-agnostic pieces it uses are in
[api-dao.md](api-dao.md).

## Contents

- [`api/src/db/schemas/entity.schema.ts`](#apisrcdbschemasentityschemats)
- [`api/src/db/schema.ts`](#apisrcdbschemats)
- [`api/src/daos/entity.dao.ts`](#apisrcdaosentitydaots)
- [`api/src/controllers/home.controller.ts`](#apisrccontrollershomecontrollerts)
- [`api/src/controllers/health.controller.ts`](#apisrccontrollershealthcontrollerts)
- [`api/src/controllers/entity.controller.ts`](#apisrccontrollersentitycontrollerts)
- [Test layout](#test-layout)
- [`api/tests/utils/`](#apitestsutils)
- [`api/tests/controllers/entity.controller.test.ts`](#apitestscontrollersentitycontrollertestts)
- [`api/tests/controllers/home.controller.test.ts`](#apitestscontrollershomecontrollertestts)
- [`api/tests/controllers/health.controller.test.ts`](#apitestscontrollershealthcontrollertestts)
- [`api/tests/controllers/error.middleware.test.ts`](#apitestscontrollerserrormiddlewaretestts)
- [`api/tests/db/entity.dao.test.ts`](#apitestsdbentitydaotestts)
- [`api/tests/api/entity.api.test.ts`](#apitestsapientityapitestts)
- [`api/tests/unit/entity.schema.test.ts`](#apitestsunitentityschematestts)
- [Adding another resource](#adding-another-resource)

## `api/src/db/schemas/entity.schema.ts`

Everything resource-specific lives here, so the DAO holds no configuration of its own:

- the drizzle table, and the row type `Entity = z.infer<typeof selectEntitySchema>`, inferred from drizzle-zod's
  select schema like every other type in the file;
- `CreateEntityInput` / `UpdateEntityInput` from drizzle-zod. The update input carries the `id`, and the controller
  merges the path id into the body before validating;
- the list pieces: `entityFilterInputSchema` and `entitySortInputSchema` from the builders, `ListEntityInput`,
  `listEntityInputSchema` (the structured `ListEntityInput`, with no URL decoding), and `entityDefaultSort`.

The builders (`createFilterInputSchema` / `createSortInputSchema` / `createListInputSchema`) come from
`helpers/list-input.helper.ts`; the scalar filter inputs (`idFilterInputSchema`, …) come from `models/list-input.model.ts`
(see [api-dao.md](api-dao.md)).

Filter and sort fields carry the column names, which is what lets the DAO pass `entity` as the column source. The file
has no comments: every resource schema is declarations only, so keep it that way when copying it.

```ts
import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema, createUpdateSchema } from 'drizzle-zod';
import { z } from 'zod';
import { createFilterInputSchema, createListInputSchema, createSortInputSchema } from '../../helpers/list-input.helper.js';
import { dateFilterInputSchema, idFilterInputSchema, stringFilterInputSchema } from '../../models/list-input.model.js';

export const entity = pgTable('entity', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
});

export const selectEntitySchema = createSelectSchema(entity);

export const entityIdInputSchema = z.object({
  id: z.uuid('id must be a valid UUID')
});

export const createEntityInputSchema = createInsertSchema(entity, {
  name: (schema) => schema.min(1, 'name is required').max(200),
  description: (schema) => schema.max(2000).nullish()
}).pick({ name: true, description: true });

export const updateEntityInputSchema = createUpdateSchema(entity, {
  name: (schema) => schema.min(1).max(200),
  description: (schema) => schema.max(2000).nullish()
})
  .pick({ name: true, description: true })
  .extend({ id: z.uuid('id must be a valid UUID') })
  .refine((input) => Object.keys(input).some((key) => key !== 'id'), { message: 'at least one field is required' });

export const entityFilterInputSchema = createFilterInputSchema({
  id: idFilterInputSchema,
  name: stringFilterInputSchema,
  description: stringFilterInputSchema,
  createdAt: dateFilterInputSchema,
  updatedAt: dateFilterInputSchema
});

export const entitySortInputSchema = createSortInputSchema(['name', 'createdAt', 'updatedAt']);

export const listEntityInputSchema = createListInputSchema({
  filter: entityFilterInputSchema,
  sort: entitySortInputSchema
});

export const entityDefaultSort: EntitySortInput = { field: 'createdAt', direction: 'DESC' };

export type Entity = z.infer<typeof selectEntitySchema>;
export type CreateEntityInput = z.infer<typeof createEntityInputSchema>;
export type UpdateEntityInput = z.infer<typeof updateEntityInputSchema>;
export type EntityFilterInput = z.infer<typeof entityFilterInputSchema>;
export type EntitySortInput = z.infer<typeof entitySortInputSchema>;
export type EntitySortField = EntitySortInput['field'];
export type ListEntityInput = z.infer<typeof listEntityInputSchema>;
```

## `api/src/db/schema.ts`

The table registry handed to `drizzle(pool, { schema })` in `db/client.ts`, which imports it as `{ schema }`. drizzle-kit
does not read this object: `drizzle.config.ts` points at `src/db/schemas/*.schema.ts`, because drizzle-kit discovers
tables from module exports.

```ts
import { entity } from './schemas/entity.schema.js';

/**
 * Every drizzle table, passed to `drizzle(pool, { schema })`. Each table is
 * defined with its zod inputs in `schemas/<resource>.schema.ts`; register new
 * tables here.
 */
export const schema = { entity };
```

## `api/src/daos/entity.dao.ts`

The DAO only runs queries. `implements Dao<Entity, ListEntityInput, CreateEntityInput, UpdateEntityInput>` is the whole
type surface: it never names the filter or sort-field types, and it passes the `entity` table to the shared helpers.

```ts
import { count, eq } from 'drizzle-orm';
import type { DbClient } from '../db/client.js';
import {
  type CreateEntityInput,
  type Entity,
  entity,
  entityDefaultSort,
  type ListEntityInput,
  type UpdateEntityInput
} from '../db/schemas/entity.schema.js';
import { filterToSql, sortToSql, toPaginatedResult } from '../helpers/dao.helper.js';
import type { Dao, IdInput, PaginatedResult } from '../models/dao.model.js';
import { NotFoundError } from '../models/error.model.js';

export class EntityDao implements Dao<Entity, ListEntityInput, CreateEntityInput, UpdateEntityInput> {
  constructor(private readonly db: DbClient) {}

  async get({ id }: IdInput): Promise<Entity | null> {
    const [row] = await this.db.select().from(entity).where(eq(entity.id, id)).limit(1);
    return row ?? null;
  }

  async list({ filter, sort = entityDefaultSort, page, pageSize }: ListEntityInput): Promise<PaginatedResult<Entity>> {
    const where = filter && filterToSql(filter, entity);
    const orderBy = sortToSql(sort, entity);

    const items = await this.db
      .select()
      .from(entity)
      .where(where)
      .orderBy(...orderBy)
      .limit(pageSize)
      .offset((page - 1) * pageSize);
    const [counted] = await this.db.select({ total: count() }).from(entity).where(where);
    return toPaginatedResult(items, counted?.total ?? 0, { page, pageSize });
  }

  async create(input: CreateEntityInput): Promise<Entity> {
    const [row] = await this.db.insert(entity).values(input).returning();
    if (!row) {
      throw new Error('Entity insert did not return a row');
    }
    return row;
  }

  async update({ id, ...attrs }: UpdateEntityInput): Promise<Entity> {
    const [row] = await this.db
      .update(entity)
      .set({ ...attrs, updatedAt: new Date() })
      .where(eq(entity.id, id))
      .returning();
    if (!row) {
      throw new NotFoundError('Entity', id);
    }
    return row;
  }

  async delete({ id }: IdInput): Promise<void> {
    const [row] = await this.db.delete(entity).where(eq(entity.id, id)).returning({ id: entity.id });
    if (!row) {
      throw new NotFoundError('Entity', id);
    }
  }
}
```

The DAO is the only code that touches Drizzle. It is covered directly by a Testcontainers-backed suite
([`tests/db/entity.dao.test.ts`](#apitestsdbentitydaotestts)) that runs it against a real Postgres, and its
SQL-building pieces are additionally unit-tested through the SQL they render in the `dao.helper` tests
([api-dao.md](api-dao.md)).

## `api/src/controllers/home.controller.ts`

```ts
import type { NextFunction, Request, Response } from 'express';

export async function getHome(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ service: 'api', status: 'running' });
  } catch (err) {
    next(err);
  }
}
```

## `api/src/controllers/health.controller.ts`

Non-persisted ops probe: runs `SELECT 1` inline, no DAO. It is the one deliberate exception to the uniform
`catch (err) { next(err) }` skeleton — its catch maps any failure to a 503.

```ts
import type { NextFunction, Request, Response } from 'express';
import { sql } from 'drizzle-orm';
import createError from 'http-errors';

export async function getHealth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const startedAt = Date.now();
  try {
    await req.app.locals.context.db.execute(sql`select 1`);
    res.json({
      status: 'ok',
      db: 'up',
      latencyMs: Date.now() - startedAt,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    next(createError(503, 'Database connection failed', { expose: true, cause: err }));
  }
}
```

## `api/src/controllers/entity.controller.ts`

Thin HTTP edge. Each handler validates with the resource's input schemas, calls the DAO, and translates errors itself:
an invalid query, id or body → 400, `NotFoundError` → 404 for update and delete. The list handler decodes the URL
itself (unknown params, the JSON filter, sort, page numbers) and then validates the structured input with `safeParse`
like the others. No cross-cutting helpers in this file.

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

export async function listEntities(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { filter, sortField, sortDirection, page, pageSize, ...unknownParams } = normalizeQuery(req.query);
    const unknownKeys = Object.keys(unknownParams);
    if (unknownKeys.length > 0) {
      throw createError(400, `Unknown query params: ${unknownKeys.join(', ')}`, { expose: true });
    }
    let decodedFilter: unknown;
    try {
      decodedFilter = typeof filter === 'string' ? JSON.parse(filter) : filter;
    } catch {
      throw createError(400, 'filter must be valid JSON', { expose: true });
    }
    const input = listEntityInputSchema.safeParse({
      filter: decodedFilter,
      sort: sortField === undefined ? undefined : { field: sortField, direction: sortDirection ?? 'ASC' },
      page: page === undefined ? undefined : Number(page),
      pageSize: pageSize === undefined ? undefined : Number(pageSize)
    });
    if (!input.success) {
      throw createError(400, 'Invalid query', { expose: true, cause: z.flattenError(input.error) });
    }
    const result = await req.app.locals.context.entityDao.list(input.data);
    res.json(result);
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
    res.json(row);
  } catch (err) {
    next(err);
  }
}

export async function createEntity(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = createEntityInputSchema.safeParse(req.body);
    if (!input.success) {
      throw createError(400, 'Invalid body', { expose: true, cause: z.flattenError(input.error) });
    }
    const row = await req.app.locals.context.entityDao.create(input.data);
    res.status(201).json(row);
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
    const input = updateEntityInputSchema.safeParse({ ...req.body, id: params.data.id });
    if (!input.success) {
      throw createError(400, 'Invalid body', { expose: true, cause: z.flattenError(input.error) });
    }
    try {
      const row = await req.app.locals.context.entityDao.update(input.data);
      res.json(row);
    } catch (err) {
      if (err instanceof NotFoundError) {
        throw createError(404, err.message, { expose: true, cause: err });
      }
      throw err;
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
      if (err instanceof NotFoundError) {
        throw createError(404, err.message, { expose: true, cause: err });
      }
      throw err;
    }
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
```

## Test layout

Tests are grouped by kind, not mirrored against `src/` (full rules in `coding-conventions.md`):

| folder | what it tests | DAO / DB | project, script |
| --- | --- | --- | --- |
| `tests/unit/` | helpers and schemas: `dao.helper`, `list-input.helper`, `query-parser.helper`, `entity.schema` | none | `unit`, `pnpm test` |
| `tests/controllers/` | **controller unit tests**: one file per controller plus `error.middleware.test.ts` — validation, status codes, error mapping, response shape | fake DAO | `controllers`, `pnpm test` |
| `tests/db/` | the DAO itself: one `<resource>.dao.test.ts`, every query path | real DAO, Testcontainers Postgres | `db`, `pnpm test:integration` |
| `tests/api/` | **API tests, end to end**: one `<resource>.api.test.ts`, real HTTP → controller → DAO → Postgres | real DAO, Testcontainers Postgres | `api`, `pnpm test:integration` |
| `tests/utils/` | shared helpers, not tests | — | — |

A controller test proves what the controller does with whatever the DAO returns; it cannot prove the real DAO accepts
what the controller sends or returns what the controller serializes. The API test closes that gap per resource, and the
DAO test covers every query path without HTTP in between.

Each test file wraps its suites in one top-level `describe` named for the file's module (`describe('entity.controller')`,
`describe('entity.dao')`, `describe('entity.api')`, …). `vitest.config.ts` defines four projects (`unit`,
`controllers`, `db`, `api`); `pnpm --filter api test` runs `unit` + `controllers` (no Docker), and
`pnpm --filter api test:integration` runs `db` + `api`.

## `api/tests/utils/`

Shared test helpers, not tests themselves. The `controllers` suites use `test-server.ts` + `fake-dao.ts`; the `db`
suite uses `pg-container.ts` + `entity-seed.ts`; the `api` suite uses `pg-container.ts`, `entity-seed.ts` and
`test-server.ts`'s `serve`.

### `api/tests/utils/fake-dao.ts`

A vitest mock standing in for `EntityDao`, a minimal `db` stub for the health probe, and `createTestApp`, which builds an
app whose context carries both and returns them so tests can program and assert on them.

```ts
import { vi } from 'vitest';
import { createApp } from '../../src/app.js';
import type { EntityDao } from '../../src/daos/entity.dao.js';
import type { DbClient } from '../../src/db/client.js';
import type { AppContext } from '../../src/models/app-context.model.js';

/** A vitest mock standing in for an EntityDao — one vi.fn() per Dao method. */
export function createFakeDao() {
  return {
    get: vi.fn(),
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn()
  };
}

/** A minimal stub of the drizzle client: only `execute`, used by the health probe. */
export function createFakeDb() {
  return { execute: vi.fn().mockResolvedValue(undefined) };
}

export type FakeDao = ReturnType<typeof createFakeDao>;
export type FakeDb = ReturnType<typeof createFakeDb>;

/** Build an app whose context carries a fake DAO and db, returning both so tests can program and assert on them. */
export function createTestApp(): { app: ReturnType<typeof createApp>; dao: FakeDao; db: FakeDb } {
  const dao = createFakeDao();
  const db = createFakeDb();
  const context: AppContext = { db: db as unknown as DbClient, entityDao: dao as unknown as EntityDao };
  return { app: createApp(context), dao, db };
}
```

### `api/tests/utils/test-server.ts`

Starts an app on an ephemeral port and hands back its base URL. `startTestServer` serves the app with the fake DAO and
db, so each controller test is a few lines of `fetch`; `serve` takes any app, which is how the API test serves the real
one.

```ts
import { createServer, type RequestListener, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createTestApp, type FakeDao, type FakeDb } from './fake-dao.js';

export interface ServedApp {
  readonly baseUrl: string;
  readonly close: () => Promise<void>;
}

export interface TestServer extends ServedApp {
  readonly dao: FakeDao;
  readonly db: FakeDb;
}

/** Serve an app on an ephemeral port and hand back its base URL. */
export async function serve(app: RequestListener): Promise<ServedApp> {
  const server: Server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const { port } = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve()))
  };
}

/** Start the app (with a fake DAO + db) on an ephemeral port and hand back its base URL and mocks. */
export async function startTestServer(): Promise<TestServer> {
  const { app, dao, db } = createTestApp();
  return { ...(await serve(app)), dao, db };
}
```

### `api/tests/utils/pg-container.ts`

Spins up a throwaway `postgres:17-alpine` with Testcontainers, connects drizzle, and applies `db/migrations/` with the
drizzle migrator (same `__migrations__` table as `drizzle.config.ts`). DAO suites call `startTestDb()` once in
`beforeAll` and `stop()` in `afterAll`. Needs a running Docker daemon.

```ts
import { fileURLToPath } from 'node:url';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import type { DbClient } from '../../src/db/client.js';
import { schema } from '../../src/db/schema.js';

const migrationsFolder = fileURLToPath(new URL('../../db/migrations', import.meta.url));

export interface TestDb {
  readonly db: DbClient;
  readonly stop: () => Promise<void>;
}

/**
 * Spin up a throwaway Postgres container, connect drizzle to it, and apply the
 * project's migrations with the drizzle migrator (same folder and __migrations__
 * table as drizzle.config.ts). DAO suites call this once in beforeAll and tear
 * it down in afterAll.
 */
export async function startTestDb(): Promise<TestDb> {
  const container: StartedPostgreSqlContainer = await new PostgreSqlContainer('postgres:17-alpine').start();
  const pool = new Pool({ connectionString: container.getConnectionUri() });
  const db = drizzle(pool, { schema });
  await migrate(db, { migrationsFolder, migrationsTable: '__migrations__', migrationsSchema: 'public' });
  return {
    db,
    stop: async () => {
      await pool.end();
      await container.stop();
    }
  };
}
```

### `api/tests/utils/entity-seed.ts`

Seed generators for the DAO suite: `day(n)` for stable timestamps, `seedEntities(db, rows)` inserting directly (bypassing
the DAO so tests control ids and timestamps), and `seedCanonical(db)` for the five-row list fixture. A new resource adds
its own `<resource>-seed.ts`.

```ts
import type { DbClient } from '../../src/db/client.js';
import { type Entity, entity } from '../../src/db/schemas/entity.schema.js';

export interface EntitySeed {
  name: string;
  description?: string | null;
  createdAt?: Date;
}

/** A fixed day in 2026, so date-filter tests have stable, ordered timestamps. */
export function day(n: number): Date {
  return new Date(Date.UTC(2026, 0, n));
}

/** Insert rows directly (bypassing the DAO) so tests control ids, descriptions and timestamps. */
export function seedEntities(db: DbClient, rows: EntitySeed[]): Promise<Entity[]> {
  return db.insert(entity).values(rows).returning();
}

/** Five rows (alpha…echo) on consecutive days, with one null description — the canonical list fixture. */
export function seedCanonical(db: DbClient): Promise<Entity[]> {
  return seedEntities(db, [
    { name: 'alpha', description: 'first', createdAt: day(1) },
    { name: 'bravo', description: 'second', createdAt: day(2) },
    { name: 'charlie', description: null, createdAt: day(3) },
    { name: 'delta', description: 'fourth', createdAt: day(4) },
    { name: 'echo', description: 'fifth', createdAt: day(5) }
  ]);
}
```

## `api/tests/controllers/entity.controller.test.ts`

Runs the real app from `createApp` on a random port, with a fake DAO on the context (via `startTestServer`). This is what
the context singleton buys: no database, no module mocking. Uses `fetch`, not `supertest`, and asserts status **and**
response body for each route, plus the 400/404 cases — including the body-parser edges (malformed JSON → 400, an
over-the-limit body → 413), the `PATCH` validation refine (no updatable fields → 400) and an invalid field → 400, the
DAO's `NotFoundError` → 404 on **both** update and delete, and repeated query params collapsing to the first value.

```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { NotFoundError } from '../../src/models/error.model.js';
import { startTestServer, type TestServer } from '../utils/test-server.js';

const ID = '00000000-0000-4000-8000-000000000001';

let srv: TestServer;

beforeEach(async () => {
  srv = await startTestServer();
});

afterEach(async () => {
  await srv.close();
});

describe('entity.controller', () => {
  describe('GET /entities', () => {
    it('passes the parsed list input to the DAO and returns its paginated result', async () => {
      // Arrange
      const result = { items: [{ id: ID, name: 'a' }], total: 1, page: 2, pageSize: 5, totalPages: 1 };
      srv.dao.list.mockResolvedValue(result);
      const filter = encodeURIComponent(JSON.stringify({ name: { contains: 'a' } }));

      // Act
      const res = await fetch(`${srv.baseUrl}/entities?filter=${filter}&sortField=name&sortDirection=DESC&page=2&pageSize=5`);

      // Assert
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual(result);
      expect(srv.dao.list).toHaveBeenCalledWith({
        filter: { name: { contains: 'a' } },
        sort: { field: 'name', direction: 'DESC' },
        page: 2,
        pageSize: 5
      });
    });

    it('decodes the URL params: numbers, and ASC when only a sort field is given', async () => {
      // Arrange
      srv.dao.list.mockResolvedValue({ items: [], total: 0, page: 3, pageSize: 10, totalPages: 0 });

      // Act
      const res = await fetch(`${srv.baseUrl}/entities?sortField=createdAt&page=3&pageSize=10`);

      // Assert
      expect(res.status).toBe(200);
      expect(srv.dao.list).toHaveBeenCalledWith({ sort: { field: 'createdAt', direction: 'ASC' }, page: 3, pageSize: 10 });
    });

    it('keeps the first value of a repeated param', async () => {
      // Arrange
      srv.dao.list.mockResolvedValue({ items: [], total: 0, page: 3, pageSize: 20, totalPages: 0 });

      // Act
      const res = await fetch(`${srv.baseUrl}/entities?page=3&page=9`);

      // Assert
      expect(res.status).toBe(200);
      expect(srv.dao.list).toHaveBeenCalledWith({ page: 3, pageSize: 20 });
    });

    it.each([
      ['a filter that is not JSON', 'filter=%7B'],
      ['an unknown param', 'nme=a'],
      ['a page that is not a number', 'page=abc'],
      ['a sort field outside the allowlist', 'sortField=description'],
      ['a pageSize over the max', 'pageSize=101']
    ])('rejects %s with 400 without reaching the DAO', async (_label, query) => {
      // Act
      const res = await fetch(`${srv.baseUrl}/entities?${query}`);

      // Assert
      expect(res.status).toBe(400);
      expect(srv.dao.list).not.toHaveBeenCalled();
    });

    it('rejects a malformed filter with 400 without reaching the DAO', async () => {
      // Act
      const res = await fetch(`${srv.baseUrl}/entities?filter=${encodeURIComponent('{"name":{"gt":1}}')}`);

      // Assert
      expect(res.status).toBe(400);
      expect(srv.dao.list).not.toHaveBeenCalled();
    });
  });

  describe('POST /entities', () => {
    it('creates from a valid body and returns 201 with the created row', async () => {
      // Arrange
      const created = { id: ID, name: 'first', description: null };
      srv.dao.create.mockResolvedValue(created);

      // Act
      const res = await fetch(`${srv.baseUrl}/entities`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'first' })
      });

      // Assert
      expect(res.status).toBe(201);
      expect(await res.json()).toEqual(created);
      expect(srv.dao.create).toHaveBeenCalledWith({ name: 'first' });
    });

    it('rejects an empty name with 400', async () => {
      // Act
      const res = await fetch(`${srv.baseUrl}/entities`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: '' })
      });

      // Assert
      expect(res.status).toBe(400);
      expect(srv.dao.create).not.toHaveBeenCalled();
    });

    it('rejects a malformed JSON body with 400 without reaching the DAO', async () => {
      // Act: the JSON body parser fails before the controller runs.
      const res = await fetch(`${srv.baseUrl}/entities`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{'
      });

      // Assert
      expect(res.status).toBe(400);
      expect(srv.dao.create).not.toHaveBeenCalled();
    });

    it('rejects a body over the size limit with 413 without reaching the DAO', async () => {
      // Act: express.json()'s default 100kb limit rejects the request before the controller runs.
      const res = await fetch(`${srv.baseUrl}/entities`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'x'.repeat(200 * 1024) })
      });

      // Assert
      expect(res.status).toBe(413);
      expect(srv.dao.create).not.toHaveBeenCalled();
    });
  });

  describe('/entities/:id', () => {
    it('returns 200 with the row on GET', async () => {
      // Arrange
      const row = { id: ID, name: 'found', description: null };
      srv.dao.get.mockResolvedValue(row);

      // Act
      const res = await fetch(`${srv.baseUrl}/entities/${ID}`);

      // Assert
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual(row);
      expect(srv.dao.get).toHaveBeenCalledWith({ id: ID });
    });

    it('returns 404 when GET finds no row', async () => {
      // Arrange
      srv.dao.get.mockResolvedValue(null);

      // Act
      const res = await fetch(`${srv.baseUrl}/entities/${ID}`);

      // Assert
      expect(res.status).toBe(404);
    });

    it('returns 200 with the updated row on PATCH', async () => {
      // Arrange
      const updated = { id: ID, name: 'renamed', description: null };
      srv.dao.update.mockResolvedValue(updated);

      // Act
      const res = await fetch(`${srv.baseUrl}/entities/${ID}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'renamed' })
      });

      // Assert
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual(updated);
      expect(srv.dao.update).toHaveBeenCalledWith({ id: ID, name: 'renamed' });
    });

    it('rejects a PATCH with no updatable fields with 400 without reaching the DAO', async () => {
      // Act: the update schema's refine requires at least one field besides id.
      const res = await fetch(`${srv.baseUrl}/entities/${ID}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({})
      });

      // Assert
      expect(res.status).toBe(400);
      expect(srv.dao.update).not.toHaveBeenCalled();
    });

    it('rejects a PATCH with an invalid field with 400 without reaching the DAO', async () => {
      // Act: name exceeds its 200-character limit.
      const res = await fetch(`${srv.baseUrl}/entities/${ID}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'x'.repeat(201) })
      });

      // Assert
      expect(res.status).toBe(400);
      expect(srv.dao.update).not.toHaveBeenCalled();
    });

    it('rejects an id that is not a uuid with 400', async () => {
      // Act
      const res = await fetch(`${srv.baseUrl}/entities/not-a-uuid`);

      // Assert
      expect(res.status).toBe(400);
    });

    it('maps NotFoundError from the DAO to 404', async () => {
      // Arrange
      srv.dao.update.mockRejectedValue(new NotFoundError('Entity', ID));

      // Act
      const res = await fetch(`${srv.baseUrl}/entities/${ID}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'renamed' })
      });

      // Assert
      expect(res.status).toBe(404);
      expect(srv.dao.update).toHaveBeenCalledWith({ id: ID, name: 'renamed' });
    });

    it('maps NotFoundError from the DAO to 404 on delete', async () => {
      // Arrange
      srv.dao.delete.mockRejectedValue(new NotFoundError('Entity', ID));

      // Act
      const res = await fetch(`${srv.baseUrl}/entities/${ID}`, { method: 'DELETE' });

      // Assert
      expect(res.status).toBe(404);
      expect(srv.dao.delete).toHaveBeenCalledWith({ id: ID });
    });

    it('returns 204 with an empty body on delete', async () => {
      // Arrange
      srv.dao.delete.mockResolvedValue(undefined);

      // Act
      const res = await fetch(`${srv.baseUrl}/entities/${ID}`, { method: 'DELETE' });

      // Assert
      expect(res.status).toBe(204);
      expect(await res.text()).toBe('');
      expect(srv.dao.delete).toHaveBeenCalledWith({ id: ID });
    });
  });
});
```

## `api/tests/controllers/home.controller.test.ts`

One file per controller: the home descriptor, and the unmatched-path 404 (the not-found middleware's job, exercised at
the app edge).

```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { startTestServer, type TestServer } from '../utils/test-server.js';

let srv: TestServer;

beforeEach(async () => {
  srv = await startTestServer();
});

afterEach(async () => {
  await srv.close();
});

describe('home.controller', () => {
  it('returns the service descriptor on GET /', async () => {
    // Act
    const res = await fetch(`${srv.baseUrl}/`);

    // Assert
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ service: 'api', status: 'running' });
  });

  it('returns 404 for an unmatched path', async () => {
    // Act
    const res = await fetch(`${srv.baseUrl}/nope`);

    // Assert
    expect(res.status).toBe(404);
  });
});
```

## `api/tests/controllers/health.controller.test.ts`

The health probe both ways: `ok` when the db stub resolves, `503` when it rejects.

```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { startTestServer, type TestServer } from '../utils/test-server.js';

let srv: TestServer;

beforeEach(async () => {
  srv = await startTestServer();
});

afterEach(async () => {
  await srv.close();
});

describe('health.controller', () => {
  it('reports ok when the database responds', async () => {
    // Act
    const res = await fetch(`${srv.baseUrl}/health`);

    // Assert
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: 'ok', db: 'up' });
    expect(srv.db.execute).toHaveBeenCalledOnce();
  });

  it('reports 503 when the database query fails', async () => {
    // Arrange
    srv.db.execute.mockRejectedValue(new Error('down'));

    // Act
    const res = await fetch(`${srv.baseUrl}/health`);

    // Assert
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ status: 'error' });
  });
});
```

## `api/tests/controllers/error.middleware.test.ts`

Exercises the terminal error handler through the real app (fake DAO). The key guarantee is that an **unexpected** error
(a non-`http-error`) becomes a `500` whose body does **not** leak the original message — only `4xx` errors created with
`createError(..., { expose: true })` surface their message. Also pins the uniform body shape `{ status, message }`
returned at every status.

```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { startTestServer, type TestServer } from '../utils/test-server.js';

const ID = '00000000-0000-4000-8000-000000000001';

let srv: TestServer;

beforeEach(async () => {
  srv = await startTestServer();
});

afterEach(async () => {
  await srv.close();
});

describe('error.middleware', () => {
  it('maps an unexpected error to 500 without leaking the internal message', async () => {
    // Arrange: a non-HTTP error from deep in the stack.
    srv.dao.get.mockRejectedValue(new Error('secret db detail'));

    // Act
    const res = await fetch(`${srv.baseUrl}/entities/${ID}`);

    // Assert: the status is 500 and the body hides the original message.
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ status: 'error', message: 'Internal Server Error' });
  });

  it('exposes the message of a client (4xx) error in the standard body shape', async () => {
    // Act: an invalid uuid produces a 400 from the controller.
    const res = await fetch(`${srv.baseUrl}/entities/not-a-uuid`);

    // Assert
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ status: 'error', message: 'Invalid id' });
  });

  it('returns the standard body shape on a 404', async () => {
    // Arrange
    srv.dao.get.mockResolvedValue(null);

    // Act
    const res = await fetch(`${srv.baseUrl}/entities/${ID}`);

    // Assert
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ status: 'error', message: `Entity not found: ${ID}` });
  });
});
```

## `api/tests/db/entity.dao.test.ts`

Exercises the real DAO against a throwaway `postgres:17-alpine` (via `startTestDb` from `utils/pg-container.ts`), with
`db/migrations/` applied by the drizzle migrator. One container per suite (`beforeAll` / `afterAll`), and `beforeEach`
clears rows (a delete) so each test is isolated. `create` / `get` / `update` / `delete` cover the happy path and the edge
cases (`NotFoundError` on a missing id, null description, a partial patch leaving omitted fields untouched vs. clearing a
field with `null`); `list` is exhaustive — pagination, sort (with the `id`
tie-breaker and the default sort), filter (every operator kind possible on the entity's columns, a second string and a
second date column, `and` / `or` / `not`, empty `in`), the three combined, and a dedicated
`list: filter escaping and injection safety` block proving `escapeLike` treats `%` / `_` as literals and that a hostile
value is parameterized, not executed.

Needs a running Docker daemon **and** an existing `db/migrations/` (run `pnpm --filter api db:generate` first). It runs
under `pnpm --filter api test:integration`, not the default `test`.

```ts
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { EntityDao } from '../../src/daos/entity.dao.js';
import { type Entity, type EntityFilterInput, type EntitySortInput, entity } from '../../src/db/schemas/entity.schema.js';
import { NotFoundError } from '../../src/models/error.model.js';
import { day, seedCanonical, seedEntities } from '../utils/entity-seed.js';
import { startTestDb, type TestDb } from '../utils/pg-container.js';

const MISSING_ID = '00000000-0000-4000-8000-000000000000';

let testDb: TestDb;
let dao: EntityDao;

function runList(input: { filter?: EntityFilterInput; sort?: EntitySortInput; page?: number; pageSize?: number } = {}) {
  return dao.list({ page: 1, pageSize: 50, ...input });
}

const names = (result: { items: readonly Entity[] }): string[] => result.items.map((row) => row.name);

const idsOf = (rows: readonly Entity[]): string[] => rows.map((row) => row.id);

function idOf(rows: Entity[], name: string): string {
  const row = rows.find((candidate) => candidate.name === name);
  if (!row) {
    throw new Error(`no seeded row named ${name}`);
  }
  return row.id;
}

describe('entity.dao', () => {
  beforeAll(async () => {
    testDb = await startTestDb();
    dao = new EntityDao(testDb.db);
  });

  afterAll(async () => {
    await testDb.stop();
  });

  beforeEach(async () => {
    await testDb.db.delete(entity);
  });

  describe('create', () => {
    it('inserts a row and returns it with a generated id and timestamps', async () => {
      // Act
      const row = await dao.create({ name: 'first', description: 'hello' });

      // Assert
      expect(row.name).toBe('first');
      expect(row.description).toBe('hello');
      expect(row.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(row.createdAt).toBeInstanceOf(Date);
      expect(row.updatedAt).toBeInstanceOf(Date);
    });

    it('stores a null description when none is given', async () => {
      // Act
      const row = await dao.create({ name: 'no-desc' });

      // Assert
      expect(row.description).toBeNull();
    });
  });

  describe('get', () => {
    it('returns the row for an existing id', async () => {
      // Arrange
      const created = await dao.create({ name: 'findme' });

      // Act
      const row = await dao.get({ id: created.id });

      // Assert
      expect(row).toEqual(created);
    });

    it('returns null for a missing id', async () => {
      // Act + Assert
      expect(await dao.get({ id: MISSING_ID })).toBeNull();
    });
  });

  describe('update', () => {
    it('updates the given fields and bumps updatedAt', async () => {
      // Arrange
      const created = await dao.create({ name: 'old', description: 'old' });

      // Act
      const row = await dao.update({ id: created.id, name: 'new', description: null });

      // Assert
      expect(row.name).toBe('new');
      expect(row.description).toBeNull();
      expect(row.updatedAt.getTime()).toBeGreaterThanOrEqual(created.updatedAt.getTime());
    });

    it('throws NotFoundError for a missing id', async () => {
      // Act + Assert
      await expect(dao.update({ id: MISSING_ID, name: 'x' })).rejects.toBeInstanceOf(NotFoundError);
    });

    it('leaves fields that are omitted from the patch untouched', async () => {
      // Arrange
      const created = await dao.create({ name: 'old', description: 'keep me' });

      // Act: patch only the name.
      const row = await dao.update({ id: created.id, name: 'new' });

      // Assert
      expect(row.name).toBe('new');
      expect(row.description).toBe('keep me');
    });

    it('clears a field when the patch sets it to null', async () => {
      // Arrange
      const created = await dao.create({ name: 'old', description: 'remove me' });

      // Act
      const row = await dao.update({ id: created.id, description: null });

      // Assert
      expect(row.name).toBe('old');
      expect(row.description).toBeNull();
    });
  });

  describe('delete', () => {
    it('removes the row', async () => {
      // Arrange
      const created = await dao.create({ name: 'gone' });

      // Act
      await dao.delete({ id: created.id });

      // Assert
      expect(await dao.get({ id: created.id })).toBeNull();
    });

    it('throws NotFoundError for a missing id', async () => {
      // Act + Assert
      await expect(dao.delete({ id: MISSING_ID })).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('list: pagination', () => {
    beforeEach(async () => {
      await seedCanonical(testDb.db);
    });

    it('returns the requested page with total and totalPages', async () => {
      // Act
      const result = await runList({ sort: { field: 'name', direction: 'ASC' }, page: 1, pageSize: 2 });

      // Assert
      expect(names(result)).toEqual(['alpha', 'bravo']);
      expect(result).toMatchObject({ total: 5, page: 1, pageSize: 2, totalPages: 3 });
    });

    it('returns the last partial page', async () => {
      // Act
      const result = await runList({ sort: { field: 'name', direction: 'ASC' }, page: 3, pageSize: 2 });

      // Assert
      expect(names(result)).toEqual(['echo']);
    });

    it('returns no items for a page past the end but keeps the real total', async () => {
      // Act
      const result = await runList({ page: 4, pageSize: 2 });

      // Assert
      expect(result.items).toEqual([]);
      expect(result).toMatchObject({ total: 5, totalPages: 3 });
    });
  });

  describe('list: sort', () => {
    beforeEach(async () => {
      await seedCanonical(testDb.db);
    });

    it('sorts by name ascending', async () => {
      expect(names(await runList({ sort: { field: 'name', direction: 'ASC' } }))).toEqual(['alpha', 'bravo', 'charlie', 'delta', 'echo']);
    });

    it('sorts by name descending', async () => {
      expect(names(await runList({ sort: { field: 'name', direction: 'DESC' } }))).toEqual(['echo', 'delta', 'charlie', 'bravo', 'alpha']);
    });

    it('falls back to the default sort (createdAt DESC) when none is given', async () => {
      expect(names(await runList())).toEqual(['echo', 'delta', 'charlie', 'bravo', 'alpha']);
    });
  });

  describe('list: sort tie-breaker', () => {
    it('breaks ties on the sort field with an ascending id', async () => {
      // Arrange: identical name and timestamp, so only the id can order them.
      const created = await seedEntities(testDb.db, [
        { name: 'same', createdAt: day(1) },
        { name: 'same', createdAt: day(1) }
      ]);
      const expected = idsOf(created).sort();

      // Act
      const result = await runList({ sort: { field: 'name', direction: 'ASC' } });

      // Assert
      expect(idsOf(result.items)).toEqual(expected);
    });
  });

  describe('list: filter', () => {
    let rows: Entity[] = [];

    beforeEach(async () => {
      rows = await seedCanonical(testDb.db);
    });

    const sortedByName = (filter: EntityFilterInput) => runList({ filter, sort: { field: 'name', direction: 'ASC' } });

    it('filters by id eq and id in', async () => {
      expect(names(await sortedByName({ id: { eq: idOf(rows, 'alpha') } }))).toEqual(['alpha']);
      expect(names(await sortedByName({ id: { in: [idOf(rows, 'alpha'), idOf(rows, 'echo')] } }))).toEqual(['alpha', 'echo']);
    });

    it('treats an empty in list as matching nothing', async () => {
      const result = await sortedByName({ id: { in: [] } });
      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('filters strings by eq and ne', async () => {
      expect(names(await sortedByName({ name: { eq: 'bravo' } }))).toEqual(['bravo']);
      expect(names(await sortedByName({ name: { ne: 'alpha' } }))).toEqual(['bravo', 'charlie', 'delta', 'echo']);
    });

    it('matches contains / notContains / beginsWith case-insensitively', async () => {
      expect(names(await sortedByName({ name: { contains: 'ALPHA' } }))).toEqual(['alpha']);
      expect(names(await sortedByName({ name: { contains: 'a' } }))).toEqual(['alpha', 'bravo', 'charlie', 'delta']);
      expect(names(await sortedByName({ name: { notContains: 'a' } }))).toEqual(['echo']);
      expect(names(await sortedByName({ name: { beginsWith: 'A' } }))).toEqual(['alpha']);
    });

    it('filters strings by comparison, between and in', async () => {
      expect(names(await sortedByName({ name: { lt: 'charlie' } }))).toEqual(['alpha', 'bravo']);
      expect(names(await sortedByName({ name: { between: ['bravo', 'delta'] } }))).toEqual(['bravo', 'charlie', 'delta']);
      expect(names(await sortedByName({ name: { in: ['alpha', 'echo'] } }))).toEqual(['alpha', 'echo']);
    });

    it('filters dates by ge, le, between and eq', async () => {
      expect(names(await sortedByName({ createdAt: { ge: day(3) } }))).toEqual(['charlie', 'delta', 'echo']);
      expect(names(await sortedByName({ createdAt: { le: day(2) } }))).toEqual(['alpha', 'bravo']);
      expect(names(await sortedByName({ createdAt: { between: [day(2), day(4)] } }))).toEqual(['bravo', 'charlie', 'delta']);
      expect(names(await sortedByName({ createdAt: { eq: day(1) } }))).toEqual(['alpha']);
    });

    it('filters by description (a second string column)', async () => {
      // 'fourth' and 'fifth' both contain 'th'; charlie's description is null.
      expect(names(await sortedByName({ description: { contains: 'th' } }))).toEqual(['delta', 'echo']);
      expect(names(await sortedByName({ description: { eq: 'first' } }))).toEqual(['alpha']);
    });

    it('filters by updatedAt (a second date column)', async () => {
      // Seeded rows take the default updatedAt (insertion time), which is after every day() fixture.
      expect(names(await sortedByName({ updatedAt: { ge: day(1) } }))).toEqual(['alpha', 'bravo', 'charlie', 'delta', 'echo']);
      expect(await sortedByName({ updatedAt: { lt: day(1) } })).toMatchObject({ total: 0 });
    });

    it('combines fields with and / or / not', async () => {
      expect(names(await sortedByName({ and: [{ name: { contains: 'a' } }, { createdAt: { le: day(2) } }] }))).toEqual(['alpha', 'bravo']);
      expect(names(await sortedByName({ or: [{ name: { eq: 'alpha' } }, { name: { eq: 'echo' } }] }))).toEqual(['alpha', 'echo']);
      expect(names(await sortedByName({ not: { name: { eq: 'alpha' } } }))).toEqual(['bravo', 'charlie', 'delta', 'echo']);
    });

    it('returns an empty result when nothing matches', async () => {
      const result = await sortedByName({ name: { eq: 'zzz' } });
      expect(result.items).toEqual([]);
      expect(result).toMatchObject({ total: 0, totalPages: 0 });
    });
  });

  describe('list: filter escaping and injection safety', () => {
    it('treats LIKE metacharacters in contains as literals', async () => {
      // Arrange: rows whose names differ only by a literal % or _.
      await seedEntities(testDb.db, [{ name: '100% off' }, { name: '1000 off' }, { name: 'a_b' }, { name: 'axb' }]);
      const sortedByName = (filter: EntityFilterInput) => runList({ filter, sort: { field: 'name', direction: 'ASC' } });

      // Act + Assert: the % and _ match only themselves, not as wildcards.
      expect(names(await sortedByName({ name: { contains: '100%' } }))).toEqual(['100% off']);
      expect(names(await sortedByName({ name: { contains: 'a_b' } }))).toEqual(['a_b']);
    });

    it('treats a SQL-injection string as ordinary filter data', async () => {
      // Arrange
      await seedCanonical(testDb.db);

      // Act: a hostile value that would drop the table if it were not parameterized.
      const hostile = await runList({ filter: { name: { eq: "'; DROP TABLE entity; --" } } });

      // Assert: it matched nothing, and the table is still queryable afterwards.
      expect(hostile).toMatchObject({ total: 0 });
      expect((await runList()).total).toBe(5);
    });
  });

  describe('list: filter + sort + pagination combined', () => {
    beforeEach(async () => {
      await seedCanonical(testDb.db);
    });

    it('applies the filter, then the sort, then the page window', async () => {
      // Act: names containing 'a' (alpha, bravo, charlie, delta), sorted DESC, second page of 2.
      const result = await runList({
        filter: { name: { contains: 'a' } },
        sort: { field: 'name', direction: 'DESC' },
        page: 2,
        pageSize: 2
      });

      // Assert
      expect(names(result)).toEqual(['bravo', 'alpha']);
      expect(result).toMatchObject({ total: 4, page: 2, pageSize: 2, totalPages: 2 });
    });
  });
});
```

## `api/tests/api/entity.api.test.ts`

The resource's API, end to end: the real app served by `serve` on the real `EntityDao` and a Testcontainers Postgres,
driven over `fetch`, with no fake. Where the controller test programs the DAO's answers, this one gets them from real
rows, so it covers what only the real stack can show:

- `POST` creates a row, and the response carries ISO-8601 `createdAt` / `updatedAt` strings.
- `GET /entities` answers a `filter` (with `or`), `sortField` / `sortDirection` and `page` / `pageSize` sent as a real
  query string from seeded rows, with the right `total` and `totalPages`; an unknown filter field is a 400.
- `GET` / `PATCH` / `DELETE /entities/:id` read, update and delete a stored row, and a deleted row then 404s.
- A row that does not exist is a 404 on `GET`, `PATCH` and `DELETE` — the `NotFoundError` the real DAO throws.

Every route's happy path and every DAO-raised error belong here; validation edge cases (malformed JSON, oversize
bodies, each invalid field) stay in the controller test. Needs Docker and `db/migrations/`, like the DAO test.

```ts
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { EntityDao } from '../../src/daos/entity.dao.js';
import { entity } from '../../src/db/schemas/entity.schema.js';
import type { AppContext } from '../../src/models/app-context.model.js';
import { seedCanonical } from '../utils/entity-seed.js';
import { startTestDb, type TestDb } from '../utils/pg-container.js';
import { serve, type ServedApp } from '../utils/test-server.js';

const MISSING_ID = '00000000-0000-4000-8000-000000000000';
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

let testDb: TestDb;
let server: ServedApp;

beforeAll(async () => {
  testDb = await startTestDb();
  const context: AppContext = { db: testDb.db, entityDao: new EntityDao(testDb.db) };
  server = await serve(createApp(context));
});

afterAll(async () => {
  await server.close();
  await testDb.stop();
});

beforeEach(async () => {
  await testDb.db.delete(entity);
});

function request(path: string, init?: { method: string; body?: unknown }): Promise<Response> {
  return fetch(`${server.baseUrl}${path}`, {
    method: init?.method ?? 'GET',
    headers: init?.body === undefined ? undefined : { 'content-type': 'application/json' },
    body: init?.body === undefined ? undefined : JSON.stringify(init.body)
  });
}

describe('entity.api', () => {
  describe('POST /entities', () => {
    it('creates a row and returns it with ISO dates', async () => {
      // Act
      const res = await request('/entities', { method: 'POST', body: { name: 'alpha', description: 'first' } });

      // Assert
      expect(res.status).toBe(201);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body).toMatchObject({ name: 'alpha', description: 'first' });
      expect(body['createdAt']).toMatch(ISO);
      expect(body['updatedAt']).toMatch(ISO);
    });
  });

  describe('GET /entities', () => {
    it('answers a filter, sort and page from real rows', async () => {
      // Arrange
      await seedCanonical(testDb.db);
      const filter = encodeURIComponent(JSON.stringify({ or: [{ name: { beginsWith: 'a' } }, { description: { contains: 'F' } }] }));

      // Act
      const res = await request(`/entities?filter=${filter}&sortField=name&sortDirection=DESC&page=2&pageSize=2`);

      // Assert
      expect(res.status).toBe(200);
      const body = (await res.json()) as { items: { name: string }[]; total: number; page: number; pageSize: number; totalPages: number };
      expect(body.items).toEqual([expect.objectContaining({ name: 'alpha' })]);
      expect(body).toMatchObject({ total: 3, page: 2, pageSize: 2, totalPages: 2 });
    });

    it('rejects an unknown filter field with 400', async () => {
      const res = await request(`/entities?filter=${encodeURIComponent(JSON.stringify({ title: { eq: 'x' } }))}`);
      expect(res.status).toBe(400);
    });
  });

  describe('GET / PATCH / DELETE /entities/:id', () => {
    it('reads, updates and deletes a stored row', async () => {
      // Arrange
      const [row] = await seedCanonical(testDb.db);

      // Act + Assert
      const got = await request(`/entities/${row.id}`);
      expect(got.status).toBe(200);
      expect(await got.json()).toMatchObject({ id: row.id, name: 'alpha' });

      const patched = await request(`/entities/${row.id}`, { method: 'PATCH', body: { name: 'renamed' } });
      expect(patched.status).toBe(200);
      expect(await patched.json()).toMatchObject({ id: row.id, name: 'renamed', description: 'first' });

      expect((await request(`/entities/${row.id}`, { method: 'DELETE' })).status).toBe(204);
      expect((await request(`/entities/${row.id}`)).status).toBe(404);
    });

    it('answers 404 for a row that does not exist, on every id route', async () => {
      expect((await request(`/entities/${MISSING_ID}`)).status).toBe(404);
      expect((await request(`/entities/${MISSING_ID}`, { method: 'PATCH', body: { name: 'x' } })).status).toBe(404);
      expect((await request(`/entities/${MISSING_ID}`, { method: 'DELETE' })).status).toBe(404);
    });
  });
});
```

## `api/tests/unit/entity.schema.test.ts`

Covers only the entity's own column/sort wiring on `listEntityInputSchema` — a nested filter over the real columns with
date coercion, and the rejections specific to this resource (a column the entity lacks, a bad uuid, a sort field outside
its allowlist). The generic builder behaviour (defaults, strictness, the logical-branch cap) is covered once in
`tests/unit/list-input.helper.test.ts` ([api-dao.md](api-dao.md)), so it is not repeated here. No URL strings appear;
the controller test covers decoding.

```ts
import { describe, expect, it } from 'vitest';
import { listEntityInputSchema } from '../../src/db/schemas/entity.schema.js';

describe('entity.schema', () => {
  it('accepts a nested filter over the entity columns and coerces date strings', () => {
    // Arrange
    const raw = {
      filter: { or: [{ name: { contains: 'a' } }, { createdAt: { ge: '2026-01-01T00:00:00Z' } }] },
      sort: { field: 'name', direction: 'DESC' },
      page: 2,
      pageSize: 5
    };

    // Act
    const input = listEntityInputSchema.parse(raw);

    // Assert
    expect(input).toEqual({
      filter: { or: [{ name: { contains: 'a' } }, { createdAt: { ge: new Date('2026-01-01T00:00:00Z') } }] },
      sort: { field: 'name', direction: 'DESC' },
      page: 2,
      pageSize: 5
    });
  });

  it('accepts a date-only value in a date filter', () => {
    // Act
    const input = listEntityInputSchema.parse({ filter: { createdAt: { ge: '2026-01-01' } } });

    // Assert
    expect(input.filter).toEqual({ createdAt: { ge: new Date('2026-01-01') } });
  });

  it.each([
    ['a filter field the entity does not have', { filter: { title: { eq: 'a' } } }],
    ['an invalid uuid for the id column', { filter: { id: { eq: 'nope' } } }],
    ['a sort field outside the entity allowlist', { sort: { field: 'description', direction: 'ASC' } }]
  ])('rejects %s', (_label, raw) => {
    // Act + Assert
    expect(listEntityInputSchema.safeParse(raw).success).toBe(false);
  });
});
```

## Adding another resource

The entity example is the template. For a second resource (say `user`):

1. `db/schemas/user.schema.ts`: copy `entity.schema.ts` (no comments, as in the original). Define the `user` table, `createUserInputSchema` /
   `updateUserInputSchema` / `userIdInputSchema`, `userFilterInputSchema = createFilterInputSchema({ … })` with one
   scalar filter input per filterable column (keyed by the column name), `userSortInputSchema =
createSortInputSchema([...])`, `ListUserInput`, `listUserInputSchema` and `userDefaultSort`. The builders come from
   `helpers/list-input.helper.js`, the scalar inputs from `models/list-input.model.js`.
2. `db/schema.ts`: register the table, `export const schema = { entity, user }`.
3. `daos/user.dao.ts`: copy `entity.dao.ts`, swap the table and types:
   `implements Dao<User, ListUserInput, CreateUserInput, UpdateUserInput>`.
4. `models/app-context.model.ts`: add `userDao: UserDao`.
5. `server.ts`: instantiate `new UserDao(db)` in the context literal.
6. `controllers/user.controller.ts`: copy `entity.controller.ts`, swap the schemas and the DAO.
7. `app.ts`: wire the routes.
8. Tests: copy `tests/controllers/user.controller.test.ts` (routes, fake DAO), `tests/db/user.dao.test.ts`
   (Testcontainers), `tests/api/user.api.test.ts` (end to end over HTTP) and `tests/unit/user.schema.test.ts` (schema
   wiring) from the entity ones, swapping the schema and DAO. Add a
   `tests/utils/user-seed.ts` seed generator for the DAO suite; `fake-dao.ts`, `test-server.ts` and `pg-container.ts` are
   reused as-is.
9. Web: mirror `User`, `UserFilterInput`, `UserSortInput` and `ListUserInput` in `models/user.model.ts`, then add the
   page slices `store/user-list-page/`, `store/user-detail-page/` and `store/user-form-page/` and register each on its
   route (see [web.md](web.md#9-shared-model-and-page-slices)).
10. `pnpm --filter api db:generate --name add-user`, then `db:migrate`.

Adding a filterable column to an existing resource is one line in its filter input schema; adding a sortable one is
one entry in its `createSortInputSchema([...])` call. The compiler rejects either if the column does not exist.
