# Web tests

The web app has **three** test layers, each with its own runner:

| layer                  | runner                                   | what it covers                                               | command            |
| ---------------------- | ---------------------------------------- | ------------------------------------------------------------ | ------------------ |
| unit                   | `ng test` (Vitest + jsdom, Angular CLI)  | services, every NgRx slice, helpers — `*.spec.ts` beside the file | `pnpm test`        |
| component / page browser | Vitest **browser mode** + Playwright     | pages rendered in real Chromium with a mocked store          | `pnpm test:browser`|
| full-stack e2e         | **Playwright Test**                      | the real app → real API → real Postgres                      | `pnpm test:e2e`    |

`ng test` is the required check (`test`); `test:browser` and `test:e2e` are additional scripts.

> **Web is pinned to Vitest 4** (`vitest`, `@vitest/browser`, `@vitest/browser-playwright` all `4.1.12`). Vitest 5's
> browser mode does not inject its `@vitest/browser/context` virtual module in this workspace (peer fan-out produces
> several `vitest` realms), so `page` throws. `@angular/build` accepts `vitest ^4.0.8 || ^5.0.0`, so `ng test` runs on
> 4 unchanged. The **API stays on Vitest 5**. Revisit when upstream browser mode works on 5 here.

## Contents

- [1. Unit tests (`ng test`)](#1-unit-tests-ng-test)
- [2. Browser-mode page tests](#2-browser-mode-page-tests)
- [3. Full-stack e2e](#3-full-stack-e2e)

## 1. Unit tests (`ng test`)

Specs sit beside the file they cover as `*.spec.ts`; `ng test` runs them with Vitest in jsdom via the Angular builder.
Every spec imports `{ describe, it, expect }` from `vitest`, follows Arrange / Act / Assert, and wraps its cases in one
top-level `describe` named for the module. What the scaffold ships:

- **`services/entity.service.spec.ts`** — `TestBed` with `provideHttpClient()` + `provideHttpClientTesting()` and a
  `provideMockStore` overriding `selectApiBaseUrl`; asserts the URL, method, params and body of each call via
  `HttpTestingController`.
- **Per page slice** (`entity-list-page`, `entity-detail-page`, `entity-form-page`): a `*.reducer.spec.ts`
  (pure: each action → state), a `*.selectors.spec.ts` (test the `.projector(...)` of selectors that carry logic), and
  a `*.effects.spec.ts` (functional effects via `provideMockActions` + `TestBed.runInInjectionContext`). The list page's
  effects spec adds an **operator-details** block that drives the RxJS pipeline itself (`distinctUntilChanged`,
  `takeUntil(leave)`, the null-input filter, `switchMap` cancellation, `concatMap` serialization) — see below.
- **`store/app-context/`** — `app-context.reducer.spec.ts` (initial state seeded from `environment`) and
  `app-context.selectors.spec.ts`. **`store/app-router/app-router.effects.spec.ts`** — `navigate$` calls the
  Angular `Router`.
- **App shell & routing**: `app.routes.spec.ts` drives every route with `RouterTestingHarness` (redirect + each page +
  the shared form slice); `app.component.spec.ts` and `layouts/main-layout.component.spec.ts` smoke-render the shell
  (router-outlet present, app name from the store).
- **Helpers**: `entity-list-params.helper.spec.ts` (the URL ↔ input round-trip), `entity-filter-form.helper.spec.ts`
  (the filter strip mapping + date round-trip) and `http-error.helper.spec.ts`.

A new resource copies the service + slice specs; a new helper gets a spec beside it with a happy case and an edge case.

### Service — `services/entity.service.spec.ts`

```ts
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideMockStore } from '@ngrx/store/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { type Entity } from '../models/entity.model';
import { selectApiBaseUrl } from '../store/app-context/app-context.selectors';
import { EntityService } from './entity.service';

const API = 'http://api.test';

describe('entity.service', () => {
  let service: EntityService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        EntityService,
        provideHttpClient(),
        provideHttpClientTesting(),
        provideMockStore({ selectors: [{ selector: selectApiBaseUrl, value: API }] })
      ]
    });
    service = TestBed.inject(EntityService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('drops page and pageSize when they are the defaults', () => {
    service.list({ page: 1, pageSize: 20 }).subscribe();
    const req = httpMock.expectOne((r) => r.url === `${API}/entities`);
    expect(req.request.params.has('page')).toBe(false);
    req.flush({ items: [], total: 0, page: 1, pageSize: 20, totalPages: 0 });
  });

  it('delete issues a DELETE at the id URL', () => {
    service.delete('e1').subscribe();
    const req = httpMock.expectOne(`${API}/entities/e1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });
});
```

### Effects — functional effects via `provideMockActions`

Functional effects (`createEffect(() => inject(Actions)…, { functional: true })`) are invoked inside an injection
context and subscribed. This is the pattern for every `*.effects.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { type Action } from '@ngrx/store';
import { provideMockActions } from '@ngrx/effects/testing';
import { firstValueFrom, type Observable, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { type Entity } from '../../models/entity.model';
import { EntityService } from '../../services/entity.service';
import { EntityDetailPageActions } from './entity-detail-page.actions';
import { load$ } from './entity-detail-page.effects';

const entity: Entity = { id: 'e1', name: 'Acme', description: null, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' };

describe('entity-detail-page.effects', () => {
  let actions$: Observable<Action>;
  const entityService = { get: vi.fn() };

  beforeEach(() => {
    vi.resetAllMocks();
    TestBed.configureTestingModule({
      providers: [provideMockActions(() => actions$), { provide: EntityService, useValue: entityService }]
    });
  });

  it('maps a successful get to load success', async () => {
    entityService.get.mockReturnValue(of(entity));
    actions$ = of(EntityDetailPageActions.load({ id: 'e1' }));

    const emitted = await firstValueFrom(TestBed.runInInjectionContext(() => load$()));

    expect(emitted).toEqual(EntityDetailPageActions.loadSuccess({ entity }));
  });

  it('maps a failing get to load failure with the server message', async () => {
    entityService.get.mockReturnValue(throwError(() => new HttpErrorResponse({ error: { message: 'not found' }, status: 404 })));
    actions$ = of(EntityDetailPageActions.load({ id: 'missing' }));

    const emitted = await firstValueFrom(TestBed.runInInjectionContext(() => load$()));

    expect(emitted).toEqual(EntityDetailPageActions.loadFailure({ error: 'not found' }));
  });
});
```

- **Reducer specs** are plain function calls: `reducer(state, action)` → expected state, no `TestBed`.
- **Selector specs** call `selector.projector(input)` directly. Each page slice and the `app-context` slice ships a
  `*.selectors.spec.ts` for parallelism across slices, even where the selectors are trivial field pickers; the list
  page's `selectListInput` / `selectListInputOnListPage` additionally carry URL-parsing logic worth asserting in depth.
- **Store effects** that read the store (the list page's `fetchOnListInputChange$` / `fetchAfterDelete$`) add a
  `provideMockStore` with the relevant selectors overridden.

### Effects — operator details (list page)

The single-action-in → single-action-out style above proves the mapping but **not** the RxJS operators that make the
URL-driven list correct. The list effects spec adds an `operator details` block that drives them with a
**`Subject`-backed `actions$`** and a **mutable `MockStore`**, collecting every emission synchronously — no scheduler:

- Reassign the existing `let actions$` to a `new Subject<Action>()` and `.subscribe((a) => emitted.push(a))` the effect.
- For store-driven effects (`fetchOnListInputChange$`), push input changes with `store.overrideSelector(selector, value)`
  then `store.refreshState()`. Identical values exercise `distinctUntilChanged` (dropped); emitting `leave()` then a
  change exercises `takeUntil`; overriding to `null` exercises the null-input `filter`.
- For service-driven effects (`fetch$`, `delete$`), give the fake service `Subject` returns via
  `mockReturnValueOnce(first).mockReturnValueOnce(second)` and complete them in a controlled order: `switchMap` drops the
  first (its emission is ignored), `concatMap` only subscribes the second after the first completes
  (`toHaveBeenCalledTimes`).

```ts
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { Subject } from 'rxjs';
// ...the beforeEach adds provideMockStore with selectListInput / selectListInputOnListPage overridden.

describe('operator details', () => {
  const inputA: ListEntityInput = { filter: undefined, sort: undefined, page: 1, pageSize: 20 };
  const inputB: ListEntityInput = { filter: undefined, sort: undefined, page: 2, pageSize: 20 };

  it('fetchOnListInputChange$ fetches once for a repeated identical input (distinctUntilChanged)', () => {
    const actions = new Subject<Action>();
    actions$ = actions;
    const store = TestBed.inject(MockStore);
    store.overrideSelector(selectListInputOnListPage, inputA);
    const emitted: Action[] = [];
    const sub = TestBed.runInInjectionContext(() => fetchOnListInputChange$()).subscribe((a) => emitted.push(a));

    actions.next(EntityListPageActions.load()); // inner subscribes, emits inputA -> fetch
    store.overrideSelector(selectListInputOnListPage, inputA);
    store.refreshState(); // identical -> dropped
    store.overrideSelector(selectListInputOnListPage, inputB);
    store.refreshState(); // changed -> fetch
    sub.unsubscribe();

    expect(emitted).toEqual([EntityListPageActions.fetch({ input: inputA }), EntityListPageActions.fetch({ input: inputB })]);
  });

  it('fetch$ lets a newer fetch cancel the in-flight one (switchMap)', () => {
    const first = new Subject<PaginatedResult<Entity>>();
    const second = new Subject<PaginatedResult<Entity>>();
    entityService.list.mockReturnValueOnce(first).mockReturnValueOnce(second);
    const actions = new Subject<Action>();
    actions$ = actions;
    const emitted: Action[] = [];
    const sub = TestBed.runInInjectionContext(() => fetch$()).subscribe((a) => emitted.push(a));

    actions.next(EntityListPageActions.fetch({ input: inputA })); // subscribes `first`
    actions.next(EntityListPageActions.fetch({ input: inputB })); // switchMap drops `first`
    first.next(result); // ignored
    second.next(resultB);
    sub.unsubscribe();

    expect(emitted).toEqual([EntityListPageActions.fetchSuccess({ items: resultB.items, total: resultB.total })]);
  });
});
```

The companion cases (`takeUntil(leave)`, the null-input `filter`, and `delete$`'s `concatMap` serialization) follow the
same two techniques.

### Routing — `app.routes.spec.ts`

`RouterTestingHarness` works in the zoneless jsdom `ng test` environment with no extra change-detection provider. Provide
the real `routes`, a root store (`appContext` + `appRouter` reducers) with `provideRouterStore`, the app-router effects,
and a **fake `EntityService`** (every method returns `of(...)`) so the per-route effects that fire on page load never
touch HTTP. `navigateByUrl(url, Component)` asserts the activated component's type; read `Router.url` to assert the
redirect.

```ts
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

const fakeEntityService = {
  list: () => of({ items: [], total: 0, page: 1, pageSize: 20, totalPages: 0 }),
  get: () => of(entity), create: () => of(entity), update: () => of(entity), delete: () => of(undefined)
};

describe('app routes', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        provideStore({ [APP_CONTEXT_FEATURE_KEY]: appContextReducer, [ROUTER_FEATURE_KEY]: routerReducer }),
        provideRouterStore({ stateKey: ROUTER_FEATURE_KEY }),
        provideEffects(appRouterEffects),
        { provide: EntityService, useValue: fakeEntityService }
      ]
    });
  });

  it("redirects '' to the entity list", async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/', EntityListPage);
    expect(TestBed.inject(Router).url).toBe('/entities');
  });

  it('renders the form page at /entities/:id/edit (the edit and new routes share one form slice)', async () => {
    const harness = await RouterTestingHarness.create();
    expect(await harness.navigateByUrl('/entities/e1/edit', EntityFormPage)).toBeInstanceOf(EntityFormPage);
  });
});
```

## 2. Browser-mode page tests

Pages are rendered in **real Chromium** with a mocked store and asserted/driven through the `page` locators. This is
component-level — no backend; the full request→response path is the e2e suite. Co-located with the page as
`*.component.browser.spec.ts`.

### Dependencies

```sh
pnpm --filter web add -D vitest@4.1.12 @vitest/browser@4.1.12 @vitest/browser-playwright@4.1.12 \
  @analogjs/vitest-angular @oxc-project/runtime
