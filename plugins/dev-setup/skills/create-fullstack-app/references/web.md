# Web scaffold

Angular 22 + NgRx 22 + `@ngrx/router-store` + Tailwind v4. This file covers the default stack; the Fundamental NGX
reference layers FD-NGX on top.

The scaffold ships a complete **entity CRUDL** example wired end to end: a list page with filter / sort / pagination
controls, a detail page, a shared form page for create and edit, and a confirm dialog for delete. The app is a
statechart: each page route is a state, and actions are the only transitions. The URL enters the store one way, from
`routerNavigatedAction` into the page reducer whose state matches; each page reads only its own slice, registered on
its route, and loads its data from its own lifecycle.

## Contents

1. [Scaffold with Angular CLI](#1-scaffold-with-angular-cli)
2. [Clean up CLI defaults](#2-clean-up-cli-defaults)
3. [Scripts and dependencies](#3-scripts-and-dependencies)
4. [Tailwind v4](#4-tailwind-v4)
5. [Environment files](#5-environment-files)
6. [Folder structure](#6-folder-structure)
7. [Core files](#7-core-files)
8. [Global slices](#8-global-slices)
9. [Shared model and page slices](#9-shared-model-and-page-slices)
10. [Pages](#10-pages)
11. [Tests](#11-tests)
12. [Nginx production serving](#12-nginx-production-serving)

## 1. Scaffold with Angular CLI

Pin the CLI to the Angular major the rest of the stack targets, never `@latest`:

```bash
pnpm dlx @angular/cli@22 new web \
  --directory=web --package-manager=pnpm --skip-install --skip-git \
  --style=scss --routing=true --ssr=false --defaults
```

Then **immediately** apply the conventions below.

## 2. Clean up CLI defaults

```sh
rm web/.editorconfig web/README.md web/src/app/app.ts web/src/app/app.html web/src/app/app.scss web/src/app/app.spec.ts
pnpm --filter web pkg delete packageManager devDependencies.prettier devDependencies.typescript
```

- `.editorconfig` goes because Prettier handles indentation and the two can disagree. The CLI's own `web/.prettierrc`
  is overwritten by the one in [references/eslint-prettier.md](eslint-prettier.md). `README.md` goes because the
  docs live at the repo root (`coding-conventions.md`). The CLI's `.vscode/` and `public/favicon.ico` stay.
- The CLI's root component (`app.ts` + `app.html` + `app.scss`) and its spec are replaced by `app.component.ts` in
  section 7 and `app.component.spec.ts` ([references/web-testing.md](web-testing.md#2-unit-tests)).
- `packageManager` belongs to the root manifest. `prettier` and `typescript` are removed so the root shared-tooling
  step adds them back as `catalog:`; `pnpm add --save-catalog` leaves an existing direct `prettier` range in place.
- In `web/src/index.html`, the CLI's `<title>Web</title>` becomes the app name (the repo name in Title Case, the same
  value as `appName` in the environment files).

## 3. Scripts and dependencies

Set the scripts:

```sh
pnpm --filter web pkg set scripts.lint="eslint ." scripts.test="ng test" \
  scripts.typecheck="tsc -p tsconfig.app.json --noEmit && tsc -p tsconfig.spec.json --noEmit && tsc -p e2e/tsconfig.json --noEmit" \
  scripts.format="prettier --write \"**/*.{ts,js,mjs,html,css,json,md,yml,yaml}\"" \
  "scripts['format:check']=prettier --check \"**/*.{ts,js,mjs,html,css,json,md,yml,yaml}\""
```

Keep the CLI's `ng`, `start`, `build` and `watch` scripts as generated. `test` runs on Analog's Vitest builder
([references/web-testing.md](web-testing.md#1-setup-analogs-vitest-builder)), which runs once unless given `--watch`,
like the API's `vitest run`. `typecheck` covers what `ng build` does not compile: the specs, the test setup, the e2e
suite and the Playwright config. `ng build` stays the check for the templates.

The `pages/*.component.ts` files are written from the patterns in section 10; the routes import all three, so the
build fails until they exist.

Add NgRx, Tailwind and angular-eslint, pinned to the Angular major (NgRx and angular-eslint track it). These run in
SKILL step 5, with the other installs:

```sh
pnpm --filter web add @ngrx/store@22 @ngrx/effects@22 @ngrx/router-store@22
pnpm --filter web add -D @ngrx/store-devtools@22 angular-eslint@22 tailwindcss @tailwindcss/postcss postcss
```

The CLI's own Angular and `jsdom` entries stay as generated. ESLint, Prettier, TypeScript, `@types/node` and Vitest are
added by the root shared-tooling step in `monorepo-root.md`, which turns the CLI's `vitest` entry into `catalog:`.

**Storybook and the test layers** are added after the app is in place: Storybook for the components
([references/web-storybook.md](web-storybook.md)), and the Analog test setup with the browser-mode and full-stack e2e
layers ([references/web-testing.md](web-testing.md)). They replace the `test` target in `angular.json`, add the
`storybook`, `build-storybook`, `test:browser` and `test:e2e` scripts and their dev dependencies. `ng test` stays the
required `test` check.

## 4. Tailwind v4

### `web/.postcssrc.json`

```json
{
  "plugins": {
    "@tailwindcss/postcss": {}
  }
}
```

### `web/src/styles.css`

Imports Tailwind's layers one by one, so preflight can be dropped when Fundamental NGX is added:

```css
@layer theme, base, components, utilities;

@import 'tailwindcss/theme.css' layer(theme);
@import 'tailwindcss/preflight.css' layer(base);
@import 'tailwindcss/utilities.css' layer(utilities);
```

### Remove the SCSS

```sh
rm web/src/styles.scss
find web/src -name '*.scss' -delete
```

### `web/angular.json`

In `projects.web`:

- `schematics["@schematics/angular:component"].style` becomes `"css"`.
- `architect.build.options.styles` becomes `["src/styles.css"]` and `inlineStyleLanguage` becomes `"css"`.
- `architect.build.configurations.production.budgets`: initial `2mb` warning / `4mb` error; `anyComponentStyle`
  `4kB` / `8kB`.
- `architect.build.configurations.development` gets the environment swap:

  ```json
  "fileReplacements": [
    { "replace": "src/environments/environment.ts", "with": "src/environments/environment.development.ts" }
  ]
  ```

## 5. Environment files

### `web/src/environments/environment.ts` (production)

```ts
// Production: the app is served from the server's host (not localhost), and the
// API is exposed on port 3000 of that same host (see docker-compose.yml).
// Derive the base URL from the current origin so one build works on any host.
export const environment = {
  production: true,
  appName: '<App name>',
  apiBaseUrl: `${window.location.protocol}//${window.location.hostname}:3000`
};
```

### `web/src/environments/environment.development.ts`

```ts
export const environment = {
  production: false,
  appName: '<App name>',
  apiBaseUrl: 'http://localhost:3000'
};
```

`<App name>` is the repo name in Title Case (`my-app` → `My App`), the same in every environment file. Only the
`app-context` store slice imports `environment`. Everything else reads `apiBaseUrl` and `appName` from the
store. A third file, `environment.e2e.ts`, points the e2e run at its own API; it belongs to the e2e layer
([references/web-testing.md](web-testing.md#4-full-stack-e2e)).

## 6. Folder structure

```
web/
├── .storybook/              # Storybook (Vite/Analog) config — see references/web-storybook.md
│   ├── main.ts / preview.ts / tsconfig.json / typings.d.ts
├── e2e/                     # Playwright full-stack e2e — see references/web-testing.md
│   ├── global-setup.ts / global-teardown.ts / tsconfig.json
│   ├── pages/               #   one *.spec.ts per page
│   └── utils/               #   env.ts (e2e ports + database), api.ts (seed via the real API)
├── playwright.config.ts     # e2e runner config (CommonJS: uses __dirname)
├── vitest.config.mts        # Vitest projects `unit` (jsdom) + `browser` (Chromium), run by `ng test`
└── src/
    ├── test-setup.ts        # setupTestBed() for the unit project
    ├── testing/             # render() + browser-setup.ts for the browser project; navigated() for reducer specs
    ├── environments/        # environment.ts, environment.development.ts, environment.e2e.ts
    └── app/
        ├── app.component.ts         # root
        ├── app.config.ts            # global slices (appContext, appRouter), provideRouterStore, app-router effects
        ├── app.routes.ts            # the statechart: one route per state (data.state), each registering its page slice
        ├── components/
        │   ├── confirm-dialog.component.ts    # example: presentational, store-free, input()/output()
        │   ├── confirm-dialog.component.browser.spec.ts   # its browser-mode test
        │   └── confirm-dialog.stories.ts      # its Storybook story
        ├── layouts/
        │   └── main-layout.component.ts
        ├── pages/
        │   ├── entity-list-page.component.ts
        │   ├── entity-list-page.component.browser.spec.ts   # browser-mode test
        │   ├── entity-detail-page.component.ts  (+ .browser.spec.ts)
        │   └── entity-form-page.component.ts  (+ .browser.spec.ts)  # reused for /entities/new + /entities/:id/edit
        ├── models/
        │   └── entity.model.ts       # resource types, mirroring the API's names and shapes
        ├── services/
        │   ├── entity.service.ts     # EntityService: the only HttpClient user; called from effects
        │   └── entity.service.spec.ts
        ├── helpers/
        │   ├── entity-list-params.helper.ts  (+ .spec.ts)  # URL ↔ ListEntityInput (de)serializer
        │   ├── entity-filter-form.helper.ts  (+ .spec.ts)  # list page's filter strip ↔ EntityFilterInput + range label
        │   └── http-error.helper.ts  (+ .spec.ts)          # httpErrorMessage, shared by the page effects
        └── store/
            ├── app-context/          # global slice: apiBaseUrl + appName (+ reducer/selectors specs)
            ├── app-router/           # global slice: AppState, serializer, navigatedRoute(), Navigate action + effect (+ specs)
            ├── entity-list-page/     # page slice, registered on the list route
            │   ├── entity-list-page.{model,actions,reducer,selectors,effects}.ts
            │   └── entity-list-page.{reducer,selectors,effects}.spec.ts
            ├── entity-detail-page/   # page slice (+ reducer/selectors/effects specs), registered on the detail route
            └── entity-form-page/     # page slice (+ reducer/selectors/effects specs), registered on the new + edit routes
```

Every page slice gets `*.reducer.spec.ts` / `*.selectors.spec.ts` / `*.effects.spec.ts` beside it; the global
`app-context` slice gets reducer + selectors specs and `app-router` serializer, helper and effects specs. The service and helpers
get a `*.spec.ts`, and each page and component gets a `*.component.browser.spec.ts`. The test layers are specified in
[references/web-testing.md](web-testing.md); Storybook in [references/web-storybook.md](web-storybook.md).

**One slice per page.** Each page owns a slice at `store/<page-name>/`, named after the page component, and registers
it on its own route with `provideState` + `provideEffects`. Only `appContext` and the router state
(`appRouter`) are global, in `app.config.ts`. Pages never read another page's slice: what two pages both need (the entity) each loads for itself,
and the list fetches fresh data whenever it is shown. Resource types that several slices use live in `models/`,
not in a slice.

**Data access goes through a service.** `services/entity.service.ts` (`EntityService`, `providedIn: 'root'`) is the
only code that uses `HttpClient`: `list`, `get`, `create`, `update` and `delete`, each returning an `Observable`. It
reads `apiBaseUrl` from the app-context slice. Effects inject the service and map its results to success and failure
actions; pages never call it.

**The app is a statechart.** Each page route is a state, named in its `data: { state }` (`entity-list`,
`entity-detail`, `entity-new`, `entity-edit`, typed by `AppState`), and actions are the only transitions. Each page's
`status` union holds its sub-states (`'idle' | 'loading' | 'loaded' | …`). Data moves one way, in two loops:

- **Navigation:** user intent → `AppRouterActions.navigate` → `navigate$` → Angular `Router` →
  `routerNavigatedAction` → the page reducer whose state matches stores the params or query it needs. Back, forward,
  deep links and refresh enter through the same `routerNavigatedAction`.
- **Data:** the page watches its slice's query or id from `ngOnInit` and dispatches `Fetch` / `Load` for each new
  value → an effect calls the service → `<Action> Success` / `Failure` → reducer → the page.

The router only writes state; it never starts a request. The page decides when to load, for as long as it is mounted.

**Actions are named for intent, not lifecycle.** The page asks for data with `Load` (detail, form) or `Fetch` (the
list's request for one input), and results are `<Action> Success` / `<Action> Failure`. `Leave` resets the slice when
the page is destroyed.

**Every page loads the same way.** In `ngOnInit` the page starts a watch on its slice's route state (the list input,
the detail id, the form target), skips `null`, drops repeats with `distinctUntilChanged`, and dispatches `Fetch` /
`Load` for each value until it is destroyed (`takeUntilDestroyed`); `ngOnDestroy` dispatches `Leave`. A reused
component (page 2 → 3, detail 42 → 43) reloads because the watch is still running. `Fetch` / `Load` set the slice's
`status` to `'loading'` and an effect calls the service; success sets `'loaded'` (or `'ready'` for the form) with the
data, failure sets `'error'` with a message. Each slice has one `status` field, a union of the page's states, instead
of boolean flags such as `loading` / `saving` / `deleting`, and the template switches its status-driven body on it
with `@switch (status())`; the error banner over it is an `@if (status() === 'error')`.

**Pages inject only the `Store` and read only their slice.** Route params and the list query reach a page through its
own slice, never through router selectors; navigation is `AppRouterActions.navigate`; forms are built with
`new FormGroup` / `new FormControl` instead of an injected `FormBuilder`. Only effects inject services
(`HttpClient`, `Router`).

## 7. Core files

### `web/src/main.ts`

```ts
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app.component';

bootstrapApplication(App, appConfig).catch((err) => console.error(err));
```

### `web/src/app/app.component.ts`

```ts
import { Component } from '@angular/core';
import { MainLayout } from './layouts/main-layout.component';

@Component({
  selector: 'app-root',
  imports: [MainLayout],
  template: `<app-main-layout />`
})
export class App {}
```

### `web/src/app/layouts/main-layout.component.ts`

```ts
import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Store } from '@ngrx/store';
import { selectAppName } from '../store/app-context/app-context.selectors';

@Component({
  selector: 'app-main-layout',
  imports: [RouterOutlet],
  host: { class: 'flex min-h-screen flex-col' },
  template: `
    <header class="flex h-12 items-center bg-slate-900 px-6 text-white shadow">
      <span class="text-lg font-bold tracking-wide">{{ appName() }}</span>
    </header>
    <main class="flex-1 p-6">
      <router-outlet />
    </main>
  `
})
export class MainLayout {
  protected readonly appName = inject(Store).selectSignal(selectAppName);
}
```

### `web/src/app/app.config.ts`

Only the global slices are registered here, with the app-router effects; the route-level `provideEffects(...)` calls join the same effects runtime.

```ts
import { type ApplicationConfig, isDevMode, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideStore } from '@ngrx/store';
import { provideEffects } from '@ngrx/effects';
import { provideStoreDevtools } from '@ngrx/store-devtools';
import { NavigationActionTiming, provideRouterStore, routerReducer } from '@ngrx/router-store';
import { routes } from './app.routes';
import { APP_CONTEXT_FEATURE_KEY } from './store/app-context/app-context.selectors';
import { appContextReducer } from './store/app-context/app-context.reducer';
import * as appRouterEffects from './store/app-router/app-router.effects';
import { AppRouterSerializer } from './store/app-router/app-router.serializer';
import { ROUTER_FEATURE_KEY } from './store/app-router/app-router.selectors';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(),
    // Global stores:
    //   - application context (api base URL, app name)
    //   - router (@ngrx/router-store turns every navigation into actions; page reducers copy
    //     what their state needs from routerNavigatedAction, so pages read only their slice)
    // Page slices are registered on their routes (see app.routes.ts). Navigation is an
    // action: the app-router effects are the only code that calls the Angular Router.
    provideStore({
      [APP_CONTEXT_FEATURE_KEY]: appContextReducer,
      [ROUTER_FEATURE_KEY]: routerReducer
    }),
    // PostActivation: the store never holds a URL the router has not committed (a guard can still cancel before).
    provideRouterStore({
      stateKey: ROUTER_FEATURE_KEY,
      serializer: AppRouterSerializer,
      navigationActionTiming: NavigationActionTiming.PostActivation
    }),
    provideEffects(appRouterEffects),
    provideStoreDevtools({ maxAge: 25, logOnly: !isDevMode() })
  ]
};
```

### `web/src/app/app.routes.ts`

The route table is the app's statechart: each page route is one state, named in `data: { state }` and typed by
`AppState` (`satisfies` makes a typo a compile error). The serializer copies the deepest route's state into every
router action, and each page reducer reacts only to its own. Each page route registers its slice. The form page
serves `new` and `:id/edit`, two states, so the two routes sit under one componentless parent that registers the form
slice once; registering it on both routes would run its effects twice. Route-level slices and effects stay registered
after the page is left, which is why every page resets its slice on `Leave`.

```ts
import type { Routes } from '@angular/router';
import { provideEffects } from '@ngrx/effects';
import { provideState } from '@ngrx/store';
import { EntityDetailPage } from './pages/entity-detail-page.component';
import { EntityFormPage } from './pages/entity-form-page.component';
import { EntityListPage } from './pages/entity-list-page.component';
import { type AppState } from './store/app-router/app-router.model';
import * as entityDetailPageEffects from './store/entity-detail-page/entity-detail-page.effects';
import { entityDetailPageReducer } from './store/entity-detail-page/entity-detail-page.reducer';
import { ENTITY_DETAIL_PAGE_FEATURE_KEY } from './store/entity-detail-page/entity-detail-page.selectors';
import * as entityFormPageEffects from './store/entity-form-page/entity-form-page.effects';
import { entityFormPageReducer } from './store/entity-form-page/entity-form-page.reducer';
import { ENTITY_FORM_PAGE_FEATURE_KEY } from './store/entity-form-page/entity-form-page.selectors';
import * as entityListPageEffects from './store/entity-list-page/entity-list-page.effects';
import { entityListPageReducer } from './store/entity-list-page/entity-list-page.reducer';
import { ENTITY_LIST_PAGE_FEATURE_KEY } from './store/entity-list-page/entity-list-page.selectors';

// The app's statechart: each page route is one state (data.state), and actions are
// the only transitions between them. Each page registers its own slice on its route.
// The form page serves two states, so they share one provider group and its effects run once.
export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'entities' },
  {
    path: 'entities',
    children: [
      {
        path: '',
        pathMatch: 'full',
        component: EntityListPage,
        data: { state: 'entity-list' satisfies AppState },
        providers: [provideState(ENTITY_LIST_PAGE_FEATURE_KEY, entityListPageReducer), provideEffects(entityListPageEffects)]
      },
      {
        path: '',
        providers: [provideState(ENTITY_FORM_PAGE_FEATURE_KEY, entityFormPageReducer), provideEffects(entityFormPageEffects)],
        children: [
          { path: 'new', component: EntityFormPage, data: { state: 'entity-new' satisfies AppState } },
          { path: ':id/edit', component: EntityFormPage, data: { state: 'entity-edit' satisfies AppState } }
        ]
      },
      {
        path: ':id',
        component: EntityDetailPage,
        data: { state: 'entity-detail' satisfies AppState },
        providers: [provideState(ENTITY_DETAIL_PAGE_FEATURE_KEY, entityDetailPageReducer), provideEffects(entityDetailPageEffects)]
      }
    ]
  }
];
```

## 8. Global slices

Two slices are global, because every page and layout may need them.

### App-context slice

Static for the life of the app: its initial state comes from `environment` and no action changes it.

#### `store/app-context/app-context.model.ts`

```ts
export interface AppContextState {
  apiBaseUrl: string;
  appName: string;
}
```

#### `store/app-context/app-context.reducer.ts`

```ts
import { createReducer } from '@ngrx/store';
import { environment } from '../../../environments/environment';
import { type AppContextState } from './app-context.model';

export const initialAppContextState: AppContextState = {
  apiBaseUrl: environment.apiBaseUrl,
  appName: environment.appName
};

export const appContextReducer = createReducer(initialAppContextState);
```

#### `store/app-context/app-context.selectors.ts`

```ts
import { createFeatureSelector, createSelector } from '@ngrx/store';
import { type AppContextState } from './app-context.model';

export const APP_CONTEXT_FEATURE_KEY = 'appContext';

export const selectAppContext = createFeatureSelector<AppContextState>(APP_CONTEXT_FEATURE_KEY);
export const selectApiBaseUrl = createSelector(selectAppContext, (s) => s.apiBaseUrl);
export const selectAppName = createSelector(selectAppContext, (s) => s.appName);
```

### App-router slice

The router side of the statechart. `@ngrx/router-store` turns every navigation into actions and keeps the last
route under the `appRouter` key (not router-store's default `router`, so the key is passed to `provideRouterStore`).
`AppRouterSerializer` reduces each snapshot to `{ url, state, params, queryParams }`, where `state` is the deepest
route's `data.state`. The URL enters the store one way only: page reducers handle `routerNavigatedAction`, read it
with `navigatedRoute(action)`, and copy what their own state needs when `state` is theirs. Pages and page effects
never select from `appRouter`.

Navigation is an action too: pages and page effects dispatch `AppRouterActions.navigate`, and the app-router
`navigate$` effect is the only code that calls the Angular `Router`. It is registered globally in `app.config.ts`.

#### `store/app-router/app-router.model.ts`

```ts
import { type Params } from '@angular/router';

/** The app's states: one per page route, declared on the route as `data: { state }`. */
export type AppState = 'entity-list' | 'entity-detail' | 'entity-new' | 'entity-edit';

/** What the serializer keeps of a router snapshot: plain, serializable data. */
export interface AppRouterState {
  url: string;
  /** The deepest route's `data.state`; `null` on a route that declares none (the root redirect). */
  state: AppState | null;
  /** Route params of the whole matched branch, e.g. `{ id }`. */
  params: Params;
  queryParams: Params;
}
```

#### `store/app-router/app-router.serializer.ts`

```ts
import { type Params, type RouterStateSnapshot } from '@angular/router';
import { type RouterStateSerializer } from '@ngrx/router-store';
import { type AppRouterState, type AppState } from './app-router.model';

export class AppRouterSerializer implements RouterStateSerializer<AppRouterState> {
  serialize(snapshot: RouterStateSnapshot): AppRouterState {
    let route = snapshot.root;
    let params: Params = {};
    let state: AppState | null = null;
    while (route.firstChild) {
      route = route.firstChild;
      params = { ...params, ...route.params };
      state = (route.data['state'] as AppState | undefined) ?? state;
    }
    return { url: snapshot.url, state, params, queryParams: snapshot.root.queryParams };
  }
}
```

#### `store/app-router/app-router.helper.ts`

The one place that knows `routerNavigatedAction` carries an `AppRouterState`: router-store types its payload with its
default serializer's shape.

```ts
import { type RouterNavigatedAction } from '@ngrx/router-store';
import { type AppRouterState } from './app-router.model';

/** The route a navigation landed on, as `AppRouterSerializer` wrote it. */
export function navigatedRoute(action: RouterNavigatedAction): AppRouterState {
  return action.payload.routerState as unknown as AppRouterState;
}
```

#### `store/app-router/app-router.selectors.ts`

```ts
import { createFeatureSelector } from '@ngrx/store';
import { type RouterReducerState } from '@ngrx/router-store';
import { type AppRouterState } from './app-router.model';

export const ROUTER_FEATURE_KEY = 'appRouter';

// For devtools and debugging only: pages and page slices get the route from routerNavigatedAction.
export const selectRouterState = createFeatureSelector<RouterReducerState<AppRouterState>>(ROUTER_FEATURE_KEY);
```

#### `store/app-router/app-router.actions.ts`

```ts
import { createActionGroup, props } from '@ngrx/store';

export const AppRouterActions = createActionGroup({
  source: 'App Router',
  events: {
    /**
     * `commands: []` keeps the current path and replaces only the query params; `null` removes a param.
     * `replaceUrl` corrects the current history entry instead of adding one (a step the user did not ask for).
     */
    Navigate: props<{ commands: string[]; queryParams?: Record<string, string | null>; replaceUrl?: boolean }>()
  }
});
```

#### `store/app-router/app-router.effects.ts`

```ts
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { tap } from 'rxjs';
import { AppRouterActions } from './app-router.actions';

export const navigate$ = createEffect(
  (actions$ = inject(Actions), router = inject(Router)) =>
    actions$.pipe(
      ofType(AppRouterActions.navigate),
      tap(({ commands, queryParams, replaceUrl }) => void router.navigate(commands, { queryParams, replaceUrl }))
    ),
  { functional: true, dispatch: false }
);
```

## 9. Shared model and page slices

### `models/entity.model.ts`

Mirrors the API by name and shape: `Entity`, `CreateEntityInput` / `UpdateEntityInput`, `EntityFilterInput` with the
scalar filter inputs it uses, `EntitySortInput`, `ListEntityInput` and `PaginatedResult<T>`. The web cannot import
the API package, so a change to the API's inputs changes this file too. Dates travel as ISO strings.

```ts
export interface Entity {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEntityInput {
  name: string;
  description?: string | null;
}
export type UpdateEntityInput = Partial<CreateEntityInput>;

export interface StringFilterInput {
  eq?: string;
  ne?: string;
  lt?: string;
  le?: string;
  gt?: string;
  ge?: string;
  between?: [string, string];
  in?: string[];
  contains?: string;
  notContains?: string;
  beginsWith?: string;
}

export interface IdFilterInput {
  eq?: string;
  ne?: string;
  in?: string[];
}

/** ISO-8601 date or date-time strings. */
export interface DateFilterInput {
  eq?: string;
  ne?: string;
  lt?: string;
  le?: string;
  gt?: string;
  ge?: string;
  between?: [string, string];
  in?: string[];
}

export interface EntityFilterInput {
  id?: IdFilterInput;
  name?: StringFilterInput;
  description?: StringFilterInput;
  createdAt?: DateFilterInput;
  updatedAt?: DateFilterInput;
  and?: EntityFilterInput[];
  or?: EntityFilterInput[];
  not?: EntityFilterInput;
}

export type SortDirection = 'ASC' | 'DESC';
export type EntitySortField = 'name' | 'createdAt' | 'updatedAt';

export interface EntitySortInput {
  field: EntitySortField;
  direction: SortDirection;
}

export interface ListEntityInput {
  filter?: EntityFilterInput;
  sort?: EntitySortInput;
  page: number;
  pageSize: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
```

### `services/entity.service.ts`

All HTTP for the resource, called only from effects. Each method writes its full URL explicitly, so it reads as the request it sends; there is no private `url()` helper. `list` reuses the shared `toParams` (from `entity-list-params.helper.ts`) — the same mapping the page URL uses — so the query it sends and the URL stay identical; there is no params helper _private to the service_.

```ts
import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Store } from '@ngrx/store';
import { type Observable } from 'rxjs';
import { toParams } from '../helpers/entity-list-params.helper';
import {
  type CreateEntityInput,
  type Entity,
  type ListEntityInput,
  type PaginatedResult,
  type UpdateEntityInput
} from '../models/entity.model';
import { selectApiBaseUrl } from '../store/app-context/app-context.selectors';

@Injectable({ providedIn: 'root' })
export class EntityService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(Store).selectSignal(selectApiBaseUrl);

  list(input: ListEntityInput): Observable<PaginatedResult<Entity>> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(toParams(input))) {
      if (value !== null) {
        params = params.set(key, value);
      }
    }
    return this.http.get<PaginatedResult<Entity>>(`${this.apiBaseUrl()}/entities`, { params });
  }

  get(id: string): Observable<Entity> {
    return this.http.get<Entity>(`${this.apiBaseUrl()}/entities/${id}`);
  }

  create(input: CreateEntityInput): Observable<Entity> {
    return this.http.post<Entity>(`${this.apiBaseUrl()}/entities`, input);
  }

  update(id: string, input: UpdateEntityInput): Observable<Entity> {
    return this.http.patch<Entity>(`${this.apiBaseUrl()}/entities/${id}`, input);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiBaseUrl()}/entities/${id}`);
  }
}
```

### `helpers/entity-list-params.helper.ts`

Converts between router `Params` and `ListEntityInput`. The page URL and the API request share this one format (`?filter=<json>&sortField=…&sortDirection=…&page=…&pageSize=…`), so it lives in `helpers/` for the list reducer (URL → input), the list page and effects (input → URL) and the service. Default values serialize to `null` so the router strips them, and malformed params fall back to defaults instead of throwing. `sameListInput` is the page watch's equality: two inputs that make the same request are the same.

```ts
import { type EntityFilterInput, type ListEntityInput, type SortDirection, type EntitySortField } from '../models/entity.model';

export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 20;

/** The input of a list URL without params; what the page shows before the router has written one. */
export const DEFAULT_LIST_INPUT: ListEntityInput = { page: DEFAULT_PAGE, pageSize: DEFAULT_PAGE_SIZE };

const SORT_FIELDS: readonly EntitySortField[] = ['name', 'createdAt', 'updatedAt'];

export interface Params {
  readonly [key: string]: string | undefined;
}

export function parseListInput(params: Params): ListEntityInput {
  const field = SORT_FIELDS.find((f) => f === params['sortField']);
  const direction: SortDirection = params['sortDirection'] === 'DESC' ? 'DESC' : 'ASC';
  return {
    filter: parseFilter(params['filter']),
    sort: field ? { field, direction } : undefined,
    page: parsePositiveInt(params['page']) ?? DEFAULT_PAGE,
    pageSize: parsePositiveInt(params['pageSize']) ?? DEFAULT_PAGE_SIZE
  };
}

/**
 * Params shared by the page URL and the API request. Absent and default
 * values map to null so the router drops them from the URL.
 */
export function toParams(input: Partial<ListEntityInput>): Record<string, string | null> {
  return {
    filter: input.filter && Object.keys(input.filter).length > 0 ? JSON.stringify(input.filter) : null,
    sortField: input.sort?.field ?? null,
    sortDirection: input.sort?.direction ?? null,
    page: nonDefault(input.page, DEFAULT_PAGE),
    pageSize: nonDefault(input.pageSize, DEFAULT_PAGE_SIZE)
  };
}

/** Two inputs are the same when they make the same request. */
export function sameListInput(a: ListEntityInput, b: ListEntityInput): boolean {
  return JSON.stringify(toParams(a)) === JSON.stringify(toParams(b));
}

function parseFilter(raw: string | undefined): EntityFilterInput | undefined {
  if (!raw) {
    return undefined;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function parsePositiveInt(raw: string | undefined): number | undefined {
  if (!raw) {
    return undefined;
  }
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 1 ? n : undefined;
}

function nonDefault(value: number | undefined, fallback: number): string | null {
  return value && value !== fallback ? String(value) : null;
}
```

### `helpers/entity-filter-form.helper.ts`

The list page's filter strip ↔ `EntityFilterInput` mapping and its range label, kept out of the component so `ng test` covers them directly (`entity-filter-form.helper.spec.ts`), paralleling `entity-list-params.helper.ts`. Exports `FilterForm`, `EMPTY_FILTER_FORM`, `formatRange`, `toFilterInput` and `toFilterForm`; the date conversions stay private. Dates are days in the viewer's time zone, sent as local midnight in ISO-8601.

```ts
import { type DateFilterInput, type EntityFilterInput, type ListEntityInput } from '../models/entity.model';

export interface FilterForm {
  name: string;
  description: string;
  createdFrom: string;
  createdBefore: string;
}

export const EMPTY_FILTER_FORM: FilterForm = { name: '', description: '', createdFrom: '', createdBefore: '' };

export function formatRange(input: ListEntityInput, total: number, totalPages: number): string {
  if (total === 0) {
    return '0 of 0';
  }
  const first = (input.page - 1) * input.pageSize + 1;
  const last = Math.min(input.page * input.pageSize, total);
  return `${first}–${last} of ${total} · page ${input.page} of ${totalPages}`;
}

export function toFilterInput(form: FilterForm): EntityFilterInput | undefined {
  const filter: EntityFilterInput = {};
  if (form.name.trim()) {
    filter.name = { contains: form.name.trim() };
  }
  if (form.description.trim()) {
    filter.description = { contains: form.description.trim() };
  }
  const createdAt: DateFilterInput = {};
  const from = toIsoDate(form.createdFrom);
  const before = toIsoDate(form.createdBefore);
  if (from) {
    createdAt.ge = from;
  }
  if (before) {
    createdAt.lt = before;
  }
  if (Object.keys(createdAt).length > 0) {
    filter.createdAt = createdAt;
  }
  return Object.keys(filter).length > 0 ? filter : undefined;
}

export function toFilterForm(filter: EntityFilterInput | undefined): FilterForm {
  const base: EntityFilterInput = filter ?? {};
  return {
    name: base.name?.contains ?? '',
    description: base.description?.contains ?? '',
    createdFrom: toLocalDate(base.createdAt?.ge),
    createdBefore: toLocalDate(base.createdAt?.lt)
  };
}

// A date input is a day in the viewer's time zone; send local midnight as ISO-8601.
function toIsoDate(day: string): string | undefined {
  if (!day) {
    return undefined;
  }
  const [year, month, date] = day.split('-').map(Number);
  return new Date(year, month - 1, date).toISOString();
}

// Turn an ISO-8601 instant back into the local day a date input shows.
function toLocalDate(iso: string | undefined): string {
  if (!iso) {
    return '';
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
```

### `helpers/http-error.helper.ts`

The message shown when a request fails: the API's `message` when it sent one.

```ts
import { type HttpErrorResponse } from '@angular/common/http';

export function httpErrorMessage(err: HttpErrorResponse): string {
  const body = err.error as { message?: string } | null;
  return body?.message ?? err.message ?? 'Request failed';
}
```

### Page slice shape

Every page slice has the same five files, named after the page: `<page>.model.ts` (its state), `<page>.actions.ts`
(an action group whose source is the page name), `<page>.reducer.ts`, `<page>.selectors.ts` (the feature key and its
selectors) and `<page>.effects.ts` (functional effects). The state has one `status` field typed as a union of the
page's sub-states, plus an `error` message set only when `status` is `'error'`, and the route state the page needs
(the list input, the detail id, the form target), `null` until the router writes it. The reducer writes that route
state on `routerNavigatedAction` when the route's `state` is the page's, and only then: navigating away never
rewrites a slice. Pages dispatch `Leave` on destroy and the reducers reset to the initial state, so a revisit never
shows stale data.

### `store/entity-list-page/`

State `entity-list`. The slice holds the list input, copied from the URL by the reducer, the server data for the
current page and the page's `status` (`'idle' | 'loading' | 'loaded' | 'deleting' | 'error'`).

#### `store/entity-list-page/entity-list-page.model.ts`

```ts
import { type Entity, type ListEntityInput } from '../../models/entity.model';

export type EntityListPageStatus = 'idle' | 'loading' | 'loaded' | 'deleting' | 'error';

export interface EntityListPageState {
  /** The list input from the URL; `null` until the router has navigated to the list. */
  input: ListEntityInput | null;
  status: EntityListPageStatus;
  items: Entity[];
  total: number;
  /** Set when `status` is `'error'`. */
  error: string | null;
}
```

#### `store/entity-list-page/entity-list-page.actions.ts`

```ts
import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { type Entity, type ListEntityInput } from '../../models/entity.model';

export const EntityListPageActions = createActionGroup({
  source: 'Entity List Page',
  events: {
    Leave: emptyProps(),

    /** One request for one list input: the page's watch sends one per new input, and a delete one more. */
    Fetch: props<{ input: ListEntityInput }>(),
    'Fetch Success': props<{ items: Entity[]; total: number }>(),
    'Fetch Failure': props<{ error: string }>(),

    Delete: props<{ id: string }>(),
    'Delete Success': props<{ id: string }>(),
    'Delete Failure': props<{ error: string }>()
  }
});
```

#### `store/entity-list-page/entity-list-page.reducer.ts`

```ts
import { createReducer, on } from '@ngrx/store';
import { routerNavigatedAction } from '@ngrx/router-store';
import { parseListInput } from '../../helpers/entity-list-params.helper';
import { navigatedRoute } from '../app-router/app-router.helper';
import { EntityListPageActions } from './entity-list-page.actions';
import { type EntityListPageState } from './entity-list-page.model';

export const initialEntityListPageState: EntityListPageState = {
  input: null,
  status: 'idle',
  items: [],
  total: 0,
  error: null
};

export const entityListPageReducer = createReducer(
  initialEntityListPageState,
  // The URL enters the slice here, and only for the list's own state.
  on(routerNavigatedAction, (state, action) => {
    const route = navigatedRoute(action);
    return route.state === 'entity-list' ? { ...state, input: parseListInput(route.queryParams) } : state;
  }),
  on(EntityListPageActions.leave, () => initialEntityListPageState),

  on(EntityListPageActions.fetch, (state) => ({ ...state, status: 'loading' as const, error: null })),
  on(EntityListPageActions.fetchSuccess, (state, { items, total }) => ({ ...state, status: 'loaded' as const, items, total })),
  on(EntityListPageActions.fetchFailure, (state, { error }) => ({ ...state, status: 'error' as const, error })),

  on(EntityListPageActions.delete, (state) => ({ ...state, status: 'deleting' as const, error: null })),
  on(EntityListPageActions.deleteFailure, (state, { error }) => ({ ...state, status: 'error' as const, error }))
);
```

#### `store/entity-list-page/entity-list-page.selectors.ts`

```ts
import { createFeatureSelector, createSelector } from '@ngrx/store';
import { type EntityListPageState } from './entity-list-page.model';

export const ENTITY_LIST_PAGE_FEATURE_KEY = 'entityListPage';

export const selectEntityListPageState = createFeatureSelector<EntityListPageState>(ENTITY_LIST_PAGE_FEATURE_KEY);

/** The list input the reducer copied from the URL; `null` until the router has navigated to the list. */
export const selectListInput = createSelector(selectEntityListPageState, (s) => s.input);
export const selectStatus = createSelector(selectEntityListPageState, (s) => s.status);
export const selectItems = createSelector(selectEntityListPageState, (s) => s.items);
export const selectTotal = createSelector(selectEntityListPageState, (s) => s.total);
export const selectError = createSelector(selectEntityListPageState, (s) => s.error);
```

#### `store/entity-list-page/entity-list-page.effects.ts`

The page fetches each new list input itself (its watch, in [Pages](#pages)); the effects cover what is not a new
input. `fetchAfterDelete$` fetches again after a delete, because the totals change and later rows shift onto the
current page. `stepBackPastLastPage$` handles the page that ends up past the end — a delete emptied the last page, or a
deep link names a page that no longer exists: an empty result with a non-zero total on a page above 1 navigates to the
last page with `replaceUrl`, since the user did not ask for that step, and the new input reaches the page's watch
through the reducer like any other navigation.

```ts
import { inject } from '@angular/core';
import { type HttpErrorResponse } from '@angular/common/http';
import { Store } from '@ngrx/store';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, concatMap, filter, map, of, switchMap, withLatestFrom } from 'rxjs';
import { toParams } from '../../helpers/entity-list-params.helper';
import { httpErrorMessage } from '../../helpers/http-error.helper';
import { EntityService } from '../../services/entity.service';
import { AppRouterActions } from '../app-router/app-router.actions';
import { EntityListPageActions } from './entity-list-page.actions';
import { selectListInput } from './entity-list-page.selectors';

// A delete changes the totals and shifts later rows onto the current page, so the list is fetched again.
export const fetchAfterDelete$ = createEffect(
  (actions$ = inject(Actions), store = inject(Store)) =>
    actions$.pipe(
      ofType(EntityListPageActions.deleteSuccess),
      withLatestFrom(store.select(selectListInput).pipe(filter((input) => input !== null))),
      map(([, input]) => EntityListPageActions.fetch({ input }))
    ),
  { functional: true }
);

// A page past the end (a delete emptied the last page, or a stale deep link) steps back to the last page.
export const stepBackPastLastPage$ = createEffect(
  (actions$ = inject(Actions), store = inject(Store)) =>
    actions$.pipe(
      ofType(EntityListPageActions.fetchSuccess),
      withLatestFrom(store.select(selectListInput).pipe(filter((input) => input !== null))),
      filter(([{ items, total }, input]) => items.length === 0 && total > 0 && input.page > 1),
      map(([{ total }, input]) =>
        AppRouterActions.navigate({
          commands: [],
          queryParams: toParams({ ...input, page: Math.ceil(total / input.pageSize) }),
          replaceUrl: true
        })
      )
    ),
  { functional: true }
);

export const fetch$ = createEffect(
  (actions$ = inject(Actions), entityService = inject(EntityService)) =>
    actions$.pipe(
      ofType(EntityListPageActions.fetch),
      switchMap(({ input }) =>
        entityService.list(input).pipe(
          map((res) => EntityListPageActions.fetchSuccess({ items: res.items, total: res.total })),
          catchError((err: HttpErrorResponse) => of(EntityListPageActions.fetchFailure({ error: httpErrorMessage(err) })))
        )
      )
    ),
  { functional: true }
);

export const delete$ = createEffect(
  (actions$ = inject(Actions), entityService = inject(EntityService)) =>
    actions$.pipe(
      ofType(EntityListPageActions.delete),
      concatMap(({ id }) =>
        entityService.delete(id).pipe(
          map(() => EntityListPageActions.deleteSuccess({ id })),
          catchError((err: HttpErrorResponse) => of(EntityListPageActions.deleteFailure({ error: httpErrorMessage(err) })))
        )
      )
    ),
  { functional: true }
);
```

### `store/entity-detail-page/`

State `entity-detail`. The reducer copies the `:id` from the URL; the page's watch loads each new id; `Leave` clears
the slice. A new id on the reused page (detail 42 → 43) drops the previous entity at once, so the page never shows
entity 42 under the URL for 43. Status: `'idle' | 'loading' | 'loaded' | 'error'`.

#### `store/entity-detail-page/entity-detail-page.model.ts`

```ts
import { type Entity } from '../../models/entity.model';

export type EntityDetailPageStatus = 'idle' | 'loading' | 'loaded' | 'error';

export interface EntityDetailPageState {
  /** The `:id` from the URL; `null` until the router has navigated to a detail page. */
  id: string | null;
  status: EntityDetailPageStatus;
  entity: Entity | null;
  /** Set when `status` is `'error'`. */
  error: string | null;
}
```

#### `store/entity-detail-page/entity-detail-page.actions.ts`

```ts
import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { type Entity } from '../../models/entity.model';

export const EntityDetailPageActions = createActionGroup({
  source: 'Entity Detail Page',
  events: {
    Load: props<{ id: string }>(),
    'Load Success': props<{ entity: Entity }>(),
    'Load Failure': props<{ error: string }>(),
    Leave: emptyProps()
  }
});
```

#### `store/entity-detail-page/entity-detail-page.reducer.ts`

```ts
import { createReducer, on } from '@ngrx/store';
import { routerNavigatedAction } from '@ngrx/router-store';
import { navigatedRoute } from '../app-router/app-router.helper';
import { EntityDetailPageActions } from './entity-detail-page.actions';
import { type EntityDetailPageState } from './entity-detail-page.model';

export const initialEntityDetailPageState: EntityDetailPageState = {
  id: null,
  status: 'idle',
  entity: null,
  error: null
};

export const entityDetailPageReducer = createReducer(
  initialEntityDetailPageState,
  // A new id starts the slice over: nothing of the previous entity survives.
  on(routerNavigatedAction, (state, action) => {
    const route = navigatedRoute(action);
    const id = route.state === 'entity-detail' ? (route.params['id'] as string) : null;
    return id !== null && id !== state.id ? { ...initialEntityDetailPageState, id } : state;
  }),
  on(EntityDetailPageActions.load, (state) => ({ ...state, status: 'loading' as const, entity: null, error: null })),
  on(EntityDetailPageActions.loadSuccess, (state, { entity }) => ({ ...state, status: 'loaded' as const, entity })),
  on(EntityDetailPageActions.loadFailure, (state, { error }) => ({ ...state, status: 'error' as const, error })),
  on(EntityDetailPageActions.leave, () => initialEntityDetailPageState)
);
```

#### `store/entity-detail-page/entity-detail-page.selectors.ts`

```ts
import { createFeatureSelector, createSelector } from '@ngrx/store';
import { type EntityDetailPageState } from './entity-detail-page.model';

export const ENTITY_DETAIL_PAGE_FEATURE_KEY = 'entityDetailPage';

export const selectEntityDetailPageState = createFeatureSelector<EntityDetailPageState>(ENTITY_DETAIL_PAGE_FEATURE_KEY);

/** The `:id` the reducer copied from the URL; `null` until the router has navigated to a detail page. */
export const selectId = createSelector(selectEntityDetailPageState, (s) => s.id);
export const selectStatus = createSelector(selectEntityDetailPageState, (s) => s.status);
export const selectEntity = createSelector(selectEntityDetailPageState, (s) => s.entity);
export const selectError = createSelector(selectEntityDetailPageState, (s) => s.error);
```

#### `store/entity-detail-page/entity-detail-page.effects.ts`

```ts
import { inject } from '@angular/core';
import { type HttpErrorResponse } from '@angular/common/http';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, map, of, switchMap } from 'rxjs';
import { httpErrorMessage } from '../../helpers/http-error.helper';
import { EntityService } from '../../services/entity.service';
import { EntityDetailPageActions } from './entity-detail-page.actions';

export const load$ = createEffect(
  (actions$ = inject(Actions), entityService = inject(EntityService)) =>
    actions$.pipe(
      ofType(EntityDetailPageActions.load),
      switchMap(({ id }) =>
        entityService.get(id).pipe(
          map((entity) => EntityDetailPageActions.loadSuccess({ entity })),
          catchError((err: HttpErrorResponse) => of(EntityDetailPageActions.loadFailure({ error: httpErrorMessage(err) })))
        )
      )
    ),
  { functional: true }
);
```

### `store/entity-form-page/`

States `entity-new` and `entity-edit`, one slice. The reducer copies the target from the URL: `{ id: null }` on
`/entities/new`, `{ id }` on `/entities/:id/edit`. The page's watch dispatches `Load` with the target's id, or `null`,
and only an id triggers a request. Status: `'idle' | 'loading' | 'ready' | 'saving' | 'error'`, where `ready` is a new form or an edit form whose entity has loaded. After a successful save, `navigateAfterSave$` dispatches `AppRouterActions.navigate` to the detail page. Writes use `concatMap`, so a second save never cancels the first.

#### `store/entity-form-page/entity-form-page.model.ts`

```ts
import { type Entity } from '../../models/entity.model';

/** `ready`: a new form, or an edit form whose entity has loaded. */
export type EntityFormPageStatus = 'idle' | 'loading' | 'ready' | 'saving' | 'error';

/** Which entity the form is for: `id` is `null` on `/entities/new`. */
export interface EntityFormTarget {
  id: string | null;
}

export interface EntityFormPageState {
  /** Copied from the URL; `null` until the router has navigated to the form. */
  target: EntityFormTarget | null;
  status: EntityFormPageStatus;
  /** The entity being edited; `null` when creating. */
  entity: Entity | null;
  /** Set when `status` is `'error'`. */
  error: string | null;
}
```

#### `store/entity-form-page/entity-form-page.actions.ts`

```ts
import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { type CreateEntityInput, type Entity, type UpdateEntityInput } from '../../models/entity.model';

export const EntityFormPageActions = createActionGroup({
  source: 'Entity Form Page',
  events: {
    /** `id` is `null` on `/entities/new`. */
    Load: props<{ id: string | null }>(),
    'Load Success': props<{ entity: Entity }>(),
    'Load Failure': props<{ error: string }>(),

    Create: props<{ input: CreateEntityInput }>(),
    Update: props<{ id: string; input: UpdateEntityInput }>(),
    'Save Success': props<{ entity: Entity }>(),
    'Save Failure': props<{ error: string }>(),

    Leave: emptyProps()
  }
});
```

#### `store/entity-form-page/entity-form-page.reducer.ts`

```ts
import { createReducer, on } from '@ngrx/store';
import { routerNavigatedAction } from '@ngrx/router-store';
import { type AppRouterState } from '../app-router/app-router.model';
import { navigatedRoute } from '../app-router/app-router.helper';
import { EntityFormPageActions } from './entity-form-page.actions';
import { type EntityFormPageState, type EntityFormTarget } from './entity-form-page.model';

export const initialEntityFormPageState: EntityFormPageState = {
  target: null,
  status: 'idle',
  entity: null,
  error: null
};

export const entityFormPageReducer = createReducer(
  initialEntityFormPageState,
  // A new target starts the slice over: nothing of the previous form survives.
  on(routerNavigatedAction, (state, action) => {
    const target = formTarget(navigatedRoute(action));
    return target !== null && target.id !== state.target?.id ? { ...initialEntityFormPageState, target } : state;
  }),
  on(EntityFormPageActions.load, (state, { id }) => ({
    ...state,
    status: id === null ? ('ready' as const) : ('loading' as const),
    entity: null,
    error: null
  })),
  on(EntityFormPageActions.loadSuccess, (state, { entity }) => ({ ...state, status: 'ready' as const, entity })),
  on(EntityFormPageActions.loadFailure, (state, { error }) => ({ ...state, status: 'error' as const, error })),

  on(EntityFormPageActions.create, EntityFormPageActions.update, (state) => ({ ...state, status: 'saving' as const, error: null })),
  on(EntityFormPageActions.saveSuccess, (state, { entity }) => ({ ...state, status: 'ready' as const, entity })),
  on(EntityFormPageActions.saveFailure, (state, { error }) => ({ ...state, status: 'error' as const, error })),

  on(EntityFormPageActions.leave, () => initialEntityFormPageState)
);

function formTarget(route: AppRouterState): EntityFormTarget | null {
  if (route.state === 'entity-new') {
    return { id: null };
  }
  return route.state === 'entity-edit' ? { id: route.params['id'] as string } : null;
}
```

`target.id !== state.target?.id` is `true` for the first `{ id: null }` too, because the initial `target` is `null` and
`state.target?.id` is then `undefined`.

#### `store/entity-form-page/entity-form-page.selectors.ts`

```ts
import { createFeatureSelector, createSelector } from '@ngrx/store';
import { type EntityFormPageState } from './entity-form-page.model';

export const ENTITY_FORM_PAGE_FEATURE_KEY = 'entityFormPage';

export const selectEntityFormPageState = createFeatureSelector<EntityFormPageState>(ENTITY_FORM_PAGE_FEATURE_KEY);

/** The target the reducer copied from the URL; `null` until the router has navigated to the form. */
export const selectTarget = createSelector(selectEntityFormPageState, (s) => s.target);
export const selectStatus = createSelector(selectEntityFormPageState, (s) => s.status);
export const selectEntity = createSelector(selectEntityFormPageState, (s) => s.entity);
export const selectError = createSelector(selectEntityFormPageState, (s) => s.error);
```

#### `store/entity-form-page/entity-form-page.effects.ts`

```ts
import { inject } from '@angular/core';
import { type HttpErrorResponse } from '@angular/common/http';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, concatMap, filter, map, of, switchMap } from 'rxjs';
import { httpErrorMessage } from '../../helpers/http-error.helper';
import { EntityService } from '../../services/entity.service';
import { AppRouterActions } from '../app-router/app-router.actions';
import { EntityFormPageActions } from './entity-form-page.actions';

export const load$ = createEffect(
  (actions$ = inject(Actions), entityService = inject(EntityService)) =>
    actions$.pipe(
      ofType(EntityFormPageActions.load),
      filter((action): action is typeof action & { id: string } => action.id !== null),
      switchMap(({ id }) =>
        entityService.get(id).pipe(
          map((entity) => EntityFormPageActions.loadSuccess({ entity })),
          catchError((err: HttpErrorResponse) => of(EntityFormPageActions.loadFailure({ error: httpErrorMessage(err) })))
        )
      )
    ),
  { functional: true }
);

// Writes use concatMap so a second save never cancels the first.
export const create$ = createEffect(
  (actions$ = inject(Actions), entityService = inject(EntityService)) =>
    actions$.pipe(
      ofType(EntityFormPageActions.create),
      concatMap(({ input }) =>
        entityService.create(input).pipe(
          map((entity) => EntityFormPageActions.saveSuccess({ entity })),
          catchError((err: HttpErrorResponse) => of(EntityFormPageActions.saveFailure({ error: httpErrorMessage(err) })))
        )
      )
    ),
  { functional: true }
);

export const update$ = createEffect(
  (actions$ = inject(Actions), entityService = inject(EntityService)) =>
    actions$.pipe(
      ofType(EntityFormPageActions.update),
      concatMap(({ id, input }) =>
        entityService.update(id, input).pipe(
          map((entity) => EntityFormPageActions.saveSuccess({ entity })),
          catchError((err: HttpErrorResponse) => of(EntityFormPageActions.saveFailure({ error: httpErrorMessage(err) })))
        )
      )
    ),
  { functional: true }
);

export const navigateAfterSave$ = createEffect(
  (actions$ = inject(Actions)) =>
    actions$.pipe(
      ofType(EntityFormPageActions.saveSuccess),
      map(({ entity }) => AppRouterActions.navigate({ commands: ['/entities', entity.id] }))
    ),
  { functional: true }
);
```

## 10. Pages

### Components: `components/confirm-dialog.component.ts`

Components are presentational and **store-free**: they take `input()` / `output()` and leave the action to the host.
The scaffold ships one, `ConfirmDialog` — a modal used by the list page's delete flow and developed in Storybook
([references/web-storybook.md](web-storybook.md)). It is the template for every later component.

```ts
import { Component, computed, input, output } from '@angular/core';

export type ConfirmDialogTone = 'danger' | 'primary';

let nextId = 0;

// A modal confirm dialog driven entirely by inputs/outputs (no store). The host
// decides when it is shown; it emits `confirmed` / `cancelled` and leaves the action
// to the caller. `busy` disables both buttons and swaps the confirm label while
// the confirmed action is in flight.
@Component({
  selector: 'app-confirm-dialog',
  host: { class: 'contents', '(document:keydown.escape)': 'onEscape()' },
  template: `
    <div class="fixed inset-0 flex items-center justify-center bg-black/40 p-4">
      <div role="dialog" aria-modal="true" [attr.aria-labelledby]="titleId" class="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
        <h2 [id]="titleId" class="text-lg font-semibold text-slate-900">{{ title() }}</h2>
        <p class="mt-2 text-sm text-slate-600">{{ message() }}</p>
        <div class="mt-4 flex justify-end gap-2">
          <button
            type="button"
            (click)="cancelled.emit()"
            [disabled]="busy()"
            class="rounded border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            {{ cancelLabel() }}
          </button>
          <button type="button" (click)="confirmed.emit()" [disabled]="busy()" [class]="confirmClasses()">
            {{ busy() ? busyLabel() : confirmLabel() }}
          </button>
        </div>
      </div>
    </div>
  `
})
export class ConfirmDialog {
  readonly title = input.required<string>();
  readonly message = input.required<string>();
  readonly confirmLabel = input('Delete');
  readonly cancelLabel = input('Cancel');
  readonly busyLabel = input('Deleting…');
  readonly busy = input(false);
  readonly tone = input<ConfirmDialogTone>('danger');

  readonly confirmed = output<void>();
  readonly cancelled = output<void>();

  protected readonly titleId = `confirm-dialog-title-${nextId++}`;

  private static readonly TONE_CLASSES: Record<ConfirmDialogTone, string> = {
    danger: 'bg-red-600 hover:bg-red-500',
    primary: 'bg-slate-900 hover:bg-slate-700'
  };

  protected readonly confirmClasses = computed(
    () => `rounded px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 ${ConfirmDialog.TONE_CLASSES[this.tone()]}`
  );

  // Escape cancels, but not while the action is in flight.
  protected onEscape(): void {
    if (!this.busy()) {
      this.cancelled.emit();
    }
  }
}
```

A host binds its inputs with property syntax — `[title]="'Delete entity'"`, not a static `title="…"` — so the signal
input is wired as an input rather than a plain attribute. No component sets `changeDetection`: `OnPush` is Angular 22's
default.

### Pages

Three pages: list, detail, and form (reused for create and edit). Each reads only its own slice, never the router.

**The page watch.** Each page loads from its own lifecycle: `ngOnInit` starts a watch on the slice's route state and
dispatches the page's load action for each new value, until the component is destroyed; `ngOnDestroy` dispatches
`Leave`. The list page's watch:

```ts
private readonly store = inject(Store);
private readonly destroyRef = inject(DestroyRef);

ngOnInit(): void {
  // From init to destroy, each new list input (the first one included) fetches the list.
  this.store
    .select(selectListInput)
    .pipe(
      filter((input) => input !== null),
      distinctUntilChanged(sameListInput),
      takeUntilDestroyed(this.destroyRef)
    )
    .subscribe((input) => this.store.dispatch(EntityListPageActions.fetch({ input })));
}

ngOnDestroy(): void {
  this.store.dispatch(EntityListPageActions.leave());
}
```

- **`ngOnInit`, never the constructor.** Angular constructs the new page before `routerNavigatedAction`, and runs
  `ngOnInit` after it, so by `ngOnInit` the reducer has copied the URL into the slice.
- **`null` is skipped:** it means the router has not written the slice yet.
- **`distinctUntilChanged` is the only dedupe.** A navigation that lands on the same input writes an equal object and
  fetches nothing.
- The detail page watches `selectId` (`distinctUntilChanged()`) and dispatches `EntityDetailPageActions.load({ id })`;
  the form page watches `selectTarget` (`distinctUntilChanged((a, b) => a.id === b.id)`) and dispatches
  `EntityFormPageActions.load({ id: target.id })`.

### `pages/entity-list-page.component.ts`

- Runs the watch above and dispatches `leave()` on destroy.
- Reads its slice: `selectListInput`, `selectStatus`, `selectItems`, `selectTotal`, `selectError`. The template reads
  the input through `listInput = computed(() => this.input() ?? DEFAULT_LIST_INPUT)`, so it never handles `null`.
- The control strip (filter / sort / page size) and pagination dispatch no load action: they build the next input
  from the slice's input and dispatch `AppRouterActions.navigate({ commands: [], queryParams: toParams(next) })`. The
  router changes the URL, the reducer copies the new input, and the watch fetches it. A user's change adds a history
  entry, so back undoes it.
- The filter strip has fixed inputs: _name contains_, _description contains_, _created on or after_, _created
  before_. Its pure functions live in `helpers/entity-filter-form.helper.ts` (`FilterForm`, `EMPTY_FILTER_FORM`,
  `formatRange`, `toFilterInput`, `toFilterForm`), kept out of the component so `ng test` covers them directly
  (`entity-filter-form.helper.spec.ts`). The strip's edits live in
  `draft = linkedSignal<FilterForm>(() => toFilterForm(listInput().filter))`, so it resyncs from the slice on every
  change of the list input — back / forward, a deep link, _Clear_ — and holds local edits in between; `applyFilters()` maps it
  with `toFilterInput` to an `EntityFilterInput` (`name.contains`, `description.contains`, `createdAt.ge` /
  `createdAt.lt`) and navigates with `page: 1`; _Clear_ resets the draft and navigates without a filter on page 1,
  keeping the sort and page size. Dates are days in the viewer's time zone: the helper's private
  `toIsoDate` sends local midnight as ISO-8601, and `toLocalDate` turns it back into the day when reading the URL.
  `toFilterForm` reads back only what the strip can express; other operators in a deep link are kept in the URL but
  not shown.
- Sort is a select of `field:direction` pairs, exactly these, in this order: _Newest first_ (`createdAt:DESC`, the
  default), _Oldest first_ (`createdAt:ASC`), _Name A–Z_ (`name:ASC`), _Name Z–A_ (`name:DESC`), _Recently updated_
  (`updatedAt:DESC`). Picking an option always writes its field and direction to the URL. Page size is a select of
  10 / 20 / 50 / 100. Changing either resets to page 1.
- Each select has its own `<label for>` and an `id` (`entity-list-sort` / `Sort`, `entity-list-page-size` /
  `Per page`), not a wrapping `<label>`: a wrapping label folds the option text into the accessible name, and the
  specs' `getByLabelText('Sort')` stops matching. Each `<option>` shows the URL's value with
  `[selected]="option.value === sortValue()"` (and `size === listInput().pageSize`), the slice's value; a `[value]` on the `<select>` is
  applied before the `@for` renders the options, so it does not take.
- Pagination: _Previous_ / _Next_ navigate with `page ± 1`; the label shows `first–last of total · page X of Y` via the
  helper's `formatRange`, with `totalPages` computed from `total` and `pageSize`. Stepping back from a page past the
  end is the slice's `stepBackPastLastPage$` effect, not the page's.
- Delete: an `<app-confirm-dialog>` (the `ConfirmDialog` component above), shown while a `pendingDelete` signal holds
  the row, dispatches `EntityListPageActions.delete` on `(confirmed)` and clears the signal on `(cancelled)`; it is
  `[busy]` while `status() === 'deleting'`. `pendingDelete` is a `linkedSignal` over the items
  (`linkedSignal<Entity[], Entity | null>({ source: items, computation: () => null })`), so the dialog stays open, busy,
  until the refetch after the delete delivers a new page of items, and closes then. On a failed delete the items do
  not change, so the dialog stays open, no longer busy, over the error banner. The row button and the dialog's
  confirm are both named _Delete_, so specs scope to `page.getByRole('dialog')` or the row.
- Rows show the name (a link to the detail page), the description and `createdAt | date: 'medium'`.
- `status() === 'error'` shows `error()` in a banner. The empty row switches on the status: _Loading…_ while
  `'loading'`, otherwise _No entities match the filter._ when a filter is active, or _No entities yet._
- Every input and select has a `name`; the free-text inputs also set `autocomplete="off"`, since they are not
  personal data.
- The accessible names the specs drive: heading _Entities_; link _New entity_; labels _Name contains_, _Description
  contains_, _Created on or after_, _Created before_, _Sort_, _Per page_; buttons _Apply_, _Clear_, _Previous_, _Next_,
  and _Delete_ on each row (the row's name is a link to its detail page).

### `pages/entity-detail-page.component.ts`

- Watches `selectId` from `ngOnInit` and dispatches `EntityDetailPageActions.load({ id })` for each new id, and
  `leave()` on destroy. A link to another entity reuses the component; the watch loads the new id.
- Shows the description (`—` when it is `null`) and `createdAt` / `updatedAt` with `date: 'medium'`.
- The error banner is an `@if (status() === 'error')`; under it, `@switch (status())` renders _Loading…_ or (on
  `'loaded'`) the entity with a link to the edit page.
- Accessible names: the entity's name as the heading, link _Edit_, link _← Back to entities_.

### `pages/entity-form-page.component.ts`

- Shared for `new` and `edit`: watches `selectTarget` from `ngOnInit` and dispatches
  `EntityFormPageActions.load({ id: target.id })` for each new target (`id` is `null` on `new`), and `leave()` on
  destroy.
- The form is `new FormGroup({ name: new FormControl(…), description: new FormControl(…) })`, with no injected
  `FormBuilder`; an `effect(() => …)` fills it when `selectEntity` delivers the edited entity.
- After a save, the slice's `navigateAfterSave$` effect dispatches `AppRouterActions.navigate` to the detail page; the
  page itself never navigates.
- `status() === 'error'` shows `error()` in a banner. The Save button is disabled while `'loading'` or `'saving'`
  and its label switches on the status (_Loading…_, _Saving…_, _Save_).
- Validation mirrors the API's create schema: `name` is `Validators.required` + `Validators.maxLength(200)`,
  `description` `Validators.maxLength(2000)`. Save sends both values trimmed and an empty description as `null`; a
  name that is blank after trimming does not save. In `'error'` the form stays editable, so the user can retry.
- Uses `Validators.required` + `Validators.maxLength` with an inline
  `// eslint-disable-next-line @typescript-eslint/unbound-method` on the first validator (Angular's static validator
  reference is a known false positive of the unbound-method rule).
- The `name` input and `description` textarea carry `name` and `autocomplete="off"` attributes.
- Accessible names: heading _New entity_ or _Edit entity_; labels _Name_, _Description_; button _Save_; link
  _← Cancel_ back to the list.

## 11. Tests

The web app has three test layers, specified in [references/web-testing.md](web-testing.md): **unit** (`ng test` on
Analog's Vitest builder, jsdom, `*.spec.ts` beside the file — services, every slice, helpers), **browser-mode tests**
(`ng test -c browser`, Vitest browser mode + Playwright, `*.component.browser.spec.ts` for components and pages), and
**full-stack e2e** (Playwright Test against its own stack, `e2e/`). `ng test` is the required `test` check.

The URL (de)serializer the list page depends on is the clearest standalone example of the unit layer:

### `helpers/entity-list-params.helper.spec.ts`

```ts
import { describe, expect, it } from 'vitest';
import { type ListEntityInput } from '../models/entity.model';
import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE, parseListInput, sameListInput, toParams } from './entity-list-params.helper';

describe('entity-list-params.helper', () => {
  it('falls back to the defaults for an empty URL', () => {
    // Act
    const input = parseListInput({});

    // Assert
    expect(input).toEqual({ filter: undefined, sort: undefined, page: DEFAULT_PAGE, pageSize: DEFAULT_PAGE_SIZE });
  });

  it('serializes default values to null so the router drops them', () => {
    // Act
    const params = toParams({ filter: {}, page: DEFAULT_PAGE, pageSize: DEFAULT_PAGE_SIZE });

    // Assert
    expect(Object.values(params).every((value) => value === null)).toBe(true);
  });

  it('round-trips a list input through the URL', () => {
    // Arrange
    const input: ListEntityInput = {
      filter: { or: [{ name: { contains: 'a' } }, { createdAt: { ge: '2026-01-01T00:00:00.000Z' } }] },
      sort: { field: 'createdAt', direction: 'DESC' },
      page: 3,
      pageSize: 50
    };

    // Act
    const params = toParams(input);
    const parsed = parseListInput(Object.fromEntries(Object.entries(params).map(([key, value]) => [key, value ?? undefined])));

    // Assert
    expect(parsed).toEqual(input);
  });

  it('ignores a malformed filter, unknown sort field and invalid page instead of throwing', () => {
    // Act
    const input = parseListInput({ filter: '{', sortField: 'nope', page: '0' });

    // Assert
    expect(input.filter).toBeUndefined();
    expect(input.sort).toBeUndefined();
    expect(input.page).toBe(DEFAULT_PAGE);
  });

  it('treats two inputs that make the same request as the same', () => {
    // Arrange
    const input: ListEntityInput = { filter: { name: { contains: 'a' } }, page: 2, pageSize: DEFAULT_PAGE_SIZE };

    // Act + Assert
    expect(sameListInput(input, { ...input, filter: { name: { contains: 'a' } } })).toBe(true);
    expect(sameListInput(input, { ...input, page: 3 })).toBe(false);
  });
});
```

## 12. Nginx production serving

### `web/Dockerfile`

Built with the **repo root** as context, like the API, so the `catalog:` entries and `allowBuilds` resolve from the
root `pnpm-workspace.yaml`.

```dockerfile
# Build stage: produce the production Angular bundle
FROM node:24-alpine AS build
RUN corepack enable
WORKDIR /repo
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY web/package.json web/
RUN pnpm install --filter web --frozen-lockfile
COPY web/ web/
RUN pnpm --filter web build

# Runtime stage: Nginx serves the static bundle
FROM nginx:1.27-alpine AS runtime
COPY web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/web/dist/web/browser /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### `web/nginx.conf`

```nginx
server {
  listen 80;
  server_name _;

  root /usr/share/nginx/html;
  index index.html;

  # Serve the Angular app, falling back to index.html for client-side routes.
  # The API base URL is baked into the bundle at build time via Angular
  # environment files (src/environments), not proxied here.
  location / {
    try_files $uri $uri/ /index.html;
  }
}
```

**No `/api` reverse proxy.** The browser calls the API host directly; CORS stays enabled on the API.
