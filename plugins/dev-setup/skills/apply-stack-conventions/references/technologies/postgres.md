# Postgres

Postgres as the database of a long-running process: one pool, a required connection URL, its column types, and
transactions for atomic work.

**Realises:** [Database](../architecture/database.md)

## Use it like this

- **One `pg` pool per process**, built once at module scope by the composition root, closed on shutdown after the HTTP
  server.
- **`DATABASE_URL` is required**: the client and the migration tool throw when it is unset.
- **The pool has an `error` listener that logs**: without one, an idle client's error (the database restarting) crashes
  the process.
- **Column types**: `uuid` primary keys with a database default (`gen_random_uuid()`); `timestamp with time zone` for
  times, defaulting to `now()`; `text` rather than `varchar(n)`, with lengths enforced by the validation schemas.
- **Concurrency and atomicity**: independent queries run concurrently on the pool; a write across tables is one
  transaction.
- **Tests run on a throwaway `postgres:17-alpine`**, one per suite, migrated by the project's migrations.

## Required values

| What            | Value                                                                              |
| --------------- | ---------------------------------------------------------------------------------- |
| image           | `postgres:17-alpine`                                                               |
| dependencies    | `pg`                                                                               |
| devDependencies | `@types/pg`                                                                        |
| `.env.example`  | `DB_PASSWORD=s3cr3t`, `DATABASE_URL=postgres://postgres:s3cr3t@localhost:5432/app` |
| database name   | `app`, everywhere it appears, changed all together                                 |
| port            | `5432`                                                                             |

## Pitfalls

- **A pool without an `error` listener** crashes the process when the database drops an idle connection.
- **A connection opened per request** exhausts the server's connections under load: share the one pool.

## Conventions

- **One pool per process**, built at module scope, with an `error` listener, closed on shutdown.
- **`DATABASE_URL` is required**, with no fallback.
- **Ids are `uuid` with a database default; times are `timestamp with time zone`.**
- **Independent queries run concurrently; atomic writes are one transaction.**
