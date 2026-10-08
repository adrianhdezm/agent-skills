---
name: create-node-project
description: Scaffolds a single-package TypeScript project that Node 24 runs directly, with pnpm, ESLint, Prettier and Vitest wired up and three passing checks. Use when creating a new Node.js or TypeScript project, setting up tooling from scratch, or when the user asks to bootstrap, scaffold, init or start a Node project.
---

# Create Node Project

Creates a single-package TypeScript project with this shape:

- **Node 24 or newer runs the TypeScript as it is.** Nothing is built, bundled or emitted. Sources import each other with
  the `.ts` extension; the entry point is `src/main.ts`, run with `node`.
- **ESM only.** `"type": "module"`, `import`/`export` everywhere, config files included.
- **pnpm**, with an exact TypeScript version on the 6 line (typescript-eslint does not support TypeScript 7 yet) and
  caret ranges for the rest.
- **Prettier formats, ESLint judges.** ESLint runs with type information and the strict `typescript-eslint` presets;
  its formatting rules are switched off.
- **Vitest** for tests, in `tests/` mirroring `src/`, one `*.test.ts` per module.
- **Three checks, all required to pass:** `typecheck`, `lint` (zero warnings), `test`.

There are no templates. The tools' own CLIs create what they can (`git init`, `pnpm init`, `pnpm pkg set`, `pnpm add`,
`pnpm approve-builds`); every other file is written from the specification in
[references/tooling.md](references/tooling.md), so it can fit the project (its name, its first module, files that
already exist) instead of being copied verbatim.

## What gets created

```
my-project/
├── .env                  # empty; `start` and `dev` pass --env-file=.env, which needs it to exist
├── .gitignore
├── .prettierignore
├── .prettierrc
├── eslint.config.js
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml   # pnpm settings only; no packages list, so not a workspace
├── tsconfig.json         # solution file: only references the two below
├── tsconfig.app.json     # src/, the program
├── tsconfig.node.json    # tests/ and the config files: everything Node runs but nobody imports
├── src/
│   ├── main.ts           # entry point: wires things up and runs; the one file with side effects
│   └── <module>.ts       # the first module
└── tests/
    └── <module>.test.ts  # one ….test.ts per module in src/, same name
```

## Process

Copy this checklist and tick it off:

```
- [ ] 1. Toolchain checked
- [ ] 2. Directory, git and package.json created
- [ ] 3. Dependencies installed, TypeScript pinned, esbuild approved
- [ ] 4. Config files written from the spec
- [ ] 5. First module, its test and main.ts written
- [ ] 6. Formatted and checked
```

