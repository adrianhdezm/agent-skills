# React Router + Docker Compose

A server-rendered React Router app's image and Compose service: built in two stages, run from `server.ts` with
production dependencies only, next to the services it needs. React Router on Node uses it.

## The seam

```
Dockerfile: build stage (node:24-alpine, corepack, frozen install, react-router build) ─► build/
            runtime stage (node:24-alpine, --prod install, build/ + server.ts) ─► CMD ["node", "server.ts"]
docker-compose.yml: app (build: ., env from .env, ports '${PORT:-3000}:3000') ─► depends_on db healthy
```

- **The runtime stage runs `server.ts` over `build/`**: with `NODE_ENV=production` the server takes its production
  branch, which needs only the server packages, so the dev dependencies (Vite among them) never reach the image.
- **Configuration arrives from Compose**: the app service sets its own URLs for the services it reaches by name, and
  passes the app's variables through from `.env`.

## Required values

| What            | Value                                                                                                                                                                           |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| build stage     | the Docker Compose doc's, building with `pnpm build`                                                                                                                            |
| runtime stage   | `pnpm install --prod --frozen-lockfile`; copy `build/` and `server.ts`; `ENV NODE_ENV=production`; `USER node`; `EXPOSE 3000`; `CMD ["node", "server.ts"]`                      |
| service `app`   | `build: .`; `environment`: the database URL at its service name, `APP_NAME: ${APP_NAME}`, `PORT: '3000'`; ports `'${PORT:-3000}:3000'`; `depends_on` the database being healthy |
| `.dockerignore` | `**/node_modules`, `build`, `.react-router`, `.git`, `.env`, the data folders                                                                                                   |

## Pitfalls

- **`NODE_ENV=development` in the image** sends the server down its dev branch, which imports Vite: the container fails
  without dev dependencies.
- **A new environment variable missing from the service** works on the host, where `.env` is loaded, and is `undefined`
  in the container.

## Conventions

- **The app image runs `node server.ts` over the build with production dependencies only.**
- **A new environment variable is in `.env.example` and, if the image needs it, in the `app` service.**

## Verify it is wired

- `pnpm compose:up` brings the app up after its database, and the container serves the home page.
- The runtime image has no `vite` in its `node_modules`.
