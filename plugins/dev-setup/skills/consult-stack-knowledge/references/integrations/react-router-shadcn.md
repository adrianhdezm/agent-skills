---
type: Integration
title: React Router + shadcn/ui
description: '`components.json`, the aliases, the shadcn primitives, `cn`'
connects: [react-router, shadcn]
realises: [ui-components]
---
# React Router + shadcn/ui

shadcn/ui in a React Router app: primitives copied in by the shadcn CLI with the `base-nova` style on Base UI, their
aliases from the root `tsconfig.json`, and `cn`. Both React Router stacks use it, under the UI components concept's two
tiers, over the stylesheet React Router + Tailwind wires in; the shadcn CLI has its own doc.

**Realises:** [UI components](../architecture/ui-components.md)

## The seam

```
pnpm dlx shadcn@4 add … ─► reads components.json + root tsconfig paths ─► writes app/components/ui/*
app/components/ui/* ─► cn from 'cn'; the tokens of app/app.css (React Router + Tailwind)
```

- **Colours are shadcn's tokens** (`bg-background`, `text-muted-foreground`, `border-border`), defined for light and dark
  in `app/app.css`, the stylesheet React Router + Tailwind wires in.
- **The shadcn CLI resolves its aliases** (`~/components`, `~/lib/utils`) from the `paths` of the root `tsconfig.json`,
  and rewrites each primitive's imports to them.

## Where it lives

| File                 | Holds                                                                             |
| -------------------- | --------------------------------------------------------------------------------- |
| `components.json`    | the shadcn style, the stylesheet, the aliases                                     |
| `tsconfig.json`      | `paths: { "~/*": ["./app/*"] }`, for the CLI                                      |
| `app/lib/utils.ts`   | `cn`, re-exported from the `cn` package; with sign-in, `safeRedirectTo` beside it |
| `app/components/ui/` | the shadcn primitives, the project's code once added                              |

## Required values

| Where                | Value                                                                                                                                                                                                                                                                                                                   |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `components.json`    | `style: "base-nova"`, `rsc: false`, `tsx: true`, `tailwind: { config: "", css: "app/app.css", baseColor: "neutral", cssVariables: true, prefix: "" }`, `rtl: false`, aliases `components: "~/components"`, `utils: "~/lib/utils"`, `ui: "~/components/ui"`, `lib: "~/lib"`, `hooks: "~/hooks"`, `iconLibrary: "lucide"` |
| root `tsconfig.json` | `"compilerOptions": { "paths": { "~/*": ["./app/*"] } }`, for the CLI                                                                                                                                                                                                                                                   |
| installed up front   | `@base-ui/react`, `class-variance-authority`, `cn`, `lucide-react`, `tw-animate-css`                                                                                                                                                                                                                                    |
| `app/lib/utils.ts`   | `export { cn } from 'cn';`, with a doc comment, as the registry's own `utils` item has it                                                                                                                                                                                                                               |

## Pitfalls

- **The shadcn registry ships `cn` as its own package**, a drop-in for `clsx` plus `tailwind-merge`; primitives import
  `cn` from `'cn'`, and neither of the other two is installed.
- **Registry items declare only `cn`**: the style's base packages (`@base-ui/react`, `class-variance-authority`,
  `lucide-react`) are installed up front, or the primitives do not compile.

## Conventions

- **Primitives come through the shadcn CLI** (`pnpm dlx shadcn@4 add …`) into `app/components/ui/`. They are the
  project's code once added: edit them in place, and do not re-add one that has been edited.
- **Colours are shadcn's theme tokens** from `app/app.css`, never raw palette classes, so dark mode follows.

## Verify it is wired

- `components.json` names `app/app.css` and the `~/` aliases, and the root `tsconfig.json` has the matching `paths`.
- There is no `~` folder at the repo root, and no `clsx` or `tailwind-merge` in the manifest.