1. **Check the toolchain.** `node --version` must be 24 or newer, `pnpm --version` 11 or newer (`allowBuilds` is a
   pnpm 11 setting). Stop if the target directory already holds a `package.json`: follow
   [Adding the tooling to an existing project](#adding-the-tooling-to-an-existing-project) instead.

2. **Create the directory, git and `package.json`.** Ask for a one-sentence description if the user has not given one.

   ```sh
   mkdir -p my-project/src my-project/tests && cd my-project
   git init -q
   touch .env
   pnpm init --bare --no-init-package-manager
   pnpm pkg set name=my-project version=0.1.0 description="One sentence on what it does." \
     type=module engines.node=">=24" \
     scripts.start="node --env-file=.env src/main.ts" \
     scripts.dev="node --import=tsx --watch --env-file=.env src/main.ts" \
     scripts.lint="eslint . --max-warnings 0" \
     scripts.test="vitest run" \
     scripts.typecheck="tsc -b" \
     scripts.format="prettier --write ."
   pnpm pkg set private=true --json
   ```

   `private` is set on its own line because only `--json` stores it as a boolean, and `--json` would also parse every
   other value as JSON.

3. **Install the dev dependencies**, then pin TypeScript to the exact version that was installed and approve esbuild's
   install script, which writes `pnpm-workspace.yaml`:

   ```sh
   pnpm add -D typescript@6 @types/node@24 eslint @eslint/js typescript-eslint eslint-config-prettier prettier tsx vitest
   pnpm add -D -E typescript@"$(node -p "require('typescript/package.json').version")"
   pnpm approve-builds esbuild
   ```

   pnpm may warn that esbuild is not awaiting approval; it still writes the setting, which `pnpm <script>` needs later.
   Add the comment line to `pnpm-workspace.yaml` described in the spec.

4. **Write the config files** from [references/tooling.md](references/tooling.md): `tsconfig.json`,
   `tsconfig.app.json`, `tsconfig.node.json`, `eslint.config.js`, `.prettierrc`, `.prettierignore`, `.gitignore`.
   Every value the spec gives is required as given; keep its grouping and section comments, since they are part of
   the convention. Any extra config file (a `vitest.config.ts`, say) goes into the `include` of `tsconfig.node.json`.

5. **Write the first module, its test and `main.ts`**, following
   [references/conventions.md](references/conventions.md). Use the module the user asked for; if there is none yet,
   write a starter `src/greeting.ts` exporting `greet(name)` that returns `hello, ${name}`, with a doc comment, plus
   `tests/greeting.test.ts` testing it in Arrange / Act / Assert. `main.ts` imports the module with its `.ts`
   extension and runs it; it is the only file with side effects. Vitest fails when it finds no test files, so a module
   and its test always come together.

6. **Format and run the checks.**

   ```sh
   pnpm format
   pnpm typecheck && pnpm lint && pnpm test && pnpm start
   ```

   All three checks pass with zero warnings and `pnpm start` runs `main.ts`. The checks do not catch a wrong
   `package.json`, so also confirm that `private` is `true` (a boolean, not `"true"`) and that `typescript` has an
   exact version with no `^`.

## Rules the tooling enforces

These bite first when writing code in the project, so know them before the first module:

- **No type assertions** (`as`, angle brackets) in `src/`. Narrow with a type guard or restructure. Tests may assert.
- **`import type` for types**, in a separate statement from value imports. Type-only imports must not survive Node's
  type stripping.
- **No `enum`, `namespace`, parameter properties or `import x = require()`**: Node cannot strip them
  (`erasableSyntaxOnly`). Use `as const` objects and unions.
- **`array[0]` is `T | undefined`** (`noUncheckedIndexedAccess`); handle it.
- **`_` prefix** marks an intentionally unused parameter or destructured value.
- **Size limits are warnings that fail `lint`** (`--max-warnings 0`): complexity 10, depth 4, 75 lines per function,
  20 statements, 4 params, 400 lines per file, one class per file. Split rather than raise the limit.
- **`defineConfig` from `eslint/config`**, not `tseslint.config()`, which is deprecated and reported.
- **Every new config file** goes into the `include` of `tsconfig.node.json`, or ESLint reports it as belonging to no
  project.

## Adding the tooling to an existing project

Skip `pnpm init`, and do not overwrite what is there:

1. Set the `package.json` fields and scripts from step 2 with `pnpm pkg set`, leaving `name`, `version` and
   `description` alone. Check with the user before replacing a script that already exists under the same name.
2. Install the dev dependencies as in step 3.
3. Write each config file from the spec that the project lacks. Where one exists, merge the spec's values into it and
   say what changed.
4. Move sources under `src/` and tests under `tests/`, or adjust the `include` arrays in the two tsconfigs.
5. Run `pnpm format`, then the three checks, and fix what they report.

## References

**What each config file must contain and why, and what changes in a workspace**: see
[references/tooling.md](references/tooling.md)

**Code conventions the tooling is set up for** (tests, doc comments, errors, `undefined` over `null`): see
[references/conventions.md](references/conventions.md)

## Review Checklist

- [ ] Node 24+ and pnpm 11+ confirmed
- [ ] `package.json` built with `pnpm init` and `pnpm pkg set`, `private` a boolean, TypeScript pinned exactly on 6.x
- [ ] Config files written from the spec, with its values, grouping and comments
- [ ] First module and its test follow the conventions; `main.ts` only wires up and runs
- [ ] `pnpm typecheck && pnpm lint && pnpm test` passes with zero warnings, and `pnpm start` runs
