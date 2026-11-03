---
kind: integration
connects: [react-router, tailwind]
realises: [ui-components]
---
# React Router + Tailwind

Tailwind 4 in a React Router app: wired through its Vite plugin, `app/app.css` as the one global stylesheet holding the
theme's tokens, imported by the root route and by the browser tests' setup file. Both React Router stacks use it.

**Realises:** [UI components](../architecture/ui-components.md)

## The seam

```
vite.config.ts: [runtime plugin] ─► tailwindcss() ─► reactRouter()
app/root.tsx ─► imports ./app.css (Tailwind, the dark variant, the theme tokens)
browser tests ─► tests/setup.ts imports ../app/app.css
```

- **Tailwind through `@tailwindcss/vite`**, `tailwindcss()` after the runtime's plugin and before `reactRouter()`, with
  `app/app.css` as the one global stylesheet, imported by `app/root.tsx`.
- **The theme is `app/app.css`**: Tailwind, `tw-animate-css`, the dark variant and the tokens for light and dark, copied
  from the skill's asset rather than written by hand.

## Where it lives

| File             | Holds                                                            |
| ---------------- | ---------------------------------------------------------------- |
| `vite.config.ts` | `tailwindcss()` from `@tailwindcss/vite`, before `reactRouter()` |
| `app/app.css`    | Tailwind, `tw-animate-css`, the dark variant, the tokens         |
| `app/root.tsx`   | `import './app.css'`                                             |
| `tests/setup.ts` | `import '../app/app.css'`, the unit project's setup file         |

## Required values

| What             | Value                                                                                                                                                                                                                         |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| devDependencies  | `tailwindcss`, `@tailwindcss/vite`                                                                                                                                                                                            |
| plugin           | `tailwindcss()` after the runtime's plugin and before `reactRouter()`                                                                                                                                                         |
| `app/app.css`    | copied from `<skill-dir>/references/assets/react-router-app.css`: Tailwind, `tw-animate-css`, the dark variant, the theme's tokens for light and dark, plus `surface`, `code` and `selection` tokens and two wide breakpoints |
| `tests/setup.ts` | `import '../app/app.css'`, listed in the unit project's `setupFiles` where the blueprint's test config has one, so browser tests render with the styles                                                                       |

## Conventions

- **Tailwind is wired through `@tailwindcss/vite`**, `tailwindcss()` before `reactRouter()`; `app/app.css` is the one
  global stylesheet, imported by `app/root.tsx`.
- **Browser tests import `app/app.css`** through the unit project's setup file.

## Verify it is wired

- `tailwindcss()` comes before `reactRouter()` in `vite.config.ts`, and `app/root.tsx` imports `./app.css`.
- Where the unit project lists `setupFiles`, `tests/setup.ts` imports `../app/app.css`.
