# React Router + Drizzle

How a React Router app layers data access once it has a database: D1 on Workers or Postgres on Node, both through
Drizzle with `drizzle-zod`, reached from loaders and actions through the app's context. The React Router stacks arrive
without database code; these rules apply from the first table. The Angular full stack's API layers its data
differently (the Express + Drizzle integration).

**Realises:** [Data access](../architecture/data-access.md)

## The seam

```
Routes (loaders, actions) ─► Services ─► Queries ─► DAOs ─► Database
          ▲
context.get(appContext).db   (built per request on Workers, once on Node, by the server entry)
```

- **The Drizzle client reaches routes through `appContext`**, built by the server entry: per request from the D1
  binding on Workers, once at module scope from `DATABASE_URL` on Node.
- **Routes call services, queries and DAOs**, never Drizzle directly.

## Where it lives

| File                                       | Holds                                                                                                          |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| `app/db/schema.ts`                         | the tables, both sides of every `relations()`, the exported `schema`                                           |
| `app/db/data-access.ts`                    | the contract: `Dao`, `RelationQuery`, `PaginatedResult`, `IdInput`, and the list-input builders and translator |
| `app/db/schemas/<entity>.schema.ts`        | the entity's table, input schemas, filter, sort and list input, default sort, inferred types                   |
| `app/db/daos/<entity>.dao.ts`              | one DAO per table, implementing the contract                                                                   |
| `app/db/queries/<parent>-<child>.query.ts` | one read-only query per cross-table read                                                                       |
| `app/services/`                            | one service per business workflow                                                                              |
| `app/context.ts`                           | the database client's type on `appContext`                                                                     |
| `tests/integration/`                       | DAOs, queries and services against a real database                                                             |

## Reference code

Drizzle's reference code applies here, laid out for React Router:

| In Drizzle's reference code                                                 | In a React Router app                                                           |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `src/models/dao.model.ts`, `list-input.model.ts`, `error.model.ts`          | one `app/db/data-access.ts`, the contract in one file                           |
| `src/helpers/list-input.helper.ts`, `dao.helper.ts`                         | the same `app/db/data-access.ts`, below the contract                            |
| `src/helpers/query-parser.helper.ts`                                        | `app/db/data-access.ts` as well, once a loader decodes list params from the URL |
| `src/db/schemas/<entity>.schema.ts`, `src/db/schema.ts`, `src/db/client.ts` | `app/db/schemas/…`, `app/db/schema.ts`, `app/db/client.ts`                      |
| `src/daos/<entity>.dao.ts`                                                  | `app/db/daos/<entity>.dao.ts`                                                   |
| relative imports with `.js`                                                 | `~/db/…` imports with no extension                                              |
| `drizzle.config.ts` `schema: './src/db/schemas/*.schema.ts'`                | `schema: './app/db/schemas/*.schema.ts'`                                        |

A React Router app on Node has no logger doc, so its `app/db/client.ts` is Drizzle + Postgres's with `console.error` in
place of the logger. Its integration tests are one Vitest project, `integration`, over `tests/integration/`
(`test:integration` `vitest run --project integration`), beside the `unit` project.

`app/db/client.ts` on Postgres:

```ts
import { type NodePgDatabase, drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import { schema } from './schema';

export type DbClient = NodePgDatabase<typeof schema>;

/** The one pool of the process and the Drizzle client on it. An idle client's error is logged, not fatal. */
export function createDbClient(connectionString: string): { pool: Pool; db: DbClient } {
  const pool = new Pool({ connectionString });
  pool.on('error', (error) => {
    console.error('Idle database client error', error);
  });
  return { pool, db: drizzle(pool, { schema }) };
}
```

`app/db/data-access.ts` on Postgres, the contract, the list-input builders and the translator merged into one file:

```ts
import { type SQL, and, asc, between, desc, eq, gt, gte, ilike, inArray, lt, lte, ne, not, notIlike, or, sql } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { z } from 'zod';

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

## Conventions

D1 on Workers or Postgres on Node, both through Drizzle with `drizzle-zod`: `Routes → Services → Queries → DAOs →
Database`.

- **A DAO per table** in `app/db/daos/<entity>.dao.ts`, constructed with the Drizzle client, implementing the data
  access contract (`get`, `list`, `create`, `update`, `delete`) as the Drizzle doc's reference code does; every filtered
  read goes through `list` with the typed filter, never a custom `findBySlug`. Its entity's table, schemas and inferred
  types live in `app/db/schemas/<entity>.schema.ts`, in the Drizzle doc's order. It imports no other DAO, query or
  service, and holds no business logic.
- **A query per cross-table read** in `app/db/queries/<parent>-<child>.query.ts`: read-only, Drizzle's relational API
  (`db.query.*` with `with`), offering the contract's `get` and `list` and returning a `<Parent>With<Child>` type; no
  query-builder joins.
- **A service per business workflow** in `app/services/`: anything that writes more than one table, needs atomic
  writes, or composes DAOs and queries. Services import no tables and build no queries, except `FilesService`, which
  the file storage concept makes the one owner of the `files` table and the object store.
- **The contract and its builders live in `app/db/data-access.ts`**: `Dao`, `RelationQuery`, `PaginatedResult`,
  `IdInput`, the list-input builders and the translator; `app/db/schema.ts` registers every table, both sides of every
  `relations()`, and exports `schema`.
- **Concurrency and atomic writes follow the engine's doc**: Cloudflare D1 runs queries in
  sequence and batches atomic work; Postgres runs independent queries together and uses transactions.
- **Integration tests seed through DAOs**, not raw SQL, in workerd with D1 or in Node with the Compose Postgres; their
  helpers live in `tests/integration/db-test-utils.ts`, and the file that registers hooks is a separate
  `setup-tests.ts`. Drizzle itself is not tested.

## Verify it is wired

- No route module imports from `drizzle-orm` or a table: routes reach data through services, queries or DAOs.
- Each DAO file imports no other DAO, query or service; each query file only reads.
- Multi-table writes are atomic the way the engine's doc says.
