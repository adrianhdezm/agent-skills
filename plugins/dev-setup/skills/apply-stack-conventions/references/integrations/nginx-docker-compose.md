# Nginx + Docker Compose

A static web app's image: built on `node:24-alpine`, served from `nginx:1.27-alpine`, and run as a Compose service that
waits for the API it calls. The Angular stacks use it; any app whose build is static files can.

## The seam

```
Dockerfile: build stage (node:24-alpine, corepack, frozen install, build) ─► runtime stage (nginx:1.27-alpine)
            COPY <static build> /usr/share/nginx/html   COPY nginx.conf /etc/nginx/conf.d/default.conf
docker-compose.yml: web (ports '<host>:80', depends_on the API) ─► the browser calls the API at its own published port
```

- **The runtime stage is Nginx alone**: no runtime package install, no app server; only the static files and
  `nginx.conf`.
- **Nginx listens on 80 inside the container**; Compose publishes it on the app's host port.
- **The web service depends on the API it calls**, so `up --wait` brings them up in order; the browser still calls the
  API directly, at its own published port.

## Required values

| What          | Value                                                                                                                                      |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| build stage   | as the Docker Compose doc's, ending with the framework's static build                                                                      |
| runtime stage | `FROM nginx:1.27-alpine`; `COPY <static build> /usr/share/nginx/html`; `COPY <pkg>/nginx.conf /etc/nginx/conf.d/default.conf`; `EXPOSE 80` |
| service       | `build` from the repo root in a workspace; ports `'<host port>:80'`; `depends_on` the API service                                          |

## Pitfalls

- **`nginx.conf` copied to `/etc/nginx/nginx.conf`** replaces the main config and drops its `http` block: copy it to
  `conf.d/default.conf`.
- **A runtime stage that still installs packages** carries a Node toolchain it never uses: the static files are all it
  needs.

## Conventions

- **A static web image is two stages: a Node build, then Nginx serving the files** with the SPA fallback.
- **Its Compose service publishes port 80 on the app's host port** and depends on the API it calls.

## Verify it is wired

- The running container answers an app route (not a file) with `index.html`, and `docker image ls` shows an image with
  no `node_modules`.
