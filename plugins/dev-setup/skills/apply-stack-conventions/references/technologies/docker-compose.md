# Docker Compose

How apps and the services they need run in containers: one Compose file at the root, healthchecked services, one root
`.env`, and production images built in two stages.

## Use it like this

- **One `docker-compose.yml` at the repo root**, with one service per app image and one per service the apps need. It
  runs the production images locally; development runs the apps on the host against the same services.
- **A service the apps depend on has a healthcheck**, so `docker compose up --wait` returns only once it is ready, and
  the app services wait for it with `depends_on: { <service>: { condition: service_healthy } }`.
- **Data is bind-mounted** under the package that owns it, not a named volume: it is easy to inspect and to reset, and
  it is git-ignored and docker-ignored.
- **One root `.env` feeds Compose and the apps.** Compose substitutes `${VAR:-default}` from it. Inside the Compose
  network a service is reached by its service name, not `localhost`, so an app service sets its own URLs.
- **Images are multi-stage on `node:24-alpine`**: a build stage installs with `--frozen-lockfile` and builds, a
  runtime stage installs production dependencies only and copies the build. `corepack enable` takes the package
  manager's version from the root `packageManager`, so no Dockerfile names it. A static web app ends in
  `nginx:1.27-alpine`.
- **In a workspace, every image builds from the repo root** (`context: .`, `dockerfile: <pkg>/Dockerfile`), because
  `catalog:` entries resolve only against the root `pnpm-workspace.yaml` and lockfile. It copies the root manifests
  plus its own, and installs with `--filter <pkg>`. One root `.dockerignore` serves every image.
- **Scripts**: `compose:up` (`docker compose up --build -d --wait`) and `compose:down`. Not `up` / `down`, which the
  package manager takes for itself.
- **Check the ports first** (each service's and each app's); stop with the user when one is taken, or move the app's
  host port in `.env`. Never stop a stack you did not start.

## Required values

| What            | Value                                                                                                     |
| --------------- | --------------------------------------------------------------------------------------------------------- |
| base images     | `node:24-alpine` to build and run; `nginx:1.27-alpine` for static files                                   |
| scripts         | `compose:up` `docker compose up --build -d --wait`; `compose:down` `docker compose down`                  |
| `.dockerignore` | `node_modules` and build output at any depth, `.git`, `.env`, every bind-mounted data folder, test output |

## Pitfalls

- **Without a healthcheck, `up --wait` returns while a service still refuses connections**, and a step run straight
  after fails on a cold machine.
- **A per-package build context cannot see the catalog**, and the install fails inside the image.
- **`--ignore-scripts` in the image** skips install scripts the build and runtime never need; use it where `allowBuilds`
  would otherwise have to download binaries for nothing.
- **A harness may refuse to write `.env` or `.env.example`.** Give the user the contents, list it under **Blocked on
  me**, and carry on with every step that does not read it.

## Conventions

- **`pnpm compose:up` runs the production images** (`docker compose up --build -d --wait`) next to the services they
  need; `pnpm compose:down` stops them. Development runs the apps on the host against the same services.
- **One root `.env`** (git-ignored) feeds Compose and the apps; `.env.example` is committed and lists every variable.
- **Inside Compose, a service is reached by its service name**; on the host, at `localhost` and its published port.
- **Data is bind-mounted and git-ignored**; reset a service by deleting its folder.
- **Images build from the repo root** in a workspace, with Corepack taking the package manager's version from
  `packageManager`.
