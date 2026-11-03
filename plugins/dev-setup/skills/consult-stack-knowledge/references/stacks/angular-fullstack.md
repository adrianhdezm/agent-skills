---
kind: stack
technologies: [pnpm, typescript, node, express, pino, postgres, drizzle, angular, ngrx, tailwind, storybook, nginx, docker-compose, eslint, prettier, vitest]
optional:
  angular-fundamental-ngx: [fundamental-ngx]
---
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
- [Pino](../technologies/pino.md)
- [Postgres](../technologies/postgres.md)
- [Drizzle](../technologies/drizzle.md)
- [Drizzle + Postgres](../integrations/drizzle-postgres.md)
- [Express + Drizzle](../integrations/express-drizzle.md)
- [Express + Pino](../integrations/express-pino.md)
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
- [Node + Docker Compose](../integrations/node-docker-compose.md)
- [Nginx + Docker Compose](../integrations/nginx-docker-compose.md)
- [ESLint](../technologies/eslint.md)
- [TypeScript + ESLint](../integrations/typescript-eslint.md)
- [Prettier](../technologies/prettier.md)
- [ESLint + Prettier](../integrations/eslint-prettier.md)
- [Angular + ESLint](../integrations/angular-eslint.md)
- [Angular + Prettier](../integrations/angular-prettier.md)
- [Testing](../architecture/testing.md)
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
│   ├── Dockerfile / drizzle.config.ts / eslint.config.js / .prettierrc / .prettierignore
│   ├── package.json / tsconfig{,.app,.node}.json / vitest.config.ts
│   ├── db/scripts/init.sql, db/migrations/   # the init migration the scaffold generated
│   ├── src/
│   │   ├── server.ts / app.ts / migrate.ts / logger.ts / express.d.ts
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
    ├── src/environments/environment.e2e.ts   # apiBaseUrl at localhost:3100 for the e2e build
    ├── playwright.config.ts
    └── e2e/                  # global-setup, global-teardown, tsconfig.json, pages/, utils/{env,api}.ts
