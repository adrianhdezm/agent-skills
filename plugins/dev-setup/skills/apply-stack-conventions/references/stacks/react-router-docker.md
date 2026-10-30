# React Router on Node

A server-rendered React Router app on Node, next to Postgres in Docker Compose, styled with Tailwind and shadcn/ui.
Postgres runs and `DATABASE_URL` is set, but no database code is wired: the React Router + Drizzle integration says how
it is layered when it arrives.

## Composition

- [Code style](../architecture/code-style.md)
- [pnpm](../technologies/pnpm.md)
- [TypeScript](../technologies/typescript.md)
- [Database](../architecture/database.md)
- [Data access](../architecture/data-access.md)
- [Authentication](../architecture/authentication.md) — optional (authentication)
- [Better Auth](../technologies/better-auth.md) — optional (authentication)
- [Better Auth + Drizzle](../integrations/better-auth-drizzle.md) — optional (authentication)
- [Better Auth + React Router](../integrations/better-auth-react-router.md) — optional (authentication)
- [File storage](../architecture/file-storage.md) — optional (file-storage)
- [UI components](../architecture/ui-components.md)
- [React Router](../technologies/react-router.md)
- [Vite](../technologies/vite.md)
- [React Router + Vite](../integrations/react-router-vite.md)
- [Tailwind](../technologies/tailwind.md)
- [shadcn](../technologies/shadcn.md)
- [React Router + shadcn/ui](../integrations/react-router-shadcn.md)
- [Hono](../technologies/hono.md)
- [Hono + React Router](../integrations/hono-react-router.md)
- [Storybook](../technologies/storybook.md) — optional (storybook)
- [React Router + Storybook](../integrations/react-router-storybook.md) — optional (storybook)
- [Node](../technologies/node.md)
- [Node + TypeScript](../integrations/node-typescript.md)
- [Hono + Node](../integrations/hono-node.md)
- [Docker Compose](../technologies/docker-compose.md)
- [Postgres](../technologies/postgres.md)
- [Postgres + Docker Compose](../integrations/postgres-docker-compose.md)
- [React Router + Docker Compose](../integrations/react-router-docker-compose.md)
- [React Router + Drizzle](../integrations/react-router-drizzle.md)
- [Drizzle](../technologies/drizzle.md) — optional (database)
- [Drizzle + Postgres](../integrations/drizzle-postgres.md) — optional (database)
- [S3 storage](../technologies/s3-storage.md) — optional (file-storage)
- [S3 storage + Docker Compose](../integrations/s3-storage-docker-compose.md) — optional (file-storage)
- [Drizzle + S3 storage](../integrations/drizzle-s3-storage.md) — optional (file-storage)
- [ESLint](../technologies/eslint.md)
- [TypeScript + ESLint](../integrations/typescript-eslint.md)
- [Prettier](../technologies/prettier.md)
- [ESLint + Prettier](../integrations/eslint-prettier.md)
- [React Router + ESLint](../integrations/react-router-eslint.md)
- [React Router + Prettier](../integrations/react-router-prettier.md)
- [Vitest](../technologies/vitest.md)
- [React Router + Vitest](../integrations/react-router-vitest.md)

## Examples

- [React Router home](../examples/react-router-home.md): the home route reading `APP_NAME` from the server's
  configuration
- [Sign in](../examples/sign-in.md) — optional (authentication): sign up, log in, a protected account page, log out
- [File upload](../examples/file-upload.md) — optional (file-storage): upload, list, download and delete, per user; needs authentication too

## Shape

```
my-app/
├── .dockerignore / .gitignore / .prettierignore / .prettierrc
├── .env / .env.example        # only .env.example is committed
├── coding-conventions.md      # assembled from the stack blueprint
├── components.json            # shadcn/ui
├── docker-compose.yml         # db + app
├── Dockerfile                 # the app image
├── eslint.config.js
├── package.json / pnpm-lock.yaml / pnpm-workspace.yaml
├── react-router.config.ts
├── server.ts                  # dev and production entry, run by Node as TypeScript
├── migrate.ts                 # with the database entry: applies db/migrations/ before the app, in Compose
├── tsconfig.json              # solution file, plus `paths` for the shadcn CLI
├── tsconfig.app.json          # app/ and workers/: Node and the browser
├── tsconfig.node.json         # server.ts and the config files
├── tsconfig.test.json         # the app project plus tests/: Chromium
├── vite.config.ts / vitest.config.ts
├── app/                       # as on Workers; context.ts holds the server's configuration
├── db/scripts/init.sql
├── public/favicon.ico
├── tests/unit/                # mirrors app/
└── workers/app.ts             # Hono → React Router
```

## Required values

