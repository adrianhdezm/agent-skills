# API query layer

The resource-agnostic building blocks every DAO and list endpoint uses: the DAO contract, the error classes, the
Hasura-flavored query vocabulary, the URL query parser, and the SQL translator. Nothing here mentions a specific table.

## Contents

- [`api/src/models/dao.model.ts`](#apisrcmodelsdaomodelts)
- [`api/src/models/error.model.ts`](#apisrcmodelserrormodelts)
- [`api/src/models/query/predicates.ts`](#apisrcmodelsquerypredicatests)
- [`api/src/models/query/where.ts`](#apisrcmodelsquerywherets)
- [`api/src/models/query/list.ts`](#apisrcmodelsquerylistts)
- [`api/src/models/query/index.ts`](#apisrcmodelsqueryindexts)
- [`api/src/helpers/query-parser.helper.ts`](#apisrchelpersquery-parserhelperts)
- [`api/src/daos/query.ts`](#apisrcdaosqueryts)
- [`api/tests/helpers/query-parser.helper.test.ts`](#apitestshelpersquery-parserhelpertestts)
- [`api/tests/daos/query.test.ts`](#apitestsdaosquerytestts)
- [Adding an operator or a column type](#adding-an-operator-or-a-column-type)

## `api/src/models/dao.model.ts`

```ts
/**
 * Minimal, HTTP-agnostic persistence abstractions. DAOs expose a typed
 * data-access surface and know nothing about Express or http-errors.
 *
 * Params for every method are objects so callers always name arguments and
 * so new fields (e.g. a future tenant/workspace id) can be added without
 * breaking existing call sites.
 *
 * The query vocabulary (where / orderBy / predicates) lives in
 * `models/query/` and is built per-resource with zod — this file stays
 * concerned only with the shape of the data-access contract.
 */

export interface ListResult<T> {
  readonly items: readonly T[];
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
}

export interface AppendOnlyDao<T, FindOneParams, CreateParams, ListQuery = Record<string, unknown>> {
  findOne(params: FindOneParams): Promise<T | null>;
  list(params?: ListQuery): Promise<ListResult<T>>;
  create(params: CreateParams): Promise<T>;
}

/**
 * Standard CRUD DAO.
 *
 * - `T`: full entity row as returned by reads.
 * - `C`: create input. Defaults to `T` minus server-managed fields.
 * - `U`: update input. Defaults to a partial of the create input.
 * - `ListQuery`: fully-parsed query shape for `list()` — typically the
 *    `z.infer` of the resource's `listQuerySchema`.
 */
export interface Dao<
  T,
  C = Omit<T, 'id' | 'createdAt' | 'updatedAt'>,
  U = Partial<C>,
  ListQuery = Record<string, unknown>
> extends AppendOnlyDao<T, { id: string }, { attrs: C }, ListQuery> {
  update(params: { id: string; attrs: U }): Promise<T>;
  delete(params: { id: string }): Promise<void>;
  deleteMany(params: { ids: readonly string[] }): Promise<void>;
}
```

## `api/src/models/error.model.ts`

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

/**
 * Thrown by query/body parsers when input is malformed or fails validation.
 * HTTP controllers map this to a 400 — parsers stay transport-agnostic.
 */
export class QueryParseError extends Error {
  readonly details: unknown;

  constructor(message: string, details?: unknown) {
    super(message);
    this.name = 'QueryParseError';
    this.details = details;
  }
}
```

## `api/src/models/query/predicates.ts`

The single source of truth for which comparison operators each column type accepts.

```ts
import { z } from 'zod';

function nonEmptyPredicate<T extends z.ZodRawShape>(shape: T): z.ZodType<Partial<z.infer<z.ZodObject<T>>>> {
  return z
    .object(shape)
    .strict()
    .refine((v) => Object.keys(v as object).length > 0, {
      message: 'predicate must specify at least one operator'
    });
}

export const textPredicate = nonEmptyPredicate({
  _eq: z.string().optional(),
  _neq: z.string().optional(),
  _in: z.array(z.string()).optional(),
  _like: z.string().optional(),
  _ilike: z.string().optional(),
  _nlike: z.string().optional(),
  _nilike: z.string().optional(),
  _is_null: z.boolean().optional()
});

export const uuidPredicate = nonEmptyPredicate({
  _eq: z.string().uuid().optional(),
  _neq: z.string().uuid().optional(),
  _in: z.array(z.string().uuid()).optional(),
  _is_null: z.boolean().optional()
});

export const dateTimePredicate = nonEmptyPredicate({
  _eq: z.string().datetime({ offset: true }).optional(),
  _neq: z.string().datetime({ offset: true }).optional(),
  _gt: z.string().datetime({ offset: true }).optional(),
  _gte: z.string().datetime({ offset: true }).optional(),
  _lt: z.string().datetime({ offset: true }).optional(),
  _lte: z.string().datetime({ offset: true }).optional(),
  _is_null: z.boolean().optional()
});

export const numberPredicate = nonEmptyPredicate({
  _eq: z.number().optional(),
  _neq: z.number().optional(),
  _gt: z.number().optional(),
  _gte: z.number().optional(),
  _lt: z.number().optional(),
  _lte: z.number().optional(),
  _in: z.array(z.number()).optional(),
  _is_null: z.boolean().optional()
});

export const booleanPredicate = nonEmptyPredicate({
  _eq: z.boolean().optional(),
  _neq: z.boolean().optional(),
  _is_null: z.boolean().optional()
});
```

## `api/src/models/query/where.ts`

```ts
import { z } from 'zod';

export type WhereNode<Fields extends z.ZodRawShape> = {
  [K in keyof Fields]?: z.infer<Fields[K]>;
} & {
  _and?: WhereNode<Fields>[];
  _or?: WhereNode<Fields>[];
  _not?: WhereNode<Fields>;
};

/**
 * Builds a recursive `where` zod schema from a map of per-field predicate
 * schemas. All field keys are optional; combinators are optional. Unknown
 * keys are rejected (strict), catching typos at the API boundary.
 */
export function whereSchema<Fields extends z.ZodRawShape>(fields: Fields): z.ZodType<WhereNode<Fields>> {
  const self: z.ZodType<WhereNode<Fields>> = z.lazy(() =>
    z
      .object(fields)
      .partial()
      .extend({
        _and: z.array(self).optional(),
        _or: z.array(self).optional(),
        _not: self.optional()
      })
      .strict()
  ) as unknown as z.ZodType<WhereNode<Fields>>;
  return self;
}
```

## `api/src/models/query/list.ts`

```ts
import { z } from 'zod';
import { intQueryParam, jsonQueryParam } from '../../helpers/query-parser.helper.js';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const MAX_SORT_FIELDS = 5;

export interface SortSpec<Field extends string> {
  field: Field;
  dir: 'asc' | 'desc';
}

/**
 * Builds a URL-ready list-query schema: `where` + `orderBy` arrive as
 * JSON-encoded strings; `limit` + `offset` are integer strings. The schema
 * handles coercion end to end so controllers can call `parseQuery` directly.
 */
export function listQuerySchema<Where extends z.ZodType, SortFields extends readonly [string, ...string[]]>(opts: {
  where: Where;
  sortFields: SortFields;
}) {
  const sortSpec = z.object({
    field: z.enum(opts.sortFields),
    dir: z.enum(['asc', 'desc'])
  });
  return z.object({
    where: jsonQueryParam(opts.where),
    orderBy: jsonQueryParam(z.array(sortSpec).max(MAX_SORT_FIELDS)),
    limit: intQueryParam({ min: 1, max: MAX_LIMIT, default: DEFAULT_LIMIT }),
    offset: intQueryParam({ min: 0, default: 0 })
  });
}
```

## `api/src/models/query/index.ts`

```ts
export * from './predicates.js';
export * from './where.js';
export * from './list.js';
```

## `api/src/helpers/query-parser.helper.ts`

Transport-agnostic. Takes a plain params dict (works with `req.query`, Fastify, `URLSearchParams.entries()`, test
fixtures). On failure throws `QueryParseError`; the controller translates it to a 400 at the edge.

```ts
import { z } from 'zod';
import { QueryParseError } from '../models/error.model.js';

/** URL query values arrive as `string | string[] | undefined`. */
export const firstQueryValue = (v: unknown): unknown => (Array.isArray(v) ? v[0] : v);

/** JSON-encoded param whose decoded value is further validated by `inner`. */
export function jsonQueryParam<Inner extends z.ZodType>(inner: Inner) {
  return z.preprocess(
    firstQueryValue,
    z
      .string()
      .optional()
      .transform((s, ctx): unknown => {
        if (s === undefined) {
          return undefined;
        }
        try {
          return JSON.parse(s);
        } catch {
          ctx.addIssue({ code: 'custom', message: 'must be valid JSON' });
          return z.NEVER;
        }
      })
      .pipe(inner.optional())
  );
}

/** Integer-valued query param. */
export function intQueryParam(opts: { min?: number; max?: number; default?: number } = {}) {
  let schema = z.coerce.number().int();
  if (opts.min !== undefined) {
    schema = schema.min(opts.min);
  }
  if (opts.max !== undefined) {
    schema = schema.max(opts.max);
  }
  const withDefault = opts.default !== undefined ? schema.default(opts.default) : schema;
  return z.preprocess(firstQueryValue, withDefault);
}

export function parseQuery<Schema extends z.ZodType>(params: unknown, schema: Schema): z.infer<Schema> {
  const result = schema.safeParse(params);
  if (!result.success) {
    throw new QueryParseError('Invalid query', z.flattenError(result.error));
  }
  return result.data;
}
```

## `api/src/daos/query.ts`

Table-agnostic Hasura-tree → drizzle-SQL translator. Each DAO supplies its own `ColumnMap`.

```ts
import {
  and,
  asc,
  desc,
  eq,
  gt,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  like,
  lt,
  lte,
  ne,
  not,
  notIlike,
  notLike,
  or,
  type SQL,
  sql
} from 'drizzle-orm';
import type { AnyPgColumn, PgTable } from 'drizzle-orm/pg-core';

export type ColumnMap = Readonly<Record<string, AnyPgColumn>>;
export type WhereNode = Readonly<Record<string, unknown>>;

export interface SortSpec {
  readonly field: string;
  readonly dir: 'asc' | 'desc';
}

const COMBINATOR_KEYS = new Set(['_and', '_or', '_not']);
type Combinator = '_and' | '_or' | '_not';

const OPERATORS: Readonly<Record<string, (col: AnyPgColumn, value: unknown) => SQL | undefined>> = {
  _eq: (c, v) => eq(c, v),
  _neq: (c, v) => ne(c, v),
  _gt: (c, v) => gt(c, v),
  _gte: (c, v) => gte(c, v),
  _lt: (c, v) => lt(c, v),
  _lte: (c, v) => lte(c, v),
  _in: (c, v) => (Array.isArray(v) && v.length > 0 ? inArray(c, v) : sql`false`),
  _is_null: (c, v) => (v ? isNull(c) : isNotNull(c)),
  _like: (c, v) => like(c, String(v)),
  _ilike: (c, v) => ilike(c, String(v)),
  _nlike: (c, v) => notLike(c, String(v)),
  _nilike: (c, v) => notIlike(c, String(v))
};

export function whereToSql(where: WhereNode | undefined, columns: ColumnMap): SQL | undefined {
  if (!where) {
    return undefined;
  }
  const clauses: SQL[] = [];
  for (const [key, value] of Object.entries(where)) {
    if (value === undefined) {
      continue;
    }
    const built = COMBINATOR_KEYS.has(key)
      ? combinatorToSql(key as Combinator, value, columns)
      : fieldToSql(columns[key], value as Record<string, unknown>);
    if (built) {
      clauses.push(built);
    }
  }
  return combine(clauses, 'and');
}

function combinatorToSql(key: Combinator, value: unknown, columns: ColumnMap): SQL | undefined {
  if (key === '_not') {
    const inner = whereToSql(value as WhereNode, columns);
    return inner ? not(inner) : undefined;
  }
  const parts = (value as readonly WhereNode[]).map((w) => whereToSql(w, columns)).filter(isDefined);
  return combine(parts, key === '_and' ? 'and' : 'or');
}

function fieldToSql(col: AnyPgColumn | undefined, predicate: Record<string, unknown>): SQL | undefined {
  if (!col) {
    return undefined;
  }
  const parts: SQL[] = [];
  for (const [op, raw] of Object.entries(predicate)) {
    if (raw === undefined) {
      continue;
    }
    const fn = OPERATORS[op];
    const built = fn?.(col, raw);
    if (built) {
      parts.push(built);
    }
  }
  return combine(parts, 'and');
}

function combine(parts: readonly SQL[], mode: 'and' | 'or'): SQL | undefined {
  if (parts.length === 0) {
    return undefined;
  }
  if (parts.length === 1) {
    return parts[0];
  }
  return mode === 'and' ? and(...parts) : or(...parts);
}

export function orderByToSql(orderBy: readonly SortSpec[] | undefined, columns: ColumnMap): SQL[] {
  if (!orderBy || orderBy.length === 0) {
    return [];
  }
  return orderBy
    .map((spec) => {
      const col = columns[spec.field];
      if (!col) {
        return undefined;
      }
      return spec.dir === 'desc' ? desc(col) : asc(col);
    })
    .filter(isDefined);
}

export async function countRows(
  db: { execute: (q: SQL) => Promise<{ rows: Array<{ count: string | number }> }> },
  table: PgTable,
  where: SQL | undefined
): Promise<number> {
  const query = where
    ? sql`select count(*)::int as count from ${table} where ${where}`
    : sql`select count(*)::int as count from ${table}`;
  const result = await db.execute(query);
  const row = result.rows[0];
  return row ? Number(row.count) : 0;
}

function isDefined<T>(v: T | undefined): v is T {
  return v !== undefined;
}
```

## `api/tests/helpers/query-parser.helper.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { intQueryParam, jsonQueryParam, parseQuery } from '../../src/helpers/query-parser.helper.js';
import { QueryParseError } from '../../src/models/error.model.js';

const schema = z.object({
  where: jsonQueryParam(z.object({ name: z.string() }).strict()),
  limit: intQueryParam({ min: 1, max: 100, default: 20 })
});

describe('parseQuery', () => {
  it('applies defaults when params are absent', () => {
    // Act
    const query = parseQuery({}, schema);

    // Assert
    expect(query.where).toBeUndefined();
    expect(query.limit).toBe(20);
  });

  it('decodes JSON params and coerces integers', () => {
    // Arrange
    const params = { where: '{"name":"a"}', limit: '5' };

    // Act
    const query = parseQuery(params, schema);

    // Assert
    expect(query).toEqual({ where: { name: 'a' }, limit: 5 });
  });

  it('takes the first value of a repeated param', () => {
    // Act
    const query = parseQuery({ limit: ['3', '9'] }, schema);

    // Assert
    expect(query.limit).toBe(3);
  });

  it.each([
    ['invalid JSON', { where: '{' }],
    ['an unknown field', { where: '{"nope":"a"}' }],
    ['an out-of-range integer', { limit: '500' }]
  ])('throws QueryParseError on %s', (_label, params) => {
    // Act + Assert
    expect(() => parseQuery(params, schema)).toThrow(QueryParseError);
  });
});
```

## `api/tests/daos/query.test.ts`

Renders the built SQL with `PgDialect`, so the translator is tested without a database.

```ts
import { type SQL } from 'drizzle-orm';
import { PgDialect, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import { orderByToSql, whereToSql } from '../../src/daos/query.js';

const table = pgTable('t', {
  name: text('name'),
  createdAt: timestamp('created_at', { withTimezone: true })
});
const columns = { name: table.name, createdAt: table.createdAt };
const dialect = new PgDialect();

function render(sql: SQL | undefined): { sql: string; params: unknown[] } | undefined {
  return sql ? dialect.sqlToQuery(sql) : undefined;
}

describe('whereToSql', () => {
  it('returns undefined for an empty or missing where', () => {
    // Act + Assert
    expect(whereToSql(undefined, columns)).toBeUndefined();
    expect(whereToSql({}, columns)).toBeUndefined();
  });

  it('translates a field predicate into a parameterised clause', () => {
    // Act
    const query = render(whereToSql({ name: { _ilike: '%a%' } }, columns));

    // Assert
    expect(query?.sql).toBe('"t"."name" ilike $1');
    expect(query?.params).toEqual(['%a%']);
  });

  it('joins _or branches with or', () => {
    // Arrange
    const where = { _or: [{ name: { _eq: 'a' } }, { name: { _eq: 'b' } }] };

    // Act
    const query = render(whereToSql(where, columns));

    // Assert
    expect(query?.sql).toBe('("t"."name" = $1 or "t"."name" = $2)');
    expect(query?.params).toEqual(['a', 'b']);
  });

  it('ignores fields that are not in the column map', () => {
    // Act + Assert
    expect(whereToSql({ unknown: { _eq: 'x' } }, columns)).toBeUndefined();
  });

  it('turns an empty _in list into false instead of invalid SQL', () => {
    // Act
    const query = render(whereToSql({ name: { _in: [] } }, columns));

    // Assert
    expect(query?.sql).toBe('false');
  });
});

describe('orderByToSql', () => {
  it('maps known fields and drops unknown ones', () => {
    // Arrange
    const orderBy = [
      { field: 'createdAt', dir: 'desc' as const },
      { field: 'unknown', dir: 'asc' as const }
    ];

    // Act
    const clauses = orderByToSql(orderBy, columns).map((c) => render(c)?.sql);

    // Assert
    expect(clauses).toEqual(['"t"."created_at" desc']);
  });
});
```

## Adding an operator or a column type

- **A new operator** (e.g. `_similar`): one line in the matching predicate in `models/query/predicates.ts`, plus one
  line in the `OPERATORS` map in `daos/query.ts`, plus a `whereToSql` test.
- **A new column type** (e.g. `jsonbPredicate`): one new `nonEmptyPredicate({...})` in `predicates.ts`, enumerating
  only the operators that make sense for that type.
