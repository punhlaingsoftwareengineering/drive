# Environment and database

## Environment variables

Create a **`.env`** file locally (never commit secrets). Typical values include database URL, auth secrets, email transport if used, object storage credentials for remote providers, and **`CRON_SECRET`** for the trash purge endpoint.

Use **`$env/dynamic/private`** or static `$env/static/private` in server code as elsewhere in the project.

Set **`ORIGIN`** to the exact URL users type in the browser (e.g. `http://localhost:1025` for local dev).

## Database workflow

From `deno.json` tasks:

- **`deno task db:push`** — push Drizzle schema to the database (fast iteration).
- **`deno task db:generate`** — generate SQL migrations from schema drift.
- **`deno task db:migrate`** — apply migrations.
- **`deno task db:studio`** — open Drizzle Studio against your database.

Neon (or any Postgres) works as long as the connection string matches Drizzle’s driver configuration.

## Auth schema

When Better Auth schema changes, the repo may include a helper script such as `deno task auth:schema` to regenerate typed tables—run it after updating auth config if the project documents that step.
