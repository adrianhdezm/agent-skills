# Entity CRUDL

One resource, `entity`, listed with filter, sort and pagination, shown, created, edited and deleted: the template every
later resource copies. REST API on Node and Hono API on Node ship its resource and API part; the Angular app ships its
web part against an API it does not own; the Angular full stack ships all of it, from the table to the pages, with an
end-to-end suite over the whole stack. Each part below names the docs it
applies; build it by applying them, and use this file for what they leave open: names, values, behaviours and tests.

## Demonstrates

| Part                            | Applies                                                                                                                                   |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| the whole resource, API side    | [Database](../architecture/database.md), [Data access](../architecture/data-access.md), [REST API](../architecture/rest-api.md) (serving) |
| the whole resource, web side    | [REST API](../architecture/rest-api.md) (consuming)                                                                                       |
| the table, schemas and DAO      | Drizzle (its reference code: `entity.schema.ts`, `schema.ts`, `entity.dao.ts`)                                                            |
| the API's shell and controllers | Express, Express + Drizzle; on Hono API on Node, Hono, Hono + Drizzle (see its variant)                                                   |
| the wire between web and API    | Angular + the API contract                                                                                                                |
| the shell, slices and pages     | Angular, NgRx (its reference code: the router, the list and form slices)                                                                  |
| the components                  | [UI components](../architecture/ui-components.md) (two tiers), Angular (signal components, Storybook)                                     |
| the tests                       | Vitest, and each technology's testing conventions                                                                                         |
| the end-to-end suite            | the Angular full stack's testing tiers                                                                                                    |
| the Fiori variant               | Angular + Fundamental NGX                                                                                                                 |

## The resource

| Field         | Type                     | Rules                    | Filter           | Sort |
| ------------- | ------------------------ | ------------------------ | ---------------- | ---- |
| `id`          | UUID, generated          |                          | id operators     |      |
| `name`        | text                     | required, 1 to 200 chars | string operators | yes  |
| `description` | text or `null`           | up to 2000 chars         | string operators |      |
| `createdAt`   | timestamp, set on insert |                          | date operators   | yes  |
| `updatedAt`   | timestamp                |                          | date operators   | yes  |

The default sort is `createdAt DESC`. An update needs at least one field besides `id`. On the API these are the Drizzle
reference code; the web mirrors them by hand in `models/entity.model.ts` (dates as ISO strings).

## API

The Angular full stack, REST API on Node and Hono API on Node. The routes and their answers are the blueprint's HTTP
contract.

| Piece       | What it is                                                                                                                                                                  |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| context     | `AppContext { db: DbClient; entityDao: EntityDao }`; `db` stays for the health probe                                                                                        |
| controllers | `home` (`getHome`: `{ service: 'api', status: 'running' }`), `health` (`getHealth`), `entity` (`listEntities`, `getEntity`, `createEntity`, `updateEntity`, `deleteEntity`) |
| mounts      | `GET /`, `GET /health`, `GET` and `POST /entities`, `GET`, `PATCH` and `DELETE /entities/:id`                                                                               |
| database    | `db/scripts/init.sql` creates `app`; the scaffold's `db:generate --name init` writes the first migration, committed, and `migrate.ts` applies it before the API serves      |

The tests are written from these tables; the utilities and the code under test are reference code. Three renders the
translator's tests meet: `PgDialect.sqlToQuery` returns `{ sql, params, typings }`, each nested `and` / `or` is
parenthesised on its own, and an empty `not` renders as `false`.

**Test utilities** (`tests/utils/`): `http-mocks.ts` (`createStubContext()` with a `vi.fn()` per DAO method and the db's
`execute`; `mockRequest`, `mockResponse` with chainable spies as plain properties, `mockNext`, `mockLog`, and an
`httpError(status)` matcher); `test-server.ts` (`serve(app)` on an ephemeral port → `{ baseUrl, close }`);
`pg-container.ts` (the Drizzle reference code); `entity-seed.ts` (`day(n)`, a fixed UTC day in 2026; `seedEntities(db,
rows)` inserting directly so tests control timestamps; `seedCanonical(db)`: `alpha` to `echo` on consecutive days,
`charlie` with a `null` description).

| Tier | Files                                                                   | Covers                                                                                                                                                             |
| ---- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| unit | `unit/helpers/dao.helper.test.ts`                                       | every operator and kind through the SQL `PgDialect` renders, escaped LIKE patterns, empty `in`, nested `and`/`or`/`not`, the sort tie-breaker, `toPaginatedResult` |
| unit | `unit/helpers/list-input.helper.test.ts`, `query-parser.helper.test.ts` | the builders' accepts and rejects against an ad-hoc config and their limits; first-value-wins, empty values dropped                                                |
| unit | `unit/db/schemas/entity.schema.test.ts`                                 | the entity's own wiring: its columns, date coercion, its sort allowlist                                                                                            |
| unit | `unit/controllers/*.test.ts`                                            | list decoding and every 400 (each asserting the DAO was not called), 404 mapping, 201/204, an unexpected error forwarded; health `ok` and 503 with `cause`         |
| unit | `unit/middlewares/error.middleware.test.ts`                             | exposed 4xx at `warn`, hidden 500 at `error`, an unexposed http error hidden, headers already sent                                                                 |
| DAO  | `db/entity.dao.test.ts`                                                 | every method's happy path and edges; `list` pagination, sort, each filter kind, combinations, hostile input as data                                                |
| API  | `api/entity.api.test.ts`                                                | a real query string from seeded rows with the right totals, the CRUD round trip, malformed JSON 400, over 100 kB 413, unmatched path 404                           |

