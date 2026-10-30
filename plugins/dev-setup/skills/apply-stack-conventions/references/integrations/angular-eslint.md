# Angular + ESLint

angular-eslint's presets for an Angular package: TypeScript and inline templates linted together, selector prefixes per
folder, and the overrides its reducers and specs need. Both Angular stacks use it.

## Required values

| What            | Value                                                                                                                                                     |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| devDependencies | `angular-eslint@22`, `globals`                                                                                                                            |
| file            | `eslint.config.mjs` (the CLI's manifest is not `"type": "module"`)                                                                                        |
| presets         | `angular.configs.tsRecommended` with `processor: angular.processInlineTemplates`; `templateRecommended` + `templateAccessibility` for `**/*.html`         |
| typed preset    | `tseslint.configs.recommendedTypeChecked`, in a block with `files: ['**/*.ts']`, not the strict pair the other stacks take                                |
| selectors       | `app` (element kebab-case, attribute camelCase); `ui` under `src/app/components/ui/`                                                                      |
| overrides       | `*.reducer.ts`: `complexity` off; `*.spec.ts`: size limits off, and `no-restricted-imports` for `@vitest/browser/context` (message: use `vitest/browser`) |
| ignores         | the shared list, plus `dist/**`, `.angular/**`, `storybook-static/**`, `eslint.config.mjs`                                                                |

## Pitfalls

- **The strict typed presets fight Angular's idioms**: about 17 errors on ordinary code, such as
  `restrict-template-expressions` on bound numbers, `no-confusing-void-expression` on event handlers and
  `no-extraneous-class` on the root component. Angular packages take `recommendedTypeChecked`.
- **A typed preset not limited to `**/_.ts`** also runs on the virtual `.html`files`processInlineTemplates` creates
and crashes (`await-thenable`under the template parser): put it, and the shared typed rules, in a`files: ['\*\*/_.ts']` block.
- **`Validators.required` trips `@typescript-eslint/unbound-method`**, a known false positive: disable it on that line
  with a comment.

## Conventions

- **Templates are linted inline** through `processInlineTemplates`.
- **ESLint enforces the selector prefixes per folder**: `ui` under `components/ui/`, `app` everywhere else.
