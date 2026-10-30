# pnpm

The package manager: the manifest, pnpm's settings, workspaces, and how versions are held back.

## Use it like this

- **pnpm for everything**, never npm, npx or yarn: `pnpm add`, `pnpm exec` for a local binary, `pnpm dlx` for a one-off
  CLI. pnpm 11 or newer (`allowBuilds` is a pnpm 11 setting).
- **The tools create the manifest.** `pnpm init --bare --no-init-package-manager`, then `pnpm pkg set` for the fields
  and scripts, and `pnpm add` for the dependencies, so versions are current at scaffold time and nothing is
  hand-typed. A monorepo's package manifests are the exception: a framework's CLI writes one, and a package's
  `package.json` with only scripts is quicker to write than to set.
- **ESM only**: `"type": "module"` in every package.
- **`private: true`** on every app and package nobody installs, so it is never published.
- **`packageManager: "pnpm@<the local version>"`** at the root: Corepack reads it inside container builds, and it tells
  a teammate which pnpm wrote the lockfile.
- **Build scripts are approved up front.** `pnpm-workspace.yaml` lists in `allowBuilds` every package whose install
  script must run (`true`) or may be skipped (`false`), written before the first `pnpm add`. The file holds pnpm's
  settings even in a single package: with no `packages` list it is not a workspace, and its first line says so.
- **A monorepo is a pnpm workspace** with a `packages` list and a **catalog** for what the packages share. A package
  goes in `catalog:` only when two or more manifests use it with the same range; everything else is a direct
  dependency of the one manifest that uses it. Root scripts roll up with `pnpm -r <script>` or target one package
  with `pnpm --filter <name> <script>`.
- **Versions are resolved by `pnpm add`, not copied from a table.** A package is held back only when a peer range
  forces it, with an exact version (`-E`) or a major (`@24`), and the doc for that tool says why.
- **The same script names in every project**, so people and the `define-constraints` skill find them:
  `dev`, `build`, `typecheck`, `lint`, `test`, `format`, `format:check`, plus `start` where something runs in
  production.

## Required values

| Field            | Value                                                |
| ---------------- | ---------------------------------------------------- |
| `name`           | the directory's name, unless the user names it       |
| `version`        | `0.1.0` (`0.0.0` for the packages inside a monorepo) |
| `description`    | one sentence on what it does                         |
| `private`        | `true`, a boolean                                    |
| `type`           | `module`                                             |
| `engines.node`   | `>=24`                                               |
| `packageManager` | `pnpm@$(pnpm --version)`, at the root only           |

## Pitfalls

- **`private` set on the same line as other fields becomes a string.** Only `pnpm pkg set private=true --json` stores
  a boolean, and `--json` would parse every other value on the line as JSON, so it goes on its own line.
- **`scripts.format:check=…` is rejected** as an invalid property path. A script name with a `:` takes the quoted
  bracket form: `"scripts['format:check']=<command>"`.
- **pnpm 12 fails `pnpm add` half done** (`ERR_PNPM_IGNORED_BUILDS`) when a new dependency has an unapproved install
  script; pnpm 11 fails every later `pnpm <script>` instead. Write `allowBuilds` first. A package that shows up in the
  error and is not in the stack's list is new: allow it if it must be built, set it to `false` otherwise, and say which.
- **`pnpm up` and `pnpm down` are not your scripts.** `up` is pnpm's own update command and wins over a script of the
  same name. Name such scripts with a prefix, as `compose:up` and `compose:down`.
- **`pnpm add -E` pins only a full version.** `pnpm add -E typescript@6` writes a caret; resolve the version first
  (`pnpm view 'typescript@~6.0.0' version`) and pass it.
- **`pnpm add --save-catalog` leaves an existing direct range alone.** Remove a package from a manifest before adding
  it back through the catalog.

## Conventions

- **pnpm only**: `pnpm add`, `pnpm exec`, `pnpm dlx`; never npm, npx or yarn. The version is the root
  `packageManager` field.
- **Approve install scripts in `pnpm-workspace.yaml`'s `allowBuilds`** when a new dependency asks: `true` if it must be
  built, `false` if it may be skipped.
- **In a workspace, the catalog holds only what two or more packages share at the same range**; everything else is a
  direct dependency of the package that uses it.
- **Held-back versions stay held until their reason goes**, each where its own doc says why.
- **Script names are the same everywhere**: `dev`, `build`, `typecheck`, `lint`, `test`, `format`, `format:check`.
  Never name a script after a pnpm command (`up`, `update`, `add`, `install`).
