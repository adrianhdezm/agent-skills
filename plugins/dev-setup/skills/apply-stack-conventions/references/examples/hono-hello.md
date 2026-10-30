# Hono hello

The first route of a Hono Worker: one `GET /` answered by the Worker's real entry, and a test that reaches it the way
workerd does. The Hono Worker stack starts with it when the user has named no routes of their own; when they have, their
routes take its place and the same shape holds.

## Demonstrates

| Part                             | Applies                                                                    |
| -------------------------------- | -------------------------------------------------------------------------- |
| `src/app.ts`, the default export | Hono (one app, no `serve()`), Hono + Cloudflare Workers (`Bindings: Env`)  |
| `tests/app.test.ts`              | Hono + Cloudflare Workers (through `cloudflare:workers`), Vitest (workerd) |

## Data

| What     | Value                                 |
| -------- | ------------------------------------- |
| route    | `GET /`                               |
| response | 200, text `Hello Cloudflare Workers!` |

## Behaviour

- The app is typed with the generated `Env`, even with no binding yet, so the first binding needs no change to it.

## Tests

| Tier          | File                | Covers                                                            |
| ------------- | ------------------- | ----------------------------------------------------------------- |
| unit, workerd | `tests/app.test.ts` | `GET /` through `exports.default.fetch` answers 200 with the text |

## Done when

The stack's checks pass, and `vite preview` serves `Hello Cloudflare Workers!` on `GET /` from the build in workerd.
