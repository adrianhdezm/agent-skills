# Angular + ESLint

angular-eslint's presets for an Angular package: TypeScript and inline templates linted together, selector prefixes per
folder, and the overrides its reducers and specs need. Both Angular stacks use it.

## Required values

| What      | Value                                                                                                                                             |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| packages  | dev `angular-eslint@22`, `globals`                                                                                                                |
| file      | `eslint.config.mjs` (the CLI's manifest is not `"type": "module"`)                                                                                |
| presets   | `angular.configs.tsRecommended` with `processor: angular.processInlineTemplates`; `templateRecommended` + `templateAccessibility` for `**/*.html` |
| selectors | `app` (element kebab-case, attribute camelCase); `ui` under `src/app/components/ui/`                                                              |
| overrides | `*.reducer.ts`: `complexity` off; `*.spec.ts`: size limits off                                                                                    |
| ignores   | `dist/**`, `.angular/**`, `storybook-static/**`, `eslint.config.mjs`                                                                              |

## Pitfalls

- **`Validators.required` trips `@typescript-eslint/unbound-method`**, a known false positive: disable it on that line
  with a comment.

## Conventions

- **Templates are linted inline** through `processInlineTemplates`.
- **ESLint enforces the selector prefixes per folder**: `ui` under `components/ui/`, `app` everywhere else.
