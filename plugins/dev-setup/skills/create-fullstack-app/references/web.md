# Web scaffold

Angular 22 + NgRx 22 + `@ngrx/router-store` + Tailwind v4. This file covers the default stack; the Fundamental NGX
reference layers FD-NGX on top.

The scaffold ships a complete **entity CRUDL** example wired end to end: a list page with filter / sort / pagination
controls, a detail page, a shared form page for create and edit, and a confirm dialog for delete. The list input lives
entirely in the URL (via router-store), and each page has its own slice, registered on its route.

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
rm web/.editorconfig web/src/app/app.ts web/src/app/app.html web/src/app/app.scss web/src/app/app.spec.ts
pnpm --filter web pkg delete packageManager devDependencies.prettier devDependencies.typescript
```

- `.editorconfig` goes because Prettier handles indentation and the two can disagree.
- The CLI's root component (`app.ts` + `app.html` + `app.scss`) and its spec are replaced by `app.component.ts` in
  section 7 and the spec in section 11.
- `packageManager` belongs to the root manifest. `prettier` and `typescript` are removed so the root shared-tooling
  step adds them back as `catalog:`; `pnpm add --save-catalog` leaves an existing direct `prettier` range in place.

## 3. Scripts and dependencies

Set the scripts:

```sh
pnpm --filter web pkg set scripts.lint="eslint ." scripts.test="ng test --watch=false" \
  scripts.format="prettier --write \"**/*.{ts,js,mjs,html,css,json,md,yml,yaml}\"" \
  "scripts['format:check']=prettier --check \"**/*.{ts,js,mjs,html,css,json,md,yml,yaml}\""
