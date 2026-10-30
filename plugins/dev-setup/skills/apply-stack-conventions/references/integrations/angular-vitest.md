# Angular + Vitest

Angular's tests on Vitest through Analog's builder: `ng test` runs a `unit` project in jsdom and a `browser` project in
Chromium, compiled the same way Storybook compiles the components. Both Angular stacks use it.

## The seam

```
ng test ─► @analogjs/vitest-angular:test ─► vitest.config.mts (plugins: [angular()])
             ├─ unit:    jsdom,    src/**/*.spec.ts,          setup src/test-setup.ts
             └─ browser: Chromium, src/**/*.browser.spec.ts,  setup src/testing/browser-setup.ts (+ styles.css)
Analog compiles only tsconfig.spec.json's program
```

- **Analog's builder, not the CLI's `@angular/build:unit-test`**, so the tests and Storybook share one compile path
  (`@analogjs/vite-plugin-angular`).
- **The config is `vitest.config.mts`**, so Storybook's Vite builder, which reads `vite.config.*`, never picks it up.

## Required values

| What                       | Value                                                                                                                                                                                                                                                                                                                                                                       |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| dependencies               | dev `@analogjs/vitest-angular@2`, `@vitest/browser@5`, `@vitest/browser-playwright@5`, `@playwright/test@1`; the CLI's `jsdom` stays; the CLI's `vitest` replaced by `vitest@5`                                                                                                                                                                                             |
| `angular.json` test target | `{ "builder": "@analogjs/vitest-angular:test", "options": { "project": ["unit"] }, "configurations": { "browser": { "project": ["browser"] } } }`                                                                                                                                                                                                                           |
| scripts                    | `test` `ng test`; `test:browser` `ng test -c browser`                                                                                                                                                                                                                                                                                                                       |
| `vitest.config.mts`        | `plugins: [angular()]` from `@analogjs/vite-plugin-angular`; project `unit`: `environment: 'jsdom'`, `include: ['src/**/*.spec.ts']`, `exclude: ['src/**/*.browser.spec.ts']`, `setupFiles: ['src/test-setup.ts']`; project `browser`: `include: ['src/**/*.browser.spec.ts']`, `setupFiles: ['src/testing/browser-setup.ts']`, Chromium browser mode; both `extends: true` |
| setup files                | `src/test-setup.ts`: `import '@angular/compiler'`, then `setupTestBed()` from `@analogjs/vitest-angular/setup-testbed`; `src/testing/browser-setup.ts`: the same plus `import '../styles.css'` so the styles apply                                                                                                                                                          |
| `tsconfig.spec.json`       | extends `./tsconfig.json`; `types: ["vitest/globals", "vite/client"]`; includes `src/**/*.spec.ts`, `src/test-setup.ts`, `src/testing/**/*.ts`, `src/**/*.d.ts`. `tsconfig.app.json` excludes the same files                                                                                                                                                                |
| `.gitignore` additions     | `/.vitest`, Playwright's `/test-results`, `/playwright-report`, `/blob-report`, `/playwright/.cache`                                                                                                                                                                                                                                                                        |

## Pitfalls

- **Analog compiles only the files in `tsconfig.spec.json`'s program**; any other file falls through to Vite's plain
  transform, which loses signal `input()` / `output()` metadata (`NG0303` / `NG0315`). Every spec, unit and browser, and
  both setup files belong there. Never switch to `@Input()` to make a component testable.
- **`vite/client` in `tsconfig.spec.json`** declares the `*.css` import of `browser-setup.ts`; an undeclared side-effect
  import is rejected.
- **A test config named `vite.config.*`** is read by Storybook too: name it `vitest.config.mts`.
- **The first browser run can report "Vite unexpectedly reloaded a test"** while Vite pre-bundles; run it again.

## Conventions

- **`ng test` runs on Analog's builder**: `unit` in jsdom (`pnpm test`), `browser` in Chromium (`pnpm test:browser`).
- **Every spec is in `tsconfig.spec.json`**: Analog compiles only that program.

## Verify it is wired

- `angular.json`'s test target is `@analogjs/vitest-angular:test` with the two projects.
- Every `*.spec.ts` and `*.browser.spec.ts` matches `tsconfig.spec.json`'s `include`.
