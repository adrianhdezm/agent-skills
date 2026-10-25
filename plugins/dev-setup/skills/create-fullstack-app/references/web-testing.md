# Web tests

The web app has **three** test layers. The first two are one Vitest setup run through Analog's Angular builder; the
third is Playwright Test:

| layer                    | runner                                                    | what it covers                                                   | command             |
| ------------------------ | --------------------------------------------------------- | ---------------------------------------------------------------- | ------------------- |
| unit                     | `ng test` → Vitest project `unit` (jsdom)                 | services, every NgRx slice, helpers, routes, the app shell       | `pnpm test`         |
| component / page browser | `ng test -c browser` → Vitest project `browser` (Chromium) | components and pages rendered in real Chromium with a mock store | `pnpm test:browser` |
| full-stack e2e           | **Playwright Test**                                       | the real app → real API → real Postgres, in its own database     | `pnpm test:e2e`     |

`ng test` is the required check (`test`); `test:browser` and `test:e2e` are additional scripts. Every spec imports
`{ describe, it, expect }` from `vitest`, follows Arrange / Act / Assert (with `// Arrange` / `// Act` / `// Assert`
comments once a case has more than one line per phase), and wraps its cases in one top-level `describe`
named for the file's module (`entity.service`, `entity-list-page.effects`, `confirm-dialog.component`, …).

## Contents

