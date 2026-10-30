# React Router + Vite

React Router's framework mode as a Vite plugin: `reactRouter()` last among the plugins, the `~/` alias through the
TypeScript paths, the client types, and the virtual server build declared before the first build. Both React Router
stacks use it.

## The seam

```
vite.config.ts: [runtime plugin?, …, reactRouter()] + resolve.tsconfigPaths
react-router dev / build ─► Vite ─► the client build and the server build (virtual:react-router/server-build)
app/env.d.ts ─► @react-router/dev/vite/env ─► the virtual module's types before any build exists
```

## Where it lives

| File             | Holds                                                                              |
| ---------------- | ---------------------------------------------------------------------------------- |
| `vite.config.ts` | `reactRouter()` from `@react-router/dev/vite`, last; `resolve.tsconfigPaths: true` |
| `app/env.d.ts`   | `/// <reference types="@react-router/dev/vite/env" />`                             |
| runtime tsconfig | `"vite/client"` in `types`, beside the runtime's                                   |

## Required values

| What         | Value                                                                                                                         |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| dependencies | dev `vite`                                                                                                                    |
| plugins      | the runtime's plugin first where there is one, then the styling plugin, then `reactRouter()`                                  |
| aliases      | `resolve.tsconfigPaths: true`, so `~/` comes from the runtime project's `paths`                                               |
| commands     | `react-router dev` and `react-router build` drive Vite; `vite preview` serves a build where the runtime's integration says so |

## Pitfalls

- **`virtual:react-router/server-build` cannot be found** on a fresh clone without `app/env.d.ts`.
- **`reactRouter()` before another plugin** leaves that plugin's transform out of the route build: it comes last.

## Conventions

- **`reactRouter()` is the last Vite plugin**; the `~/` alias reaches Vite through `resolve.tsconfigPaths`.
- **`app/env.d.ts` declares the virtual server build**, so a fresh clone type-checks before its first build.

## Verify it is wired

- `vite.config.ts` ends its plugins with `reactRouter()` and sets `resolve.tsconfigPaths`.
- `app/env.d.ts` exists and `pnpm typecheck` passes on a fresh clone.
