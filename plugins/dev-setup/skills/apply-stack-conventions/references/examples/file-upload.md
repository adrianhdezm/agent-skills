# File upload

Upload, list, download and delete files on a React Router app, bytes in the object store and metadata in the `files`
table, each file visible only to the user who uploaded it. Both React Router stacks start with it when file storage is
picked; it builds on Sign in, so file storage comes with authentication and the database entry.

## Demonstrates

| Part                                                          | Applies                                                                                                                        |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| the `files` table and its migration                           | [File storage](../architecture/file-storage.md) (metadata, `ownerId`), the engine's Drizzle integration                        |
| `app/services/files.service.ts`                               | [File storage](../architecture/file-storage.md) (one service owns both sides, object first, undone if the row fails)           |
| the store client                                              | Cloudflare R2 (the bucket binding) on Workers; S3 storage and S3 storage + Docker Compose (RustFS) on Node                     |
| `workers/app.ts`, `app/context.ts`                            | Hono + React Router (the service built by the server entry onto `appContext`)                                                  |
| `routes/files.tsx`, `files.$id.tsx`, `files.$id.download.tsx` | React Router (loaders and actions under the protected layout), [Authentication](../architecture/authentication.md) (ownership) |
| `tests/integration/files.service.test.ts`                     | the engine's Drizzle integration (real database), [File storage](../architecture/file-storage.md) (the rollback branch)        |

## Data

| What       | Value                                                                                                                     |
| ---------- | ------------------------------------------------------------------------------------------------------------------------- |
| `files`    | `id`, unique `key`, `filename`, `contentType`, `size`, `ownerId` (indexed, the user's id), `createdAt`                    |
| key        | `<ownerId>/<uuid>`, made by the server; the client's filename is metadata only                                            |
| size limit | 10 MB per file; a larger upload answers 413                                                                               |
| routes     | `/files` (list and upload form), `/files/:id` (details, delete), `/files/:id/download`, all under the protected layout    |
| list       | the signed-in user's files, newest first, as `{ items, total, page, pageSize, totalPages }` from the data access contract |

## Behaviour

- Uploading from `/files` (`multipart/form-data`, field `file`) stores the object, inserts the row and redirects to the
  file's page; a missing content type is stored as `application/octet-stream`.
- If the row insert fails, the object is deleted before the error is rethrown: no object is left without a row.
- `/files` lists only the signed-in user's files; another user's `/files/:id` or its download answers 404.
- The download answers the stored bytes with the row's `Content-Type` and `Content-Disposition: attachment` with the
  filename.
- Deleting removes the row, then the object, and redirects to `/files`.

## Tests

| Tier          | File                                      | Covers                                                                                                              |
| ------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| integration   | `tests/integration/files.service.test.ts` | upload writes both sides; a failing insert leaves no object; delete removes both; another owner's file is not found |
| unit, browser | `tests/unit/routes/files.test.tsx`        | the list a stubbed loader returns, the labelled upload field, the empty state                                       |

On Workers the integration tests run in workerd against the local D1 and R2; on Node against Testcontainers Postgres
and the Compose RustFS, or an in-memory stand-in for the store client.

## Done when

The stack's checks pass, and against the built app on a migrated database, signed in: an upload lands on its page and
in the list, the download returns the same bytes and content type, a second user gets 404 for it, and delete removes it
from the list and the store.
