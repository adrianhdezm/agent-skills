---
kind: example
needs: [[node]]
unless: [hono, express, react-router, angular]
---
# Node module

The first module of a Node package: one exported function, its test, and the entry point that runs it. The Node package
stack starts with it when the user has named no module of their own; when they have, their module takes its place and
the same shape holds.

## Demonstrates

| Part                               | Applies                                                                                                     |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `src/<module>.ts`, exporting only  | Node (one file has side effects), [Code style](../architecture/code-style.md) (named exports, doc comments) |
| `src/main.ts`, the one side effect | Node (the one file with side effects), Node + TypeScript (`.ts` imports)                                    |
| `tests/<module>.test.ts`           | Vitest (one `describe` named for the module, a behaviour sentence per case)                                 |

## Data

| What   | Value                                                                                                         |
| ------ | ------------------------------------------------------------------------------------------------------------- |
| module | `src/greeting.ts`, exporting `greet(name)`                                                                    |
| result | `hello, ${name}`                                                                                              |
| entry  | prints `greet(process.argv[2] ?? 'world')`: a command-line argument, so a default is input, not configuration |

## Behaviour

- `greet` addresses the name it is given, and carries a doc comment saying what it returns.
- `main.ts` prints one line.

## Tests

| Tier | File                     | Covers                           |
| ---- | ------------------------ | -------------------------------- |
| unit | `tests/greeting.test.ts` | `greet` addresses the given name |

## Done when

`pnpm start` prints `hello, world`, and the stack's checks pass with zero warnings.
