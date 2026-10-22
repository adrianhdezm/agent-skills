# API setup

The `api/` package's manifest, configs, app shell and container. The DAO layer is in `api-dao.md` and the entity
example in `api-entity.md`.

## Contents

- [Shape](#shape)
- [`api/package.json`](#apipackagejson)
- [Dependencies](#dependencies)
- [TypeScript (3 files)](#typescript-3-files)
- [`api/drizzle.config.ts`](#apidrizzleconfigts)
- [`api/vitest.config.ts`](#apivitestconfigts)
- [`api/src/express.d.ts`](#apisrcexpressdts)
- [`api/src/models/app-context.model.ts`](#apisrcmodelsapp-contextmodelts)
- [`api/src/logger.ts`](#apisrcloggerts)
- [`api/src/db/client.ts`](#apisrcdbclientts)
- [`api/src/server.ts`](#apisrcserverts)
- [`api/src/app.ts`](#apisrcappts)
- [`api/src/middleware/error.middleware.ts`](#apisrcmiddlewareerrormiddlewarets)
- [`api/src/middleware/not-found.middleware.ts`](#apisrcmiddlewarenot-foundmiddlewarets)
- [`api/Dockerfile`](#apidockerfile)
- [`api/db/scripts/init.sql`](#apidbscriptsinitsql)
- [First-run migration](#first-run-migration)

## Shape

```
api/
├── package.json
├── tsconfig.json            # pure solution root
├── tsconfig.app.json        # src/, the program
├── tsconfig.node.json       # tests/ and the config files
├── drizzle.config.ts
├── vitest.config.ts
├── eslint.config.mjs        # see eslint-prettier.md
├── .prettierrc / .prettierignore
├── Dockerfile               # built from the repo root (see monorepo-root.md)
├── db/
│   └── scripts/init.sql
├── src/
│   ├── express.d.ts         # ambient Express.Locals augmentation
│   ├── logger.ts
│   ├── app.ts               # createApp(context), a pure factory
│   ├── server.ts            # http listener + DAO wiring
│   ├── db/
│   │   ├── client.ts
│   │   ├── schema.ts        # table registry, api-entity.md
│   │   └── schemas/
│   │       └── entity.schema.ts  # api-entity.md
│   ├── models/
│   │   ├── app-context.model.ts
│   │   ├── dao.model.ts     # api-dao.md
│   │   ├── list-input.model.ts   # api-dao.md
│   │   └── error.model.ts   # api-dao.md
│   ├── helpers/
│   │   ├── dao.helper.ts    # api-dao.md
│   │   └── query-parser.helper.ts  # api-dao.md
│   ├── daos/                # entity.dao.ts, api-entity.md
│   ├── controllers/         # api-entity.md
│   └── middleware/
│       ├── error.middleware.ts
│       └── not-found.middleware.ts
└── tests/                   # mirrors src/, one *.test.ts per module
    ├── helpers/dao.helper.test.ts
    ├── helpers/query-parser.helper.test.ts
    ├── db/schemas/entity.schema.test.ts
    └── controllers/entity.controller.test.ts
```

**No `db/migrations/` is shipped.** The scaffold writes the schema source only; the first `pnpm db:generate` emits one
fresh migration locally.

## `api/package.json`

Scripts and metadata only. Dependencies are added with `pnpm add` (next section) so they resolve to current versions.

```json
{
  "name": "api",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "node --env-file=../.env --import=tsx --watch src/server.ts | pino-pretty --colorize --singleLine --translateTime 'HH:MM:ss.l' --ignore pid,hostname,req.headers,res.headers",
    "build": "tsc -p tsconfig.app.json",
    "typecheck": "tsc -p tsconfig.app.json --noEmit && tsc -p tsconfig.node.json",
    "lint": "eslint .",
    "test": "vitest run",
    "format": "prettier --write \"**/*.{ts,js,mjs,json,md,yml,yaml}\"",
    "format:check": "prettier --check \"**/*.{ts,js,mjs,json,md,yml,yaml}\"",
    "start": "node --env-file=../.env dist/server.js",
    "db:generate": "node --env-file=../.env node_modules/drizzle-kit/bin.cjs generate",
    "db:migrate": "node --env-file=../.env node_modules/drizzle-kit/bin.cjs migrate"
  }
}
```

Rules:

- `dev` uses `node --import=tsx --watch` (not `tsx watch`) and pipes to pino-pretty for readable logs.
- Both `dev` and `start` use **strict** `--env-file=../.env` (no `-if-exists`).
- `db:*` scripts run drizzle-kit's bin **under node with `--env-file`** because drizzle-kit does not load `.env`.
- Only `db:generate` and `db:migrate`; there is no `db:push`.
- `typecheck` runs **both** tsconfigs so the tests and config files are type-checked too.

## Dependencies

Run from the repo root, after the web app exists, so the shared tooling lands in the catalog once for both projects:

```sh
pnpm --filter api add cors drizzle-orm drizzle-zod express http-errors pg pino pino-http zod
pnpm --filter api add -D @types/cors @types/express @types/http-errors @types/node@24 @types/pg \
  drizzle-kit pino-pretty tsx vitest
```

`@types/node` follows the Node major the Dockerfile runs (24). The shared tooling (ESLint, Prettier, TypeScript) is
added by the root step in `monorepo-root.md`.

## TypeScript (3 files)

### `api/tsconfig.json`

**No `compilerOptions`.** Pure solution root.

```json
{
  "files": [],
  "references": [{ "path": "./tsconfig.app.json" }, { "path": "./tsconfig.node.json" }]
}
```

### `api/tsconfig.app.json`

```json
{
  "compilerOptions": {
    "composite": true,
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.app.tsbuildinfo",
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "types": ["node"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "sourceMap": true
  },
  "include": ["src/**/*.ts"]
}
```

- `types: ["node"]` is required: TypeScript 6 defaults `types` to `[]`, so without it `process` and `node:*` imports do
  not resolve.
- The `src/**/*.ts` glob matches `.d.ts` files too, so `src/express.d.ts` is picked up without further config.

### `api/tsconfig.node.json`

Everything Node runs that is not part of the build: the tests and the two config files.

```json
{
  "extends": "./tsconfig.app.json",
  "compilerOptions": {
    "composite": false,
    "noEmit": true,
    "rootDir": ".",
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.node.tsbuildinfo"
  },
  "include": ["drizzle.config.ts", "vitest.config.ts", "tests/**/*.ts"]
}
```

`composite` is switched off because the tests import from `src/`, which this project does not list. Every new config
file goes into `include`, or ESLint reports it as belonging to no project.

## `api/drizzle.config.ts`

```ts
import { type Config, defineConfig } from 'drizzle-kit';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required');
}

export default defineConfig({
  out: './db/migrations',
  schema: './src/db/schemas/*.schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL
  },
  migrations: {
    prefix: 'timestamp',
    table: '__migrations__',
    schema: 'public'
  }
}) satisfies Config;
```

No fallback for `DATABASE_URL`: it throws loud and early. `schema` points at the per-resource schema files, not at
`db/schema.ts`: drizzle-kit discovers tables from module exports, and `db/schema.ts` only groups them in an object.

## `api/vitest.config.ts`

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    // pino-http logs every request; keep test output readable.
    env: { LOG_LEVEL: 'silent' }
  }
});
```

Tests import sources with the `.js` extension, as the sources do; Vite resolves them to the `.ts` files. No test opens
a database connection: DAO-level code is tested through the SQL it builds, and controllers through `createApp` with a
fake DAO on the context.

## `api/src/express.d.ts`

Ambient module augmentation lives at the `src/` root, not under `models/`: it is TypeScript tooling, not a model.

```ts
import type { AppContext } from './models/app-context.model.js';

// Make the injected AppContext available (and typed) on app.locals / res.locals.
declare global {
  namespace Express {
    interface Locals {
      context: AppContext;
    }
  }
}

export {};
```

## `api/src/models/app-context.model.ts`

```ts
import type { DbClient } from '../db/client.js';
import type { EntityDao } from '../daos/entity.dao.js';

/**
 * Dependencies the Express app needs at construction time. Stored on
 * app.locals so controllers can read them via req.app.locals.context
 * instead of importing singletons directly, which keeps them testable.
 *
 * `db` is kept available for queries that don't belong to a DAO (e.g. the
 * health probe's `SELECT 1`); feature code should prefer the typed DAOs.
 */
export interface AppContext {
  db: DbClient;
  entityDao: EntityDao;
}
```

## `api/src/logger.ts`

```ts
import { pino } from 'pino';

const isProduction = process.env.NODE_ENV === 'production';

// Emits structured JSON. For readable local output, pipe through pino-pretty
// (see the `dev` script in package.json).
export const logger = pino({
  level: process.env.LOG_LEVEL ?? (isProduction ? 'info' : 'debug')
});
```

**No `transport` in code.** Pretty-printing is a pipe in the `dev` script only.

## `api/src/db/client.ts`

```ts
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { schema } from './schema.js';
import { logger } from '../logger.js';

const connectionString = process.env.DATABASE_URL ?? 'postgres://postgres:s3cr3t@localhost:5432/app';

export const pool = new Pool({ connectionString });
export const db = drizzle(pool, { schema });

export type DbClient = typeof db;

// Idle clients can emit errors (e.g. the DB restarts or drops the connection).
// Without a listener, pg lets the error reach the process and crash it.
pool.on('error', (err) => {
  logger.error({ err }, 'Unexpected error on idle Postgres client');
});
```

The idle-error listener is **not optional**. Without it, a transient DB drop crashes the process.

## `api/src/server.ts`

Composition root: constructs the DB client, instantiates every DAO, assembles the `AppContext`, and wires the HTTP
listener.

```ts
import { createServer } from 'node:http';
import { createApp } from './app.js';
import type { AppContext } from './models/app-context.model.js';
import { db, pool } from './db/client.js';
import { logger } from './logger.js';
import { EntityDao } from './daos/entity.dao.js';

const port = Number(process.env.PORT ?? 3000);

const context: AppContext = {
  db,
  entityDao: new EntityDao(db)
};
const app = createApp(context);
const server = createServer(app);

server.listen(port, () => {
  logger.info({ port }, `[api] listening on http://localhost:${port}`);
});

// Graceful shutdown: stop accepting connections, then close the pg pool.
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    logger.info({ signal }, 'Shutting down');
    server.close(() => {
      void pool.end().finally(() => process.exit(0));
    });
  });
}
```

## `api/src/app.ts`

```ts
import express, { type Express } from 'express';
import cors from 'cors';
import { pinoHttp } from 'pino-http';
import { logger } from './logger.js';
import type { AppContext } from './models/app-context.model.js';
import { errorHandler } from './middleware/error.middleware.js';
import { notFoundMiddleware } from './middleware/not-found.middleware.js';
import { healthController } from './controllers/health.controller.js';
import { homeController } from './controllers/home.controller.js';
import { createEntity, deleteEntity, getEntity, listEntities, updateEntity } from './controllers/entity.controller.js';

export function createApp(context: AppContext): Express {
  const app = express();
  app.locals.context = context; // singleton — not a middleware

  app.use(pinoHttp({ logger }));
  app.use(cors());
  app.use(express.json());

  app.get('/', homeController);
  app.get('/health', healthController);

  app.get('/entities', listEntities);
  app.post('/entities', createEntity);
  app.get('/entities/:id', getEntity);
  app.patch('/entities/:id', updateEntity);
  app.delete('/entities/:id', deleteEntity);

  // Unmatched routes -> 404, then the terminal error handler.
  app.use(notFoundMiddleware);
  app.use(errorHandler);

  return app;
}
```

No `routes/` module. No context middleware. Controllers wire directly on `app`.

## `api/src/middleware/error.middleware.ts`

```ts
import type { NextFunction, Request, Response } from 'express';
import { isHttpError } from 'http-errors';

// Express identifies error handlers by their 4-argument signature.
export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction): void {
  const status = isHttpError(err) ? err.statusCode : 500;

  if (res.headersSent) {
    next(err);
    return;
  }

  // Severity follows status: 5xx are unexpected server faults, 4xx are routine client mistakes.
  if (status >= 500) {
    req.log.error({ err }, 'Request failed with server error');
  } else {
    req.log.warn({ err }, 'Request failed with client error');
  }

  const message = isHttpError(err) && err.expose ? err.message : 'Internal Server Error';

  res.status(status).json({
    status: 'error',
    message
  });
}
```

## `api/src/middleware/not-found.middleware.ts`

```ts
import type { NextFunction, Request, Response } from 'express';
import createError from 'http-errors';

export function notFoundMiddleware(req: Request, _res: Response, next: NextFunction): void {
  next(createError(404, `Not Found: ${req.method} ${req.originalUrl}`));
}
```

## `api/Dockerfile`

Built with the **repo root** as context (`docker-compose.yml` sets `context: .`), because the manifest's `catalog:`
entries resolve only against the root `pnpm-workspace.yaml` and lockfile. Corepack reads the pnpm version from the root
`package.json`'s `packageManager` field.

```dockerfile
# Build stage
FROM node:24-alpine AS build
RUN corepack enable
WORKDIR /repo
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY api/package.json api/
# tsx/drizzle-kit pull esbuild, but the build (tsc) and runtime (node) never
# invoke it, so skip install scripts.
RUN pnpm install --filter api --frozen-lockfile --ignore-scripts
COPY api/ api/
RUN pnpm --filter api build

# Runtime stage
FROM node:24-alpine AS runtime
RUN corepack enable
WORKDIR /repo
ENV NODE_ENV=production
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY api/package.json api/
RUN pnpm install --filter api --prod --frozen-lockfile --ignore-scripts
COPY --from=build /repo/api/dist api/dist
WORKDIR /repo/api
EXPOSE 3000
CMD ["node", "dist/server.js"]
```

The root `.dockerignore` (in `monorepo-root.md`) keeps `node_modules`, `dist`, `.env` and the Postgres data out of the
context.

## `api/db/scripts/init.sql`

```sql
-- Create a new database named 'app'
CREATE DATABASE app;

-- Grant all privileges on the 'app' database to the 'postgres' user
GRANT ALL PRIVILEGES ON DATABASE app TO postgres;
```

Mounted by Compose into `/docker-entrypoint-initdb.d/`. Runs **only on first init** (when `api/db/data/` is empty). To
reset the DB locally: `rm -rf api/db/data` and `docker compose up db`.

## First-run migration

The scaffold does **not** ship a `db/migrations/` directory. After scaffolding:

```bash
docker compose up -d db                       # start Postgres
pnpm --filter api db:generate --name init     # one fresh snapshot
pnpm --filter api db:migrate                  # apply it
```
