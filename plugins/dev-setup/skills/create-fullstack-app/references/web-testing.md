# Web tests

The web app has **three** test layers. The first two are one Vitest setup run through Analog's Angular builder; the
third is Playwright Test:

| layer                    | runner                                                    | what it covers                                                   | command             |
| ------------------------ | --------------------------------------------------------- | ---------------------------------------------------------------- | ------------------- |
| unit                     | `ng test` → Vitest project `unit` (jsdom)                 | services, every NgRx slice, helpers                              | `pnpm test`         |
| component / page browser | `ng test -c browser` → Vitest project `browser` (Chromium) | components and pages rendered in real Chromium with a mock store | `pnpm test:browser` |
| full-stack e2e           | **Playwright Test**                                       | the real app → real API → real Postgres, in its own database     | `pnpm test:e2e`     |

`ng test` is the required check (`test`); `test:browser` and `test:e2e` are additional scripts. Every spec imports
`{ describe, it, expect }` from `vitest`, follows Arrange / Act / Assert (with `// Arrange` / `// Act` / `// Assert`
comments once a case has more than one line per phase), and wraps its cases in one top-level `describe`
named for the file's module (`entity.service`, `entity-list-page.effects`, `delete-dialog.component`, …).

## Contents

- [Spec inventory](#spec-inventory)
- [1. Setup: Analog's Vitest builder](#1-setup-analogs-vitest-builder)
- [2. Unit tests](#2-unit-tests)
- [3. Browser-mode tests](#3-browser-mode-tests)
- [4. Full-stack e2e](#4-full-stack-e2e)

## Spec inventory

The scaffold ships exactly these specs, each covering the cases listed and no more: a spec or case not listed here
needs a bug only it would catch ([coding-conventions.md §7.5](coding-conventions.md#75-what-not-to-test)). The root
component, the layout, the route table (`app.routes.ts`), the `app-context` slice, `navigatedRoute`, `navigate$` and
the field-picking selectors have no spec: they hold no logic, and the specs that run through them prove them. The
route table in particular is proven by the e2e suite, whose page specs each open their page by its URL. Code blocks further down show the patterns;
the cases come from here. Names follow the `describe` rule above.

**Unit (`ng test`, `src/**/*.spec.ts`)**

| file | cases |
| --- | --- |
| `services/entity.service.spec.ts` | `list` sends the list input as the shared URL params; `get`, `create`, `update`, `delete` each send the right method, URL and body |
| `helpers/entity-list-params.helper.spec.ts` | the five cases in `web.md` §11 |
| `helpers/entity-filter-form.helper.spec.ts` | `toFilterInput`: empty form → `undefined`, trimmed `contains` filters, the date range as local midnight; `toFilterForm`: no filter → empty form, round trip, unsupported operators and invalid dates ignored; `formatRange`: `0 of 0`, the row range with total and page |
| `helpers/http-error.helper.spec.ts` | uses the API's message; falls back to the response's |
| `store/app-router/app-router.serializer.spec.ts` | the deepest route's `data.state`; params merged along the branch; the query params and URL; `state` is `null` when no route declares one |
| `store/<page>/<page>.reducer.spec.ts` (×3) | `routerNavigatedAction` into the page's own state writes its route state (list: the parsed input; detail: the id, and a new id drops the previous entity; form: `{ id: null }` on `entity-new`, `{ id }` on `entity-edit`, each with the navigation's `navigationId`), into another state leaves the slice unchanged; `Leave` resets; each request → its loading status; each success and failure; form: a save result with another `navigationId` (after `Leave`, or from an earlier visit) leaves the slice unchanged |
| `store/entity-list-page/entity-list-page.effects.spec.ts` | `fetchAfterDelete$` (fetches the slice's input; fetches nothing once the input is `null` after `Leave`, even if it was set before), `fetch$` (success carries the input it was made for; failure) and `delete$` success / failure, `stepBackPastLastPage$` (steps back with `replaceUrl`, from the result's input; stays on a page with rows; stays on an empty first page), and the operator details below, including `fetch$` emitting nothing for a response after `Leave` |
| `store/entity-detail-page/entity-detail-page.effects.spec.ts` | `load$` success and failure; a response after `Leave` emits nothing |
| `store/entity-form-page/entity-form-page.effects.spec.ts` | `load$` (loads an id, makes no request for a new form, failure; a new form cancels an edit form's request in flight; a response after `Leave` emits nothing), `create$` and `update$` success / failure carrying the `navigationId` current when the save started, saves run one after the other (`concatMap`), `navigateAfterSave$` (navigates for the current `navigationId`; not for another, nor after `Leave`) |

**Browser (`ng test -c browser`, `src/**/*.browser.spec.ts`)**

| file | cases |
| --- | --- |
| `components/ui/dialog.component.browser.spec.ts` | the full spec below: named by its title and described by its description; Escape emits `dismissed`, but not while `dismissible` is off |
| `components/ui/select.component.browser.spec.ts` | the full spec below: the label names the select and the option matching `value` is selected; picking an option emits its value |
| `components/ui/pagination.component.browser.spec.ts` | the full spec below: Previous / Next disabled at the ends and enabled in the middle; each emits the page next to the current one |
| `components/delete-dialog.component.browser.spec.ts` | the full spec below: Delete emits `confirmed`, Cancel `cancelled`; while busy both are disabled, the label is _Deleting…_ and Escape does nothing |
| `pages/entity-list-page.component.browser.spec.ts` | the watch (fetches the slice's input on init, again for a new input, not for an equal one, nothing while the input is `null`, `leave()` on destroy); the UI states (rows + range label, loading, no-entities-yet, filtered-empty, error banner); the delete flow (confirm dispatches `delete`, cancel dispatches nothing); the navigation actions built from the slice's input (sort, page size, Next, Apply, Clear) |
| `pages/entity-detail-page.component.browser.spec.ts` | loaded entity with an _Edit_ link, error banner, _Loading…_, the watch (`load({ id })` on init, again for a new id on the same component, `leave()` on destroy) |
| `pages/entity-form-page.component.browser.spec.ts` | the watch on `new` (`load({ id: null })`) and edit (`load({ id })`), `leave()` on destroy; fills the form on load; dispatches `create` / `update` with the form values; does not save an empty name; Save disabled with its label while loading or saving; error banner |

**e2e (`pnpm test:e2e`, `e2e/pages/*.spec.ts`)**

| file | cases |
| --- | --- |
| `entity-list-page.spec.ts` | filters by name through the strip, and the filter lands in the URL; a deep link to page 2 shows page 2; _Next_ then the browser's back shows the first page again; deletes through the dialog; steps back a page when a delete empties the last one |
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

  it('list sends the list input as the shared URL params', () => {
    service.list({ sort: { field: 'name', direction: 'DESC' }, page: 2, pageSize: 50 }).subscribe();
    const req = httpMock.expectOne((r) => r.url === `${API}/entities`);
    expect(req.request.params.get('sortField')).toBe('name');
    expect(req.request.params.get('page')).toBe('2');
    req.flush({ items: [], total: 0, page: 2, pageSize: 50, totalPages: 0 });
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

- **Reducer specs** are plain function calls: `reducer(state, action)` → expected state, no `TestBed`. A navigation
  is a `routerNavigatedAction` built by `navigated()` from `src/testing/navigated.ts`, so each navigation reads as
  one line: `reducer(initialState, navigated({ state: 'entity-detail', params: { id: 'e1' } }))`; pass a second
  argument for the navigation's id when a case needs two navigations told apart (the form's `navigationId`).
- **Selector specs** call `selector.projector(input)` directly, and exist only for a selector with logic (a derived
  value, a combination of slices). The scaffold's selectors all pick one field, so it ships no selector spec. URL
  parsing is the params helper's spec and the list reducer's, not the selectors'.
- **Store effects** that read the store (the list page's `fetchAfterDelete$`, the form's `create$` / `update$` /
  `navigateAfterSave$`) add a `provideMockStore` with the selector overridden (`selectListInput`,
  `selectNavigationId`). To show the value *after* `Leave` wins, override it with a value, then with `null`, and
  `refreshState()` before the action.

### `web/src/testing/navigated.ts`

Builds the `routerNavigatedAction` the router would dispatch after landing on a state, with the payload
`AppRouterSerializer` writes. Unit specs only; the browser specs mock the store and never see router actions.

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

`routerState as never` is the one cast: router-store types the payload with its default serializer's snapshot shape,
the same reason `navigatedRoute` exists.

### Effects — operator details (list page)

An excerpt: `entity`, `result` / `resultB`, `entityService` and the imports come from the rest of the file. The
single-action-in → single-action-out style above proves the mapping but **not** the RxJS operators that keep the
list correct. The list effects spec adds an `operator details` block that drives them with a
**`Subject`-backed `actions$`**, collecting every emission synchronously — no scheduler:

- Reassign the existing `let actions$` to a `new Subject<Action>()` and `.subscribe((a) => emitted.push(a))` the effect.
- Give the fake service `Subject` returns via `mockReturnValueOnce(first).mockReturnValueOnce(second)` and complete
  them in a controlled order: `switchMap` drops the first (its emission is ignored), `concatMap` only subscribes the
  second after the first completes (`toHaveBeenCalledTimes`).

The list's other operator, `distinctUntilChanged` on the list input, lives in the page's watch and is covered by the
page's browser spec ([The page watch](#the-page-watch-ui-states-and-navigation-actions)).

```ts
import { Subject } from 'rxjs';

describe('operator details', () => {
  const inputA: ListEntityInput = { filter: undefined, sort: undefined, page: 1, pageSize: 20 };
  const inputB: ListEntityInput = { filter: undefined, sort: undefined, page: 2, pageSize: 20 };

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

    expect(emitted).toEqual([EntityListPageActions.fetchSuccess({ input: inputB, items: resultB.items, total: resultB.total })]);
  });

  it('fetch$ drops a response that arrives after Leave', () => {
    const pending = new Subject<PaginatedResult<Entity>>();
    entityService.list.mockReturnValueOnce(pending);
    const actions = new Subject<Action>();
    actions$ = actions;
    const emitted: Action[] = [];
    const sub = TestBed.runInInjectionContext(() => fetch$()).subscribe((a) => emitted.push(a));

    actions.next(EntityListPageActions.fetch({ input: inputA }));
    actions.next(EntityListPageActions.leave()); // the page is gone: takeUntil ends the request
    pending.next(result); // ignored
    sub.unsubscribe();

    expect(emitted).toEqual([]);
    expect(pending.observed).toBe(false);
  });
});
```

The companion case, `delete$`'s `concatMap` serialization, follows the same technique, and so do the other "after
`Leave`" cases: the detail and form `load$`, and the form's new-form-cancels-edit (`load({ id: 'e1' })` then
`load({ id: null })` unsubscribes the pending `get`). `stepBackPastLastPage$` takes the plain style and needs no store:
emit one `fetchSuccess` and collect with `toArray()` — an empty page past the end (`input: { page: 3, pageSize: 1 }`,
`total: 2`) navigates to page 2 with `replaceUrl: true`; a page with rows, or an empty first page, emits nothing.

## 3. Browser-mode tests

Components and pages are rendered in **real Chromium** and asserted/driven through the `page` locators. This is
component-level — pages get a mock store, there is no backend; the full request→response path is the e2e suite.
Co-located with the file as `*.browser.spec.ts`: one per component (`components/ui/*.component.browser.spec.ts` and
`components/delete-dialog.component.browser.spec.ts`) and one `pages/<page>.component.browser.spec.ts` per page.

### `web/src/testing/render.ts`

`render()` mounts a **page** — a component without required inputs — and starts change detection at once. A
component with required `input.required()`s cannot go through it: the first change detection runs before any input is
set and throws `NG0950`. Component specs mount by hand instead (see the component specs below).

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
import { selectEntity, selectError, selectId, selectStatus } from '../store/entity-detail-page/entity-detail-page.selectors';
import { EntityDetailPage } from './entity-detail-page.component';

const entity: Entity = { id: 'e1', name: 'Acme', description: 'An entity', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-02T00:00:00.000Z' };

function setup(status: EntityDetailPageStatus, value: Entity | null, error: string | null): void {
  render(EntityDetailPage, [
    provideRouter([]),
    provideMockStore({
      selectors: [
        { selector: selectId, value: 'e1' },
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

### Components — `components/**/*.component.browser.spec.ts`

A store-free component is driven through its signal inputs and outputs, mounted in this order:
`TestBed.createComponent` → `fixture.componentRef.setInput(name, value)` for every required input → append to
`document.body` → `fixture.autoDetectChanges()`, then a `vi.fn()` subscribed to each output. A new component gets the
same kind of spec beside its story.

Each behaviour is tested in the tier that owns it. A primitive's spec covers the primitive's behaviour (labelling,
Escape, the disabled ends). An app component's spec covers only what it adds (its buttons, its busy state), and a page
spec does not repeat either.

#### `components/ui/dialog.component.browser.spec.ts`

```ts
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { page, userEvent } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { UiDialog } from './dialog.component';

function setup(dismissible = true): { fixture: ComponentFixture<UiDialog>; dismissed: ReturnType<typeof vi.fn> } {
  // Set the required inputs before the first change detection, which render() would run at once (NG0950).
  const fixture = TestBed.createComponent(UiDialog);
  fixture.componentRef.setInput('title', 'Rename item');
  fixture.componentRef.setInput('description', 'Pick a new name.');
  fixture.componentRef.setInput('dismissible', dismissible);
  document.body.appendChild(fixture.nativeElement as HTMLElement);
  fixture.autoDetectChanges();
  const dismissed = vi.fn();
  fixture.componentInstance.dismissed.subscribe(dismissed);
  return { fixture, dismissed };
}

describe('dialog.component', () => {
  it('renders a dialog named by its title and described by its description', async () => {
    // Arrange
    setup();

    // Assert
    const dialog = page.getByRole('dialog', { name: 'Rename item' });
    await expect.element(dialog).toBeVisible();
    await expect.element(dialog).toHaveAccessibleDescription('Pick a new name.');
  });

  it('emits dismissed on Escape', async () => {
    // Arrange
    const { dismissed } = setup();

    // Act
    await userEvent.keyboard('{Escape}');

    // Assert
    expect(dismissed).toHaveBeenCalledTimes(1);
  });

  it('ignores Escape while not dismissible', async () => {
    // Arrange
    const { dismissed } = setup(false);

    // Act
    await userEvent.keyboard('{Escape}');

    // Assert
    expect(dismissed).not.toHaveBeenCalled();
  });
});
```

#### `components/ui/select.component.browser.spec.ts`

```ts
import { TestBed } from '@angular/core/testing';
import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { UiSelect } from './select.component';

function setup(): { valueChange: ReturnType<typeof vi.fn> } {
  const fixture = TestBed.createComponent(UiSelect);
  fixture.componentRef.setInput('label', 'Fruit');
  fixture.componentRef.setInput('name', 'fruit');
  fixture.componentRef.setInput('options', [
    { value: 'apple', label: 'Apple' },
    { value: 'banana', label: 'Banana' }
  ]);
  fixture.componentRef.setInput('value', 'banana');
  document.body.appendChild(fixture.nativeElement as HTMLElement);
  fixture.autoDetectChanges();
  const valueChange = vi.fn();
  fixture.componentInstance.valueChange.subscribe(valueChange);
  return { valueChange };
}

describe('select.component', () => {
  it('is named by its label and shows the option matching its value', async () => {
    // Arrange
    setup();

    // Assert
    await expect.element(page.getByLabelText('Fruit')).toHaveValue('banana');
  });

  it('emits the value of the option picked', async () => {
    // Arrange
    const { valueChange } = setup();

    // Act
    await page.getByLabelText('Fruit').selectOptions('apple');

    // Assert
    expect(valueChange).toHaveBeenCalledWith('apple');
  });
});
```

#### `components/ui/pagination.component.browser.spec.ts`

```ts
import { TestBed } from '@angular/core/testing';
import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { UiPagination } from './pagination.component';

function setup(current: number, pageCount: number): { pageChange: ReturnType<typeof vi.fn> } {
  const fixture = TestBed.createComponent(UiPagination);
  fixture.componentRef.setInput('page', current);
  fixture.componentRef.setInput('pageCount', pageCount);
  document.body.appendChild(fixture.nativeElement as HTMLElement);
  fixture.autoDetectChanges();
  const pageChange = vi.fn();
  fixture.componentInstance.pageChange.subscribe(pageChange);
  return { pageChange };
}

describe('pagination.component', () => {
  it.each([
    { current: 1, pageCount: 0, previous: false, next: false },
    { current: 1, pageCount: 3, previous: false, next: true },
    { current: 2, pageCount: 3, previous: true, next: true },
    { current: 3, pageCount: 3, previous: true, next: false }
  ])('on page $current of $pageCount, Previous enabled: $previous, Next enabled: $next', async ({ current, pageCount, previous, next }) => {
    // Arrange
    setup(current, pageCount);

    // Assert
    const previousButton = page.getByRole('button', { name: 'Previous' });
    const nextButton = page.getByRole('button', { name: 'Next' });
    await (previous ? expect.element(previousButton).toBeEnabled() : expect.element(previousButton).toBeDisabled());
    await (next ? expect.element(nextButton).toBeEnabled() : expect.element(nextButton).toBeDisabled());
  });

  it.each([
    { button: 'Previous', expected: 1 },
    { button: 'Next', expected: 3 }
  ])('emits page $expected when $button is clicked on page 2', async ({ button, expected }) => {
    // Arrange
    const { pageChange } = setup(2, 3);

    // Act
    await page.getByRole('button', { name: button }).click();

    // Assert
    expect(pageChange).toHaveBeenCalledWith(expected);
  });
});
```

#### `components/delete-dialog.component.browser.spec.ts`

`UiDialog`'s spec owns the dialog's name, description and Escape. This spec covers what `DeleteDialog` adds.

```ts
import { TestBed } from '@angular/core/testing';
import { page, userEvent } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { DeleteDialog } from './delete-dialog.component';

function setup(busy = false): { confirmed: ReturnType<typeof vi.fn>; cancelled: ReturnType<typeof vi.fn> } {
  const fixture = TestBed.createComponent(DeleteDialog);
  fixture.componentRef.setInput('itemKind', 'entity');
  fixture.componentRef.setInput('itemName', 'Acme');
  fixture.componentRef.setInput('busy', busy);
  document.body.appendChild(fixture.nativeElement as HTMLElement);
  fixture.autoDetectChanges();
  const confirmed = vi.fn();
  const cancelled = vi.fn();
  fixture.componentInstance.confirmed.subscribe(confirmed);
  fixture.componentInstance.cancelled.subscribe(cancelled);
  return { confirmed, cancelled };
}

describe('delete-dialog.component', () => {
  it('emits confirmed once when Delete is clicked', async () => {
    // Arrange
    const { confirmed, cancelled } = setup();

    // Act
    await page.getByRole('dialog', { name: 'Delete entity' }).getByRole('button', { name: 'Delete' }).click();

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

  it('while busy, disables both buttons, shows the busy label and ignores Escape', async () => {
    // Arrange
    const { cancelled } = setup(true);

    // Act
    await userEvent.keyboard('{Escape}');

    // Assert
    await expect.element(page.getByRole('button', { name: 'Deleting…' })).toBeDisabled();
    await expect.element(page.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(cancelled).not.toHaveBeenCalled();
  });
});
```

### The page watch, UI states and navigation actions

Pages read only their own slice, so a page spec seeds everything through `provideMockStore` selector overrides,
including the route state the router would have written (`selectListInput`, `selectId`, `selectTarget`). Beyond
rendering, the page specs cover:

- **The watch** (all pages): the first route state dispatches the load action (`fetch({ input })`, `load({ id })`),
  an equal value dispatches nothing, a new value on the same component dispatches it again, `null` dispatches nothing,
  and `ngOnDestroy` dispatches `leave()` and ends the watch.
- **UI states** (list page): loading, filtered-empty vs. no-entities-yet and the error banner — one
  `renderList(state)` helper over `provideMockStore` selector overrides. Which pagination button is disabled is
  `UiPagination`'s spec, not the page's.
- **The delete flow** (list page): _Delete_ on a row opens the `DeleteDialog`; confirming dispatches
  `EntityListPageActions.delete({ id })`, cancelling closes the dialog and dispatches nothing.
- **Navigation actions** (list page): changing the Sort / Per-page selects and clicking Next / Clear each dispatch the
  exact `AppRouterActions.navigate({ commands: [], queryParams: toParams(...) })`, built from the slice's input. The
  page never fetches for them: the new input comes back through the reducer.
- **Form fill-on-load**: a mock store returning a loaded entity populates the Name/Description controls (the component's
  `effect` → `form.setValue`).

Two setup rules make these work:

1. **Spy on `dispatch` _before_ `createComponent`** — the shared `render` helper injects the store only after creating
   the component, too late to observe `ngOnInit`. For watch and action specs, inline the setup instead: configure →
   `TestBed.inject(MockStore)` → `vi.spyOn(store, 'dispatch')` → `createComponent` → append → `autoDetectChanges()`.
2. **Move the route state with `overrideSelector` + `refreshState()`**, as the reducer would after a navigation. An
   equal value must be a new object: the same reference is dropped by NgRx's own `select` before the page's
   `distinctUntilChanged` sees it, and the case would pass without the operator.

```ts
const input: ListEntityInput = { filter: undefined, sort: undefined, page: 2, pageSize: 20 };
TestBed.configureTestingModule({
  providers: [
    provideRouter([]),
    provideMockStore({ selectors: [{ selector: selectListInput, value: input } /* status, items, total, error */] })
  ]
});
// ...spy before createComponent:
const store = TestBed.inject(MockStore);
const dispatch = vi.spyOn(store, 'dispatch');
const fixture = TestBed.createComponent(EntityListPage);
document.body.appendChild(fixture.nativeElement);
fixture.autoDetectChanges();
expect(dispatch).toHaveBeenCalledWith(EntityListPageActions.fetch({ input }));

dispatch.mockClear();
store.overrideSelector(selectListInput, { ...input }); // equal -> dropped by distinctUntilChanged
store.refreshState();
expect(dispatch).not.toHaveBeenCalled();
store.overrideSelector(selectListInput, { ...input, page: 3 }); // the reused page gets a new input
store.refreshState();
expect(dispatch).toHaveBeenCalledWith(EntityListPageActions.fetch({ input: { ...input, page: 3 } }));

fixture.destroy();
expect(dispatch).toHaveBeenCalledWith(EntityListPageActions.leave());
```

For a navigation action, `dispatch.mockClear()` after init (to drop the `fetch()`), drive the control, then assert the
`navigate` payload — e.g. `await page.getByLabelText('Sort').selectOptions('name:ASC')` →
`navigate({ commands: [], queryParams: { filter: null, sortField: 'name', sortDirection: 'ASC', page: null, pageSize: null } })`
(a sort change goes back to page 1, the default, so `page` is `null`).

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

export async function createEntity(
  request: APIRequestContext,
  input: { name: string; description?: string | null }
): Promise<SeededEntity> {
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

The list page e2e covers the router → store path and the delete flows against the real API:

- **deep link** — seed three rows under one filter, `goto` `?pageSize=1&page=2` with that filter, and see the second
  row and _page 2 of 3_;
- **back after Next** — on page 1, click _Next_, see page 2, then `page.goBack()` and see page 1 again, with no _Next_
  click repeated: the browser's own navigation reaches the slice through the router;
- delete-via-dialog and **step-back-on-empty-page** — seed two rows under one filter, land on
  `?pageSize=1&page=2` by deep link, delete the only row, and assert the URL drops `page=2` as the page steps back to
  page 1.

Add to `web/.gitignore`: `/test-results`, `/playwright-report`, `/blob-report`, `/playwright/.cache` (Playwright
output), and `/.vitest` (Vitest 5's attachments and browser-mode failure screenshots, under `.vitest/attachments/`).
