# Hono

Hono as the server entry: one app that whatever runs it drives through `app.fetch`, its errors answered in one place.

## Use it like this

- **One Hono app, with no `serve()` call in it.** It is the entry file's default export where nothing has to be built
  before it, and `createApp(context)` where the server entry first builds what the handlers use (clients, data access)
  and hands it over. Whatever runs the app drives `app.fetch`: the runtime itself, or a server adapter.
- **Errors are answered by one `app.onError`**: an `HTTPException` is thrown on purpose, so its status and message go to
  the client; anything else answers 500 with a fixed message and is logged, since Hono has no `expose` flag to tell them
  apart. `app.notFound` throws a 404 `HTTPException`, so an unmatched route answers in the same shape.
- **Hono's own middleware covers the edges**: `hono/cors`, and `hono/body-limit` with an `onError` that throws a 413
  `HTTPException`. A malformed JSON body makes `c.req.json()` throw: catch it and throw a 400.
- **Configuration is typed and read once**: bindings through Hono's generics where the runtime passes them per
  request, the environment read once where the process lives on.
- **Tests reach the app through its real entry** where the runtime matters. `app.request()` is fine for a quick test of
  one route, but skips the entry point.

## Conventions

- **The server entry is one Hono app**, the default export or `createApp(context)`; it never calls `serve()` itself.
- **Errors go through one `onError`**: `HTTPException` messages are shown, anything else is a logged 500.
- **Capabilities are wired by the server entry** (a database client, auth) and typed in the app's context. Where the
  entry is the default-export app itself, no helper file sits next to it.
