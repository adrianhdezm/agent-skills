# TypeScript

How TypeScript is configured and pinned: one project per runtime, checked without emitting.

## Use it like this

- **One TypeScript project per runtime**, tied together by a solution file. The program (`tsconfig.app.json`, or a
  project named for its runtime) is one project; the files only the build machine runs and nobody imports (config
  files, and tests that run there) are `tsconfig.node.json`; tests that run in another runtime with its own types get
  `tsconfig.test.json`, extending the program's project. Each runtime sees only its own globals.
- **`tsconfig.json` is a solution file**: `"files": []` and `references`, so `tsc -b` and the editor start from one
  place. It holds no compiler options, except `paths` that a CLI reads from it, and says why.
- **Check, never emit, unless something builds.** Each project sets `noEmit` and its own `tsBuildInfoFile` under
  `node_modules/.tmp/`. A package that compiles to `dist/` emits from its app project only.
- **`typecheck` is `tsc -b`**, preceded by whatever generates types the code imports.
- **Module resolution follows who turns the code into JavaScript**:

| The code is                                 | `module` / `moduleResolution`                 | Imports      |
| ------------------------------------------- | --------------------------------------------- | ------------ |
| run as it is by a runtime that strips types | `NodeNext`, with `allowImportingTsExtensions` | `./thing.ts` |
| built by a bundler                          | `ESNext` / `bundler`                          | `./thing`    |
| compiled by `tsc` to `dist/`                | `NodeNext`                                    | `./thing.js` |

- **One exact TypeScript on the 6.0 line**, pinned with `-E`, in the catalog in a monorepo. TypeScript 7 is out and
  tools that read TypeScript cap their peer range below it, so a caret or `@latest` breaks them on the next install.
  Move it only when every peer range allows.
- **Every config file belongs to a project**, `tsconfig.node.json`'s `include`, so it is checked with types.

## Required values

The options every project sets, under the line comments `// Environment, modules, output` and `// Checks`:

| Option                       | Value                                               | Why                                                                                   |
| ---------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `noEmit` + `tsBuildInfoFile` | `true`, `./node_modules/.tmp/<project>.tsbuildinfo` | `tsc -b` follows references without writing next to the sources; one file per project |
| `types`                      | written out per project                             | TypeScript 6 loads no `@types` by default; each runtime sees only its own             |
| `moduleDetection`            | `"force"`                                           | every file is a module                                                                |
| `verbatimModuleSyntax`       | `true`                                              | type-only imports say `type`, so stripping them is safe                               |
| `erasableSyntaxOnly`         | `true`                                              | no `enum`, `namespace`, parameter properties, `import x = require()`                  |
| `isolatedModules`            | `true`                                              | each file transpiles alone, as bundlers and type-stripping runtimes do                |
| `skipLibCheck`               | `true`                                              | the checks are for this project's code                                                |
| `strict`                     | `true`                                              | the TypeScript 6 default, written out                                                 |
| `noUncheckedIndexedAccess`   | `true`                                              | `array[0]` is `T \| undefined`                                                        |
| `noFallthroughCasesInSwitch` | `true`                                              |                                                                                       |
| `lib`, `target`              | `ES2024`                                            | what the runtime implements; add `DOM` only where code runs in a browser              |

Pin TypeScript after checking the peer ranges of the tools that read it:

```sh
pnpm add -D -E "typescript@$(pnpm view 'typescript@~6.0.0' version)"
```

## Pitfalls

- **`composite` without an `outDir` writes `.js`, `.d.ts` and `.tsbuildinfo` next to the sources**, which every tool
  reading the tree then trips over. Use `noEmit` plus `tsBuildInfoFile` instead; delete any emitted files a run left
  behind.
- **Two projects sharing one `tsBuildInfoFile`** (an extended config inheriting it) overwrite each other: every
  project sets its own.
- **`tsc -p .` on a solution file checks nothing**; `tsc -b` follows the references.
- **A build or test tool that compiles through a project's tsconfig emits nothing when the tsconfig sets `noEmit`.**
  Where a framework's tooling does, its doc says so: that project leaves `noEmit` out, and its `typecheck` passes
  `--noEmit` on the command line instead.
- **`types` left out means runtime globals and built-in modules do not resolve** under TypeScript 6.
- **`esModuleInterop` and `baseUrl`** are not written: the first is always on in TypeScript 6, the second is
  deprecated, and `paths` work without it.

## Conventions

- **`pnpm typecheck` is the type check**: `tsc -b` over every project, after generating the types the code imports.
- **TypeScript is pinned exactly** on 6.0.x; move it only when every tool that reads it accepts the new version.
- **Each runtime is its own project.** A new config file goes into `tsconfig.node.json`'s `include`; a new folder of
  sources goes into the project of the runtime that runs it.
- **`array[0]` is `T | undefined`**; handle it, and never silence it with a non-null assertion (`!`).
- **Type guards over type assertions** (`as`) in sources; tests may assert.
- **`import type` for types**, so nothing type-only reaches the output.
- **No `enum`, `namespace`, parameter properties or `import x = require()`**: use `as const` objects and unions.
- **Never write a type that mirrors a schema or a generated file**: infer it.
