# REST API reference

Quick-scan catalog of handlers under `src/routes/api`. For request/response schemas, see the detail pages linked in the **Detail** column.

**Auth legend:** `Cookie or key` = `requireApiSession`; `Cookie only` = browser session required; `None` = no user auth; `CRON_SECRET` = ops bearer.

## Auth

| Method | Path | Auth | Content-Type | Detail |
| ------ | ---- | ---- | ------------ | ------ |
| `POST` | `/api/auth/login` | None | JSON | [Other endpoints](./other-endpoints#auth) |
| `POST` | `/api/auth/logout` | Session | — | [Other endpoints](./other-endpoints#auth) |
| `POST` | `/api/auth/signup` | Varies | JSON | [Other endpoints](./other-endpoints#auth) |
| `POST` | `/api/auth/signup/send-otp` | Varies | JSON | [Other endpoints](./other-endpoints#auth) |
| `POST` | `/api/auth/signup/verify-otp` | Varies | JSON | [Other endpoints](./other-endpoints#auth) |
| `POST` | `/api/auth/social` | Varies | JSON | [Other endpoints](./other-endpoints#auth) |
| `GET` | `/api/auth/social` | Varies | — | [Other endpoints](./other-endpoints#auth) |

## Teams

| Method | Path | Auth | Content-Type | Detail |
| ------ | ---- | ---- | ------------ | ------ |
| `GET` | `/api/teams` | Cookie or key | — | [Teams API](./teams-api#get-apiteams) |
| `POST` | `/api/teams` | Cookie or key | JSON | [Teams API](./teams-api#post-apiteams) |
| `POST` | `/api/teams/[teamId]/invites` | Cookie or key | JSON | [Teams API](./teams-api#post-apiteamsteamidinvites) |

## Drive — browse and mutate

| Method | Path | Auth | Content-Type | Detail |
| ------ | ---- | ---- | ------------ | ------ |
| `GET` | `/api/drive/files` | Cookie or key | — | [Drive API](./drive-api#get-apidrivefiles) |
| `POST` | `/api/drive/folders` | Cookie or key | JSON | [Drive API](./drive-api#post-apidrivefolders) |
| `PATCH` | `/api/drive/files/[id]` | Cookie or key | JSON | [Drive API](./drive-api#patch-apidrivefilesid) |
| `DELETE` | `/api/drive/files/[id]` | Cookie or key | — | [Drive API](./drive-api#delete-apidrivefilesid) |
| `POST` | `/api/drive/files/reorder` | Cookie or key | JSON | [Drive API](./drive-api#post-apidrivefilesreorder) |
| `GET` | `/api/drive/files/[id]/download` | Cookie or key | — | [Drive API](./drive-api#get-apidrivefilesiddownload) |
| `GET` | `/api/drive/files/[id]/public-link` | Cookie or key | — | [Drive API](./drive-api#public-link) |
| `POST` | `/api/drive/files/[id]/public-link` | Cookie or key | — | [Drive API](./drive-api#public-link) |
| `DELETE` | `/api/drive/files/[id]/public-link` | Cookie or key | — | [Drive API](./drive-api#public-link) |
| `POST` | `/api/drive/files/[id]/share` | Cookie or key | JSON | [Drive API](./drive-api#post-apidrivefilesidshare) |

## Drive — views and upload

| Method | Path | Auth | Content-Type | Detail |
| ------ | ---- | ---- | ------------ | ------ |
| `GET` | `/api/drive/shared` | Cookie or key | — | [Drive API](./drive-api#get-apidriveshared) |
| `GET` | `/api/drive/trash` | Cookie or key | — | [Drive API](./drive-api#get-apidrivetrash) |
| `GET` | `/api/drive/recent` | Cookie or key | — | [Drive API](./drive-api#get-apidriverecent) |
| `GET` | `/api/drive/stats` | Cookie or key | — | [Drive API](./drive-api#get-apidrivestats) |
| `POST` | `/api/drive/upload` | Cookie or key | `application/octet-stream` | [Drive API](./drive-api#post-apidriveupload) |
| `POST` | `/api/drive/upload/chunk` | Cookie or key | `application/octet-stream` | [Drive API](./drive-api#post-apidriveuploadchunk) |

## Developer admin

| Method | Path | Auth | Content-Type | Detail |
| ------ | ---- | ---- | ------------ | ------ |
| `GET` | `/api/developer/mode` | Cookie only | — | [Other endpoints](./other-endpoints#developer-admin) |
| `POST` | `/api/developer/mode` | Cookie only | JSON | [Other endpoints](./other-endpoints#developer-admin) |
| `GET` | `/api/developer/api-keys` | Cookie only | — | [Other endpoints](./other-endpoints#developer-admin) |
| `POST` | `/api/developer/api-keys` | Cookie only + dev mode | JSON | [Other endpoints](./other-endpoints#developer-admin) |
| `DELETE` | `/api/developer/api-keys/[id]` | Cookie only + dev mode | — | [Other endpoints](./other-endpoints#developer-admin) |

## Public and cron

| Method | Path | Auth | Content-Type | Detail |
| ------ | ---- | ---- | ------------ | ------ |
| `GET` | `/api/public/share/[token]` | None | — | [Other endpoints](./other-endpoints#public) |
| `GET` | `/api/public/files/[token]` | None | — | [Other endpoints](./other-endpoints#public) |
| `POST` | `/api/cron/purge-trash` | `CRON_SECRET` | — | [Other endpoints](./other-endpoints#cron) |

## Share URL shape

The human-facing preview lives at `{ORIGIN}/<token>` (site root). Direct download uses `{ORIGIN}/api/public/files/<token>`.

## Related

- [Getting started](./getting-started)
- [Authentication](./authentication)
- [Drive API](./drive-api)
- [Teams API](./teams-api)
- [Workflows](./workflows)
- [Errors](./errors)
