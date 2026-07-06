# Drive API

Detailed reference for `/api/drive/**`. All endpoints accept **cookie session or developer API key** unless noted.

Common query params:

| Param | Type | Description |
| ----- | ---- | ----------- |
| `storageProvider` | `local` \| `tigris` | Default `local`. For team scope, must match team’s provider. |
| `teamId` | UUID | Optional. Scope to a team drive; requires membership. |

---

## `GET /api/drive/files`

List files and folders in a parent directory.

**Query**

| Param | Required | Description |
| ----- | -------- | ----------- |
| `storageProvider` | No | Default `local` |
| `parentId` or `folder` | No | Parent folder UUID; omit for drive root |
| `teamId` | No | Team UUID; lists under team root when parent omitted |

**Response** `200`

```json
{
  "files": [
    {
      "id": "uuid",
      "name": "report.pdf",
      "itemType": "file",
      "sizeBytes": 1024,
      "updatedAt": "2026-07-01T12:00:00.000Z",
      "storageProvider": "local",
      "isPinned": false,
      "isStarred": false,
      "color": null,
      "parentId": "uuid-or-null",
      "sortOrder": 0,
      "ownerName": "Jane Doe"
    }
  ]
}
```

Folder `sizeBytes` is the sum of file bytes in the subtree. Sorted by `sortOrder`, then name.

**Errors:** `400` invalid provider/folder/team id; `403` not a team member; `500` team root not configured.

**Example**

```bash
curl '{ORIGIN}/api/drive/files?storageProvider=local&teamId=<TEAM_UUID>' \
  -H 'Authorization: Bearer <API_KEY>'
```

---

## `POST /api/drive/folders`

Create a folder.

**Body** `application/json`

```json
{
  "name": "Projects",
  "storageProvider": "local",
  "parentId": "optional-parent-uuid",
  "teamId": "optional-team-uuid"
}
```

**Response** `200`

```json
{ "ok": true, "id": "new-folder-uuid", "name": "Projects" }
```

**Errors:** `400` validation; `403` team forbidden; `502` Tigris failure.

---

## `PATCH /api/drive/files/[id]`

Update metadata or trash state. At least one field required.

**Body** `application/json` (all optional, strict — no extra keys)

| Field | Type | Description |
| ----- | ---- | ----------- |
| `isPinned` | boolean | Pin / unpin |
| `isStarred` | boolean | Star / unstar |
| `name` | string | 1–500 chars; `/` and `\` replaced |
| `color` | string \| null | Label color; see [Conventions](./conventions) |
| `trashed` | boolean | `true` moves to trash; `false` restores |

**Response** `200`

```json
{ "ok": true }
```

**Errors:** `404` not found or no access; `400` empty body or invalid JSON.

---

## `DELETE /api/drive/files/[id]`

Permanently delete an item **already in trash**.

**Response** `200`

```json
{ "ok": true }
```

**Errors:** `400` if not in trash; `404` not found; `500` delete failure.

---

## `POST /api/drive/files/reorder`

Set display order of siblings in one folder.

**Body** `application/json`

```json
{
  "orderedIds": ["uuid-1", "uuid-2", "uuid-3"],
  "parentId": "parent-uuid-or-null",
  "teamId": "optional-team-uuid",
  "storageProvider": "local"
}
```

`orderedIds` must be unique, same parent, and owned by you (or same team). `sortOrder` is set to `0..n-1` in array order.

**Response** `200`

```json
{ "ok": true }
```

---

## `GET /api/drive/files/[id]/download`

Download a file or folder ZIP.

**Response** `200` — binary body

| Item type | Content-Type | Disposition |
| --------- | ------------ | ----------- |
| File | MIME from file | `attachment` with filename |
| Folder | `application/zip` | `<name>.zip` |

Accessible if you own the file, are on the team, or have share access.

**Errors:** `403` forbidden; `404` not found; `502` read failure.

**Example**

```bash
curl -o report.pdf '{ORIGIN}/api/drive/files/<ID>/download' \
  -H 'Authorization: Bearer <API_KEY>'
