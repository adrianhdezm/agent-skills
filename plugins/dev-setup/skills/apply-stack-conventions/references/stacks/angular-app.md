# Angular app

A single Angular 22 project: an SPA with NgRx route-driven state, Tailwind, Storybook and two test layers, calling an
API it does not own, and served as static files by Nginx. It is the web package of the Angular full stack at the repo
root, without the API, the database or the end-to-end suite. SAP Fiori Horizon components are opt-in.

## Composition

The architecture concepts, technologies and integrations this stack is built from. Their conventions, after this
file's own, are assembled into the project's `coding-conventions.md` in this order. An entry marked optional is
included only when the project has it, with `--with <name>`, or `--with <group>` for every entry of a group.

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
├── angular.json / package.json / tsconfig{,.app,.spec}.json / vitest.config.mts
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
| dependencies        | the Angular and NgRx docs' packages and `@playwright/test@1`; the shared tooling as direct dev dependencies (`eslint`, `@eslint/js`, `typescript-eslint`, `eslint-config-prettier`, `globals`, `@types/node@24`); the CLI's `typescript` replaced by the exact 6.0.x and its `vitest` by `vitest@5`; the CLI's `prettier` kept     |
| environments        | development: `production: false`, `appName: '<App name>'`, `apiBaseUrl` the development URL (default `http://localhost:3000`); production: `production: true`, the same `appName`, `apiBaseUrl` the production URL (default `` `${window.location.protocol}//${window.location.hostname}:3000` ``, so one build works on any host) |
| `src/index.html`    | `<title>` is `<App name>`                                                                                                                                                                                                                                                                                                          |
| `eslint.config.mjs` | the Angular + ESLint presets, selectors, overrides and ignores                                                                                                                                                                                                                                                                     |
| `.prettierrc`       | shared, with the HTML override; `.prettierignore`: `node_modules`, `dist`, `.angular`                                                                                                                                                                                                                                              |
| `Dockerfile`        | Nginx + Docker Compose's two stages, as Angular + Nginx says                                                                                                                                                                                                                                                                       |

`<App name>` is the repo name in Title Case.

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
| `pnpm typecheck`                                  | the app and spec tsconfigs          |
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
