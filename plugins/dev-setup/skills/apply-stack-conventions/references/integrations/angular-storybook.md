# Angular + Storybook

Storybook in an Angular package: the Vite builder through Analog, so stories share the compile path of the app and its
tests, run as `angular.json` targets, zoneless like the app. Both Angular stacks use it.

## The seam

```
angular.json: storybook / build-storybook targets ─► @storybook/angular-vite ─► @analogjs/vite-plugin-angular ─► the app's compile
.storybook/main.ts (src/**/*.stories.ts) ─► preview.ts imports ../src/styles.css
```

- **`@storybook/angular-vite`, not the webpack `@storybook/angular`**, so stories compile through
  `@analogjs/vite-plugin-angular`, the same path as the tests.
- **Stories run zoneless**, like the app and its tests.

## Required values

| What                       | Value                                                                                                                                                                                                                  |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| dependencies               | dev `storybook@10`, `@storybook/angular-vite@10`, `@analogjs/vite-plugin-angular@2`, `vite`, `@angular/animations`, `@angular-devkit/architect`, `@angular-devkit/core`, `eslint-plugin-storybook@10`                  |
| `angular.json`             | targets `storybook` (`@storybook/angular-vite:start-storybook`, `configDir: ".storybook"`, `browserTarget: "<name>:build"`, `port: 6006`) and `build-storybook` (`…:build-storybook`, `outputDir: "storybook-static"`) |
| scripts                    | `storybook` `ng run <name>:storybook`; `build-storybook` `ng run <name>:build-storybook`                                                                                                                               |
| `.storybook/main.ts`       | stories `../src/**/*.stories.ts`, `framework: '@storybook/angular-vite'`                                                                                                                                               |
| `.storybook/preview.ts`    | imports `../src/styles.css`                                                                                                                                                                                            |
| `.storybook/tsconfig.json` | extends `../tsconfig.app.json` with `types: ["node"]`, `moduleResolution: "bundler"`, including the sources, the stories and the two config files; `typings.d.ts` declares `*.md`                                      |
| lint                       | `...storybook.configs['flat/recommended']` in `eslint.config.mjs`                                                                                                                                                      |

## Pitfalls

- **`@angular/animations` is a required peer of `@storybook/angular-vite`**, so every install prints its deprecation
  warning; that is expected. `zone.js` is only an optional peer: do not install it.
- **A test config named `vite.config.*`** is read by Storybook's builder too: the test config is `vitest.config.mts`.

## Conventions

- **Stories are `<name>.stories.ts` beside each component**; a primitive with projected content renders through a
  `template`.
- **Storybook runs as `angular.json` targets** (`pnpm storybook`, `pnpm build-storybook`).

## Verify it is wired

- `pnpm build-storybook` writes `storybook-static/index.json` listing a story for every component.
- No `zone.js` in the manifest.
