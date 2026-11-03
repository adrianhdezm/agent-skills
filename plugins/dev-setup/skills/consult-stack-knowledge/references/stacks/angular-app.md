---
kind: stack
technologies: [pnpm, typescript, angular, ngrx, tailwind, storybook, nginx, docker-compose, eslint, prettier, vitest]
optional:
  angular-fundamental-ngx: [fundamental-ngx]
---
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
- [Testing](../architecture/testing.md)
- [Vitest](../technologies/vitest.md)
- [Angular + Vitest](../integrations/angular-vitest.md)

## Shape

```
<repo>/
├── .postcssrc.json / .prettierrc / .prettierignore / eslint.config.mjs
├── .storybook/                # main.ts, preview.ts, tsconfig.json, typings.d.ts
├── angular.json / package.json / tsconfig{,.app,.spec,.node}.json / vitest.config.mts
├── pnpm-lock.yaml / pnpm-workspace.yaml
├── Dockerfile / nginx.conf    # Node build → Nginx, SPA fallback
├── docker-compose.yml         # the web service
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

| What                 | Value                                                                                                                                                                                                                                                                                                                              |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ports                | 4200 (`ng serve`, and the Compose `web` on `WEB_PORT`), 6006 (Storybook)                                                                                                                                                                                                                                                           |
| manifest             | the CLI's `package.json`, keeping its `name`, with `version`, `description`, `private`, `engines.node` and `packageManager` set by `pnpm pkg set`                                                                                                                                                                                  |
| scripts              | the Angular, Angular + Vitest, Angular + Storybook and Angular + Prettier docs' scripts; `lint` `eslint .`; `compose:up`, `compose:down`                                                                                                                                                                                           |
| `allowBuilds`        | `esbuild: true`; `'@parcel/watcher'`, `lmdb` and `msgpackr-extract` `false` (the Angular build's optional native dependencies)                                                                                                                                                                                                     |
| dependencies         | the CLI's Angular packages and the NgRx doc's                                                                                                                                                                                                                                                                                      |
| devDependencies      | the Angular, NgRx and integrations' dev packages and `@playwright/test@1`; the shared tooling (`eslint`, `@eslint/js`, `typescript-eslint`, `eslint-config-prettier`, `globals`, `@types/node@24`); the CLI's `typescript` replaced by the exact 6.0.x and its `vitest` by `vitest@5`; the CLI's `prettier` kept                   |
| environments         | development: `production: false`, `appName: '<App name>'`, `apiBaseUrl` the development URL (default `http://localhost:3000`); production: `production: true`, the same `appName`, `apiBaseUrl` the production URL (default `` `${window.location.protocol}//${window.location.hostname}:3000` ``, so one build works on any host) |
| `src/index.html`     | `<title>` is `<App name>`                                                                                                                                                                                                                                                                                                          |
| `eslint.config.mjs`  | under Reference code: the Angular + ESLint presets, selectors, overrides and ignores                                                                                                                                                                                                                                               |
| `.prettierrc`        | shared, with the HTML override; `.prettierignore`: Angular + Prettier's list                                                                                                                                                                                                                                                       |
| `Dockerfile`         | Nginx + Docker Compose's two stages, as Angular + Nginx says                                                                                                                                                                                                                                                                       |
| `docker-compose.yml` | one `web` service: Nginx + Docker Compose's, `build: .`, ports `'${WEB_PORT:-4200}:80'`, with nothing to depend on                                                                                                                                                                                                                 |
| `.gitignore`         | the CLI's, plus Storybook's and Angular + Vitest's additions                                                                                                                                                                                                                                                                       |

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
  ]),
  js.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: {
      // src/app and src/testing run in the browser (tsconfig.app.json, tsconfig.spec.json); vitest.config.mts runs on Node (tsconfig.node.json).
      globals: { ...globals.browser },
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname }
    },
    processor: angular.processInlineTemplates,
    extends: [tseslint.configs.recommendedTypeChecked, angular.configs.tsRecommended],
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
]);
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
- **Check that `@angular/compiler-cli@22`'s and typescript-eslint's TypeScript ranges overlap** before pinning.
- **With Fundamental NGX**: add the Starter's registry components after the other installs, from the package folder,
  then run the integration's placement check.

## Starter

What a fresh scaffold ships: one resource, `entity`, listed with filter, sort and pagination, shown, created, edited and
deleted, the template every later resource copies. Build it by applying the docs above, and take from here what they
leave open: names, values, behaviours and tests. When the user names the first resource, it takes this one's name and
keeps its fields, routes and tests. It works against any API that speaks the API contract.

### The resource

