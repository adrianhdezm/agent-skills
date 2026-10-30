# React Router on Node

A server-rendered React Router app on Node, next to Postgres in Docker Compose, styled with Tailwind and shadcn/ui.
Postgres runs and `DATABASE_URL` is set, but no database code is wired: the React Router + Drizzle integration says how
it is layered when it arrives.

## Composition

- [Code style](../architecture/code-style.md)
- [pnpm](../technologies/pnpm.md)
- [TypeScript](../technologies/typescript.md)
- [Database](../architecture/database.md)
- [Data access](../architecture/data-access.md)
- [Authentication](../architecture/authentication.md) — optional (authentication)
- [Better Auth](../technologies/better-auth.md) — optional (authentication)
- [Better Auth + Drizzle](../integrations/better-auth-drizzle.md) — optional (authentication)
- [Better Auth + React Router](../integrations/better-auth-react-router.md) — optional (authentication)
- [File storage](../architecture/file-storage.md) — optional (file-storage)
- [UI components](../architecture/ui-components.md)
- [React Router](../technologies/react-router.md)
- [Vite](../technologies/vite.md)
- [React Router + Vite](../integrations/react-router-vite.md)
- [Tailwind](../technologies/tailwind.md)
- [shadcn](../technologies/shadcn.md)
- [React Router + shadcn/ui](../integrations/react-router-shadcn.md)
- [Hono](../technologies/hono.md)
- [Hono + React Router](../integrations/hono-react-router.md)
- [Storybook](../technologies/storybook.md) — optional (storybook)
- [React Router + Storybook](../integrations/react-router-storybook.md) — optional (storybook)
- [Node](../technologies/node.md)
- [Node + TypeScript](../integrations/node-typescript.md)
- [Hono + Node](../integrations/hono-node.md)
- [Docker Compose](../technologies/docker-compose.md)
- [Postgres](../technologies/postgres.md)
- [Postgres + Docker Compose](../integrations/postgres-docker-compose.md)
- [React Router + Docker Compose](../integrations/react-router-docker-compose.md)
- [React Router + Drizzle](../integrations/react-router-drizzle.md)
- [Drizzle](../technologies/drizzle.md) — optional (database)
- [Drizzle + Postgres](../integrations/drizzle-postgres.md) — optional (database)
- [S3 storage](../technologies/s3-storage.md) — optional (file-storage)
- [S3 storage + Docker Compose](../integrations/s3-storage-docker-compose.md) — optional (file-storage)
- [ESLint](../technologies/eslint.md)
- [TypeScript + ESLint](../integrations/typescript-eslint.md)
- [Prettier](../technologies/prettier.md)
- [ESLint + Prettier](../integrations/eslint-prettier.md)
- [React Router + ESLint](../integrations/react-router-eslint.md)
- [React Router + Prettier](../integrations/react-router-prettier.md)
- [Vitest](../technologies/vitest.md)
- [React Router + Vitest](../integrations/react-router-vitest.md)

## Examples

- [React Router home](../examples/react-router-home.md): the home route reading `APP_NAME` from the server's
  configuration

## Shape

```
my-app/
├── .dockerignore / .gitignore / .prettierignore / .prettierrc
├── .env / .env.example        # only .env.example is committed
├── coding-conventions.md      # assembled from the stack blueprint
├── components.json            # shadcn/ui
├── docker-compose.yml         # db + app
├── Dockerfile                 # the app image
├── eslint.config.js
├── package.json / pnpm-lock.yaml / pnpm-workspace.yaml
├── react-router.config.ts
├── server.ts                  # dev and production entry, run by Node as TypeScript
├── tsconfig.json              # solution file, plus `paths` for the shadcn CLI
├── tsconfig.app.json          # app/ and workers/: Node and the browser
├── tsconfig.node.json         # server.ts and the config files
├── tsconfig.test.json         # the app project plus tests/: Chromium
├── vite.config.ts / vitest.config.ts
├── app/                       # as on Workers; context.ts holds the server's configuration
├── db/scripts/init.sql
├── public/favicon.ico
├── tests/unit/                # mirrors app/
└── workers/app.ts             # Hono → React Router
```

## Required values

