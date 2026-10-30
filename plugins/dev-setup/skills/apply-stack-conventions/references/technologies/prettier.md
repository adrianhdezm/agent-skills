# Prettier

The formatter. Prettier owns formatting; nothing else does.

## Use it like this

- **One `.prettierrc` per package**, JSON, with the shared values below; a framework adds plugins or overrides.
  Everything else is Prettier's default (two-space indent, semicolons, double quotes in JSX, LF line endings). There is
  no `.editorconfig`: it and Prettier can disagree.
- **`format` writes and `format:check` checks**, both over the whole package (`prettier --write .`,
  `prettier --check .`), and `format:check` is one of the required checks.
- **`.prettierignore` lists the lockfile and the generated files the package commits**; Prettier already skips
  `node_modules` and everything the `.gitignore` in the folder it runs from lists; a package inside a workspace does not
  see the root `.gitignore`, so its own `.prettierignore` lists its generated folders. Vendored code a CLI writes and
  overwrites is ignored too, so an update diffs cleanly.
- **Format before checking**: `pnpm format`, then the checks.

## Required values

```json
{
  "$schema": "https://json.schemastore.org/prettierrc",
  "singleQuote": true,
  "printWidth": 140,
  "trailingComma": "none"
}
```

## Pitfalls

- **A plugin's sort order fights a hand-ordered list**: where a plugin sorts imports or classes, let `pnpm format` do
  it.
- **Formatting a CLI's vendored files** turns each update into a whole-file diff; ignore them instead.

## Conventions

- **Prettier formats everything**: run `pnpm format` before committing; `pnpm format:check` fails on anything it would
  change. Single quotes, 140 columns, no trailing commas.
- **Never format by hand** or reformat a file you are not changing.
- **Generated and vendored files are ignored**, never reformatted.
