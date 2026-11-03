---
kind: concept
---
# Authorization

What a signed-in user may see and do, whatever the auth library: ownership as the default model, checked where the
resource is loaded, lists filtered in the query, someone else's resource answered as a missing one, and an action that
is not allowed refused. Who the user is belongs to [Authentication](authentication.md). These rules apply from the
moment a project adds sign-in.

## Principles

- **Ownership is the default model**: a row a user creates belongs to them through an `ownerId` column referencing the
  user, and only the owner reads, changes or deletes it. Roles or sharing are added when a feature needs them, as a
  check beside ownership, never in place of it.
- **The owner comes from the session, never from the request**: the server sets `ownerId` from the signed-in user on
  create, and no input schema accepts it from the client, so no request can file a row under someone else.
- **Check where the resource is loaded.** The handler that reads a resource id passes the user's id to the data layer,
  which reads by id and owner together, before any private data is read; nothing reads first and checks afterwards,
  because a check that runs after the read is a check a later change can skip.
- **Lists are filtered in the query**: the owner condition is added to the list's query beside the client's filter, so
  totals and pages count only the user's rows and no filter the client sends can widen them. Filtering a fetched page
  instead breaks the totals and leaks the count.
- **Someone else's resource is a 404**, the same answer as an id that does not exist, for every operation, so a guessed
  id tells nothing about what exists.
- **An action that is not allowed is a 403**: the user may know the resource or route exists but may not take this
  action on it (a role or a share without that right). Ownership misses never answer 403, since that would confirm the
  resource exists.
- **Tests try another user's resource**: a second user's read, update, delete and download answer 404, and their list
  does not contain it.

## Required values

| What                            | Value                                                                                                                             |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| owner column                    | `ownerId` (`owner_id`): a UUID, not null, referencing the user's id with `on delete cascade`, indexed, as Database requires       |
| data layer input                | `ownerId` inside each method's one input object: `{ id, ownerId }` for `get`, `update` and `delete`, beside the filter for `list` |
| owner on create                 | the session's user id, set by the server; never an input field                                                                    |
| list                            | the owner condition in the query, combined with `and` with the client's filter                                                    |
| another user's resource         | 404, as for a missing one                                                                                                         |
| an action the user may not take | 403                                                                                                                               |

## Conventions

- **Every user-owned table has `ownerId`**, a not-null UUID referencing the user, `on delete cascade`, indexed.
- **`ownerId` is set by the server from the session**; no input schema accepts it.
- **The handler that loads a resource by id passes the user's id to the data layer**, which reads by id and owner
  together; someone else's resource is a 404.
- **Every list of user-owned rows adds the owner condition in the query.**
- **A forbidden action on a resource the user may know about is a 403.**

## Verify it is wired

- Every handler taking a resource id passes the signed-in user's id to the data layer.
- No input schema for a user-owned table has an `ownerId` field.
- Every list query of a user-owned table has the owner condition in its `where`.
- A test reads, changes and deletes another user's row and gets 404 each time.
