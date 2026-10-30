# React Router home

The first route of a React Router app: a home page whose loader reads a value the server entry put on the context,
rendered with a shadcn primitive, and the two tests every later route and helper copies. Both React Router stacks start
with it; only where the value comes from differs by runtime.

## Demonstrates

| Part                               | Applies                                                                                                                           |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `app/context.ts`, `workers/app.ts` | Hono + React Router (one handler, typed `appContext`), the runtime's integration                                                  |
| the home route's loader            | React Router (loaders read, `context.get(appContext)`, generated `+types`)                                                        |
| the home page                      | React Router + shadcn/ui (a primitive from `app/components/ui/`, theme tokens), [UI components](../architecture/ui-components.md) |
| `tests/unit/lib/utils.test.ts`     | Vitest (browser mode); proves the `~/` alias resolves under Vitest                                                                |
| `tests/unit/routes/home.test.tsx`  | React Router (`createRoutesStub` with a stubbed loader, queried by role)                                                          |

## Data

| What               | Value                                                               |
| ------------------ | ------------------------------------------------------------------- |
| route              | `/`, `app/routes/home.tsx`, declared in `app/routes.ts`             |
| loader returns     | `` `Welcome to ${APP_NAME}` ``                                      |
| page               | that message as the heading, a short paragraph, an outline `Button` |
| starter primitives | `button`, `input`, `label`, `card`                                  |
| `APP_NAME`         | the app name in Title Case                                          |

| Runtime | `APP_NAME` comes from                                                                          | `appContext` carries                                         |
| ------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Workers | `vars.APP_NAME` in `wrangler.jsonc`                                                            | `{ cloudflare: { env: Env; ctx: Context['executionCtx'] } }` |
| Node    | `process.env.APP_NAME`, read once at module scope; the server throws at start when it is unset | `{ env: { APP_NAME: string } }`                              |

## Behaviour

- The page renders the loader's message; nothing in the route reads the runtime directly.
- An unknown path answers 404 through the root `ErrorBoundary`.

## Tests

| Tier          | File                              | Covers                                                 |
| ------------- | --------------------------------- | ------------------------------------------------------ |
| unit, browser | `tests/unit/lib/utils.test.ts`    | `cn` merges classes, imported through `~/`             |
| unit, browser | `tests/unit/routes/home.test.tsx` | the heading shows the message a stubbed loader returns |

## Variants

- **With Storybook**: a story file beside each starter primitive (`app/components/ui/button.stories.tsx` and the
  rest), one story per state the primitive has; `pnpm build-storybook` lists them in `storybook-static/index.json`.

## Done when

The stack's checks pass, and the built app serves `/` with the welcome heading (proving the loader read `APP_NAME` from
the runtime), its stylesheet with a 200, and a 404 for an unknown path.
