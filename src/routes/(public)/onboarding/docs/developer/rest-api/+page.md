# REST API reference

This table reflects handlers under `src/routes/api` as of the current codebase. **Auth** summarizes how the route authenticates the caller.

| Method   | Path                                | Auth                   | Description                                                         |
| -------- | ----------------------------------- | ---------------------- | ------------------------------------------------------------------- |
| `POST`   | `/api/auth/login`                   | None                   | Email/password login; sets session.                                 |
| `POST`   | `/api/auth/logout`                  | Session                | End session.                                                        |
| `POST`   | `/api/auth/signup`                  | Varies                 | Sign-up flow.                                                       |
| `POST`   | `/api/auth/signup/send-otp`         | Varies                 | Send OTP.                                                           |
| `POST`   | `/api/auth/signup/verify-otp`       | Varies                 | Verify OTP.                                                         |
| `POST`   | `/api/auth/social`                  | Varies                 | Social auth start/callback helper.                                  |
| `GET`    | `/api/auth/social`                  | Varies                 | Social auth redirect handling.                                      |
| `GET`    | `/api/teams`                        | Cookie or API key      | List teams the current user belongs to.                            |
| `POST`   | `/api/teams`                        | Cookie or API key      | Create a team (name, optional `storageProvider`, `inviteEmails`).  |
| `GET`    | `/api/drive/files`                  | Cookie or API key      | List files/folders; query `storageProvider`, `parentId` / `folder`, `teamId`. |
| `POST`   | `/api/drive/folders`                | Cookie or API key      | Create folder (JSON body).                                          |
| `PATCH`  | `/api/drive/files/[id]`             | Cookie or API key      | Update pin, star, name, color, trash flag.                          |
| `DELETE` | `/api/drive/files/[id]`             | Cookie or API key      | Permanently delete an item that is **already in trash**.            |
| `GET`    | `/api/drive/files/[id]/download`    | Cookie or API key      | Download file or folder archive.                                    |
| `GET`    | `/api/drive/files/[id]/public-link` | Cookie or API key      | Get or check public link metadata for a file.                       |
| `POST`   | `/api/drive/files/[id]/public-link` | Cookie or API key      | Create (or refresh) public link.                                    |
| `DELETE` | `/api/drive/files/[id]/public-link` | Cookie or API key      | Revoke public link.                                                 |
| `POST`   | `/api/drive/files/[id]/share`       | Cookie or API key      | Share file with another user.                                       |
| `GET`    | `/api/drive/shared`                 | Cookie or API key      | List shared-with-me content.                                        |
| `GET`    | `/api/drive/trash`                  | Cookie or API key      | List trashed items.                                                 |
| `GET`    | `/api/drive/stats`                  | Cookie or API key      | Storage / usage stats.                                              |
| `POST`   | `/api/drive/upload`                 | Cookie or API key      | Upload file (binary `application/octet-stream`, metadata in query). |
| `POST`   | `/api/drive/upload/chunk`           | Cookie or API key      | Chunked binary upload part (metadata in query).                         |
| `GET`    | `/api/developer/mode`               | Cookie only            | Read developer mode enabled flag.                                   |
| `POST`   | `/api/developer/mode`               | Cookie only            | Set developer mode `{ "enabled": boolean }`.                        |
| `GET`    | `/api/developer/api-keys`           | Cookie only            | List keys (masked `znldv_…`); `developerModeRequired` if off.       |
| `POST`   | `/api/developer/api-keys`           | Cookie only + dev mode | Create key; body `{ "name": string }`.                              |
| `DELETE` | `/api/developer/api-keys/[id]`      | Cookie only + dev mode | Revoke key.                                                         |
| `GET`    | `/api/public/share/[token]`         | None                   | Public metadata JSON for share preview page.                        |
| `GET`    | `/api/public/files/[token]`         | None                   | Stream file or folder ZIP for valid token.                          |
| `POST`   | `/api/cron/purge-trash`             | `Bearer CRON_SECRET`   | Purge expired trash (scheduled job).                                |

## Share URL shape

The human-facing preview lives at `/<token>` (root of the site). Direct download uses `/api/public/files/<token>`.

## Related

- [Authentication](./authentication) — Bearer, `X-API-Key`, and cookie-only routes.
- [Errors](./errors) — status codes you should handle.
