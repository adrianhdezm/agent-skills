# Express + Drizzle

An Express API over the Drizzle DAO layer: the composition root builds the DAOs once, controllers reach them through the
app's context, decode the list query, and turn DAO results into HTTP answers. The Angular full stack's `api/` uses it.

**Realises:** [Data access](../architecture/data-access.md), [REST API](../architecture/rest-api.md)

## The seam

```
server.ts ─► createDbClient() ─► new <Resource>Dao(db) ─► AppContext { db, <resource>Dao, … } ─► createApp(context)
request ─► controller ─► req.app.locals.context.<resource>Dao ─► Drizzle ─► Postgres
                │                     │
     decodes the list query     NotFoundError / null ─► createError(404)
```

- **`server.ts` builds the database client and every DAO**, puts them on the `AppContext`, and closes the pool after the
  HTTP server on `SIGINT` / `SIGTERM`. It is the only place that opens connections.
- **Controllers call DAOs through `req.app.locals.context`** and never import the ORM or a DAO class.
- **A DAO's `NotFoundError` becomes a 404 in the handler**, as does a `null` from `get`. DAOs throw no HTTP errors, so
  they stay callable from non-HTTP code.
- **The list query is decoded in the controller**: the DAO takes the structured `{ filter, sort, page, pageSize }` from
  anywhere, and the controller builds it from the query string in plain sight.
- **The health probe runs `SELECT 1` inline** on `context.db` and answers `{ status: 'ok', db: 'up', latencyMs, timestamp }`,
  or an exposed 503 `Database connection failed` with the original error as its `cause`. It is the one handler whose
  `catch` creates the error, and the reason `db` stays on the context beside the DAOs.

## Where it lives

| File                                 | Holds                                                                      |
| ------------------------------------ | -------------------------------------------------------------------------- |
| `src/server.ts`                      | the pool, the Drizzle client, every DAO, the `AppContext`, shutdown        |
| `src/models/app-context.model.ts`    | `AppContext { db: DbClient; <resource>Dao: <Resource>Dao }`                |
| `src/express.d.ts`                   | `Express.Locals { context: AppContext }`                                   |
| `src/controllers/*.controller.ts`    | list decoding, `safeParse` against the resource's schemas, the 404 mapping |
| `src/helpers/query-parser.helper.ts` | `normalizeQuery`, the one HTTP-aware helper of the data layer              |
| `tests/utils/http-mocks.ts`          | `createStubContext()`: a `vi.fn()` per DAO method                          |
| `tests/api/`                         | the real app on the real DAOs and a Testcontainers Postgres                |

## Conventions

- **The composition root builds the DAOs once**: `server.ts` creates the pool and one `<Resource>Dao` per table, puts
  them on `AppContext`, and closes the pool on shutdown. Adding a resource adds its DAO there and to `AppContext`.
- **Controllers reach data only through the context's DAOs**; they import no ORM, table or DAO class.
- **A DAO's `NotFoundError` becomes a 404** in the handler, as does a `null` from `get`.
- **The list query on the wire** (the REST API concept's format) is decoded by the controller in plain sight:
  `normalizeQuery`, reject unknown params, `JSON.parse` the filter, build `sort` with `ASC` when only the field is given,
  numbers for the page; then `list<Resource>InputSchema` validates the structured input.
- **Request bodies are validated against the resource's `drizzle-zod` schemas** with `safeParse`; an update merges the
  path id into the body before validating.

## Verify it is wired

- Only `server.ts` constructs a pool or a DAO; no controller imports from `drizzle-orm`, `db/` or `daos/`.
- Every DAO method that can miss a row is mapped to a 404 by its handler.
- Every list controller rejects unknown query params and validates with its resource's list input schema.
