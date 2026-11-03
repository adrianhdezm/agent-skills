# Blueprints

* [Angular app](angular-app.md) - A single Angular 22 project: an SPA with NgRx route-driven state, Tailwind, Storybook and two test layers, calling an API it does not own, and served as static files by Nginx.
* [Angular full stack](angular-fullstack.md) - A pnpm-workspace monorepo: an Express 5 + Drizzle + Postgres API in `api/` and the Angular web package in `web/`, run by Docker Compose, with an `entity` CRUDL resource wired end to end from the database to the pages, and a Playwright suite over the whole stack.
* [Hono API on Node](hono-node-api.md) - A single-package Hono + Drizzle + Postgres REST API, compiled by `tsc` and run on Node through `@hono/node-server`, next to Postgres in Docker Compose, with an `entity` CRUDL resource wired from the table to the routes.
* [Hono Worker](hono-worker.md) - A Hono API or small site on Cloudflare Workers, built by Vite, with its tests running inside workerd against the real Worker.
* [REST API on Node](node-api.md) - A single-package Express 5 + Drizzle + Postgres REST API, compiled by `tsc` and run on Node, next to Postgres in Docker Compose, with an `entity` CRUDL resource wired from the table to the routes.
* [Node package](node-package.md) - A single-package TypeScript project that Node 24 runs as it is: a library, a CLI or a script.
* [React Router on Workers](react-router-cloudflare.md) - A server-rendered React Router app whose server is a Hono Worker on Cloudflare's edge, styled with Tailwind and shadcn/ui.
* [React Router on Node](react-router-docker.md) - A server-rendered React Router app on Node, next to Postgres in Docker Compose, styled with Tailwind and shadcn/ui.
