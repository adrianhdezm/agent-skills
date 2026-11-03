---
kind: integration
connects: [drizzle, postgres]
---
# Drizzle + Postgres

Drizzle over Postgres: the `node-postgres` client on the shared pool, the `postgresql` dialect for migrations, Postgres
column types in the schema files, and Testcontainers for the data layer's tests. React Router on Node and the Angular
full stack use it.

## The seam

```
createDbClient(DATABASE_URL), once per process ─► pg Pool (error listener) ─► drizzle(pool, { schema }) from drizzle-orm/node-postgres
drizzle.config.ts (dialect: 'postgresql', dbCredentials.url) ─► drizzle-kit generate / migrate
tests: Testcontainers postgres:17-alpine ─► Drizzle migrator ─► DAO suites
```

## Required values

| What                | Value                                                                                                                                                                                                             |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| dependencies        | `pg`                                                                                                                                                                                                              |
| devDependencies     | `@types/pg`, `@testcontainers/postgresql`                                                                                                                                                                         |
| client              | `createDbClient(url)` returning `{ pool, db }`, `DbClient` the `NodePgDatabase` type                                                                                                                              |
| `drizzle.config.ts` | `dialect: 'postgresql'`, `dbCredentials.url` from `DATABASE_URL` (throws when unset), `migrations.schema: 'public'`                                                                                               |
| scripts             | the Drizzle doc's, reading `DATABASE_URL`                                                                                                                                                                         |
| schema              | `pgTable`; `uuid('id').primaryKey().defaultRandom()`; `timestamp(…, { withTimezone: true }).defaultNow()`; `text`                                                                                                 |
| Vitest projects     | `unit` (no database), `db` and `api` (Testcontainers; `hookTimeout: 120_000`, `testTimeout: 30_000` for the first image pull); `test` runs `--project unit`, `test:integration` runs `--project db --project api` |
| `allowBuilds`       | `cpu-features`, `protobufjs`, `ssh2` set to `false`: optional native dependencies of Testcontainers that the local Docker socket never needs                                                                      |

## Reference code

The one pool, its idle-error listener, and the Drizzle client on it; the caller keeps `pool` to close it on shutdown
(`app/db/client.ts` in React Router, with `~/` imports).

`src/db/client.ts`:

```ts
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { logger } from '../logger.js';
import { schema } from './schema.js';

export type DbClient = NodePgDatabase<typeof schema>;

/** The one pool of the process and the Drizzle client on it. An idle client's error is logged, not fatal. */
export function createDbClient(connectionString: string): { pool: Pool; db: DbClient } {
  const pool = new Pool({ connectionString });
  pool.on('error', (error) => {
    logger.error({ err: error }, 'Idle database client error');
  });
  return { pool, db: drizzle(pool, { schema }) };
}
```

The migration entry applies the committed migrations with drizzle-orm's own migrator, a production dependency, so the
image needs no drizzle-kit; the engine's Compose integration runs it before the app.

`src/migrate.ts`:

```ts
import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';

// Applies db/migrations/ and exits: Compose runs it before the API, from the same image.
const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error('DATABASE_URL is not set');
}
const pool = new Pool({ connectionString: url });
try {
  const migrationsFolder = fileURLToPath(new URL('../db/migrations', import.meta.url));
  await migrate(drizzle(pool), { migrationsFolder, migrationsTable: '__migrations__', migrationsSchema: 'public' });
} finally {
  await pool.end();
}
```

The engine-specific files of the Drizzle doc's DAO layer: the translator, the resource schema and DAO, and the
Testcontainers database the DAO suites run on. `entity.schema.ts` and `entity.dao.ts` name a resource: copy them for
each new one.

**`src/helpers/dao.helper.ts`**

