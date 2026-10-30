# Hono API on Node

A single-package Hono + Drizzle + Postgres REST API, compiled by `tsc` and run on Node through `@hono/node-server`,
next to Postgres in Docker Compose, with an `entity` CRUDL resource wired from the table to the routes. It is REST API
on Node with Hono in place of Express: the same contract, layers, tests and image, for teams that write Hono.

## Composition

- [Code style](../architecture/code-style.md)
- [pnpm](../technologies/pnpm.md)
- [TypeScript](../technologies/typescript.md)
- [Database](../architecture/database.md)
- [Data access](../architecture/data-access.md)
- [REST API](../architecture/rest-api.md)
- [Node](../technologies/node.md)
- [Node + TypeScript](../integrations/node-typescript.md)
- [Hono](../technologies/hono.md)
- [Hono + Node](../integrations/hono-node.md)
- [Pino](../technologies/pino.md)
- [Postgres](../technologies/postgres.md)
- [Drizzle](../technologies/drizzle.md)
- [Drizzle + Postgres](../integrations/drizzle-postgres.md)
- [Hono + Drizzle](../integrations/hono-drizzle.md)
- [Hono + Pino](../integrations/hono-pino.md)
- [Docker Compose](../technologies/docker-compose.md)
- [Postgres + Docker Compose](../integrations/postgres-docker-compose.md)
- [ESLint](../technologies/eslint.md)
- [TypeScript + ESLint](../integrations/typescript-eslint.md)
- [Prettier](../technologies/prettier.md)
- [ESLint + Prettier](../integrations/eslint-prettier.md)
- [Vitest](../technologies/vitest.md)

## Examples

- [Entity CRUDL](../examples/entity-crudl.md): its resource and its API part, in its Hono variant

## Shape

```
my-api/
├── .dockerignore / .env / .env.example / .gitignore / .prettierignore / .prettierrc
├── coding-conventions.md     # assembled from the stack blueprint
├── docker-compose.yml        # db + api
├── Dockerfile / drizzle.config.ts / eslint.config.js
├── package.json / pnpm-lock.yaml / pnpm-workspace.yaml
├── tsconfig{,.app,.node}.json / vitest.config.ts
├── db/scripts/init.sql, db/migrations/   # the init migration the scaffold generated and committed
├── src/
│   ├── server.ts / app.ts / migrate.ts / logger.ts
│   ├── db/client.ts / db/schema.ts / db/schemas/entity.schema.ts
│   ├── models/               # dao.model, list-input.model, error.model, app-context.model
│   ├── helpers/              # dao.helper, list-input.helper, query-parser.helper
│   ├── daos/entity.dao.ts
│   ├── controllers/          # home, health, entity
│   └── middlewares/          # error (onError and notFound), request-log
└── tests/
    ├── unit/                 # mirrors src/: helpers, db/schemas, controllers, middlewares
    ├── db/entity.dao.test.ts
    ├── api/entity.api.test.ts
    └── utils/                # http-mocks, test-server, pg-container, entity-seed
```

## Required values

`<App name>` is the repo name in Title Case; the database name defaults to `app`.

| What                   | Value                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ports                  | 5432 (Postgres, moved with `DB_PORT`), the API's `PORT` (default 3000)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `pnpm-workspace.yaml`  | `allowBuilds` with `esbuild: true` and `cpu-features`, `protobufjs`, `ssh2` all `false`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| scripts                | `dev` `node --env-file=.env --import=tsx --watch src/server.ts \| pino-pretty --colorize --singleLine --translateTime 'HH:MM:ss.l' --ignore pid,hostname`; `build` `tsc -p tsconfig.app.json`; `start` `node --env-file=.env dist/server.js`; `typecheck` `tsc -p tsconfig.app.json --noEmit && tsc -p tsconfig.node.json`; `lint` `eslint .`; `test` `vitest run --project unit`; `test:integration` `vitest run --project db --project api`; `format`, `format:check` Prettier over `.`; `db:generate`, `db:migrate` as the Drizzle doc says; `compose:up` `docker compose up --build -d --wait`, `compose:down` |
| dependencies           | `hono`, `@hono/node-server`, `zod`, and the Pino, Drizzle and Postgres docs' runtime packages                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| devDependencies        | the Pino, Drizzle and Drizzle + Postgres dev packages; `tsx`, `eslint`, `@eslint/js`, `typescript-eslint`, `eslint-config-prettier`, `globals`, `prettier`, `@types/node@24`, `vitest@5`, and the pinned `typescript`                                                                                                                                                                                                                                                                                                                                                                                              |
| configs                | the tsconfigs, `eslint.config.js` and `vitest.config.ts` under Reference code; `drizzle.config.ts` from Drizzle + Postgres. ESLint turns `@typescript-eslint/require-await` off for `*.controller.ts`, because every handler is `async` for one shape; Vitest sets `env: { LOG_LEVEL: 'silent' }` at the root                                                                                                                                                                                                                                                                                                      |
| `.env.example`         | `DB_PASSWORD`, `DB_PORT=5432`, `DATABASE_URL` (`…@localhost:5432/app`), `PORT=3000`, a commented `LOG_LEVEL`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `docker-compose.yml`   | one top-level `services:` holding Postgres + Docker Compose's `db` service (data at `./db/data`) and the Docker Compose doc's `migrate` and `api` services, in that order                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `.gitignore`           | `node_modules/`, `dist/`, `.env`, `*.log`, `*.tsbuildinfo`, `.DS_Store`, and `db/data/` under a comment                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `.prettierignore`      | `node_modules`, `dist`, `db/migrations`, `db/data`, `pnpm-lock.yaml`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `Dockerfile`, services | the Docker Compose doc's compiled API image and its `migrate` and `api` services, as given                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `.dockerignore`        | `**/node_modules`, `dist`, `.git`, `.env`, `db/data`, `coverage`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |

