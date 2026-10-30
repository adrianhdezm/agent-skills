# ESLint

How code is linted: flat config, one shared rule set, framework presets on top, and overrides that say why.

## Use it like this

- **`defineConfig` and `globalIgnores` from `eslint/config`**, the flat config, one per package: `eslint.config.js`, or
  `.mjs` in a package whose manifest is not `"type": "module"`.
- **The blocks, in this order:** ignores; `js.configs.recommended`; the language's preset; `languageOptions` with the
  parser options, and a comment naming which project each folder belongs to; the framework presets; the formatter's
  off-switch config; the shared rules; per-folder overrides, each with a comment saying why; the test files' block.
- **Size guardrails are warnings**, so one reads as a nudge in the editor. A stack that passes `--max-warnings 0` turns
  them into a failing check; the others let them warn.
- **Generated and vendored code goes in `globalIgnores`**, not under a rule override.

## Required values

The shared rules ESLint itself provides, under `// Correctness`, `// Complexity and size guardrails` and
`// Clarity and simplicity`:

| Group       | Rule                                                                                                                       | Setting                                                          |
| ----------- | -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Correctness | `curly`                                                                                                                    | `error`                                                          |
| Size        | `complexity` 10, `max-depth` 4, `max-lines-per-function` 75, `max-statements` 20, `max-params` 4, `max-nested-callbacks` 3 | `warn`                                                           |
|             | `max-lines`                                                                                                                | `warn`, `{ max: 400, skipBlankLines: true, skipComments: true }` |
| Clarity     | `no-else-return`, `no-nested-ternary`, `no-unneeded-ternary`                                                               | `warn`                                                           |

The test files' block turns off `max-lines-per-function`, `max-nested-callbacks` and `max-statements`: a `describe`
holds every case for one module.

## Pitfalls

- **A framework plugin's peer range can hold ESLint back a major**: check each plugin's `peerDependencies` before
  lifting it, and install the major they all accept.

## Conventions

- **`pnpm lint` reports code problems**; formatting is not its job.
- **Always braces** (`curly`), even around a one-line body.
- **Size guardrails warn** (complexity 10, depth 4, 75 lines per function, 20 statements, 4 parameters, 400 lines per
  file, 3 nested callbacks): split rather than raise the limit.
- **An override is per folder or file pattern, with a comment saying why**, never a blanket `eslint-disable` at the top
  of a file. A single-line disable names the rule and carries its reason.
- **Generated and vendored code is ignored**, never patched with overrides.
