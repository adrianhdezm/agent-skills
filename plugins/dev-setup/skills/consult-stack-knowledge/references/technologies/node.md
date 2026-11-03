---
type: Technology
title: Node
description: running TypeScript as it is, `--env-file`, the dev loop
resource: https://nodejs.org
role: runtime
detect:
  manifest: [engines.node]
  scripts: ['node .*\.ts']
aliases: [Node]
stale_after: 2027-05-01T00:00:00Z
sources:
  - id: node-schedule
    resource: https://github.com/nodejs/release#release-schedule
    title: Node.js release schedule
---
# Node

Node 24 as a runtime: loading the environment, configuration that fails loudly, and one file with side effects.

## Use it like this

- **The environment comes from one `.env`, loaded by Node**: `node --env-file=.env …` in `dev` and in any script that
  needs it. The flag is strict, not `--env-file-if-exists`, so a missing file fails at start; an empty `.env` is
  created where nothing needs a value yet. `start` in production gets its environment from the platform, not from a
  file. `.env` is git-ignored; `.env.example` is committed.
- **`--env-file` never overrides a variable already set**, so a test runner or a script can pass its own `PORT` to a
  server that loads `.env`.
- **Configuration is read once and fails loudly**: code that needs a variable throws when it is unset, with no fallback
  value, so a misconfiguration is never masked and no credential sits in source. A log level is the one exception: it
  changes only what is printed, so it may default.
- **One file has side effects**: the entry point reads the environment, builds what it needs and runs; every other
  module exports functions or classes, and is what the tests import.

## Required values

| What           | Value            |
| -------------- | ---------------- |
| `engines.node` | `>=24`           |
| image tag      | `node:24-alpine` |

## Conventions

- **Node 24 or newer.**[^node-schedule]
- **The environment comes from the root `.env`** (git-ignored; `.env.example` is committed and lists every variable).
  A missing `.env` or a missing required variable fails at start; there are no fallback values for configuration.
- **The entry point is the only file with side effects**; everything else exports, and is tested through its exports.

[^node-schedule]: Node.js release schedule
