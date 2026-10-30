# Cloudflare Workers

What every Worker shares: Wrangler's config, the compatibility date, the runtime types, the Vite plugin and secrets.

## Use it like this

- **Vite builds and serves the Worker.** `@cloudflare/vite-plugin` runs `vite dev` (or the framework's dev command)
  inside workerd and writes the deployable build; `wrangler deploy` ships it. Never `wrangler dev`, and never
  `pnpm create cloudflare`: its templates bring settings these stacks do not use.
- **`cloudflare({ viteEnvironment: { name: '<environment>' } })` is the first Vite plugin**: `worker` for a plain
  Worker, the framework's server environment (`ssr`) under a framework.
- **`wrangler.jsonc`, not TOML**: it takes comments, and its `$schema` gives completion.
- **Wrangler owns the runtime types.** `wrangler types` writes `worker-configuration.d.ts` (the `Env` interface and
  the workerd globals) from `wrangler.jsonc`. It is committed, as Cloudflare recommends, so a fresh clone has the types
  and a binding change shows in review; `typecheck` regenerates it first, and `cf-typegen` runs it alone. No
  `@cloudflare/workers-types`.
- **The runtime project lists it in `types` and `include`**: `["./worker-configuration.d.ts"]`, plus the framework's
  client types under a framework. The config files' project never sees the Worker's globals.
- **Plain configuration goes in `vars`; secrets never do.** Secrets go in `.dev.vars` locally (git-ignored) and
  `wrangler secret put` in production.
- **Scripts**: `cf-typegen` (`wrangler types`), `preview` (`pnpm run build && vite preview`: the build running in
  workerd locally) and `deploy` (`pnpm run build && wrangler deploy`).

## Required values

| `wrangler.jsonc` key  | Value                                                  |
| --------------------- | ------------------------------------------------------ |
| `$schema`             | `./node_modules/wrangler/config-schema.json`           |
| `name`                | the package name                                       |
| `compatibility_date`  | the day the project is created, in UTC (`date -u +%F`) |
| `compatibility_flags` | `["nodejs_compat"]`                                    |
| `main`                | the Worker's entry file                                |
| `upload_source_maps`  | `true`                                                 |

`allowBuilds` adds `workerd: true` (it downloads its binary in an install script). `.gitignore` adds `.wrangler/` and
`.dev.vars*`; linters and formatters ignore `worker-configuration.d.ts`, which is generated.

## Pitfalls

- **A compatibility date later than today in UTC** fails the dev server and the tests with
  `ERR_FUTURE_COMPATIBILITY_DATE`; a local date already tomorrow in UTC breaks the first run. Set it with `date -u +%F`,
  then move it forward on purpose, never automatically. If the installed workerd is older than the date,
  `wrangler types` generates types for the newest date it supports; that is expected.
- **`nodejs_compat`** is on by default from compatibility date 2026-08-04; the flag stays so the Worker does not
  depend on the date for it.
- **No `assets` key**: the Vite plugin writes the asset settings into the build's own `wrangler.json`.
- **`DOM` beside the runtime types** conflicts in a plain Worker; under a framework that renders in the browser, the
  generated runtime types sit beside `DOM` without conflict.
- **A stale `Env`**: after any change to `wrangler.jsonc`, run `pnpm cf-typegen` (or `pnpm typecheck`).

## Conventions

- **Bindings live in `wrangler.jsonc`**; after changing it, run `pnpm cf-typegen` and commit
  `worker-configuration.d.ts`. Never hand-write `Env`.
- **Secrets go in `.dev.vars` locally** (git-ignored) and `wrangler secret put` in production, never in
  `wrangler.jsonc`.
- **`compatibility_date` moves forward on purpose**, in its own change, after reading what the new date changes.
- **`pnpm preview` runs the production build in workerd**; `pnpm deploy` ships it.
