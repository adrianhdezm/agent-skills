---
type: Technology
title: Nginx
description: static files with an SPA fallback and no proxy
resource: https://nginx.org
role: runtime
detect:
  files: [nginx.conf]
aliases: [Nginx, nginx]
stale_after: 2027-05-01T00:00:00Z
sources:
  - id: nginx-image
    resource: https://hub.docker.com/_/nginx
    title: The official nginx image and its tags
---
# Nginx

Nginx as the server of a single-page app's static build: one `nginx.conf`, an SPA fallback, and no proxy.

## Use it like this

- **Static files only**: the image copies the app's built files into Nginx's root and serves them; there is no
  application server behind it.
- **An SPA fallback**: any path that is not a file serves `index.html`, so a deep link reaches the app's router.
- **No proxy**: the browser calls the API directly, so Nginx forwards nothing.

## Required values

| What         | Value                                                                                         |
| ------------ | --------------------------------------------------------------------------------------------- |
| image        | `nginx:1.27-alpine`[^nginx-image]                                                             |
| `nginx.conf` | `listen 80`, `root /usr/share/nginx/html`, `location / { try_files $uri $uri/ /index.html; }` |

## Pitfalls

- **Without `try_files … /index.html`**, a reload or a deep link to an app route answers 404.

## Conventions

- **Nginx serves the static build with an SPA fallback and proxies nothing**: `nginx.conf` has no `proxy_pass`.

[^nginx-image]: The official nginx image and its tags
