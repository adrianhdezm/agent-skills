# Tooling specification

What each generated file must contain, and why. Write the files from this; there is nothing to copy. Where a value is
given, use it as is: the checks depend on it.

## Contents

- [Versions](#versions)
- [package.json](#packagejson)
- [pnpm-workspace.yaml](#pnpm-workspaceyaml)
- [wrangler.jsonc](#wranglerjsonc)
- [vite.config.ts and vitest.config.ts](#viteconfigts-and-vitestconfigts)
- [The four tsconfig files](#the-four-tsconfig-files)
- [eslint.config.js](#eslintconfigjs)
- [Prettier](#prettier)
- [.gitignore](#gitignore)
- [The starter test](#the-starter-test)

## Versions

Two packages are held back by a peer range; everything else takes the latest release with a caret.

| Package       | Held at                       | Because                                                             | Lift when                                                         |
| ------------- | ----------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `typescript`  | exact version on the 6.0 line | `typescript-eslint` declares `typescript: <6.1.0`                   | `pnpm view typescript-eslint peerDependencies` allows a newer one |
| `vitest`      | the major the plugin allows   | `@cloudflare/vitest-plugin` declares its Vitest range               | the plugin's `peerDependencies` lists a newer major               |
| `@types/node` | the local Node major          | it types `vite.config.ts` and `vitest.config.ts`, which run in Node | Node is upgraded                                                  |

TypeScript is pinned exactly, not with a caret: a caret would accept 6.1 the day it ships, and typescript-eslint would
then refuse to load. `pnpm add -E` only pins when given a full version, hence the second `pnpm add` in the process.

Use `@cloudflare/vitest-plugin`. The older `@cloudflare/vitest-pool-workers` is deprecated and renamed; its README says
so and it receives no updates.

## package.json

Created by `pnpm init`, then filled with `pnpm pkg set` and `pnpm add`; never written by hand.

| Field          | Value                                                                    |
| -------------- | ------------------------------------------------------------------------ |
| `name`         | the directory's basename, unless the user names it; also the Worker name |
| `version`      | `0.1.0`                                                                  |
| `description`  | one sentence on what the Worker does                                     |
| `private`      | `true`                                                                   |
| `type`         | `module`                                                                 |
| `engines.node` | `>=24`                                                                   |
| `cf-typegen`   | `wrangler types`                                                         |
| `typecheck`    | `pnpm run cf-typegen && tsc -b`                                          |
| `lint`         | `eslint .`                                                               |
| `lint:fix`     | `eslint . --fix`                                                         |
| `test`         | `vitest run`                                                             |
| `dev`          | `vite dev`                                                               |
| `build`        | `vite build`                                                             |
| `preview`      | `pnpm run build && vite preview`                                         |
| `deploy`       | `pnpm run build && wrangler deploy`                                      |
| `format`       | `prettier --write . --cache`                                             |
| `format:check` | `prettier --check . --cache`                                             |

Dependencies: `hono`. Dev dependencies: `typescript` (exact), `@types/node`, `wrangler`, `vite`,
`@cloudflare/vite-plugin`, `vitest`, `@cloudflare/vitest-plugin`, `eslint`, `@eslint/js`, `typescript-eslint`,
`eslint-config-prettier`, `prettier`.

- **`typescript` is a dev dependency.** Vite bundles the Worker; nothing reads TypeScript at runtime.
- **`typecheck` regenerates the runtime types first**, so a binding added to `wrangler.jsonc` is never checked against
  stale types.
- **`tsc -b`** builds the three projects the root `tsconfig.json` references. `tsc -p .` would check nothing.
- **`dev` and `build` go through Vite**, not `wrangler dev`: the Cloudflare Vite plugin runs the Worker in workerd
  during development and writes the deployable build to `dist/`, which `wrangler deploy` picks up.

## pnpm-workspace.yaml

Created by `pnpm approve-builds esbuild workerd`, which writes `allowBuilds` with both set to `true`. Add a first-line
comment saying these are pnpm settings and a single package needs no `packages` list.

Wrangler and the Vitest plugin pull in esbuild, and workerd downloads its binary in an install script. pnpm refuses both
until told, and until then every `pnpm <script>` fails with `ERR_PNPM_IGNORED_BUILDS`.

## wrangler.jsonc

JSONC, not TOML: it takes comments and its `$schema` gives completion in the editor.

| Key                   | Value                                                  |
| --------------------- | ------------------------------------------------------ |
| `$schema`             | `./node_modules/wrangler/config-schema.json`           |
| `name`                | the package name                                       |
| `compatibility_date`  | the day the project is created, in UTC (`date -u +%F`) |
| `main`                | `./src/app.ts`                                         |
| `upload_source_maps`  | `true`                                                 |
| `compatibility_flags` | `["nodejs_compat"]`                                    |

- **`compatibility_date`** is set once, at creation, and then moved forward on purpose, never automatically. It must be
  today in UTC or earlier: Miniflare compares it against the UTC date and fails `vite dev` and `vitest` with
  `ERR_FUTURE_COMPATIBILITY_DATE`, so a local date that is already tomorrow in UTC terms breaks the first test run. If
  the installed workerd is older than the date, `wrangler types` generates the runtime types for the newest date it
  supports; that is expected.
- **`nodejs_compat`** makes the `node:` built-ins available, which most npm packages assume. From compatibility date
  2026-08-04 it is on by default; the flag stays in the file so the Worker does not depend on the date for it.
- **`upload_source_maps`**, with `sourcemap: true` in Vite, makes production stack traces point at the TypeScript.

## vite.config.ts and vitest.config.ts

`vite.config.ts` uses `defineConfig` from `vite`, with one plugin, `cloudflare({ viteEnvironment: { name: 'worker' } })`
from `@cloudflare/vite-plugin`, and `environments.worker.build.sourcemap: true`.

`vitest.config.ts` is a separate file. It uses `defineConfig` from `vitest/config`, with one plugin,
`cloudflareTest({ wrangler: { configPath: './wrangler.jsonc' } })` from `@cloudflare/vitest-plugin`.

- **Two files, not one.** Vitest would otherwise load `vite.config.ts`, and the dev plugin and the test plugin each want
  to own the Worker runtime.
- **The test plugin reads `wrangler.jsonc`**, so tests get the same entry point, compatibility date, flags and bindings
  as production.

## The four tsconfig files

Three TypeScript projects, because three kinds of file run in two different runtimes: the Worker in workerd, the config
files in Node, and the tests in workerd with extra test types.

**`tsconfig.json`** is a solution file: `"files": []` and `references` to `./tsconfig.node.json`,
`./tsconfig.cloudflare.json` and `./tsconfig.test.json`, nothing else. It is what `tsc -b`, the editor and ESLint start
from.

**`tsconfig.cloudflare.json`** includes `src` and `worker-configuration.d.ts`. Its compiler options come in two groups
separated by a blank line:

| Group                        | Options                                                                                                                                                                                                                                                                                                                                          |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Environment, modules, output | `tsBuildInfoFile: "./node_modules/.tmp/tsconfig.cloudflare.tsbuildinfo"`, `target: "ES2024"`, `lib: ["ES2024"]`, `types: ["./worker-configuration.d.ts"]`, `module: "ESNext"`, `moduleResolution: "bundler"`, `moduleDetection: "force"`, `noEmit`, `isolatedModules`, `verbatimModuleSyntax`, `erasableSyntaxOnly`, `skipLibCheck` (all `true`) |
| Checks                       | `strict`, `noUncheckedIndexedAccess`, `noFallthroughCasesInSwitch`, `noUncheckedSideEffectImports` (all `true`)                                                                                                                                                                                                                                  |

**`tsconfig.node.json`** has the same options with `types: ["node"]` and its own
`tsBuildInfoFile: "./node_modules/.tmp/tsconfig.node.tsbuildinfo"`, and includes `vite.config.ts` and
`vitest.config.ts`.

**`tsconfig.test.json`** extends `./tsconfig.cloudflare.json`, with a leading comment saying it is the Worker project
plus `tests/`. It sets `tsBuildInfoFile: "./node_modules/.tmp/tsconfig.test.tsbuildinfo"`,
`types: ["./worker-configuration.d.ts", "@cloudflare/vitest-plugin/types"]`, and includes `src`, `tests` and
`worker-configuration.d.ts`.

- **No `DOM` in `lib`.** `worker-configuration.d.ts` declares the Workers runtime globals (`fetch`, `Request`,
  `WebSocket`, streams) as workerd implements them; DOM declares the browser's versions of the same names, and the two
  conflict in dozens of places.
- **No `composite`.** Each project sets `noEmit` and its own `tsBuildInfoFile` instead, which is what lets `tsc -b`
  build references without emitting. `composite` without an `outDir` writes `.js`, `.d.ts` and `.tsbuildinfo` next to
  the sources, which ESLint and Prettier then trip over.
- **`tsBuildInfoFile` in `node_modules/.tmp`**: `tsc -b` writes one per project even with `noEmit`, by default next to
  the tsconfig. Each project needs its own path; inherited, two projects would share one file.
- **`types` set explicitly in every project**: TypeScript 6 no longer loads every `@types` package by default, and the
  Worker must not see Node's types anyway, nor the config files the Worker's.
- **The test types stay out of `src/`.** Only `tsconfig.test.json` loads `@cloudflare/vitest-plugin/types`, so app code
  cannot import `cloudflare:test` by accident.
- **`moduleResolution: "bundler"`**: Vite resolves the imports, so sources import without extensions.
- **`isolatedModules` and `erasableSyntaxOnly`**: Vite transpiles one file at a time without type information, so
  nothing may depend on cross-file type knowledge or on TypeScript-only runtime syntax.
- **`verbatimModuleSyntax`**: type-only imports must say `type`, so the bundler can drop them safely.
- **`strict`** is the TypeScript 6 default; it is written out so the file does not depend on that.
- **No `esModuleInterop`, `jsx`, `paths`, `rootDirs` or `resolveJsonModule`**: the first is always on in TypeScript 6,
  the rest belong to React Router templates.

## eslint.config.js

ESM, `export default defineConfig([...])` with `defineConfig` imported from `eslint/config`. The blocks, in this order:

1. `ignores`: `**/node_modules/**`, `**/dist/**`, `**/.wrangler/**`, `**/worker-configuration.d.ts`, `eslint.config.js`
2. `js.configs.recommended` from `@eslint/js`
3. `tseslint.configs.recommendedTypeChecked` from `typescript-eslint`
4. `languageOptions.parserOptions` with `projectService: true` and `tsconfigRootDir: import.meta.dirname`
5. `prettier` from `eslint-config-prettier/flat`, under the comment
   `// Formatting is Prettier's job (see format scripts); turn off rules that conflict with it.`
6. The project's rules

| Rule                                         | Setting                                                                                                                    |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `curly`                                      | `error`                                                                                                                    |
| `@typescript-eslint/consistent-type-imports` | `error`, `{ prefer: 'type-imports', fixStyle: 'inline-type-imports' }`                                                     |
| `@typescript-eslint/no-unused-vars`          | `error`, `argsIgnorePattern`, `varsIgnorePattern`, `destructuredArrayIgnorePattern` all `'^_'`, `ignoreRestSiblings: true` |

- **`eslint-config-prettier` comes before the project's rules.** It turns `curly` off; placed last, it would silently
  undo the project's `curly: 'error'`. Check with `pnpm exec eslint --print-config src/app.ts`.
- **`eslint-config-prettier`, not `eslint-plugin-prettier`**: Prettier runs on its own through `format`; ESLint only
  needs its conflicting rules switched off, not Prettier re-run inside it.
- **`projectService: true`**: every linted file belongs to a project through the solution `tsconfig.json`. A file in
  none is reported, not silently linted without types.
- **`recommendedTypeChecked`** brings the rules that matter most in a Worker, `no-floating-promises` and
  `no-misused-promises`: an un-awaited promise is cut off when the response returns.
- **No `globals` package**: the runtime globals come from TypeScript, and typescript-eslint turns `no-undef` off for
  TypeScript files.
- **`eslint.config.js` is ignored** because no project includes it; linting it would need `allowJs` in a project.

## Prettier

`.prettierrc` is JSON with `singleQuote: true`, `printWidth: 140` and `trailingComma: "none"`. Everything else is
Prettier's default.

`.prettierignore` lists `worker-configuration.d.ts` and `pnpm-lock.yaml`, both generated. Prettier already skips
`node_modules` and what `.gitignore` lists.

## .gitignore

`node_modules/`, `.wrangler/`, `dist/`, `.dev.vars`, `.env`, `*.tsbuildinfo`.

`.wrangler/` is Wrangler's and Miniflare's local state, `dist/` the Vite build, `.dev.vars` the local secrets.
`worker-configuration.d.ts` is **not** ignored: Cloudflare recommends committing it, so the types are there for a fresh
clone and a binding change shows up in review.

## The starter test

```ts
import { exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

describe("GET /", () => {
  it("greets the caller", async () => {
    // Arrange
    const request = new Request("https://example.com/");

    // Act
    const response = await exports.default.fetch(request);

    // Assert
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("Hello Cloudflare Workers!");
  });
});
```

- **`exports.default.fetch()`** goes through the Worker's real entry point inside workerd, routing included. For a
  binding, read `env` from `cloudflare:workers` too.
- **Arrange / Act / Assert**, with those three comments; one behaviour per `it`, named as a present-tense sentence.
- **`app.request()`** from Hono is fine for a quick unit test of a route, but skips the Worker entry point; prefer
  `exports` for anything that touches bindings or the request lifecycle.
