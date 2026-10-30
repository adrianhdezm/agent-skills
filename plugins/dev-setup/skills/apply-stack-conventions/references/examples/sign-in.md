# Sign in

Email and password sign-in on a React Router app: sign up, log in, a protected page that knows who is signed in, and
log out, with the redirect and error behaviour a later protected route relies on. Both React Router stacks start with
it when authentication is picked; it builds on React Router home and needs the database entry.

## Demonstrates

| Part                                                  | Applies                                                                                                                                        |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/lib/auth.ts`, `workers/app.ts`, `app/context.ts` | Better Auth (`createAuth`, `AppAuth`), Better Auth + React Router (built by the server entry onto `appContext`)                                |
| the auth tables and the `init` migration              | Better Auth + Drizzle, [Database](../architecture/database.md) (generated, committed, applied before the app serves)                           |
| `routes/auth.tsx`                                     | Better Auth + React Router (the `api/auth/*` splat)                                                                                            |
| `routes/signup.tsx`, `login.tsx`, `logout.tsx`        | Better Auth + React Router (Conform forms, the reference login action), [Authentication](../architecture/authentication.md)                    |
| the protected layout and `routes/account.tsx`         | Better Auth + React Router (middleware array, `userContext`), [Authentication](../architecture/authentication.md) (protected layouts)          |
| `safeRedirectTo` in `app/lib/utils.ts`                | [Authentication](../architecture/authentication.md) (safe redirects)                                                                           |
| the forms                                             | React Router + shadcn/ui (`input`, `label`, `button`, `card`), [UI components](../architecture/ui-components.md) (labels and accessible names) |

## Data

| What          | Value                                                                                                         |
| ------------- | ------------------------------------------------------------------------------------------------------------- |
| routes        | `api/auth/*` (splat), `/signup`, `/login`, `/logout` (action only), and `/account` under the protected layout |
| signup fields | `name` (required), `email` (an email), `password` (at least 8 characters)                                     |
| login fields  | `email`, `password`; `redirectTo` from the query string                                                       |
| account page  | the heading "Account" and "Signed in as `<email>`", with a "Sign out" button posting to `/logout`             |
| auth tables   | `user`, `session`, `account`, `verification`, with uuid ids (`advanced.database.generateId: 'uuid'`)          |

## Behaviour

- An anonymous request for `/account` redirects to `/login?redirectTo=%2Faccount`.
- Signing up creates the user and redirects to `/login` (no automatic sign-in). An email already taken also redirects
  to `/login`, as Better Auth answers it with automatic sign-in off, so sign-up does not reveal which emails exist.
- A right password redirects to the safe `redirectTo` (or `/`) with the session cookie set; a wrong one answers the
  login page again with "Invalid email or password" and no password in its HTML.
- A `redirectTo` that is absolute or starts with `//` is ignored: the redirect goes to `/`.
- `/account` shows the signed-in user's email, read from `userContext`; signing out clears the session and redirects
  to `/login`, after which `/account` redirects again.

## Tests

| Tier          | File                                 | Covers                                                                                         |
| ------------- | ------------------------------------ | ---------------------------------------------------------------------------------------------- |
| unit, browser | `tests/unit/lib/utils.test.ts`       | `safeRedirectTo` keeps `/account`, turns `//evil.com`, `https://evil.com` and nothing into `/` |
| unit, browser | `tests/unit/routes/login.test.tsx`   | the form's labelled fields; an action error shows on the form                                  |
| unit, browser | `tests/unit/routes/account.test.tsx` | the email a stubbed loader returns, and the Sign out button                                    |

## Done when

The stack's checks pass, and against the built app on an empty, migrated database: `/account` redirects anonymously,
sign-up then log-in sets a cookie and lands on `/account` with the email shown, a wrong password stays on the login page
with the error and no password in the HTML, `//evil.com` as `redirectTo` lands on `/`, and log-out ends the session.
