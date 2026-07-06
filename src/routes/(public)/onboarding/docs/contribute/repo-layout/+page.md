# Repository layout

## `src/routes`

- **`(public)/`** — marketing and onboarding, anonymous share pages, etc.
- **`(private)/home/`** — authenticated drive UI (sidebar, navbar, dialogs).
- **`(public)/onboarding/docs/`** — this documentation site at `/onboarding/docs` (public, prerendered). Uses **`+layout@.svelte`** so docs only inherit the root layout, not the onboarding marketing chrome.
- **`api/`** — REST handlers (`auth`, `drive`, `developer`, `public`, `cron`). When adding or changing a handler, update the [developer REST API docs](/onboarding/docs/developer/rest-api) and the relevant detail page ([Drive API](/onboarding/docs/developer/drive-api), [Teams API](/onboarding/docs/developer/teams-api), or [Other endpoints](/onboarding/docs/developer/other-endpoints)).
- **`[token]/`** — public share preview at `/<token>` (dynamic segment at root).

Route groups in parentheses do not affect the URL.

## `src/lib/server`

Auth helpers, Drizzle `db`, storage adapters, drive logic (`requireApiSession`, trash purge, uploads, ZIP building, etc.). Only import from server layouts, `+page.server.ts`, or `+server.ts`.

## `src/lib/client`

Browser-only helpers: session-aware `fetch`, upload progress, small state modules used by components.

## Database schema

Schema modules live under `src/lib/server/db/schema/` (for example `auth-schema`, `main-schema`). Keep TypeScript models (like `STORAGE_PROVIDERS`) aligned with Drizzle tables.