- [Spec inventory](#spec-inventory)
- [1. Setup: Analog's Vitest builder](#1-setup-analogs-vitest-builder)
- [2. Unit tests](#2-unit-tests)
- [3. Browser-mode tests](#3-browser-mode-tests)
- [4. Full-stack e2e](#4-full-stack-e2e)

## Spec inventory

The scaffold ships exactly these specs; each must cover at least the cases listed. Code blocks further down show the
patterns; the cases come from here. Names follow the `describe` rule above.

**Unit (`ng test`, `src/**/*.spec.ts`)**

| file | cases |
| --- | --- |
| `app.component.spec.ts` | renders the main layout with its router outlet |
| `app.routes.spec.ts` | `''` redirects to `/entities`; `/entities`, `/entities/:id`, `/entities/new` and `/entities/:id/edit` render their pages |
| `layouts/main-layout.component.spec.ts` | shows the app name from the store and a router outlet |
| `services/entity.service.spec.ts` | `list` drops default `page` / `pageSize`; `list` sends the list input as the shared URL params; `get`, `create`, `update`, `delete` each send the right method, URL and body |
| `helpers/entity-list-params.helper.spec.ts` | the four cases in `web.md` §11 |
| `helpers/entity-filter-form.helper.spec.ts` | `toFilterInput`: empty form → `undefined`, trimmed `contains` filters, the date range as local midnight; `toFilterForm`: no filter → empty form, round trip, unsupported operators and invalid dates ignored; `formatRange`: `0 of 0`, the row range with total and page |
| `helpers/http-error.helper.spec.ts` | uses the API's message; falls back to the response's |
| `store/app-context/app-context.reducer.spec.ts` | seeds the initial state from `environment`; an unknown action returns it unchanged |
| `store/app-context/app-context.selectors.spec.ts` | picks `apiBaseUrl` and `appName` |
| `store/app-router/app-router.effects.spec.ts` | `navigate$` calls the `Router` with the commands and query params |
| `store/<page>/<page>.reducer.spec.ts` (×3) | every action → its state: `Load` / `Leave` reset, each request → its loading status, each success and failure |
| `store/<page>/<page>.selectors.spec.ts` (×3) | the slice fields; the list's `selectListInput` (parse, defaults, `ASC` default direction) and `selectListInputOnListPage` (`null` off the list URL) |
| `store/entity-list-page/entity-list-page.effects.spec.ts` | `fetchOnListInputChange$`, `fetchAfterDelete$`, `fetch$` and `delete$` success / failure, `stepBackPastLastPage$` (steps back; stays on a page with rows; stays on an empty first page), and the operator details below |
| `store/entity-detail-page/entity-detail-page.effects.spec.ts` | `load$` success and failure |
| `store/entity-form-page/entity-form-page.effects.spec.ts` | `load$` (loads an id, skips a new form, failure), `create$` and `update$` success / failure, saves run one after the other (`concatMap`), `navigateAfterSave$` |

**Browser (`ng test -c browser`, `src/**/*.browser.spec.ts`)**

| file | cases |
| --- | --- |
| `components/confirm-dialog.component.browser.spec.ts` | the full spec below |
| `pages/entity-list-page.component.browser.spec.ts` | lifecycle; the UI states (rows + range label, loading, no-entities-yet, filtered-empty, error banner, Previous / Next disabled at the ends and enabled in the middle); the delete flow (confirm dispatches `delete`, cancel dispatches nothing); the URL-building actions (sort, page size, Next, Apply, Clear) |
| `pages/entity-detail-page.component.browser.spec.ts` | loaded entity with an _Edit_ link, error banner, _Loading…_, lifecycle (`load({ id })` / `leave()`) |
| `pages/entity-form-page.component.browser.spec.ts` | lifecycle on `new` (`load({ id: null })`) and edit (`load({ id })`); fills the form on load; dispatches `create` / `update` with the form values; does not save an empty name; Save disabled with its label while loading or saving; error banner |

**e2e (`pnpm test:e2e`, `e2e/pages/*.spec.ts`)**

| file | cases |
| --- | --- |
| `entity-list-page.spec.ts` | lists entities seeded through the API; filters by name through the strip, and the filter lands in the URL; deletes through the dialog; cancel keeps the row; steps back a page when a delete empties the last one |
| `entity-detail-page.spec.ts` | the spec below |
| `entity-form-page.spec.ts` | creates an entity and lands on its detail page; edits a seeded entity and sees the change |

## 1. Setup: Analog's Vitest builder

The Angular CLI's `@angular/build:unit-test` builder is replaced by `@analogjs/vitest-angular:test`, which runs Vitest
with a project-level config and compiles Angular through `@analogjs/vite-plugin-angular` — the same plugin Storybook
uses. The app build stays on `@angular/build`.

### Dependencies

Run in SKILL step 5, after Storybook's install:

```sh
pnpm --filter web add -D @analogjs/vitest-angular@2 @vitest/browser@5 @vitest/browser-playwright@5
```

The Chromium download both browser layers use runs once, after `@playwright/test` is added
([§4](#dependencies-and-script)).

`@analogjs/vite-plugin-angular` comes with Storybook's dependencies; `vitest` itself is in the catalog (shared with the
API, see `monorepo-root.md`); the CLI's `jsdom` stays as generated. `@vitest/browser` and `@vitest/browser-playwright`
must share `vitest`'s major.

### `web/angular.json` test target

Replace the generated `test` target. `project` is passed through to Vitest and picks the project to run; the `browser`
configuration switches it. The builder runs once by default (`--watch` turns watch mode on).

```jsonc
"test": {
  "builder": "@analogjs/vitest-angular:test",
  "options": { "project": ["unit"] },
  "configurations": { "browser": { "project": ["browser"] } }
}
```

The scripts are `test` = `ng test` (set in `web.md`) and `test:browser`:

```sh
pnpm --filter web pkg set "scripts['test:browser']=ng test -c browser"
```

### `web/vitest.config.mts`

One config with two projects, like the API's `vitest.config.ts`. It is named `vitest.config.*`, not `vite.config.*`, so
Storybook's Vite builder (which reads `vite.config.*`) does not pick up the test settings.

```ts
import angular from '@analogjs/vite-plugin-angular';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

// One config, two projects: `ng test` runs `unit` (jsdom), `ng test -c browser` runs `browser` (real Chromium).
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
          browser: {
            enabled: true,
            provider: playwright(),
            headless: true,
            instances: [{ browser: 'chromium' }]
          }
        }
      }
    ]
  }
});
```

Both `include` globs start at `src/`, so the Playwright specs under `e2e/` never reach Vitest.

### `web/src/test-setup.ts`

```ts
import '@angular/compiler';
import { setupTestBed } from '@analogjs/vitest-angular/setup-testbed';

setupTestBed();
```

### `web/src/testing/browser-setup.ts`

The same, plus the global stylesheet so Tailwind utilities apply in Chromium:

```ts
import '@angular/compiler';
import { setupTestBed } from '@analogjs/vitest-angular/setup-testbed';
import '../styles.css';

setupTestBed();
```

`setupTestBed()` is zoneless by default, like the app.

### tsconfigs

Under Vitest, Analog compiles **only the files in `tsconfig.spec.json`'s program**; any other file is handed to Vite's
plain TypeScript transform, which skips the Angular compiler and loses signal `input()` / `output()` metadata. So
`tsconfig.spec.json` holds every spec, unit and browser alike, plus both setup files:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "types": ["vitest/globals", "vite/client"]
  },
  "include": ["src/**/*.spec.ts", "src/test-setup.ts", "src/testing/**/*.ts", "src/**/*.d.ts"]
}
```

`vite/client` declares the `*.css` module that `browser-setup.ts` imports; TypeScript 6 rejects an undeclared
side-effect import. `tsconfig.app.json` excludes the same files: `"exclude": ["src/**/*.spec.ts", "src/test-setup.ts",
"src/testing/**/*.ts"]`. There is no separate tsconfig for the browser specs, and no `exclude` on the test target.

## 2. Unit tests

Specs sit beside the file they cover as `*.spec.ts` and run in jsdom. Which specs ship, and the cases each covers, is
the [spec inventory](#spec-inventory); this section shows the patterns they use.

A new resource copies the service + slice specs; a new helper gets a spec beside it with a happy case and an edge case.

### Service — `services/entity.service.spec.ts`

```ts
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideMockStore } from '@ngrx/store/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
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
- **Store effects** that read the store (the list page's `fetchOnListInputChange$` / `fetchAfterDelete$` /
  `stepBackPastLastPage$`) add a `provideMockStore` with the relevant selectors overridden.

### Effects — operator details (list page)

An excerpt: `entity`, `result` / `resultB`, `entityService` and the imports come from the rest of the file. The
single-action-in → single-action-out style above proves the mapping but **not** the RxJS operators that make the
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
same two techniques. `stepBackPastLastPage$` takes the plain style: override `selectListInput`, emit one
`fetchSuccess`, and collect with `toArray()` — an empty page past the end (`{ page: 3, pageSize: 1 }`, `total: 2`)
navigates to page 2; a page with rows, or an empty first page, emits nothing.

### Routing — `app.routes.spec.ts`

`RouterTestingHarness` works in the zoneless jsdom environment with no extra change-detection provider. Provide the
real `routes`, a root store (`appContext` + `appRouter` reducers) with `provideRouterStore`, the app-router effects,
and a **fake `EntityService`** (every method returns `of(...)`) so the per-route effects that fire on page load never
touch HTTP. `navigateByUrl(url, Component)` asserts the activated component's type; read `Router.url` to assert the
redirect. The block is an excerpt: its imports and the `entity` fixture are the same as in the other specs, and the
full spec covers every route listed in the [spec inventory](#spec-inventory).

```ts
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

const fakeEntityService = {
  list: () => of({ items: [], total: 0, page: 1, pageSize: 20, totalPages: 0 }),
  get: () => of(entity), create: () => of(entity), update: () => of(entity), delete: () => of(undefined)
};

describe('app.routes', () => {
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

## 3. Browser-mode tests

Components and pages are rendered in **real Chromium** and asserted/driven through the `page` locators. This is
component-level — pages get a mock store, there is no backend; the full request→response path is the e2e suite.
Co-located with the file as `*.browser.spec.ts`: `components/confirm-dialog.component.browser.spec.ts` and one
`pages/<page>.component.browser.spec.ts` per page.

### `web/src/testing/render.ts`

`render()` mounts a **page** — a component without required inputs — and starts change detection at once. A
component with required `input.required()`s cannot go through it: the first change detection runs before any input is
set and throws `NG0950`. Component specs mount by hand instead (see the `ConfirmDialog` spec below).

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

describe('entity-detail-page.component', () => {
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

### Components — `components/confirm-dialog.component.browser.spec.ts`

A store-free component is driven through its signal inputs and outputs, mounted in this order:
`TestBed.createComponent` → `fixture.componentRef.setInput(name, value)` for every required input → append to
`document.body` → `fixture.autoDetectChanges()`, then a `vi.fn()` subscribed to each output. A new component gets the
same kind of spec beside its story.

```ts
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmDialog } from './confirm-dialog.component';

function setup(inputs: Partial<Record<'title' | 'message' | 'busy', unknown>> = {}): {
  fixture: ComponentFixture<ConfirmDialog>;
  confirmed: ReturnType<typeof vi.fn>;
  cancelled: ReturnType<typeof vi.fn>;
} {
  // Set the required inputs before the first change detection, which render() would run at once (NG0950).
  const fixture = TestBed.createComponent(ConfirmDialog);
  fixture.componentRef.setInput('title', 'Delete entity');
  fixture.componentRef.setInput('message', 'Delete “Acme”? This cannot be undone.');
  for (const [name, value] of Object.entries(inputs)) {
    fixture.componentRef.setInput(name, value);
  }
  document.body.appendChild(fixture.nativeElement as HTMLElement);
  fixture.autoDetectChanges();
  const confirmed = vi.fn();
  const cancelled = vi.fn();
  fixture.componentInstance.confirmed.subscribe(confirmed);
  fixture.componentInstance.cancelled.subscribe(cancelled);
  return { fixture, confirmed, cancelled };
}

describe('confirm-dialog.component', () => {
  it('renders a dialog named by its title, with the message', async () => {
    // Arrange
    setup();

    // Assert
    await expect.element(page.getByRole('dialog', { name: 'Delete entity' })).toBeVisible();
    await expect.element(page.getByText('Delete “Acme”? This cannot be undone.')).toBeVisible();
  });

  it('emits confirmed once when Delete is clicked', async () => {
    // Arrange
    const { confirmed, cancelled } = setup();

    // Act
    await page.getByRole('button', { name: 'Delete' }).click();

    // Assert
    expect(confirmed).toHaveBeenCalledTimes(1);
    expect(cancelled).not.toHaveBeenCalled();
  });

  it('emits cancelled once when Cancel is clicked', async () => {
    // Arrange
    const { confirmed, cancelled } = setup();

    // Act
    await page.getByRole('button', { name: 'Cancel' }).click();

    // Assert
    expect(cancelled).toHaveBeenCalledTimes(1);
    expect(confirmed).not.toHaveBeenCalled();
  });

  it('disables both buttons and shows the busy label while busy', async () => {
    // Arrange
    setup({ busy: true });

    // Assert
    await expect.element(page.getByRole('button', { name: 'Deleting…' })).toBeDisabled();
    await expect.element(page.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  });
});
```

### Lifecycle dispatch, UI states and URL actions

Beyond rendering, the page specs cover:

- **UI states** (list page): loading, filtered-empty vs. no-entities-yet, the error banner, and the `Previous`/`Next`
  disabled logic — one `renderList(state)` helper over `provideMockStore` selector overrides, asserted with
  `toBeDisabled()` / `toBeEnabled()`.
- **The delete flow** (list page): _Delete_ on a row opens the `ConfirmDialog`; confirming dispatches
  `EntityListPageActions.delete({ id })`, cancelling closes the dialog and dispatches nothing.
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

## 4. Full-stack e2e

Playwright Test drives real Chromium against a **running stack of its own**: `ng serve` on `:4300` → the real API
(node) on `:3100` → real Postgres, in a separate `app_e2e` database. Nothing it does reaches the dev stack: the `app`
database, `:3000` and `:4200` (local or Compose) stay untouched and can keep running. Specs in `e2e/pages/`, helpers in
`e2e/utils/`. **Requires Docker running and the root `.env`.**

### Dependencies and script

In SKILL step 5, after the §1 install:

```sh
pnpm --filter web add -D @playwright/test@1
pnpm --filter web exec playwright install chromium   # one-time; shared with the browser tests
```

The script is set with the other files, in step 4:

```sh
pnpm --filter web pkg set "scripts['test:e2e']=playwright test"
```

### `web/src/environments/environment.e2e.ts` and the `e2e` configuration

The e2e web server needs the e2e API's URL, so it gets its own environment file:

```ts
// The Playwright e2e run: its own API on :3100 (see e2e/utils/env.ts), so the dev API on :3000 is untouched.
export const environment = {
  production: false,
  appName: '<App name>',
  apiBaseUrl: 'http://localhost:3100'
};
```

In `web/angular.json`, `build.configurations.e2e` mirrors `development` (`optimization: false`,
`extractLicenses: false`, `sourceMap: true`) with `fileReplacements` swapping `src/environments/environment.ts` for
`src/environments/environment.e2e.ts`, and `serve.configurations.e2e` is `{ "buildTarget": "web:build:e2e" }`.

### `web/e2e/utils/env.ts`

The ports and the database, in one place for the config and the global setup. The `.env` is **parsed, not loaded**:
loading it would put its `PORT=3000` into the environment the servers inherit, and `ng serve` honours `PORT` over
`--port`.

```ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';

// The e2e run owns its own database and ports, so it never touches the dev stack (app DB, :3000, :4200).
export const repoRoot = resolve(__dirname, '../../..');
export const E2E_DB = 'app_e2e';
export const E2E_API_PORT = 3100;
export const E2E_WEB_PORT = 4300;

/** The root .env's DATABASE_URL, pointed at the e2e database. Parsed, not loaded: its PORT must not reach the servers. */
export function e2eDatabaseUrl(): string {
  const env = parseEnv(readFileSync(resolve(repoRoot, '.env'), 'utf8'));
  const url = new URL(env['DATABASE_URL'] ?? '');
  url.pathname = `/${E2E_DB}`;
  return url.toString();
}
```

### `web/playwright.config.ts`

```ts
import { defineConfig, devices } from '@playwright/test';
import { E2E_API_PORT, E2E_WEB_PORT, e2eDatabaseUrl, repoRoot } from './e2e/utils/env';

export default defineConfig({
  testDir: './e2e',
  workers: 1, // one shared database — run serially for determinism
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  reporter: 'list',
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
  use: { baseURL: `http://localhost:${E2E_WEB_PORT}`, trace: 'on-first-retry' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: `pnpm --filter web exec ng serve -c e2e --port ${E2E_WEB_PORT}`,
      url: `http://localhost:${E2E_WEB_PORT}`,
      cwd: repoRoot,
      reuseExistingServer: !process.env['CI'],
      timeout: 120_000
    },
    // GET / is DB-free, so the API is "ready" before Postgres is up (global-setup brings Postgres up).
    {
      command: 'pnpm --filter api dev',
      url: `http://localhost:${E2E_API_PORT}/`,
      cwd: repoRoot,
      env: { PORT: String(E2E_API_PORT), DATABASE_URL: e2eDatabaseUrl() },
      reuseExistingServer: !process.env['CI'],
      timeout: 60_000
    }
  ]
});
```

The API's `dev` script loads `../.env` with `--env-file`, which never overrides a variable already set, so the
`PORT` and `DATABASE_URL` passed here win.

### `web/e2e/global-setup.ts`

```ts
import { execSync } from 'node:child_process';
import { E2E_DB, e2eDatabaseUrl, repoRoot } from './utils/env';

const run = (cmd: string, env: NodeJS.ProcessEnv = process.env): string =>
  execSync(cmd, { cwd: repoRoot, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
const psql = (db: string, query: string): string => run(`docker compose exec -T db psql -U postgres -d ${db} -tAc "${query}"`);

// Real Postgres in its own database: create it once, apply the schema, start from an empty table.
export default function globalSetup(): void {
  process.env['E2E_STARTED_DB'] = run('docker compose ps --status running --quiet db').trim() ? '' : '1';
  run('docker compose up -d --wait db');
  if (psql('postgres', `SELECT 1 FROM pg_database WHERE datname = '${E2E_DB}'`).trim() !== '1') {
    psql('postgres', `CREATE DATABASE ${E2E_DB}`);
  }
  run('pnpm --filter api db:migrate', { ...process.env, DATABASE_URL: e2eDatabaseUrl() });
  psql(E2E_DB, 'TRUNCATE TABLE entity RESTART IDENTITY CASCADE');
}
```

`db:migrate` needs `api/db/migrations/`, so the e2e suite runs after the first `db:generate`.

### `web/e2e/global-teardown.ts`

```ts
import { execSync } from 'node:child_process';
import { repoRoot } from './utils/env';

// Stop Postgres only if global-setup started it; a db the developer had running stays up.
export default function globalTeardown(): void {
  if (process.env['E2E_STARTED_DB']) {
    execSync('docker compose stop db', { cwd: repoRoot, stdio: 'inherit' });
  }
}
```

### `web/e2e/utils/api.ts`

```ts
import { type APIRequestContext, expect } from '@playwright/test';
import { E2E_API_PORT } from './env';

export const API = `http://localhost:${E2E_API_PORT}`;

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

### `web/e2e/tsconfig.json`

Extends `../tsconfig.json` with `types: ["node"]` and `include: ["**/*.ts", "../playwright.config.ts"]`, so the specs,
the helpers and the Playwright config are type-checked by the web `typecheck` script and resolve for ESLint.

### Example — `e2e/pages/entity-detail-page.spec.ts`

Tests that need existing data seed it through the API `request` fixture, then drive the UI with `page`. CRUD flows
create uniquely-named entities (and the list page filters by that name) so serial runs stay deterministic.

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

The list page e2e covers the delete flows against the real API: delete-via-dialog, cancel-keeps-the-row, and
**step-back-on-empty-page** — seed two rows under one filter, land on `?pageSize=1&page=2` (URL as source of truth),
delete the only row, and assert the URL drops `page=2` as the page steps back to page 1.

Add to `web/.gitignore`: `/test-results`, `/playwright-report`, `/blob-report`, `/playwright/.cache` (Playwright
output), and `/.vitest` (Vitest 5's attachments and browser-mode failure screenshots, under `.vitest/attachments/`).
