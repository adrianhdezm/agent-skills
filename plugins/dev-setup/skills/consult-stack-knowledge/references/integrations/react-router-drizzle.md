---
type: Integration
title: React Router + Drizzle
description: routes → services → queries → DAOs, the client on `appContext`
connects: [react-router, drizzle]
realises: [data-access, resource-operations]
---
# React Router + Drizzle

How a React Router app layers data access once it has a database: through Drizzle with `drizzle-zod`, reached from
loaders and actions through the app's context. The React Router stacks arrive without database code; these rules apply
from the first table.

**Realises:** [Data access](../architecture/data-access.md), [Resource operations](../architecture/resource-operations.md)

## The seam

```
Routes (loaders, actions) ─► Services ─► Queries ─► DAOs ─► Database
          ▲
context.get(appContext).db   (built per request on Workers, once on Node, by the server entry)
```

- **The Drizzle client reaches routes through `appContext`**, built by the server entry: per request from the runtime's
  binding where the runtime gives one, once at module scope from the connection setting where the process lives on.
- **Routes call services, queries and DAOs**, never Drizzle directly.

## Where it lives

| File                                       | Holds                                                                                                          |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| `app/db/schema.ts`                         | the tables, both sides of every `relations()`, the exported `schema`                                           |
| `app/db/data-access.ts`                    | the contract: `Dao`, `PaginatedResult`, `IdInput`, and the list-input builders and translator                  |
| `app/db/schemas/<entity>.schema.ts`        | the entity's table, input schemas, filter, sort and list input, default sort, inferred types                   |
| `app/db/daos/<entity>.dao.ts`              | one DAO per table, implementing the contract                                                                   |
| `app/db/queries/<parent>-<child>.query.ts` | one read-only query per cross-table read                                                                       |
| `app/services/`                            | one service per business workflow                                                                              |
| `app/context.ts`                           | the database client's type on `appContext`                                                                     |
| `tests/integration/`                       | DAOs, queries and services against a real database                                                             |
| `tests/integration/db-test-utils.ts`       | the seeding helpers the integration tests share                                                                |
| `tests/integration/setup-tests.ts`         | the file that registers the hooks                                                                              |

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

`data-access.ts` is those six files concatenated in that order, with `AnyPgColumn` or `AnySQLiteColumn` as the engine's
integration says.

## Conventions

Through Drizzle with `drizzle-zod`, whatever the engine: `Routes → Services → Queries → DAOs → Database`.

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
- **The contract and its builders live in `app/db/data-access.ts`**: `Dao`, `PaginatedResult`, `IdInput`, the
  list-input builders and the translator; `app/db/schema.ts` registers every table, both sides of every
  `relations()`, and exports `schema`.
- **Concurrency and atomic writes follow the engine's doc.**
- **Integration tests seed through DAOs**, not raw SQL, against the database the engine's integration starts; helpers
  live in `tests/integration/db-test-utils.ts`, hooks in `tests/integration/setup-tests.ts`. Drizzle itself is not
  tested.

## Verify it is wired

- No route module imports from `drizzle-orm` or a table: routes reach data through services, queries or DAOs.
- Each DAO file imports no other DAO, query or service; each query file only reads.
- Multi-table writes are atomic the way the engine's doc says.
