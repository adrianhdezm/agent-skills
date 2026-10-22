# ESLint + Prettier

Per-project configs: flat ESLint 10 with type-checked rules, and Prettier per project. **Prettier formats, ESLint
judges**: `eslint-config-prettier` switches off every ESLint rule that would fight Prettier, and formatting is checked by
`format:check`, not by `lint`.

## Contents

- [Prettier](#prettier)
- [ESLint (API)](#eslint-api)
- [ESLint (Angular)](#eslint-angular)
- [Why these choices](#why-these-choices)

## Prettier

Each project owns its own `.prettierrc` and `.prettierignore`. **No root config.**

### `api/.prettierrc`

```json
{
  "singleQuote": true,
  "printWidth": 140,
  "trailingComma": "none"
}
```

### `api/.prettierignore`

```
node_modules
dist
db/migrations
db/data
```

### `web/.prettierrc`

Adds the Angular HTML parser override (web-specific):

```json
{
  "singleQuote": true,
  "printWidth": 140,
  "trailingComma": "none",
  "overrides": [
    {
      "files": "*.html",
      "options": {
        "parser": "angular"
      }
    }
  ]
}
```

### `web/.prettierignore`

```
node_modules
dist
.angular
```

Each project's `package.json` has `format` and `format:check` scripts (see `api-setup.md` and `web.md`). The root
`package.json` rolls them up with `pnpm -r`.

## ESLint (API)

### `api/eslint.config.mjs`

```js
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier/flat';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig([
  globalIgnores(['dist/**', 'db/**', 'eslint.config.mjs']),
  js.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      globals: { ...globals.node },
      parserOptions: {
        projectService: { defaultProject: 'tsconfig.json' },
        tsconfigRootDir: import.meta.dirname,
        sourceType: 'module'
      }
    }
  },
  {
    rules: {
      // Type-safe imports and unused-variable hygiene
      'no-unused-vars': 'off',
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          ignoreRestSiblings: true
        }
      ],
      '@typescript-eslint/no-non-null-assertion': 'error',

      // Complexity and size guardrails
      complexity: ['warn', 10],
      'max-depth': ['warn', 4],
      'max-lines-per-function': ['warn', 75],
      'max-statements': ['warn', 20],
      'max-params': ['warn', 4],
      'max-lines': ['warn', { max: 400, skipBlankLines: true, skipComments: true }],
      'max-nested-callbacks': ['warn', 3],

      // Clarity and simplicity
      curly: 'error',
      'no-else-return': 'warn',
      'no-nested-ternary': 'warn',
      'no-unneeded-ternary': 'warn'
    }
  },
  {
    // Controllers share a uniform async (req, res, next) signature for
    // consistency, even when a given handler has nothing to await.
    files: ['**/*.controller.ts'],
    rules: {
      '@typescript-eslint/require-await': 'off'
    }
  },
  {
    // A describe block holds every case for one module, so it is long by design.
    files: ['tests/**/*.test.ts'],
    rules: {
      'max-lines-per-function': 'off'
    }
  },
  eslintConfigPrettier
]);
```

## ESLint (Angular)

### `web/eslint.config.mjs`

```js
import eslint from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import angular from 'angular-eslint';
import eslintConfigPrettier from 'eslint-config-prettier/flat';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig([
  globalIgnores(['dist/**', '.angular/**', 'eslint.config.mjs']),
  {
    files: ['**/*.ts'],
    extends: [eslint.configs.recommended, tseslint.configs.recommendedTypeChecked, angular.configs.tsRecommended],
    processor: angular.processInlineTemplates,
    languageOptions: {
      globals: { ...globals.browser },
      parserOptions: {
        projectService: { defaultProject: 'tsconfig.json' },
        tsconfigRootDir: import.meta.dirname
      }
    },
    rules: {
      '@angular-eslint/directive-selector': ['error', { type: 'attribute', prefix: 'app', style: 'camelCase' }],
      '@angular-eslint/component-selector': ['error', { type: 'element', prefix: 'app', style: 'kebab-case' }],

      // Type-safe imports and unused-variable hygiene
      'no-unused-vars': 'off',
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          ignoreRestSiblings: true
        }
      ],
      '@typescript-eslint/no-non-null-assertion': 'error',

      // Complexity and size guardrails
      complexity: ['warn', 10],
      'max-depth': ['warn', 4],
      'max-lines-per-function': ['warn', 75],
      'max-statements': ['warn', 20],
      'max-params': ['warn', 4],
      'max-lines': ['warn', { max: 400, skipBlankLines: true, skipComments: true }],
      'max-nested-callbacks': ['warn', 3],

      // Clarity and simplicity
      curly: 'error',
      'no-else-return': 'warn',
      'no-nested-ternary': 'warn',
      'no-unneeded-ternary': 'warn'
    }
  },
  {
    files: ['**/*.html'],
    extends: [angular.configs.templateRecommended, angular.configs.templateAccessibility]
  },
  {
    // Reducers are dispatch switches that grow one branch per action, so their
    // cyclomatic complexity scales with the number of actions by design.
    files: ['**/*.reducer.ts'],
    rules: {
      complexity: 'off'
    }
  },
  {
    files: ['**/*.spec.ts'],
    rules: {
      'max-lines-per-function': 'off'
    }
  },
  eslintConfigPrettier
]);
```

## Why these choices

- **`defineConfig` + `globalIgnores` from `eslint/config`**: `tseslint.config()` is deprecated in favor of the core
  helper.
- **`recommendedTypeChecked`**: catches real bugs (floating promises, unsafe `any`, etc.) over syntax-only
  `recommended`. Requires `projectService` and the config file in `globalIgnores`.
- **`eslint-config-prettier/flat`, last**: switches off the ESLint rules that conflict with Prettier. Formatting is not a
  lint concern, so `pnpm lint` reports only code problems and `pnpm format:check` reports only formatting. CI runs both.
- **`angular.processInlineTemplates`**: lints templates declared inline in `@Component({ template: … })`, which every
  component here uses.
- **`^_` ignore pattern** on `no-unused-vars`: Express handlers that don't need `next` can declare it as `_next` without
  warnings.
- **Complexity guards as `warn`, not `error`**: they signal when a module grows too dense without blocking prototype
  code.
- **Per-file overrides carry a comment**: `*.controller.ts` → `require-await` off (uniform controller signature);
  `*.reducer.ts` → `complexity` off (grows with actions by design); tests → `max-lines-per-function` off.
