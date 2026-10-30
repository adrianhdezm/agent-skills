# Angular full stack

A pnpm-workspace monorepo: an Express 5 + Drizzle + Postgres API in `api/` and the Angular web package in `web/`, run by
Docker Compose, with an `entity` CRUDL example wired end to end from the database to the pages, and a Playwright suite
over the whole stack. SAP Fiori Horizon components are opt-in.

## Composition

- [Code style](../architecture/code-style.md)
- [pnpm](../technologies/pnpm.md)
- [TypeScript](../technologies/typescript.md)
- [Database](../architecture/database.md)
- [Data access](../architecture/data-access.md)
- [REST API](../architecture/rest-api.md)
- [Node](../technologies/node.md)
- [Node + TypeScript](../integrations/node-typescript.md)
- [Express](../technologies/express.md)
- [Postgres](../technologies/postgres.md)
- [Drizzle](../technologies/drizzle.md)
- [Drizzle + Postgres](../integrations/drizzle-postgres.md)
- [Express + Drizzle](../integrations/express-drizzle.md)
- [UI components](../architecture/ui-components.md)
- [Angular](../technologies/angular.md)
- [NgRx](../technologies/ngrx.md)
- [Tailwind](../technologies/tailwind.md)
- [Angular + Tailwind](../integrations/angular-tailwind.md)
- [Storybook](../technologies/storybook.md)
- [Angular + Storybook](../integrations/angular-storybook.md)
- [Nginx](../technologies/nginx.md)
- [Angular + Nginx](../integrations/angular-nginx.md)
- [Angular + Fundamental NGX](../integrations/angular-fundamental-ngx.md) — optional
- [Angular + the API contract](../integrations/angular-api-contract.md)
- [Docker Compose](../technologies/docker-compose.md)
- [Postgres + Docker Compose](../integrations/postgres-docker-compose.md)
- [Express + Docker Compose](../integrations/express-docker-compose.md)
- [Nginx + Docker Compose](../integrations/nginx-docker-compose.md)
- [ESLint](../technologies/eslint.md)
- [TypeScript + ESLint](../integrations/typescript-eslint.md)
- [Prettier](../technologies/prettier.md)
- [ESLint + Prettier](../integrations/eslint-prettier.md)
- [Angular + ESLint](../integrations/angular-eslint.md)
- [Angular + Prettier](../integrations/angular-prettier.md)
- [Vitest](../technologies/vitest.md)
- [Angular + Vitest](../integrations/angular-vitest.md)

## Examples

- [Entity CRUDL](../examples/entity-crudl.md): all of it, the API, the web and the end-to-end suite, with its
  Fundamental NGX variant when opted in

## Shape

```
my-app/
├── .dockerignore / .env / .env.example / .gitignore
├── coding-conventions.md     # assembled from the stack blueprint
├── docker-compose.yml        # db + api + web
├── package.json              # root scripts; packageManager
├── pnpm-lock.yaml / pnpm-workspace.yaml   # packages + catalog + allowBuilds
├── api/
│   ├── Dockerfile / drizzle.config.ts / eslint.config.mjs / .prettierrc / .prettierignore
│   ├── package.json / tsconfig{,.app,.node}.json / vitest.config.ts
│   ├── db/scripts/init.sql   # no db/migrations/ is shipped
│   ├── src/
│   │   ├── server.ts / app.ts / logger.ts / express.d.ts
│   │   ├── db/client.ts / db/schema.ts / db/schemas/entity.schema.ts
│   │   ├── models/           # dao.model, list-input.model, error.model, app-context.model
│   │   ├── helpers/          # dao.helper, list-input.helper, query-parser.helper
│   │   ├── daos/entity.dao.ts
│   │   ├── controllers/      # home, health, entity
│   │   └── middlewares/      # error, not-found
│   └── tests/
│       ├── unit/             # mirrors src/: helpers, db/schemas, controllers, middlewares
│       ├── db/entity.dao.test.ts
│       ├── api/entity.api.test.ts
│       └── utils/            # http-mocks, test-server, pg-container, entity-seed
└── web/                      # the Angular app's package, plus the e2e suite:
    ├── tsconfig.node.json    # vitest.config.mts and playwright.config.ts, as in the Angular app
    ├── playwright.config.ts
    └── e2e/                  # global-setup, global-teardown, tsconfig.json, pages/, utils/{env,api}.ts
```

