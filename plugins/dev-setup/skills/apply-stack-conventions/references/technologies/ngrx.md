# NgRx

NgRx 22 with `@ngrx/router-store`, used for **route-driven state**: each page route names a state, the URL enters the
store one way, each page reads only its own slice and loads from its own lifecycle, and its requests end with it. The
Angular full stack's `web/` uses it.

## Use it like this

- **Routes name the states.** Each page route declares `data: { state }`, typed by an `AppState` union, so the app's
  shape reads from `app.routes.ts` and a misspelt state is a compile error. Each page's `status` union names what the
  page is doing. Reducers do not guard transitions, so it is not a statechart: late results are kept out by the
  request rules below.
- **The router only writes state.** `provideRouterStore({ serializer: AppRouterSerializer })` turns every navigation
  into actions, and the serializer flattens the route tree to a `NavigatedRoute` (`{ url, state, params, queryParams }`)
  once per navigation. On `routerNavigatedAction`, the page reducer whose state matches copies the route state its page
  needs (the list input, the detail id, the form target). No effect reacts to a navigation, and no navigation starts a
  request. `routerReducer` is not registered: no page would read a router slice, and it would be a second copy of the
  URL to be tempted by.
- **One slice per page, registered on its route** with `provideState` + `provideEffects`; only `appContext` (the API
  base URL and app name, seeded from `environment`) is global, in `app.config.ts`. A page on several routes (the form
  on `new` and `:id/edit`) registers its slice once, on a componentless parent route, or its effects run twice. What two
  pages both need (the entity) each loads for itself.
- **Pages load from a watch started in `ngOnInit`**, never the constructor: Angular constructs the new page before
  `routerNavigatedAction` and runs `ngOnInit` after it. The watch selects the slice's route state, skips `null`, drops
  repeats with `distinctUntilChanged` (its only dedupe), and dispatches `Fetch` / `Load` until destroyed
  (`takeUntilDestroyed`); `ngOnDestroy` dispatches `Leave`, which resets the slice. A reused page (list page 2 → 3,
  detail 42 → 43) reloads through its running watch.
- **Pages inject only the `Store` and read only their slice.** Plain links are `routerLink`; a navigation computed in
  code (a new list query) or caused by a result (after a save, off an empty page) is `AppRouterActions.navigate`, whose
  `navigate$` effect is the only caller of the Angular `Router`. A list query change is a navigation: the reducer copies
  the new input and the watch fetches it, so refresh, back, forward and deep links take the same path. Forms are
  `new FormGroup`; services are injected only in effects.
