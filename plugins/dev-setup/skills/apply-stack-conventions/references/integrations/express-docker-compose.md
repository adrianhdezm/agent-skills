# Express + Docker Compose

An Express API's image and Compose service: compiled in the build stage, run from `dist/` with production dependencies
only, next to the database it waits for. REST API on Node and the Angular full stack use it.

## The seam

```
Dockerfile: build stage (node:24-alpine, corepack, frozen install, tsc build) ─► dist/
            runtime stage (node:24-alpine, --prod install, dist/) ─► CMD ["node", "dist/server.js"]
docker-compose.yml: migrate (same image, node dist/migrate.js) ─► depends_on db healthy, runs to completion
                    api (DATABASE_URL at host db, PORT, ports '${PORT:-3000}:3000') ─► depends_on migrate completed
```

- **The runtime stage runs the compiled server**: `dist/` and production dependencies only; `tsx`, `pino-pretty` and
  the compiler stay in the build stage.
- **Logs stay JSON in the container**: `pino-pretty` is a dev pipe, never part of the image's command.

## Required values

| What                | Value                                                                                                                  |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `Dockerfile`        | the Docker Compose doc's compiled API image, as given: `--ignore-scripts` on both installs, since nothing runs esbuild |
| `migrate` and `api` | the Docker Compose doc's two services, as given; in a workspace, `build` names the API's Dockerfile from the repo root |

## Pitfalls

- **`start` with `--env-file`** fails in the container, where there is no `.env`: the image's `CMD` runs `node` directly
  and Compose provides the environment.
- **A missing migration** fails the first request with "relation does not exist": the `migrate` service runs them
  before the API starts.
- **An image without `db/migrations/`** fails the `migrate` service: `.dockerignore` leaves out `db/data` only, never
  all of `db`.

## Conventions

- **The API image runs `node dist/server.js` with production dependencies only**, its configuration from Compose.

## Verify it is wired

- `pnpm compose:up` on an empty database brings `db` up healthy, runs `migrate` to exit code 0, then brings `api` up,
  and `GET /health` answers `ok`.
