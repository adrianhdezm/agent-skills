---
type: Integration
title: Angular + Nginx
description: '`dist/<name>/browser` in the Nginx image, the router behind the SPA fallback'
connects: [angular, nginx]
---
# Angular + Nginx

The Angular build served by Nginx: the browser bundle copied into Nginx's root, the router reached through the SPA
fallback, and the API called directly. Both Angular stacks use it.

## The seam

```
ng build ─► dist/<name>/browser ─► image: nginx:1.27-alpine /usr/share/nginx/html + nginx.conf ─► try_files … /index.html ─► the Angular router
```

## Required values

| What         | Value                                                                                                     |
| ------------ | --------------------------------------------------------------------------------------------------------- |
| static build | `ng build`, whose output is `dist/<name>/browser`                                                         |
| image        | the static web image (Nginx + Docker Compose) copies `dist/<name>/browser` and the package's `nginx.conf` |

## Conventions

- **The production image serves `dist/<name>/browser` from Nginx** with the SPA fallback.

## Verify it is wired

- The image answers 200 with the app's `<title>` for an app route (not a file).
