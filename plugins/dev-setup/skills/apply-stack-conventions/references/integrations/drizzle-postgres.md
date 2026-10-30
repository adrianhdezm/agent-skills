# Drizzle + Postgres

Drizzle over Postgres: the `node-postgres` client on the shared pool, the `postgresql` dialect for migrations, Postgres
column types in the schema files, and Testcontainers for the data layer's tests. React Router on Node and the Angular
full stack use it.

## The seam

```
createDbClient(DATABASE_URL), once per process ─► pg Pool (error listener) ─► drizzle(pool, { schema }) from drizzle-orm/node-postgres
drizzle.config.ts (dialect: 'postgresql', dbCredentials.url) ─► drizzle-kit generate / migrate
tests: Testcontainers postgres:17-alpine ─► Drizzle migrator ─► DAO suites
```

## Required values

| What                | Value                                                                                                                                                                                                             |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| dependencies        | `pg`                                                                                                                                                                                                              |
| devDependencies     | `@types/pg`, `@testcontainers/postgresql`                                                                                                                                                                         |
| client              | `createDbClient(url)` returning `{ pool, db }`, `DbClient` the `NodePgDatabase` type                                                                                                                              |
| `drizzle.config.ts` | `dialect: 'postgresql'`, `dbCredentials.url` from `DATABASE_URL` (throws when unset)                                                                                                                              |
| scripts             | `db:generate` and `db:migrate`, each `node --env-file=<root .env> node_modules/drizzle-kit/bin.cjs generate` / `migrate`                                                                                          |
| schema              | `pgTable`; `uuid('id').primaryKey().defaultRandom()`; `timestamp(…, { withTimezone: true }).defaultNow()`; `text`                                                                                                 |
| Vitest projects     | `unit` (no database), `db` and `api` (Testcontainers; `hookTimeout: 120_000`, `testTimeout: 30_000` for the first image pull); `test` runs `--project unit`, `test:integration` runs `--project db --project api` |
| `allowBuilds`       | `cpu-features`, `protobufjs`, `ssh2` set to `false`: optional native dependencies of Testcontainers that the local Docker socket never needs                                                                      |

## Reference code

The one pool, its idle-error listener, and the Drizzle client on it; the caller keeps `pool` to close it on shutdown
(`app/db/client.ts` in React Router, with `~/` imports).

`src/db/client.ts`:

```ts
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { logger } from '../logger.js';
import { schema } from './schema.js';

export type DbClient = NodePgDatabase<typeof schema>;

/** The one pool of the process and the Drizzle client on it. An idle client's error is logged, not fatal. */
export function createDbClient(connectionString: string): { pool: Pool; db: DbClient } {
  const pool = new Pool({ connectionString });
  pool.on('error', (error) => {
    logger.error({ err: error }, 'Idle database client error');
  });
  return { pool, db: drizzle(pool, { schema }) };
}
```

The migration entry applies the committed migrations with drizzle-orm's own migrator, a production dependency, so the
image needs no drizzle-kit; the engine's Compose integration runs it before the app.

`src/migrate.ts`:

```ts
import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';

// Applies db/migrations/ and exits: Compose runs it before the API, from the same image.
const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error('DATABASE_URL is not set');
}
const pool = new Pool({ connectionString: url });
try {
  const migrationsFolder = fileURLToPath(new URL('../db/migrations', import.meta.url));
  await migrate(drizzle(pool), { migrationsFolder, migrationsTable: '__migrations__', migrationsSchema: 'public' });
} finally {
  await pool.end();
}
```

## Pitfalls

- **drizzle-kit does not load `.env`**: run its bin under `node --env-file`.
- **Integration tests need Docker** as well as an existing `db/migrations/`.
- **SQL in translator tests renders through `PgDialect`**: the unit tests check the Postgres SQL, so `ilike` and casts
  match what runs.

## Conventions

- **The Drizzle client wraps the one pool**; it is typed `DbClient` and built by the composition root.
- **drizzle-kit runs under `node --env-file`** with the `postgresql` dialect.
- **Each DAO suite gets its own Testcontainers Postgres**, migrated by the Drizzle migrator; the end-to-end suite its
  own database in the Compose service.

## Verify it is wired

- `drizzle.config.ts` throws without `DATABASE_URL`.
- `pnpm test:integration` starts a container per suite and passes from a clean machine with Docker running.
