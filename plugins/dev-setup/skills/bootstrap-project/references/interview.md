# Interview

Settle the combination before writing a file. Ask only what the request, the analysis or the calling skill has not
already answered, put every open question in one message, and give each its default. Then state the combination in
one line and run to the end.

## Questions

1. **What does it ship?**
   - a library, a CLI or a script: nothing runs as a server;
   - an HTTP API or small service, with no screens;
   - a web app, with screens.
2. **Where does it run, and does it own its backend?** For an API or a web app.
   - **Cloudflare Workers**: on the edge, nothing to operate, billed per request. Data comes later as bindings (D1,
     KV, R2).
   - **Node, with Docker Compose and Postgres**: a long-running process next to a relational database, self-hosted
     wherever Compose runs.
   - **Static files only** (web app): the app calls an API it does not own, and Nginx serves it.
3. **Which frontend?** For a web app.
   - **React Router**: one package; server-rendered routes whose loaders and actions are the backend. On Workers or on
     Node.
   - **Angular**: an SPA with route-driven NgRx state, Storybook and two test layers. With its own Express + Postgres
     API as a monorepo, or alone, calling an existing API.
4. **Angular only**: whether to add SAP Fiori Horizon components from the Fundamental NGX registry (default no); for
   the full stack, the database name (default `app`); alone, the API's base URL (default `http://localhost:3000` in
   development, the page's own host on port 3000 in production).
5. **Always**: the project name (default: the target directory's name) and a one-sentence description.
6. **Anything the request names that the questions above do not cover** (another framework, a database, a
   library): take it as part of the combination; whether a doc covers it is looked up in the next step, not asked.

## Combinations with a blueprint

| Ships                  | Runs on                        | Frontend     | Stack                   | Blueprint                                                                                                |
| ---------------------- | ------------------------------ | ------------ | ----------------------- | -------------------------------------------------------------------------------------------------------- |
| a library, CLI, script | Node 24, no build              | none         | Node package            | [node-package.md](../../apply-stack-conventions/references/stacks/node-package.md)                       |
| an API or service      | Cloudflare Workers             | none         | Hono Worker             | [hono-worker.md](../../apply-stack-conventions/references/stacks/hono-worker.md)                         |
| a web app              | Cloudflare Workers             | React Router | React Router on Workers | [react-router-cloudflare.md](../../apply-stack-conventions/references/stacks/react-router-cloudflare.md) |
| a web app              | Node, Docker Compose, Postgres | React Router | React Router on Node    | [react-router-docker.md](../../apply-stack-conventions/references/stacks/react-router-docker.md)         |
| a web app              | static files, an existing API  | Angular      | Angular app             | [angular-app.md](../../apply-stack-conventions/references/stacks/angular-app.md)                         |
| a web app              | Node, Docker Compose, Postgres | Angular      | Angular full stack      | [angular-fullstack.md](../../apply-stack-conventions/references/stacks/angular-fullstack.md)             |

**Any other combination** in TypeScript is composed from the docs that cover its parts, with the gaps filled and
reported. Say plainly when it has no blueprint, and offer the nearest blueprint if one would do:

- **An API alone on Node with Postgres**: composed from Node, Express, Drizzle and Express + Drizzle, with the API part
  of the Entity CRUDL example; or React Router on Node, whose resource routes serve JSON.
- **Angular on Workers**: the Angular app's static build on any static host; or React Router on Workers.
- **A framework or library no doc covers**: the shared tooling's docs plus that framework's official docs, listed as a
  gap.
- **Another language**: this skill does not apply.

## Recommending a stack

When another skill (`design-solution`) or the user asks which stack fits, read what the analysis says people do and
recommend one, with the reason in a sentence:

| The analysis says                                                                                                      | Recommend                                                                                        |
| ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| nothing runs as a server: other code imports it, or a person runs it in a terminal or a schedule                       | Node package                                                                                     |
| endpoints only, a handful of them, little or no relational data                                                        | Hono Worker                                                                                      |
| screens and forms, modest data per user, nothing to operate, users anywhere                                            | React Router on Workers                                                                          |
| screens and forms over relational data, long-running work, or it must be self-hosted                                   | React Router on Node                                                                             |
| many list, detail and form screens over an API that already exists, or the SAP Fiori look without a backend of its own | Angular app                                                                                      |
| many list, detail and form screens over a relational model, an API other clients will use too, or the SAP Fiori look   | Angular full stack: it arrives with Postgres, the DAO layer and a CRUDL example wired end to end |

When two fit, recommend the one with fewer moving parts and say what would tip it the other way. A React Router stack
arrives with no database code: the React Router + Drizzle integration says how data access is layered once one is added.

## The answer

One line the rest of the run, and a calling skill, can quote:

```
Stack: React Router on Node · my-app · Lets a team book the shared meeting rooms.
```

For an Angular stack, add the Fundamental NGX choice, and the database name or the API base URL. A combination with no
blueprint names its parts instead:

```
Combination: Express + Drizzle + Postgres API on Node, no blueprint · my-api · Tracks the team's equipment loans.
```
