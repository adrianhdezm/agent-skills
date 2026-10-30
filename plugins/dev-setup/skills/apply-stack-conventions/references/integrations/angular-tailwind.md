# Angular + Tailwind

Tailwind in an Angular package: wired through PostCSS, its layers imported one by one into `src/styles.css`, and every
component styled with utilities plus a `host` class. Both Angular stacks use it.

## The seam

```
.postcssrc.json (@tailwindcss/postcss) ─► angular.json styles: ["src/styles.css"] ─► the layers, the theme
components ─► host: { class: '…' } + utilities in the inline template
browser tests ─► src/testing/browser-setup.ts imports ../styles.css
```

## Required values

| What              | Value                                                                                                                                             |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| devDependencies   | `tailwindcss`, `@tailwindcss/postcss`, `postcss`                                                                                                  |
| `.postcssrc.json` | `{ "plugins": { "@tailwindcss/postcss": {} } }`                                                                                                   |
| `src/styles.css`  | `@layer theme, base, components, utilities;` then `tailwindcss/theme.css`, `preflight.css` and `utilities.css`, each into its layer; Preflight on |

## Pitfalls

- **A browser spec without `styles.css` imported** renders unstyled: the browser setup file imports it.

## Conventions

- **Components style themselves with Tailwind utilities plus a `host` class**; `src/styles.css` is the only stylesheet.

## Verify it is wired

- No `.css` or `.scss` file under `src/app/`; `angular.json` lists only `src/styles.css`.