```

Keep the CLI's `ng`, `start`, `build` and `watch` scripts as generated. `--watch=false` makes `test` a one-shot check,
like the API's `vitest run`.

The `pages/*.component.ts` files are written from the patterns in section 10; the routes import all three, so the
build fails until they exist.

Add NgRx, Tailwind and angular-eslint, pinned to the Angular major (NgRx and angular-eslint track it):

```sh
pnpm --filter web add @ngrx/store@22 @ngrx/effects@22 @ngrx/router-store@22
pnpm --filter web add -D @ngrx/store-devtools@22 angular-eslint@22 tailwindcss @tailwindcss/postcss postcss
```

The CLI's own Angular, `vitest` and `jsdom` entries stay as generated. ESLint, Prettier and TypeScript are added by the
root shared-tooling step in `monorepo-root.md`.

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

Only the `app-context` store slice imports `environment`. Everything else reads `apiBaseUrl` and `appName` from the
store.

## 6. Folder structure

```
web/src/app/
├── app.component.ts         # root
├── app.config.ts            # global slices (appContext, appRouter), provideRouterStore, app-router effects
├── app.routes.ts            # routes; each page route registers its page slice
├── components/
│   └── <name>.component.ts   # presentational, store-free, inputs/outputs only
├── layouts/
│   └── main-layout.component.ts
├── pages/
│   ├── entity-list-page.component.ts
│   ├── entity-detail-page.component.ts
│   └── entity-form-page.component.ts  # reused for /entities/new + /entities/:id/edit
├── models/
│   └── entity.model.ts       # resource types, mirroring the API's names and shapes
├── services/
│   └── entity.service.ts     # EntityService: the only HttpClient user; called from effects
├── helpers/
│   ├── entity-list-params.helper.ts       # URL ↔ ListEntityInput (de)serializer, shared by the URL and the API call
│   ├── entity-list-params.helper.spec.ts
│   └── http-error.helper.ts  # httpErrorMessage, shared by the page effects
└── store/
    ├── app-context/          # global slice: apiBaseUrl + appName
    ├── app-router/           # global slice: appRouter state, route selectors, Navigate action + effect
    ├── entity-list-page/     # page slice, registered on the list route
    │   ├── entity-list-page.model.ts
    │   ├── entity-list-page.actions.ts
    │   ├── entity-list-page.reducer.ts
    │   ├── entity-list-page.selectors.ts
    │   └── entity-list-page.effects.ts
    ├── entity-detail-page/   # page slice, registered on the detail route
    └── entity-form-page/     # page slice, registered on the new + edit routes
```

**One slice per page.** Each page owns a slice at `store/<page-name>/`, named after the page component, and registers
it on its own route with `provideState` + `provideEffects`. Only `appContext` and the router state
(`appRouter`) are global, in `app.config.ts`. Pages never read another page's slice: what two pages both need (the entity) each loads for itself,
and the list fetches fresh data whenever it is shown. Resource types that several slices use live in `models/`,
not in a slice.

**Data access goes through a service.** `services/entity.service.ts` (`EntityService`, `providedIn: 'root'`) is the
only code that uses `HttpClient`: `list`, `get`, `create`, `update` and `delete`, each returning an `Observable`. It
reads `apiBaseUrl` from the app-context slice. Effects inject the service and map its results to success and failure
actions; pages never call it.

**Actions are named for intent, not lifecycle.** The page asks for its data with `Load` (dispatched from `ngOnInit`,
but named for what it does, not for the moment), the list's request for one input is `Fetch`, and results are
`<Action> Success` / `<Action> Failure`.

**Every page loads the same way.** The page dispatches `Load` in `ngOnInit` and `Leave` in `ngOnDestroy`. `Load`
sets the slice's `status` to `'loading'` and an effect calls the service; success sets `'loaded'` (or `'ready'` for
the form) with the data, failure sets `'error'` with a message. Each slice has one `status` field, a union of the
page's states, instead of boolean flags such as `loading` / `saving` / `deleting`, and the template switches on it
with `@switch (status())`.

**Pages inject only the `Store`.** Route params come from the app-router selectors, navigation is
`AppRouterActions.navigate`, and forms are built with `new FormGroup` / `new FormControl` instead of an injected
`FormBuilder`. Only effects inject services (`HttpClient`, `Router`).

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
import { provideRouterStore, routerReducer } from '@ngrx/router-store';
import { routes } from './app.routes';
import { APP_CONTEXT_FEATURE_KEY } from './store/app-context/app-context.selectors';
import { appContextReducer } from './store/app-context/app-context.reducer';
import * as appRouterEffects from './store/app-router/app-router.effects';
import { ROUTER_FEATURE_KEY } from './store/app-router/app-router.selectors';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(),
    // Global stores:
    //   - application context (api base URL, app name)
    //   - router (@ngrx/router-store makes the URL part of the store state;
    //     list inputs are derived from it, so the URL is the source of truth)
    // Page slices are registered on their routes (see app.routes.ts). Navigation is an
    // action: the app-router effects are the only code that calls the Angular Router.
    provideStore({
      [APP_CONTEXT_FEATURE_KEY]: appContextReducer,
      [ROUTER_FEATURE_KEY]: routerReducer
    }),
    provideRouterStore({ stateKey: ROUTER_FEATURE_KEY }),
    provideEffects(appRouterEffects),
    provideStoreDevtools({ maxAge: 25, logOnly: !isDevMode() })
  ]
};
```

### `web/src/app/app.routes.ts`

Each page route registers its slice. The form page serves `new` and `:id/edit`, so the two routes sit under one componentless parent that registers the form slice once; registering it on both routes would run its effects twice. Route-level effects stay registered after the page is left, which is why the list effect filters navigation by path.

```ts
import type { Routes } from '@angular/router';
import { provideEffects } from '@ngrx/effects';
import { provideState } from '@ngrx/store';
import { EntityDetailPage } from './pages/entity-detail-page.component';
import { EntityFormPage } from './pages/entity-form-page.component';
import { EntityListPage } from './pages/entity-list-page.component';
import * as entityDetailPageEffects from './store/entity-detail-page/entity-detail-page.effects';
import { entityDetailPageReducer } from './store/entity-detail-page/entity-detail-page.reducer';
import { ENTITY_DETAIL_PAGE_FEATURE_KEY } from './store/entity-detail-page/entity-detail-page.selectors';
import * as entityFormPageEffects from './store/entity-form-page/entity-form-page.effects';
import { entityFormPageReducer } from './store/entity-form-page/entity-form-page.reducer';
import { ENTITY_FORM_PAGE_FEATURE_KEY } from './store/entity-form-page/entity-form-page.selectors';
import * as entityListPageEffects from './store/entity-list-page/entity-list-page.effects';
import { entityListPageReducer } from './store/entity-list-page/entity-list-page.reducer';
import { ENTITY_LIST_PAGE_FEATURE_KEY } from './store/entity-list-page/entity-list-page.selectors';

// Each page registers its own slice on its route. The form page serves two
// routes, so they share one provider group and its effects run once.
export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'entities' },
  {
    path: 'entities',
    children: [
      {
        path: '',
        pathMatch: 'full',
        component: EntityListPage,
        providers: [provideState(ENTITY_LIST_PAGE_FEATURE_KEY, entityListPageReducer), provideEffects(entityListPageEffects)]
      },
      {
        path: '',
        providers: [provideState(ENTITY_FORM_PAGE_FEATURE_KEY, entityFormPageReducer), provideEffects(entityFormPageEffects)],
        children: [
          { path: 'new', component: EntityFormPage },
          { path: ':id/edit', component: EntityFormPage }
        ]
      },
      {
        path: ':id',
        component: EntityDetailPage,
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

`@ngrx/router-store` puts the URL in the store under the `appRouter` key. Pages read everything about the route from
here: the list input from `selectQueryParams`, the `id` of the detail and form pages from `selectRouteParam('id')`.
The key is not router-store's default (`router`), so it is passed to
`provideRouterStore({ stateKey: ROUTER_FEATURE_KEY })` in `app.config.ts`, and the selectors are built from
`selectRouterState` rather than the default feature.

Navigation is an action too: pages and page effects dispatch `AppRouterActions.navigate`, and the app-router
`navigate$` effect is the only code that calls the Angular `Router`. It is registered globally in `app.config.ts`.

#### `store/app-router/app-router.selectors.ts`

```ts
import { createFeatureSelector } from '@ngrx/store';
import { getRouterSelectors, type RouterReducerState } from '@ngrx/router-store';

export const ROUTER_FEATURE_KEY = 'appRouter';

export const selectRouterState = createFeatureSelector<RouterReducerState>(ROUTER_FEATURE_KEY);

export const { selectQueryParams, selectRouteParam, selectUrl } = getRouterSelectors(selectRouterState);
```

#### `store/app-router/app-router.actions.ts`

```ts
import { createActionGroup, props } from '@ngrx/store';

export const AppRouterActions = createActionGroup({
  source: 'App Router',
  events: {
    /** `commands: []` keeps the current path and replaces only the query params; `null` removes a param. */
    Navigate: props<{ commands: string[]; queryParams?: Record<string, string | null> }>()
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
      tap(({ commands, queryParams }) => void router.navigate(commands, { queryParams }))
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

