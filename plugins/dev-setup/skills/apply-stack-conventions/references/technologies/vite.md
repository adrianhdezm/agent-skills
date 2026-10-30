# Vite

Vite as the dev server and the build: one `vite.config.ts`, plugins in a deliberate order, path aliases from the
`tsconfig` `paths`, and the client types for what Vite injects.

## Use it like this

- **One `vite.config.ts`**, in `tsconfig.node.json`'s `include`. The test runner and the component workshop have
  configs of their own and never load this one as it is.
- **Plugin order is part of the config**: a runtime's plugin comes first, a framework's last; each integration says
  where its plugin sits.
- **Path aliases come from the `tsconfig` `paths`**: `resolve.tsconfigPaths: true`, so `paths` is written once and Vite,
  the editor and the type check agree.
- **Environments**: the client is the default; a server or runtime build is a named environment (`ssr`, or a runtime's
  own), configured under `environments.<name>`.
- **Client types**: the project whose code Vite builds lists `"vite/client"` in `types`, so `import.meta.env` and asset
  imports (`*.css`, images) type-check.
- **`vite dev` serves, `vite build` builds, `vite preview` serves the build locally**; a framework or runtime may wrap
  them in its own commands.

## Required values

| What                 | Value                                                                |
| -------------------- | -------------------------------------------------------------------- |
| dependencies         | dev `vite`                                                           |
| `vite.config.ts`     | `defineConfig({ plugins: [...], resolve: { tsconfigPaths: true } })` |
| client project types | `"vite/client"`                                                      |

## Pitfalls

- **A plugin in the wrong place** builds the wrong environment, or none: the runtime's first, the framework's last.
- **Without `"vite/client"` in `types`**, a side-effect `*.css` import or `import.meta.env` fails the type check.
- **The dependency pre-bundle can reload a page or a test on the first run** after a new dependency: run it again.

## Conventions

- **One `vite.config.ts` for the app**; tools with their own config never load it as it is.
- **Aliases live in the `tsconfig` `paths`** and reach Vite through `resolve.tsconfigPaths`.
- **Plugin order is deliberate**: the runtime's first, the framework's last.
