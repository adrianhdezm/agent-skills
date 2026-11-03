---
type: Technology
title: Tailwind
description: utilities only, one global stylesheet with the theme, the build wiring per framework
resource: https://tailwindcss.com
role: library
realises: [ui-components]
detect:
  dependencies: [tailwindcss]
aliases: [Tailwind, tailwindcss]
stale_after: 2027-05-01T00:00:00Z
sources:
  - id: tailwind-releases
    resource: https://github.com/tailwindlabs/tailwindcss/releases
    title: Tailwind CSS releases
---
# Tailwind

Tailwind 4[^tailwind-releases] as the only way components are styled: utilities in the markup, and one global stylesheet
holding Tailwind and the theme.

**Realises:** [UI components](../architecture/ui-components.md)

## Use it like this

- **Utilities in the markup, no per-component CSS.** Components style themselves with utility classes; there are no
  `.css` or `.scss` files beside them.
- **One global stylesheet** imports Tailwind and defines the theme: the tokens as CSS variables, for light and dark,
  which the utilities read. It is the only stylesheet in the app.
- **The framework's build wires Tailwind in**, as the framework's integration says; nothing else processes CSS.

## Required values

| What            | Value                                                                                      |
| --------------- | ------------------------------------------------------------------------------------------ |
| devDependencies | `tailwindcss`, and the build plugin the framework's integration names                      |
| stylesheet      | one global file that `@import`s Tailwind and defines the theme's tokens for light and dark |

## Pitfalls

- **A browser test without the global stylesheet** renders unstyled: the browser test setup imports it.

## Conventions

- **Tailwind utilities only**: no per-component `.css` or `.scss` files; the global stylesheet is the only one.
- **The theme's tokens are CSS variables in the global stylesheet**; utilities read them, components never set raw
  colours.

[^tailwind-releases]: Tailwind CSS releases
