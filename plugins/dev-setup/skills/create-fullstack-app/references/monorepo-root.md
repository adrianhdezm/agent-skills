# Monorepo root

The workspace files at the repo root: manifests, shared tooling, env, ignore files and Compose.

## Contents

- [`pnpm-workspace.yaml`](#pnpm-workspaceyaml)
- [Root `package.json`](#root-packagejson)
- [Shared tooling](#shared-tooling)
- [`.gitignore`](#gitignore)
- [`.dockerignore`](#dockerignore)
- [`.env.example`](#envexample)
- [`docker-compose.yml`](#docker-composeyml)

## `pnpm-workspace.yaml`

Write the packages list and `allowBuilds`. The `catalog:` block is not written by hand: `pnpm add --save-catalog` in
[Shared tooling](#shared-tooling) fills it.

```yaml
packages:
  - api
  - web

allowBuilds:
  '@parcel/watcher': false
  cpu-features: false
  esbuild: true
  lmdb: false
  msgpackr-extract: false
  protobufjs: false
  ssh2: false
```

`cpu-features`, `protobufjs` and `ssh2` are optional native deps pulled in transitively by `@testcontainers/postgresql`
(through dockerode/ssh2). The DB tests talk to the local Docker socket and never need them built, so they are set to
`false` to keep `pnpm install` clean (no `ERR_PNPM_IGNORED_BUILDS`).

**Catalog rule**: only packages used in two or more manifests with the same version range belong in the catalog.
Everything else is a direct dependency of the one manifest that uses it. TypeScript is in the catalog because both
projects pin the same exact 6.0.x version; `@types/node` and `vitest` are in the catalog too, because api and web both
depend on them at the same range (`^24.x`, `^5.x`).

## Root `package.json`

```json
{
  "name": "<repo-name>",
  "version": "0.0.0",
  "private": true,
  "engines": { "node": ">=24" },
  "scripts": {
    "dev:api": "pnpm --filter api dev",
    "dev:web": "pnpm --filter web start",
    "build": "pnpm -r build",
    "typecheck": "pnpm -r typecheck",
    "lint": "pnpm -r lint",
    "test": "pnpm -r test",
    "test:integration": "pnpm --filter api test:integration",
    "test:browser": "pnpm --filter web test:browser",
    "test:e2e": "pnpm --filter web test:e2e",
    "storybook": "pnpm --filter web storybook",
    "format": "pnpm -r format",
    "format:check": "pnpm -r format:check",
    "up": "docker compose up --build",
    "down": "docker compose down -v"
  }
}
```

Then record the local pnpm version, which Corepack uses inside both Dockerfiles:

```sh
pnpm pkg set packageManager="pnpm@$(pnpm --version)"
```

No root-level Prettier devDependency, no root `.prettierrc`, no root `.prettierignore`. Each project owns its own
formatter config.

## Shared tooling

Run once both `api/package.json` and `web/package.json` exist. First check that the TypeScript ranges still overlap:

```sh
pnpm view typescript-eslint peerDependencies       # typescript ceiling, e.g. "<6.1.0"
pnpm view @angular/compiler-cli@22 peerDependencies # e.g. ">=6.0 <6.1"
```

Pick the newest TypeScript that satisfies both, which is the latest 6.0.x while those ranges hold, and pin it exactly:

```sh
pnpm --filter api --filter web add -D --save-catalog \
  eslint @eslint/js typescript-eslint eslint-config-prettier globals prettier @types/node@24 vitest@5
pnpm --filter api --filter web add -D -E --save-catalog "typescript@$(pnpm view 'typescript@~6.0.0' version)"
```

This writes the `catalog:` block, adds back `typescript` and `prettier` (removed from `web/package.json` in the
`web.md` cleanup) as `catalog:`, and replaces the Angular CLI's own `vitest` entry with `catalog:`. `@types/node` and `vitest` carry their majors explicitly, so the catalog never
picks up a newer major than the Dockerfiles' Node (24) or the one the test configs are written for (5). Check the
result: `typescript` in the catalog is an exact version with no `^` or `~`.

## `.gitignore`

```
node_modules/
dist/
.env
*.log
*.tsbuildinfo
.angular/
.DS_Store

# Postgres data (bind-mounted by docker-compose)
api/db/data/
```

## `.dockerignore`

Both images build with the repo root as context, so one ignore file serves both.

```
**/node_modules
**/dist
**/.angular
.git
.env
api/db
web/storybook-static
web/test-results
web/playwright-report
web/.vitest
```

The last four are Storybook, Playwright and Vitest output: never part of an image, and they would bust the build
cache.

## `.env.example`

```bash
# Postgres — used by Docker Compose (db service + ${VAR} substitution)
DB_PASSWORD=s3cr3t

# API — loaded locally via `node --env-file=../.env`
# Local (non-Docker) runs connect to Postgres on localhost.
# Inside Docker Compose the API uses host "db" (set in docker-compose.yml).
DATABASE_URL=postgres://postgres:s3cr3t@localhost:5432/app
PORT=3000

# Optional: pino log level (defaults to debug in dev, info in production).
# LOG_LEVEL=info
```

Copy it to `.env` for local work: `cp .env.example .env`. The API fails fast if `.env` is missing (strict
`--env-file`), and `db/client.ts` throws if `DATABASE_URL` is unset — there is no hardcoded connection-string fallback.
`.env.example` is committed; `.env` is not.

## `docker-compose.yml`

```yaml
services:
  db:
    image: postgres:17-alpine
    restart: unless-stopped
    environment:
      - POSTGRES_PASSWORD=${DB_PASSWORD:-s3cr3t}
    ports:
      - '5432:5432'
    volumes:
      - ./api/db/data:/var/lib/postgresql/data # Persist data (host-bound)
      - ./api/db/scripts/init.sql:/docker-entrypoint-initdb.d/init.sql # Run init script on first start
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U postgres -d app']
      interval: 5s
      timeout: 5s
      retries: 10

  api:
    build:
      context: .
      dockerfile: api/Dockerfile
    restart: unless-stopped
    environment:
      DATABASE_URL: postgres://postgres:${DB_PASSWORD:-s3cr3t}@db:5432/app
      PORT: '3000'
    ports:
      - '3000:3000'
    depends_on:
      db:
        condition: service_healthy

  web:
    build:
      context: .
      dockerfile: web/Dockerfile
    restart: unless-stopped
    ports:
      - '4200:80'
    depends_on:
      - api
```

Notes:

- The build context is the repo root, not `./api` or `./web`: each manifest's `catalog:` entries resolve only against
  the root `pnpm-workspace.yaml` and `pnpm-lock.yaml`.
- The database **name** is `app` in both this file and `init.sql`. Change it in both places to use a different name.
- Inside the Compose network the API reaches Postgres by hostname `db`, not `localhost`.
- The web service maps `4200:80` because Nginx listens on 80 inside the container.
