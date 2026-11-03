# Technologies

* [pnpm](pnpm.md) - the manifest, `allowBuilds`, workspaces and the catalog, held-back versions
* [TypeScript](typescript.md) - one project per runtime, checking without emitting, the 6.0.x pin
* [ESLint](eslint.md) - flat config, type-checked rules, the shared rules, framework presets
* [Prettier](prettier.md) - the shared config and the stacks' plugins
* [Vitest](vitest.md) - one config of named projects, picking an environment, how tests are written
* [Node](node.md) - running TypeScript as it is, `--env-file`, the dev loop
* [Docker Compose](docker-compose.md) - two-stage images, healthchecked services, the root `.env`
* [Hono](hono.md) - the server entry every server stack's runtime drives
* [Cloudflare Workers](cloudflare-workers.md) - Wrangler, the compatibility date, the runtime types, secrets
* [React Router](react-router.md) - framework mode, the context, routes, route tests
* [Tailwind](tailwind.md) - utilities only, one global stylesheet with the theme, the build wiring per framework
* [shadcn](shadcn.md) - the CLI, registries, `components.json` aliases and the `paths` they need
* [Vite](vite.md) - one `vite.config.ts`, plugin order, aliases from `tsconfig` `paths`, client types
* [Storybook](storybook.md) - a story file beside every component, one story per state, on the app's Vite builder
* [Nginx](nginx.md) - static files with an SPA fallback and no proxy
* [Angular](angular.md) - the CLI and its cleanup, signal components, two tiers of tests, a static build
* [NgRx](ngrx.md) - route-driven state and the request rules
* [Express](express.md) - the app factory, controllers, the error shape
* [Pino](pino.md) - one JSON logger, `LOG_LEVEL`, errors as `{ err }`, `pino-pretty` as a dev pipe only
* [Postgres](postgres.md) - the pool, `DATABASE_URL`, column types, transactions, test containers
* [Cloudflare D1](cloudflare-d1.md) - the binding, a client per request, SQLite column types, `db.batch()`, Wrangler migrations
* [Drizzle](drizzle.md) - the client, migrations, the DAO layer and its typed list queries
* [Better Auth](better-auth.md) - email and password over the Drizzle adapter, the splat route, sessions, secret
* [Cloudflare R2](cloudflare-r2.md) - the bucket binding, its generated type, what `put()` takes
* [S3 storage](s3-storage.md) - the AWS SDK v3 client, the `S3_*` settings, RustFS in Compose
