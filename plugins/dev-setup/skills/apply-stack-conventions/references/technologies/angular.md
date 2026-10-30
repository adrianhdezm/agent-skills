# Angular

Angular 22 as a single-page app: the CLI scaffold and its cleanup, standalone signal components with inline templates,
two tiers of tests, Storybook for building components, and static serving.

## Use it like this

- **The Angular CLI creates the package**, pinned to the major the stack targets, never `@latest`:

  ```sh
  pnpm dlx @angular/cli@22 new <name> --directory=<dir> --package-manager=pnpm --skip-install --skip-git \
    --style=scss --routing=true --ssr=false --defaults
  ```

  then the cleanup, at once: delete `.editorconfig` (the formatter owns indentation), `README.md` (the docs live at the
  repo root), the CLI's root component (`app.ts`, `app.html`, `app.scss`, `app.spec.ts`: the root component is wiring,
  and has no spec) and every `.scss` file; in a workspace package also delete `packageManager` (the root's) and the
  shared tools' entries (the root catalog adds them back). The CLI's `.vscode/` and `public/favicon.ico` stay;
  `<title>` in `src/index.html` becomes the app name.

- **Standalone, zoneless, signal components.** Every component takes signal `input()` / `output()`, never `@Input()`;
  none sets `changeDetection`, because `OnPush` is Angular 22's default and writing it on one makes the others look
  eager. No `zone.js` anywhere: the app, the tests and Storybook run zoneless.
- **One file per component**: inline `template`, no `.html` or `.scss` siblings, styled through its `host` and its
  template's classes. Files sit flat in their folder with the `.component.ts` suffix
  (`pages/entity-list-page.component.ts`), classes have no suffix (`EntityListPage`), and the one nested component
  folder is `components/ui/`.
- **Templates use the control flow blocks**: the status-driven body is an `@switch (status())`, the error banner over it
  an `@if (status() === 'error')`. A host binds every signal input with property syntax, literals included
  (`[itemKind]="'entity'"`), so all bindings read alike.
- **Forms are `new FormGroup` / `new FormControl`**, never an injected `FormBuilder`.
- **Configuration is build-time.** `src/environments/environment.ts` (production) and `environment.development.ts`
  hold `appName` and `apiBaseUrl`, swapped by `fileReplacements`; one place in the app reads them, the app-context
  state.
- **Two tiers of tests**: `unit` for services, state and helpers (the required `test` check), `browser` for components
  and pages in a real browser (`test:browser`). The test runner's integration says how they are wired.
- **Storybook develops the components**, on `@storybook/angular-vite` with `@analogjs/vite-plugin-angular`, not the
  webpack `@storybook/angular`, so it shares the app's compile path. Every component in `components/` and
  `components/ui/` has a `*.stories.ts` beside it. Storybook is not a test runner.
- **Static serving**: the production build is static files, `dist/<name>/browser`, served by Nginx with an SPA fallback
  (`try_files $uri $uri/ /index.html`) and no `/api` proxy: the API URL is build-time configuration.
- **The checks**: `build` (`ng build`, the check for templates), `typecheck` (what `ng build` does not compile: the
  specs and setup files, and the e2e suite where there is one), `test`, `lint`, `format:check`.

## Required values

| What                     | Value                                                                                                                                                                                                                                                                                                                                  |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Storybook                | dev `storybook@10`, `@storybook/angular-vite@10`, `@analogjs/vite-plugin-angular@2`, `vite`, `@angular/animations`, `@angular-devkit/architect`, `@angular-devkit/core`                                                                                                                                                                |
| `angular.json` build     | `schematics["@schematics/angular:component"].style: "css"`; `styles: ["src/styles.css"]`, `inlineStyleLanguage: "css"`; production budgets initial `2mb` / `4mb`, `anyComponentStyle` `4kB` / `8kB`; `development.fileReplacements` swapping `environment.ts` for `environment.development.ts`                                         |
| `angular.json` Storybook | targets `storybook` (`@storybook/angular-vite:start-storybook`, `configDir: ".storybook"`, `browserTarget: "<name>:build"`, `port: 6006`) and `build-storybook` (`…:build-storybook`, `outputDir: "storybook-static"`)                                                                                                                 |
| scripts                  | the CLI's `ng`, `start`, `build`, `watch`; `storybook` `ng run <name>:storybook`; `build-storybook` `ng run <name>:build-storybook`; `typecheck` `tsc -p tsconfig.app.json --noEmit && tsc -p tsconfig.spec.json --noEmit`                                                                                                             |
| `.storybook/`            | `main.ts` (stories `../src/**/*.stories.ts`, `framework: '@storybook/angular-vite'`); `preview.ts` importing `../src/styles.css`; `tsconfig.json` extending `../tsconfig.app.json` with `types: ["node"]`, `moduleResolution: "bundler"`, including the sources, the stories and the two config files; `typings.d.ts` declaring `*.md` |
| `.gitignore` additions   | `*storybook.log`, `storybook-static`                                                                                                                                                                                                                                                                                                   |
| Nginx                    | `nginx.conf`: `listen 80`, `root /usr/share/nginx/html`, `location / { try_files $uri $uri/ /index.html; }`                                                                                                                                                                                                                            |

## Pitfalls

- **A component with `input.required()` cannot be mounted by a helper that starts change detection at once**
  (`NG0950`): mount it by hand, `TestBed.createComponent` → `setInput` for each required input → append to
  `document.body` → `autoDetectChanges()`.
- **`@angular/animations` is a required peer of `@storybook/angular-vite`**, so every install prints its deprecation
  warning; that is expected. `zone.js` is only an optional peer: do not install it.
- **A `[value]` on a native `<select>` is applied before `@for` renders the options**, so it does not take: reflect the
  value with `[selected]` on each `<option>`. A wrapping `<label>` folds the option text into the select's name: use
  `<label for>` and an `id`.

## Conventions

### Components and templates

- **One file per component**, inline `template`, no `.html` or `.scss`; the only global stylesheet is
  `src/styles.css`.
- **Signal `input()` / `output()` only**, no `@Input()`; no component sets `changeDetection` (`OnPush` is the default);
  everything runs zoneless.
- **Bind signal inputs with property syntax**, literals included (`[itemKind]="'entity'"`).
- **The status-driven body is an `@switch (status())`**; the error banner over it is an `@if (status() === 'error')`.
- **A native select gets its own `<label for>` and `id`**, and each `<option>` reflects the value with `[selected]`.
- **Dates** shown with `date: 'medium'`; a date filter is a day in the viewer's time zone, sent as local midnight in
  ISO-8601.
- **Forms are `new FormGroup` / `new FormControl`**, validated like the API's schemas.

### Files and names

| What                    | Pattern                                                                                    | Example                               |
| ----------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------- |
| page, layout, component | `<name>.component.ts`, flat in `pages/`, `layouts/`, `components/`                         | `pages/entity-list-page.component.ts` |
| primitive               | `components/ui/<name>.component.ts`, selector `ui-<name>`, class `Ui<Name>`                | `UiDialog`                            |
| app component           | `components/<name>.component.ts`, selector `app-<name>`                                    | `DeleteDialog`                        |
| service, helper, model  | `services/<resource>.service.ts`, `helpers/<name>.helper.ts`, `models/<resource>.model.ts` | `entity.service.ts`                   |
| story                   | `<name>.stories.ts` beside the component                                                   | `delete-dialog.stories.ts`            |
| unit / browser spec     | `<file>.spec.ts` / `<file>.browser.spec.ts` beside the file                                | `entity.service.spec.ts`              |

Selector prefixes follow the folder: `ui` under `components/ui/`, `app` everywhere else.

### Storybook

- **Every component has a story file beside it**, one story per meaningful state, `args` for its inputs and `fn()` for
  its outputs, titled `UI/<Name>` for a primitive and `Components/<Name>` for an app component. A primitive with
  projected content renders through a `template`.
- **Storybook is where components are built and reviewed, not a test**: behaviour is tested by browser specs.

### Testing the web app

| Tier    | Answers                                                          | Real                                 | Stubbed                        | Lives in                            | Run                 |
| ------- | ---------------------------------------------------------------- | ------------------------------------ | ------------------------------ | ----------------------------------- | ------------------- |
| unit    | is this service, slice, effect or helper right?                  | the unit, `TestBed`                  | HTTP, store, actions, services | `*.spec.ts` beside the file         | `pnpm test`         |
| browser | does this component or page render and behave in a real browser? | the component, Chromium, real styles | the store (mock), the router   | `*.browser.spec.ts` beside the file | `pnpm test:browser` |

- **Services** run against `provideHttpClient()` + `provideHttpClientTesting()` and assert method, URL, params and body.
- **Helpers** get a happy case and an edge case each.
- **Components** are mounted by hand (`createComponent`, `setInput`, append to `document.body`,
  `autoDetectChanges()`), driven through locators by role and name, with a spy on each output.
- **Pages** mount over a mock store and assert each UI state of the status union and what each control dispatches.
