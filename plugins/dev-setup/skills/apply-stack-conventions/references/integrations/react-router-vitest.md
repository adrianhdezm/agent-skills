# React Router + Vitest

React Router's tests in Vitest's browser mode: route components rendered through `createRoutesStub` in real Chromium,
queried by role, asserted with retrying expectations. Both React Router stacks use it.

## The seam

```
vitest.config.ts: project unit ─► plugins: [react()], resolve.tsconfigPaths ─► Chromium browser mode
tests/unit/routes/*.test.tsx ─► createRoutesStub([{ path, Component, loader }]) ─► render ─► page.getByRole ─► expect.element
```

## Required values

| What                 | Value                                                                                                                                               |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| devDependencies      | `@vitejs/plugin-react`, `vitest-browser-react`, `@vitest/browser-playwright`, `playwright`                                                          |
| `vitest.config.ts`   | one inline project `unit`: `plugins: [react()]`, `resolve.tsconfigPaths: true`, `include: ['tests/unit/**/*.test.{ts,tsx}']`, Chromium browser mode |
| `tsconfig.test.json` | extends the runtime project, adds `tests` to `include`, its own `tsBuildInfoFile`                                                                   |

## Reference code

**A route test**, the pattern for every route component:

```tsx
import { createRoutesStub } from 'react-router';
import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-react';

import Home from '~/routes/home';

describe('Home', () => {
  it('shows the welcome message the loader returns', async () => {
    // Arrange
    const Stub = createRoutesStub([{ path: '/', Component: Home, loader: () => ({ message: 'Welcome to Test App' }) }]);

    // Act
    await render(<Stub initialEntries={['/']} />);

    // Assert
    await expect.element(page.getByRole('heading', { name: 'Welcome to Test App' })).toBeInTheDocument();
  });
});
```

## Conventions

- **Unit tests run in Chromium** through Vitest browser mode, in `tests/unit/` mirroring `app/`.
- **Query with `page` from `vitest/browser`** (`getByRole`, `getByLabelText` with `exact: true` to tell "Password" from
  "Confirm password", `getByText`); locators are strict, so pick one with `.first()` only on purpose.
- **Assert with `await expect.element(…)`**, which retries until the DOM settles; every test is `async`.

## Verify it is wired

- A test of `cn` imports it through `~/`, proving the alias resolves under Vitest.
- Every route component has a test that renders it through `createRoutesStub`.
