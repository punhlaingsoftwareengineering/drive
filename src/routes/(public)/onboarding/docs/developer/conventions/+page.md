# Conventions

Stable contracts for HTTP API integrators. Handlers live under `src/routes/api/`; when behavior changes, update this page and the [REST API reference](./rest-api).

## Base URL

All paths are relative to your deployment origin: `{ORIGIN}/api/...`. Local development typically uses `http://localhost:1025`.

There is **no URL version prefix** (no `/v1`). Breaking path or payload changes should be documented here and in the REST index.

## Content types

| Use case | `Content-Type` |
| -------- | -------------- |
| JSON request bodies | `application/json` |
| File / chunk upload body | `application/octet-stream` (required) |
| JSON responses | `application/json` |
| File download | `application/octet-stream`, `application/zip`, or MIME from file |

## Authentication headers

- **API key:** `Authorization: Bearer znldv_<prefix>_<secret>` or `X-API-Key: znldv_…`
- **Browser session:** session cookie from Better Auth (automatic on same-origin `fetch`)
- **Cron:** `Authorization: Bearer <CRON_SECRET>` (not a user key)

See [Authentication](./authentication) for the full matrix.

## Storage providers

Query param or JSON field `storageProvider`:

| Value | Meaning |
| ----- | ------- |
| `local` | Server filesystem (default) |
| `tigris` | Tigris object storage |

Invalid values return **400** `Invalid storage provider`.

For **team-scoped** requests, pass `teamId` — the team’s configured provider is enforced; your `storageProvider` query must match it.

## Identifiers

- File, folder, team, and API key ids are **UUID v4** strings.
- Public share tokens are short URL-safe strings (not UUIDs), e.g. `o3891y8qhw9`.

## Team scoping (`teamId`)

Many drive endpoints accept optional query param `teamId=<uuid>`:

- Caller must be a **member** of that team (**403** otherwise).
- Team’s `storageProvider` is fixed at team creation and overrides the query default.
- Without `teamId`, operations apply to the authenticated user’s **personal** drive (`team_id IS NULL`).

Used by: `GET /api/drive/files`, `shared`, `trash`, `recent`, `stats`, and upload query params. See [Drive API](./drive-api).

## Dates and numbers

- Timestamps in JSON are **ISO 8601** strings in UTC (e.g. `2026-07-01T12:00:00.000Z`).
- `sizeBytes` in JSON responses are JavaScript-safe **numbers** (bigint values from the DB are converted).

## Folder listing query aliases

`GET /api/drive/files` accepts either:

- `parentId=<uuid>` — list children of that folder
- `folder=<uuid>` — alias for `parentId`

Omit both for the drive root (personal root or team root when `teamId` is set).

## Error responses

Failed requests typically return a **plain-text** body with a short message from SvelteKit `error()`, not a JSON envelope:

```
Unauthorized
```

Status codes: [Errors](./errors).

## File label colors

`PATCH /api/drive/files/[id]` accepts `color` as one of:

`base`, `primary`, `secondary`, `accent`, `neutral`, `info`, `success`, `warning`, `error`, or `null` to clear.

## Upload limits

- **Simple upload** (`POST /api/drive/upload`): intended for files **≤ 8 MiB** (8 × 1024 × 1024 bytes).
- **Chunked upload** (`POST /api/drive/upload/chunk`): 8 MiB per chunk; required for larger files.
- **`MAX_UPLOAD_BYTES`** env: app-level cap; `0` or unset means no app cap (disk/env limits still apply).

## Maintenance for contributors

When adding a new `src/routes/api/**/+server.ts` handler:

1. Add a row to [REST API reference](./rest-api).
2. Document request/response on the relevant detail page ([Drive API](./drive-api), [Teams API](./teams-api), or [Other endpoints](./other-endpoints)).
3. Note whether `requireApiSession` (key OK) or `requireCookieApiSession` (cookie only) is used.

## Related

- [Getting started](./getting-started)
- [REST API reference](./rest-api)