## Reference code

The config files as a fresh scaffold writes them; the tables above say why each value is there.

`tsconfig.json`:

```jsonc
{
  "files": [],
  "references": [{ "path": "./tsconfig.app.json" }, { "path": "./tsconfig.node.json" }]
}
```

`tsconfig.app.json`:

```jsonc
{
  "compilerOptions": {
    // Environment, modules, output
    "target": "ES2024",
    "lib": ["ES2024"],
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "types": ["node"],
    "moduleDetection": "force",
    "verbatimModuleSyntax": true,
    "erasableSyntaxOnly": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src",
    "sourceMap": true,
    "composite": true,
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.app.tsbuildinfo",

    // Checks
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src/**/*.ts"]
}
```

`tsconfig.node.json`:

```jsonc
{
  "extends": "./tsconfig.app.json",
  "compilerOptions": {
    // Environment, modules, output
    "composite": false,
    "noEmit": true,
    "outDir": null,
    "rootDir": ".",
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.node.tsbuildinfo"
  },
  "include": ["src/**/*.ts", "tests/**/*.ts", "drizzle.config.ts", "vitest.config.ts"]
}
```

`eslint.config.js`:

```js
import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import eslintConfigPrettier from 'eslint-config-prettier/flat';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig(
  globalIgnores(['**/node_modules/**', '**/coverage/**', '**/.cache/**', '**/*.tsbuildinfo', 'dist/**', 'db/**', 'eslint.config.js']),
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      globals: globals.node,
      parserOptions: {
        // src/ belongs to tsconfig.app.json; tests and config files to tsconfig.node.json.
        projectService: true,
        tsconfigRootDir: import.meta.dirname
      }
    }
  },
  eslintConfigPrettier,
  {
    rules: {
      // Correctness
      curly: 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports', fixStyle: 'inline-type-imports' }],
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_', ignoreRestSiblings: true }
      ],
      '@typescript-eslint/no-non-null-assertion': 'error',

      // Complexity and size guardrails
      complexity: ['warn', 10],
      'max-depth': ['warn', 4],
      'max-lines-per-function': ['warn', 75],
      'max-statements': ['warn', 20],
      'max-params': ['warn', 4],
      'max-nested-callbacks': ['warn', 3],
      'max-lines': ['warn', { max: 400, skipBlankLines: true, skipComments: true }],

      // Clarity and simplicity
      'no-else-return': 'warn',
      'no-nested-ternary': 'warn',
      'no-unneeded-ternary': 'warn'
    }
  },
  {
    // Every handler is async for one shape, even where nothing is awaited.
    files: ['**/*.controller.ts'],
    rules: { '@typescript-eslint/require-await': 'off' }
  },
  {
    // A describe holds every case for one module.
    files: ['tests/**/*.ts'],
    rules: { 'max-lines-per-function': 'off', 'max-nested-callbacks': 'off', 'max-statements': 'off' }
  }
);
```

`vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    env: { LOG_LEVEL: 'silent' },
    projects: [
      { extends: true, test: { name: 'unit', include: ['tests/unit/**/*.test.ts'] } },
      { extends: true, test: { name: 'db', include: ['tests/db/**/*.test.ts'], hookTimeout: 120_000, testTimeout: 30_000 } },
      { extends: true, test: { name: 'api', include: ['tests/api/**/*.test.ts'], hookTimeout: 120_000, testTimeout: 30_000 } }
    ]
  }
});
```

## Scaffold

- **Check the ports first**; stop with the user if one is taken, or set another `PORT` in `.env`.
- **The manifest is written by the tools** (`pnpm init`, `pnpm pkg set`), with `type: "module"`.
- **`cp .env.example .env`** once `.env.example` is written.
- **Generate the `init` migration before the first `compose:up`**: the image carries `db/migrations/`, and the
  `migrate` service applies it before the API starts. It produces exactly one migration, committed with the scaffold.

## Conventions

### Layout

