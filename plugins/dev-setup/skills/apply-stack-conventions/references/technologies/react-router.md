# React Router

React Router 8 in framework mode, server-rendered: routes whose loaders and actions are the backend, a typed context,
and generated route types.

## Use it like this

- **Framework mode, `ssr: true`** (`react-router.config.ts`). Routes live in `app/routes/` and are declared in
  `app/routes.ts`; loaders and actions are the backend. React Router 8's defaults need no `future` flags.
- **The context is typed and explicit.** `app/context.ts` exports `appContext = createContext<…>()` with everything
  loaders and actions need (the runtime's bindings or the server's configuration, later a database client); routes
  read it with `context.get(appContext)`. React Router 8's middleware context is always on: no `AppLoadContext`, no
  plain-object context.
- **Route types are generated.** `react-router typegen` (and the dev server) write `.react-router/types`; route modules
  import `Route` from `./+types/<route>`. `typecheck` runs `react-router typegen` before `tsc -b`, so a fresh clone
  checks.
- **The app files**: `app/root.tsx` exports `Layout` (the document: `<Meta />`, `<Links />`, `<ScrollRestoration />`,
  `<Scripts />`), a default `App` rendering `<Outlet />`, and an `ErrorBoundary` that shows 404s, other route error
  responses, and the message and stack of an `Error` in development only; it imports `./app.css`.
  `app/entry.server.tsx` streams the document (reference code below). `public/favicon.ico` is a placeholder.
- **Imports inside `app/` use the `~/` alias** (`paths: { "~/*": ["./app/*"] }` in the runtime project); a route module imports its own `+types` relatively.
- **A route component is tested through `createRoutesStub`** with stubbed `loader` and `action`, so data flows through
  the router as in production; tests mirror `app/` in `tests/unit/` and render in a real browser.

## Required values

| Where                | Value                                                                                                                                                                                                                                                                                                                    |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| dependencies         | `react`, `react-dom`, `react-router`, `isbot`                                                                                                                                                                                                                                                                            |
| devDependencies      | `@react-router/dev`, `@types/react`, `@types/react-dom`                                                                                                                                                                                                                                                                  |
| runtime tsconfig     | `include`: `.react-router/types/**/*`, `app`, `workers` and the target's files; `lib: ["ES2024", "DOM", "DOM.Iterable"]`; `jsx: "react-jsx"`; `rootDirs: [".", "./.react-router/types"]`; `paths: { "~/*": ["./app/*"] }`; `module: "ESNext"`, `moduleResolution: "bundler"`; `types`: the target's and the build tool's |
| `tsconfig.test.json` | extends the runtime project, adds `tests` to `include`, its own `tsBuildInfoFile`                                                                                                                                                                                                                                        |
| `tsconfig.node.json` | includes `react-router.config.ts` and the build and test configs                                                                                                                                                                                                                                                         |
| `typecheck`          | `react-router typegen && tsc -b`, after any runtime type generator                                                                                                                                                                                                                                                       |
| `dev` / `build`      | `react-router dev`, or a custom server that runs the app / `react-router build`                                                                                                                                                                                                                                          |
| `.gitignore`         | `build/`, `.react-router/`                                                                                                                                                                                                                                                                                               |

## Pitfalls

- **`root.tsx` without both `Layout` and a default export renders a blank page** with nothing in the browser console.
- **`./+types/home` cannot be found** when `typecheck` skips `react-router typegen`.
- **`createRoutesStub` returns loosely typed values**: tests assign them without a type of their own.

## Reference code

**`app/entry.server.tsx`**, the same on every runtime that has `renderToReadableStream`:

```tsx
import { isbot } from 'isbot';
import { renderToReadableStream } from 'react-dom/server';
import { type EntryContext, ServerRouter } from 'react-router';

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext
) {
  let shellRendered = false;
  const userAgent = request.headers.get('user-agent');

  const body = await renderToReadableStream(<ServerRouter context={routerContext} url={request.url} />, {
    onError(error: unknown) {
      responseStatusCode = 500;
      // Errors in the initial shell reject and are logged by React Router; log only those that stream in later.
      if (shellRendered) {
        console.error(error);
      }
    }
  });
  shellRendered = true;

  // Bots and SPA mode get the whole document at once, so crawlers see the content.
  if ((userAgent && isbot(userAgent)) || routerContext.isSpaMode) {
    await body.allReady;
  }

  responseHeaders.set('Content-Type', 'text/html');
  return new Response(body, { headers: responseHeaders, status: responseStatusCode });
}
```

## Conventions

### Routes

- **A route module's filename describes its role, not its URL syntax**; the URL lives in `app/routes.ts`.
- **Loaders read, actions write.** Every mutation goes through an action; a loader never changes state.
- **Middleware only for cross-cutting request work** (auth, logging, headers), not for one route's data.
- **Types come from `./+types/<route>`** (`Route.LoaderArgs`, `Route.ActionArgs`, `Route.ComponentProps`); they are
  generated, never written by hand.
- **Redirects and HTTP errors are thrown** (`throw redirect(…)`, `throw data(…, { status: 404 })`).
- **Every screen has its empty, loading and error states**: an `ErrorBoundary` where the root one says too little, and
  pending UI from `useNavigation` or `useFetcher` for slow actions.
- **Forms are `<Form>` posting to the route's action**; validation happens in the action and its errors come back
  through `actionData`. With Conform and Zod 4, import `@conform-to/zod/v4`, not the top-level `@conform-to/zod`.
- **Imports inside `app/` use `~/`.**

### Testing

| Location                 | Kind | Runs in  | Tests                                            |
| ------------------------ | ---- | -------- | ------------------------------------------------ |
| `tests/unit/lib/`        | unit | Chromium | pure functions                                   |
| `tests/unit/components/` | unit | Chromium | a component's render and interaction             |
| `tests/unit/routes/`     | unit | Chromium | a route component with stubbed loader and action |

- **Route components render through `createRoutesStub`** with `loader` and `action` stubs. To show an action's result
  without submitting (a file input, say), pass `hydrationData={{ actionData: … }}`.
- **Do not test** React Router itself, or primitives a registry provides.
