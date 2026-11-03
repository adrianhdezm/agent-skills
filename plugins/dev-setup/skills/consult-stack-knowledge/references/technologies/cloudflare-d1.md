---
type: Technology
title: Cloudflare D1
description: the binding, a client per request, SQLite column types, `db.batch()`, Wrangler migrations
resource: https://developers.cloudflare.com/d1/
role: service
family: cloudflare-workers
realises: [database]
detect:
  fileContains: ['wrangler.jsonc=d1_databases']
aliases: [D1]
---
# Cloudflare D1

D1, Cloudflare's SQLite database, as the database of a Worker: a binding in `wrangler.jsonc`, SQLite's types, batches
for atomic work, and migrations applied by Wrangler locally and remotely.

**Realises:** [Database](../architecture/database.md)

## Use it like this

- **The database is created by Wrangler and bound in one step**:
  `pnpm wrangler d1 create <name> --binding=APP_DB --update-config` writes the binding into `wrangler.jsonc`, merged with
  what is there. The name is the user's, or the project's in snake case with `_db`. Then `pnpm cf-typegen`, so `Env` has
  `APP_DB: D1Database`.
- **The binding exists only inside the request handler**, so anything that uses it is built there.
- **Column types are SQLite's**: ids are text UUIDs set by the application, since SQLite cannot generate one; times are
  integer milliseconds, UTC by nature.
- **Queries run one at a time**: there is no gain in running them concurrently. Work that must be atomic is one batch.
- **Migrations live in `db/migrations/`** and are applied by Wrangler: `wrangler d1 migrations apply --local APP_DB`
  for the local database, `--remote` for Cloudflare's.
- **Local data lives under `.wrangler/`**, git-ignored and safe to delete.

## Required values

| What             | Value                                                                                                                                                                  |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `wrangler.jsonc` | `"d1_databases": [{ "binding": "APP_DB", "database_name": "<name>", "database_id": "<id>", "migrations_table": "__migrations__", "migrations_dir": "db/migrations" }]` |
| binding name     | `APP_DB`                                                                                                                                                               |
| scripts          | `db:local:migrate` `wrangler d1 migrations apply --local APP_DB`                                                                                                       |

## Pitfalls

- **D1 has no interactive transactions**: atomic work is a batch.
- **A migration applied locally is not applied remotely**, and the reverse: apply to both.
- **Touching the binding at module scope** finds no `env`: do it inside the handler.
- **Rewriting `wrangler.jsonc` by hand** drops the generated id: merge.
- **`wrangler d1 create` needs a Cloudflare account**: offline, write the `d1_databases` binding by hand with a
  placeholder `database_id`; local development and the tests use the local D1, and the real id replaces it before the
  first deploy.

## Conventions

- **D1 is bound as `APP_DB`.**
- **Ids are text UUIDs set by the application; times are integer milliseconds.**
- **Queries run in sequence; atomic work is one batch.**
- **Every migration is applied locally and remotely.**
