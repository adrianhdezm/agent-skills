# Fundamental NGX + SAP Horizon (opt-in)

Add this on top of the default scaffold when the user wants SAP Fiori Horizon components. They come from the
[fundamental-ngx-registry](https://github.com/adrianhdezm/fundamental-ngx-registry): a port of `@fundamental-ngx/core`
to standalone, signal-based, zoneless Angular, styled with Tailwind v4 and the SAP theme tokens, and published as a
shadcn registry. The shadcn CLI copies each component's source into the app's `web/src/app/components/ui/`, with the
components it uses, the theme and the npm packages it needs. There is no `@fundamental-ngx/*` package to install or
pin.

The registry is at `https://adrianhdezm.github.io/fundamental-ngx-registry/r/<name>.json`, where `<name>` is the
component's folder name in the registry (`button`, `date-picker`, …). The full list is the registry's
[`registry.json`](https://github.com/adrianhdezm/fundamental-ngx-registry/blob/main/registry.json) and its Storybook;
the primitives an app reaches for first, with their selectors, are in
[coding-conventions.md §4.8](coding-conventions.md#48-with-fundamental-ngx-the-registry-primitives).

## Contents

1. [What the registry owns](#1-what-the-registry-owns)
2. [Wire the CLI](#2-wire-the-cli)
3. [Add the components](#3-add-the-components)
4. [Keep registry code out of lint and format](#4-keep-registry-code-out-of-lint-and-format)
5. [Resolve `@/*` under Vite](#5-resolve--under-vite)
6. [Replace the hand-written primitives](#6-replace-the-hand-written-primitives)
7. [Specs](#7-specs)
8. [Theme, density and tokens](#8-theme-density-and-tokens)
9. [Updating a component](#9-updating-a-component)
10. [Verify](#10-verify)

## 1. What the registry owns

The CLI places components and libs where the `ui` and `lib` aliases in `components.json` point, and rewrites their
imports to match; only the theme has a fixed target:

| path                                  | holds                                                                                                         |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `web/src/app/components/ui/<name>/`   | one folder per component (`button/button.ts`, `dialog/dialog.ts`, …), importing each other as `@/app/components/ui/…` |
| `web/src/app/lib/utils.ts`            | `cn()` and `cva`, shared by every component                                                                   |
| `web/src/styles/`                     | `fundamental.css` (the entry), the four Horizon themes, the token utilities, the fonts, beside `styles.css`   |

The component folders, `app/lib/` and `styles/` are **registry code**: the CLI writes them and
`shadcn add --overwrite` replaces them. Do not edit them by hand; a change goes upstream to the registry, and the app
takes it with `--overwrite`. The primitives tier is still `web/src/app/components/ui/`
([coding-conventions.md §4.7](coding-conventions.md#47-components-ui-primitives-and-app-components)): registry
components in their folders, and the app's own adaptations of them as flat `<name>.component.ts` files beside those
folders. The scaffold needs no adaptation.

This placement needs a registry build that leaves `target` off its component and lib files. A build that pins
`target: "src/components/ui/…"` makes the CLI write there whatever the aliases say, beside `src/app/` instead of inside
it. If `add` reports `src/components/ui/…` or `src/lib/…` paths, stop: the registry has to publish without those
targets first (`targetOf()` in its `scripts/build-registry.mjs`, and the `target` of its `registry:lib` entries).

## 2. Wire the CLI

Write these in SKILL step 4, with the other web files.

Map `@/*` to `src/*` in the `compilerOptions` of `web/tsconfig.json`. The components import each other through it
(`@/app/components/ui/…`), and the CLI resolves its aliases with it:

```json
"paths": { "@/*": ["./src/*"] }
```

### `web/components.json`

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": false,
  "tsx": true,
  "tailwind": { "config": "", "css": "src/styles.css", "baseColor": "neutral", "cssVariables": true },
  "aliases": {
    "components": "@/app/components",
    "ui": "@/app/components/ui",
    "utils": "@/app/lib/utils",
    "lib": "@/app/lib"
  }
}
```

- `"css"` names the global stylesheet; the first `add` appends the theme import to it.
- `"tsx": true` keeps the files in TypeScript (`false` makes the CLI transpile them to JavaScript).
- `"cssVariables": true` keeps the class names as written (`false` makes the CLI rewrite them).
- The aliases put the registry code inside `src/app/`: `ui` decides where each component folder goes, `lib` where
  `utils.ts` goes, and the CLI rewrites the registry's `@/ui/…` and `@/lib/…` imports to `@/app/components/ui/…` and
  `@/app/lib/…`.

## 3. Add the components

Run in SKILL step 5, after the web's own installs (the CLI needs Tailwind and the Angular packages installed), from
`web/`. Add only the components the app uses; the scaffold's example uses these:

```sh
R=https://adrianhdezm.github.io/fundamental-ngx-registry/r
pnpm dlx shadcn@4 add --yes \
  $R/button.json $R/dialog.json $R/select.json $R/pagination.json $R/input.json $R/form.json $R/message-strip.json
```

The CLI pulls in each component's `registryDependencies` (`dialog` brings `bar`, `busy-indicator`, `icon` and
`title`; `select` brings `list`, `popover` and more), and it:

- adds `@angular/cdk`, `clsx`, `tailwind-merge` and `class-variance-authority` to `web/package.json` with pnpm;
- writes the registry code above;
- appends `@import "./styles/fundamental.css";` to `web/src/styles.css`, after the Tailwind layers. `pnpm format`
  turns its double quotes into single ones. A second `add` leaves the import alone.

Tailwind's preflight **stays on**: the registry's styles are written as Tailwind utilities and theme layers on top of
it, unlike the `@fundamental-ngx/core` stylesheet, whose base styles preflight clobbered. The initial bundle grows to
about 1.15 MB raw (210 kB transferred), inside the scaffold's 2 MB warning / 4 MB error budget, so `angular.json`
needs no change. The fonts load from jsDelivr (`src/styles/fonts.css`); to self-host them, copy the `.woff2` files
from `@sap-theming/theming-base-content` and point `fonts.css` at them.

## 4. Keep registry code out of lint and format

The registry's code follows its own style (4-space indent, `fd` selector prefixes, aliased inputs, explicit
`OnPush`), so ESLint reports about 165 errors in it and Prettier would rewrite every file. Reformatting it would also
turn each `--overwrite` into a whole-file diff. Both tools skip it; `ng build` and `pnpm typecheck` still compile it,
under the app's strict tsconfig.

Both ignore the component **folders** under `src/app/components/ui/`, not the folder itself, so an adaptation written
flat beside them (`ui/<name>.component.ts`) is still linted and formatted.

In `web/eslint.config.mjs`, extend `globalIgnores`:

```js
globalIgnores([
  'dist/**',
  '.angular/**',
  'storybook-static/**',
  'eslint.config.mjs',
  'playwright.config.ts',
  // Fundamental NGX registry code, one folder per component, owned by `shadcn add --overwrite`
  'src/app/components/ui/*/**',
  'src/app/lib/**'
]),
```

Append to `web/.prettierignore`:

```
# Fundamental NGX registry code, owned by `shadcn add --overwrite`
src/app/components/ui/*/
src/app/lib
src/styles
```

The per-folder selector prefixes (`app` everywhere, `ui` under `src/app/components/ui/`) stay as they are: they apply
to the app's own declarations, and using an `fd` selector in a template is not a declaration.

## 5. Resolve `@/*` under Vite

`ng build` reads the tsconfig paths, but Vitest and Storybook run on Vite, which does not unless told to. Without it,
every browser spec that renders a registry component fails to import with
`Failed to resolve import "@/app/components/…"`.

In `web/vitest.config.mts`, beside `plugins`:

```ts
  // The Fundamental NGX registry components import each other through tsconfig's `@/*` path.
  resolve: { tsconfigPaths: true },
```

In `web/.storybook/main.ts`, after `framework`:

```ts
  // The Fundamental NGX registry components import each other through tsconfig's `@/*` path.
  viteFinal: (config) => ({ ...config, resolve: { ...config.resolve, tsconfigPaths: true } })
```

Nothing else in Storybook or the browser tests changes: `.storybook/preview.ts` and `src/testing/browser-setup.ts`
already import `src/styles.css`, which now imports the theme.

## 6. Replace the hand-written primitives

With a UI library, a primitive comes from the library, so the scaffold's three hand-written ones go, with their
stories and specs:

```sh
rm web/src/app/components/ui/{dialog,select,pagination}.{component.ts,stories.ts,component.browser.spec.ts}
```

Their place in `components/ui/` is taken by the registry's `dialog/`, `select/` and `pagination/` folders.

The rest of `web.md` is written as specified, with these differences.

### `components/delete-dialog.component.ts`

`DeleteDialog` composes `fd-dialog` instead of `UiDialog`. Declared in a template without a `DialogRef`, `fd-dialog`
does not close on Escape (its handler dismisses the ref), so the app component handles Escape itself, as `UiDialog`
did. The description reaches the dialog's `aria-describedby` through `dialogConfig`.

```ts
import { Component, computed, input, output } from '@angular/core';
import { Button } from '@/app/components/ui/button/button';
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from '@/app/components/ui/dialog/dialog';
import { Title } from '@/app/components/ui/title/title';

let nextId = 0;

// The app's delete confirmation: a Fundamental dialog with the app's wording and a negative action.
// It emits `confirmed` / `cancelled` and leaves the delete to the host. `busy` disables
// both buttons, keeps Escape from closing it and swaps the label while the delete runs.
// Declared without a DialogRef, `fd-dialog` leaves Escape to its host, so this component handles it.
@Component({
  selector: 'app-delete-dialog',
  imports: [Button, Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle, Title],
  host: { '(document:keydown.escape)': 'onEscape()' },
  template: `
    <fd-dialog [dialogConfig]="{ ariaDescribedBy: descriptionId }">
      <fd-dialog-header>
        <h2 fd-title fd-dialog-title>{{ title() }}</h2>
      </fd-dialog-header>
      <fd-dialog-body>
        <p [id]="descriptionId" class="m-0">{{ description() }}</p>
      </fd-dialog-body>
      <fd-dialog-footer>
        <button fdButton variant="negative" [disabled]="busy()" (click)="confirmed.emit()">
          {{ busy() ? 'Deleting…' : 'Delete' }}
        </button>
        <button fdButton variant="transparent" [disabled]="busy()" (click)="cancelled.emit()">Cancel</button>
      </fd-dialog-footer>
    </fd-dialog>
  `
})
export class DeleteDialog {
  readonly itemKind = input.required<string>();
  readonly itemName = input.required<string>();
  readonly busy = input(false);

  readonly confirmed = output<void>();
  readonly cancelled = output<void>();

  protected readonly descriptionId = `delete-dialog-description-${nextId++}`;
  protected readonly title = computed(() => `Delete ${this.itemKind()}`);
  protected readonly description = computed(() => `Delete “${this.itemName()}”? This cannot be undone.`);

  protected onEscape(): void {
    if (!this.busy()) {
      this.cancelled.emit();
    }
  }
}
```

Its story (`delete-dialog.stories.ts`) is unchanged.

### `pages/entity-list-page.component.ts`

- **Sort and Per page** are two `fd-select`s, each labelled by an `fdFormLabel` through `ariaLabelledBy`. The options
  are `<li fd-option [value]>`; the select emits the picked value on `(valueChange)`. The option constants become a
  local `Option<T>` list (`UiSelectOption` is gone), and Per page binds numbers, so the page no longer converts the
  emitted value:

  ```html
  <div class="flex items-center gap-2">
    <span fdFormLabel id="sort-label">Sort</span>
    <fd-select ariaLabelledBy="sort-label" [value]="sortValue()" (valueChange)="changeSort($any($event))">
      @for (option of sortOptions; track option.value) {
        <li fd-option [value]="option.value">{{ option.label }}</li>
      }
    </fd-select>
  </div>
  <div class="flex items-center gap-2">
    <span fdFormLabel id="page-size-label">Per page</span>
    <fd-select ariaLabelledBy="page-size-label" [value]="listInput().pageSize" (valueChange)="changePageSize($any($event))">
      @for (size of pageSizeOptions; track size) {
        <li fd-option [value]="size">{{ size }}</li>
      }
    </fd-select>
  </div>
  ```

- **Pagination** is `fd-pagination`, bound one way to the slice, beside the page's own range text:

  ```html
  <div class="flex items-center justify-between gap-4">
    <p class="shrink-0 text-sap-font-size text-sap-content-label-color">{{ rangeLabel() }}</p>
    <fd-pagination
      [totalItems]="total()"
      [currentPage]="listInput().page"
      [itemsPerPage]="listInput().pageSize"
      [displayTotalItems]="false"
      (currentPageChange)="changePage($event)"
    />
  </div>
  ```

  Do not use its `itemsPerPageOptions`: on a page-size change it emits `itemsPerPageChange` and then
  `currentPageChange` in the same tick, and each would navigate from the same stale list input, so the second
  navigation undoes the first. Per page stays the separate select above. `fd-pagination` renders nothing while
  `total` is 0 and no page buttons while there is one page; its buttons are named _Previous page_, _Page N_ and
  _Next page_.

- **Buttons and inputs** take the registry's directives: `fdButton` on every `<button>` and on the _New entity_ link
  (`variant="emphasized"` for the primary action, `variant="transparent"` for _Clear_ and the row _Delete_), and
  `fdFormControl` on every `<input>`, each with its own `<label fdFormLabel for>` and `id` instead of a wrapping label.
- **The error banner** is `<fd-message-strip type="error" [dismissible]="false">{{ error() }}</fd-message-strip>`.
- **Colours** are Horizon token utilities instead of `slate-*` / `red-*`: `text-sap-title-color` on the heading,
  `text-sap-link-color` on the row links, `text-sap-content-label-color` for secondary text,
  `border-sap-list-border-color` on table rows.

### `pages/entity-detail-page.component.ts` and `pages/entity-form-page.component.ts`

The same substitutions: the error banner is an `fd-message-strip`, _Edit_ is `<a fdButton>`, _Save_ is
`<button fdButton variant="emphasized" type="submit">`, the form's input and textarea take `fdFormControl` with their own
`<label fdFormLabel for>`, and the colours are token utilities. In the form page, import the registry directive as
`FormControl as FdFormControl`: Angular's `FormControl` is already imported from `@angular/forms`.

### `layouts/main-layout.component.ts`

```ts
host: { class: 'flex min-h-screen flex-col bg-sap-background-color' },
template: `
  <header class="flex h-12 items-center bg-sap-shell-color px-6 text-sap-shell-text-color shadow-sap-content-shadow1">
    <span class="text-lg font-bold tracking-wide">{{ appName() }}</span>
  </header>
  <main class="flex-1 p-6">
    <router-outlet />
  </main>
`
```

For a full SAP shell bar (product switch, user menu), add the registry's `shellbar` instead.

## 7. Specs

The spec inventory in [web-testing.md](web-testing.md#spec-inventory) changes as follows:

- The three `components/ui/*.component.browser.spec.ts` go with their components. The registry ships its own specs
  upstream; the app does not copy them.
- **`delete-dialog.component.browser.spec.ts`** keeps its three cases and drives the dialog the same way, by role and
  name, with one difference. The registry renders a special button's type description (_Default Action_ for
  `emphasized`, _Negative Action_ for `negative`, …) as visually hidden text inside the button, so it joins the
  accessible name: _Delete_ is announced as "Delete Negative Action". Vitest's locators match names exactly, so the
  spec matches that button loosely and says why:

  ```ts
  // A negative button's hidden type description ("Negative Action") follows its label, so its name is matched loosely.
  await page.getByRole('dialog', { name: 'Delete entity' }).getByRole('button', { name: 'Delete', exact: false }).click();
  await expect.element(page.getByRole('button', { name: 'Deleting…', exact: false })).toBeDisabled();
  ```

  Playwright's `getByRole` matches substrings by default, so the e2e specs need no change for it.
- **`entity-list-page.component.browser.spec.ts`** drives `fd-select` as a combobox and its options, not a native
  `<select>`:

  ```ts
  await page.getByRole('combobox', { name: 'Sort' }).click();
  await page.getByRole('option', { name: 'Name A–Z' }).click();
  ```

  _Next_ is `getByRole('button', { name: 'Next page' })`. Seed `total` above one page (25 rows at `pageSize: 10`),
  or `fd-pagination` renders no buttons.
- **`e2e/pages/entity-list-page.spec.ts`** clicks _Next page_ instead of _Next_; the rest stands.

The first `ng test -c browser` after the registry is added can report "Vite unexpectedly reloaded a test" and fail one
file to import while Vite pre-bundles `@angular/cdk/*`. Run it again; the second run uses the cached bundles.

## 8. Theme, density and tokens

Set the theme and density on `<html>` in `web/src/index.html`; Horizon and cozy are the defaults:

```html
<html lang="en" data-sap-theme="sap_horizon" data-density="cozy" dir="ltr"></html>
```

`data-sap-theme` takes `sap_horizon`, `sap_horizon_dark`, `sap_horizon_hcb` or `sap_horizon_hcw`, and
`data-density="compact"` switches to compact; both work on any element, to theme a subtree.

Every SAP token is a Tailwind utility: drop `--sap`, split at camelCase and `_`, write it in kebab-case and prefix
`sap-` (`--sapShell_TextColor` → `text-sap-shell-text-color`, `--sapButton_Hover_Background` →
`bg-sap-button-hover-background`). A token with no Tailwind namespace uses the variable shorthand,
`opacity-(--sapContent_DisabledOpacity)`. App code uses these, never `slate-*` or a hex colour, so it follows the theme.

## 9. Updating a component

Rerun its `add` with `--overwrite` and review the diff before committing:

```sh
pnpm dlx shadcn@4 add --yes --overwrite https://adrianhdezm.github.io/fundamental-ngx-registry/r/button.json
```

Adding a component later is the same command without `--overwrite`; files that already exist are skipped. Add one when
the app first needs it, and add its row to the table in
[coding-conventions.md §4.8](coding-conventions.md#48-with-fundamental-ngx-the-registry-primitives) when it is a new
primitive.

## 10. Verify

- The five checks pass, plus `pnpm test:browser`, `pnpm --filter web build-storybook` and `pnpm test:e2e`.
- `web/src/app/components/ui/` holds one folder per added component and its registry dependencies, and no
  `*.component.ts`; there is no `web/src/components/` or `web/src/lib/`.
- The running app shows the Horizon theme: the 72 font, a white shell bar on a light grey background, blue emphasized
  buttons, and the dialog over a dimmed block layer with focus on its first button.
- The browser console is clean on the list page, with the sort select open and the delete dialog shown.
