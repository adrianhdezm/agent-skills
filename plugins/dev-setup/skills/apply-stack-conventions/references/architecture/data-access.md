# Data access

How code reads and writes the database, whatever the ORM or runtime: one layer touches the database, everything above it
calls that layer, and schemas define the types. The database itself (engine, table design, migrations, connection) is
the Database concept.

## Principles

- **One layer touches the database.** DAOs (and, where a stack has them, read-only queries) are the only code that
  builds SQL or calls the ORM. Routes, controllers, effects and pages call that layer, so a query has one home and a
  schema change has one place to land.
- **One DAO per table, built once, reached through the app's context.** The server entry creates the database client and
  the DAOs (once at module scope where the process lives on, per request where the runtime allows nothing else) and puts
  them on the typed context. Nothing else opens a connection.
- **Schemas define the types.** Row types and input types are inferred from the schema and its validation schemas, so
  the two cannot drift.
- **The data layer speaks the domain, not HTTP.** It throws domain errors (`NotFoundError`) and returns `null` for a
  missing row; the layer above maps them to answers. That keeps it callable from scripts, jobs and tests.
- **Every list is ordered and bounded.** A default sort plus an `id` tie-breaker, so pages never repeat or skip rows; a
  page size with a maximum, so no request reads a whole table.
- **A write that spans tables is one atomic unit, owned by a service.** DAOs stay single-table; the service composes
  them inside a transaction (or the runtime's batch). A batch over many rows is one statement, never a loop.
- **Data access is tested against the real database** the Database concept describes, seeded through the data layer or
  a seed helper; the SQL a translator builds is unit-tested without one.

## Open decision

**Two DAO contracts are in use.** One takes a single input object per method and returns paged lists with a total
(`list(input)` → `{ items, total, page, pageSize, totalPages }`); the other exposes `getAll({ filters, limit, offset })`
and `deleteMany`, with cross-table reads in query classes. Both keep the principles above. Follow the one the project
already uses; which one becomes the single house contract is an open decision.

## Conventions

- **Only the data layer touches the database**: DAOs, and read-only queries where the stack has them. Routes,
  controllers, effects and pages never build a query or import a table.
- **One DAO per table**, created by the server entry and reached through the app's context; nothing else opens a
  connection.
- **Types are inferred from the schemas**, never written to mirror them.
- **The data layer throws domain errors** (`NotFoundError`) and never an HTTP error; the HTTP layer maps them.
- **Every list has a default sort, an `id` tie-breaker and a maximum page size.**
- **A write across tables is a service method in one atomic unit** (a transaction, or the engine's batch where it has no transactions); a batch over many rows is
  one statement.
- **DAOs, queries and services are tested against the real database**, seeded through the data layer or a seed helper.

## Verify it is wired

- No route, controller, effect or component imports the ORM, a table or the database client.
- The database client and the DAOs are constructed in exactly one place, the server entry.
- Every list query has an `ORDER BY` ending in the id, and a page size limit.