```

---

## Public link {#public-link}

### `GET /api/drive/files/[id]/public-link`

**Response** when no active link:

```json
{ "public": false }
```

**Response** when public:

```json
{
  "public": true,
  "token": "o3891y8qhw9",
  "shareUrl": "https://example.com/o3891y8qhw9",
  "fileDirectUrl": "https://example.com/api/public/files/o3891y8qhw9"
}
```

`fileDirectUrl` is omitted for folders.

### `POST /api/drive/files/[id]/public-link`

Create or return existing public link.

**Response** `200`

```json
{
  "ok": true,
  "token": "…",
  "shareUrl": "…",
  "fileDirectUrl": "…"
}
```

### `DELETE /api/drive/files/[id]/public-link`

Revoke active public link.

**Response** `200`

```json
{ "ok": true }
```

---

## `POST /api/drive/files/[id]/share`

Share a file or folder with another user by email.

**Body** `application/json`

```json
{
  "targetEmail": "colleague@example.com",
  "permission": "read",
  "canReshare": false
}
```

| Field | Default | Values |
| ----- | ------- | ------ |
| `permission` | `read` | `read`, `write` |
| `canReshare` | `false` | boolean |

**Response** `200`

```json
{ "ok": true }
```

If already shared: `{ "ok": true, "alreadyShared": true }`.

---

## `GET /api/drive/shared`

**Personal (no `teamId`):** items **shared with you** (inbound).

**With `teamId`:** **outbound** shares from that team’s drive (files the team shared with others).

**Query:** `storageProvider`, optional `teamId`, optional `parentId`/`folder` for folder navigation inside shared trees.

**Response** `200`

```json
{
  "files": [
    {
      "id": "uuid",
      "name": "Shared doc",
      "itemType": "file",
      "sizeBytes": 2048,
      "updatedAt": "…",
      "storageProvider": "local",
      "isPinned": false,
      "isStarred": false,
      "color": null,
      "parentId": null,
      "ownerName": "Owner Name",
      "sharePermission": "read"
    }
  ]
}
```

---

## `GET /api/drive/trash`

List trashed items for personal or team scope.

**Query:** `storageProvider`, optional `teamId`.

**Response** `200`

```json
{
  "trashRetentionDays": 30,
  "files": [
    {
      "id": "uuid",
      "name": "old.txt",
      "itemType": "file",
      "sizeBytes": 100,
      "updatedAt": "…",
      "trashedAt": "…",
      "purgeAt": "…",
      "storageProvider": "local",
      "isPinned": false,
      "isStarred": false,
      "color": null,
      "parentId": null,
      "ownerName": "…"
    }
  ]
}
```

---

## `GET /api/drive/recent`

Recently touched files across own, shared, and team sources (or team-only when `teamId` set).

**Query:** `storageProvider`, optional `teamId`. Max **200** results.

**Response** `200`

```json
{
  "files": [
    {
      "id": "uuid",
      "name": "…",
      "itemType": "file",
      "sizeBytes": 0,
      "updatedAt": "…",
      "recencyAt": "…",
      "storageProvider": "local",
      "isPinned": false,
      "isStarred": false,
      "color": null,
      "parentId": null,
      "ownerName": "…",
      "source": "own",
      "teamId": null,
      "teamName": null,
      "teamSlug": null,
      "sharePermission": null
    }
  ]
}
```

`source` is `own`, `shared`, or `team`.

---

## `GET /api/drive/stats`

Dashboard statistics for personal or team drive.

**Query:** `storageProvider`, optional `teamId`.

**Response** `200`

```json
{
  "storageProvider": "local",
  "summary": {
    "files": 10,
    "folders": 3,
    "totalBytes": 1048576,
    "trashedFiles": 1,
    "trashedBytes": 1024,
    "activeShares": 2,
    "pinnedFiles": 1,
    "starredFiles": 4
  },
  "byCategory": [
    { "category": "Images", "files": 5, "bytes": 500000 }
  ],
  "activityByWeek": [
    { "weekStart": "2026-05-12", "fileCount": 2 }
  ]
}
```

---

## `POST /api/drive/upload`

Upload a **small file** (≤ 8 MiB). Body is raw bytes.

**Headers:** `Content-Type: application/octet-stream` (required)

**Query**

| Param | Required | Description |
| ----- | -------- | ----------- |
| `fileName` | Yes | Original filename |
| `storageProvider` | No | Default `local` |
| `parentId` | No | Parent folder UUID |
| `teamId` | No | Team UUID |
| `mimeType` | No | Inferred from filename if omitted |

**Response** `200`

```json
{
  "ok": true,
  "created": [
    {
      "id": "uuid",
      "name": "photo.png",
      "itemType": "file",
      "parentId": null,
      "storageProvider": "local"
    }
  ]
}
```

**Errors:** `415` wrong Content-Type; `400` empty body or missing `fileName`; size limit errors.

**Example**

```bash
curl -X POST '{ORIGIN}/api/drive/upload?fileName=hello.txt&storageProvider=local' \
  -H 'Authorization: Bearer <API_KEY>' \
  -H 'Content-Type: application/octet-stream' \
  --data-binary @hello.txt
```

---

## `POST /api/drive/upload/chunk`

Multipart upload for files **larger than 8 MiB**. Chunk size: **8 MiB** (8 × 1024 × 1024 bytes).

**Headers:** `Content-Type: application/octet-stream`

**Query**

| Param | Required | When |
| ----- | -------- | ---- |
| `chunkIndex` | Yes | 0-based index |
| `chunkCount` | Yes | Total chunks |
| `uploadId` | After chunk 0 | Returned from previous response |
| `fileName` | Chunk 0 only | Target filename |
| `storageProvider` | Chunk 0 only | Default `local` |
| `parentId` | Chunk 0 only | Optional |
| `teamId` | Chunk 0 only | Optional |
| `mimeType` | Chunk 0 only | Optional |

**Response** (more chunks needed) `200`

```json
{ "uploadId": "session-id", "done": false }
```

**Response** (final chunk) `200`

```json
{
  "ok": true,
  "done": true,
  "uploadId": "session-id",
  "created": [{ "id": "…", "name": "…", "itemType": "file", … }]
}
```

See [Workflows](./workflows#chunked-upload) for the full sequence.

---

## Related

- [Conventions](./conventions) — `teamId`, upload limits
- [Workflows](./workflows)
- [REST API reference](./rest-api)
- [Errors](./errors)