```

## Required values

`<App name>` is the repo name in Title Case; the database name defaults to `app`.

| What                  | Value                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ports                 | 5432 (Postgres, moved with `DB_PORT`), 3000 (API), 4200 (web), 3100 and 4300 (the e2e API and web), 6006 (Storybook)                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `pnpm-workspace.yaml` | `packages: [api, web]`; `allowBuilds` with `esbuild: true` and `'@parcel/watcher'`, `cpu-features`, `lmdb`, `msgpackr-extract`, `protobufjs`, `ssh2` all `false`; the catalog                                                                                                                                                                                                                                                                                                                                                                                                   |
| root `package.json`   | `name`, `version: "0.1.0"`, `private: true`, `engines.node: ">=24"`, `packageManager`; no Prettier or ESLint of its own                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| root scripts          | `dev:api` `pnpm --filter api dev`; `dev:web` `pnpm --filter web start`; `build`, `typecheck`, `lint`, `test`, `format`, `format:check` `pnpm -r <script>`; `test:integration` `pnpm --filter api test:integration`; `test:browser` `pnpm --filter web test:browser`; `test:e2e` `pnpm --filter web test:e2e`; `storybook` `pnpm --filter web storybook`; `compose:up` `docker compose up --build -d --wait`; `compose:down` `docker compose down`                                                                                                                               |
| `.gitignore`          | `node_modules/`, `dist/`, `.env`, `*.log`, `*.tsbuildinfo`, `.angular/`, `.vitest/`, `storybook-static/`, `*storybook.log`, `test-results/`, `playwright-report/`, `blob-report/`, `playwright/.cache/`, `.DS_Store`, and `api/db/data/` under a comment                                                                                                                                                                                                                                                                                                                        |
| `.dockerignore`       | `**/node_modules`, `**/dist`, `**/.angular`, `.git`, `.env`, `api/db/data`, `web/storybook-static`, `web/test-results`, `web/playwright-report`, `web/.vitest`                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `.env.example`        | `DB_PASSWORD`, `DB_PORT=5432`, `DATABASE_URL` (`…@localhost:5432/app`), `PORT=3000`, `WEB_PORT=4200`, a commented `LOG_LEVEL`                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| shared tooling        | in the catalog, read as `catalog:` by both packages: `eslint`, `@eslint/js`, `typescript-eslint`, `eslint-config-prettier`, `globals`, `prettier`, `@types/node@24`, `vitest@5`, and the exact `typescript`                                                                                                                                                                                                                                                                                                                                                                     |
| `api/package.json`    | `name: "api"`, `version: "0.0.0"`, `private`, `type: "module"`, written by hand; dependencies: the Express, Express + Pino, Pino, Drizzle and Postgres docs' runtime packages; devDependencies: the Express, Pino, Drizzle and Drizzle + Postgres dev packages                                                                                                                                                                                                                                                                                                                  |
| API scripts           | `dev` `node --env-file=../.env --import=tsx --watch src/server.ts` piped as Express + Pino says; `build` `tsc -p tsconfig.app.json`; `start` `node dist/server.js`; `typecheck` `tsc -p tsconfig.app.json --noEmit && tsc -p tsconfig.node.json`; `lint` `eslint .`; `test` `vitest run --project unit`; `test:integration` `vitest run --project db --project api`; `format`, `format:check` Prettier over `.`; `db:generate`, `db:migrate` as the Drizzle doc says                                                                                                            |
| API configs           | the tsconfigs, `eslint.config.js` and `vitest.config.ts` under Reference code; `drizzle.config.ts` from Drizzle + Postgres; `.prettierignore` `node_modules`, `dist`, `db/migrations`, `db/data`, as Prettier says for a package in a workspace                                                                                                                                                                                                                                                                                                                                 |
| web package           | the Angular app blueprint's values with `<name>` = `web`, minus `packageManager` and the CLI's `prettier` and `typescript` entries (the catalog has them); the browser calls the API directly and Nginx proxies nothing                                                                                                                                                                                                                                                                                                                                                         |
| e2e                   | `@playwright/test@1`; its Reference code below; web scripts `test:e2e` `playwright test`; `playwright.config.ts` is in the web's `tsconfig.node.json`; the web `typecheck` adds `&& tsc -p e2e/tsconfig.json --noEmit`; `angular.json`: an `e2e` build configuration (`optimization: false`, `extractLicenses: false`, `sourceMap: true`, `fileReplacements` to `src/environments/environment.e2e.ts`) and an `e2e` serve configuration on `web:build:e2e`; Playwright loads `playwright.config.ts` and `e2e/**` as CommonJS, where `import.meta` throws: use `__dirname` there |
| `docker-compose.yml`  | the `db` service from Postgres + Docker Compose with `<owner>` = `api`, then `migrate`, `api` (Node + Docker Compose's, `build: { context: ., dockerfile: api/Dockerfile }`, ports `'${PORT:-3000}:3000'`) and `web` (Nginx + Docker Compose's, `dockerfile: web/Dockerfile`, ports `'${WEB_PORT:-4200}:80'`, depending on `api` healthy)                                                                                                                                                                                                                                       |
| `api/Dockerfile`      | Node + Docker Compose's image in a workspace                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `web/Dockerfile`      | Nginx + Docker Compose's, copying `web/dist/web/browser`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |

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
    "target": "ES2024",
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

`api/eslint.config.js`:

```js
import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import prettier from 'eslint-config-prettier/flat';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores(['**/node_modules/**', '**/coverage/**', '**/.cache/**', '**/*.tsbuildinfo', 'dist/**', 'db/**', 'eslint.config.js']),
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
    // No TypeScript project includes the ESLint config itself.
    'eslint.config.mjs'
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

`web/playwright.config.ts`:

```ts
import { defineConfig } from '@playwright/test';
import { E2E_API_PORT, E2E_DATABASE_URL, E2E_WEB_PORT, ROOT } from './e2e/utils/env';

// The e2e ports live here and in src/environments/environment.e2e.ts (the API), and change together.
export default defineConfig({
  testDir: './e2e/pages',
  // One worker: the specs share one database.
  workers: 1,
  fullyParallel: false,
  reporter: [['list']],
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
  use: { baseURL: `http://localhost:${String(E2E_WEB_PORT)}`, trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: [
    {
      command: 'pnpm --filter api dev',
      cwd: ROOT,
      env: { PORT: String(E2E_API_PORT), DATABASE_URL: E2E_DATABASE_URL },
      url: `http://localhost:${String(E2E_API_PORT)}/`,
      reuseExistingServer: false,
      timeout: 60_000
    },
    {
      command: `pnpm --filter web exec ng serve -c e2e --port ${String(E2E_WEB_PORT)}`,
      cwd: ROOT,
      url: `http://localhost:${String(E2E_WEB_PORT)}/`,
      reuseExistingServer: false,
      timeout: 180_000
    }
  ]
});
```

`web/e2e/utils/env.ts`, the e2e ports and database:

```ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';

// Playwright loads this as CommonJS, where `import.meta` throws: __dirname locates the repo root.
export const ROOT = resolve(__dirname, '../../..');

export const E2E_API_PORT = 3100;
export const E2E_WEB_PORT = 4300;
export const E2E_API_URL = `http://localhost:${String(E2E_API_PORT)}`;
export const E2E_DATABASE_NAME = 'app_e2e';

// The root .env is parsed, never loaded: loading it would leak `PORT` into `ng serve`.
const rootEnv = parseEnv(readFileSync(resolve(ROOT, '.env'), 'utf8'));

function required(name: string): string {
  const value = rootEnv[name];
  if (!value) {
    throw new Error(`${name} is not set in .env`);
  }
  return value;
}

export const E2E_DATABASE_URL = `postgres://postgres:${required('DB_PASSWORD')}@localhost:${required('DB_PORT')}/${E2E_DATABASE_NAME}`;
```

`web/e2e/global-setup.ts`:

```ts
import { execFileSync } from 'node:child_process';
import { E2E_DATABASE_NAME, E2E_DATABASE_URL, ROOT } from './utils/env';

function run(command: string, args: string[], env: NodeJS.ProcessEnv = process.env): string {
  return execFileSync(command, args, { cwd: ROOT, env, encoding: 'utf8' });
}

function psql(database: string, sql: string): string {
  return run('docker', ['compose', 'exec', '-T', 'db', 'psql', '-U', 'postgres', '-d', database, '-tAc', sql]).trim();
}

// Starts the Compose Postgres if needed, creates and migrates the e2e database, and empties `entity`.
export default function globalSetup(): void {
  const running = run('docker', ['compose', 'ps', '--status', 'running', '--services']).split('\n');
  if (!running.includes('db')) {
    run('docker', ['compose', 'up', '-d', '--wait', 'db']);
    process.env['E2E_STARTED_DB'] = '1';
  }
  if (psql('postgres', `SELECT 1 FROM pg_database WHERE datname = '${E2E_DATABASE_NAME}'`) !== '1') {
    psql('postgres', `CREATE DATABASE ${E2E_DATABASE_NAME}`);
  }
  run('pnpm', ['--filter', 'api', 'db:migrate'], { ...process.env, DATABASE_URL: E2E_DATABASE_URL });
  psql(E2E_DATABASE_NAME, 'TRUNCATE entity');
}
```

`web/e2e/global-teardown.ts`:

```ts
import { execFileSync } from 'node:child_process';
import { ROOT } from './utils/env';

// Stops `db` only if the setup started it, so a stack the developer was running keeps running.
export default function globalTeardown(): void {
  if (process.env['E2E_STARTED_DB'] === '1') {
    execFileSync('docker', ['compose', 'stop', 'db'], { cwd: ROOT, stdio: 'ignore' });
  }
}
```

`web/e2e/utils/api.ts`:

```ts
import { type APIRequestContext, expect } from '@playwright/test';
import { E2E_API_URL } from './env';

export interface SeededEntity {
  id: string;
  name: string;
  description: string | null;
}

/** Creates an entity through the real API. */
export async function seedEntity(request: APIRequestContext, name: string, description: string | null = null): Promise<SeededEntity> {
  const res = await request.post(`${E2E_API_URL}/entities`, { data: { name, description } });
  expect(res.status()).toBe(201);
  return (await res.json()) as SeededEntity;
}