| What                 | Value                                                                                                                                                                                                                                                                                                                                            |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ports                | Postgres 5432 (moved with `DB_PORT`), the app's `PORT` (default 3000), Vite's HMR socket 24678 in development (moved with `HMR_PORT`), Vitest's browser-mode API 63315 during tests, RustFS 9000 (moved with `RUSTFS_PORT`) and Storybook 6006 when picked                                                                                       |
| scripts              | `dev` `node --env-file=.env server.ts`; `build` `react-router build`; `start` `node server.ts` (production gets its environment from Compose); `typecheck` `react-router typegen && tsc -b`; `lint`, `test`, `format`, `format:check`, `compose:up`, `compose:down`                                                                              |
| `allowBuilds`        | `esbuild`                                                                                                                                                                                                                                                                                                                                        |
| dependencies         | the React Router set and the shadcn/ui packages from their docs; `hono`, `@hono/node-server`                                                                                                                                                                                                                                                     |
| devDependencies      | the React Router, Vite and shadcn/ui docs' dev packages; the shared tooling with `eslint@9` and `@eslint/js@9`, `globals`, the React lint plugins, the Prettier plugins, the Vitest browser packages, `playwright`; `@types/node@24`, and the pinned `typescript`                                                                                |
| configs              | the tsconfigs, `eslint.config.js`, `vite.config.ts` and `vitest.config.ts` under Reference code; `tsconfig.node.json` also holds `server.ts`, under Node's rules (`module: "NodeNext"`, `allowImportingTsExtensions`), and Vite takes the SSR input from the Hono + Node integration                                                             |
| `.env.example`       | `DB_PASSWORD`, `DB_PORT=5432`, `DATABASE_URL` (`…@localhost:5432/app`), `PORT=3000`, `NODE_ENV=development`, `APP_NAME=<App name>`; with authentication `AUTH_SECRET=` (empty) and `BETTER_AUTH_URL=http://localhost:3000`; with file storage `RUSTFS_PORT=9000`, `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` (empty), `S3_BUCKET=app-files` |
| `docker-compose.yml` | the Postgres + Docker Compose `db` service with the data at `./db/data`, and the React Router + Docker Compose `app` service                                                                                                                                                                                                                     |
| `Dockerfile`         | React Router + Docker Compose's two stages                                                                                                                                                                                                                                                                                                       |
| `.gitignore`         | `node_modules/`, `build/`, `.react-router/`, `.env`, `*.tsbuildinfo`, `.DS_Store`, and `db/data/` under a comment                                                                                                                                                                                                                                |
| `.prettierignore`    | `pnpm-lock.yaml`, `db/data`                                                                                                                                                                                                                                                                                                                      |
| `.dockerignore`      | React Router + Docker Compose's, with `db` as the data folder                                                                                                                                                                                                                                                                                    |

## Reference code

The config files as a fresh scaffold writes them, before any optional entry adds to them; the tables above say why each value is there.

`tsconfig.json`:

```jsonc
{
  // Solution file: no compiler options, except `paths`, which the shadcn CLI reads from here.
  "files": [],
  "references": [{ "path": "./tsconfig.app.json" }, { "path": "./tsconfig.node.json" }, { "path": "./tsconfig.test.json" }],
  "compilerOptions": {
    "paths": { "~/*": ["./app/*"] }
  }
}
```

`tsconfig.app.json`:

```jsonc
{
  "compilerOptions": {
    // Environment, modules, output
    "noEmit": true,
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.app.tsbuildinfo",
    "target": "ES2024",
    "lib": ["ES2024", "DOM", "DOM.Iterable"],
    "types": ["node", "vite/client"],
    "jsx": "react-jsx",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "moduleDetection": "force",
    "verbatimModuleSyntax": true,
    "erasableSyntaxOnly": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "rootDirs": [".", "./.react-router/types"],
    "paths": { "~/*": ["./app/*"] },

    // Checks
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": [".react-router/types/**/*", "app", "workers"]
}
```

`tsconfig.node.json`:

```jsonc
{
  "compilerOptions": {
    // Environment, modules, output
    "noEmit": true,
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.node.tsbuildinfo",
    "target": "ES2024",
    "lib": ["ES2024"],
    "types": ["node"],
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "allowImportingTsExtensions": true,
    "moduleDetection": "force",
    "verbatimModuleSyntax": true,
    "erasableSyntaxOnly": true,
    "isolatedModules": true,
    "skipLibCheck": true,

    // Checks
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noFallthroughCasesInSwitch": true
  },
  // With the optional entries, also "migrate.ts", "drizzle.config.ts", "scripts" and ".storybook/**/*".
  "include": ["server.ts", "vite.config.ts", "vitest.config.ts", "react-router.config.ts"]
}
```

`tsconfig.test.json`:

```jsonc
{
  "extends": "./tsconfig.app.json",
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.test.tsbuildinfo",
    "types": ["node", "vite/client"]
  },
  "include": [".react-router/types/**/*", "app", "workers", "tests"]
}
```

`eslint.config.js`:

