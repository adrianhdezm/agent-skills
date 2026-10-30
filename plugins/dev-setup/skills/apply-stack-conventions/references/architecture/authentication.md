# Authentication

How users sign in and how the app decides what they may see: an established library owns sessions, the server entry
wires it, protected requests authenticate once, and each resource checks ownership where it is loaded. These rules apply
from the moment a project adds sign-in.

## Principles

- **An established library owns credentials and sessions.** No hand-rolled password hashing, tokens or session cookies,
  and no second session mechanism beside it.
- **Sessions live server-side, referenced by an HTTP-only cookie.** The session, user, account and verification tables
  are ordinary schema tables, created by a migration like any other, and exist before the server starts.
- **The server entry builds auth and puts it on the app's context**, like any capability: per request where the runtime
  exposes configuration only per request, once at module scope where the process lives on.
- **The library's endpoints are one catch-all route** (`api/auth/*`): a narrower path makes its sub-endpoints 404.
- **Authenticate once per request, in middleware that wraps the protected routes.** It reads the session, redirects an
  anonymous user to `/login?redirectTo=<path>`, and puts the user on the context; the handlers under it read the user
  from there and do not check again. Public routes (login, signup) sit outside it.
- **Authorize where the resource is loaded.** The handler that reads a resource id checks the user may see or change that
  resource before touching private data, and answers 404 for someone else's, so existence does not leak.
- **Redirects after sign-in go only to local paths**: a target that does not start with `/`, or starts with `//`, falls
  back to `/`.
- **Credentials forms validate on the server.** The handler parses the form against its schema and returns field and
  library errors with the page; a signed-in user who opens login or signup is redirected home. Sign-out is a POST.
- **The secret is generated, never committed, and stable.** `AUTH_SECRET` comes from `openssl rand -base64 32`, lives in
  the git-ignored env file or the platform's secret store with an empty placeholder in `.env.example`, and is the same
  across environments: a new secret ends every session. The cookie prefix the server sets is the one the client reads.
- **Tests**: the login and signup pages with stubbed handlers (errors shown, redirect target kept), and a protected
  route's redirect for an anonymous request.

## Conventions

- **One library owns credentials and sessions**; nothing else hashes passwords, issues tokens or sets session cookies.
- **Auth is built by the server entry and reached through the app's context**; its tables change through migrations.
- **Its endpoints are one catch-all route, `api/auth/*`.**
- **Protected routes sit under middleware that authenticates once** and puts the user on the context; the handlers under
  it read the user from there.
- **Ownership is checked in the handler that owns the resource id**, before any private data is read; someone else's
  resource is a 404.
- **Redirect targets are local paths only.**
- **Sign-out is a POST**; a signed-in user is redirected away from login and signup.
- **`AUTH_SECRET` is never committed** and stays the same across environments; `.env.example` holds an empty
  placeholder.

## Verify it is wired

- Every route that reads private data is under the authenticating middleware, or checks the session itself.
- Every handler taking a resource id checks ownership before reading the resource.
- The redirect-after-login helper rejects `//host` and absolute URLs.
- No `AUTH_SECRET` value in the repository; `.env.example` has the empty key.
