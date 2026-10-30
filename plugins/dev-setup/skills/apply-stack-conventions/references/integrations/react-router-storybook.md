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
| dependencies            | dev `storybook@10`, `@storybook/react-vite@10`, `eslint-plugin-storybook@10`                                                                                                            |
| scripts                 | `storybook` `storybook dev -p 6006`; `build-storybook` `storybook build`                                                                                                                |
| `.storybook/main.ts`    | stories `../app/components/**/*.stories.tsx`, `framework: '@storybook/react-vite'`, a `viteFinal` that removes `reactRouter()` and any runtime plugin and keeps `resolve.tsconfigPaths` |
| `.storybook/preview.ts` | imports `../app/app.css`                                                                                                                                                                |
| tsconfig                | `.storybook/` in `tsconfig.node.json`'s `include`; stories in the runtime project with the components                                                                                   |
| lint                    | `...storybook.configs['flat/recommended']` in `eslint.config.js`                                                                                                                        |

## Pitfalls

- **Storybook loading the app's Vite config as it is** starts React Router's plugin, which expects a server build and an
  `app/root.tsx` entry: drop it, and the runtime's plugin, in `viteFinal`.
- **A component that reads loader data** cannot render alone: stories cover components that take props, and route
  modules are tested through `createRoutesStub` instead.

## Conventions

- **Stories are `<name>.stories.tsx` beside each component** in `app/components/` and `app/components/ui/`.
- **Route modules have no stories**; components do.

## Verify it is wired

- `pnpm build-storybook` succeeds and lists a story for every component in `app/components/`.
