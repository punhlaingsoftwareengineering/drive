# Getting started

This guide walks through API setup from zero to a working authenticated request. All drive and teams features exposed in the web UI are available to **developer API keys**.

## Prerequisites

- A running drive instance (local dev default: `http://localhost:1025`)
- A user account with access to the drive
- `curl` or any HTTP client

Replace `{ORIGIN}` below with your deployment base URL (no trailing slash).

## Step 1 — Enable developer mode

Developer mode must be on for API keys to authenticate.

**In the UI (recommended):**

1. Sign in and open your **Profile** menu (top bar).
2. Open the **Developer** section.
3. Turn on **Developer mode**.

**Via API (browser session only):**

```bash
curl -X POST '{ORIGIN}/api/developer/mode' \
  -H 'Content-Type: application/json' \
  -H 'Cookie: <your-session-cookie>' \
  -d '{"enabled": true}'
```

Key management and developer mode toggles require a **cookie session** — they cannot be done with an API key alone. See [Authentication](./authentication).

## Step 2 — Create an API key

Still in Profile → Developer, enter an app name (for example `CI backup`) and click **Generate key**. Copy the secret immediately — it is shown **once**.

Or via API with your session cookie:

```bash
curl -X POST '{ORIGIN}/api/developer/api-keys' \
  -H 'Content-Type: application/json' \
  -H 'Cookie: <your-session-cookie>' \
  -d '{"name": "My integration"}'
```

Example response:

```json
{
  "ok": true,
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "My integration",
  "key": "znldv_AbCdEfGhIjKl_mnopqrstuvwxyz123456",
  "masked": "znldv_AbCdEfGhIjKl…3456",
  "warning": "Copy this key now. You will not see it again."
}
```

Store `key` in a secrets manager. Keys use the format `znldv_<12-char-prefix>_<secret>`.

## Step 3 — Authenticate requests

Send the raw secret on every API call using either header:

```bash
-H 'Authorization: Bearer znldv_AbCdEfGhIjKl_mnopqrstuvwxyz123456'
```

or

```bash
-H 'X-API-Key: znldv_AbCdEfGhIjKl_mnopqrstuvwxyz123456'
```

Only Bearer tokens starting with `znldv_` are treated as API keys (other Bearer values are ignored for key resolution).

## Step 4 — Smoke test

List your teams:

```bash
curl '{ORIGIN}/api/teams' \
  -H 'Authorization: Bearer <YOUR_API_KEY>'
```

List files in your personal drive root (`local` storage):

```bash
curl '{ORIGIN}/api/drive/files?storageProvider=local' \
  -H 'Authorization: Bearer <YOUR_API_KEY>'
```

Example response shape:

```json
{
  "files": [
    {
      "id": "…",
      "name": "Documents",
      "itemType": "folder",
      "sizeBytes": 1048576,
      "updatedAt": "2026-07-01T12:00:00.000Z",
      "storageProvider": "local",
      "isPinned": false,
      "isStarred": false,
      "color": null,
      "parentId": null,
      "sortOrder": 0,
      "ownerName": "you@example.com"
    }
  ]
}
```

## What API keys can access

| Area | API key? |
| ---- | -------- |
| `/api/drive/**` (files, upload, trash, stats, share, …) | Yes |
| `/api/teams/**` | Yes |
| `/api/developer/**` (mode, key CRUD) | No — cookie session only |
| `/api/auth/**` (login, signup) | No — establishes sessions, not for key automation |
| `/api/public/**` | No auth required (token in URL) |
| `/api/cron/**` | `CRON_SECRET` bearer, not user keys |

An API key impersonates your user account: same ownership, team membership, and shared-item access as the web app. There are **no per-key scopes** today — one key grants full user API access while developer mode stays enabled.

## Next steps

- [Authentication](./authentication) — security model and auth matrix
- [Conventions](./conventions) — `storageProvider`, `teamId`, UUIDs, dates
- [Drive API](./drive-api) — full endpoint contracts
- [Workflows](./workflows) — upload, team drive, sharing recipes
