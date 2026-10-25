# Web Storybook

Storybook develops and documents the reusable **components** under `src/app/components/` (the pieces that take
`input()` / `output()` and never touch the store). It is **dev/docs only** — not a test runner. Component behaviour
that needs a real browser is covered by the e2e flow (see [references/web-testing.md](web-testing.md)); Storybook is
where a component is built and its states are reviewed.

It runs on the **Vite / Analog** builder (`@storybook/angular-vite`), not the webpack `@storybook/angular` one, so it
matches the project's esbuild/Vite toolchain (`@angular/build`) and does not pull a second webpack stack of its own.

## Contents

- [Dependencies](#dependencies)
- [`.storybook/` config](#storybook-config)
- [`angular.json` targets and scripts](#angularjson-targets-and-scripts)
- [Ignore + ESLint](#ignore--eslint)
- [The example story](#the-example-story)

## Dependencies

```sh
pnpm --filter web add -D storybook @storybook/angular-vite \
  @analogjs/vite-plugin-angular vite @angular/animations zone.js \
  @angular-devkit/architect @angular-devkit/core eslint-plugin-storybook
```

- `@storybook/angular-vite` compiles Angular through `@analogjs/vite-plugin-angular` (the same plugin the browser
  tests use), on `vite`.
- `@angular/animations` and `zone.js` are peer requirements of the Storybook Angular tooling; `zone.js` is **not** used
  by the app itself, which is zoneless.
- `@angular-devkit/{architect,core}` back the `ng run web:storybook` builder targets.
- `eslint-plugin-storybook` lints `*.stories.ts` (wired in [references/eslint-prettier.md](eslint-prettier.md)).

`@storybook/angular-vite` also pulls `@angular-devkit/build-angular` transitively — it is **not** a direct dependency,
and the app build/test stay on `@angular/build`.

> Equivalent shortcut: `pnpm --filter web dlx storybook@latest init --type angular` detects the `angular-vite`
> framework and writes the same config + targets. Installing the deps and writing the files below is the deterministic
> form.

## `.storybook/` config

### `web/.storybook/main.ts`

```ts
import type { StorybookConfig } from '@storybook/angular-vite';

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: [],
  framework: '@storybook/angular-vite'
};
export default config;
```

### `web/.storybook/preview.ts`

Imports the global stylesheet so Tailwind utilities resolve in the canvas.

```ts
import type { Preview } from '@storybook/angular-vite';
import '../src/styles.css';

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i
      }
    }
  }
};

export default preview;
```

### `web/.storybook/tsconfig.json`

```json
{
  "extends": "../tsconfig.app.json",
  "compilerOptions": {
    "types": ["node"],
    "allowSyntheticDefaultImports": true,
    "resolveJsonModule": true,
    "moduleResolution": "bundler"
  },
  "exclude": ["../src/**/*.spec.ts"],
  "include": ["../src/**/*.ts", "../src/**/*.stories.*", "./main.ts", "./preview.ts"],
  "files": ["./typings.d.ts"]
}
```

### `web/.storybook/typings.d.ts`

```ts
declare module '*.md' {
  const content: string;
  export default content;
}
```

## `angular.json` targets and scripts

Add two architect targets to the `web` project in `angular.json`:

```jsonc
"storybook": {
  "builder": "@storybook/angular-vite:start-storybook",
  "options": { "configDir": ".storybook", "browserTarget": "web:build", "port": 6006 }
},
"build-storybook": {
  "builder": "@storybook/angular-vite:build-storybook",
  "options": { "configDir": ".storybook", "browserTarget": "web:build", "outputDir": "storybook-static" }
}
```

And the scripts:

```sh
pnpm --filter web pkg set scripts.storybook="ng run web:storybook" \
  "scripts['build-storybook']=ng run web:build-storybook"
```

## Ignore + ESLint

Add to `web/.gitignore`:

```
*storybook.log
storybook-static
```

`web/eslint.config.mjs` adds `storybook-static/**` to `globalIgnores`, imports `eslint-plugin-storybook`, and spreads
`...storybook.configs['flat/recommended']` **before** `eslintConfigPrettier`, so prettier stays the last entry and
wins the final say on formatting. See [references/eslint-prettier.md](eslint-prettier.md).

## The example story

The scaffold ships one component, `ConfirmDialog` (defined in [references/web.md](web.md) under Components), and one
story for it. The story drives the signal `input()`s as `args` and wires the `output()`s to `fn()` spies.

### `web/src/app/components/confirm-dialog.stories.ts`

```ts
import type { Meta, StoryObj } from '@storybook/angular-vite';
import { fn } from 'storybook/test';
import { ConfirmDialog } from './confirm-dialog.component';

// The dialog renders as a full-screen modal overlay, so each story fills the
// canvas. Outputs are wired to spies via `fn()` so clicks show in the Actions panel.
const meta: Meta<ConfirmDialog> = {
  title: 'Components/ConfirmDialog',
  component: ConfirmDialog,
  tags: ['autodocs'],
  args: {
    title: 'Delete entity',
    message: 'Delete “Acme Corp”? This cannot be undone.',
    confirmLabel: 'Delete',
    cancelLabel: 'Cancel',
    busyLabel: 'Deleting…',
    busy: false,
    tone: 'danger',
    confirmed: fn(),
    cancelled: fn()
  },
  argTypes: {
    tone: { control: 'inline-radio', options: ['danger', 'primary'] },
    busy: { control: 'boolean' },
    title: { control: 'text' },
    message: { control: 'text' }
  }
};

export default meta;
type Story = StoryObj<ConfirmDialog>;

export const Danger: Story = {};

export const Primary: Story = {
  args: {
    tone: 'primary',
    title: 'Publish entity',
    message: 'Publish “Acme Corp” now? It will be visible to everyone.',
    confirmLabel: 'Publish'
  }
};

export const Busy: Story = {
  args: { busy: true }
};
```

**A new component** gets a `*.stories.ts` beside it with one story per meaningful state, args for its inputs, and
`fn()` for its outputs.
