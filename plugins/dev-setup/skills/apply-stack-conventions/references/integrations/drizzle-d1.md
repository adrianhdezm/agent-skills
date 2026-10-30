# Drizzle + Cloudflare D1

Drizzle over D1: a client per request from the binding, the `sqlite` dialect for migrations, SQLite column types in the
schema files, `db.batch()` for atomic work, and tests inside workerd against a local D1. React Router on Workers uses it
once it adds a database.

## The seam

```
request handler ─► drizzle(c.env.APP_DB, { schema }) from drizzle-orm/d1 ─► DAOs, queries, services
drizzle.config.ts (dialect: 'sqlite') ─► drizzle-kit generate ─► db/migrations/ ─► wrangler d1 migrations apply
tests: readMigrationFiles() at config time ─► a binding ─► applied in workerd's local D1 by the setup file
```

## Required values

| What                | Value                                                                                                                                                                           |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| client              | `drizzle(c.env.APP_DB, { schema })` from `drizzle-orm/d1`, built inside the request handler                                                                                     |
| `drizzle.config.ts` | `dialect: 'sqlite'`, the remote driver reading the `CLOUDFLARE_*` settings                                                                                                      |
| scripts             | `db:generate` and `db:migrate` (remote), each drizzle-kit's bin under `node --env-file=.env --import=tsx`                                                                       |
| schema              | `sqliteTable`; ids `text('id').primaryKey().$defaultFn(() => crypto.randomUUID())`; times `integer(…, { mode: 'timestamp_ms' })` defaulting to the current time in milliseconds |
| tests               | the Cloudflare Vitest plugin with `d1Databases: ['APP_DB']`; the migrations read with `readMigrationFiles()` and passed as a JSON binding, applied by the setup file            |

## Reference code

The data layer is [Drizzle](../technologies/drizzle.md)'s reference code with these changes:

| In Drizzle's reference code                         | On D1                                                                                    |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `drizzle-orm/pg-core`, `pgTable`, `AnyPgColumn`     | `drizzle-orm/sqlite-core`, `sqliteTable`, `AnySQLiteColumn`                              |
| `uuid('id').primaryKey().defaultRandom()`           | `text('id').primaryKey().$defaultFn(() => crypto.randomUUID())`                          |
| `timestamp(…, { withTimezone: true }).defaultNow()` | `integer(…, { mode: 'timestamp_ms' }).$defaultFn(() => new Date())`                      |
| `ilike` / `notIlike`                                | `likeEscaped` / `not(likeEscaped(…))` below: SQLite's `LIKE` already ignores ASCII case  |
| refine callbacks, `(schema) => schema.min(1)`       | plain schemas, `z.string().min(1)`: drizzle-zod types a SQLite `text` callback as Buffer |
| a list's items, then its count, as two queries      | one `db.batch([items, count])`                                                           |
| `DbClient` from the pool client; Testcontainers     | `DrizzleD1Database<typeof schema>`; the workerd setup file below                         |
| `src/…` paths, `.js` imports                        | the stack's folders (`app/db/…` with `~/` in React Router), no extension                 |

`app/db/client.ts`:

```ts
import type { DrizzleD1Database } from 'drizzle-orm/d1';

import type { schema } from './schema';

export type DbClient = DrizzleD1Database<typeof schema>;
```

The entity table:

```ts
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { createInsertSchema, createSelectSchema, createUpdateSchema } from 'drizzle-zod';
import { z } from 'zod';

import { createFilterInputSchema, createListInputSchema, createSortInputSchema } from '../helpers/list-input.helper';
import { dateFilterInputSchema, idFilterInputSchema, stringFilterInputSchema } from '../models/list-input.model';

export const entity = sqliteTable('entity', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  description: text('description'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date())
});
```

Its input schemas:

```ts
export const createEntityInputSchema = createInsertSchema(entity, {
  name: z.string().min(1, 'name is required').max(200),
  description: z.string().max(2000).nullish()
})
  .pick({ name: true, description: true })
  .strict();

export const updateEntityInputSchema = createUpdateSchema(entity, {
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullish()
})
  .pick({ name: true, description: true })
  .extend({ id: z.uuid('id must be a valid UUID') })
  .strict()
  .refine((input) => Object.keys(input).some((key) => key !== 'id'), { message: 'at least one field is required' });
```

The text filters in `dao.helper.ts`:

```ts
function textMatchesToSql(column: AnySQLiteColumn, input: FieldFilterInput): (SQL | undefined)[] {
  return [
    input.contains !== undefined ? likeEscaped(column, containsPattern(input.contains)) : undefined,
    input.notContains !== undefined ? not(likeEscaped(column, containsPattern(input.notContains))) : undefined,
    input.beginsWith !== undefined ? likeEscaped(column, prefixPattern(input.beginsWith)) : undefined
  ];
}

/** SQLite's LIKE has no default escape character, so the backslashes escapeLike adds must be named. */
function likeEscaped(column: AnySQLiteColumn, pattern: string): SQL {
  return sql`${column} like ${pattern} escape '\\'`;
}
```

The DAO's `list`:

```ts
  async list({ filter, sort = entityDefaultSort, page, pageSize }: ListEntityInput): Promise<PaginatedResult<Entity>> {
    const where = filter && filterToSql(filter, entity);
    const orderBy = sortToSql(sort, entity);

    // One round trip, read from one snapshot: D1 has no transactions, so the page and its count go in one batch.
    const [items, [counted]] = await this.db.batch([
      this.db
        .select()
        .from(entity)
        .where(where)
        .orderBy(...orderBy)
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      this.db.select({ total: count() }).from(entity).where(where)
    ]);
    return toPaginatedResult(items, counted?.total ?? 0, { page, pageSize });
  }
```

`tests/integration/setup-tests.ts`, applying the migrations the Vitest config read with `readMigrationFiles()` and
passed as the `TEST_MIGRATIONS` binding:

```ts
import { env } from 'cloudflare:workers';
import { beforeAll } from 'vitest';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- the global Cloudflare.Env can only be extended through its namespace
  namespace Cloudflare {
    interface Env {
      TEST_MIGRATIONS: { sql: string[] }[];
    }
  }
}

beforeAll(async () => {
  const statements = env.TEST_MIGRATIONS.flatMap((migration) => migration.sql).map((sql) => env.APP_DB.prepare(sql));
  await env.APP_DB.batch(statements);
});
```

## Pitfalls

- **`db.transaction()` throws on D1**: use `db.batch([...])`, which is atomic.
- **`Promise.all` over queries** gains nothing and can interleave: `await` them in sequence.
- **workerd cannot read the project's files**: migrations reach the tests as a binding, read at config time.
- **SQLite's `LIKE` has no default escape character**: the backslashes `escapeLike` adds are matched literally unless
  the query says `escape '\'`, so a `contains: '50%'` filter finds nothing. Use `likeEscaped`.
- **drizzle-zod types a refine callback on a SQLite `text` column as `ZodType<Buffer>`** (no `min`, no `max`): refine
  with a plain `z.string()…` schema instead.
- **`wrangler d1 create` needs a Cloudflare account**: offline, write the `d1_databases` binding by hand with a
  placeholder `database_id`; local development and the tests use the local D1, and the real id replaces it before the
  first deploy.

## Conventions

- **The Drizzle client is built per request** from `c.env.APP_DB`.
- **Atomic work, and a list's items plus count, is one `db.batch()`**; never `db.transaction()`.
- **Data access tests run in workerd** against a local D1 migrated by the project's migrations.

## Verify it is wired

- No `db.transaction(` and no `Promise.all` over queries in the data layer.
- The integration tests apply `db/migrations/` before the first test.