/** A name prefix no other run shares, so a spec filters to its own rows. */
export function uniquePrefix(label: string): string {
  return `${label}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function listUrl(prefix: string, params: Record<string, string> = {}): string {
  const query = new URLSearchParams({ filter: JSON.stringify({ name: { contains: prefix } }), ...params });
  return `/entities?${query.toString()}`;
}
```

`web/e2e/tsconfig.json`:

```jsonc
{
  "extends": "../tsconfig.json",
  "compilerOptions": {
    "lib": ["ES2024"],
    "module": "preserve",
    "moduleResolution": "bundler",
    "types": ["node"],
    "tsBuildInfoFile": "../node_modules/.tmp/tsconfig.e2e.tsbuildinfo"
  },
  "include": ["./**/*.ts"]
}
```

## Scaffold

- **Write every file before installing**, then install each package once, in this order: the API's dependencies; the
  web's; with Fundamental NGX, the registry components from `web/` and the placement check; then the shared tooling
  into the catalog, after checking that typescript-eslint's and `@angular/compiler-cli@22`'s TypeScript ranges still
  overlap:

  ```sh
  pnpm --filter api --filter web add -D --save-catalog \
    eslint @eslint/js typescript-eslint eslint-config-prettier globals prettier @types/node@24 vitest@5
  pnpm --filter api --filter web add -D -E --save-catalog "typescript@$(pnpm view 'typescript@~6.0.0' version)"
  ```

- **Then confirm** every file of the Shape exists, the catalog's `typescript` is exact, every shared tool reads
  `catalog:` in both manifests, `web/package.json` has no `packageManager`, and `pnpm install` reports no
  `ERR_PNPM_IGNORED_BUILDS`.
- **Generate the `init` migration before the first `compose:up`**: the image carries `db/migrations/`, and the
  `migrate` service applies it before the API starts. It produces exactly one migration, committed with the scaffold.

## Conventions

### Layout

| Path                    | Holds                                                                                    |
| ----------------------- | ---------------------------------------------------------------------------------------- |
| `api/`                  | the Express 5 + Drizzle + Postgres API, with zod and Pino                                |
| `web/`                  | the Angular 22 app: NgRx with router-store, Tailwind 4, Storybook, and the e2e suite     |
| `docker-compose.yml`    | the `db`, `migrate`, `api` and `web` services                                            |
| `.env` / `.env.example` | the single env file, feeding Compose and both packages; only `.env.example` is committed |
| `web/e2e/`              | the Playwright suite: `pages/`, the global setup and teardown, `utils/{env,api}.ts`      |
| `web/src/environments/` | the API base URL per build: production, development and e2e                              |

### Commands

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

The e2e ports live in two files, `web/src/environments/environment.e2e.ts` (the API) and `web/e2e/utils/env.ts` (both
servers, which `playwright.config.ts` reads), and change together.

### HTTP contract

Routes follow the REST API concept; the `entity` resource's routes, answers and errors are the Entity CRUDL example's,
the template every later resource copies.

### Testing tiers

| Tier           | Lives in                           | Real                                      | Run                     |
| -------------- | ---------------------------------- | ----------------------------------------- | ----------------------- |
| API unit       | `api/tests/unit/` (mirrors `src/`) | the function; DAO and HTTP stubbed        | `pnpm test`             |
| API DAO        | `api/tests/db/`                    | DAO, Drizzle, Postgres                    | `pnpm test:integration` |
| API end to end | `api/tests/api/`                   | HTTP, Express, controllers, DAO, Postgres | `pnpm test:integration` |
| e2e            | `web/e2e/pages/`                   | everything, on its own database and ports | `pnpm test:e2e`         |

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

## Smoke test

```sh
pnpm --filter api db:generate --name init     # exactly one migration
pnpm compose:up                               # db healthy, migrate exits 0, then api and web
pnpm test:integration
curl -s "http://localhost:${PORT:-3000}/health"   # {"status":"ok","db":"up",…}, on the PORT in .env
curl -s -o /dev/null -w '%{http_code}\n' "http://localhost:${WEB_PORT:-4200}/entities"   # 200
curl -s -H "Origin: http://localhost:${WEB_PORT:-4200}" "http://localhost:${PORT:-3000}/entities"  # the page's call
pnpm test:browser && pnpm test:e2e
pnpm --filter web build-storybook             # storybook-static/index.json lists the six stories
```

`docker compose ps -a --format '{{.Service}} {{.ExitCode}}'` shows `migrate` exited 0. Through the API, `POST /entities` creates, a filtered, sorted, paged
`GET /entities` answers `{ items, total, page, pageSize, totalPages }`, an unknown filter field is a 400, `PATCH`
updates, `DELETE` answers 204 and then 404. After `test:e2e` the dev database and any running services are as they
were.
