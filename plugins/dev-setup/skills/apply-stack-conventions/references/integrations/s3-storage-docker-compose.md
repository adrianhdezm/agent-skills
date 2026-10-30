# S3 storage + Docker Compose

RustFS, an S3-compatible store, as a service of the root Compose file, so file storage runs locally the way it runs in
production. React Router on Node uses it once it stores files.

## The seam

```
.env (S3_ENDPOINT=http://localhost:9000, keys, S3_BUCKET) ─► docker-compose.yml: rustfs (port 9000, ./<owner>/storage/data)
host apps ─► localhost:9000          app services ─► rustfs:9000 (their own S3_ENDPOINT)
```

## Required values

| What    | Value                                                                                                                                                                    |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| service | `rustfs` on the `rustfs/rustfs` image, pinned to a tag; `RUSTFS_ACCESS_KEY` and `RUSTFS_SECRET_KEY` from `.env`; port `9000`; data bind-mounted; `command: server /data` |
| `.env`  | `S3_ENDPOINT=http://localhost:9000`, the access and secret keys matching the service's                                                                                   |

## Pitfalls

- **Inside Compose, an app reaches RustFS at its service name**, not `localhost`: the app service sets its own
  `S3_ENDPOINT`.
- **The bucket does not exist on a fresh service**: create it with the SDK once the service is up.

## Conventions

- **RustFS runs as a Compose service** with its data bind-mounted and git-ignored; reset it by deleting the folder.
- **Inside Compose, apps reach it at host `rustfs`**; on the host, at `localhost:9000`.

## Verify it is wired

- `docker compose up -d --wait rustfs` brings the service up, and the bucket in `S3_BUCKET` exists.
