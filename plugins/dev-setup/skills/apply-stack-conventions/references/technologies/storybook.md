# Storybook

Storybook 10 as the workshop where components are built and reviewed: a story file beside every component, one story per
meaningful state, on the app's own Vite build. Not a test runner.

**Realises:** [UI components](../architecture/ui-components.md)

## Use it like this

- **On the framework's Vite builder**, so stories compile the way the app does; the framework's integration names the
  package. Never a webpack builder beside a Vite app.
- **A story file beside every component** in `components/` and `components/ui/`, named after it (`<name>.stories.*`),
  with one story per meaningful state: `args` for its inputs, `fn()` for its outputs.
- **Titles follow the tiers**: `UI/<Name>` for a primitive, `Components/<Name>` for an app component.
- **The preview loads the app's global stylesheet**, so components render with the real theme.
- **Storybook builds and reviews components; behaviour is tested elsewhere.** A story is not a test, and no test imports
  a story.
- **Scripts**: `storybook` runs it on port 6006; `build-storybook` writes `storybook-static/`, which the smoke test
  checks through `storybook-static/index.json`.

## Required values

| What                   | Value                                                                   |
| ---------------------- | ----------------------------------------------------------------------- |
| dependencies           | dev `storybook@10`, the framework's Vite package on the same major      |
| config                 | `.storybook/main.ts` (stories glob, framework), `.storybook/preview.ts` |
| port                   | `6006`                                                                  |
| `.gitignore` additions | `*storybook.log`, `storybook-static`                                    |

## Pitfalls

- **A Storybook builder that is not the app's** compiles stories differently from the app, and what renders in the
  workshop stops matching what ships.
- **A preview without the global stylesheet** renders every component unstyled.

## Conventions

- **Every component has a story file beside it**, one story per meaningful state, `args` for its inputs and `fn()` for
  its outputs, titled `UI/<Name>` for a primitive and `Components/<Name>` for an app component.
- **Storybook is where components are built and reviewed, not a test**: behaviour is tested by browser specs.
