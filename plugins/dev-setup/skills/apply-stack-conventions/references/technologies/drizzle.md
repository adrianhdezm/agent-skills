# Drizzle

Drizzle ORM with zod: the schema, migrations, and a DAO layer with typed list queries. The engine it talks to, and how
its client is built and tested there, belong to that engine's integration.

**Realises:** [Database](../architecture/database.md), [Data access](../architecture/data-access.md)

## Use it like this

- **Drizzle with `drizzle-zod` and zod 4.** Row inputs come from `createInsertSchema` / `createUpdateSchema` /
  `createSelectSchema`; every type is a `z.infer` of a schema, including the row type
  (`type Entity = z.infer<typeof selectEntitySchema>`), so types and validation cannot drift.
- **The client is the engine's**: the engine's integration says how it is built; `drizzle.config.ts` reads the same
  connection setting and throws when it is unset.
- **Migrations only.** `db:generate` writes a migration from the schema files and `db:migrate` applies it; there is no
  `db:push`. No doc ships a migration file: the scaffold's own `db:generate --name init` creates the first clean
  snapshot from its schema, and it is committed with the scaffold. drizzle-kit does not load `.env`, so its scripts run its bin under
  `node --env-file=../.env node_modules/drizzle-kit/bin.cjs …`.
- **drizzle-kit reads the resource schema files** (`src/db/schemas/*.schema.ts`), because it finds tables from module
  exports; `db/schema.ts` only groups them in the object handed to `drizzle(pool, { schema })`.
- **DAOs are the only code that touches Drizzle.** One class per table, `<Resource>Dao implements Dao<…>`, created once
  in the composition root and put on the app's context. "Dao", not "Repository": a class per table returning rows is
  DAO-shaped, and a repository promises a domain layer that does not exist.
