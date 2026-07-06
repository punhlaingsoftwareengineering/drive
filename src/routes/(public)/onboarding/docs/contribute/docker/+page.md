# Docker deployment

Run ZNL-DRIVE in a container on a LAN server, cloud VM, or any host with Docker. The image uses **adapter-node** (Node.js) on port **1025** by default.

## Prerequisites

- **Docker Engine** or Docker Desktop
- A **Postgres** database reachable from the container (Neon, RDS, or a Postgres container on the same network)
- Secrets for auth and (optionally) OAuth, email, Tigris, and encryption

Push the database schema **before** or **after** first boot from a machine with the repo checked out (the runtime image does not include Drizzle CLI):

```bash
cp .env.example .env
# Set DATABASE_URL, then:
pnpm install
pnpm db:push
```

## Pull a pre-built image

When a release publishes a container image to GitHub Container Registry:

```bash
docker pull ghcr.io/punhlaingsoftwareengineering/drive:latest
```

Tag it locally if you prefer a short name:

```bash
docker tag ghcr.io/punhlaingsoftwareengineering/drive:latest znl-drive
```

If no release image is available yet, build from source (next section).

## Build from source

```bash
git clone https://github.com/punhlaingsoftwareengineering/drive.git
cd drive
docker build -t znl-drive .
```

The multi-stage `Dockerfile` builds the app, then ships a slim **Node 24 Alpine** runtime. Build-time placeholders are used for auth/DB so **secrets are not required during `docker build`**; you must still set runtime env vars when starting the container.

## Run with Docker Compose (recommended)

The repo includes `docker-compose.yml` with a **host bind mount** for local file storage (files on your real disk, not inside the container image).

1. Copy and edit env:

```bash
cp .env.example .env
```

2. Set at minimum in `.env`:

- `DATABASE_URL`
- `ORIGIN` — exact browser URL (e.g. `http://192.168.1.10:1025` or `https://drive.example.com`)
- `BETTER_AUTH_SECRET` — long random string
- `LOCAL_DRIVE_HOST_PATH` — folder on the **host** to store uploads (default `./data/znl-drive`)

3. Start:

```bash
docker compose up --build -d
```

Compose maps **1025:1025**, loads `.env` via `env_file`, and bind-mounts **`LOCAL_DRIVE_HOST_PATH`** on the host to `/data/znl-drive` in the container. Override paths in `.env`:

```bash
# Relative to the project directory (default)
LOCAL_DRIVE_HOST_PATH=./data/znl-drive

# Or an absolute path on the server disk
LOCAL_DRIVE_HOST_PATH=/mnt/storage/znl-drive
```

On Windows with Docker Desktop you can use a drive path, e.g. `D:/znl-drive-data`.

Open the URL you set in `ORIGIN`.

## Run with `docker run`

Minimal example (local **Local** storage with a **host directory** bind mount):

```bash
mkdir -p /mnt/storage/znl-drive
docker run -d --name znl-drive \
  -p 1025:1025 \
  -v /mnt/storage/znl-drive:/data/znl-drive \
  -e ORIGIN=http://YOUR_HOST:1025 \
  -e BETTER_AUTH_SECRET='your-long-random-secret' \
  -e DATABASE_URL='postgresql://user:pass@host:5432/db?sslmode=require' \
  znl-drive
```

Using an env file (all options in one place):

```bash
docker run -d --name znl-drive \
  -p 1025:1025 \
  -v /mnt/storage/znl-drive:/data/znl-drive \
  --env-file .env \
  znl-drive
```

### Port mapping

Change the host port while keeping the app on 1025 inside the container:

```bash
docker run -p 8080:1025 -e PORT=1025 -e ORIGIN=http://YOUR_HOST:8080 ...
```

`ORIGIN` must match what users type in the browser (including port).

### Volumes (host disk)

Use a **bind mount** so files are stored on the host filesystem, not in the container’s writable layer or an opaque Docker named volume.

| Host path (`LOCAL_DRIVE_HOST_PATH` or `-v` left side) | Container path | Purpose |
| ----------------------------------------------------- | -------------- | ------- |
| `./data/znl-drive` or `/mnt/storage/znl-drive` | `/data/znl-drive` | **Local** storage — user files, team folders, upload sessions |

