# Angular + the API contract

How the Angular web app consumes its HTTP API: a build-time base URL, models mirrored by hand, and the REST API concept's
list format shared by the page URL and the request. Both Angular stacks use it: against the full stack's own Express
API, or against an existing API that speaks the same contract.

**Realises:** [REST API](../architecture/rest-api.md), as its client

## The seam

```
environment*.ts (apiBaseUrl) ─► appContext slice ─► selectApiBaseUrl
                                                        │
effect ─► <Resource>Service (HttpClient) ─► GET <apiBaseUrl>/<resources>?filter=…&sortField=…&page=… ─► the API
                                         ◄─ PaginatedResult<T>  |  { status: 'error', message }
```

- **The browser calls the API directly.** The base URL is build-time configuration in `src/environments/`; production
  derives it from the page's own host (`` `${window.location.protocol}//${window.location.hostname}:3000` ``), so one
  build works on any host. Nginx proxies nothing, and the API answers CORS for any origin.
- **Models mirror the API by hand.** The web cannot import the API package; the two change together.
- **One list format.** The page URL and the API request carry the same query params, built by one helper, so a deep
  link is the request.

## Where it lives

| File (web)                                         | Holds                                                          |
| -------------------------------------------------- | -------------------------------------------------------------- |
| `src/environments/environment*.ts`                 | `apiBaseUrl` per build                                         |
| `src/app/store/app-context/`                       | the only importer of `environment`; `selectApiBaseUrl`         |
| `src/app/models/<resource>.model.ts`               | the API's types, by name and shape                             |
| `src/app/services/<resource>.service.ts`           | the only `HttpClient` user; full URLs from `selectApiBaseUrl`  |
| `src/app/helpers/<resource>-list-params.helper.ts` | `parseListInput`, `toParams`: the URL ⇄ list input format      |
| `src/app/helpers/http-error.helper.ts`             | `httpErrorMessage(err)`, the API's `message` or the response's |

The wire format itself (the list request and response, the error body, values) is the REST API concept's; on the
API side, the controllers and `errorHandler` (the Express doc) produce it.

## Pitfalls

- **The derived production URL assumes the API is published on port 3000 of the page's host.** Publishing it on
  another port, or serving the web from a host the API is not on (a static host, a CDN, the edge), leaves every call
  failing while the page itself loads: set the production `apiBaseUrl` explicitly there, and check a smoke test calls the
  API as the page does rather than fetching only the HTML.

## Conventions

- **The API base URL is build-time configuration**, in `src/environments/`; only the `appContext` slice reads it. There
  is no `/api` proxy and no runtime config file; the API allows any origin, because the browser calls it directly.
- **Resource models mirror the API by hand** in `models/<resource>.model.ts`; a change to the API's types changes them
  in the same commit.
- **One list params helper per resource writes the REST list format** for both the page URL and the request, so a deep
  link is the request.
- **The web shows the API's error `message`** when it sent one, else the response's.

## Verify it is wired

- Only `store/app-context/` imports `environment`, and only services use `HttpClient`.
- The list service builds its `HttpParams` from the same `toParams` the page uses for the URL.
- Each model's fields match the API's response for that resource; `nginx.conf` has no `proxy_pass`.
