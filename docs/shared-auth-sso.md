# Shared Better Auth SSO (employee-portal ↔ PHH-DRIVE ↔ docs)

See [employee-portal/docs/shared-auth-sso.md](../../employee-portal/docs/shared-auth-sso.md) for the full env contract.

employee-portal owns Caddy (`pnpm caddy:dev` / `Caddyfile.generated` from `.env`). Drive only needs matching env vars and `pnpm dev` on port 1025.

**docs** is the third SSO app (port 1026). See [docs/docs/DEPLOYMENT.md](../../docs/docs/DEPLOYMENT.md) for docs-specific CMS vs auth database split.

## Local `.env`

```env
ORIGIN=http://drive.local.test
PORTAL_ORIGIN=http://portal.local.test
AUTH_COOKIE_DOMAIN=.local.test
BETTER_AUTH_SECRET=<same as portal>
AUTH_DATABASE_URL=<portal postgres URL>
```

## Portal media uploads

Employee portal stores admin media (images, PDFs, video, audio) on team drive via a server-side `znltv_` key. See [employee-portal/docs/drive-media-integration.md](../../employee-portal/docs/drive-media-integration.md).

## Production `.env`

```env
ORIGIN=https://office.drive.phh.com
PORTAL_ORIGIN=https://phh.com
AUTH_COOKIE_DOMAIN=.phh.com
BETTER_AUTH_SECRET=<same as portal>
AUTH_DATABASE_URL=<portal postgres URL>
```
