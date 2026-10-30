# React Router + Storybook

Storybook in a React Router app: the React Vite builder over the app's Vite config, without the plugins that start the
app's server, stories beside the components, and the theme from `app/app.css`. Optional in both React Router stacks.

## The seam

```
.storybook/main.ts ─► @storybook/react-vite ─► viteFinal: the app's config minus the React Router and runtime plugins
stories: app/components/**/*.stories.tsx ─► preview.ts imports ../app/app.css ─► the `~/` alias through resolve.tsconfigPaths
```

## Required values

| What                    | Value                                                                                                                                                                                   |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| devDependencies         | `storybook@10`, `@storybook/react-vite@10`, `eslint-plugin-storybook@10`                                                                                                                |
| scripts                 | `storybook` `storybook dev -p 6006`; `build-storybook` `storybook build`                                                                                                                |
| `.storybook/main.ts`    | stories `../app/components/**/*.stories.tsx`, `framework: '@storybook/react-vite'`, a `viteFinal` that removes `reactRouter()` and any runtime plugin and keeps `resolve.tsconfigPaths` |
| `.storybook/preview.ts` | `/// <reference types="vite/client" />`, then imports `../app/app.css` (the node project has no Vite types otherwise)                                                                   |
| tsconfig                | `".storybook/**/*"` in `tsconfig.node.json`'s `include` (a bare `.storybook/` matches nothing: globs skip dot-folders); stories in the runtime project with the components              |
| lint                    | `...storybook.configs['flat/recommended']` in `eslint.config.js`                                                                                                                        |

## Pitfalls

- **Storybook loading the app's Vite config as it is** starts React Router's plugin, which expects a server build and an
  `app/root.tsx` entry: drop it, and the runtime's plugin, in `viteFinal`.
- **A component that reads loader data** cannot render alone: stories cover components that take props, and route
  modules are tested through `createRoutesStub` instead.

## Reference code

`.storybook/main.ts`: the app's Vite config with the plugins that build or run its server removed by name, nested
arrays included, so no cast on the plugin list is needed:

```ts
import type { StorybookConfig } from '@storybook/react-vite';
import type { PluginOption } from 'vite';

/** Plugins that build or run the app's server: React Router's, and on Workers the Cloudflare plugin's. */
const APP_SERVER_PLUGINS = ['react-router', 'vite-plugin-cloudflare'];

/** True for a plugin, or a nested array of plugins, that builds or runs the app's server. */
function isAppServerPlugin(plugin: PluginOption): boolean {
  if (Array.isArray(plugin)) {
    return (plugin as PluginOption[]).some(isAppServerPlugin);
  }
  return (
    typeof plugin === 'object' && plugin !== null && 'name' in plugin && APP_SERVER_PLUGINS.some((prefix) => plugin.name.startsWith(prefix))
  );
}

const config: StorybookConfig = {
  stories: ['../app/components/**/*.stories.tsx'],
  framework: '@storybook/react-vite',
  viteFinal: (viteConfig) => ({
    ...viteConfig,
    // The app's own config also builds the server entry, which Storybook has no use for.
    plugins: (viteConfig.plugins ?? []).filter((plugin) => !isAppServerPlugin(plugin)),
    resolve: { ...viteConfig.resolve, tsconfigPaths: true }
  })
};

export default config;
```

## Conventions

- **Stories are `<name>.stories.tsx` beside each component** in `app/components/` and `app/components/ui/`.
- **Route modules have no stories**; components do.

## Verify it is wired

- `pnpm build-storybook` succeeds and lists a story for every component in `app/components/`.
