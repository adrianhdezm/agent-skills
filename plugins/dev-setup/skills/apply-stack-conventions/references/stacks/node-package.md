# Node package

A single-package TypeScript project that Node 24 runs as it is: a library, a CLI or a script. Nothing is built,
bundled or emitted; the entry point is `src/main.ts`. It has the strictest lint of the stacks.

## Composition

- [Code style](../architecture/code-style.md)
- [pnpm](../technologies/pnpm.md)
- [TypeScript](../technologies/typescript.md)
- [Node](../technologies/node.md)
- [Node + TypeScript](../integrations/node-typescript.md)
- [ESLint](../technologies/eslint.md)
- [TypeScript + ESLint](../integrations/typescript-eslint.md)
- [Prettier](../technologies/prettier.md)
- [ESLint + Prettier](../integrations/eslint-prettier.md)
- [Vitest](../technologies/vitest.md)

## Examples

- [Node module](../examples/node-module.md): the first module, its test and `main.ts`

## Shape

```
my-project/
├── .env                   # empty; `start` and `dev` pass --env-file=.env, which needs it to exist
├── .gitignore / .prettierignore / .prettierrc
├── coding-conventions.md  # assembled from the stack blueprint
├── eslint.config.js
├── package.json / pnpm-lock.yaml / pnpm-workspace.yaml
├── tsconfig.json          # solution file
├── tsconfig.app.json      # src/, the program
├── tsconfig.node.json     # tests/ and eslint.config.js
├── src/
│   ├── main.ts            # the entry point, the one file with side effects
│   └── <module>.ts
└── tests/
    └── <module>.test.ts   # one per module in src/, same name
```

## Required values

| What                 | Value                                                                                                                                                                                                                                                                                 |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| scripts              | `start` `node --env-file=.env src/main.ts`; `dev` `node --import=tsx --watch --env-file=.env src/main.ts`; `typecheck` `tsc -b`; `lint` `eslint . --max-warnings 0`; `test` `vitest run`; `format`, `format:check`                                                                    |
| `allowBuilds`        | `esbuild`                                                                                                                                                                                                                                                                             |
| devDependencies      | `@types/node@24`, `eslint`, `@eslint/js`, `typescript-eslint`, `eslint-config-prettier`, `prettier`, `tsx`, `vitest@5`, and the pinned `typescript`                                                                                                                                   |
| `tsconfig.app.json`  | includes `src`; the shared options with `lib`/`target` `ES2025`, `module: "NodeNext"`, `types: ["node"]`, `allowImportingTsExtensions`, `noImplicitOverride`                                                                                                                          |
| `tsconfig.node.json` | extends the app project, with a leading comment that only the file set and the JavaScript switches differ: `allowJs`, `checkJs`, its own `tsBuildInfoFile`, `include: ["tests", "eslint.config.js"]`                                                                                  |
| `eslint.config.js`   | `strictTypeChecked` and `stylisticTypeChecked`; correctness adds `consistent-type-assertions: never` and `max-classes-per-file: 1`; `consistent-type-imports` takes `{ prefer: 'type-imports' }` alone (Node + TypeScript says why); tests allow assertions; ignoring `**/dist/**`    |
| `.prettierignore`    | `node_modules`, `dist`, `pnpm-lock.yaml`                                                                                                                                                                                                                                              |
| `.gitignore`         | one comment per group: dependencies (`node_modules`); output (`out`, `dist`, `*.tgz`); coverage (`coverage`, `*.lcov`); logs (`logs`, `*.log`); dotenv (`.env`, `.env.*.local`, `.env.local`); caches (`.eslintcache`, `.cache`, `*.tsbuildinfo`); IDEs and OS (`.idea`, `.DS_Store`) |

## Scaffold

- **An empty `.env`** is created with the manifest: the scripts' `--env-file` needs it to exist.
- **Into an existing project**: move sources under `src/` and tests under `tests/`, or adjust the two `include` arrays.
- **Growing into a workspace**: the pieces to move are exactly the ones inlined here: versions into the catalog, the
  ESLint rules into a `tooling/eslint-config` package exporting `config({ tsconfigRootDir })`, the compiler options into
  a `tooling/tsconfig` package with a base file, and the scripts into root `pnpm -r` rollups.

## Conventions

### Layout

- **`src/main.ts` is the only file that does something when imported**: it reads the environment, builds what it needs
  and runs. Every other file under `src/` exports functions or classes.
- **A test file per source file**, same base name, in `tests/`, importing from `../src/….ts`. `main.ts` has none: its
  behaviour lives, and is tested, in the modules it calls.
- **Errors are classes** with a name the caller can check, under `src/errors/`.

### Values and control flow

- **`undefined`, not `null`, for absence**, except where an external format (JSON, a provider API) says otherwise.
- **`Promise.all` for independent async work**; `for … of` with `await` only where order matters.

### Lint

- **No type assertions in `src/`** (`consistent-type-assertions: never`): narrow with a type guard. The one accepted
  exception is a library that offers no other way, with `// eslint-disable-next-line` and a reason.
- **One class per file.** **Warnings fail the check** (`--max-warnings 0`).

### Commands

`pnpm start` runs the program, `pnpm dev` reruns it on change; `pnpm typecheck`, `pnpm lint`, `pnpm test` and
`pnpm format:check` are the four required checks.

## Smoke test

`pnpm start` runs the entry point: with the example, it prints `hello, world`.
