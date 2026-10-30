# Postgres + Docker Compose

Postgres as the `db` service of the root Compose file: healthchecked, its database created by an init script, its data
bind-mounted, reached at host `db` inside Compose and at `localhost` from the host. React Router on Node and the
Angular full stack use it.

## The seam

```
.env (DB_PASSWORD, DATABASE_URL@localhost) ─► docker-compose.yml: db (postgres:17-alpine, healthcheck, init.sql, ./<owner>/db/data)
                                                                   ▲
host apps ─► localhost:5432          app services ─► db:5432 (their own DATABASE_URL), depends_on db healthy
```

## Where it lives

| File                          | Holds                                                                                          |
| ----------------------------- | ---------------------------------------------------------------------------------------------- |
| `docker-compose.yml`          | the `db` service                                                                               |
| `<owner>/db/scripts/init.sql` | `CREATE DATABASE app;`, its only line: the `postgres` superuser owns it, so no grant is needed |
| `<owner>/db/data/`            | the bind-mounted data, git- and docker-ignored                                                 |
| `.env`, `.env.example`        | `DB_PASSWORD`, `DB_PORT`, `DATABASE_URL`                                                       |

## Required values

The `db` service, the same in every stack except the paths:

```yaml
db:
  image: postgres:17-alpine
  restart: unless-stopped
  environment:
    - POSTGRES_PASSWORD=${DB_PASSWORD:-s3cr3t}
  ports:
    - "${DB_PORT:-5432}:5432"
  volumes:
    - ./<owner>/db/data:/var/lib/postgresql/data # Persist data (host-bound)
    - ./<owner>/db/scripts/init.sql:/docker-entrypoint-initdb.d/init.sql # Run init script on first start
  healthcheck:
    test: ["CMD-SHELL", "pg_isready -U postgres -d app"]
    interval: 5s
    timeout: 5s
    retries: 10
```

The database name `app` appears in `init.sql`, the healthcheck and the URLs: change all together. `DB_PORT` moves only
the host port: the host's `DATABASE_URL` uses it, while services inside Compose keep `db:5432`.

## Pitfalls

- **Without the healthcheck, `up --wait` returns while Postgres still refuses connections**, and a migration run
  straight after fails on a cold machine.
- **`localhost` inside a container** is the container itself: an app service reaches Postgres at `db`.
- **`init.sql` runs only on the first start**, when the data folder is empty: delete the folder to rerun it.

## Conventions

- **Postgres runs as the Compose `db` service**, `postgres:17-alpine`, healthchecked; app services wait for it to be
  healthy.
- **Its data is bind-mounted under `db/data/`** (reset it with `rm -rf` on that folder); `db/scripts/init.sql` creates
  the `app` database on first start.
- **Inside Compose, apps reach Postgres at host `db`**; on the host, at `localhost:5432`.

## Verify it is wired

- `docker compose up -d --wait db` returns with the service healthy, and the `app` database exists.
- Every app service's `DATABASE_URL` names host `db`; `.env`'s names `localhost`.
