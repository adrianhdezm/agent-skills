---
kind: integration
connects: [hono, react-router]
---
# Hono + React Router

Hono as React Router's server entry: one Hono app hands every request to React Router with a typed context. Both React
Router stacks use it; the runtime under the Hono app (Workers or Node) has its own integration.

## The seam

```
runtime ─► workers/app.ts (Hono) ─► app.all('*') ─► RouterContextProvider + appContext ─► React Router request handler
                                                                                             └─► loaders / actions read context.get(appContext)
```

- **Hono is the server entry**, `workers/app.ts` on both targets: one `app.all('*', …)` handler builds a
  `RouterContextProvider` per request, sets the typed `appContext`, and hands `c.req.raw` to React Router's request
  handler. On Workers the runtime drives it; on Node, `server.ts` does.
- **What goes on the context depends on the runtime**: on Workers the bindings and the execution context, built inside
  the handler, because bindings exist only per request; on Node the configuration, built once at module scope from
  `process.env`, because the process lives on.

## Where it lives

| File             | Holds                                                                                 |
| ---------------- | ------------------------------------------------------------------------------------- |
| `workers/app.ts` | the Hono app: one `app.all('*', …)` handler, `createRequestHandler`, default export   |
| `app/context.ts` | `appContext = createContext<…>()`, the one type every loader and action reads         |
| `app/routes/*`   | `context.get(appContext)` in loaders and actions                                      |

`hono` is a dependency of the app, next to `react-router`.

## Reference code

**`workers/app.ts`**, on Workers. On Node it is the same without `Bindings`, and the context carries `{ env }` built
once at module scope from `process.env`:

```ts
import { Hono } from 'hono';
import { createRequestHandler, RouterContextProvider } from 'react-router';

import { appContext } from '~/context';

const app = new Hono<{ Bindings: Env }>();

const requestHandler = createRequestHandler(() => import('virtual:react-router/server-build'), import.meta.env.MODE);

app.all('*', (c) => {
  const routerContext = new RouterContextProvider();
  routerContext.set(appContext, { cloudflare: { env: c.env, ctx: c.executionCtx } });
  return requestHandler(c.req.raw, routerContext);
});

export default app;
```

## Conventions

- **`workers/app.ts` is one Hono app with one `app.all('*', …)` handler** that builds a `RouterContextProvider`, sets
  `appContext` and calls React Router's request handler. It exports the app as the default and never calls `serve()`.
- **Capabilities are wired there and typed in `app/context.ts`**: a database client, auth, file storage. On Workers they
  are built inside the handler, because bindings exist only per request; on Node, once at module scope, because the
  process lives on. Shared code (schema, services) lives in `app/`, never in `workers/`.

## Verify it is wired

- `workers/app.ts` has exactly one handler, `app.all('*', …)`, and no `serve()`; nothing else sits under `workers/`.
- Every value a route reads from the server comes through `context.get(appContext)`, and `app/context.ts` types it.
- No `AppLoadContext` augmentation and no `getLoadContext` anywhere.