`LOCAL_DRIVE_DATA_DIR` inside the container should stay `/data/znl-drive` (set in the image and compose). Only the **host** side of the mount is yours to choose.

Without a bind mount, local uploads are lost when the container is removed. **Tigris** objects live in your bucket; the mount is still used for chunked upload assembly under `.upload-sessions/` — allow enough disk for roughly **2× the largest file** during finalize.

## Environment variables

Set these via `-e`, `--env-file`, or Compose `environment` / `env_file`. See also [Environment and database](./env-and-db) for database workflows.

### Required at runtime (production)

| Variable | Description |
| -------- | ----------- |
| `DATABASE_URL` | Postgres connection string (Neon, self-hosted, etc.). |
| `ORIGIN` | Public site URL **without** trailing slash. Must match the browser URL exactly (scheme, host, port). |
| `BETTER_AUTH_SECRET` | Secret for sessions, OTP, and API key pepper. Use a strong random value in production. |

### Core server (optional / defaults)

| Variable | Default (image) | Description |
| -------- | --------------- | ----------- |
| `PUBLIC_APP_NAME` | `ZNL-DRIVE` | Display name in navbar, titles, and UI copy. |
| `PORT` | `1025` | Listen port inside the container. |
| `HOST` | `0.0.0.0` | Bind address (set in `Dockerfile`; usually leave as-is). |
| `BODY_SIZE_LIMIT` | `8M` | Max HTTP body per request (SvelteKit). Must be **≥ 8 MiB** upload chunk size. |
| `MAX_UPLOAD_BYTES` | `0` | Max single-file size in bytes; `0` = no app-level cap. |
| `LOCAL_DRIVE_DATA_DIR` | `/data/znl-drive` | Path **inside the container** for **Local** storage. Keep as `/data/znl-drive` when using the default mount. |
| `LOCAL_DRIVE_HOST_PATH` | `./data/znl-drive` | **Compose only:** host folder bind-mounted to `/data/znl-drive`. Set in `.env`. |

### Reverse proxy / HTTPS

Use when TLS terminates in front of the container (nginx, Caddy, Traefik, Fly.io edge).

| Variable | Example | Description |
| -------- | ------- | ----------- |
| `PROTOCOL_HEADER` | `x-forwarded-proto` | Header the proxy sets with the client scheme (`https`). |
| `HOST_HEADER` | `x-forwarded-host` | Header the proxy sets with the public host. |

Also set `ORIGIN=https://your-domain` (no port if 443).

**Do not** set `PROTOCOL_HEADER` / `HOST_HEADER` when users hit the container directly over plain HTTP (LAN IP:port). Doing so can cause CSRF errors (“Cross-site POST form submissions are forbidden”).

| Scenario | Required env |
| -------- | ------------ |
| Direct access (LAN / VM, no proxy) | `ORIGIN=http://YOUR_IP:1025` |
| TLS terminator / Fly.io | `ORIGIN=https://your-domain` + `PROTOCOL_HEADER` + `HOST_HEADER` |
| nginx / Caddy / Traefik | Same as TLS row; proxy must send `X-Forwarded-Proto` and `X-Forwarded-Host` |

### OAuth (optional)

| Variable | Description |
| -------- | ----------- |
| `GITHUB_CLIENT_ID` | GitHub OAuth app client ID. |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth app secret. |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID. |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret. |

Redirect URIs must use your public `ORIGIN` (e.g. `https://drive.example.com/api/auth/callback/github`).

### Email / signup OTP (optional)

Required for email OTP signup. Prefer explicit SMTP; Gmail app password is a fallback.

| Variable | Description |
| -------- | ----------- |
| `SMTP_HOST` | SMTP server hostname. |
| `SMTP_PORT` | SMTP port (`587` STARTTLS, `465` SSL). |
| `SMTP_USER` | SMTP username. |
| `SMTP_PASS` | SMTP password. |
| `SMTP_FROM` | From address (falls back to `GMAIL_USER`). |
| `GMAIL_USER` | Gmail address (used if `SMTP_*` unset). |
| `GMAIL_APP_PASSWORD` | Gmail app password (used if `SMTP_*` unset). |