| Field         | Type                     | Rules                    | Filter           | Sort |
| ------------- | ------------------------ | ------------------------ | ---------------- | ---- |
| `id`          | UUID, generated          |                          | id operators     |      |
| `name`        | text                     | required, 1 to 200 chars | string operators | yes  |
| `description` | text or `null`           | up to 2000 chars         | string operators |      |
| `createdAt`   | timestamp, set on insert |                          | date operators   | yes  |
| `updatedAt`   | timestamp                |                          | date operators   | yes  |

The default sort is `createdAt DESC`. An update needs at least one field besides `id`. The web mirrors them by hand in
`models/entity.model.ts` (dates as ISO strings), as the API's contract has them.

### Web

**Shell.** `App` renders `MainLayout`: a header bar with the app name (from `selectAppName`) over a `<main>` holding the
router outlet. `''` redirects to `entities`. The `appContext` slice holds `{ apiBaseUrl, appName }` from `environment`,
and has no handlers and no spec.

**Model, service, helpers.**

| Piece                          | Contract                                                                                                                                                                                                                                                                                                              |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `EntityService`                | `list`, `get`, `create` (POST), `update` (PATCH), `delete`, each an `Observable`                                                                                                                                                                                                                                      |
| `entity-list-params.helper.ts` | `DEFAULT_PAGE` 1, `DEFAULT_PAGE_SIZE` 20; `parseListInput` never throws (bad filter, unknown sort field or page below 1 fall back; no `sortField` means the default sort, `createdAt DESC`, and with a field any direction but `DESC` is `ASC`); `toParams` maps absent and default values to `null`; `sameListInput` |
| `entity-filter-form.helper.ts` | `FilterForm` (`name`, `description`, `createdFrom`, `createdBefore`) ⇄ `EntityFilterInput` (trimmed `contains`, `createdAt.ge` / `.lt`, a day as local midnight in ISO-8601); reads back only what the strip can express; `formatRange` → `0 of 0` or `first–last of total · page X of Y`                             |

**Slices.** One per page: the list, form and detail slices are the NgRx reference code.

**Components**, store-free, each with a story and a browser spec:

| Component                            | Inputs → outputs                                                           | Behaviour                                                                                                                                                                             |
| ------------------------------------ | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `UiDialog` (`ui-dialog`)             | `title` (required), `description`, `dismissible` = true → `dismissed`      | a modal `role="dialog"` named by its title, described by its description; Escape dismisses unless not dismissible; a body and a `[uiDialogFooter]` slot                               |
| `UiSelect` (`ui-select`)             | `label`, `name`, `options` (`{ value, label }[]`), `value` → `valueChange` | its own label names a native select; the option matching `value` is selected                                                                                                          |
| `UiPagination` (`ui-pagination`)     | `page`, `pageCount` → `pageChange`                                         | a `nav` named Pagination; projected status text; _Previous_ / _Next_ disabled at the ends                                                                                             |
| `DeleteDialog` (`app-delete-dialog`) | `itemKind`, `itemName`, `busy` = false → `confirmed`, `cancelled`          | a `UiDialog` titled `Delete <itemKind>`, described `Delete “<itemName>”? This cannot be undone.`; _Cancel_ and a red _Delete_ (_Deleting…_ while busy); busy disables both and Escape |

Stories: `UI/Dialog` (`Default`, through a template filling the slots), `UI/Select` (`Default`), `UI/Pagination`
(`Middle`, `FirstPage`), `Components/DeleteDialog` (`Default`, `Busy`).

**Pages**, each on the NgRx page contract.

| Page   | Routes and state                                                 | Accessible names                                                                                                                                                                                                           |
| ------ | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| list   | `/entities`, `entity-list`                                       | heading _Entities_; link _New entity_; _Name contains_, _Description contains_, _Created on or after_, _Created before_, _Sort_, _Per page_; _Apply_, _Clear_, _Previous_, _Next_; _Delete_ per row, the row's name a link |
| detail | `/entities/:id`, `entity-detail`                                 | the entity's name as heading; _Edit_; _← Back to entities_                                                                                                                                                                 |
| form   | `/entities/new` `entity-new`, `/entities/:id/edit` `entity-edit` | heading _New entity_ / _Edit entity_; _Name_, _Description_; _Save_; _← Cancel_                                                                                                                                            |

