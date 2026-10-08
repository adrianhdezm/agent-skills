# Code conventions

Habits rather than tooling, but the tooling is set up to make them the path of least resistance. Every file written
during the bootstrap, the starter module and its test included, follows them.

## Layout

- `src/main.ts` is the only file that does something when imported: it reads the environment, builds what it needs and
  runs. Every other file under `src/` exports functions or classes and is what the tests import.
- **A test file per source file**, same base name, in `tests/`, importing from `../src/….ts`. `main.ts` is the
  exception: it only wires things up and runs, so the behaviour lives, and is tested, in the modules it calls.
- **Errors are classes** with a name the caller can check, under `src/errors/`.

## Tests

- **Arrange / Act / Assert**, with those three comments marking the sections.
- **One behaviour per `it`**, and the `it` name a sentence describing the behaviour in the present tense:
  `it('answers every call of the turn, in the order they were made')`.
- **Fakes are small hand-written objects**; `vi.fn()` where a call count matters.

A test in full, here the starter `tests/greeting.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { greet } from '../src/greeting.ts';

describe('greet', () => {
  it('addresses the given name', () => {
    // Arrange
    const name = 'world';

    // Act
    const result = greet(name);

    // Assert
    expect(result).toBe('hello, world');
  });
});
```

## Comments

- **Doc comments say what a thing is or does**, one or two sentences, in the third person. They go on every export and
  on any internal function whose name does not say it all.
- **Line comments explain a decision**, never restate the code.

## Values and control flow

- **`undefined`, not `null`**, for absence, except where an external format (JSON, a provider API) says otherwise.
- **`Promise.all` for independent async work**; `for … of` with `await` only where order matters.
- **`as const` objects and unions instead of enums**, since Node cannot strip `enum`.
- **Type guards instead of assertions**: `as` is forbidden in `src/`.
