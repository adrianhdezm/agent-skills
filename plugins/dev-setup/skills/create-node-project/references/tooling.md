# Tooling specification

What each generated file must contain, and why. Write the files from this; there is nothing to copy. Where a value is
given, use it as is: the checks and the conventions depend on it.

## Contents

- [package.json](#packagejson)
- [pnpm-workspace.yaml](#pnpm-workspaceyaml)
- [The three tsconfig files](#the-three-tsconfig-files)
- [eslint.config.js](#eslintconfigjs)
- [Prettier](#prettier)
- [.gitignore](#gitignore)
- [Where a workspace differs](#where-a-workspace-differs)

## package.json

Created by `pnpm init`, then filled with `pnpm pkg set` and `pnpm add`; never written by hand.

| Field          | Value                                                   |
| -------------- | ------------------------------------------------------- |
| `name`         | the directory's basename, unless the user names it      |
| `version`      | `0.1.0`                                                 |
| `description`  | one sentence on what the project does                   |
| `private`      | `true`                                                  |
| `type`         | `module`                                                |
| `engines.node` | `>=24`                                                  |
| `start`        | `node --env-file=.env src/main.ts`                      |
| `dev`          | `node --import=tsx --watch --env-file=.env src/main.ts` |
| `lint`         | `eslint . --max-warnings 0`                             |
| `test`         | `vitest run`                                            |
| `typecheck`    | `tsc -b`                                                |
| `format`       | `prettier --write .`                                    |

Dev dependencies: `typescript` pinned exactly on the 6 line; `@types/node@24`, `eslint`, `@eslint/js`,
`typescript-eslint`, `eslint-config-prettier`, `prettier`, `tsx` and `vitest` with caret ranges.

- `private: true`: this is a program, not a package anyone installs, so there is no `exports`, no `files` and no build.
  `start` runs `src/main.ts` with Node as it is.
- `typecheck` is `tsc -b`: it checks the two projects the root `tsconfig.json` references. `tsc -p .` would check
  nothing, because the root file has no sources of its own.
- `lint` passes `--max-warnings 0` so the size guardrails, which are warnings, still fail the check. They are warnings
  only so that a single one reads as a nudge in the editor, not an error.
- `start` and `dev` pass `--env-file=.env`, which needs the file to exist: create an empty one; it is git-ignored.
- `dev` needs `tsx` for file watching; plain `node` runs the sources already, so `tsx` is only there for `--watch`.
- TypeScript stays on the 6 line because typescript-eslint rejects TypeScript 7 at load time. Bump the major once
  typescript-eslint supports it. `pnpm add -E` only pins when the spec names a full version, hence the second
  `pnpm add` with the installed version in the process. `@types/node` follows the Node major in `engines`.

## pnpm-workspace.yaml

Created by `pnpm approve-builds esbuild`, which writes `allowBuilds: { esbuild: true }`. Add a first-line comment saying
these are pnpm settings and a single package needs no `packages` list.

pnpm keeps its settings in this file even for a single package; without a `packages` list it does not make the project
a workspace. Vitest can pull in esbuild, which has an install script pnpm refuses to run unless told, and until it is
told every `pnpm <script>` fails with `ERR_PNPM_IGNORED_BUILDS`.

## The three tsconfig files

Two TypeScript projects, because two kinds of file live in the repository: the sources, which are the program, and the
files that only run under Node and are never imported, which are the tests and `eslint.config.js`.

**`tsconfig.json`** is a solution file: `"files": []` and `references` to `./tsconfig.app.json` and
`./tsconfig.node.json`, nothing else. It is what `tsc -b`, the editor and ESLint start from.

**`tsconfig.app.json`** holds every compiler option, grouped under three line comments, and `"include": ["src"]`:

| Group                                 | Options                                                                                                                                                              |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Environment & language level          | `lib: ["ES2025"]`, `target: "ES2025"`, `module: "NodeNext"`, `moduleDetection: "force"`, `types: ["node"]`                                                           |
| Node strips types; nothing is emitted | `allowImportingTsExtensions`, `verbatimModuleSyntax`, `erasableSyntaxOnly`, `noEmit` (all `true`), `tsBuildInfoFile: "./node_modules/.tmp/tsconfig.app.tsbuildinfo"` |
| Checks beyond `strict`                | `skipLibCheck`, `noFallthroughCasesInSwitch`, `noUncheckedIndexedAccess`, `noImplicitOverride` (all `true`)                                                          |

**`tsconfig.node.json`** extends `./tsconfig.app.json`, with a leading comment saying only the file set and the
JavaScript switches differ. It sets `allowJs`, `checkJs` and
`tsBuildInfoFile: "./node_modules/.tmp/tsconfig.node.tsbuildinfo"`, and includes `tests` and `eslint.config.js`.

- **The split**: the app project is the program alone, what `node src/main.ts` runs. The tests reach into `src/`
  through their imports, so the node project checks those files too, with the same options. `eslint.config.js` is
  type-checked like everything else (`checkJs`, so no `// @ts-check` comment is needed), and because a project now
  covers it, ESLint lints it with type information too. Every later config file, a `vitest.config.ts` say, goes into
  the `include` of `tsconfig.node.json`.
- **`tsBuildInfoFile`**: `tsc -b` writes one build-info file per project even with `noEmit`, and by default next to
  the tsconfig. Pointing them into `node_modules/.tmp` keeps them out of the tree. The node project must set its own
  path; inherited from the app it would make both projects write the same file.
- **`allowImportingTsExtensions` + `noEmit`**: imports are written as `./thing.ts`, which is what Node resolves at
  runtime.
- **`verbatimModuleSyntax`**: type-only imports must say `import type`, so nothing type-only survives type stripping.
- **`erasableSyntaxOnly`**: forbids the TypeScript syntax Node cannot strip: `enum`, `namespace`, parameter
  properties, `import x = require()`.
- **`noUncheckedIndexedAccess`**: `array[0]` is `T | undefined`.
- **`strict`** is not listed because TypeScript 6 turns it on by default.
- **`lib` and `target`** are `ES2025`, matching what Node 24 implements; `module` is `NodeNext` so resolution follows
  Node's own rules.

## eslint.config.js

ESM, `export default defineConfig(...)` with `defineConfig` imported from `eslint/config`. The blocks, in this order:

1. `{ ignores: ['**/dist/**'] }`
2. `js.configs.recommended` from `@eslint/js`
3. `tseslint.configs.strictTypeChecked` and `tseslint.configs.stylisticTypeChecked` from `typescript-eslint`
4. `languageOptions.parserOptions` with `projectService: true` and `tsconfigRootDir: import.meta.dirname`, with a
   comment saying which project each directory belongs to
5. `eslint-config-prettier`, so no formatting rule survives
6. The project's rules, grouped under the line comments `// Correctness`, `// Complexity and size guardrails` and
   `// Clarity and simplicity`
7. A block for `files: ['**/*.test.ts']` relaxing rules for tests, under the comment `// Test files`

The project's rules:

| Group       | Rule                                                         | Setting                                                                                                                    |
| ----------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| Correctness | `curly`                                                      | `error`                                                                                                                    |
|             | `@typescript-eslint/consistent-type-assertions`              | `error`, `{ assertionStyle: 'never' }`                                                                                     |
|             | `@typescript-eslint/consistent-type-imports`                 | `error`, `{ prefer: 'type-imports' }`                                                                                      |
|             | `@typescript-eslint/no-unused-vars`                          | `error`, `argsIgnorePattern`, `varsIgnorePattern`, `destructuredArrayIgnorePattern` all `'^_'`, `ignoreRestSiblings: true` |
| Size        | `complexity`                                                 | `warn`, 10                                                                                                                 |
|             | `max-depth`                                                  | `warn`, 4                                                                                                                  |
|             | `max-lines-per-function`                                     | `warn`, 75                                                                                                                 |
|             | `max-statements`                                             | `warn`, 20                                                                                                                 |
|             | `max-params`                                                 | `warn`, 4                                                                                                                  |
|             | `max-lines`                                                  | `warn`, `{ max: 400, skipBlankLines: true, skipComments: true }`                                                           |
|             | `max-nested-callbacks`                                       | `warn`, 3                                                                                                                  |
|             | `max-classes-per-file`                                       | `error`, 1                                                                                                                 |
| Clarity     | `no-else-return`, `no-nested-ternary`, `no-unneeded-ternary` | `warn`                                                                                                                     |

The test block turns off `max-lines-per-function`, `max-nested-callbacks`, `max-statements` and
`@typescript-eslint/consistent-type-assertions`.

- **`defineConfig` from `eslint/config`**, not `tseslint.config()`. The latter is deprecated, and since the config
  file is linted with type information, `@typescript-eslint/no-deprecated` reports it.
- **`projectService: true`**: every file ESLint sees belongs to a project, `src/` to `tsconfig.app.json`, `tests/` and
  the config files to `tsconfig.node.json`. A file in neither is reported, not silently linted without types.
- **No type assertions in source**: narrow with a type guard or restructure. The one accepted exception is a library
  that offers no other way, marked with `// eslint-disable-next-line` and a comment saying why.
- **`_` patterns**: a `_` prefix marks an intentionally unused parameter or destructured value.
- **Size guardrails** are warnings, but `--max-warnings 0` fails the check on them. Split the function or file rather
  than raising the limit.
- **Test files** drop the function-size, statement and nesting limits, and allow type assertions, because a test is
  one long function of setup and a fake often needs an assertion.

## Prettier

`.prettierrc` is JSON with `$schema: "https://json.schemastore.org/prettierrc"`, `singleQuote: true`,
`printWidth: 140` and `trailingComma: "none"`. Everything else is Prettier's default: two-space indent, semicolons,
double quotes in JSX, LF line endings.

`.prettierignore` lists `node_modules`, `dist` and `pnpm-lock.yaml`.

## .gitignore

Grouped under one comment per section: dependencies (`node_modules`); output (`out`, `dist`, `*.tgz`); code coverage
(`coverage`, `*.lcov`); logs (`logs`, `*.log`); dotenv files (`.env`, `.env.*.local`, `.env.local`); caches
(`.eslintcache`, `.cache`, `*.tsbuildinfo`); IDEs and OS (`.idea`, `.DS_Store`).

## Where a workspace differs

If the project later grows into a workspace, the pieces to move are exactly the ones inlined here:

| Single package                        | Workspace                                                                    |
| ------------------------------------- | ---------------------------------------------------------------------------- |
| Versions pinned in `package.json`     | `catalog:` in `pnpm-workspace.yaml`, `"catalog:"` in packages                |
| `eslint.config.js` holds the rules    | A `tooling/eslint-config` package exporting `config({ tsconfigRootDir })`    |
| `tsconfig.app.json` holds the options | A `tooling/tsconfig` package with `tsconfig.base.json`, extended per package |
| Scripts run in place                  | Root scripts run `pnpm -r <script>` across the packages                      |