```js
import js from '@eslint/js';
import prettier from 'eslint-config-prettier/flat';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores([
    '**/node_modules/**',
    '**/coverage/**',
    '**/.cache/**',
    '**/*.tsbuildinfo',
    'build',
    'public',
    '.react-router',
    'db/data',
    // No TypeScript project includes the ESLint config itself.
    'eslint.config.js'
  ]),
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname
      }
    },
    settings: { react: { version: 'detect' } }
  },
  react.configs.flat.recommended,
  react.configs.flat['jsx-runtime'],
  reactHooks.configs.flat.recommended,
  jsxA11y.flatConfigs.recommended,
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
    // The shadcn primitives are the registry's code: they forward props and import React as a namespace.
    files: ['app/components/ui/**'],
    rules: {
      'jsx-a11y/label-has-associated-control': 'off',
      '@typescript-eslint/consistent-type-imports': 'off'
    }
  },
  {
    // Loaders and actions throw Responses; the top-level Conform package has a v4 entry point.
    files: ['app/routes/**'],
    rules: {
      '@typescript-eslint/only-throw-error': 'off',
      'no-restricted-imports': ['error', { paths: [{ name: '@conform-to/zod', message: 'Use @conform-to/zod/v4.' }] }]
    }
  },
  {
    // A describe holds every case for one module; createRoutesStub returns loosely typed values.
    files: ['tests/**'],
    rules: {
      'max-lines-per-function': 'off',
      'max-nested-callbacks': 'off',
      'max-statements': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      'no-restricted-imports': ['error', { paths: [{ name: '@vitest/browser/context', message: 'Use vitest/browser.' }] }]
    }
  }
]);
```

`vite.config.ts`:

```ts
import { reactRouter } from '@react-router/dev/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [tailwindcss(), reactRouter()],
  resolve: { tsconfigPaths: true },
  // HMR_PORT, when set, moves Vite's live-reload socket off its default 24678.
  server: { hmr: { port: process.env.HMR_PORT ? Number(process.env.HMR_PORT) : undefined } },
  environments: {
    ssr: {
      build: {
        rollupOptions: { input: './workers/app.ts' }
      }
    }
  }
});
```

`vitest.config.ts`:

```ts
import react from '@vitejs/plugin-react';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        plugins: [react()],
        resolve: { tsconfigPaths: true },
        test: {
          name: 'unit',
          include: ['tests/unit/**/*.test.{ts,tsx}'],
          setupFiles: ['tests/setup.ts'],
          browser: { enabled: true, headless: true, provider: playwright(), instances: [{ browser: 'chromium' }] }
        }
      }
    ]
  }
});
```

## Scaffold

- **Check the ports first**; stop with the user if one is taken, or set another `PORT` in `.env`.
- **`pnpm exec playwright install chromium`** after the install, once.
- **`cp .env.example .env`** once `.env.example` is written, then fill its secrets: `AUTH_SECRET` with
  `openssl rand -base64 32`, and `S3_ACCESS_KEY` / `S3_SECRET_KEY` with any values (Compose hands them to RustFS as its
  credentials). `HMR_PORT` is optional: set it to move Vite's live-reload socket.
- **Add the shadcn primitives after the app files**, then check none landed in a `~` folder.

## Conventions

### Layout

| Path              | Holds                                                                          |
| ----------------- | ------------------------------------------------------------------------------ |
| `server.ts`       | runs `workers/app.ts`: Vite middleware in development, the build in production |
| `workers/app.ts`  | the Hono app: builds the context once and hands each request to React Router   |
| `app/context.ts`  | `appContext`: the server's configuration, later its database client            |
| `app/routes/`     | route modules, declared in `app/routes.ts`                                     |
| `app/components/` | app components; `app/components/ui/` the shadcn primitives                     |
| `tests/unit/`     | mirrors `app/`; runs in Chromium                                               |
| `db/`             | `scripts/init.sql`, and the bind-mounted Postgres data                         |

### Commands

`pnpm dev` runs the server with Vite; `pnpm build` then `pnpm start` runs production; `pnpm compose:up` runs the image
next to Postgres. `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` and `pnpm format:check` are the five
required checks.

### Before you merge

- [ ] The five checks pass.
- [ ] Every new route has a unit test.
- [ ] A new dependency of the routes is built in `workers/app.ts` and typed in `app/context.ts`.
- [ ] A new environment variable is in `.env.example` and, if the image needs it, in `docker-compose.yml`.

## Smoke test

- **Production**: after `pnpm build`, `NODE_ENV=production PORT=<port> node --env-file=.env server.ts` serves the
  welcome heading, the stylesheet under `/assets/` with `cache-control: public, max-age=31536000, immutable`, and a 404
  for an unknown path. Both prefixes are needed: `node server.ts` alone reads no `.env` (it fails on the first required
  variable once a database is added), and `--env-file` never overrides a variable already set, so `.env`'s
  `NODE_ENV=development` would otherwise start the dev server.
- **Development**: `pnpm dev` serves the welcome heading.
- **Compose**: `pnpm compose:up` brings `db` up healthy, `migrate` to exit 0 when the database entry is picked, and then
  `app` healthy; with file storage, `pnpm storage:bucket` then creates the bucket. The app container serves the heading,
  and
  `docker compose exec -T db psql -U postgres -tAc "select datname from pg_database where datname='app'"` prints
  `app`. Leave Compose running or `pnpm compose:down`, and say which.
