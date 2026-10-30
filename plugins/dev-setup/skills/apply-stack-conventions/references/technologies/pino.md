# Pino

Pino as a long-lived server process's logger: one instance writing JSON lines to stdout, its level from the
environment, made readable only by a pipe in development. The stacks whose server is a process of its own use it; where
the platform runs each request, its console is the log.

## Use it like this

- **One logger, `src/logger.ts`**, exporting `logger`; everything that logs imports it, and the framework's request
  logging is built on it.
- **Plain JSON to stdout, nothing else**: no `transport`, no `pino-pretty` import. Production then needs no dev
  dependency and no worker thread, and the container's logs stay machine-readable.
- **`LOG_LEVEL` sets the level**, `debug` by default and `info` when `NODE_ENV=production`. It is the one setting with a
  default: a level changes what is printed, never what the app does.
- **Errors are logged as `{ err }`**, the first argument, so Pino's serializer prints the message, the stack and the
  `cause`; the second argument is a short message.
- **Development reads logs through `pino-pretty`**, as a pipe after the `dev` command; tests set `LOG_LEVEL` to
  `silent`.

## Required values

| What            | Value                                                                                       |
| --------------- | ------------------------------------------------------------------------------------------- |
| dependencies    | `pino`                                                                                      |
| devDependencies | `pino-pretty`                                                                               |
| `dev` pipe      | `\| pino-pretty --colorize --singleLine --translateTime 'HH:MM:ss.l' --ignore pid,hostname` |
| tests           | `env: { LOG_LEVEL: 'silent' }` at the root of the test runner's config                      |
| `.env.example`  | a commented `# LOG_LEVEL=debug`                                                             |

## Pitfalls

- **`transport: { target: 'pino-pretty' }`** makes production load a dev dependency, in a worker thread: pretty
  printing stays a pipe.
- **An error passed as the message** (`logger.error(String(error))`) loses its stack and `cause`: pass `{ err }`.

## Reference code

`src/logger.ts`:

```ts
import { pino } from 'pino';

/** Plain JSON logs; `pnpm dev` pipes them through pino-pretty. */
export const logger = pino({ level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'production' ? 'info' : 'debug') });
```

## Conventions

- **One logger in `src/logger.ts`**, writing JSON to stdout; nothing else creates one.
- **The level comes from `LOG_LEVEL`**: `debug` by default, `info` in production, `silent` in tests.
- **Errors are logged as `{ err }`** with a short message.
- **Pretty output is a pipe in the `dev` script only**, never an import or a transport.