```ts
import { and, asc, between, desc, eq, gt, gte, ilike, inArray, lt, lte, ne, not, notIlike, or, type SQL, sql } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import type { PaginatedResult } from '../models/dao.model.js';
import type { FieldFilterInput, FilterField, LogicalFilterInput, SortInput } from '../models/list-input.model.js';

export type FilterTable<FilterInput> = Readonly<Record<FilterField<FilterInput>, AnyPgColumn>>;
export type SortTable<SortField extends string> = Readonly<Record<SortField | 'id', AnyPgColumn>>;

const LOGICAL_KEYS: ReadonlySet<string> = new Set(['and', 'or', 'not'] satisfies (keyof LogicalFilterInput<unknown>)[]);
const MATCHES_NOTHING = sql`false`;

export function filterToSql<Filter extends LogicalFilterInput<Filter>>(filter: Filter, table: FilterTable<Filter>): SQL | undefined {
  return and(
    ...filterFields(filter).map((field) => fieldToSql(table[field], filter[field] as FieldFilterInput | undefined)),
    filter.and && and(...filter.and.map((branch) => filterToSql(branch, table))),
    filter.or && orToSql(filter.or.map((branch) => filterToSql(branch, table))),
    filter.not && notToSql(filterToSql(filter.not, table))
  );
}

export function sortToSql<SortField extends string>(sort: SortInput<SortField>, table: SortTable<SortField>): SQL[] {
  const column = table[sort.field];
  return [sort.direction === 'DESC' ? desc(column) : asc(column), asc(table.id)];
}

export function toPaginatedResult<T>(
  items: readonly T[],
  total: number,
  { page, pageSize }: { page: number; pageSize: number }
): PaginatedResult<T> {
  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&');
}

function filterFields<Filter>(filter: Filter & object): FilterField<Filter>[] {
  return Object.keys(filter).filter((key) => !LOGICAL_KEYS.has(key)) as FilterField<Filter>[];
}

function fieldToSql(column: AnyPgColumn, input: FieldFilterInput | undefined): SQL | undefined {
  return input && and(...comparisonsToSql(column, input), ...textMatchesToSql(column, input));
}

function comparisonsToSql(column: AnyPgColumn, input: FieldFilterInput): (SQL | undefined)[] {
  return [
    input.eq !== undefined ? eq(column, input.eq) : undefined,
    input.ne !== undefined ? ne(column, input.ne) : undefined,
    input.lt !== undefined ? lt(column, input.lt) : undefined,
    input.le !== undefined ? lte(column, input.le) : undefined,
    input.gt !== undefined ? gt(column, input.gt) : undefined,
    input.ge !== undefined ? gte(column, input.ge) : undefined,
    input.between !== undefined ? between(column, input.between[0], input.between[1]) : undefined,
    input.in !== undefined ? inToSql(column, input.in) : undefined
  ];
}

function textMatchesToSql(column: AnyPgColumn, input: FieldFilterInput): (SQL | undefined)[] {
  return [
    input.contains !== undefined ? ilike(column, containsPattern(input.contains)) : undefined,
    input.notContains !== undefined ? notIlike(column, containsPattern(input.notContains)) : undefined,
    input.beginsWith !== undefined ? ilike(column, prefixPattern(input.beginsWith)) : undefined
  ];
}

function inToSql(column: AnyPgColumn, values: readonly unknown[]): SQL {
  return values.length > 0 ? inArray(column, [...values]) : MATCHES_NOTHING;
}

function orToSql(branches: readonly (SQL | undefined)[]): SQL | undefined {
  return branches.includes(undefined) ? undefined : or(...branches);
}

function notToSql(condition: SQL | undefined): SQL {
  return condition ? not(condition) : MATCHES_NOTHING;
}

function containsPattern(value: string): string {
  return `%${escapeLike(value)}%`;
}

function prefixPattern(value: string): string {
  return `${escapeLike(value)}%`;
}
```

**`src/db/schemas/entity.schema.ts`**

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
})
  .pick({ name: true, description: true })
  .strict();

export const updateEntityInputSchema = createUpdateSchema(entity, {
  name: (schema) => schema.min(1).max(200),
  description: (schema) => schema.max(2000).nullish()
})
  .pick({ name: true, description: true })
  .extend({ id: z.uuid('id must be a valid UUID') })
  .strict()
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

**`src/daos/entity.dao.ts`**

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
  private readonly db: DbClient;

  constructor(db: DbClient) {
    this.db = db;
  }

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

**`tests/utils/pg-container.ts`**

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

## Pitfalls

- **Integration tests need Docker** as well as an existing `db/migrations/`.
- **SQL in translator tests renders through `PgDialect`**: the unit tests check the Postgres SQL, so `ilike` and casts
  match what runs.

## Conventions

- **The Drizzle client wraps the one pool**; it is typed `DbClient` and built by the composition root.
- **drizzle-kit runs under `node --env-file`** with the `postgresql` dialect.
- **Each DAO suite gets its own Testcontainers Postgres**, migrated by the Drizzle migrator; the end-to-end suite its
  own database in the Compose service.

## Verify it is wired

- `drizzle.config.ts` throws without `DATABASE_URL`.
- `pnpm test:integration` starts a container per suite and passes from a clean machine with Docker running.
