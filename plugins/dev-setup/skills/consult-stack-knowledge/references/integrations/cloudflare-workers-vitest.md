---
type: Integration
title: Cloudflare Workers + Vitest
description: tests in workerd through `cloudflare:workers`
connects: [cloudflare-workers, vitest]
---
# Cloudflare Workers + Vitest

Vitest inside workerd through Cloudflare's plugin: tests reach the Worker through its real entry and read its bindings,
with the test runtime's types seen only by the tests. The Hono Worker uses it, and any Worker whose server code is
tested in its own runtime. Under a framework (React Router on Workers), the unit tests run in browser mode through
React Router + Vitest, and only the `integration` project runs in workerd through `cloudflareTest`.

## The seam

```
vitest.config.ts ─► cloudflareTest({ wrangler: { configPath: './wrangler.jsonc' } }) ─► workerd
tests ─► import { exports, env } from 'cloudflare:workers' ─► exports.default.fetch(new Request(…))
tsconfig.test.json ─► types: ["./worker-configuration.d.ts", "@cloudflare/vitest-plugin/types"]
```

## Required values

| What                 | Value                                                                                                                    |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| devDependencies      | `@cloudflare/vitest-plugin`, on the same Vitest major                                                                    |
| `vitest.config.ts`   | `cloudflareTest({ wrangler: { configPath: './wrangler.jsonc' } })`; under a framework, in the `integration` project only |
| `tsconfig.test.json` | extends the Worker project, adds `tests`, `types: ["./worker-configuration.d.ts", "@cloudflare/vitest-plugin/types"]`    |

Check `pnpm view @cloudflare/vitest-plugin peerDependencies` before installing `vitest`.

## Pitfalls

- **`@cloudflare/vitest-pool-workers` is deprecated**: use `@cloudflare/vitest-plugin`.
- **`SELF` and `env` from `cloudflare:test` are deprecated**: import `exports` and `env` from `cloudflare:workers`.

## Conventions

- **Server tests run in workerd** and reach the Worker through `exports.default.fetch()` from `cloudflare:workers`,
  reading bindings from `env` there.
- **Only the tests see the test runtime's types**, through `tsconfig.test.json`.

## Verify it is wired

- `vitest.config.ts` uses `cloudflareTest`; no `@cloudflare/vitest-pool-workers` in the manifest.
- No test imports from `cloudflare:test`.
