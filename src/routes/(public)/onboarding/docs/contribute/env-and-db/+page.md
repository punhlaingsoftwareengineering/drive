# Environment and database

## Environment variables

Create a **`.env`** file locally or pass the same keys to Docker (`--env-file`, Compose). Never commit secrets. Copy from **`.env.example`** at the repo root.

For **Docker image pull, `docker run`, Compose, volumes, and proxy setup**, see [Docker deployment](./docker).

### Required (production)

| Variable | Description |
| -------- | ----------- |
| `DATABASE_URL` | Postgres connection string. Password special characters must be URL-encoded (`@` → `%40`). For LAN Postgres without TLS, append `?sslmode=disable`. |

### `DATABASE_URL` examples

```bash
# Neon / cloud (SSL)
DATABASE_URL=postgresql://user:pass@host.neon.tech:5432/db?sslmode=require

# LAN / Docker Postgres on another host (no TLS)
DATABASE_URL=postgresql://postgres:secret%40word@10.100.100.67:5432/db_drive?sslmode=disable
```

If `pnpm db:push` hangs at “Pulling schema from database…” then exits with code 1, the app cannot reach Postgres on that host:port — check VPN, firewall, `listen_addresses`, and `pg_hba.conf` on the database server.
| `ORIGIN` | Public URL users open in the browser (no trailing slash). |
| `BETTER_AUTH_SECRET` | Auth sessions, OTP, and related crypto. |

### Application

| Variable | Default | Description |
| -------- | ------- | ----------- |
| `PUBLIC_APP_NAME` | `ZNL-DRIVE` | Navbar and page title branding. |
| `PORT` | `1025` | adapter-node listen port. |
| `BODY_SIZE_LIMIT` | `8M` | Max request body; must be ≥ 8 MiB upload chunks. |
| `MAX_UPLOAD_BYTES` | `0` | Per-file byte cap; `0` = unlimited at app level. |
| `LOCAL_DRIVE_DATA_DIR` | `~/Documents/znl-drive` (dev) / `/data/znl-drive` (Docker) | **Local** storage root **inside** the app process. |
| `LOCAL_DRIVE_HOST_PATH` | `./data/znl-drive` | **Docker Compose only:** folder on the host disk bind-mounted to `LOCAL_DRIVE_DATA_DIR`. |

### Reverse proxy (HTTPS / Fly / nginx)

| Variable | Description |
| -------- | ----------- |
| `PROTOCOL_HEADER` | e.g. `x-forwarded-proto` — only behind a trusted proxy. |
| `HOST_HEADER` | e.g. `x-forwarded-host` — only behind a trusted proxy. |

### OAuth

| Variable | Description |
| -------- | ----------- |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | GitHub sign-in. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google sign-in. |

### Email (signup OTP)

| Variable | Description |
| -------- | ----------- |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | Preferred SMTP transport. |
| `GMAIL_USER`, `GMAIL_APP_PASSWORD` | Fallback Gmail app-password transport. |

### Tigris storage

| Variable | Aliases | Description |
| -------- | ------- | ----------- |
| `TIGRIS_STORAGE_ACCESS_KEY_ID` | `TIGRIS_ACCESS_KEY` | Access key. |
| `TIGRIS_STORAGE_SECRET_ACCESS_KEY` | `TIGRIS_SECRET_KEY` | Secret key. |
| `TIGRIS_STORAGE_BUCKET` | `TIGRIS_BUCKET` | Bucket name. |
| `TIGRIS_STORAGE_ENDPOINT` | — | API endpoint (default `https://t3.storage.dev`). |
| `TIGRIS_STORAGE_IAM_ENDPOINT` | — | IAM endpoint (default `https://iam.storage.dev`). |
| `TIGRIS_STORAGE_REGION` | — | Region (default `auto`). |

### Encryption and cron

| Variable | Description |
| -------- | ----------- |
| `FILE_ENCRYPTION_KEY` | At-rest file encryption (alias: `DRIVE_ENCRYPTION_KEY`). |
| `CRON_SECRET` | Bearer secret for `POST /api/cron/purge-trash`. |

Use **`$env/dynamic/private`** or static `$env/static/private` in server code as elsewhere in the project.

Set **`ORIGIN`** to the exact URL users type in the browser (e.g. `http://localhost:1025` for local dev).

## Database workflow

From `package.json` scripts via pnpm:

- **`pnpm db:push`** — push Drizzle schema to the database (fast iteration).
- **`pnpm db:generate`** — generate SQL migrations from schema drift.
- **`pnpm db:migrate`** — apply migrations.
- **`pnpm db:studio`** — open Drizzle Studio against your database.

Neon (or any Postgres) works as long as the connection string matches Drizzle’s driver configuration. The app uses the standard **`pg`** driver (TCP) — suitable for self-hosted Postgres, Docker, and Neon pooled URLs. Use `?sslmode=disable` on LAN hosts without TLS.

Run **`pnpm db:push`** from your workstation (or CI) before pointing the Docker container at the database.

## Auth schema

When Better Auth schema changes, the repo may include a helper script such as `auth:schema` to regenerate typed tables—run it after updating auth config if the project documents that step.