- **Requests belong to the page that started them**, because route-level effects outlive their page:
  - **reads end on `Leave`**: each read's inner observable ends with `takeUntil(actions$.pipe(ofType(<Page>.leave)))`,
    and a load that needs no request (the new form's `null` id) returns `EMPTY` inside `switchMap` rather than being
    filtered out before it, so it still cancels the read before it;
  - **writes finish, but carry their page**: a save is never cancelled (the user asked for it). The form slice keeps
    the `navigationId` of the navigation that opened it (`routerNavigatedAction`'s `event.id`), cleared on `Leave`;
    each write records it as it starts and its result carries it back, and the reducer and `navigateAfterSave$` ignore
    a result from another visit;
  - **an effect reading route state samples the nullable value and filters afterwards**, never inside
    `withLatestFrom`, which keeps the last non-null value after `Leave`;
  - **a follow-up reads the request it follows**: `Fetch Success` carries its `input`.
- **One `status` union per slice** plus an `error` message set only in `'error'`, never `loading` / `saving` booleans
  that can contradict each other. Templates switch on it.
- **Actions name intent**: `Load` (not `Enter`), `Fetch` for one request with a given input, `<Action> Success` /
  `<Action> Failure`, `Leave`. The action group's `source` is the page name.
- **Reads `switchMap`, writes `concatMap`.** A newer fetch cancels an older one; a second save never cancels the first.
- **A new id or target starts the slice over**: the reducer drops the previous entity with the new id, or the page shows
  entity 42 under the URL for 43.

## Required values

| What            | Value                                                                                                                    |
| --------------- | ------------------------------------------------------------------------------------------------------------------------ |
| dependencies    | `@ngrx/store@22`, `@ngrx/effects@22`, `@ngrx/router-store@22` (NgRx tracks Angular's major)                              |
| devDependencies | `@ngrx/store-devtools@22`                                                                                                |
| effects         | functional: `createEffect(() => …, { functional: true })`, registered with `provideEffects(<module namespace>)`          |
| slice files     | `store/<page>/<page>.{model,actions,reducer,selectors,effects}.ts`; feature key `<PAGE>_FEATURE_KEY`                     |
| specs           | `<page>.reducer.spec.ts` and `<page>.effects.spec.ts` beside each slice; a selectors spec only for a selector with logic |

## Pitfalls

- **Starting the watch in the constructor** sees the previous URL's state.
- **`filter(nonNull)` inside `withLatestFrom`** keeps the input from before `Leave`, and a write's follow-up acts on a page
  the user left.
- **`commands: []` is relative to the current URL**, whatever page that is by the time the action runs: use it only from
  the page itself or from an effect whose request ended on `Leave`.
- **Registering a page's slice on two routes** runs its effects twice.
- **An equal route state must be a new object in a page test**: NgRx's `select` drops the same reference before the
  page's `distinctUntilChanged` sees it, and the case passes without the operator.
- **Spying on `dispatch` after the page exists** misses everything its `ngOnInit` dispatched: spy first, then create.
- **`TestBed.inject(MockStore)` is a `MockStore<any>`**, which the type-checked lint rejects when assigned to a typed
  variable: inject it as `TestBed.inject<MockStore<object>>(MockStore)`.

## Reference code

Write these as given; they are the pattern every later resource copies. The detail page's slice is the list's shape
with an `id: string | null` instead of the input, statuses `'idle' | 'loading' | 'loaded' | 'error'`, a `Load` /
`Load Success` / `Load Failure` / `Leave` group, and one `load$` read ending on `Leave`; its reducer starts the slice
over when the id changes. Its files close this section.

**`app.config.ts`**

```ts
import { type ApplicationConfig, isDevMode, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideStore } from '@ngrx/store';
import { provideEffects } from '@ngrx/effects';
import { provideStoreDevtools } from '@ngrx/store-devtools';
import { provideRouterStore } from '@ngrx/router-store';
import { routes } from './app.routes';
import { APP_CONTEXT_FEATURE_KEY } from './store/app-context/app-context.selectors';
import { appContextReducer } from './store/app-context/app-context.reducer';
import * as appRouterEffects from './store/app-router/app-router.effects';
import { AppRouterSerializer } from './store/app-router/app-router.serializer';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(),
    // The one global slice is the application context (api base URL, app name); page slices are
    // registered on their routes (see app.routes.ts). The route is not kept in the store:
    // router-store turns every navigation into actions, and each page reducer copies what its
    // state needs from routerNavigatedAction. Templates navigate with routerLink; everything else
    // dispatches AppRouterActions.navigate, and navigate$ is the only code that calls the Router.
    provideStore({ [APP_CONTEXT_FEATURE_KEY]: appContextReducer }),
    provideRouterStore({ serializer: AppRouterSerializer }),
    provideEffects(appRouterEffects),
    provideStoreDevtools({ maxAge: 25, logOnly: !isDevMode() })
  ]
};
```

**`app.routes.ts`**

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

// Each page route is one state (data.state) and registers its own slice on its route.
// Route-level effects outlive the page: reads end on Leave, writes check their page.
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

**`store/app-router/app-router.model.ts`**

```ts
import { type Params } from '@angular/router';

/** The app's states: one per page route, declared on the route as `data: { state }`. */
export type AppState = 'entity-list' | 'entity-detail' | 'entity-new' | 'entity-edit';

/**
 * The payload of `routerNavigatedAction`, as `AppRouterSerializer` writes it: plain data, never stored. Each page
 * reducer reads it with `navigatedRoute(action)` and copies what its own state needs into its slice.
 */
export interface NavigatedRoute {
  url: string;
  /** The deepest route's `data.state`; `null` on a route that declares none (the root redirect). */
  state: AppState | null;
  /** Route params of the whole matched branch, e.g. `{ id }`. */
  params: Params;
  queryParams: Params;
}
```

**`store/app-router/app-router.serializer.ts`**

```ts
import { type Params, type RouterStateSnapshot } from '@angular/router';
import { type RouterNavigatedAction, type RouterStateSerializer } from '@ngrx/router-store';
import { type AppState, type NavigatedRoute } from './app-router.model';

export class AppRouterSerializer implements RouterStateSerializer<NavigatedRoute> {
  serialize(snapshot: RouterStateSnapshot): NavigatedRoute {
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

/**
 * The route a navigation landed on, as `AppRouterSerializer` wrote it. router-store types the payload with its
 * default serializer's shape, so this is the one cast to ours.
 */
export function navigatedRoute(action: RouterNavigatedAction): NavigatedRoute {
  return action.payload.routerState as unknown as NavigatedRoute;
}
```

**`store/app-router/app-router.actions.ts`**

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

**`store/app-router/app-router.effects.ts`**

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

**`store/entity-list-page/entity-list-page.model.ts`**

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

**`store/entity-list-page/entity-list-page.actions.ts`**

```ts
import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { type Entity, type ListEntityInput } from '../../models/entity.model';

export const EntityListPageActions = createActionGroup({
  source: 'Entity List Page',
  events: {
    Leave: emptyProps(),

    /** One request for one list input: the page's watch sends one per new input, and a delete one more. */
    Fetch: props<{ input: ListEntityInput }>(),
    /** `input` is the one the request was made for. */
    'Fetch Success': props<{ input: ListEntityInput; items: Entity[]; total: number }>(),
    'Fetch Failure': props<{ error: string }>(),

    Delete: props<{ id: string }>(),
    'Delete Success': props<{ id: string }>(),
    'Delete Failure': props<{ error: string }>()
  }
});
```

**`store/entity-list-page/entity-list-page.reducer.ts`**

```ts
import { createReducer, on } from '@ngrx/store';
import { routerNavigatedAction } from '@ngrx/router-store';
import { parseListInput } from '../../helpers/entity-list-params.helper';
import { navigatedRoute } from '../app-router/app-router.serializer';
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

**`store/entity-list-page/entity-list-page.selectors.ts`**

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

**`store/entity-list-page/entity-list-page.effects.ts`**

```ts
import { inject } from '@angular/core';
import { type HttpErrorResponse } from '@angular/common/http';
import { Store } from '@ngrx/store';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, concatMap, filter, map, of, switchMap, takeUntil, withLatestFrom } from 'rxjs';
import { toParams } from '../../helpers/entity-list-params.helper';
import { httpErrorMessage } from '../../helpers/http-error.helper';
import { EntityService } from '../../services/entity.service';
import { AppRouterActions } from '../app-router/app-router.actions';
import { EntityListPageActions } from './entity-list-page.actions';
import { selectListInput } from './entity-list-page.selectors';

// A delete changes the totals and shifts later rows onto the current page, so the list is fetched again,
// unless the page has been left (the input is null after Leave).
export const fetchAfterDelete$ = createEffect(
  (actions$ = inject(Actions), store = inject(Store)) =>
    actions$.pipe(
      ofType(EntityListPageActions.deleteSuccess),
      withLatestFrom(store.select(selectListInput)),
      map(([, input]) => input),
      filter((input) => input !== null),
      map((input) => EntityListPageActions.fetch({ input }))
    ),
  { functional: true }
);

// A page past the end (a delete emptied the last page, or a stale deep link) steps back to the last page.
export const stepBackPastLastPage$ = createEffect(
  (actions$ = inject(Actions)) =>
    actions$.pipe(
      ofType(EntityListPageActions.fetchSuccess),
      filter(({ input, items, total }) => items.length === 0 && total > 0 && input.page > 1),
      map(({ input, total }) =>
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
          map((res) => EntityListPageActions.fetchSuccess({ input, items: res.items, total: res.total })),
          catchError((err: HttpErrorResponse) => of(EntityListPageActions.fetchFailure({ error: httpErrorMessage(err) }))),
          takeUntil(actions$.pipe(ofType(EntityListPageActions.leave)))
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

**`store/entity-form-page/entity-form-page.model.ts`**

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
  /** The router navigation that opened the form for `target`; `null` until then and after `Leave`. */
  navigationId: number | null;
  status: EntityFormPageStatus;
  /** The entity being edited; `null` when creating. */
  entity: Entity | null;
  /** Set when `status` is `'error'`. */
  error: string | null;
}
```

**`store/entity-form-page/entity-form-page.actions.ts`**

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
    /** `navigationId` is the slice's when the save started: the result belongs to that visit of the form. */
    'Save Success': props<{ entity: Entity; navigationId: number | null }>(),
    'Save Failure': props<{ error: string; navigationId: number | null }>(),

    Leave: emptyProps()
  }
});
```

In the reducer, `target.id !== state.target?.id` is `true` for the first `{ id: null }` too, since the initial
`target` is `null`; `action.payload.event` is the router's `NavigationEnd`, whose `id` is unique per navigation.

**`store/entity-form-page/entity-form-page.reducer.ts`**

```ts
import { createReducer, on } from '@ngrx/store';
import { routerNavigatedAction } from '@ngrx/router-store';
import { type NavigatedRoute } from '../app-router/app-router.model';
import { navigatedRoute } from '../app-router/app-router.serializer';
import { EntityFormPageActions } from './entity-form-page.actions';
import { type EntityFormPageState, type EntityFormTarget } from './entity-form-page.model';

export const initialEntityFormPageState: EntityFormPageState = {
  target: null,
  navigationId: null,
  status: 'idle',
  entity: null,
  error: null
};

export const entityFormPageReducer = createReducer(
  initialEntityFormPageState,
  // A new target starts the slice over: nothing of the previous form survives, and its saves no longer apply.
  on(routerNavigatedAction, (state, action) => {
    const target = formTarget(navigatedRoute(action));
    return target !== null && target.id !== state.target?.id
      ? { ...initialEntityFormPageState, target, navigationId: action.payload.event.id }
      : state;
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
  // A save's result applies only to the visit of the form that started it.
  on(EntityFormPageActions.saveSuccess, (state, { entity, navigationId }) =>
    navigationId === state.navigationId ? { ...state, status: 'ready' as const, entity } : state
  ),
  on(EntityFormPageActions.saveFailure, (state, { error, navigationId }) =>
    navigationId === state.navigationId ? { ...state, status: 'error' as const, error } : state
  ),

  on(EntityFormPageActions.leave, () => initialEntityFormPageState)
);

function formTarget(route: NavigatedRoute): EntityFormTarget | null {
  if (route.state === 'entity-new') {
    return { id: null };
  }
  return route.state === 'entity-edit' ? { id: route.params['id'] as string } : null;
}
```

**`store/entity-form-page/entity-form-page.selectors.ts`**

```ts
import { createFeatureSelector, createSelector } from '@ngrx/store';
import { type EntityFormPageState } from './entity-form-page.model';

export const ENTITY_FORM_PAGE_FEATURE_KEY = 'entityFormPage';

export const selectEntityFormPageState = createFeatureSelector<EntityFormPageState>(ENTITY_FORM_PAGE_FEATURE_KEY);

/** The target the reducer copied from the URL; `null` until the router has navigated to the form. */
export const selectTarget = createSelector(selectEntityFormPageState, (s) => s.target);
/** For the effects: which visit of the form a save belongs to. */
export const selectNavigationId = createSelector(selectEntityFormPageState, (s) => s.navigationId);
export const selectStatus = createSelector(selectEntityFormPageState, (s) => s.status);
export const selectEntity = createSelector(selectEntityFormPageState, (s) => s.entity);
export const selectError = createSelector(selectEntityFormPageState, (s) => s.error);
```

**`store/entity-form-page/entity-form-page.effects.ts`**

```ts
import { inject } from '@angular/core';
import { type HttpErrorResponse } from '@angular/common/http';
import { Store } from '@ngrx/store';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, concatMap, EMPTY, filter, map, of, switchMap, takeUntil, withLatestFrom } from 'rxjs';
import { httpErrorMessage } from '../../helpers/http-error.helper';
import { EntityService } from '../../services/entity.service';
import { AppRouterActions } from '../app-router/app-router.actions';
import { EntityFormPageActions } from './entity-form-page.actions';
import { selectNavigationId } from './entity-form-page.selectors';

// A new form (id null) needs no request, but still goes through switchMap to cancel the one before it;
// leaving the page cancels it too.
export const load$ = createEffect(
  (actions$ = inject(Actions), entityService = inject(EntityService)) =>
    actions$.pipe(
      ofType(EntityFormPageActions.load),
      switchMap(({ id }) =>
        id === null
          ? EMPTY
          : entityService.get(id).pipe(
              map((entity) => EntityFormPageActions.loadSuccess({ entity })),
              catchError((err: HttpErrorResponse) => of(EntityFormPageActions.loadFailure({ error: httpErrorMessage(err) }))),
              takeUntil(actions$.pipe(ofType(EntityFormPageActions.leave)))
            )
      )
    ),
  { functional: true }
);

// Writes use concatMap so a second save never cancels the first, and are not cancelled on Leave.
// Each records the form's navigationId as the save starts, so its result can tell whether that visit is still open.
export const create$ = createEffect(
  (actions$ = inject(Actions), store = inject(Store), entityService = inject(EntityService)) =>
    actions$.pipe(
      ofType(EntityFormPageActions.create),
      withLatestFrom(store.select(selectNavigationId)),
      concatMap(([{ input }, navigationId]) =>
        entityService.create(input).pipe(
          map((entity) => EntityFormPageActions.saveSuccess({ entity, navigationId })),
          catchError((err: HttpErrorResponse) => of(EntityFormPageActions.saveFailure({ error: httpErrorMessage(err), navigationId })))
        )
      )
    ),
  { functional: true }
);

export const update$ = createEffect(
  (actions$ = inject(Actions), store = inject(Store), entityService = inject(EntityService)) =>
    actions$.pipe(
      ofType(EntityFormPageActions.update),
      withLatestFrom(store.select(selectNavigationId)),
      concatMap(([{ id, input }, navigationId]) =>
        entityService.update(id, input).pipe(
          map((entity) => EntityFormPageActions.saveSuccess({ entity, navigationId })),
          catchError((err: HttpErrorResponse) => of(EntityFormPageActions.saveFailure({ error: httpErrorMessage(err), navigationId })))
        )
      )
    ),
  { functional: true }
);

// Only the visit of the form that started the save moves on to the detail page.
export const navigateAfterSave$ = createEffect(
  (actions$ = inject(Actions), store = inject(Store)) =>
    actions$.pipe(
      ofType(EntityFormPageActions.saveSuccess),
      withLatestFrom(store.select(selectNavigationId)),
      filter(([{ navigationId }, current]) => navigationId === current),
      map(([{ entity }]) => AppRouterActions.navigate({ commands: ['/entities', entity.id] }))
    ),
  { functional: true }
);
```

The list page's watch; the detail page watches `selectId` with `distinctUntilChanged()`, the form `selectTarget`
with `distinctUntilChanged((a, b) => a.id === b.id)`:

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

**`src/testing/navigated.ts`**: builds the `routerNavigatedAction` a reducer spec feeds in; `routerState as never` is the one cast, for the reason `navigatedRoute` exists.

```ts
import { routerNavigatedAction } from '@ngrx/router-store';
import { type NavigationEnd } from '@angular/router';
import { type NavigatedRoute } from '../app/store/app-router/app-router.model';

export function navigated(
  route: Partial<NavigatedRoute> & Pick<NavigatedRoute, 'state'>,
  navigationId = 1
): ReturnType<typeof routerNavigatedAction> {
  const routerState: NavigatedRoute = { url: '/', params: {}, queryParams: {}, ...route };
  return routerNavigatedAction({
    payload: { routerState: routerState as never, event: { id: navigationId, url: routerState.url } as NavigationEnd }
  });
}
```

**`src/testing/render-page.ts`**: mounts a page over a mock store, with `dispatch` spied before the page exists. Keep the inferred return type: a hand-written one turns the spy into `any`.

```ts
// render-page.ts — mounts a page over a mock store, into the live document for the `page` locators
import { type Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MockStore, type MockSelector, provideMockStore } from '@ngrx/store/testing';
import { vi } from 'vitest';

// `dispatch` is spied before the page exists, so the actions of its ngOnInit watch are recorded.
// The return type is inferred on purpose: it keeps the spy typed as `dispatch`'s own mock.
export function renderPage<T>(component: Type<T>, selectors: MockSelector[]) {
  TestBed.configureTestingModule({ providers: [provideRouter([]), provideMockStore({ selectors })] });
  const store = TestBed.inject(MockStore);
  const dispatch = vi.spyOn(store, 'dispatch');
  const fixture = TestBed.createComponent(component);
  document.body.appendChild(fixture.nativeElement as HTMLElement);
  fixture.autoDetectChanges();
  return { fixture, store, dispatch };
}
```

**`store/entity-detail-page/entity-detail-page.model.ts`**

```ts
import { type Entity } from '../../models/entity.model';

export type EntityDetailPageStatus = 'idle' | 'loading' | 'loaded' | 'error';

export interface EntityDetailPageState {
  /** Copied from the URL; `null` until the router has navigated to the detail page. */
  id: string | null;
  status: EntityDetailPageStatus;
  entity: Entity | null;
  /** Set when `status` is `'error'`. */
  error: string | null;
}
```

**`store/entity-detail-page/entity-detail-page.actions.ts`**

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

**`store/entity-detail-page/entity-detail-page.reducer.ts`**

```ts
import { createReducer, on } from '@ngrx/store';
import { routerNavigatedAction } from '@ngrx/router-store';
import { navigatedRoute } from '../app-router/app-router.serializer';
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
  // A new id starts the slice over, or the page would show entity 42 under the URL for 43.
  on(routerNavigatedAction, (state, action) => {
    const route = navigatedRoute(action);
    if (route.state !== 'entity-detail') {
      return state;
    }
    const id = route.params['id'] as string;
    return id === state.id ? state : { ...initialEntityDetailPageState, id };
  }),
  on(EntityDetailPageActions.leave, () => initialEntityDetailPageState),

  on(EntityDetailPageActions.load, (state) => ({ ...state, status: 'loading' as const, error: null })),
  on(EntityDetailPageActions.loadSuccess, (state, { entity }) => ({ ...state, status: 'loaded' as const, entity })),
  on(EntityDetailPageActions.loadFailure, (state, { error }) => ({ ...state, status: 'error' as const, error }))
);
```

**`store/entity-detail-page/entity-detail-page.selectors.ts`**

```ts
import { createFeatureSelector, createSelector } from '@ngrx/store';
import { type EntityDetailPageState } from './entity-detail-page.model';

export const ENTITY_DETAIL_PAGE_FEATURE_KEY = 'entityDetailPage';

export const selectEntityDetailPageState = createFeatureSelector<EntityDetailPageState>(ENTITY_DETAIL_PAGE_FEATURE_KEY);

/** The id the reducer copied from the URL; `null` until the router has navigated to the detail page. */
export const selectId = createSelector(selectEntityDetailPageState, (s) => s.id);
export const selectStatus = createSelector(selectEntityDetailPageState, (s) => s.status);
export const selectEntity = createSelector(selectEntityDetailPageState, (s) => s.entity);
export const selectError = createSelector(selectEntityDetailPageState, (s) => s.error);
```

**`store/entity-detail-page/entity-detail-page.effects.ts`**

```ts
import { inject } from '@angular/core';
import { type HttpErrorResponse } from '@angular/common/http';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, map, of, switchMap, takeUntil } from 'rxjs';
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
          catchError((err: HttpErrorResponse) => of(EntityDetailPageActions.loadFailure({ error: httpErrorMessage(err) }))),
          takeUntil(actions$.pipe(ofType(EntityDetailPageActions.leave)))
        )
      )
    ),
  { functional: true }
);
```

## Conventions

### Route-driven state

- **Each page route is a state**, named in `data: { state }` and typed by `AppState`; each page's `status` union names
  what the page is doing. The route table is the list of states.
- **Data moves one way, in two loops.** Navigation: a `routerLink`, or `AppRouterActions.navigate` → `navigate$` →
  `Router` → `routerNavigatedAction` → the page reducer whose state matches. Data: the page's watch → `Fetch` / `Load`
  → effect → service → `<Action> Success` / `Failure` → reducer → page.
- **The router only writes state; the page decides when to load.** No effect reacts to `routerNavigatedAction`, and
  there is no router slice: each page reducer keeps the part of the URL its page needs, read with
  `navigatedRoute(action)`.
- **The URL changes in one direction.** The app follows a link or dispatches `navigate`, and the new value reaches the
  slice only through `routerNavigatedAction`; nothing writes URL-backed state into a slice directly. A user's change
  adds a history entry; a correction the user did not ask for (a page past the end) uses `replaceUrl`.

### Where state lives

| State                                  | Lives in                                               |
| -------------------------------------- | ------------------------------------------------------ |
| what the user is looking at, shareable | the URL, copied into the page slice by its reducer     |
| server data and the request's status   | the page's slice                                       |
| UI-only, short-lived                   | a signal in the page (`signal` / `linkedSignal`)       |
| build-time config                      | `environment*.ts`, read only by the `appContext` slice |

Derive UI state that must follow the store with `linkedSignal`, not an `effect()` that syncs it by hand.

### The page contract

- **Watch and Leave.** Every page starts its watch in `ngOnInit` (skip `null`, `distinctUntilChanged`,
  `takeUntilDestroyed`) and dispatches `Leave` in `ngOnDestroy`; the reducer resets on `Leave`.
- **Each slice holds the route state its page needs**, `null` until the router writes it, and writes it only on
  `routerNavigatedAction` for its own state. A new id or target starts the slice over.
- **One `status` union per slice, never boolean flags**, plus `error: string | null` set only in `'error'`.
- **Actions name intent**: `Load`, `Fetch`, `<Action> Success` / `<Action> Failure`, `Leave`; the group's `source` is
  the page name.
- **Reads `switchMap` and end on `Leave`**; a load that needs no request returns `EMPTY` inside `switchMap`.
- **Writes `concatMap`, finish, and carry their page's `navigationId`**; the reducer and any follow-up act on a result
  only when it matches the slice's.
- **An effect reading route state samples it and filters afterwards**, never inside `withLatestFrom`.
- **Navigation after a result is an effect**, never page code; plain links are `routerLink`.
- **A page on several routes registers its slice once**, on a shared componentless parent route.

### Building blocks

| Block       | Lives in                                                   | May use                                                        | Must not                                                                                    |
| ----------- | ---------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| page        | `pages/<name>-page.component.ts`                           | the `Store` (its own slice), `RouterLink`, components, signals | inject services, `Router`, `ActivatedRoute`, `FormBuilder`                                  |
| slice       | `store/<page>/<page>.{model,actions,reducer,selectors}.ts` | resource models, helpers, `navigatedRoute`                     | hold another page's data, read another state's route                                        |
| effects     | `store/<page>/<page>.effects.ts`                           | services, `Store`, `AppRouterActions.navigate`                 | call `Router` or `HttpClient`, react to `routerNavigatedAction`, let a read outlive `Leave` |
| app router  | `store/app-router/`                                        | the `Router` (`navigate$` only)                                | keep the route in the store                                                                 |
| app context | `store/app-context/`                                       | `environment`                                                  | change after start                                                                          |
| service     | `services/<resource>.service.ts`                           | `HttpClient`, `selectApiBaseUrl`, helpers                      | be injected outside effects, keep state                                                     |

- **Services write each request in full**: the URL and params inline, no private URL helper; the list reuses the shared
  params helper so the page URL and the API request share one format.
- **Naming**: action groups `<Page>Actions`, feature keys `<PAGE>_FEATURE_KEY`, selectors `select<Thing>`, effects
  `<what it does>$` (`stepBackPastLastPage$`, `navigateAfterSave$`).

### Testing state

- **Reducer specs** are plain calls, `reducer(state, action)`, with each navigation built by
  `navigated({ state, params, queryParams })`, into the page's own state and into another.
- **Effects specs** use `provideMockActions`, fake services and `provideMockStore` with overridden selectors, and drive
  the operators that matter (`switchMap` cancellation, `concatMap` ordering, `takeUntil` on `Leave`) with a `Subject`
  of actions. Every read gets a "response after `Leave` emits nothing" case; every write's follow-up a "from another
  visit does nothing" case.
- **Page specs** mount through `renderPage()` and move the route state with `overrideSelector` + `refreshState()`,
  each value a new object: the first state loads, an equal one does not, a new one on the same component does, and
  destroy dispatches `Leave`. A page that derives something from a sequence of statuses (a `linkedSignal` or
  `computed` watching `status`) sees only the last of several `refreshState()` calls in one tick, since signals are
  read lazily: `await fixture.whenStable()` after each one.
- **No spec for selectors that only pick a field**, nor for the route table: each page's end-to-end test opens its page
  by URL, which proves the path, the state and the slice registered on the route.
