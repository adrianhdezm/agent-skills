# Better Auth + Drizzle

Better Auth's tables in the app's Drizzle schema, reached through its Drizzle adapter with the engine's provider. The
React Router stacks use it once they add sign-in.

## The seam

```
app/db/schemas/auth.schema.ts: users, sessions, accounts, verifications, registered in app/db/schema.ts ─► drizzleAdapter(db, { provider, schema: { user: schema.users, … } })
                                                         └─► drizzle-kit generate ─► the auth migration
```

## Required values

| What     | Value                                                                                                                                                                                                                                           |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| adapter  | `drizzleAdapter(db, { provider, schema: { ...schema, user: schema.users, session: schema.sessions, account: schema.accounts, verification: schema.verifications } })` from `better-auth/adapters/drizzle`                                       |
| provider | `sqlite` on D1, `pg` on Postgres                                                                                                                                                                                                                |
| tables   | `users`, `sessions`, `accounts`, `verifications` in `app/db/schemas/auth.schema.ts`, registered in `app/db/schema.ts`, with their relations, in the engine's column types; uuid ids, so the adapter sets `advanced.database.generateId: 'uuid'` |

## Pitfalls

- **Plural table names without the adapter's mapping** leave Better Auth looking for `user` and `session`.
- **Tables declared only in `app/db/schema.ts`** are missed by drizzle-kit, which reads the `*.schema.ts` files: the
  first migration then lacks them. Declare them in `auth.schema.ts`.

## Reference code

`app/db/schemas/auth.schema.ts` on Postgres, with the columns Better Auth's email and password sign-in reads and writes;
on D1 the same columns take Drizzle + D1's types:

```ts
import { relations } from 'drizzle-orm';
import { boolean, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').default(false).notNull(),
  image: text('image'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
});

export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    token: text('token').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [index('sessions_user_id_idx').on(table.userId)]
);

export const accounts = pgTable(
  'accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
    scope: text('scope'),
    password: text('password'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [index('accounts_user_id_idx').on(table.userId)]
);

export const verifications = pgTable('verifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
});

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  accounts: many(accounts)
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] })
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] })
}));
```

## Conventions

- **The auth tables live in `app/db/schemas/auth.schema.ts`** as `users`, `sessions`, `accounts`, `verifications`, mapped onto Better
  Auth's names in the adapter options.
- **The adapter's provider is the engine's.**

## Verify it is wired

- The adapter's `schema` maps all four tables, and a migration creates them.
