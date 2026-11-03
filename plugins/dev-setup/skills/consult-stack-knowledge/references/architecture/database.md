---
type: Architecture Concept
title: Database
description: the engine per runtime, table design, migrations, connection, one database per environment
---
# Database

The database itself, whatever the engine: which kind a runtime gets, how tables are designed, how the schema changes,
how the app connects, and where its data lives in development and tests. Column types, drivers, transactions and
tooling belong to the engine's technology doc. The code that reads and writes the database is the Data access concept.

## Principles

- **The engine follows the runtime**, because a request-scoped runtime cannot hold a connection open and a long-running
  one should not pay a hop it need not: a long-running process gets a server database it connects to; a runtime that
  offers its own managed database uses it rather than reaching out. The same engine runs in development, in tests and in
  production, so no query behaves differently between them.
- **Primary keys are UUIDs**, so ids are safe to expose in URLs and can be known before the insert. Who generates them,
  the database or the schema, is the engine's to say.
- **Every table records when a row was created and last updated**, in UTC, defaulted on insert, so any row can be
  audited and ordered by age without a later migration; every update sets the second.
- **Columns are snake_case in the database and camelCase in code**, mapped once in the schema files, so each side
  follows its own naming rule and no query quotes identifiers.
- **Every foreign key states its `on delete`** (`cascade` for rows that cannot outlive their owner), and **every foreign
  key is indexed**, because every join and every cascading delete reads by it.
- **A column is nullable only where absence means something**, because a nullable column makes every reader handle a
  case that never happens; otherwise `not null`, with a default where one is natural.
- **The schema changes through migrations only**, because a pushed schema has no history to replay in another
  environment. They are generated from the schema files, reviewed, and committed with the change; nothing pushes a
  schema to a live database. Migrations are applied by a step that runs to completion before the app serves, in every
  environment: a missing table is a deploy error, not a request error.
- **One connection setting, which fails loudly**, because a fallback hides a misconfigured environment and connects to
  the wrong database. The client and the migration tool read one setting (a URL or a binding) and throw when it is
  missing; no fallback, no credential in source.
- **One database per environment**, so a test run never wipes what a developer was looking at. Development, end-to-end
  tests and production never share one; an end-to-end suite gets its own database and leaves the development one as it
  found it.
- **Local data is disposable**, so a reset is a delete and nothing of value lives there: it sits in a git-ignored folder
  that a reset deletes.
- **Seed data goes through the data layer or a seed helper**, never inside a migration, because a migration replays
  everywhere, including production.
- **Tests run against the real engine**, isolated per suite and migrated with the project's own migrations, so what
  passes in tests is what the engine does.

## Conventions

- **The same engine in every environment**, the one the runtime calls for.
- **UUID primary keys; created and updated times in UTC on every table.**
- **snake_case columns, camelCase fields**, mapped in the schema files.
- **Every foreign key has an explicit `on delete` and an index.**
- **`not null` unless absence means something.**
- **Schema changes are generated migrations, committed with the schema change**; nothing pushes a schema, and no
  migration carries seed data.
- **The connection setting is required**: a missing one fails at start.
- **Each environment has its own database**; local data is git-ignored and safe to delete.
- **Database tests run on the real engine, migrated by the project's migrations.**

## Verify it is wired

- Every table has a UUID primary key and both times.
- Every foreign key has `on delete` and an index.
- Every schema change in history has its migration in the same commit; no migration inserts rows.
- The connection code has no fallback value.
- The end-to-end configuration names a database other than the development one.
