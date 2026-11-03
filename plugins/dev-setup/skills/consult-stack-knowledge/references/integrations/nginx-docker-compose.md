---
type: Integration
title: Nginx + Docker Compose
description: 'a static web image: a Node build, then Nginx; its Compose service'
connects: [nginx, docker-compose]
---
# Nginx + Docker Compose

A static web app's image: built on `node:24-alpine`, served from `nginx:1.27-alpine`, and run as a Compose service.
The Angular stacks use it; any app whose build is static files can.

## The seam

```
Dockerfile: build stage (node:24-alpine, corepack, frozen install, build) ─► runtime stage (nginx:1.27-alpine)
            COPY <static build> /usr/share/nginx/html   COPY nginx.conf /etc/nginx/conf.d/default.conf
docker-compose.yml: web (ports '<host>:80') ─► the browser calls the API at its own published port
```

- **The runtime stage is Nginx alone**: no runtime package install, no app server; only the static files and
  `nginx.conf`.
- **Nginx listens on 80 inside the container**; Compose publishes it on the app's host port.

## Required values

| What          | Value                                                                                                                                      |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| build stage   | as the Docker Compose doc's, ending with the framework's static build                                                                      |
| runtime stage | `FROM nginx:1.27-alpine`; `COPY <static build> /usr/share/nginx/html`; `COPY <pkg>/nginx.conf /etc/nginx/conf.d/default.conf`; `EXPOSE 80` |
| service       | `build` from the repo root in a workspace; ports `'<host port>:80'`                                                                        |

## Pitfalls

- **`nginx.conf` copied to `/etc/nginx/nginx.conf`** replaces the main config and drops its `http` block: copy it to
  `conf.d/default.conf`.
- **A runtime stage that still installs packages** carries a Node toolchain it never uses: the static files are all it
  needs.

## Reference code

`<pkg>/Dockerfile`, with `<pkg>` = `web`: a Node build of the web inside a workspace (every package's manifest copied
so the frozen lockfile resolves, `--filter web`), then Nginx serving the static build, here `web/dist/web/browser`:

```dockerfile
FROM node:24-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY api/package.json ./api/
COPY web/package.json ./web/
RUN pnpm install --filter web --frozen-lockfile
COPY web ./web
RUN pnpm --filter web build

FROM nginx:1.27-alpine
COPY --from=build /app/web/dist/web/browser /usr/share/nginx/html
COPY web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

Its Compose service, beside the services of the API the browser calls: it publishes Nginx's port 80 on the app's host
port and starts once `api` is healthy:

```yaml
  web:
    build:
      context: .
      dockerfile: web/Dockerfile
    restart: unless-stopped
    ports:
      - '${WEB_PORT:-4200}:80'
    depends_on:
      api:
        condition: service_healthy
```

## Conventions

- **A static web image is two stages: a Node build, then Nginx serving the files** with the SPA fallback.
- **Its Compose service publishes port 80 on the app's host port.**

## Verify it is wired

- The running container answers an app route (not a file) with `index.html`, and `docker image ls` shows an image with
  no `node_modules`.
