# Hono + Node

A Hono app served by Node through `@hono/node-server`. React Router on Node uses it with `server.ts` running
`workers/app.ts`: Vite's middleware mode in development, the build behind `serveStatic` in production. Hono API on
Node uses it with `src/server.ts` serving `createApp(context)`, compiled by `tsc` like any API.

## The seam

```
development:  node --env-file=.env server.ts ─► Vite middleware ─► ssrLoadModule('./workers/app.ts') ─► getRequestListener(fetch)
production:   node server.ts ─► Hono ─► serveStatic(build/client) ─► app.fetch from build/server/index.js
an API:       node dist/server.js ─► the pool, the DAOs ─► createApp(context) ─► serve({ fetch: app.fetch, port }); shutdown on SIGTERM
```

- **`server.ts` runs the Hono app; the app never serves itself.** The app module exports its `fetch` and nothing more.
- **`@hono/node-server` serves the app**: `serve({ fetch, port })` in production, `getRequestListener(fetch)` inside a
  Node HTTP server in development, and `serveStatic` for the client build.
- **Vite builds the Hono app as the SSR entry**:
  `environments: { ssr: { build: { rollupOptions: { input: './workers/app.ts' } } } }` writes it to
  `build/server/index.js` for `server.ts` to import.
- **Node runs `server.ts` as TypeScript**, so it follows Node's rules (`module: "NodeNext"`,
  `allowImportingTsExtensions`, `types: ["node"]`) and sits in `tsconfig.node.json`.

## Where it lives

| File             | Holds                                                                                          |
| ---------------- | ---------------------------------------------------------------------------------------------- |
| `server.ts`      | the dev and production branches, chosen by `NODE_ENV === 'development'`                        |
| `vite.config.ts` | the `ssr` environment's `input: './workers/app.ts'`                                            |
| `Dockerfile`     | the runtime stage copies `build/` and `server.ts`, installs `--prod`, `node server.ts`         |
| `src/server.ts`  | in an API: the composition root, `serve()`, and closing the server, then the pool, on a signal |

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
const PORT = Number(process.env.PORT) || 3000;

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
  }).listen(PORT, () => {
    console.log(`Dev server at http://localhost:${String(PORT)}`);
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
  serve({ fetch: server.fetch, port: PORT }, () => {
    console.log(`Server running at http://localhost:${String(PORT)}`);
  });
}

await (DEV ? startDev() : startProduction());
```

- **Vite in middleware mode opens its HMR WebSocket on port 24678**, beside the app's `PORT`: a second dev server on the
  same machine fails on it. Count it among the ports to check, and give each dev server its own `server.hmr.port`.
- **`vite` is imported only in the dev branch**, so the production image runs without dev dependencies.
- **The build path is a variable**: `build/` does not exist before the first build, and `tsc` must not resolve it.
- **Cache headers are set in `onFound`**, because nothing after `serveStatic` runs for a file it served.

**`src/server.ts`** in an API: reads its two settings and fails loudly, builds the context, serves, and on `SIGINT` or
`SIGTERM` closes the server and then the pool.

```ts
import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import { createDbClient } from './db/client.js';
import { EntityDao } from './daos/entity.dao.js';
import { logger } from './logger.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is required');
}
const port = Number(process.env.PORT);
if (!Number.isInteger(port) || port <= 0) {
  throw new Error('PORT is required');
}

const { pool, db } = createDbClient(databaseUrl);
const app = createApp({ db, entityDao: new EntityDao(db) });
const server = serve({ fetch: app.fetch, port }, (info) => {
  logger.info(`Listening on port ${String(info.port)}`);
});

function shutdown(signal: string): void {
  logger.info(`${signal} received, shutting down`);
  server.close(() => {
    pool.end().then(
      () => process.exit(0),
      (error: unknown) => {
        logger.error({ err: error }, 'Pool did not close cleanly');
        process.exit(1);
      }
    );
  });
}

process.on('SIGINT', () => {
  shutdown('SIGINT');
});
process.on('SIGTERM', () => {
  shutdown('SIGTERM');
});
```

## Conventions

- **The app never calls `serve()` itself**: a Node entry serves it through `@hono/node-server`.
- **Behind a React Router app, `server.ts` runs `workers/app.ts`**: Vite middleware in development, the build in
  production, with `vite` reached only from the dev branch, and static files served by `serveStatic` with their cache
  headers set in `onFound` (fingerprinted `/assets/*` immutable for a year, the rest of `build/client` for an hour).
- **In an API, `src/server.ts` is the composition root**: it reads its settings, builds the context for
  `createApp(context)`, serves it, and on `SIGINT` / `SIGTERM` closes the server and then the pool.

## Verify it is wired

- Behind a React Router app: `server.ts` imports `vite` only inside its dev branch, and imports the build through a
  variable path.
- `vite.config.ts` builds `./workers/app.ts` as the SSR input.
- In an API: `SIGTERM` closes the server and the pool, and the process exits 0.
- A production response for `/assets/<file>` carries `cache-control: public, max-age=31536000, immutable`.
