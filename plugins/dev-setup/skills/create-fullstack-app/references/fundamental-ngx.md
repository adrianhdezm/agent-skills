# Fundamental NGX + SAP Horizon (opt-in)

Add this on top of the default Angular + Tailwind scaffold when the user wants the SAP Fundamental NGX component library with the Horizon theme.

## 1. Install

FD-NGX's peer ranges are tight, so check which release supports the project's Angular major before installing:

```sh
pnpm view @fundamental-ngx/core peerDependencies   # @angular/core must cover 22
```

Then add the matching release (0.65.x supports Angular 22). Core pins its sibling packages and `fundamental-styles` to
exact versions in its peer range, so pin them exactly too:

```sh
pnpm --filter web add @angular/cdk@22 @sap-theming/theming-base-content
pnpm --filter web add -E @fundamental-ngx/core@0.65 @fundamental-ngx/cdk@0.65 @fundamental-ngx/i18n@0.65 \
  fundamental-styles@"$(pnpm view @fundamental-ngx/core@0.65 peerDependencies.fundamental-styles)"
```

## 2. Wire the stylesheets

In `web/angular.json`, the build config's `styles` array becomes:

```json
"styles": [
  "node_modules/@sap-theming/theming-base-content/content/Base/baseLib/sap_horizon/css_variables.css",
  "node_modules/@fundamental-ngx/core/styles/fundamental-ngx-core.css",
  "src/styles.css"
]
```

That array only feeds the app build. Storybook's canvas and the browser-mode tests load their stylesheets by import, so
add the same two files above the `styles.css` import in `web/.storybook/preview.ts` and
`web/src/testing/browser-setup.ts`:

```ts
import '@sap-theming/theming-base-content/content/Base/baseLib/sap_horizon/css_variables.css';
import '@fundamental-ngx/core/styles/fundamental-ngx-core.css';
```

## 3. Tailwind + FD-NGX co-existence

Tailwind v4 **must skip preflight** when FD-NGX is in the project — Tailwind's reset would clobber the Fundamental styles. The default `web/src/styles.css` imports Tailwind's layers one by one; delete the preflight line and set the margin and the SAP font on `body` by hand:

```css
@layer theme, base, components, utilities;

@import 'tailwindcss/theme.css' layer(theme);
@import 'tailwindcss/utilities.css' layer(utilities);

body {
  margin: 0;
  font-family: var(--sapFontFamily, system-ui, sans-serif);
}
```

## 4. Use the SAP theme vars in Tailwind utilities

Tailwind v4's CSS-variable shorthand plays nicely with the Horizon tokens:

- `bg-(--sapShellColor)`
- `text-(--sapShell_TextColor)`
- `bg-(--sapBackgroundColor)`
- `text-(--sapContent_LabelColor)`

Use the shorthand rather than the arbitrary `bg-[var(--sapShellColor)]` form: both compile to the same CSS, but the
shorthand is Tailwind v4's canonical syntax for a CSS variable, and it is shorter to read in a template.

## 5. Import FD-NGX components à la carte

FD-NGX is standalone-ready; import components from their secondary entry points, not from `@fundamental-ngx/core` root:

```ts
import { ButtonComponent } from '@fundamental-ngx/core/button';
import { MessageStripComponent } from '@fundamental-ngx/core/message-strip';
import { ObjectStatusComponent } from '@fundamental-ngx/core/object-status';
import { BusyIndicatorComponent } from '@fundamental-ngx/core/busy-indicator';
```

Each component declares its own selector (e.g. `fd-busy-indicator`, `[fd-object-status]`); check `node_modules/@fundamental-ngx/core/fesm2022/*` for the exact selector + input shape before using.

## 6. Minimal top bar using Horizon tokens

```html
<header class="flex h-12 items-center bg-(--sapShellColor) px-6 text-(--sapShell_TextColor) shadow">
  <span class="text-lg font-bold tracking-wide">{{ appName() }}</span>
</header>
```

## 7. Verify

- The build should complete without warnings about missing CSS vars.
- A loaded page should show the Horizon colour tokens applied (dark top bar; `var(--sapBackgroundColor)` on the content area).
- Lint remains clean — the shorthand CSS-var syntax is Tailwind-approved and FD-NGX styles are not touched by Tailwind utilities.