All HTTP for the resource, called only from effects. Each method writes its full URL explicitly and builds its params inline, so it reads as the request it sends; there is no private `url()` or params helper. `list` sends the list input as the same query params the page URL uses.

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

Converts between router `Params` and `ListEntityInput`. The page URL and the API request share this one format (`?filter=<json>&sortField=…&sortDirection=…&page=…&pageSize=…`), so it lives in `helpers/` for both the list slice and the service. Default values serialize to `null` so the router strips them, and malformed params fall back to defaults instead of throwing.

```ts
import { type EntityFilterInput, type ListEntityInput, type SortDirection, type EntitySortField } from '../models/entity.model';

export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 20;

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
page's states, plus an `error` message set only when `status` is `'error'`. Pages dispatch `Load` on init and
`Leave` on destroy, and the reducers reset to the initial state on both, so a revisit never shows stale data.

### `store/entity-list-page/`

The list input lives in the URL; the slice holds the server data for the current page and the page's `status`
(`'idle' | 'loading' | 'loaded' | 'deleting' | 'error'`).

#### `store/entity-list-page/entity-list-page.model.ts`

```ts
import { type Entity } from '../../models/entity.model';

export type EntityListPageStatus = 'idle' | 'loading' | 'loaded' | 'deleting' | 'error';

export interface EntityListPageState {
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
    /** The page asks for its data; the list then follows the list input in the URL. */
    Load: emptyProps(),
    Leave: emptyProps(),

    /** One request for one list input: the first one after `Load`, every URL change, and after a delete. */
    Fetch: props<{ input: ListEntityInput }>(),
    'Load Success': props<{ items: Entity[]; total: number }>(),
    'Load Failure': props<{ error: string }>(),

