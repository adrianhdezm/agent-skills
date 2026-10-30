# Vitest

The test runner: one config of named projects, an environment per kind of test, and the rules every test follows.

## Use it like this

- **Vitest's own config file**, never the app's build config: the app's plugins own the dev server and the runtime, and
  Vitest must not load them. The config goes into `tsconfig.node.json`.
- **One config, named projects.** Kinds of test that need different environments or services are inline `projects`
  in the one config (`unit`, `browser`, `db`, `api`, `integration`), selected by folder glob and run with
  `--project`. A second config file duplicates the shared setup and drifts. Shared options sit at the root and each
  project sets `extends: true` to inherit them.
- **`test` runs the fast tier only** (`vitest run`, or `--project unit`): no containers, no browser download where it
  can be helped. Slower tiers get their own scripts (`test:integration`, `test:browser`, `test:e2e`).
- **Pick the environment by where the code runs**: the default for server code, `jsdom` for DOM code that needs no
  real browser, and browser mode for components that must render for real:
  `browser: { enabled: true, headless: true, provider: playwright(), instances: [{ browser: 'chromium' }] }` from
  `@vitest/browser-playwright`, queried with `page` from `vitest/browser`. A runtime or framework with its own
  environment has an integration that says how.
- **Browser tests download Chromium once**: `pnpm exec playwright install chromium`.
- **Vitest 5**, one major across a monorepo through the catalog; every `@vitest/*` package and every plugin follows the
  same major.

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
- **Browser mode caches under `node_modules/.vite` beside the config**: ignore `node_modules/` at any depth, not
  `/node_modules/`.

## Conventions

### Writing a test

- **One top-level `describe` per file, named for the module under test** (`describe('entity.controller')`,
  `describe('cn')`); nested `describe`s group functions or behaviours, and hooks sit inside the top-level one.
- **Name a case for the behaviour, in a present-tense sentence**: `it('forwards a 400 for an unknown param without
reaching the DAO')`, not `it('test list error')`.
- **Arrange / Act / Assert**, with `// Arrange`, `// Act`, `// Assert` comments once a phase has more than one line.
- **Import from `vitest`** (`describe`, `it`, `expect`, `vi`); no globals.
- **Fakes are small hand-written objects; `vi.fn()` where a call or its arguments matter.** Shared mocks and fixtures
  live in the test utilities folder, not in test files.
- **Find UI by role and accessible name**, never by CSS class or test id. Renaming a heading, label or button is a change
  to its tests.

### What not to test

- **Name the bug first.** A test earns its place by catching a failure no other test catches; if a lower tier, another
  test or the compiler already catches it, do not add it.
- **Test a behaviour once, at the cheapest tier that can see it.** Go up a tier only for what the lower one cannot see,
  and cover only that addition there.
- **No tests for wiring without logic**: route tables, root components, layouts, a reducer with no handlers, a one-line
  cast, an effect or handler that only forwards. The tests that run through them prove them.
- **No tests for what the compiler enforces**: a union, a required input, a field naming a real column.
- **A caller tests its own branches, not its callee's rules.** One schema rejection in a controller test, not every
  rule of the schema.
- **One behaviour per case.** Cases that differ only in data are one `it.each`.
