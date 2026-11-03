---
kind: concept
---
# Testing

How a project proves its code works, whatever the test runner: tiers named by what is real in them, each behaviour
tested once at the cheapest tier that can see it, tests named for the behaviour they hold, and data each test owns. The
test runner's doc says how a test is written in it; each technology's doc says how its own code is tested.

## Principles

- **Tiers are named by what is real in them**, so a passing test says what it proves. A **unit** test runs one function
  or component with its collaborators stubbed; a **browser** test renders a component or page in a real browser with the
  real styles; an **integration** test runs code against the real service it talks to (the database, the object store,
  the runtime); an **API** test drives the assembled server over HTTP; an **end-to-end** test drives the whole stack
  through its UI.
- **Test a behaviour once, at the cheapest tier that can see it**, because the same behaviour at two tiers doubles the
  upkeep and the slow copy catches nothing the fast one misses. Go up a tier only for what the lower one cannot see
  (body parsing, the route table, a query whose result depends on the engine, a page in a real browser), and cover only
  that addition there.
- **Name the bug first.** A test earns its place by catching a failure no other test, tier or the compiler catches; if
  one already does, do not add it.
- **No tests for wiring without logic**: route tables, root components, layouts, a state handler with no logic, a
  one-line cast, a handler that only forwards. The tests that run through them prove them. **Nor for what the compiler
  enforces**: a union, a required input, a field naming a real column.
- **A caller tests its own branches, not its callee's rules**: one schema rejection in a handler test, not every rule of
  the schema, which the schema's own test covers.
- **A test names a behaviour**, so a failure reads as a broken promise: one top-level group per file, named for the
  module under test; each case a present-tense sentence ("forwards a 400 for an unknown param without reaching the data
  layer", not "test list error"); one behaviour per case, and cases that differ only in data are one table-driven case.
- **Arrange, act, assert**, in that order, each phase marked once it has more than one line, so a reader finds the one
  action under test.
- **Fakes are small and hand-written**, shaped like the calls the code makes, because a deep automatic mock passes
  whatever the code does. A spy only where a call or its arguments matter. Shared fakes, stub contexts, seed helpers and
  the test server live in one test-utilities folder, not in test files.
- **Each test owns its data**, so tests pass in any order, alone or in parallel: each suite gets its own database, rows
  are cleared before each test and seeded through a `<resource>-seed` helper that inserts directly with fixed
  timestamps (a fixed day, never "now"). An end-to-end run has its own database and ports, so the development stack
  keeps running beside it; it seeds through the real API and names every row it creates uniquely.
- **The integration tier runs on the engine production uses**, because the bugs it exists for (constraints, the
  dialect's SQL, transactions, ordering) are not in a substitute. A service the project only calls through a client
  may be faked behind the interface its code uses.
- **A UI is queried the way a user finds it**: by role and accessible name, never by test id or class, so every UI test
  also checks the labels [UI components](ui-components.md) requires.
- **The default test command runs the fast tier only**: no containers, no browser, so it runs on every change and in
  every check. Each slower tier has its own command, run before merging a change it covers.
- **A module and its test are written together**, in the one place the stack keeps tests (a tests folder that mirrors
  the source, or a spec beside the file), so a missing test shows.

## Required values

| What           | Value                                                                                                             |
| -------------- | ----------------------------------------------------------------------------------------------------------------- |
| commands       | `test` (the fast tier only), `test:browser`, `test:integration`, `test:e2e`: each slower one only where it exists |
| test utilities | one folder: fakes, stub contexts, `<resource>-seed` helpers, the test server, the database a suite gets           |
| seed helper    | `seed<Resources>(db, rows)` inserting directly so tests control timestamps; a `day(n)` helper for a fixed day     |
| end to end     | its own database (`<database>_e2e`) cleared by the run's setup, its own ports, rows named uniquely                |

## Conventions

- **Test a behaviour once, at the cheapest tier that can see it**; a higher tier covers only what the lower one cannot
  see.
- **No test for wiring without logic, or for what the compiler enforces**; a caller tests its own branches, not its
  callee's rules.
- **One top-level group per file, named for the module; each case a present-tense behaviour sentence; one behaviour per
  case**, cases that differ only in data table-driven.
- **Arrange, act, assert**, marked once a phase has more than one line.
- **Fakes are small and hand-written; shared ones live in the test utilities.**
- **Each test owns its data**: cleared before each test, seeded with fixed timestamps; end to end on its own database
  and ports, through the real API, with unique names.
- **Integration tests run on the production engine.**
- **UI tests query by role and accessible name.**
- **`test` runs the fast tier only**; run the slower tier that covers a change before merging it.

## Verify it is wired

- `test` passes with no container running and no browser installed.
- Each slower tier has its own command, and passes on a fresh checkout after its documented setup.
- Running a suite twice, or two suites at once, gives the same result.
- No UI test selects an element by test id or class.