    Delete: props<{ id: string }>(),
    'Delete Success': props<{ id: string }>(),
    'Delete Failure': props<{ error: string }>()
  }
});
```

#### `store/entity-list-page/entity-list-page.reducer.ts`

```ts
import { createReducer, on } from '@ngrx/store';
import { EntityListPageActions } from './entity-list-page.actions';
import { type EntityListPageState } from './entity-list-page.model';

export const initialEntityListPageState: EntityListPageState = {
  status: 'idle',
  items: [],
  total: 0,
  error: null
};

export const entityListPageReducer = createReducer(
  initialEntityListPageState,
  on(EntityListPageActions.load, EntityListPageActions.leave, () => initialEntityListPageState),

  on(EntityListPageActions.fetch, (state) => ({ ...state, status: 'loading' as const, error: null })),
  on(EntityListPageActions.loadSuccess, (state, { items, total }) => ({ ...state, status: 'loaded' as const, items, total })),
  on(EntityListPageActions.loadFailure, (state, { error }) => ({ ...state, status: 'error' as const, error })),

  on(EntityListPageActions.delete, (state) => ({ ...state, status: 'deleting' as const, error: null })),
  on(EntityListPageActions.deleteFailure, (state, { error }) => ({ ...state, status: 'error' as const, error }))
);
```

#### `store/entity-list-page/entity-list-page.selectors.ts`

```ts
import { createFeatureSelector, createSelector } from '@ngrx/store';
import { parseListInput } from '../../helpers/entity-list-params.helper';
import { selectQueryParams, selectUrl } from '../app-router/app-router.selectors';
import { type EntityListPageState } from './entity-list-page.model';

export const ENTITY_LIST_PAGE_FEATURE_KEY = 'entityListPage';

export const selectEntityListPageState = createFeatureSelector<EntityListPageState>(ENTITY_LIST_PAGE_FEATURE_KEY);

export const selectStatus = createSelector(selectEntityListPageState, (s) => s.status);
export const selectItems = createSelector(selectEntityListPageState, (s) => s.items);
export const selectTotal = createSelector(selectEntityListPageState, (s) => s.total);
export const selectError = createSelector(selectEntityListPageState, (s) => s.error);

// The URL is the source of truth for the list input.
export const selectListInput = createSelector(selectQueryParams, (params) => parseListInput(params ?? {}));

/** The list input while the URL is the list page's, otherwise `null` (e.g. mid-navigation to another page). */
export const selectListInputOnListPage = createSelector(selectUrl, selectListInput, (url, input) => (isListUrl(url) ? input : null));

function isListUrl(url: string | undefined): boolean {
  const [path] = (url ?? '').split('?');
  return path === '/entities' || path === '/entities/';
}
```

#### `store/entity-list-page/entity-list-page.effects.ts`

`fetchOnListInputChange$` runs from `Load` until `Leave`: it follows the list input in the URL and dispatches `Fetch({ input })` for the first value and for every change, so the page never fetches itself. `selectListInputOnListPage` is `null` while the URL belongs to another page, which keeps a navigation away from triggering a stray fetch before `Leave` arrives. `fetchAfterDelete$` fetches again after a delete, because the totals change and later rows shift onto the current page. Route-level effects stay registered after the page is left, which is why the stream ends on `Leave`.

```ts
import { inject } from '@angular/core';
import { type HttpErrorResponse } from '@angular/common/http';
import { Store } from '@ngrx/store';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, concatMap, distinctUntilChanged, filter, map, of, switchMap, takeUntil, withLatestFrom } from 'rxjs';
import { httpErrorMessage } from '../../helpers/http-error.helper';
import { type ListEntityInput } from '../../models/entity.model';
import { EntityService } from '../../services/entity.service';
import { EntityListPageActions } from './entity-list-page.actions';
import { selectListInput, selectListInputOnListPage } from './entity-list-page.selectors';

// From Load until Leave, every change of the list input in the URL (the first one included) fetches the list.
export const fetchOnListInputChange$ = createEffect(
  (actions$ = inject(Actions), store = inject(Store)) =>
    actions$.pipe(
      ofType(EntityListPageActions.load),
      switchMap(() =>
        store.select(selectListInputOnListPage).pipe(
          filter((input): input is ListEntityInput => input !== null),
          distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)),
          map((input) => EntityListPageActions.fetch({ input })),
          takeUntil(actions$.pipe(ofType(EntityListPageActions.leave)))
        )
      )
    ),
  { functional: true }
);

