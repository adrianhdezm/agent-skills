---
kind: integration
connects: [angular]
realises: [rest-api]
detect:
  fileContains: ['src/environments/environment.ts=apiBaseUrl']
---
# Angular + the API contract

How the Angular web app consumes its HTTP API: a build-time base URL, models mirrored by hand, and the REST API concept's
list format shared by the page URL and the request. Both Angular stacks use it: against the full stack's own Express
API, or against an existing API that speaks the same contract.

**Realises:** [REST API](../architecture/rest-api.md), as its client

## The seam

```
environment*.ts (apiBaseUrl) ─► the app's configuration ─► <Resource>Service (HttpClient) ─► GET <apiBaseUrl>/<resources>?filter=…&sortField=…&page=… ─► the API
                                                                                          ◄─ PaginatedResult<T>  |  { status: 'error', message }
```

- **The browser calls the API directly.** The base URL is build-time configuration in `src/environments/`; production
  derives it from the page's own host and the port the blueprint names, so one build works on any host. Nothing proxies
  it, and the API allows the browser's origin.
- **Models mirror the API by hand.** The web cannot import the API package; the two change together.
- **One list format.** The page URL and the API request carry the same query params, built by one helper, so a deep
  link is the request.

## Where it lives

| File (web)                                         | Holds                                                              |
| -------------------------------------------------- | ------------------------------------------------------------------ |
| `src/environments/environment*.ts`                 | `apiBaseUrl` per build                                             |
| `src/app/models/<resource>.model.ts`               | the API's types, by name and shape                                 |
| `src/app/services/<resource>.service.ts`           | the only `HttpClient` user; full URLs from the configured base URL |
| `src/app/helpers/<resource>-list-params.helper.ts` | `parseListInput`, `toParams`: the URL ⇄ list input format          |
| `src/app/helpers/http-error.helper.ts`             | `httpErrorMessage(err)`, the API's `message` or the response's     |

The wire format itself (the list request and response, the error body, values) is the REST API concept's; on the
API side, the controllers and `errorHandler` (the Express doc) produce it.

## Pitfalls

- **The derived production URL assumes the API is published on the page's host, on the port the production
  environment names.** Publishing it elsewhere, or serving the web from a host the API is not on (a static host, a CDN,
  the edge), leaves every call failing while the page itself loads: set the production `apiBaseUrl` explicitly there,
  and check a smoke test calls the API as the page does rather than fetching only the HTML.

## Conventions

- **There is no `/api` proxy and no runtime config file**: the browser calls the API at the configured base URL.
- **Resource models mirror the API by hand** in `models/<resource>.model.ts`; a change to the API's types changes them
  in the same commit.
- **One list params helper per resource writes the REST list format** for both the page URL and the request, so a deep
  link is the request.
- **The web shows the API's error `message`** when it sent one, else the response's.
- **A date filter is a day in the viewer's time zone**, sent as local midnight in ISO-8601.

## Verify it is wired

- Only one place reads `environment`, and only services use `HttpClient`.
- The list service builds its `HttpParams` from the same `toParams` the page uses for the URL.
- Each model's fields match the API's response for that resource.
