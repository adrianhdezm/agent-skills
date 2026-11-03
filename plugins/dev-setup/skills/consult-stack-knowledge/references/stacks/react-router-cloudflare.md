---
type: Stack Blueprint
title: React Router on Workers
description: A server-rendered React Router app whose server is a Hono Worker on Cloudflare's edge, styled with Tailwind and shadcn/ui.
technologies: [pnpm, typescript, react-router, vite, tailwind, shadcn, hono, cloudflare-workers, eslint, prettier, vitest]
optional:
  database: [cloudflare-d1, drizzle]
  authentication: [better-auth]
  file-storage: [cloudflare-r2]
  storybook: [storybook]
requires:
  authentication: [database]
  file-storage: [database, authentication]
---
# React Router on Workers

A server-rendered React Router app whose server is a Hono Worker on Cloudflare's edge, styled with Tailwind and
shadcn/ui. No database is wired: D1, R2 and KV arrive later as bindings.

## Composition

- [Code style](../architecture/code-style.md)
- [pnpm](../technologies/pnpm.md)
- [TypeScript](../technologies/typescript.md)
- [Database](../architecture/database.md)
- [Data access](../architecture/data-access.md)
- [Resource operations](../architecture/resource-operations.md)
- [Authentication](../architecture/authentication.md) — optional (authentication)
- [Authorization](../architecture/authorization.md) — optional (authentication)
- [Better Auth](../technologies/better-auth.md) — optional (authentication)
- [Better Auth + Drizzle](../integrations/better-auth-drizzle.md) — optional (authentication)
- [Better Auth + React Router](../integrations/better-auth-react-router.md) — optional (authentication)
- [File storage](../architecture/file-storage.md) — optional (file-storage)
- [UI components](../architecture/ui-components.md)
- [React Router](../technologies/react-router.md)
- [Vite](../technologies/vite.md)
- [React Router + Vite](../integrations/react-router-vite.md)
- [Tailwind](../technologies/tailwind.md)
- [React Router + Tailwind](../integrations/react-router-tailwind.md)
- [shadcn](../technologies/shadcn.md)
- [React Router + shadcn/ui](../integrations/react-router-shadcn.md)
- [Hono](../technologies/hono.md)
- [Hono + React Router](../integrations/hono-react-router.md)
- [Storybook](../technologies/storybook.md) — optional (storybook)
- [React Router + Storybook](../integrations/react-router-storybook.md) — optional (storybook)
- [Cloudflare Workers](../technologies/cloudflare-workers.md)
- [Cloudflare Workers + Vite](../integrations/cloudflare-workers-vite.md)
- [Hono + Cloudflare Workers](../integrations/hono-cloudflare-workers.md)
- [React Router + Drizzle](../integrations/react-router-drizzle.md)
- [Cloudflare D1](../technologies/cloudflare-d1.md) — optional (database)
- [Drizzle](../technologies/drizzle.md) — optional (database)
- [Drizzle + Cloudflare D1](../integrations/drizzle-d1.md) — optional (database)
- [Cloudflare R2](../technologies/cloudflare-r2.md) — optional (file-storage)
- [ESLint](../technologies/eslint.md)
- [TypeScript + ESLint](../integrations/typescript-eslint.md)
- [Prettier](../technologies/prettier.md)
- [ESLint + Prettier](../integrations/eslint-prettier.md)
- [React Router + ESLint](../integrations/react-router-eslint.md)
- [React Router + Prettier](../integrations/react-router-prettier.md)
- [Testing](../architecture/testing.md)
- [Vitest](../technologies/vitest.md)
- [React Router + Vitest](../integrations/react-router-vitest.md)
- [Cloudflare Workers + Vitest](../integrations/cloudflare-workers-vitest.md)

## Shape

