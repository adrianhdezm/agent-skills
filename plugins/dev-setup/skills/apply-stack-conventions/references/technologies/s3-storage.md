# S3 storage

S3-compatible object storage: the AWS SDK v3 client, configured from the root `.env`, against any S3-compatible service.

**Realises:** [File storage](../architecture/file-storage.md)

## Use it like this

- **The AWS SDK v3 client**, `@aws-sdk/client-s3` (with `@aws-sdk/s3-request-presigner` for signed URLs), built once at
  module scope by the composition root and handed to the file service with the bucket name.
- **Configuration comes from the root `.env`**, read once; the client's code throws when a variable is unset, with no
  fallback value.
- **The bucket is created with the SDK** by `scripts/create-bucket.ts`, run as `pnpm storage:bucket` once the service is
  up, so no AWS CLI is needed. It succeeds when the bucket already exists, so it is safe to run on every setup.

## Required values

| What           | Value                                                                                                                                                          |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| dependencies   | `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`                                                                                                          |
| client options | `endpoint: S3_ENDPOINT`, `region: 'us-east-1'` (required by the SDK, ignored by most compatible services), `credentials` from the keys, `forcePathStyle: true` |
| scripts        | `storage:bucket` `node --env-file=.env scripts/create-bucket.ts`, the script in `tsconfig.node.json`                                                           |
| `.env`         | `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET=app-files`; `.env.example` lists them with the keys empty                                          |

## Pitfalls

- **Without `forcePathStyle: true`** the SDK addresses the bucket as a subdomain, which a self-hosted service does not
  serve.
- **The SDK requires a region** even where the service ignores it.

## Reference code

The client factory, in the app's `lib/` folder (`app/lib/s3.ts` or `src/lib/s3.ts`):

```ts
import { S3Client } from '@aws-sdk/client-s3';

export interface S3Config {
  readonly endpoint: string;
  readonly accessKey: string;
  readonly secretKey: string;
  readonly bucket: string;
}

/** Builds the process's one S3 client; only the file service uses it. */
export function createS3Client(config: S3Config): S3Client {
  return new S3Client({
    endpoint: config.endpoint,
    region: 'us-east-1',
    credentials: { accessKeyId: config.accessKey, secretAccessKey: config.secretKey },
    forcePathStyle: true
  });
}
```

`scripts/create-bucket.ts`:

```ts
import { BucketAlreadyOwnedByYou, CreateBucketCommand } from '@aws-sdk/client-s3';

import { createS3Client } from '../app/lib/s3.ts';

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

const bucket = required('S3_BUCKET');
const client = createS3Client({
  endpoint: required('S3_ENDPOINT'),
  accessKey: required('S3_ACCESS_KEY'),
  secretKey: required('S3_SECRET_KEY'),
  bucket
});
try {
  await client.send(new CreateBucketCommand({ Bucket: bucket }));
  console.log(`Created bucket ${bucket}`);
} catch (error) {
  if (!(error instanceof BucketAlreadyOwnedByYou)) {
    throw error;
  }
  console.log(`Bucket ${bucket} already exists`);
}
```

## Conventions

- **One S3 client, built once by the composition root** from the root `.env`; only the file service uses it.
- **`pnpm storage:bucket` creates the bucket** on a fresh store; uploads fail until it has run.
- **`S3_*` variables are in `.env.example`** with the secret values empty; production gets them from the platform.
