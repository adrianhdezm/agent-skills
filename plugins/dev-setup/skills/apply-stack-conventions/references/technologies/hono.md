# Hono

Hono as the server entry: one app that whatever runs it drives through `app.fetch`.

## Use it like this

- **One Hono app, exported as the default** from the entry file, with no `serve()` call in it. Whatever runs the app
  drives `app.fetch`: the runtime itself, or a server adapter.
- **Configuration is typed and read once**: bindings through Hono's generics where the runtime passes them per
  request, the environment read once where the process lives on.
- **Tests reach the app through its real entry** where the runtime matters. `app.request()` is fine for a quick test of
  one route, but skips the entry point.

## Conventions

- **The server entry is one Hono app, exported as the default**; it never calls `serve()` itself.
- **No helper files beside the entry.** Wiring a capability (a database client, auth) happens in the entry and is
  typed in the app's context, not in a new file next to the entry.
