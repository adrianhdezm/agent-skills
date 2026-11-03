---
type: Architecture Concept
title: Authentication
description: the library that owns sessions, protected routes, safe redirects, sign-out
---
# Authentication

How users sign in: an established library owns sessions, the server entry wires it, and protected requests
authenticate once. What a signed-in user may then see and do is [Authorization](authorization.md). These rules apply
from the moment a project adds sign-in.

## Principles

- **An established library owns credentials and sessions**, because hashing, token entropy and cookie flags are easy to
  get subtly wrong and a library's are reviewed: no hand-rolled password hashing, tokens or session cookies, and no
  second session mechanism beside it.
- **Sessions live server-side, referenced by an HTTP-only cookie**, so a session can be revoked and its token never
  reaches page scripts. The library's tables are ordinary schema tables, created by a migration like any other, and
  exist before the server starts.
- **The server entry builds auth and puts it on the app's context**, like any capability, at the same scope as the
  database client (Data access).
- **The library's endpoints are mounted once, as a catch-all under one prefix**, so the app never enumerates them.
- **Authenticate once per request, in middleware that wraps the protected routes.** It reads the session, redirects an
  anonymous user to login with the path to return to, and puts the user on the context; the handlers under it read the
  user from there and do not check again. Public routes (login, signup) sit outside it.
- **Redirects after sign-in go only to local paths**, so a crafted sign-in link cannot send a user to another site: a
  target that does not start with `/`, or starts with `//`, falls back to `/`.
- **Credentials forms validate on the server**, because the client's checks can be skipped: the handler parses the form
  against its schema and returns field and library errors with the page.
- **A signed-in user who opens login or signup is redirected home**, so a stale tab cannot start a second session.
- **Sign-out is a POST**, so a link, a prefetch or an image tag cannot sign a user out.
- **The secret is generated, never committed, and stable.** It lives in the git-ignored env file or the platform's
  secret store, and is the same across environments: a new secret ends every session.
- **Tests cover what an attacker would try**: a rejected credential shows its error without saying which field was
  wrong and without the password in the page, the redirect target survives a failed attempt and is sanitised, and an
  anonymous request to a protected route is sent to login.

## Required values

| What                           | Value                                                                                                                                          |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| auth endpoints                 | `/api/auth/*`, one catch-all                                                                                                                   |
| anonymous on a protected route | redirect to `/login?redirectTo=<path>`                                                                                                         |
| sign-out                       | POST only                                                                                                                                      |
| secret                         | `AUTH_SECRET`, generated (`openssl rand -base64 32`), never committed, the same across environments; an empty `AUTH_SECRET=` in `.env.example` |

## Conventions

- **One library owns credentials and sessions**; nothing else hashes passwords, issues tokens or sets session cookies.
- **Auth is built by the server entry and reached through the app's context**; its tables change through migrations.
- **The library's endpoints are one catch-all route under `/api/auth/*`**; nothing else answers under it.
- **Protected routes sit under middleware that authenticates once** and puts the user on the context; the handlers under
  it read the user from there.
- **Redirect targets are local paths only.**
- **Sign-out is a POST**; a signed-in user is redirected away from login and signup.
- **`AUTH_SECRET` is never committed** and stays the same across environments; `.env.example` holds an empty
  placeholder.

## Verify it is wired

- Every route that reads private data is under the authenticating middleware.
- The redirect-after-login helper rejects `//host` and absolute URLs.
- No `AUTH_SECRET` value in the repository; `.env.example` has the empty key.
