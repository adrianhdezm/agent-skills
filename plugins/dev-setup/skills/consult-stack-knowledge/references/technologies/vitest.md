---
type: Technology
title: Vitest
description: one config of named projects, picking an environment, how tests are written
resource: https://vitest.dev
role: tooling
realises: [testing]
detect:
  files: ['vitest.config.*']
aliases: [Vitest, vitest]
stale_after: 2027-05-01T00:00:00Z
sources:
  - id: vitest-releases
    resource: https://github.com/vitest-dev/vitest/releases
    title: Vitest releases
---
# Vitest

The test runner: one config of named projects, an environment per kind of test, and how a test is written in it.

**Realises:** [Testing](../architecture/testing.md)

## Use it like this

- **Vitest's own config file**, never the app's build config: the app's plugins own the dev server and the runtime, and
  Vitest must not load them. The config goes into `tsconfig.node.json`.
- **One config, named projects.** Kinds of test that need different environments or services are inline `projects`
  in the one config (`unit`, `browser`, `db`, `api`, `integration`), selected by folder glob and run with
  `--project`. A second config file duplicates the shared setup and drifts. Shared options sit at the root and each
  project sets `extends: true` to inherit them.
- **`test` runs the fast tier only** (`vitest run`, or `--project unit`), and each slower tier gets the script Testing
  names, selecting its project.
- **Pick the environment by where the code runs**: the default for server code, `jsdom` for DOM code that needs no
  real browser, and browser mode for components that must render for real:
  `browser: { enabled: true, headless: true, provider: playwright(), instances: [{ browser: 'chromium' }] }` from
  `@vitest/browser-playwright`, queried with `page` from `vitest/browser`. A runtime or framework with its own
  environment has an integration that says how.
- **Browser tests download Chromium once**: `pnpm exec playwright install chromium`.
- **Vitest 5**[^vitest-releases], one major across a monorepo through the catalog; every `@vitest/*` package and every
  plugin follows the same major.

## Required values

| Package                      | Held at | Because                                                                      |
| ---------------------------- | ------- | ---------------------------------------------------------------------------- |
| `vitest`, `@vitest/browser*` | major 5 | the configs are written for it; check every Vitest plugin's peer range first |

## Pitfalls

- **Vitest fails when it finds no test file**: a module and its test are written together.
- **`provider: 'playwright'` (a string) is gone**: pass the `playwright()` function.
- **`@vitest/browser/context` is the old import**: `page` comes from `vitest/browser`.
- **Loading the app's build config** (its framework or runtime plugins) makes Vitest reject options such as
  `resolve.external`, or start a second runtime.
- **Browser mode caches inside a `node_modules/` beside the config**: ignore `node_modules/` at any depth, not
  `/node_modules/`.
- **Browser mode opens its API server on port 63315**, beside the dev server's: count it among the ports to check.

## Conventions

### Writing a test

- **One top-level `describe` per file, named for the module under test** (`describe('entity.controller')`,
  `describe('cn')`); nested `describe`s group functions or behaviours, and hooks sit inside the top-level one.
- **`it` takes the behaviour sentence**: `it('forwards a 400 for an unknown param without reaching the DAO')`.
- **`// Arrange`, `// Act`, `// Assert` comments** once a phase has more than one line.
- **Import from `vitest`** (`describe`, `it`, `expect`, `vi`); no globals.
- **`vi.fn()` only where a call or its arguments matter**; cases that differ only in data are one `it.each`.

[^vitest-releases]: Vitest releases
