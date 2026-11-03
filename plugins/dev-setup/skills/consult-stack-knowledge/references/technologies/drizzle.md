---
kind: technology
role: library
realises: [database, data-access]
detect:
  dependencies: [drizzle-orm]
  files: [drizzle.config.ts]
aliases: [Drizzle, drizzle]
---
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
  `node --env-file=<root .env> node_modules/drizzle-kit/bin.cjs …`, where `<root .env>` is `.env` in a single package
  and `../.env` in a workspace package.
- **drizzle-kit reads the resource schema files** (`src/db/schemas/*.schema.ts`), because it finds tables from module
  exports; `db/schema.ts` only groups them in the object handed to the engine's `drizzle(…, { schema })` call.
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
- **`list` runs its page query and then its count.** Whether the two read one snapshot (a transaction, or the engine's
  batch) is the engine's integration's. `count(*) over ()` was rejected because a page past the end returns no rows and
  so no total.
- **Everything resource-specific lives in its schema file**, so the DAO holds no configuration: the table, the input
  schemas, the list pieces, the default sort, then the inferred types.
- **URL decoding is the HTTP layer's job.** The list input schema validates the structured
  `{ filter, sort, page, pageSize }` and knows nothing about query strings, so the DAO takes plain objects from
  anywhere; `normalizeQuery` only keeps the first value of a repeated param and drops empty ones.
- **Tests at three tiers.** The translator is unit-tested through the SQL the engine's dialect renders, and the
  builders against an ad-hoc field config, with no database. Each DAO runs against a throwaway database, migrated with
  the Drizzle migrator, one per suite; the engine's integration says how it is started. API tests use the same database
  under the real app.

## Required values

| What                | Value                                                                                                                                                                                                                                                                    |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| dependencies        | `drizzle-orm`, `drizzle-zod`, `zod`, and the engine's driver                                                                                                                                                                                                             |
| devDependencies     | `drizzle-kit`                                                                                                                                                                                                                                                            |
| `drizzle.config.ts` | `out: './db/migrations'`, `schema: './<src>/db/schemas/*.schema.ts'` (`<src>` the app's source folder), `dialect` and `dbCredentials` from the engine's integration (throwing when the setting is unset), `migrations: { prefix: 'timestamp', table: '__migrations__' }` |
| scripts             | `db:generate` and `db:migrate`, each `node --env-file=<root .env> node_modules/drizzle-kit/bin.cjs generate` / `migrate`                                                                                                                                                 |
| limits              | the contract's, in `list-input.helper.ts` and the scalar schemas                                                                                                                                                                                                         |

The filter operators and their semantics are the contract's; `contains`, `notContains` and `beginsWith` escape LIKE
metacharacters, so user input is matched literally.

## Pitfalls

- **Integration tests need an existing `db/migrations/`**: they run after the first `db:generate`.
- **drizzle-zod's object schemas strip unknown keys** rather than rejecting them, so a body with an extra field would
  pass: end every row input schema in `.strict()` (before any `.refine`), as the reference code does.

## Reference code

These files are the DAO layer; write them as given. `entity.schema.ts` and `entity.dao.ts`, in the engine's
integration's reference code, name a resource: copy them for each new one and register the table in `schema.ts`.

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

**`src/db/schema.ts`**

```ts
import { entity } from './schemas/entity.schema.js';

/**
 * Every drizzle table, passed to the engine's `drizzle(…, { schema })` call.
 * Each table is defined with its zod inputs in `schemas/<resource>.schema.ts`;
 * register new tables here.
 */
export const schema = { entity };
```

## Conventions

### The DAO layer

| Layer        | File                              | Holds                                                                                           |
| ------------ | --------------------------------- | ----------------------------------------------------------------------------------------------- |
| contract     | `models/dao.model.ts`             | `Dao<T, ListInput, CreateInput, UpdateInput>`, `PaginatedResult`, `IdInput`; no zod, no ORM     |
| vocabulary   | `models/list-input.model.ts`      | the scalar filter inputs, `sortDirectionSchema`, the derived types                              |
| builders     | `helpers/list-input.helper.ts`    | `createFilterInputSchema`, `createSortInputSchema`, `createListInputSchema`, page limits        |
| translation  | `helpers/dao.helper.ts`           | `filterToSql`, `sortToSql`, `toPaginatedResult`, `escapeLike` (the engine's integration's code) |
| HTTP parsing | `helpers/query-parser.helper.ts`  | `normalizeQuery`                                                                                |
| resource     | `db/schemas/<resource>.schema.ts` | the table, every input schema and type of one resource, its default sort                        |
| registry     | `db/schema.ts`                    | `export const schema = { entity, … }`                                                           |
| DAO          | `daos/<resource>.dao.ts`          | one class `implements Dao<…>`; queries only                                                     |

- **The contract is `Dao<…>` in `dao.model.ts`**; row-input schemas end in `.strict()`; `sortToSql` is the one place the
  tie-breaker is added.
- **Resource schema files carry no comments and follow one order**: the table; the schemas (`select<Resource>Schema`,
  `<resource>IdInputSchema`, `create…`, `update…`, `<resource>FilterInputSchema`, `<resource>SortInputSchema`,
  `list<Resource>InputSchema`); `<resource>DefaultSort`; then the inferred types in the same order.
- **Naming**: inputs are `<Operation><Resource>Input` with schemas `<operation><Resource>InputSchema`; per-resource list
  pieces are `<resource><Kind>`; builders are `create<Thing>Schema`; the class is `<Resource>Dao`.

### List queries

- **Fields are named after the table's columns**; the compiler rejects a field with no column.
- **Extending**: a filterable column is one line in the resource's filter schema, a sortable one one entry in its sort
  allowlist; a new operator is one line in its scalar schema plus one branch in `dao.helper.ts`.

### Migrations

- **`db:generate --name <name>` writes a migration** from the schema files and `db:migrate` applies it; there is no
  `db:push`.
- **A new table** is a new `db/schemas/<resource>.schema.ts`, registered in `db/schema.ts`.

### Testing data access

- **The translator and builders are unit tests**, with no database: the translator through the SQL the engine's
  dialect renders, the builders against an ad-hoc field config, a resource's schema test covering only its own columns
  and sort fields.
- **Three renders the translator's tests meet**: `PgDialect.sqlToQuery` returns `{ sql, params, typings }`, each nested
  `and` / `or` is parenthesised on its own, and an empty `not` renders as `false`.
- **Each DAO has a suite against the real database**, in the stack's integration-test folder: one database per suite,
  rows cleared before each test and seeded through a `<resource>-seed` helper; every method's happy path and edge
  cases, and `list` for what only real rows show (pagination, sort with the tie-breaker, filters whose result depends on
  the engine, `and` / `or` / `not`, LIKE metacharacters and hostile input treated as data).
- **A new operator** gets a translator case and a builder rejection case; a DAO case only when its result depends on
  the engine.
