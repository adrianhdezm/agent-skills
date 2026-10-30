# Better Auth

Better Auth with email and password: the library that owns credentials and sessions, built where the runtime allows,
its endpoints behind one handler, and a secret that never changes.

**Realises:** [Authentication](../architecture/authentication.md)

## Use it like this

- **Email and password**, `emailAndPassword: { enabled: true, autoSignIn: false }`, over a database adapter; its tables
  (`user`, `session`, `account`, `verification`) live in the app's schema and change through migrations like any
  other table.
- **Built where the runtime allows**: inside the request handler where configuration exists only per request, with
  `baseURL` taken from the request's URL; once at module scope where the process lives on. Either way it goes on the
  app's context as `auth: ReturnType<typeof betterAuth>`.
- **Its endpoints are one handler**: every request under `api/auth/` goes to `auth.handler(request)`.
- **Sessions are read with `auth.api.getSession({ headers })`**; sign-out is `auth.api.signOut({ headers,
asResponse: true })`.

## Required values

| What         | Value                                                                                                                                               |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| dependencies | `better-auth`                                                                                                                                       |
| options      | `emailAndPassword: { enabled: true, autoSignIn: false }`; `session.cookieCache: { enabled: true, maxAge: 5 * 60 }`; `advanced.cookiePrefix: 'App'`  |
| secret       | `AUTH_SECRET` from `openssl rand -base64 32`, in the platform's secret store or the git-ignored env file; an empty `AUTH_SECRET=` in `.env.example` |
| context      | `auth: ReturnType<typeof betterAuth>`                                                                                                               |

## Pitfalls

- **A handler mounted on `api/auth` alone**, not everything under it, makes every sub-endpoint 404.
- **A cookie prefix that differs between server and client** makes `getSession` return `null`, silently.
- **Unapplied auth migrations** fail the first request with "no such table".
- **A changed `AUTH_SECRET`** invalidates every session: keep it the same across environments.
- **Built at module scope where configuration exists only per request**, it has no secret to read: build it inside the
  handler.

## Conventions

- **Better Auth is built by the server entry** and reached through the app's context; no other file constructs it.
- **Its tables change through migrations.**
- **Every request under `api/auth/` goes to its handler.**
- **`AUTH_SECRET` is never committed** and stays the same across environments.
