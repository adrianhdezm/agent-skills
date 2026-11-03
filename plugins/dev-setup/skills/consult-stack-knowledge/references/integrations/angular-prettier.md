---
kind: integration
connects: [angular, prettier]
---
# Angular + Prettier

Prettier in an Angular package: the Angular parser for HTML, and the folders the package leaves out. Both Angular
stacks use it.

## Required values

| What              | Value                                                                                                  |
| ----------------- | ------------------------------------------------------------------------------------------------------ |
| `.prettierrc`     | the shared values plus `overrides: [{ "files": "*.html", "options": { "parser": "angular" } }]`        |
| `.prettierignore` | `node_modules`, `dist`, `.angular`, `storybook-static`, `test-results`, `playwright-report`, `.vitest` |
| package           | the CLI's `prettier` entry, kept (or the catalog's in a workspace)                                     |

## Conventions

- **HTML is formatted with the Angular parser**; inline templates are formatted with their component.
