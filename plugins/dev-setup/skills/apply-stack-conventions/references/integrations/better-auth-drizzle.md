# Better Auth + Drizzle

Better Auth's tables in the app's Drizzle schema, reached through its Drizzle adapter with the engine's provider. The
React Router stacks use it once they add sign-in.

## The seam

```
app/db/schema.ts: users, sessions, accounts, verifications ─► drizzleAdapter(db, { provider, schema: { user: schema.users, … } })
                                                         └─► drizzle-kit generate ─► the auth migration
```

## Required values

| What     | Value                                                                                                                                                                                                     |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| adapter  | `drizzleAdapter(db, { provider, schema: { ...schema, user: schema.users, session: schema.sessions, account: schema.accounts, verification: schema.verifications } })` from `better-auth/adapters/drizzle` |
| provider | `sqlite` on D1, `pg` on Postgres                                                                                                                                                                          |
| tables   | `users`, `sessions`, `accounts`, `verifications` in `app/db/schema.ts`, with their relations, in the engine's column types                                                                                |

## Pitfalls

- **Plural table names without the adapter's mapping** leave Better Auth looking for `user` and `session`.

## Conventions

- **The auth tables live in `app/db/schema.ts`** as `users`, `sessions`, `accounts`, `verifications`, mapped onto Better
  Auth's names in the adapter options.
- **The adapter's provider is the engine's.**

## Verify it is wired

- The adapter's `schema` maps all four tables, and a migration creates them.