## Web

Both Angular stacks. `<App name>` is the repo name in Title Case.

**Shell.** `App` renders `MainLayout`: a header bar with the app name (from `selectAppName`) over a `<main>` holding the
router outlet. `''` redirects to `entities`. The `appContext` slice holds `{ apiBaseUrl, appName }` from `environment`,
has no handlers and no spec, and is the only importer of `environment`.

**Model, service, helpers.**

| Piece                          | Contract                                                                                                                                                                                                                                                                                                              |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `EntityService`                | the only `HttpClient` user: `list`, `get`, `create` (POST), `update` (PATCH), `delete`, each an `Observable`                                                                                                                                                                                                          |
| `entity-list-params.helper.ts` | `DEFAULT_PAGE` 1, `DEFAULT_PAGE_SIZE` 20; `parseListInput` never throws (bad filter, unknown sort field or page below 1 fall back; no `sortField` means the default sort, `createdAt DESC`, and with a field any direction but `DESC` is `ASC`); `toParams` maps absent and default values to `null`; `sameListInput` |
| `entity-filter-form.helper.ts` | `FilterForm` (`name`, `description`, `createdFrom`, `createdBefore`) ⇄ `EntityFilterInput` (trimmed `contains`, `createdAt.ge` / `.lt`, a day as local midnight in ISO-8601); reads back only what the strip can express; `formatRange` → `0 of 0` or `first–last of total · page X of Y`                             |
| `http-error.helper.ts`         | `httpErrorMessage(err)`: the API's `message`, else the response's                                                                                                                                                                                                                                                     |

**Slices.** One per page, as the NgRx reference code has the list and form slices; the detail slice is the list's shape
with an `id` (the NgRx doc says how).

**Components**, store-free, each with a story and a browser spec:

| Component                            | Inputs → outputs                                                           | Behaviour                                                                                                                                                                             |
| ------------------------------------ | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `UiDialog` (`ui-dialog`)             | `title` (required), `description`, `dismissible` = true → `dismissed`      | a modal `role="dialog"` named by its title, described by its description; Escape dismisses unless not dismissible; a body and a `[uiDialogFooter]` slot                               |
| `UiSelect` (`ui-select`)             | `label`, `name`, `options` (`{ value, label }[]`), `value` → `valueChange` | its own label names a native select; the option matching `value` is selected                                                                                                          |
| `UiPagination` (`ui-pagination`)     | `page`, `pageCount` → `pageChange`                                         | a `nav` named Pagination; projected status text; _Previous_ / _Next_ disabled at the ends                                                                                             |
| `DeleteDialog` (`app-delete-dialog`) | `itemKind`, `itemName`, `busy` = false → `confirmed`, `cancelled`          | a `UiDialog` titled `Delete <itemKind>`, described `Delete “<itemName>”? This cannot be undone.`; _Cancel_ and a red _Delete_ (_Deleting…_ while busy); busy disables both and Escape |

Stories: `UI/Dialog` (`Default`, through a template filling the slots), `UI/Select` (`Default`), `UI/Pagination`
(`Middle`, `FirstPage`), `Components/DeleteDialog` (`Default`, `Busy`).

**Pages.** Each reads only its slice, loads from its watch and dispatches `Leave` on destroy (the NgRx page contract).

| Page   | Routes and state                                                 | Accessible names                                                                                                                                                                                                           |
| ------ | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| list   | `/entities`, `entity-list`                                       | heading _Entities_; link _New entity_; _Name contains_, _Description contains_, _Created on or after_, _Created before_, _Sort_, _Per page_; _Apply_, _Clear_, _Previous_, _Next_; _Delete_ per row, the row's name a link |
| detail | `/entities/:id`, `entity-detail`                                 | the entity's name as heading; _Edit_; _← Back to entities_                                                                                                                                                                 |
| form   | `/entities/new` `entity-new`, `/entities/:id/edit` `entity-edit` | heading _New entity_ / _Edit entity_; _Name_, _Description_; _Save_; _← Cancel_                                                                                                                                            |

- **List.** Every control (filter strip, sort, page size, pagination) navigates with the next list input in the URL and
  never fetches: the reducer copies the input and the watch loads it, so back undoes each change and a deep link
  restores it. Sort options, in order: _Newest first_ (`createdAt:DESC`, default), _Oldest first_, _Name A–Z_, _Name
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

