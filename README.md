# ZNL-DRIVE

ZNL-DRIVE is a SvelteKit app that provides a simple “drive” experience with **local filesystem** storage and **Tigris object storage** support, plus user authentication and a REST-ish API for file operations.

## Features

- **Auth**: Better Auth (email/password + optional GitHub/Google OAuth)
- **Storage providers**:
  - **Local** (files stored on the server’s filesystem)
  - **Tigris** (S3-compatible object storage via `@tigrisdata/storage`)
- **Drive UI**: files/folders, shared items, trash, dashboard stats
- **Docs**: onboarding documentation via mdsvex
- **UI**: Tailwind CSS + DaisyUI (prefixed classes `d-...`)

## Tech stack

- **SvelteKit** + **Svelte 5** (adapter-node)
- **Deno 2** for install, dev, build, and scripts
- **Postgres** via **Drizzle ORM** (Neon serverless driver)
- **Better Auth** sessions/cookies
- **Tigris Storage** SDK

## Quick start (local development)

### Prerequisites

- [Deno 2.x](https://docs.deno.com/runtime/getting_started/installation/) — install deps and run tasks (`deno task …`)
- Node.js — used by Vite/SvelteKit build CLI (Deno’s npm runner breaks tsconfig `extends` resolution); also the production runtime in Docker
- Postgres database (local or hosted)

### Setup

1. Install dependencies:

```bash
deno install
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
deno task db:push
```

5. Start dev server:

```bash
deno task dev
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

Common tasks (from `deno.json`):

- **`deno task db:push`**: push schema to the database
- **`deno task db:generate`**: generate migrations (if you’re using migrations)
- **`deno task db:migrate`**: run migrations
- **`deno task db:studio`**: open Drizzle Studio

## Storage providers

This project supports:

- **Local**: files are stored on the server’s filesystem (good for dev and single-node deployments).
- **Tigris**: objects stored in Tigris buckets via `@tigrisdata/storage`.

If you add another provider later, the cleanest next step is typically another **S3-compatible** backend (AWS S3, Cloudflare R2, MinIO, Backblaze B2 S3 API, Wasabi, etc.).

## Deployment

This repo ships with a Dockerfile, optional `docker-compose.yml`, and Fly.io config (`fly.toml`).

### Docker (local server or cloud VM)

```bash
docker build -t znl-drive .
docker run -p 1025:1025 \
  -e ORIGIN=http://YOUR_HOST:1025 \
  -e BETTER_AUTH_SECRET=... \
  -e DATABASE_URL='postgresql://...' \
  znl-drive
```

Or with compose:

```bash
docker compose up --build
```

### Deployment matrix (avoid CSRF / login errors)

SvelteKit verifies form POST origins. Set env vars to match how users reach the app:

| Scenario | Required env |
|----------|----------------|
| Direct access (LAN/cloud VM, no proxy) | `ORIGIN=http://YOUR_IP:1025` |
| Fly.io / cloud with TLS terminator | `ORIGIN=https://your-domain` + `PROTOCOL_HEADER` + `HOST_HEADER` (in `fly.toml`) |
| nginx / Caddy / Traefik in front | `ORIGIN` + proxy headers; proxy must send `X-Forwarded-Proto` and `X-Forwarded-Host` |

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

Note: Docker image builds run without Fly secrets. Auth initialization is **build-safe** (placeholders during `deno task build`) but the app still requires real `ORIGIN`/`BETTER_AUTH_SECRET` at runtime in production.

## Troubleshooting (production)

- **Login fails with “Cross-site POST form submissions are forbidden”**
  - Ensure `ORIGIN` matches the public URL exactly (protocol + hostname + port if non-default, no trailing slash)
  - Behind a reverse proxy: set `PROTOCOL_HEADER=x-forwarded-proto` and `HOST_HEADER=x-forwarded-host`
  - On Fly: these are already in `fly.toml`; confirm `ORIGIN` secret matches your public URL
- **Build fails complaining about Better Auth secret**
  - Runtime must have `BETTER_AUTH_SECRET` set
  - CI/Docker builds should pass without secrets (placeholders are used only during the build step)
- **Database unavailable**
  - Confirm `DATABASE_URL` is set and reachable from your app region/host

## Scripts

From `deno.json`:

- `deno task dev` — dev server (port 1025)
- `deno task build` — production build
- `deno task preview` — preview build (port 1025)
- `deno task check` — svelte-check
- `deno task lint` / `deno task format`
- `deno task test` — unit + e2e

## License

GPLv3 — see `LICENSE`.
