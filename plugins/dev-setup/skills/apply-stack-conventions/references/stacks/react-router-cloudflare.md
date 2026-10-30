# React Router on Workers

A server-rendered React Router app whose server is a Hono Worker on Cloudflare's edge, styled with Tailwind and
shadcn/ui. No database is wired: D1, R2 and KV arrive later as bindings.

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
- [Vitest](../technologies/vitest.md)
- [React Router + Vitest](../integrations/react-router-vitest.md)

## Examples

- [React Router home](../examples/react-router-home.md): the home route reading `APP_NAME` from the bindings

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
├── tests/unit/                # mirrors app/
└── workers/app.ts             # the Worker: Hono → React Router
```

## Required values

| What              | Value                                                                                                                                                                                                                                                                                  |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| scripts           | `dev` `react-router dev`; `build` `react-router build`; `preview`, `deploy`, `cf-typegen`; `typecheck` `wrangler types && react-router typegen && tsc -b`; `lint` `eslint .`; `test` `vitest run`; `format`, `format:check`                                                            |
| `allowBuilds`     | `esbuild`, `workerd`                                                                                                                                                                                                                                                                   |
| dependencies      | the React Router set and the shadcn/ui packages from their docs; `hono`                                                                                                                                                                                                                |
| devDependencies   | the React Router, Vite and shadcn/ui docs' dev packages; the shared tooling with `eslint@9` and `@eslint/js@9`, `globals`, the React lint plugins, the Prettier plugins, the Vitest browser packages, `playwright`; `wrangler`, `@cloudflare/vite-plugin`, and the pinned `typescript` |
| `wrangler.jsonc`  | `main: "./workers/app.ts"`, `vars: { "APP_NAME": "<App name>" }`, `observability: { "enabled": true }`                                                                                                                                                                                 |
| configs           | the tsconfigs, `eslint.config.js`, `vite.config.ts` and `vitest.config.ts` under Reference code; Vite's plugins run `cloudflare({ viteEnvironment: { name: 'ssr' } })`, `tailwindcss()`, `reactRouter()`, in that order                                                                |
| `.gitignore`      | `node_modules/`, `build/`, `.react-router/`, `.wrangler/`, `.env`, `*.tsbuildinfo`, `.DS_Store`                                                                                                                                                                                        |
| `.prettierignore` | `pnpm-lock.yaml`, `worker-configuration.d.ts`                                                                                                                                                                                                                                          |

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
  "include": ["eslint.config.js", "react-router.config.ts", "vite.config.ts", "vitest.config.ts"],
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
          browser: { enabled: true, headless: true, provider: playwright(), instances: [{ browser: 'chromium' }] }
        }
      }
    ]
  }
});
```

## Scaffold

- **`pnpm exec playwright install chromium`** after the install, once.
- **Run `pnpm cf-typegen`** once the configs are written, before the app code.
- **Add the shadcn primitives after the app files**, then check none landed in a `~` folder.

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

`pnpm dev` serves the app in workerd; `pnpm preview` runs the production build; `pnpm deploy` ships it.
`pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` and `pnpm format:check` are the five required checks.

### Before you merge

- [ ] The five checks pass.
- [ ] Every new route has a unit test.
- [ ] A new binding is in `wrangler.jsonc`, `worker-configuration.d.ts` is regenerated and committed, and the binding
      reaches routes through `app/context.ts`.

## Smoke test

`pnpm exec vite preview --port <free port>` runs the build in workerd: `/` renders the welcome heading (proving the
loader read `APP_NAME` from the bindings), the stylesheet it links answers 200, and an unknown path answers 404.
