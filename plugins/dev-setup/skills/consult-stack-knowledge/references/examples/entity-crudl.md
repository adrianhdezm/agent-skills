---
kind: example
needs: [[express, drizzle], [hono, node, drizzle], [angular]]
unless: [react-router]
---
# Entity CRUDL

One resource, `entity`, listed with filter, sort and pagination, shown, created, edited and deleted: the template every
later resource copies. REST API on Node and Hono API on Node ship its resource and API part (a React Router app on Node,
which owns its data through React Router + Drizzle, does not use it); the Angular app ships its web part against an API
it does not own; the Angular full stack ships all of it, from the table to the pages, with an end-to-end suite over the
whole stack. Each part below names the docs it applies; build it by applying them, and use this file for what they
leave open: names, values, behaviours and tests.

## Demonstrates

| Part                                           | Applies                                                                                                                                     |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| the whole resource, API side                   | [Database](../architecture/database.md), [Data access](../architecture/data-access.md), [REST API](../architecture/rest-api.md) (serving)   |
| the whole resource, web side                   | [REST API](../architecture/rest-api.md) (consuming)                                                                                         |
| the table, schemas and DAO                     | Drizzle (its reference code: `schema.ts`), Drizzle + Postgres (its reference code: `entity.schema.ts`, `entity.dao.ts`)                     |
| the API's shell, controllers and error handler | Express, Express + Drizzle, Express + Pino; on Hono API on Node, Hono, Hono + Drizzle, Hono + Pino (see its variant)                        |
| the wire between web and API                   | Angular + the API contract                                                                                                                  |
| the shell, slices and pages                    | Angular, NgRx (its reference code: the router, the list, form and detail slices)                                                            |
| the components                                 | [UI components](../architecture/ui-components.md) (two tiers), Angular (signal components), Storybook and Angular + Storybook (the stories) |
| the tests                                      | Vitest, Angular + Vitest (the `unit` and `browser` projects), and each technology's testing conventions                                     |
| the end-to-end suite                           | Playwright (no doc of its own; the suite's wiring is the stack's)                                                                           |
| the Fiori variant                              | Angular + Fundamental NGX                                                                                                                   |

## The resource

| Field         | Type                     | Rules                    | Filter           | Sort |
| ------------- | ------------------------ | ------------------------ | ---------------- | ---- |
| `id`          | UUID, generated          |                          | id operators     |      |
| `name`        | text                     | required, 1 to 200 chars | string operators | yes  |
| `description` | text or `null`           | up to 2000 chars         | string operators |      |
| `createdAt`   | timestamp, set on insert |                          | date operators   | yes  |
| `updatedAt`   | timestamp                |                          | date operators   | yes  |

The default sort is `createdAt DESC`. An update needs at least one field besides `id`. On the API these are Drizzle +
Postgres's reference code; the web mirrors them by hand in `models/entity.model.ts` (dates as ISO strings).

## Behaviour

### API

The Angular full stack, REST API on Node and Hono API on Node.

| Piece       | What it is                                                                                                                                                                  |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| context     | `AppContext { db: DbClient; entityDao: EntityDao }`                                                                                                                         |
| controllers | `home` (`getHome`: `{ service: 'api', status: 'running' }`), `health` (`getHealth`), `entity` (`listEntities`, `getEntity`, `createEntity`, `updateEntity`, `deleteEntity`) |
| mounts      | `GET /`, `GET /health`, `GET` and `POST /entities`, `GET`, `PATCH` and `DELETE /entities/:id`                                                                               |
| database    | the `entity` table arrives in the scaffold's `init` migration                                                                                                               |

The routes, their answers and their errors:

| Route                  | Success                                                | Errors                                                                      |
| ---------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------- |
| `GET /`                | 200 `{ service, status }`                              | —                                                                           |
| `GET /health`          | 200 `{ status: 'ok', db: 'up', latencyMs, timestamp }` | 503 `Database connection failed`                                            |
| `GET /entities`        | 200 `PaginatedResult<Entity>`                          | 400 `Unknown query params: …`, `filter must be valid JSON`, `Invalid query` |
| `POST /entities`       | 201 the created row                                    | 400 `Invalid body`; 400 malformed JSON, 413 over 100 kB                     |
| `GET /entities/:id`    | 200 the row                                            | 400 `Invalid id`; 404 `Entity not found: <id>`                              |
| `PATCH /entities/:id`  | 200 the updated row                                    | 400 `Invalid id` / `Invalid body` (including no updatable field); 404       |
| `DELETE /entities/:id` | 204, no body                                           | 400 `Invalid id`; 404                                                       |
| anything else          | —                                                      | 404 `Not Found: <METHOD> <path>`                                            |

### Web

Both Angular stacks.

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

