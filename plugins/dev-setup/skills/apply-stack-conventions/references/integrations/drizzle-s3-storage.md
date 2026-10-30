# Drizzle + S3 storage

The file service on Node: object bytes in an S3-compatible store through the AWS SDK, metadata in the `files` table
through Drizzle, one `FilesService` keeping the two in step, scoped to the file's owner. React Router on Node uses it
once file storage is picked.

**Realises:** [File storage](../architecture/file-storage.md)

## The seam

```
upload:   PutObjectCommand(key) ─► insert files row ─► on failure, DeleteObjectCommand(key) and rethrow
download: select the owner's row ─► GetObjectCommand(row.key) ─► Body.transformToWebStream()
delete:   select the owner's row ─► delete the row ─► DeleteObjectCommand(row.key)
list:     the data access list, with eq(files.ownerId, ownerId) added to the typed filter
```

- **`FilesService` is built by the server entry** with the Drizzle client, the S3 client and the bucket name, and
  reached through the app's context.
- **Every read is scoped to the owner**: `get` returns `null` for someone else's file, so the route answers 404.
- **Keys are `<ownerId>/<uuid>`**, made by the service; the client's filename is a column.

## Where it lives

| File                                      | Holds                                                                    |
| ----------------------------------------- | ------------------------------------------------------------------------ |
| `app/db/schemas/files.schema.ts`          | the `files` table with its indexed `ownerId`, and its list input schemas |
| `app/services/files.service.ts`           | `FilesService`                                                           |
| `tests/integration/files.service.test.ts` | the service on a Testcontainers Postgres and an in-memory store          |

## Reference code

`app/services/files.service.ts`:

```ts
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, type S3Client } from '@aws-sdk/client-s3';
import { and, count, eq } from 'drizzle-orm';

import type { DbClient } from '~/db/client';
import { NotFoundError, type PaginatedResult, filterToSql, sortToSql, toPaginatedResult } from '~/db/data-access';
import { type FileRow, type ListFileInput, fileDefaultSort, files } from '~/db/schemas/files.schema';

export const MAX_FILE_SIZE = 10 * 1024 * 1024;

/** The one owner of the `files` table and the object store: every database call is paired with an object-store call. */
export class FilesService {
  private readonly db: DbClient;
  private readonly s3: S3Client;
  private readonly bucket: string;

  constructor(db: DbClient, s3: S3Client, bucket: string) {
    this.db = db;
    this.s3 = s3;
    this.bucket = bucket;
  }

  /** Stores the object, then the row; the object is deleted again if the row cannot be written. */
  async upload(input: { ownerId: string; filename: string; contentType: string; body: Uint8Array }): Promise<FileRow> {
    const key = `${input.ownerId}/${crypto.randomUUID()}`;
    const contentType = input.contentType || 'application/octet-stream';
    await this.s3.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: input.body, ContentType: contentType }));
    try {
      const [row] = await this.db
        .insert(files)
        .values({ key, filename: input.filename, contentType, size: input.body.byteLength, ownerId: input.ownerId })
        .returning();
      if (!row) {
        throw new Error('File insert did not return a row');
      }
      return row;
    } catch (error) {
      await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
      throw error;
    }
  }

  /** The owner's file, or null when it does not exist or belongs to someone else. */
  async get(input: { id: string; ownerId: string }): Promise<FileRow | null> {
    const [row] = await this.db
      .select()
      .from(files)
      .where(and(eq(files.id, input.id), eq(files.ownerId, input.ownerId)))
      .limit(1);
    return row ?? null;
  }

  async list(input: ListFileInput & { ownerId: string }): Promise<PaginatedResult<FileRow>> {
    const { ownerId, filter, sort = fileDefaultSort, page, pageSize } = input;
    const where = and(eq(files.ownerId, ownerId), filter && filterToSql(filter, files));
    const items = await this.db
      .select()
      .from(files)
      .where(where)
      .orderBy(...sortToSql(sort, files))
      .limit(pageSize)
      .offset((page - 1) * pageSize);
    const [counted] = await this.db.select({ total: count() }).from(files).where(where);
    return toPaginatedResult(items, counted?.total ?? 0, { page, pageSize });
  }

  /** The stored bytes of the owner's file. */
  async download(input: { id: string; ownerId: string }): Promise<{ file: FileRow; body: ReadableStream }> {
    const file = await this.get(input);
    if (!file) {
      throw new NotFoundError('File', input.id);
    }
    const object = await this.s3.send(new GetObjectCommand({ Bucket: this.bucket, Key: file.key }));
    if (!object.Body) {
      throw new NotFoundError('File object', input.id);
    }
    return { file, body: object.Body.transformToWebStream() };
  }

  /** Removes the row, then the object. */
  async delete(input: { id: string; ownerId: string }): Promise<void> {
    const file = await this.get(input);
    if (!file) {
      throw new NotFoundError('File', input.id);
    }
    await this.db.delete(files).where(eq(files.id, file.id));
    await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: file.key }));
  }
}
```