```
my-app/
├── .gitignore / .prettierignore / .prettierrc
├── coding-conventions.md      # assembled from the stack blueprint
├── components.json            # shadcn/ui
├── eslint.config.js
├── package.json / pnpm-lock.yaml / pnpm-workspace.yaml
├── react-router.config.ts
├── tsconfig.json              # solution file, plus `paths` for the shadcn CLI
├── tsconfig.cloudflare.json   # app/ and workers/: workerd and the browser
├── tsconfig.node.json         # the config files
├── tsconfig.test.json         # the runtime project plus tests/: Chromium
├── vite.config.ts / vitest.config.ts
├── worker-configuration.d.ts  # generated; committed
├── wrangler.jsonc
├── app/
│   ├── app.css / context.ts / entry.server.tsx / env.d.ts / root.tsx / routes.ts
│   ├── components/ui/         # the shadcn primitives
│   ├── lib/utils.ts           # cn
│   └── routes/
├── public/favicon.ico
├── tests/setup.ts             # imports app/app.css for the browser tests
├── tests/unit/                # mirrors app/
└── workers/app.ts             # the Worker: Hono → React Router
```

## Required values

| What              | Value                                                                                                                                                                                                                                                                                                    |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ports             | 5173 (`pnpm dev`, Vite), 4173 (`vite preview`), 6006 (Storybook, when picked)                                                                                                                                                                                                                            |
| scripts           | `dev` `react-router dev`; `build` `react-router build`; `preview`, `cf:deploy`, `cf-typegen`; `typecheck` `wrangler types && react-router typegen && tsc -b`; `lint` `eslint .`; `test` `vitest run`; `format`, `format:check`                                                                           |
| `allowBuilds`     | `esbuild`, `workerd`                                                                                                                                                                                                                                                                                     |
| dependencies      | the React Router set and the shadcn/ui packages from their docs; `hono`                                                                                                                                                                                                                                  |
| devDependencies   | the React Router, Vite and shadcn/ui docs' dev packages; the shared tooling with `eslint@9` and `@eslint/js@9`, `globals`, the React lint plugins, the Prettier plugins, the Vitest browser packages, `playwright`; `wrangler`, `@cloudflare/vite-plugin`, `@types/node@24`, and the pinned `typescript` |
| `wrangler.jsonc`  | `main: "./workers/app.ts"`, `vars: { "APP_NAME": "<App name>" }`, `observability: { "enabled": true }`                                                                                                                                                                                                   |
| configs           | the tsconfigs, `eslint.config.js`, `vite.config.ts` and `vitest.config.ts` under Reference code                                                                                                                                                                                                          |
| `.gitignore`      | `node_modules/`, `build/`, `.react-router/`, `.wrangler/`, `.env`, `*.tsbuildinfo`, `.DS_Store`                                                                                                                                                                                                          |
| `.prettierignore` | `pnpm-lock.yaml`, `worker-configuration.d.ts`                                                                                                                                                                                                                                                            |

## Reference code

The config files as a fresh scaffold writes them, before any optional entry adds to them; the tables above say why each value is there.

`tsconfig.json`:

```jsonc
{
  // Solution file: `paths` stays here because the shadcn CLI reads it from this file.
  "files": [],
  "references": [{ "path": "./tsconfig.cloudflare.json" }, { "path": "./tsconfig.node.json" }, { "path": "./tsconfig.test.json" }],
  "compilerOptions": {
    "paths": { "~/*": ["./app/*"] }
  }
}
```

`tsconfig.cloudflare.json`:

```jsonc
{
  "include": [".react-router/types/**/*", "app", "workers", "worker-configuration.d.ts"],
  "compilerOptions": {
    // Environment, modules, output
    "noEmit": true,
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.cloudflare.tsbuildinfo",
    "lib": ["ES2024", "DOM", "DOM.Iterable"],
    "target": "ES2024",
    "types": ["./worker-configuration.d.ts", "vite/client"],
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
  }
}
```

`tsconfig.node.json`:

```jsonc
{
  "include": ["react-router.config.ts", "vite.config.ts", "vitest.config.ts"],
  "compilerOptions": {
    // Environment, modules, output
    "noEmit": true,
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.node.tsbuildinfo",
    "lib": ["ES2024"],
    "target": "ES2024",
    "types": ["node"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "moduleDetection": "force",
    "verbatimModuleSyntax": true,
    "erasableSyntaxOnly": true,
    "isolatedModules": true,
    "skipLibCheck": true,

    // Checks
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

`tsconfig.test.json`:

```jsonc
{
  "extends": "./tsconfig.cloudflare.json",
  "include": [".react-router/types/**/*", "app", "workers", "worker-configuration.d.ts", "tests"],
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.test.tsbuildinfo",
    "types": ["./worker-configuration.d.ts", "vite/client"]
  }
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
    '.wrangler',
    'worker-configuration.d.ts',
    // No TypeScript project includes it.
    'eslint.config.js'
  ]),
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    // app/ and workers/ belong to tsconfig.cloudflare.json, tests/ to tsconfig.test.json, the config files to tsconfig.node.json.
    languageOptions: {
      globals: globals.browser,
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname }
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
    // shadcn code forwards props and imports React as a namespace.
    files: ['app/components/ui/**'],
    rules: { 'jsx-a11y/label-has-associated-control': 'off', '@typescript-eslint/consistent-type-imports': 'off' }
  },
  {
    // Loaders and actions throw Responses.
    files: ['app/routes/**'],
    rules: {
      '@typescript-eslint/only-throw-error': 'off',
      'no-restricted-imports': ['error', { paths: [{ name: '@conform-to/zod', message: 'Use @conform-to/zod/v4.' }] }]
    }
  },
  {
    // createRoutesStub returns loosely typed values; a describe holds every case for one module.
    files: ['tests/**'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      'max-lines-per-function': 'off',
      'max-nested-callbacks': 'off',
      'max-statements': 'off',
      'no-restricted-imports': ['error', { paths: [{ name: '@vitest/browser/context', message: 'Use vitest/browser.' }] }]
    }
  }
]);
```

`vite.config.ts`:

```ts
import { cloudflare } from '@cloudflare/vite-plugin';
import { reactRouter } from '@react-router/dev/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [cloudflare({ viteEnvironment: { name: 'ssr' } }), tailwindcss(), reactRouter()],
  resolve: { tsconfigPaths: true }
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

`tests/setup.ts`, the unit project's setup file, loading the app's stylesheet so browser tests render with its styles:

```ts
import '../app/app.css';
```

## Scaffold

- **Run `pnpm cf-typegen`** once the configs are written, before the app code.
- **Add the shadcn primitives after the app files.**

## Starter

What a fresh scaffold ships, built by applying the docs above: the home route always, and each optional part's
starter when its group is picked. The user's own routes grow beside them in the same shape.

### Home

| What             | Value                                                                                        |
| ---------------- | -------------------------------------------------------------------------------------------- |
| route            | `/`, `app/routes/home.tsx`, declared in `app/routes.ts`                                      |
| loader           | returns `` `Welcome to ${APP_NAME}` ``, reading `APP_NAME` through `context.get(appContext)` |
| `APP_NAME`       | the app name in Title Case, from `vars.APP_NAME` in `wrangler.jsonc`                         |
| `appContext`     | `{ cloudflare: { env: Env; ctx: Context['executionCtx'] } }`                                 |
| page             | the message as the heading, a short paragraph, an outline `Button`                           |
| primitives       | `button`, added with the shadcn CLI                                                          |
| unknown path     | 404 through the root `ErrorBoundary`                                                         |
| with `storybook` | a story beside each primitive (`app/components/ui/button.stories.tsx` and the rest)          |

| Tier          | File                              | Covers                                                 |
| ------------- | --------------------------------- | ------------------------------------------------------ |
| unit, browser | `tests/unit/lib/utils.test.ts`    | `cn` merges classes, imported through `~/`             |
| unit, browser | `tests/unit/routes/home.test.tsx` | the heading shows the message a stubbed loader returns |

### Sign in, with `authentication`

Sign up, log in, a protected page that knows who is signed in, and log out. Signing up redirects to `/login` (no
automatic sign-in); an anonymous request for `/account` goes to `/login?redirectTo=%2Faccount`.