## Tests

### API

The tests are written from these tables; the utilities and the code under test are reference code.

**Test utilities** (`tests/utils/`): `http-mocks.ts`, `test-server.ts` and `pg-container.ts` are the integration's and
Drizzle + Postgres's reference code; `entity-seed.ts` (`day(n)`, a fixed UTC day in 2026; `seedEntities(db, rows)`
inserting directly so tests control timestamps; `seedCanonical(db)`: `alpha` to `echo` on consecutive days, `charlie`
with a `null` description).

| Tier | Files                                                                   | Covers                                                                                                                                                             |
| ---- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| unit | `unit/helpers/dao.helper.test.ts`                                       | every operator and kind through the SQL `PgDialect` renders, escaped LIKE patterns, empty `in`, nested `and`/`or`/`not`, the sort tie-breaker, `toPaginatedResult` |
| unit | `unit/helpers/list-input.helper.test.ts`, `query-parser.helper.test.ts` | the builders' accepts and rejects against an ad-hoc config and their limits; first-value-wins, empty values dropped                                                |
| unit | `unit/db/schemas/entity.schema.test.ts`                                 | the entity's own wiring: its columns, date coercion, its sort allowlist                                                                                            |
| unit | `unit/controllers/*.test.ts`                                            | list decoding and every 400, 404 mapping, 201/204, an unexpected error forwarded; health `ok` and 503 with `cause`                                                 |
| unit | `unit/middlewares/error.middleware.test.ts`                             | exposed 4xx at `warn`, hidden 500 at `error`, an unexposed http error hidden, headers already sent                                                                 |
| DAO  | `db/entity.dao.test.ts`                                                 | every method's happy path and edges; `list` pagination, sort, each filter kind, combinations, hostile input as data                                                |
| API  | `api/entity.api.test.ts`                                                | a real query string from seeded rows with the right totals, the CRUD round trip, malformed JSON 400, over 100 kB 413, unmatched path 404                           |

### Web

| Tier    | Files                                 | Covers                                                                                                                                                                                                                                |
| ------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| unit    | the service and each helper's spec    | each request's method, URL and body; the list params round trip and fallbacks; the filter form mapping                                                                                                                                |
| unit    | `app-router.serializer.spec.ts`       | the deepest route's state, merged params, `null` with no state                                                                                                                                                                        |
| unit    | each slice's reducer and effects spec | as the NgRx testing conventions say: own-state navigation, `Leave`, each status; `switchMap` cancelling, `concatMap` ordering, nothing after `Leave`, a write from another visit ignored, stepping back past the last page            |
| browser | each component's spec                 | the behaviour in the component table                                                                                                                                                                                                  |
| browser | each page's spec                      | the watch (first load, equal value ignored, new value reloads, `null` waits, `Leave` on destroy); each UI state; list: the delete flow and the exact `navigate` each control dispatches; form: fill on load, no save for a blank name |

### End to end

Full stack only. Playwright drives Chromium against the stack the blueprint's e2e reference code starts, so the dev
stack can keep running:

| Piece    | Value                                                     |
| -------- | --------------------------------------------------------- |
| database | `app_e2e`, with `entity` truncated by the global setup    |
| seeding  | through the real API, with Playwright's `request` fixture |

| Spec                         | Covers                                                                                                                                             |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `entity-list-page.spec.ts`   | the filter lands in the URL; a deep link to page 2; _Next_ then back; delete through the dialog; stepping back when a delete empties the last page |
| `entity-detail-page.spec.ts` | a seeded entity with its _Edit_ link; an unknown id shows the error                                                                                |
| `entity-form-page.spec.ts`   | create lands on the detail page; edit a seeded entity                                                                                              |

Each spec creates uniquely named rows, so runs stay deterministic.

## Variants

### Hono

On Hono API on Node the resource, routes, answers and tiers are the same; the shell follows Hono and Hono + Drizzle:

- Handlers, errors and the context follow Hono + Drizzle; there is no `express.d.ts` and no `http-errors`.
- `http-mocks.ts` keeps only `createStubContext()`; the error handler's test asserts an `HTTPException` shown at `warn`,
  anything else a 500 at `error`.

### Fundamental NGX

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
  spec matches _Delete_ loosely; the e2e list spec clicks _Next page_. Storybook lists only the two
  `Components/DeleteDialog` stories.

## Done when

The stack's checks pass. With the API part, `pnpm test:integration` passes and `GET /health` answers
`{ status: 'ok', db: 'up', … }`. With the web part, `pnpm test:browser` passes, `pnpm build-storybook` lists the six
stories in `storybook-static/index.json`, and the image serves `/entities` through the SPA fallback. In the full stack,
`pnpm test:e2e` also passes and leaves the dev database and any running services as they were.
