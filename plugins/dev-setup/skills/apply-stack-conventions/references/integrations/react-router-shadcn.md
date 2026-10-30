# React Router + shadcn/ui

Tailwind 4 and shadcn/ui in a React Router app: Tailwind through its Vite plugin, primitives copied in by the shadcn CLI
with the `base-nova` style on Base UI, and the lint and format settings that code needs. Both React Router stacks use
it, under the UI components concept's two tiers; Tailwind and the shadcn CLI have their own docs.

**Realises:** [UI components](../architecture/ui-components.md)

## The seam

```
vite.config.ts: [runtime plugin] ─► tailwindcss() ─► reactRouter()
app/root.tsx ─► imports ./app.css (Tailwind + shadcn tokens)
pnpm dlx shadcn@4 add … ─► reads components.json + root tsconfig paths ─► writes app/components/ui/*
```

- **Tailwind through `@tailwindcss/vite`**, `tailwindcss()` before `reactRouter()`, with `app/app.css` as the one global
  stylesheet, imported by `app/root.tsx`.
- **Colours are shadcn's tokens** (`bg-background`, `text-muted-foreground`, `border-border`), defined for light and dark
  in `app/app.css`.
- **The shadcn CLI resolves its aliases** (`~/components`, `~/lib/utils`) from the `paths` of the root `tsconfig.json`,
  and rewrites each primitive's imports to them.

## Where it lives

| File                 | Holds                                                    |
| -------------------- | -------------------------------------------------------- |
| `components.json`    | the shadcn style, the stylesheet, the aliases            |
| `tsconfig.json`      | `paths: { "~/*": ["./app/*"] }`, for the CLI             |
| `app/app.css`        | Tailwind, `tw-animate-css`, the dark variant, the tokens |
| `app/lib/utils.ts`   | `cn`, re-exported from the `cn` package                  |
| `app/components/ui/` | the shadcn primitives, the project's code once added     |
| `.prettierrc`        | `prettier-plugin-tailwindcss` with `tailwindStylesheet`  |

## Required values

| Where                | Value                                                                                                                                                                                                                                                                                                                   |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `components.json`    | `style: "base-nova"`, `rsc: false`, `tsx: true`, `tailwind: { config: "", css: "app/app.css", baseColor: "neutral", cssVariables: true, prefix: "" }`, `rtl: false`, aliases `components: "~/components"`, `utils: "~/lib/utils"`, `ui: "~/components/ui"`, `lib: "~/lib"`, `hooks: "~/hooks"`, `iconLibrary: "lucide"` |
| root `tsconfig.json` | `"compilerOptions": { "paths": { "~/*": ["./app/*"] } }`, for the CLI                                                                                                                                                                                                                                                   |
| installed up front   | `@base-ui/react`, `class-variance-authority`, `cn`, `lucide-react`, `tw-animate-css`; dev `tailwindcss`, `@tailwindcss/vite`                                                                                                                                                                                            |
| `app/app.css`        | copied from `<skill-dir>/references/assets/react-router-app.css`: Tailwind, `tw-animate-css`, the dark variant, shadcn's tokens for light and dark, plus `surface`, `code` and `selection` tokens and two wide breakpoints                                                                                              |
| `app/lib/utils.ts`   | `export { cn } from 'cn';`, with a doc comment, as the registry's own `utils` item has it                                                                                                                                                                                                                               |
| ESLint               | `app/components/ui/**`: `jsx-a11y/label-has-associated-control` and `consistent-type-imports` off (shadcn code forwards props and imports React as a namespace)                                                                                                                                                         |

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

- `tailwindcss()` comes before `reactRouter()` in `vite.config.ts`, and `app/root.tsx` imports `./app.css`.
- `components.json` names `app/app.css` and the `~/` aliases, and the root `tsconfig.json` has the matching `paths`.
- There is no `~` folder at the repo root, and no `clsx` or `tailwind-merge` in the manifest.
