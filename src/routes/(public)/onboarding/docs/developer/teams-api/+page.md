# Teams API

All `/api/teams/**` endpoints accept **cookie session or developer API key**.

Team drives use a fixed `storageProvider` set at creation (`local` or `tigris`). Pass `teamId` on [Drive API](./drive-api) calls to work inside a team’s file tree.

---

## `GET /api/teams`

List teams the authenticated user belongs to.

**Response** `200`

```json
{
  "teams": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Engineering",
      "slug": "engineering"
    }
  ]
}
```

Ordered by team creation date (newest first).

**Example**

```bash
curl '{ORIGIN}/api/teams' \
  -H 'Authorization: Bearer <API_KEY>'
```

---

## `POST /api/teams`

Create a team with a root folder and optional member invites.

**Body** `application/json`

```json
{
  "name": "Engineering",
  "storageProvider": "local",
  "inviteEmails": ["alice@example.com", "bob@example.com"]
}
```

| Field | Required | Description |
| ----- | -------- | ----------- |
| `name` | Yes | 1–200 characters |
| `storageProvider` | No | `local` (default) or `tigris` |
| `inviteEmails` | No | Up to 50 email strings |

**Response** `200`

```json
{
  "ok": true,
  "teamId": "uuid",
  "name": "Engineering",
  "slug": "engineering",
  "rootFolderId": "uuid",
  "addedMembers": 1,
  "pendingInvites": 1
}
```

- `addedMembers` — existing users added immediately.
- `pendingInvites` — invites sent to unknown emails.

**Errors:** `400` validation; `502` Tigris configuration failure; `500` other failures.

**Example**

```bash
curl -X POST '{ORIGIN}/api/teams' \
  -H 'Authorization: Bearer <API_KEY>' \
  -H 'Content-Type: application/json' \
  -d '{"name":"My Team","storageProvider":"local","inviteEmails":[]}'
```

---

## `POST /api/teams/[teamId]/invites`

Invite additional members to an existing team. Caller must already be a team member.

**Path:** `teamId` — team UUID

**Body** `application/json`

```json
{
  "inviteEmails": ["newuser@example.com"]
}
```

Up to 50 emails per request.

**Response** `200`

```json
{
  "ok": true,
  "addedMembers": 0,
  "pendingInvites": 1
}
```

**Errors:** `400` missing team id or invalid JSON; `403` not a member; `404` team not found; `500` invite failure.

**Example**

```bash
curl -X POST '{ORIGIN}/api/teams/<TEAM_UUID>/invites' \
  -H 'Authorization: Bearer <API_KEY>' \
  -H 'Content-Type: application/json' \
  -d '{"inviteEmails":["colleague@example.com"]}'
```

---

## Using teams with the Drive API

After creating or listing a team, use its `id` as `teamId`:

```bash
# List team root
curl '{ORIGIN}/api/drive/files?teamId=<TEAM_UUID>&storageProvider=local' \
  -H 'Authorization: Bearer <API_KEY>'

# Upload into team
curl -X POST '{ORIGIN}/api/drive/upload?fileName=doc.pdf&teamId=<TEAM_UUID>&storageProvider=local' \
  -H 'Authorization: Bearer <API_KEY>' \
  -H 'Content-Type: application/octet-stream' \
  --data-binary @doc.pdf

# Team trash / recent / stats
curl '{ORIGIN}/api/drive/trash?teamId=<TEAM_UUID>' -H 'Authorization: Bearer <API_KEY>'
curl '{ORIGIN}/api/drive/recent?teamId=<TEAM_UUID>' -H 'Authorization: Bearer <API_KEY>'
curl '{ORIGIN}/api/drive/stats?teamId=<TEAM_UUID>' -H 'Authorization: Bearer <API_KEY>'

# Team outbound shares
curl '{ORIGIN}/api/drive/shared?teamId=<TEAM_UUID>' -H 'Authorization: Bearer <API_KEY>'
```

The web UI uses `slug` in URLs (`/home/team/engineering`); the API uses **UUID** `teamId`.

---

## Related

- [Drive API](./drive-api)
- [Workflows](./workflows#team-drive)
- [Conventions](./conventions)
- [REST API reference](./rest-api)