`app/db/schemas/files.schema.ts`:

```ts
import { index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { createSelectSchema } from 'drizzle-zod';
import type { z } from 'zod';

import {
  createFilterInputSchema,
  createListInputSchema,
  createSortInputSchema,
  dateFilterInputSchema,
  idFilterInputSchema,
  numberFilterInputSchema,
  stringFilterInputSchema
} from '../data-access';
import { users } from './auth.schema';

export const files = pgTable(
  'files',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    key: text('key').notNull().unique(),
    filename: text('filename').notNull(),
    contentType: text('content_type').notNull(),
    size: integer('size').notNull(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [index('files_owner_id_idx').on(table.ownerId)]
);

export const selectFileSchema = createSelectSchema(files);

export const fileFilterInputSchema = createFilterInputSchema({
  id: idFilterInputSchema,
  ownerId: idFilterInputSchema,
  filename: stringFilterInputSchema,
  contentType: stringFilterInputSchema,
  size: numberFilterInputSchema,
  createdAt: dateFilterInputSchema
});

export const fileSortInputSchema = createSortInputSchema(['filename', 'size', 'createdAt']);

export const listFileInputSchema = createListInputSchema({
  filter: fileFilterInputSchema,
  sort: fileSortInputSchema
});

export const fileDefaultSort: FileSortInput = { field: 'createdAt', direction: 'DESC' };

export type FileRow = z.infer<typeof selectFileSchema>;
export type FileFilterInput = z.infer<typeof fileFilterInputSchema>;
export type FileSortInput = z.infer<typeof fileSortInputSchema>;
export type ListFileInput = z.infer<typeof listFileInputSchema>;
```

The in-memory store the integration test hands the service in place of the S3 client:

```ts
/** An in-memory stand-in for the S3 client: the objects it holds, and the commands it understands. */
function createFakeStore() {
  const objects = new Map<string, Uint8Array>();
  const client = {
    send: (command: unknown) => {
      if (command instanceof PutObjectCommand) {
        objects.set(String(command.input.Key), command.input.Body as Uint8Array);
        return Promise.resolve({});
      }
      if (command instanceof DeleteObjectCommand) {
        objects.delete(String(command.input.Key));
        return Promise.resolve({});
      }
      if (command instanceof GetObjectCommand) {
        const body = objects.get(String(command.input.Key));
        return Promise.resolve({ Body: body && { transformToWebStream: () => new Blob([new Uint8Array(body)]).stream() } });
      }
      return Promise.reject(new Error('Unsupported command'));
    }
  } as unknown as S3Client;
  return { objects, client };
}
```

## Pitfalls

- **Writing the row first** leaves a row with no object when the upload fails: the object goes first, and is deleted
  again when the insert throws.
- **`GetObjectCommand`'s `Body` is a Node stream**: answer with `Body.transformToWebStream()`, so the route returns a
  web `Response` body.

## Conventions

- **`FilesService` is the only code that imports the S3 client or the `files` table**, built by the server entry.
- **Every read and delete is scoped to the owner**; another user's file is not found.
- **The service's integration test runs on a real Postgres and an in-memory store**, and covers the rollback branch.

## Verify it is wired

- An insert that fails leaves no object in the store; a test covers it.
- A second user's `get`, `download` and `delete` of a file answer not found.
