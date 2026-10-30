# Interview

Settle the combination before writing a file. Ask only what the request, the analysis or the calling skill has not
already answered, put every open question in one message, and give each its default. Then state the combination in
one line and run to the end.

The stacks, what each suits, how to choose between them and the combinations without a blueprint are in the
[Stacks section of `apply-stack-conventions`](../../apply-stack-conventions/SKILL.md#stacks). This file only asks the
questions that pick one; each answer below names the stack it leads to.

## Questions

1. **What does it ship?**
   - a library, a CLI or a script: nothing runs as a server. **Node package**; skip to question 5.
   - an HTTP API or small service, with no screens;
   - a web app, with screens.
2. **Where does it run, and does it own its backend?** For an API or a web app.
   - **Cloudflare Workers**: on the edge, nothing to operate, billed per request. Data comes later as bindings (D1,
     KV, R2). An API is a **Hono Worker**; a web app is **React Router on Workers**.
   - **Node, with Docker Compose and Postgres**: a long-running process next to a relational database, self-hosted
     wherever Compose runs. An API is a **REST API on Node** (Express), or a **Hono API on Node** when Hono is asked
     for; a web app takes question 3.
   - **Static files only** (web app): the app calls an API it does not own, and Nginx serves it. **Angular app**.
3. **Which frontend?** For a web app on Node.
   - **React Router**: one package; server-rendered routes whose loaders and actions are the backend. **React Router
     on Node**.
   - **Angular**: an SPA with route-driven NgRx state, Storybook and two test layers, with its own Express + Postgres
     API as a monorepo. **Angular full stack**.
4. **Angular only**: whether to add SAP Fiori Horizon components from the Fundamental NGX registry (default no); for
   the full stack, the database name (default `app`); alone, the API's base URL (default `http://localhost:3000` in
   development, the page's own host on port 3000 in production). The React Router stacks' optional entries (database,
   authentication, file storage, Storybook) are taken from the request, not asked.
5. **Always**: the project name (default: the target directory's name) and a one-sentence description. For a stack
   that starts from Entity CRUDL (both REST APIs on Node, both Angular stacks), also the first resource's name, singular
   (default `entity`): a renamed resource keeps the example's fields, routes and tests, under the new name. Suggest one
   only when the description names a thing (stock items, invoices), and still default to `entity`.
6. **Anything the request names that the questions above do not cover** (a database, a library): take it as part of
   the combination; whether a doc covers it is looked up in the next step, not asked. Server code is Express or Hono:
   a request for another server framework gets the blueprint that fits offered instead, as `apply-stack-conventions`
   says.

An answer the questions do not lead to a stack from (Angular on Workers, a React app over its own REST API, a library
no doc covers) is a combination without a blueprint: say so plainly and offer the nearest blueprint that
`apply-stack-conventions` names for it. Another language: this skill does not apply.

## Recommending a stack

When another skill (`design-solution`) or the user asks which stack fits, recommend one the way the Stacks section of
`apply-stack-conventions` says: by what the analysis says people do, matched to its **Suits applications like**
column, with the reason in a sentence.

## The answer

One line the rest of the run, and a calling skill, can quote:

```
Stack: React Router on Node · with: database · my-app · Lets a team book the shared meeting rooms.
```

For an Angular stack, add the Fundamental NGX choice, and the database name or the API base URL; for a stack that
starts from Entity CRUDL, the resource's name when it is not `entity`. A combination with no
blueprint names its parts instead:

```
Combination: Express + Drizzle + Postgres API on Node, no blueprint · my-api · Tracks the team's equipment loans.
```