- **List.** Every control (filter strip, sort, page size, pagination) navigates with the next list input in the URL and
  never fetches. Sort options, in order: _Newest first_ (`createdAt:DESC`, default), _Oldest first_, _Name A–Z_, _Name
  Z–A_, _Recently updated_ (`updatedAt:DESC`); page sizes 10, 20, 50, 100. Changing the filter, sort or page size goes to
  page 1. The filter strip keeps local edits until _Apply_ and resyncs whenever the URL's input changes; _Clear_ drops
  the filter and keeps sort and page size. Rows show the name, the description and `createdAt` (`medium`). The empty
  row reads _Loading…_, _No entities match the filter._ or _No entities yet._; an error shows in a banner. Delete opens
  `DeleteDialog`, which stays open and busy until the refetched page arrives, and on failure stays open, not busy, over
  the banner. A page past the end after a delete steps back with `replaceUrl`.
- **Detail.** Shows the description (`—` for `null`) and both dates; a link to another entity reuses the page and loads
  the new id.
- **Form.** One page for both states; fills itself when the edited entity arrives. Validation mirrors the API: name
  required and at most 200, description at most 2000; values are sent trimmed, an empty description as `null`. _Save_
  is disabled while loading or saving, labelled _Loading…_ / _Saving…_ / _Save_. After a save, the slice navigates to the
  detail page only if this visit of the form is still open; _← Cancel_ works mid-save.

### Web tests

| Tier    | Files                                 | Covers                                                                                                                                                                                                                                |
| ------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| unit    | the service and each helper's spec    | each request's method, URL and body; the list params round trip and fallbacks; the filter form mapping                                                                                                                                |
| unit    | `app-router.serializer.spec.ts`       | the deepest route's state, merged params, `null` with no state                                                                                                                                                                        |
| unit    | each slice's reducer and effects spec | as the NgRx testing conventions say: own-state navigation, `Leave`, each status; `switchMap` cancelling, `concatMap` ordering, nothing after `Leave`, a write from another visit ignored, stepping back past the last page            |
| browser | each component's spec                 | the behaviour in the component table                                                                                                                                                                                                  |
| browser | each page's spec                      | the watch (first load, equal value ignored, new value reloads, `null` waits, `Leave` on destroy); each UI state; list: the delete flow and the exact `navigate` each control dispatches; form: fill on load, no save for a blank name |

### With `angular-fundamental-ngx`

When the project opts in, the registry's `button`, `dialog`, `select`, `pagination`, `input`, `form` and
`message-strip` replace the hand-written primitives, which go with their stories and specs. The rest holds, with these
differences:

- `DeleteDialog` composes `fd-dialog` (header, body, footer; `fdButton`, the confirm `variant="negative"`) with the same
  inputs, outputs and wording, and handles Escape itself.
- The list page uses two `fd-select`s (page size binds numbers) and `fd-pagination` bound one way with
  `displayTotalItems` off, beside the page's own range text.
- Buttons take `fdButton` (`emphasized` for the primary action, `transparent` for _Clear_ and row _Delete_), inputs
  `fdFormControl` with their own `fdFormLabel`; the banner is `fd-message-strip`.
- Specs: the three primitive specs go; the list spec drives `fd-select` as a combobox and clicks _Next page_; the dialog
  spec matches _Delete_ loosely. Storybook lists only the two `Components/DeleteDialog` stories.

## Conventions

### Layout

| Path                     | Holds                                                                           |
| ------------------------ | ------------------------------------------------------------------------------- |
| `src/app/pages/`         | one page component per route, each reading its slice and loading from its watch |
| `src/app/layouts/`       | the layouts the routes nest in                                                  |
| `src/app/components/`    | app components, each with a story and a browser spec                            |
| `src/app/components/ui/` | the primitives, selectors prefixed `ui`, each with a story and a browser spec   |
| `src/app/models/`        | the resources' types, mirroring the API's                                       |
| `src/app/services/`      | one HTTP service per resource                                                   |
| `src/app/helpers/`       | the list-params and filter-form helpers                                         |
| `src/app/store/`         | `app-context/`, `app-router/`, one slice per page                               |
| `src/environments/`      | the API base URL, per build                                                     |
| `.storybook/`            | Storybook's `main.ts`, `preview.ts`, `tsconfig.json`, `typings.d.ts`            |
| `Dockerfile`             | the Node build, then Nginx serving it                                           |
| `nginx.conf`             | the SPA fallback                                                                |
| `docker-compose.yml`     | the `web` service                                                               |

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
| `pnpm compose:up` / `pnpm compose:down`           | the Nginx image on `WEB_PORT`       |

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

## Smoke test

- `pnpm test:browser` passes, and `pnpm build-storybook` builds with `storybook-static/index.json` listing the
  Starter's stories.
- `pnpm compose:up` builds the image and serves the app on `WEB_PORT` (default 4200): fetch `/entities`, which answers
  200 with the app's `<title>` through the SPA fallback; with an API at the development `apiBaseUrl`, the page lists its
  entities (the call the page makes, as Angular + the API contract says).