- **The DAOs implement the data access concept's contract**, AppSync-style: the `Dao` interface in `dao.model.ts`, its
  filter, sort and pagination inputs built by `createFilterInputSchema`, `createSortInputSchema` and
  `createListInputSchema` (modelled on AppSync's `Model<Type>FilterInput`). A Hasura-style `where` tree lost its types in
  the translator; flat per-resource filters could not express OR and NOT.
- **Fields are named after columns.** The DAO passes its Drizzle table to `filterToSql` / `sortToSql`, and
  `FilterTable` / `SortTable` make a field without a matching column a compile error: no column maps.
- **One translator for every scalar kind**: the schemas already reject operators a kind does not support.
- **Every resource declares a default sort, and `sortToSql` appends an `id` tie-breaker**: without `ORDER BY`, pages
  repeat or skip rows.
- **`list` runs its page query and then its count, one after the other**: one pool connection per request. Neither form
  is a snapshot; wrap both in a transaction when `total` must match exactly. `count(*) over ()` was rejected because a
  page past the end returns no rows and so no total.
- **Everything resource-specific lives in its schema file**, so the DAO holds no configuration: the table, the input
  schemas, the list pieces, the default sort, then the inferred types.
- **URL decoding is the HTTP layer's job.** The list input schema validates the structured
  `{ filter, sort, page, pageSize }` and knows nothing about query strings, so the DAO takes plain objects from
  anywhere; `normalizeQuery` only keeps the first value of a repeated param and drops empty ones.
- **Tests at three tiers.** The translator is unit-tested through the SQL it renders with `PgDialect`, and the
  builders against an ad-hoc field config, with no database. Each DAO runs against a throwaway database, migrated with
  the Drizzle migrator, one per suite; the engine's integration says how it is started. API tests use the same database
  under the real app.

## Required values

| What                | Value                                                                                                                                                                                                                                                  |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| dependencies        | `drizzle-orm`, `drizzle-zod`, `zod`, and the engine's driver                                                                                                                                                                                           |
| devDependencies     | `drizzle-kit`                                                                                                                                                                                                                                          |
| `drizzle.config.ts` | `out: './db/migrations'`, `schema: './src/db/schemas/*.schema.ts'`, `dialect` and `dbCredentials` from the engine's integration (throwing when the setting is unset), `migrations: { prefix: 'timestamp', table: '__migrations__', schema: 'public' }` |
| scripts             | `db:generate` and `db:migrate`, each `node --env-file=../.env node_modules/drizzle-kit/bin.cjs generate` / `migrate`                                                                                                                                   |
| limits              | the contract's, in `list-input.helper.ts` and the scalar schemas                                                                                                                                                                                       |

The filter operators and their semantics are the contract's; `contains`, `notContains` and `beginsWith` escape LIKE
metacharacters, so user input is matched literally.

## Pitfalls

- **Integration tests need an existing `db/migrations/`**: they run after the first `db:generate`.
- **drizzle-kit does not load `.env`**: run its bin under `node --env-file`.
- **drizzle-zod's object schemas strip unknown keys** rather than rejecting them, so a body with an extra field would
  pass: end every row input schema in `.strict()` (before any `.refine`), as the reference code does.
- **A migration copied from a doc** carries another project's clock and diverges from the schema on the first edit:
  generate it.

## Reference code

These files are the DAO layer; write them as given. Only the last three name a resource: copy them for each new one.

**`src/models/dao.model.ts`**

```ts
export interface PaginatedResult<T> {
  readonly items: readonly T[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
  readonly totalPages: number;
}

export interface IdInput {
  readonly id: string;
}

export interface Dao<T, ListInput, CreateInput, UpdateInput extends IdInput> {
  get(input: IdInput): Promise<T | null>;
  list(input: ListInput): Promise<PaginatedResult<T>>;
  create(input: CreateInput): Promise<T>;
  update(input: UpdateInput): Promise<T>;
  delete(input: IdInput): Promise<void>;
}
```

**`src/models/list-input.model.ts`**

```ts
import { z } from 'zod';

const MAX_IN_VALUES = 100;

function equatable<T extends z.ZodType>(value: T) {
  return {
    eq: value.optional(),
    ne: value.optional()
  };
}

function oneOf<T extends z.ZodType>(value: T) {
  return z.array(value).max(MAX_IN_VALUES).optional();
}

function comparable<T extends z.ZodType>(value: T) {
  return {
    ...equatable(value),
    lt: value.optional(),
    le: value.optional(),
    gt: value.optional(),
    ge: value.optional(),
    between: z.tuple([value, value]).optional(),
    in: oneOf(value)
  };
}

export const idFilterInputSchema = z.strictObject({
  ...equatable(z.uuid()),
  in: oneOf(z.uuid())
});

export const stringFilterInputSchema = z.strictObject({
  ...comparable(z.string()),
  contains: z.string().optional(),
  notContains: z.string().optional(),
  beginsWith: z.string().optional()
});

export const numberFilterInputSchema = z.strictObject(comparable(z.number()));

export const dateFilterInputSchema = z.strictObject(comparable(z.coerce.date()));

export const booleanFilterInputSchema = z.strictObject(equatable(z.boolean()));

export type ScalarFilterInputSchema =
  | typeof idFilterInputSchema
  | typeof stringFilterInputSchema
  | typeof numberFilterInputSchema
  | typeof dateFilterInputSchema
  | typeof booleanFilterInputSchema;

export const sortDirectionSchema = z.enum(['ASC', 'DESC']);

export type IdFilterInput = z.infer<typeof idFilterInputSchema>;
export type StringFilterInput = z.infer<typeof stringFilterInputSchema>;
export type NumberFilterInput = z.infer<typeof numberFilterInputSchema>;
export type DateFilterInput = z.infer<typeof dateFilterInputSchema>;
export type BooleanFilterInput = z.infer<typeof booleanFilterInputSchema>;
export type ScalarFilterInput = IdFilterInput | StringFilterInput | NumberFilterInput | DateFilterInput | BooleanFilterInput;
export type SortDirection = z.infer<typeof sortDirectionSchema>;

export interface SortInput<SortField extends string> {
  readonly field: SortField;
  readonly direction: SortDirection;
}

export interface LogicalFilterInput<Filter> {
  and?: Filter[];
  or?: Filter[];
  not?: Filter;
}

export type FilterField<Filter> = {
  [K in keyof Filter]-?: NonNullable<Filter[K]> extends ScalarFilterInput ? K : never;
}[keyof Filter];

type KeysOfUnion<U> = U extends unknown ? keyof U : never;
type ValueOfUnion<U, K extends PropertyKey> = U extends unknown ? (K extends keyof U ? U[K] : never) : never;

export type FieldFilterInput = { [K in KeysOfUnion<ScalarFilterInput>]?: ValueOfUnion<ScalarFilterInput, K> };
```

**`src/helpers/list-input.helper.ts`**

```ts
import { z } from 'zod';
import { type ScalarFilterInputSchema, sortDirectionSchema } from '../models/list-input.model.js';

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
const MAX_LOGICAL_BRANCHES = 20;

export function createFilterInputSchema<Fields extends Record<string, ScalarFilterInputSchema>>(fields: Fields) {
  const schema = z.strictObject({
    ...z.object(fields).partial().shape,
    get and() {
      return z.array(schema).max(MAX_LOGICAL_BRANCHES).optional();
    },
    get or() {
      return z.array(schema).max(MAX_LOGICAL_BRANCHES).optional();
    },
    get not() {
      return schema.optional();
    }
  });
  return schema;
}

export function createSortInputSchema<const SortFields extends readonly [string, ...string[]]>(sortFields: SortFields) {
  return z.strictObject({
    field: z.enum(sortFields),
    direction: sortDirectionSchema
  });
}

export function createListInputSchema<Filter extends z.ZodType, Sort extends z.ZodType>(opts: { filter: Filter; sort: Sort }) {
  return z.strictObject({
    filter: opts.filter.optional(),
    sort: opts.sort.optional(),
    page: z.number().int().min(1).default(1),
    pageSize: z.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE)
  });
}
```

**`src/models/error.model.ts`**

```ts
/**
 * Thrown by DAOs when a required row is missing. HTTP controllers map this
 * to a 404 — DAOs stay transport-agnostic.
 */
export class NotFoundError extends Error {
  readonly resource: string;
  readonly id: string;

  constructor(resource: string, id: string) {
    super(`${resource} not found: ${id}`);
    this.name = 'NotFoundError';
    this.resource = resource;
    this.id = id;
  }
}
```

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

**`src/helpers/query-parser.helper.ts`**

```ts
/**
 * URL query values arrive as `string | string[] | undefined`. Keep the first
 * value of a repeated param and drop empty ones, so schemas only see plain
 * strings.
 */
export function normalizeQuery(params: unknown): Record<string, unknown> {
  if (typeof params !== 'object' || params === null) {
    return {};
  }
  const normalized: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(params)) {
    const value: unknown = Array.isArray(raw) ? raw[0] : raw;
    if (value !== undefined && value !== '') {
      normalized[key] = value;
    }
  }
  return normalized;
}
```

The resource schema file has no comments, and keeps this order: the table; the schemas (select, id, create,
update, filter, sort, list); the default sort; then the inferred types in the same order.

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

**`src/db/schema.ts`**

```ts
import { entity } from './schemas/entity.schema.js';

/**
 * Every drizzle table, passed to `drizzle(pool, { schema })`. Each table is
 * defined with its zod inputs in `schemas/<resource>.schema.ts`; register new
 * tables here.
 */
export const schema = { entity };
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

## Conventions

### The DAO layer

| Layer        | File                              | Holds                                                                                       |
| ------------ | --------------------------------- | ------------------------------------------------------------------------------------------- |
| contract     | `models/dao.model.ts`             | `Dao<T, ListInput, CreateInput, UpdateInput>`, `PaginatedResult`, `IdInput`; no zod, no ORM |
| vocabulary   | `models/list-input.model.ts`      | the scalar filter inputs, `sortDirectionSchema`, the derived types                          |
| builders     | `helpers/list-input.helper.ts`    | `createFilterInputSchema`, `createSortInputSchema`, `createListInputSchema`, page limits    |
| translation  | `helpers/dao.helper.ts`           | `filterToSql`, `sortToSql`, `toPaginatedResult`, `escapeLike`                               |
| HTTP parsing | `helpers/query-parser.helper.ts`  | `normalizeQuery`                                                                            |
| resource     | `db/schemas/<resource>.schema.ts` | the table, every input schema and type of one resource, its default sort                    |
| registry     | `db/schema.ts`                    | `export const schema = { entity, … }`                                                       |
| DAO          | `daos/<resource>.dao.ts`          | one class `implements Dao<…>`; queries only                                                 |

- **DAOs are the only code that touches the ORM**; they read no request, throw no HTTP errors, and hold no
  configuration of their own. A missing row on update or delete is a `NotFoundError`.
- **Every DAO `implements Dao<…>`** from `dao.model.ts`, the data access contract.
- **Resource schema files carry no comments and follow one order**: the table; the schemas (`select<Resource>Schema`,
  `<resource>IdInputSchema`, `create…`, `update…`, `<resource>FilterInputSchema`, `<resource>SortInputSchema`,
  `list<Resource>InputSchema`); `<resource>DefaultSort`; then the inferred types in the same order.
- **Naming**: inputs are `<Operation><Resource>Input` with schemas `<operation><Resource>InputSchema`; per-resource list
  pieces are `<resource><Kind>`; builders are `create<Thing>Schema`; the class is `<Resource>Dao`.

### List queries

- **Filter, sort and pagination follow the data access contract**, built per resource from the list-input builders;
  schemas are strict, so an unknown field or operator is rejected.
- **Fields are named after the table's columns**; the compiler rejects a field with no column.
- **`sortToSql` appends the `id` tie-breaker**; each resource's schema file declares its default sort.
- **Extending**: a filterable column is one line in the resource's filter schema, a sortable one one entry in its sort
  allowlist; a new operator is one line in its scalar schema plus one branch in `dao.helper.ts`.

### Migrations

- **`db:generate --name <name>` writes a migration** from the schema files and `db:migrate` applies it; there is no
  `db:push`.
- **A new table** is a new `db/schemas/<resource>.schema.ts`, registered in `db/schema.ts`.

### Testing data access

- **The translator and builders are unit tests**, with no database: SQL checked through what `PgDialect` renders, the
  builders against an ad-hoc field config, a resource's schema test covering only its own columns and sort fields.
- **Each DAO has a suite against the real database** (`tests/db/<resource>.dao.test.ts`): one database per suite, rows cleared
  before each test and seeded through `tests/utils/<resource>-seed.ts`; every method's happy path and edge cases, and
  `list` for what only real rows show (pagination, sort with the tie-breaker, filters whose result depends on the engine,
  `and` / `or` / `not`, LIKE metacharacters and hostile input treated as data).
- **A new operator** gets a translator case and a builder rejection case; a DAO case only when its result depends on
  the engine.
