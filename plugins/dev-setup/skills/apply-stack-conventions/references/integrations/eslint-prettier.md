# ESLint + Prettier

Prettier formats, ESLint judges: the two never overlap, and each has its own check. Every stack uses it.

## The seam

```
eslint.config.js: … framework presets ─► eslint-config-prettier/flat ─► shared rules ─► overrides
pnpm lint          ─► code problems        pnpm format:check ─► formatting
```

- **`eslint-config-prettier` switches off every ESLint rule that would fight Prettier**, and formatting is checked by
  `format:check`, not `lint`.
- **`eslint-plugin-prettier` is never used**: it re-runs Prettier inside ESLint, is slower, and reports formatting as
  code problems.

## Required values

| What      | Value                                                                                 |
| --------- | ------------------------------------------------------------------------------------- |
| package   | `eslint-config-prettier`                                                              |
| placement | `eslint-config-prettier/flat` after the framework presets and before the shared rules |

## Pitfalls

- **`eslint-config-prettier` placed after the shared rules turns `curly` off**, silently: it sets it to `0`. Put it
  before them, and check with `pnpm exec eslint --print-config <a source file>`.

## Conventions

- **`pnpm lint` reports code problems; `pnpm format:check` reports formatting.** Never fix formatting by hand or to
  please the linter: run `pnpm format`.

## Verify it is wired

- `pnpm exec eslint --print-config <a source file>` shows `curly` as `error`.
- No `eslint-plugin-prettier` in the manifest.
