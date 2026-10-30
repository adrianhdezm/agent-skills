# React Router + ESLint

The React and accessibility presets for a React Router app, and the overrides its routes and tests need. Both React
Router stacks use it.

## Required values

| What      | Value                                                                                                                                                                                                      |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| presets   | `react.configs.flat.recommended`, `react.configs.flat['jsx-runtime']`, `reactHooks.configs.flat.recommended`, `jsxA11y.flatConfigs.recommended`, `globals.browser`, `settings.react.version: 'detect'`     |
| packages  | `eslint@9`, `@eslint/js@9`, `eslint-plugin-react`, `eslint-plugin-react-hooks`, `eslint-plugin-jsx-a11y`, `globals`                                                                                        |
| overrides | `app/routes/**`: `@typescript-eslint/only-throw-error` off (loaders and actions throw `Response`s); tests: `@typescript-eslint/no-unsafe-assignment` off (`createRoutesStub` returns loosely typed values) |
| ignores   | `build`, `.react-router`, `eslint.config.js` (no project includes it)                                                                                                                                      |

## Pitfalls

- **`eslint-plugin-react` and `eslint-plugin-jsx-a11y` declare ESLint up to 9**, so a React Router app installs
  `eslint@9` and `@eslint/js@9`. Lift it when both plugins' `peerDependencies` list 10.
- **Throwing a `Response` from a loader** trips `only-throw-error` without the routes override.

## Conventions

- **Loaders and actions may throw `Response`s**: `only-throw-error` is off for `app/routes/` only.
- **ESLint stays on major 9** until the React plugins accept 10.
