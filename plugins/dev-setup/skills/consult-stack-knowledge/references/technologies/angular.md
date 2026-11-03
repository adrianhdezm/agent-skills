---
kind: technology
role: framework
detect:
  files: [angular.json]
realises: [ui-components]
aliases: [Angular, '@angular/']
---
# Angular

Angular 22 as a single-page app: the CLI scaffold and its cleanup, standalone signal components with inline templates,
two tiers of tests, and a static build.

**Realises:** [UI components](../architecture/ui-components.md)

## Use it like this

- **The Angular CLI creates the package**, pinned to the major the stack targets, never `@latest`:

  ```sh
  pnpm dlx @angular/cli@22 new <name> --directory=<dir> --package-manager=pnpm --skip-install --skip-git \
    --style=css --routing=true --ssr=false --defaults
  ```

  then the cleanup, at once: delete `.editorconfig` (the formatter owns indentation), `README.md` (the docs live at the
  repo root), the CLI's root component (`app.ts`, `app.html`, `app.css`, `app.spec.ts`: the root component is wiring,
  and has no spec); in a workspace package also delete `packageManager` (the root's) and the shared tools' entries
  (the root catalog adds them back), its `.gitignore` (the root's covers it) and its `.prettierrc` (rewritten with the
  shared config). The new root component is `app.component.ts` (class `App`), so `src/main.ts` imports
  it from `./app/app.component` instead of `./app/app`. The CLI's `.vscode/` and `public/favicon.ico` stay; `<title>`
  in `src/index.html` becomes the app name.

- **Standalone, zoneless, signal components.** Every component takes signal `input()` / `output()`, never `@Input()`;
  none sets `changeDetection`, because `OnPush` is Angular 22's default and writing it on one makes the others look
  eager. No `zone.js` anywhere: the app and everything that renders its components run zoneless.
- **One file per component**: inline `template`, no `.html` or `.css` siblings, styled through its `host` and its
  template's classes. Files sit flat in their folder with the `.component.ts` suffix
  (`pages/entity-list-page.component.ts`), classes have no suffix (`EntityListPage`), and the one nested component
  folder is `components/ui/`.
- **Templates use the control flow blocks**: the status-driven body is an `@switch (status())`, the error banner over it
  an `@if (status() === 'error')`. A host binds every signal input with property syntax, literals included
  (`[itemKind]="'entity'"`), so all bindings read alike.
- **Configuration is build-time.** `src/environments/environment.ts` (production) and `environment.development.ts`
  hold `appName` and `apiBaseUrl`, swapped by `fileReplacements`; one place in the app reads them.
- **Two tiers of tests**: `unit` for services, state and helpers (the required `test` check), `browser` for components
  and pages in a real browser (`test:browser`). The test runner's integration says how they are wired.
- **A static build**: the production build is static files in `dist/<name>/browser`, served by a static server with an
  SPA fallback; the API URL is build-time configuration, so nothing is proxied.
- **The checks**: `build` (`ng build`, the check for templates), `typecheck` (what `ng build` does not compile: the
  specs and setup files, and the e2e suite where there is one), `test`, `lint`, `format:check`.

## Required values

| What                 | Value                                                                                                                                                                                                                                                                                          |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `angular.json` build | `schematics["@schematics/angular:component"].style: "css"`; `styles: ["src/styles.css"]`, `inlineStyleLanguage: "css"`; production budgets initial `2mb` / `4mb`, `anyComponentStyle` `4kB` / `8kB`; `development.fileReplacements` swapping `environment.ts` for `environment.development.ts` |
| scripts              | the CLI's `ng`, `start`, `build`, `watch`; `typecheck` `tsc -p tsconfig.app.json --noEmit && tsc -p tsconfig.spec.json --noEmit && tsc -p tsconfig.node.json --noEmit`                                                                                                                         |

## Pitfalls

- **The CLI's manifest is not `"type": "module"`**, and stays that way: a config file that uses `import` ends in `.mjs`
  or `.mts`.
- **A component with `input.required()` cannot be mounted by a helper that starts change detection at once**
  (`NG0950`): mount it by hand, `TestBed.createComponent` → `setInput` for each required input → append to
  `document.body` → `autoDetectChanges()`.
- **A `[value]` on a native `<select>` is applied before `@for` renders the options**, so it does not take: reflect the
  value with `[selected]` on each `<option>`. A wrapping `<label>` folds the option text into the select's name: use
  `<label for>` and an `id`.

## Conventions

### Components and templates

- **One file per component**, inline `template`, no `.html` or `.css`; the only global stylesheet is
  `src/styles.css`.
- **Signal `input()` / `output()` only**, no `@Input()`; no component sets `changeDetection` (`OnPush` is the default);
  everything runs zoneless.
- **Bind signal inputs with property syntax**, literals included (`[itemKind]="'entity'"`).
- **The status-driven body is an `@switch (status())`**; the error banner over it is an `@if (status() === 'error')`.
- **A native select gets its own `<label for>` and `id`**, and each `<option>` reflects the value with `[selected]`.
- **Dates** shown with `date: 'medium'`.
- **Forms are `new FormGroup` / `new FormControl`**, validated like the API's schemas.

### Files and names

| What                    | Pattern                                                                                    | Example                               |
| ----------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------- |
| page, layout, component | `<name>.component.ts`, flat in `pages/`, `layouts/`, `components/`                         | `pages/entity-list-page.component.ts` |
| primitive               | `components/ui/<name>.component.ts`, selector `ui-<name>`, class `Ui<Name>`                | `UiDialog`                            |
| app component           | `components/<name>.component.ts`, selector `app-<name>`                                    | `DeleteDialog`                        |
| service, helper, model  | `services/<resource>.service.ts`, `helpers/<name>.helper.ts`, `models/<resource>.model.ts` | `entity.service.ts`                   |
| unit / browser spec     | `<file>.spec.ts` / `<file>.browser.spec.ts` beside the file                                | `entity.service.spec.ts`              |

Selector prefixes follow the folder: `ui` under `components/ui/`, `app` everywhere else.

### Testing the web app

| Tier    | Answers                                                          | Real                                       | Stubbed        | Lives in                            | Run                 |
| ------- | ---------------------------------------------------------------- | ------------------------------------------ | -------------- | ----------------------------------- | ------------------- |
| unit    | is this service or helper right?                                 | the unit, `TestBed`                        | HTTP, services | `*.spec.ts` beside the file         | `pnpm test`         |
| browser | does this component or page render and behave in a real browser? | the component, a real browser, real styles | the router     | `*.browser.spec.ts` beside the file | `pnpm test:browser` |

- **Services** run against `provideHttpClient()` + `provideHttpClientTesting()` and assert method, URL, params and body.
- **Helpers** get a happy case and an edge case each.
- **Components** are mounted by hand (`createComponent`, `setInput`, append to `document.body`,
  `autoDetectChanges()`), driven through locators by role and name, with a spy on each output.
