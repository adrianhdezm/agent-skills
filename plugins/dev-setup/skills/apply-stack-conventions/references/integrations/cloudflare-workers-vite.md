# Cloudflare Workers + Vite

Vite as the dev server and the build of a Worker, through Cloudflare's Vite plugin: the dev server runs the Worker
inside workerd, the build writes what Wrangler deploys, and `vite preview` runs that build locally. The Hono Worker and
React Router on Workers use it.

## The seam

```
vite.config.ts: [cloudflare({ viteEnvironment: { name } }), …the framework's plugins]
vite dev (or the framework's dev command) ─► workerd, with wrangler.jsonc's bindings and .env's secrets
vite build ─► dist/ (with its own wrangler.json) ─► wrangler deploy
vite preview ─► the build, in workerd, locally
```

- **`@cloudflare/vite-plugin` runs the dev server inside workerd** and writes the deployable build, so development
  and production run in the same runtime.
- **`cloudflare({ viteEnvironment: { name } })` is the first Vite plugin**: `worker` for a plain Worker, the
  framework's server environment (`ssr`) under a framework.
- **`preview` runs the production build locally**: `pnpm run build && vite preview`.

## Required values

| What         | Value                                                                                                                        |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| dependencies | dev `vite`, `@cloudflare/vite-plugin`                                                                                        |
| plugin       | `cloudflare({ viteEnvironment: { name: 'worker' } })` for a plain Worker, `'ssr'` under a framework; first in `plugins`      |
| scripts      | `dev` `vite dev` (or the framework's); `build` `vite build` (or the framework's); `preview` `pnpm run build && vite preview` |
| source maps  | `environments.<name>.build.sourcemap: true` for a plain Worker                                                               |

## Pitfalls

- **No `assets` key in `wrangler.jsonc`**: the plugin writes the asset settings into the build's own `wrangler.json`.
- **The plugin placed after the framework's** leaves the framework's server build outside workerd: it comes first.

## Conventions

- **`pnpm dev` runs the Worker in workerd**; `pnpm preview` runs the production build in workerd; `pnpm deploy` ships it.
- **Vite builds the Worker; Wrangler only deploys it.**

## Verify it is wired

- `vite.config.ts` lists `cloudflare(…)` first, with the environment name the stack needs.
- `pnpm preview` serves the built Worker locally.
