# Cloudflare Workers

What every Worker shares: Wrangler's config, the compatibility date, the runtime types, its scripts and its secrets.

## Use it like this

- **Wrangler configures, types and deploys the Worker.** The local runtime and the build come from the build tool's
  integration; Wrangler never runs the dev server (no `wrangler dev`), and nothing starts from
  `pnpm create cloudflare`, whose templates bring settings these stacks do not use.
- **`wrangler.jsonc`, not TOML**: it takes comments, and its `$schema` gives completion.
- **Wrangler owns the runtime types.** `wrangler types` writes `worker-configuration.d.ts` (the `Env` interface and the
  workerd globals) from `wrangler.jsonc`. It is committed, as Cloudflare recommends, so a fresh clone has the types and
  a binding change shows in review. No `@cloudflare/workers-types`.
- **The type check regenerates the types first**: `typecheck` is `wrangler types && tsc -b`, so a changed binding can
  never be checked against a stale `Env`; `cf-typegen` runs `wrangler types` alone.
- **The runtime project lists the generated file in `types` and `include`**: `["./worker-configuration.d.ts"]`, plus
  the framework's client types under a framework. The config files' project never sees the Worker's globals.
- **Plain configuration goes in `vars`; secrets never do.** Locally, secrets go in the git-ignored `.env`, which Wrangler
  and the local runtime load; in production, `wrangler secret put`. There is no `.dev.vars`.
- **`deploy` builds, then ships**: `pnpm run build && wrangler deploy`.

## Required values

| `wrangler.jsonc` key  | Value                                                  |
| --------------------- | ------------------------------------------------------ |
| `$schema`             | `./node_modules/wrangler/config-schema.json`           |
| `name`                | the package name                                       |
| `compatibility_date`  | the day the project is created, in UTC (`date -u +%F`) |
| `compatibility_flags` | `["nodejs_compat"]`                                    |
| `main`                | the Worker's entry file                                |
| `upload_source_maps`  | `true`                                                 |

| Script       | Value                                                                  |
| ------------ | ---------------------------------------------------------------------- |
| `cf-typegen` | `wrangler types`                                                       |
| `typecheck`  | `wrangler types && tsc -b`, with any other type generator between them |
| `deploy`     | `pnpm run build && wrangler deploy`                                    |

`allowBuilds` adds `workerd: true` (it downloads its binary in an install script). `.gitignore` adds `.wrangler/` and
`.env`; linters and formatters ignore `worker-configuration.d.ts`, which is generated.

## Pitfalls

- **A `.dev.vars` file makes Wrangler ignore `.env`**: with both present, only `.dev.vars` is read and the secrets in
  `.env` vanish. Keep secrets in `.env` and create no `.dev.vars`.
- **A compatibility date later than today in UTC** fails the dev server and the tests with
  `ERR_FUTURE_COMPATIBILITY_DATE`; a local date already tomorrow in UTC breaks the first run. Set it with `date -u +%F`,
  then move it forward on purpose, never automatically. If the installed workerd is older than the date,
  `wrangler types` generates types for the newest date it supports; that is expected.
- **`nodejs_compat`** is on by default from compatibility date 2026-08-04; the flag stays so the Worker does not
  depend on the date for it.
- **`DOM` beside the runtime types** conflicts in a plain Worker; under a framework that renders in the browser, the
  generated runtime types sit beside `DOM` without conflict.
- **A stale `Env`**: after any change to `wrangler.jsonc`, run `pnpm cf-typegen` (or `pnpm typecheck`).

## Conventions

- **Bindings live in `wrangler.jsonc`**; after changing it, run `pnpm cf-typegen` and commit
  `worker-configuration.d.ts`. Never hand-write `Env`.
- **`pnpm typecheck` regenerates the runtime types before checking.**
- **Secrets go in the git-ignored `.env` locally** and `wrangler secret put` in production, never in `wrangler.jsonc`
  and never in a `.dev.vars`.
- **`compatibility_date` moves forward on purpose**, in its own change, after reading what the new date changes.
- **`pnpm deploy` builds and ships the Worker.**