pnpm --filter web exec playwright install chromium   # one-time browser download
```

`@analogjs/vite-plugin-angular` (already added for Storybook) compiles Angular; `@analogjs/vitest-angular` supplies the
zoneless `setupTestBed`; `@oxc-project/runtime` provides the decorator helper Analog emits in dev mode.

### `web/vitest.browser.config.mts`

```ts
import angular from '@analogjs/vite-plugin-angular';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [angular()],
  test: {
    include: ['src/app/**/*.browser.spec.ts'],
    setupFiles: ['src/testing/browser-setup.ts'],
    browser: {
      enabled: true,
      provider: playwright(),
      headless: true,
      instances: [{ browser: 'chromium' }]
    }
  }
});
```

### `web/src/testing/browser-setup.ts` and `render.ts`

```ts
// browser-setup.ts
import { setupTestBed } from '@analogjs/vitest-angular/setup-testbed';
import '../styles.css';

setupTestBed({ zoneless: true, browserMode: true });
```

```ts
// render.ts — mounts a component into the live document for the `page` locators
import { type EnvironmentProviders, type Provider, type Type } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';

export function render<T>(component: Type<T>, providers: (Provider | EnvironmentProviders)[] = []): ComponentFixture<T> {
  TestBed.configureTestingModule({ providers });
  const fixture = TestBed.createComponent(component);
  document.body.appendChild(fixture.nativeElement);
  fixture.autoDetectChanges();
  return fixture;
}
```

### Keeping them out of `ng test` and in a TS project

- `angular.json` test target: `"options": { "exclude": ["**/*.browser.spec.ts"] }` (the builder's default include is
  `**/*.spec.ts`, independent of `tsconfig.spec`).
- `tsconfig.spec.json` excludes `src/**/*.browser.spec.ts`; `tsconfig.app.json` excludes `src/**/*.spec.ts` and
  `src/testing/**`.
- `tsconfig.browser.json` (referenced from `tsconfig.json`) `include`s `src/**/*.browser.spec.ts` + `src/testing/**`,
  so ESLint's project service resolves them.

### Example — `pages/entity-detail-page.component.browser.spec.ts`

```ts
import { provideRouter } from '@angular/router';
import { provideMockStore } from '@ngrx/store/testing';
import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from '../../testing/render';
import { type Entity } from '../models/entity.model';
import { type EntityDetailPageStatus } from '../store/entity-detail-page/entity-detail-page.model';
import { selectEntity, selectError, selectStatus } from '../store/entity-detail-page/entity-detail-page.selectors';
import { EntityDetailPage } from './entity-detail-page.component';

const entity: Entity = { id: 'e1', name: 'Acme', description: 'An entity', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-02T00:00:00.000Z' };

function setup(status: EntityDetailPageStatus, value: Entity | null, error: string | null): void {
  render(EntityDetailPage, [
    provideRouter([]),
    provideMockStore({
      selectors: [
        { selector: selectStatus, value: status },
        { selector: selectEntity, value },
        { selector: selectError, value: error }
      ]
    })
  ]);
}

describe('EntityDetailPage (browser)', () => {
  it('renders the loaded entity with an edit link', async () => {
    setup('loaded', entity, null);
    await expect.element(page.getByRole('heading', { name: 'Acme' })).toBeVisible();
    await expect.element(page.getByRole('link', { name: 'Edit' })).toBeVisible();
  });

  it('shows the error message in the error state', async () => {
    setup('error', null, 'Entity not found');
    await expect.element(page.getByText('Entity not found')).toBeVisible();
  });
});
```

### Lifecycle dispatch, UI states and URL actions

Beyond rendering, the browser specs cover:

- **UI states** (list page): loading, filtered-empty vs. no-entities-yet, the error banner, and the `Previous`/`Next`
  disabled logic — one `renderList(state)` helper over `provideMockStore` selector overrides, asserted with
  `toBeDisabled()` / `toBeEnabled()`.
- **URL-building actions** (list page): changing the Sort / Per-page selects and clicking Next / Clear each dispatch the
  exact `AppRouterActions.navigate({ commands: [], queryParams: toParams(...) })` — the "URL as source of truth" contract.
- **Lifecycle** (all pages): `ngOnInit` dispatches `load(...)` and `ngOnDestroy` dispatches `leave()`.
- **Form fill-on-load**: a mock store returning a loaded entity populates the Name/Description controls (the component's
  `effect` → `form.setValue`).

Two setup rules make these work:

1. **Spy on `dispatch` _before_ `createComponent`** — the shared `render` helper injects the store only after creating
   the component, too late to observe `ngOnInit`. For lifecycle/action specs, inline the setup instead: configure →
   `TestBed.inject(MockStore)` → `vi.spyOn(store, 'dispatch')` → `createComponent` → append → `autoDetectChanges()`.
2. **Seed the router param** — `selectRouteParam('id')` returns a fresh selector each call, so it can't be overridden by
   reference. Seed it through `provideMockStore`'s `initialState`:

```ts
provideMockStore({
  selectors: [/* status/entity/error */],
  initialState: { appRouter: { state: { root: { params: { id: 'e1' }, firstChild: null } }, navigationId: 1 } }
});
// ...spy before createComponent:
const store = TestBed.inject(MockStore);
const dispatch = vi.spyOn(store, 'dispatch');
const fixture = TestBed.createComponent(EntityDetailPage);
document.body.appendChild(fixture.nativeElement);
fixture.autoDetectChanges();

