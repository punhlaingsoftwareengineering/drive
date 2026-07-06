# Errors

How the HTTP API signals failures. Most error bodies are **plain text** (not JSON) with a short message.

## Status code summary

| Code | Meaning | Typical action |
| ---- | ------- | -------------- |
| `400` | Bad request — validation, malformed JSON, business rule | Fix request; read body message |
| `401` | Unauthorized — no valid session or API key | Send credentials or check key / dev mode |
| `403` | Forbidden — authenticated but not allowed | Check ownership, team membership, dev mode for key admin |
| `404` | Not found — missing resource or no access | Verify id and scope |
| `415` | Unsupported media type — upload without `application/octet-stream` | Fix `Content-Type` header |
| `500` | Internal server error | Retry later; check server logs |
| `502` | Bad gateway — storage backend failure (often Tigris) | Check `TIGRIS_*` env and bucket |
| `503` | Service unavailable — auth/DB unreachable or cron misconfigured | Retry; check `CRON_SECRET` for cron |

---

## 401 Unauthorized

Returned when authentication is required but missing or invalid.

**Drive / teams (`requireApiSession`)**

- No session cookie and no valid API key.
- API key revoked, wrong secret, or developer mode disabled.
- Malformed key (does not match `znldv_<prefix>_<secret>`).

Example body:

```
Unauthorized
```

**Cron**

```
Unauthorized
```

When `Authorization: Bearer` does not match `CRON_SECRET`.

**Login**

```
Invalid email or password
```

---

## 403 Forbidden

Authenticated user is not permitted for this operation.

| Context | Example message |
| ------- | ----------------- |
| Team API | `Forbidden` — not a team member |
| Team file access | `Forbidden` |
| Developer key create/delete | `Enable developer mode first` |
| Download | `Forbidden` — no share/team/owner access |

---

## 503 Service Unavailable

`requireApiSession` and `requireCookieApiSession` catch unexpected auth/database errors:

```
Service temporarily unavailable
```

**Cron** when `CRON_SECRET` is unset:

```
CRON_SECRET is not configured
```

Clients should retry with backoff.

---

## 400 Bad Request

Common cases by area:

### Drive — general

| Message pattern | Cause |
| ----------------- | ----- |
| `Invalid storage provider` | Not `local` or `tigris` |
| `Invalid folder id` / `Invalid team id` | Bad UUID in query |
| `Invalid JSON` | Body parse failure |
| `No fields to update` | Empty PATCH body |
| `Only items in trash can be permanently deleted` | DELETE on non-trash item |
| `One or more items not found` | Reorder with bad ids |
| `Items must share the same parent folder` | Reorder mismatch |

### Upload

| Message | Cause |
| ------- | ----- |
| `Expected Content-Type: application/octet-stream` | Wrong upload content type (**415** in practice) |
| `Missing fileName` | Simple upload query |
| `Empty upload body` | Zero-byte body |
| `Invalid chunk indices` | Bad `chunkIndex` / `chunkCount` |
| `File too large (max N bytes)` | Exceeds `MAX_UPLOAD_BYTES` |

### Teams

| Message | Cause |
| ------- | ----- |
| Zod validation errors | Invalid `name`, `inviteEmails`, etc. |
| `Missing team id` | Invites without path param |

### Developer admin

| Message | Cause |
| ------- | ----- |
| `Expected { enabled: boolean }` | Bad dev mode POST body |
| `Expected { name: string }` | Empty key name |

---

## 404 Not Found

| Context | Cause |
| ------- | ----- |
| `File not found` | PATCH/DELETE on inaccessible id |
| `Not found` | Download, share, public-link |
| `Team not found` | Invalid `teamId` in team context |
| Public token | Link revoked, expired, or file trashed |

---

## 415 Unsupported Media Type

Upload endpoints require:

```
Content-Type: application/octet-stream
```

---

## 502 Bad Gateway

Storage operations failed (common with **Tigris**):

```
Tigris folder create failed. Check TIGRIS_* env vars and bucket access.
```

```
Failed to read file
```

---

## 500 Internal Server Error

Examples:

```
Team root not configured
```

```
Failed to delete permanently
```

```
Stats query failed
```

```
Failed to create key
```

---

## Client handling tips

1. **Always read the response body** on failure — messages are human-readable strings.
2. **Do not retry 400/403/404** without changing the request.
3. **Retry 503** (and transient 502) with exponential backoff.
4. **401 with API key** — verify dev mode, key not revoked, full secret including `znldv_` prefix.
5. **JSON success responses** use `application/json`; errors are usually plain text.

---

## Related

- [Authentication](./authentication)
- [Conventions](./conventions)
- [REST API reference](./rest-api)
