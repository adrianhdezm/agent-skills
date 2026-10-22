# Web scaffold

Angular 22 + NgRx 22 + `@ngrx/router-store` + Tailwind v4. This file covers the default stack; the Fundamental NGX
reference layers FD-NGX on top.

The scaffold ships a complete **entity CRUDL** example wired end to end: a list page with filter / sort / pagination
controls, a detail page, a shared form page for create and edit, and a confirm dialog for delete. The list query lives
entirely in the URL (via router-store) and the entities slice holds only server-returned data.

## Contents

1. [Scaffold with Angular CLI](#1-scaffold-with-angular-cli)
2. [Clean up CLI defaults](#2-clean-up-cli-defaults)
3. [Scripts and dependencies](#3-scripts-and-dependencies)
4. [Tailwind v4](#4-tailwind-v4)
5. [Environment files](#5-environment-files)
6. [Folder structure](#6-folder-structure)
7. [Core files](#7-core-files)
8. [App-context slice](#8-app-context-slice)
9. [Entities slice](#9-entities-slice)
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
├── app.config.ts            # provideStore + provideRouterStore + global effects
├── app.routes.ts            # entity routes (list / detail / form)
├── components/
│   └── <name>.component.ts   # presentational, store-free, inputs/outputs only
├── layouts/
│   └── main-layout.component.ts
├── pages/
│   ├── entity-list-page.component.ts
│   ├── entity-detail-page.component.ts
│   └── entity-form-page.component.ts  # reused for /entities/new + /entities/:id/edit
└── store/
    ├── app-context/           # global slice (apiBaseUrl + appName)
    │   ├── app-context.model.ts
    │   ├── app-context.reducer.ts
    │   └── app-context.selectors.ts
    └── entities/              # resource slice, registered globally
        ├── entities.model.ts
        ├── entities.query.ts  # URL ↔ ListQuery (de)serializer
        ├── entities.query.spec.ts
        ├── entities.actions.ts
        ├── entities.reducer.ts
        ├── entities.selectors.ts
        └── entities.effects.ts
```

The entities slice is **shared across pages** (list / detail / form all read and write it), so it is registered
globally in `app.config.ts`, not per route. Any slice that only one page uses lives at `store/<page-name>/` and is
registered on that route with `provideState` + `provideEffects`.

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
import { ENTITIES_FEATURE_KEY, ROUTER_FEATURE_KEY } from './store/entities/entities.selectors';
import { entitiesReducer } from './store/entities/entities.reducer';
import * as entitiesEffects from './store/entities/entities.effects';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(),
    // Global stores:
    //   - application context (api base URL, app name)
    //   - router (@ngrx/router-store makes the URL part of the store state;
    //     the entity list query is derived from it, so URL is the source of truth)
    //   - entities (server-returned list/current + saving/deleting flags)
    provideStore({
      [APP_CONTEXT_FEATURE_KEY]: appContextReducer,
      [ROUTER_FEATURE_KEY]: routerReducer,
      [ENTITIES_FEATURE_KEY]: entitiesReducer
    }),
    provideRouterStore(),
    provideEffects(entitiesEffects),
    provideStoreDevtools({ maxAge: 25, logOnly: !isDevMode() })
  ]
};
```

### `web/src/app/app.routes.ts`

```ts
import type { Routes } from '@angular/router';
import { EntityListPage } from './pages/entity-list-page.component';
import { EntityDetailPage } from './pages/entity-detail-page.component';
import { EntityFormPage } from './pages/entity-form-page.component';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'entities' },
  { path: 'entities', component: EntityListPage },
  { path: 'entities/new', component: EntityFormPage },
  { path: 'entities/:id', component: EntityDetailPage },
  { path: 'entities/:id/edit', component: EntityFormPage }
];
```

## 8. App-context slice

Static for the life of the app: its initial state comes from `environment` and no action changes it.

### `store/app-context/app-context.model.ts`

```ts
export interface AppContextState {
  apiBaseUrl: string;
  appName: string;
}
```

### `store/app-context/app-context.reducer.ts`

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

### `store/app-context/app-context.selectors.ts`

```ts
import { createFeatureSelector, createSelector } from '@ngrx/store';
import { type AppContextState } from './app-context.model';

export const APP_CONTEXT_FEATURE_KEY = 'appContext';

export const selectAppContext = createFeatureSelector<AppContextState>(APP_CONTEXT_FEATURE_KEY);
export const selectApiBaseUrl = createSelector(selectAppContext, (s) => s.apiBaseUrl);
export const selectAppName = createSelector(selectAppContext, (s) => s.appName);
```

## 9. Entities slice

Server data in the slice, the query in the URL.

### `store/entities/entities.model.ts`

Mirrors the API vocabulary exactly.

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

// --- List query (URL is the source of truth; this mirrors the API) --------

export type FilterField = 'name' | 'description' | 'createdAt' | 'updatedAt';
export type SortField = 'name' | 'createdAt' | 'updatedAt';
export type ComparisonOperator =
  | '_eq'
  | '_neq'
  | '_gt'
  | '_gte'
  | '_lt'
  | '_lte'
  | '_in'
  | '_is_null'
  | '_like'
  | '_ilike'
  | '_nlike'
  | '_nilike';

export type FieldPredicate = Partial<Record<ComparisonOperator, unknown>>;
export type Where = {
  _and?: Where[];
  _or?: Where[];
  _not?: Where;
} & Partial<Record<FilterField, FieldPredicate>>;

export interface SortSpec {
  field: SortField;
  dir: 'asc' | 'desc';
}

export interface ListQuery {
  where?: Where;
  orderBy?: SortSpec[];
  limit: number;
  offset: number;
}

// --- Entities slice (server data only — not the query) --------------------

export interface EntitiesState {
  items: Entity[];
  total: number;
  current: Entity | null;
  listLoading: boolean;
  listError: string | null;
  itemLoading: boolean;
  itemError: string | null;
  saving: boolean;
  saveError: string | null;
  lastSavedId: string | null;
  deleting: boolean;
  deleteError: string | null;
}
```

### `store/entities/entities.query.ts`

The URL is the single source of truth; this file is the (de)serializer between `Params` and `ListQuery`. Default
values serialize to `null` so the router strips them, keeping URLs clean.

```ts
import { type ListQuery, type SortSpec, type Where } from './entities.model';

export const DEFAULT_LIMIT = 20;
export const DEFAULT_OFFSET = 0;

export interface Params {
  readonly [key: string]: string | undefined;
}

export function parseQuery(params: Params): ListQuery {
  return {
    where: parseJson<Where>(params['where']),
    orderBy: parseJson<SortSpec[]>(params['orderBy']),
    limit: parseInt10(params['limit']) ?? DEFAULT_LIMIT,
    offset: parseInt10(params['offset']) ?? DEFAULT_OFFSET
  };
}

export function toParams(query: Partial<ListQuery>): Record<string, string | null> {
  return {
    where: query.where && Object.keys(query.where).length > 0 ? JSON.stringify(query.where) : null,
    orderBy: query.orderBy && query.orderBy.length > 0 ? JSON.stringify(query.orderBy) : null,
    limit: query.limit && query.limit !== DEFAULT_LIMIT ? String(query.limit) : null,
    offset: query.offset && query.offset !== DEFAULT_OFFSET ? String(query.offset) : null
  };
}

function parseJson<T>(raw: string | undefined): T | undefined {
  if (!raw) {
    return undefined;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

function parseInt10(raw: string | undefined): number | undefined {
  if (!raw) {
    return undefined;
  }
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : undefined;
}
```

### `store/entities/entities.actions.ts`

```ts
import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { type CreateEntityInput, type Entity, type ListQuery, type UpdateEntityInput } from './entities.model';

export const EntitiesActions = createActionGroup({
  source: 'Entities',
  events: {
    'Load List': props<{ query: ListQuery }>(),
    'Load List Success': props<{ items: Entity[]; total: number }>(),
    'Load List Failure': props<{ error: string }>(),

    'Load One': props<{ id: string }>(),
    'Load One Success': props<{ item: Entity }>(),
    'Load One Failure': props<{ error: string }>(),
    'Clear Current': emptyProps(),

    Create: props<{ input: CreateEntityInput }>(),
    'Create Success': props<{ item: Entity }>(),
    'Create Failure': props<{ error: string }>(),

    Update: props<{ id: string; input: UpdateEntityInput }>(),
    'Update Success': props<{ item: Entity }>(),
    'Update Failure': props<{ error: string }>(),

    Delete: props<{ id: string }>(),
    'Delete Success': props<{ id: string }>(),
    'Delete Failure': props<{ error: string }>(),

    'Reset Form State': emptyProps()
  }
});
```

### `store/entities/entities.reducer.ts`

Only reacts to server-returned data. The query itself lives in the URL.

```ts
import { createReducer, on } from '@ngrx/store';
import { EntitiesActions } from './entities.actions';
import { type EntitiesState } from './entities.model';

export const initialEntitiesState: EntitiesState = {
  items: [],
  total: 0,
  current: null,
  listLoading: false,
  listError: null,
  itemLoading: false,
  itemError: null,
  saving: false,
  saveError: null,
  lastSavedId: null,
  deleting: false,
  deleteError: null
};

export const entitiesReducer = createReducer(
  initialEntitiesState,
  on(EntitiesActions.loadList, (state) => ({ ...state, listLoading: true, listError: null })),
  on(EntitiesActions.loadListSuccess, (state, { items, total }) => ({ ...state, listLoading: false, items, total })),
  on(EntitiesActions.loadListFailure, (state, { error }) => ({ ...state, listLoading: false, listError: error })),

  on(EntitiesActions.loadOne, (state) => ({ ...state, itemLoading: true, itemError: null, current: null })),
  on(EntitiesActions.loadOneSuccess, (state, { item }) => ({ ...state, itemLoading: false, current: item })),
  on(EntitiesActions.loadOneFailure, (state, { error }) => ({ ...state, itemLoading: false, itemError: error })),
  on(EntitiesActions.clearCurrent, (state) => ({ ...state, current: null, itemError: null })),

  on(EntitiesActions.create, (state) => ({ ...state, saving: true, saveError: null, lastSavedId: null })),
  on(EntitiesActions.createSuccess, (state, { item }) => ({
    ...state,
    saving: false,
    lastSavedId: item.id,
    items: [item, ...state.items],
    total: state.total + 1
  })),
  on(EntitiesActions.createFailure, (state, { error }) => ({ ...state, saving: false, saveError: error })),

  on(EntitiesActions.update, (state) => ({ ...state, saving: true, saveError: null, lastSavedId: null })),
  on(EntitiesActions.updateSuccess, (state, { item }) => ({
    ...state,
    saving: false,
    lastSavedId: item.id,
    current: item,
    items: state.items.map((e) => (e.id === item.id ? item : e))
  })),
  on(EntitiesActions.updateFailure, (state, { error }) => ({ ...state, saving: false, saveError: error })),

  on(EntitiesActions.delete, (state) => ({ ...state, deleting: true, deleteError: null })),
  on(EntitiesActions.deleteSuccess, (state, { id }) => ({
    ...state,
    deleting: false,
    items: state.items.filter((item) => item.id !== id),
    total: Math.max(0, state.total - 1),
    current: state.current?.id === id ? null : state.current
  })),
  on(EntitiesActions.deleteFailure, (state, { error }) => ({ ...state, deleting: false, deleteError: error })),

  on(EntitiesActions.resetFormState, (state) => ({ ...state, saving: false, saveError: null, lastSavedId: null }))
);
```

### `store/entities/entities.selectors.ts`

The query is derived from router-store's `queryParams`, not held in the entities slice.

```ts
import { createFeatureSelector, createSelector } from '@ngrx/store';
import { getRouterSelectors, type RouterReducerState } from '@ngrx/router-store';
import { type EntitiesState } from './entities.model';
import { parseQuery } from './entities.query';

export const ENTITIES_FEATURE_KEY = 'entities';
export const ROUTER_FEATURE_KEY = 'router';

export const selectEntitiesState = createFeatureSelector<EntitiesState>(ENTITIES_FEATURE_KEY);
export const selectRouterState = createFeatureSelector<RouterReducerState>(ROUTER_FEATURE_KEY);

export const selectEntityList = createSelector(selectEntitiesState, (s) => s.items);
export const selectTotal = createSelector(selectEntitiesState, (s) => s.total);
export const selectListLoading = createSelector(selectEntitiesState, (s) => s.listLoading);
export const selectListError = createSelector(selectEntitiesState, (s) => s.listError);

export const selectCurrentEntity = createSelector(selectEntitiesState, (s) => s.current);
export const selectItemLoading = createSelector(selectEntitiesState, (s) => s.itemLoading);
export const selectItemError = createSelector(selectEntitiesState, (s) => s.itemError);

export const selectSaving = createSelector(selectEntitiesState, (s) => s.saving);
export const selectSaveError = createSelector(selectEntitiesState, (s) => s.saveError);
export const selectLastSavedId = createSelector(selectEntitiesState, (s) => s.lastSavedId);
export const selectDeleting = createSelector(selectEntitiesState, (s) => s.deleting);
export const selectDeleteError = createSelector(selectEntitiesState, (s) => s.deleteError);

const { selectQueryParams, selectUrl } = getRouterSelectors();
export { selectQueryParams, selectUrl };

// The URL is the source of truth. All list pages read the query from here.
export const selectListQuery = createSelector(selectQueryParams, (params) => parseQuery(params ?? {}));
```

### `store/entities/entities.effects.ts`

The `reloadListOnNavigation$` effect listens for `routerNavigatedAction` filtered to `/entities`; the component
dispatches **no** load actions, it just navigates with new query params.

```ts
import { inject } from '@angular/core';
import { HttpClient, HttpParams, type HttpErrorResponse } from '@angular/common/http';
import { Store } from '@ngrx/store';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { routerNavigatedAction, type SerializedRouterStateSnapshot } from '@ngrx/router-store';
import { catchError, filter, map, of, switchMap, withLatestFrom } from 'rxjs';
import { EntitiesActions } from './entities.actions';
import { type Entity, type ListQuery } from './entities.model';
import { selectListQuery } from './entities.selectors';
import { selectApiBaseUrl } from '../app-context/app-context.selectors';

interface ListResponse {
  items: Entity[];
  total: number;
  limit: number;
  offset: number;
}

function extractError(err: HttpErrorResponse): string {
  const body = err.error as { message?: string } | null;
  return body?.message ?? err.message ?? 'Request failed';
}

function listPathActive(snapshot: SerializedRouterStateSnapshot): boolean {
  const [path] = snapshot.url.split('?');
  return path === '/entities' || path === '/entities/';
}

function buildListParams(query: ListQuery): HttpParams {
  let params = new HttpParams();
  if (query.where && Object.keys(query.where).length > 0) {
    params = params.set('where', JSON.stringify(query.where));
  }
  if (query.orderBy && query.orderBy.length > 0) {
    params = params.set('orderBy', JSON.stringify(query.orderBy));
  }
  params = params.set('limit', String(query.limit)).set('offset', String(query.offset));
  return params;
}

export const reloadListOnNavigation$ = createEffect(
  (actions$ = inject(Actions), store = inject(Store)) =>
    actions$.pipe(
      ofType(routerNavigatedAction),
      filter(({ payload }) => listPathActive(payload.routerState)),
      withLatestFrom(store.select(selectListQuery)),
      map(([, query]) => EntitiesActions.loadList({ query }))
    ),
  { functional: true }
);

export const loadEntities$ = createEffect(
  (actions$ = inject(Actions), http = inject(HttpClient), store = inject(Store)) =>
    actions$.pipe(
      ofType(EntitiesActions.loadList),
      withLatestFrom(store.select(selectApiBaseUrl)),
      switchMap(([{ query }, apiBaseUrl]) =>
        http.get<ListResponse>(`${apiBaseUrl}/entities`, { params: buildListParams(query) }).pipe(
          map((res) => EntitiesActions.loadListSuccess({ items: res.items, total: res.total })),
          catchError((err: HttpErrorResponse) => of(EntitiesActions.loadListFailure({ error: extractError(err) })))
        )
      )
    ),
  { functional: true }
);
```

Write `loadEntity$`, `createEntity$`, `updateEntity$` and `deleteEntity$` the same way: listen for the request action,
call `HttpClient` against `apiBaseUrl`, and map to the success or failure action. Use `switchMap` for loads and
`concatMap` for writes, so a second save never cancels the first.

## 10. Pages

Three pages: list, detail, and form (reused for create and edit). The list page's control strip (filter / sort / page
size) dispatches `router.navigate([], { queryParams: toParams(next) })`; the effect handles the fetch.

### `pages/entity-list-page.component.ts`

- Reads `selectListQuery` for the current filter / sort / pagination state.
- A local `rows: FilterRow[]` signal holds the editable filter buffer; `applyFilters()` serializes it to a `Where` and
  navigates.
- Pagination: `prev` and `next` buttons navigate with a new `offset`.
- Delete: an inline modal controlled by a signal, with no dialog-service dependency.

### `pages/entity-detail-page.component.ts`

- Dispatches `loadOne` with the route's `id` on init and `clearCurrent` on destroy.
- Reads `selectCurrentEntity`, `selectItemLoading` and `selectItemError`; links to the edit page.

### `pages/entity-form-page.component.ts`

- Shared for `new` and `edit`: reads `this.route.snapshot.paramMap.get('id')` to decide the mode.
- `effect(() => …)` watches `lastSavedId` and navigates to the detail page on success.
- Uses `Validators.required` + `Validators.maxLength` with an inline
  `// eslint-disable-next-line @typescript-eslint/unbound-method` on the first validator (Angular's static validator
  reference is a known false positive of the unbound-method rule).

## 11. Tests

Angular's convention puts specs next to the file they test, as `*.spec.ts`; `ng test` runs them with Vitest. The
scaffold ships one spec for the URL (de)serializer, the piece every list page depends on.

### `store/entities/entities.query.spec.ts`

```ts
import { describe, expect, it } from 'vitest';
import { DEFAULT_LIMIT, DEFAULT_OFFSET, parseQuery, toParams } from './entities.query';

describe('entities query', () => {
  it('falls back to the defaults for an empty URL', () => {
    // Act
    const query = parseQuery({});

    // Assert
    expect(query).toEqual({ where: undefined, orderBy: undefined, limit: DEFAULT_LIMIT, offset: DEFAULT_OFFSET });
  });

  it('serializes default values to null so the router drops them', () => {
    // Act
    const params = toParams({ where: {}, orderBy: [], limit: DEFAULT_LIMIT, offset: DEFAULT_OFFSET });

    // Assert
    expect(params).toEqual({ where: null, orderBy: null, limit: null, offset: null });
  });

  it('round-trips a query through the URL', () => {
    // Arrange
    const query = {
      where: { name: { _ilike: '%a%' } },
      orderBy: [{ field: 'createdAt' as const, dir: 'desc' as const }],
      limit: 50,
      offset: 100
    };

    // Act
    const params = toParams(query);
    const parsed = parseQuery({
      where: params['where'] ?? undefined,
      orderBy: params['orderBy'] ?? undefined,
      limit: params['limit'] ?? undefined,
      offset: params['offset'] ?? undefined
    });

    // Assert
    expect(parsed).toEqual(query);
  });

  it('ignores a malformed where instead of throwing', () => {
    // Act
    const query = parseQuery({ where: '{' });

    // Assert
    expect(query.where).toBeUndefined();
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
