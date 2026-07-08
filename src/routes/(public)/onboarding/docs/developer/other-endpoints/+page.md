# Other endpoints

Auth, developer admin, public token routes, and cron — endpoints outside the main drive/teams surface.

---

<h2 id="auth">Auth</h2>

Session establishment for browsers and interactive clients. **Not** used with developer API keys.

| Method | Path | Description |
| ------ | ---- | ----------- |
| `POST` | `/api/auth/login` | Email/password login; sets session cookie |
| `POST` | `/api/auth/logout` | End session |
| `POST` | `/api/auth/signup` | Registration flow |
| `POST` | `/api/auth/signup/send-otp` | Send OTP during signup |
| `POST` | `/api/auth/signup/verify-otp` | Verify OTP |
| `POST` / `GET` | `/api/auth/social` | OAuth start/callback helpers |

### `POST /api/auth/login`

**Body:** JSON `{ "email": string, "password": string }` or `application/x-www-form-urlencoded`.

**Response**

- `Accept: application/json` → `200` `{ "success": true }` + `Set-Cookie`
- Otherwise → `303` redirect to `/home`

**Errors:** `400` invalid body; `401` invalid credentials.

For automation, use [developer API keys](./authentication) instead of scripting login.

---

<h2 id="developer-admin">Developer admin</h2>

Cookie session **required**. API keys return **401**.

### `GET /api/developer/mode`

```json
{
  "enabled": true,
  "limits": {
    "teams": null,
    "folders": 500,
    "files": 5000,
    "apiKeys": 5
  }
}
```

`limits` values are `null` when unlimited (`DEVELOPER_API_MAX_*` unset or `0`).

### `POST /api/developer/mode`

**Body:** `{ "enabled": boolean }`

**Response:** `{ "ok": true, "enabled": boolean }`

### `GET /api/developer/api-keys`

When dev mode is off:

```json
{ "keys": [], "developerModeRequired": true }
```

When on:

```json
{
  "keys": [
    {
      "id": "uuid",
      "name": "CI",
      "masked": "znldv_AbCdEfGhIjKl…3456",
      "createdAt": "2026-07-01T00:00:00.000Z",
      "lastUsedAt": "2026-07-06T12:00:00.000Z",
      "isRevoked": false
    }
  ]
}
```

### `POST /api/developer/api-keys`

Requires dev mode. **Body:**

```json
{
  "name": "CI backup",
  "limits": { "teams": 2, "folders": 50, "files": 1000 }
}
```

`limits` is optional; omit a field or set `null` for no per-key cap on that resource.

**Response:** `{ "ok": true, "id", "name", "key", "masked", "limits", "warning" }` — see [Getting started](./getting-started).

### `PATCH /api/developer/api-keys/[id]`

Update per-key quotas. **Body:** `{ "limits": { "teams": number | null, "folders": number | null, "files": number | null } }`

**Response:** `{ "ok": true, "limits": { … } }`

### `DELETE /api/developer/api-keys/[id]`

Revokes the key. **Response:** `{ "ok": true }` (or 404 if not found).

---

<h2 id="public">Public</h2>

No authentication. Access is gated by the **link token** in the URL.

### `GET /api/public/share/[token]`

Metadata for the public preview page.

**Response** `200`

```json
{
  "ok": true,
  "token": "o3891y8qhw9",
  "item": {
    "id": "uuid",
    "ownerId": "uuid",
    "itemType": "file",
    "name": "report.pdf",
    "mimeType": "application/pdf",
    "sizeBytes": 1024,
    "updatedAt": "…",
    "storageProvider": "local"
  }
}
```

**Errors:** `404` invalid, revoked, expired, or trashed.

Human preview URL: `{ORIGIN}/<token>`

### `GET /api/public/files/[token]`

Stream file bytes or folder ZIP (same as authenticated download, but token-based).

**Response:** binary with appropriate `Content-Type` and `Content-Disposition`.

Create links via [Drive API](./drive-api). See also the [user public links guide](../user/public-links).

---

<h2 id="cron">Cron</h2>

### `POST /api/cron/purge-trash`

Scheduled job to permanently delete trash past retention. **Not** a user API.

**Auth:** `Authorization: Bearer <CRON_SECRET>` (exact match; env `CRON_SECRET` must be set).

**Response** `200`

```json
{
  "purged": 3,
  "skipped": 0
}
```

**Errors:** `401` wrong secret; `503` if `CRON_SECRET` not configured.

**Example**

```bash
curl -X POST '{ORIGIN}/api/cron/purge-trash' \
  -H "Authorization: Bearer $CRON_SECRET"
```

---

## Related

- [Authentication](./authentication)
- [Getting started](./getting-started)
- [REST API reference](./rest-api)
