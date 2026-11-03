---
name: consult-stack-knowledge
description: "Consults the house knowledge base of TypeScript stacks: a graph of concept, technology, integration and stack docs. Recommends the stack that fits a project; resolves which stack a project is or will be (a blueprint with its optional parts, or a combination composed from the docs that cover it) from the project's files or the technologies named; lists the docs that apply and assembles coding-conventions.md for the calling skill; and answers which conventions, pitfalls and required values govern a file or a topic in a project. Use when bootstrap-project, experiment-idea or plan-release needs a stack recommended or settled, when another skill needs the stack and the docs for a project, when a project's coding-conventions.md has to be assembled again, or when a session asks which rule applies to a file, how something is done in this stack, or why a convention holds."
---

# Consult Stack Knowledge

The house stacks as a knowledge base: concept, technology, integration and stack docs under
`<skill-dir>/references/` (`<skill-dir>` is this skill's base directory), joined into a graph by each doc's frontmatter,
and the scripts that ask it. For a project, or a combination of technologies, it answers which stack that is, which
docs apply and what `coding-conventions.md` they assemble into, and hands that to the skill that asked; for a file or a
topic in a project, it answers which docs govern it and what they say. Which docs apply is computed from the graph, not
recalled. It does not build or change the project: the caller reads the docs and does the work.
[references/catalog.md](references/catalog.md) lists every doc and says where a new fact belongs; after changing the
docs, `node <skill-dir>/scripts/check.mjs` reports what else has to change. `references/` is an Open Knowledge Format
(OKF v0.2) bundle: its `index.md` files list the docs with their descriptions, and a doc that pins a version cites where
to check it and says when it goes stale.

The two tables below are the one list of stacks. Other skills (`bootstrap-project`'s interview, `experiment-idea`,
`plan-release`) link here rather than keep their own.

## Stacks

| Stack                                       | Suits applications like                                                                                                                          | Runs on                                          | Data out of the box                                    | Optional (`--with`)                                                                | Blueprint                                                                  |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------ | ------------------------------------------------------ | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Node package                                | libraries, CLIs, scripts, scheduled jobs: nothing runs as a server                                                                               | Node 24, no build                                | none                                                   | —                                                                                  | [node-package.md](references/stacks/node-package.md)                       |
| Hono Worker                                 | JSON APIs, webhooks, small edge services with little or no relational data                                                                       | Cloudflare Workers                               | none                                                   | —                                                                                  | [hono-worker.md](references/stacks/hono-worker.md)                         |
| REST API on Node                            | an API several clients use (web, mobile, partners), over relational data, self-hosted                                                            | Express on Node, Postgres, Docker Compose        | Postgres through Drizzle, an `entity` CRUDL resource   | —                                                                                  | [node-api.md](references/stacks/node-api.md)                               |
| Hono API on Node                            | the same API, for a team that writes Hono rather than Express                                                                                    | Hono on Node, Postgres, Docker Compose           | Postgres through Drizzle, an `entity` CRUDL resource   | —                                                                                  | [hono-node-api.md](references/stacks/hono-node-api.md)                     |
| React Router on Workers                     | server-rendered web apps with forms and modest data per user, nothing to operate, users anywhere: SaaS front ends, internal tools, content sites | Cloudflare Workers                               | none                                                   | `database` (D1), `authentication`, `file-storage` (R2), `storybook`                | [react-router-cloudflare.md](references/stacks/react-router-cloudflare.md) |
| React Router on Node (the React full stack) | server-rendered web apps that own their data: loaders and actions are the backend, over relational data, with long-running work, self-hosted     | Node, Postgres, Docker Compose                   | Postgres running, no data code                         | `database` (Drizzle), `authentication`, `file-storage` (S3 on RustFS), `storybook` | [react-router-docker.md](references/stacks/react-router-docker.md)         |
| Angular app                                 | single-page back-office front ends with many list, detail and form screens, over an API the project does not own                                 | static files on Nginx                            | the API it calls                                       | `angular-fundamental-ngx` (SAP Fiori)                                              | [angular-app.md](references/stacks/angular-app.md)                         |
| Angular full stack                          | back-office apps that own their data and expose a REST API other clients can use too                                                             | Nginx, Express on Node, Postgres, Docker Compose | Postgres through Drizzle, an `entity` CRUDL end to end | `angular-fundamental-ngx` (SAP Fiori)                                              | [angular-fullstack.md](references/stacks/angular-fullstack.md)             |

To recommend one, match what the project does to **Suits applications like** and give the reason in a sentence. When
two fit, recommend the one with fewer moving parts and say what would tip it the other way. `authentication` needs
`database`, and `file-storage` needs both; the script adds what a picked group requires and says so.

Combinations without a blueprint are composed from the docs that cover their parts. Say plainly that one has no
blueprint, and offer the nearest blueprint if it would do:

| Combination                               | Built from                                                                                                | Nearest blueprint                                      |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| A React app over its own REST API         | React Router on Node for the app, REST API on Node for the API, the React Router + Drizzle rules left out | React Router on Node alone: resource routes serve JSON |
| Angular on Workers or another static host | the Angular app blueprint, without Nginx and Docker Compose                                               | React Router on Workers                                |
| A library no doc covers                   | the docs of the parts that have one, and that library's official docs (a gap)                             | the blueprint the rest of the project matches          |

**Server code is Express or Hono.** An API on Node is REST API on Node (Express) unless Hono is asked for. A request
for another server framework (Fastify, NestJS, Koa) is not composed: say so, and offer the blueprint that fits. Another
language is out of scope: every doc here is TypeScript.

## Workflow

1. **Resolve the stack** with one command, which prints the block the hand-off is built from:

   ```sh
   # an existing project: its technologies are read from its manifests and config files
   node <skill-dir>/scripts/resolve-stack.mjs <project dir> [--with <group>]...
   # a combination the caller settled: the technologies by their doc names, a --with for each optional entry asked for
   node <skill-dir>/scripts/resolve-stack.mjs --technologies <name>... [--concepts <concept>...] [--with <group>]... [--kind "<what it is>"]
   ```

   It matches the technologies to a blueprint when every one belongs to it and whatever it lacks is only toolchain or
   tooling (named under `Found`), picks the groups whose technologies are present plus each `--with` and what those
   require, and lists the blueprint's docs and the parts of its Starter (what a fresh scaffold ships) for them.
   Otherwise the combination is **composed**: the concepts its technologies realise (plus each `--concepts`, such as
   `rest-api` for an API with no data) and every integration whose both ends are present and no present technology
   rules out, in composition order, with no Starter; `Found` names the nearest blueprint. A `--technologies` name no doc covers is a `Gap`.

   Name the technologies by their doc's base name (`react-router`, `cloudflare-workers`, `s3-storage`); the
   [catalog](references/catalog.md) lists them. For an existing project, its `coding-conventions.md` names its stack in
   its first paragraph: a difference from the `Stack` line goes under **Found**.

2. **Judge the block.** The script knows the docs; you know the request. Add to `Gaps` any technology the request names,
   or the project's manifest shows, that shapes the project (a server framework, a database, an auth library, a UI
   kit) and the `Technologies` line lacks; an ordinary dependency is not a gap. A request for a server framework other
   than Express or Hono, or for another language, is answered as the Stacks section says, not composed. Read the
   blueprint and each doc the caller will need before handing off.