expect(dispatch).toHaveBeenCalledWith(EntityDetailPageActions.load({ id: 'e1' }));
fixture.destroy();
expect(dispatch).toHaveBeenCalledWith(EntityDetailPageActions.leave());
```

For a URL-building action, `dispatch.mockClear()` after init (to drop the `load()`), drive the control, then assert the
`navigate` payload — e.g. `await page.getByLabelText('Sort').selectOptions('name:ASC')` →
`navigate({ commands: [], queryParams: { filter: null, sortField: 'name', sortDirection: 'ASC', page: null, pageSize: null } })`.

### Limitation: signal-input components can't be browser-tested

Analog's browser-mode compile emits **empty `inputs`/`outputs` metadata** on components that use signal `input()` /
`output()` (verified: a component's `ɵcmp.inputs` is `[]` under AOT). So you cannot bind a page template to a
signal-input child nor `setInput` one in browser mode — `NG0303` / `NG0315` / `NG0950`. Tried AOT, JIT, separate
projects/processes, and the `vitest-browser-angular` helper; none fix it. **Consequence:** the list page's browser
spec asserts rendering only, not the `ConfirmDialog` delete flow; `ConfirmDialog` itself is covered by **Storybook**
([references/web-storybook.md](web-storybook.md)) and the **e2e** delete flow. Keep `input()`/`output()` on components;
do not switch to `@Input()` just to browser-test them.

## 3. Full-stack e2e

Playwright Test drives real Chromium against the **running stack**: `ng serve` → the real API (node) → real Postgres.
Specs in `e2e/pages/`, shared API-seeding helper in `e2e/utils/`. **Requires Docker running and the root `.env`.**

### Dependencies

```sh
pnpm --filter web add -D @playwright/test
pnpm --filter web exec playwright install chromium   # shared with the browser tests
```

### `web/playwright.config.ts`

```ts
import { defineConfig, devices } from '@playwright/test';
import { resolve } from 'node:path';

