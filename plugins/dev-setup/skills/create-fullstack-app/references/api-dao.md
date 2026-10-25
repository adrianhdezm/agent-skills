# API DAO layer

The DAO layer is the core of the API: how a resource is read and written, and how a list request becomes SQL. This file
covers the resource-agnostic pieces every DAO uses; [api-entity.md](api-entity.md) shows them applied to the `entity`
example. The design follows an AppSync-style schema: one contract with `get` / `list` / `create` / `update` / `delete`,
typed `<Type>FilterInput`s per column kind, and named `<Operation><Resource>Input` types.

## Contents

- [How the layers fit](#how-the-layers-fit)
- [`api/src/models/dao.model.ts`](#apisrcmodelsdaomodelts)
- [`api/src/models/list-input.model.ts`](#apisrcmodelslist-inputmodelts)
- [`api/src/helpers/list-input.helper.ts`](#apisrchelperslist-inputhelperts)
- [`api/src/models/error.model.ts`](#apisrcmodelserrormodelts)
- [`api/src/helpers/dao.helper.ts`](#apisrchelpersdaohelperts)
- [`api/src/helpers/query-parser.helper.ts`](#apisrchelpersquery-parserhelperts)
- [`api/tests/unit/helpers/dao.helper.test.ts`](#apitestsunithelpersdaohelpertestts)
- [`api/tests/unit/helpers/query-parser.helper.test.ts`](#apitestsunithelpersquery-parserhelpertestts)
- [`api/tests/unit/helpers/list-input.helper.test.ts`](#apitestsunithelperslist-inputhelpertestts)
- [Extending the vocabulary](#extending-the-vocabulary)

## How the layers fit

Each layer has one job, and types flow downward. Only the last two rows mention a specific resource.

| layer                 | file                              | holds                                                                                                                                                                                                                                |
| --------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| contract              | `models/dao.model.ts`             | `Dao<T, ListInput, CreateInput, UpdateInput>`, `PaginatedResult`, `IdInput`. No zod, no drizzle.                                                                                                                                     |
| list-input vocabulary | `models/list-input.model.ts`      | the scalar filter inputs (id, string, number, date, boolean), `sortDirectionSchema`, `SortInput`, and the types derived from them                                                                                                     |
| list-input builders   | `helpers/list-input.helper.ts`    | `createFilterInputSchema`, `createSortInputSchema`, `createListInputSchema`, and the page-size limits                                                                                                                                 |
| translation           | `helpers/dao.helper.ts`           | `FilterTable` / `SortTable`, `filterToSql`, `sortToSql`, `toPaginatedResult`                                                                                                                                                         |
| HTTP parsing          | `helpers/query-parser.helper.ts`  | `normalizeQuery`                                                                                                                                                                                                                     |
| resource schema       | `db/schemas/<resource>.schema.ts` | the drizzle table, the create / update / filter / sort / list input schemas, the default sort, and the types inferred from them                                                                                                      |
| DAO                   | `daos/<resource>.dao.ts`          | one class implementing `Dao`; runs queries, holds no configuration                                                                                                                                                                   |

A list request passes through them in this order:

```
GET /entities?filter={"name":{"contains":"a"}}&sortField=name&sortDirection=DESC&page=2
  │
  ├─ controller   normalizeQuery(req.query), reject unknown params, JSON.parse(filter),
  │               build sort, Number(page / pageSize)                → { filter, sort, page, pageSize }
  │               listEntityInputSchema.safeParse(…)                → ListEntityInput, or 400
  ├─ DAO          entityDao.list(input)
  │    ├─ page, pageSize arrive set: the schema applied the defaults and the range
  │    ├─ where   = filterToSql(filter, entity)                      → WHERE
  │    └─ orderBy = sortToSql(sort ?? entityDefaultSort, entity)      → ORDER BY …, id
  └─ response     toPaginatedResult(items, total, { page, pageSize })→ { items, total, page, pageSize, totalPages }
```

### What the types guarantee

- **Filter inputs are inferred, not hand-written.** `createFilterInputSchema` builds the recursive `and` / `or` / `not`
  with zod 4 getters, so `EntityFilterInput` is inferred at every depth: an unknown field, an unknown operator or a
  wrongly typed operand is a compile error in code and a 400 at the HTTP edge.
- **Fields are named after columns.** The DAO passes the drizzle table itself as the column source. `FilterTable` /
  `SortTable` require a column for every filter and sort field, so a field without a matching column does not compile.
- **One translator for every scalar kind.** The zod schemas already restrict which operators each kind accepts (no
  `beginsWith` on a date), so `filterToSql` never needs to know the kind. `FieldFilterInput` is derived from the
  scalar inputs, so the translator tracks the schemas.
- **Sort fields are an allowlist** (`createSortInputSchema([...])`), and `sortToSql` requires each one to be a column of
  the table.
- **Every input type is inferred.** `ListEntityInput = z.infer<typeof listEntityInputSchema>`, like the create, update,
  filter and sort inputs; `dao.model.ts` defines no input shapes.
- **Pagination is resolved once, at the edge.** `createListInputSchema` applies the defaults and rejects a `page` below
  1 or a `pageSize` outside 1–100 with a 400, so the DAO receives both set.
- **Pages are deterministic.** `sortToSql` always appends an `id` tie-breaker, and every resource declares a default
  sort, because rows without an `ORDER BY` have no guaranteed order.
- **`and` / `or` / `not` keep their logic** when a branch matches everything: `or` containing `{}` matches every row,
  and `not {}` matches none.

## `api/src/models/dao.model.ts`

The contract every DAO implements and the result it returns. It defines no input shapes: every input type is inferred from a schema built with `list-input.model.ts` or drizzle-zod.

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

## `api/src/models/list-input.model.ts`

The single source of truth for which operators each column kind accepts: one strict zod schema per scalar kind, `sortDirectionSchema`, and the types derived from them (including the exported `ScalarFilterInputSchema`, the union the filter builder is generic over). The three builders that assemble these into a resource's filter / sort / list schemas live in `helpers/list-input.helper.ts` (next section).

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

## `api/src/helpers/list-input.helper.ts`

The three builders every resource schema calls — `createFilterInputSchema`, `createSortInputSchema`, `createListInputSchema` — plus the page-size limits. They are functions that assemble the scalar schemas and `sortDirectionSchema` from `list-input.model.ts` into a resource's filter, sort and list input schemas, so they live in `helpers/` (logic), not `models/` (shapes). The import is one-directional: the helper depends on the model, never the reverse.

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

## `api/src/models/error.model.ts`

The sentinel error DAOs throw for a missing row; controllers translate it to a 404. Validation failures need no sentinel: controllers read the `safeParse` result.

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

## `api/src/helpers/dao.helper.ts`

Resource-agnostic translation from list inputs to drizzle SQL, plus pagination. Each DAO passes its drizzle table as the column source.

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

## `api/src/helpers/query-parser.helper.ts`

Normalizes URL query params: the first value of a repeated param wins, and empty values are dropped. The rest of the URL decoding (JSON filter, sort, page numbers) is written out in the list controller. Transport-agnostic: it takes a plain params dict (`req.query`, another framework, `URLSearchParams.entries()`, a test fixture).

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

## `api/tests/unit/helpers/dao.helper.test.ts`

Renders the built SQL with `PgDialect`, so the translator is tested without a database. The test table has one column per
scalar kind, and the whole file wraps in a single `describe('dao.helper')`.

```ts
import { type SQL } from 'drizzle-orm';
import { boolean, integer, PgDialect, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import { escapeLike, filterToSql, sortToSql, toPaginatedResult } from '../../../src/helpers/dao.helper.js';
import type {
  BooleanFilterInput,
  DateFilterInput,
  IdFilterInput,
  NumberFilterInput,
  StringFilterInput
} from '../../../src/models/list-input.model.js';

const table = pgTable('t', {
  id: uuid('id'),
  name: text('name'),
  score: integer('score'),
  active: boolean('active'),
  createdAt: timestamp('created_at', { withTimezone: true })
});

interface TestFilterInput {
  id?: IdFilterInput;
  name?: StringFilterInput;
  score?: NumberFilterInput;
  active?: BooleanFilterInput;
  createdAt?: DateFilterInput;
  and?: TestFilterInput[];
  or?: TestFilterInput[];
  not?: TestFilterInput;
}

const dialect = new PgDialect();

function render(sql: SQL | undefined): { sql: string; params: unknown[] } | undefined {
  return sql ? dialect.sqlToQuery(sql) : undefined;
}

function translate(filter: TestFilterInput): { sql: string; params: unknown[] } | undefined {
  return render(filterToSql(filter, table));
}

function sqlOf(clauses: SQL[]): (string | undefined)[] {
  return clauses.map((clause) => render(clause)?.sql);
}

describe('dao.helper', () => {
  describe('filterToSql: field operators', () => {
    it('returns undefined for an empty filter or field input', () => {
      // Act + Assert
      expect(translate({})).toBeUndefined();
      expect(translate({ name: {} })).toBeUndefined();
    });

    it('translates contains / beginsWith into escaped, case-insensitive patterns', () => {
      // Act
      const query = translate({ name: { contains: '50%', beginsWith: 'a_' } });

      // Assert
      expect(query?.sql).toBe('("t"."name" ilike $1 and "t"."name" ilike $2)');
      expect(query?.params).toEqual(['%50\\%%', 'a\\_%']);
    });

    it('translates comparisons and between', () => {
      // Act
      const query = translate({ score: { gt: 1.5, between: [0, 10] } });

      // Assert
      expect(query?.sql).toBe('("t"."score" > $1 and "t"."score" between $2 and $3)');
      expect(query?.params).toEqual([1.5, 0, 10]);
    });

    it('translates in, and turns an empty in list into false', () => {
      // Act + Assert
      expect(translate({ name: { in: ['a', 'b'] } })?.sql).toBe('"t"."name" in ($1, $2)');
      expect(translate({ id: { in: [] } })?.sql).toBe('false');
    });

    it('translates boolean and date inputs', () => {
      // Act + Assert
      expect(translate({ active: { eq: true } })?.sql).toBe('"t"."active" = $1');
      expect(translate({ createdAt: { ge: new Date('2026-01-01') } })?.sql).toBe('"t"."created_at" >= $1');
    });

    it('translates each comparison operator', () => {
      // Act + Assert
      expect(translate({ score: { eq: 1 } })?.sql).toBe('"t"."score" = $1');
      expect(translate({ score: { ne: 1 } })?.sql).toBe('"t"."score" <> $1');
      expect(translate({ score: { lt: 1 } })?.sql).toBe('"t"."score" < $1');
      expect(translate({ score: { le: 1 } })?.sql).toBe('"t"."score" <= $1');
      expect(translate({ score: { ge: 1 } })?.sql).toBe('"t"."score" >= $1');
    });

    it('translates notContains into an escaped, case-insensitive negative match', () => {
      // Act
      const query = translate({ name: { notContains: '50%' } });

      // Assert
      expect(query?.sql).toBe('"t"."name" not ilike $1');
      expect(query?.params).toEqual(['%50\\%%']);
    });

    it('ANDs the branches of a top-level and', () => {
      // Act
      const query = translate({ and: [{ name: { eq: 'a' } }, { score: { gt: 1 } }] });

      // Assert
      expect(query?.sql).toBe('("t"."name" = $1 and "t"."score" > $2)');
    });

    it('ANDs several fields', () => {
      // Act
      const query = translate({ name: { eq: 'a' }, score: { lt: 3 } });

      // Assert
      expect(query?.sql).toBe('("t"."name" = $1 and "t"."score" < $2)');
    });
  });

  describe('filterToSql: and / or / not', () => {
    it('nests and / or / not', () => {
      // Act
      const query = translate({ or: [{ name: { eq: 'a' } }, { not: { score: { gt: 1 } } }] });

      // Assert
      expect(query?.sql).toBe('("t"."name" = $1 or not "t"."score" > $2)');
    });

    it('treats a branch that matches everything as making the whole or match everything', () => {
      // Act + Assert
      expect(translate({ or: [{ name: { eq: 'a' } }, {}] })).toBeUndefined();
    });

    it('negates a match-everything filter into false', () => {
      // Act + Assert
      expect(translate({ not: {} })?.sql).toBe('false');
    });
  });

  describe('sortToSql', () => {
    it('sorts by the requested column with an id tie-breaker', () => {
      // Act
      const clauses = sqlOf(sortToSql({ field: 'createdAt', direction: 'DESC' }, table));

      // Assert
      expect(clauses).toEqual(['"t"."created_at" desc', '"t"."id" asc']);
    });

    it('sorts ascending when the direction is ASC', () => {
      // Act
      const clauses = sqlOf(sortToSql({ field: 'name', direction: 'ASC' }, table));

      // Assert
      expect(clauses).toEqual(['"t"."name" asc', '"t"."id" asc']);
    });
  });

  describe('escapeLike / toPaginatedResult', () => {
    it('escapes LIKE metacharacters', () => {
      // Act + Assert
      expect(escapeLike('50%_off\\')).toBe('50\\%\\_off\\\\');
    });

    it('derives totalPages from total and pageSize', () => {
      // Act + Assert
      expect(toPaginatedResult(['x'], 21, { page: 2, pageSize: 10 })).toEqual({
        items: ['x'],
        total: 21,
        page: 2,
        pageSize: 10,
        totalPages: 3
      });
    });

    it('yields zero pages for an empty result', () => {
      // Act + Assert
      expect(toPaginatedResult([], 0, { page: 1, pageSize: 10 })).toEqual({
        items: [],
        total: 0,
        page: 1,
        pageSize: 10,
        totalPages: 0
      });
    });
  });
});
```

## `api/tests/unit/helpers/query-parser.helper.test.ts`

Tests the normalizer on its own, wrapped in `describe('query-parser.helper')`. The list-input builders have their own test (next section) and URL decoding is tested through the controller unit test ([api-entity.md](api-entity.md)).

```ts
import { describe, expect, it } from 'vitest';
import { normalizeQuery } from '../../../src/helpers/query-parser.helper.js';

describe('query-parser.helper', () => {
  it('keeps the first value of a repeated param', () => {
    // Act + Assert
    expect(normalizeQuery({ page: ['3', '9'] })).toEqual({ page: '3' });
  });

  it('drops empty and missing values', () => {
    // Act + Assert
    expect(normalizeQuery({ filter: '', page: undefined, pageSize: '5' })).toEqual({ pageSize: '5' });
  });

  it('returns an empty object for anything that is not a params object', () => {
    // Act + Assert
    expect(normalizeQuery(undefined)).toEqual({});
    expect(normalizeQuery('page=1')).toEqual({});
  });
});
```

## `api/tests/unit/helpers/list-input.helper.test.ts`

Tests the builders directly against an ad-hoc field config (`id` / `name` / `age`), so the generic behaviour — field optionality, recursive `and` / `or` / `not`, strictness, the logical-branch cap, the `in`-list cap (`MAX_IN_VALUES`) at and over the limit, the `between` tuple arity, the sort allowlist, and the page defaults and range — is covered without any one resource. The per-resource schema test then only checks that resource's own column and sort wiring.

```ts
import { describe, expect, it } from 'vitest';
import { createFilterInputSchema, createListInputSchema, createSortInputSchema } from '../../../src/helpers/list-input.helper.js';
import { idFilterInputSchema, numberFilterInputSchema, stringFilterInputSchema } from '../../../src/models/list-input.model.js';

const filterInputSchema = createFilterInputSchema({
  id: idFilterInputSchema,
  name: stringFilterInputSchema,
  age: numberFilterInputSchema
});
const sortInputSchema = createSortInputSchema(['name', 'age']);
const listInputSchema = createListInputSchema({ filter: filterInputSchema, sort: sortInputSchema });

const UUID = '00000000-0000-4000-8000-000000000001';

// Hoisted so the Array.from callback doesn't nest inside the `it` callback (max-nested-callbacks).
const IN_AT_MAX = Array.from({ length: 100 }, (_, i) => i);

describe('list-input.helper', () => {
  describe('createFilterInputSchema', () => {
    it('makes every field optional (an empty filter parses)', () => {
      // Act + Assert
      expect(filterInputSchema.parse({})).toEqual({});
    });

    it('accepts the declared fields and recursive and / or / not', () => {
      // Arrange
      const raw = { or: [{ name: { contains: 'a' } }, { not: { age: { gt: 1 } } }], and: [{ id: { eq: UUID } }] };

      // Act + Assert
      expect(filterInputSchema.safeParse(raw).success).toBe(true);
    });

    it('accepts an in list at the maximum size', () => {
      // Act + Assert: MAX_IN_VALUES is 100.
      const raw = { age: { in: IN_AT_MAX } };
      expect(filterInputSchema.safeParse(raw).success).toBe(true);
    });

    it.each([
      ['an undeclared field', { title: { eq: 'a' } }],
      ['an operator the scalar does not allow', { age: { contains: '1' } }],
      ['an invalid nested branch', { or: [{ name: { gt: 1 } }] }],
      ['more logical branches than allowed', { and: Array.from({ length: 21 }, () => ({ name: { eq: 'a' } })) }],
      ['an in list over the maximum size', { age: { in: Array.from({ length: 101 }, (_, i) => i) } }],
      ['a between tuple with too few elements', { age: { between: [1] } }],
      ['a between tuple with too many elements', { age: { between: [1, 2, 3] } }]
    ])('rejects %s', (_label, raw) => {
      // Act + Assert
      expect(filterInputSchema.safeParse(raw).success).toBe(false);
    });
  });

  describe('createSortInputSchema', () => {
    it('accepts a field in the allowlist with a direction', () => {
      // Act + Assert
      expect(sortInputSchema.parse({ field: 'name', direction: 'DESC' })).toEqual({ field: 'name', direction: 'DESC' });
    });

    it.each([
      ['a field outside the allowlist', { field: 'other', direction: 'ASC' }],
      ['a lowercase direction', { field: 'name', direction: 'asc' }],
      ['a missing direction', { field: 'name' }],
      ['an unknown key', { field: 'name', direction: 'ASC', nulls: 'last' }]
    ])('rejects %s', (_label, raw) => {
      // Act + Assert
      expect(sortInputSchema.safeParse(raw).success).toBe(false);
    });
  });

  describe('createListInputSchema', () => {
    it('applies the page defaults and leaves filter / sort optional', () => {
      // Act + Assert
      expect(listInputSchema.parse({})).toEqual({ page: 1, pageSize: 20 });
    });

    it('keeps a provided page and pageSize', () => {
      // Act + Assert
      expect(listInputSchema.parse({ page: 3, pageSize: 50 })).toMatchObject({ page: 3, pageSize: 50 });
    });

    it.each([
      ['a pageSize over the max', { pageSize: 101 }],
      ['a zero page', { page: 0 }],
      ['a fractional pageSize', { pageSize: 1.5 }],
      ['an unknown key', { cursor: 'abc' }]
    ])('rejects %s', (_label, raw) => {
      // Act + Assert
      expect(listInputSchema.safeParse(raw).success).toBe(false);
    });
  });
});
```

## Extending the vocabulary

- **A new operator** (e.g. `notBeginsWith`): one line in the matching scalar schema in `list-input.model.ts`, one
  line in `comparisonsToSql` or `textMatchesToSql` in `dao.helper.ts`, a `filterToSql` case in
  `tests/unit/helpers/dao.helper.test.ts`, and a rejection case in `tests/unit/db/schemas/entity.schema.test.ts`. `FieldFilterInput`
  picks the operator up by itself.
- **A new scalar kind** (e.g. `jsonbFilterInputSchema`): a new strict schema in `list-input.model.ts` listing only the
  operators that make sense for it, added to the `ScalarFilterInputSchema` and `ScalarFilterInput` unions. If it needs
  SQL the existing operators cannot express, add a branch to `fieldToSql`.
- **A new filterable or sortable column** is a resource change, not a vocabulary change: see
  [api-entity.md](api-entity.md#adding-another-resource).
