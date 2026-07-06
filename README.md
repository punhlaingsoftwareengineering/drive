# ZNL-DRIVE

ZNL-DRIVE is a SvelteKit app that provides a simple “drive” experience with **local filesystem** storage and **Tigris object storage** support, plus user authentication and a REST-ish API for file operations.

## Features

- **Auth**: Better Auth (email/password + optional GitHub/Google OAuth)
- **Storage providers**:
  - **Local** (files stored on the server’s filesystem)
  - **Tigris** (S3-compatible object storage via `@tigrisdata/storage`)
- **Drive UI**: files/folders, shared items, trash, dashboard stats
- **Docs**: onboarding documentation via mdsvex (user manual, contributor guides, **[REST API reference](/onboarding/docs/developer)**)
- **UI**: Tailwind CSS + DaisyUI (prefixed classes `d-...`)

## Tech stack

- **SvelteKit** + **Svelte 5** (adapter-node)
- **pnpm** + **Node.js** for install, dev, build, and scripts
- **Postgres** via **Drizzle ORM** (Neon serverless driver)
- **Better Auth** sessions/cookies
- **Tigris Storage** SDK

## Quick start (local development)

### Prerequisites

- [pnpm](https://pnpm.io/installation) — install deps and run scripts
- [Node.js](https://nodejs.org/) 20+ — dev, build, and production runtime (Docker)
- Postgres database (local or hosted)

### Setup

1. Install dependencies:

```bash
pnpm install
```

2. Create an `.env` file:

```bash
cp .env.example .env
```

3. Fill in required variables in `.env`:

- `DATABASE_URL`
- `ORIGIN` (local example: `http://localhost:1025`)
- `BETTER_AUTH_SECRET`

4. Push DB schema:

```bash
pnpm db:push
```

5. Start dev server:

```bash
pnpm dev
```

Open `http://localhost:1025`.

## Environment variables

See `.env.example`. Key variables:

- **`DATABASE_URL`**: Postgres connection string
- **`ORIGIN`**: public site URL (no trailing slash)
  - local: `http://localhost:1025`
  - LAN: `http://192.168.x.x:1025` (exact URL users type in the browser)
  - Fly.io: `https://YOUR_APP.fly.dev` (or your custom domain)
- **`PORT`**: listen port for adapter-node (default `1025` in Docker/Fly)
- **`BETTER_AUTH_SECRET`**: required in production (use a strong random secret)
- **OAuth (optional)**:
  - `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`
  - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`

## Database workflows

Common tasks (from `package.json`):

- **`pnpm db:push`**: push schema to the database
- **`pnpm db:generate`**: generate migrations (if you’re using migrations)
- **`pnpm db:migrate`**: run migrations
- **`pnpm db:studio`**: open Drizzle Studio

## Storage providers

This project supports:

- **Local**: files are stored on the server’s filesystem (good for dev and single-node deployments).
- **Tigris**: objects stored in Tigris buckets via `@tigrisdata/storage`.

If you add another provider later, the cleanest next step is typically another **S3-compatible** backend (AWS S3, Cloudflare R2, MinIO, Backblaze B2 S3 API, Wasabi, etc.).

## Deployment

This repo ships with a Dockerfile, optional `docker-compose.yml`, and Fly.io config (`fly.toml`).

### Docker (local server or cloud VM)

Full reference (pull, build, Compose, every env var): open **`/onboarding/docs/contribute/docker`** in the app documentation.

```bash
docker build -t znl-drive .
docker run -p 1025:1025 \
  -v /path/on/host/znl-drive:/data/znl-drive \
  -e ORIGIN=http://YOUR_HOST:1025 \
  -e BETTER_AUTH_SECRET=... \
  -e DATABASE_URL='postgresql://...' \
  znl-drive
```

The image sets `BODY_SIZE_LIMIT=8M` (per chunk), `LOCAL_DRIVE_DATA_DIR=/data/znl-drive`, and `MAX_UPLOAD_BYTES=0` (unlimited single-file size). **Bind-mount a host directory** to `/data/znl-drive` when using **Local** storage so files live on your real disk (not inside the container filesystem). With Compose, set `LOCAL_DRIVE_HOST_PATH` in `.env` (default `./data/znl-drive`). Large files (e.g. MP4) are assembled on disk under `.upload-sessions/` during chunked upload; ensure enough free disk for roughly **2× the file size** during finalize.

Or with compose (bind-mounts host disk automatically):

```bash
docker compose up --build
```

### Deployment matrix (avoid CSRF / login errors)

SvelteKit verifies form POST origins. Set env vars to match how users reach the app:

| Scenario                               | Required env                                                                         |
| -------------------------------------- | ------------------------------------------------------------------------------------ |
| Direct access (LAN/cloud VM, no proxy) | `ORIGIN=http://YOUR_IP:1025`                                                         |
| Fly.io / cloud with TLS terminator     | `ORIGIN=https://your-domain` + `PROTOCOL_HEADER` + `HOST_HEADER` (in `fly.toml`)     |
| nginx / Caddy / Traefik in front       | `ORIGIN` + proxy headers; proxy must send `X-Forwarded-Proto` and `X-Forwarded-Host` |

Do **not** set `PROTOCOL_HEADER` / `HOST_HEADER` when accessing the container directly without a trusted reverse proxy.

### Fly.io

Required secrets (examples):

```bash
fly secrets set ORIGIN=https://YOUR_APP.fly.dev
fly secrets set BETTER_AUTH_SECRET=YOUR_LONG_RANDOM_SECRET
fly secrets set DATABASE_URL='postgresql://...'
```

`fly.toml` sets `internal_port = 1025`, `PORT=1025`, `PROTOCOL_HEADER`, and `HOST_HEADER` for Fly’s TLS edge.

### GitHub Actions deploy

Deployment is done via `.github/workflows/fly-deploy.yml` using:

- `flyctl deploy --remote-only`

Note: Docker image builds run without Fly secrets. Auth initialization is **build-safe** (placeholders during `pnpm build`) but the app still requires real `ORIGIN`/`BETTER_AUTH_SECRET` at runtime in production.

## Troubleshooting (production)

- **Login fails with “Cross-site POST form submissions are forbidden”**
  - Set `ORIGIN` to the exact browser URL (e.g. `http://10.100.100.67:1025`, not `localhost`)
  - Do not set `PROTOCOL_HEADER` / `HOST_HEADER` when accessing the container directly over HTTP
  - Behind a reverse proxy: set proxy headers and `ORIGIN=https://your-domain`
- **OTP “expired” immediately on HTTP LAN**
  - Caused by `Secure` cookies on plain HTTP — fixed when `ORIGIN` uses `http://` (cookies are only Secure for `https://` origins)
  - Rebuild/redeploy after updating `ORIGIN`, then request a new OTP
- **Upload fails with “Cross-site POST form submissions are forbidden”**
  - Uploads use binary `application/octet-stream` (not multipart) — rebuild/redeploy if you still see this on an old image
  - Ensure `ORIGIN` matches the browser URL exactly (e.g. `http://10.100.100.67:1025`)
- **Build fails complaining about Better Auth secret**
  - Runtime must have `BETTER_AUTH_SECRET` set
  - CI/Docker builds should pass without secrets (placeholders are used only during the build step)
- **Database unavailable**
  - Confirm `DATABASE_URL` is set and reachable from your app region/host

## Scripts

From `package.json`:

- `pnpm dev` — dev server (port 1025)
- `pnpm build` — production build
- `pnpm preview` — preview build (port 1025)
- `pnpm check` — svelte-check
- `pnpm lint` / `pnpm format`
- `pnpm test` — unit + e2e

## License

GPLv3 — see `LICENSE`.