// A delete changes the totals and shifts later rows onto the current page, so the list is fetched again.
export const fetchAfterDelete$ = createEffect(
  (actions$ = inject(Actions), store = inject(Store)) =>
    actions$.pipe(
      ofType(EntityListPageActions.deleteSuccess),
      withLatestFrom(store.select(selectListInput)),
      map(([, input]) => EntityListPageActions.fetch({ input }))
    ),
  { functional: true }
);

export const fetch$ = createEffect(
  (actions$ = inject(Actions), entityService = inject(EntityService)) =>
    actions$.pipe(
      ofType(EntityListPageActions.fetch),
      switchMap(({ input }) =>
        entityService.list(input).pipe(
          map((res) => EntityListPageActions.loadSuccess({ items: res.items, total: res.total })),
          catchError((err: HttpErrorResponse) => of(EntityListPageActions.loadFailure({ error: httpErrorMessage(err) })))
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

Loads the entity on `Load`; clears it on `Leave`. Status: `'idle' | 'loading' | 'loaded' | 'error'`.

#### `store/entity-detail-page/entity-detail-page.model.ts`

```ts
import { type Entity } from '../../models/entity.model';

export type EntityDetailPageStatus = 'idle' | 'loading' | 'loaded' | 'error';

export interface EntityDetailPageState {
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
import { EntityDetailPageActions } from './entity-detail-page.actions';
import { type EntityDetailPageState } from './entity-detail-page.model';

export const initialEntityDetailPageState: EntityDetailPageState = {
  status: 'idle',
  entity: null,
  error: null
};

export const entityDetailPageReducer = createReducer(
  initialEntityDetailPageState,
  on(EntityDetailPageActions.load, () => ({ ...initialEntityDetailPageState, status: 'loading' as const })),
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

Serves both create and edit: `Load` carries the id, or `null` on `/entities/new`, and only an id triggers a load. Status: `'idle' | 'loading' | 'ready' | 'saving' | 'error'`, where `ready` is a new form or an edit form whose entity has loaded. After a successful save, `navigateAfterSave$` dispatches `AppRouterActions.navigate` to the detail page. Writes use `concatMap`, so a second save never cancels the first.

#### `store/entity-form-page/entity-form-page.model.ts`

```ts
import { type Entity } from '../../models/entity.model';

/** `ready`: a new form, or an edit form whose entity has loaded. */
export type EntityFormPageStatus = 'idle' | 'loading' | 'ready' | 'saving' | 'error';

export interface EntityFormPageState {
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
import { EntityFormPageActions } from './entity-form-page.actions';
import { type EntityFormPageState } from './entity-form-page.model';

export const initialEntityFormPageState: EntityFormPageState = {
  status: 'idle',
  entity: null,
  error: null
};

export const entityFormPageReducer = createReducer(
  initialEntityFormPageState,
  on(EntityFormPageActions.load, (_state, { id }) => ({
    ...initialEntityFormPageState,
    status: id === null ? ('ready' as const) : ('loading' as const)
  })),
  on(EntityFormPageActions.loadSuccess, (state, { entity }) => ({ ...state, status: 'ready' as const, entity })),
  on(EntityFormPageActions.loadFailure, (state, { error }) => ({ ...state, status: 'error' as const, error })),

  on(EntityFormPageActions.create, EntityFormPageActions.update, (state) => ({ ...state, status: 'saving' as const, error: null })),
  on(EntityFormPageActions.saveSuccess, (state, { entity }) => ({ ...state, status: 'ready' as const, entity })),
  on(EntityFormPageActions.saveFailure, (state, { error }) => ({ ...state, status: 'error' as const, error })),

  on(EntityFormPageActions.leave, () => initialEntityFormPageState)
);
```

#### `store/entity-form-page/entity-form-page.selectors.ts`

```ts
import { createFeatureSelector, createSelector } from '@ngrx/store';
import { type EntityFormPageState } from './entity-form-page.model';

export const ENTITY_FORM_PAGE_FEATURE_KEY = 'entityFormPage';

export const selectEntityFormPageState = createFeatureSelector<EntityFormPageState>(ENTITY_FORM_PAGE_FEATURE_KEY);

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

Three pages: list, detail, and form (reused for create and edit). Each reads only its own slice.

### `pages/entity-list-page.component.ts`

- Dispatches `EntityListPageActions.load()` on init and `leave()` on destroy; the slice's effect fetches from there.
- Reads `selectListInput` (from the URL) and its slice: `selectStatus`, `selectItems`, `selectTotal`, `selectError`.
- The control strip (filter / sort / page size) dispatches no load action: it dispatches
  `AppRouterActions.navigate({ commands: [], queryParams: toParams(next) })`, and the slice's navigation effect
  fetches when the URL changes.
- The filter strip has fixed inputs: *name contains*, *description contains*, *created on or after*, *created
  before*. A local `draft: FilterForm` signal holds the edits; `applyFilters()` maps it with `toFilterInput` to an
  `EntityFilterInput` (`name.contains`, `description.contains`, `createdAt.ge` / `createdAt.lt`) and navigates with
  `page: 1`. Dates are days in the viewer's time zone: `toIsoDate` sends local midnight as ISO-8601, and
  `toLocalDate` turns it back into the day when reading the URL. `toFilterForm` reads back only what the strip can
  express; other operators in a deep link are kept in the URL but not shown.
- Sort is a select of `field:direction` pairs (default *Newest first*, `createdAt:DESC`); page size is a select of 10 /
  20 / 50 / 100. Changing either resets to page 1.
- Pagination: *Previous* / *Next* navigate with `page ± 1`; the label shows `first–last of total · page X of Y`, with
  `totalPages` computed from `total` and `pageSize`. An `effect()` steps back to the last page when a delete empties
  the current one.
- Delete: an inline confirm modal controlled by a signal dispatches `EntityListPageActions.delete`; the dialog is busy
  while `status() === 'deleting'`.
- `status() === 'error'` shows `error()` in a banner. The empty row switches on the status: *Loading…* while
  `'loading'`, otherwise *No entities match the filter.* when a filter is active, or *No entities yet.*
- Every input and select has a `name`; the free-text inputs also set `autocomplete="off"`, since they are not
  personal data.

### `pages/entity-detail-page.component.ts`

- Reads the `id` with `selectRouteParam('id')`, dispatches `EntityDetailPageActions.load({ id })` on init and
  `leave()` on destroy.
- Renders with `@switch (status())`: *Loading…*, the error banner, or (on `'loaded'`) the entity with a link to the
  edit page.

### `pages/entity-form-page.component.ts`

- Shared for `new` and `edit`: reads the `id` with `selectRouteParam('id')` (absent on `new`) and dispatches
  `EntityFormPageActions.load({ id })` on init and `leave()` on destroy.
- The form is `new FormGroup({ name: new FormControl(…), description: new FormControl(…) })`, with no injected
  `FormBuilder`; an `effect(() => …)` fills it when `selectEntity` delivers the edited entity.
- After a save, the slice's `navigateAfterSave$` effect dispatches `AppRouterActions.navigate` to the detail page; the
  page itself never navigates.
- `status() === 'error'` shows `error()` in a banner. The Save button is disabled while `'loading'` or `'saving'`
  and its label switches on the status (*Loading…*, *Saving…*, *Save*).
- Uses `Validators.required` + `Validators.maxLength` with an inline
  `// eslint-disable-next-line @typescript-eslint/unbound-method` on the first validator (Angular's static validator
  reference is a known false positive of the unbound-method rule).
- The `name` input and `description` textarea carry `name` and `autocomplete="off"` attributes.

## 11. Tests

Angular's convention puts specs next to the file they test, as `*.spec.ts`; `ng test` runs them with Vitest. The
scaffold ships one spec for the URL (de)serializer, the piece the list page depends on.

### `helpers/entity-list-params.helper.spec.ts`

```ts
import { describe, expect, it } from 'vitest';
import { type ListEntityInput } from '../models/entity.model';
import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE, parseListInput, toParams } from './entity-list-params.helper';

describe('entity list params', () => {
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
