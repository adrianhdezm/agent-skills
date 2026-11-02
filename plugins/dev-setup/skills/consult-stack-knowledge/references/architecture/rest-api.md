---
kind: concept
---
# REST API

How an HTTP API is shaped, and what its clients can rely on: resources and methods, one error body, inputs validated at
the edge, one list format, and plain values on the wire. It binds the API that serves it and every client that consumes
it.

## Principles

- **Resources are plural nouns; methods carry the verb**, so a client derives every URL from the resource name.
  `GET /entities` lists, `POST /entities` creates, `GET /entities/:id` reads, `PATCH /entities/:id` updates part of one,
  `DELETE /entities/:id` removes it. No verbs in paths.
- **Status codes say what happened**: 200 with the resource, 201 with the created one, 204 with no body after a delete;
  400 for input the API rejects, 404 for a missing resource or path, 413 for a body over the limit, 503 when a
  dependency is down, 500 for anything unexpected.
- **One error body**, `{ status: 'error', message }`, for every error, from one place. A client error's message is
  shown; an unexpected error's is hidden and logged, so internals never leak. Client errors log at `warn`, server errors
  at `error`.
- **Every input is validated at the edge**, against strict schemas, because a misspelled param that is silently ignored
  is a bug the client never sees: an unknown query param or body field is a 400, not ignored. Every error a handler can
  answer is visible in its own code, not only in a shared catch.
- **Handlers are thin**, so a handler test needs no server and the logic lives once in the data layer: validate, call
  the data layer, shape the answer. A domain error (`NotFoundError`) becomes its status there.
- **One list format.** Every list takes the same optional query params and answers the same envelope, so every client
  and every page URL share one parser.
- **Plain values on the wire**, so every client parses the same way and no serializer is configured: dates as ISO-8601
  strings, ids as UUIDs, `null` for an absent optional field.
- **A health endpoint probes the dependencies**, so a deploy is checked before it takes traffic: `GET /health` answers
  `{ status: 'ok', … }` or 503.
- **Clients mirror the API's types in the same commit** as the API change, so a client never compiles against a stale
  shape, and take the base URL from configuration.
- **Tests at two tiers**: each handler as a function with stubbed dependencies, for every branch; and the real app over
  HTTP, for what only the assembled stack does (body parsing, the route table, the error chain).

## Required values

| What               | Value                                                                                                                                                                                           |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| list request       | `?filter=<json>&sortField=<field>&sortDirection=ASC\|DESC&page=<n>&pageSize=<n>`, every param optional, any other a 400                                                                         |
| `filter`           | the Data access filter as JSON: typed per field kind, recursive `and` / `or` / `not`, strict (an unknown field or operator is a 400), `in` at most 100 values, `and` / `or` at most 20 branches |
| list response      | `{ items, total, page, pageSize, totalPages }`, the Data access paginated result as is                                                                                                          |
| list defaults      | the Data access defaults: `page` 1, `pageSize` 20 (max 100), the resource's default sort                                                                                                        |
| error body         | `{ status: 'error', message }`                                                                                                                                                                  |
| values on the wire | dates as ISO-8601 strings, ids as UUIDs, `null` for an absent optional field                                                                                                                    |
| health             | `GET /health` → 200 `{ status: 'ok', timestamp, … }` with one key per dependency probed (a database: `db: 'up'`, `latencyMs`), or 503 when one is down                                          |

## Conventions

- **Resources are plural nouns and methods carry the verb**: `GET` list and read, `POST` create (201), `PATCH` partial
  update, `DELETE` (204, no body).
- **Every error answers `{ status: 'error', message }`** from one error handler; a client error's message is shown, an
  unexpected one's hidden and logged.
- **Every input is validated at the edge against a strict schema**; anything unknown is a 400.
- **Handlers validate, call the data layer and shape the answer**; a missing resource is a 404.
- **Every list speaks one format**: `?filter=<json>&sortField=…&sortDirection=ASC|DESC&page=…&pageSize=…` in,
  `{ items, total, page, pageSize, totalPages }` out.
- **Dates travel as ISO-8601 strings, ids are UUIDs, absence is `null`.**
- **A change to the API's types changes its clients' types in the same commit.**
- **A new route gets a handler test and a case in its resource's API test.**

## Verify it is wired

- Every error response in the API tests has the standard body, including an unmatched path and malformed JSON.
- Every handler validates its params, query and body before calling the data layer.
- Every list endpoint accepts the list params and rejects unknown ones.
- The client's models match the API's responses field for field.
