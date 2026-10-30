# Node

Node 24 as a runtime: loading the environment, configuration that fails loudly, and one file with side effects.

## Use it like this

- **The environment comes from one `.env`, loaded by Node**: `node --env-file=.env …` in `dev` and in any script that
  needs it. The flag is strict, not `--env-file-if-exists`, so a missing file fails at start; an empty `.env` is
  created where nothing needs a value yet. `start` in production gets its environment from the platform, not from a
  file. `.env` is git-ignored; `.env.example` is committed.
- **Configuration is read once and fails loudly**: code that needs a variable throws when it is unset, with no fallback
  value, so a misconfiguration is never masked and no credential sits in source.
- **One file has side effects**: the entry point reads the environment, builds what it needs and runs; every other
  module exports functions or classes, and is what the tests import.

## Required values

| What           | Value            |
| -------------- | ---------------- |
| `engines.node` | `>=24`           |
| image tag      | `node:24-alpine` |

## Pitfalls

- **`--env-file` never overrides a variable already set**, which is what lets a test runner or a script pass its own
  `PORT` or `DATABASE_URL` to a server that loads `.env`.

## Conventions

- **Node 24 or newer.**
- **The environment comes from the root `.env`** (git-ignored; `.env.example` is committed and lists every variable).
  A missing `.env` or a missing required variable fails at start; there are no fallback values for configuration.
- **The entry point is the only file with side effects**; everything else exports, and is tested through its exports.
