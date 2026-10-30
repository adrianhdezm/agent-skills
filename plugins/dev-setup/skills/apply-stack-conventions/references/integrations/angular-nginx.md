# Angular + Nginx

The Angular build served by Nginx: the browser bundle copied into Nginx's root, the router reached through the SPA
fallback, and the API called directly. Both Angular stacks use it.

## The seam

```
ng build ─► dist/<name>/browser ─► image: nginx:1.27-alpine /usr/share/nginx/html + nginx.conf ─► try_files … /index.html ─► the Angular router
```

## Required values

| What         | Value                                                                                                                                                     |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dockerfile   | a build stage on `node:24-alpine` with Corepack running `ng build`; a runtime stage on `nginx:1.27-alpine` copying `dist/<name>/browser` and `nginx.conf` |
| `nginx.conf` | the Nginx doc's, beside the package's `Dockerfile`                                                                                                        |

## Conventions

- **The production image serves `dist/<name>/browser` from Nginx** with the SPA fallback; the API base URL is
  build-time configuration, so Nginx proxies nothing.

## Verify it is wired

- The image answers 200 with the app's `<title>` for `/entities` (an app route, not a file).
