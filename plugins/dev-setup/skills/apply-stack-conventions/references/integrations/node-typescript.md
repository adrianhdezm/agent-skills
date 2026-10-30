# Node + TypeScript

How TypeScript runs on Node: as it is, with the types stripped by Node 24, or compiled by `tsc` to `dist/`. The Node
package and the React Router server run as they are; the Express API is compiled.

## The seam

```
run as it is:  node src/main.ts ─► Node strips the types ─► imports ./thing.ts   (NodeNext + allowImportingTsExtensions)
compiled:      tsc -p tsconfig.app.json ─► dist/ ─► node dist/server.js ─► imports ./thing.js   (NodeNext)
```

- **Node 24 runs TypeScript as it is** by stripping the types. A program that needs no bundle is run with
  `node <file>.ts`: nothing is built.
- **Code Node strips follows its rules**: imports carry the `.ts` extension, type-only imports are `import type` in
  their own statement, and nothing uses syntax Node cannot erase (`enum`, `namespace`, parameter properties,
  `import x = require()`). `module: "NodeNext"` with `allowImportingTsExtensions` checks exactly that.
- **Code `tsc` compiles for Node** imports `./thing.js`, as Node's ESM resolution requires of the output, and builds
  with `tsc -p tsconfig.app.json` to `dist/`, `composite` with an `outDir`.
- **The dev loop is `node --import=tsx --watch …`**: Node restarts, tsx loads TypeScript. Not `tsx watch`. Where Node
  strips types itself, `tsx` is only there for `--watch` to follow imports.
- **`@types/node` follows the Node major**, and the project that runs on Node lists `types: ["node"]`.

## Required values

| What          | Value                                                                         |
| ------------- | ----------------------------------------------------------------------------- |
| run as it is  | `module: "NodeNext"`, `allowImportingTsExtensions`, `types: ["node"]`         |
| compiled      | `module`/`moduleResolution` `"NodeNext"`, `outDir: "dist"`, `types: ["node"]` |
| `@types/node` | major 24                                                                      |
| dev loop      | `tsx`, run as `node --import=tsx --watch`                                     |

## Pitfalls

- **`import { type X } from './x.ts'` strips to `import {} from './x.ts'`**, which still loads the module for its side
  effects. Keep type imports in their own `import type` statement in code Node runs; the lint's `consistent-type-imports`
  then takes `{ prefer: 'type-imports' }` alone.
- **A dynamic import of a path that does not exist yet** (a build output before the first build) fails `tsc` when
  written as a literal; put the path in a variable.

## Conventions

- **Code Node runs as TypeScript imports with the `.ts` extension**, keeps type imports in their own `import type`
  statement, and avoids syntax Node cannot strip.
- **Code compiled by `tsc` for Node imports with the `.js` extension.**

## Verify it is wired

- Every relative import in code Node runs ends in `.ts`; in compiled code, in `.js`.
- `pnpm typecheck` passes with `erasableSyntaxOnly`.
