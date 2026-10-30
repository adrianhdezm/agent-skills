# shadcn

The shadcn CLI and its registries: primitives copied into the app as source, with their dependencies, and their imports
rewritten to the app's aliases. Which registry, and whether its code may be edited, is each registry's integration.

**Realises:** [UI components](../architecture/ui-components.md)

## Use it like this

- **`pnpm dlx shadcn@4 add <item>…`**, from the package that owns the components: the CLI writes each item's source into
  `components/ui/`, adds the items it depends on and the packages it declares, and rewrites imports to the aliases in
  `components.json`.
- **`components.json` names the style, the global stylesheet and the aliases**; the CLI resolves those aliases from the
  `paths` of the package's root `tsconfig.json`, which therefore keeps them even though it holds no other compiler
  options.
- **An item is a URL or a name**: a name for the registry the style belongs to, a full URL for any other registry.
- **Add an item when the app first needs it**, as the UI components concept says; `--overwrite` takes a registry's update
  as a reviewable diff.

## Required values

| What                 | Value                                                              |
| -------------------- | ------------------------------------------------------------------ |
| command              | `pnpm dlx shadcn@4 add …`                                          |
| root `tsconfig.json` | `paths` matching the aliases in `components.json` (`~/*` or `@/*`) |

## Pitfalls

- **No `paths` in the root `tsconfig.json`**: the CLI writes into a literal folder named after the alias (`~` or `@`) at
  the package root. Check the files landed under `components/ui/` after every `add`.
- **`npx` or a local `shadcn` binary** resolves another version: use `pnpm dlx shadcn@4` only.
- **A registry item declares only some of its packages**: the integration lists what to install up front.

## Conventions

- **Primitives from a registry come through `pnpm dlx shadcn@4 add`**, never copied by hand, `npx` or a local binary.
- **The root `tsconfig.json` keeps the `paths` the CLI reads.**
- **After every `add`, the files are under `components/ui/`**; a stray `~` or `@` folder is a bug.
- **Whether an added primitive may be edited is the registry's integration's call.**