Every input has a `name`; free-text inputs set `autocomplete="off"`.

**Tests.**

| Tier    | Files                                 | Covers                                                                                                                                                                                                                                |
| ------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| unit    | the service and each helper's spec    | each request's method, URL and body; the list params round trip and fallbacks; the filter form mapping                                                                                                                                |
| unit    | `app-router.serializer.spec.ts`       | the deepest route's state, merged params, `null` with no state                                                                                                                                                                        |
| unit    | each slice's reducer and effects spec | as the NgRx testing conventions say: own-state navigation, `Leave`, each status; `switchMap` cancelling, `concatMap` ordering, nothing after `Leave`, a write from another visit ignored, stepping back past the last page            |
| browser | each component's spec                 | the behaviour in the component table                                                                                                                                                                                                  |
| browser | each page's spec                      | the watch (first load, equal value ignored, new value reloads, `null` waits, `Leave` on destroy); each UI state; list: the delete flow and the exact `navigate` each control dispatches; form: fill on load, no save for a blank name |

No spec for the root component, the layout, the route table, the `appContext` slice or selectors that only pick a field.

## End to end

Full stack only. Playwright drives Chromium against a stack of its own, so the dev stack can keep running:

| Piece       | Value                                                                                                                               |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| web         | `ng serve -c e2e` on `:4300`, an `e2e` build configuration pointing `apiBaseUrl` at `http://localhost:3100`                         |
| API         | `pnpm --filter api dev` on `:3100`, with `PORT` and `DATABASE_URL` in its `env`, ready on `GET /`                                   |
| database    | `app_e2e` in the Compose Postgres: created if missing, migrated, `entity` truncated by the global setup                             |
| environment | `e2e/utils/env.ts` parses the root `.env` with `node:util`'s `parseEnv` and never loads it, so `PORT` does not leak into `ng serve` |
| teardown    | stops `db` only if the setup started it                                                                                             |
| seeding     | through the real API, with Playwright's `request` fixture                                                                           |
| run         | one worker (one database); `test:e2e` = `playwright test`; `e2e/tsconfig.json` is part of the web `typecheck`                       |

| Spec                         | Covers                                                                                                                                             |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `entity-list-page.spec.ts`   | the filter lands in the URL; a deep link to page 2; _Next_ then back; delete through the dialog; stepping back when a delete empties the last page |
| `entity-detail-page.spec.ts` | a seeded entity with its _Edit_ link; an unknown id shows the error                                                                                |
| `entity-form-page.spec.ts`   | create lands on the detail page; edit a seeded entity                                                                                              |

Each spec opens its page by URL and creates uniquely named rows, so runs stay deterministic.

## Variant: Hono

On Hono API on Node the resource, routes, answers and tiers are the same; the shell follows Hono and Hono + Drizzle:

- Handlers are `(c: Context<AppEnv>) => Promise<Response>` reading `c.var.context`, and errors are thrown
  `HTTPException`s that `app.onError` shapes; there is no `express.d.ts` and no `http-errors`.
- `http-mocks.ts` keeps only `createStubContext()`; handler unit tests call `createApp(stub.context).request(…)`, so
  they cover the route table too, and the error handler's test asserts an `HTTPException` shown at `warn`, anything
  else a 500 at `error`.
- `test-server.ts` serves the app with `@hono/node-server`'s `serve({ fetch: app.fetch, port: 0 })`.

## Variant: Fundamental NGX

When the project opts in, the registry's `button`, `dialog`, `select`, `pagination`, `input`, `form` and
`message-strip` replace the hand-written primitives, which go with their stories and specs. The rest holds, with these
differences:

- `DeleteDialog` composes `fd-dialog` (header, body, footer; `fdButton`, the confirm `variant="negative"`) with the same
  inputs, outputs and wording, and handles Escape itself.
- The list page uses two `fd-select`s labelled through `ariaLabelledBy` (page size binds numbers) and `fd-pagination`
  bound one way with `displayTotalItems` off, beside the page's own range text; page size stays a separate select.
- Buttons take `fdButton` (`emphasized` for the primary action, `transparent` for _Clear_ and row _Delete_), inputs
  `fdFormControl` with their own `fdFormLabel`; the banner is `fd-message-strip`; colours are Horizon tokens, the layout
  included.
- Specs: the three primitive specs go; the list spec drives `fd-select` as a combobox and clicks _Next page_ (seed more
  than one page, or the pagination renders no buttons); the dialog spec matches _Delete_ loosely; the e2e list spec
  clicks _Next page_. Storybook lists only the two `Components/DeleteDialog` stories.

## Done when

The stack's checks pass; `pnpm test:browser` passes; Storybook builds with its stories; the image serves `/entities`
through the SPA fallback; and, in the full stack, `pnpm test:integration` and `pnpm test:e2e` pass and leave the dev
database as it was.
