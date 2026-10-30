# Angular app

A single Angular 22 project: an SPA with NgRx route-driven state, Tailwind, Storybook and two test layers, calling an
API it does not own, and served as static files by Nginx. It is the web package of the Angular full stack at the repo
root, without the API, the database or the end-to-end suite. SAP Fiori Horizon components are opt-in.

## Composition

- [Code style](../architecture/code-style.md)
- [pnpm](../technologies/pnpm.md)
- [TypeScript](../technologies/typescript.md)
- [REST API](../architecture/rest-api.md)
- [UI components](../architecture/ui-components.md)
- [Angular](../technologies/angular.md)
- [NgRx](../technologies/ngrx.md)
- [Tailwind](../technologies/tailwind.md)
- [Angular + Tailwind](../integrations/angular-tailwind.md)
- [Storybook](../technologies/storybook.md)
- [Angular + Storybook](../integrations/angular-storybook.md)
- [Nginx](../technologies/nginx.md)
- [Angular + Nginx](../integrations/angular-nginx.md)
- [Docker Compose](../technologies/docker-compose.md)
- [Nginx + Docker Compose](../integrations/nginx-docker-compose.md)
- [Angular + Fundamental NGX](../integrations/angular-fundamental-ngx.md) — optional
- [Angular + the API contract](../integrations/angular-api-contract.md)
- [ESLint](../technologies/eslint.md)
- [TypeScript + ESLint](../integrations/typescript-eslint.md)
- [Prettier](../technologies/prettier.md)
- [ESLint + Prettier](../integrations/eslint-prettier.md)
- [Angular + ESLint](../integrations/angular-eslint.md)
- [Angular + Prettier](../integrations/angular-prettier.md)
- [Vitest](../technologies/vitest.md)
- [Angular + Vitest](../integrations/angular-vitest.md)

## Examples

- [Entity CRUDL](../examples/entity-crudl.md): its Web part, and its Fundamental NGX variant when opted in. The API it
  calls must speak the API contract for the example to work against it; the example is the template for the user's own
  resources either way.

## Shape

```
<repo>/
├── .postcssrc.json / .prettierrc / .prettierignore / eslint.config.mjs
├── .storybook/                # main.ts, preview.ts, tsconfig.json, typings.d.ts
├── angular.json / package.json / tsconfig{,.app,.spec,.node}.json / vitest.config.mts
├── pnpm-lock.yaml / pnpm-workspace.yaml
├── Dockerfile / nginx.conf    # Node build → Nginx, SPA fallback
├── coding-conventions.md      # assembled from the stack blueprint
└── src/
    ├── index.html / main.ts / styles.css / test-setup.ts
    ├── environments/          # environment.ts (production), environment.development.ts
    ├── testing/               # browser-setup.ts, render-page.ts, navigated.ts
    └── app/
        ├── app.component.ts / app.config.ts / app.routes.ts
        ├── components/ui/     # primitives, each with a story and a browser spec
        ├── components/        # app components, each with a story and a browser spec
        ├── layouts/ pages/ models/ services/ helpers/
        └── store/             # app-context/, app-router/, one folder per page slice
```

## Required values

