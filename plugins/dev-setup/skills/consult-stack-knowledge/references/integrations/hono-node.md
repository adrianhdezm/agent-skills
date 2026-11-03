---
kind: integration
connects: [hono, node]
---
# Hono + Node

A Hono app served by Node through `@hono/node-server`. React Router on Node uses it with `server.ts` running
`workers/app.ts`: Vite's middleware mode in development, the build behind `serveStatic` in production. Hono API on
Node uses it with `src/server.ts` serving `createApp(context)`, compiled by `tsc` like any API.

## The seam

```
development:  node --env-file=.env server.ts ─► Vite middleware ─► ssrLoadModule('./workers/app.ts') ─► getRequestListener(fetch)
production:   node server.ts ─► Hono ─► serveStatic(build/client) ─► app.fetch from build/server/index.js
an API:       node dist/server.js ─► the context ─► createApp(context) ─► serve({ fetch: app.fetch, port }); shutdown on SIGTERM
```

- **`server.ts` runs the Hono app; the app never serves itself.** The app module exports its `fetch` and nothing more.
- **`@hono/node-server` serves the app**: `serve({ fetch, port })` in production, `getRequestListener(fetch)` inside a
  Node HTTP server in development, and `serveStatic` for the client build.
- **`server.ts` imports the server build at `build/server/index.js`.**
- **Node runs `server.ts` as TypeScript** (Node + TypeScript), from `tsconfig.node.json`.

## Where it lives

| File                         | Holds                                                                                                                 |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `server.ts`                  | the dev and production branches, chosen by `NODE_ENV === 'development'`                                               |
| `src/server.ts`              | in an API: `serve()`, and closing the server, then what the context opened, on a signal; the rest is Hono + Drizzle's |
| `tests/utils/test-server.ts` | in an API: `serveApp(app)`, the real app on an ephemeral port                                                         |

`@hono/node-server` is a dependency; `vite` is only reached from the dev branch.

## Pitfalls

- **A middleware placed after `serveStatic` never runs for a file it served**: `serveStatic` answers without calling
  `next`. Set cache headers in its `onFound` option.
- **Importing `vite` at the top of `server.ts`** makes the production image need dev dependencies: import it inside the
  dev branch.

## Reference code

**`server.ts`**: Vite's middleware mode in development, `@hono/node-server` over the build in production.

```ts
import { getRequestListener, serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { createServer } from 'node:http';

const DEV = process.env.NODE_ENV === 'development';
const port = Number(process.env.PORT);
if (!Number.isInteger(port) || port <= 0) {
  throw new Error('PORT is required');
}

/** The Hono app's request entry point, as workers/app.ts exports it. */
interface App {
  fetch: (request: Request) => Response | Promise<Response>;
}

/** Narrows a loaded module to one whose default export is the app. */
function isAppModule(mod: unknown): mod is { default: App } {
  return typeof mod === 'object' && mod !== null && 'default' in mod;
}

async function startDev() {
  // Vite in middleware mode serves the client and reloads workers/app.ts on every request, so edits apply at once.
  const vite = await import('vite');
  const viteServer = await vite.createServer({ server: { middlewareMode: true } });
  createServer((req, res) => {
    viteServer.middlewares(req, res, () => {
      viteServer
        .ssrLoadModule('./workers/app.ts')
        .then(async (mod) => {
          if (!isAppModule(mod)) {
            throw new Error('workers/app.ts has no default export');
          }
          await getRequestListener(mod.default.fetch)(req, res);
        })
        .catch((error: unknown) => {
          if (error instanceof Error) {
            viteServer.ssrFixStacktrace(error);
          }
          console.error(error);
          res.statusCode = 500;
          res.end();
        });
    });
  }).listen(port, () => {
    console.log(`Dev server at http://localhost:${String(port)}`);
  });
}

async function startProduction() {
  // A variable, not a literal: build/ does not exist before the first build, and tsc must not try to resolve it.
  const buildPath = './build/server/index.js';
  const mod: unknown = await import(buildPath);
  if (!isAppModule(mod)) {
    throw new Error(`${buildPath} has no default export`);
  }
  const app = mod.default;
  const server = new Hono();
  // Fingerprinted assets never change; everything else in build/client may.
  server.use(
    '/assets/*',
    serveStatic({
      root: './build/client',
      onFound: (_path, c) => {
        c.header('Cache-Control', 'public, max-age=31536000, immutable');
      }
    })
  );
  server.use(
    '*',
    serveStatic({
      root: './build/client',
      onFound: (_path, c) => {
        c.header('Cache-Control', 'public, max-age=3600');
      }
    })
  );
  server.all('*', (c) => app.fetch(c.req.raw));
  serve({ fetch: server.fetch, port }, () => {
    console.log(`Server running at http://localhost:${String(port)}`);
  });
}

await (DEV ? startDev() : startProduction());
```

- **`vite` is imported only in the dev branch**, so the production image runs without dev dependencies.
- **The build path is a variable**: `build/` does not exist before the first build, and `tsc` must not resolve it.
- **Cache headers are set in `onFound`**, because nothing after `serveStatic` runs for a file it served.

In an API, `src/server.ts` calls `serve({ fetch: app.fetch, port })` and, on a signal, `server.close()` before closing
what the context opened; the file is Hono + Drizzle's reference code.

`tests/utils/test-server.ts`: the real app on an ephemeral port for API tests.

```ts
import type { AddressInfo } from 'node:net';
import { serve } from '@hono/node-server';
import type { Hono } from 'hono';
import type { AppEnv } from '../../src/models/app-context.model.js';

export interface TestServer {
  readonly baseUrl: string;
  readonly close: () => Promise<void>;
}

/** Serves the app on an ephemeral port. */
export function serveApp(app: Hono<AppEnv>): Promise<TestServer> {
  return new Promise((resolve) => {
    const server = serve({ fetch: app.fetch, port: 0 }, (info: AddressInfo) => {
      resolve({
        baseUrl: `http://localhost:${String(info.port)}`,
        close: () =>
          new Promise<void>((done, fail) => {
            server.close((error) => {
              if (error) {
                fail(error);
              } else {
                done();
              }
            });
          })
      });
    });
  });
}
```

## Conventions

- **The app never calls `serve()` itself**: a Node entry serves it through `@hono/node-server`.
- **Behind a React Router app, `server.ts` runs `workers/app.ts`**: Vite middleware in development, the build in
  production, with `vite` reached only from the dev branch, and static files served by `serveStatic` with their cache
  headers set in `onFound` (fingerprinted `/assets/*` immutable for a year, the rest of `build/client` for an hour).
- **In an API, `src/server.ts` serves `createApp(context)`** through `serve({ fetch: app.fetch, port })` and, on
  `SIGINT` / `SIGTERM`, closes the server and then what the context opened.

## Verify it is wired

- Behind a React Router app: `server.ts` imports `vite` only inside its dev branch, and imports the build through a
  variable path.
- In an API: `SIGTERM` closes the server, then what the context opened, and the process exits 0.
- A production response for `/assets/<file>` carries `cache-control: public, max-age=31536000, immutable`.
