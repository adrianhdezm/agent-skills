# Angular + Fundamental NGX

SAP Fiori Horizon components in the Angular web app, copied in from the Fundamental NGX shadcn registry by the shadcn
CLI. Optional in both Angular stacks: with it, the registry's components take the place of the hand-written primitives
in `components/ui/`.

**Realises:** [UI components](../architecture/ui-components.md)

## The seam

```
pnpm dlx shadcn@4 add $R/<name>.json ─► reads web components.json + tsconfig paths (@/*) ─► writes src/app/components/ui/<name>/, src/app/lib/
src/styles.css ◄─ the theme import (appended by the CLI)      index.html ◄─ data-sap-theme="sap_horizon"
pages / app components ─► import from '@/app/components/ui/<name>/<name>'
```

`$R` is `https://adrianhdezm.github.io/fundamental-ngx-registry/r`.

## Where it lives

| File                                      | Holds                                                         |
| ----------------------------------------- | ------------------------------------------------------------- |
| `components.json`                         | the registry's style, the stylesheet, the `@/app/…` aliases   |
| `tsconfig.json`                           | `paths: { "@/*": ["./src/*"] }`                               |
| `src/app/components/ui/<name>/`           | registry code, one folder per component, never edited by hand |
| `src/app/lib/utils.ts`                    | the registry's `cn`                                           |
| `src/index.html`                          | the theme attributes on `<html>`                              |
| `vitest.config.mts`, `.storybook/main.ts` | `tsconfigPaths`, so tests and stories resolve `@/`            |

## Required values

| Where                   | Value                                                                                                                                                                                                                                                              |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `tsconfig.json`         | `"paths": { "@/*": ["./src/*"] }`: the components import each other as `@/app/components/ui/…`; `erasableSyntaxOnly` and `noUncheckedIndexedAccess` `false`, for the registry's code                                                                               |
| `components.json`       | `style: "new-york"`, `rsc: false`, `tsx: true`, `tailwind: { config: "", css: "src/styles.css", baseColor: "neutral", cssVariables: true }`, aliases `components: "@/app/components"`, `ui: "@/app/components/ui"`, `utils: "@/app/lib/utils"`, `lib: "@/app/lib"` |
| Vite (tests, Storybook) | `resolve: { tsconfigPaths: true }` in `vitest.config.mts`; `viteFinal` doing the same in `.storybook/main.ts`                                                                                                                                                      |
| lint and format ignores | `src/app/components/ui/*/**`, `src/app/lib/**` in ESLint; `src/app/components/ui/*/`, `src/app/lib`, `src/styles` in Prettier                                                                                                                                      |
| dependencies            | `@angular/cdk`, `clsx`, `tailwind-merge`, `class-variance-authority`: the registry items' imports; confirm the CLI added them                                                                                                                                      |
| styles                  | the CLI writes the theme to `src/styles/` (`fundamental.css`, `tokens.css`, `extensions.css`, `fonts.css`, `themes/`); `src/styles.css` imports `./styles/fundamental.css` after the three Tailwind layer imports                                                  |
| theme                   | `<html lang="en" data-sap-theme="sap_horizon" data-density="cozy" dir="ltr">`                                                                                                                                                                                      |

## Pitfalls

- **The registry writes in its own style** (4-space indent, `fd` selectors, explicit `OnPush`): ESLint reports about 165
  errors in it and Prettier would rewrite every file. Both skip its folders, but `ng build` and `typecheck` still
  compile it, and it fails two of the TypeScript doc's options: `erasableSyntaxOnly` (an `enum` in `dialog.ts`, a
  parameter property in `message-strip-alert.ts`) and `noUncheckedIndexedAccess` (TS18048 in `dialog.ts`). The web
  tsconfig turns both off, with a comment saying why; the folders are not edited to pass them.
- **If the registry ever pins a `target` again**, its code lands beside `src/app/` while the app imports it from inside.
  Check that `src/app/lib/utils.ts` and `src/app/components/ui/dialog/dialog.ts` exist and that there is no
  `src/components` or `src/lib`; if not, stop and report it, since moving files by hand is undone by the next
  `--overwrite`.
- **`fd-select` and `fd-combobox` render a `role="combobox"`**, not a native control: `<label for>` does not name them.
  Give the label an `id` and pass it as `ariaLabelledBy`; tests find them with `getByRole('combobox', { name })`.
- **Buttons and required labels carry hidden text that joins the accessible name**: every `fdButton` variant adds its
  type description (_Negative Action_ on a negative one, so Delete reads "DeleteNegative Action"), and `fdFormLabel
required` adds a marker. Vitest's exact name match needs `{ exact: false }` for each; Playwright matches substrings
  already.
- **`fd-pagination`'s own page-size select** emits the new size and then a clamped page in the same tick, and two
  navigations built from the same stale input undo each other: keep Per page as a separate select.
- **`fd-dialog` declared in a template without a `DialogRef` does not close on Escape**: the app component handles Escape
  itself.
- **The first browser test run after adding the registry** can fail one file while Vite pre-bundles `@angular/cdk/*`
  ("Vite unexpectedly reloaded a test"); run it again.

## Conventions

- **Primitives come from the Fundamental NGX registry** through the shadcn CLI (`pnpm dlx shadcn@4 add …`), one folder
  per component under `components/ui/`. Those folders are not edited by hand: a change goes upstream, and the app takes
  it with `add --overwrite` and a reviewed diff; an app adaptation is a flat file beside the folders.
- **Colours are Horizon token utilities** (`text-sap-link-color`, `bg-sap-shell-color`), never raw palette classes.
- **The registry's folders are outside lint and format**, and inside the type check.
- **A custom control is labelled through `ariaLabelledBy`**, and found in tests by its role and name.

## Verify it is wired

- `src/app/lib/utils.ts` and the registry folders sit under `src/app/`; there is no `src/components`, `src/lib`, `@` or
  `~` folder.
- ESLint's and Prettier's ignores list the registry folders; no hand-written `ui-dialog`, `ui-select` or `ui-pagination`
  remains beside them.
- `index.html` carries `data-sap-theme="sap_horizon"`.
