# Authentication

## Overview

The API supports two user authentication modes for **drive** and **teams** routes:

1. **Browser session** — Better Auth cookie after login or signup.
2. **Developer API key** — long-lived secret for scripts, CI, and backends.

Resolution happens in `requireApiSession`: cookie is tried first, then API key.

## Browser sessions

Same-origin browser `fetch` calls send cookies automatically. Establish a session via:

- `POST /api/auth/login` with email/password, or
- Sign-up / social flows under `/api/auth/**`

Session cookies are **not** documented for third-party embedding; use API keys for server-to-server integration.

## Developer API keys

### Format

User-wide keys:

```
znldv_<12-char-prefix>_<secret>
```

Team-scoped keys (created in **Team settings → Developer API**):

```
znltv_<12-char-prefix>_<secret>
```

Example: `znldv_AbCdEfGhIjKl_mnopqrstuvwxyz123456`

### Transmission

Send the **full** raw secret (not the masked display form):

| Header | Example |
| ------ | ------- |
| `Authorization` | `Bearer znldv_AbCdEfGhIjKl_…` |
| `X-API-Key` | `znldv_AbCdEfGhIjKl_…` |

Only Bearer tokens starting with `znldv_` are parsed as API keys.

### Lifecycle

1. **Enable developer mode** on your user (Profile → Developer, or `POST /api/developer/mode` with cookie).
2. **Create a key** (`POST /api/developer/api-keys` with cookie + dev mode). Plaintext returned once.
3. **Use the key** on all `requireApiSession` routes.
4. **Revoke** when compromised (`DELETE /api/developer/api-keys/[id]` with cookie).

Keys stop working if:

- The key is **revoked**
- **Developer mode** is disabled on the user (keys are not auto-deleted; re-enable dev mode to restore access)
- The secret is wrong

There is **no expiration**. User keys grant the same API access as your account (personal + all teams). **Team keys** (`znltv_…`) are limited to one team and only the permissions chosen at creation.

### Team API keys

- Created by team **owner/admin** with **developer mode** enabled (Profile + Team settings).
- Prefix `znltv_`; bound to one team; customizable permissions (`drive.read`, `drive.write`, `invites.manage`, etc.).
- Cannot access personal drive, other teams, or create new teams.
- Managed at `GET/POST /api/teams/[teamId]/api-keys` (cookie session only).

### Storage and verification

- Only a hashed prefix + last4 are stored server-side.
- `lastUsedAt` is updated on each successful authentication.

## Auth matrix by route group

| Route group | Cookie | API key | Notes |
| ----------- | ------ | ------- | ----- |
| `/api/drive/**` | Yes | Yes | Full drive surface |
| `/api/teams/**` | Yes | Yes | List, create, invites |
| `/api/developer/**` | Yes | **No** | Mode toggle, key CRUD |
| `/api/auth/**` | Varies | **No** | Login/signup only |
| `/api/public/**` | N/A | N/A | Token in path; no user auth |
| `/api/cron/**` | N/A | N/A | `CRON_SECRET` bearer |

## Developer admin (cookie only)

These use `requireCookieApiSession` — API keys are **rejected** (401):

| Method | Path | Purpose |
| ------ | ---- | ------- |
| `GET` | `/api/developer/mode` | Read `{ enabled: boolean }` |
| `POST` | `/api/developer/mode` | Set `{ "enabled": boolean }` |
| `GET` | `/api/developer/api-keys` | List masked keys; `{ developerModeRequired: true }` if dev mode off |
| `POST` | `/api/developer/api-keys` | Create key; body `{ "name": string }` |
| `DELETE` | `/api/developer/api-keys/[id]` | Revoke key |

`POST` and `DELETE` on api-keys return **403** if developer mode is off.

## Authorization after authentication

Authentication identifies **who** you are. Authorization enforces **what** you can do:

- **Personal files:** `owner_id` must match your user id; `team_id` must be null.
- **Team files:** you must be a member of the file’s team (`teamId` query or file row).
- **Shared with you:** recipient email must have share access (download/list shared).
- **Mutations:** pin, rename, trash, delete require ownership or team membership per `drive-file-access`.

API keys do not bypass these rules.

## Security practices

- Store keys in environment variables or a secrets manager, never in source control.
- Use one key per integration; revoke unused keys.
- Prefer HTTPS in production so keys are not sent in cleartext.
- Disabling developer mode immediately invalidates key auth without deleting key records.

## Public and cron

- **`/api/public/share/[token]`** and **`/api/public/files/[token]`** — no user session; validity depends on the public link token.
- **`POST /api/cron/purge-trash`** — `Authorization: Bearer <CRON_SECRET>`; server ops only.

## Related

- [Getting started](./getting-started) — create your first key
- [Conventions](./conventions) — headers and IDs
- [REST API reference](./rest-api) — full endpoint index
- [Errors](./errors) — 401, 403, 503
