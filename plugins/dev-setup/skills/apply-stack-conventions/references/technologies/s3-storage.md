# S3 storage

S3-compatible object storage: the AWS SDK v3 client, configured from the root `.env`, against any S3-compatible service.

**Realises:** [File storage](../architecture/file-storage.md)

## Use it like this

- **The AWS SDK v3 client**, `@aws-sdk/client-s3` (with `@aws-sdk/s3-request-presigner` for signed URLs), built once at
  module scope by the composition root and handed to the file service with the bucket name.
- **Configuration comes from the root `.env`**, read once; the client's code throws when a variable is unset, with no
  fallback value.
- **The bucket is created with the SDK**, a one-off `CreateBucketCommand` run under `node --env-file=.env`, so no AWS
  CLI is needed.

## Required values

| What           | Value                                                                                                                                                          |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| dependencies   | `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`                                                                                                          |
| client options | `endpoint: S3_ENDPOINT`, `region: 'us-east-1'` (required by the SDK, ignored by most compatible services), `credentials` from the keys, `forcePathStyle: true` |
| `.env`         | `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET=app-files`; `.env.example` lists them with the keys empty                                          |

## Pitfalls

- **Without `forcePathStyle: true`** the SDK addresses the bucket as a subdomain, which a self-hosted service does not
  serve.
- **The SDK requires a region** even where the service ignores it.

## Conventions

- **One S3 client, built once by the composition root** from the root `.env`; only the file service uses it.
- **`S3_*` variables are in `.env.example`** with the secret values empty; production gets them from the platform.
