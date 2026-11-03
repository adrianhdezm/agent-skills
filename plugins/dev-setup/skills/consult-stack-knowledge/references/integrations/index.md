# Integrations

* [Hono + React Router](hono-react-router.md) - one Hono handler builds the typed `appContext` and calls React Router
* [Hono + Cloudflare Workers](hono-cloudflare-workers.md) - the Hono app as the Worker, typed bindings, tests through `cloudflare:workers`
* [Hono + Node](hono-node.md) - `server.ts`: Vite middleware in development, `serveStatic` over the build
* [React Router + Tailwind](react-router-tailwind.md) - Tailwind's Vite plugin and its order, `app/app.css` with the theme tokens, the test setup
* [React Router + shadcn/ui](react-router-shadcn.md) - `components.json`, the aliases, the shadcn primitives, `cn`
* [React Router + Drizzle](react-router-drizzle.md) - routes → services → queries → DAOs, the client on `appContext`
* [Express + Drizzle](express-drizzle.md) - DAOs on the `AppContext`, list decoding, `NotFoundError` → 404
* [Express + Pino](express-pino.md) - `pino-http` first, `req.log` per request, errors logged once by the error handler
* [Hono + Drizzle](hono-drizzle.md) - DAOs on `c.var.context`, list decoding, `NotFoundError` → a 404 `HTTPException`, one `onError`
* [Hono + Pino](hono-pino.md) - a `requestLog` middleware on the shared logger, errors logged once by `onError`
* [Angular + the API contract](angular-api-contract.md) - build-time base URL, mirrored models, one list format, one error body
* [Angular + Fundamental NGX](angular-fundamental-ngx.md) - the Fiori registry under `components/ui/`, its ignores, its pitfalls
* [Node + TypeScript](node-typescript.md) - TypeScript run as it is by Node, or compiled by `tsc`; `.ts` versus `.js` imports
* [TypeScript + ESLint](typescript-eslint.md) - typed linting through the project service, the shared typed rules, the TypeScript ceiling
* [ESLint + Prettier](eslint-prettier.md) - `eslint-config-prettier` and its placement; lint versus format checks
* [React Router + ESLint](react-router-eslint.md) - the React and accessibility presets, the routes and tests overrides, ESLint 9
* [React Router + Prettier](react-router-prettier.md) - import and class sorting
* [React Router + Vite](react-router-vite.md) - `reactRouter()` last, the `~/` alias, `vite/client`, `app/env.d.ts`
* [React Router + Vitest](react-router-vitest.md) - route tests in browser mode through `createRoutesStub`
* [Angular + ESLint](angular-eslint.md) - angular-eslint presets, inline templates, selector prefixes
* [Angular + Prettier](angular-prettier.md) - the Angular parser for HTML
* [Angular + Vitest](angular-vitest.md) - Analog's builder, the `unit` and `browser` projects, `tsconfig.spec.json`
* [Angular + Tailwind](angular-tailwind.md) - PostCSS wiring, the layer imports, utilities plus a `host` class
* [Angular + Storybook](angular-storybook.md) - `@storybook/angular-vite` through Analog, `angular.json` targets, zoneless
* [Angular + Nginx](angular-nginx.md) - `dist/<name>/browser` in the Nginx image, the router behind the SPA fallback
* [React Router + Storybook](react-router-storybook.md) - `@storybook/react-vite` over the app's config without the React Router plugin
* [Cloudflare Workers + Vite](cloudflare-workers-vite.md) - the Cloudflare Vite plugin: dev server and build in workerd, `vite preview`
* [Cloudflare Workers + Vitest](cloudflare-workers-vitest.md) - tests in workerd through `cloudflare:workers`
* [Postgres + Docker Compose](postgres-docker-compose.md) - the `db` service, its healthcheck, `init.sql`, host `db`
* [Nginx + Docker Compose](nginx-docker-compose.md) - a static web image: a Node build, then Nginx; its Compose service
* [Node + Docker Compose](node-docker-compose.md) - the compiled service image, built then run from `dist/`; its `migrate` and `api` services
* [React Router + Docker Compose](react-router-docker-compose.md) - the app image running `server.ts` over the build; its `app` service
* [Drizzle + Postgres](drizzle-postgres.md) - the client on the pool, the `postgresql` dialect, Testcontainers
* [Drizzle + Cloudflare D1](drizzle-d1.md) - a client per request, the `sqlite` dialect, `db.batch()`, tests in workerd
* [Better Auth + Drizzle](better-auth-drizzle.md) - the auth tables in the schema, the adapter and its provider
* [Better Auth + React Router](better-auth-react-router.md) - auth on `appContext`, the splat route, the protected layout, Conform forms
* [S3 storage + Docker Compose](s3-storage-docker-compose.md) - RustFS as a Compose service
* [Drizzle + S3 storage](drizzle-s3-storage.md) - `FilesService`: object first and undone on failure, owner-scoped reads, delete row then object