| Path               | Holds                                                                              |
| ------------------ | ---------------------------------------------------------------------------------- |
| `src/server.ts`    | the composition root: the pool, the DAOs, the `AppContext`, the listener, shutdown |
| `src/app.ts`       | `createApp(context)`: middleware, every route, the not-found and error handlers    |
| `src/controllers/` | one file per resource, one handler per route                                       |
| `src/daos/`        | one DAO per table                                                                  |
| `src/db/`          | the client, the schema registry, one schema file per resource                      |
| `tests/`           | `unit/` mirrors `src/`; `db/` per DAO; `api/` per resource; `utils/`               |
| `db/`              | `scripts/init.sql`, the bind-mounted data, and the generated `migrations/`         |

### Commands

| Command                                      | Does                                                    | Needs                          |
| -------------------------------------------- | ------------------------------------------------------- | ------------------------------ |
| `pnpm dev`                                   | the API with `node --watch`, logs through `pino-pretty` | Postgres, `.env`               |
| `pnpm build` / `pnpm start`                  | compile to `dist/` / run it                             | — / Postgres, `.env`           |
| `pnpm test:integration`                      | the `db` and `api` projects (Testcontainers)            | Docker, `db/migrations/`       |
| `pnpm compose:up` / `pnpm compose:down`      | the API image next to Postgres                          | Docker                         |
| `pnpm db:generate --name <n>` / `db:migrate` | write a migration / apply pending ones                  | `.env`, Postgres for `migrate` |

`build`, `typecheck`, `test`, `lint` and `format:check` are the five required checks.

### HTTP contract

| Route                  | Success                                                | Errors                                                                      |
| ---------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------- |
| `GET /`                | 200 `{ service, status }`                              | —                                                                           |
| `GET /health`          | 200 `{ status: 'ok', db: 'up', latencyMs, timestamp }` | 503 `Database connection failed`                                            |
| `GET /entities`        | 200 `PaginatedResult<Entity>`                          | 400 `Unknown query params: …`, `filter must be valid JSON`, `Invalid query` |
| `POST /entities`       | 201 the created row                                    | 400 `Invalid body`; 400 malformed JSON, 413 over 100 kB                     |
| `GET /entities/:id`    | 200 the row                                            | 400 `Invalid id`; 404 `Entity not found: <id>`                              |
| `PATCH /entities/:id`  | 200 the updated row                                    | 400 `Invalid id` / `Invalid body` (including no updatable field); 404       |
| `DELETE /entities/:id` | 204, no body                                           | 400 `Invalid id`; 404                                                       |
| anything else          | —                                                      | 404 `Not Found: <METHOD> <path>`                                            |

### Testing tiers

| Tier       | Lives in                       | Real                                   | Run                     |
| ---------- | ------------------------------ | -------------------------------------- | ----------------------- |
| unit       | `tests/unit/` (mirrors `src/`) | the function; DAO and HTTP stubbed     | `pnpm test`             |
| DAO        | `tests/db/`                    | DAO, Drizzle, Postgres                 | `pnpm test:integration` |
| end to end | `tests/api/`                   | HTTP, Hono, controllers, DAO, Postgres | `pnpm test:integration` |

| Change                             | Tests                                                                         |
| ---------------------------------- | ----------------------------------------------------------------------------- |
| a filter operator or scalar kind   | the translator and builder unit tests; a DAO case only if Postgres decides it |
| a filterable or sortable column    | the resource's schema test                                                    |
| a validation rule or error mapping | the controller unit test                                                      |
| a route                            | the controller unit test and the resource's API test                          |
| a DAO method or query path         | the DAO test and the API test for its route                                   |
| a change to `app.ts`               | the API test                                                                  |

### Adding a resource

Copy `entity.schema.ts` (the same order, no comments) and register the table in `db/schema.ts`; copy `entity.dao.ts`;
add the DAO to `AppContext` and build it in `server.ts`; copy `entity.controller.ts` and mount its handlers in `app.ts`;
add the schema, controller (with a stub in `createStubContext`), DAO (with a seed file) and API tests; then
`pnpm db:generate --name add-<resource>` and `pnpm db:migrate`.

### Before you merge

- [ ] The five checks pass; `pnpm test:integration` if you touched the DAOs, schemas, controllers or `app.ts`.
- [ ] A schema change comes with its migration, committed.
- [ ] A change to a response's shape is a change to the API's clients, made in the same commit where they live here.

## Smoke test

```sh
pnpm db:generate --name init                  # exactly one migration
pnpm compose:up                               # db healthy, migrate exits 0, then api
pnpm test:integration
curl -s http://localhost:3000/health          # {"status":"ok","db":"up",…}
```

`docker compose ps -a` shows `migrate` exited 0. Through the API, `POST /entities` creates, a filtered, sorted, paged
`GET /entities` answers `{ items, total, page, pageSize, totalPages }`, an unknown filter field is a 400, `PATCH`
updates, `DELETE` answers 204 and then 404.