| What           | Value                                                                                                                                                 |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| routes         | `api/auth/*` (splat, `routes/auth.tsx`), `/signup`, `/login`, `/logout` (action only), and `/account` under the protected layout                      |
| signup fields  | `name` (required), `email` (an email), `password` (at least 8 characters)                                                                             |
| login fields   | `email`, `password`; `redirectTo` from the query string                                                                                               |
| account page   | the heading "Account" and "Signed in as `<email>`", with a "Sign out" button posting to `/logout`                                                     |
| auth tables    | `users`, `sessions`, `accounts`, `verifications` (Better Auth's `user`, `session`, `account`, `verification`), with uuid ids, in the `init` migration |
| safe redirect  | `safeRedirectTo` in `app/lib/utils.ts`                                                                                                                |
| primitives     | `input`, `label`, `card` beside `button`                                                                                                              |
| wrong password | the login page again with "Invalid email or password"                                                                                                 |

| Tier          | File                                   | Covers                                                                                                   |
| ------------- | -------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| unit, browser | `tests/unit/lib/utils.test.ts`         | `safeRedirectTo` keeps `/account`, turns `//evil.com`, `https://evil.com` and nothing into `/`           |
| unit, browser | `tests/unit/routes/login.test.tsx`     | the form's labelled fields; an action error shows on the form; `redirectTo` is kept on the form's action |
| unit, browser | `tests/unit/routes/protected.test.tsx` | an anonymous request for a route under the layout is redirected to `/login?redirectTo=…`                 |
| unit, browser | `tests/unit/routes/account.test.tsx`   | the email a stubbed loader returns, and the Sign out button                                              |

### File upload, with `file-storage`

Upload, list, download and delete files, each visible only to the user who uploaded it.

| What       | Value                                                                                                                                                                                            |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| store      | the R2 bucket binding (Cloudflare R2)                                                                                                                                                            |
| `files`    | the `files` table in the app's Drizzle schema, with its generated migration: `id`, unique `key`, `filename`, `contentType`, `size`, `ownerId` (indexed, the user's id), `createdAt`, `updatedAt` |
| service    | `app/services/files.service.ts`, built by the server entry onto `appContext`                                                                                                                     |
| key        | `<ownerId>/<uuid>`                                                                                                                                                                               |
| size limit | 10 MB per file; a larger upload answers 413                                                                                                                                                      |
| routes     | `/files` (list and upload form), `/files/:id` (details, delete), `/files/:id/download`, all under the protected layout, in `routes/files.tsx`, `routes/file.tsx`, `routes/file-download.tsx`     |
| upload     | `multipart/form-data`, field `file`; redirects to the file's page                                                                                                                                |
| list       | the signed-in user's files, newest first, as the data access paginated result                                                                                                                    |
| delete     | redirects to `/files`                                                                                                                                                                            |

The integration tests run in workerd against the local D1 database and R2 bucket.

| Tier          | File                                      | Covers                                                                                                              |
| ------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| integration   | `tests/integration/files.service.test.ts` | upload writes both sides; a failing insert leaves no object; delete removes both; another owner's file is not found |
| unit, browser | `tests/unit/routes/files.test.tsx`        | the list a stubbed loader returns, the labelled upload field, the empty state                                       |

## Conventions

### Layout

| Path              | Holds                                                                   |
| ----------------- | ----------------------------------------------------------------------- |
| `workers/app.ts`  | the Worker: builds the context per request and hands it to React Router |
| `app/context.ts`  | `appContext`: the bindings and the execution context                    |
| `app/routes/`     | route modules, declared in `app/routes.ts`                              |
| `app/components/` | app components; `app/components/ui/` the shadcn primitives              |
| `app/lib/`        | pure helpers                                                            |
| `tests/unit/`     | mirrors `app/`; runs in Chromium                                        |

### Commands

`pnpm dev` serves the app in workerd; `pnpm preview` runs the production build; `pnpm cf:deploy` ships it.
`pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` and `pnpm format:check` are the five required checks.

### Before you merge

- [ ] The five checks pass.

## Smoke test

- **The build**: `pnpm build`, then `pnpm exec vite preview --port <free port>`, runs it in workerd: `/` renders the
  welcome heading (proving the loader read `APP_NAME` from the bindings), the stylesheet it links answers 200, and an
  unknown path answers 404.
- **With authentication**, against the built app on an empty, migrated database: `/account` redirects anonymously,
  sign-up then log-in sets a cookie and lands on `/account` with the email shown, a wrong password stays on the login
  page with the error and no password in the HTML, `//evil.com` as `redirectTo` lands on `/`, and log-out ends the
  session.
- **With file storage**, signed in: an upload lands on its page and in the list, the download returns the same bytes
  and content type, a second user gets 404 for it, and delete removes it from the list and the store.
- **With Storybook**: `pnpm build-storybook` lists the primitives' stories in `storybook-static/index.json`.