| What                 | Value                                                                                                                                                                                                                                                               |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ports                | Postgres 5432 (moved with `DB_PORT`), the app's `PORT` (default 3000)                                                                                                                                                                                               |
| scripts              | `dev` `node --env-file=.env server.ts`; `build` `react-router build`; `start` `node server.ts` (production gets its environment from Compose); `typecheck` `react-router typegen && tsc -b`; `lint`, `test`, `format`, `format:check`, `compose:up`, `compose:down` |
| `allowBuilds`        | `esbuild`                                                                                                                                                                                                                                                           |
| dependencies         | the React Router set and the shadcn/ui packages from their docs; `hono`, `@hono/node-server`                                                                                                                                                                        |
| devDependencies      | the React Router, Vite and shadcn/ui docs' dev packages; the shared tooling with `eslint@9` and `@eslint/js@9`, `globals`, the React lint plugins, the Prettier plugins, the Vitest browser packages, `playwright`; `@types/node@24`, and the pinned `typescript`   |
| `vite.config.ts`     | `tailwindcss()`, `reactRouter()`, `resolve.tsconfigPaths`, and the SSR input from the Hono + Node integration                                                                                                                                                       |
| `tsconfig.app.json`  | includes `.react-router/types/**/*`, `app`, `workers`; `types: ["node", "vite/client"]`                                                                                                                                                                             |
| `tsconfig.node.json` | also includes `server.ts`, with Node's rules: `module: "NodeNext"`, `allowImportingTsExtensions`, `types: ["node"]`                                                                                                                                                 |
| `.env.example`       | `DB_PASSWORD`, `DB_PORT=5432`, `DATABASE_URL` (`…@localhost:5432/app`), `PORT=3000`, `NODE_ENV=development`, `APP_NAME=<App name>`                                                                                                                                  |
| `docker-compose.yml` | the Postgres + Docker Compose `db` service with the data at `./db/data`, and the React Router + Docker Compose `app` service                                                                                                                                        |
| `Dockerfile`         | React Router + Docker Compose's two stages                                                                                                                                                                                                                          |
| `.gitignore`         | `node_modules/`, `build/`, `.react-router/`, `.env`, `*.tsbuildinfo`, `.DS_Store`, and `db/data/` under a comment                                                                                                                                                   |
| `.prettierignore`    | `pnpm-lock.yaml`, `db/data`                                                                                                                                                                                                                                         |
| `.dockerignore`      | React Router + Docker Compose's, with `db` as the data folder                                                                                                                                                                                                       |

## Scaffold

- **Check the ports first**; stop with the user if one is taken, or set another `PORT` in `.env`.
- **`pnpm exec playwright install chromium`** after the install, once.
- **`cp .env.example .env`** once `.env.example` is written.
- **Add the shadcn primitives after the app files**, then check none landed in a `~` folder.

## Conventions

### Layout

| Path              | Holds                                                                          |
| ----------------- | ------------------------------------------------------------------------------ |
| `server.ts`       | runs `workers/app.ts`: Vite middleware in development, the build in production |
| `workers/app.ts`  | the Hono app: builds the context once and hands each request to React Router   |
| `app/context.ts`  | `appContext`: the server's configuration, later its database client            |
| `app/routes/`     | route modules, declared in `app/routes.ts`                                     |
| `app/components/` | app components; `app/components/ui/` the shadcn primitives                     |
| `tests/unit/`     | mirrors `app/`; runs in Chromium                                               |
| `db/`             | `scripts/init.sql`, and the bind-mounted Postgres data                         |

### Commands

`pnpm dev` runs the server with Vite; `pnpm build` then `pnpm start` runs production; `pnpm compose:up` runs the image
next to Postgres. `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` and `pnpm format:check` are the five
required checks.

### Before you merge

- [ ] The five checks pass.
- [ ] Every new route has a unit test.
- [ ] A new dependency of the routes is built in `workers/app.ts` and typed in `app/context.ts`.
- [ ] A new environment variable is in `.env.example` and, if the image needs it, in `docker-compose.yml`.

## Smoke test

- **Production**: `PORT=<port> node server.ts` serves the welcome heading, the stylesheet under `/assets/` with
  `cache-control: public, max-age=31536000, immutable`, and a 404 for an unknown path.
- **Development**: `pnpm dev` serves the welcome heading.
- **Compose**: `pnpm compose:up` brings `db` up healthy and then `app`; the app container serves the heading, and
  `docker compose exec -T db psql -U postgres -tAc "select datname from pg_database where datname='app'"` prints
  `app`. Leave Compose running or `pnpm compose:down`, and say which.
