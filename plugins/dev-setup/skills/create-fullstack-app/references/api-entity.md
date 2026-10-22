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
- [`api/tests/controllers/entity.controller.test.ts`](#apitestscontrollersentitycontrollertestts)
- [`api/tests/db/schemas/entity.schema.test.ts`](#apitestsdbschemasentityschematestts)
- [Adding another resource](#adding-another-resource)

## `api/src/db/schemas/entity.schema.ts`

Everything resource-specific lives here, so the DAO holds no configuration of its own:

- the drizzle table, and the row type `Entity = z.infer<typeof selectEntitySchema>`, inferred from drizzle-zod's
  select schema like every other type in the file;
- `CreateEntityInput` / `UpdateEntityInput` from drizzle-zod. The update input carries the `id`, and the controller
  merges the path id into the body before validating;
- the list pieces: `entityFilterInputSchema` and `entitySortInputSchema` from the builders, `ListEntityInput`,
  `listEntityInputSchema` (the structured `ListEntityInput`, with no URL decoding), and `entityDefaultSort`.

Filter and sort fields carry the column names, which is what lets the DAO pass `entity` as the column source. The file
has no comments: every resource schema is declarations only, so keep it that way when copying it.

```ts
import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema, createUpdateSchema } from 'drizzle-zod';
import { z } from 'zod';
import {
  createFilterInputSchema,
  createListInputSchema,
  createSortInputSchema,
  dateFilterInputSchema,
  idFilterInputSchema,
  stringFilterInputSchema
} from '../../models/list-input.model.js';

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

The DAO is the only code that touches Drizzle, and it needs a live database, so it has no unit test. Its SQL building is
covered by the `dao.helper` tests, and its wiring by the smoke test in the SKILL.md Review Checklist.

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
    get: vi.fn(),
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn()
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
  it('passes the parsed list input to the DAO', async () => {
    // Arrange
    dao.list.mockResolvedValue({ items: [], total: 0, page: 2, pageSize: 5, totalPages: 0 });
    const filter = encodeURIComponent(JSON.stringify({ name: { contains: 'a' } }));

    // Act
    const res = await fetch(`${baseUrl}/entities?filter=${filter}&sortField=name&sortDirection=DESC&page=2&pageSize=5`);

    // Assert
    expect(res.status).toBe(200);
    expect(dao.list).toHaveBeenCalledWith({
      filter: { name: { contains: 'a' } },
      sort: { field: 'name', direction: 'DESC' },
      page: 2,
      pageSize: 5
    });
  });

  it('decodes the URL params: numbers, and ASC when only a sort field is given', async () => {
    // Arrange
    dao.list.mockResolvedValue({ items: [], total: 0, page: 3, pageSize: 10, totalPages: 0 });

    // Act
    const res = await fetch(`${baseUrl}/entities?sortField=createdAt&page=3&pageSize=10`);

    // Assert
    expect(res.status).toBe(200);
    expect(dao.list).toHaveBeenCalledWith({ sort: { field: 'createdAt', direction: 'ASC' }, page: 3, pageSize: 10 });
  });

  it.each([
    ['a filter that is not JSON', 'filter=%7B'],
    ['an unknown param', 'nme=a'],
    ['a page that is not a number', 'page=abc'],
    ['a sort field outside the allowlist', 'sortField=description']
  ])('rejects %s with 400 without reaching the DAO', async (_label, query) => {
    // Act
    const res = await fetch(`${baseUrl}/entities?${query}`);

    // Assert
    expect(res.status).toBe(400);
    expect(dao.list).not.toHaveBeenCalled();
  });

  it('rejects a malformed filter with 400 without reaching the DAO', async () => {
    // Act
    const res = await fetch(`${baseUrl}/entities?filter=${encodeURIComponent('{"name":{"gt":1}}')}`);

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
    expect(dao.create).toHaveBeenCalledWith({ name: 'first' });
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
    expect(dao.update).toHaveBeenCalledWith({ id: ID, name: 'renamed' });
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

## `api/tests/db/schemas/entity.schema.test.ts`

Tests the list input schema on the structured input the DAO receives: the page defaults, a nested filter, and every
rejection the strict schemas promise. No URL strings appear here; the controller test covers decoding.

```ts
import { describe, expect, it } from 'vitest';
import { listEntityInputSchema } from '../../../src/db/schemas/entity.schema.js';

describe('listEntityInputSchema', () => {
  it('applies the page defaults', () => {
    // Act
    const input = listEntityInputSchema.parse({});

    // Assert
    expect(input).toEqual({ page: 1, pageSize: 20 });
  });

  it('accepts a nested filter with sort and pagination', () => {
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
    ['an unknown filter field', { filter: { title: { eq: 'a' } } }],
    ['an unknown operator', { filter: { name: { startsWith: 'a' } } }],
    ['a wrongly typed operand', { filter: { name: { eq: 1 } } }],
    ['an invalid id', { filter: { id: { eq: 'nope' } } }],
    ['a between that is not a pair', { filter: { name: { between: ['a'] } } }],
    ['an in list of the wrong type', { filter: { name: { in: [1] } } }],
    ['an in list over 100 values', { filter: { name: { in: Array.from({ length: 101 }, String) } } }],
    ['an invalid nested filter', { filter: { and: [{ not: { name: { gt: true } } }] } }],
    ['an unknown key', { nope: 'a' }],
    ['a sort field outside the allowlist', { sort: { field: 'description', direction: 'ASC' } }],
    ['a lowercase sort direction', { sort: { field: 'name', direction: 'desc' } }],
    ['an out-of-range pageSize', { pageSize: 500 }],
    ['a zero page', { page: 0 }],
    ['a fractional pageSize', { pageSize: 1.5 }],
    ['a page that is not a number', { page: Number('abc') }]
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
   createSortInputSchema([...])`, `ListUserInput`, `listUserInputSchema` and `userDefaultSort`.
2. `db/schema.ts`: register the table, `export const schema = { entity, user }`.
3. `daos/user.dao.ts`: copy `entity.dao.ts`, swap the table and types:
   `implements Dao<User, ListUserInput, CreateUserInput, UpdateUserInput>`.
4. `models/app-context.model.ts`: add `userDao: UserDao`.
5. `server.ts`: instantiate `new UserDao(db)` in the context literal.
6. `controllers/user.controller.ts`: copy `entity.controller.ts`, swap the schemas and the DAO.
7. `app.ts`: wire the routes.
8. `tests/controllers/user.controller.test.ts` and `tests/db/schemas/user.schema.test.ts`: copy the entity tests,
   swap the fake DAO and the schema.
9. Web: mirror `User`, `UserFilterInput`, `UserSortInput` and `ListUserInput` in `models/user.model.ts`, then add the
   page slices `store/user-list-page/`, `store/user-detail-page/` and `store/user-form-page/` and register each on its
   route (see [web.md](web.md#9-shared-model-and-page-slices)).
10. `pnpm --filter api db:generate --name add-user`, then `db:migrate`.

Adding a filterable column to an existing resource is one line in its filter input schema; adding a sortable one is
one entry in its `createSortInputSchema([...])` call. The compiler rejects either if the column does not exist.