| What                | Value                                                                                                                                                                                                                                                                                                                              |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ports               | 4200 (`ng serve`), 6006 (Storybook)                                                                                                                                                                                                                                                                                                |
| manifest            | the CLI's `package.json`, keeping its `name`, with `version`, `description`, `private`, `engines.node` and `packageManager` set by `pnpm pkg set`                                                                                                                                                                                  |
| `allowBuilds`       | `esbuild: true`; `'@parcel/watcher'`, `lmdb` and `msgpackr-extract` `false` (the Angular build's optional native dependencies)                                                                                                                                                                                                     |
| dependencies        | the CLI's Angular packages and the NgRx doc's                                                                                                                                                                                                                                                                                      |
| devDependencies     | the Angular, NgRx and integrations' dev packages and `@playwright/test@1`; the shared tooling (`eslint`, `@eslint/js`, `typescript-eslint`, `eslint-config-prettier`, `globals`, `@types/node@24`); the CLI's `typescript` replaced by the exact 6.0.x and its `vitest` by `vitest@5`; the CLI's `prettier` kept                   |
| environments        | development: `production: false`, `appName: '<App name>'`, `apiBaseUrl` the development URL (default `http://localhost:3000`); production: `production: true`, the same `appName`, `apiBaseUrl` the production URL (default `` `${window.location.protocol}//${window.location.hostname}:3000` ``, so one build works on any host) |
| `src/index.html`    | `<title>` is `<App name>`                                                                                                                                                                                                                                                                                                          |
| `eslint.config.mjs` | under Reference code: the Angular + ESLint presets, selectors, overrides and ignores                                                                                                                                                                                                                                               |
| `.prettierrc`       | shared, with the HTML override; `.prettierignore`: `node_modules`, `dist`, `.angular`                                                                                                                                                                                                                                              |
| `Dockerfile`        | Nginx + Docker Compose's two stages, as Angular + Nginx says                                                                                                                                                                                                                                                                       |

`<App name>` is the repo name in Title Case.

## Reference code

The TypeScript, ESLint and Vitest configs as a fresh scaffold writes them, after the CLI's cleanup; the tables above and the Angular docs say why each value is there. The shared compiler options live in `tsconfig.json`, because the CLI and the spec project extend it.

`tsconfig.json`:

```jsonc
/* Solution file: the projects below are the checks. The shared options live here because the Angular CLI and the spec project extend this file. */
{
  "compileOnSave": false,
  "compilerOptions": {
    // Environment, modules, output
    "target": "ES2024",
    "lib": ["ES2024", "DOM"],
    "module": "preserve",
    "moduleDetection": "force",
    "verbatimModuleSyntax": true,
    "erasableSyntaxOnly": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "importHelpers": true,
    "experimentalDecorators": true,
    "incremental": true,

    // Checks
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noFallthroughCasesInSwitch": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true,
    "noImplicitReturns": true
  },
  "angularCompilerOptions": {
    "enableI18nLegacyMessageIdFormat": false,
    "strictInjectionParameters": true,
    "strictInputAccessModifiers": true
  },
  "files": [],
  "references": [{ "path": "./tsconfig.app.json" }, { "path": "./tsconfig.spec.json" }, { "path": "./tsconfig.node.json" }]
}
```

`tsconfig.app.json`:

```jsonc
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "types": [],
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.app.tsbuildinfo"
  },
  "include": ["src/**/*.ts"],
  "exclude": ["src/**/*.spec.ts", "src/test-setup.ts", "src/testing/**/*.ts"]
}
```

`tsconfig.spec.json`:

```jsonc
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "types": ["vitest/globals", "vite/client"],
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.spec.tsbuildinfo"
  },
  "include": ["src/**/*.spec.ts", "src/test-setup.ts", "src/testing/**/*.ts", "src/**/*.d.ts"]
}
```

`tsconfig.node.json`:

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
  "include": ["vitest.config.mts"]
}
```

`eslint.config.mjs`:

```js
import js from '@eslint/js';
import angular from 'angular-eslint';
import { defineConfig, globalIgnores } from 'eslint/config';
import prettier from 'eslint-config-prettier/flat';
import storybook from 'eslint-plugin-storybook';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig(
  globalIgnores([
    '**/node_modules/**',
    '**/coverage/**',
    '**/.cache/**',
    '**/*.tsbuildinfo',
    'dist/**',
    '.angular/**',
    'storybook-static/**',
    'eslint.config.mjs'
  ]),
  js.configs.recommended,
  {
    files: ['**/*.ts'],
    extends: [tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      // src/app and src/testing run in the browser (tsconfig.app.json, tsconfig.spec.json); vitest.config.mts runs on Node (tsconfig.node.json).
      globals: { ...globals.browser },
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname }
    },
    processor: angular.processInlineTemplates
  },
  {
    files: ['**/*.ts'],
    extends: [angular.configs.tsRecommended],
    rules: {
      '@angular-eslint/directive-selector': ['error', { type: 'attribute', prefix: 'app', style: 'camelCase' }],
      '@angular-eslint/component-selector': ['error', { type: 'element', prefix: 'app', style: 'kebab-case' }]
    }
  },
  {
    // The primitives are the design system: their selectors carry the `ui` prefix.
    files: ['src/app/components/ui/**/*.ts'],
    rules: {
      '@angular-eslint/directive-selector': ['error', { type: 'attribute', prefix: 'ui', style: 'camelCase' }],
      '@angular-eslint/component-selector': ['error', { type: 'element', prefix: 'ui', style: 'kebab-case' }]
    }
  },
  {
    files: ['**/*.html'],
    extends: [angular.configs.templateRecommended, angular.configs.templateAccessibility]
  },
  storybook.configs['flat/recommended'],
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
    // A reducer is one `on(...)` per action: its complexity is its handler count.
    files: ['**/*.reducer.ts'],
    rules: { complexity: 'off' }
  },
  {
    // A describe holds every case for one module; the old browser-context import is replaced by vitest/browser.
    files: ['**/*.spec.ts'],
    rules: {
      'max-lines-per-function': 'off',
      'max-nested-callbacks': 'off',
      'max-statements': 'off',
      'no-restricted-imports': ['error', { paths: [{ name: '@vitest/browser/context', message: 'Use vitest/browser.' }] }]
    }
  }
);
```

`vitest.config.mts`:

```ts
import angular from '@analogjs/vite-plugin-angular';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [angular()],
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          environment: 'jsdom',
          include: ['src/**/*.spec.ts'],
          exclude: ['src/**/*.browser.spec.ts'],
          setupFiles: ['src/test-setup.ts']
        }
      },
      {
        extends: true,
        test: {
          name: 'browser',
          include: ['src/**/*.browser.spec.ts'],
          setupFiles: ['src/testing/browser-setup.ts'],
          browser: { enabled: true, headless: true, provider: playwright(), instances: [{ browser: 'chromium' }] }
        }
      }
    ]
  }
});
```

## Scaffold

- **The Angular CLI creates the package**, then its cleanup, as the Angular doc says; `git init -q` in it afterwards,
  since the CLI skips git.
- **`pnpm-workspace.yaml` is written before the first install.**
- **Check that `@angular/compiler-cli@22`'s and typescript-eslint's TypeScript ranges overlap** before pinning.
- **`pnpm exec playwright install chromium`** after the install, once.
- **With Fundamental NGX**: add the example's registry components after the other installs, from the package folder,
  then run the integration's placement check.

## Conventions

### Shape

```
<repo>/
├── src/app/
│   ├── pages/ layouts/ components/ components/ui/
│   ├── models/ services/ helpers/
│   └── store/            # app-context/, app-router/, one slice per page
├── src/environments/      # the API base URL, per build
├── .storybook/  Dockerfile  nginx.conf
└── coding-conventions.md  # this file
```

### Commands

| Command                                           | Does                                |
| ------------------------------------------------- | ----------------------------------- |
| `pnpm start`                                      | `ng serve` on `:4200`               |
| `pnpm build`                                      | `ng build` → `dist/<name>/browser/` |
| `pnpm typecheck`                                  | the app, spec and node tsconfigs    |
| `pnpm test`                                       | the `unit` project (jsdom)          |
| `pnpm test:browser`                               | the `browser` project (Chromium)    |
| `pnpm storybook`                                  | Storybook on `:6006`                |
| `pnpm lint` / `pnpm format` / `pnpm format:check` | ESLint / Prettier                   |

`build`, `typecheck`, `test`, `lint` and `format:check` are the five required checks.

### Adding a resource

1. `models/<resource>.model.ts`, mirroring the API's types; `services/<resource>.service.ts`;
   `helpers/<resource>-list-params.helper.ts` (and a filter-form helper if the list has one).
2. The new states in `AppState` and one route per state in `app.routes.ts`, each with its `data: { state }`.
3. One slice per page under `store/<resource>-<page>-page/`, registered on its route.
4. The pages, each with its watch.
5. Tests: the service, helper and slice specs, and a browser spec per page.

### Before you merge

- [ ] The five checks pass, and `pnpm test:browser` if you touched a component or page.
- [ ] A new page route declares its `data: { state }`; the page reads only its slice and loads from its watch.
- [ ] A new read effect ends on its page's `Leave`; a write's follow-up acts only for the page that started it.
- [ ] A new component sits in its tier and has a story and a browser spec.

## Smoke test

- `pnpm test:browser` passes, and `pnpm build-storybook` builds with `storybook-static/index.json` listing the
  example's stories.
- The image builds (`docker build -t <name> .`) and serves the app: run it on a free port and fetch `/entities`, which
  answers 200 with the app's `<title>` through the SPA fallback.
