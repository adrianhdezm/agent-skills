---
kind: integration
connects: [node, docker-compose]
realises: []
unless: [react-router]
---
# Node + Docker Compose

A compiled Node service's image and Compose services: compiled in the build stage, run from `dist/` with production
dependencies only, next to the database it waits for. REST API on Node, Hono API on Node and the Angular full stack use
it; React Router on Node has its own image.

## The seam

```
Dockerfile: build stage (node:24-alpine, corepack, frozen install, tsc build) ─► dist/
            runtime stage (node:24-alpine, --prod install, dist/) ─► CMD ["node", "dist/server.js"]
docker-compose.yml: migrate (same image, node dist/migrate.js) ─► depends_on db healthy, runs to completion
                    api (DATABASE_URL at host db, PORT, ports '${PORT:-3000}:3000') ─► depends_on migrate completed
```

- **The runtime stage runs the compiled server**: `dist/` and production dependencies only; the compiler, the dev loop
  and the log pretty printer stay in the build stage.
- **Logs stay JSON in the container**: the pretty printer is a dev pipe, never part of the image's command.

## Required values

| What                | Value                                                                                                       |
| ------------------- | ----------------------------------------------------------------------------------------------------------- |
| `Dockerfile`        | the compiled image below, as given: `--ignore-scripts` on both installs, since nothing runs esbuild         |
| `migrate` and `api` | the two services below, as given; in a workspace, `build` names the service's Dockerfile from the repo root |
| `DATABASE_URL`      | on both services, at host `db` with the password and the database name Postgres + Docker Compose gives      |

## Pitfalls

- **`start` with `--env-file`** fails in the container, where there is no `.env`: the image's `CMD` runs `node` directly
  and Compose provides the environment.
- **A missing migration** fails the first request with "relation does not exist": the `migrate` service runs them
  before the service starts.
- **An image without `db/migrations/`** fails the `migrate` service: `.dockerignore` leaves out `db/data` only, never
  all of `db`.

## Reference code

A compiled API's `Dockerfile`, the same whatever framework it serves with: the build stage compiles `src/` to
`dist/`, the runtime stage keeps production dependencies, `dist/` and `db/migrations/`, and runs as `node`:

```dockerfile
FROM node:24-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --ignore-scripts
COPY tsconfig.json tsconfig.app.json ./
COPY src ./src
RUN pnpm build

FROM node:24-alpine
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --prod --frozen-lockfile --ignore-scripts
COPY --from=build /app/dist ./dist
COPY db/migrations ./db/migrations
ENV NODE_ENV=production
USER node
EXPOSE 3000
CMD ["node", "dist/server.js"]
```

Its two services beside the database's: `migrate` runs the image's migration entry once and exits, and `api` starts
after it and reports healthy only when its health route answers:

```yaml
  migrate:
    build: .
    command: ['node', 'dist/migrate.js']
    environment:
      DATABASE_URL: postgres://postgres:${DB_PASSWORD:-s3cr3t}@db:5432/app
    depends_on:
      db:
        condition: service_healthy
    restart: 'no'

  api:
    build: .
    restart: unless-stopped
    environment:
      DATABASE_URL: postgres://postgres:${DB_PASSWORD:-s3cr3t}@db:5432/app
      PORT: '3000'
    ports:
      - '${PORT:-3000}:3000'
    depends_on:
      migrate:
        condition: service_completed_successfully
    healthcheck:
      test: ['CMD-SHELL', 'wget -qO- http://localhost:3000/health >/dev/null || exit 1']
      interval: 5s
      timeout: 5s
      retries: 10
```

## Conventions

- **The service image runs `node dist/server.js` with production dependencies only**, its configuration from Compose.

## Verify it is wired

- `pnpm compose:up` on an empty database brings `db` up healthy, runs `migrate` to exit code 0, then brings `api` up,
  and `GET /health` answers `ok`.
