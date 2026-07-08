# REST API reference

Quick-scan catalog of handlers under `src/routes/api`. For request/response schemas, see the detail pages linked in the **Detail** column.

**Auth legend:** `Cookie or key` = `requireApiSession`; `Cookie only` = browser session required; `None` = no user auth; `CRON_SECRET` = ops bearer.

## Auth

| Method | Path | Auth | Content-Type | Detail |
| ------ | ---- | ---- | ------------ | ------ |
| `POST` | `/api/auth/login` | None | JSON | [Other endpoints](./other-endpoints) |
| `POST` | `/api/auth/logout` | Session | — | [Other endpoints](./other-endpoints) |
| `POST` | `/api/auth/signup` | Varies | JSON | [Other endpoints](./other-endpoints) |
| `POST` | `/api/auth/signup/send-otp` | Varies | JSON | [Other endpoints](./other-endpoints) |
| `POST` | `/api/auth/signup/verify-otp` | Varies | JSON | [Other endpoints](./other-endpoints) |
| `POST` | `/api/auth/social` | Varies | JSON | [Other endpoints](./other-endpoints) |
| `GET` | `/api/auth/social` | Varies | — | [Other endpoints](./other-endpoints) |

## Teams

| Method | Path | Auth | Content-Type | Detail |
| ------ | ---- | ---- | ------------ | ------ |
| `GET` | `/api/teams` | Cookie or key | — | [Teams API](./teams-api) |
| `POST` | `/api/teams` | Cookie or key | JSON | [Teams API](./teams-api) |
| `POST` | `/api/teams/[teamId]/invites` | Cookie or key | JSON | [Teams API](./teams-api) |

## Drive — browse and mutate

| Method | Path | Auth | Content-Type | Detail |
| ------ | ---- | ---- | ------------ | ------ |
| `GET` | `/api/drive/files` | Cookie or key | — | [Drive API](./drive-api) |
| `POST` | `/api/drive/folders` | Cookie or key | JSON | [Drive API](./drive-api) |
| `PATCH` | `/api/drive/files/[id]` | Cookie or key | JSON | [Drive API](./drive-api) |
| `DELETE` | `/api/drive/files/[id]` | Cookie or key | — | [Drive API](./drive-api) |
| `POST` | `/api/drive/files/reorder` | Cookie or key | JSON | [Drive API](./drive-api) |
| `GET` | `/api/drive/files/[id]/download` | Cookie or key | — | [Drive API](./drive-api) |
| `GET` | `/api/drive/files/[id]/public-link` | Cookie or key | — | [Drive API](./drive-api) |
| `POST` | `/api/drive/files/[id]/public-link` | Cookie or key | — | [Drive API](./drive-api) |
| `DELETE` | `/api/drive/files/[id]/public-link` | Cookie or key | — | [Drive API](./drive-api) |
| `POST` | `/api/drive/files/[id]/share` | Cookie or key | JSON | [Drive API](./drive-api) |

## Drive — views and upload

| Method | Path | Auth | Content-Type | Detail |
| ------ | ---- | ---- | ------------ | ------ |
| `GET` | `/api/drive/shared` | Cookie or key | — | [Drive API](./drive-api) |
| `GET` | `/api/drive/trash` | Cookie or key | — | [Drive API](./drive-api) |
| `GET` | `/api/drive/recent` | Cookie or key | — | [Drive API](./drive-api) |
| `GET` | `/api/drive/stats` | Cookie or key | — | [Drive API](./drive-api) |
| `POST` | `/api/drive/upload` | Cookie or key | `application/octet-stream` | [Drive API](./drive-api) |
| `POST` | `/api/drive/upload/chunk` | Cookie or key | `application/octet-stream` | [Drive API](./drive-api) |

## Developer admin

| Method | Path | Auth | Content-Type | Detail |
| ------ | ---- | ---- | ------------ | ------ |
| `GET` | `/api/developer/mode` | Cookie only | — | [Other endpoints](./other-endpoints) |
| `POST` | `/api/developer/mode` | Cookie only | JSON | [Other endpoints](./other-endpoints) |
| `GET` | `/api/developer/api-keys` | Cookie only | — | [Other endpoints](./other-endpoints) |
| `POST` | `/api/developer/api-keys` | Cookie only + dev mode | JSON | [Other endpoints](./other-endpoints) |
| `DELETE` | `/api/developer/api-keys/[id]` | Cookie only + dev mode | — | [Other endpoints](./other-endpoints) |

## Public and cron

| Method | Path | Auth | Content-Type | Detail |
| ------ | ---- | ---- | ------------ | ------ |
| `GET` | `/api/public/share/[token]` | None | — | [Other endpoints](./other-endpoints) |
| `GET` | `/api/public/files/[token]` | None | — | [Other endpoints](./other-endpoints) |
| `POST` | `/api/cron/purge-trash` | `CRON_SECRET` | — | [Other endpoints](./other-endpoints) |

## Share URL shape

The human-facing preview lives at `{ORIGIN}/<token>` (site root). Direct download uses `{ORIGIN}/api/public/files/<token>`.

## Related

- [Getting started](./getting-started)
- [Authentication](./authentication)
- [Drive API](./drive-api)
- [Teams API](./teams-api)
- [Workflows](./workflows)
- [Errors](./errors)
