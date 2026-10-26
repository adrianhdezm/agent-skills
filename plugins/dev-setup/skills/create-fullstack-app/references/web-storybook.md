# Web Storybook

Storybook develops and documents the reusable **components** under `src/app/components/`: the `ui/` primitives and
the app components built on them, both taking `input()` / `output()` and never touching the store. It is **dev/docs only** — not a test runner. A component's
behaviour is tested by its browser-mode spec (see [references/web-testing.md](web-testing.md)); Storybook is where a
component is built and its states are reviewed.

It runs on the **Vite / Analog** builder (`@storybook/angular-vite`), not the webpack `@storybook/angular` one, so it
matches the project's esbuild/Vite toolchain (`@angular/build`) and does not pull a second webpack stack of its own.

## Contents

- [Dependencies](#dependencies)
- [`.storybook/` config](#storybook-config)
- [`angular.json` targets and scripts](#angularjson-targets-and-scripts)
- [Ignore + ESLint](#ignore--eslint)
- [The stories](#the-stories)

## Dependencies

Run in SKILL step 5, after the web's own installs:

```sh
pnpm --filter web add -D storybook@10 @storybook/angular-vite@10 \
  @analogjs/vite-plugin-angular@2 vite @angular/animations \
  @angular-devkit/architect @angular-devkit/core eslint-plugin-storybook@10
```

- `@storybook/angular-vite` compiles Angular through `@analogjs/vite-plugin-angular` (the same plugin `ng test` uses),
  on `vite`. Storybook reads `vite.config.*`; the tests' `vitest.config.mts` is a different name, so the two configs
  stay apart.
- `@angular/animations` is a required peer of `@storybook/angular-vite`, not something the app uses; every install
  prints `deprecated @angular/animations`, which is expected. There is no `zone.js`: the builder's `zoneless` option
  defaults to `true` (it only loads `zone.js` when set to `false`), and `zone.js` is an optional peer, so Storybook runs
  zoneless like the app.
- `@angular-devkit/{architect,core}` back the `ng run web:storybook` builder targets.
- `eslint-plugin-storybook` lints `*.stories.ts` (wired in [references/eslint-prettier.md](eslint-prettier.md)).

`@storybook/angular-vite` also pulls `@angular-devkit/build-angular` transitively — it is **not** a direct dependency,
and the app build stays on `@angular/build`.

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

## The stories

The scaffold ships four components ([references/web.md](web.md) under Components) and one story file beside each. A
story drives the signal `input()`s as `args` and wires the `output()`s to `fn()` spies. The title names the tier:
`UI/<Name>` for a primitive, `Components/<Name>` for an app component.

### `web/src/app/components/ui/dialog.stories.ts`

A primitive with projected content renders through a `template`, so the story shows the slots filled.

```ts
import type { Meta, StoryObj } from '@storybook/angular-vite';
import { fn } from 'storybook/test';
import { UiDialog } from './dialog.component';

const meta: Meta<UiDialog> = {
  title: 'UI/Dialog',
  component: UiDialog,
  args: {
    title: 'Dialog title',
    description: 'A short description of what this dialog is for.',
    dismissible: true,
    dismissed: fn()
  },
  render: (args) => ({
    props: args,
    template: `
      <ui-dialog [title]="title" [description]="description" [dismissible]="dismissible" (dismissed)="dismissed()">
        <p class="mt-4 text-sm text-slate-700">Body content goes here.</p>
        <button uiDialogFooter type="button" class="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white">OK</button>
      </ui-dialog>
    `
  })
};

export default meta;
type Story = StoryObj<UiDialog>;

export const Default: Story = {};
```

### `web/src/app/components/ui/select.stories.ts`

```ts
import type { Meta, StoryObj } from '@storybook/angular-vite';
import { fn } from 'storybook/test';
import { UiSelect } from './select.component';

const meta: Meta<UiSelect> = {
  title: 'UI/Select',
  component: UiSelect,
  args: {
    label: 'Fruit',
    name: 'fruit',
    options: [
      { value: 'apple', label: 'Apple' },
      { value: 'banana', label: 'Banana' },
      { value: 'cherry', label: 'Cherry' }
    ],
    value: 'banana',
    valueChange: fn()
  }
};

export default meta;
type Story = StoryObj<UiSelect>;

export const Default: Story = {};
```

### `web/src/app/components/ui/pagination.stories.ts`

```ts
import type { Meta, StoryObj } from '@storybook/angular-vite';
import { fn } from 'storybook/test';
import { UiPagination } from './pagination.component';

const meta: Meta<UiPagination> = {
  title: 'UI/Pagination',
  component: UiPagination,
  args: { page: 2, pageCount: 5, pageChange: fn() },
  render: (args) => ({
    props: args,
    template: `<ui-pagination [page]="page" [pageCount]="pageCount" (pageChange)="pageChange($event)">Page {{ page }} of {{ pageCount }}</ui-pagination>`
  })
};

export default meta;
type Story = StoryObj<UiPagination>;

export const Middle: Story = {};

export const FirstPage: Story = {
  args: { page: 1 }
};
```

### `web/src/app/components/delete-dialog.stories.ts`

```ts
import type { Meta, StoryObj } from '@storybook/angular-vite';
import { fn } from 'storybook/test';
import { DeleteDialog } from './delete-dialog.component';

// The dialog is a `fixed inset-0` overlay, so it covers the canvas without a `layout` parameter.
const meta: Meta<DeleteDialog> = {
  title: 'Components/DeleteDialog',
  component: DeleteDialog,
  args: {
    itemKind: 'entity',
    itemName: 'Acme Corp',
    busy: false,
    confirmed: fn(),
    cancelled: fn()
  }
};

export default meta;
type Story = StoryObj<DeleteDialog>;

export const Default: Story = {};

export const Busy: Story = {
  args: { busy: true }
};
```

**A new component** gets a `*.stories.ts` beside it, titled for its tier, with one story per meaningful state, args for
its inputs, and `fn()` for its outputs, plus a `*.component.browser.spec.ts` for its behaviour.
