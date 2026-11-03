# Architecture

* [Code style](code-style.md) - comments that explain why, named exports, small units, suppressions with reasons, absence handled
* [Database](database.md) - the engine per runtime, table design, migrations, connection, one database per environment
* [Data access](data-access.md) - one layer touches the database, DAOs on the context, ordered lists, domain errors
* [REST API](rest-api.md) - resources and methods, status codes, one error body, edge validation, the list format
* [Resource operations](resource-operations.md) - the five operations, one list contract, list state in the URL, one form, confirmed delete, copying the first resource
* [Authentication](authentication.md) - the library that owns sessions, protected routes, safe redirects, sign-out
* [Authorization](authorization.md) - ownership by default, checked where loaded, lists filtered in the query, 404 for another's, 403 for a forbidden action
* [File storage](file-storage.md) - bytes in an object store, metadata in a table, one service keeping them in step
* [UI components](ui-components.md) - two tiers of components, one-way imports, theme tokens, states, labels and accessible names
* [Testing](testing.md) - tiers by what is real, each behaviour once at the cheapest tier, behaviour-named cases, owned data
