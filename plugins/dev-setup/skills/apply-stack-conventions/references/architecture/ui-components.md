# UI components

How a frontend is built from components, whatever the framework or component library: two tiers of components, imports
that go one way, styles from the theme, and screens and controls that every user can reach. How the styles are applied
and where the primitives come from belong to the technology docs.

## Principles

- **Two tiers of components.** Primitives (`components/ui/`) are the design system: commonly recognised base components
  (dialog, select, pagination, button, tabs) with the generic API of that component and no resource, flow or app
  wording. App components (`components/`) compose primitives for one purpose, in the app's words (`DeleteDialog` over a
  dialog). A piece named for a resource or a flow (`delete-dialog`, `entity-table`) is never a primitive, however
  reusable it looks.
- **A primitive stays generic.** A new need is a new app component over the same primitive, never a new input that
  teaches the primitive about the app.
- **Pages use both and repeat neither**: a primitive directly for a generic control, an app component for an
  app-specific piece, and no primitive's markup rebuilt inside a page.
- **Imports go one way**: pages → app components → primitives. A primitive imports only other primitives, the framework
  and its component library.
- **Add a primitive when the app first needs it**, never a catalogue in advance. A native element that needs nothing but
  styling stays native, even when its classes repeat.
- **Styles come from the theme.** Colours, spacing and type are the theme's tokens, never raw values, so themes and dark
  mode follow. No component carries its own stylesheet.
- **Every screen has its empty, loading and error states.**
- **Every control has a name and a label, and works from the keyboard.** A custom control that is not a native input
  (a combobox) is labelled through `aria-labelledby`. Free-text inputs that hold no personal data turn autocomplete off.
- **Accessible names are a contract**: tests find elements by role and name, so renaming a heading, label or button
  changes its tests.
- **Each behaviour is tested where it lives**: a primitive's test covers its own behaviour, an app component's only what
  it adds, a page's only what the page does.

## Conventions

- **Two tiers**: design-system primitives in `components/ui/`, generic and free of app wording; app components in
  `components/`, in the app's words. A piece named for a resource or a flow is an app component.
- **A new need is a new app component over the same primitive**, never a new input on the primitive.
- **Pages use primitives for generic controls and app components for app pieces**, and repeat no primitive's markup.
- **Imports go one way**: pages → app components → primitives.
- **Add a primitive when the app first needs it**; a native element that needs only styling stays native.
- **Styles come from the theme's tokens**, never raw values; no per-component stylesheets.
- **Every screen has its empty, loading and error states.**
- **Every input, select and textarea has a `name` and a label**; free-text inputs that are not personal data set
  `autocomplete="off"`; a custom control is labelled through `aria-labelledby`.
- **Accessible names are a test contract**; renaming one changes its tests.
- **Each behaviour is tested where it lives**: primitive, app component or page.

## Verify it is wired

- Nothing in `components/ui/` imports from `components/`, a page, a service or the store, or carries app wording.
- No page contains the markup of a primitive it could use.
- No component sets a raw colour or has its own stylesheet.
- Every form control has a label that names it; the page tests find elements by role and name.
