# React Router on Workers

A server-rendered React Router app whose server is a Hono Worker on Cloudflare's edge, styled with Tailwind and
shadcn/ui. No database is wired: D1, R2 and KV arrive later as bindings.

## Composition

- [Code style](../architecture/code-style.md)
- [pnpm](../technologies/pnpm.md)
- [TypeScript](../technologies/typescript.md)
- [Database](../architecture/database.md)
- [Data access](../architecture/data-access.md)
- [Authentication](../architecture/authentication.md) — optional (authentication)
- [Better Auth](../technologies/better-auth.md) — optional (authentication)
- [Better Auth + Drizzle](../integrations/better-auth-drizzle.md) — optional (authentication)
- [Better Auth + React Router](../integrations/better-auth-react-router.md) — optional (authentication)
- [File storage](../architecture/file-storage.md) — optional (file-storage)
- [UI components](../architecture/ui-components.md)
- [React Router](../technologies/react-router.md)
- [Vite](../technologies/vite.md)
- [React Router + Vite](../integrations/react-router-vite.md)
- [Tailwind](../technologies/tailwind.md)
- [shadcn](../technologies/shadcn.md)
- [React Router + shadcn/ui](../integrations/react-router-shadcn.md)
- [Hono](../technologies/hono.md)
- [Hono + React Router](../integrations/hono-react-router.md)
- [Storybook](../technologies/storybook.md) — optional (storybook)
- [React Router + Storybook](../integrations/react-router-storybook.md) — optional (storybook)
- [Cloudflare Workers](../technologies/cloudflare-workers.md)
- [Cloudflare Workers + Vite](../integrations/cloudflare-workers-vite.md)
- [Hono + Cloudflare Workers](../integrations/hono-cloudflare-workers.md)
- [React Router + Drizzle](../integrations/react-router-drizzle.md)
- [Cloudflare D1](../technologies/cloudflare-d1.md) — optional (database)
- [Drizzle](../technologies/drizzle.md) — optional (database)
- [Drizzle + Cloudflare D1](../integrations/drizzle-d1.md) — optional (database)
- [Cloudflare R2](../technologies/cloudflare-r2.md) — optional (file-storage)
- [ESLint](../technologies/eslint.md)
- [TypeScript + ESLint](../integrations/typescript-eslint.md)
- [Prettier](../technologies/prettier.md)
- [ESLint + Prettier](../integrations/eslint-prettier.md)
- [React Router + ESLint](../integrations/react-router-eslint.md)
- [React Router + Prettier](../integrations/react-router-prettier.md)
- [Vitest](../technologies/vitest.md)
- [React Router + Vitest](../integrations/react-router-vitest.md)

## Examples

- [React Router home](../examples/react-router-home.md): the home route reading `APP_NAME` from the bindings

## Shape

```
my-app/
├── .gitignore / .prettierignore / .prettierrc
├── coding-conventions.md      # assembled from the stack blueprint
├── components.json            # shadcn/ui
├── eslint.config.js
├── package.json / pnpm-lock.yaml / pnpm-workspace.yaml
├── react-router.config.ts
├── tsconfig.json              # solution file, plus `paths` for the shadcn CLI
├── tsconfig.cloudflare.json   # app/ and workers/: workerd and the browser
├── tsconfig.node.json         # the config files
├── tsconfig.test.json         # the runtime project plus tests/: Chromium
├── vite.config.ts / vitest.config.ts
├── worker-configuration.d.ts  # generated; committed
├── wrangler.jsonc
├── app/
│   ├── app.css / context.ts / entry.server.tsx / env.d.ts / root.tsx / routes.ts
│   ├── components/ui/         # the shadcn primitives
│   ├── lib/utils.ts           # cn
│   └── routes/
├── public/favicon.ico
├── tests/unit/                # mirrors app/
└── workers/app.ts             # the Worker: Hono → React Router
```

## Required values

| What                       | Value                                                                                                                                                                                                                                                                                  |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| scripts                    | `dev` `react-router dev`; `build` `react-router build`; `preview`, `deploy`, `cf-typegen`; `typecheck` `wrangler types && react-router typegen && tsc -b`; `lint` `eslint .`; `test` `vitest run`; `format`, `format:check`                                                            |
| `allowBuilds`              | `esbuild`, `workerd`                                                                                                                                                                                                                                                                   |
| dependencies               | the React Router set and the shadcn/ui packages from their docs; `hono`                                                                                                                                                                                                                |
| devDependencies            | the React Router, Vite and shadcn/ui docs' dev packages; the shared tooling with `eslint@9` and `@eslint/js@9`, `globals`, the React lint plugins, the Prettier plugins, the Vitest browser packages, `playwright`; `wrangler`, `@cloudflare/vite-plugin`, and the pinned `typescript` |
| `wrangler.jsonc`           | `main: "./workers/app.ts"`, `vars: { "APP_NAME": "<App name>" }`, `observability: { "enabled": true }`                                                                                                                                                                                 |
| `vite.config.ts`           | `cloudflare({ viteEnvironment: { name: 'ssr' } })`, `tailwindcss()`, `reactRouter()`, in that order                                                                                                                                                                                    |
| `tsconfig.cloudflare.json` | includes `worker-configuration.d.ts`; `types: ["./worker-configuration.d.ts", "vite/client"]`                                                                                                                                                                                          |
| `.gitignore`               | `node_modules/`, `build/`, `.react-router/`, `.wrangler/`, `.env`, `*.tsbuildinfo`, `.DS_Store`                                                                                                                                                                                        |
| `.prettierignore`          | `pnpm-lock.yaml`, `worker-configuration.d.ts`                                                                                                                                                                                                                                          |

## Scaffold

- **`pnpm exec playwright install chromium`** after the install, once.
- **Run `pnpm cf-typegen`** once the configs are written, before the app code.
- **Add the shadcn primitives after the app files**, then check none landed in a `~` folder.

## Conventions

### Layout

| Path              | Holds                                                                   |
| ----------------- | ----------------------------------------------------------------------- |
| `workers/app.ts`  | the Worker: builds the context per request and hands it to React Router |
| `app/context.ts`  | `appContext`: the bindings and the execution context                    |
| `app/routes/`     | route modules, declared in `app/routes.ts`                              |
| `app/components/` | app components; `app/components/ui/` the shadcn primitives              |
| `app/lib/`        | pure helpers                                                            |
| `tests/unit/`     | mirrors `app/`; runs in Chromium                                        |

### Commands

`pnpm dev` serves the app in workerd; `pnpm preview` runs the production build; `pnpm deploy` ships it.
`pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` and `pnpm format:check` are the five required checks.

### Before you merge

- [ ] The five checks pass.
- [ ] Every new route has a unit test.
- [ ] A new binding is in `wrangler.jsonc`, `worker-configuration.d.ts` is regenerated and committed, and the binding
      reaches routes through `app/context.ts`.

## Smoke test

`pnpm exec vite preview --port <free port>` runs the build in workerd: `/` renders the welcome heading (proving the
loader read `APP_NAME` from the bindings), the stylesheet it links answers 200, and an unknown path answers 404.
