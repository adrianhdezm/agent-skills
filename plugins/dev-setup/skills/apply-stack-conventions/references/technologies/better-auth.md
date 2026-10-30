# Better Auth

Better Auth with email and password: the library that owns credentials and sessions, built where the runtime allows,
its endpoints behind one handler, and a secret that never changes.

**Realises:** [Authentication](../architecture/authentication.md)

## Use it like this

- **Email and password**, `emailAndPassword: { enabled: true, autoSignIn: false }`, over a database adapter; its tables
  (`user`, `session`, `account`, `verification`) live in the app's schema and change through migrations like any
  other table.
- **One factory builds it**: `createAuth(…)` holds the `betterAuth` options and the database adapter, and exports
  `type AppAuth = ReturnType<typeof createAuth>`, which the app's context uses (`auth: AppAuth`). The server entry calls
  it where the runtime allows: inside the request handler where configuration exists only per request, with `baseURL`
  taken from the request's URL; once at module scope where the process lives on, with `baseURL` from `BETTER_AUTH_URL`.
- **Its endpoints are one handler**: every request under `api/auth/` goes to `auth.handler(request)`.
- **Sessions are read with `auth.api.getSession({ headers })`**; sign-out is `auth.api.signOut({ headers,
asResponse: true })`.

## Required values

| What         | Value                                                                                                                                                                                 |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| dependencies | `better-auth`                                                                                                                                                                         |
| options      | `emailAndPassword: { enabled: true, autoSignIn: false }`; `session.cookieCache: { enabled: true, maxAge: 5 * 60 }`; `advanced.cookiePrefix: 'App'`                                    |
| secret       | `AUTH_SECRET` from `openssl rand -base64 32`, in the platform's secret store or the git-ignored env file; an empty `AUTH_SECRET=` in `.env.example`                                   |
| base URL     | per request, the request's origin; where the process lives on, `BETTER_AUTH_URL` (the app's public URL), the variable the library itself reads, in `.env.example` and the app service |
| context      | `auth: AppAuth`, with `export type AppAuth = ReturnType<typeof createAuth>` beside the factory                                                                                        |

## Pitfalls

- **A handler mounted on `api/auth` alone**, not everything under it, makes every sub-endpoint 404.
- **A cookie prefix that differs between server and client** makes `getSession` return `null`, silently.
- **`ReturnType<typeof betterAuth>` is the unconfigured type**: a configured instance is not assignable to it (TS2345).
  Type the context from the factory instead.
- **Unapplied auth migrations** fail the first request with "no such table".
- **A changed `AUTH_SECRET`** invalidates every session: keep it the same across environments.
- **Built at module scope where configuration exists only per request**, it has no secret to read: build it inside the
  handler.

## Conventions

- **Better Auth is built by one factory, `createAuth`, which only the server entry calls**; everything else reaches it
  through the app's context.
- **Its tables change through migrations.**
- **Every request under `api/auth/` goes to its handler.**
- **`AUTH_SECRET` is never committed** and stays the same across environments.
