# Nginx

Nginx as the server of a single-page app's static build: one `nginx.conf`, an SPA fallback, and no proxy.

## Use it like this

- **Static files only**: the image copies the app's built files into Nginx's root and serves them; there is no
  application server behind it.
- **An SPA fallback**: any path that is not a file serves `index.html`, so a deep link reaches the app's router.
- **No proxy**: the app calls its API by a URL fixed at build time, so Nginx forwards nothing.

## Required values

| What         | Value                                                                                         |
| ------------ | --------------------------------------------------------------------------------------------- |
| image        | `nginx:1.27-alpine`                                                                           |
| `nginx.conf` | `listen 80`, `root /usr/share/nginx/html`, `location / { try_files $uri $uri/ /index.html; }` |

## Pitfalls

- **Without `try_files … /index.html`**, a reload or a deep link to an app route answers 404.

## Conventions

- **Nginx serves the static build with an SPA fallback and proxies nothing.**

## Verify it is wired

- A request for an app route (not a file) answers 200 with `index.html`.
- `nginx.conf` has no `proxy_pass`.