### Tigris object storage (optional)

Required only when using the **Tigris** storage provider in the UI.

| Variable | Default | Description |
| -------- | ------- | ----------- |
| `TIGRIS_STORAGE_ACCESS_KEY_ID` | — | Tigris access key. Alias: `TIGRIS_ACCESS_KEY`. |
| `TIGRIS_STORAGE_SECRET_ACCESS_KEY` | — | Tigris secret key. Alias: `TIGRIS_SECRET_KEY`. |
| `TIGRIS_STORAGE_BUCKET` | — | Bucket name. Alias: `TIGRIS_BUCKET`. |
| `TIGRIS_STORAGE_ENDPOINT` | `https://t3.storage.dev` | S3-compatible API endpoint. |
| `TIGRIS_STORAGE_IAM_ENDPOINT` | `https://iam.storage.dev` | IAM endpoint (Tigris SDK / tooling). |
| `TIGRIS_STORAGE_REGION` | `auto` | Region identifier for the SDK. |

### Encryption and jobs (optional)

| Variable | Description |
| -------- | ----------- |
| `FILE_ENCRYPTION_KEY` | At-rest file encryption key (recommended in production). |
| `DRIVE_ENCRYPTION_KEY` | Alias for `FILE_ENCRYPTION_KEY`. |
| `CRON_SECRET` | Bearer token for `POST /api/cron/purge-trash` (scheduled trash purge). |

If encryption keys are unset, the app falls back to `BETTER_AUTH_SECRET` for file sealing.

## Example: full `.env` for Docker

```bash
# Required
DATABASE_URL=postgresql://user:pass@db.example.com:5432/drive?sslmode=require
ORIGIN=https://drive.example.com
BETTER_AUTH_SECRET=replace-with-long-random-string

# Branding & limits
PUBLIC_APP_NAME=My Drive
BODY_SIZE_LIMIT=1000M
MAX_UPLOAD_BYTES=0
LOCAL_DRIVE_DATA_DIR=/data/znl-drive
LOCAL_DRIVE_HOST_PATH=./data/znl-drive

# Behind nginx / Caddy
PROTOCOL_HEADER=x-forwarded-proto
HOST_HEADER=x-forwarded-host

# OAuth
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Tigris
TIGRIS_STORAGE_ACCESS_KEY_ID=
TIGRIS_STORAGE_SECRET_ACCESS_KEY=
TIGRIS_STORAGE_BUCKET=
TIGRIS_STORAGE_ENDPOINT=https://t3.storage.dev
TIGRIS_STORAGE_IAM_ENDPOINT=https://iam.storage.dev
TIGRIS_STORAGE_REGION=auto

# Encryption & cron
FILE_ENCRYPTION_KEY=
CRON_SECRET=

# Email
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=
```

## Scheduled trash purge

With `CRON_SECRET` set, call from cron on the host or a scheduler:

```bash
curl -X POST -H "Authorization: Bearer $CRON_SECRET" \
  "$ORIGIN/api/cron/purge-trash"
```

## Troubleshooting

- **Login or upload fails with “Cross-site POST form submissions are forbidden”** — `ORIGIN` does not match the browser URL, or proxy headers are set without a trusted reverse proxy.
- **OTP “expired” on HTTP LAN** — ensure `ORIGIN` uses `http://` (not `https://`) when there is no TLS.
- **Local files missing after restart** — bind-mount a host directory to `/data/znl-drive` (`LOCAL_DRIVE_HOST_PATH` in Compose or `-v /host/path:/data/znl-drive` with `docker run`).
- **Upload fails on large files** — increase `BODY_SIZE_LIMIT`, ensure disk space for chunk assembly, check `MAX_UPLOAD_BYTES`.
- **Database errors** — confirm `DATABASE_URL` is reachable from the container network and schema was pushed with `pnpm db:push`.

## Related

- [Environment and database](./env-and-db) — `.env` reference and Drizzle tasks
- [Storage providers](../user/storage-providers) — Local vs Tigris in the UI
- Repository root `README.md` — Fly.io deploy and CI notes
