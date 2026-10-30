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

| File                                       | Holds                                                                |
| ------------------------------------------ | -------------------------------------------------------------------- |
| `app/db/schema.ts`                         | the tables, both sides of every `relations()`, the exported `schema` |
| `app/db/data-access.ts`                    | `Dao`, `RelationQuery`, `GetAllOptions`, `GetAllResult`              |
| `app/db/daos/<entity>.dao.ts`              | one DAO per table, with its types and `drizzle-zod` schemas          |
| `app/db/queries/<parent>-<child>.query.ts` | one read-only query per cross-table read                             |
| `app/services/`                            | one service per business workflow                                    |
| `app/context.ts`                           | the database client's type on `appContext`                           |
| `tests/integration/`                       | DAOs, queries and services against a real database                   |

## Conventions

D1 on Workers or Postgres on Node, both through Drizzle with `drizzle-zod`: `Routes → Services → Queries → DAOs →
Database`.

- **A DAO per table** in `app/db/daos/<entity>.dao.ts`, constructed with the Drizzle client. It exposes only `create`,
  `get`, `getAll`, `update`, `delete` and `deleteMany`; every filtered read goes through
  `getAll({ filters, limit, offset })` with a typed `<Entity>Filters`, never a custom `findBySlug`. It owns its
  entity's types (`<Entity>Record`, `Create<Entity>`, `Update<Entity>`, `<Entity>Filters`) and its `drizzle-zod`
  schemas, imports no other DAO, query or service, and holds no business logic.
- **A query per cross-table read** in `app/db/queries/<parent>-<child>.query.ts`: read-only, Drizzle's relational API
  (`db.query.*` with `with`), only `get` and `getAll`, returning a `<Parent>With<Child>` type; no query-builder joins.
- **A service per business workflow** in `app/services/`: anything that writes more than one table, needs atomic
  writes, or composes DAOs and queries. Services import no tables and build no queries.
- **The shared interfaces** (`Dao`, `RelationQuery`, `GetAllOptions`, `GetAllResult`) live in `app/db/data-access.ts`;
  tables, both sides of every `relations()`, and the exported `schema` in `app/db/schema.ts`.
- **Concurrency and atomic writes follow the engine's doc**: Cloudflare D1 runs queries in
  sequence and batches atomic work; Postgres runs independent queries together and uses transactions.
- **Integration tests seed through DAOs**, not raw SQL, in workerd with D1 or in Node with the Compose Postgres; their
  helpers live in `tests/integration/db-test-utils.ts`, and the file that registers hooks is a separate
  `setup-tests.ts`. Drizzle itself is not tested.

## Verify it is wired

- No route module imports from `drizzle-orm` or a table: routes reach data through services, queries or DAOs.
- Each DAO file imports no other DAO, query or service; each query file only reads.
- Multi-table writes are atomic the way the engine's doc says.
