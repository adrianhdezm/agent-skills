# Better Auth + React Router

Better Auth inside a React Router app: built by the server entry onto `appContext`, its endpoints as one splat route,
sessions read by the protected layout's middleware, and credentials forms in Conform with Zod 4. The React Router stacks
use it once they add sign-in.

## The seam

```
workers/app.ts ─► createAuth(db, { secret, baseURL }) ─► appContext.auth      (app/lib/auth.ts: betterAuth({ … }))
app/routes.ts: route('api/auth/*', 'routes/auth.tsx') ─► loader/action return auth.handler(request)
protected layout middleware ─► auth.api.getSession({ headers: request.headers }) ─► userContext, or redirect to /login
login / signup actions ─► parseWithZod ─► auth.api.signInEmail / signUpEmail ─► redirect(safeRedirectTo(…))
```

## Where it lives

| File                                               | Holds                                                                   |
| -------------------------------------------------- | ----------------------------------------------------------------------- |
| `app/lib/auth.ts`                                  | `createAuth(db, …)`: the `betterAuth` options and adapter; `AppAuth`    |
| `workers/app.ts`                                   | calls `createAuth` per request on Workers, once at module scope on Node |
| `app/context.ts`                                   | `auth: AppAuth` on `appContext`; `userContext`                          |
| `app/routes/auth.tsx`                              | the splat route's loader and action                                     |
| `app/routes/login.tsx`, `signup.tsx`, `logout.tsx` | the credentials forms and sign-out                                      |
| the protected layout route                         | `export const middleware: Route.MiddlewareFunction[] = [requireUser]`   |
| `app/lib/utils.ts`                                 | `safeRedirectTo`                                                        |

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
- **`signInEmail` and `signUpEmail` with `asResponse: true` do not throw on bad credentials**: they return a 4xx
  response. An action that only catches errors redirects a wrong password as if it had signed in: check
  `response.ok`.
- **`submission.reply()` sends the submitted values back**, so a failed sign-in renders the password into the page's
  HTML: reply with `{ hideFields: ['password'] }`.
- **The session cookie is on the sign-in response**: redirect with `{ headers: response.headers }`, or the browser
  arrives signed out.

## Reference code

`app/lib/auth.ts` on Postgres (`provider: 'sqlite'`, and the request's origin as `baseURL`, on D1):

```ts
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';

import type { DbClient } from '~/db/client';
import { schema } from '~/db/schema';

/** Builds Better Auth over the app's Drizzle client; only the server entry calls it. */
export function createAuth(db: DbClient, options: { secret: string; baseURL: string }) {
  return betterAuth({
    secret: options.secret,
    baseURL: options.baseURL,
    database: drizzleAdapter(db, {
      provider: 'pg',
      schema: {
        ...schema,
        user: schema.users,
        session: schema.sessions,
        account: schema.accounts,
        verification: schema.verifications
      }
    }),
    emailAndPassword: { enabled: true, autoSignIn: false },
    session: { cookieCache: { enabled: true, maxAge: 5 * 60 } },
    advanced: { cookiePrefix: 'App', database: { generateId: 'uuid' } }
  });
}

export type AppAuth = ReturnType<typeof createAuth>;
```

`app/lib/credentials.ts`, the schemas both the forms and the actions parse with:

```ts
import { z } from 'zod/v4';

export const loginSchema = z.object({
  email: z.email('Enter a valid email'),
  password: z.string('Password is required').min(1, 'Password is required')
});

export const signupSchema = z.object({
  name: z.string('Name is required').min(1, 'Name is required'),
  email: z.email('Enter a valid email'),
  password: z.string('Password is required').min(8, 'Use at least 8 characters')
});

/** The error body Better Auth answers a failed credentials call with. */
export const errorBodySchema = z.object({ message: z.string().optional() });
```

`app/routes/protected.tsx`, the layout every signed-in route sits under:

```tsx
import { Outlet, redirect } from 'react-router';

import { appContext, userContext } from '~/context';

import type { Route } from './+types/protected';

/** Authenticates once for every route under this layout; an anonymous request goes to the login page. */
const requireUser: Route.MiddlewareFunction = async ({ request, context }, next) => {
  const session = await context.get(appContext).auth.api.getSession({ headers: request.headers });
  if (!session) {
    const url = new URL(request.url);
    throw redirect(`/login?redirectTo=${encodeURIComponent(url.pathname + url.search)}`);
  }
  context.set(userContext, { id: session.user.id, name: session.user.name, email: session.user.email });
  return next();
};

export const middleware: Route.MiddlewareFunction[] = [requireUser];

export default function Protected() {
  return <Outlet />;
}
```

The forms are two small components, a login form and a signup form, each with its own `useForm` over its own schema
(`getFormProps`, `getInputProps`, `getZodConstraint` from `@conform-to/zod/v4`); one component shared by both needs
casts, since the schemas' fields differ. `app/routes/login.tsx`'s server half; signup is the same with `signUpEmail` and its own schema:

```tsx
const errorBodySchema = z.object({ message: z.string().optional() });

export async function action({ request, context }: Route.ActionArgs) {
  const submission = parseWithZod(await request.formData(), { schema: loginSchema });
  if (submission.status !== 'success') {
    return { result: submission.reply({ hideFields: ['password'] }), formError: undefined };
  }
  const response = await context
    .get(appContext)
    .auth.api.signInEmail({ body: submission.value, headers: request.headers, asResponse: true });
  if (!response.ok) {
    const body = errorBodySchema.parse(await response.json());
    return { result: submission.reply({ hideFields: ['password'] }), formError: body.message ?? 'Could not sign in' };
  }
  return redirect(safeRedirectTo(new URL(request.url).searchParams.get('redirectTo')), { headers: response.headers });
}
```

## Conventions

- **Better Auth is built by `createAuth` in `app/lib/auth.ts`**, called from `workers/app.ts` (per request on Workers,
  once on Node), and reached as `context.get(appContext).auth`.
- **Its endpoints are the `api/auth/*` splat route**; login, signup and logout are ordinary routes outside the protected
  layout.
- **The protected layout's middleware reads the session once** and puts the user on `userContext`; loaders and actions
  under it read the user from there.
- **Credentials forms parse with `@conform-to/zod/v4`**; redirect targets pass through `safeRedirectTo`.

## Verify it is wired

- `app/routes.ts` registers `api/auth/*` as a splat, and `login`, `signup`, `logout` outside the protected layout.
- The protected layout exports its middleware as an array that redirects an anonymous request to `/login?redirectTo=…`.
- A wrong password answers the login page again with an error and no password in its HTML; a right one redirects with
  a `Set-Cookie` header.