## Compose

The `db` service from [Postgres + Docker Compose](../integrations/postgres-docker-compose.md#required-values) with `<owner>` = `api`,
then:

- **`api`**: the Express + Docker Compose service, with `build: { context: ., dockerfile: api/Dockerfile }` and ports
  `'3000:3000'`.
- **`web`**: `build: { context: ., dockerfile: web/Dockerfile }`, ports `'4200:80'` (Nginx listens on 80), depending on
  `api`.

Both images build from the repo root, copying the root manifests and their own, and installing with
`--filter <pkg> --frozen-lockfile`. The API image installs with `--ignore-scripts` in both stages (its build and runtime
never run esbuild), builds with `pnpm --filter api build`, and runs `node dist/server.js` from `api/` with
`NODE_ENV=production`. The web image builds with `pnpm --filter web build` and copies `web/dist/web/browser` and
`web/nginx.conf` into Nginx.

## Where it differs from the shared tooling

- **Two packages with their own configs**, the shared tool versions in the root catalog, and the Angular CLI's tsconfig
  layout in `web/`. The API compiles with `composite` and `outDir`, as Node + TypeScript says.
- **`lint` passes warnings**: no `--max-warnings 0`.
- **Web specs sit beside the file they test**, and `null` marks absence in the DAO contract and the store slices.

## Required values

`<App name>` is the repo name in Title Case; the database name defaults to `app`.

| What                  | Value                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ports                 | 5432 (Postgres, moved with `DB_PORT`), 3000 (API), 4200 (web), 3100 and 4300 (the e2e API and web), 6006 (Storybook)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `pnpm-workspace.yaml` | `packages: [api, web]`; `allowBuilds` with `esbuild: true` and `'@parcel/watcher'`, `cpu-features`, `lmdb`, `msgpackr-extract`, `protobufjs`, `ssh2` all `false`; the catalog                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| root `package.json`   | `name`, `version: "0.0.0"`, `private: true`, `engines.node: ">=24"`, `packageManager`; no Prettier or ESLint of its own                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| root scripts          | `dev:api` `pnpm --filter api dev`; `dev:web` `pnpm --filter web start`; `build`, `typecheck`, `lint`, `test`, `format`, `format:check` `pnpm -r <script>`; `test:integration` `pnpm --filter api test:integration`; `test:browser` `pnpm --filter web test:browser`; `test:e2e` `pnpm --filter web test:e2e`; `storybook` `pnpm --filter web storybook`; `compose:up` `docker compose up --build -d --wait`; `compose:down` `docker compose down`                                                                                                                                                              |
| `.gitignore`          | `node_modules/`, `dist/`, `.env`, `*.log`, `*.tsbuildinfo`, `.angular/`, `.vitest/`, `.DS_Store`, and `api/db/data/` under a comment                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `.dockerignore`       | `**/node_modules`, `**/dist`, `**/.angular`, `.git`, `.env`, `api/db`, `web/storybook-static`, `web/test-results`, `web/playwright-report`, `web/.vitest`                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `.env.example`        | `DB_PASSWORD`, `DB_PORT=5432`, `DATABASE_URL` (`…@localhost:5432/app`), `PORT=3000`, a commented `LOG_LEVEL`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| shared tooling        | in the catalog, read as `catalog:` by both packages: `eslint`, `@eslint/js`, `typescript-eslint`, `eslint-config-prettier`, `globals`, `prettier`, `@types/node@24`, `vitest@5`, and the exact `typescript`                                                                                                                                                                                                                                                                                                                                                                                                    |
| `api/package.json`    | `name: "api"`, `version: "0.0.0"`, `private`, `type: "module"`, written by hand; dependencies from the Express and Drizzle docs                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| API scripts           | `dev` `node --env-file=../.env --import=tsx --watch src/server.ts \| pino-pretty --colorize --singleLine --translateTime 'HH:MM:ss.l' --ignore pid,hostname,req.headers,res.headers`; `build` `tsc -p tsconfig.app.json`; `typecheck` `tsc -p tsconfig.app.json --noEmit && tsc -p tsconfig.node.json`; `lint` `eslint .`; `test` `vitest run --project unit`; `test:integration` `vitest run --project db --project api`; `format`, `format:check` Prettier over `"**/*.{ts,js,mjs,json,md,yml,yaml}"`; `start` `node --env-file=../.env dist/server.js`; `db:generate`, `db:migrate` as the Drizzle doc says |
| API configs           | the tsconfigs, `eslint.config.mjs` and `vitest.config.ts` under Reference code; `drizzle.config.ts` from Drizzle + Postgres; `.prettierignore` `node_modules`, `dist`, `db/migrations`, `db/data`                                                                                                                                                                                                                                                                                                                                                                                                              |
| web package           | the Angular app blueprint's values with `<name>` = `web`, minus `packageManager` and the CLI's `prettier` and `typescript` entries (the catalog has them); the browser calls the API directly and Nginx proxies nothing                                                                                                                                                                                                                                                                                                                                                                                        |
| e2e                   | `@playwright/test@1`; the example's End to end values; `playwright.config.ts` is in the web's `tsconfig.node.json`; the web `typecheck` adds `&& tsc -p e2e/tsconfig.json --noEmit`                                                                                                                                                                                                                                                                                                                                                                                                                            |

## Reference code

The API's configs as a fresh scaffold writes them (strict presets), and the web's ESLint config (`recommendedTypeChecked`, scoped to `**/*.ts`); the web's tsconfigs and `vitest.config.mts` are the Angular app blueprint's. The tables above say why each value is there.

`api/tsconfig.json`:

```jsonc
{
  "files": [],
  "references": [{ "path": "./tsconfig.app.json" }, { "path": "./tsconfig.node.json" }]
}
```

`api/tsconfig.app.json`:

```jsonc
{
  "compilerOptions": {
    // Environment, modules, output
    "target": "ES2022",
    "lib": ["ES2024"],
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "moduleDetection": "force",
    "types": ["node"],
    "outDir": "dist",
    "rootDir": "src",
    "sourceMap": true,
    "composite": true,
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.app.tsbuildinfo",
    "verbatimModuleSyntax": true,
    "erasableSyntaxOnly": true,
    "isolatedModules": true,
    "skipLibCheck": true,

    // Checks
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src/**/*.ts"]
}
```

`api/tsconfig.node.json`:

```jsonc
{
  "extends": "./tsconfig.app.json",
  "compilerOptions": {
    "composite": false,
    "noEmit": true,
    "rootDir": ".",
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.node.tsbuildinfo"
  },
  "include": ["drizzle.config.ts", "vitest.config.ts", "src/express.d.ts", "tests/**/*.ts"]
}
```

`api/eslint.config.mjs`:

```js
import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import prettier from 'eslint-config-prettier/flat';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores(['**/node_modules/**', '**/coverage/**', '**/.cache/**', '**/*.tsbuildinfo', 'dist/**', 'db/**', 'eslint.config.mjs']),
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      globals: globals.node,
      parserOptions: {
        // src/ belongs to tsconfig.app.json; config files and tests to tsconfig.node.json.
        projectService: true,
        tsconfigRootDir: import.meta.dirname
      }
    }
  },
  prettier,
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
    // Every handler is `async` for one shape, whether or not it awaits.
    files: ['**/*.controller.ts'],
    rules: { '@typescript-eslint/require-await': 'off' }
  },
  {
    // A describe holds every case for one module.
    files: ['tests/**/*.ts'],
    rules: { 'max-lines-per-function': 'off', 'max-nested-callbacks': 'off', 'max-statements': 'off' }
  }
]);
```

`api/vitest.config.ts`:

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

`web/eslint.config.mjs`:

```js
import js from '@eslint/js';
import angular from 'angular-eslint';
import prettier from 'eslint-config-prettier/flat';
import { defineConfig, globalIgnores } from 'eslint/config';
import storybook from 'eslint-plugin-storybook';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores([
    '**/node_modules/**',
    '**/coverage/**',
    '**/.cache/**',
    '**/*.tsbuildinfo',
    'dist/**',
    '.angular/**',
    'storybook-static/**',
    'eslint.config.mjs'
    // Config files that no type-checked project includes.
  ]),
  js.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: {
      globals: { ...globals.browser },
      parserOptions: {
        // Each folder belongs to a project: src/ to tsconfig.app.json (specs to tsconfig.spec.json), e2e/ and .storybook/ to their own.
        projectService: true,
        tsconfigRootDir: import.meta.dirname
      }
    },
    processor: angular.processInlineTemplates,
    extends: [tseslint.configs.recommendedTypeChecked, angular.configs.tsRecommended],
    rules: {
      '@angular-eslint/directive-selector': ['error', { type: 'attribute', prefix: 'app', style: 'camelCase' }],
      '@angular-eslint/component-selector': ['error', { type: 'element', prefix: 'app', style: 'kebab-case' }]
    }
  },
  {
    files: ['**/*.html'],
    extends: [angular.configs.templateRecommended, angular.configs.templateAccessibility]
  },
  ...storybook.configs['flat/recommended'],
  prettier,
  {
    files: ['**/*.ts'],
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
    // Components under components/ui/ are primitives: their selectors start with `ui`.
    files: ['src/app/components/ui/**/*.ts'],
    rules: {
      '@angular-eslint/directive-selector': ['error', { type: 'attribute', prefix: 'ui', style: 'camelCase' }],
      '@angular-eslint/component-selector': ['error', { type: 'element', prefix: 'ui', style: 'kebab-case' }]
    }
  },
  {
    // A reducer is one `on` per action: its branches are the point, not a smell.
    files: ['**/*.reducer.ts'],
    rules: { complexity: 'off' }
  },
  {
    // A describe holds every case for one module; @vitest/browser/context is the old import.
    files: ['**/*.spec.ts'],
    rules: {
      'max-lines-per-function': 'off',
      'max-nested-callbacks': 'off',
      'max-statements': 'off',
      'no-restricted-imports': ['error', { paths: [{ name: '@vitest/browser/context', message: 'Use `vitest/browser`.' }] }]
    }
  }
]);
```

`web/tsconfig.node.json`:

```jsonc
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "lib": ["ES2024"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "types": ["node"],
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.node.tsbuildinfo"
  },
  "include": ["vitest.config.mts", "playwright.config.ts"]
}
```

## Scaffold

- **Check every port first**; stop with the user if one is taken.
- **Write every file before installing**, then install each package once, in this order: the API's dependencies; the
  web's, then `pnpm --filter web exec playwright install chromium`; with Fundamental NGX, the registry components from
  `web/` and the placement check; then the shared tooling into the catalog, after checking that typescript-eslint's and
  `@angular/compiler-cli@22`'s TypeScript ranges still overlap:

  ```sh
  pnpm --filter api --filter web add -D --save-catalog \
    eslint @eslint/js typescript-eslint eslint-config-prettier globals prettier @types/node@24 vitest@5
  pnpm --filter api --filter web add -D -E --save-catalog "typescript@$(pnpm view 'typescript@~6.0.0' version)"
  ```

- **Then confirm** every file of the Shape exists, the catalog's `typescript` is exact, every shared tool reads
  `catalog:` in both manifests, `web/package.json` has no `packageManager`, and `pnpm install` reports no
  `ERR_PNPM_IGNORED_BUILDS`.
- **Bring the stack up for the smoke test**; `db:generate --name init` produces exactly one migration.

## Conventions

### Repository

```
<repo>/
├── api/                    # Express 5 + Drizzle + Postgres + zod + Pino
├── web/                    # Angular 22 + NgRx + router-store + Tailwind 4
├── docker-compose.yml      # db + api + web
├── .env / .env.example     # the single env file; only .env.example is committed
└── coding-conventions.md   # this file
```

| Command                                                         | Does                                                                            | Needs                          |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------ |
| `pnpm dev:api` / `pnpm dev:web`                                 | the API with `node --watch`, logs through `pino-pretty` / `ng serve` on `:4200` | Postgres, `.env` / —           |
| `pnpm build`                                                    | the API to `api/dist/`, the web to `web/dist/web/browser/`                      | —                              |
| `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm format:check` | per package                                                                     | —                              |
| `pnpm test:integration`                                         | the API's `db` and `api` projects (Testcontainers)                              | Docker, `api/db/migrations/`   |
| `pnpm test:browser`                                             | the web's `browser` project (Chromium)                                          | `playwright install chromium`  |
| `pnpm test:e2e`                                                 | Playwright against its own app, API and database                                | Docker, `.env`, migrations     |
| `pnpm storybook`                                                | Storybook on `:6006`                                                            | —                              |
| `pnpm compose:up` / `pnpm compose:down`                         | the three images                                                                | Docker                         |
| `pnpm --filter api db:generate --name <n>` / `db:migrate`       | write a migration / apply pending ones                                          | `.env`, Postgres for `migrate` |

`build`, `typecheck`, `test`, `lint` and `format:check` are the five required checks.

| Port            | What                        |
| --------------- | --------------------------- |
| `5432`          | Postgres (Compose `db`)     |
| `3000`          | API, local and Compose      |
| `4200`          | web, `ng serve` and Compose |
| `3100` / `4300` | the e2e API and web         |
| `6006`          | Storybook                   |

The web has no runtime environment: its API base URL is build-time, in `web/src/environments/` (production derives it
from the page's host on port 3000, development and e2e name `localhost:3000` and `localhost:3100`).

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

| Tier           | Lives in                            | Real                                      | Run                     |
| -------------- | ----------------------------------- | ----------------------------------------- | ----------------------- |
| API unit       | `api/tests/unit/` (mirrors `src/`)  | the function; DAO and HTTP stubbed        | `pnpm test`             |
| API DAO        | `api/tests/db/`                     | DAO, Drizzle, Postgres                    | `pnpm test:integration` |
| API end to end | `api/tests/api/`                    | HTTP, Express, controllers, DAO, Postgres | `pnpm test:integration` |
| web unit       | `*.spec.ts` beside the file         | the unit, `TestBed`                       | `pnpm test`             |
| web browser    | `*.browser.spec.ts` beside the file | the component, Chromium, Tailwind         | `pnpm test:browser`     |
| e2e            | `web/e2e/pages/`                    | everything, on its own database and ports | `pnpm test:e2e`         |

| Change                             | Tests                                                                         |
| ---------------------------------- | ----------------------------------------------------------------------------- |
| a filter operator or scalar kind   | the translator and builder unit tests; a DAO case only if Postgres decides it |
| a filterable or sortable column    | the resource's schema test                                                    |
| a validation rule or error mapping | the controller unit test                                                      |
| a route                            | the controller unit test and the resource's API test                          |
| a DAO method or query path         | the DAO test and the API test for its route                                   |
| a change to `app.ts`               | the API test                                                                  |
| a service method                   | the service spec                                                              |
| an action or page state            | the reducer spec, the effects spec if it requests, the page's browser spec    |
| a component                        | its browser spec and its story                                                |
| a page or user flow                | the slice specs, the page's browser spec, an e2e spec opening the page by URL |

### Adding a resource

**API**: copy `entity.schema.ts` (the same order, no comments) and register the table in `db/schema.ts`; copy
`entity.dao.ts`; add the DAO to `AppContext` and build it in `server.ts`; copy `entity.controller.ts` and mount its
handlers in `app.ts`; add the schema, controller (with a stub in `createStubContext`), DAO (with a seed file) and API
tests; then `pnpm --filter api db:generate --name add-<resource>` and `db:migrate`.

**Web**: mirror the resource's types in `models/`; add its service and params helper; add its states to `AppState` and
one route per state; one slice per page, registered on its route; the pages with their watches; the service, helper,
slice and browser specs, and an e2e spec per page.

### Before you merge

- [ ] The five checks pass; `pnpm test:integration` if you touched the API's DAOs, schemas, controllers or `app.ts`;
      `pnpm test:browser` for a component or page; `pnpm test:e2e` for a user flow or the web↔API contract.
- [ ] A schema change comes with its migration, committed; an API type change is mirrored in the web's `models/`.
- [ ] A new page route declares its `data: { state }`, reads only its slice and loads from its watch; a new read ends on
      `Leave` and a write's follow-up acts only for its page.
- [ ] A new component sits in its tier, with a story and a browser spec.

## Smoke test

```sh
pnpm compose:up
pnpm --filter api db:generate --name init && pnpm --filter api db:migrate
pnpm test:integration
curl -s http://localhost:3000/health          # {"status":"ok","db":"up",…}
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:4200/entities   # 200
pnpm test:browser && pnpm test:e2e
pnpm --filter web build-storybook             # storybook-static/index.json lists the six stories
```

`db:generate` produces exactly one migration. Through the API, `POST /entities` creates, a filtered, sorted, paged
`GET /entities` answers `{ items, total, page, pageSize, totalPages }`, an unknown filter field is a 400, `PATCH`
updates, `DELETE` answers 204 and then 404. After `test:e2e` the dev database and any running services are as they
were.