3. **Assemble the conventions** with the `Assemble` command the block printed, `<out>` replaced by the caller's scratch
   directory, or a new temporary one. It writes `coding-conventions.md` and prints the hand-off block. The script
   fails on a missing section or a link that would not resolve in a project; a failure is a broken doc, reported under
   **Found**, not something to work around.

   For an existing project that has a `coding-conventions.md`, diff the two: a difference means one of them moved, and
   goes under **Found** for the user to decide.

4. **Hand off.** Return the block the assembly printed, with the `Gaps` and `Found` lines from step 1 and what you
   added in step 2, to the caller:

   ```
   Stack: React Router on Node · with: database, authentication     (or: Composed: <what it is>)
   Blueprint: <skill-dir>/references/stacks/react-router-docker.md  (or: none)
   Docs: <path>, <path>, …                                           (absolute, in composition order)
   Starter: the blueprint's Starter: Home; Sign in, with `authentication`   (or: none (no blueprint))
   Ports: Postgres 5432 (moved with `DB_PORT`), the app's `PORT` …   (the blueprint's ports row)
   Conventions: <scratchpad>/coding-conventions.md
   Gaps: no doc for <technology>                                     (or: none)
   Found: <a broken doc, a group added because another requires it, a doc past its stale_after or deprecated, a drift from the project's coding-conventions.md>   (or: none)
   ```

   Run without a calling skill, end with the same block.

## Answering about a file or a topic

When a session asks which rule governs a file, how something is done in this stack, or why a convention holds, do not
load the docs and search: ask the graph.

```sh
# the docs that claim a file: their Conventions and Pitfalls (--sections Conventions,Pitfalls,Verify it is wired; or all)
node <skill-dir>/scripts/dossier.mjs <project dir> <file>... [--sections <name>,...] [--with <group>]...
# the bullets and rows, across the docs that apply to the project, that mention every word
node <skill-dir>/scripts/dossier.mjs <project dir> --topic <word>... [--sections <name>,...]
```

It resolves the project's stack as step 1 does, keeps the docs that apply, and prints, for a file, each doc whose
"Where it lives", "Layout" or Required values names it, with what that file holds and the sections asked for; for a
topic, each matching bullet with its doc and section. Answer from what it printed, naming the doc each rule comes from,
and quote the reason the doc gives; when it flags a doc as deprecated or past its `stale_after`, say so with the answer. When no doc claims the file, say so and offer the blueprint's Layout as the nearest
guide; when no doc mentions the topic, say so rather than inferring a rule. A rule the docs lack is a gap to report to
the maintainer, not a rule to make up.

## Review Checklist

- [ ] The stack came from `resolve-stack.mjs`, from the project's files or the technologies named, and its block was read
- [ ] Only the optional entries the project has or asks for, and what they require, were picked
- [ ] Docs are in composition order; every technology that shapes the project and has no doc is a gap
- [ ] `coding-conventions.md` was assembled by the script with `--out`, and the script passed
- [ ] The hand-off block was returned, with Gaps and Found carried over and added to
- [ ] A question about a file or a topic was answered from `dossier.mjs`, each rule with its doc
