---
type: Integration
title: React Router + Tailwind
description: Tailwind's Vite plugin and its order, `app/app.css` with the theme tokens, the test setup
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
- **The theme is `app/app.css`**: Tailwind, `tw-animate-css`, the dark variant and the tokens for light and dark,
  written exactly as the Reference code below rather than by hand.

## Where it lives

| File             | Holds                                                            |
| ---------------- | ---------------------------------------------------------------- |
| `vite.config.ts` | `tailwindcss()` from `@tailwindcss/vite`, before `reactRouter()` |
| `app/app.css`    | Tailwind, `tw-animate-css`, the dark variant, the tokens         |
| `app/root.tsx`   | `import './app.css'`                                             |
| `tests/setup.ts` | `import '../app/app.css'`, the unit project's setup file         |

## Required values

| What             | Value                                                                                                                                                                                            |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| devDependencies  | `tailwindcss`, `@tailwindcss/vite`                                                                                                                                                               |
| plugin           | `tailwindcss()` after the runtime's plugin and before `reactRouter()`                                                                                                                            |
| `app/app.css`    | exactly as the Reference code below: Tailwind, `tw-animate-css`, the dark variant, the theme's tokens for light and dark, plus `surface`, `code` and `selection` tokens and two wide breakpoints |
| `tests/setup.ts` | `import '../app/app.css'`, listed in the unit project's `setupFiles` where the blueprint's test config has one, so browser tests render with the styles                                          |

## Reference code

`app/app.css`: Tailwind and its animations, the dark variant, the theme's tokens for light and dark mapped to Tailwind
colours, the `surface`, `code` and `selection` tokens, and two wide breakpoints:

```css
@import "tailwindcss";
@import "tw-animate-css";

@custom-variant dark (&:is(.dark *));

@theme inline {
  --breakpoint-3xl: 1600px;
  --breakpoint-4xl: 2000px;

  --radius-sm: calc(var(--radius) * 0.6);
  --radius-md: calc(var(--radius) * 0.8);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) * 1.4);
  --radius-2xl: calc(var(--radius) * 1.8);
  --radius-3xl: calc(var(--radius) * 2.2);
  --radius-4xl: calc(var(--radius) * 2.6);

  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);

  --color-chart-1: var(--chart-1);
  --color-chart-2: var(--chart-2);
  --color-chart-3: var(--chart-3);
  --color-chart-4: var(--chart-4);
  --color-chart-5: var(--chart-5);

  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-ring: var(--sidebar-ring);

  --color-surface: var(--surface);
  --color-surface-foreground: var(--surface-foreground);
  --color-code: var(--code);
  --color-code-foreground: var(--code-foreground);
  --color-code-highlight: var(--code-highlight);
  --color-code-number: var(--code-number);
  --color-selection: var(--selection);
  --color-selection-foreground: var(--selection-foreground);
}

:root {
  --radius: 0.625rem;

  --background: oklch(1 0 0);
  --foreground: oklch(0% 0 0);

  --card: oklch(1 0 0);
  --card-foreground: oklch(0% 0 0);

  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0% 0 0);

  --primary: oklch(0% 0 0);
  --primary-foreground: oklch(0.985 0 0);

  --secondary: oklch(0.97 0 0);
  --secondary-foreground: oklch(0.205 0 0);

  --muted: oklch(0.97 0 0);
  --muted-foreground: oklch(0.556 0 0);

  --accent: oklch(0.97 0 0);
  --accent-foreground: oklch(0.205 0 0);

  --destructive: oklch(0.577 0.245 27.325);
  --destructive-foreground: oklch(0.97 0.01 17);

  --border: oklch(0.922 0 0);
  --input: oklch(0.922 0 0);
  --ring: oklch(0.708 0 0);

  --chart-1: var(--color-blue-300);
  --chart-2: var(--color-blue-500);
  --chart-3: var(--color-blue-600);
  --chart-4: var(--color-blue-700);
  --chart-5: var(--color-blue-800);

  --sidebar: oklch(0.985 0 0);
  --sidebar-foreground: oklch(0% 0 0);
  --sidebar-primary: oklch(0.205 0 0);
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(0.97 0 0);
  --sidebar-accent-foreground: oklch(0.205 0 0);
  --sidebar-border: oklch(0.922 0 0);
  --sidebar-ring: oklch(0.708 0 0);

  --surface: oklch(0.98 0 0);
  --surface-foreground: var(--foreground);

  --code: var(--surface);
  --code-foreground: var(--surface-foreground);
  --code-highlight: oklch(0.96 0 0);
  --code-number: oklch(0.56 0 0);

  --selection: oklch(0% 0 0);
  --selection-foreground: oklch(1 0 0);
}

.dark {
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);

  --card: oklch(0.205 0 0);
  --card-foreground: oklch(0.985 0 0);

  --popover: oklch(0.205 0 0);
  --popover-foreground: oklch(0.985 0 0);

  --primary: oklch(0.922 0 0);
  --primary-foreground: oklch(0.205 0 0);

  --secondary: oklch(0.269 0 0);
  --secondary-foreground: oklch(0.985 0 0);

  --muted: oklch(0.269 0 0);
  --muted-foreground: oklch(0.708 0 0);

  --accent: oklch(0.371 0 0);
  --accent-foreground: oklch(0.985 0 0);

  --destructive: oklch(0.704 0.191 22.216);
  --destructive-foreground: oklch(0.58 0.22 27);

  --border: oklch(1 0 0 / 10%);
  --input: oklch(1 0 0 / 15%);
  --ring: oklch(0.556 0 0);

  --chart-1: var(--color-blue-300);
  --chart-2: var(--color-blue-500);
  --chart-3: var(--color-blue-600);
  --chart-4: var(--color-blue-700);
  --chart-5: var(--color-blue-800);

  --sidebar: oklch(0.205 0 0);
  --sidebar-foreground: oklch(0.985 0 0);
  --sidebar-primary: oklch(0.488 0.243 264.376);
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(0.269 0 0);
  --sidebar-accent-foreground: oklch(0.985 0 0);
  --sidebar-border: oklch(1 0 0 / 10%);
  --sidebar-ring: oklch(0.439 0 0);

  --surface: oklch(0.2 0 0);
  --surface-foreground: oklch(0.708 0 0);

  --code: var(--surface);
  --code-foreground: var(--surface-foreground);
  --code-highlight: oklch(0.27 0 0);
  --code-number: oklch(0.72 0 0);

  --selection: oklch(0.922 0 0);
  --selection-foreground: oklch(0.205 0 0);
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }

  body {
    @apply bg-background text-foreground;
  }

  ::selection {
    background-color: var(--selection);
    color: var(--selection-foreground);
  }
}
```

## Conventions

- **Tailwind is wired through `@tailwindcss/vite`**, `tailwindcss()` before `reactRouter()`; `app/app.css` is the one
  global stylesheet, imported by `app/root.tsx`.
- **Browser tests import `app/app.css`** through the unit project's setup file.

## Verify it is wired

- `tailwindcss()` comes before `reactRouter()` in `vite.config.ts`, and `app/root.tsx` imports `./app.css`.
- Where the unit project lists `setupFiles`, `tests/setup.ts` imports `../app/app.css`.
