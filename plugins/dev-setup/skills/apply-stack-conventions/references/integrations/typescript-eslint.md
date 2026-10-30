# TypeScript + ESLint

Linting with type information through typescript-eslint: every linted file belongs to a TypeScript project, the
type-checked presets catch what syntax alone cannot, and TypeScript moves only when typescript-eslint accepts it. Every
stack uses it.

## The seam

```
eslint.config.js ─► typescript-eslint preset + parserOptions { projectService, tsconfigRootDir }
                         └─► the tsconfig projects ─► every linted file must be in one
```

- **Type-checked rules**, through `projectService: true` and `tsconfigRootDir: import.meta.dirname`: a file in no
  project is reported instead of being linted without types. **`strictTypeChecked` plus `stylisticTypeChecked`** is the
  preset: beyond floating and misused promises and unsafe `any`, it catches needless conditions, confusing `void`
  returns and loose template expressions. A framework whose own idioms it rejects says so in that framework's ESLint
  integration and takes `recommendedTypeChecked` instead.
- **`defineConfig` from `eslint/config`**, not `tseslint.config()`, which is deprecated and reported by
  `@typescript-eslint/no-deprecated`.
- **Config files are linted with types too**: they sit in `tsconfig.node.json`'s `include`, or in `globalIgnores` when
  no project includes them.

## Required values

The preset is `tseslint.configs.strictTypeChecked` and `tseslint.configs.stylisticTypeChecked`, after `js.configs.recommended`
and before `eslint-config-prettier`. The shared correctness rules typescript-eslint adds:

| Rule                                         | Setting                                                                                                                    |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `@typescript-eslint/consistent-type-imports` | `error`, `{ prefer: 'type-imports', fixStyle: 'inline-type-imports' }`                                                     |
| `no-unused-vars`                             | `off`: the base rule does not understand types, and reports type-only imports and overload signatures as unused            |
| `@typescript-eslint/no-unused-vars`          | `error`, `argsIgnorePattern`, `varsIgnorePattern`, `destructuredArrayIgnorePattern` all `'^_'`, `ignoreRestSiblings: true` |
| `@typescript-eslint/no-non-null-assertion`   | `error`                                                                                                                    |

The TypeScript ceiling comes from typescript-eslint:

```sh
pnpm view typescript-eslint peerDependencies    # e.g. "typescript": "<6.1.0"
```

## Pitfalls

- **A config file in no TypeScript project** is reported as not part of any project: add it to `tsconfig.node.json`, or
  ignore it.
- **The base `no-unused-vars` left on** beside `@typescript-eslint/no-unused-vars` reports the same variable twice, and
  flags type-only imports the typed rule accepts: keep it `off`.
- **A caret or `@latest` TypeScript** moves past typescript-eslint's ceiling on the next install and breaks the lint.

## Conventions

- **Lint runs with type information.** A new file must belong to a TypeScript project, or ESLint reports it.
- **TypeScript moves only when typescript-eslint's peer range accepts the new version.**
- **No non-null assertions, type-only imports marked `type`, unused names prefixed `_`**: the shared typed rules enforce
  them.

## Verify it is wired

- `eslint.config.js` sets `projectService: true` and `tsconfigRootDir`, and uses `strictTypeChecked` and
  `stylisticTypeChecked`, or the preset its framework's ESLint integration names.
- `pnpm exec eslint --print-config <a config file>` succeeds, so the config files are in a project.
