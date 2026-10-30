# Express + Docker Compose

An Express API's image and Compose service: compiled in the build stage, run from `dist/` with production dependencies
only, next to the database it waits for. REST API on Node and the Angular full stack use it.

## The seam

```
Dockerfile: build stage (node:24-alpine, corepack, frozen install, tsc build) ─► dist/
            runtime stage (node:24-alpine, --prod install, dist/) ─► CMD ["node", "dist/server.js"]
docker-compose.yml: api (DATABASE_URL at host db, PORT, ports '${PORT:-3000}:3000') ─► depends_on db healthy
```

- **The runtime stage runs the compiled server**: `dist/` and production dependencies only; `tsx`, `pino-pretty` and
  the compiler stay in the build stage.
- **Logs stay JSON in the container**: `pino-pretty` is a dev pipe, never part of the image's command.

## Required values

| What          | Value                                                                                                                                                           |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| build stage   | the Docker Compose doc's, with `--ignore-scripts` (nothing in the build or runtime runs esbuild), building with the package's `build`                           |
| runtime stage | `pnpm install --prod --frozen-lockfile --ignore-scripts`; copy `dist/`; `ENV NODE_ENV=production`; `USER node`; `EXPOSE 3000`; `CMD ["node", "dist/server.js"]` |
| service `api` | `build` from the repo root; `environment`: `DATABASE_URL` at host `db`, `PORT: '3000'`; ports `'${PORT:-3000}:3000'`; `depends_on` `db` being healthy           |

## Pitfalls

- **`start` with `--env-file`** fails in the container, where there is no `.env`: the image's `CMD` runs `node` directly
  and Compose provides the environment.
- **A missing migration** fails the first request with "relation does not exist": migrations run before the API serves.

## Conventions

- **The API image runs `node dist/server.js` with production dependencies only**, its configuration from Compose.

## Verify it is wired

- `pnpm compose:up` brings `api` up after `db` is healthy, and `GET /health` answers `ok`.
