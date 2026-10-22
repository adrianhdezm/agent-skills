# API entity example

The `entity` resource wired end to end: table, schemas, DAO, controllers and tests. It is a placeholder for the first
real resource, and the template for every later one.

## Contents

- [`api/src/db/schema.ts`](#apisrcdbschemats)
- [`api/src/daos/entity.dao.ts`](#apisrcdaosentitydaots)
- [`api/src/controllers/home.controller.ts`](#apisrccontrollershomecontrollerts)
- [`api/src/controllers/health.controller.ts`](#apisrccontrollershealthcontrollerts)
- [`api/src/controllers/entity.controller.ts`](#apisrccontrollersentitycontrollerts)
- [`api/tests/controllers/entity.controller.test.ts`](#apitestscontrollersentitycontrollertestts)
- [Adding another resource](#adding-another-resource)

## `api/src/db/schema.ts`

One example resource: `entity`, with a uuid id, name, description and timestamps. The list query is built
declaratively from the primitives in `models/query/`.

```ts
import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema, createUpdateSchema } from 'drizzle-zod';
import { z } from 'zod';
import { dateTimePredicate, listQuerySchema, textPredicate, whereSchema } from '../models/query/index.js';

export const entity = pgTable('entity', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
});

export type Entity = typeof entity.$inferSelect;

// --- Row-level schemas (drizzle-zod) --------------------------------------

export const selectEntitySchema = createSelectSchema(entity);

export const createEntitySchema = createInsertSchema(entity, {
  name: (schema) => schema.min(1, 'name is required').max(200),
  description: (schema) => schema.max(2000).nullish()
}).pick({ name: true, description: true });

export const updateEntitySchema = createUpdateSchema(entity, {
  name: (schema) => schema.min(1).max(200),
  description: (schema) => schema.max(2000).nullish()
})
  .pick({ name: true, description: true })
  .refine((data) => Object.keys(data).length > 0, { message: 'at least one field is required' });

export const entityIdParamSchema = z.object({
  id: z.string().uuid('id must be a valid UUID')
});

export type CreateEntityInput = z.infer<typeof createEntitySchema>;
export type UpdateEntityInput = z.infer<typeof updateEntitySchema>;

// --- List query (filter / sort / pagination) ------------------------------
// Adding a filterable column is one line here; adding an operator is one
// line in `models/query/predicates.ts`.

export const entityWhereSchema = whereSchema({
  name: textPredicate,
  description: textPredicate,
  createdAt: dateTimePredicate,
  updatedAt: dateTimePredicate
});

export const entityListQuerySchema = listQuerySchema({
  where: entityWhereSchema,
  sortFields: ['name', 'createdAt', 'updatedAt'] as const
});

export type EntityWhere = z.infer<typeof entityWhereSchema>;
export type EntityListQuery = z.infer<typeof entityListQuerySchema>;
```

## `api/src/daos/entity.dao.ts`

```ts
import { eq, inArray } from 'drizzle-orm';
import type { DbClient } from '../db/client.js';
import {
  type CreateEntityInput,
  type Entity,
  type EntityListQuery,
  entity,
  entityListQuerySchema,
  type UpdateEntityInput
} from '../db/schema.js';
import type { Dao, ListResult } from '../models/dao.model.js';
import { NotFoundError } from '../models/error.model.js';
import { type ColumnMap, countRows, orderByToSql, whereToSql } from './query.js';

const ENTITY_COLUMNS: ColumnMap = {
  name: entity.name,
  description: entity.description,
  createdAt: entity.createdAt,
  updatedAt: entity.updatedAt
};

export class EntityDao implements Dao<Entity, CreateEntityInput, UpdateEntityInput, EntityListQuery> {
  constructor(private readonly db: DbClient) {}

  async findOne({ id }: { id: string }): Promise<Entity | null> {
    const [row] = await this.db.select().from(entity).where(eq(entity.id, id)).limit(1);
    return row ?? null;
  }

  async list(params?: EntityListQuery): Promise<ListResult<Entity>> {
    // When called without args, resolve defaults from the schema itself so
    // they're defined once (in db/schema.ts) rather than duplicated here.
    const { where, orderBy, limit, offset } = params ?? entityListQuerySchema.parse({});
    const whereSql = whereToSql(where, ENTITY_COLUMNS);
    const orderBySql = orderByToSql(orderBy, ENTITY_COLUMNS);

    const rowsQuery = this.db.select().from(entity).$dynamic();
    if (whereSql) {
      rowsQuery.where(whereSql);
    }
    if (orderBySql.length > 0) {
      rowsQuery.orderBy(...orderBySql);
    }
    rowsQuery.limit(limit).offset(offset);

    const [items, total] = await Promise.all([rowsQuery, countRows(this.db, entity, whereSql)]);
    return { items, total, limit, offset };
  }

  async create({ attrs }: { attrs: CreateEntityInput }): Promise<Entity> {
    const [row] = await this.db.insert(entity).values(attrs).returning();
    if (!row) {
      throw new Error('Entity insert did not return a row');
    }
    return row;
  }

  async update({ id, attrs }: { id: string; attrs: UpdateEntityInput }): Promise<Entity> {
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

  async delete({ id }: { id: string }): Promise<void> {
    const [row] = await this.db.delete(entity).where(eq(entity.id, id)).returning({ id: entity.id });
    if (!row) {
      throw new NotFoundError('Entity', id);
    }
  }

  async deleteMany({ ids }: { ids: readonly string[] }): Promise<void> {
    if (ids.length === 0) {
      return;
    }
    await this.db.delete(entity).where(inArray(entity.id, [...ids]));
  }
}
```

The DAO is the only code that touches Drizzle, and it needs a live database, so it has no unit test. Its SQL building
is covered by the `daos/query.ts` tests; its wiring is covered by the smoke test in the SKILL.md Review Checklist.

## `api/src/controllers/home.controller.ts`

```ts
import type { NextFunction, Request, Response } from 'express';

export async function homeController(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ service: 'api', status: 'running' });
  } catch (err) {
    next(err);
  }
}
```

## `api/src/controllers/health.controller.ts`

Non-persisted ops probe: runs `SELECT 1` inline, no DAO.

```ts
import type { NextFunction, Request, Response } from 'express';
import { sql } from 'drizzle-orm';
import createError from 'http-errors';

export async function healthController(req: Request, res: Response, next: NextFunction): Promise<void> {
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

Thin HTTP edge. Everything on-request is inlined: zod validation per field with explicit 400s, `NotFoundError` → 404
in the catch, `QueryParseError` → 400 in the catch for the list endpoint. No cross-cutting helpers in this file.

```ts
import type { NextFunction, Request, Response } from 'express';
import createError from 'http-errors';
import { z } from 'zod';
import { createEntitySchema, entityIdParamSchema, entityListQuerySchema, updateEntitySchema } from '../db/schema.js';
import { parseQuery } from '../helpers/query-parser.helper.js';
import { NotFoundError, QueryParseError } from '../models/error.model.js';

export async function listEntities(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const query = parseQuery(req.query, entityListQuerySchema);
    const result = await req.app.locals.context.entityDao.list(query);
    res.json(result);
  } catch (err) {
    if (err instanceof QueryParseError) {
      next(createError(400, err.message, { expose: true, cause: err.details ?? err }));
      return;
    }
    next(err);
  }
}

export async function getEntity(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const params = entityIdParamSchema.safeParse(req.params);
    if (!params.success) {
      throw createError(400, 'Invalid id', { expose: true, cause: z.flattenError(params.error) });
    }
    const row = await req.app.locals.context.entityDao.findOne({ id: params.data.id });
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
    const body = createEntitySchema.safeParse(req.body);
    if (!body.success) {
      throw createError(400, 'Invalid body', { expose: true, cause: z.flattenError(body.error) });
    }
    const row = await req.app.locals.context.entityDao.create({ attrs: body.data });
    res.status(201).json(row);
  } catch (err) {
    next(err);
  }
}

export async function updateEntity(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const params = entityIdParamSchema.safeParse(req.params);
    if (!params.success) {
      throw createError(400, 'Invalid id', { expose: true, cause: z.flattenError(params.error) });
    }
    const body = updateEntitySchema.safeParse(req.body);
    if (!body.success) {
      throw createError(400, 'Invalid body', { expose: true, cause: z.flattenError(body.error) });
    }
    try {
      const row = await req.app.locals.context.entityDao.update({ id: params.data.id, attrs: body.data });
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
    const params = entityIdParamSchema.safeParse(req.params);
    if (!params.success) {
      throw createError(400, 'Invalid id', { expose: true, cause: z.flattenError(params.error) });
    }
    try {
      await req.app.locals.context.entityDao.delete({ id: params.data.id });
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

## `api/tests/controllers/entity.controller.test.ts`

Runs the real app from `createApp` on a random port, with a fake DAO on the context. This is what the context
singleton buys: no database, no module mocking.

```ts
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app.js';
import type { EntityDao } from '../../src/daos/entity.dao.js';
import type { DbClient } from '../../src/db/client.js';
import { NotFoundError } from '../../src/models/error.model.js';

const ID = '00000000-0000-4000-8000-000000000001';

function fakeDao() {
  return {
    findOne: vi.fn(),
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn()
  };
}

let server: Server;
let baseUrl: string;
let dao: ReturnType<typeof fakeDao>;

beforeEach(async () => {
  dao = fakeDao();
  const app = createApp({ db: {} as DbClient, entityDao: dao as unknown as EntityDao });
  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterEach(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe('GET /entities', () => {
  it('passes the parsed list query to the DAO', async () => {
    // Arrange
    dao.list.mockResolvedValue({ items: [], total: 0, limit: 5, offset: 0 });
    const where = encodeURIComponent(JSON.stringify({ name: { _ilike: '%a%' } }));

    // Act
    const res = await fetch(`${baseUrl}/entities?limit=5&where=${where}`);

    // Assert
    expect(res.status).toBe(200);
    expect(dao.list).toHaveBeenCalledWith(
      expect.objectContaining({ where: { name: { _ilike: '%a%' } }, limit: 5, offset: 0 })
    );
  });

  it('rejects a malformed where with 400 without reaching the DAO', async () => {
    // Act
    const res = await fetch(`${baseUrl}/entities?where=${encodeURIComponent('{"name":{"_gt":1}}')}`);

    // Assert
    expect(res.status).toBe(400);
    expect(dao.list).not.toHaveBeenCalled();
  });
});

describe('POST /entities', () => {
  it('creates from a valid body and returns 201', async () => {
    // Arrange
    dao.create.mockResolvedValue({ id: ID, name: 'first' });

    // Act
    const res = await fetch(`${baseUrl}/entities`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'first' })
    });

    // Assert
    expect(res.status).toBe(201);
    expect(dao.create).toHaveBeenCalledWith({ attrs: { name: 'first' } });
  });

  it('rejects an empty name with 400', async () => {
    // Act
    const res = await fetch(`${baseUrl}/entities`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: '' })
    });

    // Assert
    expect(res.status).toBe(400);
    expect(dao.create).not.toHaveBeenCalled();
  });
});

describe('/entities/:id', () => {
  it('rejects an id that is not a uuid with 400', async () => {
    // Act
    const res = await fetch(`${baseUrl}/entities/not-a-uuid`);

    // Assert
    expect(res.status).toBe(400);
  });

  it('maps NotFoundError from the DAO to 404', async () => {
    // Arrange
    dao.update.mockRejectedValue(new NotFoundError('Entity', ID));

    // Act
    const res = await fetch(`${baseUrl}/entities/${ID}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'renamed' })
    });

    // Assert
    expect(res.status).toBe(404);
  });

  it('returns 204 on delete', async () => {
    // Arrange
    dao.delete.mockResolvedValue(undefined);

    // Act
    const res = await fetch(`${baseUrl}/entities/${ID}`, { method: 'DELETE' });

    // Assert
    expect(res.status).toBe(204);
    expect(dao.delete).toHaveBeenCalledWith({ id: ID });
  });
});
```

## Adding another resource

The entity example is the template. For a second resource (say `user`):

1. `db/schema.ts`: add the `user` drizzle table and its `createUserSchema`, `updateUserSchema`, `userIdParamSchema`,
   `userWhereSchema = whereSchema({...})` and `userListQuerySchema = listQuerySchema({...})`.
2. `daos/user.dao.ts`: copy `entity.dao.ts`, swap the types.
3. `models/app-context.model.ts`: add `userDao: UserDao`.
4. `server.ts`: instantiate `new UserDao(db)` in the context literal.
5. `controllers/user.controller.ts`: copy `entity.controller.ts`, swap the types and paths.
6. `app.ts`: wire the routes.
7. `tests/controllers/user.controller.test.ts`: copy the entity controller test, swap the fake DAO.
8. `pnpm --filter api db:generate --name add-user`, then `db:migrate`.
