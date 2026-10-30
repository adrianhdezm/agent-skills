# React Router + Docker Compose

A server-rendered React Router app's image and Compose service: built in two stages, run from `server.ts` with
production dependencies only, next to the services it needs. React Router on Node uses it.

## The seam

```
Dockerfile: build stage (node:24-alpine, corepack, frozen install, react-router build) ─► build/
            runtime stage (node:24-alpine, --prod install, build/ + server.ts) ─► CMD ["node", "server.ts"]
docker-compose.yml: migrate (same image, node migrate.ts; once a database is added) ─► depends_on db healthy, runs to completion
                    app (build: ., env from .env, ports '${PORT:-3000}:3000') ─► depends_on migrate completed (db healthy before)
```

- **The runtime stage runs `server.ts` over `build/`**: with `NODE_ENV=production` the server takes its production
  branch, which needs only the server packages, so the dev dependencies (Vite among them) never reach the image.
- **Configuration arrives from Compose**: the app service sets its own URLs for the services it reaches by name, and
  passes the app's variables through from `.env`.

## Required values

| What            | Value                                                                                                                                                                                                                                                                                                                                     |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| build stage     | the Docker Compose doc's, building with `pnpm build`                                                                                                                                                                                                                                                                                      |
| runtime stage   | `pnpm install --prod --frozen-lockfile`; copy `build/` and `server.ts`; `ENV NODE_ENV=production`; `USER node`; `EXPOSE 3000`; `CMD ["node", "server.ts"]`                                                                                                                                                                                |
| service `app`   | `build: .`; `environment`: the database URL at its service name, `APP_NAME: ${APP_NAME}`, `PORT: '3000'`; ports `'${PORT:-3000}:3000'`; `depends_on` the database being healthy, or, once Drizzle is added, `migrate` with `condition: service_completed_successfully`                                                                    |
| with a database | `migrate.ts` beside `server.ts`: Drizzle + Postgres's `src/migrate.ts` with the folder `./db/migrations`, in `tsconfig.node.json`; the runtime stage also copies `migrate.ts` and `db/migrations/`; a `migrate` service on the same `build`, `command: ['node', 'migrate.ts']`, the database URL, `depends_on` the database being healthy |
| `.dockerignore` | `**/node_modules`, `build`, `.react-router`, `.git`, `.env`, the data folders                                                                                                                                                                                                                                                             |

## Pitfalls

- **`NODE_ENV=development` in the image** sends the server down its dev branch, which imports Vite: the container fails
  without dev dependencies.
- **Sign-in with no `migrate` service** fails every request that reads a session ("relation does not exist") until
  someone runs `db:migrate` from the host.
- **A new environment variable missing from the service** works on the host, where `.env` is loaded, and is `undefined`
  in the container.

## Reference code

The `Dockerfile` with the database entry (without it, drop `migrate.ts` and `db/migrations`):

```dockerfile
FROM node:24-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --ignore-scripts
COPY . .
RUN pnpm build

FROM node:24-alpine
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --prod --frozen-lockfile --ignore-scripts
COPY --from=build /app/build ./build
COPY server.ts migrate.ts ./
COPY db/migrations ./db/migrations
ENV NODE_ENV=production
USER node
EXPOSE 3000
CMD ["node", "server.ts"]
```

The `migrate` and `app` services with every optional entry, beside the `db` and `rustfs` services; `app` reports
healthy once it serves its home page, so `up --wait` returns only when the app answers:

```yaml
  migrate:
    build: .
    command: ['node', 'migrate.ts']
    environment:
      DATABASE_URL: postgres://postgres:${DB_PASSWORD:-s3cr3t}@db:5432/app
    depends_on:
      db:
        condition: service_healthy
    restart: 'no'

  app:
    build: .
    restart: unless-stopped
    environment:
      DATABASE_URL: postgres://postgres:${DB_PASSWORD:-s3cr3t}@db:5432/app
      APP_NAME: ${APP_NAME}
      PORT: '3000'
      AUTH_SECRET: ${AUTH_SECRET}
      BETTER_AUTH_URL: ${BETTER_AUTH_URL:-http://localhost:3000}
      S3_ENDPOINT: http://rustfs:9000
      S3_ACCESS_KEY: ${S3_ACCESS_KEY}
      S3_SECRET_KEY: ${S3_SECRET_KEY}
      S3_BUCKET: ${S3_BUCKET:-app-files}
    ports:
      - '${PORT:-3000}:3000'
    depends_on:
      migrate:
        condition: service_completed_successfully
      rustfs:
        condition: service_started
    healthcheck:
      test: ['CMD-SHELL', 'wget -qO- http://localhost:3000/ >/dev/null || exit 1']
      interval: 5s
      timeout: 5s
      retries: 10
```

The server keeps its database pool for the life of the process and closes nothing on shutdown: `SIGTERM` ends the
process, and Postgres drops its connections.

## Conventions

- **The app image runs `node server.ts` over the build with production dependencies only.**
- **A new environment variable is in `.env.example` and, if the image needs it, in the `app` service.**

## Verify it is wired

- `pnpm compose:up` on an empty database brings the app up after its database (and, with Drizzle, after `migrate`
  exits 0), and the container serves the home page.
- The runtime image has no `vite` in its `node_modules`.
