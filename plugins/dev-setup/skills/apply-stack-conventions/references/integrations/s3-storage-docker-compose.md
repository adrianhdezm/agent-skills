# S3 storage + Docker Compose

RustFS, an S3-compatible store, as a service of the root Compose file, so file storage runs locally the way it runs in
production. React Router on Node uses it once it stores files.

## The seam

```
.env (S3_ENDPOINT=http://localhost:9000, keys, S3_BUCKET) ─► docker-compose.yml: rustfs (port 9000, ./<owner>/storage/data)
host apps ─► localhost:9000          app services ─► rustfs:9000 (their own S3_ENDPOINT)
```

## Required values

```yaml
rustfs:
  image: rustfs/rustfs:1.0.4
  restart: unless-stopped
  command: server /data
  user: root # the image's rustfs user cannot write a bind mount Docker created as root
  environment:
    - RUSTFS_ACCESS_KEY=${S3_ACCESS_KEY}
    - RUSTFS_SECRET_KEY=${S3_SECRET_KEY}
  ports:
    - '${RUSTFS_PORT:-9000}:9000'
  volumes:
    - ./<owner>/storage/data:/data # Persist objects (host-bound)
```

| What    | Value                                                                                                  |
| ------- | ------------------------------------------------------------------------------------------------------ |
| `.env`  | `RUSTFS_PORT=9000`, `S3_ENDPOINT=http://localhost:9000`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET` |
| ignores | `<owner>/storage/data/` in `.gitignore`, `.dockerignore` and `.prettierignore`                         |

## Pitfalls

- **Without `user: root` the service crash-loops** on `Permission denied (os error 13)`: the image runs as its own
  `rustfs` user, and Docker creates the bind-mounted folder as root. `docker compose up --wait` still reports it
  started, since it has no healthcheck: check `docker compose ps` or its logs.
- **Inside Compose, an app reaches RustFS at its service name**, not `localhost`: the app service sets its own
  `S3_ENDPOINT`.
- **The bucket does not exist on a fresh service**: create it with the SDK once the service is up.

## Conventions

- **RustFS runs as a Compose service** with its data bind-mounted and git-ignored; reset it by deleting the folder.
- **Inside Compose, apps reach it at host `rustfs`**; on the host, at `localhost:${RUSTFS_PORT}`.

## Verify it is wired

- `docker compose up -d --wait rustfs` brings the service up, `docker compose ps rustfs` shows it running (not
  restarting), and the bucket in `S3_BUCKET` exists.
