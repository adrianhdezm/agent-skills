# Better Auth + React Router

Better Auth inside a React Router app: built by the server entry onto `appContext`, its endpoints as one splat route,
sessions read by the protected layout's middleware, and credentials forms in Conform with Zod 4. The React Router stacks
use it once they add sign-in.

## The seam

```
workers/app.ts ─► betterAuth({ database: adapter, secret, baseURL, … }) ─► appContext.auth
app/routes.ts: route('api/auth/*', 'routes/auth.tsx') ─► loader/action return auth.handler(request)
protected layout middleware ─► auth.api.getSession({ headers: request.headers }) ─► userContext, or redirect to /login
login / signup actions ─► parseWithZod ─► auth.api.signInEmail / signUpEmail ─► redirect(safeRedirectTo(…))
```

## Where it lives

| File                                               | Holds                                                                  |
| -------------------------------------------------- | ---------------------------------------------------------------------- |
| `workers/app.ts`                                   | Better Auth built per request on Workers, once at module scope on Node |
| `app/context.ts`                                   | `auth: ReturnType<typeof betterAuth>` on `appContext`; `userContext`   |
| `app/routes/auth.tsx`                              | the splat route's loader and action                                    |
| `app/routes/login.tsx`, `signup.tsx`, `logout.tsx` | the credentials forms and sign-out                                     |
| the protected layout route                         | `export const middleware: Route.MiddlewareFunction[] = [requireUser]`  |
| `app/lib/utils.ts`                                 | `safeRedirectTo`                                                       |

## Required values

| What         | Value                                                                                               |
| ------------ | --------------------------------------------------------------------------------------------------- |
| dependencies | `zod@4`, `@conform-to/react`, `@conform-to/zod`                                                     |
| route        | `route('api/auth/*', 'routes/auth.tsx')`, a splat                                                   |
| forms        | `parseWithZod` from `@conform-to/zod/v4`, `z` from `zod/v4`                                         |
| middleware   | exported as an array, `Route.MiddlewareFunction[]`, from the layout that wraps the protected routes |
| secret       | `.env` locally; in production, the platform's secret store (`wrangler secret put` on Workers)       |

## Pitfalls

- **A non-splat auth route** (`api/auth`) makes every sub-endpoint 404.
- **The top-level `@conform-to/zod` import is the Zod 3 API**: import from `@conform-to/zod/v4`.
- **Login and signup nested under the protected layout** redirect to themselves: keep them outside it.
- **Middleware exported as a single function** cannot be composed and must call `next()`: export an array.

## Conventions

- **Better Auth is built in `workers/app.ts`** (per request on Workers, once on Node) and reached as
  `context.get(appContext).auth`.
- **Its endpoints are the `api/auth/*` splat route**; login, signup and logout are ordinary routes outside the protected
  layout.
- **The protected layout's middleware reads the session once** and puts the user on `userContext`; loaders and actions
  under it read the user from there.
- **Credentials forms parse with `@conform-to/zod/v4`**; redirect targets pass through `safeRedirectTo`.

## Verify it is wired

- `app/routes.ts` registers `api/auth/*` as a splat, and `login`, `signup`, `logout` outside the protected layout.
- The protected layout exports its middleware as an array that redirects an anonymous request to `/login?redirectTo=…`.
