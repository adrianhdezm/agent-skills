# React Router + Prettier

The Prettier plugins a React Router app adds: imports sorted by the app's layers, and Tailwind classes sorted against the
theme. Both React Router stacks use it.

## Required values

| What        | Value                                                                                                                                |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| plugins     | `["@trivago/prettier-plugin-sort-imports", "prettier-plugin-tailwindcss"]`                                                           |
| import sort | `importOrder: ["^~/routes/(.*)$", "^~/components/(.*)$", "^~/(.*)$", "^[./]"]`, `importOrderSeparation`, `importOrderSortSpecifiers` |
| class sort  | `tailwindStylesheet: "./app/app.css"`, so the sorter knows the theme's utilities                                                     |

## Pitfalls

- **The class sorter without `tailwindStylesheet`** does not know the theme's custom utilities and sorts them as unknown.
- **A hand-ordered import list** is reordered on the next format: let `pnpm format` order imports.

## Conventions

- **Imports and classes are ordered by `pnpm format`**, never by hand.