const repoRoot = resolve(__dirname, '..'); // __dirname: Playwright loads the TS config as CommonJS

export default defineConfig({
  testDir: './e2e',
  workers: 1, // one shared database — run serially for determinism
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  reporter: 'list',
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
  use: { baseURL: 'http://localhost:4200', trace: 'on-first-retry' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    { command: 'pnpm --filter web start', url: 'http://localhost:4200', cwd: repoRoot, reuseExistingServer: !process.env['CI'], timeout: 120_000 },
    // GET / is DB-free, so the API is "ready" before Postgres is up (global-setup brings Postgres up).
    { command: 'pnpm --filter api dev', url: 'http://localhost:3000/', cwd: repoRoot, reuseExistingServer: !process.env['CI'], timeout: 60_000 }
  ]
});
```

### `web/e2e/global-setup.ts` and `global-teardown.ts`

```ts
// global-setup.ts — real Postgres, apply schema, start from an empty table
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

const repoRoot = resolve(__dirname, '../..');
const run = (cmd: string): void => execSync(cmd, { cwd: repoRoot, stdio: 'inherit' });

export default function globalSetup(): void {
  run('docker compose up -d --wait db');
  run('pnpm --filter api db:migrate');
  run('docker compose exec -T db psql -U postgres -d app -c "TRUNCATE TABLE entity RESTART IDENTITY CASCADE"');
}
```

```ts
// global-teardown.ts
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

