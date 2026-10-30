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
