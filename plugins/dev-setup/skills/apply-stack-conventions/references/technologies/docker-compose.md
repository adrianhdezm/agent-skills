# Docker Compose

How apps and the services they need run in containers: small, reproducible images built in two stages, one Compose file
at the root, healthchecked services, and one root `.env` feeding them at run time.

## Use it like this

### Images

- **Two stages: build, then run.** The build stage installs every dependency and builds; the runtime stage starts from
  a clean base, installs production dependencies only, and copies just the build output. Compilers, dev dependencies
  and sources never reach the image that runs.
- **Base images are pinned to a tag** (`node:24-alpine`), never `latest`, so a rebuild next month is the same image.
- **Layers are ordered for the cache**: the manifests, lockfile and workspace file are copied and installed first, the
  sources after, so a code change does not reinstall dependencies.
- **Installs are reproducible**: `--frozen-lockfile`, and `corepack enable` taking the package manager's version from
  the root `packageManager`, so no Dockerfile names a version.
- **In a workspace, every image builds from the repo root** (`context: .`, `dockerfile: <pkg>/Dockerfile`), because
  `catalog:` entries resolve only against the root `pnpm-workspace.yaml` and lockfile. It copies the root manifests
  plus its own, and installs with `--filter <pkg>`. One root `.dockerignore` serves every image.
- **Nothing secret is baked in.** `.env` is docker-ignored, no `ARG` or `ENV` carries a credential, and the running
  container gets its configuration from Compose or the platform.
- **The runtime stage runs as a non-root user** where its base image provides one (`USER node`), sets
  `NODE_ENV=production`, `EXPOSE`s its one port, and starts one process in exec form (`CMD ["node", "…"]`), so signals
  reach the process and it shuts down cleanly.
- **Install scripts the image never needs are skipped** with `--ignore-scripts`, where `allowBuilds` would otherwise
  download binaries for nothing.

### Compose

- **One `docker-compose.yml` at the repo root**, with one service per app image and one per service the apps need. It
  runs the production images locally; development runs the apps on the host against the same services.
- **A service the apps depend on has a healthcheck**, so `docker compose up --wait` returns only once it is ready, and
  the app services wait for it with `depends_on: { <service>: { condition: service_healthy } }`.
- **Data is bind-mounted** under the package that owns it, not a named volume: it is easy to inspect and to reset, and
  it is git-ignored and docker-ignored.
- **One root `.env` feeds Compose and the apps.** Compose substitutes `${VAR:-default}` from it. Inside the Compose
  network a service is reached by its service name, not `localhost`, so an app service sets its own URLs.
- **Host ports come from `.env`** where they may clash (`'${PORT:-3000}:3000'`); the container port stays fixed.
- **Scripts**: `compose:up` (`docker compose up --build -d --wait`) and `compose:down`. Not `up` / `down`, which the
  package manager takes for itself.
- **Check the ports first** (each service's and each app's); stop with the user when one is taken, or move the app's
  host port in `.env`. Never stop a stack you did not start.

## Required values

| What            | Value                                                                                                                                                                       |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| base image      | `node:24-alpine` to build and run                                                                                                                                           |
| build stage     | `corepack enable`; copy the manifests, lockfile and workspace file; `pnpm install --frozen-lockfile`; copy the sources; build                                               |
| runtime stage   | `corepack enable`; copy the manifests; `pnpm install --prod --frozen-lockfile`; copy the build; `ENV NODE_ENV=production`; `USER node`; `EXPOSE <port>`; `CMD` in exec form |
| scripts         | `compose:up` `docker compose up --build -d --wait`; `compose:down` `docker compose down`                                                                                    |
| `.dockerignore` | `node_modules` and build output at any depth, `.git`, `.env`, every bind-mounted data folder, test output                                                                   |

## Pitfalls

- **`up --wait` reports a service with no healthcheck as healthy once its process starts**, and a one-shot service as
  exited without its code: neither proves the app answers. The smoke test's request does, and
  `docker compose ps -a --format '{{.Service}} {{.ExitCode}}'` shows each exit code.
- **Without a healthcheck, `up --wait` returns while a service still refuses connections**, and a step run straight
  after fails on a cold machine.
- **A per-package build context cannot see the catalog**, and the install fails inside the image.
- **Sources copied before the install** invalidate the dependency layer on every change, and each build reinstalls
  everything.
- **`CMD node …` in shell form** runs under a shell that swallows `SIGTERM`: the container is killed after the grace
  period instead of shutting down.
- **A harness may refuse to write `.env` or `.env.example`.** Give the user the contents, list it under **Blocked on
  me**, and carry on with every step that does not read it.

## Conventions

- **Images are two-stage**: build with everything, run with production dependencies and the build output only.
- **Base images are pinned to a tag; installs use the lockfile and Corepack.**
- **No secret is baked into an image**; configuration arrives at run time.
- **The runtime stage runs one process, as a non-root user where the base image has one, in exec form.**
- **`pnpm compose:up` runs the production images** (`docker compose up --build -d --wait`) next to the services they
  need; `pnpm compose:down` stops them. Development runs the apps on the host against the same services.
- **One root `.env`** (git-ignored) feeds Compose and the apps; `.env.example` is committed and lists every variable.
- **Inside Compose, a service is reached by its service name**; on the host, at `localhost` and its published port.
- **Data is bind-mounted and git-ignored**; reset a service by deleting its folder.

## Verify it is wired

- `docker compose up --build -d --wait` brings every service up healthy.
- Each runtime image holds no dev dependency and no `.env`, and its `CMD` is in exec form.