const repoRoot = resolve(__dirname, '../..');

export default function globalTeardown(): void {
  execSync('docker compose down', { cwd: repoRoot, stdio: 'inherit' });
}
```

### `web/e2e/utils/api.ts`

```ts
import { type APIRequestContext, expect } from '@playwright/test';

export const API = 'http://localhost:3000';

export interface SeededEntity {
  id: string;
  name: string;
  description: string | null;
}

export async function createEntity(request: APIRequestContext, input: { name: string; description?: string | null }): Promise<SeededEntity> {
  const res = await request.post(`${API}/entities`, { data: input });
  expect(res.ok(), `seed failed (${res.status()})`).toBeTruthy();
  return (await res.json()) as SeededEntity;
}
```

`web/e2e/tsconfig.json` extends `../tsconfig.json` with `types: ["node"]` and `include: ["**/*.ts"]` so the specs and
helpers resolve for ESLint.

### Example — `e2e/pages/entity-detail-page.spec.ts`

Tests that need existing data seed it through the API `request` fixture, then drive the UI with `page`. CRUD flows
create uniquely-named entities (and the list page filters by that name) so parallel-free serial runs stay deterministic.

```ts
import { expect, test } from '@playwright/test';
import { createEntity } from '../utils/api';

test.describe('entity detail page', () => {
  test('renders an entity loaded from the API', async ({ page, request }) => {
    const name = `E2E Detail ${Date.now()}`;
    const created = await createEntity(request, { name, description: 'Detail description' });

    await page.goto(`/entities/${created.id}`);

    await expect(page.getByRole('heading', { name })).toBeVisible();
    await expect(page.getByText('Detail description')).toBeVisible();
  });

  test('shows an error for a non-existent entity', async ({ page }) => {
    await page.goto('/entities/00000000-0000-0000-0000-000000000000'); // valid uuid, 404s from the DAO
    await expect(page.getByText(/not found/i)).toBeVisible();
  });
});
```

The list page e2e also covers the delete flows that the browser spec can't (the `ConfirmDialog` is a signal-input child):
delete-via-dialog, cancel-keeps-the-row, and **step-back-on-empty-page** — seed two rows under one filter, land on
`?pageSize=1&page=2` (URL as source of truth), delete the only row, and assert the URL drops `page=2` as the page steps
back to page 1.

Add to `web/.gitignore`: `/test-results`, `/playwright-report`, `/blob-report`, `/playwright/.cache`, and
`.vitest-attachments` (browser-mode run artifacts).
