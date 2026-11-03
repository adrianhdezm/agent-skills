---
kind: concept
always: true
---
# Code style

How code is written, whatever the language tooling: comments that explain decisions, named exports, small units,
suppressions that say why, and absence handled rather than asserted away. The tools that enforce some of it have their
own rules; this is the habit behind them.

## Principles

- **Comments explain why, and only where the code cannot**, because a comment that restates code goes stale the first
  time the code changes. A doc comment on an export says what the thing is or does; a line comment explains a decision;
  none restates the code. Generated files carry none.
- **Exports are named**, so every import says what it takes and a rename is found everywhere. A default export only where
  a tool requires one (a file a tool loads by convention; each technology doc names its own).
- **Units stay small**, so each can be read, tested and replaced on its own. A function does one thing and a file holds
  one concern; when a size limit fires, the unit is split, never the limit raised.
- **Every suppression carries its reason**, so the next reader can tell whether the exception still applies: a disabled
  rule, an ignored check or an exception to a convention says why it does not fit there, next to where it applies, and
  as narrowly as possible.
- **Absence is handled, not asserted away**, because an assertion turns a missing value into a crash far from its cause.
  Code checks for the missing value and decides what happens, rather than telling the compiler it cannot be missing.
- **Narrow, don't cast**, because a cast silences the compiler without changing the value. A value's type is proven by a
  check, or the code is restructured so it needs no proof; tests may assert.
- **Closed sets are literal values**, not a separate runtime construct, so they cost nothing and read as data.
- **An intentionally unused name is marked as such**, so the reader and the tools know it was left on purpose.
- **Independent async work runs concurrently**, because awaiting it one piece at a time adds up every latency for no
  gain; a loop awaits in sequence only where order matters.

## Conventions

- **Comments explain why, and only where the code cannot**; doc comments on exports say what the thing is or does; never
  restate the code.
- **Named exports only**, except where a tool requires a default export (a file a tool loads by convention, as its
  technology doc says).
- **Split a function or file when a size limit fires**; never raise the limit.
- **Every suppression says why**, next to where it applies, as narrowly as possible.
- **Handle absence; never assert it away.**
- **Narrow with checks instead of casting**; tests may assert.
- **Closed sets are literal values**, never a separate runtime construct.
- **An intentionally unused name starts with `_`.**
- **`Promise.all` for independent async work**; `for … of` with `await` only where order matters.

## Verify it is wired

- Every export without a doc comment is self-evident, and no comment restates the line below it.
- Default exports appear only in files a tool loads by convention.
- Every disabled rule or ignored check has a reason beside it.
