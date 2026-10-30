# Drizzle + Cloudflare D1

Drizzle over D1: a client per request from the binding, the `sqlite` dialect for migrations, SQLite column types in the
schema files, `db.batch()` for atomic work, and tests inside workerd against a local D1. React Router on Workers uses it
once it adds a database.

## The seam

```
request handler ─► drizzle(c.env.APP_DB, { schema }) from drizzle-orm/d1 ─► DAOs, queries, services
drizzle.config.ts (dialect: 'sqlite') ─► drizzle-kit generate ─► db/migrations/ ─► wrangler d1 migrations apply
tests: readMigrationFiles() at config time ─► a binding ─► applied in workerd's local D1 by the setup file
```

## Required values

| What                | Value                                                                                                                                                                           |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| client              | `drizzle(c.env.APP_DB, { schema })` from `drizzle-orm/d1`, built inside the request handler                                                                                     |
| `drizzle.config.ts` | `dialect: 'sqlite'`, the remote driver reading the `CLOUDFLARE_*` settings                                                                                                      |
| scripts             | `db:generate` and `db:migrate` (remote), each drizzle-kit's bin under `node --env-file=.env --import=tsx`                                                                       |
| schema              | `sqliteTable`; ids `text('id').primaryKey().$defaultFn(() => crypto.randomUUID())`; times `integer(…, { mode: 'timestamp_ms' })` defaulting to the current time in milliseconds |
| tests               | the Cloudflare Vitest plugin with `d1Databases: ['APP_DB']`; the migrations read with `readMigrationFiles()` and passed as a JSON binding, applied by the setup file            |

## Pitfalls

- **`db.transaction()` throws on D1**: use `db.batch([...])`, which is atomic.
- **`Promise.all` over queries** gains nothing and can interleave: `await` them in sequence.
- **workerd cannot read the project's files**: migrations reach the tests as a binding, read at config time.

## Conventions

- **The Drizzle client is built per request** from `c.env.APP_DB`.
- **Atomic work, and a list's items plus count, is one `db.batch()`**; never `db.transaction()`.
- **Data access tests run in workerd** against a local D1 migrated by the project's migrations.

## Verify it is wired

- No `db.transaction(` and no `Promise.all` over queries in the data layer.
- The integration tests apply `db/migrations/` before the first test.
