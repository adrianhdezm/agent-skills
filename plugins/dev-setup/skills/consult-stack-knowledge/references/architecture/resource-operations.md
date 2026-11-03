---
type: Architecture Concept
title: Resource operations
description: the five operations, one list contract, list state in the URL, one form, confirmed delete, copying the first resource
---
# Resource operations

How an app offers a resource, a kind of record its users list, read, create, edit and delete, from the database to the
page, whatever the stack: five operations with one shape each, one list contract, list state in the URL, one form for
create and edit, a delete that asks first, and each new resource made by copying the first. The wire format is
[REST API](rest-api.md)'s, the data layer's contract [Data access](data-access.md)'s, the table
[Database](database.md)'s and the test tiers [Testing](testing.md)'s; this concept says how they line up for one
resource.

## Principles

- **Five operations, the same five for every resource**, so a resource is learned once and the next one is a copy: list,
  read, create, a partial update and delete, each one data-layer method, one HTTP route and one page or control, as the
  table under Required values pairs them. A business action that is none of the five is a service with its own route,
  never a sixth verb on the resource.
- **One list contract, from the URL to the database.** The page URL, the API request and the data layer's `list` input
  carry the same filter, sort, page and page size, written and parsed by one list-params helper per resource, so a deep
  link is the request and a value has one place to be rejected. The API rejects a bad value; the page's parser never
  throws, falling back to the defaults, because a hand-edited URL should still show a list.
- **List state lives in the URL.** Every control (filter, sort, page size, pagination) navigates to the next URL and never
  fetches; the page loads from the URL it lands on. Back, forward, reload and a shared link then show the same list, and
  loading has one path. Changing the filter, sort or page size goes to page 1. A filter form keeps its edits until they
  are applied and takes the URL's values again whenever the URL changes; clearing it drops the filter and keeps sort and
  page size. A page past the end (a delete emptied it, a stale link) steps back to the last page, replacing the history
  entry the user did not ask for.
- **A list says why it is empty**: still loading, nothing matching the filter, and nothing yet are three messages, and an
  error is shown as an error, never as an empty list.
- **One form for create and edit**, one page in two states, so the two cannot drift. The edit state fills the form when
  the row arrives. Validation mirrors the API's rules so the user hears early, while the API stays the authority; values
  are sent trimmed, an empty optional field as `null`. Save is disabled while the form loads or saves, and says which.
  After a save the app goes to the detail page only if the user is still on that visit of the form; cancel works while
  a save is in flight.
- **Delete asks first, then waits for the list.** A confirmation names the item and says it cannot be undone. Confirming
  keeps the dialog open and busy until the refetched list arrives, so the deleted row never flashes back; a failure
  leaves it open and usable, with the error shown.
- **A new resource copies the first, layer by layer**: its table and migration, its data access, its routes on the
  API, its model, service and list-params helper on the web, its pages; each layer with its tests at the tiers Testing
  gives them, before the next layer builds on it. Copying keeps names, order and tests aligned across resources; each
  stack's blueprint lists the files.

## Required values

| Operation | Data layer | HTTP                      | Success                   | Page                                            |
| --------- | ---------- | ------------------------- | ------------------------- | ----------------------------------------------- |
| list      | `list`     | `GET /<resources>`        | 200, the paginated result | `/<resources>`                                  |
| read      | `get`      | `GET /<resources>/:id`    | 200, the row              | `/<resources>/:id`                              |
| create    | `create`   | `POST /<resources>`       | 201, the created row      | `/<resources>/new`, then the detail page        |
| update    | `update`   | `PATCH /<resources>/:id`  | 200, the updated row      | `/<resources>/:id/edit`, then the detail page   |
| delete    | `delete`   | `DELETE /<resources>/:id` | 204, no body              | a control on the list, confirmed, then the list |

| What                | Value                                                                                                                     |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| a missing id        | 404 from read, update and delete: `get`'s `null` and `NotFoundError` from `update` and `delete`, mapped by the HTTP layer |
| a malformed id      | 400; ids are UUIDs (Database)                                                                                             |
| an update           | at least one field besides `id`, else 400                                                                                 |
| list params         | REST API's list format; Data access's defaults: page 1, page size 20 of at most 100, the resource's default sort          |
| page-size choices   | sizes from 1 to 100, the default 20 among them                                                                            |
| list-params helper  | one per resource, used for both the page URL and the request; parsing the page URL never throws                           |
| empty list messages | loading, no match for the filter, none yet: three different texts                                                         |

## Conventions

- **Every resource offers the five operations in one shape**: `list`, `get`, `create`, `update`, `delete` in the data
  layer, `GET`, `GET :id`, `POST`, `PATCH :id`, `DELETE :id` on the API, and a list page, a detail page and one form.
- **One list-params helper per resource** writes and parses the list contract for the page URL and the request; parsing
  a URL never throws.
- **Every list control navigates and never fetches**; changing the filter, sort or page size goes to page 1; a page past
  the end steps back, replacing the history entry.
- **An empty list says whether it is loading, filtered to nothing or empty**; an error shows as an error.
- **One form page for create and edit**, sending trimmed values and `null` for an empty optional field, its save
  disabled while busy.
- **Delete is confirmed by name and stays busy until the refetched list arrives.**
- **A new resource copies the first, layer by layer, with its tests**, as the stack's blueprint lists.

## Verify it is wired

- Each resource answers all five routes, with 404 for a missing id and 400 for a malformed one.
- The page URL and the API request of a list are built by the same helper.
- No list control calls the API itself; reloading a list URL shows the same list.
- Create and edit render the same form.
- Deleting the last row of the last page lands on the new last page, with the row gone.
